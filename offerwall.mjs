// 외부 오퍼월 연동: 최고관리자가 만든 퀴즈·설문 페이지를 버즈빌·애드팝콘 같은 오퍼월 매체에 공급합니다.
//
//  1) 매체 서버가 서명된 오퍼 목록 API(GET /ow/v1/offers)로 진행 중인 오퍼와 랜딩 주소를 받아 갑니다.
//  2) 매체 회원이 오퍼를 누르면 매체가 클릭 ID·회원 식별값·시각·서명을 붙여 /ow/<오퍼>로 보냅니다.
//  3) 애즈폼은 서명과 중복을 검사해 참여 세션을 만들고, 참여 페이지에서 퀴즈·설문을 받습니다.
//  4) 정답(또는 설문 검수 승인)이면 매체의 포스트백 주소로 서명된 완료 알림을 보내고,
//     매체가 자기 회원에게 리워드를 지급합니다. 실패하면 간격을 늘려 다시 보냅니다.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { lookup as dnsLookup } from 'node:dns';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP } from 'node:net';
import { resolve } from 'node:path';

export const presets = {
  buzzvil: { name: '버즈빌', click_param: 'click_id', user_param: 'user_id' },
  adpopcorn: { name: '애드팝콘', click_param: 'click_key', user_param: 'usn' },
  custom: { name: '', click_param: 'click_id', user_param: 'user_id' }
};
const macros = ['click_id', 'user_id', 'offer_id', 'transaction_id', 'price', 'reward', 'timestamp', 'signature'];
const idPattern = /^[A-Za-z0-9._:~=+/-]{1,256}$/;
const paramPattern = /^[a-z][a-z0-9_]{0,31}$/;
const slugPattern = /^[A-Za-z0-9_-]{12}$/;
const landingSkew = 15 * 60;      // 랜딩 서명 시각 허용 오차(초)
const apiSkew = 5 * 60;           // 오퍼 목록 API 서명 시각 허용 오차(초)
const clickMinutes = 60;          // 랜딩 후 제출할 수 있는 시간
const backoff = [60, 300, 1800, 7200, 21600]; // 포스트백 재시도 간격(초), 6번째 실패 시 중단
const maxPostbackAttempts = backoff.length + 1;

const hmac = (secret, text) => createHmac('sha256', secret).update(text).digest('hex');
const sameHex = (a, b) => typeof a === 'string' && typeof b === 'string' && /^[a-f0-9]{64}$/i.test(a) &&
  timingSafeEqual(Buffer.from(a.toLowerCase(), 'hex'), Buffer.from(b, 'hex'));
const sha = text => createHash('sha256').update(text).digest('hex');

