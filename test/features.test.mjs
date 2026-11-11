import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { request as httpRequest } from 'node:http';

async function start(env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'adsform-features-'));
  const db = join(dir, 'features.sqlite');
  const port = String(4400 + Math.floor(Math.random() * 500));
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', fileURLToPath(new URL('../server.mjs', import.meta.url))], {
    env: { ...process.env, ADSFORM_DB: db, ADSFORM_PORT: port, ADSFORM_DEMO: '1', ADSFORM_MIN_DWELL: '0', ...env },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
  });
  let log = '';
  server.stderr.on('data', chunk => { log += chunk; });
  const exit = once(server, 'exit');
  await Promise.race([once(server.stdout, 'data'), exit.then(() => { throw new Error(log); })]);
  async function request(path, { cookie, body, expected = 200, site = origin, headers = {} } = {}) {
    const result = await fetch(origin + '/api/' + path, {
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { Origin: site, 'Content-Type': 'application/json' } : {}), ...headers },
      ...(body ? { method: 'POST', body: JSON.stringify(body) } : {})
    });
    const data = await result.json();
    assert.equal(result.status, expected, `${path}: ${JSON.stringify(data)}`);
    return { data, cookie: result.headers.get('set-cookie')?.split(';')[0], headers: result.headers };
  }
  const api = {
    origin, db, request,
    session: async role => (await request('demo', { body: { role } })).cookie,
    state: async cookie => (await request('state', { cookie })).data,
    get: async (path, cookie, expected) => (await request(path, { cookie, expected })).data,
    post: async (path, cookie, body, expected) => (await request(path, { cookie, body, expected })).data,
    async stop() {
      if (server.exitCode === null) server.kill();
      await exit;
      rmSync(dir, { recursive: true, force: true });
    }
  };
  return api;
}

test('회원가입, 비밀번호 변경, 계정 정지와 로그인 제한', { timeout: 30000 }, async () => {
  const app = await start();
  try {
    const { post, state, session, request } = app;
    const form = { role: 'participant', name: '새 참여자', username: 'new.member', password: 'member-pass-2026', agree: 'on' };
    await post('signup', undefined, { ...form, agree: '' }, 400);
    await post('signup', undefined, { ...form, password: 'onlyletters!!' }, 400);
    await post('signup', undefined, { ...form, role: 'admin' }, 400);
    const joined = await request('signup', { body: form });
    let member = joined.cookie;
    assert.equal(joined.data.user.role, 'participant');
    await post('signup', undefined, form, 409);

    await post('password', member, { current: 'wrong-pass-1', password: 'member-next-2027' }, 400);
    await post('password', member, { current: form.password, password: 'member-next-2027' });
    await post('login', undefined, { username: form.username, password: form.password }, 401);
    member = (await request('login', { body: { username: form.username, password: 'member-next-2027' } })).cookie;
    await post('profile', member, { name: '바뀐 이름' });
    assert.equal((await state(member)).user.name, '바뀐 이름');

    const admin = await session('admin');
    const memberId = (await state(member)).user.id;
    await post('account/update', admin, { id: memberId, action: 'suspend' });
    assert.equal((await state(member)).user, null);
    await post('login', undefined, { username: form.username, password: 'member-next-2027' }, 403);
    await post('account/update', admin, { id: memberId, action: 'activate' });
    await post('account/update', admin, { id: memberId, action: 'reset_password', password: 'temporary-pass-9' });
    const reset = await request('login', { body: { username: form.username, password: 'temporary-pass-9' } });
    assert.equal(reset.data.user.must_change, true);
    const demoId = (await state(await session('advertiser'))).user.id;
    await post('account/update', admin, { id: demoId, action: 'suspend' }, 403);
    await post('password', await session('advertiser'), { current: 'x', password: 'whatever-pass-1' }, 403);

    const operator = await session('operator');
    await post('account', operator, { name: '대행사 B', username: 'agency.b', password: 'agency-pass-77' });
    const agencyB = (await state(operator)).agencies.find(item => item.username === 'agency.b');
    await post('account/update', operator, { id: agencyB.id, action: 'rename', name: '권한 없음' }, 400);
    await post('account/update', operator, { id: memberId, action: 'suspend' }, 404);
    await post('account/update', operator, { id: agencyB.id, action: 'suspend' });

    for (let i = 0; i < 10; i++) await post('login', undefined, { username: form.username, password: 'bad-password-' + i }, 401);
    await post('login', undefined, { username: form.username, password: 'temporary-pass-9' }, 429);
  } finally {
    await app.stop();
  }
});

