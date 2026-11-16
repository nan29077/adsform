import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

async function start(env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'adsform-shortform-'));
  const db = join(dir, 'shortform.sqlite');
  const port = String(5600 + Math.floor(Math.random() * 300));
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', fileURLToPath(new URL('../server.mjs', import.meta.url))], {
    env: { ...process.env, ADSFORM_DB: db, ADSFORM_PORT: port, ADSFORM_DEMO: '1', ADSFORM_MIN_DWELL: '0', ...env },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
  });
  let log = '';
  server.stderr.on('data', chunk => { log += chunk; });
  const exit = once(server, 'exit');
  await Promise.race([once(server.stdout, 'data'), exit.then(() => { throw new Error(log); })]);
  async function request(path, { cookie, body, expected = 200, raw } = {}) {
    const result = await fetch(origin + '/api/' + path, {
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body || raw ? { Origin: origin } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(raw ? { 'Content-Type': 'image/jpeg' } : {}) },
      ...(body ? { method: 'POST', body: JSON.stringify(body) } : raw ? { method: 'POST', body: raw } : {})
    });
    const text = result.headers.get('content-type')?.startsWith('image/') ? '' : await result.text();
    assert.equal(result.status, expected, `${path}: ${text.slice(0, 300)}`);
    const data = result.headers.get('content-type')?.startsWith('application/json') ? JSON.parse(text) : text;
    return { data, cookie: result.headers.get('set-cookie')?.split(';')[0], headers: result.headers };
  }
  return {
    db, request,
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

const signup = async (app, role, username, extra = {}) =>
  (await app.request('signup', { body: { role, name: username.replace(/\..*/, ''), username, password: 'pass-word-2026', agree: 'on', ...extra } })).cookie;

test('부업회원 가입·승인, 채널 인증, 숏폼 캠페인 등록·심사·참여·시안·배포 검수·정산·종료', { timeout: 60000 }, async () => {
  const app = await start();
  try {
    const { post, get, state, session, request } = app;
    const admin = await session('admin');

    // 부업회원 가입: 소개·주 활동 SNS 필수, 가입 직후 승인 대기
    await request('signup', { body: { role: 'creator', name: '소개없음', username: 'no.intro', password: 'pass-word-2026', agree: 'on' }, expected: 400 });
    const mint = await signup(app, 'creator', 'mint.one', { intro: '일상 릴스를 주 3회 올려요.', main_platform: 'instagram' });
    let s = await state(mint);
    assert.equal(s.user.role, 'creator');
    assert.equal(s.sfStatus, 'pending');
    assert.equal(s.sfLabel, '부업회원');
    const mintId = s.user.id;
    let me = await get('shortform/me', mint);
    assert.equal(me.profile.status, 'pending');

    // 승인 전에도 채널은 등록할 수 있고, 다른 SNS 주소·중복 채널은 막습니다.
    await post('shortform/channel', mint, { platform: 'instagram', handle: '@mint.real', url: 'https://www.youtube.com/@mint', followers: '500' }, 400);
    const channel = await post('shortform/channel', mint, { platform: 'instagram', handle: '@Mint.Real', url: 'https://www.instagram.com/mint.real', followers: '500' });
    assert.match(channel.code, /^AF-[A-Z0-9]{6}$/);
    await post('shortform/channel', mint, { platform: 'instagram', handle: 'mint.real', url: 'https://www.instagram.com/mint.real', followers: '1' }, 409);
    await get('shortform/admin', mint, 403);

    let overview = await get('shortform/admin?view=creators', admin);
    assert.ok(overview.counts.creators >= 1 && overview.counts.channels >= 1);
    await post('shortform/creator/decision', admin, { id: mintId, action: 'reject' }, 400); // 사유 필수
    await post('shortform/creator/decision', admin, { id: mintId, action: 'reject', reason: '소개가 부족해요' });
    assert.equal((await state(mint)).sfStatus, 'rejected');
    await post('shortform/creator/reapply', mint, { intro: '퇴근 후 뷰티·일상 릴스를 주 3회 올리는 직장인이에요.', main_platform: 'instagram' });
    await post('shortform/creator/decision', admin, { id: mintId, action: 'approve' });
    await post('shortform/channel/decision', admin, { id: channel.id, action: 'verify', followers: '12000' });
    me = await get('shortform/me', mint);
    assert.equal(me.profile.status, 'approved');
    assert.equal(me.channels[0].status, 'verified');
    assert.equal(me.channels[0].followers, 12000);
    assert.equal(me.channels[0].handle, 'mint.real');

    // 광고 계정: 예산 배정·잔액 부족·중복 요청 방지
    const brand = await signup(app, 'advertiser', 'brand.sf');
    const brandId = (await state(brand)).user.id;
    await post('account/adjust', admin, { id: brandId, wallet: 'credit', amount: '400000', reason: '숏폼 테스트' });
    const date = (await state(brand)).date;
    const shift = n => new Date(Date.parse(date) + n * 86_400_000).toISOString().slice(0, 10);
    const base = { mode: 'produce', title: '밤 라떼 숏폼', brand: '오후의 상점', product: '국산 밤을 졸여 만든 가을 음료입니다.', guide: '첫 모금 반응을 15초 안에 담아 주세요.',
      hashtags: '#밤라떼 #광고', length: '30', keep_days: '30', min_followers: '1000', selection: 'auto', draft_review: '1', start: date, end: shift(10) };
    await post('shortform/campaign', brand, { ...base, key: 'big', count_youtube: '100' }, 409); // 3,000,000원 > 잔액
    await post('shortform/campaign', brand, { ...base, key: 'none' }, 400); // 건수 없음
    await post('shortform/campaign', brand, { ...base, mode: 'distribute', key: 'nosrc', count_instagram: '1' }, 400); // 배포 영상 주소 필수
    const created = await post('shortform/campaign', brand, { ...base, key: 'c1', count_instagram: '2', count_tiktok: '1' });
    assert.equal(created.budget, 90000);
    assert.equal((await post('shortform/campaign', brand, { ...base, key: 'c1', count_instagram: '2', count_tiktok: '1' })).id, created.id);
    s = await state(brand);
    assert.equal(s.balances.credit, 310000);
    assert.match(s.ledger.find(item => item.kind === 'sf_reserve').memo, /밤 라떼 숏폼/);
    const campaignId = created.id;

    // 심사 전에는 참여할 수 없고, 다른 광고 계정은 볼 수 없습니다.
    await post('shortform/join', mint, { campaign: campaignId, channel: channel.id, agree: '1' }, 409);
    const other = await signup(app, 'advertiser', 'other.sf');
    await get('shortform/campaign?id=' + campaignId, other, 404);
    await post('shortform/campaign/status', brand, { id: campaignId, action: 'approve' }, 409);
    await post('shortform/campaign/status', admin, { id: campaignId, action: 'approve' });

    // 참여: 동의 필수, 선착순 자동 선정, 캠페인당 1회
    await post('shortform/join', mint, { campaign: campaignId, channel: channel.id }, 400);
    const joined = await post('shortform/join', mint, { campaign: campaignId, channel: channel.id, agree: '1', note: '근처 매장 방문 가능' });
    assert.equal(joined.status, 'accepted');
    await post('shortform/join', mint, { campaign: campaignId, channel: channel.id, agree: '1' }, 409);
    const taskId = joined.id;

    // 시안 검토: 시안 승인 전 게시 불가 → 수정 요청 → 재제출 → 승인
    await post('shortform/task/post', mint, { id: taskId, url: 'https://www.instagram.com/reel/AbCdEf123' }, 409);
    await post('shortform/task/draft', mint, { id: taskId, url: 'https://drive.example.com/draft-1', note: '1차 시안' });
    await post('shortform/task/draft-review', brand, { id: taskId, action: 'revise' }, 400);
    await post('shortform/task/draft-review', other, { id: taskId, action: 'revise', reason: '권한 없음' }, 404);
    await post('shortform/task/draft-review', brand, { id: taskId, action: 'revise', reason: '로고를 마지막에 보여 주세요' });
    me = await get('shortform/me', mint);
    assert.equal(me.tasks[0].status, 'revise');
    assert.equal(me.tasks[0].feedback, '로고를 마지막에 보여 주세요');
    await post('shortform/task/draft', mint, { id: taskId, url: 'https://drive.example.com/draft-2' });
    await post('shortform/task/draft-review', brand, { id: taskId, action: 'approve' });

    // 게시물 주소 검증: 플랫폼 주소·형식·캡처 이미지
    await post('shortform/task/post', mint, { id: taskId, url: 'https://youtube.com/shorts/abcdefg1234' }, 400);
    await post('shortform/task/post', mint, { id: taskId, url: 'https://www.instagram.com/mint.real/' }, 400);
    const photo = readFileSync(new URL('./fixtures/profile-photo.jpg', import.meta.url));
    const asset = (await request('shortform/asset', { cookie: mint, raw: photo })).data;
    await post('shortform/task/post', mint, { id: taskId, url: 'https://www.instagram.com/reel/AbCdEf123/?igsh=xyz', proof_id: String(asset.id) });
    await post('shortform/task/post', mint, { id: taskId, url: 'https://www.instagram.com/reel/AbCdEf123' }, 409);
    // 캡처는 관리자·본인·캠페인 광고주만 볼 수 있습니다.
    await request(`shortform/image?id=${asset.id}`, { cookie: brand });
    await request(`shortform/image?id=${asset.id}`, { cookie: other, expected: 404 });

    // 같은 게시물을 다른 작업에 다시 낼 수 없습니다(운영팀이 만든 부업회원은 바로 승인).
    await post('account', admin, { role: 'creator', name: '한결', username: 'han.sf', password: 'temp-pass-2026' });
    const han = (await request('login', { body: { username: 'han.sf', password: 'temp-pass-2026' } })).cookie;
    assert.equal((await state(han)).sfStatus, 'approved');
    const hanChannel = await post('shortform/channel', han, { platform: 'instagram', handle: 'han.eats', url: 'https://instagram.com/han.eats', followers: '800' });
    await post('shortform/channel/decision', admin, { id: hanChannel.id, action: 'verify', followers: '800' });
    await post('shortform/join', han, { campaign: campaignId, channel: hanChannel.id, agree: '1' }, 409); // 팔로워 1,000명 미만
    await post('shortform/channel/decision', admin, { id: hanChannel.id, action: 'followers', followers: '5000' });
    const hanTask = (await post('shortform/join', han, { campaign: campaignId, channel: hanChannel.id, agree: '1' })).id;
    await post('shortform/task/draft', han, { id: hanTask, url: 'https://drive.example.com/han' });
    await post('shortform/task/draft-review', admin, { id: hanTask, action: 'approve' });
    await post('shortform/task/post', han, { id: hanTask, url: 'https://instagram.com/reel/AbCdEf123' }, 409);
    await post('shortform/task/post', han, { id: hanTask, url: 'https://instagram.com/reel/HanReel999' });

    // 인스타그램 2자리가 모두 찼습니다.
    const third = await signup(app, 'creator', 'third.sf', { intro: '세 번째 회원입니다. 잘 부탁드려요.', main_platform: 'instagram' });
    const thirdId = (await state(third)).user.id;
    await post('shortform/creator/decision', admin, { id: thirdId, action: 'approve' });
    const thirdChannel = await post('shortform/channel', third, { platform: 'instagram', handle: 'third.one', url: 'https://instagram.com/third.one', followers: '3000' });
    await post('shortform/channel/decision', admin, { id: thirdChannel.id, action: 'verify', followers: '3000' });
    await post('shortform/join', third, { campaign: campaignId, channel: thirdChannel.id, agree: '1' }, 409);

    // 배포 검수: 광고 계정은 승인할 수 없고, 관리자 승인 → 정산 보류 → 즉시 정산
    await post('shortform/task/review', brand, { id: taskId, action: 'approve' }, 403);
    await post('shortform/task/metrics', mint, { id: taskId, views: '1540', likes: '88' });
    await post('shortform/campaign/status', brand, { id: campaignId, action: 'close' }, 409); // 검수 대기 배포
    await post('shortform/task/review', admin, { id: taskId, action: 'approve', views: '1800' });
    me = await get('shortform/me', mint);
    assert.equal(me.tasks[0].status, 'approved');
    assert.equal(me.pendingPay, 15000);
    assert.equal(me.balance, 0);
    await post('shortform/task/settle', admin, { id: taskId, action: 'settle' });
    me = await get('shortform/me', mint);
    assert.equal(me.balance, 15000);
    assert.equal(me.tasks[0].status, 'paid');
    assert.equal(me.tasks[0].views, 1800);

    // 수정 요청 → 다시 제출 → 반려하면 자리가 다시 열립니다.
    await post('shortform/task/review', admin, { id: hanTask, action: 'redo', reason: '해시태그가 빠졌어요' });
    await post('shortform/task/post', han, { id: hanTask, url: 'https://instagram.com/reel/HanReel999' });
    await post('shortform/task/review', admin, { id: hanTask, action: 'reject', reason: '가이드 위반' });
    await post('shortform/join', third, { campaign: campaignId, channel: thirdChannel.id, agree: '1' });

    // 광고 리포트: 조회수·참여자 이름 가림·CSV
    const detail = await get('shortform/campaign?id=' + campaignId, brand);
    assert.equal(detail.campaign.totals.done, 1);
    assert.equal(detail.campaign.committed, 30000);
    assert.equal(detail.campaign.totals.views, 1800);
    assert.ok(detail.tasks.every(task => task.creator.includes('*')));
    const csv = await get('shortform/export?id=' + campaignId, brand);
    assert.match(csv, /AbCdEf123/);

    // 연장·증액: 기존 플랫폼은 등록 당시 단가, 새 플랫폼은 현재 단가
    await post('shortform/campaign/extend', brand, { id: campaignId, add_instagram: '1', add_youtube: '1', end: shift(12) });
    s = await state(brand);
    assert.equal(s.balances.credit, 310000 - 60000);

    // 종료: 게시 전 작업은 정리되고, 승인 건만 집행한 나머지가 돌아옵니다.
    const closed = await post('shortform/campaign/status', brand, { id: campaignId, action: 'close' });
    assert.equal(closed.returned, 150000 - 30000);
    s = await state(brand);
    assert.equal(s.balances.credit, 250000 + 120000);
    me = await get('shortform/me', third);
    assert.equal(me.tasks[0].status, 'canceled');
  } finally {
    await app.stop();
  }
});

test('선정형 캠페인, 기한 만료, 정산 보류 자동 정산, 승인 취소 환급, 명칭·단가 설정, 출금, 정지·탈퇴', { timeout: 60000 }, async () => {
  const app = await start();
  try {
    const { post, get, state, session, request } = app;
    const admin = await session('admin');
    const brand = await signup(app, 'advertiser', 'brand.two');
    const brandId = (await state(brand)).user.id;
    await post('account/adjust', admin, { id: brandId, wallet: 'credit', amount: '500000', reason: '테스트' });
    const date = (await state(brand)).date;
    const end = new Date(Date.parse(date) + 7 * 86_400_000).toISOString().slice(0, 10);

    // 명칭·단가·보류 기간 설정
    const policy = (await get('shortform/admin?view=campaigns', admin)).policy;
    const rates = Object.fromEntries(Object.entries(policy.rates).flatMap(([mode, list]) => Object.entries(list).flatMap(([p, r]) => [[`${mode}_${p}_cost`, String(r.cost)], [`${mode}_${p}_pay`, String(r.pay)]])));
    await post('shortform/settings', admin, { ...rates, label: '숏폼크루', hold_days: '0', due_days: '3', max_open: '5', distribute_tiktok_pay: '20000' }, 400); // 지급액 > 단가
    await post('shortform/settings', admin, { ...rates, label: '숏폼크루', hold_days: '2', due_days: '3', max_open: '5', distribute_tiktok_cost: '15000', distribute_tiktok_pay: '7000' });
    assert.equal((await state(brand)).sfLabel, '숏폼크루');
    await post('shortform/settings', brand, { ...rates, label: 'x', hold_days: '0', due_days: '3', max_open: '5' }, 403);

    const crew = await signup(app, 'creator', 'crew.one', { intro: '틱톡 리뷰 계정을 운영하고 있어요.', main_platform: 'tiktok' });
    const crewId = (await state(crew)).user.id;
    await post('shortform/creator/decision', admin, { id: crewId, action: 'approve' });
    const tt = await post('shortform/channel', crew, { platform: 'tiktok', handle: 'crew.tok', url: 'https://www.tiktok.com/@crew.tok', followers: '2000' });
    await post('shortform/channel/decision', admin, { id: tt.id, action: 'verify', followers: '2000' });

    const c = await post('shortform/campaign', brand, { mode: 'distribute', title: '할인 영상 배포', brand: '오후의 상점', product: '블랙프라이데이 기획전 홍보 영상입니다.', guide: '영상을 그대로 올려 주세요.',
      source_url: 'https://example.com/video.mp4', length: '15', keep_days: '14', selection: 'manual', start: date, end, count_tiktok: '2', key: 'm1' });
    assert.equal(c.budget, 30000);
    await post('shortform/campaign/status', admin, { id: c.id, action: 'approve' });

    // 선정형: 신청 → 광고주 선정
    const applied = await post('shortform/join', crew, { campaign: c.id, channel: tt.id, agree: '1' });
    assert.equal(applied.status, 'applied');
    await post('shortform/task/post', crew, { id: applied.id, url: 'https://www.tiktok.com/@crew.tok/video/7311111111111111111' }, 409);
    await post('shortform/task/select', brand, { id: applied.id, action: 'accept' });

    // 다른 계정의 영상은 낼 수 없습니다(틱톡 주소의 계정 확인).
    await post('shortform/task/post', crew, { id: applied.id, url: 'https://www.tiktok.com/@someone/video/7311111111111111111' }, 400);
    await post('shortform/task/post', crew, { id: applied.id, url: 'https://www.tiktok.com/@crew.tok/video/7311111111111111111' });
    await post('shortform/task/review', admin, { id: applied.id, action: 'approve' });

    // 정산 보류가 끝나면 자동 정산(시간을 앞당겨 확인)
    const db = new DatabaseSync(app.db);
    db.prepare('UPDATE sf_tasks SET settle_at=1 WHERE id=?').run(applied.id);
    let me = await get('shortform/me', crew);
    assert.equal(me.tasks.find(t => t.id === applied.id).status, 'paid');
    assert.equal(me.balance, 7000);

    // 기한 만료
    const c2 = await post('shortform/campaign', brand, { mode: 'produce', title: '만료 확인', brand: '오후의 상점', product: '만료를 확인하는 캠페인입니다.', guide: '가이드입니다.',
      length: '30', keep_days: '30', selection: 'auto', start: date, end, count_tiktok: '1', key: 'm2' });
    await post('shortform/campaign/status', admin, { id: c2.id, action: 'approve' });
    const t2 = await post('shortform/join', crew, { campaign: c2.id, channel: tt.id, agree: '1' });
    db.prepare('UPDATE sf_tasks SET due_at=1 WHERE id=?').run(t2.id);
    me = await get('shortform/me', crew);
    assert.equal(me.tasks.find(t => t.id === t2.id).status, 'expired');

    // 종료 후 승인 취소 → 집행액 환급
    const crew2 = await signup(app, 'creator', 'crew.two', { intro: '두 번째 틱톡 계정입니다. 잘 부탁해요.', main_platform: 'tiktok' });
    await post('shortform/creator/decision', admin, { id: (await state(crew2)).user.id, action: 'approve' });
    const tt2 = await post('shortform/channel', crew2, { platform: 'tiktok', handle: 'crew.two', url: 'https://www.tiktok.com/@crew.two', followers: '900' });
    await post('shortform/channel/decision', admin, { id: tt2.id, action: 'verify' });
    const t3 = await post('shortform/join', crew2, { campaign: c.id, channel: tt2.id, agree: '1' });
    await post('shortform/task/select', admin, { id: t3.id, action: 'accept' });
    await post('shortform/task/post', crew2, { id: t3.id, url: 'https://vm.tiktok.com/ZSabc123' });
    await post('shortform/task/review', admin, { id: t3.id, action: 'approve' });
    // 2자리 모두 승인되면 목표 달성으로 자동 종료됩니다(집행 30,000원, 반환 0원).
    const ended = (await get('shortform/mine', brand)).campaigns.find(item => item.id === c.id);
    assert.equal(ended.status, 'closed');
    assert.equal(ended.reason, '목표 배포 달성');
    let s = await state(brand);
    const before = s.balances.credit;
    await post('shortform/task/settle', admin, { id: t3.id, action: 'revoke', reason: '게시물 삭제 확인' });
    s = await state(brand);
    assert.equal(s.balances.credit, before + 15000);
    assert.equal((await get('shortform/me', crew2)).balance, 0);

    // 출금: 부업 수익 10,000원부터
    await post('payout', crew, { amount: '7000', destination: '국민은행 123-45 김크루', key: 'p1' }, 400);
    await post('account/adjust', admin, { id: crewId, wallet: 'earning', amount: '5000', reason: '이벤트' });
    const payout = await post('payout', crew, { amount: '12000', destination: '국민은행 123-45 김크루', key: 'p2' });
    s = await state(crew);
    assert.equal(s.balances.earning, 0);
    await post('payout/decision', admin, { id: payout.id, action: 'approve' });
    assert.ok((await state(crew)).notifications.some(n => n.link === '/manage?tab=sfearn'));

    // 정지: 게시 전 작업 취소, 참여 불가
    const c3 = await post('shortform/campaign', brand, { mode: 'produce', title: '정지 확인', brand: '오후의 상점', product: '정지를 확인하는 캠페인입니다.', guide: '가이드입니다.',
      length: '30', keep_days: '30', selection: 'auto', start: date, end, count_tiktok: '1', key: 'm3' });
    await post('shortform/campaign/status', admin, { id: c3.id, action: 'approve' });
    const t4 = await post('shortform/join', crew, { campaign: c3.id, channel: tt.id, agree: '1' });
    await post('shortform/creator/decision', admin, { id: crewId, action: 'suspend', reason: '가이드 반복 위반' });
    me = await get('shortform/me', crew);
    assert.equal(me.tasks.find(t => t.id === t4.id).status, 'canceled');
    await post('shortform/join', crew, { campaign: c3.id, channel: tt.id, agree: '1' }, 403);

    // 탈퇴: 진행·정산 대기 작업이나 남은 수익이 없어야 합니다.
    await post('shortform/creator/decision', admin, { id: crewId, action: 'activate' });
    await post('account/withdraw', crew, { password: 'pass-word-2026', confirm: '탈퇴' });
    assert.equal((await request('state', { cookie: crew })).data.user, null);
    db.close();
  } finally {
    await app.stop();
  }
});

test('데모 숏폼 데이터와 화면 데이터', { timeout: 30000 }, async () => {
  const app = await start();
  try {
    const { get, session, state } = app;
    const admin = await session('admin');
    const creator = await session('creator');
    const advertiser = await session('advertiser');
    const counts = (await state(admin)).adminCounts;
    assert.ok(counts.shortformPending >= 2 && counts.sfCreatorsPending >= 2);
    const review = await get('shortform/admin?view=review', admin);
    assert.ok(review.posted.length >= 1 && review.holding.length >= 1);
    const tasks = await get('shortform/admin?view=tasks&status=paid', admin);
    assert.ok(tasks.tasks.length >= 1);
    const mine = await get('shortform/mine', advertiser);
    assert.ok(mine.campaigns.length >= 2);
    const me = await get('shortform/me', creator);
    assert.equal(me.profile.status, 'approved');
    assert.ok(me.channels.length >= 2 && me.jobs.length >= 1);
    await get('shortform/me', advertiser, 403);
    await get('shortform/mine', creator, 403);
  } finally {
    await app.stop();
  }
});
