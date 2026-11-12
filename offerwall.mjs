// 외부 오퍼월 연동
//
// 애즈폼은 광고주·대행사·실행사(그리고 최고관리자)가 등록한 오퍼월 광고를 모아
// 버즈빌·애드팝콘 같은 오퍼월 매체에 공급합니다. 실제 참여는 매체 회원이 합니다.
//
//  · 매체 연동 방식 두 가지
//    1) 피드 연동  : 매체 서버가 서명된 오퍼 목록 API(GET /ow/v1/offers)로 광고를 받아 자기 오퍼월에 그리고,
//                    회원이 누르면 클릭 ID·회원 식별값을 붙여 /ow/{광고}로 보냅니다.
//    2) 오퍼월 호스팅: 매체가 회원 식별값만 붙여 /ow/wall 을 열면 애즈폼이 '포인트 받기·포인트 조회' 화면을 그대로 보여 줍니다.
//  · 광고 유형: 방문하기(visit) · 콘텐츠보기(content) · 팔로우하기(follow) · 퀴즈(quiz) · 설문(survey) · 미션형 CPA(cpa)
//  · 완료되면 매체의 포스트백 주소로 서명된 완료 알림을 보내고, 매체가 자기 회원에게 리워드를 지급합니다.
//  · 광고 계정의 광고는 등록 시 예산(건당 단가 × 목표)을 잔액에서 배정하고, 완료 건만 집행한 뒤 종료 시 남은 예산을 돌려줍니다.
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
// 광고 유형: 매체 오퍼월의 탭(category)과 참여 방식, 기본 단가(광고주가 내는 건당 금액, 원)
export const offerTypes = {
  visit: { category: 'visit', label: '방문하기', repeat: 'daily', cost: 20, dwell: 3 },
  content: { category: 'content', label: '콘텐츠보기', repeat: 'daily', cost: 20, dwell: 5 },
  follow: { category: 'follow', label: '팔로우하기', repeat: 'once', cost: 250, dwell: 0 },
  quiz: { category: 'join', label: '퀴즈', repeat: 'once', cost: 80, dwell: 5 },
  survey: { category: 'join', label: '설문', repeat: 'once', cost: 250, dwell: 10 },
  cpa: { category: 'join', label: '미션형', repeat: 'once', cost: 300, dwell: 0 }
};
export const categories = { visit: '방문하기', join: '참여하기', follow: '팔로우하기', content: '콘텐츠보기' };
export const snsTypes = {
  youtube: { label: '유튜브', action: '유튜브 구독하면', hosts: ['youtube.com', 'youtu.be'] },
  instagram: { label: '인스타그램', action: '인스타그램 팔로우하면', hosts: ['instagram.com'] },
  kakao: { label: '카카오톡 채널', action: '카카오톡 채널 추가하면', hosts: ['pf.kakao.com', 'kakao.com'] },
  naver: { label: '네이버', action: '네이버 블로그 이웃 추가하면', hosts: ['naver.com', 'naver.me'] },
  tiktok: { label: '틱톡', action: '틱톡 팔로우하면', hosts: ['tiktok.com'] },
  etc: { label: '기타 SNS', action: '팔로우하면', hosts: null }
};
export const actionText = offer => offer.type === 'follow' ? (snsTypes[offer.sns]?.action || '팔로우하면')
  : { visit: '페이지 방문하면', content: '콘텐츠 보면', quiz: '퀴즈 맞히면', survey: '설문 참여하면', cpa: '미션 완료하면' }[offer.type];

const macros = ['click_id', 'user_id', 'offer_id', 'offer_type', 'event', 'transaction_id', 'price', 'reward', 'timestamp', 'signature'];
const idPattern = /^[A-Za-z0-9._:~=+/-]{1,256}$/;
const paramPattern = /^[a-z][a-z0-9_]{0,31}$/;
const slugPattern = /^[A-Za-z0-9_-]{12}$/;
const stepPattern = /^[a-z][a-z0-9_]{0,23}$/;
const landingSkew = 15 * 60;   // 랜딩·오퍼월 서명 허용 오차(초)
const apiSkew = 5 * 60;        // 서버 간 API 서명 허용 오차(초)
const clickMinutes = 60;       // 랜딩 후 제출 기한(분)
const cpaDays = 30;            // 미션형: 광고주 전환 통보를 받는 기간(일)
const backoff = [60, 300, 1800, 7200, 21600]; // 포스트백 재시도 간격(초)
const maxPostbackAttempts = backoff.length + 1;
const assetSizes = { icon: [256, 256], banner: [1080, 540] };

const hmac = (secret, text) => createHmac('sha256', secret).update(text).digest('hex');
const sha = text => createHash('sha256').update(text).digest('hex');
const sameHex = (a, b) => typeof a === 'string' && typeof b === 'string' && /^[a-f0-9]{64}$/i.test(a) &&
  timingSafeEqual(Buffer.from(a.toLowerCase(), 'hex'), Buffer.from(b, 'hex'));

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
      if (!/^\d+$/.test(bits) || Number(bits) > (family === 4 ? 32 : 128)) throw new Error(item);
      list.addSubnet(address, Number(bits), type);
    }
  }
  return { list, items };
}
const allowedIp = (allowlist, ip) => {
  if (!allowlist) return true;
  const address = ip.replace(/^::ffff:(?=\d+\.)/i, '');
  const family = isIP(address);
  return Boolean(family) && parseAllowlist(allowlist).list.check(address, family === 4 ? 'ipv4' : 'ipv6');
};

// JPEG 구조를 확인하고 가로·세로 크기를 돌려줍니다. 브라우저에서 다시 그려 보낸 이미지만 받습니다.
export function jpegSize(image) {
  if (image.length < 16 || image.readUInt16BE(0) !== 0xffd8 || image.readUInt16BE(image.length - 2) !== 0xffd9) return null;
  for (let offset = 2; offset + 4 <= image.length;) {
    const marker = image.readUInt16BE(offset);
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return null;
    const length = image.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > image.length) return null;
    if (marker === 0xffc0 || marker === 0xffc2) return length >= 8 ? { height: image.readUInt16BE(offset + 5), width: image.readUInt16BE(offset + 7) } : null;
    offset += 2 + length;
  }
  return null;
}

