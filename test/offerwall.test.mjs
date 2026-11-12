import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { isPrivateAddress } from '../offerwall.mjs';

const hmac = (secret, text) => createHmac('sha256', secret).update(text).digest('hex');
const sleep = ms => new Promise(done => setTimeout(done, ms));

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
  async function call(path, { cookie, body, expected = 200, headers = {}, method } = {}) {
    const response = await fetch(origin + path, {
      method: method || (body ? 'POST' : 'GET'), redirect: 'manual',
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { Origin: origin, 'Content-Type': 'application/json' } : {}), ...headers },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const type = response.headers.get('content-type') || '';
    const data = type.includes('json') ? await response.json() : await response.text();
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(data)}`);
    return { data, response, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  return {
    origin, db, dir, call,
    admin: async () => (await call('/api/demo', { body: { role: 'admin' } })).cookie,
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
    const url = new URL(req.url, 'http://local');
    hits.push({ url, headers: req.headers });
    const fail = url.searchParams.get('click') === 'flaky' && hits.filter(hit => hit.url.searchParams.get('click') === 'flaky').length === 1;
    res.writeHead(fail ? 500 : 200, { 'Content-Type': 'application/json' });
    res.end(fail ? '{"code":500}' : '{"code":0}');
  });
  return new Promise(done => server.listen(0, '127.0.0.1', () => done({ hits, port: server.address().port, close: () => server.close() })));
}

const quizOffer = (networkId, extra = {}) => ({
  kind: 'quiz', title: '가을 신메뉴 퀴즈', brand: '오후의 상점', intro: '가을 시즌 신메뉴는 밤 라떼입니다. 내용을 읽고 퀴즈를 풀어 주세요.',
  q1_prompt: '가을 시즌 신메뉴는?', q1_c1: '밤 라떼', q1_c2: '딸기 라떼', q1_c3: '수박 주스', q1_answer: '1',
  q2_prompt: '브랜드 이름은?', q2_c1: '오전의 상점', q2_c2: '오후의 상점', q2_answer: '2',
  goal: '3', start: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(), end: '2099-12-31', attempts: '2', min_dwell: '0',
  [`p${networkId}_on`]: 'on', [`p${networkId}_price`]: '120', [`p${networkId}_reward`]: '50', ...extra
});

test('내부망 주소 판별', () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.0.10', '169.254.169.254', '::1', 'fd00::1', '::ffff:127.0.0.1', '100.64.1.1']) assert.ok(isPrivateAddress(address), address);
  for (const address of ['8.8.8.8', '211.249.220.24', '2001:4860:4860::8888']) assert.ok(!isPrivateAddress(address), address);
});

test('오퍼월: 매체 등록, 서명 피드, 서명 랜딩, 퀴즈 판정, 포스트백 재시도', { timeout: 60000 }, async () => {
  const sink = await receiver();
  const app = await start();
  try {
    const { call, post } = app;
    const admin = await app.admin();
    const advertiser = (await call('/api/demo', { body: { role: 'advertiser' } })).cookie;
    const network = { preset: 'buzzvil', code: 'buzzvil', name: '버즈빌', click_param: 'click_id', user_param: 'user_id', sign_landing: 'on',
      postback_url: `http://127.0.0.1:${sink.port}/pb?click={click_id}&tx={transaction_id}&user={user_id}&price={price}&ts={timestamp}&sig={signature}`, postback_method: 'GET' };

    await post('offerwall/network', advertiser, network, 403);
    await post('offerwall/network', admin, { ...network, postback_url: 'ftp://example.com/{click_id}' }, 400);
    await post('offerwall/network', admin, { ...network, postback_url: `http://127.0.0.1:${sink.port}/pb?c={clickid}` }, 400);
    await post('offerwall/network', admin, { ...network, ip_allowlist: '10.0.0.0/99' }, 400);
    const created = await post('offerwall/network', admin, network);
    assert.match(created.apiKey, /^awk_[a-f0-9]{24}$/);
    assert.match(created.secret, /^aws_/);
    await post('offerwall/network', admin, network, 409);
    const { secret, apiKey } = created;

    // 비밀키는 평문으로 저장되지 않고, 관리자 조회에도 나오지 않습니다.
    assert.equal(readFileSync(join(app.dir, 'secret.key'), 'utf8').trim().length, 64, '매체 비밀키 암호화 키 파일');
    const stored = new DatabaseSync(app.db, { readOnly: true }).prepare('SELECT secret_enc FROM ow_networks').get().secret_enc;
    assert.ok(stored.startsWith('v1:') && !stored.includes(secret));
    const overview = (await call('/api/offerwall', { cookie: admin })).data;
    assert.ok(!JSON.stringify(overview).includes(secret));
    assert.equal(overview.networks[0].api_key, apiKey);
    await call('/api/offerwall', { cookie: advertiser, expected: 403 });

    const offer = await post('offerwall/offer', admin, quizOffer(created.id));
    assert.match(offer.slug, /^[A-Za-z0-9_-]{12}$/);
    // 작성 중인 오퍼는 피드·랜딩에 나오지 않습니다.
    const signed = (path, secretKey = secret, key = apiKey, ts = Math.floor(Date.now() / 1000)) => ({
      'X-Adsform-Key': key, 'X-Adsform-Timestamp': String(ts), 'X-Adsform-Signature': hmac(secretKey, `${ts}\nGET\n${path}`)
    });
    assert.equal((await call('/ow/v1/offers', { headers: signed('/ow/v1/offers') })).data.offers.length, 0);
    await post('offerwall/offer/status', admin, { id: offer.id, action: 'activate' });

    // 피드 API 인증
    await call('/ow/v1/offers', { expected: 401 });
    await call('/ow/v1/offers', { headers: signed('/ow/v1/offers', 'wrong-secret'), expected: 401 });
    await call('/ow/v1/offers', { headers: signed('/ow/v1/offers', secret, apiKey, Math.floor(Date.now() / 1000) - 3600), expected: 401 });
    const feed = (await call('/ow/v1/offers', { headers: signed('/ow/v1/offers') })).data;
    assert.equal(feed.offers.length, 1);
    const item = feed.offers[0];
    assert.equal(item.id, offer.slug);
    assert.equal(item.reward, 50);
    assert.equal(item.remaining, 3);
    assert.ok(item.landing_url.includes(`/ow/${offer.slug}?nw=buzzvil&click_id={CLICK_ID}&user_id={USER_ID}&ts={TS}&sig={SIG}`));
    assert.ok(!JSON.stringify(feed).includes('딸기 라떼') && !JSON.stringify(feed).includes('"answer"'), '정답·선택지는 피드에 나오지 않습니다');

    const land = async (click, user, { sig, ts = Math.floor(Date.now() / 1000) } = {}) => {
      const signature = sig ?? hmac(secret, `${offer.slug}.${click}.${user}.${ts}`);
      return call(`/ow/${offer.slug}?nw=buzzvil&click_id=${encodeURIComponent(click)}&user_id=${encodeURIComponent(user)}&ts=${ts}&sig=${signature}`, { expected: 303 });
    };
    // 서명이 틀리거나 오래된 링크는 거절합니다.
    assert.match((await land('c-1', 'u-1', { sig: '0'.repeat(64) })).response.headers.get('location'), /r=signature/);
    assert.match((await land('c-1', 'u-1', { ts: Math.floor(Date.now() / 1000) - 7200 })).response.headers.get('location'), /r=stale/);
    assert.match((await call(`/ow/${offer.slug}?nw=buzzvil&click_id=<script>&user_id=u&ts=1&sig=x`, { expected: 303 })).response.headers.get('location'), /r=params/);

    const first = await land('c-1', 'u-1');
    assert.equal(first.response.headers.get('location'), `/ow/${offer.slug}`);
    assert.match(first.cookie, new RegExp(`^ow_${offer.slug.replace(/-/g, '\\-')}=[a-f0-9]{64}$`));
    assert.match(first.response.headers.get('set-cookie'), /HttpOnly; SameSite=Lax; Path=\/ow\//);
    const page = await call(`/ow/${offer.slug}`, { cookie: first.cookie });
    assert.match(page.data, /<script type="module" src="\/ow.js">/);
    assert.match(page.response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    const view = (await call(`/ow/${offer.slug}/state`, { cookie: first.cookie })).data;
    assert.equal(view.offer.questions.length, 2);
    assert.ok(!JSON.stringify(view).includes('"answer"'), '정답은 참여 화면에 내려가지 않습니다');
    await call(`/ow/${offer.slug}/state`, { expected: 401 });

    // 다른 사이트에서 제출하거나 세션 없이 제출하면 막습니다.
    await call(`/ow/${offer.slug}/submit`, { cookie: first.cookie, body: { answers: [0, 1] }, headers: { Origin: 'https://evil.example' }, expected: 403 });
    await call(`/ow/${offer.slug}/submit`, { body: { answers: [0, 1] }, expected: 401 });
    await call(`/ow/${offer.slug}/submit`, { cookie: first.cookie, body: { answers: [0] }, expected: 400 });
    // 오답 1번 → 재도전, 정답 → 완료
    assert.deepEqual((await call(`/ow/${offer.slug}/submit`, { cookie: first.cookie, body: { answers: [1, 1] } })).data, { status: 'retry', triesLeft: 1 });
    assert.equal((await call(`/ow/${offer.slug}/submit`, { cookie: first.cookie, body: { answers: [0, 1] } })).data.status, 'completed');
    assert.equal((await call(`/ow/${offer.slug}/submit`, { cookie: first.cookie, body: { answers: [0, 1] } })).data.status, 'completed', '두 번 제출해도 한 번만 처리');

    // 같은 클릭 ID를 다른 회원이 재사용하거나, 같은 회원이 다시 들어오면 새 참여가 생기지 않습니다.
    assert.match((await land('c-1', 'u-other')).response.headers.get('location'), /r=used/);
    const again = await land('c-1b', 'u-1');
    assert.equal((await call(`/ow/${offer.slug}/state`, { cookie: again.cookie })).data.click.status, 'completed');

    // 포스트백: 서명과 매크로가 채워져 한 번만 전송
    for (let i = 0; i < 40 && !sink.hits.length; i++) await sleep(100);
    assert.equal(sink.hits.length, 1);
    const hit = sink.hits[0].url.searchParams;
    assert.equal(hit.get('click'), 'c-1');
    assert.equal(hit.get('user'), 'u-1');
    assert.equal(hit.get('price'), '120');
    assert.match(hit.get('tx'), /^adsform-\d+$/);
    assert.equal(hit.get('sig'), hmac(secret, `${hit.get('tx')}.c-1.${hit.get('ts')}`));
    assert.equal(sink.hits[0].headers['x-adsform-signature'], hit.get('sig'));

    // 매체가 클릭 상태를 조회
    const status = (await call('/ow/v1/clicks/c-1', { headers: signed('/ow/v1/clicks/c-1') })).data;
    assert.equal(status.status, 'completed');
    assert.equal(status.postback, 'sent');

    // 오답만 내면 응시 횟수 소진 후 실패, 포스트백 없음
    const loser = await land('c-2', 'u-2');
    await call(`/ow/${offer.slug}/submit`, { cookie: loser.cookie, body: { answers: [2, 0] } });
    assert.equal((await call(`/ow/${offer.slug}/submit`, { cookie: loser.cookie, body: { answers: [2, 0] } })).data.status, 'failed');

    // 매체 서버 오류 시 재시도 대기열에 남고, 관리자가 즉시 재전송할 수 있습니다.
    await post('offerwall/network/update', admin, { ...network, id: created.id, postback_url: `http://127.0.0.1:${sink.port}/pb?click=flaky&tx={transaction_id}` });
    const flaky = await land('c-3', 'u-3');
    assert.equal((await call(`/ow/${offer.slug}/submit`, { cookie: flaky.cookie, body: { answers: [0, 1] } })).data.status, 'completed');
    for (let i = 0; i < 40 && sink.hits.length < 2; i++) await sleep(100);
    await sleep(200);
    let jobs = (await call('/api/offerwall', { cookie: admin })).data.clicks.filter(click => click.postback_status);
    const pending = jobs.find(click => click.click_id === 'c-3');
    assert.equal(pending.postback_status, 'queued');
    assert.equal(pending.last_code, 500);
    await post('offerwall/postback/retry', admin, { id: pending.postback });
    for (let i = 0; i < 40 && sink.hits.length < 3; i++) await sleep(100);
    await sleep(200);
    jobs = (await call('/api/offerwall', { cookie: admin })).data.clicks;
    assert.equal(jobs.find(click => click.click_id === 'c-3').postback_status, 'sent');

    // 목표 3건 중 완료 2건 + 실패 1건 → 남은 1자리, 목표 달성 시 자동 종료
    const fourth = await land('c-4', 'u-4');
    assert.equal((await call(`/ow/${offer.slug}/submit`, { cookie: fourth.cookie, body: { answers: [0, 1] } })).data.status, 'completed');
    assert.equal((await call('/api/offerwall', { cookie: admin })).data.offers[0].status, 'closed');
    assert.match((await land('c-5', 'u-5')).response.headers.get('location'), /r=closed/);

    // 테스트 포스트백, 키 재발급(이전 키는 즉시 무효)
    const tested = await post('offerwall/network/test', admin, { id: created.id });
    assert.equal(tested.code, 200);
    await post('offerwall/network/rotate', admin, { id: created.id, confirm: '' }, 400);
    const rotated = await post('offerwall/network/rotate', admin, { id: created.id, confirm: '재발급' });
    await call('/ow/v1/offers', { headers: signed('/ow/v1/offers'), expected: 401 });
    await call('/ow/v1/offers', { headers: signed('/ow/v1/offers', rotated.secret, rotated.apiKey) });

    // 허용 IP 밖에서 부르면 막습니다.
    await post('offerwall/network/update', admin, { ...network, id: created.id, ip_allowlist: '203.0.113.7' });
    await call('/ow/v1/offers', { headers: signed('/ow/v1/offers', rotated.secret, rotated.apiKey), expected: 403 });

    const actions = new DatabaseSync(app.db, { readOnly: true }).prepare("SELECT action FROM audit WHERE action LIKE '오퍼월%'").all().map(row => row.action);
    for (const action of ['오퍼월 매체 등록', '오퍼월 오퍼 등록', '오퍼월 오퍼 상태 변경', '오퍼월 매체 키 재발급', '오퍼월 포스트백 재전송']) assert.ok(actions.includes(action), action);
  } finally {
    sink.close();
    await app.stop();
  }
});

