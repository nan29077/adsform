// 최고관리자 콘솔의 '오퍼월 연동' 메뉴: 매체(버즈빌·애드팝콘 등) 등록, 오퍼 페이지 제작·공급, 참여·포스트백 현황.
export function setupOfferwallAdmin(h) {
  const { api, esc, format, field, textarea, select, btn, empty, panelHead, icon, modal, dialog, dateTime, day, pager, showToast, decision } = h;
  let data = null;
  const kindName = { quiz: '퀴즈', survey: '설문' };
  const offerStatus = { draft: ['작성 중', 'paused'], active: ['공급 중', 'active'], paused: ['일시중지', 'paused'], closed: ['종료', 'withdrawn'] };
  const clickStatus = { started: ['참여 중', 'paused'], pending: ['검수 대기', 'pending'], completed: ['완료', 'approved'], failed: ['오답', 'rejected'], rejected: ['반려', 'rejected'], expired: ['만료', 'withdrawn'] };
  const postbackStatus = { queued: ['재시도 대기', 'pending'], sending: ['전송 중', 'pending'], sent: ['전송 완료', 'approved'], failed: ['전송 실패', 'rejected'] };
  const tag = ([label, cls]) => `<span class="status ${cls}">${label}</span>`;
  const percent = (part, whole) => whole ? Math.round(part / whole * 1000) / 10 : 0;
  const views = [['offers', '오퍼 페이지'], ['clicks', '참여·포스트백'], ['networks', '연동 매체'], ['guide', '연동 안내']];

  function tabs(view, params) {
    return `<div class="tabs">${views.map(([key, label]) => `<a href="/manage?tab=offerwall&amp;view=${key}" class="${key === view ? 'on' : ''}">${label}${key === 'clicks' && data.counts.pending ? ` <span class="count">${format(data.counts.pending)}</span>` : ''}</a>`).join('')}</div>`;
  }

  async function view(params) {
    const query = new URLSearchParams({ status: params.get('status') || '', offer: params.get('offer') || '', page: params.get('page') || '1' });
    data = await api('/api/offerwall?' + query);
    const current = views.some(([key]) => key === params.get('view')) ? params.get('view') : 'offers';
    const strip = `<div class="summary-strip">${[['공급 중인 오퍼', `${format(data.offers.filter(o => o.status === 'active').length)}개`], ['연동 매체', `${format(data.networks.filter(n => n.status === 'active').length)}곳`],
      ['오늘 완료', `${format(data.counts.completedToday)}건`], ['설문 검수 대기', `${format(data.counts.pending)}건`],
      ['포스트백 재시도·실패', `${format(data.counts.queuedPostbacks)} · ${format(data.counts.failedPostbacks)}건`]].map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('')}</div>`;
    const body = { offers: offersView, clicks: clicksView, networks: networksView, guide: guideView }[current](params);
    return `${strip}<div class="toolbar">${tabs(current, params)}<div class="actions">${btn(`${icon('target')} 오퍼 만들기`, `type="button" data-ow-offer-new${data.networks.length ? '' : ' disabled title="매체를 먼저 등록해 주세요"'}`, 'primary small')}
      ${btn('매체 등록', 'type="button" data-ow-network-new', 'quiet small')}</div></div>${body}`;
  }

  const networkName = id => data.networks.find(n => n.id === id)?.name || `매체 #${id}`;

  function offersView() {
    if (!data.networks.length) return `<section class="panel">${panelHead('먼저 연동할 매체를 등록하세요', '버즈빌·애드팝콘 등과 계약 후 받은 연동 정보를 등록하면 오퍼를 공급할 수 있어요.')}
      <div class="actions">${btn('매체 등록', 'type="button" data-ow-network-new')}</div></section>`;
    if (!data.offers.length) return empty('아직 만든 오퍼가 없어요. ‘오퍼 만들기’로 퀴즈·설문 페이지를 만들어 보세요.');
    return `<div class="order-grid">${data.offers.map(offer => {
      const live = offer.placements.filter(p => p.status === 'active');
      const transitions = { draft: [['activate', '공급 시작']], active: [['pause', '일시중지'], ['close', '종료']], paused: [['activate', '공급 재개'], ['close', '종료']], closed: [] }[offer.status];
      return `<article class="panel order-card ow-offer"><div class="row-top"><span class="eyebrow">${kindName[offer.kind]} · 문항 ${format(offer.questions.length)}개 · #${offer.id}</span>${tag(offerStatus[offer.status])}</div>
        <h3>${esc(offer.title)}</h3><p>${esc(offer.brand)} · ${offer.start_date} ~ ${offer.end_date}${offer.reason ? ` · ${esc(offer.reason)}` : ''}</p>
        <div class="order-progress"><span>완료 ${format(offer.completed)} / 목표 ${format(offer.goal)}${offer.daily_cap ? ` · 일일 ${format(offer.daily_cap)}` : ''}</span><strong>${percent(offer.completed, offer.goal)}%</strong></div>
        <progress class="meter" value="${Math.min(offer.completed + offer.pending, offer.goal)}" max="${offer.goal}" aria-label="진행률"></progress>
        <div class="review-signals"><span>유입 ${format(offer.landings)}</span><span>전환율 ${percent(offer.completed, offer.landings)}%</span><span>검수 ${format(offer.pending)}</span><span>실패 ${format(offer.failed)}</span><span>오늘 ${format(offer.today)}</span><span>매체 정산 ${format(offer.spend)}원</span></div>
        <ul class="ow-placements">${live.map(p => `<li><b>${esc(networkName(p.network_id))}</b><span>단가 ${format(p.price)}원 · 리워드 ${format(p.reward)}</span></li>`).join('') || '<li><span>공급 매체 없음</span></li>'}</ul>
        <div class="actions"><a class="btn quiet small" href="/ow/${esc(offer.slug)}?preview=1" target="_blank" rel="noopener">미리보기</a>
          ${offer.status !== 'closed' ? btn('수정', `type="button" data-ow-offer-edit="${offer.id}"`, 'quiet small') : ''}
          <a class="btn quiet small" href="/manage?tab=offerwall&amp;view=clicks&amp;offer=${offer.id}">참여 현황</a>
          ${transitions.map(([action, label]) => decision('offerwall/offer/status', offer.id, action, label)).join('')}</div></article>`;
    }).join('')}</div>`;
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
    const filters = [['', '전체'], ['pending', '검수 대기'], ['completed', '완료'], ['started', '참여 중'], ['failed', '오답'], ['rejected', '반려'], ['expired', '만료']];
    return `<div class="toolbar"><div class="tabs">${filters.map(([key, label]) => `<a href="${link({ status: key, page: '' })}" class="${key === status ? 'on' : ''}">${label}</a>`).join('')}</div>
      ${offerId ? `<a class="btn quiet small" href="${link({ offer: '', page: '' })}">오퍼 필터 해제 · #${esc(offerId)}</a>` : ''}</div>
      ${pending.length ? `<h3 class="ow-sub">설문 검수 대기</h3><div class="order-grid">${pending.map(click => `<article class="panel order-card"><div class="row-top"><span class="eyebrow">참여 #${click.id} · ${dateTime(click.finished)}</span>${tag(clickStatus.pending)}</div>
        <h3>${esc(click.title)}</h3><p>${esc(click.network)} · 회원 ${esc(click.network_user)}</p>
        ${click.prompts.map((prompt, i) => `<p class="review-question"><small>Q${i + 1}</small> ${esc(prompt)}</p><blockquote>${esc(click.answers?.[i] ?? '')}</blockquote>`).join('')}
        <p class="form-hint">승인하면 ${esc(click.network)}에 완료 포스트백을 보내 회원에게 ${format(click.reward)} 리워드가 지급됩니다.</p>
        <div class="actions">${decision('offerwall/click/review', click.id, 'approve')}${decision('offerwall/click/review', click.id, 'reject')}</div></article>`).join('')}</div>` : ''}
      <section class="panel dash-block">${panelHead('참여 기록', `${format(data.total)}건 · 최근 순`)}
      ${data.clicks.length ? `<div class="table-wrap"><table class="data-table compact"><thead><tr><th>일시</th><th>오퍼</th><th>매체 · 회원</th><th>클릭 ID</th><th>참여</th><th>포스트백</th><th></th></tr></thead><tbody>
        ${data.clicks.map(click => `<tr><td><small>${dateTime(click.created)}</small></td><td><b>${esc(click.title)}</b><small>#${click.offer_id} · ${kindName[click.kind]}</small></td>
          <td>${esc(click.network)}<small>${esc(click.network_user)}</small></td><td><code class="ow-code">${esc(click.click_id)}</code></td>
          <td>${tag(clickStatus[click.status])}${click.tries > 1 ? `<small>${format(click.tries)}회 응시</small>` : ''}${click.reason ? `<small>${esc(click.reason)}</small>` : ''}</td>
          <td>${click.postback_status ? `${tag(postbackStatus[click.postback_status])}<small>${format(click.postback_attempts)}회${click.last_code ? ` · HTTP ${click.last_code}` : ''}${click.sent ? ` · ${dateTime(click.sent)}` : ''}</small>${click.last_error ? `<small class="ow-error-text">${esc(click.last_error)}</small>` : ''}` : '<small>−</small>'}</td>
          <td>${['failed', 'queued'].includes(click.postback_status) ? `<form data-form="offerwall/postback/retry"><input type="hidden" name="id" value="${click.postback}">${btn('지금 재전송', 'type="submit"', 'quiet small')}</form>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : empty('조건에 맞는 참여가 없어요.')}${pager(data.page, data.pages, link({ page: '' }))}</section>`;
  }

  function networksView() {
    if (!data.networks.length) return empty('등록된 매체가 없어요. 오른쪽 위 ‘매체 등록’을 눌러 주세요.');
    return `<div class="order-grid">${data.networks.map(network => `<article class="panel order-card"><div class="row-top"><span class="eyebrow">${esc(network.code)} · ${network.preset === 'custom' ? '직접 입력' : esc(data.presets[network.preset]?.name || network.preset)}</span>
        ${tag(network.status === 'active' ? ['연동 중', 'active'] : ['일시중지', 'paused'])}</div>
      <h3>${esc(network.name)}</h3>
      <dl class="ow-kv"><div><dt>API 키</dt><dd><code class="ow-code">${esc(network.api_key)}</code> ${btn('복사', `type="button" data-ow-copy="${esc(network.api_key)}"`, 'quiet small')}</dd></div>
        <div><dt>랜딩 파라미터</dt><dd>${esc(network.click_param)} · ${esc(network.user_param)} · ${network.sign_landing ? '서명 필수(ts, sig)' : '<b class="ow-warn">서명 없음</b>'}</dd></div>
        <div><dt>포스트백</dt><dd>${network.postback_url ? `${network.postback_method} <code class="ow-code">${esc(network.postback_url)}</code>` : '<b class="ow-warn">미설정 · 완료 알림을 보낼 수 없어요</b>'}</dd></div>
        <div><dt>허용 IP</dt><dd>${esc(network.ip_allowlist) || '제한 없음'}</dd></div>
        <div><dt>키 발급</dt><dd>${day(network.rotated || network.created)}${network.updated ? ` · 설정 수정 ${day(network.updated)}` : ''}</dd></div></dl>
      <div class="actions">${btn('설정 수정', `type="button" data-ow-network-edit="${network.id}"`, 'quiet small')}
        ${network.postback_url ? `<form data-form="offerwall/network/test"><input type="hidden" name="id" value="${network.id}">${btn('포스트백 테스트', 'type="submit"', 'quiet small')}</form>` : ''}
        ${btn('키 재발급', `type="button" data-ow-network-rotate="${network.id}"`, 'quiet small')}</div></article>`).join('')}</div>`;
  }

  function guideView() {
    const origin = data.origin;
    return `<section class="panel ow-guide">${panelHead('매체에 전달할 연동 규격', '버즈빌·애드팝콘 등 매체 담당자에게 아래 내용과 매체별 API 키·비밀키를 전달하세요. 매체가 정한 규격이 있으면 매체 설정의 파라미터 이름과 포스트백 주소를 그에 맞춰 바꾸면 됩니다.')}
      <h3>1. 오퍼 목록 API (매체 서버 → 애즈폼)</h3>
      <pre class="ow-pre">GET ${esc(origin)}/ow/v1/offers
X-Adsform-Key: {API 키}
X-Adsform-Timestamp: {유닉스 초}
X-Adsform-Signature: hex(HMAC-SHA256(비밀키, "{Timestamp}\\nGET\\n/ow/v1/offers"))</pre>
      <p class="form-hint">시각 오차 ±5분. 응답의 <code>landing_url</code>에 매체의 클릭 ID·회원 식별값을 넣어 회원을 보내면 됩니다. 클릭 상태는 <code>GET /ow/v1/clicks/{클릭 ID}</code>로 같은 방식으로 조회합니다.</p>
      <h3>2. 랜딩 (회원 → 애즈폼 참여 페이지)</h3>
      <pre class="ow-pre">${esc(origin)}/ow/{오퍼 ID}?nw={매체 코드}&amp;{클릭 파라미터}={CLICK_ID}&amp;{회원 파라미터}={USER_ID}&amp;ts={유닉스 초}&amp;sig={서명}
sig = hex(HMAC-SHA256(비밀키, "{오퍼 ID}.{CLICK_ID}.{USER_ID}.{ts}"))</pre>
      <p class="form-hint">서명 유효 시간 ±15분. 같은 클릭 ID는 한 번만, 같은 회원은 오퍼당 한 번만 참여할 수 있습니다. 매체가 서명을 지원하지 않으면 매체 설정에서 서명을 끌 수 있지만, 위조 클릭 차단이 약해집니다.</p>
      <h3>3. 완료 포스트백 (애즈폼 → 매체 서버)</h3>
      <pre class="ow-pre">매크로: ${data.macros.map(name => `{${name}}`).join(' ')}
signature = hex(HMAC-SHA256(비밀키, "{transaction_id}.{click_id}.{timestamp}"))
헤더: X-Adsform-Timestamp, X-Adsform-Signature</pre>
      <p class="form-hint">퀴즈는 정답 즉시, 설문은 검수 승인 시 전송합니다. HTTP 2xx를 받으면 성공으로 보고, 실패하면 1분·5분·30분·2시간·6시간 간격으로 다시 보냅니다(최대 6회). <code>transaction_id</code>는 참여마다 고정이라 매체에서 중복 지급을 막을 수 있습니다. 포스트백은 https 주소로만, 내부망 주소로는 보내지 않습니다.</p></section>`;
  }

  /* ---------- 폼 ---------- */
  const check = (label, name, on) => `<label class="check"><input type="checkbox" name="${name}" value="1"${on ? ' checked' : ''}> ${label}</label>`;

  function networkForm(network) {
    const n = network || { preset: 'buzzvil', ...data.presets.buzzvil, code: 'buzzvil', sign_landing: true, postback_method: 'GET', postback_url: '', ip_allowlist: '' };
    return `<form class="form" data-form="${network ? 'offerwall/network/update' : 'offerwall/network'}">${network ? `<input type="hidden" name="id" value="${network.id}">` : `
      ${select('매체 유형', 'preset', [['buzzvil', '버즈빌'], ['adpopcorn', '애드팝콘'], ['custom', '그 밖의 매체 (직접 입력)']])}`}
      <div class="two">${network ? '' : field('매체 코드', 'code', 'text', `required minlength="2" maxlength="20" pattern="[a-z][a-z0-9\\-]{1,19}" value="${esc(n.code)}"`)}${field('매체 이름', 'name', 'text', `required maxlength="40" value="${esc(n.name)}"`)}</div>
      <div class="two">${field('클릭 ID 파라미터', 'click_param', 'text', `required maxlength="32" value="${esc(n.click_param)}"`)}${field('회원 식별 파라미터', 'user_param', 'text', `required maxlength="32" value="${esc(n.user_param)}"`)}</div>
      ${check('랜딩 링크 서명 필수 (권장 · 위조 클릭 차단)', 'sign_landing', n.sign_landing)}
      ${select('포스트백 방식', 'postback_method', [['GET', 'GET · 주소에 값 포함'], ['POST', 'POST · JSON 본문']])}
      ${field('포스트백 주소', 'postback_url', 'url', `maxlength="1000" placeholder="https://매체주소/postback?click_id={click_id}&amp;tx={transaction_id}" value="${esc(n.postback_url)}"`)}
      <p class="form-hint">쓸 수 있는 매크로: ${data.macros.map(name => `{${name}}`).join(' ')} · https 주소만 저장됩니다.</p>
      ${textarea('매체 서버 허용 IP (선택)', 'ip_allowlist', `maxlength="500" rows="2" placeholder="예: 203.0.113.10, 198.51.100.0/24" data-prefill="${esc(n.ip_allowlist)}"`)}
      ${network ? select('상태', 'status', [['active', '연동 중'], ['paused', '일시중지 · 피드·랜딩 차단']]) : ''}
      <p class="form-hint">파라미터 이름과 포스트백 주소는 매체와 계약 후 받은 연동 문서를 기준으로 맞춰 주세요. 기본값은 예시입니다.</p>
      ${btn(network ? '설정 저장' : '매체 등록하고 키 발급', 'type="submit"')}</form>`;
  }

  function openNetwork(id) {
    const network = id ? data.networks.find(n => n.id === id) : null;
    modal('OFFERWALL NETWORK', network ? `${esc(network.name)} 설정` : '오퍼월 매체 등록', networkForm(network), true);
    const form = dialog.querySelector('form[data-form]');
    if (network) form.elements.status.value = network.status;
    if (network) form.elements.postback_method.value = network.postback_method;
    form.elements.ip_allowlist.value = form.elements.ip_allowlist.dataset.prefill || '';
  }

  function questionBlock(n, kind, question = {}, visible = true) {
    const choices = question.choices || [];
    return `<fieldset class="ow-q" data-ow-q="${n}"${visible ? '' : ' hidden'}><legend>${n}번 문항${n > 1 ? ' (선택)' : ''}</legend>
      ${field('질문', `q${n}_prompt`, 'text', `${n === 1 ? 'required ' : ''}maxlength="200" value="${esc(question.prompt || '')}"`)}
      <div class="ow-choices" ${kind === 'quiz' ? '' : 'hidden'}><div class="two">${[1, 2, 3, 4, 5].map(i => field(`선택지 ${i}`, `q${n}_c${i}`, 'text', `maxlength="60" value="${esc(choices[i - 1] || '')}"`)).join('')}
        ${select('정답', `q${n}_answer`, [1, 2, 3, 4, 5].map(i => [i, `선택지 ${i}`]))}</div></div></fieldset>`;
  }

  function offerForm(offer) {
    const kind = offer?.kind || 'quiz';
    const questions = offer?.questions || [];
    const today = h.today();
    const live = offer ? offer.placements : [];
    return `<form class="form" data-form="${offer ? 'offerwall/offer/update' : 'offerwall/offer'}">${offer ? `<input type="hidden" name="id" value="${offer.id}">` : ''}
      ${offer ? `<p class="notice">${kindName[kind]} 오퍼 · ${offer.status === 'active' ? '공급 중에는 문항·정답·응시 횟수를 바꿀 수 없어요. 일시중지한 뒤 고쳐 주세요.' : '저장하면 바로 반영됩니다.'}</p>` : `
      <div class="chips" role="radiogroup" aria-label="오퍼 유형">${[['quiz', '퀴즈 · 정답 시 즉시 완료'], ['survey', '설문 · 응답 수집']].map(([key, label]) => `<label class="chip"><input type="radio" name="kind" value="${key}"${key === kind ? ' checked' : ''}> ${label}</label>`).join('')}</div>`}
      <div class="two">${field('오퍼 제목', 'title', 'text', `required maxlength="80" value="${esc(offer?.title || '')}"`)}${field('브랜드명', 'brand', 'text', `required maxlength="50" value="${esc(offer?.brand || '')}"`)}</div>
      ${textarea('오퍼 소개 (참여 페이지 상단 안내 · 퀴즈 힌트를 담아 주세요)', 'intro', 'required maxlength="1000" rows="4"')}
      <div class="ow-questions">${Array.from({ length: 10 }, (_, i) => questionBlock(i + 1, kind, questions[i], i < Math.max(1, questions.length))).join('')}</div>
      ${btn('+ 문항 추가', 'type="button" data-ow-add-question', 'quiet small')}
      <div class="two">${field('목표 완료 수', 'goal', 'number', `required min="1" max="1000000" value="${offer?.goal ?? 1000}"`)}${field('일일 한도 (선택)', 'daily_cap', 'number', `min="0" max="1000000" placeholder="제한 없음" value="${offer?.daily_cap ?? ''}"`)}</div>
      <div class="two">${field('시작일', 'start', 'date', `required value="${offer?.start_date || today}"`)}${field('종료일', 'end', 'date', `required min="${today}" value="${offer?.end_date || new Date(Date.parse(today) + 29 * 86_400_000).toISOString().slice(0, 10)}"`)}</div>
      <div class="two ow-quiz-only" ${kind === 'quiz' ? '' : 'hidden'}>${field('응시 기회 (1~5번)', 'attempts', 'number', `min="1" max="5" value="${offer?.attempts ?? 1}"`)}<span></span></div>
      <div class="two">${field('최소 체류 시간 (초)', 'min_dwell', 'number', `min="0" max="600" value="${offer?.min_dwell ?? 5}"`)}${field('같은 IP 하루 참여 한도', 'ip_daily_limit', 'number', `min="1" max="10000" value="${offer?.ip_daily_limit ?? 30}"`)}</div>
      <div class="ow-survey-only" ${kind === 'survey' ? '' : 'hidden'}>${check('운영자가 답변을 검수한 뒤 완료 처리 (끄면 제출 즉시 완료)', 'review', offer ? offer.review : true)}</div>
      <fieldset class="ow-placement-set"><legend>공급 매체와 단가 <small>매체에 지급할 건당 단가와 매체 회원에게 표시할 리워드</small></legend>
        ${data.networks.map(network => {
          const p = live.find(item => item.network_id === network.id);
          return `<div class="ow-placement">${check(`${esc(network.name)}${network.status === 'active' ? '' : ' (일시중지)'}`, `p${network.id}_on`, p ? p.status === 'active' : !offer)}
            ${field('단가(원)', `p${network.id}_price`, 'number', `min="0" max="1000000" value="${p?.price ?? 100}"`)}${field('리워드', `p${network.id}_reward`, 'number', `min="0" max="1000000" value="${p?.reward ?? 50}"`)}</div>`;
        }).join('')}</fieldset>
      <p class="form-hint">새 오퍼는 ‘작성 중’으로 저장됩니다. 미리보기로 확인한 뒤 ‘공급 시작’을 누르면 매체 오퍼 목록 API에 나타나요. 같은 회원은 오퍼당 한 번만 참여할 수 있습니다.</p>
      ${btn(offer ? '오퍼 저장' : '오퍼 저장 (작성 중)', 'type="submit"')}</form>`;
  }

  function syncOfferForm(form) {
    const kind = form.elements.kind ? form.querySelector('input[name="kind"]:checked')?.value : data.offers.find(o => String(o.id) === form.elements.id?.value)?.kind;
    const quiz = kind === 'quiz';
    for (const node of form.querySelectorAll('.ow-choices, .ow-quiz-only')) node.hidden = !quiz;
    for (const node of form.querySelectorAll('.ow-survey-only')) node.hidden = quiz;
    for (const block of form.querySelectorAll('[data-ow-q]')) {
      const n = block.dataset.owQ;
      const answer = form.elements[`q${n}_answer`];
      for (const option of answer.options) {
        const value = form.elements[`q${n}_c${option.value}`].value.trim();
        option.disabled = !value;
        option.textContent = value ? `선택지 ${option.value} · ${value.slice(0, 18)}` : `선택지 ${option.value} (비어 있음)`;
      }
      if (answer.selectedOptions[0]?.disabled) answer.value = [...answer.options].find(option => !option.disabled)?.value || '1';
      for (const i of [1, 2]) form.elements[`q${n}_c${i}`].required = quiz && (n === '1' || Boolean(form.elements[`q${n}_prompt`].value.trim()));
    }
  }

  function openOffer(id) {
    const offer = id ? data.offers.find(o => o.id === id) : null;
    modal('OFFERWALL OFFER', offer ? '오퍼 수정' : '오퍼 페이지 만들기', offerForm(offer), true);
    const form = dialog.querySelector('form[data-form]');
    form.elements.intro.value = offer?.intro || '';
    offer?.questions.forEach((question, i) => { if (question.answer !== undefined) form.elements[`q${i + 1}_answer`].value = String(question.answer + 1); });
    syncOfferForm(form);
  }

  function showKeys(title, result) {
    modal('OFFERWALL KEY', title, `<p class="notice warn">${icon('lock')} 비밀키는 지금 한 번만 보여 드려요. 창을 닫으면 다시 볼 수 없으니 매체 담당자에게 안전한 경로로 전달하세요. 잃어버리면 ‘키 재발급’으로 새로 만들어야 합니다.</p>
      <dl class="ow-kv"><div><dt>API 키</dt><dd><code class="ow-code">${esc(result.apiKey)}</code> ${btn('복사', `type="button" data-ow-copy="${esc(result.apiKey)}"`, 'quiet small')}</dd></div>
      <div><dt>비밀키</dt><dd><code class="ow-code">${esc(result.secret)}</code> ${btn('복사', `type="button" data-ow-copy="${esc(result.secret)}"`, 'quiet small')}</dd></div></dl>
      <p class="form-hint">메신저·이메일 본문에 그대로 붙여 넣지 말고, 암호를 건 파일이나 매체가 지정한 보안 채널로 보내 주세요.</p>`, true);
  }

  return {
    view,
    click(button) {
      const d = button.dataset;
      if ('owNetworkNew' in d) return openNetwork(0), true;
      if ('owNetworkEdit' in d) return openNetwork(Number(d.owNetworkEdit)), true;
      if ('owOfferNew' in d) return openOffer(0), true;
      if ('owOfferEdit' in d) return openOffer(Number(d.owOfferEdit)), true;
      if ('owNetworkRotate' in d) {
        const network = data.networks.find(n => n.id === Number(d.owNetworkRotate));
        modal('OFFERWALL KEY', `${esc(network.name)} 키 재발급`, `<p>새 API 키와 비밀키를 만들면 <b>이전 키는 즉시 쓸 수 없게 됩니다.</b> 매체에 새 키를 반영할 시간을 맞춘 뒤 진행하세요. 이미 보낸 참여 링크도 이전 키로 서명돼 있으면 열리지 않아요.</p>
          <form class="form" data-form="offerwall/network/rotate"><input type="hidden" name="id" value="${network.id}">${field('확인을 위해 ‘재발급’을 입력하세요', 'confirm', 'text', 'required pattern="재발급" autocomplete="off"')}${btn('키 재발급', 'type="submit"', 'danger')}</form>`);
        return true;
      }
      if ('owAddQuestion' in d) {
        const next = button.form.querySelector('[data-ow-q][hidden]');
        if (next) { next.hidden = false; next.querySelector('input').focus(); }
        if (!button.form.querySelector('[data-ow-q][hidden]')) button.hidden = true;
        return true;
      }
      if ('owCopy' in d) {
        navigator.clipboard?.writeText(d.owCopy).then(() => showToast('복사했습니다.'), () => showToast('복사하지 못했어요. 직접 선택해 복사해 주세요.'));
        return true;
      }
      return false;
    },
    input(event) {
      const form = event.target.form;
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
      if (path === 'offerwall/network') return showKeys('매체 등록 완료 · 연동 키', result), true;
      if (path === 'offerwall/network/rotate') return showKeys('키 재발급 완료', result), true;
      if (path === 'offerwall/network/test') {
        showToast(result.code >= 200 && result.code < 300 ? `포스트백 테스트 성공 · HTTP ${result.code}` : `포스트백 테스트 실패 · ${result.code ? 'HTTP ' + result.code : ''} ${result.message}`);
        return true;
      }
      const messages = { 'offerwall/network/update': '매체 설정을 저장했습니다.', 'offerwall/offer': '오퍼를 저장했습니다. 미리보기로 확인한 뒤 공급을 시작하세요.', 'offerwall/offer/update': '오퍼를 수정했습니다.',
        'offerwall/offer/status': '오퍼 상태를 바꿨습니다.', 'offerwall/click/review': '검수 결과를 저장했습니다.', 'offerwall/postback/retry': '포스트백을 다시 보내고 있어요.' };
      if (messages[path]) return showToast(messages[path]), true;
      return false;
    }
  };
}
