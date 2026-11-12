import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { request as httpRequest } from 'node:http';

async function start(env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'adsform-upgrades-'));
  const db = join(dir, 'upgrades.sqlite');
  const port = String(5000 + Math.floor(Math.random() * 500));
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', fileURLToPath(new URL('../server.mjs', import.meta.url))], {
    env: { ...process.env, ADSFORM_DB: db, ADSFORM_PORT: port, ADSFORM_DEMO: '1', ADSFORM_MIN_DWELL: '0', ...env },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
  });
  let log = '';
  server.stderr.on('data', chunk => { log += chunk; });
  const exit = once(server, 'exit');
  await Promise.race([once(server.stdout, 'data'), exit.then(() => { throw new Error(log); })]);
  async function request(path, { cookie, body, expected = 200 } = {}) {
    const result = await fetch(origin + '/api/' + path, {
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { Origin: origin, 'Content-Type': 'application/json' } : {}) },
      ...(body ? { method: 'POST', body: JSON.stringify(body) } : {})
    });
    const text = await result.text();
    assert.equal(result.status, expected, `${path}: ${text.slice(0, 300)}`);
    const data = result.headers.get('content-type')?.startsWith('application/json') ? JSON.parse(text) : text;
    return { data, cookie: result.headers.get('set-cookie')?.split(';')[0], headers: result.headers };
  }
  return {
    dir, port, request,
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
}

test('알림, 잔액 조정, 캠페인 연장·증액, CSV 내보내기, 검수 신호', { timeout: 40000 }, async () => {
  const app = await start();
  try {
    const { post, get, state, session, request } = app;
    const admin = await session('admin');
    const brand = (await request('signup', { body: { role: 'advertiser', name: '브랜드원', username: 'brand.one', password: 'brand-pass-2026', agree: 'on' } })).cookie;
    const member = (await request('signup', { body: { role: 'participant', name: '참여왕', username: 'member.one', password: 'member-pass-2026', agree: 'on' } })).cookie;
    const brandId = (await state(brand)).user.id;
    const memberId = (await state(member)).user.id;

    // 잔액 조정: 지갑 검증, 차감 한도, 알림·원장 메모
    await post('account/adjust', admin, { id: brandId, wallet: 'reward', amount: '1000', reason: '잘못된 지갑' }, 400);
    await post('account/adjust', admin, { id: brandId, wallet: 'credit', amount: '-1', reason: '잔액 부족' }, 409);
    await post('account/adjust', brand, { id: brandId, wallet: 'credit', amount: '1000', reason: '권한 없음' }, 403);
    await post('account/adjust', admin, { id: brandId, wallet: 'credit', amount: '100000', reason: '테스트 지원금' });
    let s = await state(brand);
    assert.equal(s.balances.credit, 100000);
    assert.equal(s.unreadNotifications, 1);
    assert.match(s.ledger.find(item => item.kind === 'adjust').memo, /테스트 지원금/);
    const detail = await get('account/detail?id=' + brandId, admin);
    assert.equal(detail.balances.credit, 100000);
    assert.ok(detail.account.last_login);
    await get('account/detail?id=' + brandId, brand, 403);

    // 캠페인 승인 알림과 연장·증액
    const date = s.date;
    const shift = n => new Date(Date.parse(date) + n * 86_400_000).toISOString().slice(0, 10);
    const quiz = await post('campaign', brand, { kind: 'quiz', title: '연장 퀴즈', brand: '브랜드원', details: '퀴즈입니다.', prompt: '정답은?', option1: '가', option2: '나', answer: '1', goal: '10', start: date, end: shift(2), key: 'q1' });
    await post('campaign/extend', brand, { id: quiz.id, goal: '20', end: shift(4) }, 409); // 심사 전
    await post('campaign/decision', admin, { id: quiz.id, action: 'approve' });
    s = await state(brand);
    assert.ok(s.notifications.some(item => item.title.includes('심사 승인')));
    const before = s.balances.credit;
    await post('campaign/extend', brand, { id: quiz.id, goal: '5', end: shift(4) }, 400);
    await post('campaign/extend', brand, { id: quiz.id, goal: '10', end: shift(1) }, 400);
    await post('campaign/extend', brand, { id: quiz.id, goal: '20', end: shift(4), daily_cap: '1' }, 400);
    await post('campaign/extend', member, { id: quiz.id, goal: '20', end: shift(4) }, 403);
    const extended = await post('campaign/extend', brand, { id: quiz.id, goal: '20', end: shift(4), daily_cap: '' });
    assert.equal(extended.extra, 5000);
    s = await state(brand);
    assert.equal(s.balances.credit, before - 5000);
    const row = s.campaigns.find(item => item.id === quiz.id);
    assert.equal(row.goal, 20);
    assert.equal(row.end_date, shift(4));
    const report = await get('report?id=' + quiz.id, brand);
    assert.ok(report.history.some(item => item.action === '캠페인 연장·증액'));

    // 설문: 반려 알림, 검수 신호, CSV 수식 방지
    const survey = await post('campaign', brand, { kind: 'survey', title: '의견 설문', brand: '브랜드원', details: '설문입니다.', prompt: '의견을 적어 주세요', goal: '5', start: date, end: shift(3), key: 's1' });
    await post('campaign/decision', admin, { id: survey.id, action: 'approve' });
    await post('mission/reserve', member, { id: survey.id });
    await post('mission', member, { id: survey.id, response: '=HYPERLINK("x") 이건 의견입니다' });
    const review = await get('submissions?status=pending&q=' + encodeURIComponent('의견 설문'), admin);
    const item = review.items.find(entry => entry.user_id === memberId);
    assert.equal(item.prompt, '의견을 적어 주세요');
    assert.equal(typeof item.dupes, 'number');
    await post('mission/review', admin, { id: item.id, action: 'reject', reason: '질문과 무관' });
    s = await state(member);
    assert.ok(s.notifications.some(entry => entry.title === '설문 응답 반려' && entry.body.includes('질문과 무관')));
    assert.ok(s.submissions.some(entry => entry.response.startsWith('=HYPERLINK')));
    await post('notifications/read', member, {});
    assert.equal((await state(member)).unreadNotifications, 0);

    const csv = await get(`export?type=responses&id=${survey.id}`, brand);
    assert.ok(csv.replace(/^\ufeff/, '').startsWith('제출 번호'));
    assert.ok(csv.includes(`"'=HYPERLINK(""x"") 이건 의견입니다"`));
    assert.ok(csv.includes('참*'));
    await get(`export?type=responses&id=${survey.id}`, member, 404);
    assert.match(await get('export?type=charges', admin), /충전액/);
    assert.match(await get('export?type=campaigns', admin), /연장 퀴즈/);
    await get('export?type=payouts', brand, 403);
    assert.match(await get('export?type=ledger&wallet=credit', brand), /운영 조정/);

    // 출금 대기 한도 3건
    await post('account/adjust', admin, { id: memberId, wallet: 'reward', amount: '30000', reason: '출금 테스트' });
    for (const n of [1, 2, 3]) await post('payout', member, { amount: 5000, destination: '테스트은행 123-456', key: 'p' + n });
    await post('payout', member, { amount: 5000, destination: '테스트은행 123-456', key: 'p4' }, 409);
    const payoutId = (await state(member)).payouts[0].id;
    await post('payout/decision', admin, { id: payoutId, action: 'approve' });
    assert.ok((await state(member)).notifications.some(entry => entry.title.includes('지급 완료')));
  } finally {
    await app.stop();
  }
});

