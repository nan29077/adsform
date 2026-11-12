import { createServer } from 'node:http';
import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { setupOfferwall } from './offerwall.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.ADSFORM_PORT || 3063);
const bindHost = process.env.ADSFORM_HOST || '127.0.0.1';
const trustProxy = process.env.ADSFORM_TRUST_PROXY === '1';
const shareOrigin = process.env.ADSFORM_PUBLIC_ORIGIN ? new URL(process.env.ADSFORM_PUBLIC_ORIGIN) : null;
if (shareOrigin && (shareOrigin.protocol !== 'https:' || shareOrigin.href !== shareOrigin.origin + '/')) {
  throw new Error('ADSFORM_PUBLIC_ORIGIN must be an HTTPS origin, such as https://adsform.example');
}
// 공개 주소로 배포하면 명시적으로 ADSFORM_DEMO=1을 주지 않는 한 테스트 로그인을 끕니다.
const demo = process.env.ADSFORM_DEMO ? process.env.ADSFORM_DEMO !== '0' : !shareOrigin;
const minDwell = process.env.ADSFORM_MIN_DWELL !== undefined
  ? { quiz: Number(process.env.ADSFORM_MIN_DWELL), survey: Number(process.env.ADSFORM_MIN_DWELL) }
  : { quiz: 3, survey: 10 };
const payoutMinimum = { reward: 5000, revenue: 10000 };
const payoutPendingLimit = 3;
const backupDays = Number(process.env.ADSFORM_BACKUP_DAYS ?? (demo ? 0 : 14));
const maxRate = 3000;
const pageSize = 20;
const dbPath = resolve(process.env.ADSFORM_DB || resolve(root, 'data', demo ? 'demo.sqlite' : 'adsform.sqlite'));
const roles = ['admin', 'advertiser', 'agency', 'operator', 'participant'];
const partners = ['advertiser', 'agency', 'operator'];
const backgrounds = ['grove', 'tide', 'lilac', 'sunset', 'night', 'studio', 'creator', 'city', 'showroom', 'growth'];
const products = { quiz: { cost: 500, reward: 150 }, survey: { cost: 900, reward: 300 } };
const reservationMinutes = 10;
const avatarCount = 30;
const avatarSize = 256;
const avatarLimit = 128 * 1024;
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
  CREATE TABLE IF NOT EXISTS user_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    avatar_variant INTEGER NOT NULL CHECK (avatar_variant BETWEEN 0 AND 29),
    avatar_image BLOB,
    avatar_version TEXT
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
  CREATE TABLE IF NOT EXISTS notices (
    id INTEGER PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, audience TEXT NOT NULL DEFAULT 'all',
    pinned INTEGER NOT NULL DEFAULT 0, author INTEGER REFERENCES users(id), created TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS payouts (
    id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), wallet TEXT NOT NULL, amount INTEGER NOT NULL,
    destination TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', reason TEXT NOT NULL DEFAULT '', created TEXT NOT NULL,
    decided TEXT, request_key TEXT NOT NULL, UNIQUE(user_id, request_key)
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), kind TEXT NOT NULL, title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '', link TEXT NOT NULL DEFAULT '', created TEXT NOT NULL, read TEXT
  );
  CREATE TABLE IF NOT EXISTS adjustments (
    id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), wallet TEXT NOT NULL, amount INTEGER NOT NULL,
    reason TEXT NOT NULL, actor INTEGER REFERENCES users(id), created TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id, id);
  CREATE INDEX IF NOT EXISTS submissions_user ON submissions(user_id, status);
  CREATE INDEX IF NOT EXISTS submissions_created ON submissions(created);
  CREATE INDEX IF NOT EXISTS ledger_user_wallet ON ledger(user_id, wallet, created);
  INSERT OR IGNORE INTO settings VALUES ('background', 'grove'), ('default_rate', '750');
`);
for (const [table, column, definition] of [
  ['campaigns', 'daily_cap', 'INTEGER'],
  ['campaigns', 'memo', "TEXT NOT NULL DEFAULT ''"],
  ['users', 'status', "TEXT NOT NULL DEFAULT 'active'"],
  ['users', 'must_change', 'INTEGER NOT NULL DEFAULT 0'],
  ['users', 'created', 'TEXT'],
  ['users', 'agreed', 'TEXT'],
  ['charges', 'reason', "TEXT NOT NULL DEFAULT ''"],
  ['charges', 'vat', 'INTEGER NOT NULL DEFAULT 0'],
  ['submissions', 'decided', 'TEXT'],
  ['reservations', 'created', 'INTEGER'],
  ['inquiries', 'reply', "TEXT NOT NULL DEFAULT ''"],
  ['inquiries', 'replied', 'TEXT'],
  ['notices', 'updated', 'TEXT'],
  ['users', 'last_login', 'TEXT']
]) {
  if (!db.prepare(`PRAGMA table_info(${table})`).all().some(item => item.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
db.exec(`UPDATE submissions SET decided=created WHERE decided IS NULL AND status<>'pending';
  UPDATE charges SET vat=CAST(ROUND(amount*0.1) AS INTEGER) WHERE vat=0;`);

const get = (sql, ...params) => db.prepare(sql).get(...params);
const all = (sql, ...params) => db.prepare(sql).all(...params);
const run = (sql, ...params) => db.prepare(sql).run(...params);
const setting = key => get('SELECT value FROM settings WHERE key=?', key).value;
const setSetting = (key, value) => run('UPDATE settings SET value=? WHERE key=?', String(value), key);
const balance = (id, wallet) => get('SELECT COALESCE(SUM(amount),0) AS total FROM ledger WHERE user_id=? AND wallet=?', id, wallet).total;
const entry = (id, wallet, amount, kind, ref) => run('INSERT INTO ledger(user_id,wallet,amount,kind,ref,created) VALUES (?,?,?,?,?,?)', id, wallet, amount, kind, String(ref), now());
const audit = (actor, action, subject, detail = '') => run('INSERT INTO audit(actor,action,subject,detail,created) VALUES (?,?,?,?,?)', actor, action, String(subject), detail, now());
function notify(userId, kind, title, body = '', link = '') {
  if (userId) run('INSERT INTO notifications(user_id,kind,title,body,link,created) VALUES (?,?,?,?,?,?)', userId, kind, title, body, link, now());
}
const won = value => `${Number(value).toLocaleString('ko-KR')}원`;
const digest = token => createHash('sha256').update(token).digest('hex');
const clean = user => user && ({ id: user.id, name: user.name, username: user.username, role: user.role, parent_id: user.parent_id,
  must_change: Boolean(user.must_change), is_demo: Boolean(user.is_demo) });
const passHash = (password, salt = randomBytes(16).toString('hex')) => `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
const dummyHash = passHash(randomBytes(16).toString('hex'));
const checkPass = (password, saved) => timingSafeEqual(Buffer.from(passHash(password, saved.split(':')[0])), Buffer.from(saved));
const count = (campaign, onlyApproved = false) => get(`SELECT COUNT(*) AS total FROM submissions WHERE campaign_id=? AND status ${onlyApproved ? "='approved'" : "IN ('approved','pending')"}`, campaign).total;
const dayStart = (day = dateKst()) => new Date(Date.parse(day + 'T00:00:00+09:00')).toISOString();
const countToday = campaign => get("SELECT COUNT(*) AS total FROM submissions WHERE campaign_id=? AND status IN ('approved','pending') AND created>=?", campaign, dayStart()).total;
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

