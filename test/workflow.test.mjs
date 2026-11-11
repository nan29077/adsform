import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

test('로컬 역할 권한, 대행사 수익, 광고 집행과 보상', { timeout: 20000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'adsform-test-'));
  const db = join(dir, 'workflow.sqlite');
  const port = process.env.ADSFORM_TEST_PORT || '4318';
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], {
    env: { ...process.env, ADSFORM_DB: db, ADSFORM_PORT: port, ADSFORM_DEMO: '1', ADSFORM_MIN_DWELL: '0', ADSFORM_PUBLIC_ORIGIN: 'https://adsform.example' },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
  });
  let log = '';
  server.stderr.on('data', chunk => { log += chunk; });
  const exit = once(server, 'exit');

  async function request(path, { cookie, body, expected = 200, site = origin } = {}) {
    const headers = { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { Origin: site, 'Content-Type': 'application/json' } : {}) };
    const result = await fetch(origin + '/api/' + path, { headers, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) });
    const data = await result.json();
    assert.equal(result.status, expected, JSON.stringify(data));
    return { data, cookie: result.headers.get('set-cookie')?.split(';')[0] };
  }
  const session = async role => (await request('demo', { body: { role } })).cookie;
  const state = async cookie => (await request('state', { cookie })).data;
  const post = async (path, cookie, body, expected) => (await request(path, { cookie, body, expected })).data;

  try {
    await Promise.race([once(server.stdout, 'data'), exit.then(() => { throw new Error(log); })]);
    const page = await fetch(origin + '/missions?kind=quiz');
    const html = await page.text();
    assert.match(html, /property="og:url" content="https:\/\/adsform\.example\/missions"/);
    assert.match(html, /property="og:image" content="https:\/\/adsform\.example\/assets\/adsform-share\.jpg"/);
    assert.match(html, /rel="icon" href="\/icon\.svg\?v=2"/);
    assert.doesNotMatch(html, /__ADSFORM_/);
    const thumbnail = await fetch(origin + '/assets/adsform-share.jpg', { method: 'HEAD' });
    assert.equal(thumbnail.status, 200);
    assert.equal(thumbnail.headers.get('content-type'), 'image/jpeg');
    const admin = await session('admin');
    const operator = await session('operator');
    const advertiser = await session('advertiser');
    const participant = await session('participant');
    const operatorId = (await state(operator)).user.id;
    const initialAgency = await session('agency');
    assert.equal((await state(initialAgency)).user.parent_id, operatorId);

    const participantProfile = (await state(participant)).user;
    assert.ok(Number.isInteger(participantProfile.avatar.variant) && participantProfile.avatar.variant >= 0 && participantProfile.avatar.variant < 30);
    assert.equal(participantProfile.avatar.version, null);
    const photo = readFileSync(new URL('./fixtures/profile-photo.jpg', import.meta.url));
    const uploadAvatar = (cookie, account = participantProfile.id, site = origin, body = photo) =>
      fetch(`${origin}/api/profile/avatar?account=${account}`, {
        method: 'POST', headers: { Cookie: cookie, Origin: site, 'Content-Type': 'image/jpeg' }, body
      });
    assert.equal((await uploadAvatar('', participantProfile.id)).status, 401);
    assert.equal((await uploadAvatar(admin)).status, 409);
    assert.equal((await uploadAvatar(participant, participantProfile.id, 'https://other.example')).status, 403);
    assert.equal((await uploadAvatar(participant, participantProfile.id, origin, Buffer.from('not a photo'))).status, 400);
    assert.equal((await uploadAvatar(participant)).status, 200);
    const savedAvatar = (await state(await session('participant'))).user.avatar;
    assert.equal(savedAvatar.variant, participantProfile.avatar.variant);
    assert.ok(savedAvatar.version);
    const photoUrl = `${origin}/api/profile/avatar?v=${savedAvatar.version}`;
    assert.equal((await fetch(photoUrl)).status, 401);
    assert.equal((await fetch(photoUrl, { headers: { Cookie: admin } })).status, 404);
    const servedPhoto = await fetch(photoUrl, { headers: { Cookie: participant } });
    assert.equal(servedPhoto.headers.get('content-type'), 'image/jpeg');
    assert.deepEqual(Buffer.from(await servedPhoto.arrayBuffer()), photo);
    await post('profile/avatar/reset', admin, { account: participantProfile.id }, 409);
    await post('profile/avatar/reset', participant, { account: participantProfile.id });
    assert.deepEqual((await state(participant)).user.avatar, participantProfile.avatar);
    assert.equal((await fetch(photoUrl, { headers: { Cookie: participant } })).status, 404);

    await post('background', operator, { value: 'lilac' }, 403);
    await request('background', { cookie: admin, body: { value: 'lilac' }, site: 'https://other.example', expected: 403 });
    await post('background', admin, { value: 'lilac' });
    assert.equal((await state()).background, 'lilac');
    for (const value of ['studio', 'creator', 'city', 'showroom', 'growth']) {
      await post('background', operator, { value }, 403);
      await post('background', admin, { value });
      assert.equal((await state()).background, value);
    }
    await post('background', admin, { value: 'unknown' }, 400);
    assert.equal((await state()).background, 'growth');
    await post('background', admin, { value: 'lilac' });
    assert.equal((await state()).missions.length, 10);
    assert.equal(Object.hasOwn((await state()).missions[0], 'answer'), false);
    for (const name of ['banner-quiz-photo', 'banner-survey', 'banner-partner', 'wallpaper-grove', 'wallpaper-tide', 'wallpaper-lilac', 'wallpaper-sunset', 'wallpaper-night', 'wallpaper-studio', 'wallpaper-creator', 'wallpaper-city', 'wallpaper-showroom', 'wallpaper-growth', 'avatars-woodland', 'avatars-pets', 'avatars-ocean', 'avatars-safari', 'avatars-garden']) {
      const asset = await fetch(origin + '/assets/' + name + '.webp', { method: 'HEAD' });
      assert.equal(asset.status, 200, name);
      assert.equal(asset.headers.get('content-type'), 'image/webp');
    }

    const inquiry = { subject: '광고 주문 문의', message: '광고 주문 시작일을 설정하는 방법이 궁금합니다.', email: 'local-test@example.test', key: 'test-inquiry' };
    const ticket = await post('inquiry', undefined, inquiry);
    assert.deepEqual(await post('inquiry', undefined, inquiry), ticket);
    await post('inquiry', undefined, { ...inquiry, message: '기존 요청과 다른 내용으로 제출합니다.' }, 409);
    assert.equal(Object.hasOwn(await state(), 'inquiries'), false);
    assert.equal(Object.hasOwn(await state(advertiser), 'inquiries'), false);
    assert.equal((await state(admin)).inquiries.find(item => item.id === ticket.id).reviewed, null);
    await post('inquiry/review', operator, ticket, 403);
    await post('inquiry/review', admin, ticket);
    assert.ok((await state(admin)).inquiries.find(item => item.id === ticket.id).reviewed);

    await post('rates', operator, { rate: '100' }, 403);
    await post('rates', admin, { rate: '7.5' });
    await post('rates', admin, { operator_id: operatorId, rate: '12.34' });
    const credentials = { username: 'qa.agency', password: 'qa-local-example-53' };
    await post('account', operator, { ...credentials, name: '테스트 하위 대행사', role: 'admin' });
    const agency = (await request('login', { body: credentials })).cookie;
    assert.equal((await state(agency)).user.role, 'agency');
    assert.equal((await state(agency)).user.parent_id, operatorId);
    assert.equal((await state(operator)).agencies.some(item => item.username === credentials.username), true);

    const rewardBefore = (await state(participant)).balances.reward;
    const revenueBefore = (await state(operator)).balances.revenue;
    const amount = 100001;
    const charge = await post('charge', agency, { amount, key: 'test-charge' });
    assert.deepEqual(await post('charge', agency, { amount, key: 'test-charge' }), charge);
    await post('charge/decision', operator, { id: charge.id, action: 'approve' }, 403);
    assert.equal((await post('charge/decision', admin, { id: charge.id, action: 'approve' })).commission, 12340);
    await post('charge/decision', admin, { id: charge.id, action: 'approve' }, 409);
    assert.equal((await state(agency)).balances.credit, amount);
    await post('rates', admin, { operator_id: operatorId, rate: '' });
    const operatorState = await state(operator);
    assert.equal(operatorState.rate, 750);
    assert.equal(operatorState.balances.revenue, revenueBefore + 12340);
    assert.equal(operatorState.charges.find(item => item.id === charge.id).rate, 1234);

    const date = (await state(agency)).date;
    const orderData = { kind: 'survey', title: '브랜드 설문 검수', brand: '테스트', details: '설문에 응답해 주세요.', prompt: '이 상품의 장점은 무엇인가요?', goal: '2', start: date, end: date, key: 'test-campaign' };
    const campaign = await post('campaign', agency, orderData);
    assert.deepEqual(await post('campaign', agency, orderData), campaign);
    await post('campaign', agency, { ...orderData, goal: '3' }, 409);
    assert.equal((await state(agency)).balances.credit, amount - 1800);
    assert.equal((await state(advertiser)).campaigns.some(item => item.id === campaign.id), false);
    assert.equal((await state()).missions.some(item => item.id === campaign.id), false);
    await post('campaign/decision', admin, { id: campaign.id, action: 'approve' });
    assert.equal((await state()).missions.some(item => item.id === campaign.id), true);
    await post('mission', agency, { id: campaign.id, response: '광고주는 참여할 수 없습니다.' }, 403);
    const answer = { id: campaign.id, response: '안내가 분명하고 사용하기 편리합니다.' };
    await post('mission', participant, answer, 409);
    const reservation = await post('mission/reserve', participant, { id: campaign.id });
    assert.deepEqual(await post('mission/reserve', participant, { id: campaign.id }), reservation);
    assert.equal((await state(agency)).campaigns.find(item => item.id === campaign.id).reserved, 1);
    assert.equal((await post('mission', participant, answer)).status, 'pending');
    assert.equal((await post('mission', participant, answer)).status, 'pending');
    await post('campaign/decision', admin, { id: campaign.id, action: 'close' }, 409);
    const pending = (await state(admin)).submissions.find(item => item.status === 'pending');
    await post('mission/review', admin, { id: pending.id, action: 'approve' });
    await post('mission/review', admin, { id: pending.id, action: 'approve' }, 409);
    assert.equal((await state(participant)).balances.reward, rewardBefore + 300);
    assert.equal((await state(agency)).campaigns.find(item => item.id === campaign.id).approved, 1);
    await post('campaign/decision', admin, { id: campaign.id, action: 'close' });
    assert.equal((await state(agency)).balances.credit, amount - 900);
    assert.equal((await state(agency)).campaigns.find(item => item.id === campaign.id).returned, 900);

    const quiz = (await state()).missions.find(item => item.kind === 'quiz');
    assert.deepEqual(quiz.choices, []);
    await post('mission/reserve', participant, { id: quiz.id });
    assert.equal((await state(participant)).missions.find(item => item.id === quiz.id).choices.length, 3);
    assert.equal((await post('mission', participant, { id: quiz.id, response: '0' })).status, 'approved');
    await post('mission', participant, { id: quiz.id, response: '0' });
    assert.equal((await state(participant)).balances.reward, rewardBefore + 450);

    const second = { username: 'qa.participant', password: 'qa-local-example-71' };
    await post('account', admin, { ...second, name: '두 번째 참여자', role: 'participant' });
    const otherParticipant = (await request('login', { body: second })).cookie;
    const finalSeat = await post('campaign', agency, { ...orderData, goal: '1', key: 'final-seat' });
    await post('campaign/decision', admin, { id: finalSeat.id, action: 'approve' });
    const attempts = await Promise.allSettled([participant, otherParticipant].map(cookie => post('mission/reserve', cookie, finalSeat)));
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
    assert.match(attempts.find(result => result.status === 'rejected').reason.message, /참여 가능 인원이 찼습니다/);
    const winnerIndex = attempts.findIndex(result => result.status === 'fulfilled');
    const winner = [participant, otherParticipant][winnerIndex];
    const waiting = [otherParticipant, participant][winnerIndex];
    const fixture = new DatabaseSync(db);
    try {
      fixture.prepare('UPDATE reservations SET expires=? WHERE campaign_id=?').run(Date.now() - 1, finalSeat.id);
      await post('mission', winner, { ...answer, id: finalSeat.id }, 409);
      assert.equal((await state()).missions.find(item => item.id === finalSeat.id).remaining, 1);
      await post('mission/reserve', waiting, finalSeat);
      await post('campaign/decision', admin, { id: finalSeat.id, action: 'pause' });
      await post('mission', waiting, { ...answer, id: finalSeat.id }, 409);
      await post('campaign/decision', admin, { id: finalSeat.id, action: 'resume' });
      await post('mission', waiting, { ...answer, id: finalSeat.id }, 409);
      await post('mission/reserve', waiting, finalSeat);
      await post('mission', waiting, { ...answer, id: finalSeat.id });
      const submission = (await state(admin)).submissions.find(item => item.status === 'pending');
      await post('mission/review', admin, { id: submission.id, action: 'approve' });
      const completed = (await state(agency)).campaigns.find(item => item.id === finalSeat.id);
      assert.equal(completed.status, 'closed');
      assert.equal(completed.reason, '목표 건수 달성');

      const expiring = await post('campaign', agency, { ...orderData, key: 'expire-with-review' });
      await post('campaign/decision', admin, { id: expiring.id, action: 'approve' });
      await post('mission/reserve', participant, expiring);
      await post('mission', participant, { ...answer, id: expiring.id });
      const past = new Date(Date.parse(date) - 86_400_000).toISOString().slice(0, 10);
      fixture.prepare('UPDATE campaigns SET start_date=?,end_date=? WHERE id=?').run(past, past, expiring.id);
      const before = await state(agency);
      assert.equal(before.campaigns.find(item => item.id === expiring.id).returned, 0);
      assert.equal((await state()).missions.some(item => item.id === expiring.id), false);
      const toReview = (await state(admin)).submissions.find(item => item.status === 'pending');
      await post('mission/review', admin, { id: toReview.id, action: 'approve' });
      const settled = await state(agency);
      assert.equal(settled.campaigns.find(item => item.id === expiring.id).reason, '집행 기간 종료');
      assert.equal(settled.campaigns.find(item => item.id === expiring.id).returned, 900);
      assert.equal(settled.balances.credit, before.balances.credit + 900);
      assert.equal((await state(agency)).balances.credit, settled.balances.credit);

      const expiredWithoutReview = await post('campaign', agency, { ...orderData, goal: '1', key: 'expire-no-review' });
      fixture.prepare('UPDATE campaigns SET start_date=?,end_date=? WHERE id=?').run(past, past, expiredWithoutReview.id);
      const expired = await state(agency);
      assert.equal(expired.campaigns.find(item => item.id === expiredWithoutReview.id).returned, 900);
      assert.equal(expired.balances.credit, settled.balances.credit);

      const later = new Date(Date.parse(date) + 2 * 86_400_000).toISOString().slice(0, 10);
      await post('campaign', agency, { ...orderData, goal: '3', daily_cap: '1', key: 'cap-too-low' }, 400);
      const capped = await post('campaign', agency, { ...orderData, goal: '3', daily_cap: '1', end: later, memo: '한도 테스트', key: 'daily-cap' });
      await post('campaign/decision', admin, { id: capped.id, action: 'approve' });
      await post('mission/reserve', participant, capped);
      await post('mission', participant, { ...answer, id: capped.id });
      assert.equal((await state()).missions.find(item => item.id === capped.id).remaining, 0);
      await assert.rejects(post('mission/reserve', otherParticipant, capped), /오늘 모집 인원/);

      const report = await request(`report?id=${capped.id}`, { cookie: agency });
      assert.equal(report.data.daily.at(-1).pending, 1);
      assert.equal(report.data.responses[0].who.includes('*'), true);
      await request(`report?id=${capped.id}`, { cookie: advertiser, expected: 404 });
      await post('campaign/memo', advertiser, { id: capped.id, memo: '권한 없음' }, 404);
      await post('campaign/memo', agency, { id: capped.id, memo: '메모 수정' });
      assert.equal((await state(agency)).campaigns.find(item => item.id === capped.id).memo, '메모 수정');

      await post('notice', operator, { title: '공지', body: '내용', audience: 'all' }, 403);
      const notice = await post('notice', admin, { title: '광고 계정 공지', body: '광고 계정에만 보입니다.', audience: 'business' });
      assert.equal((await state(agency)).notices.some(item => item.id === notice.id), true);
      assert.equal((await state(participant)).notices.some(item => item.id === notice.id), false);
      await post('notice/delete', admin, notice);
      assert.equal((await state(agency)).notices.some(item => item.id === notice.id), false);
    } finally {
      fixture.close();
    }
  } finally {
    if (server.exitCode === null) server.kill();
    await exit;
    for (const suffix of ['', '-shm', '-wal']) rmSync(db + suffix, { force: true });
    rmdirSync(dir);
  }
});
