import { createServer } from 'node:http';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.ADSFORM_PORT || 3063);
const shareOrigin = process.env.ADSFORM_PUBLIC_ORIGIN ? new URL(process.env.ADSFORM_PUBLIC_ORIGIN) : null;
if (shareOrigin && (shareOrigin.protocol !== 'https:' || shareOrigin.href !== shareOrigin.origin + '/')) {
  throw new Error('ADSFORM_PUBLIC_ORIGIN must be an HTTPS origin, such as https://adsform.example');
}
const demo = process.env.ADSFORM_DEMO !== '0';
const dbPath = resolve(process.env.ADSFORM_DB || resolve(root, 'data', demo ? 'demo.sqlite' : 'adsform.sqlite'));
const roles = ['admin', 'advertiser', 'agency', 'operator', 'participant'];
const partners = ['advertiser', 'agency', 'operator'];
const backgrounds = ['grove', 'tide', 'lilac', 'sunset', 'night'];
const products = { quiz: { cost: 500, reward: 150 }, survey: { cost: 900, reward: 300 } };
const reservationMinutes = 10;
const dateKst = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format();
const now = () => new Date().toISOString();

mkdirSync(dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin','advertiser','agency','operator','participant')),
    parent_id INTEGER REFERENCES users(id), rate INTEGER CHECK (rate BETWEEN 0 AND 10000),
    is_demo INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS charges (
    id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', created TEXT NOT NULL, decided TEXT, operator_id INTEGER REFERENCES users(id),
    rate INTEGER NOT NULL DEFAULT 0, commission INTEGER NOT NULL DEFAULT 0, request_key TEXT NOT NULL,
    UNIQUE(user_id, request_key)
  );
  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY, owner_id INTEGER REFERENCES users(id), title TEXT NOT NULL, brand TEXT NOT NULL,
    kind TEXT NOT NULL, details TEXT NOT NULL, prompt TEXT NOT NULL, choices TEXT NOT NULL DEFAULT '[]', answer INTEGER,
    goal INTEGER NOT NULL, cost INTEGER NOT NULL, reward INTEGER NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL,
    status TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', created TEXT NOT NULL, request_key TEXT,
    UNIQUE(owner_id, request_key)
  );
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY, campaign_id INTEGER NOT NULL REFERENCES campaigns(id), user_id INTEGER NOT NULL REFERENCES users(id),
    response TEXT NOT NULL, status TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', created TEXT NOT NULL,
    UNIQUE(campaign_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS reservations (
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id), user_id INTEGER NOT NULL REFERENCES users(id),
    expires INTEGER NOT NULL, PRIMARY KEY(campaign_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS reservations_campaign_expiry ON reservations(campaign_id, expires);
  CREATE TABLE IF NOT EXISTS ledger (
    id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), wallet TEXT NOT NULL,
    amount INTEGER NOT NULL, kind TEXT NOT NULL, ref TEXT NOT NULL, created TEXT NOT NULL,
    UNIQUE(user_id, wallet, kind, ref)
  );
  CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY, actor INTEGER REFERENCES users(id), action TEXT NOT NULL, subject TEXT NOT NULL,
    detail TEXT NOT NULL, created TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), subject TEXT NOT NULL,
    message TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', created TEXT NOT NULL, reviewed TEXT,
    request_key TEXT NOT NULL UNIQUE
  );
  INSERT OR IGNORE INTO settings VALUES ('background', 'grove'), ('default_rate', '750');
`);

const get = (sql, ...params) => db.prepare(sql).get(...params);
const all = (sql, ...params) => db.prepare(sql).all(...params);
const run = (sql, ...params) => db.prepare(sql).run(...params);
const setting = key => get('SELECT value FROM settings WHERE key=?', key).value;
const setSetting = (key, value) => run('UPDATE settings SET value=? WHERE key=?', String(value), key);
const balance = (id, wallet) => get('SELECT COALESCE(SUM(amount),0) AS total FROM ledger WHERE user_id=? AND wallet=?', id, wallet).total;
const entry = (id, wallet, amount, kind, ref) => run('INSERT INTO ledger(user_id,wallet,amount,kind,ref,created) VALUES (?,?,?,?,?,?)', id, wallet, amount, kind, String(ref), now());
const audit = (actor, action, subject, detail = '') => run('INSERT INTO audit(actor,action,subject,detail,created) VALUES (?,?,?,?,?)', actor, action, String(subject), detail, now());
const digest = token => createHash('sha256').update(token).digest('hex');
const clean = user => user && ({ id: user.id, name: user.name, username: user.username, role: user.role, parent_id: user.parent_id });
const passHash = (password, salt = randomBytes(16).toString('hex')) => `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
const checkPass = (password, saved) => timingSafeEqual(Buffer.from(passHash(password, saved.split(':')[0])), Buffer.from(saved));
const count = (campaign, onlyApproved = false) => get(`SELECT COUNT(*) AS total FROM submissions WHERE campaign_id=? AND status ${onlyApproved ? "='approved'" : "IN ('approved','pending')"}`, campaign).total;
const countReserved = (campaign, time) => get('SELECT COUNT(*) AS total FROM reservations WHERE campaign_id=? AND expires>?', campaign, time).total;