function addUser(username, name, password, role, parent = null, isDemo = 0, mustChange = 0) {
  return Number(run('INSERT INTO users(username,name,password,role,parent_id,is_demo,must_change,created) VALUES (?,?,?,?,?,?,?,?)', username, name, passHash(password), role, parent, isDemo, mustChange, now()).lastInsertRowid);
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
const shiftDay = (day, offset) => new Date(Date.parse(day + 'T00:00:00Z') + offset * 86_400_000).toISOString().slice(0, 10);
const kstStamp = (day, minutes) => new Date(Date.parse(day + 'T00:00:00+09:00') + minutes * 60_000).toISOString();

function seedDemoHistory() {
  let seed = 20261110;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = (min, max) => min + Math.floor(random() * (max - min + 1));
  const today = dateKst();
  const id = name => get('SELECT id FROM users WHERE username=?', name).id;
  const [admin, operator, agency, advertiser, participant] = ['demo.admin', 'demo.operator', 'demo.agency', 'demo.advertiser', 'demo.participant'].map(id);
  const shared = passHash(randomBytes(24).toString('hex'));
  run("UPDATE ledger SET created=? WHERE kind='opening'", kstStamp(shiftDay(today, -60), 540));
  const nicknames = ['하늘', '도윤', '서연', '민준', '지우', '하은', '시우', '수아', '예준', '지안', '은우', '서윤', '유준', '채원', '건우', '다인', '주원', '소율', '현우', '아린'];
  const people = [];
  const addPerson = db.prepare("INSERT INTO users(username,name,password,role,is_demo) VALUES (?,?,?,'participant',1)");
  for (let i = 1; i <= 180; i++) {
    people.push(Number(addPerson.run(`demo.u${String(i).padStart(3, '0')}`, `${nicknames[i % nicknames.length]}${String(i).padStart(3, '0')}`, shared).lastInsertRowid));
  }
  const ledgerAt = db.prepare('INSERT INTO ledger(user_id,wallet,amount,kind,ref,created) VALUES (?,?,?,?,?,?)');
  const auditAt = db.prepare('INSERT INTO audit(actor,action,subject,detail,created) VALUES (?,?,?,?,?)');
  const chargeAt = (user, amount, day, approved = true, operatorId = null) => {
    const rate = operatorId ? Number(setting('default_rate')) : 0;
    const commission = approved ? Math.floor(amount * rate / 10000) : 0;
    const charge = Number(run(`INSERT INTO charges(user_id,amount,vat,status,created,decided,operator_id,rate,commission,request_key) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      user, amount, Math.round(amount * 0.1), approved ? 'approved' : 'pending', kstStamp(day, 560), approved ? kstStamp(day, 640) : null, approved ? operatorId : null, approved ? rate : 0, commission, `seed-${user}-${day}-${amount}`).lastInsertRowid);
    if (!approved) return;
    ledgerAt.run(user, 'credit', amount, 'charge', String(charge), kstStamp(day, 640));
    if (commission) ledgerAt.run(operatorId, 'revenue', commission, 'commission', String(charge), kstStamp(day, 640));
    auditAt.run(admin, '충전 승인', String(charge), `${amount.toLocaleString('ko-KR')}원${commission ? ` · 실행사 수익 ${commission.toLocaleString('ko-KR')}원` : ''}`, kstStamp(day, 640));
  };
  chargeAt(advertiser, 500000, shiftDay(today, -45));
  chargeAt(advertiser, 300000, shiftDay(today, -9));
  chargeAt(agency, 400000, shiftDay(today, -15), true, operator);
  chargeAt(agency, 200000, shiftDay(today, -3), true, operator);
  chargeAt(agency, 100000, today, false);
  chargeAt(operator, 200000, shiftDay(today, -6));

  const plans = [
    { owner: advertiser, title: '가을 시즌 브랜드 퀴즈', mine: ['approved', -4], brand: '오후의 상점', kind: 'quiz', goal: 300, from: -13, to: 16, status: 'active', cap: 40, daily: [6, 14],
      details: '오후의 상점 가을 시즌 컬렉션 이야기를 읽고 퀴즈를 풀어보세요.', prompt: '오후의 상점 가을 컬렉션의 대표 소재는 무엇일까요?', choices: ['리넨', '가죽', '네오프렌'], memo: '인스타그램 이벤트와 동시 진행' },
    { owner: advertiser, title: '매장 방문 경험 설문', mine: ['pending', 0], brand: '오후의 상점', kind: 'survey', goal: 150, from: -10, to: 20, status: 'active', cap: 20, daily: [3, 8],
      details: '최근 오프라인 매장을 방문한 경험을 알려주세요.', prompt: '매장에서 가장 만족스러웠던 점과 아쉬웠던 점은 무엇인가요?', memo: '응답 내용은 매장 리뉴얼 회의 자료로 활용' },
    { owner: advertiser, title: '여름 신메뉴 인지도 퀴즈', mine: ['approved', -30], brand: '오후의 상점', kind: 'quiz', goal: 120, from: -40, to: -21, status: 'closed', reason: '목표 건수 달성', daily: [6, 9],
      details: '여름 시즌 음료 신메뉴에 관한 퀴즈입니다.', prompt: '여름 신메뉴에 사용된 과일은 무엇일까요?', choices: ['청귤', '사과', '배'] },
    { owner: advertiser, title: '연말 선물 선호도 조사', brand: '오후의 상점', kind: 'survey', goal: 200, from: 3, to: 30, status: 'pending', daily: [0, 0],
      details: '연말 선물로 받고 싶은 생활용품을 알려주세요.', prompt: '올해 연말에 받고 싶은 선물과 그 이유를 적어주세요.' },
    { owner: agency, title: '친환경 리필 스테이션 퀴즈', mine: ['rejected', -2], brand: '그린리필', kind: 'quiz', goal: 200, from: -7, to: 14, status: 'active', cap: 30, daily: [5, 12],
      details: '동네 리필 스테이션 이용 방법을 알아보는 퀴즈입니다.', prompt: '리필 스테이션을 이용할 때 꼭 챙겨야 하는 것은?', choices: ['세척한 빈 용기', '새 플라스틱 병', '종이컵'], memo: '그린리필 1차 캠페인' },
    { owner: agency, title: '반려동물 용품 구매 기준 설문', mine: ['approved', -8], brand: '펫앤홈', kind: 'survey', goal: 80, from: -12, to: 10, status: 'paused', daily: [2, 4],
      details: '반려동물 용품을 고르는 기준을 알려주세요.', prompt: '반려동물 용품을 살 때 가장 먼저 확인하는 것은 무엇인가요?' },
    { owner: operator, title: '그린웨이 브랜드 스토리 퀴즈', brand: '그린웨이', kind: 'quiz', goal: 100, from: -5, to: 25, status: 'active', daily: [4, 9],
      details: '그린웨이가 걸어온 친환경 포장 이야기를 확인해 보세요.', prompt: '그린웨이가 처음 선보인 포장재는 무엇일까요?', choices: ['재생지 완충재', '스티로폼', '비닐 에어캡'] }
  ];
  const survey = ['직원분들이 친절하게 안내해 주셔서 좋았고, 주말에는 대기 시간이 조금 길었습니다.', '진열이 깔끔해서 상품을 찾기 쉬웠어요. 가격표가 더 크게 보이면 좋겠습니다.',
    '매장 분위기가 편안해서 오래 머물렀습니다. 주차 공간이 부족한 점이 아쉬웠어요.', '신상품을 직접 만져볼 수 있어 좋았습니다. 계산대가 하나만 열려 있었어요.',
    '포장이 꼼꼼하고 선물용으로 좋았습니다. 영업시간이 조금 더 길었으면 합니다.', '재고가 넉넉해서 원하는 색상을 바로 살 수 있었어요. 화장실 안내가 부족했습니다.'];
  for (const plan of plans) {
    const { cost, reward } = products[plan.kind];
    const start = shiftDay(today, plan.from);
    const end = shiftDay(today, plan.to);
    const ordered = kstStamp(shiftDay(start < today ? start : today, start < today ? -2 : -1), 600);
    const campaign = Number(run(`INSERT INTO campaigns(owner_id,title,brand,kind,details,prompt,choices,answer,goal,cost,reward,start_date,end_date,status,reason,created,daily_cap,memo)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, plan.owner, plan.title, plan.brand, plan.kind, plan.details, plan.prompt, JSON.stringify(plan.choices || []),
      plan.kind === 'quiz' ? 0 : null, plan.goal, cost, reward, start, end, plan.status, plan.reason || '', ordered, plan.cap ?? null, plan.memo || '').lastInsertRowid);
    ledgerAt.run(plan.owner, 'credit', -cost * plan.goal, 'reserve', String(campaign), ordered);
    auditAt.run(plan.owner, '광고 주문 접수', String(campaign), '', ordered);
    if (plan.status !== 'pending') auditAt.run(admin, '캠페인 상태 변경', String(campaign), 'active', kstStamp(shiftDay(start, -1), 620));
    if (plan.mine) {
      const stamp = kstStamp(shiftDay(today, plan.mine[1]), 690);
      const quiz = plan.kind === 'quiz';
      const status = plan.mine[0];
      const submission = Number(run('INSERT INTO submissions(campaign_id,user_id,response,status,reason,created,decided) VALUES (?,?,?,?,?,?,?)', campaign, participant,
        quiz ? plan.choices[status === 'approved' ? 0 : 1] : '가격이 합리적이고 직원 응대가 친절했습니다. 매장 위치 안내가 더 있으면 좋겠어요.', status,
        status === 'rejected' ? '퀴즈 정답과 일치하지 않습니다.' : '', stamp, status === 'pending' ? null : stamp).lastInsertRowid);
      if (status === 'approved') ledgerAt.run(participant, 'reward', reward, 'mission', String(submission), stamp);
    }
    const pool = [...people].sort(() => random() - 0.5);
    let approved = plan.mine?.[0] === 'approved' ? 1 : 0;
    const last = plan.status === 'closed' ? plan.to : 0;
    for (let offset = plan.from; offset <= last && pool.length; offset++) {
      const day = shiftDay(today, offset);
      const volume = Math.min(pick(...plan.daily), plan.cap ?? Infinity, pool.length);
      for (let n = 0; n < volume && approved < plan.goal; n++) {
        const user = pool.pop();
        const stamp = offset === 0 ? new Date(Date.now() - pick(5, 600) * 60_000).toISOString() : kstStamp(day, pick(420, 1380));
        let status; let response; let reason = '';
        if (plan.kind === 'quiz') {
          const choice = random() < 0.86 ? 0 : pick(1, 2);
          response = plan.choices[choice];
          status = choice === 0 ? 'approved' : 'rejected';
          if (status === 'rejected') reason = '퀴즈 정답과 일치하지 않습니다.';
        } else {
          response = survey[pick(0, survey.length - 1)];
          status = offset >= -1 && plan.status === 'active' ? 'pending' : random() < 0.92 ? 'approved' : 'rejected';
          if (status === 'rejected') reason = '질문과 관련 없는 응답입니다.';
        }
        const submission = Number(run('INSERT INTO submissions(campaign_id,user_id,response,status,reason,created,decided) VALUES (?,?,?,?,?,?,?)', campaign, user, response, status, reason, stamp, status === 'pending' ? null : stamp).lastInsertRowid);
        if (status === 'approved') {
          approved++;
          ledgerAt.run(user, 'reward', reward, 'mission', String(submission), stamp);
        }
      }
    }
  }
  run("INSERT INTO notices(title,body,audience,pinned,author,created) VALUES (?,?,?,?,?,?)", '애즈폼 정식 오픈 안내', '브랜드 퀴즈·설문 캠페인 주문과 실시간 리포트를 이용할 수 있습니다. 문의는 우측 하단 문의하기를 이용해 주세요.', 'all', 1, admin, kstStamp(shiftDay(today, -14), 540));
  run("INSERT INTO notices(title,body,audience,pinned,author,created) VALUES (?,?,?,?,?,?)", '일일 모집 한도 기능 추가', '주문서에서 하루 최대 승인 건수를 정하면 캠페인 기간 동안 참여가 고르게 분배됩니다.', 'business', 0, admin, kstStamp(shiftDay(today, -2), 600));
  run("INSERT INTO notices(title,body,audience,pinned,author,created) VALUES (?,?,?,?,?,?)", '설문 검수 기준 안내', '질문과 관련 없는 답변, 의미 없는 반복 문자는 반려될 수 있어요. 성의 있는 답변을 남겨 주세요.', 'participant', 0, admin, kstStamp(shiftDay(today, -1), 600));
}

if (demo && !get("SELECT value FROM settings WHERE key='demo_history'") && get("SELECT id FROM users WHERE username='demo.admin'")) {
  transaction(() => {
    seedDemoHistory();
    run("INSERT INTO settings VALUES ('demo_history', ?)", dateKst());
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

function userProfile(userId) {
  let profile = get('SELECT avatar_variant, avatar_version FROM user_profiles WHERE user_id=?', userId);
  if (!profile) {
    run('INSERT OR IGNORE INTO user_profiles (user_id, avatar_variant) VALUES (?,?)', userId, randomInt(avatarCount));
    profile = get('SELECT avatar_variant, avatar_version FROM user_profiles WHERE user_id=?', userId);
  }
  return { variant: profile.avatar_variant, version: profile.avatar_version };
}

function isAvatarJpeg(image) {
  if (image.length < 16 || image.readUInt16BE(0) !== 0xffd8 || image.readUInt16BE(image.length - 2) !== 0xffd9) return false;
  for (let offset = 2; offset + 4 <= image.length;) {
    const marker = image.readUInt16BE(offset);
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return false;
    const length = image.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > image.length) return false;
    if (marker === 0xffc0 || marker === 0xffc2) {
      return length >= 8 && image.readUInt16BE(offset + 5) === avatarSize && image.readUInt16BE(offset + 7) === avatarSize;
    }
    offset += 2 + length;
  }
  return false;
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
  return int(Math.round(Number(value) * 100), '수익률(%) × 100', 0, maxRate);
}

/* ---------- 요청 제한 ---------- */
const buckets = new Map();
const hits = (key, windowMs) => (buckets.get(key) || []).filter(time => Date.now() - time < windowMs).length;
function hit(key, windowMs) {
  const list = (buckets.get(key) || []).filter(time => Date.now() - time < windowMs);
  list.push(Date.now());
  buckets.set(key, list);
}
function limit(key, max, windowMs, message = '요청이 많습니다. 잠시 후 다시 시도해 주세요.') {
  assert(hits(key, windowMs) < max, message, 429);
  hit(key, windowMs);
}
setInterval(() => {
  const cutoff = Date.now() - 3600_000;
  for (const [key, list] of buckets) if (!list.length || list.at(-1) < cutoff) buckets.delete(key);
}, 600_000).unref();
// X-Forwarded-For의 앞쪽 값은 접속자가 마음대로 넣을 수 있으므로, 신뢰하는 프록시가 마지막에 덧붙인 값만 씁니다.
const forwardedIp = req => String(req.headers['x-forwarded-for'] || '').split(',').map(item => item.trim()).filter(Boolean).at(-1);
const clientIp = req => (trustProxy && forwardedIp(req)) || req.socket.remoteAddress || 'unknown';

/* ---------- 세션 ---------- */
const sessionHours = 8;
const cookieName = 'adsform';
const setCookie = (req, res, value, maxAge) =>
  res.setHeader('Set-Cookie', `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${req.site?.secure ? '; Secure' : ''}`);

function login(req, res, user) {
  assert(user.status === 'active', '이용이 정지된 계정입니다. 운영팀에 문의해 주세요.', 403);
  const old = cookie(req);
  if (old) run('DELETE FROM sessions WHERE token=?', digest(old));
  run('DELETE FROM sessions WHERE expires < ?', Date.now());
  const token = randomBytes(32).toString('hex');
  run('INSERT INTO sessions VALUES (?,?,?)', digest(token), user.id, Date.now() + sessionHours * 3600_000);
  run('UPDATE users SET last_login=? WHERE id=?', now(), user.id);
  setCookie(req, res, token, sessionHours * 3600);
  return { user: clean(user) };
}

const cookie = req => req.headers.cookie?.match(/(?:^|;\s*)adsform=([a-f0-9]{64})(?:;|$)/)?.[1];
function session(req, res) {
  const token = cookie(req);
  if (!token) return null;
  const row = get('SELECT users.*, sessions.expires AS session_expires FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?', digest(token), Date.now());
  if (!row || row.status !== 'active' || (row.is_demo && !demo)) return null;
  // 사용 중인 세션은 남은 시간이 절반 아래로 내려가면 연장합니다.
  if (res && row.session_expires - Date.now() < sessionHours * 1800_000) {
    run('UPDATE sessions SET expires=? WHERE token=?', Date.now() + sessionHours * 3600_000, digest(token));
    setCookie(req, res, token, sessionHours * 3600);
  }
  return row;
}

function authenticate(req, res, body) {
  const username = str(body.username, '아이디', 32).toLowerCase();
  const password = str(body.password, '비밀번호', 128);
  limit(`login-ip:${clientIp(req)}`, 30, 60_000, '로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.');
  const failKey = `login-fail:${username}`;
  assert(hits(failKey, 15 * 60_000) < 10, '비밀번호를 여러 번 틀려 15분간 로그인이 제한됩니다.', 429);
  const user = get('SELECT * FROM users WHERE username=?', username);
  // 없는 아이디도 같은 시간이 걸리도록 비밀번호 검사를 한 번 수행합니다.
  const matched = checkPass(password, user && !user.is_demo ? user.password : dummyHash);
  if (!(user && !user.is_demo && matched)) {
    hit(failKey, 15 * 60_000);
    fail(401, '아이디 또는 비밀번호를 확인해 주세요.');
  }
  buckets.delete(failKey);
  return login(req, res, user);
}

function accountFields(body) {
  const username = str(body.username, '아이디', 32, 4).toLowerCase();
  assert(/^[a-z0-9][a-z0-9._-]+$/.test(username) && !/^(demo|withdrawn)\./.test(username), '아이디는 영문 소문자, 숫자, 점, 밑줄, 하이픈을 사용할 수 있습니다.');
  const name = str(body.name, '이름', 60);
  return { username, name, password: newPassword(body.password) };
}

function newPassword(value, label = '비밀번호') {
  const password = str(value, label, 128, 10);
  assert(/[a-zA-Z]/.test(password) && /\d/.test(password), `${label}에는 영문과 숫자를 함께 넣어 주세요.`);
  return password;
}

function newAccount(actor, body) {
  role(actor, ['admin', 'operator']);
  const targetRole = actor.role === 'operator' ? 'agency' : body.role;
  assert(roles.includes(targetRole) && targetRole !== 'admin', '등록할 계정 유형을 확인해 주세요.');
  const { username, name, password } = accountFields(body);
  let parent = actor.role === 'operator' ? actor.id : null;
  if (actor.role === 'admin' && targetRole === 'agency' && body.parent_id) {
    parent = int(body.parent_id, '실행사', 1, 1e9);
    assert(get("SELECT id FROM users WHERE id=? AND role='operator'", parent), '실행사 계정을 선택해 주세요.');
  }
  return transaction(() => {
    assert(!get('SELECT id FROM users WHERE username=?', username), '이미 사용 중인 아이디입니다.', 409);
    const id = addUser(username, name, password, targetRole, parent, 0, 1);
    audit(actor.id, '계정 등록', id, targetRole);
    return { id };
  });
}

function signup(req, res, body) {
  assert(['participant', 'advertiser'].includes(body.role), '가입할 계정 유형을 선택해 주세요.');
  assert(body.agree === true || body.agree === '1' || body.agree === 'on', '이용약관과 개인정보처리방침에 동의해 주세요.');
  const { username, name, password } = accountFields(body);
  limit(`signup:${clientIp(req)}`, 5, 3600_000, '가입 요청이 많습니다. 잠시 후 다시 시도해 주세요.');
  return transaction(() => {
    assert(!get('SELECT id FROM users WHERE username=?', username), '이미 사용 중인 아이디입니다.', 409);
    const id = addUser(username, name, password, body.role);
    run('UPDATE users SET agreed=? WHERE id=?', now(), id);
    audit(id, '회원가입', id, body.role);
    return login(req, res, get('SELECT * FROM users WHERE id=?', id));
  });
}

function changePassword(req, user, body) {
  role(user, roles);
  assert(!user.is_demo, '테스트 계정은 비밀번호를 바꿀 수 없습니다.', 403);
  const current = str(body.current, '현재 비밀번호', 128);
  const next = newPassword(body.password, '새 비밀번호');
  assert(checkPass(current, user.password), '현재 비밀번호가 일치하지 않습니다.');
  assert(current !== next, '새 비밀번호는 현재 비밀번호와 달라야 합니다.');
  return transaction(() => {
    run('UPDATE users SET password=?, must_change=0 WHERE id=?', passHash(next), user.id);
    run('DELETE FROM sessions WHERE user_id=? AND token<>?', user.id, digest(cookie(req)));
    audit(user.id, '비밀번호 변경', user.id);
    return {};
  });
}

function updateProfile(user, body) {
  role(user, roles);
  assert(!user.is_demo, '테스트 계정은 이름을 바꿀 수 없습니다.', 403);
  const name = str(body.name, '이름', 60);
  run('UPDATE users SET name=? WHERE id=?', name, user.id);
  return {};
}

function updateAccount(actor, body) {
  role(actor, ['admin', 'operator']);
  const id = int(body.id, '계정 번호', 1, 1e9);
  const actions = actor.role === 'admin' ? ['suspend', 'activate', 'reset_password', 'rename', 'parent'] : ['suspend', 'activate', 'reset_password'];
  assert(actions.includes(body.action), '처리할 수 없는 요청입니다.');
  return transaction(() => {
    const target = get('SELECT * FROM users WHERE id=?', id);
    assert(target && target.role !== 'admin' && (actor.role === 'admin' || (target.role === 'agency' && target.parent_id === actor.id)), '계정을 찾을 수 없습니다.', 404);
    assert(!target.is_demo, '테스트 계정은 변경할 수 없습니다.', 403);
    assert(target.status !== 'withdrawn', '탈퇴한 계정은 변경할 수 없습니다.', 409);
    let detail = body.action;
    if (body.action === 'suspend') {
      run("UPDATE users SET status='suspended' WHERE id=?", id);
      run('DELETE FROM sessions WHERE user_id=?', id);
    } else if (body.action === 'activate') {
      run("UPDATE users SET status='active' WHERE id=?", id);
    } else if (body.action === 'reset_password') {
      run('UPDATE users SET password=?, must_change=1 WHERE id=?', passHash(newPassword(body.password, '임시 비밀번호')), id);
      run('DELETE FROM sessions WHERE user_id=?', id);
    } else if (body.action === 'rename') {
      const name = str(body.name, '이름', 60);
      run('UPDATE users SET name=? WHERE id=?', name, id);
      detail = name;
    } else {
      assert(target.role === 'agency', '대행사만 소속을 바꿀 수 있습니다.');
      const parent = body.parent_id ? int(body.parent_id, '실행사', 1, 1e9) : null;
      assert(!parent || get("SELECT id FROM users WHERE id=? AND role='operator'", parent), '실행사 계정을 선택해 주세요.');
      run('UPDATE users SET parent_id=? WHERE id=?', parent, id);
      detail = parent ? `parent ${parent}` : 'parent none';
    }
    audit(actor.id, '계정 변경', id, detail);
    return {};
  });
}

function publicCampaigns(user) {
  const today = dateKst();
  const time = Date.now();
  const rows = all(`SELECT c.id,c.title,c.brand,c.kind,c.details,c.prompt,c.choices,c.reward,c.goal,c.start_date,c.end_date,c.daily_cap,
    (SELECT COUNT(*) FROM submissions WHERE campaign_id=c.id AND status IN ('pending','approved')) AS used,
    (SELECT COUNT(*) FROM submissions WHERE campaign_id=c.id AND status IN ('pending','approved') AND created>=?) AS usedToday,
    (SELECT status FROM submissions WHERE campaign_id=c.id AND user_id=?) AS mine,
    (SELECT COUNT(*) FROM reservations WHERE campaign_id=c.id AND expires>?) AS reserved,
    (SELECT expires FROM reservations WHERE campaign_id=c.id AND user_id=? AND expires>?) AS reservedUntil
    FROM campaigns c WHERE c.status='active' AND c.start_date<=? AND c.end_date>=?
      AND (? OR c.owner_id IS NOT NULL) ORDER BY c.id DESC`, dayStart(today), user?.id || 0, time, user?.id || 0, time, today, today, Number(demo));
  return rows.map(({ usedToday, ...row }) => ({
    ...row, prompt: row.reservedUntil ? row.prompt : '', choices: row.reservedUntil ? JSON.parse(row.choices) : [],
    remaining: Math.max(0, Math.min(row.goal - row.used, row.daily_cap ? row.daily_cap - usedToday : Infinity) - row.reserved)
  }));
}

const recentDays = n => Array.from({ length: n }, (_, i) => shiftDay(dateKst(), i - n + 1));

// 제출 상태는 제출일 기준, 집행액·보상은 승인 처리일 기준으로 모읍니다.
function campaignTrend(where, params, n = 31) {
  const since = dayStart(shiftDay(dateKst(), -n + 1));
  const rows = all(`SELECT date(s.created,'+9 hours') AS day, SUM(s.status='approved') AS approved, SUM(s.status='pending') AS pending,
    SUM(s.status='rejected') AS rejected FROM submissions s JOIN campaigns c ON c.id=s.campaign_id WHERE s.created>=? AND (${where}) GROUP BY day`, since, ...params);
  const money = all(`SELECT date(s.decided,'+9 hours') AS day, SUM(c.cost) AS spend, SUM(c.reward) AS rewards
    FROM submissions s JOIN campaigns c ON c.id=s.campaign_id WHERE s.status='approved' AND s.decided>=? AND (${where}) GROUP BY day`, since, ...params);
  const map = new Map(rows.map(row => [row.day, row]));
  const spend = new Map(money.map(row => [row.day, row]));
  return recentDays(n).map(day => ({ day, approved: 0, pending: 0, rejected: 0, ...map.get(day), spend: spend.get(day)?.spend || 0, rewards: spend.get(day)?.rewards || 0 }));
}

function dailySum(sql, params, n = 31) {
  const map = new Map(all(sql, dayStart(shiftDay(dateKst(), -n + 1)), ...params).map(row => [row.day, row.total]));
  return recentDays(n).map(day => ({ day, total: map.get(day) || 0 }));
}

const audienceFor = user => !user ? ['all'] : user.role === 'admin' ? ['all', 'business', 'participant'] : user.role === 'participant' ? ['all', 'participant'] : ['all', 'business'];

const ledgerMemo = `CASE
    WHEN l.kind IN ('reserve','release') THEN (SELECT title FROM campaigns WHERE id=CAST(l.ref AS INTEGER))
    WHEN l.kind='mission' THEN (SELECT c.title FROM submissions s JOIN campaigns c ON c.id=s.campaign_id WHERE s.id=CAST(l.ref AS INTEGER))
    WHEN l.kind='commission' THEN (SELECT u.name || ' · 충전 #' || ch.id FROM charges ch JOIN users u ON u.id=ch.user_id WHERE ch.id=CAST(l.ref AS INTEGER))
    WHEN l.kind='charge' THEN '충전 #' || l.ref
    WHEN l.kind IN ('payout','payout_return') THEN '출금 신청 #' || l.ref
    WHEN l.kind IN ('ow_reserve','ow_release') THEN (SELECT '오퍼월 · ' || title FROM ow_offers WHERE id=CAST(l.ref AS INTEGER))
    WHEN l.kind='opening' THEN '데모 시작 잔액'
    WHEN l.kind='adjust' THEN (SELECT '운영 조정 · ' || reason FROM adjustments WHERE id=CAST(l.ref AS INTEGER))
    ELSE l.ref END`;
const ledgerRowsSql = `SELECT * FROM (SELECT l.id,l.wallet,l.amount,l.kind,l.ref,l.created,${ledgerMemo} AS memo,
    SUM(l.amount) OVER (PARTITION BY l.wallet ORDER BY l.created, l.id) AS after
    FROM ledger l WHERE l.user_id=? AND l.wallet=?) ORDER BY created DESC, id DESC`;

function ledgerPage(user, wallet, page) {
  role(user, roles);
  assert(['credit', 'revenue', 'reward'].includes(wallet), '지갑을 확인해 주세요.');
  const totals = get(`SELECT COUNT(*) AS count, COALESCE(SUM(CASE WHEN amount>0 THEN amount END),0) AS income,
    COALESCE(-SUM(CASE WHEN amount<0 THEN amount END),0) AS outgo FROM ledger WHERE user_id=? AND wallet=?`, user.id, wallet);
  const pages = Math.max(1, Math.ceil(totals.count / pageSize));
  const current = Math.min(page, pages);
  return { ...totals, page: current, pages, balance: balance(user.id, wallet),
    items: all(`${ledgerRowsSql} LIMIT ? OFFSET ?`, user.id, wallet, pageSize, (current - 1) * pageSize) };
}

const campaignColumns = `c.id,c.title,c.brand,c.kind,c.details,c.prompt,c.choices,c.answer,c.goal,c.cost,c.reward,c.start_date,c.end_date,c.status,c.reason,c.created,
  c.daily_cap,c.memo,c.owner_id,u.name AS owner,
  (SELECT COUNT(*) FROM submissions WHERE campaign_id=c.id AND status='approved') AS approved,
  (SELECT COUNT(*) FROM submissions WHERE campaign_id=c.id AND status='pending') AS reviewing,
  (SELECT COUNT(*) FROM submissions WHERE campaign_id=c.id AND status='rejected') AS rejected,
  (SELECT COUNT(*) FROM submissions WHERE campaign_id=c.id AND status IN ('approved','pending') AND created>=?) AS today,
  (SELECT COUNT(*) FROM reservations WHERE campaign_id=c.id AND expires>?) AS reserved,
  COALESCE((SELECT amount FROM ledger WHERE user_id=c.owner_id AND wallet='credit' AND kind='release' AND ref=CAST(c.id AS TEXT)),0) AS returned`;
const campaignRows = (where, param) => all(`SELECT ${campaignColumns} FROM campaigns c LEFT JOIN users u ON c.owner_id=u.id WHERE ${where} ORDER BY c.id DESC`, dayStart(), Date.now(), param);

function summary(user) {
  expireCampaigns();
  const result = { user: clean(user), demo, background: setting('background'), products, missions: publicCampaigns(user), date: dateKst(), reservationMinutes, payoutMinimum, maxRate };
  const audience = audienceFor(user);
  result.notices = all(`SELECT id,title,body,audience,pinned,created,updated FROM notices WHERE audience IN (${audience.map(() => '?').join(',')})
    ORDER BY pinned DESC, id DESC LIMIT 20`, ...audience);
  if (!user) return result;
  result.user.avatar = userProfile(user.id);
  result.ledger = ['credit', 'revenue', 'reward'].flatMap(wallet => all(`${ledgerRowsSql} LIMIT 30`, user.id, wallet));
  result.balances = Object.fromEntries(['credit', 'revenue', 'reward'].map(wallet => [wallet, balance(user.id, wallet)]));
  result.notifications = all('SELECT id,kind,title,body,link,created,read FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 30', user.id);
  result.unreadNotifications = get('SELECT COUNT(*) AS total FROM notifications WHERE user_id=? AND read IS NULL', user.id).total;
  result.myInquiries = all('SELECT id,subject,message,created,reviewed,reply,replied FROM inquiries WHERE user_id=? ORDER BY id DESC LIMIT 30', user.id);
  if (user.role === 'participant' || user.role === 'operator') {
    result.payouts = all('SELECT id,wallet,amount,destination,status,reason,created,decided FROM payouts WHERE user_id=? ORDER BY id DESC LIMIT 50', user.id);
  }
  if (user.role === 'participant') {
    result.submissions = all('SELECT s.id,s.status,s.reason,s.created,s.response,c.title,c.kind,c.brand,c.reward FROM submissions s JOIN campaigns c ON s.campaign_id=c.id WHERE s.user_id=? ORDER BY s.created DESC, s.id DESC', user.id);
    result.trend = dailySum(`SELECT date(created,'+9 hours') AS day, SUM(amount) AS total FROM ledger
      WHERE created>=? AND user_id=? AND wallet='reward' AND kind='mission' GROUP BY day`, [user.id], 14);
  }
  if (partners.includes(user.role) || user.role === 'admin') {
    const admin = user.role === 'admin';
    const scope = admin ? '(c.owner_id IS NOT NULL OR ?)' : 'c.owner_id=?';
    const scopeParam = admin ? Number(demo) : user.id;
    result.campaigns = campaignRows(scope, scopeParam);
    result.charges = all(`SELECT c.id,c.user_id,c.amount,c.vat,c.status,c.reason,c.created,c.decided,c.rate,c.commission,u.name AS owner,u.role AS ownerRole,o.name AS operator
      FROM charges c JOIN users u ON c.user_id=u.id LEFT JOIN users o ON c.operator_id=o.id
      WHERE ? OR c.user_id=? OR c.operator_id=? ORDER BY c.id DESC`, Number(admin), user.id, user.role === 'operator' ? user.id : -1);
    result.trend = campaignTrend(scope, [scopeParam]);
  }
  if (user.role === 'operator') {
    result.agencies = all(`SELECT u.id,u.name,u.username,u.status,u.is_demo,u.parent_id,
      COALESCE((SELECT SUM(amount) FROM charges WHERE user_id=u.id AND status='approved'),0) AS charged,
      COALESCE((SELECT SUM(commission) FROM charges WHERE user_id=u.id AND status='approved' AND operator_id=?),0) AS commission,
      (SELECT COUNT(*) FROM charges WHERE user_id=u.id AND status='pending') AS pendingCharges,
      (SELECT COUNT(*) FROM campaigns WHERE owner_id=u.id) AS campaigns,
      (SELECT COUNT(*) FROM campaigns WHERE owner_id=u.id AND status='active') AS activeCampaigns,
      (SELECT MAX(decided) FROM charges WHERE user_id=u.id AND status='approved') AS lastCharge
      FROM users u WHERE u.parent_id=? AND u.role='agency' ORDER BY u.id DESC`, user.id, user.id);
    result.agencyCampaigns = campaignRows("c.owner_id IN (SELECT id FROM users WHERE parent_id=? AND role='agency')", user.id);
    result.rate = user.rate ?? Number(setting('default_rate'));
    result.revenueTrend = dailySum(`SELECT date(created,'+9 hours') AS day, SUM(amount) AS total FROM ledger
      WHERE created>=? AND user_id=? AND wallet='revenue' AND kind='commission' GROUP BY day`, [user.id], 31);
  }
  if (user.role === 'admin') {
    const visible = 'u.username NOT GLOB \'demo.u[0-9]*\'';
    result.defaultRate = Number(setting('default_rate'));
    result.accounts = all(`SELECT u.id,u.name,u.username,u.role,u.rate,u.status,u.is_demo,u.parent_id,u.created,u.last_login,p.name AS parent,
      COALESCE((SELECT SUM(amount) FROM ledger WHERE user_id=u.id AND wallet='credit'),0) AS credit
      FROM users u LEFT JOIN users p ON u.parent_id=p.id WHERE (? OR u.is_demo=0) AND ${visible} ORDER BY u.id DESC`, Number(demo));
    result.roleCounts = Object.fromEntries(all('SELECT role, COUNT(*) AS total FROM users WHERE ? OR is_demo=0 GROUP BY role', Number(demo)).map(row => [row.role, row.total]));
    result.submissions = all(`SELECT s.id,s.status,s.created,s.response,s.reason,c.id AS campaign,c.title,c.kind,c.reward,u.name FROM submissions s
      JOIN campaigns c ON c.id=s.campaign_id JOIN users u ON u.id=s.user_id
      WHERE s.status='pending' AND (? OR u.is_demo=0) ORDER BY s.id DESC LIMIT 50`, Number(demo));
    result.audit = all('SELECT a.action,a.subject,a.detail,a.created,u.name FROM audit a LEFT JOIN users u ON u.id=a.actor ORDER BY a.created DESC, a.id DESC LIMIT 10');
    result.inquiries = all(`SELECT i.id,i.subject,i.message,i.email,i.created,i.reviewed,i.reply,i.replied,u.name AS sender
      FROM inquiries i LEFT JOIN users u ON u.id=i.user_id ORDER BY i.reviewed IS NOT NULL, i.id DESC LIMIT 100`);
    result.payouts = all(`SELECT p.id,p.wallet,p.amount,p.destination,p.status,p.reason,p.created,p.decided,u.name AS owner,u.role AS ownerRole
      FROM payouts p JOIN users u ON u.id=p.user_id ORDER BY (p.status='pending') DESC, p.id DESC LIMIT 100`);
    result.chargeTrend = dailySum(`SELECT date(decided,'+9 hours') AS day, SUM(amount) AS total FROM charges
      WHERE status='approved' AND decided>=? GROUP BY day`, [], 31);
    result.kpi = {
      charged: get("SELECT COALESCE(SUM(amount),0) AS total FROM charges WHERE status='approved'").total,
      commission: get("SELECT COALESCE(SUM(commission),0) AS total FROM charges WHERE status='approved'").total,
      rewards: get("SELECT COALESCE(SUM(amount),0) AS total FROM ledger WHERE wallet='reward' AND kind='mission'").total,
      activeParticipants: get(`SELECT COUNT(DISTINCT user_id) AS total FROM submissions WHERE created>=?`, dayStart(shiftDay(dateKst(), -13))).total
    };
    result.adminCounts = {
      pendingSubmissions: get(`SELECT COUNT(*) AS total FROM submissions s JOIN users u ON u.id=s.user_id
        WHERE s.status='pending' AND (? OR u.is_demo=0)`, Number(demo)).total,
      unreadInquiries: get('SELECT COUNT(*) AS total FROM inquiries WHERE reviewed IS NULL').total,
      pendingPayouts: get("SELECT COUNT(*) AS total FROM payouts WHERE status='pending'").total,
      offerwallPending: ow.counts().review + ow.counts().pending
    };
  }
  return result;
}

function submissionPage(user, params) {
  role(user, ['admin']);
  const status = ['pending', 'approved', 'rejected'].includes(params.get('status')) ? params.get('status') : '';
  const kind = Object.hasOwn(products, params.get('kind')) ? params.get('kind') : '';
  const q = (params.get('q') || '').trim().slice(0, 50);
  const where = `(? OR u.is_demo=0) AND (?='' OR c.kind=?) AND (?='' OR c.title LIKE ? OR u.name LIKE ? OR s.response LIKE ?)`;
  const like = `%${q}%`;
  const args = [Number(demo), kind, kind, q, like, like, like];
  const counts = Object.fromEntries(['pending', 'approved', 'rejected'].map(key => [key, 0]));
  for (const row of all(`SELECT s.status, COUNT(*) AS total FROM submissions s JOIN campaigns c ON c.id=s.campaign_id JOIN users u ON u.id=s.user_id WHERE ${where} GROUP BY s.status`, ...args)) counts[row.status] = row.total;
  counts.all = counts.pending + counts.approved + counts.rejected;
  const total = status ? counts[status] : counts.all;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Number(params.get('page')) || 1), pages);
  const items = all(`SELECT s.id,s.status,s.created,s.decided,s.response,s.reason,c.id AS campaign,c.title,c.kind,c.reward,c.prompt,u.name,s.user_id,
    (SELECT COUNT(*) FROM submissions d WHERE d.campaign_id=s.campaign_id AND d.response=s.response AND d.id<>s.id) AS dupes,
    (SELECT COUNT(*) FROM submissions x WHERE x.user_id=s.user_id AND x.status='approved') AS userApproved,
    (SELECT COUNT(*) FROM submissions x WHERE x.user_id=s.user_id AND x.status='rejected') AS userRejected,
    (SELECT created FROM users WHERE id=s.user_id) AS joined FROM submissions s
    JOIN campaigns c ON c.id=s.campaign_id JOIN users u ON u.id=s.user_id WHERE ${where} AND (?='' OR s.status=?)
    ORDER BY (s.status='pending') DESC, s.id DESC LIMIT ? OFFSET ?`, ...args, status, status, pageSize, (page - 1) * pageSize);
  return { items, counts, page, pages, total, pendingReward: get(`SELECT COALESCE(SUM(c.reward),0) AS total FROM submissions s JOIN campaigns c ON c.id=s.campaign_id
    JOIN users u ON u.id=s.user_id WHERE s.status='pending' AND ${where}`, ...args).total };
}

function auditPage(user, params) {
  role(user, ['admin']);
  const q = (params.get('q') || '').trim().slice(0, 50);
  const like = `%${q}%`;
  const where = "(?='' OR a.action LIKE ? OR a.detail LIKE ? OR a.subject=? OR u.name LIKE ?)";
  const args = [q, like, like, q, like];
  const total = get(`SELECT COUNT(*) AS total FROM audit a LEFT JOIN users u ON u.id=a.actor WHERE ${where}`, ...args).total;
  const pages = Math.max(1, Math.ceil(total / 30));
  const page = Math.min(Math.max(1, Number(params.get('page')) || 1), pages);
  return { total, page, pages, items: all(`SELECT a.id,a.action,a.subject,a.detail,a.created,u.name FROM audit a LEFT JOIN users u ON u.id=a.actor
    WHERE ${where} ORDER BY a.created DESC, a.id DESC LIMIT 30 OFFSET ?`, ...args, (page - 1) * 30) };
}

function canSeeCampaign(user, campaign) {
  if (user.role === 'admin' || campaign.owner_id === user.id) return true;
  return user.role === 'operator' && campaign.owner_id && get("SELECT 1 FROM users WHERE id=? AND parent_id=? AND role='agency'", campaign.owner_id, user.id);
}

function report(user, id) {
  assert(user, '로그인이 필요합니다.', 401);
  const campaign = get('SELECT * FROM campaigns WHERE id=?', id);
  assert(campaign && canSeeCampaign(user, campaign), '리포트를 볼 수 없는 캠페인입니다.', 404);
  const today = dateKst();
  const total = get('SELECT COUNT(*) AS total FROM submissions WHERE campaign_id=?', id).total;
  const notStarted = !total && (campaign.start_date > today || ['pending', 'rejected', 'canceled'].includes(campaign.status));
  const start = campaign.start_date;
  const last = campaign.end_date < today ? campaign.end_date : today;
  const span = Math.max(1, Math.min(60, Math.round((Date.parse(last) - Date.parse(start)) / 86_400_000) + 1));
  const rows = all(`SELECT date(created,'+9 hours') AS day, SUM(status='approved') AS approved, SUM(status='pending') AS pending, SUM(status='rejected') AS rejected
    FROM submissions WHERE campaign_id=? GROUP BY day`, id);
  const map = new Map(rows.map(row => [row.day, row]));
  const daily = Array.from({ length: span }, (_, i) => shiftDay(last, i - span + 1)).map(day => ({ day, approved: 0, pending: 0, rejected: 0, ...map.get(day) }));
  const hours = all(`SELECT CAST(strftime('%H', created, '+9 hours') AS INTEGER) AS hour, COUNT(*) AS total FROM submissions WHERE campaign_id=? GROUP BY hour`, id);
  const choices = campaign.kind === 'quiz'
    ? JSON.parse(campaign.choices).map((choice, index) => ({ choice, correct: index === campaign.answer,
      total: get('SELECT COUNT(*) AS total FROM submissions WHERE campaign_id=? AND response=?', id, choice).total }))
    : [];
  const responses = campaign.kind === 'survey'
    ? all(`SELECT s.id,s.response,s.status,s.created,u.name FROM submissions s JOIN users u ON u.id=s.user_id WHERE s.campaign_id=? ORDER BY s.id DESC LIMIT 60`, id)
      .map(({ name, ...row }) => ({ ...row, who: user.role === 'admin' ? name : `${[...name][0]}${'*'.repeat(Math.max(1, [...name].length - 1))}` }))
    : [];
  const history = all(`SELECT a.action,a.detail,a.created,u.name FROM audit a LEFT JOIN users u ON u.id=a.actor
    WHERE a.subject=? AND a.action IN ('광고 주문 접수','캠페인 상태 변경','캠페인 종료·정산','메모 수정','주문 수정','주문 취소','캠페인 연장·증액') ORDER BY a.created`, String(id));
  return { id, notStarted, daily, hours: Array.from({ length: 24 }, (_, hour) => hours.find(item => item.hour === hour)?.total || 0), choices, responses, history };
}

function saveMemo(user, body) {
  role(user, [...partners, 'admin']);
  const id = int(body.id, '캠페인 번호', 1, 1e9);
  const memo = str(body.memo ?? '', '메모', 300, 0);
  return transaction(() => {
    const campaign = get('SELECT owner_id FROM campaigns WHERE id=?', id);
    assert(campaign && (user.role === 'admin' || campaign.owner_id === user.id), '캠페인을 찾을 수 없습니다.', 404);
    run('UPDATE campaigns SET memo=? WHERE id=?', memo, id);
    audit(user.id, '메모 수정', id);
    return {};
  });
}

function noticeFields(body) {
  const title = str(body.title, '공지 제목', 80, 2);
  const text = str(body.body, '공지 내용', 1000, 2);
  assert(['all', 'business', 'participant'].includes(body.audience), '공지 대상을 선택해 주세요.');
  const pinned = body.pinned === true || body.pinned === '1' || body.pinned === 'on' ? 1 : 0;
  return { title, text, audience: body.audience, pinned };
}

function createNotice(user, body) {
  role(user, ['admin']);
  const { title, text, audience, pinned } = noticeFields(body);
  return transaction(() => {
    const id = Number(run('INSERT INTO notices(title,body,audience,pinned,author,created) VALUES (?,?,?,?,?,?)', title, text, audience, pinned, user.id, now()).lastInsertRowid);
    audit(user.id, '공지 등록', id, title);
    return { id };
  });
}

function updateNotice(user, body) {
  role(user, ['admin']);
  const id = int(body.id, '공지 번호', 1, 1e9);
  const { title, text, audience, pinned } = noticeFields(body);
  return transaction(() => {
    assert(get('SELECT id FROM notices WHERE id=?', id), '공지를 찾을 수 없습니다.', 404);
    run('UPDATE notices SET title=?,body=?,audience=?,pinned=?,updated=? WHERE id=?', title, text, audience, pinned, now(), id);
    audit(user.id, '공지 수정', id, title);
    return {};
  });
}

function deleteNotice(user, body) {
  role(user, ['admin']);
  const id = int(body.id, '공지 번호', 1, 1e9);
  return transaction(() => {
    assert(get('SELECT id FROM notices WHERE id=?', id), '공지를 찾을 수 없습니다.', 404);
    run('DELETE FROM notices WHERE id=?', id);
    audit(user.id, '공지 삭제', id);
    return {};
  });
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
    assert(get("SELECT COUNT(*) AS total FROM charges WHERE user_id=? AND status='pending'", user.id).total < 5, '승인 대기 중인 충전이 5건 있습니다. 처리 후 다시 신청해 주세요.', 409);
    const id = Number(run('INSERT INTO charges(user_id,amount,vat,created,request_key) VALUES (?,?,?,?,?)', user.id, amount, Math.round(amount * 0.1), now(), key).lastInsertRowid);
    audit(user.id, '충전 신청', id, String(amount));
    return { id };
  });
}

