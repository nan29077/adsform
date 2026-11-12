// 콘솔의 오퍼월 메뉴
//  · 최고관리자 '오퍼월 연동' : 광고 심사·관리, 참여 검수·포스트백, 연동 매체, 단가·배분, 연동 안내
//  · 광고주·대행사·실행사 '오퍼월 광고' : 광고 등록(예산 배정), 진행 현황, 연장·증액, 미션형 전환 키
export function setupOfferwallConsole(h) {
  const { api, esc, format, field, textarea, select, btn, empty, panelHead, icon, modal, dialog, dateTime, day, pager, showToast, decision } = h;
  let data = null;
  let mine = null;
  const typeName = { visit: '방문하기', content: '콘텐츠보기', follow: '팔로우하기', quiz: '퀴즈', survey: '설문', cpa: '미션형(CPA)' };
  const typeIntro = {
    visit: '광고 페이지 방문 시 적립 · 하루 1회 반복', content: '콘텐츠(게임·운세·상식 등) 페이지 방문 · 하루 1회', follow: '유튜브·인스타그램 등 구독·팔로우 인증',
    quiz: '광고 내용을 읽고 퀴즈 정답 시 적립', survey: '설문 응답 수집 · 검수 후 적립 선택', cpa: '앱 설치·가입·구매 등 단계별 미션 · 광고주 서버 전환 통보'
  };
  const offerStatus = { review: ['심사 대기', 'pending'], draft: ['작성 중', 'paused'], active: ['공급 중', 'active'], paused: ['일시중지', 'paused'], closed: ['종료', 'withdrawn'], rejected: ['반려', 'rejected'], canceled: ['취소', 'withdrawn'] };
  const clickStatus = { started: ['참여 중', 'paused'], pending: ['검수 대기', 'pending'], completed: ['완료', 'approved'], failed: ['실패', 'rejected'], rejected: ['반려', 'rejected'], expired: ['만료', 'withdrawn'] };
  const postbackStatus = { queued: ['재시도 대기', 'pending'], sending: ['전송 중', 'pending'], sent: ['전송 완료', 'approved'], failed: ['전송 실패', 'rejected'] };
  const tag = ([label, cls]) => `<span class="status ${cls}">${label}</span>`;
  const percent = (part, whole) => whole ? Math.round(part / whole * 1000) / 10 : 0;
  const strip = items => `<div class="summary-strip">${items.map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('')}</div>`;
  const thumb = offer => offer.icon_id ? `<img class="ow-thumb" src="/ow/img/${offer.icon_id}" alt="">` : `<span class="ow-thumb letter">${esc([...offer.title.replace(/^\[[^\]]*\]\s*/, '')][0] || 'A')}</span>`;
  const check = (label, name, on) => `<label class="check"><input type="checkbox" name="${name}" value="1"${on ? ' checked' : ''}> ${label}</label>`;
  const categoryName = { visit: '방문하기', join: '참여하기', follow: '팔로우하기', content: '콘텐츠보기' };

  /* ---------- 공통: 광고 카드 ---------- */
  function offerCard(offer, admin) {
    const live = offer.placements.filter(p => p.status === 'active');
    const transitions = admin
      ? { review: [['approve', '승인 · 공급 시작'], ['reject', '반려']], draft: [['activate', '공급 시작'], ['close', '종료']], active: [['pause', '일시중지'], ['close', '종료']], paused: [['activate', '공급 재개'], ['close', '종료']] }
      : { review: [['cancel', '등록 취소']], active: [['pause', '일시중지'], ['close', '종료']], paused: [['activate', '재개'], ['close', '종료']] };
    const left = offer.owner_id ? Math.max(0, offer.budget - offer.spent) : null;
    const networks = admin ? data.networks : [];
    const ended = ['closed', 'rejected', 'canceled'].includes(offer.status);
    return `<article class="panel order-card ow-offer"><div class="row-top"><span class="eyebrow">${categoryName[offer.category] === typeName[offer.type] ? typeName[offer.type] : `${categoryName[offer.category]} · ${typeName[offer.type]}`} · #${offer.id}</span>${tag(offerStatus[offer.status])}</div>
      <div class="ow-offer-head">${thumb(offer)}<div><h3>${esc(offer.title)}</h3><p>${esc(offer.brand)}${admin ? ` · ${offer.owner ? esc(offer.owner) : '운영팀 광고'}` : ''} · ${offer.start_date} ~ ${offer.end_date}</p>
        <p class="ow-sub-line">${esc(offer.action)}${offer.badge ? ` · <b>${esc(offer.badge)}</b>` : ''}${offer.repeat === 'daily' ? ' · 하루 1회 반복' : ''}</p></div></div>
      ${offer.reason ? `<p class="order-note">${esc(offer.reason)}</p>` : ''}
      <div class="order-progress"><span>완료 ${format(offer.completed)} / 목표 ${format(offer.goal)}${offer.daily_cap ? ` · 일일 ${format(offer.daily_cap)}` : ''}</span><strong>${percent(offer.completed, offer.goal)}%</strong></div>
      <progress class="meter" value="${Math.min(offer.completed + offer.pending, offer.goal)}" max="${offer.goal}" aria-label="진행률"></progress>
      <div class="review-signals"><span>유입 ${format(offer.landings)}</span><span>전환율 ${percent(offer.completed, offer.landings)}%</span><span>검수 ${format(offer.pending)}</span><span>오늘 ${format(offer.today)}</span>
        ${offer.owner_id ? `<span>집행 ${format(offer.spent)}원</span><span>남은 예산 ${format(left)}원</span>${offer.returned ? `<span>반환 ${format(offer.returned)}원</span>` : ''}` : ''}
        ${admin ? `<span>매체 정산 ${format(offer.paid)}원</span>` : ''}<span>건당 ${format(offer.cost)}원</span></div>
      ${admin ? `<ul class="ow-placements">${live.map(p => {
        const network = networks.find(n => n.id === p.network_id);
        return `<li><b>${esc(network?.name || '매체')}</b><span>공급 단가 ${format(p.price)}원 · 리워드 ${format(p.reward)}${esc(network?.point_unit || 'P')}</span></li>`;
      }).join('') || `<li><span>${offer.status === 'review' ? '승인하면 모든 연동 매체에 자동 공급' : '공급 매체 없음'}</span></li>`}</ul>` : ''}
      ${offer.type === 'cpa' ? `<ul class="ow-placements">${offer.steps.map(step => `<li><b>${esc(step.label)}</b><span><code class="ow-code">${esc(step.code)}</code> · ${format(step.cost)}원</span></li>`).join('')}</ul>` : ''}
      <div class="actions"><a class="btn quiet small" href="/ow/${esc(offer.slug)}?preview=1" target="_blank" rel="noopener">미리보기</a>
        ${(admin && !ended) || (!admin && offer.status === 'review') ? btn('수정', `type="button" data-ow-offer-edit="${offer.id}"`, 'quiet small') : ''}
        ${!admin && ['active', 'paused'].includes(offer.status) ? btn('연장·증액', `type="button" data-ow-extend="${offer.id}"`, 'quiet small') : ''}
        ${offer.type === 'cpa' && !ended ? btn('전환 연동', `type="button" data-ow-conv="${offer.id}"`, 'quiet small') : ''}
        ${admin ? `<a class="btn quiet small" href="/manage?tab=offerwall&amp;view=clicks&amp;offer=${offer.id}">참여 현황</a>` : ''}
        ${(transitions[offer.status] || []).map(([action, label]) => decision('offerwall/offer/status', offer.id, action, label)).join('')}</div></article>`;
  }

  /* ---------- 최고관리자 ---------- */
  const adminViews = [['offers', '광고 심사·관리'], ['clicks', '참여·포스트백'], ['networks', '연동 매체'], ['rates', '단가·배분'], ['guide', '연동 안내']];

  async function adminView(params) {
    const query = new URLSearchParams({ status: params.get('status') || '', offer: params.get('offer') || '', page: params.get('page') || '1' });
    data = await api('/api/offerwall?' + query);
    const current = adminViews.some(([key]) => key === params.get('view')) ? params.get('view') : 'offers';
    const badges = { offers: data.counts.review, clicks: data.counts.pending };
    return `${strip([['공급 중인 광고', `${format(data.offers.filter(o => o.status === 'active').length)}개`], ['심사 대기', `${format(data.counts.review)}건`], ['오늘 완료', `${format(data.counts.completedToday)}건`],
      ['오늘 이익', `${format(data.counts.revenueToday)}원`], ['참여 검수 대기', `${format(data.counts.pending)}건`], ['포스트백 재시도·실패', `${format(data.counts.queuedPostbacks)} · ${format(data.counts.failedPostbacks)}건`]])}
      <div class="toolbar"><div class="tabs">${adminViews.map(([key, label]) => `<a href="/manage?tab=offerwall&amp;view=${key}" class="${key === current ? 'on' : ''}">${label}${badges[key] ? ` <span class="count">${format(badges[key])}</span>` : ''}</a>`).join('')}</div>
        <div class="actions"><a class="btn quiet small" href="/ow/wall?preview=1" target="_blank" rel="noopener">오퍼월 미리보기</a>${btn(`${icon('target')} 운영 광고 만들기`, 'type="button" data-ow-offer-new', 'primary small')}${btn('매체 등록', 'type="button" data-ow-network-new', 'quiet small')}</div></div>
      ${{ offers: offersView, clicks: clicksView, networks: networksView, rates: ratesView, guide: guideView }[current](params)}`;
  }

  function offersView(params) {
    const filter = params.get('status') || '';
    const filters = [['', '전체'], ['review', '심사 대기'], ['active', '공급 중'], ['paused', '일시중지'], ['draft', '작성 중'], ['closed', '종료'], ['rejected', '반려']];
    const list = data.offers.filter(offer => !filter || offer.status === filter);
    return `${!data.networks.length ? '<p class="notice warn">연동 매체가 아직 없어요. 버즈빌·애드팝콘 계약 후 ‘매체 등록’으로 연동 키를 발급하면 승인된 광고가 자동 공급됩니다.</p>' : ''}
      <div class="tabs">${filters.map(([key, label]) => `<a href="/manage?tab=offerwall&amp;view=offers${key ? '&amp;status=' + key : ''}" class="${key === filter ? 'on' : ''}">${label} <span class="count">${format(key ? data.offers.filter(o => o.status === key).length : data.offers.length)}</span></a>`).join('')}</div>
      ${list.length ? `<div class="order-grid">${list.map(offer => offerCard(offer, true)).join('')}</div>` : empty('조건에 맞는 광고가 없어요.')}`;
  }

  function clicksView(params) {
    const status = params.get('status') || '';
    const offerId = params.get('offer') || '';
    const link = changes => {
      const next = new URLSearchParams({ tab: 'offerwall', view: 'clicks', status, offer: offerId, ...changes });
      for (const [key, value] of [...next]) if (!value) next.delete(key);
      return '/manage?' + next.toString().replaceAll('&', '&amp;');
    };
    const pending = data.clicks.filter(click => click.status === 'pending');
    const filters = [['', '전체'], ['pending', '검수 대기'], ['completed', '완료'], ['started', '참여 중'], ['failed', '실패'], ['rejected', '반려'], ['expired', '만료']];
    return `<div class="toolbar"><div class="tabs">${filters.map(([key, label]) => `<a href="${link({ status: key, page: '' })}" class="${key === status ? 'on' : ''}">${label}</a>`).join('')}</div>
      ${offerId ? `<a class="btn quiet small" href="${link({ offer: '', page: '' })}">광고 필터 해제 · #${esc(offerId)}</a>` : ''}</div>
      ${pending.length ? `<h3 class="ow-sub">검수 대기 (설문 · 팔로우 인증)</h3><div class="order-grid">${pending.map(click => `<article class="panel order-card"><div class="row-top"><span class="eyebrow">참여 #${click.id} · ${dateTime(click.finished)}</span>${tag(clickStatus.pending)}</div>
        <h3>${esc(click.title)}</h3><p>${esc(click.network)} · 회원 ${esc(click.network_user)}</p>
        ${click.proof_id ? `<a href="/api/offerwall/proof?id=${click.proof_id}" target="_blank" rel="noopener"><img class="ow-proof" src="/api/offerwall/proof?id=${click.proof_id}" alt="팔로우 인증 화면"></a>` : ''}
        ${click.answers ? click.prompts.map((prompt, i) => `<p class="review-question"><small>Q${i + 1}</small> ${esc(prompt)}</p><blockquote>${esc(click.answers[i] ?? '')}</blockquote>`).join('') : ''}
        <p class="form-hint">승인하면 ${esc(click.network)}에 완료 포스트백을 보내 회원에게 ${format(click.reward)}${esc(click.point_unit)}이 지급됩니다.</p>
        <div class="actions">${decision('offerwall/click/review', click.id, 'approve')}${decision('offerwall/click/review', click.id, 'reject')}</div></article>`).join('')}</div>` : ''}
      <section class="panel dash-block">${panelHead('참여 기록', `${format(data.total)}건 · 최근 순`)}
      ${data.clicks.length ? `<div class="table-wrap"><table class="data-table compact"><thead><tr><th>일시</th><th>광고</th><th>매체 · 회원</th><th>클릭 ID</th><th>참여</th><th>포스트백</th></tr></thead><tbody>
        ${data.clicks.map(click => `<tr><td><small>${dateTime(click.created)}</small></td><td><b>${esc(click.title)}</b><small>#${click.offer_id} · ${typeName[click.type]}</small></td>
          <td>${esc(click.network)}<small>${esc(click.network_user)} · ${click.origin === 'wall' ? '호스팅 오퍼월' : '피드'}</small></td><td><code class="ow-code">${esc(click.click_id)}</code></td>
          <td>${tag(clickStatus[click.status])}${click.tries > 1 ? `<small>${format(click.tries)}회 시도</small>` : ''}${click.reason ? `<small>${esc(click.reason)}</small>` : ''}</td>
          <td>${click.postbacks.length ? click.postbacks.map(p => `<div class="ow-pb">${tag(postbackStatus[p.status])}<small>${p.step === 'done' ? '' : esc(p.step) + ' · '}${format(p.attempts)}회${p.last_code ? ` · HTTP ${p.last_code}` : ''}${p.sent ? ` · ${dateTime(p.sent)}` : ''}</small>
            ${p.last_error ? `<small class="ow-error-text">${esc(p.last_error)}</small>` : ''}${['failed', 'queued'].includes(p.status) ? `<form data-form="offerwall/postback/retry"><input type="hidden" name="id" value="${p.id}">${btn('지금 재전송', 'type="submit"', 'quiet small')}</form>` : ''}</div>`).join('') : '<small>−</small>'}</td></tr>`).join('')}
      </tbody></table></div>` : empty('조건에 맞는 참여가 없어요.')}${pager(data.page, data.pages, link({ page: '' }))}</section>`;
  }

  function networksView() {
    if (!data.networks.length) return empty('등록된 매체가 없어요. 오른쪽 위 ‘매체 등록’을 눌러 주세요.');
    return `<div class="order-grid">${data.networks.map(network => `<article class="panel order-card"><div class="row-top"><span class="eyebrow">${esc(network.code)} · ${network.preset === 'custom' ? '직접 입력' : esc(data.presets[network.preset]?.name || network.preset)}</span>
        ${tag(network.status === 'active' ? ['연동 중', 'active'] : ['일시중지', 'paused'])}</div><h3>${esc(network.name)}</h3>
      <dl class="ow-kv"><div><dt>API 키</dt><dd><code class="ow-code">${esc(network.api_key)}</code> ${btn('복사', `type="button" data-ow-copy="${esc(network.api_key)}"`, 'quiet small')}</dd></div>
        <div><dt>랜딩 파라미터</dt><dd>${esc(network.click_param)} · ${esc(network.user_param)} · ${network.sign_landing ? '서명 필수(ts, sig)' : '<b class="ow-warn">서명 없음</b>'}</dd></div>
        <div><dt>리워드 환산</dt><dd>공급 단가 × ${format(network.reward_rate)}% → ${esc(network.point_unit)}</dd></div>
        <div><dt>포스트백</dt><dd>${network.postback_url ? `${network.postback_method} <code class="ow-code">${esc(network.postback_url)}</code>` : '<b class="ow-warn">미설정 · 완료 알림을 보낼 수 없어요</b>'}</dd></div>
        <div><dt>허용 IP</dt><dd>${esc(network.ip_allowlist) || '제한 없음'}</dd></div>
        <div><dt>키 발급</dt><dd>${day(network.rotated || network.created)}${network.updated ? ` · 설정 수정 ${day(network.updated)}` : ''}</dd></div></dl>
      <div class="actions">${btn('설정 수정', `type="button" data-ow-network-edit="${network.id}"`, 'quiet small')}
        ${network.postback_url ? `<form data-form="offerwall/network/test"><input type="hidden" name="id" value="${network.id}">${btn('포스트백 테스트', 'type="submit"', 'quiet small')}</form>` : ''}
        ${btn('키 재발급', `type="button" data-ow-network-rotate="${network.id}"`, 'quiet small')}</div></article>`).join('')}</div>`;
  }

  function ratesView() {
    const { share, costs } = data.rates;
    const example = Math.floor(costs.quiz * share / 10000);
    return `<section class="panel">${panelHead('유형별 광고 단가와 매체 배분율', '광고 계정이 내는 건당 단가(원)입니다. 매체 공급 단가는 단가 × 배분율, 매체 리워드는 공급 단가 × 매체별 환산율로 정해집니다. 이미 등록된 광고의 단가는 바뀌지 않아요.')}
      <form class="form" data-form="offerwall/rates"><div class="ow-rate-grid">${Object.keys(data.types).map(type => field(`${typeName[type]}${type === 'cpa' ? ' 최소 합계' : ''} (원)`, `cost_${type}`, 'number', `required min="1" max="1000000" value="${costs[type]}"`)).join('')}</div>
        ${field('매체 배분율 (%)', 'share', 'text', `required inputmode="decimal" value="${share / 100}"`)}
        <p class="form-hint">예: 퀴즈 단가 ${format(costs.quiz)}원 · 배분율 ${share / 100}% → 매체 공급 ${format(example)}원, 애즈폼 이익 ${format(costs.quiz - example)}원</p>
        ${btn('단가 저장', 'type="submit"')}</form></section>`;
  }

  function guideView() {
    const origin = data.origin;
    return `<section class="panel ow-guide">${panelHead('매체에 전달할 연동 규격', '버즈빌·애드팝콘 담당자에게 아래 규격과 매체별 API 키·비밀키를 전달하세요. 매체가 정한 규격이 있으면 매체 설정의 파라미터 이름과 포스트백 주소를 그에 맞춥니다.')}
      <h3>A. 오퍼월 호스팅 (가장 간단)</h3>
      <pre class="ow-pre">${esc(origin)}/ow/wall?nw={매체 코드}&amp;{회원 파라미터}={USER_ID}&amp;ts={유닉스 초}&amp;sig={서명}
sig = hex(HMAC-SHA256(비밀키, "wall.{USER_ID}.{ts}"))</pre>
      <p class="form-hint">매체 앱의 ‘포인트 받기’ 버튼에서 위 주소를 웹뷰로 열면 방문하기·참여하기·팔로우하기·콘텐츠보기 목록과 포인트 조회 화면이 그대로 나옵니다.</p>
      <h3>B. 피드 연동 (매체가 자기 오퍼월에 직접 그림)</h3>
      <pre class="ow-pre">GET ${esc(origin)}/ow/v1/offers
X-Adsform-Key: {API 키}
X-Adsform-Timestamp: {유닉스 초}
X-Adsform-Signature: hex(HMAC-SHA256(비밀키, "{Timestamp}\\nGET\\n/ow/v1/offers"))</pre>
      <p class="form-hint">응답: category(visit·join·follow·content), type, title, action(예: “유튜브 구독하면”), reward, point_unit, icon_url, banner_url, badge, repeat, steps, remaining, landing_url. 회원이 누르면 <code>landing_url</code>에 클릭 ID·회원 식별값·ts·sig(<code>{오퍼 ID}.{CLICK_ID}.{USER_ID}.{ts}</code>)를 넣어 보냅니다. 클릭 상태 조회: <code>GET /ow/v1/clicks/{클릭 ID}</code>.</p>
      <h3>C. 완료 포스트백 (애즈폼 → 매체)</h3>
      <pre class="ow-pre">매크로: ${data.macros.map(name => `{${name}}`).join(' ')}
signature = hex(HMAC-SHA256(비밀키, "{transaction_id}.{click_id}.{timestamp}"))
헤더: X-Adsform-Timestamp, X-Adsform-Signature</pre>
      <p class="form-hint">방문·콘텐츠·퀴즈·키워드 팔로우는 즉시, 설문·캡처 인증은 검수 승인 시, 미션형은 단계마다({event}) 보냅니다. HTTP 2xx면 성공, 실패 시 1분·5분·30분·2시간·6시간 뒤 재시도(최대 6회). transaction_id는 참여(단계)마다 고정이라 매체에서 중복 지급을 막을 수 있습니다.</p>
      <h3>D. 미션형 전환 통보 (광고주 서버 → 애즈폼)</h3>
      <pre class="ow-pre">광고주 페이지로 이동할 때 ?adsform_click={클릭값}이 붙습니다.
POST ${esc(origin)}/ow/v1/conversions   본문 {"click":"{클릭값}","event":"{이벤트 코드}"}
X-Adsform-Offer: {오퍼 ID}
X-Adsform-Timestamp: {유닉스 초}
X-Adsform-Signature: hex(HMAC-SHA256(전환 비밀키, "{Timestamp}\\nPOST\\n/ow/v1/conversions\\n{sha256(본문)}"))</pre></section>`;
  }

  /* ---------- 광고 계정 ---------- */
  async function ownerView() {
    mine = await api('/api/offerwall/mine');
    const live = mine.offers.filter(o => ['active', 'paused'].includes(o.status));
    const reserved = live.reduce((sum, o) => sum + Math.max(0, o.budget - o.spent), 0);
    return `${strip([['진행 중인 광고', `${format(live.length)}개`], ['심사 대기', `${format(mine.offers.filter(o => o.status === 'review').length)}건`], ['오늘 완료', `${format(mine.offers.reduce((sum, o) => sum + o.today, 0))}건`],
      ['누적 집행', `${format(mine.offers.reduce((sum, o) => sum + o.spent, 0))}원`], ['진행 광고 남은 예산', `${format(reserved)}원`], ['사용 가능 잔액', `${format(mine.balance)}원`]])}
      <section class="panel ow-intro-panel"><div><h2>오퍼월 광고</h2><p>버즈빌·애드팝콘 등 리워드 앱의 ‘포인트 받기’ 화면에 광고가 노출되고, 회원이 미션을 완료한 건만 집행됩니다. 등록하면 예산(건당 단가 × 목표)이 배정되고 운영팀 심사 후 공급돼요.</p></div>
        <div class="actions">${btn(`${icon('target')} 오퍼월 광고 등록`, 'type="button" data-ow-offer-new', 'primary')}</div></section>
      <div class="ow-type-guide">${Object.keys(mine.types).map(type => `<div><b>${typeName[type]}</b><span>${typeIntro[type]}</span><em>${type === 'cpa' ? `합계 ${format(mine.rates.costs.cpa)}원부터` : `건당 ${format(mine.rates.costs[type])}원`}</em></div>`).join('')}</div>
      ${mine.offers.length ? `<div class="order-grid">${mine.offers.map(offer => offerCard(offer, false)).join('')}</div>` : empty('아직 등록한 오퍼월 광고가 없어요.')}`;
  }

  /* ---------- 광고 등록·수정 폼 ---------- */
  const isAdmin = () => h.isAdmin();
  const source = () => (isAdmin() ? data : mine);
  const group = (forTypes, html) => `<fieldset class="ow-group" data-for="${forTypes}">${html}</fieldset>`;

  function questionBlock(n, question = {}) {
    const choices = question.choices || [];
    return `<fieldset class="ow-q" data-ow-q="${n}"${n === 1 || question.prompt ? '' : ' hidden'}><legend>${n}번 문항${n > 1 ? ' (선택)' : ''}</legend>
      ${field('질문', `q${n}_prompt`, 'text', `maxlength="200" value="${esc(question.prompt || '')}"`)}
      <div class="ow-choices"><div class="two">${[1, 2, 3, 4, 5].map(i => field(`선택지 ${i}`, `q${n}_c${i}`, 'text', `maxlength="60" value="${esc(choices[i - 1] || '')}"`)).join('')}
        ${select('정답', `q${n}_answer`, [1, 2, 3, 4, 5].map(i => [i, `선택지 ${i}`]))}</div></div></fieldset>`;
  }

  function imagePicker(kind, label, id) {
    const size = kind === 'icon' ? '256×256' : '1080×540';
    return `<div class="ow-image"><input type="hidden" name="${kind}_id" value="${id || ''}"><span class="ow-image-preview ${kind}">${id ? `<img src="/ow/img/${id}" alt="">` : '없음'}</span>
      <div><label class="btn quiet small">${label} 선택<input type="file" accept="image/*" data-ow-image="${kind}" hidden></label>${btn('지우기', `type="button" data-ow-image-clear="${kind}"`, 'quiet small')}
      <small>${label} · ${size}로 자동 맞춤</small></div></div>`;
  }

  function offerForm(offer) {
    const admin = isAdmin();
    const type = offer?.type || 'visit';
    const today = h.today();
    const { costs } = source().rates;
    const steps = offer?.steps?.length ? offer.steps : [];
    return `<form class="form ow-offer-form" data-form="${offer ? 'offerwall/offer/update' : 'offerwall/offer'}">${offer ? `<input type="hidden" name="id" value="${offer.id}">` : ''}
      ${offer ? `<input type="hidden" name="type" value="${type}"><p class="notice">${typeName[type]} 광고 · ${admin ? (offer.status === 'active' ? '공급 중에는 문항·정답·미션 단계·인증 키워드를 바꿀 수 없어요.' : '저장하면 바로 반영됩니다.') : '심사 대기 중에는 내용을 고칠 수 있어요. 목표 수량은 승인 후 연장·증액으로 늘립니다.'}</p>` : `
      <div class="ow-type-picker" role="radiogroup" aria-label="광고 유형">${Object.keys(source().types).map(key => `<label><input type="radio" name="type" value="${key}"${key === type ? ' checked' : ''}><b>${typeName[key]}</b><small>${typeIntro[key]}</small>
        ${admin ? '' : `<em>${key === 'cpa' ? `합계 ${format(costs.cpa)}원부터` : `건당 ${format(costs[key])}원`}</em>`}</label>`).join('')}</div>`}
      <div class="two">${field('광고 제목', 'title', 'text', `required maxlength="60" placeholder="예: 두뇌 풀가동, 스피드 퀴즈!" value="${esc(offer?.title || '')}"`)}${field('브랜드명', 'brand', 'text', `required maxlength="40" value="${esc(offer?.brand || '')}"`)}</div>
      ${textarea('광고 소개 (참여 화면 상단 안내 · 퀴즈 힌트를 담아 주세요)', 'intro', 'required maxlength="1000" rows="3"')}
      <div class="two">${field('강조 문구 (선택 · 8자)', 'badge', 'text', `maxlength="8" placeholder="예: 간편조회, 앱접속만" value="${esc(offer?.badge || '')}"`)}<span></span></div>
      <div class="ow-images">${imagePicker('icon', '아이콘', offer?.icon_id)}${imagePicker('banner', '배너', offer?.banner_id)}</div>
      ${group('visit content cpa', field('광고 페이지 주소 (https)', 'target_url', 'url', `maxlength="1000" placeholder="https://" value="${esc(offer && offer.type !== 'follow' ? offer.target_url : '')}"`) +
        '<p class="form-hint" data-for-hint="cpa">미션형은 이 주소 뒤에 <code>adsform_click</code> 값이 붙습니다. 광고주 서버가 이 값으로 단계 완료를 알려 주세요.</p>')}
      ${group('visit content', select('참여 주기', 'repeat', [['daily', '하루 1회 반복 (매일 모으기)'], ['once', '회원당 1회']]))}
      ${group('follow', `<div class="two">${select('SNS', 'sns', Object.entries(source().sns).map(([key, item]) => [key, item.label]))}${select('인증 방식', 'verify', [['screenshot', '캡처 화면 업로드 · 운영팀 검수'], ['keyword', '인증 키워드 입력 · 즉시 확인']])}</div>
        ${field('채널 주소 (https)', 'target_url', 'url', `maxlength="1000" placeholder="https://www.youtube.com/@채널" value="${esc(offer?.type === 'follow' ? offer.target_url : '')}"`)}
        <div class="two">${field('인증 키워드 (키워드 방식)', 'keyword', 'text', `maxlength="20" placeholder="채널 소개글에 넣은 단어" value="${esc(offer?.keyword || '')}"`)}<span></span></div>`)}
      ${group('follow cpa', field('참여 방법 안내 (선택)', 'guide', 'text', `maxlength="300" value="${esc(offer?.guide || '')}"`))}
      ${group('quiz survey', `<div class="ow-questions">${Array.from({ length: 10 }, (_, i) => questionBlock(i + 1, offer?.questions?.[i])).join('')}</div>${btn('+ 문항 추가', 'type="button" data-ow-add-question', 'quiet small')}`)}
      ${group('quiz', `<div class="two">${field('응시 기회 (1~5번)', 'attempts', 'number', `min="1" max="5" value="${offer?.attempts ?? 1}"`)}<span></span></div>`)}
      ${group('survey', check('운영팀이 답변을 검수한 뒤 완료 처리 (끄면 제출 즉시 완료)', 'review', offer ? offer.review : true))}
      ${group('cpa', `<div class="ow-steps-edit"><p class="form-hint">단계별 이름·이벤트 코드(광고주 서버가 보낼 값)·단가. 예: 앱 설치(install) 300원 → 회원가입(signup) 500원 → 첫 구매(purchase) 1,200원</p>
        ${Array.from({ length: 5 }, (_, i) => {
          const step = steps[i] || {};
          return `<div class="ow-step-row"${i === 0 || step.label ? '' : ' hidden'} data-ow-step="${i + 1}">${field(`${i + 1}단계 이름`, `s${i + 1}_label`, 'text', `maxlength="40" value="${esc(step.label || '')}"`)}
            ${field('이벤트 코드', `s${i + 1}_code`, 'text', `maxlength="24" placeholder="signup" value="${esc(step.code || '')}"`)}${field('단가(원)', `s${i + 1}_cost`, 'number', `min="1" max="1000000" value="${step.cost || ''}"`)}</div>`;
        }).join('')}
        ${btn('+ 단계 추가', 'type="button" data-ow-add-step', 'quiet small')}</div>`)}
      <div class="two">${field('목표 완료 수', 'goal', 'number', `required min="1" max="1000000" value="${offer?.goal ?? 1000}"${offer && !admin ? ' readonly' : ''}`)}${field('일일 한도 (선택)', 'daily_cap', 'number', `min="0" max="1000000" placeholder="제한 없음" value="${offer?.daily_cap ?? ''}"`)}</div>
      <div class="two">${field('시작일', 'start', 'date', `required${offer ? '' : ` min="${today}"`} value="${offer?.start_date || today}"`)}${field('종료일', 'end', 'date', `required min="${today}" value="${offer?.end_date || new Date(Date.parse(today) + 29 * 86_400_000).toISOString().slice(0, 10)}"`)}</div>
      <div class="two">${field('최소 체류 시간 (초)', 'min_dwell', 'number', `min="0" max="600" value="${offer?.min_dwell ?? ''}" placeholder="유형 기본값"`)}${field('같은 IP 하루 참여 한도', 'ip_daily_limit', 'number', `min="1" max="10000" value="${offer?.ip_daily_limit ?? 30}"`)}</div>
      ${admin && data.networks.length ? `<fieldset class="ow-placement-set"><legend>매체별 공급 <small>비워 두면 단가 × 배분율로 자동 계산</small></legend>
        ${data.networks.map(network => {
          const p = offer?.placements?.find(item => item.network_id === network.id);
          return `<div class="ow-placement">${check(`${esc(network.name)}${network.status === 'active' ? '' : ' (일시중지)'}`, `p${network.id}_on`, p ? p.status === 'active' : true)}
            ${field('공급 단가(원)', `p${network.id}_price`, 'number', `min="0" max="1000000" placeholder="자동" value="${p?.price ?? ''}"`)}${field(`리워드(${esc(network.point_unit)})`, `p${network.id}_reward`, 'number', `min="0" max="10000000" placeholder="자동" value="${p?.reward ?? ''}"`)}</div>`;
        }).join('')}</fieldset>` : ''}
      ${admin ? '' : '<div class="ow-estimate" aria-live="polite"></div>'}
      <p class="form-hint">${admin ? '운영 광고는 ‘작성 중’으로 저장됩니다. 미리보기 후 ‘공급 시작’을 누르세요.' : '등록하면 예산이 잔액에서 배정되고 운영팀 심사 후 공급됩니다. 완료된 건만 집행되며, 종료 시 남은 예산은 자동으로 돌아와요.'}</p>
      ${btn(offer ? '저장' : admin ? '운영 광고 저장' : '광고 등록 (예산 배정)', 'type="submit"')}</form>`;
  }

  function syncOfferForm(form) {
    const type = form.querySelector('input[name="type"]:checked')?.value || form.elements.type?.value;
    for (const node of form.querySelectorAll('[data-for]')) {
      const on = node.dataset.for.split(' ').includes(type);
      node.hidden = !on;
      node.disabled = !on;
    }
    for (const hint of form.querySelectorAll('[data-for-hint]')) hint.hidden = hint.dataset.forHint !== type;
    const quiz = type === 'quiz';
    for (const node of form.querySelectorAll('.ow-choices')) node.hidden = !quiz;
    for (const block of form.querySelectorAll('[data-ow-q]')) {
      const n = block.dataset.owQ;
      const answer = block.querySelector(`[name="q${n}_answer"]`);
      for (const option of answer.options) {
        const value = block.querySelector(`[name="q${n}_c${option.value}"]`).value.trim();
        option.disabled = !value;
        option.textContent = value ? `선택지 ${option.value} · ${value.slice(0, 18)}` : `선택지 ${option.value} (비어 있음)`;
      }
      if (answer.selectedOptions[0]?.disabled) answer.value = [...answer.options].find(option => !option.disabled)?.value || '1';
      const prompt = block.querySelector(`[name="q${n}_prompt"]`);
      prompt.required = n === '1';
      for (const i of [1, 2]) block.querySelector(`[name="q${n}_c${i}"]`).required = quiz && Boolean(prompt.value.trim());
    }
    for (const input of form.querySelectorAll('[name="target_url"]')) input.required = true;
    const keyword = form.querySelector('[name="keyword"]');
    if (keyword) keyword.required = form.querySelector('[name="verify"]').value === 'keyword';
    for (const i of ['label', 'code', 'cost']) form.querySelector(`[name="s1_${i}"]`).required = true;
    const estimate = form.querySelector('.ow-estimate');
    if (estimate && mine) {
      const goal = Number(form.elements.goal.value || 0);
      const unit = type === 'cpa' ? [1, 2, 3, 4, 5].reduce((sum, i) => sum + (form.querySelector(`[name="s${i}_label"]`).value.trim() ? Number(form.querySelector(`[name="s${i}_cost"]`).value || 0) : 0), 0) : mine.rates.costs[type];
      const editing = form.dataset.form === 'offerwall/offer/update';
      const budget = unit * goal;
      const after = mine.balance - (editing ? 0 : budget);
      estimate.innerHTML = `<dl class="quote-balance"><div><dt>건당 단가</dt><dd>${format(unit)}원</dd></div><div><dt>배정 예산</dt><dd>${format(budget)}원</dd></div>
        <div><dt>${editing ? '사용 가능 잔액' : '등록 후 잔액'}</dt><dd class="${after < 0 ? 'minus' : ''}">${format(after)}원</dd></div></dl>
        ${type === 'cpa' && unit < mine.rates.costs.cpa ? `<p class="quote-warn">단계 단가 합계는 ${format(mine.rates.costs.cpa)}원 이상이어야 해요.</p>` : ''}
        ${after < 0 ? `<p class="quote-warn">잔액이 ${format(-after)}원 부족해요. <a href="/manage?tab=charges">충전 신청하기</a></p>` : ''}`;
    }
  }

  function openOffer(id) {
    const offer = id ? (source()?.offers || []).find(o => o.id === id) : null;
    modal('OFFERWALL AD', offer ? '오퍼월 광고 수정' : isAdmin() ? '운영 광고 만들기' : '오퍼월 광고 등록', offerForm(offer), true);
    const form = dialog.querySelector('form[data-form]');
    form.elements.intro.value = offer?.intro || '';
    if (offer?.repeat) form.querySelector('[name="repeat"]').value = offer.repeat;
    if (offer?.sns) form.querySelector('[name="sns"]').value = offer.sns;
    if (offer?.verify) form.querySelector('[name="verify"]').value = offer.verify;
    offer?.questions?.forEach((question, i) => { if (question.answer !== undefined) form.querySelector(`[name="q${i + 1}_answer"]`).value = String(question.answer + 1); });
    syncOfferForm(form);
  }

  function openExtend(id) {
    const offer = mine.offers.find(o => o.id === id);
    modal('OFFERWALL AD', '연장·증액', `<p>목표 완료 수를 늘리거나 종료일을 미룰 수 있어요. 늘린 건수만큼 예산(건당 ${format(offer.cost)}원)이 추가 배정되고, 끝난 뒤 남은 예산은 자동으로 돌아옵니다.</p>
      <form class="form" data-form="offerwall/offer/extend"><input type="hidden" name="id" value="${offer.id}">
        <div class="two">${field('목표 완료 수', 'goal', 'number', `required min="${offer.goal}" max="1000000" value="${offer.goal}"`)}${field('종료일', 'end', 'date', `required min="${offer.end_date}" value="${offer.end_date}"`)}</div>
        <p class="form-hint">사용 가능 잔액 ${format(mine.balance)}원</p>${btn('연장·증액', 'type="submit"')}</form>`);
  }

  function openConversion(id) {
    const offer = (source()?.offers || []).find(o => o.id === id);
    modal('CPA CONVERSION', '미션 전환 연동', `<p>회원이 ‘미션 참여하러 가기’를 누르면 광고 페이지 주소 뒤에 <code class="ow-code">adsform_click</code> 값이 붙습니다. 회원이 각 단계를 마치면 광고주 서버에서 아래처럼 알려 주세요.</p>
      <pre class="ow-pre">POST ${esc(location.origin)}/ow/v1/conversions
Content-Type: application/json
X-Adsform-Offer: ${esc(offer.slug)}
X-Adsform-Timestamp: {유닉스 초}
X-Adsform-Signature: hex(HMAC-SHA256(전환 비밀키, "{Timestamp}\\nPOST\\n/ow/v1/conversions\\n" + sha256(본문)))

{"click":"{adsform_click 값}","event":"${esc(offer.steps[0]?.code || 'signup')}"}</pre>
      <p class="form-hint">이벤트 코드: ${offer.steps.map(step => `<code class="ow-code">${esc(step.code)}</code> ${esc(step.label)}`).join(' · ')} · 같은 단계를 여러 번 보내도 한 번만 집행돼요. 전환 인정 기간은 참여 후 30일입니다.</p>
      <form class="form" data-form="offerwall/offer/convkey"><input type="hidden" name="id" value="${offer.id}"><p class="form-hint">전환 비밀키는 등록할 때 한 번만 보여 드렸어요. 잃어버렸다면 새로 발급하세요. 이전 키는 즉시 쓸 수 없게 됩니다.</p>${btn('전환 비밀키 새로 발급', 'type="submit"', 'quiet small')}</form>`, true);
  }

  // 아이콘·배너는 브라우저에서 정해진 크기로 잘라 JPG로 다시 그린 뒤 올립니다(사진 정보 제거).
  async function uploadImage(input) {
    const kind = input.dataset.owImage;
    const file = input.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type) || file.size > 15 * 1024 * 1024) return showToast('15MB 이하의 이미지 파일을 골라 주세요.');
    const [w, hgt] = kind === 'icon' ? [256, 256] : [1080, 540];
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = hgt;
      const context = canvas.getContext('2d');
      const scale = Math.max(w / bitmap.width, hgt / bitmap.height);
      context.fillStyle = '#fff';
      context.fillRect(0, 0, w, hgt);
      context.drawImage(bitmap, (w - bitmap.width * scale) / 2, (hgt - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
      let blob;
      for (const quality of [0.88, 0.75, 0.6]) {
        blob = await new Promise(done => canvas.toBlob(done, 'image/jpeg', quality));
        if (blob.size < 580 * 1024) break;
      }
      const response = await fetch(`/api/offerwall/asset?kind=${kind}`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '이미지를 올리지 못했어요.');
      const box = input.closest('.ow-image');
      box.querySelector(`input[name="${kind}_id"]`).value = result.id;
      box.querySelector('.ow-image-preview').innerHTML = `<img src="/ow/img/${result.id}" alt="">`;
      showToast('이미지를 올렸어요.');
    } catch (error) {
      showToast(error.message || '이미지를 읽지 못했어요.');
    }
  }

  /* ---------- 매체 폼 ---------- */
  function networkForm(network) {
    const n = network || { preset: 'buzzvil', ...data.presets.buzzvil, code: 'buzzvil', sign_landing: true, postback_method: 'GET', postback_url: '', ip_allowlist: '', reward_rate: 100, point_unit: 'P' };
    return `<form class="form" data-form="${network ? 'offerwall/network/update' : 'offerwall/network'}">${network ? `<input type="hidden" name="id" value="${network.id}">` : `
      ${select('매체 유형', 'preset', [['buzzvil', '버즈빌'], ['adpopcorn', '애드팝콘'], ['custom', '그 밖의 매체 (직접 입력)']])}`}
      <div class="two">${network ? '' : field('매체 코드', 'code', 'text', `required minlength="2" maxlength="20" value="${esc(n.code)}"`)}${field('매체 이름', 'name', 'text', `required maxlength="40" value="${esc(n.name)}"`)}</div>
      <div class="two">${field('클릭 ID 파라미터', 'click_param', 'text', `required maxlength="32" value="${esc(n.click_param)}"`)}${field('회원 식별 파라미터', 'user_param', 'text', `required maxlength="32" value="${esc(n.user_param)}"`)}</div>
      <div class="two">${field('리워드 환산율 (%)', 'reward_rate', 'number', `required min="0" max="100000" value="${n.reward_rate}"`)}${field('포인트 단위', 'point_unit', 'text', `required maxlength="8" value="${esc(n.point_unit)}"`)}</div>
      <p class="form-hint">회원에게 보이는 리워드 = 공급 단가 × 환산율. 예: 공급 120원, 환산율 100% → 120${esc(n.point_unit)}</p>
      ${check('랜딩·오퍼월 링크 서명 필수 (권장 · 위조 클릭 차단)', 'sign_landing', n.sign_landing)}
      ${select('포스트백 방식', 'postback_method', [['GET', 'GET · 주소에 값 포함'], ['POST', 'POST · JSON 본문']])}
      ${field('포스트백 주소', 'postback_url', 'url', `maxlength="1000" placeholder="https://매체주소/postback?click_id={click_id}&amp;tx={transaction_id}" value="${esc(n.postback_url)}"`)}
      <p class="form-hint">매크로: ${data.macros.map(name => `{${name}}`).join(' ')} · https 주소만 저장됩니다.</p>
      ${textarea('매체 서버 허용 IP (선택)', 'ip_allowlist', `maxlength="500" rows="2" placeholder="예: 203.0.113.10, 198.51.100.0/24" data-prefill="${esc(n.ip_allowlist)}"`)}
      ${network ? select('상태', 'status', [['active', '연동 중'], ['paused', '일시중지 · 피드·랜딩 차단']]) : ''}
      <p class="form-hint">파라미터 이름과 포스트백 주소는 매체와 계약 후 받은 연동 문서를 기준으로 맞춰 주세요. 기본값은 예시입니다. 등록하면 진행 중인 광고가 이 매체에도 자동 공급됩니다.</p>
      ${btn(network ? '설정 저장' : '매체 등록하고 키 발급', 'type="submit"')}</form>`;
  }

  function openNetwork(id) {
    const network = id ? data.networks.find(n => n.id === id) : null;
    modal('OFFERWALL NETWORK', network ? `${esc(network.name)} 설정` : '오퍼월 매체 등록', networkForm(network), true);
    const form = dialog.querySelector('form[data-form]');
    if (network) {
      form.elements.status.value = network.status;
      form.elements.postback_method.value = network.postback_method;
    }
    form.elements.ip_allowlist.value = form.elements.ip_allowlist.dataset.prefill || '';
  }

  function showSecret(title, rows, note) {
    modal('OFFERWALL KEY', title, `<p class="notice warn">${icon('lock')} 비밀키는 지금 한 번만 보여 드려요. 창을 닫으면 다시 볼 수 없으니 안전한 경로로 전달·보관하세요.</p>
      <dl class="ow-kv">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd><code class="ow-code">${esc(value)}</code> ${btn('복사', `type="button" data-ow-copy="${esc(value)}"`, 'quiet small')}</dd></div>`).join('')}</dl>
      <p class="form-hint">${note}</p>`, true);
  }

  function reveal(form, selector, button) {
    const next = form.querySelector(`${selector}[hidden]`);
    if (next) {
      next.hidden = false;
      next.querySelector('input').focus();
    }
    if (!form.querySelector(`${selector}[hidden]`)) button.hidden = true;
  }

  return {
    adminView,
    ownerView,
    click(button) {
      const d = button.dataset;
      if ('owNetworkNew' in d) return openNetwork(0), true;
      if ('owNetworkEdit' in d) return openNetwork(Number(d.owNetworkEdit)), true;
      if ('owOfferNew' in d) return openOffer(0), true;
      if ('owOfferEdit' in d) return openOffer(Number(d.owOfferEdit)), true;
      if ('owExtend' in d) return openExtend(Number(d.owExtend)), true;
      if ('owConv' in d) return openConversion(Number(d.owConv)), true;
      if ('owImageClear' in d) {
        const box = button.closest('.ow-image');
        box.querySelector(`input[name="${d.owImageClear}_id"]`).value = '';
        box.querySelector('.ow-image-preview').textContent = '없음';
        return true;
      }
      if ('owNetworkRotate' in d) {
        const network = data.networks.find(n => n.id === Number(d.owNetworkRotate));
        modal('OFFERWALL KEY', `${esc(network.name)} 키 재발급`, `<p>새 API 키와 비밀키를 만들면 <b>이전 키는 즉시 쓸 수 없게 됩니다.</b> 열려 있던 호스팅 오퍼월 세션도 끊겨요. 매체에 새 키를 반영할 시간을 맞춘 뒤 진행하세요.</p>
          <form class="form" data-form="offerwall/network/rotate"><input type="hidden" name="id" value="${network.id}">${field('확인을 위해 ‘재발급’을 입력하세요', 'confirm', 'text', 'required pattern="재발급" autocomplete="off"')}${btn('키 재발급', 'type="submit"', 'danger')}</form>`);
        return true;
      }
      if ('owAddQuestion' in d) return reveal(button.form, '[data-ow-q]', button), true;
      if ('owAddStep' in d) return reveal(button.form, '[data-ow-step]', button), true;
      if ('owCopy' in d) {
        navigator.clipboard?.writeText(d.owCopy).then(() => showToast('복사했습니다.'), () => showToast('복사하지 못했어요. 직접 선택해 복사해 주세요.'));
        return true;
      }
      return false;
    },
    input(event) {
      const form = event.target.form;
      if (event.target.matches?.('[data-ow-image]')) return uploadImage(event.target);
      if (!form) return;
      if (['offerwall/offer', 'offerwall/offer/update'].includes(form.dataset.form)) syncOfferForm(form);
      if (form.dataset.form === 'offerwall/network' && event.target.name === 'preset') {
        const preset = data.presets[event.target.value];
        if (preset.name) form.elements.name.value = preset.name;
        form.elements.code.value = event.target.value === 'custom' ? '' : event.target.value;
        form.elements.click_param.value = preset.click_param;
        form.elements.user_param.value = preset.user_param;
      }
    },
    // 저장 후 처리. true를 돌려주면 기본 안내를 건너뜁니다.
    after(path, result) {
      if (path === 'offerwall/network' || path === 'offerwall/network/rotate') {
        showSecret(path === 'offerwall/network' ? '매체 등록 완료 · 연동 키' : '키 재발급 완료', [['API 키', result.apiKey], ['비밀키', result.secret]], '메신저·이메일 본문에 그대로 붙여 넣지 말고, 암호를 건 파일이나 매체가 지정한 보안 채널로 보내 주세요.');
        return true;
      }
      if (result?.convSecret) {
        showSecret(path === 'offerwall/offer' ? '광고 등록 완료 · 미션 전환 비밀키' : '전환 비밀키 재발급', [['오퍼 ID', result.slug], ['전환 비밀키', result.convSecret]], '광고주 서버 개발자에게 전달해 전환 통보 서명에 쓰세요. 자세한 방법은 광고 카드의 ‘전환 연동’에서 볼 수 있어요.');
        return true;
      }
      if (path === 'offerwall/network/test') {
        showToast(result.code >= 200 && result.code < 300 ? `포스트백 테스트 성공 · HTTP ${result.code}` : `포스트백 테스트 실패 · ${result.code ? 'HTTP ' + result.code : ''} ${result.message}`);
        return true;
      }
      const messages = { 'offerwall/network/update': '매체 설정을 저장했습니다.', 'offerwall/offer': isAdmin() ? '운영 광고를 저장했습니다. 미리보기 후 공급을 시작하세요.' : '광고를 등록했습니다. 운영팀 심사 후 공급돼요.',
        'offerwall/offer/update': '광고를 수정했습니다.', 'offerwall/offer/status': '광고 상태를 바꿨습니다.', 'offerwall/offer/extend': result?.extra ? `연장·증액했습니다. 추가 예산 ${format(result.extra)}원을 배정했어요.` : '일정을 변경했습니다.',
        'offerwall/click/review': '검수 결과를 저장했습니다.', 'offerwall/postback/retry': '포스트백을 다시 보내고 있어요.', 'offerwall/rates': '단가 설정을 저장했습니다.' };
      if (messages[path]) return showToast(messages[path]), true;
      return false;
    }
  };
}