// 포스트백이 내부망·클라우드 메타데이터 주소로 향하지 않도록 막습니다(SSRF 방지).
const blocked = new BlockList();
for (const [net, bits] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]]) {
  blocked.addSubnet(net, bits, 'ipv4');
}
for (const [net, bits] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['64:ff9b::', 96], ['2001:db8::', 32]]) blocked.addSubnet(net, bits, 'ipv6');
export function isPrivateAddress(address) {
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  if (mapped) return isPrivateAddress(mapped);
  const family = isIP(address);
  return !family || blocked.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

function parseAllowlist(text) {
  const list = new BlockList();
  const items = text.split(/[\s,]+/).filter(Boolean);
  for (const item of items) {
    const [address, bits] = item.split('/');
    const family = isIP(address);
    if (!family) throw new Error(item);
    const type = family === 4 ? 'ipv4' : 'ipv6';
    if (bits === undefined) list.addAddress(address, type);
    else {
      const prefix = Number(bits);
      if (!/^\d+$/.test(bits) || prefix > (family === 4 ? 32 : 128)) throw new Error(item);
      list.addSubnet(address, prefix, type);
    }
  }
  return { list, items };
}
const allowed = (allowlist, ip) => {
  if (!allowlist) return true;
  const address = ip.replace(/^::ffff:(?=\d+\.)/i, '');
  const family = isIP(address);
  return Boolean(family) && parseAllowlist(allowlist).list.check(address, family === 4 ? 'ipv4' : 'ipv6');
};

export function setupOfferwall(ctx) {
  const { db, get, all, run, transaction, audit, assert, fail, str, int, date, limit, hits, hit, clientIp, now, dateKst, dayStart,
    session, json, headers, readBody, root, dataDir, allowPrivate } = ctx;

  db.exec(`
    CREATE TABLE IF NOT EXISTS ow_networks (
      id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, preset TEXT NOT NULL DEFAULT 'custom',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
      api_key TEXT NOT NULL UNIQUE, secret_enc TEXT NOT NULL,
      click_param TEXT NOT NULL, user_param TEXT NOT NULL, sign_landing INTEGER NOT NULL DEFAULT 1,
      postback_url TEXT NOT NULL DEFAULT '', postback_method TEXT NOT NULL DEFAULT 'GET' CHECK (postback_method IN ('GET','POST')),
      ip_allowlist TEXT NOT NULL DEFAULT '', created TEXT NOT NULL, updated TEXT, rotated TEXT
    );
    CREATE TABLE IF NOT EXISTS ow_offers (
      id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, brand TEXT NOT NULL, intro TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('quiz','survey')), questions TEXT NOT NULL, review INTEGER NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 1, min_dwell INTEGER NOT NULL DEFAULT 5, goal INTEGER NOT NULL, daily_cap INTEGER,
      ip_daily_limit INTEGER NOT NULL DEFAULT 30, start_date TEXT NOT NULL, end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','closed')), reason TEXT NOT NULL DEFAULT '',
      created_by INTEGER REFERENCES users(id), created TEXT NOT NULL, updated TEXT
    );
    CREATE TABLE IF NOT EXISTS ow_placements (
      offer_id INTEGER NOT NULL REFERENCES ow_offers(id), network_id INTEGER NOT NULL REFERENCES ow_networks(id),
      price INTEGER NOT NULL, reward INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
      PRIMARY KEY (offer_id, network_id)
    );
    CREATE TABLE IF NOT EXISTS ow_clicks (
      id INTEGER PRIMARY KEY, offer_id INTEGER NOT NULL REFERENCES ow_offers(id), network_id INTEGER NOT NULL REFERENCES ow_networks(id),
      click_id TEXT NOT NULL, network_user TEXT NOT NULL, token TEXT NOT NULL UNIQUE, ip TEXT NOT NULL, ua TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('started','pending','completed','failed','rejected','expired')),
      tries INTEGER NOT NULL DEFAULT 0, answers TEXT, reason TEXT NOT NULL DEFAULT '', price INTEGER NOT NULL, reward INTEGER NOT NULL,
      created TEXT NOT NULL, opened INTEGER NOT NULL, expires INTEGER NOT NULL, finished TEXT,
      UNIQUE (network_id, click_id), UNIQUE (offer_id, network_id, network_user)
    );
    CREATE INDEX IF NOT EXISTS ow_clicks_offer ON ow_clicks(offer_id, status, finished);
    CREATE INDEX IF NOT EXISTS ow_clicks_ip ON ow_clicks(offer_id, ip, created);
    CREATE TABLE IF NOT EXISTS ow_postbacks (
      id INTEGER PRIMARY KEY, click_ref INTEGER NOT NULL UNIQUE REFERENCES ow_clicks(id), network_id INTEGER NOT NULL REFERENCES ow_networks(id),
      status TEXT NOT NULL CHECK (status IN ('queued','sending','sent','failed')), attempts INTEGER NOT NULL DEFAULT 0,
      next_at INTEGER NOT NULL, last_code INTEGER, last_error TEXT NOT NULL DEFAULT '', created TEXT NOT NULL, sent TEXT
    );
    CREATE INDEX IF NOT EXISTS ow_postbacks_due ON ow_postbacks(status, next_at);
  `);
  // 서버가 비정상 종료돼 '전송 중'으로 남은 포스트백은 다시 보냅니다. 거래 번호가 같아 매체 쪽에서 중복 처리됩니다.
  run("UPDATE ow_postbacks SET status='queued' WHERE status='sending'");

  /* ---------- 매체 비밀키 암호화 저장 ---------- */
  // 키 파일은 매체를 처음 등록할 때 만듭니다. 운영에서는 ADSFORM_SECRET_KEY로 DB와 분리해 보관하는 것을 권장합니다.
  let cachedKey;
  const masterKey = () => cachedKey ||= (() => {
    const env = process.env.ADSFORM_SECRET_KEY;
    if (env) {
      const key = /^[a-f0-9]{64}$/i.test(env) ? Buffer.from(env, 'hex') : Buffer.from(env, 'base64');
      if (key.length !== 32) throw new Error('ADSFORM_SECRET_KEY must be 32 bytes (64 hex characters or base64).');
      return key;
    }
    const file = resolve(dataDir, 'secret.key');
    if (!existsSync(file)) writeFileSync(file, randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' });
    try { chmodSync(file, 0o600); } catch { /* Windows */ }
    return Buffer.from(readFileSync(file, 'utf8').trim(), 'hex');
  })();
  if (process.env.ADSFORM_SECRET_KEY) masterKey(); // 형식이 틀리면 시작할 때 바로 알립니다.
  const seal = text => {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', masterKey(), iv);
    cipher.setAAD(Buffer.from('adsform-ow-secret'));
    const body = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return ['v1', iv, cipher.getAuthTag(), body].map(part => typeof part === 'string' ? part : part.toString('base64url')).join(':');
  };
  const open = sealed => {
    const [version, iv, tag, body] = sealed.split(':');
    assert(version === 'v1', '매체 비밀키를 읽을 수 없습니다.', 500);
    const decipher = createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(iv, 'base64url'));
    decipher.setAAD(Buffer.from('adsform-ow-secret'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
  };
  const secretOf = network => {
    try { return open(network.secret_enc); } catch { fail(500, '매체 비밀키를 복호화할 수 없습니다. ADSFORM_SECRET_KEY를 확인해 주세요.'); }
  };

  /* ---------- 검증 ---------- */
  const flag = value => value === true || value === '1' || value === 'on' ? 1 : 0;
  const optionalInt = (value, label, min, max) => value === undefined || value === null || value === '' || value === '0' ? null : int(value, label, min, max);

  function postbackTemplate(value) {
    const url = str(value ?? '', '포스트백 주소', 1000, 0);
    if (!url) return '';
    const unknown = [...url.matchAll(/\{([a-z_]+)\}/g)].map(m => m[1]).filter(name => !macros.includes(name));
    assert(!unknown.length, `지원하지 않는 매크로입니다: {${unknown.join('}, {')}}`);
    let parsed;
    try { parsed = new URL(url.replace(/\{[a-z_]+\}/g, 'x')); } catch { fail(400, '포스트백 주소 형식을 확인해 주세요.'); }
    assert(parsed.protocol === 'https:' || (allowPrivate && parsed.protocol === 'http:'), '포스트백 주소는 https://로 시작해야 합니다.');
    assert(!parsed.username && !parsed.password, '포스트백 주소에 계정 정보를 넣을 수 없습니다.');
    const host = parsed.hostname.replace(/^\[|\]$/g, '');
    assert(allowPrivate || !(isIP(host) ? isPrivateAddress(host) : /^(localhost|.*\.local|.*\.internal)$/i.test(host)), '내부망 주소로는 포스트백을 보낼 수 없습니다.');
    assert(url.includes('{click_id}') || url.includes('{transaction_id}'), '포스트백 주소에 {click_id} 매크로를 넣어 주세요.');
    return url;
  }

  function networkFields(body, existing) {
    const name = str(body.name, '매체 이름', 40);
    const clickParam = str(body.click_param, '클릭 ID 파라미터', 32).toLowerCase();
    const userParam = str(body.user_param, '회원 식별 파라미터', 32).toLowerCase();
    for (const param of [clickParam, userParam]) {
      assert(paramPattern.test(param) && !['nw', 'ts', 'sig', 'preview'].includes(param), '파라미터 이름은 영문 소문자로 시작하고 영문·숫자·밑줄만 쓸 수 있어요. (nw, ts, sig 제외)');
    }
    assert(clickParam !== userParam, '클릭 ID와 회원 식별 파라미터는 달라야 합니다.');
    const allowlist = str(body.ip_allowlist ?? '', '허용 IP', 500, 0);
    let items = [];
    try { items = parseAllowlist(allowlist).items; } catch (error) { fail(400, `허용 IP 형식을 확인해 주세요: ${error.message}`); }
    const method = body.postback_method === 'POST' ? 'POST' : 'GET';
    return { name, clickParam, userParam, signLanding: flag(body.sign_landing), postbackUrl: postbackTemplate(body.postback_url), method,
      allowlist: items.join(', '), status: body.status === 'paused' ? 'paused' : existing?.status || 'active' };
  }

  const newKey = () => 'awk_' + randomBytes(12).toString('hex');
  const newSecret = () => 'aws_' + randomBytes(32).toString('base64url');

  function createNetwork(user, body) {
    assert(Object.hasOwn(presets, body.preset), '매체 유형을 선택해 주세요.');
    const code = str(body.code, '매체 코드', 20, 2).toLowerCase();
    assert(/^[a-z][a-z0-9-]{1,19}$/.test(code), '매체 코드는 영문 소문자로 시작하는 2~20자(영문·숫자·하이픈)로 입력해 주세요.');
    const fields = networkFields(body);
    return transaction(() => {
      assert(!get('SELECT 1 FROM ow_networks WHERE code=?', code), '이미 등록된 매체 코드입니다.', 409);
      const secret = newSecret();
      const apiKey = newKey();
      const id = Number(run(`INSERT INTO ow_networks(code,name,preset,status,api_key,secret_enc,click_param,user_param,sign_landing,postback_url,postback_method,ip_allowlist,created)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, code, fields.name, body.preset, 'active', apiKey, seal(secret), fields.clickParam, fields.userParam,
        fields.signLanding, fields.postbackUrl, fields.method, fields.allowlist, now()).lastInsertRowid);
      audit(user.id, '오퍼월 매체 등록', `ow-network:${id}`, `${fields.name} (${code})`);
      return { id, apiKey, secret };
    });
  }

  function updateNetwork(user, body) {
    const id = int(body.id, '매체 번호', 1, 1e9);
    return transaction(() => {
      const network = get('SELECT * FROM ow_networks WHERE id=?', id);
      assert(network, '매체를 찾을 수 없습니다.', 404);
      const fields = networkFields(body, network);
      run(`UPDATE ow_networks SET name=?,status=?,click_param=?,user_param=?,sign_landing=?,postback_url=?,postback_method=?,ip_allowlist=?,updated=? WHERE id=?`,
        fields.name, fields.status, fields.clickParam, fields.userParam, fields.signLanding, fields.postbackUrl, fields.method, fields.allowlist, now(), id);
      const changes = [network.postback_url !== fields.postbackUrl && '포스트백 주소', network.sign_landing !== fields.signLanding && `랜딩 서명 ${fields.signLanding ? '켬' : '끔'}`,
        network.ip_allowlist !== fields.allowlist && '허용 IP', network.status !== fields.status && fields.status].filter(Boolean).join(' · ');
      audit(user.id, '오퍼월 매체 수정', `ow-network:${id}`, changes || '설정 저장');
      return {};
    });
  }

  function rotateNetwork(user, body) {
    const id = int(body.id, '매체 번호', 1, 1e9);
    assert(body.confirm === '재발급', '확인란에 ‘재발급’을 입력해 주세요.');
    return transaction(() => {
      const network = get('SELECT * FROM ow_networks WHERE id=?', id);
      assert(network, '매체를 찾을 수 없습니다.', 404);
      const secret = newSecret();
      const apiKey = newKey();
      run('UPDATE ow_networks SET api_key=?, secret_enc=?, rotated=? WHERE id=?', apiKey, seal(secret), now(), id);
      audit(user.id, '오퍼월 매체 키 재발급', `ow-network:${id}`, network.name);
      return { id, apiKey, secret };
    });
  }

  function questionsFrom(kind, body) {
    const questions = [];
    for (let n = 1; n <= 10; n++) {
      const prompt = typeof body[`q${n}_prompt`] === 'string' ? body[`q${n}_prompt`].trim() : '';
      if (!prompt) continue;
      assert(prompt.length <= 200, `${n}번 문항은 200자 이내로 입력해 주세요.`);
      if (kind === 'survey') { questions.push({ prompt }); continue; }
      const choices = [1, 2, 3, 4, 5].map(i => body[`q${n}_c${i}`]).filter(value => typeof value === 'string' && value.trim()).map(value => str(value, `${n}번 선택지`, 60));
      assert(choices.length >= 2, `${n}번 문항의 선택지를 2개 이상 입력해 주세요.`);
      assert(new Set(choices).size === choices.length, `${n}번 문항의 선택지가 서로 같습니다.`);
      const answer = int(body[`q${n}_answer`], `${n}번 정답`, 1, choices.length) - 1;
      questions.push({ prompt, choices, answer });
    }
    assert(questions.length >= 1, '문항을 1개 이상 입력해 주세요.');
    return questions;
  }

  function offerFields(body, existing) {
    const kind = existing?.kind || body.kind;
    assert(['quiz', 'survey'].includes(kind), '오퍼 유형을 선택해 주세요.');
    const goal = int(body.goal, '목표 완료 수', 1, 1000000);
    const start = date(body.start);
    const end = date(body.end);
    assert(end >= start && end >= dateKst(), '시작일과 종료일을 확인해 주세요.');
    const cap = optionalInt(body.daily_cap, '일일 한도', 1, goal);
    return {
      kind, title: str(body.title, '오퍼 제목', 80), brand: str(body.brand, '브랜드명', 50), intro: str(body.intro, '오퍼 소개', 1000),
      questions: questionsFrom(kind, body), review: kind === 'survey' ? flag(body.review) : 0,
      attempts: kind === 'quiz' ? int(body.attempts || 1, '응시 횟수', 1, 5) : 1, minDwell: int(body.min_dwell ?? 5, '최소 체류 시간', 0, 600),
      goal, cap, ipLimit: int(body.ip_daily_limit || 30, 'IP당 하루 참여 수', 1, 10000), start, end
    };
  }

  function savePlacements(offerId, body) {
    for (const network of all('SELECT id FROM ow_networks')) {
      const on = flag(body[`p${network.id}_on`]);
      const current = get('SELECT * FROM ow_placements WHERE offer_id=? AND network_id=?', offerId, network.id);
      if (!on && !current) continue;
      if (!on) { run("UPDATE ow_placements SET status='paused' WHERE offer_id=? AND network_id=?", offerId, network.id); continue; }
      const price = int(body[`p${network.id}_price`], '매체 단가', 0, 1000000);
      const reward = int(body[`p${network.id}_reward`], '매체 리워드', 0, 1000000);
      run(`INSERT INTO ow_placements(offer_id,network_id,price,reward,status) VALUES (?,?,?,?, 'active')
        ON CONFLICT(offer_id,network_id) DO UPDATE SET price=excluded.price, reward=excluded.reward, status='active'`, offerId, network.id, price, reward);
    }
  }

  function createOffer(user, body) {
    const f = offerFields(body);
    return transaction(() => {
      const slug = randomBytes(9).toString('base64url');
      const id = Number(run(`INSERT INTO ow_offers(slug,title,brand,intro,kind,questions,review,attempts,min_dwell,goal,daily_cap,ip_daily_limit,start_date,end_date,status,created_by,created)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',?,?)`, slug, f.title, f.brand, f.intro, f.kind, JSON.stringify(f.questions), f.review, f.attempts, f.minDwell,
        f.goal, f.cap, f.ipLimit, f.start, f.end, user.id, now()).lastInsertRowid);
      savePlacements(id, body);
      audit(user.id, '오퍼월 오퍼 등록', `ow-offer:${id}`, f.title);
      return { id, slug };
    });
  }

  function updateOffer(user, body) {
    const id = int(body.id, '오퍼 번호', 1, 1e9);
    return transaction(() => {
      const offer = get('SELECT * FROM ow_offers WHERE id=?', id);
      assert(offer, '오퍼를 찾을 수 없습니다.', 404);
      assert(offer.status !== 'closed', '종료된 오퍼는 고칠 수 없습니다.', 409);
      const f = offerFields(body, offer);
      const used = get("SELECT COUNT(*) AS total FROM ow_clicks WHERE offer_id=? AND status IN ('completed','pending')", id).total;
      assert(f.goal >= used, `이미 완료·검수 중인 ${used}건보다 목표를 낮출 수 없습니다.`, 409);
      // 진행 중에 문항·정답을 바꾸면 참여 중인 회원의 판정이 달라지므로 일시중지·작성 중일 때만 허용합니다.
      const contentChanged = JSON.stringify(f.questions) !== offer.questions || f.attempts !== offer.attempts || f.review !== offer.review;
      assert(!contentChanged || offer.status !== 'active', '진행 중인 오퍼의 문항·정답·응시 횟수는 일시중지한 뒤 고칠 수 있어요.', 409);
      run(`UPDATE ow_offers SET title=?,brand=?,intro=?,questions=?,review=?,attempts=?,min_dwell=?,goal=?,daily_cap=?,ip_daily_limit=?,start_date=?,end_date=?,updated=? WHERE id=?`,
        f.title, f.brand, f.intro, JSON.stringify(f.questions), f.review, f.attempts, f.minDwell, f.goal, f.cap, f.ipLimit, f.start, f.end, now(), id);
      savePlacements(id, body);
      audit(user.id, '오퍼월 오퍼 수정', `ow-offer:${id}`, f.title);
      return {};
    });
  }

  function offerStatus(user, body) {
    const id = int(body.id, '오퍼 번호', 1, 1e9);
    const transitions = { draft: { activate: 'active', close: 'closed' }, active: { pause: 'paused', close: 'closed' }, paused: { activate: 'active', close: 'closed' } };
    return transaction(() => {
      const offer = get('SELECT * FROM ow_offers WHERE id=?', id);
      assert(offer, '오퍼를 찾을 수 없습니다.', 404);
      const next = transitions[offer.status]?.[body.action];
      assert(next, '현재 상태에서 처리할 수 없습니다.', 409);
      if (next === 'active') {
        assert(offer.end_date >= dateKst(), '종료일이 지난 오퍼입니다. 종료일을 먼저 늘려 주세요.', 409);
        assert(get("SELECT 1 FROM ow_placements p JOIN ow_networks n ON n.id=p.network_id WHERE p.offer_id=? AND p.status='active'", id), '공급할 매체를 하나 이상 선택해 주세요.', 409);
      }
      if (next === 'closed') assert(!get("SELECT 1 FROM ow_clicks WHERE offer_id=? AND status='pending'", id), '검수 대기 중인 설문 응답이 있어 종료할 수 없습니다.', 409);
      run('UPDATE ow_offers SET status=?, reason=?, updated=? WHERE id=?', next, next === 'closed' ? '운영자 종료' : '', now(), id);
      audit(user.id, '오퍼월 오퍼 상태 변경', `ow-offer:${id}`, next);
      return {};
    });
  }

  /* ---------- 포스트백 ---------- */
  function enqueuePostback(click) {
    run("INSERT OR IGNORE INTO ow_postbacks(click_ref,network_id,status,next_at,created) VALUES (?,?,'queued',?,?)", click.id, click.network_id, Date.now(), now());
    setImmediate(drain);
  }

  function postbackRequest(network, values) {
    const secret = secretOf(network);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const filled = { ...values, timestamp };
    filled.signature = hmac(secret, `${filled.transaction_id}.${filled.click_id}.${timestamp}`);
    const url = network.postback_url.replace(/\{([a-z_]+)\}/g, (_, name) => encodeURIComponent(filled[name] ?? ''));
    const body = network.postback_method === 'POST' ? JSON.stringify(filled) : null;
    return { url, body, signature: filled.signature, timestamp };
  }

  // DNS 응답까지 확인해 내부 주소로 연결되지 않게 하고, 리다이렉트는 따라가지 않습니다.
  function send({ url, body, signature, timestamp }) {
    return new Promise(done => {
      const target = new URL(url);
      const host = target.hostname.replace(/^\[|\]$/g, '');
      if (!allowPrivate && isIP(host) && isPrivateAddress(host)) return done({ code: 0, error: '내부망 주소로는 보낼 수 없습니다.' });
      const lookup = (hostname, options, callback) => dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
        if (error) return callback(error);
        const safe = allowPrivate ? addresses : addresses.filter(item => !isPrivateAddress(item.address));
        if (!safe.length) return callback(Object.assign(new Error('내부망으로 확인되는 주소입니다.'), { code: 'EBLOCKED' }));
        return options.all ? callback(null, safe) : callback(null, safe[0].address, safe[0].family);
      });
      const request = (target.protocol === 'https:' ? httpsRequest : httpRequest)(target, {
        method: body ? 'POST' : 'GET', lookup, timeout: 5000,
        headers: { 'User-Agent': 'Adsform-Offerwall/1.0', Accept: 'application/json, text/plain, */*', 'X-Adsform-Timestamp': timestamp, 'X-Adsform-Signature': signature,
          ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}) }
      }, response => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', chunk => { if (text.length < 2000) text += chunk; });
        response.on('end', () => done({ code: response.statusCode, text: text.slice(0, 300) }));
        response.on('error', error => done({ code: response.statusCode || 0, error: error.message }));
      });
      request.on('timeout', () => request.destroy(new Error('응답 시간 초과(5초)')));
      request.on('error', error => done({ code: 0, error: error.message }));
      request.end(body || undefined);
    });
  }

  const valuesFor = (click, offer) => ({ click_id: click.click_id, user_id: click.network_user, offer_id: offer.slug, transaction_id: `adsform-${click.id}`,
    price: String(click.price), reward: String(click.reward) });

  let draining = false;
  async function drain() {
    if (draining) return;
    draining = true;
    try {
      for (let round = 0; round < 50; round++) {
        const job = get(`SELECT p.*, c.click_id, c.network_user, c.price, c.reward, c.offer_id, o.slug FROM ow_postbacks p JOIN ow_clicks c ON c.id=p.click_ref JOIN ow_offers o ON o.id=c.offer_id
          WHERE p.status='queued' AND p.next_at<=? ORDER BY p.next_at LIMIT 1`, Date.now());
        if (!job) break;
        run("UPDATE ow_postbacks SET status='sending', attempts=attempts+1 WHERE id=?", job.id);
        const network = get('SELECT * FROM ow_networks WHERE id=?', job.network_id);
        let result;
        if (!network.postback_url) result = { code: 0, error: '포스트백 주소가 설정되지 않았습니다.' };
        else {
          try { result = await send(postbackRequest(network, valuesFor({ ...job, id: job.click_ref }, { slug: job.slug }))); }
          catch (error) { result = { code: 0, error: error.message }; }
        }
        const ok = result.code >= 200 && result.code < 300;
        const attempts = job.attempts + 1;
        const giveUp = !ok && attempts >= maxPostbackAttempts;
        run('UPDATE ow_postbacks SET status=?, next_at=?, last_code=?, last_error=?, sent=? WHERE id=?', ok ? 'sent' : giveUp ? 'failed' : 'queued',
          ok || giveUp ? 0 : Date.now() + backoff[attempts - 1] * 1000, result.code || null, ok ? '' : String(result.error || result.text || `HTTP ${result.code}`).slice(0, 300), ok ? now() : null, job.id);
        if (giveUp) audit(null, '오퍼월 포스트백 실패', `ow-click:${job.click_ref}`, `${network.name} · ${attempts}회 시도`);
      }
    } finally {
      draining = false;
    }
  }
  setInterval(() => { drain().catch(error => console.error('offerwall postback', error)); }, 15_000).unref();
  setImmediate(drain);

  async function testPostback(user, body) {
    const id = int(body.id, '매체 번호', 1, 1e9);
    const network = get('SELECT * FROM ow_networks WHERE id=?', id);
    assert(network, '매체를 찾을 수 없습니다.', 404);
    assert(network.postback_url, '포스트백 주소를 먼저 저장해 주세요.', 409);
    limit(`ow-test:${id}`, 10, 60_000);
    const stamp = Date.now();
    const result = await send(postbackRequest(network, { click_id: `adsform-test-${stamp}`, user_id: 'adsform-test-user', offer_id: 'test', transaction_id: `adsform-test-${stamp}`, price: '0', reward: '0' }));
    audit(user.id, '오퍼월 포스트백 테스트', `ow-network:${id}`, result.code ? `HTTP ${result.code}` : result.error);
    return { code: result.code, message: result.error || result.text || '' };
  }

  function retryPostback(user, body) {
    const id = int(body.id, '포스트백 번호', 1, 1e9);
    return transaction(() => {
      const job = get('SELECT * FROM ow_postbacks WHERE id=?', id);
      assert(job, '포스트백을 찾을 수 없습니다.', 404);
      assert(job.status === 'failed' || job.status === 'queued', '이미 전송된 포스트백입니다.', 409);
      run("UPDATE ow_postbacks SET status='queued', next_at=?, attempts=CASE WHEN status='failed' THEN 0 ELSE attempts END WHERE id=?", Date.now(), id);
      audit(user.id, '오퍼월 포스트백 재전송', `ow-click:${job.click_ref}`);
      setImmediate(drain);
      return {};
    });
  }

  function reviewClick(user, body) {
    const id = int(body.id, '참여 번호', 1, 1e9);
    assert(['approve', 'reject'].includes(body.action), '검수 유형을 확인해 주세요.');
    const reason = body.action === 'reject' ? str(body.reason, '반려 사유', 200) : '';
    return transaction(() => {
      const click = get('SELECT * FROM ow_clicks WHERE id=?', id);
      assert(click?.status === 'pending', '검수 대기 중인 응답이 아닙니다.', 409);
      run('UPDATE ow_clicks SET status=?, reason=?, finished=? WHERE id=?', body.action === 'approve' ? 'completed' : 'rejected', reason, now(), id);
      if (body.action === 'approve') enqueuePostback(click);
      audit(user.id, '오퍼월 설문 검수', `ow-click:${id}`, body.action === 'approve' ? 'approved' : 'rejected');
      return {};
    });
  }

  /* ---------- 관리자 조회 ---------- */
  const networkView = network => ({ id: network.id, code: network.code, name: network.name, preset: network.preset, status: network.status, api_key: network.api_key,
    click_param: network.click_param, user_param: network.user_param, sign_landing: Boolean(network.sign_landing), postback_url: network.postback_url,
    postback_method: network.postback_method, ip_allowlist: network.ip_allowlist, created: network.created, updated: network.updated, rotated: network.rotated });

  function overview(user, params, req) {
    const origin = req.site.origin;
    const networks = all('SELECT * FROM ow_networks ORDER BY id').map(networkView);
    const today = dayStart();
    const offers = all(`SELECT o.*,
      (SELECT COUNT(*) FROM ow_clicks WHERE offer_id=o.id) AS landings,
      (SELECT COUNT(*) FROM ow_clicks WHERE offer_id=o.id AND status='completed') AS completed,
      (SELECT COUNT(*) FROM ow_clicks WHERE offer_id=o.id AND status='pending') AS pending,
      (SELECT COUNT(*) FROM ow_clicks WHERE offer_id=o.id AND status IN ('failed','rejected')) AS failed,
      (SELECT COUNT(*) FROM ow_clicks WHERE offer_id=o.id AND status IN ('completed','pending') AND created>=?) AS today,
      (SELECT COALESCE(SUM(price),0) FROM ow_clicks WHERE offer_id=o.id AND status='completed') AS spend
      FROM ow_offers o ORDER BY (o.status='active') DESC, o.id DESC`, today).map(offer => ({ ...offer, questions: JSON.parse(offer.questions),
      placements: all('SELECT network_id,price,reward,status FROM ow_placements WHERE offer_id=?', offer.id) }));
    const status = ['started', 'pending', 'completed', 'failed', 'rejected', 'expired'].includes(params.get('status')) ? params.get('status') : '';
    const offerId = Number(params.get('offer')) || 0;
    const where = "(?='' OR c.status=?) AND (?=0 OR c.offer_id=?)";
    const args = [status, status, offerId, offerId];
    const total = get(`SELECT COUNT(*) AS total FROM ow_clicks c WHERE ${where}`, ...args).total;
    const pages = Math.max(1, Math.ceil(total / 30));
    const page = Math.min(Math.max(1, Number(params.get('page')) || 1), pages);
    const clicks = all(`SELECT c.id,c.offer_id,c.network_id,c.click_id,c.network_user,c.status,c.tries,c.answers,c.reason,c.price,c.reward,c.created,c.finished,c.ip,
      o.title, o.kind, o.questions, n.name AS network, p.id AS postback, p.status AS postback_status, p.attempts AS postback_attempts, p.last_code, p.last_error, p.sent
      FROM ow_clicks c JOIN ow_offers o ON o.id=c.offer_id JOIN ow_networks n ON n.id=c.network_id LEFT JOIN ow_postbacks p ON p.click_ref=c.id
      WHERE ${where} ORDER BY (c.status='pending') DESC, c.id DESC LIMIT 30 OFFSET ?`, ...args, (page - 1) * 30)
      .map(({ questions, answers, ...click }) => ({ ...click, prompts: JSON.parse(questions).map(q => q.prompt), answers: answers ? JSON.parse(answers) : null }));
    const counts = {
      pending: get("SELECT COUNT(*) AS total FROM ow_clicks WHERE status='pending'").total,
      failedPostbacks: get("SELECT COUNT(*) AS total FROM ow_postbacks WHERE status='failed'").total,
      queuedPostbacks: get("SELECT COUNT(*) AS total FROM ow_postbacks WHERE status IN ('queued','sending')").total,
      completedToday: get("SELECT COUNT(*) AS total FROM ow_clicks WHERE status='completed' AND finished>=?", today).total
    };
    return { origin, networks, offers, clicks, page, pages, total, counts, presets, macros };
  }

  /* ---------- 매체용 서명 API ---------- */
  function partner(req, url) {
    const apiKey = String(req.headers['x-adsform-key'] || '');
    const timestamp = String(req.headers['x-adsform-timestamp'] || '');
    const signature = String(req.headers['x-adsform-signature'] || '');
    limit(`ow-api-ip:${clientIp(req)}`, 120, 60_000);
    const network = /^awk_[a-f0-9]{24}$/.test(apiKey) ? get('SELECT * FROM ow_networks WHERE api_key=?', apiKey) : null;
    assert(network && network.status === 'active', '인증에 실패했습니다.', 401);
    assert(allowed(network.ip_allowlist, clientIp(req)), '허용되지 않은 IP입니다.', 403);
    assert(/^\d{10}$/.test(timestamp) && Math.abs(Date.now() / 1000 - Number(timestamp)) <= apiSkew, '요청 시각이 올바르지 않습니다.', 401);
    const expected = hmac(secretOf(network), `${timestamp}\n${req.method}\n${url.pathname}${url.search}`);
    assert(sameHex(signature, expected), '인증에 실패했습니다.', 401);
    return network;
  }

  function capacity(offer, network) {
    const used = get("SELECT COUNT(*) AS total FROM ow_clicks WHERE offer_id=? AND status IN ('completed','pending')", offer.id).total;
    const today = get("SELECT COUNT(*) AS total FROM ow_clicks WHERE offer_id=? AND status IN ('completed','pending') AND finished>=?", offer.id, dayStart()).total;
    return Math.max(0, Math.min(offer.goal - used, offer.daily_cap ? offer.daily_cap - today : Infinity));
  }

  const liveOffers = network => all(`SELECT o.*, p.price, p.reward FROM ow_offers o JOIN ow_placements p ON p.offer_id=o.id
    WHERE p.network_id=? AND p.status='active' AND o.status='active' AND o.start_date<=? AND o.end_date>=? ORDER BY o.id DESC`, network.id, dateKst(), dateKst());

  function feed(req, url, network) {
    const origin = req.site.origin;
    return { network: network.code, generated: now(), offers: liveOffers(network).map(offer => {
      const questions = JSON.parse(offer.questions);
      return { id: offer.slug, title: offer.title, brand: offer.brand, description: offer.intro, type: offer.kind, questions: questions.length,
        reward: offer.reward, price: offer.price, remaining: capacity(offer, network), daily_cap: offer.daily_cap, start_date: offer.start_date, end_date: offer.end_date,
        landing_url: `${origin}/ow/${offer.slug}?nw=${network.code}&${network.click_param}={CLICK_ID}&${network.user_param}={USER_ID}${network.sign_landing ? '&ts={TS}&sig={SIG}' : ''}`,
        signature_base: network.sign_landing ? `${offer.slug}.{CLICK_ID}.{USER_ID}.{TS}` : null };
    }) };
  }

  function clickStatus(network, clickId) {
    assert(idPattern.test(clickId), '클릭 ID 형식이 올바르지 않습니다.');
    const click = get(`SELECT c.*, o.slug, p.status AS postback FROM ow_clicks c JOIN ow_offers o ON o.id=c.offer_id LEFT JOIN ow_postbacks p ON p.click_ref=c.id
      WHERE c.network_id=? AND c.click_id=?`, network.id, clickId);
    assert(click, '클릭을 찾을 수 없습니다.', 404);
    return { click_id: click.click_id, offer_id: click.slug, status: click.status, transaction_id: `adsform-${click.id}`, completed_at: click.status === 'completed' ? click.finished : null,
      postback: click.postback || null };
  }

  /* ---------- 랜딩과 참여 ---------- */
  const cookieName = slug => `ow_${slug}`;
  const readToken = (req, slug) => req.headers.cookie?.match(new RegExp(`(?:^|;\\s*)${cookieName(slug).replace(/[-]/g, '\\-')}=([a-f0-9]{64})(?:;|$)`))?.[1];
  const setToken = (req, res, slug, token, maxAge) => res.setHeader('Set-Cookie',
    `${cookieName(slug)}=${token}; HttpOnly; SameSite=Lax; Path=/ow/${slug}; Max-Age=${maxAge}${req.site.secure ? '; Secure' : ''}`);

  // 안내 문구는 코드로만 넘겨, 주소에 임의 문구를 넣어 애즈폼 화면처럼 꾸미지 못하게 합니다.
  function landingError(res, code) {
    res.writeHead(303, { ...headers, Location: `/ow/expired?r=${code}`, 'Cache-Control': 'no-store' });
    return res.end();
  }

  function landing(req, res, url, offer) {
    if (hits(`ow-land-ip:${clientIp(req)}`) >= 60) return landingError(res, 'busy');
    hit(`ow-land-ip:${clientIp(req)}`);
    const params = url.searchParams;
    const code = params.get('nw') || '';
    const network = /^[a-z][a-z0-9-]{1,19}$/.test(code) ? get('SELECT * FROM ow_networks WHERE code=?', code) : null;
    if (!network || network.status !== 'active') return landingError(res, 'network');
    const clickId = params.get(network.click_param) || '';
    const member = params.get(network.user_param) || '';
    if (!idPattern.test(clickId) || !idPattern.test(member)) return landingError(res, 'params');
    if (network.sign_landing) {
      const ts = params.get('ts') || '';
      if (!/^\d{10}$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > landingSkew) return landingError(res, 'stale');
      if (!sameHex(params.get('sig') || '', hmac(secretOf(network), `${offer.slug}.${clickId}.${member}.${ts}`))) return landingError(res, 'signature');
    }
    const ip = clientIp(req);
    const outcome = transaction(() => {
      const placement = get("SELECT * FROM ow_placements WHERE offer_id=? AND network_id=? AND status='active'", offer.id, network.id);
      if (!placement || offer.status !== 'active' || offer.start_date > dateKst() || offer.end_date < dateKst()) return { error: 'closed' };
      const sameClick = get('SELECT * FROM ow_clicks WHERE network_id=? AND click_id=?', network.id, clickId);
      if (sameClick && (sameClick.offer_id !== offer.id || sameClick.network_user !== member)) return { error: 'used' };
      const prior = sameClick || get('SELECT * FROM ow_clicks WHERE offer_id=? AND network_id=? AND network_user=?', offer.id, network.id, member);
      const token = randomBytes(32).toString('hex');
      const time = Date.now();
      if (prior) {
        // 진행 중이거나 시간이 지나 끊긴 참여는 새 링크로 다시 이어서 하고, 판정이 끝난 참여는 결과 화면만 보여 줍니다.
        const resumable = prior.status === 'started' || (prior.status === 'expired' && prior.reason !== '모집 마감');
        if (resumable) {
          const stale = prior.status === 'expired' || prior.expires <= time;
          if (stale && !capacity(offer, network)) return { error: 'full' };
          run(`UPDATE ow_clicks SET token=?, click_id=?, status='started', finished=NULL${stale ? ', opened=?, expires=?' : ''} WHERE id=?`,
            sha(token), clickId, ...(stale ? [time, time + clickMinutes * 60_000] : []), prior.id);
        } else run('UPDATE ow_clicks SET token=? WHERE id=?', sha(token), prior.id);
        return { token };
      }
      if (!capacity(offer, network)) return { error: 'full' };
      const ipToday = get('SELECT COUNT(*) AS total FROM ow_clicks WHERE offer_id=? AND ip=? AND created>=?', offer.id, ip, dayStart()).total;
      if (ipToday >= offer.ip_daily_limit) return { error: 'ip' };
      run(`INSERT INTO ow_clicks(offer_id,network_id,click_id,network_user,token,ip,ua,status,price,reward,created,opened,expires) VALUES (?,?,?,?,?,?,?,'started',?,?,?,?,?)`,
        offer.id, network.id, clickId, member, sha(token), ip, sha(String(req.headers['user-agent'] || '')).slice(0, 16), placement.price, placement.reward, now(), time, time + clickMinutes * 60_000);
      return { token };
    });
    if (outcome.error) return landingError(res, outcome.error);
    setToken(req, res, offer.slug, outcome.token, 24 * 3600);
    // 클릭 ID·회원 식별값이 주소창·방문 기록에 남지 않도록 깨끗한 주소로 다시 보냅니다.
    res.writeHead(303, { ...headers, Location: `/ow/${offer.slug}`, 'Cache-Control': 'no-store' });
    return res.end();
  }

  const isPreview = (req, url) => url.searchParams.get('preview') === '1' && session(req)?.role === 'admin';

  function participantState(req, url, offer) {
    const questions = JSON.parse(offer.questions).map(({ prompt, choices }) => ({ prompt, choices: choices || [] }));
    const base = { title: offer.title, brand: offer.brand, intro: offer.intro, kind: offer.kind, questions, attempts: offer.attempts, minDwell: offer.min_dwell };
    if (isPreview(req, url)) return { offer: base, preview: true, now: Date.now(), click: { status: 'started', triesLeft: offer.attempts, opened: Date.now() } };
    const token = readToken(req, offer.slug);
    const click = token ? get('SELECT c.*, n.name AS network FROM ow_clicks c JOIN ow_networks n ON n.id=c.network_id WHERE c.token=? AND c.offer_id=?', sha(token), offer.id) : null;
    assert(click, '참여 정보를 찾을 수 없어요. 리워드 앱의 미션 목록에서 다시 들어와 주세요.', 401);
    const expired = click.status === 'started' && click.expires <= Date.now();
    return { offer: { ...base, reward: click.reward, network: click.network }, now: Date.now(), click: { status: expired ? 'expired' : click.status, reason: click.reason,
      triesLeft: Math.max(0, offer.attempts - click.tries), opened: click.opened, expires: click.expires, finished: click.finished } };
  }

  function grade(offer, body) {
    const questions = JSON.parse(offer.questions);
    assert(Array.isArray(body.answers) && body.answers.length === questions.length, '모든 문항에 답해 주세요.');
    if (offer.kind === 'quiz') {
      const answers = body.answers.map((value, i) => int(value, `${i + 1}번 답`, 0, questions[i].choices.length - 1));
      return { answers: answers.map((value, i) => questions[i].choices[value]), correct: answers.every((value, i) => value === questions[i].answer) };
    }
    const answers = body.answers.map((value, i) => str(value, `${i + 1}번 답변`, 1000, 5));
    for (const answer of answers) assert(new Set(answer.replace(/\s/g, '')).size >= 3, '같은 글자만 반복한 답변은 제출할 수 없어요.');
    return { answers, correct: true };
  }

  function submit(req, url, offer, body) {
    if (isPreview(req, url)) {
      const { correct } = grade(offer, body);
      return { status: offer.kind === 'survey' ? (offer.review ? 'pending' : 'completed') : correct ? 'completed' : 'failed', preview: true };
    }
    const token = readToken(req, offer.slug);
    assert(token, '참여 정보를 찾을 수 없어요. 리워드 앱에서 다시 들어와 주세요.', 401);
    limit(`ow-submit:${token}`, 10, 60_000);
    return transaction(() => {
      const click = get('SELECT * FROM ow_clicks WHERE token=? AND offer_id=?', sha(token), offer.id);
      assert(click, '참여 정보를 찾을 수 없어요. 리워드 앱에서 다시 들어와 주세요.', 401);
      if (click.status !== 'started') return { status: click.status };
      if (click.expires <= Date.now()) {
        run("UPDATE ow_clicks SET status='expired', finished=? WHERE id=?", now(), click.id);
        return { status: 'expired' };
      }
      assert(Date.now() - click.opened >= offer.min_dwell * 1000, `내용을 충분히 읽은 뒤 제출해 주세요. (최소 ${offer.min_dwell}초)`, 409);
      const { answers, correct } = grade(offer, body);
      const live = offer.status === 'active' && offer.end_date >= dateKst() && get("SELECT 1 FROM ow_placements WHERE offer_id=? AND network_id=? AND status='active'", offer.id, click.network_id)
        && get("SELECT 1 FROM ow_networks WHERE id=? AND status='active'", click.network_id);
      if (!live) return { status: 'closed' };
      const tries = click.tries + 1;
      if (!correct) {
        const final = tries >= offer.attempts;
        run('UPDATE ow_clicks SET tries=?, status=?, answers=?, reason=?, finished=? WHERE id=?', tries, final ? 'failed' : 'started', JSON.stringify(answers),
          final ? '퀴즈 정답과 일치하지 않습니다.' : '', final ? now() : null, click.id);
        return { status: final ? 'failed' : 'retry', triesLeft: offer.attempts - tries };
      }
      // 마지막 자리를 두고 동시에 제출해도 목표·일일 한도를 넘지 않도록 같은 트랜잭션에서 다시 셉니다.
      if (!capacity(offer)) {
        run("UPDATE ow_clicks SET tries=?, status='expired', reason='모집 마감', finished=? WHERE id=?", tries, now(), click.id);
        return { status: 'full' };
      }
      const status = offer.kind === 'survey' && offer.review ? 'pending' : 'completed';
      run('UPDATE ow_clicks SET tries=?, status=?, answers=?, finished=? WHERE id=?', tries, status, JSON.stringify(answers), now(), click.id);
      if (status === 'completed') enqueuePostback(click);
      if (get("SELECT COUNT(*) AS total FROM ow_clicks WHERE offer_id=? AND status IN ('completed','pending')", offer.id).total >= offer.goal) {
        run("UPDATE ow_offers SET status='closed', reason='목표 달성', updated=? WHERE id=?", now(), offer.id);
        audit(null, '오퍼월 오퍼 상태 변경', `ow-offer:${offer.id}`, 'closed');
      }
      return { status };
    });
  }

  // 매체가 웹뷰 안의 iframe으로 띄워야 하는 경우에만 ADSFORM_OFFERWALL_FRAME_ANCESTORS에 매체 출처를 적어 허용합니다.
  const frameAncestors = (process.env.ADSFORM_OFFERWALL_FRAME_ANCESTORS || '').split(/\s+/).filter(item => /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(item));
  const pageHeaders = { ...headers, 'Content-Security-Policy': headers['Content-Security-Policy'].replace("frame-ancestors 'none'", `frame-ancestors ${frameAncestors.join(' ') || "'none'"}`) };
  if (frameAncestors.length) delete pageHeaders['X-Frame-Options'];
  let pageHtml;
  function page(res) {
    pageHtml ||= readFileSync(resolve(root, 'public', 'ow.html'));
    res.writeHead(200, { ...pageHeaders, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(pageHtml);
  }

  async function payload(req) {
    assert(req.headers['content-type']?.split(';')[0] === 'application/json', 'JSON 요청이 필요합니다.', 415);
    try {
      const data = JSON.parse((await readBody(req, 16384)).toString());
      assert(data && typeof data === 'object' && !Array.isArray(data), '잘못된 요청입니다.');
      return data;
    } catch (error) {
      if (error.status) throw error;
      fail(400, '잘못된 요청입니다.');
    }
  }

  async function handle(req, res, url) {
    const parts = url.pathname.split('/').filter(Boolean); // ['ow', ...]
    if (parts[1] === 'v1') {
      assert(req.method === 'GET', '지원하지 않는 요청입니다.', 405);
      const network = partner(req, url);
      if (parts.length === 3 && parts[2] === 'offers') return json(res, 200, feed(req, url, network));
      if (parts.length === 4 && parts[2] === 'clicks') return json(res, 200, clickStatus(network, decodeURIComponent(parts[3])));
      fail(404, '요청한 기능을 찾을 수 없습니다.');
    }
    if (parts.length === 2 && parts[1] === 'expired' && req.method === 'GET') return page(res);
    const slug = parts[1];
    assert(slugPattern.test(slug || ''), '페이지를 찾을 수 없습니다.', 404);
    const offer = get('SELECT * FROM ow_offers WHERE slug=?', slug);
    assert(offer, '페이지를 찾을 수 없습니다.', 404);
    if (parts.length === 2 && req.method === 'GET') return url.searchParams.has('nw') ? landing(req, res, url, offer) : page(res);
    if (parts.length === 3 && parts[2] === 'state' && req.method === 'GET') return json(res, 200, participantState(req, url, offer));
    if (parts.length === 3 && parts[2] === 'submit' && req.method === 'POST') {
      assert(req.headers.origin === req.site.origin, '같은 사이트에서 요청해 주세요.', 403);
      return json(res, 200, submit(req, url, offer, await payload(req)));
    }
    fail(404, '페이지를 찾을 수 없습니다.');
  }

  const admin = handler => (req, res, user, body) => {
    assert(user, '로그인이 필요합니다.', 401);
    assert(user.role === 'admin', '이 기능을 사용할 권한이 없습니다.', 403);
    return handler(user, body, req);
  };
  return {
    handle,
    routes: {
      '/api/offerwall/network': admin(createNetwork),
      '/api/offerwall/network/update': admin(updateNetwork),
      '/api/offerwall/network/rotate': admin(rotateNetwork),
      '/api/offerwall/network/test': admin(testPostback),
      '/api/offerwall/offer': admin(createOffer),
      '/api/offerwall/offer/update': admin(updateOffer),
      '/api/offerwall/offer/status': admin(offerStatus),
      '/api/offerwall/click/review': admin(reviewClick),
      '/api/offerwall/postback/retry': admin(retryPostback)
    },
    getRoutes: {
      '/api/offerwall': (user, params, req) => {
        assert(user, '로그인이 필요합니다.', 401);
        assert(user.role === 'admin', '이 기능을 사용할 권한이 없습니다.', 403);
        return overview(user, params, req);
      }
    },
    pendingCount: () => get("SELECT COUNT(*) AS total FROM ow_clicks WHERE status='pending'").total,
    drain
  };
}