function transaction(work) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function addUser(username, name, password, role, parent = null, isDemo = 0) {
  return Number(run('INSERT INTO users(username,name,password,role,parent_id,is_demo) VALUES (?,?,?,?,?,?)', username, name, passHash(password), role, parent, isDemo).lastInsertRowid);
}

if (demo && !get("SELECT id FROM users WHERE username='demo.admin'")) {
  transaction(() => {
    addUser('demo.admin', '애즈폼 운영팀', randomBytes(24).toString('hex'), 'admin', null, 1);
    const operator = addUser('demo.operator', '그린웨이 실행사', randomBytes(24).toString('hex'), 'operator', null, 1);
    const agency = addUser('demo.agency', '오브리 대행사', randomBytes(24).toString('hex'), 'agency', operator, 1);
    const advertiser = addUser('demo.advertiser', '오후의 상점', randomBytes(24).toString('hex'), 'advertiser', null, 1);
    addUser('demo.participant', '하루', randomBytes(24).toString('hex'), 'participant', null, 1);
    for (const id of [operator, agency, advertiser]) entry(id, 'credit', 150000, 'opening', 'demo');
    const examples = [
      ['일상의 여유를 담은 커피 퀴즈', '모닝 로스터스', 'quiz', '커피에 관한 짧은 퀴즈예요. 문항을 읽고 정답을 골라 보세요.', '커피 원두를 분쇄한 뒤 물을 통과시켜 추출하는 방식은?', ['드립', '로스팅', '블렌딩'], 0],
      ['나의 주말 소비 취향 조사', '리빙랩', 'survey', '주말에 가장 자주 하는 소비 활동과 그 이유를 알려주세요.', '어떤 활동에 지출하고, 그 이유는 무엇인가요?'],
      ['친환경 포장, 얼마나 알고 있나요?', '그린웨이', 'quiz', '생활 속 분리배출 지식을 확인하는 브랜드 퀴즈예요.', '종이 상자를 배출하기 전에 테이프는 어떻게 해야 할까요?', ['제거한다', '물을 뿌린다', '추가로 붙인다'], 0],
      ['다음 여행에서 가장 중요한 것', '오후의 여행', 'survey', '여행지를 고를 때 고려하는 조건에 관한 짧은 설문이에요.', '가장 중요하게 생각하는 조건과 이유를 적어주세요.'],
      ['로컬 브랜드 이야기', '오후의 상점', 'quiz', '동네에서 만나는 작은 브랜드에 대한 퀴즈예요.', '로컬 브랜드가 주로 기반을 두는 곳은 어디일까요?', ['특정 지역', '공해', '우주 정거장'], 0],
      ['새로운 생활용품을 고르는 기준', '스튜디오 오브리', 'survey', '생활용품을 비교하는 기준을 함께 살펴봐요.', '최근 구입한 생활용품을 선택한 이유를 알려주세요.']
    ];
    const insert = db.prepare("INSERT INTO campaigns(owner_id,title,brand,kind,details,prompt,choices,answer,goal,cost,reward,start_date,end_date,status,created) VALUES (NULL,?,?,?,?,?,?,?,?,?,?,?,?,'active',?)");
    for (const [title, brand, kind, details, prompt, choices = [], answer = null] of examples) {
      const { cost, reward } = products[kind];
      insert.run(title, brand, kind, details, prompt, JSON.stringify(choices), answer, 60, cost, reward, dateKst(), '2099-12-31', now());
    }
  });
}
if (!demo && !get("SELECT id FROM users WHERE role='admin' AND is_demo=0")) {
  const initial = process.env.ADSFORM_ADMIN_PASSWORD;
  if (!initial || initial.length < 12 || initial.length > 128) throw new Error('Set ADSFORM_ADMIN_PASSWORD (12–128 characters) for the first non-demo launch.');
  addUser('admin', '애즈폼 운영팀', initial, 'admin');
}

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function assert(condition, message, status = 400) {
  if (!condition) fail(status, message);
}

function role(user, allowed) {
  assert(user, '로그인이 필요합니다.', 401);
  assert(allowed.includes(user.role), '이 기능을 사용할 권한이 없습니다.', 403);
}

