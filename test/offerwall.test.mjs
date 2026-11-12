import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { isPrivateAddress, jpegSize } from '../offerwall.mjs';

const hmac = (secret, text) => createHmac('sha256', secret).update(text).digest('hex');
const sleep = ms => new Promise(done => setTimeout(done, ms));
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format();
const now = () => Math.floor(Date.now() / 1000);
// 구조 검사를 통과하는 최소 JPEG(SOI · SOF0 · EOI)
const fakeJpeg = (width, height) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255]), Buffer.alloc(10), Buffer.from([0xff, 0xd9])]);

async function start(env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'adsform-ow-'));
  const db = join(dir, 'ow.sqlite');
  const port = String(5000 + Math.floor(Math.random() * 500));
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', fileURLToPath(new URL('../server.mjs', import.meta.url))], {
    env: { ...process.env, ADSFORM_DB: db, ADSFORM_PORT: port, ADSFORM_DEMO: '1', ADSFORM_MIN_DWELL: '0', ADSFORM_OFFERWALL_ALLOW_PRIVATE: '1', ...env },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
  });
  let log = '';
  server.stderr.on('data', chunk => { log += chunk; });
  const exit = once(server, 'exit');
  await Promise.race([once(server.stdout, 'data'), exit.then(() => { throw new Error(log); })]);
  async function call(path, { cookie, body, raw, type, expected = 200, headers = {}, origin: from = origin } = {}) {
    const response = await fetch(origin + path, {
      method: body || raw ? 'POST' : 'GET', redirect: 'manual',
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body || raw ? { Origin: from, 'Content-Type': type || 'application/json' } : {}), ...headers },
      ...(body ? { body: JSON.stringify(body) } : raw ? { body: raw } : {})
    });
    const kind = response.headers.get('content-type') || '';
    const data = kind.includes('json') ? await response.json() : await response.text();
    assert.equal(response.status, expected, `${path}: ${typeof data === 'string' ? data.slice(0, 200) : JSON.stringify(data)}`);
    return { data, response, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  return {
    origin, db, dir, call,
    db$: () => new DatabaseSync(db, { readOnly: true }),
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
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const url = new URL(req.url, 'http://local');
      hits.push({ url, headers: req.headers, body });
      const fail = url.searchParams.get('flaky') === '1' && hits.filter(hit => hit.url.searchParams.get('flaky') === '1').length === 1;
      res.writeHead(fail ? 500 : 200, { 'Content-Type': 'application/json' });
      res.end(fail ? '{"code":500}' : '{"code":0}');
    });
  });
  return new Promise(done => server.listen(0, '127.0.0.1', () => done({ hits, port: server.address().port, close: () => server.close() })));
}
const waitFor = async (check, tries = 50) => { for (let i = 0; i < tries && !check(); i++) await sleep(100); };

const network = (app, admin, sink, extra = {}) => app.post('offerwall/network', admin, { preset: 'custom', code: 'testnet', name: '테스트 매체', click_param: 'click_id', user_param: 'user_id',
  sign_landing: 'on', reward_rate: '200', point_unit: '캐시', postback_method: 'GET',
  postback_url: `http://127.0.0.1:${sink.port}/pb?click={click_id}&tx={transaction_id}&user={user_id}&ev={event}&price={price}&reward={reward}&ts={timestamp}&sig={signature}`, ...extra });
const signedGet = (path, secret, key, ts = now()) => ({ 'X-Adsform-Key': key, 'X-Adsform-Timestamp': String(ts), 'X-Adsform-Signature': hmac(secret, `${ts}\nGET\n${path}`) });
const landUrl = (net, slug, click, user, ts = now(), sig) => `/ow/${slug}?nw=testnet&click_id=${encodeURIComponent(click)}&user_id=${encodeURIComponent(user)}&ts=${ts}&sig=${sig ?? hmac(net.secret, `${slug}.${click}.${user}.${ts}`)}`;

test('내부망 주소 판별과 JPEG 크기 검사', () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.0.10', '169.254.169.254', '::1', 'fd00::1', '::ffff:127.0.0.1', '100.64.1.1']) assert.ok(isPrivateAddress(address), address);
  for (const address of ['8.8.8.8', '211.249.220.24', '2001:4860:4860::8888']) assert.ok(!isPrivateAddress(address), address);
  assert.deepEqual(jpegSize(fakeJpeg(256, 256)), { width: 256, height: 256 });
  assert.equal(jpegSize(Buffer.from('<svg></svg>')), null);
});

