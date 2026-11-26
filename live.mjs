// 라이브 셀러 광고 주문
//
// 라이브커머스 셀러(광고주·대행사·실행사 계정)가 방송 1건을 기준으로 오퍼월 광고를 묶어 주문합니다.
// 주문하면 고른 상품마다 오퍼월 광고(ow_offers)가 하나씩 만들어지고, 운영팀이 주문 단위로 심사·승인하면
// 버즈빌·애드팝콘 등 연동 매체에 방송 시간에 맞춰 자동 공급됩니다. 참여는 매체 회원이 합니다.
//
//  · 상품(노출 구간)
//      라이브 알림 신청  mission(캡처 인증) : 승인 ~ 방송 시작
//      라이브 입장       visit              : 방송 10분 전 ~ 종료
//      라이브 시청 확인  watch(키워드)      : 방송 시작 ~ 종료 · 셀러가 방송 중 말하는 키워드 + 최소 시청 시간
//      라이브 퀴즈       quiz               : 방송 1시간 전 ~ 종료 · 정답 후 방송 화면으로 이동
//      채널 팔로우       follow             : 승인 ~ 방송 7일 후
//      쿠폰 받기         mission(캡처 인증) : 방송 1시간 전 ~ 종료
//      회원가입·구매     cpa(전환 통보)     : 방송 1시간 전 ~ 종료 1일 후 · 자사몰·셀러브릭스 서버가 전환을 알려 줌
//  · 돈의 흐름 : 주문 시 상품별 예산(건당 단가 × 수량)을 잔액에서 배정 → 완료 건만 집행 → 방송이 끝나면 남은 예산 자동 반환
//  · 매체 공급 단가 : 라이브 단가 × 라이브 배분율(live_share, 기본 65%)
//  · 리뷰·구매평·상품찜·검색 유입 같은 순위 조작성 미션은 받지 않습니다(플랫폼 약관·표시광고 규정 위반 소지).