export function setupOfferwall(ctx) {
  const { db, get, all, run, transaction, audit, notify, entry, balance, won, assert, fail, str, int, date, limit, hits, hit, clientIp, now, dateKst, dayStart,
    session, json, headers, readBody, root, dataDir, allowPrivate, demo, setting } = ctx;

  // 이전 개발 브랜치의 구조(광고주 없는 오퍼)로 만든 표가 있으면 새 구조로 다시 만듭니다. 운영 데이터가 없던 단계입니다.
  if (get("SELECT 1 FROM sqlite_master WHERE type='table' AND name='ow_offers'") && !all('PRAGMA table_info(ow_offers)').some(column => column.name === 'owner_id')) {
    db.exec('DROP TABLE IF EXISTS ow_postbacks; DROP TABLE IF EXISTS ow_clicks; DROP TABLE IF EXISTS ow_placements; DROP TABLE IF EXISTS ow_offers;');
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS ow_networks (
      id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, preset TEXT NOT NULL DEFAULT 'custom',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
      api_key TEXT NOT NULL UNIQUE, secret_enc TEXT NOT NULL, click_param TEXT NOT NULL, user_param TEXT NOT NULL,
      sign_landing INTEGER NOT NULL DEFAULT 1, postback_url TEXT NOT NULL DEFAULT '',
      postback_method TEXT NOT NULL DEFAULT 'GET' CHECK (postback_method IN ('GET','POST')), ip_allowlist TEXT NOT NULL DEFAULT '',
      created TEXT NOT NULL, updated TEXT, rotated TEXT
    );
    CREATE TABLE IF NOT EXISTS ow_assets (
      id INTEGER PRIMARY KEY, owner_id INTEGER REFERENCES users(id), kind TEXT NOT NULL CHECK (kind IN ('icon','banner','proof')),
      data BLOB NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, created TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ow_offers (
      id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, owner_id INTEGER REFERENCES users(id),
      type TEXT NOT NULL CHECK (type IN ('visit','content','follow','quiz','survey','cpa')), category TEXT NOT NULL,
      title TEXT NOT NULL, brand TEXT NOT NULL, intro TEXT NOT NULL, badge TEXT NOT NULL DEFAULT '', target_url TEXT NOT NULL DEFAULT '',
      sns TEXT NOT NULL DEFAULT '', verify TEXT NOT NULL DEFAULT '', keyword TEXT NOT NULL DEFAULT '', guide TEXT NOT NULL DEFAULT '',
      questions TEXT NOT NULL DEFAULT '[]', steps TEXT NOT NULL DEFAULT '[]', review INTEGER NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 1, min_dwell INTEGER NOT NULL DEFAULT 0, repeat TEXT NOT NULL DEFAULT 'once' CHECK (repeat IN ('once','daily')),
      cost INTEGER NOT NULL DEFAULT 0, goal INTEGER NOT NULL, daily_cap INTEGER, ip_daily_limit INTEGER NOT NULL DEFAULT 30,
      start_date TEXT NOT NULL, end_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('review','draft','active','paused','closed','rejected','canceled')), reason TEXT NOT NULL DEFAULT '',
      icon_id INTEGER REFERENCES ow_assets(id), banner_id INTEGER REFERENCES ow_assets(id), budget INTEGER NOT NULL DEFAULT 0,
      conv_secret_enc TEXT, created_by INTEGER REFERENCES users(id), created TEXT NOT NULL, updated TEXT, request_key TEXT,
      UNIQUE (owner_id, request_key)
    );
    CREATE TABLE IF NOT EXISTS ow_placements (
      offer_id INTEGER NOT NULL REFERENCES ow_offers(id), network_id INTEGER NOT NULL REFERENCES ow_networks(id),
      price INTEGER NOT NULL, reward INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
      PRIMARY KEY (offer_id, network_id)
    );
    CREATE TABLE IF NOT EXISTS ow_clicks (
      id INTEGER PRIMARY KEY, ref TEXT NOT NULL UNIQUE, offer_id INTEGER NOT NULL REFERENCES ow_offers(id), network_id INTEGER NOT NULL REFERENCES ow_networks(id),
      click_id TEXT NOT NULL, network_user TEXT NOT NULL, period TEXT NOT NULL, origin TEXT NOT NULL DEFAULT 'feed',
      token TEXT NOT NULL UNIQUE, ip TEXT NOT NULL, ua TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('started','pending','completed','failed','rejected','expired')),
      tries INTEGER NOT NULL DEFAULT 0, answers TEXT, proof_id INTEGER REFERENCES ow_assets(id), reason TEXT NOT NULL DEFAULT '',
      price INTEGER NOT NULL, reward INTEGER NOT NULL, created TEXT NOT NULL, opened INTEGER NOT NULL, expires INTEGER NOT NULL, finished TEXT,
      UNIQUE (network_id, click_id), UNIQUE (offer_id, network_id, network_user, period)
    );
    CREATE INDEX IF NOT EXISTS ow_clicks_offer ON ow_clicks(offer_id, status, finished);
    CREATE INDEX IF NOT EXISTS ow_clicks_ip ON ow_clicks(offer_id, ip, created);
    CREATE INDEX IF NOT EXISTS ow_clicks_member ON ow_clicks(network_id, network_user, id);
    CREATE TABLE IF NOT EXISTS ow_conversions (
      id INTEGER PRIMARY KEY, click_ref INTEGER NOT NULL REFERENCES ow_clicks(id), step TEXT NOT NULL,
      cost INTEGER NOT NULL, price INTEGER NOT NULL, reward INTEGER NOT NULL, created TEXT NOT NULL, UNIQUE (click_ref, step)
    );
    CREATE TABLE IF NOT EXISTS ow_postbacks (
      id INTEGER PRIMARY KEY, conversion_id INTEGER NOT NULL UNIQUE REFERENCES ow_conversions(id), network_id INTEGER NOT NULL REFERENCES ow_networks(id),
      status TEXT NOT NULL CHECK (status IN ('queued','sending','sent','failed')), attempts INTEGER NOT NULL DEFAULT 0,
      next_at INTEGER NOT NULL, last_code INTEGER, last_error TEXT NOT NULL DEFAULT '', created TEXT NOT NULL, sent TEXT
    );
    CREATE INDEX IF NOT EXISTS ow_postbacks_due ON ow_postbacks(status, next_at);
    CREATE TABLE IF NOT EXISTS ow_walls (
      token TEXT PRIMARY KEY, network_id INTEGER NOT NULL REFERENCES ow_networks(id), network_user TEXT NOT NULL, expires INTEGER NOT NULL
    );
  `);
  for (const [table, column, definition] of [['ow_networks', 'reward_rate', 'INTEGER NOT NULL DEFAULT 100'], ['ow_networks', 'point_unit', "TEXT NOT NULL DEFAULT 'P'"]]) {
    if (!all(`PRAGMA table_info(${table})`).some(item => item.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
  run("INSERT OR IGNORE INTO settings VALUES ('ow_share', '6000')");
  for (const [type, item] of Object.entries(offerTypes)) run('INSERT OR IGNORE INTO settings VALUES (?, ?)', `ow_cost_${type}`, String(item.cost));
  run("UPDATE ow_postbacks SET status='queued' WHERE status='sending'");

  const rates = () => ({ share: Number(setting('ow_share')), costs: Object.fromEntries(Object.keys(offerTypes).map(type => [type, Number(setting(`ow_cost_${type}`))])) });

  /* ---------- 비밀키 암호화 저장 ---------- */
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
  if (process.env.ADSFORM_SECRET_KEY) masterKey();
  const seal = text => {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', masterKey(), iv);
    cipher.setAAD(Buffer.from('adsform-ow-secret'));
    const body = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join(':');
  };
  const unseal = sealed => {
    try {
      const [version, iv, tag, body] = sealed.split(':');
      if (version !== 'v1') throw new Error('version');
      const decipher = createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(iv, 'base64url'));
      decipher.setAAD(Buffer.from('adsform-ow-secret'));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
    } catch {
      fail(500, '비밀키를 복호화할 수 없습니다. ADSFORM_SECRET_KEY를 확인해 주세요.');
    }
  };
  const newSecret = () => 'aws_' + randomBytes(32).toString('base64url');

  /* ---------- 공통 검증 ---------- */
  const flag = value => value === true || value === '1' || value === 'on' ? 1 : 0;
  const optionalInt = (value, label, min, max) => value === undefined || value === null || value === '' || value === '0' ? null : int(value, label, min, max);
  const isAdmin = user => user?.role === 'admin';
  const partnerRoles = ['advertiser', 'agency', 'operator'];

  function httpsUrl(value, label, hosts = null) {
    const text = str(value, label, 1000);
    let url;
    try { url = new URL(text); } catch { fail(400, `${label} 형식을 확인해 주세요.`); }
    assert(url.protocol === 'https:', `${label}는 https://로 시작해야 합니다.`);
    assert(!url.username && !url.password, `${label}에 계정 정보를 넣을 수 없습니다.`);
    if (hosts) assert(hosts.some(host => url.hostname === host || url.hostname.endsWith('.' + host)), `${label}가 선택한 SNS 주소가 아닙니다.`);
    return url.href;
  }

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
    assert(url.includes('{click_id}') || url.includes('{transaction_id}'), '포스트백 주소에 {click_id} 또는 {transaction_id} 매크로를 넣어 주세요.');
    return url;
  }

  /* ---------- 매체 ---------- */
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
    const unit = str(body.point_unit || 'P', '포인트 단위', 8);
    return { name, clickParam, userParam, signLanding: flag(body.sign_landing), postbackUrl: postbackTemplate(body.postback_url), method: body.postback_method === 'POST' ? 'POST' : 'GET',
      allowlist: items.join(', '), status: body.status === 'paused' ? 'paused' : existing && body.status !== 'active' ? existing.status : 'active',
      rewardRate: int(body.reward_rate ?? 100, '리워드 환산율', 0, 100000), unit };
  }

  function createNetwork(user, body) {
    assert(Object.hasOwn(presets, body.preset), '매체 유형을 선택해 주세요.');
    const code = str(body.code, '매체 코드', 20, 2).toLowerCase();
    assert(/^[a-z][a-z0-9-]{1,19}$/.test(code) && code !== 'wall', '매체 코드는 영문 소문자로 시작하는 2~20자(영문·숫자·하이픈)로 입력해 주세요.');
    const f = networkFields(body);
    return transaction(() => {
      assert(!get('SELECT 1 FROM ow_networks WHERE code=?', code), '이미 등록된 매체 코드입니다.', 409);
      const secret = newSecret();
      const apiKey = 'awk_' + randomBytes(12).toString('hex');
      const id = Number(run(`INSERT INTO ow_networks(code,name,preset,status,api_key,secret_enc,click_param,user_param,sign_landing,postback_url,postback_method,ip_allowlist,reward_rate,point_unit,created)
        VALUES (?,?,?,'active',?,?,?,?,?,?,?,?,?,?,?)`, code, f.name, body.preset, apiKey, seal(secret), f.clickParam, f.userParam, f.signLanding, f.postbackUrl, f.method,
        f.allowlist, f.rewardRate, f.unit, now()).lastInsertRowid);
      // 진행 중인 광고는 새 매체에도 자동으로 공급합니다.
      for (const offer of all("SELECT * FROM ow_offers WHERE status IN ('active','paused','draft')")) place(offer, get('SELECT * FROM ow_networks WHERE id=?', id));
      audit(user.id, '오퍼월 매체 등록', `ow-network:${id}`, `${f.name} (${code})`);
      return { id, apiKey, secret };
    });
  }

  function updateNetwork(user, body) {
    const id = int(body.id, '매체 번호', 1, 1e9);
    return transaction(() => {
      const network = get('SELECT * FROM ow_networks WHERE id=?', id);
      assert(network, '매체를 찾을 수 없습니다.', 404);
      const f = networkFields(body, network);
      run(`UPDATE ow_networks SET name=?,status=?,click_param=?,user_param=?,sign_landing=?,postback_url=?,postback_method=?,ip_allowlist=?,reward_rate=?,point_unit=?,updated=? WHERE id=?`,
        f.name, f.status, f.clickParam, f.userParam, f.signLanding, f.postbackUrl, f.method, f.allowlist, f.rewardRate, f.unit, now(), id);
      if (f.rewardRate !== network.reward_rate) run('UPDATE ow_placements SET reward=CAST(price*?/100 AS INTEGER) WHERE network_id=?', f.rewardRate, id);
      const changes = [network.postback_url !== f.postbackUrl && '포스트백 주소', network.sign_landing !== f.signLanding && `랜딩 서명 ${f.signLanding ? '켬' : '끔'}`,
        network.ip_allowlist !== f.allowlist && '허용 IP', network.reward_rate !== f.rewardRate && `리워드 환산율 ${f.rewardRate}%`, network.status !== f.status && f.status].filter(Boolean).join(' · ');
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
      const apiKey = 'awk_' + randomBytes(12).toString('hex');
      run('UPDATE ow_networks SET api_key=?, secret_enc=?, rotated=? WHERE id=?', apiKey, seal(secret), now(), id);
      run('DELETE FROM ow_walls WHERE network_id=?', id);
      audit(user.id, '오퍼월 매체 키 재발급', `ow-network:${id}`, network.name);
      return { id, apiKey, secret };
    });
  }

  function saveRates(user, body) {
    const share = Math.round(Number(String(body.share ?? '').trim()) * 100);
    assert(/^\d{1,3}(\.\d{1,2})?$/.test(String(body.share ?? '').trim()) && share >= 0 && share <= 10000, '매체 배분율은 0~100% 사이로 입력해 주세요.');
    const costs = Object.fromEntries(Object.keys(offerTypes).map(type => [type, int(body[`cost_${type}`], `${offerTypes[type].label} 단가`, 1, 1000000)]));
    return transaction(() => {
      run("UPDATE settings SET value=? WHERE key='ow_share'", String(share));
      for (const [type, cost] of Object.entries(costs)) run('UPDATE settings SET value=? WHERE key=?', String(cost), `ow_cost_${type}`);
      audit(user.id, '오퍼월 단가 설정', 'ow-rates', `매체 배분 ${share / 100}% · ${Object.entries(costs).map(([type, cost]) => `${offerTypes[type].label} ${cost}`).join(' · ')}`);
      return {};
    });
  }

  /* ---------- 이미지 ---------- */
  async function uploadAsset(req, user, url) {
    assert(user, '로그인이 필요합니다.', 401);
    assert(isAdmin(user) || partnerRoles.includes(user.role), '이 기능을 사용할 권한이 없습니다.', 403);
    assert(req.headers.origin === req.site.origin, '같은 사이트에서 요청해 주세요.', 403);
    const kind = url.searchParams.get('kind');
    assert(Object.hasOwn(assetSizes, kind), '이미지 종류를 확인해 주세요.');
    assert(req.headers['content-type'] === 'image/jpeg', '이미지를 JPG로 보내 주세요.', 415);
    limit(`ow-asset:${user.id}`, 40, 600_000, '이미지를 너무 자주 올렸어요. 잠시 후 다시 시도해 주세요.');
    const image = await readBody(req, 600 * 1024);
    const size = jpegSize(image);
    const [width, height] = assetSizes[kind];
    assert(size && size.width === width && size.height === height, `이미지 형식이 올바르지 않습니다. (${width}×${height} JPG)`);
    return { id: Number(run('INSERT INTO ow_assets(owner_id,kind,data,width,height,created) VALUES (?,?,?,?,?,?)', user.id, kind, image, width, height, now()).lastInsertRowid) };
  }
  const assetFor = (user, value, kind) => {
    if (value === undefined || value === null || value === '') return null;
    const id = int(value, '이미지', 1, 1e9);
    const asset = get('SELECT id, owner_id, kind FROM ow_assets WHERE id=?', id);
    assert(asset && asset.kind === kind && (isAdmin(user) || asset.owner_id === user.id), '이미지를 다시 올려 주세요.');
    return id;
  };

  /* ---------- 광고(오퍼) ---------- */
  function questionsFrom(type, body) {
    const questions = [];
    for (let n = 1; n <= 10; n++) {
      const prompt = typeof body[`q${n}_prompt`] === 'string' ? body[`q${n}_prompt`].trim() : '';
      if (!prompt) continue;
      assert(prompt.length <= 200, `${n}번 문항은 200자 이내로 입력해 주세요.`);
      if (type === 'survey') { questions.push({ prompt }); continue; }
      const choices = [1, 2, 3, 4, 5].map(i => body[`q${n}_c${i}`]).filter(value => typeof value === 'string' && value.trim()).map(value => str(value, `${n}번 선택지`, 60));
      assert(choices.length >= 2, `${n}번 문항의 선택지를 2개 이상 입력해 주세요.`);
      assert(new Set(choices).size === choices.length, `${n}번 문항의 선택지가 서로 같습니다.`);
      questions.push({ prompt, choices, answer: int(body[`q${n}_answer`], `${n}번 정답`, 1, choices.length) - 1 });
    }
    assert(questions.length >= 1, '문항을 1개 이상 입력해 주세요.');
    return questions;
  }

  function stepsFrom(body, minimum) {
    const steps = [];
    for (let n = 1; n <= 5; n++) {
      const label = typeof body[`s${n}_label`] === 'string' ? body[`s${n}_label`].trim() : '';
      if (!label) continue;
      const code = str(body[`s${n}_code`], `${n}단계 이벤트 코드`, 24).toLowerCase();
      assert(stepPattern.test(code) && code !== 'done', `${n}단계 이벤트 코드는 영문 소문자로 시작하는 영문·숫자·밑줄로 입력해 주세요.`);
      steps.push({ code, label: str(label, `${n}단계 이름`, 40), cost: int(body[`s${n}_cost`], `${n}단계 단가`, 1, 1000000) });
    }
    assert(steps.length >= 1, '미션 단계를 1개 이상 입력해 주세요.');
    assert(new Set(steps.map(step => step.code)).size === steps.length, '이벤트 코드가 겹칩니다.');
    const total = steps.reduce((sum, step) => sum + step.cost, 0);
    assert(total >= minimum, `미션형 광고의 단계 단가 합계는 ${won(minimum)} 이상이어야 합니다.`);
    return steps;
  }

  function offerFields(user, body, existing) {
    const type = existing?.type || body.type;
    assert(Object.hasOwn(offerTypes, type), '광고 유형을 선택해 주세요.');
    const config = offerTypes[type];
    const owned = existing ? existing.owner_id !== null : !isAdmin(user);
    const { costs } = rates();
    const goal = int(body.goal, '목표 완료 수', 1, 1000000);
    const start = date(body.start);
    const end = date(body.end);
    assert(end >= start && end >= dateKst(), '시작일과 종료일을 확인해 주세요.');
    if (!existing) assert(start >= dateKst(), '시작일은 오늘 이후로 정해 주세요.');
    const f = {
      type, category: config.category, title: str(body.title, '광고 제목', 60), brand: str(body.brand, '브랜드명', 40), intro: str(body.intro, '광고 소개', 1000),
      badge: str(body.badge ?? '', '강조 문구', 8, 0), targetUrl: '', sns: '', verify: '', keyword: '', guide: str(body.guide ?? '', '참여 방법 안내', 300, 0),
      questions: [], steps: [], review: 0, attempts: 1, minDwell: int(body.min_dwell === undefined || body.min_dwell === '' ? config.dwell : body.min_dwell, '최소 체류 시간', 0, 600),
      repeat: config.repeat === 'daily' && body.repeat !== 'once' ? 'daily' : 'once', goal, cap: optionalInt(body.daily_cap, '일일 한도', 1, goal),
      ipLimit: int(body.ip_daily_limit || 30, 'IP당 하루 참여 수', 1, 10000), start, end,
      icon: assetFor(user, body.icon_id, 'icon'), banner: assetFor(user, body.banner_id, 'banner')
    };
    if (type === 'visit' || type === 'content' || type === 'cpa') f.targetUrl = httpsUrl(body.target_url, type === 'cpa' ? '참여 주소' : '방문 주소');
    if (type === 'follow') {
      assert(Object.hasOwn(snsTypes, body.sns), 'SNS 종류를 선택해 주세요.');
      f.sns = body.sns;
      f.targetUrl = httpsUrl(body.target_url, '채널 주소', snsTypes[body.sns].hosts);
      f.verify = body.verify === 'keyword' ? 'keyword' : 'screenshot';
      if (f.verify === 'keyword') f.keyword = str(body.keyword, '인증 키워드', 20, 2);
    }
    if (type === 'quiz' || type === 'survey') f.questions = questionsFrom(type, body);
    if (type === 'quiz') f.attempts = int(body.attempts || 1, '응시 기회', 1, 5);
    if (type === 'survey') f.review = flag(body.review);
    if (type === 'cpa') f.steps = stepsFrom(body, owned ? costs.cpa : 0);
    // 단가는 주문 시점 기준으로 고정합니다. 미션형은 단계 단가 합계입니다.
    f.cost = type === 'cpa' ? f.steps.reduce((sum, step) => sum + step.cost, 0) : existing ? existing.cost : owned ? costs[type] : 0;
    return f;
  }

  // 매체별 공급 단가: 광고 단가 × 매체 배분율, 매체 리워드: 단가 × 매체 환산율
  function place(offer, network, override) {
    const base = offer.cost || (offer.type === 'cpa' ? 0 : Number(setting(`ow_cost_${offer.type}`)));
    const price = override?.price ?? Math.floor(base * Number(setting('ow_share')) / 10000);
    const reward = override?.reward ?? Math.floor(price * network.reward_rate / 100);
    run(`INSERT INTO ow_placements(offer_id,network_id,price,reward,status) VALUES (?,?,?,?,?)
      ON CONFLICT(offer_id,network_id) DO UPDATE SET price=excluded.price, reward=excluded.reward, status=excluded.status`, offer.id, network.id, price, reward, override?.status || 'active');
  }

  function savePlacements(offer, body) {
    for (const network of all('SELECT * FROM ow_networks')) {
      if (body[`p${network.id}_price`] === undefined && body[`p${network.id}_on`] === undefined) continue;
      const on = flag(body[`p${network.id}_on`]);
      const price = body[`p${network.id}_price`] === undefined || body[`p${network.id}_price`] === '' ? undefined : int(body[`p${network.id}_price`], '매체 단가', 0, 1000000);
      const reward = body[`p${network.id}_reward`] === undefined || body[`p${network.id}_reward`] === '' ? undefined : int(body[`p${network.id}_reward`], '매체 리워드', 0, 10000000);
      place(offer, network, { price, reward, status: on ? 'active' : 'paused' });
    }
  }

  const offerColumns = f => [f.type, f.category, f.title, f.brand, f.intro, f.badge, f.targetUrl, f.sns, f.verify, f.keyword, f.guide, JSON.stringify(f.questions), JSON.stringify(f.steps),
    f.review, f.attempts, f.minDwell, f.repeat, f.cost, f.goal, f.cap, f.ipLimit, f.start, f.end, f.icon, f.banner];

  function createOffer(user, body) {
    assert(isAdmin(user) || partnerRoles.includes(user.role), '이 기능을 사용할 권한이 없습니다.', 403);
    const f = offerFields(user, body);
    const owned = !isAdmin(user);
    const key = owned ? str(body.key, '요청 키', 64) : null;
    return transaction(() => {
      if (owned) {
        const existing = get('SELECT id, slug, title, goal, type FROM ow_offers WHERE owner_id=? AND request_key=?', user.id, key);
        if (existing) {
          assert(existing.title === f.title && existing.goal === f.goal && existing.type === f.type, '이미 접수된 요청입니다. 새 광고 등록 화면에서 다시 작성해 주세요.', 409);
          return { id: existing.id, slug: existing.slug };
        }
      }
      const budget = owned ? f.cost * f.goal : 0;
      if (owned) assert(balance(user.id, 'credit') >= budget, `광고 잔액이 부족합니다. 예산 ${won(budget)}이 필요해요.`, 409);
      const slug = randomBytes(9).toString('base64url');
      const convSecret = f.type === 'cpa' ? newSecret() : null;
      const id = Number(run(`INSERT INTO ow_offers(slug,owner_id,type,category,title,brand,intro,badge,target_url,sns,verify,keyword,guide,questions,steps,review,attempts,min_dwell,repeat,cost,goal,daily_cap,
        ip_daily_limit,start_date,end_date,icon_id,banner_id,status,budget,conv_secret_enc,created_by,created,request_key)
        VALUES (?,?,${Array(25).fill('?').join(',')},?,?,?,?,?,?)`, slug, owned ? user.id : null, ...offerColumns(f), owned ? 'review' : 'draft', budget,
        convSecret ? seal(convSecret) : null, user.id, now(), key).lastInsertRowid);
      const offer = get('SELECT * FROM ow_offers WHERE id=?', id);
      if (owned) entry(user.id, 'credit', -budget, 'ow_reserve', id);
      else {
        for (const network of all('SELECT * FROM ow_networks')) place(offer, network);
        savePlacements(offer, body);
      }
      audit(user.id, '오퍼월 광고 등록', `ow-offer:${id}`, `${f.title}${budget ? ` · 예산 ${won(budget)}` : ''}`);
      return { id, slug, ...(convSecret ? { convSecret } : {}) };
    });
  }

  function editableOffer(user, id) {
    const offer = get('SELECT * FROM ow_offers WHERE id=?', id);
    assert(offer && (isAdmin(user) || offer.owner_id === user.id), '광고를 찾을 수 없습니다.', 404);
    return offer;
  }

  function updateOffer(user, body) {
    const id = int(body.id, '광고 번호', 1, 1e9);
    return transaction(() => {
      const offer = editableOffer(user, id);
      assert(!['closed', 'rejected', 'canceled'].includes(offer.status), '끝난 광고는 고칠 수 없습니다.', 409);
      assert(isAdmin(user) || offer.status === 'review', '심사 대기 중일 때만 고칠 수 있어요. 진행 중인 광고는 연장·증액을 이용하세요.', 409);
      const f = offerFields(user, { ...body, goal: offer.owner_id && !isAdmin(user) ? offer.goal : body.goal }, offer);
      if (offer.owner_id) {
        assert(f.cost === offer.cost || offer.status === 'review', '진행 중인 광고의 단가는 바꿀 수 없습니다.', 409);
        if (offer.status === 'review' && f.cost !== offer.cost) {
          const diff = f.cost * offer.goal - offer.budget;
          if (diff > 0) assert(balance(offer.owner_id, 'credit') >= diff, `광고 잔액이 ${won(diff)} 부족합니다.`, 409);
          if (diff) entry(offer.owner_id, 'credit', -diff, 'ow_reserve', `${id}.${Date.now()}`);
          run('UPDATE ow_offers SET budget=? WHERE id=?', f.cost * offer.goal, id);
        }
        assert(f.goal === offer.goal || offer.status !== 'review' || isAdmin(user), '목표 수량은 연장·증액으로 바꿔 주세요.', 409);
        assert(f.goal <= offer.goal || !offer.owner_id, '광고 계정의 목표 증액은 연장·증액으로만 할 수 있어요.', 409);
      }
      const used = get("SELECT COUNT(*) AS total FROM ow_clicks WHERE offer_id=? AND status IN ('completed','pending')", id).total;
      assert(f.goal >= used, `이미 완료·검수 중인 ${used}건보다 목표를 낮출 수 없습니다.`, 409);
      const contentChanged = JSON.stringify(f.questions) !== offer.questions || JSON.stringify(f.steps) !== offer.steps || f.attempts !== offer.attempts || f.keyword !== offer.keyword;
      assert(!contentChanged || offer.status !== 'active', '진행 중인 광고의 문항·정답·미션 단계·인증 키워드는 일시중지한 뒤 고칠 수 있어요.', 409);
      run(`UPDATE ow_offers SET type=?,category=?,title=?,brand=?,intro=?,badge=?,target_url=?,sns=?,verify=?,keyword=?,guide=?,questions=?,steps=?,review=?,attempts=?,min_dwell=?,repeat=?,cost=?,goal=?,daily_cap=?,
        ip_daily_limit=?,start_date=?,end_date=?,icon_id=?,banner_id=?,updated=? WHERE id=?`, ...offerColumns(f), now(), id);
      if (isAdmin(user)) savePlacements(get('SELECT * FROM ow_offers WHERE id=?', id), body);
      audit(user.id, '오퍼월 광고 수정', `ow-offer:${id}`, f.title);
      return {};
    });
  }

  const spentOf = id => get('SELECT COALESCE(SUM(v.cost),0) AS total FROM ow_conversions v JOIN ow_clicks c ON c.id=v.click_ref WHERE c.offer_id=?', id).total;

  // 광고를 끝내고 광고 계정에 남은 예산을 돌려줍니다.
  function finish(offer, status, reason, actor = null) {
    run('UPDATE ow_offers SET status=?, reason=?, updated=? WHERE id=?', status, reason, now(), offer.id);
    let returned = 0;
    if (offer.owner_id) {
      returned = Math.max(0, offer.budget - spentOf(offer.id));
      if (returned) entry(offer.owner_id, 'credit', returned, 'ow_release', offer.id);
      if (actor !== offer.owner_id) {
        notify(offer.owner_id, 'offerwall', `오퍼월 광고 ‘${offer.title}’ ${status === 'rejected' ? '심사 반려' : '종료'}`,
          `${reason}${returned ? ` · 남은 예산 ${won(returned)}을 잔액으로 돌려드렸어요.` : ''}`, '/manage?tab=owads');
      }
    }
    audit(actor, status === 'rejected' ? '오퍼월 광고 반려' : status === 'canceled' ? '오퍼월 광고 취소' : '오퍼월 광고 종료', `ow-offer:${offer.id}`, `${reason}${returned ? ` · 반환 ${won(returned)}` : ''}`);
    return returned;
  }

  const adminPause = '운영자 일시중지';
  function offerStatus(user, body) {
    const id = int(body.id, '광고 번호', 1, 1e9);
    const admin = isAdmin(user);
    const transitions = admin
      ? { review: { approve: 'active', reject: 'rejected' }, draft: { activate: 'active', close: 'closed' }, active: { pause: 'paused', close: 'closed' }, paused: { activate: 'active', close: 'closed' } }
      : { review: { cancel: 'canceled' }, active: { pause: 'paused', close: 'closed' }, paused: { activate: 'active', close: 'closed' } };
    return transaction(() => {
      const offer = editableOffer(user, id);
      const next = transitions[offer.status]?.[body.action];
      assert(next, '현재 상태에서 처리할 수 없습니다.', 409);
      if (!admin && body.action === 'activate') assert(offer.reason !== adminPause, '운영팀이 중지한 광고입니다. 문의하기로 재개를 요청해 주세요.', 409);
      if (next === 'active') {
        assert(offer.end_date >= dateKst(), '종료일이 지난 광고입니다. 종료일을 먼저 늘려 주세요.', 409);
        if (offer.status === 'review' || offer.status === 'draft') {
          for (const network of all('SELECT * FROM ow_networks')) if (!get('SELECT 1 FROM ow_placements WHERE offer_id=? AND network_id=?', id, network.id)) place(offer, network);
        }
        assert(get("SELECT 1 FROM ow_placements WHERE offer_id=? AND status='active'", id), '공급할 매체가 없습니다. 매체를 먼저 등록해 주세요.', 409);
      }
      if (next === 'closed') assert(!get("SELECT 1 FROM ow_clicks WHERE offer_id=? AND status='pending'", id), '검수 대기 중인 참여가 있어 종료할 수 없습니다.', 409);
      if (['closed', 'rejected', 'canceled'].includes(next)) {
        const reason = next === 'rejected' ? `심사 반려 · ${str(body.reason, '반려 사유', 200)}` : next === 'canceled' ? '광고주 취소' : admin ? '운영자 종료' : '광고주 종료';
        return { returned: finish(offer, next, reason, user.id) };
      }
      const reason = next === 'paused' ? (admin ? adminPause : '광고주 일시중지') : '';
      run('UPDATE ow_offers SET status=?, reason=?, updated=? WHERE id=?', next, reason, now(), id);
      audit(user.id, body.action === 'approve' ? '오퍼월 광고 승인' : '오퍼월 광고 상태 변경', `ow-offer:${id}`, next);
      if (admin && offer.owner_id) {
        const message = { approve: ['심사 승인', `${offer.start_date}부터 오퍼월 매체에 공급합니다.`], pause: ['운영팀 일시중지', '자세한 내용은 문의하기로 확인해 주세요.'], activate: ['공급 재개', '광고가 다시 매체에 공급됩니다.'] }[body.action];
        if (message) notify(offer.owner_id, 'offerwall', `오퍼월 광고 ‘${offer.title}’ ${message[0]}`, message[1], '/manage?tab=owads');
      }
      return {};
    });
  }

  function extendOffer(user, body) {
    const id = int(body.id, '광고 번호', 1, 1e9);
    return transaction(() => {
      const offer = editableOffer(user, id);
      assert(offer.owner_id === user.id, '광고 계정의 광고만 연장·증액할 수 있습니다.', 403);
      assert(['active', 'paused'].includes(offer.status), '진행 중이거나 일시중지된 광고만 연장·증액할 수 있습니다.', 409);
      const goal = int(body.goal, '목표 완료 수', offer.goal, 1000000);
      const end = date(body.end);
      assert(end >= offer.end_date, '종료일은 앞당길 수 없습니다.');
      assert(goal !== offer.goal || end !== offer.end_date, '바뀐 내용이 없습니다.');
      const extra = (goal - offer.goal) * offer.cost;
      if (extra) {
        assert(balance(user.id, 'credit') >= extra, `추가 예산 ${won(extra)}이 필요합니다. 먼저 충전을 신청해 주세요.`, 409);
        entry(user.id, 'credit', -extra, 'ow_reserve', `${id}.${Date.now()}`);
      }
      run('UPDATE ow_offers SET goal=?, end_date=?, budget=budget+?, updated=? WHERE id=?', goal, end, extra, now(), id);
      audit(user.id, '오퍼월 광고 연장·증액', `ow-offer:${id}`, `목표 ${offer.goal}→${goal} · 종료 ${offer.end_date}→${end}${extra ? ` · 추가 예산 ${won(extra)}` : ''}`);
      return { extra };
    });
  }

  function rotateConversionKey(user, body) {
    const id = int(body.id, '광고 번호', 1, 1e9);
    return transaction(() => {
      const offer = editableOffer(user, id);
      assert(offer.type === 'cpa', '미션형 광고만 전환 키가 있습니다.', 409);
      const secret = newSecret();
      run('UPDATE ow_offers SET conv_secret_enc=? WHERE id=?', seal(secret), id);
      audit(user.id, '오퍼월 전환 키 재발급', `ow-offer:${id}`);
      return { id, slug: offer.slug, convSecret: secret };
    });
  }

  // 기간이 끝났거나 예산을 다 쓴 광고를 정리합니다.
  function sweep() {
    const today = dateKst();
    const due = all(`SELECT o.* FROM ow_offers o WHERE o.status IN ('active','paused','draft','review') AND o.end_date<?
      AND NOT EXISTS (SELECT 1 FROM ow_clicks WHERE offer_id=o.id AND status='pending')`, today);
    if (!due.length) return;
    transaction(() => { for (const offer of due) finish(offer, offer.status === 'review' ? 'canceled' : 'closed', '집행 기간 종료'); });
  }
  setInterval(() => { try { sweep(); } catch (error) { console.error('offerwall sweep', error); } }, 60_000).unref();

  /* ---------- 완료·집행·포스트백 ---------- */
  function capacity(offer) {
    const used = get("SELECT COUNT(*) AS total FROM ow_clicks WHERE offer_id=? AND status IN ('completed','pending')", offer.id).total;
    const today = get("SELECT COUNT(*) AS total FROM ow_clicks WHERE offer_id=? AND status IN ('completed','pending') AND finished>=?", offer.id, dayStart()).total;
    return Math.max(0, Math.min(offer.goal - used, offer.daily_cap ? offer.daily_cap - today : Infinity));
  }

  // 완료(또는 미션 단계) 1건을 기록하고 매체 포스트백을 예약합니다. 예산이 모자라면 기록하지 않습니다.
  function convert(click, offer, step = 'done') {
    const steps = JSON.parse(offer.steps);
    const unit = step === 'done' ? null : steps.find(item => item.code === step);
    const cost = step === 'done' ? offer.cost : unit.cost;
    const total = steps.reduce((sum, item) => sum + item.cost, 0) || 1;
    const price = step === 'done' ? click.price : Math.floor(click.price * unit.cost / total);
    const reward = step === 'done' ? click.reward : Math.floor(click.reward * unit.cost / total);
    if (offer.owner_id && spentOf(offer.id) + cost > offer.budget) return false;
    const inserted = run('INSERT OR IGNORE INTO ow_conversions(click_ref,step,cost,price,reward,created) VALUES (?,?,?,?,?,?)', click.id, step, cost, price, reward, now());
    if (!inserted.changes) return true;
    run("INSERT INTO ow_postbacks(conversion_id,network_id,status,next_at,created) VALUES (?,?,'queued',?,?)", Number(inserted.lastInsertRowid), click.network_id, Date.now(), now());
    setImmediate(drain);
    return true;
  }

  const goalReason = '목표 달성 · 검수 후 종료';
  function closeIfDone(offer) {
    const fresh = get('SELECT * FROM ow_offers WHERE id=?', offer.id);
    // 일시중지 중에도 미션형 전환·검수 승인으로 예산이 바닥날 수 있어 함께 정리합니다.
    if (!['active', 'paused'].includes(fresh.status)) return;
    const used = get("SELECT COUNT(*) AS total FROM ow_clicks WHERE offer_id=? AND status IN ('completed','pending')", offer.id).total;
    const pending = get("SELECT 1 FROM ow_clicks WHERE offer_id=? AND status='pending'", offer.id);
    const budgetLeft = fresh.owner_id ? fresh.budget - spentOf(fresh.id) : Infinity;
    const minUnit = fresh.type === 'cpa' ? Math.min(...JSON.parse(fresh.steps).map(step => step.cost)) : fresh.cost;
    if (fresh.owner_id && budgetLeft < minUnit) return finish(fresh, 'closed', '예산 소진');
    if (fresh.status !== 'active' || fresh.type === 'cpa') return;
    if (used >= fresh.goal && !pending) finish(fresh, 'closed', '목표 달성');
    else if (used >= fresh.goal) run('UPDATE ow_offers SET reason=? WHERE id=?', goalReason, fresh.id);
    // 검수에서 반려돼 다시 자리가 생기면 '검수 후 종료' 안내를 지웁니다.
    else if (fresh.reason === goalReason) run("UPDATE ow_offers SET reason='' WHERE id=?", fresh.id);
  }

  function postbackRequest(network, values) {
    const secret = unseal(network.secret_enc);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const filled = { ...values, timestamp };
    filled.signature = hmac(secret, `${filled.transaction_id}.${filled.click_id}.${timestamp}`);
    const url = network.postback_url.replace(/\{([a-z_]+)\}/g, (_, name) => encodeURIComponent(filled[name] ?? ''));
    return { url, body: network.postback_method === 'POST' ? JSON.stringify(filled) : null, signature: filled.signature, timestamp };
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
        headers: { 'User-Agent': 'Adsform-Offerwall/2.0', Accept: 'application/json, text/plain, */*', 'X-Adsform-Timestamp': timestamp, 'X-Adsform-Signature': signature,
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

  let draining = false;
  async function drain() {
    if (draining) return;
    draining = true;
    try {
      for (let round = 0; round < 100; round++) {
        const job = get(`SELECT p.id, p.attempts, p.network_id, v.id AS conversion, v.step, v.price, v.reward, c.id AS click, c.click_id, c.network_user, o.slug, o.type
          FROM ow_postbacks p JOIN ow_conversions v ON v.id=p.conversion_id JOIN ow_clicks c ON c.id=v.click_ref JOIN ow_offers o ON o.id=c.offer_id
          WHERE p.status='queued' AND p.next_at<=? ORDER BY p.next_at LIMIT 1`, Date.now());
        if (!job) break;
        run("UPDATE ow_postbacks SET status='sending', attempts=attempts+1 WHERE id=?", job.id);
        const network = get('SELECT * FROM ow_networks WHERE id=?', job.network_id);
        let result;
        if (!network.postback_url) result = { code: 0, error: '포스트백 주소가 설정되지 않았습니다.' };
        else {
          try {
            result = await send(postbackRequest(network, { click_id: job.click_id, user_id: job.network_user, offer_id: job.slug, offer_type: job.type, event: job.step,
              transaction_id: `adsform-${job.click}${job.step === 'done' ? '' : '-' + job.step}`, price: String(job.price), reward: String(job.reward) }));
          } catch (error) { result = { code: 0, error: error.message }; }
        }
        const ok = result.code >= 200 && result.code < 300;
        const attempts = job.attempts + 1;
        const giveUp = !ok && attempts >= maxPostbackAttempts;
        run('UPDATE ow_postbacks SET status=?, next_at=?, last_code=?, last_error=?, sent=? WHERE id=?', ok ? 'sent' : giveUp ? 'failed' : 'queued',
          ok || giveUp ? 0 : Date.now() + backoff[attempts - 1] * 1000, result.code || null, ok ? '' : String(result.error || result.text || `HTTP ${result.code}`).slice(0, 300), ok ? now() : null, job.id);
        if (giveUp) audit(null, '오퍼월 포스트백 실패', `ow-click:${job.click}`, `${network.name} · ${attempts}회 시도`);
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
    const result = await send(postbackRequest(network, { click_id: `adsform-test-${stamp}`, user_id: 'adsform-test-user', offer_id: 'test', offer_type: 'visit', event: 'done',
      transaction_id: `adsform-test-${stamp}`, price: '0', reward: '0' }));
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
      audit(user.id, '오퍼월 포스트백 재전송', `ow-postback:${id}`);
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
      assert(click?.status === 'pending', '검수 대기 중인 참여가 아닙니다.', 409);
      const offer = get('SELECT * FROM ow_offers WHERE id=?', click.offer_id);
      if (body.action === 'approve') {
        assert(convert(click, offer), '광고 예산이 모두 소진돼 승인할 수 없습니다. 반려해 주세요.', 409);
        run("UPDATE ow_clicks SET status='completed', finished=? WHERE id=?", now(), id);
      } else run("UPDATE ow_clicks SET status='rejected', reason=?, finished=? WHERE id=?", reason, now(), id);
      audit(user.id, '오퍼월 참여 검수', `ow-click:${id}`, body.action === 'approve' ? 'approved' : 'rejected');
      closeIfDone(offer);
      return {};
    });
  }

  /* ---------- 조회 ---------- */
  const networkView = n => ({ id: n.id, code: n.code, name: n.name, preset: n.preset, status: n.status, api_key: n.api_key, click_param: n.click_param, user_param: n.user_param,
    sign_landing: Boolean(n.sign_landing), postback_url: n.postback_url, postback_method: n.postback_method, ip_allowlist: n.ip_allowlist, reward_rate: n.reward_rate,
    point_unit: n.point_unit, created: n.created, updated: n.updated, rotated: n.rotated });

  const offerStats = `
    (SELECT COUNT(*) FROM ow_clicks WHERE offer_id=o.id) AS landings,
    (SELECT COUNT(*) FROM ow_clicks WHERE offer_id=o.id AND status='completed') AS completed,
    (SELECT COUNT(*) FROM ow_clicks WHERE offer_id=o.id AND status='pending') AS pending,
    (SELECT COUNT(*) FROM ow_clicks WHERE offer_id=o.id AND status IN ('failed','rejected')) AS failed,
    (SELECT COUNT(*) FROM ow_clicks WHERE offer_id=o.id AND status IN ('completed','pending') AND finished>=?) AS today,
    (SELECT COALESCE(SUM(v.cost),0) FROM ow_conversions v JOIN ow_clicks c ON c.id=v.click_ref WHERE c.offer_id=o.id) AS spent,
    (SELECT COALESCE(SUM(v.price),0) FROM ow_conversions v JOIN ow_clicks c ON c.id=v.click_ref WHERE c.offer_id=o.id) AS paid,
    (SELECT COUNT(*) FROM ow_conversions v JOIN ow_clicks c ON c.id=v.click_ref WHERE c.offer_id=o.id) AS conversions,
    COALESCE((SELECT SUM(amount) FROM ledger WHERE wallet='credit' AND kind='ow_release' AND ref=CAST(o.id AS TEXT)),0) AS returned`;

  const offerView = (offer, admin) => {
    const { keyword, conv_secret_enc: secret, questions, steps, request_key: _key, ...rest } = offer;
    return { ...rest, has_conv_key: Boolean(secret), action: actionText(offer), keyword: admin || offer.owner_id ? keyword : '',
      questions: JSON.parse(questions), steps: JSON.parse(steps), placements: all('SELECT network_id,price,reward,status FROM ow_placements WHERE offer_id=?', offer.id) };
  };

  function adminOverview(user, params, req) {
    const today = dayStart();
    const networks = all('SELECT * FROM ow_networks ORDER BY id').map(networkView);
    const offers = all(`SELECT o.*, u.name AS owner, ${offerStats} FROM ow_offers o LEFT JOIN users u ON u.id=o.owner_id
      ORDER BY (o.status='review') DESC, (o.status='active') DESC, o.id DESC`, today).map(offer => offerView(offer, true));
    const status = ['started', 'pending', 'completed', 'failed', 'rejected', 'expired'].includes(params.get('status')) ? params.get('status') : '';
    const offerId = Number(params.get('offer')) || 0;
    const where = "(?='' OR c.status=?) AND (?=0 OR c.offer_id=?)";
    const args = [status, status, offerId, offerId];
    const total = get(`SELECT COUNT(*) AS total FROM ow_clicks c WHERE ${where}`, ...args).total;
    const pages = Math.max(1, Math.ceil(total / 30));
    const page = Math.min(Math.max(1, Number(params.get('page')) || 1), pages);
    const clicks = all(`SELECT c.id,c.ref,c.offer_id,c.click_id,c.network_user,c.origin,c.status,c.tries,c.answers,c.proof_id,c.reason,c.price,c.reward,c.created,c.finished,
      o.title, o.type, o.questions, o.verify, n.name AS network, n.point_unit FROM ow_clicks c JOIN ow_offers o ON o.id=c.offer_id JOIN ow_networks n ON n.id=c.network_id
      WHERE ${where} ORDER BY (c.status='pending') DESC, c.id DESC LIMIT 30 OFFSET ?`, ...args, (page - 1) * 30)
      .map(({ questions, answers, ...click }) => ({ ...click, prompts: JSON.parse(questions).map(q => q.prompt), answers: answers ? JSON.parse(answers) : null,
        postbacks: all(`SELECT p.id, p.status, p.attempts, p.last_code, p.last_error, p.sent, v.step FROM ow_postbacks p JOIN ow_conversions v ON v.id=p.conversion_id WHERE v.click_ref=? ORDER BY v.id`, click.id) }));
    const counts = {
      review: get("SELECT COUNT(*) AS total FROM ow_offers WHERE status='review'").total,
      pending: get("SELECT COUNT(*) AS total FROM ow_clicks WHERE status='pending'").total,
      failedPostbacks: get("SELECT COUNT(*) AS total FROM ow_postbacks WHERE status='failed'").total,
      queuedPostbacks: get("SELECT COUNT(*) AS total FROM ow_postbacks WHERE status IN ('queued','sending')").total,
      completedToday: get('SELECT COUNT(*) AS total FROM ow_conversions WHERE created>=?', today).total,
      revenueToday: get('SELECT COALESCE(SUM(cost-price),0) AS total FROM ow_conversions WHERE created>=?', today).total
    };
    return { origin: req.site.origin, networks, offers, clicks, page, pages, total, counts, presets, macros, rates: rates(), types: offerTypes, categories, sns: snsTypes };
  }

  function ownerOverview(user) {
    assert(user, '로그인이 필요합니다.', 401);
    assert(partnerRoles.includes(user.role), '이 기능을 사용할 권한이 없습니다.', 403);
    const offers = all(`SELECT o.*, ${offerStats} FROM ow_offers o WHERE o.owner_id=? ORDER BY o.id DESC`, dayStart(), user.id).map(offer => offerView(offer, false));
    const trend = all(`SELECT date(v.created,'+9 hours') AS day, COUNT(*) AS total, SUM(v.cost) AS spend FROM ow_conversions v JOIN ow_clicks c ON c.id=v.click_ref
      JOIN ow_offers o ON o.id=c.offer_id WHERE o.owner_id=? AND v.created>=? GROUP BY day`, user.id, dayStart(new Date(Date.now() - 13 * 86_400_000).toISOString().slice(0, 10)));
    return { offers, trend, rates: rates(), types: offerTypes, categories, sns: snsTypes, balance: balance(user.id, 'credit'), networks: get("SELECT COUNT(*) AS total FROM ow_networks WHERE status='active'").total };
  }

  async function proofImage(req, res, user, url) {
    assert(user, '로그인이 필요합니다.', 401);
    const id = int(url.searchParams.get('id') || '', '이미지 번호', 1, 1e9);
    const row = get(`SELECT a.data, o.owner_id FROM ow_assets a JOIN ow_clicks c ON c.proof_id=a.id JOIN ow_offers o ON o.id=c.offer_id WHERE a.id=? AND a.kind='proof'`, id);
    assert(row && (isAdmin(user) || row.owner_id === user.id), '이미지를 찾을 수 없습니다.', 404);
    res.writeHead(200, { ...headers, 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store' });
    return res.end(row.data);
  }

  /* ---------- 매체 서버 API ---------- */
  function partner(req, url) {
    const apiKey = String(req.headers['x-adsform-key'] || '');
    const timestamp = String(req.headers['x-adsform-timestamp'] || '');
    const signature = String(req.headers['x-adsform-signature'] || '');
    limit(`ow-api-ip:${clientIp(req)}`, 120, 60_000);
    const network = /^awk_[a-f0-9]{24}$/.test(apiKey) ? get('SELECT * FROM ow_networks WHERE api_key=?', apiKey) : null;
    assert(network && network.status === 'active', '인증에 실패했습니다.', 401);
    assert(allowedIp(network.ip_allowlist, clientIp(req)), '허용되지 않은 IP입니다.', 403);
    assert(/^\d{10}$/.test(timestamp) && Math.abs(Date.now() / 1000 - Number(timestamp)) <= apiSkew, '요청 시각이 올바르지 않습니다.', 401);
    assert(sameHex(signature, hmac(unseal(network.secret_enc), `${timestamp}\n${req.method}\n${url.pathname}${url.search}`)), '인증에 실패했습니다.', 401);
    return network;
  }

  const liveOffers = network => all(`SELECT o.*, p.price, p.reward FROM ow_offers o JOIN ow_placements p ON p.offer_id=o.id
    WHERE p.network_id=? AND p.status='active' AND o.status='active' AND o.start_date<=? AND o.end_date>=? ORDER BY o.category, o.id DESC`, network.id, dateKst(), dateKst());
  const imageUrl = (origin, id) => id ? `${origin}/ow/img/${id}` : null;

  function feedItem(origin, network, offer) {
    const steps = JSON.parse(offer.steps);
    return { id: offer.slug, category: offer.category, category_label: categories[offer.category], type: offer.type, title: offer.title, brand: offer.brand,
      action: actionText(offer), description: offer.intro, badge: offer.badge || null, sns: offer.sns || null, repeat: offer.repeat,
      reward: offer.reward, point_unit: network.point_unit, price: offer.price, remaining: capacity(offer), daily_cap: offer.daily_cap,
      steps: steps.map(step => ({ event: step.code, label: step.label, reward: Math.floor(offer.reward * step.cost / (steps.reduce((s, x) => s + x.cost, 0) || 1)) })),
      questions: offer.type === 'quiz' || offer.type === 'survey' ? JSON.parse(offer.questions).length : 0,
      icon_url: imageUrl(origin, offer.icon_id), banner_url: imageUrl(origin, offer.banner_id), start_date: offer.start_date, end_date: offer.end_date,
      landing_url: `${origin}/ow/${offer.slug}?nw=${network.code}&${network.click_param}={CLICK_ID}&${network.user_param}={USER_ID}${network.sign_landing ? '&ts={TS}&sig={SIG}' : ''}`,
      signature_base: network.sign_landing ? `${offer.slug}.{CLICK_ID}.{USER_ID}.{TS}` : null };
  }

  function feed(req, network) {
    const origin = req.site.origin;
    return { network: network.code, generated: now(), point_unit: network.point_unit,
      wall_url: `${origin}/ow/wall?nw=${network.code}&${network.user_param}={USER_ID}${network.sign_landing ? '&ts={TS}&sig={SIG}' : ''}`,
      wall_signature_base: network.sign_landing ? 'wall.{USER_ID}.{TS}' : null,
      categories: Object.entries(categories).map(([key, label]) => ({ key, label })),
      offers: liveOffers(network).map(offer => feedItem(origin, network, offer)) };
  }

  function clickStatus(network, clickId) {
    assert(idPattern.test(clickId), '클릭 ID 형식이 올바르지 않습니다.');
    const click = get('SELECT c.*, o.slug FROM ow_clicks c JOIN ow_offers o ON o.id=c.offer_id WHERE c.network_id=? AND c.click_id=?', network.id, clickId);
    assert(click, '클릭을 찾을 수 없습니다.', 404);
    return { click_id: click.click_id, offer_id: click.slug, status: click.status, completed_at: click.status === 'completed' ? click.finished : null,
      conversions: all(`SELECT v.step AS event, v.reward, v.created, p.status AS postback FROM ow_conversions v LEFT JOIN ow_postbacks p ON p.conversion_id=v.id WHERE v.click_ref=? ORDER BY v.id`, click.id)
        .map(item => ({ ...item, transaction_id: `adsform-${click.id}${item.event === 'done' ? '' : '-' + item.event}` })) };
  }

  // 미션형 광고: 광고주 서버가 회원의 단계 완료(가입·설치·조회 등)를 알려 줍니다.
  async function conversionApi(req) {
    limit(`ow-conv-ip:${clientIp(req)}`, 300, 60_000);
    const raw = await readBody(req, 4096);
    const slug = String(req.headers['x-adsform-offer'] || '');
    const timestamp = String(req.headers['x-adsform-timestamp'] || '');
    const signature = String(req.headers['x-adsform-signature'] || '');
    const offer = slugPattern.test(slug) ? get("SELECT * FROM ow_offers WHERE slug=? AND type='cpa'", slug) : null;
    assert(offer?.conv_secret_enc, '인증에 실패했습니다.', 401);
    assert(/^\d{10}$/.test(timestamp) && Math.abs(Date.now() / 1000 - Number(timestamp)) <= apiSkew, '요청 시각이 올바르지 않습니다.', 401);
    assert(sameHex(signature, hmac(unseal(offer.conv_secret_enc), `${timestamp}\nPOST\n/ow/v1/conversions\n${sha(raw)}`)), '인증에 실패했습니다.', 401);
    let body;
    try { body = JSON.parse(raw.toString()); } catch { fail(400, '잘못된 요청입니다.'); }
    assert(typeof body?.click === 'string' && /^[a-f0-9]{24}$/.test(body.click), '클릭 값이 올바르지 않습니다.');
    const steps = JSON.parse(offer.steps);
    assert(steps.some(step => step.code === body.event), '등록되지 않은 이벤트입니다.');
    return transaction(() => {
      const click = get('SELECT * FROM ow_clicks WHERE ref=? AND offer_id=?', body.click, offer.id);
      assert(click, '클릭을 찾을 수 없습니다.', 404);
      if (get('SELECT 1 FROM ow_conversions WHERE click_ref=? AND step=?', click.id, body.event)) return { status: 'duplicate' };
      assert(click.expires > Date.now(), '전환 인정 기간이 지났습니다.', 409);
      assert(['active', 'paused'].includes(get('SELECT status FROM ow_offers WHERE id=?', offer.id).status), '종료된 광고입니다.', 409);
      assert(convert(click, offer, body.event), '광고 예산이 소진됐습니다.', 409);
      const done = steps.every(step => get('SELECT 1 FROM ow_conversions WHERE click_ref=? AND step=?', click.id, step.code));
      if (done) run("UPDATE ow_clicks SET status='completed', finished=? WHERE id=?", now(), click.id);
      closeIfDone(offer);
      return { status: 'accepted', completed: done };
    });
  }

  /* ---------- 참여(랜딩) ---------- */
  const offerCookie = slug => `ow_${slug}`;
  const cookieValue = (req, name) => req.headers.cookie?.match(new RegExp(`(?:^|;\\s*)${name.replace(/-/g, '\\-')}=([a-f0-9]{64})(?:;|$)`))?.[1];
  const cookie = (req, res, name, path, token, maxAge) => res.appendHeader('Set-Cookie',
    `${name}=${token}; HttpOnly; SameSite=Lax; Path=${path}; Max-Age=${maxAge}${req.site.secure ? '; Secure' : ''}`);
  const redirect = (res, location) => { res.writeHead(303, { ...headers, Location: location, 'Cache-Control': 'no-store' }); return res.end(); };
  // 안내 문구는 코드로만 넘겨, 주소에 임의 문구를 넣어 애즈폼 화면처럼 꾸미지 못하게 합니다.
  const landingError = (res, code) => redirect(res, `/ow/expired?r=${code}`);
  const period = offer => offer.repeat === 'daily' ? dateKst() : 'once';
  const liveFor = (offer, network) => offer.status === 'active' && offer.start_date <= dateKst() && offer.end_date >= dateKst() && network.status === 'active' &&
    get("SELECT * FROM ow_placements WHERE offer_id=? AND network_id=? AND status='active'", offer.id, network.id);

  // 클릭을 만들거나, 이미 있는 참여를 이어서 할 수 있게 새 세션 토큰을 발급합니다.
  function openClick(req, offer, network, clickId, member, origin) {
    const ip = clientIp(req);
    return transaction(() => {
      const placement = liveFor(get('SELECT * FROM ow_offers WHERE id=?', offer.id), network);
      if (!placement) return { error: 'closed' };
      const key = period(offer);
      const sameClick = get('SELECT * FROM ow_clicks WHERE network_id=? AND click_id=?', network.id, clickId);
      if (sameClick && (sameClick.offer_id !== offer.id || sameClick.network_user !== member)) return { error: 'used' };
      const prior = sameClick || get('SELECT * FROM ow_clicks WHERE offer_id=? AND network_id=? AND network_user=? AND period=?', offer.id, network.id, member, key);
      const token = randomBytes(32).toString('hex');
      const time = Date.now();
      const ttl = offer.type === 'cpa' ? cpaDays * 86_400_000 : clickMinutes * 60_000;
      if (prior) {
        const resumable = prior.status === 'started' || (prior.status === 'expired' && prior.reason !== '모집 마감');
        if (resumable) {
          const stale = prior.status === 'expired' || prior.expires <= time;
          if (stale && !capacity(offer)) return { error: 'full' };
          const freshId = !sameClick && !get('SELECT 1 FROM ow_clicks WHERE network_id=? AND click_id=?', network.id, clickId);
          run(`UPDATE ow_clicks SET token=?, status='started', finished=NULL${freshId ? ', click_id=?' : ''}${stale ? ', opened=?, expires=?' : ''} WHERE id=?`,
            sha(token), ...(freshId ? [clickId] : []), ...(stale ? [time, time + ttl] : []), prior.id);
        } else run('UPDATE ow_clicks SET token=? WHERE id=?', sha(token), prior.id);
        return { token };
      }
      if (!capacity(offer)) return { error: 'full' };
      if (get('SELECT COUNT(*) AS total FROM ow_clicks WHERE offer_id=? AND ip=? AND created>=?', offer.id, ip, dayStart()).total >= offer.ip_daily_limit) return { error: 'ip' };
      run(`INSERT INTO ow_clicks(ref,offer_id,network_id,click_id,network_user,period,origin,token,ip,ua,status,price,reward,created,opened,expires)
        VALUES (?,?,?,?,?,?,?,?,?,?,'started',?,?,?,?,?)`, randomBytes(12).toString('hex'), offer.id, network.id, clickId, member, key, origin, sha(token), ip,
        sha(String(req.headers['user-agent'] || '')).slice(0, 16), placement.price, placement.reward, now(), time, time + ttl);
      return { token };
    });
  }

  function checkSignature(network, params, base) {
    if (!network.sign_landing) return '';
    const ts = params.get('ts') || '';
    if (!/^\d{10}$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > landingSkew) return 'stale';
    if (!sameHex(params.get('sig') || '', hmac(unseal(network.secret_enc), `${base}.${ts}`))) return 'signature';
    return '';
  }

  function networkFrom(params) {
    const code = params.get('nw') || '';
    const network = /^[a-z][a-z0-9-]{1,19}$/.test(code) ? get('SELECT * FROM ow_networks WHERE code=?', code) : null;
    return network?.status === 'active' ? network : null;
  }

  function landing(req, res, url, offer) {
    const key = `ow-land-ip:${clientIp(req)}`;
    if (hits(key) >= 60) return landingError(res, 'busy');
    hit(key);
    const network = networkFrom(url.searchParams);
    if (!network) return landingError(res, 'network');
    const clickId = url.searchParams.get(network.click_param) || '';
    const member = url.searchParams.get(network.user_param) || '';
    if (!idPattern.test(clickId) || !idPattern.test(member)) return landingError(res, 'params');
    const problem = checkSignature(network, url.searchParams, `${offer.slug}.${clickId}.${member}`);
    if (problem) return landingError(res, problem);
    const outcome = openClick(req, offer, network, clickId, member, 'feed');
    if (outcome.error) return landingError(res, outcome.error);
    cookie(req, res, offerCookie(offer.slug), `/ow/${offer.slug}`, outcome.token, 24 * 3600);
    // 클릭 ID·회원 식별값이 주소창·방문 기록에 남지 않도록 깨끗한 주소로 다시 보냅니다.
    return redirect(res, `/ow/${offer.slug}`);
  }

  const canPreview = (req, url, offer) => {
    if (url.searchParams.get('preview') !== '1') return false;
    const user = session(req);
    return isAdmin(user) || (offer && user && offer.owner_id === user.id);
  };
  const clickFor = (req, offer) => {
    const token = cookieValue(req, offerCookie(offer.slug));
    return token ? get('SELECT c.*, n.name AS network, n.point_unit FROM ow_clicks c JOIN ow_networks n ON n.id=c.network_id WHERE c.token=? AND c.offer_id=?', sha(token), offer.id) : null;
  };
  const wallFor = req => {
    const token = cookieValue(req, 'owwall');
    if (!token) return null;
    const wall = get('SELECT w.*, n.code, n.name, n.point_unit, n.status FROM ow_walls w JOIN ow_networks n ON n.id=w.network_id WHERE w.token=? AND w.expires>?', sha(token), Date.now());
    return wall?.status === 'active' ? wall : null;
  };

  function publicOffer(offer) {
    const steps = JSON.parse(offer.steps);
    return { slug: offer.slug, type: offer.type, category: offer.category, title: offer.title, brand: offer.brand, intro: offer.intro, badge: offer.badge, guide: offer.guide,
      action: actionText(offer), sns: offer.sns, snsLabel: snsTypes[offer.sns]?.label || '', verify: offer.verify, target: ['visit', 'content', 'follow'].includes(offer.type) ? offer.target_url : '',
      icon: offer.icon_id ? `/ow/img/${offer.icon_id}` : null, banner: offer.banner_id ? `/ow/img/${offer.banner_id}` : null, repeat: offer.repeat,
      questions: JSON.parse(offer.questions).map(({ prompt, choices }) => ({ prompt, choices: choices || [] })), steps: steps.map(({ code, label, cost }) => ({ code, label, cost })),
      attempts: offer.attempts, minDwell: offer.min_dwell };
  }

  function participantState(req, url, offer) {
    const base = publicOffer(offer);
    const wall = wallFor(req);
    if (canPreview(req, url, offer)) return { offer: { ...base, reward: 100, unit: 'P', network: '미리보기' }, preview: true, now: Date.now(),
      click: { status: 'started', triesLeft: offer.attempts, opened: Date.now(), done: [] } };
    const click = clickFor(req, offer);
    assert(click, '참여 정보를 찾을 수 없어요. 리워드 앱의 미션 목록에서 다시 들어와 주세요.', 401);
    const total = base.steps.reduce((sum, step) => sum + step.cost, 0) || 1;
    const expired = click.status === 'started' && click.expires <= Date.now();
    return { offer: { ...base, steps: base.steps.map(({ code, label, cost }) => ({ code, label, reward: Math.floor(click.reward * cost / total) })),
      reward: click.reward, unit: click.point_unit, network: click.network }, now: Date.now(), wall: Boolean(wall && wall.network_id === click.network_id),
      click: { status: expired ? 'expired' : click.status, reason: click.reason, triesLeft: Math.max(0, offer.attempts - click.tries), opened: click.opened, expires: click.expires,
        finished: click.finished, done: all('SELECT step FROM ow_conversions WHERE click_ref=?', click.id).map(row => row.step) } };
  }

  function grade(offer, body) {
    const questions = JSON.parse(offer.questions);
    assert(Array.isArray(body.answers) && body.answers.length === questions.length, '모든 문항에 답해 주세요.');
    if (offer.type === 'quiz') {
      const answers = body.answers.map((value, i) => int(value, `${i + 1}번 답`, 0, questions[i].choices.length - 1));
      return { answers: answers.map((value, i) => questions[i].choices[value]), correct: answers.every((value, i) => value === questions[i].answer) };
    }
    const answers = body.answers.map((value, i) => str(value, `${i + 1}번 답변`, 1000, 5));
    for (const answer of answers) assert(new Set(answer.replace(/\s/g, '')).size >= 3, '같은 글자만 반복한 답변은 제출할 수 없어요.');
    return { answers, correct: true };
  }

  const normalize = text => String(text || '').normalize('NFC').replace(/\s+/g, '').toLowerCase();

  // 제출 처리: 방문·콘텐츠(방문 확인), 팔로우(키워드), 퀴즈·설문, 미션형(참여 주소 이동)
  function submit(req, url, offer, body) {
    if (canPreview(req, url, offer)) {
      if (offer.type === 'quiz' || offer.type === 'survey') {
        const { correct } = grade(offer, body);
        return { preview: true, status: offer.type === 'survey' ? (offer.review ? 'pending' : 'completed') : correct ? 'completed' : 'failed' };
      }
      if (offer.type === 'follow' && offer.verify === 'keyword') return { preview: true, status: normalize(body.keyword) === normalize(offer.keyword) ? 'completed' : 'retry', triesLeft: 4 };
      return { preview: true, status: offer.type === 'cpa' ? 'started' : 'completed', url: offer.type === 'cpa' ? null : offer.target_url };
    }
    const token = cookieValue(req, offerCookie(offer.slug));
    assert(token, '참여 정보를 찾을 수 없어요. 리워드 앱에서 다시 들어와 주세요.', 401);
    limit(`ow-submit:${token}`, 12, 60_000);
    return transaction(() => {
      const click = get('SELECT * FROM ow_clicks WHERE token=? AND offer_id=?', sha(token), offer.id);
      assert(click, '참여 정보를 찾을 수 없어요. 리워드 앱에서 다시 들어와 주세요.', 401);
      const network = get('SELECT * FROM ow_networks WHERE id=?', click.network_id);
      const fresh = get('SELECT * FROM ow_offers WHERE id=?', offer.id);
      if (offer.type === 'cpa') {
        // 미션형은 광고주 페이지로 보내고, 완료는 광고주 서버의 전환 통보로 확인합니다.
        assert(click.status === 'started' && click.expires > Date.now(), '참여 기간이 지났어요. 리워드 앱에서 다시 들어와 주세요.', 409);
        if (!liveFor(fresh, network)) return { status: 'closed' };
        const target = new URL(offer.target_url);
        target.searchParams.set('adsform_click', click.ref);
        return { status: 'started', url: target.href };
      }
      if (click.status !== 'started') return { status: click.status, url: ['visit', 'content'].includes(offer.type) ? offer.target_url : undefined };
      if (click.expires <= Date.now()) {
        run("UPDATE ow_clicks SET status='expired', finished=? WHERE id=?", now(), click.id);
        return { status: 'expired' };
      }
      assert(Date.now() - click.opened >= offer.min_dwell * 1000, `내용을 충분히 확인한 뒤 진행해 주세요. (최소 ${offer.min_dwell}초)`, 409);
      if (!liveFor(fresh, network)) return { status: 'closed' };
      const tries = click.tries + 1;
      let answers = null;
      let correct = true;
      let status = 'completed';
      if (offer.type === 'quiz' || offer.type === 'survey') ({ answers, correct } = grade(offer, body));
      if (offer.type === 'follow') {
        assert(offer.verify === 'keyword', '인증 화면을 올려 주세요.');
        answers = [str(body.keyword, '인증 키워드', 40)];
        correct = normalize(answers[0]) === normalize(offer.keyword);
      }
      const maxTries = offer.type === 'quiz' ? offer.attempts : offer.type === 'follow' ? 5 : 1;
      if (!correct) {
        const final = tries >= maxTries;
        run('UPDATE ow_clicks SET tries=?, status=?, answers=?, reason=?, finished=? WHERE id=?', tries, final ? 'failed' : 'started', JSON.stringify(answers),
          final ? (offer.type === 'quiz' ? '퀴즈 정답과 일치하지 않습니다.' : '인증 키워드가 일치하지 않습니다.') : '', final ? now() : null, click.id);
        return { status: final ? 'failed' : 'retry', triesLeft: maxTries - tries };
      }
      // 마지막 자리를 두고 동시에 제출해도 목표·일일 한도를 넘지 않도록 같은 트랜잭션에서 다시 셉니다.
      if (!capacity(fresh)) {
        run("UPDATE ow_clicks SET tries=?, status='expired', reason='모집 마감', finished=? WHERE id=?", tries, now(), click.id);
        return { status: 'full' };
      }
      if (offer.type === 'survey' && offer.review) status = 'pending';
      if (status === 'completed' && !convert(click, fresh)) {
        run("UPDATE ow_clicks SET tries=?, status='expired', reason='모집 마감', finished=? WHERE id=?", tries, now(), click.id);
        closeIfDone(fresh);
        return { status: 'full' };
      }
      run('UPDATE ow_clicks SET tries=?, status=?, answers=?, finished=? WHERE id=?', tries, status, answers ? JSON.stringify(answers) : null, now(), click.id);
      closeIfDone(fresh);
      return { status, url: ['visit', 'content'].includes(offer.type) ? offer.target_url : undefined };
    });
  }

  // 팔로우 인증 화면: 브라우저에서 JPG로 다시 그린 이미지만 받아 운영자가 검수합니다.
  async function proof(req, url, offer) {
    assert(offer.type === 'follow' && offer.verify === 'screenshot', '인증 화면을 받지 않는 광고입니다.');
    if (canPreview(req, url, offer)) return { preview: true, status: 'pending' };
    const token = cookieValue(req, offerCookie(offer.slug));
    assert(token, '참여 정보를 찾을 수 없어요. 리워드 앱에서 다시 들어와 주세요.', 401);
    assert(req.headers['content-type'] === 'image/jpeg', '인증 화면을 JPG로 보내 주세요.', 415);
    limit(`ow-proof:${token}`, 5, 600_000);
    const image = await readBody(req, 1536 * 1024);
    const size = jpegSize(image);
    assert(size && size.width >= 200 && size.height >= 200 && size.width <= 2400 && size.height <= 2400, '이미지 형식이 올바르지 않습니다.');
    return transaction(() => {
      const click = get('SELECT * FROM ow_clicks WHERE token=? AND offer_id=?', sha(token), offer.id);
      assert(click, '참여 정보를 찾을 수 없어요.', 401);
      if (click.status !== 'started') return { status: click.status };
      assert(click.expires > Date.now(), '참여 시간이 지났어요. 리워드 앱에서 다시 들어와 주세요.', 409);
      assert(Date.now() - click.opened >= offer.min_dwell * 1000, '채널을 확인한 뒤 진행해 주세요.', 409);
      const fresh = get('SELECT * FROM ow_offers WHERE id=?', offer.id);
      if (!liveFor(fresh, get('SELECT * FROM ow_networks WHERE id=?', click.network_id))) return { status: 'closed' };
      if (!capacity(fresh)) return { status: 'full' };
      const asset = Number(run("INSERT INTO ow_assets(owner_id,kind,data,width,height,created) VALUES (NULL,'proof',?,?,?,?)", image, size.width, size.height, now()).lastInsertRowid);
      run("UPDATE ow_clicks SET status='pending', proof_id=?, tries=tries+1, finished=? WHERE id=?", asset, now(), click.id);
      return { status: 'pending' };
    });
  }

  /* ---------- 오퍼월 호스팅 (포인트 받기 · 포인트 조회) ---------- */
  function wallEntry(req, res, url) {
    const key = `ow-land-ip:${clientIp(req)}`;
    if (hits(key) >= 60) return landingError(res, 'busy');
    hit(key);
    const network = networkFrom(url.searchParams);
    if (!network) return landingError(res, 'network');
    const member = url.searchParams.get(network.user_param) || '';
    if (!idPattern.test(member)) return landingError(res, 'params');
    const problem = checkSignature(network, url.searchParams, `wall.${member}`);
    if (problem) return landingError(res, problem);
    const token = randomBytes(32).toString('hex');
    run('DELETE FROM ow_walls WHERE expires<?', Date.now());
    run('INSERT INTO ow_walls(token,network_id,network_user,expires) VALUES (?,?,?,?)', sha(token), network.id, member, Date.now() + 12 * 3600_000);
    cookie(req, res, 'owwall', '/ow', token, 12 * 3600);
    return redirect(res, '/ow/wall');
  }

  function wallState(req, url) {
    const origin = req.site.origin;
    const user = url.searchParams.get('preview') === '1' ? session(req) : null;
    if (isAdmin(user)) {
      const offers = all("SELECT o.*, 100 AS price, 100 AS reward FROM ow_offers o WHERE o.status='active' AND o.end_date>=? ORDER BY o.category, o.id DESC", dateKst());
      return { preview: true, network: { name: '미리보기', unit: 'P' }, categories, offers: offers.map(offer => ({ ...feedItem(origin, { code: 'preview', click_param: 'c', user_param: 'u', point_unit: 'P' }, offer), state: '' })),
        history: [], totals: { earned: 0, pending: 0, count: 0 } };
    }
    const wall = wallFor(req);
    assert(wall, '오퍼월을 열 수 없어요. 리워드 앱에서 다시 들어와 주세요.', 401);
    const network = get('SELECT * FROM ow_networks WHERE id=?', wall.network_id);
    const mine = new Map(all(`SELECT offer_id, status, period FROM ow_clicks WHERE network_id=? AND network_user=? AND (period='once' OR period=?)`, network.id, wall.network_user, dateKst())
      .map(row => [row.offer_id, row.status]));
    const offers = liveOffers(network).map(offer => ({ ...feedItem(origin, network, offer), landing_url: undefined, signature_base: undefined, state: mine.get(offer.id) || '' }))
      .filter(item => item.remaining > 0 || item.state);
    const history = all(`SELECT v.step, v.reward, v.created, o.title, o.type, o.brand, p.status AS postback FROM ow_conversions v JOIN ow_clicks c ON c.id=v.click_ref
      JOIN ow_offers o ON o.id=c.offer_id LEFT JOIN ow_postbacks p ON p.conversion_id=v.id WHERE c.network_id=? AND c.network_user=? ORDER BY v.id DESC LIMIT 60`, network.id, wall.network_user);
    const pending = all(`SELECT c.reward, c.finished AS created, o.title, o.type, o.brand FROM ow_clicks c JOIN ow_offers o ON o.id=c.offer_id
      WHERE c.network_id=? AND c.network_user=? AND c.status='pending' ORDER BY c.id DESC LIMIT 20`, network.id, wall.network_user);
    const sums = get(`SELECT COALESCE(SUM(v.reward),0) AS earned, COUNT(*) AS count FROM ow_conversions v JOIN ow_clicks c ON c.id=v.click_ref WHERE c.network_id=? AND c.network_user=?`, network.id, wall.network_user);
    const month = get(`SELECT COALESCE(SUM(v.reward),0) AS total FROM ow_conversions v JOIN ow_clicks c ON c.id=v.click_ref WHERE c.network_id=? AND c.network_user=? AND v.created>=?`,
      network.id, wall.network_user, dayStart(dateKst().slice(0, 8) + '01')).total;
    return { network: { name: network.name, unit: network.point_unit }, categories, offers, history, pending,
      totals: { earned: sums.earned, count: sums.count, month, pending: pending.reduce((sum, item) => sum + item.reward, 0) } };
  }

  function wallOpen(req, res, body) {
    const wall = wallFor(req);
    assert(wall, '오퍼월을 열 수 없어요. 리워드 앱에서 다시 들어와 주세요.', 401);
    assert(typeof body.offer === 'string' && slugPattern.test(body.offer), '광고를 찾을 수 없습니다.', 404);
    const offer = get('SELECT * FROM ow_offers WHERE slug=?', body.offer);
    assert(offer, '광고를 찾을 수 없습니다.', 404);
    const network = get('SELECT * FROM ow_networks WHERE id=?', wall.network_id);
    const key = `ow-land-ip:${clientIp(req)}`;
    assert(hits(key) < 60, '요청이 많아요. 잠시 후 다시 시도해 주세요.', 429);
    hit(key);
    const outcome = openClick(req, offer, network, `w_${randomBytes(12).toString('hex')}`, wall.network_user, 'wall');
    const messages = { closed: '지금은 참여할 수 없는 광고예요.', used: '이미 사용된 참여 정보예요.', full: '참여 인원이 모두 찼어요.', ip: '같은 네트워크에서 참여가 많아 오늘은 더 참여할 수 없어요.' };
    assert(!outcome.error, messages[outcome.error], 409);
    cookie(req, res, offerCookie(offer.slug), `/ow/${offer.slug}`, outcome.token, 24 * 3600);
    return { url: `/ow/${offer.slug}` };
  }

  /* ---------- 라우팅 ---------- */
  const frameAncestors = (process.env.ADSFORM_OFFERWALL_FRAME_ANCESTORS || '').split(/\s+/).filter(item => /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(item));
  const pageHeaders = { ...headers, 'Content-Security-Policy': headers['Content-Security-Policy'].replace("frame-ancestors 'none'", `frame-ancestors ${frameAncestors.join(' ') || "'none'"}`) };
  if (frameAncestors.length) delete pageHeaders['X-Frame-Options'];
  let pageHtml;
  function page(res) {
    pageHtml ||= readFileSync(resolve(root, 'public', 'ow.html'));
    res.writeHead(200, { ...pageHeaders, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(pageHtml);
  }

  async function payload(req, size = 16384) {
    assert(req.headers['content-type']?.split(';')[0] === 'application/json', 'JSON 요청이 필요합니다.', 415);
    try {
      const data = JSON.parse((await readBody(req, size)).toString());
      assert(data && typeof data === 'object' && !Array.isArray(data), '잘못된 요청입니다.');
      return data;
    } catch (error) {
      if (error.status) throw error;
      fail(400, '잘못된 요청입니다.');
    }
  }
  const sameSite = req => assert(req.headers.origin === req.site.origin, '같은 사이트에서 요청해 주세요.', 403);

  async function handle(req, res, url) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[1] === 'v1') {
      if (parts[2] === 'conversions' && parts.length === 3) {
        assert(req.method === 'POST', '지원하지 않는 요청입니다.', 405);
        return json(res, 200, await conversionApi(req));
      }
      assert(req.method === 'GET', '지원하지 않는 요청입니다.', 405);
      const network = partner(req, url);
      if (parts.length === 3 && parts[2] === 'offers') return json(res, 200, feed(req, network));
      if (parts.length === 4 && parts[2] === 'clicks') return json(res, 200, clickStatus(network, decodeURIComponent(parts[3])));
      fail(404, '요청한 기능을 찾을 수 없습니다.');
    }
    if (parts[1] === 'img' && parts.length === 3 && req.method === 'GET') {
      const id = /^\d{1,9}$/.test(parts[2]) ? Number(parts[2]) : 0;
      const asset = get("SELECT data FROM ow_assets WHERE id=? AND kind IN ('icon','banner')", id);
      assert(asset, '이미지를 찾을 수 없습니다.', 404);
      // 매체가 자기 앱·웹 오퍼월에 아이콘을 그릴 수 있도록 다른 출처에서도 읽게 합니다.
      res.writeHead(200, { ...headers, 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400, immutable', 'Cross-Origin-Resource-Policy': 'cross-origin' });
      return res.end(asset.data);
    }
    if (parts[1] === 'expired' && parts.length === 2 && req.method === 'GET') return page(res);
    if (parts[1] === 'wall') {
      if (parts.length === 2 && req.method === 'GET') return url.searchParams.has('nw') ? wallEntry(req, res, url) : page(res);
      if (parts.length === 3 && parts[2] === 'state' && req.method === 'GET') return json(res, 200, wallState(req, url));
      if (parts.length === 3 && parts[2] === 'open' && req.method === 'POST') {
        sameSite(req);
        return json(res, 200, wallOpen(req, res, await payload(req)));
      }
      fail(404, '페이지를 찾을 수 없습니다.');
    }
    const slug = parts[1];
    assert(slugPattern.test(slug || ''), '페이지를 찾을 수 없습니다.', 404);
    const offer = get('SELECT * FROM ow_offers WHERE slug=?', slug);
    assert(offer, '페이지를 찾을 수 없습니다.', 404);
    if (parts.length === 2 && req.method === 'GET') return url.searchParams.has('nw') ? landing(req, res, url, offer) : page(res);
    if (parts.length === 3 && parts[2] === 'state' && req.method === 'GET') return json(res, 200, participantState(req, url, offer));
    if (parts.length === 3 && parts[2] === 'submit' && req.method === 'POST') {
      sameSite(req);
      return json(res, 200, submit(req, url, offer, await payload(req)));
    }
    if (parts.length === 3 && parts[2] === 'proof' && req.method === 'POST') {
      sameSite(req);
      return json(res, 200, await proof(req, url, offer));
    }
    fail(404, '페이지를 찾을 수 없습니다.');
  }

  const adminOnly = handler => (req, res, user, body) => {
    assert(user, '로그인이 필요합니다.', 401);
    assert(isAdmin(user), '이 기능을 사용할 권한이 없습니다.', 403);
    return handler(user, body, req);
  };
  const business = handler => (req, res, user, body) => {
    assert(user, '로그인이 필요합니다.', 401);
    assert(isAdmin(user) || partnerRoles.includes(user.role), '이 기능을 사용할 권한이 없습니다.', 403);
    return handler(user, body, req);
  };

  // 데모: 매체 2곳과 유형별 예시 광고를 만들어 오퍼월 화면을 바로 볼 수 있게 합니다.
  if (demo && !get("SELECT value FROM settings WHERE key='ow_demo'")) {
    transaction(() => {
      const admin = get("SELECT id FROM users WHERE username='demo.admin'");
      if (!admin) return;
      for (const [code, preset] of [['buzzvil', 'buzzvil'], ['adpopcorn', 'adpopcorn']]) {
        if (get('SELECT 1 FROM ow_networks WHERE code=?', code)) continue;
        run(`INSERT INTO ow_networks(code,name,preset,status,api_key,secret_enc,click_param,user_param,sign_landing,created) VALUES (?,?,?,'active',?,?,?,?,1,?)`,
          code, presets[preset].name, preset, 'awk_' + randomBytes(12).toString('hex'), seal(newSecret()), presets[preset].click_param, presets[preset].user_param, now());
      }
      const today = dateKst();
      const samples = [
        ['visit', '놓치지 마세요! 주방 수납 최대 할인', '오후의 상점', { target_url: 'https://example.com/sale', repeat: 'daily' }],
        ['visit', '쇼핑할 때마다 리워드가 차곡차곡', '오후의 상점', { target_url: 'https://example.com/store', badge: '매일' }],
        ['content', '두뇌 풀가동, 스피드 퀴즈', '오후의 상점', { target_url: 'https://example.com/speed-quiz' }],
        ['content', '오늘의 상식', '오후의 상점', { target_url: 'https://example.com/today' }],
        ['follow', '오후의 상점 유튜브', '오후의 상점', { sns: 'youtube', target_url: 'https://www.youtube.com/@example', verify: 'screenshot' }],
        ['follow', '오후의 상점 인스타그램', '오후의 상점', { sns: 'instagram', target_url: 'https://www.instagram.com/example', verify: 'keyword', keyword: '가을상점', guide: '프로필 소개글 맨 아래의 인증 키워드를 입력하세요.' }],
        ['quiz', '가을 신메뉴, 얼마나 알고 있나요?', '오후의 상점', { q1_prompt: '이번 가을 시그니처 음료는?', q1_c1: '밤 라떼', q1_c2: '딸기 라떼', q1_c3: '수박 주스', q1_answer: '1', attempts: '2' }],
        ['survey', '매장 방문 경험 설문', '오후의 상점', { q1_prompt: '가장 만족스러웠던 점은 무엇인가요?', q2_prompt: '바라는 점을 알려 주세요.', review: 'on' }],
        ['cpa', '[멀티미션] 오후의 상점 앱 가입하고 첫 주문', '오후의 상점', { target_url: 'https://example.com/app', badge: '멀티미션', s1_label: '앱 회원가입', s1_code: 'signup', s1_cost: '300', s2_label: '첫 주문 완료', s2_code: 'purchase', s2_cost: '1200' }]
      ];
      const adminUser = get('SELECT * FROM users WHERE id=?', admin.id);
      for (const [type, title, brand, extra] of samples) {
        const intro = { visit: '페이지를 방문하면 리워드를 드려요. 하루 한 번 참여할 수 있어요.', content: '재미있는 콘텐츠를 보고 리워드를 받으세요.', follow: '채널을 구독(팔로우)하고 인증하면 리워드를 드려요.',
          quiz: '오후의 상점이 이번 가을에 선보이는 시그니처 음료는 국산 밤을 졸여 만든 ‘밤 라떼’예요.', survey: '최근 매장 방문 경험을 들려주세요. 검수 후 리워드가 지급돼요.', cpa: '앱에 가입하고 첫 주문까지 완료하면 단계별로 리워드를 드려요.' }[type];
        // 데모 광고는 예산 없이 운영자 소유 예시로 만들고, 매체 단가는 유형별 기본 단가 기준으로 정합니다.
        const f = offerFields(adminUser, { type, title, brand, intro, goal: '500', start: today, end: '2099-12-31', min_dwell: '0', ...extra });
        const id = Number(run(`INSERT INTO ow_offers(slug,owner_id,type,category,title,brand,intro,badge,target_url,sns,verify,keyword,guide,questions,steps,review,attempts,min_dwell,repeat,cost,goal,daily_cap,
          ip_daily_limit,start_date,end_date,icon_id,banner_id,status,budget,conv_secret_enc,created_by,created) VALUES (?,NULL,${Array(25).fill('?').join(',')},'active',0,?,?,?)`,
          randomBytes(9).toString('base64url'), ...offerColumns(f), type === 'cpa' ? seal(newSecret()) : null, admin.id, now()).lastInsertRowid);
        for (const network of all('SELECT * FROM ow_networks')) place(get('SELECT * FROM ow_offers WHERE id=?', id), network);
      }
      run("INSERT INTO settings VALUES ('ow_demo', ?)", now());
    });
  }

  return {
    handle,
    uploadAsset,
    proofImage,
    routes: {
      '/api/offerwall/network': adminOnly(createNetwork),
      '/api/offerwall/network/update': adminOnly(updateNetwork),
      '/api/offerwall/network/rotate': adminOnly(rotateNetwork),
      '/api/offerwall/network/test': adminOnly(testPostback),
      '/api/offerwall/rates': adminOnly(saveRates),
      '/api/offerwall/offer': business(createOffer),
      '/api/offerwall/offer/update': business(updateOffer),
      '/api/offerwall/offer/status': business(offerStatus),
      '/api/offerwall/offer/extend': business(extendOffer),
      '/api/offerwall/offer/convkey': business(rotateConversionKey),
      '/api/offerwall/click/review': adminOnly(reviewClick),
      '/api/offerwall/postback/retry': adminOnly(retryPostback)
    },
    getRoutes: {
      '/api/offerwall': (user, params, req) => {
        assert(user, '로그인이 필요합니다.', 401);
        assert(isAdmin(user), '이 기능을 사용할 권한이 없습니다.', 403);
        return adminOverview(user, params, req);
      },
      '/api/offerwall/mine': user => ownerOverview(user)
    },
    counts: () => ({ review: get("SELECT COUNT(*) AS total FROM ow_offers WHERE status='review'").total, pending: get("SELECT COUNT(*) AS total FROM ow_clicks WHERE status='pending'").total }),
    hasLive: userId => Boolean(get("SELECT 1 FROM ow_offers WHERE owner_id=? AND status IN ('review','active','paused')", userId)),
    drain
  };
}