test('광고 계정 등록 → 예산 배정 → 심사 승인 → 서명 피드·랜딩 → 퀴즈 완료 → 집행·포스트백 → 종료 반환', { timeout: 60000 }, async () => {
  const sink = await receiver();
  const app = await start();
  try {
    const { call, post } = app;
    const admin = await app.login('admin');
    const advertiser = await app.login('advertiser');
    const participant = await app.login('participant');
    await post('offerwall/network', advertiser, { preset: 'custom', code: 'x1', name: 'x', click_param: 'click_id', user_param: 'user_id' }, 403);
    await post('offerwall/network', admin, { preset: 'custom', code: 'x1', name: 'x', click_param: 'click_id', user_param: 'user_id', postback_url: 'ftp://example.com/{click_id}' }, 400);
    await post('offerwall/network', admin, { preset: 'custom', code: 'x1', name: 'x', click_param: 'click_id', user_param: 'user_id', ip_allowlist: '10.0.0.0/99' }, 400);
    const net = await network(app, admin, sink);
    assert.match(net.secret, /^aws_/);
    assert.equal(readFileSync(join(app.dir, 'secret.key'), 'utf8').trim().length, 64);
    const inspectionDb = app.db$();
    try {
      const stored = inspectionDb.prepare("SELECT secret_enc FROM ow_networks WHERE code='testnet'").get().secret_enc;
      assert.ok(stored.startsWith('v1:') && !stored.includes(net.secret), '비밀키는 암호화해 저장');
    } finally {
      inspectionDb.close();
    }
    assert.ok(!JSON.stringify((await call('/api/offerwall', { cookie: admin })).data).includes(net.secret));

    // 광고 등록: 단가 × 목표만큼 예산 배정, 참여자 계정은 등록 불가
    const quiz = { type: 'quiz', title: '가을 신메뉴 퀴즈', brand: '오후의 상점', intro: '가을 시그니처 음료는 밤 라떼입니다.', q1_prompt: '시그니처 음료는?', q1_c1: '밤 라떼', q1_c2: '딸기 라떼', q1_answer: '1',
      q2_prompt: '브랜드는?', q2_c1: '오전의 상점', q2_c2: '오후의 상점', q2_answer: '2', goal: '3', start: today(), end: '2099-12-31', attempts: '2', min_dwell: '0', key: 'quiz-1' };
    await post('offerwall/offer', participant, quiz, 403);
    const before = (await call('/api/state', { cookie: advertiser })).data.balances.credit;
    const created = await post('offerwall/offer', advertiser, quiz);
    assert.deepEqual(await post('offerwall/offer', advertiser, quiz), { id: created.id, slug: created.slug }, '같은 요청 키는 한 번만 등록');
    assert.equal((await call('/api/state', { cookie: advertiser })).data.balances.credit, before - 80 * 3);
    const signed = path => signedGet(path, net.secret, net.apiKey);
    assert.ok(!(await call('/ow/v1/offers', { headers: signed('/ow/v1/offers') })).data.offers.some(item => item.id === created.slug), '심사 전에는 공급하지 않음');
    await post('offerwall/offer/status', advertiser, { id: created.id, action: 'approve' }, 409);
    await post('offerwall/offer/status', admin, { id: created.id, action: 'approve' });

    // 피드: 인증, 유형·카테고리·리워드(공급 단가 48원 × 환산 200% = 96캐시), 정답 미포함
    await call('/ow/v1/offers', { expected: 401 });
    await call('/ow/v1/offers', { headers: signedGet('/ow/v1/offers', 'wrong', net.apiKey), expected: 401 });
    await call('/ow/v1/offers', { headers: signedGet('/ow/v1/offers', net.secret, net.apiKey, now() - 3600), expected: 401 });
    const feed = (await call('/ow/v1/offers', { headers: signed('/ow/v1/offers') })).data;
    const item = feed.offers.find(offer => offer.id === created.slug);
    assert.equal(item.category, 'join');
    assert.equal(item.action, '퀴즈 맞히면');
    assert.equal(item.price, 48);
    assert.equal(item.reward, 96);
    assert.equal(item.point_unit, '캐시');
    assert.ok(feed.wall_url.includes('/ow/wall?nw=testnet&user_id={USER_ID}&ts={TS}&sig={SIG}'));
    assert.ok(!JSON.stringify(item).includes('딸기') && !JSON.stringify(item).includes('answer'));

    // 랜딩: 서명·시각 검사, 클릭 정보는 쿠키로 옮기고 깨끗한 주소로 이동
    assert.match((await call(landUrl(net, created.slug, 'c-1', 'u-1', now(), '0'.repeat(64)), { expected: 303 })).response.headers.get('location'), /r=signature/);
    assert.match((await call(landUrl(net, created.slug, 'c-1', 'u-1', now() - 7200), { expected: 303 })).response.headers.get('location'), /r=stale/);
    const first = await call(landUrl(net, created.slug, 'c-1', 'u-1'), { expected: 303 });
    assert.equal(first.response.headers.get('location'), `/ow/${created.slug}`);
    assert.match(first.response.headers.get('set-cookie'), /HttpOnly; SameSite=Lax; Path=\/ow\//);
    const view = (await call(`/ow/${created.slug}/state`, { cookie: first.cookie })).data;
    assert.equal(view.offer.reward, 96);
    assert.ok(!JSON.stringify(view).includes('"answer"'));
    await call(`/ow/${created.slug}/submit`, { cookie: first.cookie, body: { answers: [0, 1] }, origin: 'https://evil.example', expected: 403 });
    assert.deepEqual((await call(`/ow/${created.slug}/submit`, { cookie: first.cookie, body: { answers: [1, 1] } })).data, { status: 'retry', triesLeft: 1 });
    assert.equal((await call(`/ow/${created.slug}/submit`, { cookie: first.cookie, body: { answers: [0, 1] } })).data.status, 'completed');
    assert.equal((await call(`/ow/${created.slug}/submit`, { cookie: first.cookie, body: { answers: [0, 1] } })).data.status, 'completed');
    assert.match((await call(landUrl(net, created.slug, 'c-1', 'u-other'), { expected: 303 })).response.headers.get('location'), /r=used/);

    // 포스트백: 매크로·서명, 한 번만
    await waitFor(() => sink.hits.length >= 1);
    await sleep(200);
    assert.equal(sink.hits.length, 1);
    const hit = sink.hits[0].url.searchParams;
    assert.equal(hit.get('click'), 'c-1');
    assert.equal(hit.get('ev'), 'done');
    assert.equal(hit.get('reward'), '96');
    assert.equal(hit.get('sig'), hmac(net.secret, `${hit.get('tx')}.c-1.${hit.get('ts')}`));
    assert.equal((await call('/ow/v1/clicks/c-1', { headers: signed('/ow/v1/clicks/c-1') })).data.status, 'completed');

    // 광고 계정 현황: 집행 80원
    const mineOffer = (await call('/api/offerwall/mine', { cookie: advertiser })).data.offers.find(offer => offer.id === created.id);
    assert.equal(mineOffer.spent, 80);
    assert.equal(mineOffer.completed, 1);
    await call('/api/offerwall/mine', { cookie: admin, expected: 403 });

    // 연장·증액은 추가 예산 배정, 종료 시 미집행 반환
    await post('offerwall/offer/extend', advertiser, { id: created.id, goal: '5', end: '2099-12-31' });
    assert.equal((await call('/api/state', { cookie: advertiser })).data.balances.credit, before - 80 * 5);
    await post('offerwall/offer/status', advertiser, { id: created.id, action: 'close' });
    const after = (await call('/api/state', { cookie: advertiser })).data;
    assert.equal(after.balances.credit, before - 80);
    assert.ok(after.ledger.some(row => row.kind === 'ow_release' && row.amount === 320 && row.memo.includes('가을 신메뉴 퀴즈')));
    assert.match((await call(landUrl(net, created.slug, 'c-9', 'u-9'), { expected: 303 })).response.headers.get('location'), /r=closed/);

    // 반려하면 예산 전액 반환
    const rejected = await post('offerwall/offer', advertiser, { ...quiz, key: 'quiz-2' });
    await post('offerwall/offer/status', admin, { id: rejected.id, action: 'reject' }, 400);
    await post('offerwall/offer/status', admin, { id: rejected.id, action: 'reject', reason: '브랜드 확인 필요' });
    assert.equal((await call('/api/state', { cookie: advertiser })).data.balances.credit, before - 80);

    // 키 재발급 후 이전 키 무효, 허용 IP 밖 차단
    const rotated = await post('offerwall/network/rotate', admin, { id: net.id, confirm: '재발급' });
    await call('/ow/v1/offers', { headers: signed('/ow/v1/offers'), expected: 401 });
    await call('/ow/v1/offers', { headers: signedGet('/ow/v1/offers', rotated.secret, rotated.apiKey) });
    await post('offerwall/network/update', admin, { id: net.id, name: '테스트 매체', click_param: 'click_id', user_param: 'user_id', sign_landing: 'on', reward_rate: '200', point_unit: '캐시', ip_allowlist: '203.0.113.7' });
    await call('/ow/v1/offers', { headers: signedGet('/ow/v1/offers', rotated.secret, rotated.apiKey), expected: 403 });
  } finally {
    sink.close();
    await app.stop();
  }
});

test('호스팅 오퍼월: 포인트 받기·조회, 매일 방문, 팔로우 인증(키워드·캡처), 이미지, 포스트백 재시도', { timeout: 60000 }, async () => {
  const sink = await receiver();
  const app = await start();
  try {
    const { call, post } = app;
    const admin = await app.login('admin');
    const advertiser = await app.login('advertiser');
    const net = await network(app, admin, sink, { postback_url: `http://127.0.0.1:${sink.port}/pb?click={click_id}&tx={transaction_id}&ev={event}&flaky=1` });

    // 아이콘 업로드: 크기·형식·출처 검사
    await call('/api/offerwall/asset?kind=icon', { cookie: advertiser, raw: fakeJpeg(100, 100), type: 'image/jpeg', expected: 400 });
    await call('/api/offerwall/asset?kind=icon', { cookie: advertiser, raw: Buffer.from('<svg/>'), type: 'image/svg+xml', expected: 415 });
    await call('/api/offerwall/asset?kind=icon', { cookie: advertiser, raw: fakeJpeg(256, 256), type: 'image/jpeg', origin: 'https://evil.example', expected: 403 });
    const icon = (await call('/api/offerwall/asset?kind=icon', { cookie: advertiser, raw: fakeJpeg(256, 256), type: 'image/jpeg' })).data;
    assert.equal((await call(`/ow/img/${icon.id}`)).response.headers.get('cross-origin-resource-policy'), 'cross-origin');

    const base = { brand: '오후의 상점', intro: '소개', goal: '10', start: today(), end: '2099-12-31', min_dwell: '0' };
    const visit = await post('offerwall/offer', advertiser, { ...base, type: 'visit', title: '최고의 할인', target_url: 'https://example.com/sale', repeat: 'daily', icon_id: String(icon.id), key: 'v1' });
    await post('offerwall/offer', advertiser, { ...base, type: 'visit', title: 'http', target_url: 'http://example.com', key: 'v2' }, 400);
    await post('offerwall/offer', advertiser, { ...base, type: 'follow', title: '유튜브', sns: 'youtube', target_url: 'https://evil.example/x', verify: 'keyword', keyword: '가을', key: 'f0' }, 400);
    const keyword = await post('offerwall/offer', advertiser, { ...base, type: 'follow', title: '인스타그램', sns: 'instagram', target_url: 'https://www.instagram.com/example', verify: 'keyword', keyword: '가을 상점', key: 'f1' });
    const shot = await post('offerwall/offer', advertiser, { ...base, type: 'follow', title: '유튜브 구독', sns: 'youtube', target_url: 'https://www.youtube.com/@example', verify: 'screenshot', key: 'f2' });
    for (const id of [visit.id, keyword.id, shot.id]) await post('offerwall/offer/status', admin, { id, action: 'approve' });

    // 오퍼월 진입: 서명 필수
    const member = 'member-7';
    const ts = now();
    assert.match((await call(`/ow/wall?nw=testnet&user_id=${member}&ts=${ts}&sig=${'0'.repeat(64)}`, { expected: 303 })).response.headers.get('location'), /r=signature/);
    const entry = await call(`/ow/wall?nw=testnet&user_id=${member}&ts=${ts}&sig=${hmac(net.secret, `wall.${member}.${ts}`)}`, { expected: 303 });
    assert.equal(entry.response.headers.get('location'), '/ow/wall');
    const wallCookie = entry.cookie;
    const wall = (await call('/ow/wall/state', { cookie: wallCookie })).data;
    assert.equal(wall.network.unit, '캐시');
    const visitItem = wall.offers.find(item => item.id === visit.slug);
    assert.equal(visitItem.category, 'visit');
    assert.equal(visitItem.action, '페이지 방문하면');
    assert.ok(visitItem.icon_url.endsWith(`/ow/img/${icon.id}`));
    assert.equal(wall.offers.find(item => item.id === keyword.slug).action, '인스타그램 팔로우하면');
    await call('/ow/wall/state', { expected: 401 });

    // 매일 방문: 완료 즉시 광고 주소, 같은 날 다시 열면 완료 상태
    const opened = await call('/ow/wall/open', { cookie: wallCookie, body: { offer: visit.slug } });
    assert.deepEqual((await call(`/ow/${visit.slug}/submit`, { cookie: opened.cookie, body: {} })).data, { status: 'completed', url: 'https://example.com/sale' });
    const again = await call('/ow/wall/open', { cookie: wallCookie, body: { offer: visit.slug } });
    const againState = (await call(`/ow/${visit.slug}/state`, { cookie: `${again.cookie}; ${wallCookie}` })).data;
    assert.equal(againState.click.status, 'completed');
    assert.equal(againState.wall, true);

    // 포스트백 1차 실패 → 재시도 대기 → 관리자 재전송 성공
    await waitFor(() => sink.hits.length >= 1);
    await sleep(200);
    let clicks = (await call('/api/offerwall', { cookie: admin })).data.clicks;
    const job = clicks.find(click => click.offer_id === visit.id).postbacks[0];
    assert.equal(job.status, 'queued');
    assert.equal(job.last_code, 500);
    await post('offerwall/postback/retry', admin, { id: job.id });
    await waitFor(() => sink.hits.length >= 2);
    await sleep(200);
    clicks = (await call('/api/offerwall', { cookie: admin })).data.clicks;
    assert.equal(clicks.find(click => click.offer_id === visit.id).postbacks[0].status, 'sent');
    assert.match(sink.hits[0].url.searchParams.get('click'), /^w_[a-f0-9]{24}$/, '오퍼월에서 연 참여는 애즈폼이 클릭 ID를 만듭니다');

    // 팔로우 키워드: 공백 무시, 틀리면 재시도
    const follow = await call('/ow/wall/open', { cookie: wallCookie, body: { offer: keyword.slug } });
    assert.equal((await call(`/ow/${keyword.slug}/submit`, { cookie: follow.cookie, body: { keyword: '봄 상점' } })).data.status, 'retry');
    assert.equal((await call(`/ow/${keyword.slug}/submit`, { cookie: follow.cookie, body: { keyword: '가을상점' } })).data.status, 'completed');

    // 팔로우 캡처: 검수 대기 → 승인 시 포스트백, 인증 화면은 관리자·광고주만 열람
    const proof = await call('/ow/wall/open', { cookie: wallCookie, body: { offer: shot.slug } });
    await call(`/ow/${shot.slug}/proof`, { cookie: proof.cookie, raw: fakeJpeg(50, 50), type: 'image/jpeg', expected: 400 });
    assert.equal((await call(`/ow/${shot.slug}/proof`, { cookie: proof.cookie, raw: fakeJpeg(720, 1280), type: 'image/jpeg' })).data.status, 'pending');
    const pendingClick = (await call('/api/offerwall?status=pending', { cookie: admin })).data.clicks[0];
    assert.ok(pendingClick.proof_id);
    await call(`/api/offerwall/proof?id=${pendingClick.proof_id}`, { cookie: admin });
    await call(`/api/offerwall/proof?id=${pendingClick.proof_id}`, { cookie: advertiser });
    await call(`/api/offerwall/proof?id=${pendingClick.proof_id}`, { cookie: await app.login('agency'), expected: 404 });
    await call(`/ow/img/${pendingClick.proof_id}`, { expected: 404 });
    const before = sink.hits.length;
    await post('offerwall/click/review', admin, { id: pendingClick.id, action: 'approve' });
    await waitFor(() => sink.hits.length > before);

    // 포인트 조회
    const check = (await call('/ow/wall/state', { cookie: wallCookie })).data;
    assert.equal(check.totals.count, 3);
    assert.equal(check.history.length, 3);
    assert.equal(check.totals.earned, check.history.reduce((sum, row) => sum + row.reward, 0));
    assert.equal(check.offers.find(item => item.id === visit.slug).state, 'completed');
    assert.equal((await call('/ow/wall/state?preview=1', { cookie: admin })).data.preview, true);
  } finally {
    sink.close();
    await app.stop();
  }
});

test('미션형(CPA): 전환 비밀키, 서명된 단계 통보, 중복·위조 차단, 단계별 포스트백, 예산 소진 종료', { timeout: 60000 }, async () => {
  const sink = await receiver();
  const app = await start();
  try {
    const { call, post } = app;
    const admin = await app.login('admin');
    const advertiser = await app.login('advertiser');
    const net = await network(app, admin, sink);
    const base = { type: 'cpa', title: '[멀티미션] 앱 가입하고 첫 주문', brand: '오후의 상점', intro: '가입하고 첫 주문하면 단계별 적립', target_url: 'https://example.com/app?ref=ow', goal: '1', start: today(), end: '2099-12-31', min_dwell: '', ip_daily_limit: '' };
    await post('offerwall/offer', advertiser, { ...base, s1_label: '가입', s1_code: 'signup', s1_cost: '100', key: 'c0' }, 400); // 최소 합계 300원
    const cpa = await post('offerwall/offer', advertiser, { ...base, s1_label: '회원가입', s1_code: 'signup', s1_cost: '300', s2_label: '첫 주문', s2_code: 'purchase', s2_cost: '700', key: 'c1' });
    assert.match(cpa.convSecret, /^aws_/);
    await post('offerwall/offer/status', admin, { id: cpa.id, action: 'approve' });
    const land = await call(landUrl(net, cpa.slug, 'cpa-1', 'm-1'), { expected: 303 });
    const target = new URL((await call(`/ow/${cpa.slug}/submit`, { cookie: land.cookie, body: {} })).data.url);
    assert.equal(target.searchParams.get('ref'), 'ow');
    const ref = target.searchParams.get('adsform_click');
    assert.match(ref, /^[a-f0-9]{24}$/);

    const send = (event, expected, { secret = cpa.convSecret, ts = now(), click = ref } = {}) => {
      const body = JSON.stringify({ click, event });
      return call('/ow/v1/conversions', { raw: body, expected, headers: { 'X-Adsform-Offer': cpa.slug, 'X-Adsform-Timestamp': String(ts),
        'X-Adsform-Signature': hmac(secret, `${ts}\nPOST\n/ow/v1/conversions\n${createHash('sha256').update(body).digest('hex')}`) } });
    };
    await send('signup', 401, { secret: 'aws_wrong' });
    await send('signup', 401, { ts: now() - 3600 });
    await send('unknown', 400);
    await send('signup', 404, { click: 'f'.repeat(24) });
    assert.deepEqual((await send('signup', 200)).data, { status: 'accepted', completed: false });
    assert.deepEqual((await send('signup', 200)).data, { status: 'duplicate' });
    assert.equal((await call(`/ow/${cpa.slug}/state`, { cookie: land.cookie })).data.click.done.join(), 'signup');
    assert.deepEqual((await send('purchase', 200)).data, { status: 'accepted', completed: true });
    await waitFor(() => sink.hits.length >= 2);
    assert.deepEqual(sink.hits.map(hit => hit.url.searchParams.get('ev')).sort(), ['purchase', 'signup']);
    assert.ok(sink.hits.every(hit => hit.url.searchParams.get('click') === 'cpa-1'));
    assert.deepEqual(sink.hits.map(hit => hit.url.searchParams.get('tx').replace(/\d+/, 'N')).sort(), ['adsform-N-purchase', 'adsform-N-signup']);
    // 목표 1건 · 예산 1,000원 모두 집행 → 자동 종료
    const mine = (await call('/api/offerwall/mine', { cookie: advertiser })).data.offers.find(offer => offer.id === cpa.id);
    assert.equal(mine.spent, 1000);
    assert.equal(mine.status, 'closed');
    const rotated = await post('offerwall/offer/convkey', advertiser, { id: cpa.id });
    assert.notEqual(rotated.convSecret, cpa.convSecret);
  } finally {
    sink.close();
    await app.stop();
  }
});

test('X-Forwarded-For는 프록시가 덧붙인 마지막 주소를 씁니다', { timeout: 20000 }, async () => {
  const app = await start({ ADSFORM_TRUST_PROXY: '1' });
  try {
    for (let i = 0; i < 30; i++) {
      await app.call('/api/login', { body: { username: `nobody${i}`, password: 'wrong-pass-1' }, headers: { 'X-Forwarded-For': `1.1.1.${i}, 9.9.9.9` }, expected: 401 });
    }
    await app.call('/api/login', { body: { username: 'nobody', password: 'wrong-pass-1' }, headers: { 'X-Forwarded-For': '2.2.2.2, 9.9.9.9' }, expected: 429 });
    const headers = (await app.call('/api/state')).response.headers;
    assert.equal(headers.get('x-frame-options'), 'DENY');
    assert.match(headers.get('permissions-policy'), /camera=\(\)/);
  } finally {
    await app.stop();
  }
});