test('충전 취소·반려 사유, 주문 취소·수정, 일괄 검수, 출금, 실행사 리포트, 페이지 조회', { timeout: 30000 }, async () => {
  const app = await start();
  try {
    const { post, get, state, session } = app;
    const admin = await session('admin');
    const advertiser = await session('advertiser');
    const operator = await session('operator');
    const agency = await session('agency');
    const participant = await session('participant');

    // 실행사 충전 화면용 데이터에는 하위 대행사 충전이 섞여 오므로 user_id로 구분할 수 있어야 합니다.
    const operatorState = await state(operator);
    assert.ok(operatorState.charges.some(charge => charge.user_id !== operatorState.user.id));
    assert.ok(operatorState.charges.every(charge => Object.hasOwn(charge, 'user_id')));

    const charge = await post('charge', advertiser, { amount: 50000, key: 'cancel-me' });
    assert.equal((await state(advertiser)).charges.find(item => item.id === charge.id).vat, 5000);
    await post('charge/cancel', operator, { id: charge.id }, 404);
    await post('charge/cancel', advertiser, { id: charge.id });
    await post('charge/decision', admin, { id: charge.id, action: 'approve' }, 409);
    const rejectMe = await post('charge', advertiser, { amount: 30000, key: 'reject-me' });
    await post('charge/decision', admin, { id: rejectMe.id, action: 'reject' }, 400);
    await post('charge/decision', admin, { id: rejectMe.id, action: 'reject', reason: '입금 확인 불가' });
    assert.equal((await state(advertiser)).charges.find(item => item.id === rejectMe.id).reason, '입금 확인 불가');

    const date = (await state(advertiser)).date;
    const before = (await state(advertiser)).balances.credit;
    const order = { kind: 'quiz', title: '다섯 지선다', brand: '테스트', details: '퀴즈입니다.', prompt: '정답은?', option1: '가', option2: '나', option3: '다', option4: '라', option5: '마', answer: '5', goal: '2', start: date, end: date, key: 'five' };
    const campaign = await post('campaign', advertiser, order);
    await post('campaign', advertiser, { ...order, option2: '', option3: '', option4: '', option5: '', answer: '1', key: 'one-choice' }, 400);
    await post('campaign/edit', advertiser, { id: campaign.id, title: '고친 제목', brand: '테스트', details: '수정했습니다.', prompt: '정답은?', option1: '가', option2: '나', answer: '2' });
    const edited = (await state(advertiser)).campaigns.find(item => item.id === campaign.id);
    assert.equal(edited.title, '고친 제목');
    assert.deepEqual(JSON.parse(edited.choices), ['가', '나']);
    await post('campaign/edit', agency, { id: campaign.id, title: 'x', brand: 'x', details: 'x', prompt: 'x', option1: '1', option2: '2', answer: '1' }, 404);
    await post('campaign/decision', advertiser, { id: campaign.id, action: 'approve' }, 409);
    await post('campaign/decision', advertiser, { id: campaign.id, action: 'cancel' });
    const canceled = (await state(advertiser)).campaigns.find(item => item.id === campaign.id);
    assert.equal(canceled.status, 'canceled');
    assert.equal((await state(advertiser)).balances.credit, before);
    assert.equal((await get(`report?id=${campaign.id}`, advertiser)).notStarted, true);

    const live = await post('campaign', advertiser, { ...order, key: 'live' });
    await post('campaign/decision', admin, { id: live.id, action: 'approve' });
    await post('campaign/decision', advertiser, { id: live.id, action: 'pause' });
    await post('campaign/decision', advertiser, { id: live.id, action: 'resume' });
    await post('campaign/decision', admin, { id: live.id, action: 'pause' });
    await post('campaign/decision', advertiser, { id: live.id, action: 'resume' }, 409);
    await post('campaign/decision', admin, { id: live.id, action: 'resume' });
    await post('mission/reserve', participant, { id: live.id });
    assert.equal((await state(participant)).missions.find(item => item.id === live.id).choices.length, 5);
    await post('mission', participant, { id: live.id, response: '5' }, 400);
    assert.equal((await post('mission', participant, { id: live.id, response: '4' })).status, 'approved');
    const rewards = (await state(participant)).ledger.filter(item => item.wallet === 'reward');
    assert.equal(rewards[0].memo, '다섯 지선다');
    await post('campaign/decision', advertiser, { id: live.id, action: 'close' });
    assert.equal((await state(advertiser)).campaigns.find(item => item.id === live.id).returned, 500);

    const agencyCampaign = (await state(agency)).campaigns[0];
    assert.ok((await get(`report?id=${agencyCampaign.id}`, operator)).daily.length >= 1);
    assert.ok((await state(operator)).agencyCampaigns.some(item => item.id === agencyCampaign.id));
    await get(`report?id=${agencyCampaign.id}`, advertiser, 404);

    const page = await get('submissions?status=pending&page=1', admin);
    assert.equal(page.items.length, Math.min(20, page.counts.pending));
    assert.ok(page.pages >= 1 && page.items.every(item => item.status === 'pending'));
    await get('submissions', advertiser, 403);
    const ids = page.items.slice(0, 3).map(item => item.id);
    assert.equal((await post('mission/review/bulk', admin, { ids, action: 'approve' })).done, 3);
    assert.equal((await post('mission/review/bulk', admin, { ids, action: 'approve' })).done, 0);
    await post('mission/review/bulk', admin, { ids: [] }, 400);

    const balance = (await state(participant)).balances.reward;
    await post('payout', participant, { amount: 100, destination: '국민은행 123-45', key: 'small' }, 400);
    await post('payout', participant, { amount: balance + 5000, destination: '국민은행 123-45', key: 'big' }, balance + 5000 >= 5000 ? 409 : 400);
    const fixture = new DatabaseSync(app.db);
    const participantId = (await state(participant)).user.id;
    fixture.prepare("INSERT INTO ledger(user_id,wallet,amount,kind,ref,created) VALUES (?,?,?,?,?,?)").run(participantId, 'reward', 10000, 'opening', 'payout-test', new Date().toISOString());
    fixture.close();
    const funded = (await state(participant)).balances.reward;
    const payout = await post('payout', participant, { amount: 6000, destination: '국민은행 123-45 하루', key: 'payout-1' });
    assert.deepEqual(await post('payout', participant, { amount: 6000, destination: '국민은행 123-45 하루', key: 'payout-1' }), payout);
    assert.equal((await state(participant)).balances.reward, funded - 6000);
    await post('payout/decision', admin, { id: payout.id, action: 'reject' }, 400);
    await post('payout/decision', admin, { id: payout.id, action: 'reject', reason: '계좌 정보 오류' });
    assert.equal((await state(participant)).balances.reward, funded);
    const second = await post('payout', participant, { amount: 5000, destination: '국민은행 123-45 하루', key: 'payout-2' });
    await post('payout/cancel', admin, { id: second.id }, 403);
    await post('payout/decision', admin, { id: second.id, action: 'approve' });
    await post('payout/cancel', participant, { id: second.id }, 409);
    assert.equal((await state(participant)).balances.reward, funded - 5000);
    assert.equal((await state(admin)).adminCounts.pendingPayouts, 0);
    await post('payout', advertiser, { amount: 10000, destination: '국민은행 1', key: 'x' }, 403);

    const ledger = await get('ledger?wallet=credit&page=1', advertiser);
    assert.ok(ledger.count >= 1 && ledger.items.length <= 20);
    assert.equal(ledger.items[0].after, ledger.balance);
    assert.ok(ledger.items.every(item => typeof item.memo === 'string'));

    const notice = await post('notice', admin, { title: '전체 공지', body: '모두에게 보입니다.', audience: 'all' });
    await post('notice/update', admin, { id: notice.id, title: '수정한 공지', body: '내용도 바꿨습니다.', audience: 'all', pinned: '1' });
    const guestNotices = (await state()).notices;
    assert.equal(guestNotices.find(item => item.id === notice.id).title, '수정한 공지');

    const inquiry = await post('inquiry', participant, { subject: '포인트 문의', message: '포인트 적립이 궁금합니다.', email: '', key: 'mine-1' });
    await post('inquiry/reply', admin, { id: inquiry.id, reply: '승인 후 적립됩니다.' });
    assert.equal((await state(participant)).myInquiries[0].reply, '승인 후 적립됩니다.');
    await post('inquiry', undefined, { subject: '비회원', message: '이메일 없이 보냅니다.', email: '', key: 'guest-no-mail' }, 400);
    for (let i = 0; i < 5; i++) await post('inquiry', undefined, { subject: '도배 ' + i, message: '반복 문의입니다 ' + i, email: 'a@b.co', key: 'spam-' + i });
    await post('inquiry', undefined, { subject: '도배 5', message: '반복 문의입니다 5', email: 'a@b.co', key: 'spam-5' }, 429);

    await post('rates', admin, { rate: '31' }, 400);
    const audit = await get('audit?q=' + encodeURIComponent('출금'), admin);
    assert.ok(audit.total >= 2 && audit.items.every(item => item.action.includes('출금') || item.detail.includes('출금')));
  } finally {
    await app.stop();
  }
});