test('오퍼월: 설문 검수 후 포스트백, IP 한도, 서명 없는 매체, 관리자 미리보기', { timeout: 40000 }, async () => {
  const sink = await receiver();
  const app = await start();
  try {
    const { call, post } = app;
    const admin = await app.admin();
    const network = await post('offerwall/network', admin, { preset: 'adpopcorn', code: 'adpopcorn', name: '애드팝콘', click_param: 'click_key', user_param: 'usn',
      postback_url: `http://127.0.0.1:${sink.port}/cb?ck={click_id}&tx={transaction_id}`, postback_method: 'POST' });
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format();
    const offer = await post('offerwall/offer', admin, { kind: 'survey', title: '매장 경험 설문', brand: '오후의 상점', intro: '최근 매장 방문 경험을 알려 주세요.',
      q1_prompt: '가장 만족스러웠던 점은?', review: 'on', goal: '10', ip_daily_limit: '2', start: today, end: '2099-12-31', min_dwell: '0',
      [`p${network.id}_on`]: 'on', [`p${network.id}_price`]: '300', [`p${network.id}_reward`]: '100' });
    await post('offerwall/offer/status', admin, { id: offer.id, action: 'activate' });
    const land = (click, user) => call(`/ow/${offer.slug}?nw=adpopcorn&click_key=${click}&usn=${user}`, { expected: 303 });

    // 서명 없는 매체 설정에서는 sig 없이 들어올 수 있습니다.
    const member = await land('k-1', 'm-1');
    assert.equal(member.response.headers.get('location'), `/ow/${offer.slug}`);
    await call(`/ow/${offer.slug}/submit`, { cookie: member.cookie, body: { answers: ['ㅋㅋㅋㅋㅋㅋ'] }, expected: 400 });
    assert.equal((await call(`/ow/${offer.slug}/submit`, { cookie: member.cookie, body: { answers: ['직원분이 친절하게 안내해 주셨어요.'] } })).data.status, 'pending');
    await sleep(300);
    assert.equal(sink.hits.length, 0, '검수 전에는 포스트백하지 않습니다');

    // 같은 IP에서 하루 2건까지
    await land('k-2', 'm-2');
    assert.match((await land('k-3', 'm-3')).response.headers.get('location'), /r=ip/);

    const overview = (await call('/api/offerwall', { cookie: admin })).data;
    const pendingClick = overview.clicks.find(click => click.status === 'pending');
    assert.deepEqual(pendingClick.answers, ['직원분이 친절하게 안내해 주셨어요.']);
    assert.equal(overview.counts.pending, 1);
    assert.equal((await call('/api/state', { cookie: admin })).data.adminCounts.offerwallPending, 1);
    await post('offerwall/offer/status', admin, { id: offer.id, action: 'close' }, 409);
    await post('offerwall/click/review', admin, { id: pendingClick.id, action: 'approve' });
    for (let i = 0; i < 40 && !sink.hits.length; i++) await sleep(100);
    assert.equal(sink.hits.length, 1);
    assert.equal(sink.hits[0].url.searchParams.get('ck'), 'k-1');

    // 관리자 미리보기는 기록을 남기지 않습니다.
    const preview = await call(`/ow/${offer.slug}/state?preview=1`, { cookie: admin });
    assert.equal(preview.data.preview, true);
    assert.equal((await call(`/ow/${offer.slug}/submit?preview=1`, { cookie: admin, body: { answers: ['미리보기로 남기는 답변입니다.'] } })).data.preview, true);
    await call(`/ow/${offer.slug}/state?preview=1`, { expected: 401 });
    const rows = new DatabaseSync(app.db, { readOnly: true }).prepare('SELECT COUNT(*) AS total FROM ow_clicks').get().total;
    assert.equal(rows, 2);

    // 진행 중에는 문항을 바꿀 수 없고, 일시중지 후에는 바꿀 수 있습니다.
    const edit = { id: offer.id, title: '매장 경험 설문', brand: '오후의 상점', intro: '최근 매장 방문 경험을 알려 주세요.', q1_prompt: '바뀐 질문', review: 'on',
      goal: '10', ip_daily_limit: '2', start: today, end: '2099-12-31', min_dwell: '0', [`p${network.id}_on`]: 'on', [`p${network.id}_price`]: '300', [`p${network.id}_reward`]: '100' };
    await post('offerwall/offer/update', admin, edit, 409);
    await post('offerwall/offer/status', admin, { id: offer.id, action: 'pause' });
    await post('offerwall/offer/update', admin, edit);
    await post('offerwall/offer/update', admin, { ...edit, goal: '0' }, 400);
  } finally {
    sink.close();
    await app.stop();
  }
});

test('X-Forwarded-For는 프록시가 덧붙인 마지막 주소를 씁니다', { timeout: 20000 }, async () => {
  const app = await start({ ADSFORM_TRUST_PROXY: '1' });
  try {
    // 앞쪽 주소를 바꿔 가며 보내도 같은 접속자로 보고 로그인 시도를 제한합니다.
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
