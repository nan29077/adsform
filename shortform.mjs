// 숏폼 배포
//
// 애즈폼의 메인 마케팅 상품입니다. 광고 계정(광고주·대행사·실행사)이 숏폼 배포 캠페인을 등록하면,
// 부업회원(명칭은 관리자 설정에서 바꿀 수 있습니다)이 자기 유튜브·인스타그램·페이스북·틱톡 계정에
// 숏폼을 만들어(또는 받은 영상을) 올리고 게시물 주소를 제출합니다. 최고관리자가 검수·승인하면
// 정산 보류 기간(게시 유지 확인)이 지난 뒤 부업 수익으로 지급됩니다.
//
//  · 부업회원  : 가입 → 운영팀 승인 → SNS 채널 등록(인증 코드) → 운영팀 채널 인증 → 캠페인 참여
//  · 캠페인    : 제작+배포(produce) / 배포만(distribute) · 플랫폼별 배포 건수 · 건당 단가 스냅샷 · 예산 배정
//  · 작업 흐름 : 신청(applied) → 선정(accepted) → [시안 제출(drafted) → 수정 요청(revise) / 시안 승인(ready)]
//                → 배포 제출(posted) → 승인(approved, 정산 보류) → 정산 완료(paid)
//                만료(expired) · 미선정(declined) · 취소(canceled) · 반려(rejected) · 승인 취소(revoked)
//  · 돈의 흐름 : 등록 시 광고 잔액에서 예산 배정(sf_reserve) → 승인 건만 집행 → 종료 시 미집행 반환(sf_release)
//                부업회원은 승인 건마다 지급액(sf_pay)을 부업 수익 지갑(earning)으로 받고 출금 신청합니다.
import { createHash, randomBytes } from 'node:crypto';
import { jpegSize } from './offerwall.mjs';

export const platforms = {
  youtube: { label: '유튜브 쇼츠', short: '유튜브', hosts: ['youtube.com', 'youtu.be'] },
  instagram: { label: '인스타그램 릴스', short: '인스타그램', hosts: ['instagram.com'] },
  facebook: { label: '페이스북 릴스', short: '페이스북', hosts: ['facebook.com', 'fb.watch', 'fb.com'] },
  tiktok: { label: '틱톡', short: '틱톡', hosts: ['tiktok.com'] }
};
export const modes = {
  produce: { label: '제작 + 배포', intro: '부업회원이 가이드에 맞춰 숏폼을 직접 만들어 자기 계정에 올려요.' },
  distribute: { label: '배포만', intro: '광고주가 준비한 영상을 부업회원 계정에 그대로 올려요.' }
};
export const defaultRates = {
  produce: { youtube: { cost: 30000, pay: 15000 }, instagram: { cost: 30000, pay: 15000 }, facebook: { cost: 20000, pay: 10000 }, tiktok: { cost: 30000, pay: 15000 } },
  distribute: { youtube: { cost: 12000, pay: 6000 }, instagram: { cost: 12000, pay: 6000 }, facebook: { cost: 8000, pay: 4000 }, tiktok: { cost: 12000, pay: 6000 } }
};
const lengths = [15, 30, 60, 90];
const grades = { basic: '일반', pro: '우수', partner: '파트너' };
// 정원을 차지하는 상태 / 시안·배포 기한이 있는 상태 / 집행(약정)으로 보는 상태
const OPEN = "('applied','accepted','drafted','revise','ready','posted','approved','paid')";
const WORKING = "('accepted','revise','ready')";
const COMMITTED = "('approved','paid')";
const DAY = 86_400_000;

const hostOf = url => url.hostname.toLowerCase().replace(/^www\./, '');
const hostIn = (url, hosts) => hosts.some(host => hostOf(url) === host || hostOf(url).endsWith('.' + host));

// 플랫폼별 게시물 주소에서 영상 고유값을 뽑습니다. 같은 영상을 두 번 제출하지 못하게 하는 기준입니다.
export function postKey(platform, url) {
  const path = url.pathname.replace(/\/+$/, '');
  const host = hostOf(url);
  let m;
  if (platform === 'youtube') {
    if (host === 'youtu.be' && (m = path.match(/^\/([\w-]{6,20})$/))) return { key: 'yt:' + m[1] };
    if ((m = path.match(/^\/shorts\/([\w-]{6,20})$/))) return { key: 'yt:' + m[1] };
    const v = url.searchParams.get('v') || '';
    if (path === '/watch' && /^[\w-]{6,20}$/.test(v)) return { key: 'yt:' + v };
    return null;
  }
  if (platform === 'instagram') {
    m = path.match(/^\/(?:[\w.]{1,40}\/)?(?:reel|reels|p)\/([\w-]{5,40})$/);
    return m ? { key: 'ig:' + m[1] } : null;
  }
  if (platform === 'tiktok') {
    if ((m = path.match(/^\/@([\w.-]{1,40})\/video\/(\d{8,25})$/))) return { key: 'tt:' + m[2], handle: m[1].toLowerCase() };
    if (/^(vm|vt)\.tiktok\.com$/.test(host) && (m = path.match(/^\/([\w-]{5,20})$/))) return { key: 'tt:s:' + m[1] };
    if ((m = path.match(/^\/t\/([\w-]{5,20})$/))) return { key: 'tt:s:' + m[1] };
    return null;
  }
  if (platform === 'facebook') {
    if (host === 'fb.watch' && (m = path.match(/^\/([\w-]{4,30})$/))) return { key: 'fb:w:' + m[1] };
    if ((m = path.match(/^\/reel\/(\d{6,25})$/))) return { key: 'fb:' + m[1] };
    if ((m = path.match(/^\/[\w.-]{1,80}\/videos\/(?:[\w.-]+\/)?(\d{6,25})$/))) return { key: 'fb:' + m[1] };
    if ((m = path.match(/^\/share\/[rv]\/([\w-]{4,30})$/))) return { key: 'fb:s:' + m[1] };
    const v = url.searchParams.get('v') || '';
    if (path === '/watch' && /^\d{6,25}$/.test(v)) return { key: 'fb:' + v };
    return null;
  }
  return null;
}