export const livePlatforms = {
  naver: { label: '네이버 쇼핑라이브', hosts: ['naver.com', 'naver.me'], notify: '알림 받기' },
  kakao: { label: '카카오 쇼핑라이브', hosts: ['kakao.com'], notify: '알림 신청' },
  youtube: { label: '유튜브 라이브', hosts: ['youtube.com', 'youtu.be'], notify: '알림 설정' },
  grip: { label: '그립', hosts: ['grip.show'], notify: '알림 받기' },
  coupang: { label: '쿠팡 라이브', hosts: ['coupang.com'], notify: '알림 받기' },
  instagram: { label: '인스타그램 라이브', hosts: ['instagram.com'], notify: '알림 설정' },
  tiktok: { label: '틱톡 라이브', hosts: ['tiktok.com'], notify: '알림 설정' },
  sellerbricks: { label: '셀러브릭스', hosts: ['sellerbricks.co.kr'], notify: '알림 받기' },
  etc: { label: '기타 (자사몰 등)', hosts: null, notify: '알림 받기' }
};

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;
// type: 오퍼월 광고 유형 · cost: 기본 단가(원) · min: 최소 수량 · tag: 매체 오퍼월에 보이는 제목 머리말
export const liveProducts = {
  notify: { label: '라이브 알림 신청', type: 'mission', cost: 200, min: 30, tag: '알림신청', badge: '방송 예정', when: '승인 ~ 방송 시작',
    intro: '방송 전에 알림 신청자를 모아 시작 순간 시청자를 끌어올려요. 알림 설정 화면 캡처를 운영팀이 확인합니다.' },
  enter: { label: '라이브 입장', type: 'visit', cost: 40, min: 100, tag: '라이브', badge: 'LIVE', when: '방송 10분 전 ~ 종료',
    intro: '방송 시간에만 노출해 초반 동시 접속을 만들어요. 방송 화면을 10초 이상 본 회원만 집행합니다.' },
  watch: { label: '라이브 시청 확인', type: 'watch', cost: 300, min: 50, tag: '라이브 시청', badge: 'LIVE', when: '방송 시작 ~ 종료',
    intro: '정한 시간 이상 시청하고, 방송 중 셀러가 말하는 키워드를 입력한 회원만 집행해요. 키워드는 방송 중에 바꿀 수 있어요.' },
  quiz: { label: '라이브 퀴즈', type: 'quiz', cost: 100, min: 100, tag: '라이브 퀴즈', badge: '퀴즈', when: '방송 1시간 전 ~ 종료',
    intro: '상품·혜택 퀴즈를 맞히면 방송 화면으로 바로 이동해요. 방송 직전 유입과 상품 인지에 좋아요.' },
  follow: { label: '채널 팔로우', type: 'follow', cost: 250, min: 30, tag: '팔로우', badge: '', when: '승인 ~ 방송 7일 후',
    intro: '유튜브·인스타그램·카카오톡 채널 등 다음 방송의 모수가 될 팔로워를 모아요.' },
  coupon: { label: '쿠폰 받기', type: 'mission', cost: 400, min: 30, tag: '쿠폰', badge: '쿠폰', when: '방송 1시간 전 ~ 종료',
    intro: '방송 쿠폰을 받은 화면을 캡처해 올린 회원만 집행해요. 운영팀이 확인합니다.' },
  signup: { label: '회원가입·구매', type: 'cpa', cost: 1500, min: 10, tag: '라이브 미션', badge: '멀티미션', when: '방송 1시간 전 ~ 종료 1일 후',
    intro: '자사몰·셀러브릭스 서버가 가입·구매 완료를 알려 주면 단계별로 집행돼요. 전환은 참여 후 30일까지 받습니다.' }
};
// 주문 화면에서 수량을 한 번에 채우는 추천 구성
export const livePackages = {
  starter: { label: '라이브 스타터', intro: '첫 방송 · 초반 동시 접속', items: { notify: 300, enter: 1000 } },
  boost: { label: '라이브 부스트', intro: '정기 방송 · 추천 노출', items: { notify: 500, watch: 300, follow: 200 } },
  sales: { label: '라이브 세일즈', intro: '한정 특가 · 신상품 런칭', items: { quiz: 1000, coupon: 200, watch: 300 } }
};

// 상품별 노출 구간 [open_at, close_at] (null은 승인 즉시)
const windows = (kind, startsAt, endsAt) => ({
  notify: [null, startsAt],
  enter: [startsAt - 10 * minute, endsAt],
  watch: [startsAt, endsAt],
  quiz: [startsAt - hour, endsAt],
  follow: [null, endsAt + 7 * day],
  coupon: [startsAt - hour, endsAt],
  signup: [startsAt - hour, endsAt + day]
})[kind];

const kstDate = ms => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date(ms));
const kstLabel = ms => new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' }).format(new Date(ms));