test('공개 주소 배포: 테스트 로그인 차단, 출처 검사, 보안 쿠키, 정적 파일 압축', { timeout: 30000 }, async () => {
  const app = await start({ ADSFORM_DEMO: '', ADSFORM_PUBLIC_ORIGIN: 'https://ads.example', ADSFORM_ADMIN_PASSWORD: 'admin-initial-pass-1' });
  try {
    const { origin } = app;
    // fetch는 Host 헤더를 바꿀 수 없어 공개 주소 요청은 node:http로 보냅니다.
    const raw = (path, { host = 'ads.example', site = 'https://ads.example', body } = {}) => new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : undefined;
      const req = httpRequest(origin + path, { method: body ? 'POST' : 'GET', headers: { Host: host, ...(body ? { Origin: site, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}) } }, res => {
        let text = '';
        res.on('data', chunk => { text += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(text) }));
      });
      req.on('error', reject);
      req.end(data);
    });
    const demo = await raw('/api/demo', { body: { role: 'admin' } });
    assert.equal(demo.status, 403);
    assert.match(demo.data.error, /테스트 로그인/);
    assert.equal((await raw('/api/login', { body: { username: 'admin', password: 'admin-initial-pass-1' }, site: 'http://ads.example' })).status, 403);
    const login = await raw('/api/login', { body: { username: 'admin', password: 'admin-initial-pass-1' } });
    assert.equal(login.status, 200, JSON.stringify(login.data));
    assert.match(login.headers['set-cookie'][0], /Secure/);
    assert.equal((await raw('/api/state', { host: 'evil.example' })).status, 403);
    const local = await fetch(origin + '/app.js', { headers: { 'Accept-Encoding': 'gzip' } });
    assert.equal(local.headers.get('content-encoding'), 'gzip');
    const etag = local.headers.get('etag');
    assert.equal((await fetch(origin + '/app.js', { headers: { 'If-None-Match': etag } })).status, 304);
    assert.equal((await fetch(origin + '/assets/fonts/PretendardSubset.woff2', { method: 'HEAD' })).headers.get('content-type'), 'font/woff2');
    assert.equal((await fetch(origin + '/signup')).status, 200);
  } finally {
    await app.stop();
  }
});