test('회원 탈퇴, 상태 확인 주소, 자동 백업', { timeout: 30000 }, async () => {
  const app = await start({ ADSFORM_BACKUP_DAYS: '3' });
  try {
    const { post, state, session, request } = app;
    const form = { role: 'participant', name: '떠나는 회원', username: 'leaving.one', password: 'leave-pass-2026', agree: 'on' };
    const member = (await request('signup', { body: form })).cookie;
    await post('account/withdraw', await session('participant'), { password: 'x', confirm: '탈퇴' }, 403);
    await post('account/withdraw', member, { password: form.password, confirm: '네' }, 400);
    await post('account/withdraw', member, { password: 'wrong-pass-1', confirm: '탈퇴' }, 400);
    await post('account/withdraw', member, { password: form.password, confirm: '탈퇴' });
    assert.equal((await state(member)).user, null);
    await post('login', undefined, { username: form.username, password: form.password }, 401);
    const again = await request('signup', { body: { ...form, name: '새 회원' } });
    assert.equal(again.data.user.username, form.username);
    await post('signup', undefined, { ...form, username: 'withdrawn.99' }, 400);
    const admin = await session('admin');
    const gone = (await state(admin)).accounts.find(item => item.status === 'withdrawn');
    assert.equal(gone.name, '탈퇴 회원');
    await post('account/update', admin, { id: gone.id, action: 'activate' }, 409);

    // 광고주는 남은 잔액이 있으면 탈퇴할 수 없습니다.
    const brand = (await request('signup', { body: { role: 'advertiser', name: '잔액 광고주', username: 'brand.left', password: 'brand-pass-2026', agree: 'on' } })).cookie;
    await post('account/adjust', admin, { id: (await state(brand)).user.id, wallet: 'credit', amount: '1000', reason: '잔액 테스트' });
    await post('account/withdraw', brand, { password: 'brand-pass-2026', confirm: '탈퇴' }, 409);

    const health = await new Promise((resolve, reject) => {
      httpRequest({ host: '127.0.0.1', port: app.port, path: '/healthz', headers: { Host: 'internal-check' } }, res => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }).on('error', reject).end();
    });
    assert.deepEqual(health, { status: 200, body: 'ok' });
    const backups = join(app.dir, 'backups');
    assert.ok(existsSync(backups) && readdirSync(backups).some(file => /^adsform-\d{4}-\d{2}-\d{2}\.sqlite$/.test(file)));
  } finally {
    await app.stop();
  }
});
