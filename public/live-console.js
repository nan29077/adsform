// 콘솔의 라이브 셀러 광고 메뉴
//  · 광고주·대행사·실행사 '라이브 셀러 광고' : 방송 1건 단위 주문(상품·수량·예산), 방송별 진행 현황, 시청 키워드 변경, 전환 연동
//  · 최고관리자 '라이브 주문 심사'          : 주문 단위 승인·반려·종료, 라이브 단가·배분율
export function setupLiveConsole(h) {
  const { api, esc, format, field, textarea, select, btn, empty, panelHead, icon, modal, dialog, dateTime, showToast, decision } = h;
  let data = null;
  const minute = 60_000;
  const phases = { review: ['심사 대기', 'pending'], scheduled: ['방송 예정', 'paused'], onair: ['방송 중', 'active'], aired: ['방송 종료 · 정산 중', 'pending'],
    closed: ['종료', 'withdrawn'], rejected: ['반려', 'rejected'], canceled: ['취소', 'withdrawn'] };
  const itemStatus = { review: ['심사 대기', 'pending'], active: ['공급 중', 'active'], paused: ['일시중지', 'paused'], draft: ['작성 중', 'paused'], closed: ['종료', 'withdrawn'], rejected: ['반려', 'rejected'], canceled: ['취소', 'withdrawn'] };
  const tag = ([label, cls]) => `<span class="status ${cls}">${label}</span>`;
  const percent = (part, whole) => whole ? Math.round(part / whole * 1000) / 10 : 0;
  const strip = items => `<div class="summary-strip">${items.map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('')}</div>`;
  const when = (open, close, order) => `${open ? dateTime(open) : '승인 즉시'} ~ ${close ? dateTime(close) : dateTime(order.ends_at)}`;
  // datetime-local 입력값(한국 시간)
  const kstInput = ms => new Date(ms + 9 * 60 * minute).toISOString().slice(0, 16);
  const tomorrowEvening = () => {
    const today = kstInput(Date.now()).slice(0, 10);
    return `${new Date(Date.parse(today) + 86_400_000).toISOString().slice(0, 10)}T20:00`;
  };

  /* ---------- 주문 카드 ---------- */
  function orderCard(order, admin) {
    const transitions = admin ? { review: [['approve', '승인 · 공급 예약'], ['reject', '반려']], active: [['close', '지금 종료']] } : { review: [['cancel', '주문 취소']], active: [['close', '지금 종료']] };
    const watch = order.items.find(item => item.kind === 'watch' && ['review', 'active', 'paused'].includes(item.status));
    const signup = order.items.find(item => item.kind === 'signup' && !['closed', 'rejected', 'canceled'].includes(item.status));
    const goal = order.items.reduce((sum, item) => sum + item.goal, 0);
    const left = Math.max(0, order.budget - order.totals.spent - order.totals.returned);
    return `<article class="panel order-card live-order"><div class="row-top"><span class="eyebrow">${esc(order.platform_label)} · 주문 #${order.id}${admin ? ` · ${esc(order.owner)}` : ''}</span>${tag(phases[order.phase] || phases.closed)}</div>
      <h3>${esc(order.title)}</h3><p>${esc(order.brand)} · <b>${dateTime(order.starts_at)}</b> 방송 (${format(Math.round((order.ends_at - order.starts_at) / minute))}분) · <a href="${esc(order.live_url)}" target="_blank" rel="noopener">방송 주소</a></p>
      ${order.reason ? `<p class="order-note">${esc(order.reason)}</p>` : ''}
      ${watch ? `<p class="live-keyword">${icon('lock')} 지금 시청 확인 키워드 <b>${esc(order.keyword)}</b> <small>방송 중에 말해 주세요 · 바꾸면 5분간 이전 키워드도 인정</small></p>` : ''}
      <div class="table-wrap"><table class="data-table compact live-items"><thead><tr><th>상품</th><th>노출 구간</th><th>완료 / 목표</th><th>검수</th><th>집행</th><th>상태</th></tr></thead><tbody>
        ${order.items.map(item => `<tr><td><b>${esc(item.label)}</b><small>건당 ${format(item.cost)}원 · <a href="/ow/${esc(item.slug)}?preview=1" target="_blank" rel="noopener">미리보기</a></small></td>
          <td><small>${when(item.open_at, item.close_at, order)}</small></td><td>${format(item.completed)} / ${format(item.goal)}<small>${percent(item.completed, item.goal)}% · 유입 ${format(item.landings)}</small></td>
          <td>${item.pending ? `<b>${format(item.pending)}</b>` : '−'}</td><td>${format(item.spent)}원${item.returned ? `<small>반환 ${format(item.returned)}원</small>` : ''}</td>
          <td>${tag(itemStatus[item.status] || itemStatus.closed)}${item.reason && item.status !== 'active' ? `<small>${esc(item.reason)}</small>` : ''}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="review-signals"><span>완료 ${format(order.totals.completed)} / ${format(goal)}</span><span>오늘 ${format(order.totals.today)}</span><span>검수 대기 ${format(order.totals.pending)}</span>
        <span>예산 ${format(order.budget)}원</span><span>집행 ${format(order.totals.spent)}원</span>${['closed', 'rejected', 'canceled'].includes(order.status) ? `<span>반환 ${format(order.totals.returned)}원</span>` : `<span>남은 예산 ${format(left)}원</span>`}</div>
      <div class="actions">${watch ? btn('시청 키워드 바꾸기', `type="button" data-live-keyword="${order.id}"`, 'quiet small') : ''}
        ${signup && !admin ? btn('가입·구매 전환 연동', `type="button" data-live-conv="${order.id}"`, 'quiet small') : ''}
        ${admin ? order.items.filter(item => item.pending).map(item => `<a class="btn quiet small" href="/manage?tab=offerwall&amp;view=clicks&amp;status=pending&amp;offer=${item.id}">${esc(item.label)} 검수 ${format(item.pending)}</a>`).join('') : ''}
        ${(transitions[order.status] || []).map(([action, label]) => decision('live/status', order.id, action, label)).join('')}</div></article>`;
  }

  /* ---------- 광고 계정 ---------- */
  async function ownerView() {
    data = await api('/api/live/mine');
    const running = data.orders.filter(order => order.status === 'active');
    const products = Object.entries(data.products);
    return `${strip([['방송 예정·진행', `${format(running.length)}건`], ['심사 대기', `${format(data.orders.filter(order => order.status === 'review').length)}건`],
      ['오늘 완료', `${format(data.orders.reduce((sum, order) => sum + order.totals.today, 0))}건`], ['누적 집행', `${format(data.orders.reduce((sum, order) => sum + order.totals.spent, 0))}원`],
      ['사용 가능 잔액', `${format(data.balance)}원`]])}
      <section class="panel ow-intro-panel"><div><h2>라이브 셀러 광고</h2><p>방송 일정과 주소만 넣으면 버즈빌·애드팝콘 등 리워드 앱의 ‘포인트 받기’에 방송 시간에 맞춰 광고가 노출돼요. 알림 신청은 방송 전에, 입장·시청 확인은 방송 중에만 보이고, 방송이 끝나면 자동으로 내려간 뒤 완료 건만 집행하고 남은 예산은 돌려드려요.</p></div>
        <div class="actions">${btn(`${icon('video')} 라이브 광고 주문`, 'type="button" data-live-new', 'primary')}</div></section>
      <div class="ow-type-guide">${products.map(([kind, item]) => `<div><b>${esc(item.label)}</b><span>${esc(item.intro)}</span><span>노출 · ${esc(item.when)}</span><em>${kind === 'signup' ? `단계 합계 ${format(data.costs[kind])}원부터` : `건당 ${format(data.costs[kind])}원`} · 최소 ${format(item.min)}건</em></div>`).join('')}</div>
      <p class="form-hint live-hint">구매평·리뷰 작성, 상품찜·스토어찜, 검색 후 클릭 같은 순위 작업 미션은 플랫폼 약관과 표시광고 규정 때문에 받지 않아요.</p>
      ${data.orders.length ? `<div class="order-grid live-grid">${data.orders.map(order => orderCard(order, false)).join('')}</div>` : empty('아직 주문한 라이브 광고가 없어요. ‘라이브 광고 주문’으로 첫 방송을 알려 보세요.')}`;
  }

  /* ---------- 최고관리자 ---------- */
  async function adminView(params) {
    const status = params.get('status') || '';
    data = await api('/api/live?' + new URLSearchParams({ status }));
    const filters = [['', '전체'], ['review', '심사 대기'], ['active', '방송 예정·진행'], ['closed', '종료'], ['rejected', '반려'], ['canceled', '취소']];
    const total = Object.values(data.counts).reduce((sum, value) => sum + value, 0);
    const onair = data.orders.filter(order => order.phase === 'onair').length;
    return `${strip([['심사 대기', `${format(data.counts.review || 0)}건`], ['방송 예정·진행', `${format(data.counts.active || 0)}건`], ['지금 방송 중', `${format(onair)}건`],
      ['검수 대기 참여', `${format(data.orders.reduce((sum, order) => sum + order.totals.pending, 0))}건`], ['라이브 매체 배분율', `${data.share / 100}%`]])}
      ${!data.networks ? '<p class="notice warn">연동 매체가 없어 승인할 수 없어요. 외부 오퍼월 › 오퍼월 연동에서 버즈빌·애드팝콘을 먼저 등록하세요.</p>' : ''}
      <div class="toolbar"><div class="tabs">${filters.map(([key, label]) => `<a href="/manage?tab=liveorders${key ? '&amp;status=' + key : ''}" class="${key === status ? 'on' : ''}">${label} <span class="count">${format(key ? data.counts[key] || 0 : total)}</span></a>`).join('')}</div>
        <div class="actions">${btn('라이브 단가·배분', 'type="button" data-live-rates', 'quiet small')}</div></div>
      <p class="form-hint live-hint">승인하면 상품별 광고가 모든 연동 매체에 공급 예약되고, 노출 구간(방송 시간 기준)에만 피드·오퍼월에 나갑니다. 알림 신청·쿠폰 캡처는 ‘오퍼월 연동 › 참여·포스트백’에서 검수해요. 방송 시작 뒤 승인하면 노출 시간이 지난 상품(알림 신청 등)은 예산을 돌려줍니다.</p>
      ${data.orders.length ? `<div class="order-grid live-grid">${data.orders.map(order => orderCard(order, true)).join('')}</div>` : empty('조건에 맞는 라이브 주문이 없어요.')}`;
  }

  function openRates() {
    modal('LIVE RATES', '라이브 광고 단가·배분', `<form class="form" data-form="live/rates"><p class="form-hint">셀러가 내는 건당 단가(원)입니다. 매체 공급 단가 = 단가 × 라이브 배분율. 방송 시간에만 노출돼 매체 노출 기회가 짧으므로 일반 오퍼월보다 배분율을 높게 두는 것을 권장해요. 이미 접수된 주문 단가는 바뀌지 않습니다.</p>
      <div class="ow-rate-grid">${Object.entries(data.products).map(([kind, item]) => field(`${esc(item.label)}${kind === 'signup' ? ' 최소 합계' : ''} (원)`, `cost_${kind}`, 'number', `required min="1" max="1000000" value="${data.costs[kind]}"`)).join('')}</div>
      ${field('라이브 매체 배분율 (%)', 'share', 'text', `required inputmode="decimal" value="${data.share / 100}"`)}${btn('저장', 'type="submit"')}</form>`, true);
  }

  /* ---------- 주문 폼 ---------- */
  const detail = (kind, html) => `<fieldset class="live-detail" data-live-for="${kind}" hidden disabled>${html}</fieldset>`;
  function orderForm() {
    const platforms = Object.entries(data.platforms).map(([key, item]) => [key, item.label]);
    const sns = [['youtube', '유튜브'], ['instagram', '인스타그램'], ['kakao', '카카오톡 채널'], ['naver', '네이버'], ['tiktok', '틱톡'], ['etc', '기타 SNS']];
    const row = ([kind, item]) => `<div class="live-product"><div><b>${esc(item.label)}</b><small>${esc(item.when)} · ${kind === 'signup' ? `단계 합계 ${format(data.costs[kind])}원부터` : `건당 ${format(data.costs[kind])}원`}</small></div>
      ${field('수량', `qty_${kind}`, 'number', `min="${item.min}" max="100000" step="1" placeholder="선택 안 함" data-live-qty="${kind}"`)}<span class="live-subtotal" data-live-sub="${kind}">−</span></div>
      ${{
        notify: detail('notify', field('알림 신청 안내 (선택)', 'notify_guide', 'text', 'maxlength="300" placeholder="예: 방송 페이지 오른쪽 위 ‘알림 받기’를 눌러 주세요"')),
        enter: '',
        watch: detail('watch', `<div class="two">${field('시청 확인 키워드 (방송 중 말할 단어)', 'keyword', 'text', 'minlength="2" maxlength="20" placeholder="예: 니트특가" required')}${select('최소 시청 시간', 'watch_minutes', [[3, '3분'], [1, '1분'], [2, '2분'], [5, '5분'], [10, '10분']])}</div>
          <p class="form-hint">방송 중 화면 자막이나 멘트로 키워드를 알려 주세요. 방송 중에도 주문 카드의 ‘시청 키워드 바꾸기’로 바꿀 수 있어요.</p>`),
        quiz: detail('quiz', `${field('퀴즈 질문 (방송 상품·혜택 관련)', 'q1_prompt', 'text', 'maxlength="200" required placeholder="예: 오늘 방송 할인율은?"')}
          <div class="two">${[1, 2, 3, 4].map(i => field(`선택지 ${i}${i > 2 ? ' (선택)' : ''}`, `q1_c${i}`, 'text', `maxlength="60"${i <= 2 ? ' required' : ''}`)).join('')}</div>
          ${select('정답', 'q1_answer', [1, 2, 3, 4].map(i => [i, `선택지 ${i}`]))}<p class="form-hint">정답 힌트는 방송 소개에 넣어 주세요. 맞힌 회원은 방송 화면으로 이동해요.</p>`),
        follow: detail('follow', `<div class="two">${select('SNS', 'follow_sns', sns)}${select('인증 방식', 'follow_verify', [['screenshot', '캡처 화면 · 운영팀 검수'], ['keyword', '인증 키워드 · 즉시 확인']])}</div>
          ${field('채널 주소 (https)', 'follow_url', 'url', 'maxlength="1000" required placeholder="https://www.youtube.com/@채널"')}
          ${field('인증 키워드 (키워드 방식일 때 · 채널 소개글에 넣은 단어)', 'follow_keyword', 'text', 'maxlength="20"')}`),
        coupon: detail('coupon', `${field('쿠폰 받는 주소 (https)', 'coupon_url', 'url', 'maxlength="1000" required placeholder="https://"')}${field('쿠폰 안내 (선택)', 'coupon_guide', 'text', 'maxlength="300"')}`),
        signup: detail('signup', `${field('가입·구매 페이지 주소 (https · 자사몰·셀러브릭스)', 'signup_url', 'url', 'maxlength="1000" required placeholder="https://"')}
          <p class="form-hint">주소 뒤에 <code>adsform_click</code> 값이 붙어요. 쇼핑몰 서버가 이 값으로 단계 완료를 알려 줘야 집행됩니다(네이버·쿠팡 스토어는 전환을 받을 수 없어요).</p>
          ${[[1, '회원가입', 'signup', 500], [2, '첫 구매', 'purchase', 1000]].map(([n, label, code, cost]) => `<div class="ow-step-row">${field(`${n}단계 이름`, `s${n}_label`, 'text', `maxlength="40" value="${label}"${n === 1 ? ' required' : ''}`)}
            ${field('이벤트 코드', `s${n}_code`, 'text', `maxlength="24" value="${code}"`)}${field('단가(원)', `s${n}_cost`, 'number', `min="1" max="1000000" value="${cost}"`)}</div>`).join('')}`)
      }[kind]}`;
    return `<form class="form live-form" data-form="live/order">
      <h3 class="ow-sub">1. 방송 정보</h3>
      <div class="two">${select('방송 플랫폼', 'platform', platforms)}${field('스토어·셀러명', 'brand', 'text', 'required maxlength="40"')}</div>
      ${field('방송 제목', 'title', 'text', 'required maxlength="40" placeholder="예: 겨울 니트 라이브 특가"')}
      ${field('방송 주소 (https · 방송 예정 페이지)', 'live_url', 'url', 'required maxlength="1000" placeholder="https://view.shoppinglive.naver.com/..."')}
      <div class="two">${field('방송 시작 (한국 시간)', 'start', 'datetime-local', `required min="${kstInput(Date.now() + 60 * minute)}" value="${tomorrowEvening()}"`)}${select('방송 시간', 'minutes', [[60, '60분'], [30, '30분'], [90, '90분'], [120, '2시간'], [180, '3시간'], [240, '4시간']])}</div>
      ${textarea('방송 소개 (리워드 앱 회원에게 보이는 안내 · 혜택과 퀴즈 힌트를 담아 주세요)', 'intro', 'required maxlength="600" rows="3"')}
      <h3 class="ow-sub">2. 광고 상품</h3>
      <div class="live-packages">${Object.entries(data.packages).map(([key, item]) => `<button type="button" class="btn quiet small" data-live-package="${key}"><b>${esc(item.label)}</b><small>&nbsp;· ${esc(item.intro)}</small></button>`).join('')}
        <button type="button" class="btn quiet small" data-live-package="">비우기</button></div>
      <div class="live-products">${Object.entries(data.products).map(row).join('')}</div>
      <p class="form-hint">구매평·리뷰, 상품찜·스토어찜, 검색 유입 같은 순위 작업은 주문할 수 없어요. 방송 시작 1시간 전까지 주문해야 심사 후 노출돼요.</p>
      <div class="ow-estimate" aria-live="polite"></div>
      ${btn('라이브 광고 주문 (예산 배정)', 'type="submit"')}</form>`;
  }

  function sync(form) {
    let total = 0;
    for (const [kind] of Object.entries(data.products)) {
      const input = form.elements[`qty_${kind}`];
      const qty = Number(input.value || 0);
      const on = qty > 0;
      const box = form.querySelector(`[data-live-for="${kind}"]`);
      if (box) { box.hidden = !on; box.disabled = !on; }
      const unit = kind === 'signup' ? [1, 2].reduce((sum, n) => sum + (form.elements[`s${n}_label`]?.value.trim() ? Number(form.elements[`s${n}_cost`]?.value || 0) : 0), 0) : data.costs[kind];
      form.querySelector(`[data-live-sub="${kind}"]`).textContent = on ? `${format(unit * qty)}원` : '−';
      if (on) total += unit * qty;
    }
    if (form.elements.follow_keyword) form.elements.follow_keyword.required = form.elements.follow_verify.value === 'keyword';
    const after = data.balance - total;
    form.querySelector('.ow-estimate').innerHTML = `<dl class="quote-balance"><div><dt>배정 예산</dt><dd>${format(total)}원</dd></div><div><dt>사용 가능 잔액</dt><dd>${format(data.balance)}원</dd></div>
      <div><dt>주문 후 잔액</dt><dd class="${after < 0 ? 'minus' : ''}">${format(after)}원</dd></div></dl>
      ${!data.networks ? '<p class="quote-warn">아직 연동된 리워드 매체가 없어 승인이 늦어질 수 있어요.</p>' : ''}
      ${after < 0 ? `<p class="quote-warn">잔액이 ${format(-after)}원 부족해요. <a href="/manage?tab=charges">충전 신청하기</a></p>` : ''}`;
  }

  function openOrder() {
    modal('LIVE COMMERCE', '라이브 광고 주문', orderForm(), true);
    sync(dialog.querySelector('form[data-form="live/order"]'));
  }

  function openKeyword(id) {
    const order = data.orders.find(item => item.id === id);
    modal('LIVE KEYWORD', '시청 확인 키워드 바꾸기', `<p>지금 키워드 <b>${esc(order.keyword)}</b>. 바꾸면 바로 적용되고, 5분 동안은 이전 키워드도 인정해요. 방송 중 화면이나 멘트로 새 키워드를 알려 주세요.</p>
      <form class="form" data-form="live/keyword"><input type="hidden" name="id" value="${order.id}">${field('새 키워드', 'keyword', 'text', 'required minlength="2" maxlength="20" autocomplete="off"')}${btn('키워드 바꾸기', 'type="submit"')}</form>`);
  }

  function openConversion(id) {
    const order = data.orders.find(item => item.id === id);
    const item = order.items.find(entry => entry.kind === 'signup');
    modal('LIVE CONVERSION', '가입·구매 전환 연동', `<p>회원이 미션을 누르면 가입·구매 페이지 주소 뒤에 <code class="ow-code">adsform_click</code> 값이 붙어요. 쇼핑몰 서버에서 단계가 끝날 때마다 아래처럼 알려 주세요. 셀러브릭스 쇼핑몰은 같은 규격으로 자동 연동할 수 있어요.</p>
      <pre class="ow-pre">POST ${esc(location.origin)}/ow/v1/conversions
Content-Type: application/json
X-Adsform-Offer: ${esc(item.slug)}
X-Adsform-Timestamp: {유닉스 초}
X-Adsform-Signature: hex(HMAC-SHA256(전환 비밀키, "{Timestamp}\\nPOST\\n/ow/v1/conversions\\n" + sha256(본문)))

{"click":"{adsform_click 값}","event":"${esc(item.steps[0]?.code || 'signup')}"}</pre>
      <p class="form-hint">이벤트 코드: ${item.steps.map(step => `<code class="ow-code">${esc(step.code)}</code> ${esc(step.label)} ${format(step.cost)}원`).join(' · ')}</p>
      <form class="form" data-form="offerwall/offer/convkey"><input type="hidden" name="id" value="${item.id}"><p class="form-hint">전환 비밀키는 주문할 때 한 번만 보여 드렸어요. 잃어버렸다면 새로 발급하세요.</p>${btn('전환 비밀키 새로 발급', 'type="submit"', 'quiet small')}</form>`, true);
  }

  return {
    ownerView,
    adminView,
    click(button) {
      const d = button.dataset;
      if ('liveNew' in d) return openOrder(), true;
      if ('liveRates' in d) return openRates(), true;
      if ('liveKeyword' in d) return openKeyword(Number(d.liveKeyword)), true;
      if ('liveConv' in d) return openConversion(Number(d.liveConv)), true;
      if ('livePackage' in d) {
        const form = button.form;
        const items = data.packages[d.livePackage]?.items || {};
        for (const kind of Object.keys(data.products)) form.elements[`qty_${kind}`].value = items[kind] ?? '';
        sync(form);
        return true;
      }
      return false;
    },
    input(event) {
      const form = event.target.form;
      if (form?.dataset.form === 'live/order' && data) sync(form);
    },
    after(path, result) {
      if (path === 'live/order' && result?.convSecret) {
        modal('LIVE CONVERSION', '주문 접수 · 가입·구매 전환 비밀키', `<p class="notice warn">${icon('lock')} 비밀키는 지금 한 번만 보여 드려요. 쇼핑몰 서버 개발자에게 안전한 경로로 전달하세요.</p>
          <dl class="ow-kv"><div><dt>오퍼 ID</dt><dd><code class="ow-code">${esc(result.slug)}</code></dd></div><div><dt>전환 비밀키</dt><dd><code class="ow-code">${esc(result.convSecret)}</code> ${btn('복사', `type="button" data-ow-copy="${esc(result.convSecret)}"`, 'quiet small')}</dd></div></dl>
          <p class="form-hint">주문은 운영팀 심사 후 방송 시간에 맞춰 공급돼요. 연동 방법은 주문 카드의 ‘가입·구매 전환 연동’에서 볼 수 있어요.</p>`, true);
        return true;
      }
      const messages = { 'live/order': `라이브 광고를 주문했어요. 예산 ${format(result?.budget || 0)}원을 배정했고, 운영팀 심사 후 방송 시간에 맞춰 공급돼요.`, 'live/keyword': `시청 확인 키워드를 ‘${result?.keyword}’(으)로 바꿨어요.`,
        'live/rates': '라이브 단가를 저장했습니다.', 'live/status': result?.waiting ? '노출을 멈췄어요. 검수 대기 참여를 확인한 뒤 자동 정산돼요.' : result?.returned ? `처리했어요. 예산 ${format(result.returned)}원을 잔액으로 돌려드렸어요.` : '처리했습니다.' };
      showToast(messages[path] || '처리했습니다.');
      return true;
    }
  };
}
