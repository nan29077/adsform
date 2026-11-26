import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const hmac = (secret, text) => createHmac('sha256', secret).update(text).digest('hex');
const sleep = ms => new Promise(done => setTimeout(done, ms));
const now = () => Math.floor(Date.now() / 1000);
const fakeJpeg = (width, height) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255]), Buffer.alloc(10), Buffer.from([0xff, 0xd9])]);
const kstInput = ms => new Date(ms + 9 * 3600_000).toISOString().slice(0, 16);

async function start() {
  const dir = mkdtempSync(join(tmpdir(), 'adsform-live-'));
  const db = join(dir, 'live.sqlite');
  const port = String(5500 + Math.floor(Math.random() * 400));
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', fileURLToPath(new URL('../server.mjs', import.meta.url))], {
    env: { ...process.env, ADSFORM_DB: db, ADSFORM_PORT: port, ADSFORM_DEMO: '1', ADSFORM_MIN_DWELL: '0', ADSFORM_OFFERWALL_ALLOW_PRIVATE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
  });
  let log = '';
  server.stderr.on('data', chunk => { log += chunk; });
  const exit = once(server, 'exit');
  await Promise.race([once(server.stdout, 'data'), exit.then(() => { throw new Error(log); })]);
  async function call(path, { cookie, body, raw, type, expected = 200, headers = {} } = {}) {
    const response = await fetch(origin + path, {
      method: body || raw ? 'POST' : 'GET', redirect: 'manual',
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body || raw ? { Origin: origin, 'Content-Type': type || 'application/json' } : {}), ...headers },
      ...(body ? { body: JSON.stringify(body) } : raw ? { body: raw } : {})
    });
    const kind = response.headers.get('content-type') || '';
    const data = kind.includes('json') ? await response.json() : await response.text();
    assert.equal(response.status, expected, `${path}: ${typeof data === 'string' ? data.slice(0, 200) : JSON.stringify(data)}`);
    return { data, response, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  return {
    call,
    // 방송 시간을 앞당겨 노출 구간을 시험하려고 테스트에서만 DB를 직접 고칩니다.
    sql: (text, ...params) => { const handle = new DatabaseSync(db, { timeout: 5000 }); try { return handle.prepare(text).run(...params); } finally { handle.close(); } },
    one: (text, ...params) => { const handle = new DatabaseSync(db, { readOnly: true }); try { return handle.prepare(text).get(...params); } finally { handle.close(); } },
    login: async role => (await call('/api/demo', { body: { role } })).cookie,
    post: async (path, cookie, body, expected) => (await call('/api/' + path, { cookie, body, expected })).data,
    async stop() {
      if (server.exitCode === null) server.kill();
      await exit;
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

function receiver() {
  const hits = [];
  const server = createServer((req, res) => {
    hits.push(new URL(req.url, 'http://local'));
    req.resume();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"code":0}');
  });
  return new Promise(done => server.listen(0, '127.0.0.1', () => done({ hits, port: server.address().port, close: () => server.close() })));
}
const waitFor = async (check, tries = 50) => { for (let i = 0; i < tries && !check(); i++) await sleep(100); };

test('라이브 셀러 주문 → 주문 단위 승인 → 방송 시간 노출 → 시청 키워드·알림 캡처 → 집행·포스트백 → 종료 정산', { timeout: 60000 }, async () => {
  const sink = await receiver();
  const app = await start();
  try {
    const { call, post } = app;
    const admin = await app.login('admin');
    const seller = await app.login('advertiser');
    const participant = await app.login('participant');
    const net = await post('offerwall/network', admin, { preset: 'custom', code: 'testnet', name: '테스트 매체', click_param: 'click_id', user_param: 'user_id', sign_landing: 'on',
      reward_rate: '100', point_unit: 'P', postback_method: 'GET', postback_url: `http://127.0.0.1:${sink.port}/pb?click={click_id}&tx={transaction_id}&ev={event}&price={price}` });
    const signed = path => ({ 'X-Adsform-Key': net.apiKey, 'X-Adsform-Timestamp': String(now()), 'X-Adsform-Signature': hmac(net.secret, `${now()}\nGET\n${path}`) });
    const feed = async () => (await call('/ow/v1/offers', { headers: signed('/ow/v1/offers') })).data.offers;
    const land = async (slug, click, user) => {
      const ts = now();
      return call(`/ow/${slug}?nw=testnet&click_id=${click}&user_id=${user}&ts=${ts}&sig=${hmac(net.secret, `${slug}.${click}.${user}.${ts}`)}`, { expected: 303 });
    };

    const startsAt = Date.now() + 3 * 3600_000;
    const order = { key: 'live-1', platform: 'naver', title: '겨울 니트 라이브', brand: '오후의 상점', intro: '방송에서만 40% 할인해요. 할인율은 40%!', live_url: 'https://view.shoppinglive.naver.com/lives/123',
      start: kstInput(startsAt), minutes: '60', qty_notify: '30', qty_enter: '100', qty_watch: '50', keyword: '니트특가', watch_minutes: '3', qty_quiz: '100',
      q1_prompt: '방송 할인율은?', q1_c1: '20%', q1_c2: '40%', q1_answer: '2', qty_follow: '30', follow_sns: 'instagram', follow_url: 'https://www.instagram.com/afternoon', follow_verify: 'screenshot',
      qty_coupon: '30', coupon_url: 'https://smartstore.naver.com/afternoon/coupon', qty_signup: '10', signup_url: 'https://shop.example.com/join',
      s1_label: '회원가입', s1_code: 'signup', s1_cost: '500', s2_label: '첫 구매', s2_code: 'purchase', s2_cost: '1000' };

    // 권한·검증
    await post('live/order', participant, order, 403);
    await post('live/order', seller, { ...order, key: 'x1', start: kstInput(Date.now() + 10 * 60_000) }, 400);
    await post('live/order', seller, { ...order, key: 'x2', live_url: 'https://www.youtube.com/live/abc' }, 400);
    await post('live/order', seller, { ...order, key: 'x3', qty_watch: '10' }, 400);
    await post('live/order', seller, { ...order, key: 'x4', s2_cost: '100' }, 400);
    await post('offerwall/offer', seller, { type: 'watch', title: 't', brand: 'b', intro: 'i', goal: '10', start: '2099-01-01', end: '2099-01-02', key: 'w' }, 400);

    const before = (await call('/api/state', { cookie: seller })).data.balances.credit;
    const created = await post('live/order', seller, order);
    const budget = 30 * 200 + 100 * 40 + 50 * 300 + 100 * 100 + 30 * 250 + 30 * 400 + 10 * 1500;
    assert.equal(created.budget, budget);
    assert.match(created.convSecret, /^aws_/, '가입·구매 상품은 전환 비밀키 발급');
    assert.equal((await post('live/order', seller, order)).id, created.id, '같은 요청 키는 한 번만 주문');
    assert.equal((await call('/api/state', { cookie: seller })).data.balances.credit, before - budget);
    const mine = (await call('/api/live/mine', { cookie: seller })).data;
    const view = mine.orders.find(item => item.id === created.id);
    assert.ok(!(await feed()).some(item => view.items.some(entry => entry.slug === item.id)), '심사 전에는 공급하지 않음');
    assert.equal(view.items.length, 7);
    assert.ok(!(await call('/api/offerwall/mine', { cookie: seller })).data.offers.some(item => item.live_id), '오퍼월 광고 목록에는 섞이지 않음');
    await post('live/status', seller, { id: created.id, action: 'approve' }, 409);
    const ours = list => list.filter(item => view.items.some(entry => entry.slug === item.id));

    // 주문 단위 승인 → 노출 구간: 알림 신청·팔로우는 즉시, 시청 확인·입장은 방송 시간에만
    await post('live/status', admin, { id: created.id, action: 'approve' });
    let items = await feed();
    const kinds = ours(items).map(item => item.live.kind).sort();
    assert.deepEqual(kinds, ['follow', 'notify']);
    const notify = ours(items).find(item => item.live?.kind === 'notify');
    assert.equal(notify.action, '라이브 알림 신청하면');
    assert.equal(notify.price, 130, '라이브 배분율 65% 적용');
    assert.equal(notify.live.platform, 'naver');
    assert.ok(notify.closes_at, '노출 종료 시각 전달');

    // 알림 신청: 캡처 업로드 → 검수 승인 → 포스트백
    const n1 = await land(notify.id, 'n-1', 'u-1');
    await call(`/ow/${notify.id}/submit`, { cookie: n1.cookie, body: {}, expected: 400 });
    assert.equal((await call(`/ow/${notify.id}/proof`, { cookie: n1.cookie, raw: fakeJpeg(800, 1200), type: 'image/jpeg', expected: 409 })).data.error.includes('미션'), true, '최소 체류 시간 전 제출 차단');
    await sleep(5200);
    assert.equal((await call(`/ow/${notify.id}/proof`, { cookie: n1.cookie, raw: fakeJpeg(800, 1200), type: 'image/jpeg' })).data.status, 'pending');
    const pending = app.one("SELECT id FROM ow_clicks WHERE click_id='n-1'");
    await post('offerwall/click/review', admin, { id: pending.id, action: 'approve' });
    await waitFor(() => sink.hits.some(hit => hit.searchParams.get('click') === 'n-1'));
    assert.equal(sink.hits.find(hit => hit.searchParams.get('click') === 'n-1').searchParams.get('price'), '130');

    // 방송 시작: 노출 구간을 지금으로 옮기고 시청 확인 최소 시간을 0으로(테스트용)
    const watchId = app.one("SELECT id FROM ow_offers WHERE live_id=? AND live_kind='watch'", created.id).id;
    app.sql('UPDATE ow_offers SET open_at=?, min_dwell=0 WHERE live_id=? AND live_kind IN (?,?,?)', Date.now() - 1000, created.id, 'watch', 'enter', 'quiz');
    items = ours(await feed());
    const watch = items.find(item => item.live?.kind === 'watch');
    assert.ok(watch && items.some(item => item.live?.kind === 'quiz') && items.some(item => item.live?.kind === 'enter'));
    assert.equal(watch.category, 'content');
    assert.ok(!JSON.stringify(watch).includes('니트특가'), '키워드는 피드에 넣지 않음');

    const w1 = await land(watch.id, 'w-1', 'u-1');
    const state = (await call(`/ow/${watch.id}/state`, { cookie: w1.cookie })).data;
    assert.equal(state.offer.type, 'watch');
    assert.equal(state.offer.target, order.live_url);
    assert.ok(!JSON.stringify(state).includes('니트특가'));
    assert.deepEqual((await call(`/ow/${watch.id}/submit`, { cookie: w1.cookie, body: { keyword: '틀린말' } })).data, { status: 'retry', triesLeft: 4 });
    // 셀러가 방송 중 키워드를 바꾸면 새 키워드와(5분간) 이전 키워드를 모두 인정
    await post('live/keyword', participant, { id: created.id, keyword: '새키워드' }, 403);
    await post('live/keyword', seller, { id: created.id, keyword: '두번째' });
    assert.equal(app.one('SELECT keyword, prev_keyword FROM ow_offers WHERE id=?', watchId).prev_keyword, '니트특가');
    const done = (await call(`/ow/${watch.id}/submit`, { cookie: w1.cookie, body: { keyword: '니트 특가' } })).data;
    assert.equal(done.status, 'completed');
    assert.equal(done.url, order.live_url, '완료 후 방송 화면으로 안내');
    const w2 = await land(watch.id, 'w-2', 'u-2');
    assert.equal((await call(`/ow/${watch.id}/submit`, { cookie: w2.cookie, body: { keyword: '두번째' } })).data.status, 'completed');
    await waitFor(() => sink.hits.filter(hit => hit.searchParams.get('click')?.startsWith('w-')).length === 2);
    assert.equal(sink.hits.find(hit => hit.searchParams.get('click') === 'w-1').searchParams.get('price'), '195');

    // 라이브 퀴즈: 정답이면 방송 주소로 이동
    const quiz = items.find(item => item.live?.kind === 'quiz');
    const q1 = await land(quiz.id, 'q-1', 'u-1');
    const quizDone = (await call(`/ow/${quiz.id}/submit`, { cookie: q1.cookie, body: { answers: [1] } })).data;
    assert.deepEqual(quizDone, { status: 'completed', url: order.live_url });

    // 방송 종료: 노출 구간이 끝나면 피드·랜딩에서 빠짐(이미 참여 중인 회원은 유예 시간 안에 제출 가능)
    const w3 = await land(watch.id, 'w-3', 'u-3');
    app.sql('UPDATE ow_offers SET close_at=? WHERE id=?', Date.now() - 1000, watchId);
    assert.ok(!(await feed()).some(item => item.id === watch.id));
    assert.match((await land(watch.id, 'w-4', 'u-4')).response.headers.get('location'), /r=closed/);
    assert.equal((await call(`/ow/${watch.id}/submit`, { cookie: w3.cookie, body: { keyword: '두번째' } })).data.status, 'completed');

    // 셀러가 주문 종료 → 노출 중단, 완료 건만 집행하고 남은 예산 반환, 주문은 정산 완료
    const balanceBefore = (await call('/api/state', { cookie: seller })).data.balances.credit;
    const closed = await post('live/status', seller, { id: created.id, action: 'close' });
    const spent = 200 + 300 * 3 + 100;
    assert.equal(closed.returned, budget - spent);
    assert.equal((await call('/api/state', { cookie: seller })).data.balances.credit, balanceBefore + budget - spent);
    const final = (await call('/api/live/mine', { cookie: seller })).data.orders.find(item => item.id === created.id);
    assert.equal(final.status, 'closed');
    assert.equal(final.totals.spent, spent);
    assert.deepEqual(ours(await feed()), [], '종료한 주문은 모두 내려감');

    // 관리자 목록과 반려 흐름
    const second = await post('live/order', seller, { ...order, key: 'live-2', title: '두 번째 방송', qty_enter: '', qty_watch: '', qty_quiz: '', qty_follow: '', qty_coupon: '', qty_signup: '' });
    assert.equal(second.budget, 30 * 200);
    assert.equal((await call('/api/live?status=review', { cookie: admin })).data.orders.length >= 1, true);
    await post('live/status', admin, { id: second.id, action: 'reject' }, 400);
    await post('live/status', admin, { id: second.id, action: 'reject', reason: '방송 주소 확인 필요' });
    assert.equal(app.one('SELECT status FROM live_orders WHERE id=?', second.id).status, 'rejected');
    await post('live/rates', seller, { share: '70' }, 403);
  } finally {
    sink.close();
    await app.stop();
  }
});