function cancelCharge(user, body) {
  role(user, partners);
  const id = int(body.id, '충전 번호', 1, 1e9);
  return transaction(() => {
    const charge = get('SELECT * FROM charges WHERE id=? AND user_id=?', id, user.id);
    assert(charge, '충전 요청을 찾을 수 없습니다.', 404);
    assert(charge.status === 'pending', '이미 처리된 충전입니다.', 409);
    run("UPDATE charges SET status='canceled', decided=?, reason='신청자 취소' WHERE id=?", now(), id);
    audit(user.id, '충전 취소', id);
    return {};
  });
}

function decideCharge(user, body) {
  role(user, ['admin']);
  const id = int(body.id, '충전 번호', 1, 1e9);
  assert(['approve', 'reject'].includes(body.action), '충전 처리 유형을 확인해 주세요.');
  const reason = body.action === 'reject' ? str(body.reason, '반려 사유', 200) : '';
  return transaction(() => {
    const charge = get('SELECT c.*,u.role,u.parent_id FROM charges c JOIN users u ON u.id=c.user_id WHERE c.id=?', id);
    assert(charge, '충전 요청을 찾을 수 없습니다.', 404);
    assert(charge.status === 'pending', '이미 처리된 충전입니다.', 409);
    if (body.action === 'reject') {
      run("UPDATE charges SET status='rejected', decided=?, reason=? WHERE id=?", now(), reason, id);
      audit(user.id, '충전 반려', id, reason);
      notify(charge.user_id, 'charge', `충전 #${id} 반려`, `${won(charge.amount)} 충전이 반려됐어요. 사유: ${reason}`, '/manage?tab=charges');
      return {};
    }
    const operator = charge.role === 'agency' && charge.parent_id
      ? get("SELECT id,rate FROM users WHERE id=? AND role='operator'", charge.parent_id) : null;
    const applied = operator ? operator.rate ?? Number(setting('default_rate')) : 0;
    const commission = Math.floor(charge.amount * applied / 10000);
    run("UPDATE charges SET status='approved',decided=?,operator_id=?,rate=?,commission=? WHERE id=?", now(), operator?.id ?? null, applied, commission, id);
    entry(charge.user_id, 'credit', charge.amount, 'charge', id);
    if (commission > 0) {
      entry(operator.id, 'revenue', commission, 'commission', id);
      notify(operator.id, 'revenue', '대행사 충전 수익 적립', `하위 대행사 충전 ${won(charge.amount)} 승인으로 ${won(commission)}이 적립됐어요.`, '/manage?tab=revenue');
    }
    notify(charge.user_id, 'charge', `충전 #${id} 승인`, `${won(charge.amount)}이 광고 잔액에 반영됐어요.`, '/manage?tab=charges');
    audit(user.id, '충전 승인', id, `${charge.amount.toLocaleString('ko-KR')}원 · 실행사 수익 ${commission.toLocaleString('ko-KR')}원`);
    return { commission };
  });
}