export function setupShortform(ctx) {
  const { db, get, all, run, transaction, audit, notify, entry, balance, won, assert, fail, str, int, date, limit, now, dateKst, dayStart,
    setting, readBody, headers, json, demo, addUser } = ctx;

  db.exec(`
    CREATE TABLE IF NOT EXISTS sf_creators (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','suspended')),
      intro TEXT NOT NULL DEFAULT '', main_platform TEXT NOT NULL DEFAULT '', grade TEXT NOT NULL DEFAULT 'basic',
      reason TEXT NOT NULL DEFAULT '', memo TEXT NOT NULL DEFAULT '', created TEXT NOT NULL, decided TEXT
    );
    CREATE TABLE IF NOT EXISTS sf_assets (
      id INTEGER PRIMARY KEY, owner_id INTEGER REFERENCES users(id), data BLOB NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, created TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sf_channels (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
      platform TEXT NOT NULL CHECK (platform IN ('youtube','instagram','facebook','tiktok')),
      handle TEXT NOT NULL, url TEXT NOT NULL, followers INTEGER NOT NULL DEFAULT 0, category TEXT NOT NULL DEFAULT '',
      code TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('pending','verified','rejected','removed')),
      reason TEXT NOT NULL DEFAULT '', proof_id INTEGER REFERENCES sf_assets(id), created TEXT NOT NULL, verified TEXT, updated TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS sf_channels_handle ON sf_channels(platform, handle) WHERE status<>'removed';
    CREATE INDEX IF NOT EXISTS sf_channels_user ON sf_channels(user_id, status);
    CREATE TABLE IF NOT EXISTS sf_campaigns (
      id INTEGER PRIMARY KEY, owner_id INTEGER REFERENCES users(id), mode TEXT NOT NULL CHECK (mode IN ('produce','distribute')),
      title TEXT NOT NULL, brand TEXT NOT NULL, product TEXT NOT NULL, guide TEXT NOT NULL, hashtags TEXT NOT NULL DEFAULT '',
      mention TEXT NOT NULL DEFAULT '', forbidden TEXT NOT NULL DEFAULT '', source_url TEXT NOT NULL DEFAULT '', landing_url TEXT NOT NULL DEFAULT '',
      length_sec INTEGER NOT NULL DEFAULT 30, keep_days INTEGER NOT NULL DEFAULT 30, min_followers INTEGER NOT NULL DEFAULT 0,
      selection TEXT NOT NULL DEFAULT 'auto' CHECK (selection IN ('auto','manual')), draft_review INTEGER NOT NULL DEFAULT 0,
      platforms TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('review','active','paused','closed','rejected','canceled')), reason TEXT NOT NULL DEFAULT '',
      memo TEXT NOT NULL DEFAULT '', budget INTEGER NOT NULL DEFAULT 0, extensions INTEGER NOT NULL DEFAULT 0,
      created TEXT NOT NULL, updated TEXT, decided TEXT, request_key TEXT, UNIQUE (owner_id, request_key)
    );
    CREATE TABLE IF NOT EXISTS sf_tasks (
      id INTEGER PRIMARY KEY, campaign_id INTEGER NOT NULL REFERENCES sf_campaigns(id), user_id INTEGER NOT NULL REFERENCES users(id),
      channel_id INTEGER NOT NULL REFERENCES sf_channels(id), platform TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('applied','accepted','drafted','revise','ready','posted','approved','paid','declined','canceled','expired','rejected','revoked')),
      cost INTEGER NOT NULL, pay INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '',
      draft_url TEXT NOT NULL DEFAULT '', draft_note TEXT NOT NULL DEFAULT '', drafts INTEGER NOT NULL DEFAULT 0, feedback TEXT NOT NULL DEFAULT '',
      post_url TEXT NOT NULL DEFAULT '', post_key TEXT, post_note TEXT NOT NULL DEFAULT '', proof_id INTEGER REFERENCES sf_assets(id), posted TEXT,
      views INTEGER, likes INTEGER, comments INTEGER, metrics_proof_id INTEGER REFERENCES sf_assets(id), metrics_at TEXT,
      reason TEXT NOT NULL DEFAULT '', canceled_by TEXT NOT NULL DEFAULT '', due_at INTEGER, settle_at INTEGER,
      created TEXT NOT NULL, accepted TEXT, decided TEXT, paid TEXT, UNIQUE (campaign_id, user_id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS sf_tasks_post ON sf_tasks(post_key) WHERE post_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS sf_tasks_campaign ON sf_tasks(campaign_id, status);
    CREATE INDEX IF NOT EXISTS sf_tasks_user ON sf_tasks(user_id, status);
    CREATE INDEX IF NOT EXISTS sf_tasks_due ON sf_tasks(status, due_at);
  `);
  for (const [key, value] of [['sf_label', '부업회원'], ['sf_hold_days', '3'], ['sf_due_days', '7'], ['sf_max_open', '5'], ['sf_auto_creator', '0'], ['sf_rates', JSON.stringify(defaultRates)]]) {
    run('INSERT OR IGNORE INTO settings VALUES (?, ?)', key, value);
  }

  /* ---------- 설정 ---------- */
  const label = () => setting('sf_label');
  const rates = () => {
    const saved = JSON.parse(setting('sf_rates'));
    return Object.fromEntries(Object.keys(modes).map(mode => [mode, Object.fromEntries(Object.keys(platforms).map(p => [p, { ...defaultRates[mode][p], ...saved?.[mode]?.[p] }]))]));
  };
  const policy = () => ({ label: label(), holdDays: Number(setting('sf_hold_days')), dueDays: Number(setting('sf_due_days')), maxOpen: Number(setting('sf_max_open')),
    autoCreator: setting('sf_auto_creator') === '1', rates: rates() });

  /* ---------- 공통 ---------- */
  const isAdmin = user => user?.role === 'admin';
  const partnerRoles = ['advertiser', 'agency', 'operator'];
  const need = (user, allowed) => {
    assert(user, '로그인이 필요합니다.', 401);
    assert(allowed.includes(user.role), '이 기능을 사용할 권한이 없습니다.', 403);
  };
  const flag = value => value === true || value === '1' || value === 'on' ? 1 : 0;
  const opt = (value, label, max) => value === undefined || value === null ? '' : str(String(value), label, max, 0);
  const endOf = day => Date.parse(day + 'T23:59:59.999+09:00');
  const mask = name => `${[...name][0] || ''}${'*'.repeat(Math.max(1, [...name].length - 1))}`;
  const creatorLink = '/manage?tab=sftasks';
  const ownerLink = '/manage?tab=sfads';

  function httpsUrl(value, label, { required = true, hosts = null } = {}) {
    const text = opt(value, label, 1000);
    if (!text) {
      assert(!required, `${label}을(를) 입력해 주세요.`);
      return '';
    }
    let url;
    try { url = new URL(text); } catch { fail(400, `${label}을(를) https 주소로 입력해 주세요.`); }
    assert(url.protocol === 'https:' && !url.username && !url.password, `${label}은(는) https 주소만 사용할 수 있어요.`);
    if (hosts) assert(hostIn(url, hosts), `${label}이(가) 선택한 SNS의 주소가 아니에요.`);
    return url.toString();
  }

  /* ---------- 이미지(게시 캡처·인증 화면) ---------- */
  async function uploadAsset(req, user) {
    need(user, ['admin', 'creator', ...partnerRoles]);
    assert(req.headers.origin === req.site.origin, '같은 사이트에서 요청해 주세요.', 403);
    assert(req.headers['content-type'] === 'image/jpeg', '이미지를 JPG로 보내 주세요.', 415);
    limit(`sf-asset:${user.id}`, 40, 600_000, '이미지를 너무 자주 올렸어요. 잠시 후 다시 시도해 주세요.');
    const image = await readBody(req, 700 * 1024);
    const size = jpegSize(image);
    assert(size && size.width >= 200 && size.width <= 1440 && size.height >= 200 && size.height <= 2560, '이미지 형식이 올바르지 않습니다. (JPG, 가로 200~1440px)');
    return { id: Number(run('INSERT INTO sf_assets(owner_id,data,width,height,created) VALUES (?,?,?,?,?)', user.id, image, size.width, size.height, now()).lastInsertRowid) };
  }
  const assetFor = (user, value) => {
    if (value === undefined || value === null || value === '') return null;
    const id = int(value, '이미지', 1, 1e9);
    const asset = get('SELECT id, owner_id FROM sf_assets WHERE id=?', id);
    assert(asset && (isAdmin(user) || asset.owner_id === user.id), '이미지를 다시 올려 주세요.');
    return id;
  };
  function image(req, res, user, url) {
    assert(user, '로그인이 필요합니다.', 401);
    const id = int(url.searchParams.get('id') || '', '이미지 번호', 1, 1e9);
    const row = get('SELECT data, owner_id FROM sf_assets WHERE id=?', id);
    const allowed = row && (isAdmin(user) || row.owner_id === user.id || get(`SELECT 1 FROM sf_tasks t JOIN sf_campaigns c ON c.id=t.campaign_id
      WHERE (t.proof_id=? OR t.metrics_proof_id=?) AND c.owner_id=?`, id, id, user.id));
    assert(allowed, '이미지를 찾을 수 없습니다.', 404);
    res.writeHead(200, { ...headers, 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store' });
    return res.end(row.data);
  }

  /* ---------- 부업회원 ---------- */
  const creatorRow = userId => get('SELECT * FROM sf_creators WHERE user_id=?', userId);
  function profileFields(body) {
    const intro = str(body.intro, '활동 소개', 500, 10);
    assert(Object.hasOwn(platforms, body.main_platform), '주로 활동하는 SNS를 선택해 주세요.');
    return { intro, mainPlatform: body.main_platform };
  }
  // 가입·계정 등록 때 server.mjs가 부릅니다.
  function registerCreator(userId, body, approved = false) {
    const f = approved && !body.intro ? { intro: '', mainPlatform: Object.hasOwn(platforms, body.main_platform) ? body.main_platform : '' } : profileFields(body);
    const status = approved || policy().autoCreator ? 'approved' : 'pending';
    run('INSERT INTO sf_creators(user_id,status,intro,main_platform,created,decided) VALUES (?,?,?,?,?,?)', userId, status, f.intro, f.mainPlatform, now(), status === 'approved' ? now() : null);
    if (status === 'pending') {
      for (const admin of all("SELECT id FROM users WHERE role='admin' AND status='active' AND is_demo=0")) {
        notify(admin.id, 'shortform', `${label()} 가입 신청`, '운영팀 승인을 기다리고 있어요.', '/manage?tab=sfcreators');
      }
    }
  }
  function reapply(user, body) {
    need(user, ['creator']);
    const f = profileFields(body);
    return transaction(() => {
      const row = creatorRow(user.id);
      assert(row, `${label()} 정보를 찾을 수 없습니다.`, 404);
      assert(['rejected', 'pending'].includes(row.status), row.status === 'approved' ? '이미 승인된 계정이에요.' : '이용이 정지된 계정입니다. 문의하기로 연락해 주세요.', 409);
      run("UPDATE sf_creators SET status='pending', intro=?, main_platform=?, reason='', created=? WHERE user_id=?", f.intro, f.mainPlatform, now(), user.id);
      audit(user.id, `${label()} 재신청`, `sf-creator:${user.id}`);
      return {};
    });
  }
  const approvedCreator = user => {
    need(user, ['creator']);
    const row = creatorRow(user.id);
    assert(row?.status === 'approved', row?.status === 'suspended' ? '이용이 정지된 계정입니다. 문의하기로 연락해 주세요.' : `운영팀 승인 후 이용할 수 있어요. (현재: ${row?.status === 'rejected' ? '승인 반려' : '승인 대기'})`, 403);
    return row;
  };

  function decideCreator(user, body) {
    need(user, ['admin']);
    const id = int(body.id, '회원 번호', 1, 1e9);
    const transitions = { pending: { approve: 'approved', reject: 'rejected' }, rejected: { approve: 'approved' }, approved: { suspend: 'suspended' }, suspended: { activate: 'approved' } };
    return transaction(() => {
      const row = creatorRow(id);
      assert(row, `${label()}을(를) 찾을 수 없습니다.`, 404);
      const status = transitions[row.status]?.[body.action];
      assert(status, '현재 상태에서 처리할 수 없습니다.', 409);
      const reason = ['reject', 'suspend'].includes(body.action) ? str(body.reason, '사유', 200) : '';
      run('UPDATE sf_creators SET status=?, reason=?, decided=? WHERE user_id=?', status, reason, now(), id);
      if (status === 'suspended') {
        // 아직 게시 전인 작업은 정리하고, 이미 게시해 검수·정산 중인 건은 그대로 둡니다.
        for (const task of all(`SELECT t.*, c.title FROM sf_tasks t JOIN sf_campaigns c ON c.id=t.campaign_id WHERE t.user_id=? AND t.status IN ('applied','accepted','drafted','revise','ready')`, id)) {
          run("UPDATE sf_tasks SET status='canceled', canceled_by='admin', reason='회원 이용 정지', decided=? WHERE id=?", now(), task.id);
        }
      }
      const messages = { approved: row.status === 'suspended' ? ['이용 정지 해제', '다시 캠페인에 참여할 수 있어요.'] : ['가입 승인', 'SNS 채널을 등록하고 인증을 받으면 캠페인에 참여할 수 있어요.'],
        rejected: ['가입 반려', `사유: ${reason} 내용을 보완해 다시 신청할 수 있어요.`], suspended: ['이용 정지', `사유: ${reason}`] }[status];
      notify(id, 'shortform', `${label()} ${messages[0]}`, messages[1], status === 'approved' && row.status !== 'suspended' ? '/manage?tab=sfchannels' : '/manage');
      audit(user.id, `${label()} ${messages[0]}`, `sf-creator:${id}`, reason);
      return {};
    });
  }
  function updateCreator(user, body) {
    need(user, ['admin']);
    const id = int(body.id, '회원 번호', 1, 1e9);
    assert(Object.hasOwn(grades, body.grade), '등급을 선택해 주세요.');
    const memo = opt(body.memo, '운영 메모', 500);
    return transaction(() => {
      assert(creatorRow(id), `${label()}을(를) 찾을 수 없습니다.`, 404);
      run('UPDATE sf_creators SET grade=?, memo=? WHERE user_id=?', body.grade, memo, id);
      audit(user.id, `${label()} 정보 수정`, `sf-creator:${id}`, grades[body.grade]);
      return {};
    });
  }

  /* ---------- SNS 채널 ---------- */
  const newCode = () => 'AF-' + randomBytes(4).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, '7').slice(0, 6);
  function addChannel(user, body) {
    need(user, ['creator']);
    const row = creatorRow(user.id);
    assert(row && row.status !== 'suspended', '이용이 정지된 계정입니다.', 403);
    assert(Object.hasOwn(platforms, body.platform), 'SNS를 선택해 주세요.');
    const handle = str(String(body.handle ?? '').replace(/^@/, ''), '계정 이름', 60).toLowerCase();
    assert(/^[\p{L}\p{N}._-]+$/u.test(handle), '계정 이름에는 글자, 숫자, 점, 밑줄, 하이픈만 쓸 수 있어요.');
    const url = httpsUrl(body.url, '채널 주소', { hosts: platforms[body.platform].hosts });
    const followers = int(body.followers === undefined || body.followers === '' ? '0' : body.followers, '팔로워 수', 0, 100_000_000);
    const category = opt(body.category, '채널 분야', 40);
    const proof = assetFor(user, body.proof_id);
    limit(`sf-channel:${user.id}`, 20, 3600_000);
    return transaction(() => {
      assert(get("SELECT COUNT(*) AS total FROM sf_channels WHERE user_id=? AND status<>'removed'", user.id).total < 12, '채널은 12개까지 등록할 수 있어요.', 409);
      assert(!get("SELECT 1 FROM sf_channels WHERE platform=? AND handle=? AND status<>'removed'", body.platform, handle), '이미 등록된 채널이에요. 본인 채널이라면 문의하기로 알려 주세요.', 409);
      const code = newCode();
      const id = Number(run(`INSERT INTO sf_channels(user_id,platform,handle,url,followers,category,code,status,proof_id,created) VALUES (?,?,?,?,?,?,?,'pending',?,?)`,
        user.id, body.platform, handle, url, followers, category, code, proof, now()).lastInsertRowid);
      audit(user.id, '숏폼 채널 등록', `sf-channel:${id}`, `${platforms[body.platform].short} @${handle}`);
      return { id, code };
    });
  }
  function proveChannel(user, body) {
    need(user, ['creator']);
    const id = int(body.id, '채널 번호', 1, 1e9);
    const proof = assetFor(user, body.proof_id);
    assert(proof, '인증 화면을 올려 주세요.');
    return transaction(() => {
      const channel = get("SELECT * FROM sf_channels WHERE id=? AND user_id=? AND status IN ('pending','rejected')", id, user.id);
      assert(channel, '인증을 요청할 수 있는 채널이 아니에요.', 404);
      run("UPDATE sf_channels SET proof_id=?, status='pending', reason='', updated=? WHERE id=?", proof, now(), id);
      return {};
    });
  }
  function removeChannel(user, body) {
    need(user, ['creator']);
    const id = int(body.id, '채널 번호', 1, 1e9);
    return transaction(() => {
      const channel = get("SELECT * FROM sf_channels WHERE id=? AND user_id=? AND status<>'removed'", id, user.id);
      assert(channel, '채널을 찾을 수 없습니다.', 404);
      assert(!get(`SELECT 1 FROM sf_tasks WHERE channel_id=? AND status IN ('applied','accepted','drafted','revise','ready','posted','approved')`, id), '진행 중인 작업에 쓰고 있는 채널이에요. 작업이 끝난 뒤 삭제해 주세요.', 409);
      run("UPDATE sf_channels SET status='removed', updated=? WHERE id=?", now(), id);
      return {};
    });
  }
  function decideChannel(user, body) {
    need(user, ['admin']);
    const id = int(body.id, '채널 번호', 1, 1e9);
    assert(['verify', 'reject', 'followers'].includes(body.action), '처리 유형을 확인해 주세요.');
    return transaction(() => {
      const channel = get("SELECT * FROM sf_channels WHERE id=? AND status<>'removed'", id);
      assert(channel, '채널을 찾을 수 없습니다.', 404);
      if (body.action === 'reject') {
        assert(channel.status !== 'rejected', '이미 반려한 채널이에요.', 409);
        const reason = str(body.reason, '반려 사유', 200);
        run("UPDATE sf_channels SET status='rejected', reason=?, updated=? WHERE id=?", reason, now(), id);
        notify(channel.user_id, 'shortform', `채널 @${channel.handle} 인증 반려`, `사유: ${reason}`, '/manage?tab=sfchannels');
        audit(user.id, '숏폼 채널 반려', `sf-channel:${id}`, reason);
        return {};
      }
      const followers = int(body.followers === undefined || body.followers === '' ? String(channel.followers) : body.followers, '팔로워 수', 0, 100_000_000);
      if (body.action === 'followers') {
        run('UPDATE sf_channels SET followers=?, updated=? WHERE id=?', followers, now(), id);
        audit(user.id, '숏폼 채널 팔로워 갱신', `sf-channel:${id}`, String(followers));
        return {};
      }
      assert(channel.status !== 'verified', '이미 인증한 채널이에요.', 409);
      run("UPDATE sf_channels SET status='verified', followers=?, reason='', verified=?, updated=? WHERE id=?", followers, now(), now(), id);
      notify(channel.user_id, 'shortform', `채널 @${channel.handle} 인증 완료`, `${platforms[channel.platform].short} 캠페인에 참여할 수 있어요. 인증 코드는 프로필에서 지워도 됩니다.`, '/manage?tab=sfjobs');
      audit(user.id, '숏폼 채널 인증', `sf-channel:${id}`, `팔로워 ${followers}`);
      return {};
    });
  }

  /* ---------- 캠페인 ---------- */
  const parsePlatforms = campaign => JSON.parse(campaign.platforms);
  const committedOf = id => get(`SELECT COALESCE(SUM(cost),0) AS total FROM sf_tasks WHERE campaign_id=? AND status IN ${COMMITTED}`, id).total;
  function usage(id) {
    const rows = all(`SELECT platform,
      SUM(status IN ${OPEN}) AS used, SUM(status='applied') AS applied, SUM(status IN ('accepted','drafted','revise','ready')) AS working,
      SUM(status='posted') AS posted, SUM(status IN ${COMMITTED}) AS done, SUM(status='paid') AS paid,
      COALESCE(SUM(CASE WHEN status IN ('posted','approved','paid') THEN views END),0) AS views
      FROM sf_tasks WHERE campaign_id=? GROUP BY platform`, id);
    return Object.fromEntries(rows.map(row => [row.platform, row]));
  }

  function campaignFields(user, body, existing) {
    const mode = existing ? existing.mode : body.mode;
    assert(Object.hasOwn(modes, mode), '캠페인 유형을 선택해 주세요.');
    const f = {
      mode,
      title: str(body.title, '캠페인 제목', 60, 2),
      brand: str(body.brand, '브랜드명', 40),
      product: str(body.product, '상품·서비스 소개', 1500, 10),
      guide: str(body.guide, mode === 'produce' ? '제작 가이드' : '게시 안내', 2000, 5),
      hashtags: opt(body.hashtags, '필수 해시태그', 200),
      mention: opt(body.mention, '필수 문구·계정 태그', 200),
      forbidden: opt(body.forbidden, '금지 표현', 300),
      source: httpsUrl(body.source_url, mode === 'distribute' ? '배포 영상 주소' : '참고 자료 주소', { required: mode === 'distribute' }),
      landing: httpsUrl(body.landing_url, '연결할 링크', { required: false }),
      length: int(body.duration ?? body.length ?? '30', '영상 길이', 15, 90),
      keep: int(body.keep_days ?? '30', '게시 유지 기간', 7, 365),
      minFollowers: int(body.min_followers === '' || body.min_followers === undefined ? '0' : body.min_followers, '최소 팔로워', 0, 10_000_000)
    };
    assert(lengths.includes(f.length), '영상 길이를 선택해 주세요.');
    if (existing) return f;
    f.selection = body.selection === 'manual' ? 'manual' : 'auto';
    f.draftReview = mode === 'produce' ? flag(body.draft_review) : 0;
    f.start = date(body.start);
    f.end = date(body.end);
    assert(f.start >= dateKst(), '시작일은 오늘 이후로 정해 주세요.');
    assert(f.end >= f.start, '종료일은 시작일 이후여야 합니다.');
    assert(Date.parse(f.end) - Date.parse(f.start) <= 180 * DAY, '캠페인 기간은 최대 180일입니다.');
    const table = rates()[mode];
    f.platforms = {};
    for (const p of Object.keys(platforms)) {
      const raw = body[`count_${p}`];
      const count = raw === undefined || raw === '' ? 0 : int(raw, `${platforms[p].short} 배포 건수`, 0, 1000);
      if (count) f.platforms[p] = { count, cost: table[p].cost, pay: table[p].pay };
    }
    assert(Object.keys(f.platforms).length, '배포할 플랫폼과 건수를 하나 이상 정해 주세요.');
    f.budget = Object.values(f.platforms).reduce((sum, item) => sum + item.count * item.cost, 0);
    return f;
  }

  function createCampaign(user, body) {
    need(user, partnerRoles);
    const key = str(body.key, '요청 키', 64);
    const f = campaignFields(user, body);
    return transaction(() => {
      const existing = get('SELECT id FROM sf_campaigns WHERE owner_id=? AND request_key=?', user.id, key);
      if (existing) return { id: existing.id };
      assert(balance(user.id, 'credit') >= f.budget, `예산 ${won(f.budget)}이 필요합니다. 먼저 충전을 신청해 주세요.`, 409);
      const id = Number(run(`INSERT INTO sf_campaigns(owner_id,mode,title,brand,product,guide,hashtags,mention,forbidden,source_url,landing_url,length_sec,keep_days,min_followers,
        selection,draft_review,platforms,start_date,end_date,status,budget,created,request_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'review',?,?,?)`,
        user.id, f.mode, f.title, f.brand, f.product, f.guide, f.hashtags, f.mention, f.forbidden, f.source, f.landing, f.length, f.keep, f.minFollowers,
        f.selection, f.draftReview, JSON.stringify(f.platforms), f.start, f.end, f.budget, now(), key).lastInsertRowid);
      entry(user.id, 'credit', -f.budget, 'sf_reserve', id);
      audit(user.id, '숏폼 캠페인 등록', `sf-campaign:${id}`, `${modes[f.mode].label} · 예산 ${won(f.budget)}`);
      for (const admin of all("SELECT id FROM users WHERE role='admin' AND status='active' AND is_demo=0")) {
        notify(admin.id, 'shortform', `숏폼 캠페인 심사 요청 · ${f.title}`, `${user.name} · ${modes[f.mode].label} · 예산 ${won(f.budget)}`, '/manage?tab=shortform');
      }
      return { id, budget: f.budget };
    });
  }

  function updateCampaign(user, body) {
    need(user, ['admin', ...partnerRoles]);
    const id = int(body.id, '캠페인 번호', 1, 1e9);
    return transaction(() => {
      const campaign = get('SELECT * FROM sf_campaigns WHERE id=?', id);
      assert(campaign && (isAdmin(user) || campaign.owner_id === user.id), '캠페인을 찾을 수 없습니다.', 404);
      assert(isAdmin(user) ? ['review', 'active', 'paused'].includes(campaign.status) : campaign.status === 'review',
        isAdmin(user) ? '끝난 캠페인은 수정할 수 없습니다.' : '심사 전 캠페인만 수정할 수 있어요. 진행 중에는 연장·증액만 할 수 있습니다.', 409);
      const f = campaignFields(user, body, campaign);
      const memo = isAdmin(user) ? opt(body.memo, '운영 메모', 500) : campaign.memo;
      run(`UPDATE sf_campaigns SET title=?,brand=?,product=?,guide=?,hashtags=?,mention=?,forbidden=?,source_url=?,landing_url=?,length_sec=?,keep_days=?,min_followers=?,memo=?,updated=? WHERE id=?`,
        f.title, f.brand, f.product, f.guide, f.hashtags, f.mention, f.forbidden, f.source, f.landing, f.length, f.keep, f.minFollowers, memo, now(), id);
      audit(user.id, '숏폼 캠페인 수정', `sf-campaign:${id}`);
      return {};
    });
  }

  // 캠페인을 끝내고 남은 예산을 돌려줍니다. 게시 전 작업은 정리하고, 승인 건은 그대로 정산됩니다.
  function finish(campaign, status, reason, actor = null) {
    run('UPDATE sf_campaigns SET status=?, reason=?, decided=?, updated=? WHERE id=?', status, reason, now(), now(), campaign.id);
    for (const task of all(`SELECT * FROM sf_tasks WHERE campaign_id=? AND status IN ('applied','accepted','drafted','revise','ready')`, campaign.id)) {
      const next = task.status === 'applied' ? 'declined' : 'canceled';
      run("UPDATE sf_tasks SET status=?, canceled_by='system', reason=?, decided=? WHERE id=?", next, `캠페인 ${status === 'closed' ? '종료' : status === 'rejected' ? '반려' : '취소'}`, now(), task.id);
      notify(task.user_id, 'shortform', `‘${campaign.title}’ 캠페인 종료`, task.status === 'applied' ? '선정되지 않은 채 캠페인이 끝났어요.' : '게시 전에 캠페인이 끝나 작업이 취소됐어요.', creatorLink);
    }
    let returned = 0;
    if (campaign.owner_id) {
      returned = Math.max(0, campaign.budget - committedOf(campaign.id));
      if (returned) entry(campaign.owner_id, 'credit', returned, 'sf_release', campaign.id);
      if (actor !== campaign.owner_id) {
        notify(campaign.owner_id, 'shortform', `숏폼 캠페인 ‘${campaign.title}’ ${status === 'rejected' ? '심사 반려' : '종료'}`,
          `${reason}${returned ? ` · 미집행 예산 ${won(returned)}을 잔액으로 돌려드렸어요.` : ''}`, ownerLink);
      }
    }
    audit(actor, status === 'rejected' ? '숏폼 캠페인 반려' : status === 'canceled' ? '숏폼 캠페인 취소' : '숏폼 캠페인 종료', `sf-campaign:${campaign.id}`, `${reason}${returned ? ` · 반환 ${won(returned)}` : ''}`);
    return returned;
  }

  const adminPause = '운영자 일시중지';
  function campaignStatus(user, body) {
    need(user, ['admin', ...partnerRoles]);
    const id = int(body.id, '캠페인 번호', 1, 1e9);
    const admin = isAdmin(user);
    const transitions = admin
      ? { review: { approve: 'active', reject: 'rejected' }, active: { pause: 'paused', close: 'closed' }, paused: { resume: 'active', close: 'closed' } }
      : { review: { cancel: 'canceled' }, active: { pause: 'paused', close: 'closed' }, paused: { resume: 'active', close: 'closed' } };
    return transaction(() => {
      const campaign = get('SELECT * FROM sf_campaigns WHERE id=?', id);
      assert(campaign && (admin || campaign.owner_id === user.id), '캠페인을 찾을 수 없습니다.', 404);
      const status = transitions[campaign.status]?.[body.action];
      assert(status, '현재 상태에서 처리할 수 없습니다.', 409);
      if (status === 'rejected') return { returned: finish(campaign, 'rejected', `반려 사유: ${str(body.reason, '반려 사유', 200)}`, user.id) };
      if (status === 'canceled') return { returned: finish(campaign, 'canceled', '주문자 취소', user.id) };
      if (status === 'closed') {
        assert(!get("SELECT 1 FROM sf_tasks WHERE campaign_id=? AND status='posted'", id), '검수 대기 중인 배포가 있어 아직 종료할 수 없어요. 검수가 끝난 뒤 다시 시도해 주세요.', 409);
        return { returned: finish(campaign, 'closed', admin ? '운영자 종료' : '주문자 종료', user.id) };
      }
      if (status === 'active') {
        assert(campaign.end_date >= dateKst(), '종료일이 지난 캠페인입니다.', 409);
        if (!admin) assert(campaign.reason !== adminPause, '운영팀이 중지한 캠페인입니다. 문의하기로 재개를 요청해 주세요.', 409);
      }
      const reason = status === 'paused' ? (admin ? adminPause : '주문자 일시중지') : '';
      run('UPDATE sf_campaigns SET status=?, reason=?, updated=?, decided=COALESCE(decided, ?) WHERE id=?', status, reason, now(), now(), id);
      if (admin && campaign.owner_id) {
        const message = status === 'active' ? (campaign.status === 'review' ? ['심사 승인', `${campaign.start_date}부터 ${label()} 모집을 시작해요.`] : ['운영 재개', '캠페인이 다시 열렸어요.'])
          : ['운영팀 일시중지', '자세한 내용은 문의하기로 확인해 주세요.'];
        notify(campaign.owner_id, 'shortform', `숏폼 캠페인 ‘${campaign.title}’ ${message[0]}`, message[1], ownerLink);
      }
      audit(user.id, campaign.status === 'review' ? '숏폼 캠페인 승인' : '숏폼 캠페인 상태 변경', `sf-campaign:${id}`, status);
      return {};
    });
  }

  function extendCampaign(user, body) {
    need(user, partnerRoles);
    const id = int(body.id, '캠페인 번호', 1, 1e9);
    return transaction(() => {
      const campaign = get('SELECT * FROM sf_campaigns WHERE id=? AND owner_id=?', id, user.id);
      assert(campaign, '캠페인을 찾을 수 없습니다.', 404);
      assert(['active', 'paused'].includes(campaign.status) && campaign.end_date >= dateKst(), '진행 중이거나 일시중지된 캠페인만 연장·증액할 수 있습니다.', 409);
      const end = date(body.end);
      assert(end >= campaign.end_date, '종료일은 현재 종료일보다 앞당길 수 없습니다.');
      assert(Date.parse(end) - Date.parse(campaign.start_date) <= 365 * DAY, '캠페인 기간은 최대 1년입니다.');
      const items = parsePlatforms(campaign);
      const table = rates()[campaign.mode];
      let extra = 0;
      const changes = [];
      for (const p of Object.keys(platforms)) {
        const raw = body[`add_${p}`];
        const add = raw === undefined || raw === '' ? 0 : int(raw, `${platforms[p].short} 추가 건수`, 0, 1000);
        if (!add) continue;
        // 기존 플랫폼은 등록 당시 단가를, 새로 더하는 플랫폼은 현재 단가를 씁니다.
        items[p] ||= { count: 0, cost: table[p].cost, pay: table[p].pay };
        items[p].count += add;
        extra += add * items[p].cost;
        changes.push(`${platforms[p].short} +${add}`);
      }
      assert(extra || end !== campaign.end_date, '바뀐 내용이 없습니다.');
      if (extra) {
        assert(balance(user.id, 'credit') >= extra, `추가 예산 ${won(extra)}이 필요합니다. 먼저 충전을 신청해 주세요.`, 409);
        entry(user.id, 'credit', -extra, 'sf_extra', `${id}.${campaign.extensions + 1}`);
      }
      run('UPDATE sf_campaigns SET platforms=?, end_date=?, budget=budget+?, extensions=extensions+1, updated=? WHERE id=?', JSON.stringify(items), end, extra, now(), id);
      audit(user.id, '숏폼 캠페인 연장·증액', `sf-campaign:${id}`, `${changes.join(', ') || '건수 변경 없음'} · 종료 ${campaign.end_date}→${end}${extra ? ` · 추가 예산 ${won(extra)}` : ''}`);
      return { extra };
    });
  }

  /* ---------- 작업(참여) ---------- */
  const dueFor = campaign => Math.min(Date.now() + policy().dueDays * DAY, endOf(campaign.end_date));
  const needsDraft = (campaign) => campaign.mode === 'produce' && campaign.draft_review === 1;
  const taskWith = id => get('SELECT t.*, c.owner_id, c.title, c.mode, c.draft_review, c.end_date, c.status AS campaign_status FROM sf_tasks t JOIN sf_campaigns c ON c.id=t.campaign_id WHERE t.id=?', id);

  function join(user, body) {
    approvedCreator(user);
    const campaignId = int(body.campaign, '캠페인 번호', 1, 1e9);
    const channelId = int(body.channel, '채널', 1, 1e9);
    const note = opt(body.note, '한마디', 300);
    assert(flag(body.agree), '캠페인 가이드와 게시 유지 기간을 확인하고 동의해 주세요.');
    limit(`sf-join:${user.id}`, 30, 600_000);
    return transaction(() => {
      const campaign = get('SELECT * FROM sf_campaigns WHERE id=?', campaignId);
      const today = dateKst();
      assert(campaign && campaign.status === 'active' && campaign.start_date <= today && campaign.end_date >= today, '지금 모집 중인 캠페인이 아니에요.', 409);
      const channel = get("SELECT * FROM sf_channels WHERE id=? AND user_id=? AND status='verified'", channelId, user.id);
      assert(channel, '인증된 내 채널을 선택해 주세요.', 409);
      const item = parsePlatforms(campaign)[channel.platform];
      assert(item, `이 캠페인은 ${platforms[channel.platform].short} 배포를 모집하지 않아요.`, 409);
      assert(channel.followers >= campaign.min_followers, `팔로워 ${campaign.min_followers.toLocaleString('ko-KR')}명 이상인 채널만 참여할 수 있어요.`, 409);
      const used = get(`SELECT COUNT(*) AS total FROM sf_tasks WHERE campaign_id=? AND platform=? AND status IN ${OPEN}`, campaignId, channel.platform).total;
      assert(used < item.count, `${platforms[channel.platform].short} 자리가 모두 찼어요.`, 409);
      assert(get(`SELECT COUNT(*) AS total FROM sf_tasks WHERE user_id=? AND status IN ('applied','accepted','drafted','revise','ready')`, user.id).total < policy().maxOpen,
        `게시 전 작업은 동시에 ${policy().maxOpen}건까지 맡을 수 있어요. 진행 중인 작업을 먼저 마무리해 주세요.`, 409);
      const existing = get('SELECT * FROM sf_tasks WHERE campaign_id=? AND user_id=?', campaignId, user.id);
      assert(!existing || (existing.status === 'canceled' && existing.canceled_by === 'creator'), '이미 참여한 캠페인이에요. 캠페인마다 한 번 참여할 수 있어요.', 409);
      const auto = campaign.selection === 'auto';
      const values = [channel.id, channel.platform, auto ? 'accepted' : 'applied', item.cost, item.pay, note, auto ? dueFor(campaign) : null, now(), auto ? now() : null];
      let id;
      if (existing) {
        run(`UPDATE sf_tasks SET channel_id=?, platform=?, status=?, cost=?, pay=?, note=?, due_at=?, created=?, accepted=?, reason='', canceled_by='', feedback='',
          draft_url='', draft_note='', drafts=0, decided=NULL WHERE id=?`, ...values, existing.id);
        id = existing.id;
      } else {
        id = Number(run(`INSERT INTO sf_tasks(channel_id,platform,status,cost,pay,note,due_at,created,accepted,campaign_id,user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, ...values, campaignId, user.id).lastInsertRowid);
      }
      if (!auto && campaign.owner_id) notify(campaign.owner_id, 'shortform', `‘${campaign.title}’ 새 참여 신청`, `${platforms[channel.platform].short} @${channel.handle} · 팔로워 ${channel.followers.toLocaleString('ko-KR')}명`, ownerLink);
      audit(user.id, '숏폼 참여', `sf-task:${id}`, `${campaign.title} · ${platforms[channel.platform].short}`);
      return { id, status: auto ? 'accepted' : 'applied' };
    });
  }

  function cancelTask(user, body) {
    need(user, ['creator']);
    const id = int(body.id, '작업 번호', 1, 1e9);
    return transaction(() => {
      const task = taskWith(id);
      assert(task && task.user_id === user.id, '작업을 찾을 수 없습니다.', 404);
      assert(['applied', 'accepted', 'drafted', 'revise', 'ready'].includes(task.status), '게시 전 작업만 취소할 수 있어요.', 409);
      run("UPDATE sf_tasks SET status='canceled', canceled_by='creator', reason='본인 취소', decided=? WHERE id=?", now(), id);
      audit(user.id, '숏폼 작업 취소', `sf-task:${id}`);
      return {};
    });
  }

  // 광고주(또는 운영팀)가 신청자를 고르는 '선정형' 캠페인
  function selectTask(user, body) {
    need(user, ['admin', ...partnerRoles]);
    const id = int(body.id, '작업 번호', 1, 1e9);
    assert(['accept', 'decline'].includes(body.action), '처리 유형을 확인해 주세요.');
    return transaction(() => {
      const task = taskWith(id);
      assert(task && (isAdmin(user) || task.owner_id === user.id), '작업을 찾을 수 없습니다.', 404);
      assert(task.status === 'applied', '이미 처리된 신청이에요.', 409);
      if (body.action === 'accept') {
        assert(['active', 'paused'].includes(task.campaign_status) && task.end_date >= dateKst(), '진행 중인 캠페인에서만 선정할 수 있어요.', 409);
        run("UPDATE sf_tasks SET status='accepted', accepted=?, due_at=? WHERE id=?", now(), dueFor({ end_date: task.end_date }), id);
        notify(task.user_id, 'shortform', `‘${task.title}’ 선정 완료`, needsDraft(task) ? '가이드를 확인하고 시안을 제출해 주세요.' : '가이드를 확인하고 숏폼을 게시한 뒤 주소를 제출해 주세요.', creatorLink);
      } else {
        const reason = opt(body.reason, '사유', 200) || '선정되지 않음';
        run("UPDATE sf_tasks SET status='declined', reason=?, decided=? WHERE id=?", reason, now(), id);
        notify(task.user_id, 'shortform', `‘${task.title}’ 미선정`, '이번 캠페인에는 선정되지 않았어요. 다른 캠페인에 참여해 보세요.', '/manage?tab=sfjobs');
      }
      audit(user.id, body.action === 'accept' ? '숏폼 참여 선정' : '숏폼 참여 미선정', `sf-task:${id}`);
      return {};
    });
  }

  function submitDraft(user, body) {
    approvedCreator(user);
    const id = int(body.id, '작업 번호', 1, 1e9);
    const url = httpsUrl(body.url, '시안 영상 주소');
    const note = opt(body.note, '시안 설명', 500);
    return transaction(() => {
      const task = taskWith(id);
      assert(task && task.user_id === user.id, '작업을 찾을 수 없습니다.', 404);
      assert(needsDraft(task), '이 캠페인은 시안 검토 없이 바로 게시하면 돼요.', 409);
      assert(['accepted', 'revise'].includes(task.status), '지금은 시안을 제출할 수 없어요.', 409);
      assert(task.drafts < 5, '시안은 5번까지 제출할 수 있어요. 문의하기로 연락해 주세요.', 409);
      run("UPDATE sf_tasks SET status='drafted', draft_url=?, draft_note=?, drafts=drafts+1 WHERE id=?", url, note, id);
      if (task.owner_id) notify(task.owner_id, 'shortform', `‘${task.title}’ 시안 도착`, '시안을 확인하고 승인하거나 수정을 요청해 주세요.', ownerLink);
      audit(user.id, '숏폼 시안 제출', `sf-task:${id}`);
      return {};
    });
  }

  function reviewDraft(user, body) {
    need(user, ['admin', ...partnerRoles]);
    const id = int(body.id, '작업 번호', 1, 1e9);
    assert(['approve', 'revise'].includes(body.action), '처리 유형을 확인해 주세요.');
    return transaction(() => {
      const task = taskWith(id);
      assert(task && (isAdmin(user) || task.owner_id === user.id), '작업을 찾을 수 없습니다.', 404);
      assert(task.status === 'drafted', '검토할 시안이 없어요.', 409);
      const feedback = body.action === 'revise' ? str(body.reason, '수정 요청 내용', 500) : opt(body.reason, '전달 메모', 500);
      // 검토하는 동안 기한이 지나지 않도록 남은 기한을 최소 2일 보장합니다(캠페인 종료일 안에서).
      const due = Math.min(Math.max(task.due_at || 0, Date.now() + 2 * DAY), endOf(task.end_date));
      run('UPDATE sf_tasks SET status=?, feedback=?, due_at=? WHERE id=?', body.action === 'approve' ? 'ready' : 'revise', feedback, due, id);
      notify(task.user_id, 'shortform', body.action === 'approve' ? `‘${task.title}’ 시안 승인` : `‘${task.title}’ 시안 수정 요청`,
        body.action === 'approve' ? `이제 내 채널에 게시하고 주소를 제출해 주세요.${feedback ? ` 메모: ${feedback}` : ''}` : `요청 내용: ${feedback}`, creatorLink);
      audit(user.id, body.action === 'approve' ? '숏폼 시안 승인' : '숏폼 시안 수정 요청', `sf-task:${id}`, feedback);
      return {};
    });
  }

  function submitPost(user, body) {
    approvedCreator(user);
    const id = int(body.id, '작업 번호', 1, 1e9);
    const note = opt(body.note, '메모', 300);
    const proof = assetFor(user, body.proof_id);
    return transaction(() => {
      const task = taskWith(id);
      assert(task && task.user_id === user.id, '작업을 찾을 수 없습니다.', 404);
      assert(task.status === 'ready' || (task.status === 'accepted' && !needsDraft(task)), needsDraft(task) && ['accepted', 'revise', 'drafted'].includes(task.status) ? '시안이 승인된 뒤 게시할 수 있어요.' : '지금은 게시 주소를 제출할 수 없어요.', 409);
      const channel = get('SELECT * FROM sf_channels WHERE id=?', task.channel_id);
      const url = new URL(httpsUrl(body.url, '게시물 주소', { hosts: platforms[task.platform].hosts }));
      const parsed = postKey(task.platform, url);
      assert(parsed, `${platforms[task.platform].label} 게시물 주소를 확인해 주세요. (예: ${{ youtube: 'https://youtube.com/shorts/영상ID', instagram: 'https://www.instagram.com/reel/코드', facebook: 'https://www.facebook.com/reel/숫자', tiktok: 'https://www.tiktok.com/@계정/video/숫자' }[task.platform]})`);
      if (parsed.handle) assert(parsed.handle === channel.handle, `등록한 채널(@${channel.handle})에 올린 게시물만 제출할 수 있어요.`);
      const key = createHash('sha256').update(parsed.key).digest('hex').slice(0, 32);
      assert(!get('SELECT 1 FROM sf_tasks WHERE post_key=? AND id<>?', key, id), '이미 다른 작업에 제출된 게시물이에요.', 409);
      run("UPDATE sf_tasks SET status='posted', post_url=?, post_key=?, post_note=?, proof_id=?, posted=? WHERE id=?", url.toString(), key, note, proof, now(), id);
      audit(user.id, '숏폼 배포 제출', `sf-task:${id}`, url.toString());
      return {};
    });
  }

  function reportMetrics(user, body) {
    need(user, ['creator', 'admin']);
    const id = int(body.id, '작업 번호', 1, 1e9);
    const views = int(body.views, '조회수', 0, 2_000_000_000);
    const likes = body.likes === undefined || body.likes === '' ? null : int(body.likes, '좋아요', 0, 2_000_000_000);
    const comments = body.comments === undefined || body.comments === '' ? null : int(body.comments, '댓글', 0, 2_000_000_000);
    const proof = assetFor(user, body.proof_id);
    return transaction(() => {
      const task = taskWith(id);
      assert(task && (isAdmin(user) || task.user_id === user.id), '작업을 찾을 수 없습니다.', 404);
      assert(['posted', 'approved', 'paid'].includes(task.status), '게시한 작업만 성과를 입력할 수 있어요.', 409);
      run('UPDATE sf_tasks SET views=?, likes=?, comments=?, metrics_proof_id=COALESCE(?, metrics_proof_id), metrics_at=? WHERE id=?', views, likes, comments, proof, now(), id);
      return {};
    });
  }

  // 최고관리자 배포 검수: 승인(정산 보류 시작) · 수정 요청(다시 게시) · 반려(작업 종료)
  function reviewPost(user, body) {
    need(user, ['admin']);
    const id = int(body.id, '작업 번호', 1, 1e9);
    assert(['approve', 'redo', 'reject'].includes(body.action), '처리 유형을 확인해 주세요.');
    return transaction(() => {
      const task = taskWith(id);
      assert(task, '작업을 찾을 수 없습니다.', 404);
      assert(task.status === 'posted', '검수 대기 중인 배포가 아니에요.', 409);
      if (body.action === 'approve') {
        if (body.views !== undefined && body.views !== '') run('UPDATE sf_tasks SET views=?, metrics_at=? WHERE id=?', int(body.views, '조회수', 0, 2_000_000_000), now(), id);
        const hold = policy().holdDays;
        run("UPDATE sf_tasks SET status='approved', reason='', decided=?, settle_at=? WHERE id=?", now(), Date.now() + hold * DAY, id);
        if (!hold) settle(get('SELECT * FROM sf_tasks WHERE id=?', id));
        else notify(task.user_id, 'shortform', `‘${task.title}’ 배포 승인`, `게시물을 ${hold}일 동안 유지하면 ${won(task.pay)}이 부업 수익으로 정산돼요.`, creatorLink);
        if (task.owner_id) notify(task.owner_id, 'shortform', `‘${task.title}’ 배포 1건 완료`, `${platforms[task.platform].short} 게시물이 승인됐어요.`, ownerLink);
        audit(user.id, '숏폼 배포 승인', `sf-task:${id}`, `지급 ${won(task.pay)} · 집행 ${won(task.cost)}`);
      } else {
        const reason = str(body.reason, body.action === 'redo' ? '수정 요청 내용' : '반려 사유', 300);
        if (body.action === 'redo') {
          const due = Math.min(Math.max(task.due_at || 0, Date.now() + 2 * DAY), endOf(task.end_date));
          run("UPDATE sf_tasks SET status='ready', feedback=?, post_key=NULL, due_at=? WHERE id=?", reason, due, id);
          notify(task.user_id, 'shortform', `‘${task.title}’ 게시물 수정 요청`, `요청 내용: ${reason} 수정해서 다시 제출해 주세요.`, creatorLink);
        } else {
          run("UPDATE sf_tasks SET status='rejected', reason=?, post_key=NULL, decided=? WHERE id=?", reason, now(), id);
          notify(task.user_id, 'shortform', `‘${task.title}’ 배포 반려`, `사유: ${reason}`, creatorLink);
        }
        audit(user.id, body.action === 'redo' ? '숏폼 배포 수정 요청' : '숏폼 배포 반려', `sf-task:${id}`, reason);
      }
      closeIfDone(get('SELECT * FROM sf_campaigns WHERE id=?', task.campaign_id));
      return {};
    });
  }

  function settle(task) {
    run("UPDATE sf_tasks SET status='paid', paid=?, settle_at=NULL WHERE id=?", now(), task.id);
    entry(task.user_id, 'earning', task.pay, 'sf_pay', task.id);
    const title = get('SELECT title FROM sf_campaigns WHERE id=?', task.campaign_id).title;
    notify(task.user_id, 'shortform', `‘${title}’ 정산 완료`, `${won(task.pay)}이 부업 수익으로 들어왔어요.`, '/manage?tab=sfearn');
  }

  // 정산 보류 중인 승인 건: 즉시 정산 또는 승인 취소(게시물 삭제·비공개 확인 시)
  function settleTask(user, body) {
    need(user, ['admin']);
    const id = int(body.id, '작업 번호', 1, 1e9);
    assert(['settle', 'revoke'].includes(body.action), '처리 유형을 확인해 주세요.');
    return transaction(() => {
      const task = taskWith(id);
      assert(task, '작업을 찾을 수 없습니다.', 404);
      assert(task.status === 'approved', '정산 대기 중인 작업이 아니에요.', 409);
      if (body.action === 'settle') {
        settle(task);
        audit(user.id, '숏폼 즉시 정산', `sf-task:${id}`, won(task.pay));
        return {};
      }
      const reason = str(body.reason, '승인 취소 사유', 300);
      run("UPDATE sf_tasks SET status='revoked', reason=?, post_key=NULL, settle_at=NULL, decided=? WHERE id=?", reason, now(), id);
      // 캠페인이 이미 끝나 정산됐다면 이 건의 집행액을 광고 계정에 돌려줍니다.
      if (task.owner_id && ['closed', 'rejected', 'canceled'].includes(task.campaign_status)) entry(task.owner_id, 'credit', task.cost, 'sf_refund', id);
      notify(task.user_id, 'shortform', `‘${task.title}’ 승인 취소`, `사유: ${reason}`, creatorLink);
      audit(user.id, '숏폼 승인 취소', `sf-task:${id}`, reason);
      return {};
    });
  }

  function closeIfDone(campaign) {
    if (!campaign || !['active', 'paused'].includes(campaign.status)) return;
    const items = parsePlatforms(campaign);
    const use = usage(campaign.id);
    if (Object.entries(items).every(([p, item]) => (use[p]?.done || 0) >= item.count)) finish(campaign, 'closed', '목표 배포 달성');
  }

  // 1분마다: 기한 지난 작업 만료, 보류 끝난 승인 건 정산, 기간 끝난 캠페인 종료
  function sweep() {
    const time = Date.now();
    const today = dateKst();
    const due = get(`SELECT
      (SELECT COUNT(*) FROM sf_tasks WHERE status IN ${WORKING} AND due_at<?) +
      (SELECT COUNT(*) FROM sf_tasks WHERE status='approved' AND settle_at<=?) +
      (SELECT COUNT(*) FROM sf_campaigns WHERE status IN ('active','paused') AND end_date<?) AS total`, time, time, today).total;
    if (!due) return;
    transaction(() => {
      for (const task of all(`SELECT t.*, c.title FROM sf_tasks t JOIN sf_campaigns c ON c.id=t.campaign_id WHERE t.status IN ${WORKING} AND t.due_at<?`, time)) {
        run("UPDATE sf_tasks SET status='expired', reason='기한 내 미제출', decided=? WHERE id=?", now(), task.id);
        notify(task.user_id, 'shortform', `‘${task.title}’ 기한 만료`, '제출 기한이 지나 작업이 종료됐어요.', creatorLink);
      }
      for (const task of all("SELECT * FROM sf_tasks WHERE status='approved' AND settle_at<=?", time)) settle(task);
      // 기간이 끝난 캠페인은 배포 검수 대기 건이 없을 때 종료합니다(검수 대기 건이 있으면 검수 후 정산).
      for (const campaign of all(`SELECT * FROM sf_campaigns c WHERE c.status IN ('active','paused') AND c.end_date<?
        AND NOT EXISTS (SELECT 1 FROM sf_tasks WHERE campaign_id=c.id AND status='posted')`, today)) {
        finish(campaign, 'closed', '집행 기간 종료');
      }
    });
  }

  /* ---------- 조회 ---------- */
  const reliability = `
    (SELECT COUNT(*) FROM sf_tasks x WHERE x.user_id=t.user_id AND x.status IN ('approved','paid')) AS done_count,
    (SELECT COUNT(*) FROM sf_tasks x WHERE x.user_id=t.user_id AND x.status IN ('expired','rejected','revoked')) AS fail_count`;
  function campaignView(campaign, { admin = false } = {}) {
    const { request_key: _key, ...rest } = campaign;
    const items = parsePlatforms(campaign);
    const use = usage(campaign.id);
    const committed = committedOf(campaign.id);
    const totals = Object.keys(items).reduce((acc, p) => {
      const u = use[p] || {};
      for (const key of ['used', 'applied', 'working', 'posted', 'done', 'paid', 'views']) acc[key] += u[key] || 0;
      acc.count += items[p].count;
      return acc;
    }, { count: 0, used: 0, applied: 0, working: 0, posted: 0, done: 0, paid: 0, views: 0 });
    const returned = get("SELECT COALESCE(SUM(amount),0) AS total FROM ledger WHERE wallet='credit' AND kind IN ('sf_release','sf_refund') AND (ref=CAST(? AS TEXT) OR ref IN (SELECT CAST(id AS TEXT) FROM sf_tasks WHERE campaign_id=?))", campaign.id, campaign.id).total;
    return { ...rest, memo: admin ? campaign.memo : undefined, items, usage: use, totals, committed, returned,
      payTotal: admin ? get(`SELECT COALESCE(SUM(pay),0) AS total FROM sf_tasks WHERE campaign_id=? AND status IN ${COMMITTED}`, campaign.id).total : undefined };
  }

  const taskColumns = `t.id,t.campaign_id,t.user_id,t.channel_id,t.platform,t.status,t.cost,t.pay,t.note,t.draft_url,t.draft_note,t.drafts,t.feedback,t.post_url,t.post_note,
    t.proof_id,t.posted,t.views,t.likes,t.comments,t.metrics_proof_id,t.metrics_at,t.reason,t.canceled_by,t.due_at,t.settle_at,t.created,t.accepted,t.decided,t.paid,
    ch.handle,ch.url AS channel_url,ch.followers,u.name AS creator`;
  function campaignDetail(user, params) {
    need(user, ['admin', ...partnerRoles]);
    const id = int(params.get('id') || '', '캠페인 번호', 1, 1e9);
    const campaign = get('SELECT c.*, u.name AS owner FROM sf_campaigns c LEFT JOIN users u ON u.id=c.owner_id WHERE c.id=?', id);
    assert(campaign && (isAdmin(user) || campaign.owner_id === user.id), '캠페인을 찾을 수 없습니다.', 404);
    const tasks = all(`SELECT ${taskColumns}, ${reliability} FROM sf_tasks t JOIN sf_channels ch ON ch.id=t.channel_id JOIN users u ON u.id=t.user_id
      WHERE t.campaign_id=? ORDER BY (t.status='applied') DESC, (t.status='drafted') DESC, (t.status='posted') DESC, t.id DESC`, id)
      .map(task => ({ ...task, creator: isAdmin(user) ? task.creator : mask(task.creator) }));
    const trend = all(`SELECT date(posted,'+9 hours') AS day, COUNT(*) AS total FROM sf_tasks WHERE campaign_id=? AND status IN ('posted','approved','paid') GROUP BY day ORDER BY day`, id);
    return { campaign: campaignView(campaign, { admin: isAdmin(user) }), tasks, trend, platforms, modes, policy: { label: label(), holdDays: policy().holdDays } };
  }

  function ownerOverview(user) {
    need(user, partnerRoles);
    sweep();
    const campaigns = all('SELECT * FROM sf_campaigns WHERE owner_id=? ORDER BY id DESC', user.id).map(c => campaignView(c));
    const trend = all(`SELECT date(t.posted,'+9 hours') AS day, COUNT(*) AS total FROM sf_tasks t JOIN sf_campaigns c ON c.id=t.campaign_id
      WHERE c.owner_id=? AND t.status IN ('posted','approved','paid') AND t.posted>=? GROUP BY day`, user.id, dayStart(new Date(Date.now() - 13 * DAY).toISOString().slice(0, 10)));
    const pending = { applied: 0, drafted: 0 };
    for (const row of all(`SELECT t.status, COUNT(*) AS total FROM sf_tasks t JOIN sf_campaigns c ON c.id=t.campaign_id WHERE c.owner_id=? AND t.status IN ('applied','drafted') GROUP BY t.status`, user.id)) pending[row.status] = row.total;
    return { campaigns, trend, pending, balance: balance(user.id, 'credit'), platforms, modes, rates: rates(), label: label(), holdDays: policy().holdDays,
      creators: get("SELECT COUNT(*) AS total FROM sf_creators c JOIN users u ON u.id=c.user_id WHERE c.status='approved' AND u.status='active'").total,
      channels: Object.fromEntries(all("SELECT platform, COUNT(*) AS total FROM sf_channels WHERE status='verified' GROUP BY platform").map(r => [r.platform, r.total])) };
  }

  function creatorOverview(user) {
    need(user, ['creator']);
    sweep();
    const profile = creatorRow(user.id) || { status: 'pending' };
    const channels = all("SELECT id,platform,handle,url,followers,category,code,status,reason,proof_id,created,verified FROM sf_channels WHERE user_id=? AND status<>'removed' ORDER BY id DESC", user.id);
    const tasks = all(`SELECT ${taskColumns}, c.title, c.brand, c.mode, c.guide, c.product, c.hashtags, c.mention, c.forbidden, c.source_url, c.landing_url, c.length_sec, c.keep_days,
      c.draft_review, c.end_date, c.status AS campaign_status FROM sf_tasks t JOIN sf_campaigns c ON c.id=t.campaign_id JOIN sf_channels ch ON ch.id=t.channel_id JOIN users u ON u.id=t.user_id
      WHERE t.user_id=? ORDER BY (t.status IN ('accepted','revise','ready')) DESC, (t.status IN ('applied','drafted','posted','approved')) DESC, t.id DESC LIMIT 200`, user.id)
      .map(({ creator: _c, ...task }) => task);
    const today = dateKst();
    const verified = channels.filter(c => c.status === 'verified');
    const jobs = all("SELECT * FROM sf_campaigns WHERE status='active' AND start_date<=? AND end_date>=? ORDER BY id DESC", today, today).map(c => {
      const items = parsePlatforms(c);
      const use = usage(c.id);
      const mine = tasks.find(t => t.campaign_id === c.id);
      const slots = Object.fromEntries(Object.entries(items).map(([p, item]) => [p, { count: item.count, pay: item.pay, left: Math.max(0, item.count - (use[p]?.used || 0)) }]));
      const eligible = verified.filter(ch => slots[ch.platform]?.left > 0 && ch.followers >= c.min_followers).map(ch => ch.id);
      return { id: c.id, mode: c.mode, title: c.title, brand: c.brand, product: c.product, guide: c.guide, hashtags: c.hashtags, mention: c.mention, forbidden: c.forbidden,
        source_url: c.source_url, landing_url: c.landing_url, length_sec: c.length_sec, keep_days: c.keep_days, min_followers: c.min_followers, selection: c.selection,
        draft_review: c.draft_review, start_date: c.start_date, end_date: c.end_date, slots, eligible, mine: mine && !(mine.status === 'canceled' && mine.canceled_by === 'creator') ? mine.status : null };
    });
    const earned = all(`SELECT date(paid,'+9 hours') AS day, SUM(pay) AS total FROM sf_tasks WHERE user_id=? AND status='paid' AND paid>=? GROUP BY day`,
      user.id, dayStart(new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10)));
    return { profile: { status: profile.status, intro: profile.intro, main_platform: profile.main_platform, grade: profile.grade, reason: profile.reason, created: profile.created },
      channels, tasks, jobs, earned, balance: balance(user.id, 'earning'),
      pendingPay: get("SELECT COALESCE(SUM(pay),0) AS total FROM sf_tasks WHERE user_id=? AND status='approved'", user.id).total,
      totalPaid: get("SELECT COALESCE(SUM(pay),0) AS total FROM sf_tasks WHERE user_id=? AND status='paid'", user.id).total,
      totalViews: get("SELECT COALESCE(SUM(views),0) AS total FROM sf_tasks WHERE user_id=? AND status IN ('posted','approved','paid')", user.id).total,
      platforms, modes, grades, policy: { label: label(), holdDays: policy().holdDays, dueDays: policy().dueDays, maxOpen: policy().maxOpen } };
  }

  function counts() {
    return {
      campaigns: get("SELECT COUNT(*) AS total FROM sf_campaigns WHERE status='review'").total,
      posted: get("SELECT COUNT(*) AS total FROM sf_tasks WHERE status='posted'").total,
      creators: get("SELECT COUNT(*) AS total FROM sf_creators c JOIN users u ON u.id=c.user_id WHERE c.status='pending' AND u.status='active'").total,
      channels: get("SELECT COUNT(*) AS total FROM sf_channels WHERE status='pending'").total
    };
  }

  function adminOverview(user, params) {
    need(user, ['admin']);
    sweep();
    const view = params.get('view') || '';
    const page = Math.max(1, Number(params.get('page')) || 1);
    const q = (params.get('q') || '').trim().toLowerCase().slice(0, 60);
    const status = params.get('status') || '';
    const result = { counts: counts(), platforms, modes, grades, policy: policy(),
      kpi: {
        live: get("SELECT COUNT(*) AS total FROM sf_campaigns WHERE status IN ('active','paused')").total,
        holding: get("SELECT COALESCE(SUM(pay),0) AS total FROM sf_tasks WHERE status='approved'").total,
        approvedToday: get("SELECT COUNT(*) AS total FROM sf_tasks WHERE status IN ('approved','paid') AND decided>=?", dayStart()).total,
        profit: get(`SELECT COALESCE(SUM(cost-pay),0) AS total FROM sf_tasks WHERE status IN ${COMMITTED}`).total,
        paid: get("SELECT COALESCE(SUM(pay),0) AS total FROM sf_tasks WHERE status='paid'").total,
        creators: get("SELECT COUNT(*) AS total FROM sf_creators WHERE status='approved'").total
      } };
    if (['', 'campaigns'].includes(view)) {
      result.campaigns = all(`SELECT c.*, u.name AS owner FROM sf_campaigns c LEFT JOIN users u ON u.id=c.owner_id
        ORDER BY (c.status='review') DESC, (c.status IN ('active','paused')) DESC, c.id DESC LIMIT 200`).map(c => campaignView(c, { admin: true }));
    }
    if (view === 'review') {
      const join = `FROM sf_tasks t JOIN sf_campaigns c ON c.id=t.campaign_id JOIN sf_channels ch ON ch.id=t.channel_id JOIN users u ON u.id=t.user_id`;
      result.posted = all(`SELECT ${taskColumns}, c.title, c.brand, c.mode, c.hashtags, c.mention, c.forbidden, c.keep_days, ${reliability} ${join} WHERE t.status='posted' ORDER BY t.posted LIMIT 100`);
      result.holding = all(`SELECT ${taskColumns}, c.title ${join} WHERE t.status='approved' ORDER BY t.settle_at LIMIT 100`);
      result.drafts = all(`SELECT ${taskColumns}, c.title ${join} WHERE t.status='drafted' ORDER BY t.id LIMIT 50`);
    }
    if (view === 'tasks') {
      const states = ['applied', 'accepted', 'drafted', 'revise', 'ready', 'posted', 'approved', 'paid', 'declined', 'canceled', 'expired', 'rejected', 'revoked'];
      const filter = states.includes(status) ? status : '';
      const where = "(?='' OR t.status=?) AND (?='' OR lower(c.title) LIKE ? OR lower(u.name) LIKE ? OR lower(ch.handle) LIKE ?)";
      const like = `%${q}%`;
      const args = [filter, filter, q, like, like, like];
      const join = 'FROM sf_tasks t JOIN sf_campaigns c ON c.id=t.campaign_id JOIN sf_channels ch ON ch.id=t.channel_id JOIN users u ON u.id=t.user_id';
      const total = get(`SELECT COUNT(*) AS total ${join} WHERE ${where}`, ...args).total;
      const pages = Math.max(1, Math.ceil(total / 30));
      const current = Math.min(page, pages);
      result.tasks = all(`SELECT ${taskColumns}, c.title ${join} WHERE ${where} ORDER BY t.id DESC LIMIT 30 OFFSET ?`, ...args, (current - 1) * 30);
      result.page = current;
      result.pages = pages;
      result.total = total;
      result.statusCounts = Object.fromEntries(all('SELECT status, COUNT(*) AS total FROM sf_tasks GROUP BY status').map(r => [r.status, r.total]));
    }
    if (view === 'creators') {
      const filter = ['pending', 'approved', 'rejected', 'suspended'].includes(status) ? status : '';
      result.creators = all(`SELECT u.id, u.name, u.username, u.status AS account_status, u.created AS joined, u.last_login, s.status, s.intro, s.main_platform, s.grade, s.reason, s.memo, s.created, s.decided,
        (SELECT COUNT(*) FROM sf_channels WHERE user_id=u.id AND status='verified') AS verified_channels,
        (SELECT COUNT(*) FROM sf_channels WHERE user_id=u.id AND status='pending') AS pending_channels,
        (SELECT COALESCE(SUM(followers),0) FROM sf_channels WHERE user_id=u.id AND status='verified') AS followers,
        (SELECT COUNT(*) FROM sf_tasks WHERE user_id=u.id AND status IN ('applied','accepted','drafted','revise','ready','posted')) AS open_tasks,
        (SELECT COUNT(*) FROM sf_tasks WHERE user_id=u.id AND status IN ('approved','paid')) AS done_count,
        (SELECT COUNT(*) FROM sf_tasks WHERE user_id=u.id AND status IN ('expired','rejected','revoked')) AS fail_count,
        (SELECT COALESCE(SUM(pay),0) FROM sf_tasks WHERE user_id=u.id AND status='paid') AS earned,
        COALESCE((SELECT SUM(amount) FROM ledger WHERE user_id=u.id AND wallet='earning'),0) AS balance
        FROM sf_creators s JOIN users u ON u.id=s.user_id
        WHERE u.status<>'withdrawn' AND (?='' OR s.status=?) AND (?='' OR lower(u.name) LIKE ? OR lower(u.username) LIKE ?)
        ORDER BY (s.status='pending') DESC, s.created DESC LIMIT 200`, filter, filter, q, `%${q}%`, `%${q}%`);
      result.statusCounts = Object.fromEntries(all("SELECT s.status, COUNT(*) AS total FROM sf_creators s JOIN users u ON u.id=s.user_id WHERE u.status<>'withdrawn' GROUP BY s.status").map(r => [r.status, r.total]));
      result.channels = all(`SELECT ch.*, u.name AS owner, s.status AS creator_status FROM sf_channels ch JOIN users u ON u.id=ch.user_id LEFT JOIN sf_creators s ON s.user_id=u.id
        WHERE ch.status IN ('pending','verified','rejected') ORDER BY (ch.status='pending') DESC, ch.id DESC LIMIT 200`);
    }
    return result;
  }

  function saveSettings(user, body) {
    need(user, ['admin']);
    const name = str(body.label, '부업회원 명칭', 12, 2);
    assert(/^[\p{L}\p{N} ]+$/u.test(name), '명칭에는 글자·숫자·공백만 쓸 수 있어요.');
    const hold = int(body.hold_days, '정산 보류 기간', 0, 60);
    const dueDays = int(body.due_days, '제출 기한', 1, 60);
    const maxOpen = int(body.max_open, '동시 진행 작업 수', 1, 50);
    const next = {};
    for (const mode of Object.keys(modes)) {
      next[mode] = {};
      for (const p of Object.keys(platforms)) {
        const cost = int(body[`${mode}_${p}_cost`], `${modes[mode].label} ${platforms[p].short} 광고 단가`, 100, 10_000_000);
        const pay = int(body[`${mode}_${p}_pay`], `${modes[mode].label} ${platforms[p].short} 지급액`, 0, 10_000_000);
        assert(pay <= cost, `${modes[mode].label} ${platforms[p].short}: 지급액은 광고 단가보다 클 수 없어요.`);
        next[mode][p] = { cost, pay };
      }
    }
    return transaction(() => {
      const before = label();
      for (const [key, value] of [['sf_label', name], ['sf_hold_days', hold], ['sf_due_days', dueDays], ['sf_max_open', maxOpen], ['sf_auto_creator', flag(body.auto_creator)], ['sf_rates', JSON.stringify(next)]]) {
        run('UPDATE settings SET value=? WHERE key=?', String(value), key);
      }
      audit(user.id, '숏폼 단가·정책 변경', 'sf-settings', `${before !== name ? `명칭 ${before}→${name} · ` : ''}보류 ${hold}일 · 기한 ${dueDays}일 · 동시 ${maxOpen}건`);
      return {};
    });
  }

  /* ---------- CSV ---------- */
  const csvCell = value => {
    let text = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const kst = value => value ? new Date(Date.parse(value) + 9 * 3600_000).toISOString().slice(0, 16).replace('T', ' ') : '';
  const statusKo = { applied: '신청', accepted: '작업 중', drafted: '시안 검토', revise: '시안 수정', ready: '게시 대기', posted: '배포 검수', approved: '승인·정산 대기', paid: '정산 완료',
    declined: '미선정', canceled: '취소', expired: '기한 만료', rejected: '반려', revoked: '승인 취소' };
  function exportCsv(user, params) {
    const { campaign, tasks } = campaignDetail(user, params);
    const rows = [['작업 번호', '플랫폼', '채널', '팔로워', '참여자', '상태', '게시물 주소', '게시일', '조회수', '좋아요', '댓글', '집행액']];
    for (const t of tasks) rows.push([t.id, platforms[t.platform].short, '@' + t.handle, t.followers, t.creator, statusKo[t.status], t.post_url, kst(t.posted), t.views ?? '', t.likes ?? '', t.comments ?? '', ['approved', 'paid'].includes(t.status) ? t.cost : 0]);
    return { name: `adsform-shortform-${campaign.id}-${dateKst()}.csv`, body: '﻿' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') };
  }

  /* ---------- 데모 ---------- */
  if (demo && !get("SELECT value FROM settings WHERE key='sf_demo'")) {
    transaction(() => {
      const advertiser = get("SELECT id FROM users WHERE username='demo.advertiser'");
      if (!advertiser) return;
      const secret = () => randomBytes(24).toString('hex');
      const creator = get("SELECT id FROM users WHERE username='demo.creator'")?.id || addUser('demo.creator', '민트', secret(), 'creator', null, 1);
      const others = [['demo.sf1', '한결', 'approved', 'youtube'], ['demo.sf2', '소담', 'approved', 'tiktok'], ['demo.sf3', '도윤', 'pending', 'instagram'], ['demo.sf4', '라온', 'pending', 'tiktok']]
        .map(([username, name, status, main]) => ({ id: get('SELECT id FROM users WHERE username=?', username)?.id || addUser(username, name, secret(), 'creator', null, 1), status, main }));
      const stamp = (daysAgo, minutes = 600) => new Date(Date.parse(dateKst() + 'T00:00:00+09:00') - daysAgo * DAY + minutes * 60_000).toISOString();
      const addCreator = (id, status, main, intro) => run(`INSERT OR IGNORE INTO sf_creators(user_id,status,intro,main_platform,grade,created,decided) VALUES (?,?,?,?,?,?,?)`,
        id, status, intro, main, status === 'approved' ? 'pro' : 'basic', stamp(20), status === 'approved' ? stamp(19) : null);
      addCreator(creator, 'approved', 'instagram', '퇴근 후 일상·뷰티 릴스를 올리는 직장인 크리에이터예요. 주 3회 이상 게시합니다.');
      addCreator(others[0].id, 'approved', 'youtube', '맛집·여행 쇼츠 채널을 2년째 운영하고 있어요.');
      addCreator(others[1].id, 'approved', 'tiktok', '챌린지·리뷰 틱톡 계정 운영, 편집 가능합니다.');
      addCreator(others[2].id, 'pending', 'instagram', '육아 일상 계정을 운영 중이에요. 생활용품 리뷰 숏폼을 만들고 싶어요.');
      addCreator(others[3].id, 'pending', 'tiktok', '대학생 자취 꿀팁 숏폼을 올리고 있습니다. 부업으로 참여하고 싶어요.');
      const channel = (user, platform, handle, followers, status = 'verified') => Number(run(`INSERT INTO sf_channels(user_id,platform,handle,url,followers,category,code,status,created,verified) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        user, platform, handle, { youtube: `https://www.youtube.com/@${handle}`, instagram: `https://www.instagram.com/${handle}`, facebook: `https://www.facebook.com/${handle}`, tiktok: `https://www.tiktok.com/@${handle}` }[platform],
        followers, '일상', newCode(), status, stamp(18), status === 'verified' ? stamp(17) : null).lastInsertRowid);
      const mintIg = channel(creator, 'instagram', 'mint.daily', 12800);
      const mintYt = channel(creator, 'youtube', 'mintshorts', 5400);
      channel(creator, 'tiktok', 'mint.tok', 2100, 'pending');
      const hanYt = channel(others[0].id, 'youtube', 'hangyeol.eats', 48200);
      const hanFb = channel(others[0].id, 'facebook', 'hangyeol.eats', 9100);
      const soTt = channel(others[1].id, 'tiktok', 'sodam.review', 31500);
      channel(others[2].id, 'instagram', 'doyun.mom', 7600, 'pending');
      const table = rates();
      const make = (mode, title, items, extra) => {
        const platformsJson = Object.fromEntries(Object.entries(items).map(([p, count]) => [p, { count, ...table[mode][p] }]));
        const budget = Object.values(platformsJson).reduce((sum, item) => sum + item.count * item.cost, 0);
        const id = Number(run(`INSERT INTO sf_campaigns(owner_id,mode,title,brand,product,guide,hashtags,mention,forbidden,source_url,landing_url,length_sec,keep_days,min_followers,selection,draft_review,
          platforms,start_date,end_date,status,budget,created,decided) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          advertiser.id, mode, title, '오후의 상점', extra.product, extra.guide, extra.hashtags || '', extra.mention || '', extra.forbidden || '', extra.source || '', 'https://example.com/store',
          extra.length || 30, 30, extra.min || 0, extra.selection || 'auto', extra.draft ? 1 : 0, JSON.stringify(platformsJson), extra.start, extra.end, extra.status, budget, stamp(extra.created ?? 10), extra.status === 'review' ? null : stamp(9)).lastInsertRowid);
        entry(advertiser.id, 'credit', 300000, 'opening', `sf-demo-${id}`);
        entry(advertiser.id, 'credit', -budget, 'sf_reserve', id);
        return id;
      };
      const shift = n => new Date(Date.parse(dateKst()) + n * DAY).toISOString().slice(0, 10);
      const autumn = make('produce', '가을 신메뉴 ‘밤 라떼’ 숏폼 리뷰', { instagram: 4, youtube: 3, tiktok: 3 }, {
        product: '국산 밤을 졸여 만든 오후의 상점 가을 시그니처 음료 ‘밤 라떼’입니다. 11월 한 달간 전 매장에서 판매해요.',
        guide: '매장에서 밤 라떼를 직접 주문해 첫 모금 반응을 담아 주세요. 15~30초 세로 영상, 자막 필수. 마지막 3초에 매장 외관이나 로고를 보여 주세요.',
        hashtags: '#오후의상점 #밤라떼 #가을신메뉴 #광고', mention: '@afternoon.store 태그, “유료 광고 포함” 표시', forbidden: '타 브랜드 음료 비교, 과장된 효능 표현',
        start: shift(-9), end: shift(14), status: 'active', draft: true, length: 30 });
      make('distribute', '블랙프라이데이 최대 70% 할인 영상 배포', { instagram: 10, facebook: 5, tiktok: 5 }, {
        product: '오후의 상점 블랙프라이데이 기획전 홍보 영상(20초)을 배포합니다.', guide: '제공 영상을 편집 없이 올리고, 본문에 아래 해시태그와 링크 안내 문구를 넣어 주세요.',
        hashtags: '#오후의상점 #블랙프라이데이 #광고', source: 'https://example.com/media/blackfriday.mp4', start: shift(1), end: shift(20), status: 'review', created: 0, length: 15 });
      const winter = make('distribute', '겨울 홈카페 키트 30초 영상 배포', { youtube: 4, instagram: 6 }, {
        product: '집에서 즐기는 핸드드립 홈카페 키트(드리퍼·필터·원두 200g) 겨울 한정 구성입니다.', guide: '제공 영상을 그대로 올리고, 본문 첫 줄에 “겨울 홈카페 키트 출시”를 적어 주세요. 프로필 링크에 구매 링크를 걸어 주세요.',
        hashtags: '#오후의상점 #홈카페 #겨울한정 #광고', mention: '“유료 광고 포함” 표시', source: 'https://example.com/media/winter-homecafe.mp4', start: shift(-2), end: shift(18), status: 'active', length: 30 });
      make('produce', '신상 보온 텀블러 언박싱 숏폼', { youtube: 3, tiktok: 3 }, {
        product: '12시간 보온되는 오후의 상점 신상 텀블러(350ml). 무광 파스텔 4색입니다.', guide: '언박싱 → 색상 소개 → 뜨거운 음료를 담고 6시간 뒤 온도 확인 장면을 꼭 넣어 주세요. 세로 30초 이내.',
        hashtags: '#오후의상점 #텀블러 #언박싱 #광고', mention: '@afternoon.store 태그', forbidden: '타 브랜드 비교, 근거 없는 보온 시간 표현', start: shift(-1), end: shift(21), status: 'active', selection: 'manual', min: 1000, draft: true });
      const task = (campaign, user, ch, platform, status, extra = {}) => {
        const item = JSON.parse(get('SELECT platforms FROM sf_campaigns WHERE id=?', campaign).platforms)[platform];
        const id = Number(run(`INSERT INTO sf_tasks(campaign_id,user_id,channel_id,platform,status,cost,pay,note,draft_url,drafts,post_url,post_key,posted,views,likes,comments,metrics_at,
          due_at,settle_at,created,accepted,decided,paid) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          campaign, user, ch, platform, status, item.cost, item.pay, extra.note || '', extra.draft || '', extra.draft ? 1 : 0, extra.post || '', extra.post ? createHash('sha256').update(extra.key).digest('hex').slice(0, 32) : null,
          extra.post ? stamp(extra.postedAgo ?? 3) : null, extra.views ?? null, extra.likes ?? null, extra.comments ?? null, extra.views ? stamp(1) : null,
          ['accepted', 'ready', 'revise'].includes(status) ? Date.now() + 4 * DAY : null, status === 'approved' ? Date.now() + 2 * DAY : null,
          stamp(8), stamp(8), ['approved', 'paid'].includes(status) ? stamp(extra.postedAgo ? extra.postedAgo - 1 : 2) : null, status === 'paid' ? stamp(1) : null).lastInsertRowid);
        if (status === 'paid') entry(user, 'earning', item.pay, 'sf_pay', id);
        return id;
      };
      task(autumn, others[0].id, hanYt, 'youtube', 'paid', { post: 'https://youtube.com/shorts/demoHan01x', key: 'yt:demoHan01x', postedAgo: 6, views: 18400, likes: 920, comments: 41 });
      task(autumn, others[1].id, soTt, 'tiktok', 'approved', { post: 'https://www.tiktok.com/@sodam.review/video/7300000000000000001', key: 'tt:7300000000000000001', postedAgo: 3, views: 26100, likes: 2210, comments: 133 });
      task(winter, creator, mintYt, 'youtube', 'accepted', {});
      task(autumn, creator, mintIg, 'instagram', 'posted', { post: 'https://www.instagram.com/reel/DmintDemo01', key: 'ig:DmintDemo01', postedAgo: 0, views: 1540, likes: 88, comments: 9, draft: 'https://drive.example.com/mint-draft' });
      run("INSERT INTO settings VALUES ('sf_demo', ?)", now());
      void mintYt;
      void hanFb;
    });
  }

  return {
    sweep,
    counts,
    label,
    registerCreator,
    creatorStatus: userId => creatorRow(userId)?.status || null,
    hasOpenWork: userId => Boolean(get(`SELECT 1 FROM sf_tasks WHERE user_id=? AND status IN ('applied','accepted','drafted','revise','ready','posted','approved')`, userId)),
    hasLive: userId => Boolean(get("SELECT 1 FROM sf_campaigns WHERE owner_id=? AND status IN ('review','active','paused')", userId)),
    withdrawCreator: userId => {
      run("UPDATE sf_channels SET status='removed', updated=? WHERE user_id=? AND status<>'removed'", now(), userId);
      run("UPDATE sf_creators SET status='suspended', reason='회원 탈퇴', intro='' WHERE user_id=?", userId);
    },
    uploadAsset,
    image,
    exportCsv,
    routes: {
      '/api/shortform/campaign': (_req, _res, user, body) => createCampaign(user, body),
      '/api/shortform/campaign/update': (_req, _res, user, body) => updateCampaign(user, body),
      '/api/shortform/campaign/status': (_req, _res, user, body) => campaignStatus(user, body),
      '/api/shortform/campaign/extend': (_req, _res, user, body) => extendCampaign(user, body),
      '/api/shortform/task/select': (_req, _res, user, body) => selectTask(user, body),
      '/api/shortform/task/draft-review': (_req, _res, user, body) => reviewDraft(user, body),
      '/api/shortform/task/review': (_req, _res, user, body) => reviewPost(user, body),
      '/api/shortform/task/settle': (_req, _res, user, body) => settleTask(user, body),
      '/api/shortform/task/metrics': (_req, _res, user, body) => reportMetrics(user, body),
      '/api/shortform/join': (_req, _res, user, body) => join(user, body),
      '/api/shortform/task/cancel': (_req, _res, user, body) => cancelTask(user, body),
      '/api/shortform/task/draft': (_req, _res, user, body) => submitDraft(user, body),
      '/api/shortform/task/post': (_req, _res, user, body) => submitPost(user, body),
      '/api/shortform/channel': (_req, _res, user, body) => addChannel(user, body),
      '/api/shortform/channel/proof': (_req, _res, user, body) => proveChannel(user, body),
      '/api/shortform/channel/remove': (_req, _res, user, body) => removeChannel(user, body),
      '/api/shortform/channel/decision': (_req, _res, user, body) => decideChannel(user, body),
      '/api/shortform/creator/reapply': (_req, _res, user, body) => reapply(user, body),
      '/api/shortform/creator/decision': (_req, _res, user, body) => decideCreator(user, body),
      '/api/shortform/creator/update': (_req, _res, user, body) => updateCreator(user, body),
      '/api/shortform/settings': (_req, _res, user, body) => saveSettings(user, body)
    },
    getRoutes: {
      '/api/shortform/admin': (user, params) => adminOverview(user, params),
      '/api/shortform/mine': user => ownerOverview(user),
      '/api/shortform/me': user => creatorOverview(user),
      '/api/shortform/campaign': (user, params) => campaignDetail(user, params)
    }
  };
}