export function setupLive(ctx, ow) {
  const { db, get, all, run, transaction, audit, notify, balance, won, assert, fail, str, int, now, dateKst, dayStart, setting, demo } = ctx;
  const { offerFields, insertOffer, changeStatus, finish, offerView, offerStats, httpsUrl, isAdmin, partnerRoles } = ow;

  db.exec(`
    CREATE TABLE IF NOT EXISTS live_orders (
      id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL, brand TEXT NOT NULL, intro TEXT NOT NULL,
      platform TEXT NOT NULL, live_url TEXT NOT NULL, starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL, budget INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('review','active','closed','rejected','canceled')), reason TEXT NOT NULL DEFAULT '',
      created TEXT NOT NULL, updated TEXT, request_key TEXT, UNIQUE (owner_id, request_key)
    );
    CREATE INDEX IF NOT EXISTS live_orders_owner ON live_orders(owner_id, id);
  `);
  for (const [kind, item] of Object.entries(liveProducts)) run('INSERT OR IGNORE INTO settings VALUES (?, ?)', `live_cost_${kind}`, String(item.cost));
  const costs = () => Object.fromEntries(Object.keys(liveProducts).map(kind => [kind, Number(setting(`live_cost_${kind}`))]));

  // 매체 피드에 방송 정보를 함께 보냅니다(매체가 '방송 중' 표시·정렬에 쓸 수 있게).
  ow.setLiveInfo(offer => {
    const order = get('SELECT platform, starts_at, ends_at FROM live_orders WHERE id=?', offer.live_id);
    return order ? { kind: offer.live_kind, platform: order.platform, platform_label: livePlatforms[order.platform]?.label || '', starts_at: new Date(order.starts_at).toISOString(),
      ends_at: new Date(order.ends_at).toISOString(), on_air: order.starts_at <= Date.now() && Date.now() < order.ends_at } : { kind: offer.live_kind };
  });

  function kstTime(value) {
    const text = str(value, '방송 시작 시각', 16, 16);
    assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text), '방송 시작 시각을 확인해 주세요.');
    const ms = Date.parse(`${text}:00+09:00`);
    assert(Number.isFinite(ms) && kstDate(ms) === text.slice(0, 10), '방송 시작 시각을 확인해 주세요.');
    return ms;
  }

  /* ---------- 주문 ---------- */
  // 상품별 오퍼월 광고 내용을 만듭니다. 검증은 오퍼월 광고와 같은 규칙(offerFields)을 그대로 씁니다.
  function itemFields(user, kind, order, body, unit) {
    const product = liveProducts[kind];
    const platform = livePlatforms[order.platform];
    const goal = int(body[`qty_${kind}`], `${product.label} 수량`, product.min, 100000);
    const [openAt, closeAt] = windows(kind, order.startsAt, order.endsAt);
    const when = `방송: ${kstLabel(order.startsAt)} · ${platform.label}`;
    const base = { type: product.type, title: `[${product.tag}] ${order.title}`.slice(0, 60), brand: order.brand, badge: product.badge, goal: String(goal),
      start: openAt ? kstDate(Math.max(openAt, Date.now())) : dateKst(), end: kstDate(closeAt), icon_id: body.icon_id, banner_id: body.banner_id, ip_daily_limit: '30' };
    const extra = {
      notify: () => ({ target_url: order.liveUrl, min_dwell: '5', intro: `${order.intro}\n\n${when}\n방송 페이지에서 ‘${platform.notify}’를 눌러 주세요.`,
        guide: str(body.notify_guide || `방송 페이지에서 ‘${platform.notify}’를 누른 뒤, 알림 설정이 완료된 화면을 캡처해 올려 주세요.`, '알림 신청 안내', 300) }),
      enter: () => ({ target_url: order.liveUrl, repeat: 'once', min_dwell: '10', intro: `${order.intro}\n\n${when}\n방송 화면을 10초 이상 보고 입장하면 적립돼요.` }),
      watch: () => {
        const watchMinutes = int(body.watch_minutes || '3', '최소 시청 시간(분)', 1, 10);
        assert(watchMinutes < order.minutes, '최소 시청 시간은 방송 시간보다 짧아야 합니다.');
        return { target_url: order.liveUrl, keyword: body.keyword, min_dwell: String(watchMinutes * 60),
          intro: `${order.intro}\n\n${when}\n방송을 ${watchMinutes}분 이상 시청하고, 방송 중 셀러가 알려 주는 키워드를 입력하면 적립돼요.`,
          guide: `방송 중 화면이나 셀러 멘트로 공개되는 키워드를 입력해 주세요.` };
      },
      quiz: () => ({ target_url: order.liveUrl, attempts: '2', min_dwell: '5', intro: `${order.intro}\n\n${when}\n퀴즈를 맞히면 방송 화면으로 이동해요.` }),
      follow: () => ({ sns: body.follow_sns, target_url: body.follow_url, verify: body.follow_verify, keyword: body.follow_keyword, guide: body.follow_guide || '', min_dwell: '5',
        intro: `${order.intro}\n\n다음 방송 소식을 받을 수 있게 채널을 팔로우해 주세요.` }),
      coupon: () => ({ target_url: body.coupon_url, min_dwell: '5', intro: `${order.intro}\n\n${when}\n방송 쿠폰을 받고 받은 화면을 캡처해 올려 주세요.`,
        guide: str(body.coupon_guide || '쿠폰을 받은 뒤 ‘다운로드 완료’ 또는 쿠폰함 화면을 캡처해 올려 주세요.', '쿠폰 안내', 300) }),
      signup: () => ({ target_url: body.signup_url, guide: body.signup_guide || '', intro: `${order.intro}\n\n${when}\n가입·구매를 마치면 단계별로 자동 적립돼요.`,
        ...Object.fromEntries([1, 2, 3, 4, 5].flatMap(n => ['label', 'code', 'cost'].map(part => [`s${n}_${part}`, body[`s${n}_${part}`]])))
      })
    }[kind]();
    if (kind === 'quiz') for (let n = 1; n <= 3; n++) for (const part of ['prompt', 'c1', 'c2', 'c3', 'c4', 'answer']) extra[`q${n}_${part}`] = body[`q${n}_${part}`];
    const f = offerFields(user, { ...base, ...extra });
    if (product.type === 'cpa') assert(f.cost >= unit.signup, `회원가입·구매 미션의 단계 단가 합계는 ${won(unit.signup)} 이상이어야 합니다.`);
    else f.cost = unit[kind];
    return { kind, f, openAt, closeAt };
  }

  function createOrder(user, body) {
    assert(partnerRoles.includes(user.role), '라이브 광고는 광고주·대행사·실행사 계정에서 주문할 수 있어요.', 403);
    const key = str(body.key, '요청 키', 64);
    assert(Object.hasOwn(livePlatforms, body.platform), '방송 플랫폼을 선택해 주세요.');
    const startsAt = kstTime(body.start);
    const minutes = int(body.minutes, '방송 시간(분)', 10, 360);
    const order = { platform: body.platform, title: str(body.title, '방송 제목', 40), brand: str(body.brand, '스토어·셀러명', 40), intro: str(body.intro, '방송 소개', 600),
      liveUrl: httpsUrl(body.live_url, '방송 주소', livePlatforms[body.platform].hosts), startsAt, minutes, endsAt: startsAt + minutes * minute };
    assert(startsAt >= Date.now() + hour, '방송 시작 1시간 전까지 주문해 주세요. 심사와 매체 반영에 시간이 필요해요.');
    assert(startsAt <= Date.now() + 60 * day, '방송 60일 전부터 주문할 수 있어요.');
    const chosen = Object.keys(liveProducts).filter(kind => body[`qty_${kind}`] !== undefined && body[`qty_${kind}`] !== '' && body[`qty_${kind}`] !== '0');
    assert(chosen.length, '광고 상품을 1개 이상 골라 주세요.');
    const unit = costs();
    const items = chosen.map(kind => itemFields(user, kind, order, body, unit));
    const total = items.reduce((sum, item) => sum + item.f.cost * item.f.goal, 0);
    return transaction(() => {
      const existing = get('SELECT id, title FROM live_orders WHERE owner_id=? AND request_key=?', user.id, key);
      if (existing) {
        assert(existing.title === order.title, '이미 접수된 요청입니다. 주문 화면을 새로 열어 다시 작성해 주세요.', 409);
        return { id: existing.id };
      }
      assert(balance(user.id, 'credit') >= total, `광고 잔액이 부족합니다. 예산 ${won(total)}이 필요해요.`, 409);
      const id = Number(run(`INSERT INTO live_orders(owner_id,title,brand,intro,platform,live_url,starts_at,ends_at,budget,status,created,request_key)
        VALUES (?,?,?,?,?,?,?,?,?,'review',?,?)`, user.id, order.title, order.brand, order.intro, order.platform, order.liveUrl, startsAt, order.endsAt, total, now(), key).lastInsertRowid);
      const secrets = [];
      for (const item of items) {
        const saved = insertOffer(user, item.f, { owned: true, live: { id, kind: item.kind, openAt: item.openAt, closeAt: item.closeAt }, status: 'review' });
        if (saved.convSecret) secrets.push({ slug: saved.slug, convSecret: saved.convSecret });
      }
      audit(user.id, '라이브 광고 주문', `live-order:${id}`, `${order.title} · ${kstLabel(startsAt)} · ${chosen.map(kind => liveProducts[kind].label).join('·')} · 예산 ${won(total)}`);
      return { id, budget: total, ...(secrets[0] ? { slug: secrets[0].slug, convSecret: secrets[0].convSecret } : {}) };
    });
  }

  const orderFor = (user, id) => {
    const order = get('SELECT * FROM live_orders WHERE id=?', id);
    assert(order && (isAdmin(user) || order.owner_id === user.id), '주문을 찾을 수 없습니다.', 404);
    return order;
  };

  // 주문 단위 심사·취소·종료. 상품별 광고 상태를 한꺼번에 바꾸고, 광고 계정에는 주문 단위로 한 번만 알립니다.
  function orderStatus(user, body) {
    const id = int(body.id, '주문 번호', 1, 1e9);
    return transaction(() => {
      const order = orderFor(user, id);
      const admin = isAdmin(user);
      const allowed = admin ? { review: ['approve', 'reject'], active: ['close'] } : { review: ['cancel'], active: ['close'] };
      assert(allowed[order.status]?.includes(body.action), '현재 상태에서 처리할 수 없습니다.', 409);
      const offers = all('SELECT * FROM ow_offers WHERE live_id=? ORDER BY id', id);
      const link = '/manage?tab=liveads';
      if (body.action === 'approve') {
        assert(order.ends_at > Date.now(), '이미 끝난 방송입니다. 반려해 주세요.', 409);
        let skipped = 0;
        for (const offer of offers.filter(item => item.status === 'review')) {
          // 승인 시점에 이미 노출 구간이 지난 상품(예: 방송 시작 뒤 승인한 알림 신청)은 집행하지 않고 예산을 돌려줍니다.
          if (offer.close_at !== null && offer.close_at <= Date.now()) { finish(offer, 'canceled', '승인 시점에 노출 시간이 지남', user.id, true); skipped++; continue; }
          changeStatus(user, offer, 'approve', '', { quiet: true });
        }
        run("UPDATE live_orders SET status='active', reason='', updated=? WHERE id=?", now(), id);
        notify(order.owner_id, 'offerwall', `라이브 광고 ‘${order.title}’ 심사 승인`, `${kstLabel(order.starts_at)} 방송에 맞춰 오퍼월 매체에 공급합니다.${skipped ? ` 노출 시간이 지난 상품 ${skipped}개는 예산을 돌려드렸어요.` : ''}`, link);
        audit(user.id, '라이브 광고 승인', `live-order:${id}`, order.title);
        return {};
      }
      if (body.action === 'reject' || body.action === 'cancel') {
        const reason = body.action === 'reject' ? str(body.reason, '반려 사유', 200) : '';
        for (const offer of offers.filter(item => item.status === 'review')) changeStatus(user, offer, body.action, reason, { quiet: true });
        const status = body.action === 'reject' ? 'rejected' : 'canceled';
        run('UPDATE live_orders SET status=?, reason=?, updated=? WHERE id=?', status, body.action === 'reject' ? `심사 반려 · ${reason}` : '광고주 취소', now(), id);
        if (admin) notify(order.owner_id, 'offerwall', `라이브 광고 ‘${order.title}’ 심사 반려`, `${reason} · 배정된 예산 ${won(order.budget)}을 잔액으로 돌려드렸어요.`, link);
        audit(user.id, body.action === 'reject' ? '라이브 광고 반려' : '라이브 광고 취소', `live-order:${id}`, reason || order.title);
        return { returned: order.budget };
      }
      // 종료: 노출을 바로 멈추고, 검수 대기 참여가 없는 상품은 즉시 정산합니다(남은 상품은 검수 후 자동 정산).
      let returned = 0;
      let waiting = 0;
      for (const offer of offers.filter(item => ['active', 'paused'].includes(item.status))) {
        run('UPDATE ow_offers SET close_at=? WHERE id=?', Date.now(), offer.id);
        if (get("SELECT 1 FROM ow_clicks WHERE offer_id=? AND status='pending'", offer.id)) { waiting++; continue; }
        returned += finish(offer, 'closed', admin ? '운영자 종료' : '광고주 종료', user.id, true);
      }
      run('UPDATE live_orders SET reason=?, updated=? WHERE id=?', waiting ? '종료 요청 · 검수 대기 참여 확인 후 정산' : admin ? '운영자 종료' : '광고주 종료', now(), id);
      audit(user.id, '라이브 광고 종료', `live-order:${id}`, `${order.title}${returned ? ` · 반환 ${won(returned)}` : ''}`);
      settle(order.id);
      return { returned, waiting };
    });
  }

  // 방송 중 시청 확인 키워드 바꾸기. 바꾼 직후 5분은 이전 키워드도 인정합니다.
  function changeKeyword(user, body) {
    const id = int(body.id, '주문 번호', 1, 1e9);
    const keyword = str(body.keyword, '시청 확인 키워드', 20, 2);
    return transaction(() => {
      const order = orderFor(user, id);
      assert(['review', 'active'].includes(order.status), '진행 중인 주문만 키워드를 바꿀 수 있어요.', 409);
      const changed = run(`UPDATE ow_offers SET prev_keyword=CASE WHEN keyword<>? THEN keyword ELSE prev_keyword END, keyword_at=CASE WHEN keyword<>? THEN ? ELSE keyword_at END, keyword=?, updated=?
        WHERE live_id=? AND type='watch' AND status IN ('review','active','paused')`, keyword, keyword, Date.now(), keyword, now(), id).changes;
      assert(changed, '시청 확인 상품이 없거나 이미 끝났어요.', 409);
      audit(user.id, '라이브 시청 키워드 변경', `live-order:${id}`, order.title);
      return { keyword };
    });
  }

  function saveRates(user, body) {
    const text = String(body.share ?? '').trim();
    const share = Math.round(Number(text) * 100);
    assert(/^\d{1,3}(\.\d{1,2})?$/.test(text) && share >= 0 && share <= 10000, '라이브 매체 배분율은 0~100% 사이로 입력해 주세요.');
    const next = Object.fromEntries(Object.keys(liveProducts).map(kind => [kind, int(body[`cost_${kind}`], `${liveProducts[kind].label} 단가`, 1, 1000000)]));
    return transaction(() => {
      run("UPDATE settings SET value=? WHERE key='live_share'", String(share));
      for (const [kind, cost] of Object.entries(next)) run('UPDATE settings SET value=? WHERE key=?', String(cost), `live_cost_${kind}`);
      audit(user.id, '라이브 광고 단가 설정', 'live-rates', `배분 ${share / 100}% · ${Object.entries(next).map(([kind, cost]) => `${liveProducts[kind].label} ${cost}`).join(' · ')}`);
      return {};
    });
  }

  // 상품 광고가 모두 끝난 주문을 종료로 정리하고, 광고 계정에 한 번만 결과를 알립니다.
  function settle(id) {
    const order = get('SELECT * FROM live_orders WHERE id=?', id);
    if (!order || !['review', 'active'].includes(order.status)) return;
    if (get("SELECT 1 FROM ow_offers WHERE live_id=? AND status IN ('review','active','paused','draft')", id)) return;
    const totals = get(`SELECT COALESCE(SUM(v.cost),0) AS spent, COUNT(v.id) AS done FROM ow_conversions v JOIN ow_clicks c ON c.id=v.click_ref JOIN ow_offers o ON o.id=c.offer_id WHERE o.live_id=?`, id);
    const returned = Math.max(0, order.budget - totals.spent);
    const status = order.status === 'review' ? 'canceled' : 'closed';
    run("UPDATE live_orders SET status=?, reason=CASE WHEN reason='' OR reason LIKE '종료 요청%' THEN ? ELSE reason END, updated=? WHERE id=?", status, status === 'canceled' ? '방송 전 승인되지 않음' : '방송 종료 · 정산 완료', now(), id);
    notify(order.owner_id, 'offerwall', `라이브 광고 ‘${order.title}’ ${status === 'canceled' ? '취소' : '정산 완료'}`,
      status === 'canceled' ? `방송 전에 승인되지 않아 예산 ${won(order.budget)}을 돌려드렸어요.` : `완료 ${totals.done.toLocaleString('ko-KR')}건 · 집행 ${won(totals.spent)}${returned ? ` · 남은 예산 ${won(returned)}을 잔액으로 돌려드렸어요.` : ''}`, '/manage?tab=liveads');
  }
  function sweep() {
    const open = all("SELECT id FROM live_orders WHERE status IN ('review','active')");
    if (!open.length) return;
    ow.sweep();
    transaction(() => { for (const order of open) settle(order.id); });
  }
  setInterval(() => { try { sweep(); } catch (error) { console.error('live sweep', error); } }, 60_000).unref();

  /* ---------- 조회 ---------- */
  function phase(order) {
    if (order.status !== 'active') return order.status;
    const time = Date.now();
    return time < order.starts_at ? 'scheduled' : time < order.ends_at ? 'onair' : 'aired';
  }

  function orderView(order, admin) {
    const offers = all(`SELECT o.*, ${offerStats} FROM ow_offers o WHERE o.live_id=? ORDER BY o.id`, dayStart(), order.id).map(offer => offerView(offer, true));
    const sum = key => offers.reduce((total, offer) => total + (offer[key] || 0), 0);
    return { id: order.id, title: order.title, brand: order.brand, intro: order.intro, platform: order.platform, platform_label: livePlatforms[order.platform]?.label || order.platform,
      live_url: order.live_url, starts_at: order.starts_at, ends_at: order.ends_at, status: order.status, phase: phase(order), reason: order.reason, budget: order.budget, created: order.created,
      ...(admin ? { owner: get('SELECT name FROM users WHERE id=?', order.owner_id)?.name || '' } : {}),
      keyword: offers.find(offer => offer.type === 'watch')?.keyword || '',
      totals: { spent: sum('spent'), completed: sum('completed'), pending: sum('pending'), landings: sum('landings'), returned: sum('returned'), today: sum('today') },
      items: offers.map(offer => ({ id: offer.id, slug: offer.slug, kind: offer.live_kind, label: liveProducts[offer.live_kind]?.label || offer.title, type: offer.type, status: offer.status,
        reason: offer.reason, goal: offer.goal, cost: offer.cost, budget: offer.budget, completed: offer.completed, pending: offer.pending, landings: offer.landings, today: offer.today,
        spent: offer.spent, returned: offer.returned, open_at: offer.open_at, close_at: offer.close_at, steps: offer.steps, has_conv_key: offer.has_conv_key,
        ...(admin ? { placements: offer.placements, paid: offer.paid } : {}) })) };
  }

  const catalog = () => ({ products: liveProducts, packages: livePackages, platforms: Object.fromEntries(Object.entries(livePlatforms).map(([key, item]) => [key, { label: item.label, hosts: item.hosts }])),
    costs: costs(), share: Number(setting('live_share')) });

  function mine(user) {
    assert(user, '로그인이 필요합니다.', 401);
    assert(partnerRoles.includes(user.role), '이 기능을 사용할 권한이 없습니다.', 403);
    const orders = all('SELECT * FROM live_orders WHERE owner_id=? ORDER BY id DESC LIMIT 100', user.id).map(order => orderView(order, false));
    return { ...catalog(), orders, balance: balance(user.id, 'credit'), networks: get("SELECT COUNT(*) AS total FROM ow_networks WHERE status='active'").total, now: Date.now() };
  }

  function adminList(user, params) {
    assert(user, '로그인이 필요합니다.', 401);
    assert(isAdmin(user), '이 기능을 사용할 권한이 없습니다.', 403);
    const status = ['review', 'active', 'closed', 'rejected', 'canceled'].includes(params.get('status')) ? params.get('status') : '';
    const orders = all(`SELECT * FROM live_orders WHERE (?='' OR status=?) ORDER BY (status='review') DESC, (status='active') DESC, starts_at ASC, id DESC LIMIT 200`, status, status)
      .map(order => orderView(order, true));
    const counts = Object.fromEntries(all('SELECT status, COUNT(*) AS total FROM live_orders GROUP BY status').map(row => [row.status, row.total]));
    return { ...catalog(), orders, counts, networks: get("SELECT COUNT(*) AS total FROM ow_networks WHERE status='active'").total, now: Date.now() };
  }

  const business = handler => (req, res, user, body) => {
    assert(user, '로그인이 필요합니다.', 401);
    assert(isAdmin(user) || partnerRoles.includes(user.role), '이 기능을 사용할 권한이 없습니다.', 403);
    return handler(user, body, req);
  };
  const adminOnly = handler => (req, res, user, body) => {
    assert(user, '로그인이 필요합니다.', 401);
    assert(isAdmin(user), '이 기능을 사용할 권한이 없습니다.', 403);
    return handler(user, body, req);
  };

  // 데모: 광고주 계정에 내일 저녁 방송 주문 1건을 승인된 상태로 만들어 셀러 화면과 오퍼월 노출을 바로 볼 수 있게 합니다.
  if (demo && !get("SELECT value FROM settings WHERE key='live_demo'")) {
    try {
      const advertiser = get("SELECT * FROM users WHERE username='demo.advertiser'");
      const admin = get("SELECT * FROM users WHERE username='demo.admin'");
      if (advertiser && admin && get("SELECT 1 FROM ow_networks WHERE status='active'")) {
        const start = kstDate(Date.now() + day) + 'T20:00';
        const created = createOrder(advertiser, { key: 'demo-live', platform: 'naver', title: '겨울 니트 라이브 특가', brand: '오후의 상점', live_url: 'https://view.shoppinglive.naver.com/lives/demo',
          intro: '오후의 상점 겨울 니트를 방송에서만 40% 할인해요.', start, minutes: '60', qty_notify: '300', qty_watch: '200', keyword: '니트특가', watch_minutes: '3',
          qty_quiz: '500', q1_prompt: '방송 할인율은?', q1_c1: '20%', q1_c2: '40%', q1_c3: '60%', q1_answer: '2' });
        orderStatus(admin, { id: created.id, action: 'approve' });
      }
      run("INSERT INTO settings VALUES ('live_demo', ?)", now());
    } catch (error) {
      console.error('live demo', error.message);
    }
  }

  return {
    routes: {
      '/api/live/order': business(createOrder),
      '/api/live/status': business(orderStatus),
      '/api/live/keyword': business(changeKeyword),
      '/api/live/rates': adminOnly(saveRates)
    },
    getRoutes: {
      '/api/live/mine': user => mine(user),
      '/api/live': (user, params) => adminList(user, params)
    },
    counts: () => ({ review: get("SELECT COUNT(*) AS total FROM live_orders WHERE status='review'").total })
  };
}