function missionContent(kind, body) {
  const title = str(body.title, '미션 제목', 80);
  const brand = str(body.brand, '브랜드명', 50);
  const details = str(body.details, '미션 소개', 500);
  const prompt = str(body.prompt, '참여 질문', 200);
  const choices = kind === 'quiz'
    ? [1, 2, 3, 4, 5].map(i => body['option' + i]).filter(value => typeof value === 'string' && value.trim()).map(value => str(value, '선택지', 60))
    : [];
  if (kind === 'quiz') assert(choices.length >= 2 && choices.length <= 5, '선택지는 2~5개 입력해 주세요.');
  assert(new Set(choices).size === choices.length, '선택지는 서로 달라야 합니다.');
  const answer = kind === 'quiz' ? int(body.answer, '정답 번호', 1, choices.length) - 1 : null;
  return { title, brand, details, prompt, choices, answer };
}

function createCampaign(user, body) {
  role(user, partners);
  const kind = body.kind;
  assert(Object.hasOwn(products, kind), '미션 유형을 선택해 주세요.');
  const { cost, reward } = products[kind];
  const { title, brand, details, prompt, choices, answer } = missionContent(kind, body);
  const goal = int(body.goal, '목표 수량', 1, 50000);
  const start = date(body.start);
  const end = date(body.end);
  assert(start >= dateKst() && end >= start, '시작일과 종료일을 확인해 주세요.');
  const cap = body.daily_cap === undefined || body.daily_cap === '' || body.daily_cap === '0' ? null : int(body.daily_cap, '일일 한도', 1, goal);
  if (cap) {
    const days = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
    assert(cap * days >= goal, `일일 한도 ${cap}건으로는 ${days}일 동안 목표 ${goal}건을 채울 수 없어요. 한도나 기간을 늘려 주세요.`);
  }
  const memo = str(body.memo ?? '', '메모', 300, 0);
  const key = str(body.key, '요청 키', 64);
  return transaction(() => {
    const existing = get('SELECT * FROM campaigns WHERE owner_id=? AND request_key=?', user.id, key);
    if (existing) {
      assert(existing.kind === kind && existing.title === title && existing.brand === brand && existing.details === details &&
        existing.prompt === prompt && existing.choices === JSON.stringify(choices) && existing.answer === answer &&
        existing.goal === goal && existing.start_date === start && existing.end_date === end && existing.daily_cap === cap, '이미 접수된 요청입니다. 새 주문 화면에서 다시 작성해 주세요.', 409);
      return { id: existing.id };
    }
    assert(balance(user.id, 'credit') >= cost * goal, '광고 잔액이 부족합니다. 먼저 충전을 신청해 주세요.', 409);
    const id = Number(run(`INSERT INTO campaigns(owner_id,title,brand,kind,details,prompt,choices,answer,goal,cost,reward,start_date,end_date,status,created,request_key,daily_cap,memo)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?,?,?,?)`, user.id, title, brand, kind, details, prompt, JSON.stringify(choices), answer, goal, cost, reward, start, end, now(), key, cap, memo).lastInsertRowid);
    entry(user.id, 'credit', -(cost * goal), 'reserve', id);
    audit(user.id, '광고 주문 접수', id);
    return { id };
  });
}