function str(value, label, max, min = 1) {
  const result = typeof value === 'string' ? value.trim() : '';
  assert(result.length >= min && result.length <= max, `${label}은(는) ${min}~${max}자로 입력해 주세요.`);
  return result;
}

function int(value, label, min, max) {
  assert(typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value)), `${label}을(를) 정수로 입력해 주세요.`);
  const number = Number(value);
  assert(Number.isSafeInteger(number) && number >= min && number <= max, `${label}은(는) ${min.toLocaleString()}~${max.toLocaleString()} 사이여야 합니다.`);
  return number;
}

function date(value) {
  const day = str(value, '날짜', 10, 10);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day, '올바른 날짜를 입력해 주세요.');
  return day;
}

function rate(value) {
  assert(typeof value === 'string' && /^\d{1,3}(\.\d{1,2})?$/.test(value), '수익률은 소수점 둘째 자리까지 입력해 주세요.');
  return int(Math.round(Number(value) * 100), '수익률', 0, 10000);
}

function login(req, res, user) {
  const old = cookie(req);
  if (old) run('DELETE FROM sessions WHERE token=?', digest(old));
  run('DELETE FROM sessions WHERE expires < ?', Date.now());
  const token = randomBytes(32).toString('hex');
  run('INSERT INTO sessions VALUES (?,?,?)', digest(token), user.id, Date.now() + 8 * 3600_000);
  res.setHeader('Set-Cookie', `adsform=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);
  return { user: clean(user) };
}

const cookie = req => req.headers.cookie?.match(/(?:^|;\s*)adsform=([a-f0-9]{64})(?:;|$)/)?.[1];
function session(req) {
  const token = cookie(req);
  if (!token) return null;
  const user = get('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?', digest(token), Date.now());
  return user && (!user.is_demo || demo) ? user : null;
}

const attempts = new Map();
function authenticate(req, res, body) {
  const username = str(body.username, '아이디', 32).toLowerCase();
  const password = str(body.password, '비밀번호', 128);
  const key = req.socket.remoteAddress;
  const recent = (attempts.get(key) || []).filter(time => Date.now() - time < 60_000);
  assert(recent.length < 20, '로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.', 429);
  attempts.set(key, [...recent, Date.now()]);
  const user = get('SELECT * FROM users WHERE username=?', username);
  assert(user && !user.is_demo && checkPass(password, user.password), '아이디 또는 비밀번호를 확인해 주세요.', 401);
  attempts.delete(key);
  return login(req, res, user);
}

function newAccount(actor, body) {
  role(actor, ['admin', 'operator']);
  const targetRole = actor.role === 'operator' ? 'agency' : body.role;
  assert(roles.includes(targetRole) && targetRole !== 'admin', '등록할 계정 유형을 확인해 주세요.');
  const username = str(body.username, '아이디', 32, 4).toLowerCase();
  assert(/^[a-z0-9][a-z0-9._-]+$/.test(username) && !username.startsWith('demo.'), '아이디는 영문, 숫자, 점, 밑줄, 하이픈을 사용할 수 있습니다.');
  const name = str(body.name, '이름', 60);
  const password = str(body.password, '비밀번호', 128, 10);
  let parent = actor.role === 'operator' ? actor.id : null;
  if (actor.role === 'admin' && targetRole === 'agency' && body.parent_id) {
    parent = int(body.parent_id, '실행사', 1, 1e9);
    assert(get("SELECT id FROM users WHERE id=? AND role='operator'", parent), '실행사 계정을 선택해 주세요.');
  }
  return transaction(() => {
    assert(!get('SELECT id FROM users WHERE username=?', username), '이미 사용 중인 아이디입니다.', 409);
    const id = addUser(username, name, password, targetRole, parent);
    audit(actor.id, '계정 등록', id, targetRole);
    return { id };
  });
}

function publicCampaigns(user) {
  const today = dateKst();
  const time = Date.now();
  const rows = all(`SELECT c.id,c.title,c.brand,c.kind,c.details,c.prompt,c.choices,c.reward,c.goal,c.start_date,c.end_date,
    (SELECT COUNT(*) FROM submissions WHERE campaign_id=c.id AND status IN ('pending','approved')) AS used,
    (SELECT status FROM submissions WHERE campaign_id=c.id AND user_id=?) AS mine,
    (SELECT COUNT(*) FROM reservations WHERE campaign_id=c.id AND expires>?) AS reserved,
    (SELECT expires FROM reservations WHERE campaign_id=c.id AND user_id=? AND expires>?) AS reservedUntil
    FROM campaigns c WHERE c.status='active' AND c.start_date<=? AND c.end_date>=?
      AND (? OR c.owner_id IS NOT NULL) ORDER BY c.id DESC`, user?.id || 0, time, user?.id || 0, time, today, today, Number(demo));
  return rows.map(row => ({
    ...row, prompt: row.reservedUntil ? row.prompt : '', choices: row.reservedUntil ? JSON.parse(row.choices) : [],
    remaining: Math.max(0, row.goal - row.used - row.reserved)
  }));
}

function summary(user) {
  expireCampaigns();
  const result = { user: clean(user), demo, background: setting('background'), products, missions: publicCampaigns(user), date: dateKst(), reservationMinutes };
  if (!user) return result;
  result.ledger = all('SELECT wallet,amount,kind,ref,created FROM ledger WHERE user_id=? ORDER BY id DESC LIMIT 100', user.id);
  result.balances = Object.fromEntries(['credit', 'revenue', 'reward'].map(wallet => [wallet, balance(user.id, wallet)]));
  if (user.role === 'participant') {
    result.submissions = all('SELECT s.id,s.status,s.reason,s.created,c.title,c.reward FROM submissions s JOIN campaigns c ON s.campaign_id=c.id WHERE s.user_id=? ORDER BY s.id DESC', user.id);
  }
  if (partners.includes(user.role) || user.role === 'admin') {
    const admin = user.role === 'admin';
    result.campaigns = all(`SELECT c.id,c.title,c.brand,c.kind,c.details,c.prompt,c.choices,c.answer,c.goal,c.cost,c.reward,c.start_date,c.end_date,c.status,c.reason,c.created,u.name AS owner,
      (SELECT COUNT(*) FROM submissions WHERE campaign_id=c.id AND status='approved') AS approved,
      (SELECT COUNT(*) FROM submissions WHERE campaign_id=c.id AND status='pending') AS reviewing,
      (SELECT COUNT(*) FROM reservations WHERE campaign_id=c.id AND expires>?) AS reserved,
      COALESCE((SELECT amount FROM ledger WHERE user_id=c.owner_id AND wallet='credit' AND kind='release' AND ref=CAST(c.id AS TEXT)),0) AS returned
      FROM campaigns c LEFT JOIN users u ON c.owner_id=u.id WHERE (? AND (c.owner_id IS NOT NULL OR ?)) OR c.owner_id=? ORDER BY c.id DESC`, Date.now(), Number(admin), Number(demo), user.id);
    result.charges = all(`SELECT c.id,c.amount,c.status,c.created,c.decided,c.rate,c.commission,u.name AS owner,o.name AS operator
      FROM charges c JOIN users u ON c.user_id=u.id LEFT JOIN users o ON c.operator_id=o.id
      WHERE ? OR c.user_id=? OR c.operator_id=? ORDER BY c.id DESC`, Number(admin), user.id, user.role === 'operator' ? user.id : -1);
  }
  if (user.role === 'operator') {
    result.agencies = all("SELECT id,name,username FROM users WHERE parent_id=? AND role='agency' ORDER BY id DESC", user.id);
    result.rate = user.rate ?? Number(setting('default_rate'));
  }
  if (user.role === 'admin') {
    result.defaultRate = Number(setting('default_rate'));
    result.accounts = all('SELECT u.id,u.name,u.username,u.role,u.rate,p.name AS parent FROM users u LEFT JOIN users p ON u.parent_id=p.id WHERE ? OR u.is_demo=0 ORDER BY u.id DESC', Number(demo));
    result.submissions = all(`SELECT s.id,s.status,s.created,s.response,c.title,c.reward,u.name FROM submissions s
      JOIN campaigns c ON c.id=s.campaign_id JOIN users u ON u.id=s.user_id
      WHERE ? OR u.is_demo=0 ORDER BY (s.status='pending') DESC, s.id DESC LIMIT 100`, Number(demo));
    result.audit = all('SELECT a.action,a.subject,a.detail,a.created,u.name FROM audit a LEFT JOIN users u ON u.id=a.actor ORDER BY a.id DESC LIMIT 50');
    result.inquiries = all(`SELECT i.id,i.subject,i.message,i.email,i.created,i.reviewed,u.name AS sender
      FROM inquiries i LEFT JOIN users u ON u.id=i.user_id ORDER BY i.reviewed IS NOT NULL, i.id DESC LIMIT 100`);
    result.adminCounts = {
      pendingSubmissions: get(`SELECT COUNT(*) AS total FROM submissions s JOIN users u ON u.id=s.user_id
        WHERE s.status='pending' AND (? OR u.is_demo=0)`, Number(demo)).total,
      unreadInquiries: get('SELECT COUNT(*) AS total FROM inquiries WHERE reviewed IS NULL').total
    };
  }
  return result;
}

function requestCharge(user, body) {
  role(user, partners);
  const amount = int(body.amount, '충전액', 1000, 10000000);
  const key = str(body.key, '요청 키', 64);
  return transaction(() => {
    const existing = get('SELECT id,amount FROM charges WHERE user_id=? AND request_key=?', user.id, key);
    if (existing) {
      assert(existing.amount === amount, '요청 내용이 바뀌었습니다. 새로 제출해 주세요.', 409);
      return { id: existing.id };
    }
    const id = Number(run('INSERT INTO charges(user_id,amount,created,request_key) VALUES (?,?,?,?)', user.id, amount, now(), key).lastInsertRowid);
    audit(user.id, '충전 신청', id, String(amount));
    return { id };
  });
}

function decideCharge(user, body) {
  role(user, ['admin']);
  const id = int(body.id, '충전 번호', 1, 1e9);
  assert(['approve', 'reject'].includes(body.action), '충전 처리 유형을 확인해 주세요.');
  return transaction(() => {
    const charge = get('SELECT c.*,u.role,u.parent_id FROM charges c JOIN users u ON u.id=c.user_id WHERE c.id=?', id);
    assert(charge, '충전 요청을 찾을 수 없습니다.', 404);
    assert(charge.status === 'pending', '이미 처리된 충전입니다.', 409);
    if (body.action === 'reject') {
      run("UPDATE charges SET status='rejected', decided=? WHERE id=?", now(), id);
      audit(user.id, '충전 반려', id);
      return {};
    }
    const operator = charge.role === 'agency' && charge.parent_id
      ? get("SELECT id,rate FROM users WHERE id=? AND role='operator'", charge.parent_id) : null;
    const applied = operator ? operator.rate ?? Number(setting('default_rate')) : 0;
    const commission = Math.floor(charge.amount * applied / 10000);
    run("UPDATE charges SET status='approved',decided=?,operator_id=?,rate=?,commission=? WHERE id=?", now(), operator?.id ?? null, applied, commission, id);
    entry(charge.user_id, 'credit', charge.amount, 'charge', id);
    if (commission > 0) entry(operator.id, 'revenue', commission, 'commission', id);
    audit(user.id, '충전 승인', id, `${charge.amount}원 · 실행사 수익 ${commission}원`);
    return { commission };
  });
}

function createCampaign(user, body) {
  role(user, partners);
  const kind = body.kind;
  assert(Object.hasOwn(products, kind), '미션 유형을 선택해 주세요.');
  const { cost, reward } = products[kind];
  const title = str(body.title, '미션 제목', 80);
  const brand = str(body.brand, '브랜드명', 50);
  const details = str(body.details, '미션 소개', 500);
  const prompt = str(body.prompt, '참여 질문', 200);
  const choices = kind === 'quiz' ? [body.option1, body.option2, body.option3].map(v => str(v, '선택지', 60)) : [];
  assert(new Set(choices).size === choices.length, '선택지는 서로 달라야 합니다.');
  const answer = kind === 'quiz' ? int(body.answer, '정답 번호', 1, 3) - 1 : null;
  const goal = int(body.goal, '목표 수량', 1, 50000);
  const start = date(body.start);
  const end = date(body.end);
  assert(start >= dateKst() && end >= start, '시작일과 종료일을 확인해 주세요.');
  const key = str(body.key, '요청 키', 64);
  return transaction(() => {
    const existing = get('SELECT * FROM campaigns WHERE owner_id=? AND request_key=?', user.id, key);
    if (existing) {
      assert(existing.kind === kind && existing.title === title && existing.brand === brand && existing.details === details &&
        existing.prompt === prompt && existing.choices === JSON.stringify(choices) && existing.answer === answer &&
        existing.goal === goal && existing.start_date === start && existing.end_date === end, '이미 접수된 요청입니다. 새 주문 화면에서 다시 작성해 주세요.', 409);
      return { id: existing.id };
    }
    assert(balance(user.id, 'credit') >= cost * goal, '광고 잔액이 부족합니다. 먼저 충전을 신청해 주세요.', 409);
    const id = Number(run(`INSERT INTO campaigns(owner_id,title,brand,kind,details,prompt,choices,answer,goal,cost,reward,start_date,end_date,status,created,request_key)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?,?)`, user.id, title, brand, kind, details, prompt, JSON.stringify(choices), answer, goal, cost, reward, start, end, now(), key).lastInsertRowid);
    entry(user.id, 'credit', -(cost * goal), 'reserve', id);
    audit(user.id, '광고 주문 접수', id);
    return { id };
  });
}

function settleCampaign(campaign) {
  if (!campaign.owner_id) return;
  const remaining = (campaign.goal - count(campaign.id, true)) * campaign.cost;
  if (remaining) entry(campaign.owner_id, 'credit', remaining, 'release', campaign.id);
}

function finishCampaign(campaign, reason, actor = null) {
  run("UPDATE campaigns SET status='closed',reason=? WHERE id=?", reason, campaign.id);
  run('DELETE FROM reservations WHERE campaign_id=?', campaign.id);
  settleCampaign(campaign);
  audit(actor, '캠페인 종료·정산', campaign.id, reason);
}

const expiredCampaigns = `FROM campaigns c WHERE c.end_date<?
  AND c.status IN ('pending','active','paused')
  AND NOT EXISTS (SELECT 1 FROM submissions WHERE campaign_id=c.id AND status='pending')`;

function expireCampaigns() {
  const today = dateKst();
  if (!get(`SELECT 1 ${expiredCampaigns} LIMIT 1`, today)) return;
  transaction(() => {
    for (const campaign of all(`SELECT c.* ${expiredCampaigns}`, today)) {
      finishCampaign(campaign, '집행 기간 종료');
    }
  });
}

function decideCampaign(user, body) {
  role(user, ['admin']);
  const id = int(body.id, '캠페인 번호', 1, 1e9);
  const transitions = {
    pending: { approve: 'active', reject: 'rejected' },
    active: { pause: 'paused', close: 'closed' },
    paused: { resume: 'active', close: 'closed' }
  };
  return transaction(() => {
    const campaign = get('SELECT * FROM campaigns WHERE id=?', id);
    assert(campaign, '캠페인을 찾을 수 없습니다.', 404);
    const options = transitions[campaign.status] || {};
    assert(Object.hasOwn(options, body.action), '현재 상태에서 처리할 수 없습니다.', 409);
    const status = options[body.action];
    if (status === 'active') assert(campaign.end_date >= dateKst(), '종료일이 지난 캠페인입니다.');
    if (status === 'closed') {
      assert(count(id) === count(id, true), '심사 중인 제출을 먼저 처리해 주세요.', 409);
      finishCampaign(campaign, '운영자 종료', user.id);
      return {};
    }
    const reason = status === 'rejected' ? str(body.reason, '반려 사유', 200) : '';
    run('UPDATE campaigns SET status=?,reason=? WHERE id=?', status, reason, id);
    if (status === 'paused') run('DELETE FROM reservations WHERE campaign_id=?', id);
    if (status === 'rejected') settleCampaign(campaign);
    audit(user.id, '캠페인 상태 변경', id, status);
    return {};
  });
}

function rewardSubmission(id, user, campaign) {
  entry(user, 'reward', campaign.reward, 'mission', id);
}

function openCampaign(id) {
  const campaign = get('SELECT * FROM campaigns WHERE id=?', id);
  const today = dateKst();
  assert(campaign && campaign.status === 'active' && (demo || campaign.owner_id) &&
    campaign.start_date <= today && campaign.end_date >= today, '지금 참여할 수 없는 미션입니다.', 409);
  return campaign;
}

function reserveMission(user, body) {
  role(user, ['participant']);
  const id = int(body.id, '미션 번호', 1, 1e9);
  return transaction(() => {
    const campaign = openCampaign(id);
    assert(!get('SELECT 1 FROM submissions WHERE campaign_id=? AND user_id=?', id, user.id), '이미 제출한 미션입니다.', 409);
    const time = Date.now();
    run('DELETE FROM reservations WHERE campaign_id=? AND expires<=?', id, time);
    const prior = get('SELECT expires FROM reservations WHERE campaign_id=? AND user_id=?', id, user.id);
    if (prior) return { expires: prior.expires };
    assert(count(id) + countReserved(id, time) < campaign.goal, '참여 가능 인원이 찼습니다. 잠시 후 다시 확인해 주세요.', 409);
    const deadline = Date.parse(campaign.end_date + 'T23:59:59.999+09:00') + 1;
    const expires = Math.min(time + reservationMinutes * 60_000, deadline);
    assert(expires > time, '미션 기간이 종료되었습니다.', 409);
    run('INSERT INTO reservations VALUES (?,?,?)', id, user.id, expires);
    return { expires };
  });
}

function submitMission(user, body) {
  role(user, ['participant']);
  const id = int(body.id, '미션 번호', 1, 1e9);
  return transaction(() => {
    const prior = get('SELECT id,status FROM submissions WHERE campaign_id=? AND user_id=?', id, user.id);
    if (prior) return { status: prior.status };
    const campaign = openCampaign(id);
    assert(get('SELECT 1 FROM reservations WHERE campaign_id=? AND user_id=? AND expires>?', id, user.id, Date.now()),
      '참여 자리가 만료됐거나 예약되지 않았습니다. 다시 참여해 주세요.', 409);
    const isQuiz = campaign.kind === 'quiz';
    const answer = isQuiz ? int(body.response, '정답', 0, 2) : str(body.response, '응답', 1000, 10);
    const status = !isQuiz ? 'pending' : answer === campaign.answer ? 'approved' : 'rejected';
    const sid = Number(run('INSERT INTO submissions(campaign_id,user_id,response,status,reason,created) VALUES (?,?,?,?,?,?)', id, user.id, isQuiz ? JSON.parse(campaign.choices)[answer] : answer, status, status === 'rejected' ? '퀴즈 정답과 일치하지 않습니다.' : '', now()).lastInsertRowid);
    run('DELETE FROM reservations WHERE campaign_id=? AND user_id=?', id, user.id);
    if (status === 'approved') {
      rewardSubmission(sid, user.id, campaign);
      if (count(id, true) >= campaign.goal) finishCampaign(campaign, '목표 건수 달성');
    }
    return { status };
  });
}

function reviewMission(user, body) {
  role(user, ['admin']);
  const id = int(body.id, '제출 번호', 1, 1e9);
  assert(['approve', 'reject'].includes(body.action), '검수 유형을 확인해 주세요.');
  return transaction(() => {
    const submission = get('SELECT * FROM submissions WHERE id=?', id);
    assert(submission?.status === 'pending', '이미 처리된 제출입니다.', 409);
    const status = body.action === 'approve' ? 'approved' : 'rejected';
    const reason = status === 'rejected' ? str(body.reason, '반려 사유', 200) : '';
    run('UPDATE submissions SET status=?,reason=? WHERE id=?', status, reason, id);
    const campaign = get('SELECT * FROM campaigns WHERE id=?', submission.campaign_id);
    if (status === 'approved') rewardSubmission(id, submission.user_id, campaign);
    audit(user.id, '미션 검수', id, status);
    const approved = count(campaign.id, true);
    if (approved >= campaign.goal) finishCampaign(campaign, '목표 건수 달성', user.id);
    else if (campaign.end_date < dateKst() && count(campaign.id) === approved) finishCampaign(campaign, '집행 기간 종료');
    return {};
  });
}

function createInquiry(user, body) {
  const subject = str(body.subject, '제목', 80, 3);
  const message = str(body.message, '문의 내용', 1200, 10);
  const email = str(body.email, '이메일', 120, 0);
  assert(!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), '올바른 이메일 주소를 입력해 주세요.');
  const key = str(body.key, '요청 키', 64);
  const sender = user?.id ?? null;
  return transaction(() => {
    const existing = get('SELECT * FROM inquiries WHERE request_key=?', key);
    if (existing) {
      assert(existing.user_id === sender && existing.subject === subject && existing.message === message && existing.email === email, '이미 접수된 요청입니다.', 409);
      return { id: existing.id };
    }
    const id = Number(run('INSERT INTO inquiries(user_id,subject,message,email,created,request_key) VALUES (?,?,?,?,?,?)', sender, subject, message, email, now(), key).lastInsertRowid);
    return { id };
  });
}

function reviewInquiry(user, body) {
  role(user, ['admin']);
  const id = int(body.id, '문의 번호', 1, 1e9);
  return transaction(() => {
    const item = get('SELECT reviewed FROM inquiries WHERE id=?', id);
    assert(item, '문의 내역을 찾을 수 없습니다.', 404);
    if (!item.reviewed) {
      run('UPDATE inquiries SET reviewed=? WHERE id=?', now(), id);
      audit(user.id, '문의 확인', id);
    }
    return {};
  });
}

const routes = {
  '/api/login': (req, res, user, body) => authenticate(req, res, body),
  '/api/demo': (req, res, user, body) => {
    assert(demo && roles.includes(body.role), '테스트 로그인을 사용할 수 없습니다.', 403);
    return login(req, res, get('SELECT * FROM users WHERE username=? AND is_demo=1', `demo.${body.role}`));
  },
  '/api/logout': (req, res) => {
    if (cookie(req)) run('DELETE FROM sessions WHERE token=?', digest(cookie(req)));
    res.setHeader('Set-Cookie', 'adsform=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    return {};
  },
  '/api/account': (_req, _res, user, body) => newAccount(user, body),
  '/api/charge': (_req, _res, user, body) => requestCharge(user, body),
  '/api/charge/decision': (_req, _res, user, body) => decideCharge(user, body),
  '/api/campaign': (_req, _res, user, body) => createCampaign(user, body),
  '/api/campaign/decision': (_req, _res, user, body) => decideCampaign(user, body),
  '/api/mission/reserve': (_req, _res, user, body) => reserveMission(user, body),
  '/api/mission': (_req, _res, user, body) => submitMission(user, body),
  '/api/mission/review': (_req, _res, user, body) => reviewMission(user, body),
  '/api/inquiry': (_req, _res, user, body) => createInquiry(user, body),
  '/api/inquiry/review': (_req, _res, user, body) => reviewInquiry(user, body),
  '/api/background': (_req, _res, user, body) => {
    role(user, ['admin']);
    assert(backgrounds.includes(body.value), '등록된 배경을 선택해 주세요.');
    return transaction(() => {
      setSetting('background', body.value);
      audit(user.id, '배경 변경', body.value);
      return {};
    });
  },
  '/api/rates': (_req, _res, user, body) => {
    role(user, ['admin']);
    return transaction(() => {
      if (body.operator_id) {
        const id = int(body.operator_id, '실행사', 1, 1e9);
        assert(get("SELECT id FROM users WHERE role='operator' AND id=?", id), '실행사를 찾을 수 없습니다.', 404);
        const value = body.rate === '' ? null : rate(body.rate);
        run('UPDATE users SET rate=? WHERE id=?', value, id);
        audit(user.id, '실행사 수익률 변경', id, value === null ? '기본값 적용' : String(value / 100));
      } else {
        const value = rate(body.rate);
        setSetting('default_rate', value);
        audit(user.id, '기본 수익률 변경', 'default', String(value / 100));
      }
      return {};
    });
  }
};

async function payload(req) {
  assert(req.headers['content-type']?.split(';')[0] === 'application/json', 'JSON 요청이 필요합니다.', 415);
  const parts = [];
  let bytes = 0;
  for await (const part of req) {
    bytes += part.length;
    assert(bytes <= 32768, '요청 크기 제한을 초과했습니다.', 413);
    parts.push(part);
  }
  try {
    const data = JSON.parse(Buffer.concat(parts).toString());
    assert(data && typeof data === 'object' && !Array.isArray(data), '잘못된 요청입니다.');
    return data;
  } catch {
    fail(400, '잘못된 요청입니다.');
  }
}

const headers = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
};
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const pages = ['/', '/login', '/missions', '/account', '/manage'];

function json(res, status, data) {
  res.writeHead(status, { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

const server = createServer(async (req, res) => {
  try {
    const host = req.headers.host;
    assert([ `127.0.0.1:${port}`, `localhost:${port}` ].includes(host), '로컬 주소로 접속해 주세요.', 403);
    const url = new URL(req.url, `http://${host}`);
    if (url.pathname === '/api/state' && req.method === 'GET') return json(res, 200, summary(session(req)));
    if (req.method === 'POST' && Object.hasOwn(routes, url.pathname)) {
      assert(req.headers.origin === `http://${host}`, '같은 사이트에서 요청해 주세요.', 403);
      const body = await payload(req);
      return json(res, 200, routes[url.pathname](req, res, session(req), body));
    }
    if (['GET', 'HEAD'].includes(req.method)) {
      const pathname = pages.includes(url.pathname) ? '/index.html' : url.pathname;
      const allowed = ['/index.html', '/app.js', '/styles.css', '/icon.svg'].includes(pathname) || /^\/assets\/[a-z-]+\.(jpg|webp)$/.test(pathname);
      if (allowed) {
        let data;
        try { data = readFileSync(resolve(root, 'public', pathname.slice(1))); } catch (error) {
          if (error.code === 'ENOENT') fail(404, '파일을 찾을 수 없습니다.');
          throw error;
        }
        if (pathname === '/index.html') {
          const origin = shareOrigin?.origin || `http://${host}`;
          const page = pages.includes(url.pathname) ? url.pathname : '/';
          data = data.toString('utf8')
            .replaceAll('__ADSFORM_SHARE_ORIGIN__', origin)
            .replace('__ADSFORM_PAGE_URL__', origin + page);
        }
        res.writeHead(200, { ...headers, 'Content-Type': mime[extname(pathname)], 'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=3600' : 'no-cache' });
        return res.end(req.method === 'HEAD' ? undefined : data);
      }
    }
    fail(404, '페이지를 찾을 수 없습니다.');
  } catch (error) {
    if (!error.status) console.error(error);
    if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : '요청 처리 중 오류가 발생했습니다.' });
  }
});
setInterval(() => {
  try { expireCampaigns(); } catch (error) { console.error(error); }
}, 60_000).unref();
server.listen(port, '127.0.0.1', () => console.log(`Adsform  http://127.0.0.1:${port}`));