function editCampaign(user, body) {
  role(user, partners);
  const id = int(body.id, '캠페인 번호', 1, 1e9);
  return transaction(() => {
    const campaign = get('SELECT * FROM campaigns WHERE id=? AND owner_id=?', id, user.id);
    assert(campaign, '캠페인을 찾을 수 없습니다.', 404);
    assert(campaign.status === 'pending', '심사 대기 중인 주문만 수정할 수 있습니다.', 409);
    const { title, brand, details, prompt, choices, answer } = missionContent(campaign.kind, body);
    run('UPDATE campaigns SET title=?,brand=?,details=?,prompt=?,choices=?,answer=? WHERE id=?', title, brand, details, prompt, JSON.stringify(choices), answer, id);
    audit(user.id, '주문 수정', id);
    return {};
  });
}

function settleCampaign(campaign) {
  if (!campaign.owner_id) return 0;
  const remaining = (campaign.goal - count(campaign.id, true)) * campaign.cost;
  if (remaining) entry(campaign.owner_id, 'credit', remaining, 'release', campaign.id);
  return remaining;
}

function finishCampaign(campaign, reason, actor = null) {
  run("UPDATE campaigns SET status='closed',reason=? WHERE id=?", reason, campaign.id);
  run('DELETE FROM reservations WHERE campaign_id=?', campaign.id);
  const returned = settleCampaign(campaign);
  audit(actor, '캠페인 종료·정산', campaign.id, reason);
  if (actor !== campaign.owner_id) {
    notify(campaign.owner_id, 'campaign', `‘${campaign.title}’ 종료·정산`, `${reason}로 캠페인이 끝났어요.${returned ? ` 미집행 예산 ${won(returned)}을 잔액으로 돌려드렸어요.` : ''}`, '/manage?tab=orders&status=closed');
  }
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

const adminPause = '운영자 일시중지';

function decideCampaign(user, body) {
  role(user, ['admin', ...partners]);
  const admin = user.role === 'admin';
  const id = int(body.id, '캠페인 번호', 1, 1e9);
  const transitions = admin
    ? { pending: { approve: 'active', reject: 'rejected' }, active: { pause: 'paused', close: 'closed' }, paused: { resume: 'active', close: 'closed' } }
    : { pending: { cancel: 'canceled' }, active: { pause: 'paused', close: 'closed' }, paused: { resume: 'active', close: 'closed' } };
  return transaction(() => {
    const campaign = get('SELECT * FROM campaigns WHERE id=?', id);
    assert(campaign && (admin || campaign.owner_id === user.id), '캠페인을 찾을 수 없습니다.', 404);
    const options = transitions[campaign.status] || {};
    assert(Object.hasOwn(options, body.action), '현재 상태에서 처리할 수 없습니다.', 409);
    const status = options[body.action];
    if (!admin && body.action === 'resume') assert(campaign.reason !== adminPause, '운영팀이 중지한 캠페인입니다. 문의하기로 재개를 요청해 주세요.', 409);
    if (status === 'active') assert(campaign.end_date >= dateKst(), '종료일이 지난 캠페인입니다.');
    if (status === 'closed') {
      assert(count(id) === count(id, true), '검수 중인 응답이 있어 아직 종료할 수 없습니다. 검수가 끝난 뒤 다시 시도해 주세요.', 409);
      finishCampaign(campaign, admin ? '운영자 종료' : '주문자 종료', user.id);
      return {};
    }
    const reason = status === 'rejected' ? str(body.reason, '반려 사유', 200)
      : status === 'paused' ? (admin ? adminPause : '주문자 일시중지')
      : status === 'canceled' ? '주문자 취소' : '';
    run('UPDATE campaigns SET status=?,reason=? WHERE id=?', status, reason, id);
    if (status === 'paused') run('DELETE FROM reservations WHERE campaign_id=?', id);
    if (status === 'rejected' || status === 'canceled') settleCampaign(campaign);
    audit(user.id, status === 'canceled' ? '주문 취소' : '캠페인 상태 변경', id, status);
    if (admin && campaign.owner_id) {
      const message = { active: campaign.status === 'pending' ? ['심사 승인', `${campaign.start_date}부터 참여를 받습니다.`] : ['운영 재개', '캠페인이 다시 열렸어요.'],
        rejected: ['심사 반려', `사유: ${reason} 배정 예산은 잔액으로 돌려드렸어요.`], paused: ['운영팀 일시중지', '자세한 내용은 문의하기로 확인해 주세요.'] }[status];
      if (message) notify(campaign.owner_id, 'campaign', `‘${campaign.title}’ ${message[0]}`, message[1], '/manage?tab=orders');
    }
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
    if (campaign.daily_cap) {
      assert(countToday(id) + countReserved(id, time) < campaign.daily_cap, '오늘 모집 인원이 모두 찼어요. 내일 다시 참여해 주세요.', 409);
    }
    const deadline = Date.parse(campaign.end_date + 'T23:59:59.999+09:00') + 1;
    const expires = Math.min(time + reservationMinutes * 60_000, deadline);
    assert(expires > time, '미션 기간이 종료되었습니다.', 409);
    run('INSERT INTO reservations(campaign_id,user_id,expires,created) VALUES (?,?,?,?)', id, user.id, expires, time);
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
    const reservation = get('SELECT * FROM reservations WHERE campaign_id=? AND user_id=? AND expires>?', id, user.id, Date.now());
    assert(reservation, '참여 자리가 만료됐거나 예약되지 않았습니다. 다시 참여해 주세요.', 409);
    const dwell = minDwell[campaign.kind] * 1000;
    assert(!reservation.created || Date.now() - reservation.created >= dwell, `문항을 충분히 읽은 뒤 제출해 주세요. (최소 ${minDwell[campaign.kind]}초)`, 409);
    const isQuiz = campaign.kind === 'quiz';
    const choices = JSON.parse(campaign.choices);
    const answer = isQuiz ? int(body.response, '정답', 0, choices.length - 1) : str(body.response, '응답', 1000, 10);
    if (!isQuiz) assert(new Set(answer.replace(/\s/g, '')).size >= 3, '같은 글자만 반복한 답변은 제출할 수 없어요.');
    const status = !isQuiz ? 'pending' : answer === campaign.answer ? 'approved' : 'rejected';
    const time = now();
    const sid = Number(run('INSERT INTO submissions(campaign_id,user_id,response,status,reason,created,decided) VALUES (?,?,?,?,?,?,?)', id, user.id, isQuiz ? choices[answer] : answer, status, status === 'rejected' ? '퀴즈 정답과 일치하지 않습니다.' : '', time, isQuiz ? time : null).lastInsertRowid);
    run('DELETE FROM reservations WHERE campaign_id=? AND user_id=?', id, user.id);
    if (status === 'approved') {
      rewardSubmission(sid, user.id, campaign);
      if (count(id, true) >= campaign.goal) finishCampaign(campaign, '목표 건수 달성');
    }
    return { status };
  });
}

function reviewOne(user, id, status, reason) {
  const submission = get('SELECT * FROM submissions WHERE id=?', id);
  if (submission?.status !== 'pending') return false;
  run('UPDATE submissions SET status=?,reason=?,decided=? WHERE id=?', status, reason, now(), id);
  const campaign = get('SELECT * FROM campaigns WHERE id=?', submission.campaign_id);
  if (status === 'approved') rewardSubmission(id, submission.user_id, campaign);
  audit(user.id, '미션 검수', id, status);
  notify(submission.user_id, 'mission', status === 'approved' ? `+${campaign.reward.toLocaleString('ko-KR')}P 적립` : '설문 응답 반려',
    status === 'approved' ? `‘${campaign.title}’ 응답이 승인됐어요.` : `‘${campaign.title}’ 응답이 반려됐어요. 사유: ${reason}`, status === 'approved' ? '/manage?tab=rewards' : '/manage?tab=history&status=rejected');
  const approved = count(campaign.id, true);
  if (campaign.status !== 'closed') {
    if (approved >= campaign.goal) finishCampaign(campaign, '목표 건수 달성', user.id);
    else if (campaign.end_date < dateKst() && count(campaign.id) === approved) finishCampaign(campaign, '집행 기간 종료');
  }
  return true;
}

function reviewMission(user, body) {
  role(user, ['admin']);
  const id = int(body.id, '제출 번호', 1, 1e9);
  assert(['approve', 'reject'].includes(body.action), '검수 유형을 확인해 주세요.');
  const status = body.action === 'approve' ? 'approved' : 'rejected';
  const reason = status === 'rejected' ? str(body.reason, '반려 사유', 200) : '';
  return transaction(() => {
    assert(reviewOne(user, id, status, reason), '이미 처리된 제출입니다.', 409);
    return {};
  });
}

function reviewBulk(user, body) {
  role(user, ['admin']);
  assert(Array.isArray(body.ids) && body.ids.length >= 1 && body.ids.length <= 200, '일괄 처리는 한 번에 1~200건까지 가능합니다.');
  const ids = [...new Set(body.ids.map(value => int(value, '제출 번호', 1, 1e9)))];
  return transaction(() => ({ done: ids.filter(id => reviewOne(user, id, 'approved', '')).length }));
}

function createInquiry(req, user, body) {
  const subject = str(body.subject, '제목', 80, 3);
  const message = str(body.message, '문의 내용', 1200, 10);
  const email = str(body.email, '이메일', 120, 0);
  assert(!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), '올바른 이메일 주소를 입력해 주세요.');
  assert(user || email, '비회원 문의는 답변 받을 이메일을 입력해 주세요.');
  const key = str(body.key, '요청 키', 64);
  const sender = user?.id ?? null;
  return transaction(() => {
    const existing = get('SELECT * FROM inquiries WHERE request_key=?', key);
    if (existing) {
      assert(existing.user_id === sender && existing.subject === subject && existing.message === message && existing.email === email, '이미 접수된 요청입니다.', 409);
      return { id: existing.id };
    }
    limit(`inquiry:${user ? 'u' + user.id : clientIp(req)}`, 5, 10 * 60_000, '문의를 연달아 보내셨어요. 10분 뒤 다시 시도해 주세요.');
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

function replyInquiry(user, body) {
  role(user, ['admin']);
  const id = int(body.id, '문의 번호', 1, 1e9);
  const reply = str(body.reply, '답변', 2000, 2);
  return transaction(() => {
    const item = get('SELECT id,user_id,subject FROM inquiries WHERE id=?', id);
    assert(item, '문의 내역을 찾을 수 없습니다.', 404);
    const time = now();
    notify(item.user_id, 'inquiry', '문의 답변 도착', `‘${item.subject}’ 문의에 답변이 등록됐어요.`, '/manage?tab=profile#my-inquiries');
    run('UPDATE inquiries SET reply=?, replied=?, reviewed=COALESCE(reviewed, ?) WHERE id=?', reply, time, time, id);
    audit(user.id, '문의 답변', id);
    return {};
  });
}

/* ---------- 포인트·수익 출금 ---------- */
function requestPayout(user, body) {
  role(user, ['participant', 'operator']);
  const wallet = user.role === 'participant' ? 'reward' : 'revenue';
  const amount = int(body.amount, '출금 금액', payoutMinimum[wallet], 10000000);
  const destination = str(body.destination, '받을 곳', 120, 5);
  const key = str(body.key, '요청 키', 64);
  return transaction(() => {
    const existing = get('SELECT id,amount FROM payouts WHERE user_id=? AND request_key=?', user.id, key);
    if (existing) {
      assert(existing.amount === amount, '요청 내용이 바뀌었습니다. 새로 제출해 주세요.', 409);
      return { id: existing.id };
    }
    assert(get("SELECT COUNT(*) AS total FROM payouts WHERE user_id=? AND status='pending'", user.id).total < payoutPendingLimit, `처리 대기 중인 출금 신청이 ${payoutPendingLimit}건 있어요. 처리 후 다시 신청해 주세요.`, 409);
    assert(balance(user.id, wallet) >= amount, wallet === 'reward' ? '보유 포인트가 부족합니다.' : '출금 가능한 수익이 부족합니다.', 409);
    const id = Number(run('INSERT INTO payouts(user_id,wallet,amount,destination,created,request_key) VALUES (?,?,?,?,?,?)', user.id, wallet, amount, destination, now(), key).lastInsertRowid);
    entry(user.id, wallet, -amount, 'payout', id);
    audit(user.id, '출금 신청', id, String(amount));
    return { id };
  });
}

function closePayout(payout, status, reason) {
  run('UPDATE payouts SET status=?, reason=?, decided=? WHERE id=?', status, reason, now(), payout.id);
  if (status !== 'approved') entry(payout.user_id, payout.wallet, payout.amount, 'payout_return', payout.id);
}

function decidePayout(user, body) {
  role(user, ['admin']);
  const id = int(body.id, '출금 번호', 1, 1e9);
  assert(['approve', 'reject'].includes(body.action), '출금 처리 유형을 확인해 주세요.');
  const reason = body.action === 'reject' ? str(body.reason, '반려 사유', 200) : '';
  return transaction(() => {
    const payout = get('SELECT * FROM payouts WHERE id=?', id);
    assert(payout, '출금 신청을 찾을 수 없습니다.', 404);
    assert(payout.status === 'pending', '이미 처리된 출금 신청입니다.', 409);
    closePayout(payout, body.action === 'approve' ? 'approved' : 'rejected', reason);
    const unit = payout.wallet === 'reward' ? `${payout.amount.toLocaleString('ko-KR')}P` : won(payout.amount);
    notify(payout.user_id, 'payout', body.action === 'approve' ? `출금 #${id} 지급 완료` : `출금 #${id} 반려`,
      body.action === 'approve' ? `${unit}을 신청한 계좌로 보냈어요.` : `${unit}을 돌려드렸어요. 사유: ${reason}`, payout.wallet === 'reward' ? '/manage?tab=rewards' : '/manage?tab=revenue');
    audit(user.id, body.action === 'approve' ? '출금 승인' : '출금 반려', id, reason || String(payout.amount));
    return {};
  });
}

function cancelPayout(user, body) {
  role(user, ['participant', 'operator']);
  const id = int(body.id, '출금 번호', 1, 1e9);
  return transaction(() => {
    const payout = get('SELECT * FROM payouts WHERE id=? AND user_id=?', id, user.id);
    assert(payout, '출금 신청을 찾을 수 없습니다.', 404);
    assert(payout.status === 'pending', '이미 처리된 출금 신청입니다.', 409);
    closePayout(payout, 'canceled', '신청자 취소');
    audit(user.id, '출금 취소', id);
    return {};
  });
}


/* ---------- 캠페인 연장·증액 ---------- */
function extendCampaign(user, body) {
  role(user, partners);
  const id = int(body.id, '캠페인 번호', 1, 1e9);
  return transaction(() => {
    const campaign = get('SELECT * FROM campaigns WHERE id=? AND owner_id=?', id, user.id);
    assert(campaign, '캠페인을 찾을 수 없습니다.', 404);
    assert(['active', 'paused'].includes(campaign.status) && campaign.end_date >= dateKst(), '진행 중이거나 일시중지된 캠페인만 연장·증액할 수 있습니다.', 409);
    const goal = int(body.goal, '목표 수량', campaign.goal, 50000);
    const end = date(body.end);
    assert(end >= campaign.end_date, '종료일은 현재 종료일보다 앞당길 수 없습니다.');
    const cap = body.daily_cap === undefined || body.daily_cap === '' || body.daily_cap === '0' ? null : int(body.daily_cap, '일일 한도', 1, goal);
    if (cap) {
      const days = Math.round((Date.parse(end) - Date.parse(campaign.start_date)) / 86_400_000) + 1;
      assert(cap * days >= goal, `일일 한도 ${cap}건으로는 ${days}일 동안 목표 ${goal}건을 채울 수 없어요.`);
    }
    assert(goal !== campaign.goal || end !== campaign.end_date || cap !== campaign.daily_cap, '바뀐 내용이 없습니다.');
    const extra = (goal - campaign.goal) * campaign.cost;
    if (extra) {
      assert(balance(user.id, 'credit') >= extra, `추가 예산 ${won(extra)}이 필요합니다. 먼저 충전을 신청해 주세요.`, 409);
      entry(user.id, 'credit', -extra, 'reserve', `${id}.${Date.now()}`);
    }
    run('UPDATE campaigns SET goal=?, end_date=?, daily_cap=? WHERE id=?', goal, end, cap, id);
    audit(user.id, '캠페인 연장·증액', id, `목표 ${campaign.goal}→${goal}건 · 종료 ${campaign.end_date}→${end}${extra ? ` · 추가 예산 ${won(extra)}` : ''}`);
    return { extra };
  });
}

/* ---------- CSV 내보내기 ---------- */
const csvCell = value => {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text; // 스프레드시트 수식 실행 방지
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const kst = value => value ? new Date(Date.parse(value) + 9 * 3600_000).toISOString().slice(0, 16).replace('T', ' ') : '';
const statusKo = { pending: '대기', approved: '승인', rejected: '반려', canceled: '취소', active: '진행', paused: '일시중지', closed: '종료' };
const walletKo = { credit: '광고 잔액', revenue: '실행사 수익', reward: '포인트' };
const kindKo = { opening: '데모 시작 잔액', charge: '충전 승인', reserve: '예산 배정', release: '미집행 반환', commission: '대행사 충전 수익', mission: '미션 보상', payout: '출금 신청', payout_return: '출금 반환', adjust: '운영 조정', ow_reserve: '오퍼월 예산 배정', ow_release: '오퍼월 미집행 반환' };
const mask = name => `${[...name][0] || ''}${'*'.repeat(Math.max(1, [...name].length - 1))}`;

function exportCsv(user, params) {
  assert(user, '로그인이 필요합니다.', 401);
  const type = params.get('type');
  let name; let head; let rows;
  if (type === 'responses') {
    const id = int(params.get('id') || '', '캠페인 번호', 1, 1e9);
    const campaign = get('SELECT * FROM campaigns WHERE id=?', id);
    assert(campaign && canSeeCampaign(user, campaign), '내려받을 수 없는 캠페인입니다.', 404);
    name = `campaign-${id}-responses`;
    head = ['제출 번호', '제출 일시(KST)', '참여자', '응답', '상태', '처리 일시(KST)', '사유'];
    rows = all('SELECT s.*,u.name FROM submissions s JOIN users u ON u.id=s.user_id WHERE s.campaign_id=? ORDER BY s.id', id)
      .map(s => [s.id, kst(s.created), user.role === 'admin' ? s.name : mask(s.name), s.response, statusKo[s.status], kst(s.decided), s.reason]);
  } else if (type === 'ledger') {
    const wallet = params.get('wallet');
    assert(['credit', 'revenue', 'reward'].includes(wallet), '지갑을 확인해 주세요.');
    name = `ledger-${wallet}`;
    head = ['일시(KST)', '구분', '내용', '금액', '거래 후 잔액'];
    rows = all(ledgerRowsSql, user.id, wallet).reverse().map(l => [kst(l.created), kindKo[l.kind] || l.kind, l.memo || l.ref, l.amount, l.after]);
  } else {
    role(user, ['admin']);
    if (type === 'charges') {
      name = 'charges';
      head = ['번호', '신청 일시(KST)', '신청 계정', '아이디', '충전액', '부가세', '상태', '처리 일시(KST)', '실행사', '수익률(%)', '실행사 수익', '사유'];
      rows = all(`SELECT c.*,u.name,u.username,o.name AS op FROM charges c JOIN users u ON u.id=c.user_id LEFT JOIN users o ON o.id=c.operator_id ORDER BY c.id`)
        .map(c => [c.id, kst(c.created), c.name, c.username, c.amount, c.vat, statusKo[c.status], kst(c.decided), c.op || '', c.rate / 100, c.commission, c.reason]);
    } else if (type === 'payouts') {
      name = 'payouts';
      head = ['번호', '신청 일시(KST)', '신청 계정', '아이디', '구분', '금액', '받을 계좌', '상태', '처리 일시(KST)', '사유'];
      rows = all('SELECT p.*,u.name,u.username FROM payouts p JOIN users u ON u.id=p.user_id ORDER BY p.id')
        .map(p => [p.id, kst(p.created), p.name, p.username, walletKo[p.wallet], p.amount, p.destination, statusKo[p.status], kst(p.decided), p.reason]);
    } else if (type === 'campaigns') {
      name = 'campaigns';
      head = ['번호', '주문 일시(KST)', '주문자', '캠페인', '브랜드', '상품', '시작일', '종료일', '목표', '승인', '반려', '건당 단가', '집행액', '반환액', '상태', '사유'];
      rows = all(`SELECT c.*,u.name AS owner,
        (SELECT COUNT(*) FROM submissions WHERE campaign_id=c.id AND status='approved') AS approved,
        (SELECT COUNT(*) FROM submissions WHERE campaign_id=c.id AND status='rejected') AS rejected,
        COALESCE((SELECT amount FROM ledger WHERE user_id=c.owner_id AND wallet='credit' AND kind='release' AND ref=CAST(c.id AS TEXT)),0) AS returned
        FROM campaigns c LEFT JOIN users u ON u.id=c.owner_id WHERE c.owner_id IS NOT NULL OR ? ORDER BY c.id`, Number(demo))
        .map(c => [c.id, kst(c.created), c.owner || '애즈폼 예시', c.title, c.brand, c.kind === 'quiz' ? '브랜드 퀴즈' : '설문 조사', c.start_date, c.end_date, c.goal, c.approved, c.rejected, c.cost, c.approved * c.cost, c.returned, statusKo[c.status] || c.status, c.reason]);
    } else fail(400, '내려받을 항목을 확인해 주세요.');
  }
  const body = '﻿' + [head, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  return { name: `adsform-${name}-${dateKst()}.csv`, body };
}

/* ---------- 관리자 계정 상세·잔액 조정 ---------- */
const walletFor = role => role === 'participant' ? ['reward'] : role === 'operator' ? ['credit', 'revenue'] : partners.includes(role) ? ['credit'] : [];

function accountDetail(user, params) {
  role(user, ['admin']);
  const id = int(params.get('id') || '', '계정 번호', 1, 1e9);
  const target = get('SELECT u.id,u.name,u.username,u.role,u.status,u.created,u.last_login,u.agreed,u.must_change,p.name AS parent FROM users u LEFT JOIN users p ON p.id=u.parent_id WHERE u.id=?', id);
  assert(target, '계정을 찾을 수 없습니다.', 404);
  const wallets = walletFor(target.role);
  const submissions = Object.fromEntries(['pending', 'approved', 'rejected'].map(key => [key, 0]));
  for (const row of all('SELECT status, COUNT(*) AS total FROM submissions WHERE user_id=? GROUP BY status', id)) submissions[row.status] = row.total;
  return {
    account: target, wallets, balances: Object.fromEntries(wallets.map(wallet => [wallet, balance(id, wallet)])), submissions,
    campaigns: get("SELECT COUNT(*) AS total, SUM(status IN ('active','paused')) AS live FROM campaigns WHERE owner_id=?", id),
    charged: get("SELECT COALESCE(SUM(amount),0) AS total FROM charges WHERE user_id=? AND status='approved'", id).total,
    paid: get("SELECT COALESCE(SUM(amount),0) AS total FROM payouts WHERE user_id=? AND status='approved'", id).total,
    ledger: all(`SELECT l.id,l.wallet,l.amount,l.kind,l.ref,l.created,${ledgerMemo} AS memo FROM ledger l WHERE l.user_id=? ORDER BY l.created DESC, l.id DESC LIMIT 12`, id),
    recent: all('SELECT s.id,s.status,s.created,c.title FROM submissions s JOIN campaigns c ON c.id=s.campaign_id WHERE s.user_id=? ORDER BY s.id DESC LIMIT 8', id)
  };
}

function adjustBalance(user, body) {
  role(user, ['admin']);
  const id = int(body.id, '계정 번호', 1, 1e9);
  assert(typeof body.amount === 'string' || typeof body.amount === 'number', '조정 금액을 입력해 주세요.');
  const raw = String(body.amount).trim();
  assert(/^-?\d+$/.test(raw), '조정 금액은 정수로 입력해 주세요. 차감은 앞에 -를 붙입니다.');
  const amount = Number(raw);
  assert(amount !== 0 && Math.abs(amount) <= 10000000, '조정 금액은 1~10,000,000 사이로 입력해 주세요.');
  const reason = str(body.reason, '조정 사유', 100, 2);
  return transaction(() => {
    const target = get('SELECT * FROM users WHERE id=?', id);
    assert(target && target.role !== 'admin', '계정을 찾을 수 없습니다.', 404);
    assert(walletFor(target.role).includes(body.wallet), '이 계정에서 조정할 수 없는 지갑입니다.');
    assert(amount > 0 || balance(id, body.wallet) + amount >= 0, '차감 후 잔액이 0보다 작아집니다.', 409);
    const ref = Number(run('INSERT INTO adjustments(user_id,wallet,amount,reason,actor,created) VALUES (?,?,?,?,?,?)', id, body.wallet, amount, reason, user.id, now()).lastInsertRowid);
    entry(id, body.wallet, amount, 'adjust', ref);
    const unit = body.wallet === 'reward' ? 'P' : '원';
    audit(user.id, '잔액 조정', id, `${walletKo[body.wallet]} ${amount > 0 ? '+' : ''}${amount.toLocaleString('ko-KR')}${unit} · ${reason}`);
    notify(id, 'adjust', `${walletKo[body.wallet]} ${amount > 0 ? '지급' : '차감'}`, `운영팀이 ${Math.abs(amount).toLocaleString('ko-KR')}${unit}을 ${amount > 0 ? '지급' : '차감'}했어요. 사유: ${reason}`,
      body.wallet === 'reward' ? '/manage?tab=rewards' : body.wallet === 'revenue' ? '/manage?tab=revenue' : '/manage?tab=ledger');
    return { balance: balance(id, body.wallet) };
  });
}

/* ---------- 회원 탈퇴 ---------- */
function withdraw(req, res, user, body) {
  role(user, ['participant', 'advertiser']);
  assert(!user.is_demo, '테스트 계정은 탈퇴할 수 없습니다.', 403);
  assert(body.confirm === '탈퇴', '확인란에 ‘탈퇴’를 입력해 주세요.');
  assert(checkPass(str(body.password, '비밀번호', 128), user.password), '비밀번호가 일치하지 않습니다.');
  return transaction(() => {
    assert(!get("SELECT 1 FROM payouts WHERE user_id=? AND status='pending'", user.id), '처리 중인 출금 신청이 있어요. 처리된 뒤 탈퇴해 주세요.', 409);
    if (user.role === 'advertiser') {
      assert(!get("SELECT 1 FROM campaigns WHERE owner_id=? AND status IN ('pending','active','paused')", user.id) && !ow.hasLive(user.id), '진행 중이거나 심사 중인 캠페인이 있어요. 종료하거나 취소한 뒤 탈퇴해 주세요.', 409);
      const credit = balance(user.id, 'credit');
      assert(credit <= 0, `광고 잔액 ${won(credit)}이 남아 있어요. 환불은 문의하기로 요청한 뒤 탈퇴해 주세요.`, 409);
      run("UPDATE charges SET status='canceled', decided=?, reason='회원 탈퇴' WHERE user_id=? AND status='pending'", now(), user.id);
    }
    run("UPDATE users SET status='withdrawn', name='탈퇴 회원', username=?, password=? WHERE id=?", `withdrawn.${user.id}`, passHash(randomBytes(24).toString('hex')), user.id);
    run('DELETE FROM sessions WHERE user_id=?', user.id);
    run('DELETE FROM user_profiles WHERE user_id=?', user.id);
    run('DELETE FROM reservations WHERE user_id=?', user.id);
    run("UPDATE inquiries SET email='' WHERE user_id=?", user.id);
    audit(user.id, '회원 탈퇴', user.id, user.role);
    setCookie(req, res, '', 0);
    return {};
  });
}

const routes = {
  '/api/profile/avatar/reset': (_req, _res, user, body) => {
    role(user, roles);
    assert(body.account === user.id, '현재 로그인 계정을 다시 확인해 주세요.', 409);
    run('UPDATE user_profiles SET avatar_image=NULL, avatar_version=NULL WHERE user_id=?', user.id);
    return {};
  },
  '/api/login': (req, res, user, body) => authenticate(req, res, body),
  '/api/signup': (req, res, user, body) => signup(req, res, body),
  '/api/demo': (req, res, user, body) => {
    assert(demo && roles.includes(body.role), '테스트 로그인을 사용할 수 없습니다.', 403);
    return login(req, res, get('SELECT * FROM users WHERE username=? AND is_demo=1', `demo.${body.role}`));
  },
  '/api/logout': (req, res) => {
    if (cookie(req)) run('DELETE FROM sessions WHERE token=?', digest(cookie(req)));
    setCookie(req, res, '', 0);
    return {};
  },
  '/api/password': (req, _res, user, body) => changePassword(req, user, body),
  '/api/profile': (_req, _res, user, body) => updateProfile(user, body),
  '/api/account': (_req, _res, user, body) => newAccount(user, body),
  '/api/account/update': (_req, _res, user, body) => updateAccount(user, body),
  '/api/charge': (_req, _res, user, body) => requestCharge(user, body),
  '/api/charge/cancel': (_req, _res, user, body) => cancelCharge(user, body),
  '/api/charge/decision': (_req, _res, user, body) => decideCharge(user, body),
  '/api/campaign': (_req, _res, user, body) => createCampaign(user, body),
  '/api/campaign/edit': (_req, _res, user, body) => editCampaign(user, body),
  '/api/campaign/extend': (_req, _res, user, body) => extendCampaign(user, body),
  '/api/account/adjust': (_req, _res, user, body) => adjustBalance(user, body),
  '/api/account/withdraw': (req, res, user, body) => withdraw(req, res, user, body),
  '/api/notifications/read': (_req, _res, user) => {
    role(user, roles);
    run('UPDATE notifications SET read=? WHERE user_id=? AND read IS NULL', now(), user.id);
    return {};
  },
  '/api/campaign/decision': (_req, _res, user, body) => decideCampaign(user, body),
  '/api/mission/reserve': (_req, _res, user, body) => reserveMission(user, body),
  '/api/mission': (_req, _res, user, body) => submitMission(user, body),
  '/api/mission/review': (_req, _res, user, body) => reviewMission(user, body),
  '/api/mission/review/bulk': (_req, _res, user, body) => reviewBulk(user, body),
  '/api/inquiry': (req, _res, user, body) => createInquiry(req, user, body),
  '/api/campaign/memo': (_req, _res, user, body) => saveMemo(user, body),
  '/api/notice': (_req, _res, user, body) => createNotice(user, body),
  '/api/notice/update': (_req, _res, user, body) => updateNotice(user, body),
  '/api/notice/delete': (_req, _res, user, body) => deleteNotice(user, body),
  '/api/inquiry/review': (_req, _res, user, body) => reviewInquiry(user, body),
  '/api/inquiry/reply': (_req, _res, user, body) => replyInquiry(user, body),
  '/api/payout': (_req, _res, user, body) => requestPayout(user, body),
  '/api/payout/cancel': (_req, _res, user, body) => cancelPayout(user, body),
  '/api/payout/decision': (_req, _res, user, body) => decidePayout(user, body),
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

const getRoutes = {
  '/api/state': (user) => summary(user),
  '/api/report': (user, params) => report(user, int(params.get('id') || '', '캠페인 번호', 1, 1e9)),
  '/api/submissions': (user, params) => submissionPage(user, params),
  '/api/audit': (user, params) => auditPage(user, params),
  '/api/account/detail': (user, params) => accountDetail(user, params),
  '/api/ledger': (user, params) => ledgerPage(user, params.get('wallet'), Math.max(1, Number(params.get('page')) || 1))
};

async function readBody(req, limit) {
  assert(Number(req.headers['content-length'] || 0) <= limit, '요청 크기 제한을 초과했습니다.', 413);
  const parts = [];
  let bytes = 0;
  for await (const part of req.iterator({ destroyOnReturn: false })) {
    bytes += part.length;
    assert(bytes <= limit, '요청 크기 제한을 초과했습니다.', 413);
    parts.push(part);
  }
  return Buffer.concat(parts);
}

async function payload(req) {
  assert(req.headers['content-type']?.split(';')[0] === 'application/json', 'JSON 요청이 필요합니다.', 415);
  const body = await readBody(req, 32768);
  try {
    const data = JSON.parse(body.toString());
    assert(data && typeof data === 'object' && !Array.isArray(data), '잘못된 요청입니다.');
    return data;
  } catch {
    fail(400, '잘못된 요청입니다.');
  }
}

const headers = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
};
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const pages = ['/', '/login', '/signup', '/missions', '/account', '/manage', '/terms', '/privacy'];
const compressible = new Set(['.html', '.js', '.css', '.svg']);

function json(res, status, data) {
  res.writeHead(status, { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

// 정적 파일은 수정 시각이 바뀔 때만 다시 읽고, 압축본과 ETag를 함께 보관합니다.
const fileCache = new Map();
function staticFile(pathname) {
  const file = resolve(root, 'public', pathname.slice(1));
  let stat;
  try { stat = statSync(file); } catch (error) {
    if (error.code === 'ENOENT') fail(404, '파일을 찾을 수 없습니다.');
    throw error;
  }
  const cached = fileCache.get(file);
  if (cached && cached.mtime === stat.mtimeMs) return cached;
  const data = readFileSync(file);
  const entry = { mtime: stat.mtimeMs, data, etag: `"${createHash('sha1').update(data).digest('base64url').slice(0, 16)}"`,
    gzip: compressible.has(extname(file)) && pathname !== '/index.html' ? gzipSync(data) : null };
  fileCache.set(file, entry);
  return entry;
}

const localHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
function siteFor(req) {
  const host = req.headers.host;
  if (shareOrigin && host === shareOrigin.host) return { host, origin: shareOrigin.origin, secure: true };
  assert(localHosts.includes(host), '허용되지 않은 주소입니다.', 403);
  return { host, origin: `http://${host}`, secure: false };
}

// 외부 오퍼월 연동(매체용 API·참여 페이지·관리자 기능)은 offerwall.mjs에 있습니다.
const ow = setupOfferwall({ db, get, all, run, transaction, audit, notify, entry, balance, won, demo, setting, assert, fail, str, int, date, limit, hits: key => hits(key, 60_000), hit: key => hit(key, 60_000), clientIp, now, dateKst, dayStart, session, json, headers, readBody,
  root, dataDir: dirname(dbPath), allowPrivate: !shareOrigin && process.env.ADSFORM_OFFERWALL_ALLOW_PRIVATE === '1' });
Object.assign(routes, ow.routes);
Object.assign(getRoutes, ow.getRoutes);

async function avatarRequest(req, res, user, url) {
  role(user, roles);
  if (req.method === 'GET' || req.method === 'HEAD') {
    const profile = get('SELECT avatar_image FROM user_profiles WHERE user_id=? AND avatar_version=?', user.id, url.searchParams.get('v'));
    assert(profile?.avatar_image, '등록된 프로필 이미지가 없습니다.', 404);
    res.writeHead(200, { ...headers, 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store' });
    return res.end(req.method === 'HEAD' ? undefined : profile.avatar_image);
  }
  assert(req.method === 'POST', '지원하지 않는 요청입니다.', 405);
  assert(req.headers.origin === req.site.origin, '같은 사이트에서 요청해 주세요.', 403);
  assert(url.searchParams.get('account') === String(user.id), '현재 로그인 계정을 다시 확인해 주세요.', 409);
  assert(req.headers['content-type'] === 'image/jpeg', '프로필 이미지를 JPG로 보내 주세요.', 415);
  const image = await readBody(req, avatarLimit);
  assert(isAvatarJpeg(image), '프로필 이미지 형식이 올바르지 않습니다.');
  run(`INSERT INTO user_profiles (user_id, avatar_variant, avatar_image, avatar_version) VALUES (?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET avatar_image=excluded.avatar_image, avatar_version=excluded.avatar_version`,
    user.id, randomInt(avatarCount), image, randomBytes(8).toString('hex'));
  return json(res, 200, {});
}

const server = createServer(async (req, res) => {
  try {
    // 로드밸런서 상태 확인은 Host 검사 전에 응답합니다.
    if (req.url === '/healthz') {
      get('SELECT 1 AS ok');
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end('ok');
    }
    req.site = siteFor(req);
    if (req.site.secure) res.setHeader('Strict-Transport-Security', 'max-age=15552000');
    const url = new URL(req.url, req.site.origin);
    if (url.pathname.startsWith('/ow/')) return await ow.handle(req, res, url);
    if (url.pathname.startsWith('/api/')) {
      const user = session(req, res);
      if (url.pathname === '/api/profile/avatar') return await avatarRequest(req, res, user, url);
      if (url.pathname === '/api/offerwall/asset' && req.method === 'POST') return json(res, 200, await ow.uploadAsset(req, user, url));
      if (url.pathname === '/api/offerwall/proof' && req.method === 'GET') return await ow.proofImage(req, res, user, url);
      if (req.method === 'GET' && url.pathname === '/api/export') {
        const { name, body } = exportCsv(user, url.searchParams);
        res.writeHead(200, { ...headers, 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store',
          'Content-Disposition': `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}` });
        return res.end(body);
      }
      if (req.method === 'GET' && Object.hasOwn(getRoutes, url.pathname)) return json(res, 200, getRoutes[url.pathname](user, url.searchParams, req));
      if (req.method === 'POST' && Object.hasOwn(routes, url.pathname)) {
        assert(req.headers.origin === req.site.origin, '같은 사이트에서 요청해 주세요.', 403);
        const body = await payload(req);
        return json(res, 200, await routes[url.pathname](req, res, user, body));
      }
      fail(404, '요청한 기능을 찾을 수 없습니다.');
    }
    if (['GET', 'HEAD'].includes(req.method)) {
      const pathname = pages.includes(url.pathname) ? '/index.html' : url.pathname;
      const allowed = ['/index.html', '/app.js', '/styles.css', '/icon.svg', '/offerwall-console.js', '/ow.js', '/ow.css'].includes(pathname)
        || /^\/assets\/[a-z-]+\.(jpg|webp)$/.test(pathname) || /^\/assets\/fonts\/[A-Za-z-]+\.woff2$/.test(pathname);
      if (allowed) {
        const file = staticFile(pathname);
        const type = mime[extname(pathname)];
        if (pathname === '/index.html') {
          const origin = shareOrigin?.origin || req.site.origin;
          const page = pages.includes(url.pathname) ? url.pathname : '/';
          const html = file.data.toString('utf8').replaceAll('__ADSFORM_SHARE_ORIGIN__', origin).replace('__ADSFORM_PAGE_URL__', origin + page);
          const gzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
          res.writeHead(200, { ...headers, 'Content-Type': type, 'Cache-Control': 'no-cache', Vary: 'Accept-Encoding', ...(gzip ? { 'Content-Encoding': 'gzip' } : {}) });
          return res.end(req.method === 'HEAD' ? undefined : gzip ? gzipSync(html) : html);
        }
        const cacheControl = pathname.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache';
        if (req.headers['if-none-match'] === file.etag) {
          res.writeHead(304, { ...headers, ETag: file.etag, 'Cache-Control': cacheControl });
          return res.end();
        }
        const gzip = file.gzip && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
        res.writeHead(200, { ...headers, 'Content-Type': type, 'Cache-Control': cacheControl, ETag: file.etag, Vary: 'Accept-Encoding', ...(gzip ? { 'Content-Encoding': 'gzip' } : {}) });
        return res.end(req.method === 'HEAD' ? undefined : gzip ? file.gzip : file.data);
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

/* ---------- 자동 백업 (운영 모드 기본 14일 보관) ---------- */
const backupDir = resolve(dirname(dbPath), 'backups');
function backup() {
  if (!backupDays) return;
  mkdirSync(backupDir, { recursive: true });
  const target = resolve(backupDir, `adsform-${dateKst()}.sqlite`);
  if (!existsSync(target)) db.prepare('VACUUM INTO ?').run(target);
  const cutoff = shiftDay(dateKst(), -backupDays + 1);
  for (const file of readdirSync(backupDir)) {
    const day = file.match(/^adsform-(\d{4}-\d{2}-\d{2})\.sqlite$/)?.[1];
    if (day && day < cutoff) unlinkSync(resolve(backupDir, file));
  }
}
try { backup(); } catch (error) { console.error('backup failed', error); }
setInterval(() => { try { backup(); } catch (error) { console.error('backup failed', error); } }, 3600_000).unref();

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close();
    try { db.close(); } catch { /* 이미 닫힘 */ }
    process.exit(0);
  });
}
server.listen(port, bindHost, () => console.log(`Adsform  http://${bindHost}:${port}${shareOrigin ? `  (public ${shareOrigin.origin})` : ''}${demo ? '  [demo]' : ''}`));
