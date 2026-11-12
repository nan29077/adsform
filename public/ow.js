// 오퍼월 매체(버즈빌·애드팝콘 등) 회원이 보는 화면
//  /ow/wall      : 포인트 받기(방문하기·참여하기·팔로우하기·콘텐츠보기) · 포인트 조회
//  /ow/{광고}    : 광고별 참여 화면(방문·콘텐츠·팔로우·퀴즈·설문·미션형)
const root = document.getElementById('ow');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const format = value => new Intl.NumberFormat('ko-KR').format(value);
const when = value => value ? new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' }).format(new Date(value)) : '';
const parts = location.pathname.split('/').filter(Boolean);
const preview = new URLSearchParams(location.search).get('preview') === '1';
const suffix = preview ? '?preview=1' : '';
let data;
let offset = 0;
let timer;

const reasons = {
  network: '연동되지 않은 앱에서 들어왔어요. 참여하신 앱의 미션 목록에서 다시 들어와 주세요.',
  params: '참여 정보가 올바르지 않아요. 참여하신 앱에서 다시 들어와 주세요.',
  stale: '참여 링크가 만료됐어요. 참여하신 앱에서 다시 들어와 주세요.',
  signature: '참여 링크를 확인할 수 없어요. 참여하신 앱에서 다시 들어와 주세요.',
  closed: '지금은 참여할 수 없는 미션이에요.',
  used: '이미 사용된 참여 링크예요. 참여하신 앱에서 다시 들어와 주세요.',
  full: '참여 인원이 모두 찼어요. 다른 미션에 참여해 주세요.',
  ip: '같은 네트워크에서 참여가 많아 오늘은 더 참여할 수 없어요.',
  busy: '요청이 많아요. 잠시 후 다시 시도해 주세요.'
};
const marks = { done: '<path d="m7 12.5 3.2 3.2L17 9"/>', wait: '<path d="M12 7.5V12l3 2"/>', fail: '<path d="M12 8v5m0 3.2h.01"/>' };
const svg = (path, size = 22) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const icons = {
  back: '<path d="M15 5l-7 7 7 7"/>', external: '<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', check: '<path d="m5 12 4 4L19 6"/>'
};
const typeName = { visit: '방문하기', content: '콘텐츠보기', follow: '팔로우하기', quiz: '퀴즈', survey: '설문', cpa: '미션' };
// 이미지가 없는 광고는 제목 첫 글자로 아이콘을 만듭니다(인라인 스타일 없이 색상 클래스 사용).
const letterIcon = (title, size = '') => `<span class="ow-letter t${[...title].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 6} ${size}">${esc([...title.replace(/^\[[^\]]*\]\s*/, '')][0] || 'A')}</span>`;
const thumb = (item, size = '') => item.icon_url || item.icon ? `<img class="ow-icon ${size}" src="${esc(item.icon_url || item.icon)}" alt="" loading="lazy">` : letterIcon(item.title, size);
const pill = (item, unit) => item.state === 'completed' ? '<span class="ow-pill done">완료</span>' : item.state === 'pending' ? '<span class="ow-pill wait">검수 중</span>'
  : ['failed', 'rejected'].includes(item.state) ? '<span class="ow-pill done">참여함</span>' : `<span class="ow-pill">${format(item.reward)}${esc(unit)}</span>`;

const backLink = () => data?.wall || (preview && parts[1] !== 'wall') ? `<a class="ow-back" href="/ow/wall${suffix}">${svg(icons.back, 18)} 미션 목록</a>` : '';
function message(title, text, tone = 'fail', extra = '') {
  clearInterval(timer);
  root.innerHTML = `${backLink()}<section class="ow-result ${tone}"><span class="ow-mark">${svg(`<circle cx="12" cy="12" r="9.5"/>${marks[tone]}`, 38)}</span>
    <h1>${esc(title)}</h1><p>${esc(text)}</p>${extra}${preview ? '<p class="ow-preview-note">미리보기 결과입니다. 기록과 포스트백은 남지 않아요.</p>' : ''}</section>`;
  root.focus();
}

async function call(path, body, type = 'application/json') {
  const response = await fetch(path, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': type }, body: type === 'application/json' ? JSON.stringify(body) : body });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(result.error || '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'), { status: response.status });
  return result;
}

function alertBar(text) {
  let bar = document.querySelector('.ow-toast');
  if (!bar) { bar = document.createElement('p'); bar.className = 'ow-toast'; bar.setAttribute('role', 'alert'); document.body.append(bar); }
  bar.textContent = text;
  bar.classList.add('on');
  clearTimeout(bar.timer);
  bar.timer = setTimeout(() => bar.classList.remove('on'), 3500);
}

/* ---------- 오퍼월 (포인트 받기 · 포인트 조회) ---------- */
const wallTabs = [['visit', '방문하기'], ['join', '참여하기'], ['follow', '팔로우하기'], ['content', '콘텐츠보기']];
const wallView = { main: 'earn', category: 'visit' };

function renderWall() {
  const { network, offers, history, totals } = data;
  const unit = network.unit;
  const counts = Object.fromEntries(wallTabs.map(([key]) => [key, offers.filter(item => item.category === key).length]));
  if (!counts[wallView.category]) wallView.category = wallTabs.find(([key]) => counts[key])?.[0] || 'visit';
  const items = offers.filter(item => item.category === wallView.category);
  const locked = item => item.state && !(item.state === 'started' || item.state === 'expired');
  const row = item => `<button type="button" class="ow-row" data-open="${esc(item.id)}"${locked(item) ? ' aria-disabled="true"' : ''}>${thumb(item)}
      <span class="ow-row-text"><b>${esc(item.title)}</b><small>${item.badge ? `<em class="ow-badge">${esc(item.badge)}</em>` : ''}${esc(item.action)}</small></span>${pill(item, unit)}</button>`;
  const card = item => `<button type="button" class="ow-card" data-open="${esc(item.id)}"${locked(item) ? ' aria-disabled="true"' : ''}>${item.banner_url ? `<img src="${esc(item.banner_url)}" alt="" loading="lazy">` : `<span class="ow-card-art">${thumb(item, 'large')}<span>${esc(item.brand)}</span></span>`}
      <span class="ow-card-foot"><span class="ow-row-text"><b>${esc(item.title)}</b><small>${item.badge ? `<em class="ow-badge">${esc(item.badge)}</em>` : ''}${esc(item.action)}</small></span>${pill(item, unit)}</span></button>`;
  const earn = `<nav class="ow-subtabs" aria-label="미션 종류">${wallTabs.map(([key, label]) => `<button type="button" data-category="${key}" class="${key === wallView.category ? 'on' : ''}"${counts[key] ? '' : ' disabled'}>${label}</button>`).join('')}</nav>
    <section class="ow-list ${wallView.category === 'visit' ? 'cards' : ''}">${items.length ? items.map(wallView.category === 'visit' ? card : row).join('') : '<p class="ow-empty">지금 참여할 수 있는 미션이 없어요. 내일 다시 확인해 주세요.</p>'}</section>
    <p class="ow-legal">${preview ? '미리보기에서는 리워드가 지급되지 않아요.' : `리워드는 ${esc(network.name)}에서 지급합니다.`} ${offers.some(item => item.repeat === 'daily') ? '매일 미션은 하루 한 번, 나머지는 미션별로 한 번 참여할 수 있어요.' : '미션별로 한 번 참여할 수 있어요.'}</p>`;
  const historyRow = (item, waiting) => `<div class="ow-history-row"><span><b>${esc(item.title)}</b><small>${when(item.created)} · ${typeName[item.type]}${waiting ? ' · 검수 중' : `${item.step && item.step !== 'done' ? ' 단계' : ''} · ${item.postback === 'sent' ? '지급 요청 완료' : '지급 요청 중'}`}</small></span><em class="${waiting ? 'wait' : ''}">+${format(item.reward)}${esc(unit)}</em></div>`;
  const check = `<section class="ow-summary"><span>애즈폼 미션으로 받은 리워드</span><strong>${format(totals.earned)}<small>${esc(unit)}</small></strong>
      <div><span>이번 달 <b>${format(totals.month || 0)}${esc(unit)}</b></span><span>적립 예정 <b>${format(totals.pending)}${esc(unit)}</b></span><span>참여 <b>${format(totals.count)}회</b></span></div></section>
    ${data.pending?.length ? `<h2 class="ow-h2">적립 예정</h2><section class="ow-history">${data.pending.map(item => historyRow(item, true)).join('')}</section>` : ''}
    <h2 class="ow-h2">적립 내역</h2><section class="ow-history">${history.length ? history.map(item => historyRow(item, false)).join('') : '<p class="ow-empty">아직 받은 리워드가 없어요. 포인트 받기에서 미션에 참여해 보세요.</p>'}</section>
    <p class="ow-legal">${preview ? '미리보기에는 적립 내역이 없어요.' : `실제 지급과 잔액은 ${esc(network.name)} 앱에서 확인할 수 있어요. 지급 요청 후 반영까지 몇 분 걸릴 수 있습니다.`}</p>`;
  root.innerHTML = `${preview ? '<p class="ow-preview">관리자 미리보기 · 진행 중인 전체 광고</p>' : ''}
    <header class="ow-wall-head"><span>${esc(network.name)} × adsform</span></header>
    <nav class="ow-maintabs" aria-label="오퍼월">${[['earn', '포인트 받기'], ['check', '포인트 조회']].map(([key, label]) => `<button type="button" data-main="${key}" class="${wallView.main === key ? 'on' : ''}">${label}</button>`).join('')}</nav>
    ${wallView.main === 'earn' ? earn : check}`;
  document.title = `${network.name} 포인트 미션 | 애즈폼`;
}

async function loadWall() {
  try {
    data = await call(`/ow/wall/state${suffix}`);
    renderWall();
  } catch (error) {
    message('오퍼월을 열 수 없어요', error.message);
  }
}

root.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button || parts[1] !== 'wall' || !data?.offers) return;
  if (button.dataset.main) { wallView.main = button.dataset.main; renderWall(); return scrollTo(0, 0); }
  if (button.dataset.category) { wallView.category = button.dataset.category; return renderWall(); }
  if (button.dataset.open) {
    if (button.getAttribute('aria-disabled') === 'true') return alertBar('이미 참여한 미션이에요.');
    if (preview) return location.assign(`/ow/${button.dataset.open}?preview=1`);
    button.disabled = true;
    try {
      const { url } = await call('/ow/wall/open', { offer: button.dataset.open });
      location.assign(url);
    } catch (error) {
      alertBar(error.message);
      button.disabled = false;
    }
  }
});

/* ---------- 광고 참여 화면 ---------- */
const results = {
  completed: ['참여 완료', '참여가 확인됐어요. 리워드는 참여하신 앱에서 잠시 후 지급됩니다.', 'done'],
  pending: ['확인 중이에요', '운영팀이 확인한 뒤 리워드가 지급돼요. 결과는 참여하신 앱에서 확인해 주세요.', 'wait'],
  failed: ['아쉬워요', '정답(인증)과 일치하지 않아 리워드를 받을 수 없어요. 다른 미션에 도전해 보세요.', 'fail'],
  rejected: ['참여 반려', '참여 내용이 기준에 맞지 않아 리워드가 지급되지 않았어요.', 'fail'],
  expired: ['참여 시간이 지났어요', '참여하신 앱의 미션 목록에서 다시 들어와 주세요.', 'fail'],
  full: ['모집이 마감됐어요', '아쉽게도 방금 참여 인원이 모두 찼어요. 다른 미션에 참여해 주세요.', 'fail'],
  closed: ['종료된 미션이에요', '지금은 참여를 받지 않는 미션입니다. 다른 미션에 참여해 주세요.', 'fail']
};
function result(status, extra = '', html = '') {
  const [title, text, tone] = results[status] || results.closed;
  message(title, extra || text, tone, html);
}

function header(offer) {
  return `${backLink()}${preview ? '<p class="ow-preview">미리보기 · 제출해도 기록되지 않아요</p>' : ''}
    ${offer.banner ? `<img class="ow-banner" src="${esc(offer.banner)}" alt="">` : ''}
    <header class="ow-head">${offer.banner ? '' : thumb(offer, 'large')}<div><span class="ow-tag">${typeName[offer.type]} · ${esc(offer.brand)}</span><h1>${esc(offer.title)}</h1>
      <p class="ow-reward"><b>${format(offer.reward)}${esc(offer.unit)}</b> ${esc(offer.action)} · ${esc(offer.network)} 지급</p></div></header>
    <section class="ow-intro"><p>${esc(offer.intro).replace(/\n/g, '<br>')}</p></section>`;
}

function dwell(button, label) {
  const { offer, click } = data;
  const ready = () => {
    const left = Math.ceil(offer.minDwell - (Date.now() + offset - click.opened) / 1000);
    button.disabled = left > 0;
    button.textContent = left > 0 ? `내용을 확인해 주세요 · ${left}초` : label;
    return left <= 0;
  };
  clearInterval(timer);
  if (!ready()) timer = setInterval(() => ready() && clearInterval(timer), 500);
}

const visitBody = () => `<div class="ow-steps-note">${svg(icons.check, 16)} 버튼을 누르면 리워드가 적립되고 광고 페이지로 이동해요.</div>
  <p class="ow-error" role="alert" hidden></p><button class="ow-submit" type="button" data-visit>방문하기</button>`;

function followBody() {
  const { offer } = data;
  const verb = offer.sns === 'youtube' ? '구독' : offer.sns === 'kakao' ? '추가' : offer.sns === 'naver' ? '이웃 추가' : '팔로우';
  return `<ol class="ow-steps"><li><b>1</b><div><strong>${esc(offer.snsLabel)} 채널 열기</strong><p>채널을 ${verb}해 주세요.</p>
      <a class="ow-outline" href="${esc(offer.target)}" target="_blank" rel="noopener noreferrer">${esc(offer.snsLabel)} 열기 ${svg(icons.external, 16)}</a></div></li>
    <li><b>2</b><div><strong>${offer.verify === 'keyword' ? '인증 키워드 입력' : '인증 화면 올리기'}</strong><p>${esc(offer.guide || (offer.verify === 'keyword' ? '채널에서 안내하는 인증 키워드를 입력하세요.' : `${verb} 완료가 보이는 화면을 캡처해 올려 주세요. 운영팀 확인 후 지급돼요.`))}</p>
      ${offer.verify === 'keyword' ? '<input class="ow-input" name="keyword" maxlength="40" autocomplete="off" placeholder="인증 키워드">'
        : `<label class="ow-file">${svg(icons.camera, 20)}<span data-file-label>캡처 화면 선택</span><input type="file" name="proof" accept="image/*" hidden></label>`}</div></li></ol>
    <p class="ow-error" role="alert" hidden></p><button class="ow-submit" type="button" data-follow>인증하고 리워드 받기</button>`;
}

function formBody() {
  const { offer, click } = data;
  const quiz = offer.type === 'quiz';
  return `<form class="ow-form" novalidate>${offer.questions.map((question, i) => `<fieldset class="ow-question"><legend><span>Q${i + 1}</span>${esc(question.prompt)}</legend>
      ${quiz ? question.choices.map((choice, c) => `<label class="ow-choice"><input type="radio" name="q${i}" value="${c}"><span>${esc(choice)}</span></label>`).join('')
        : `<textarea name="q${i}" rows="4" minlength="5" maxlength="1000" placeholder="5자 이상 입력해 주세요"></textarea>`}</fieldset>`).join('')}
    <p class="ow-error" role="alert" hidden></p>${quiz && offer.attempts > 1 ? `<p class="ow-hint">남은 응시 기회 ${format(click.triesLeft)}번</p>` : ''}
    <button class="ow-submit" type="submit">제출하기</button></form>`;
}

function renderMission(notice = '') {
  const { offer, click } = data;
  if (!['started', 'completed'].includes(click.status)) return result(click.status);
  const finished = offer.steps.every(step => click.done.includes(step.code));
  const days = preview ? 30 : Math.max(1, Math.round((click.expires - Date.now() - offset) / 86_400_000));
  root.innerHTML = `${header(offer)}${notice ? `<p class="ow-notice" role="alert">${esc(notice)}</p>` : ''}
    <ol class="ow-steps mission">${offer.steps.map((step, i) => {
      const done = click.done.includes(step.code);
      return `<li class="${done ? 'done' : ''}"><b>${done ? svg(icons.check, 14) : i + 1}</b><div><strong>${esc(step.label)}</strong><p>${done ? '완료 · 지급 요청됨' : '완료하면 적립'}</p></div><em>+${format(step.reward ?? step.cost)}${esc(offer.unit)}</em></li>`;
    }).join('')}</ol>
    ${offer.guide ? `<p class="ow-hint left">${esc(offer.guide)}</p>` : ''}
    <div class="ow-steps-note">${svg(icons.check, 16)} 광고주 페이지에서 미션을 완료하면 자동으로 확인돼요. 반영까지 몇 분 걸릴 수 있고, ${days}일 안에 완료해야 해요.</div>
    <p class="ow-error" role="alert" hidden></p>${finished ? '<p class="ow-hint">모든 미션을 완료했어요!</p>' : '<button class="ow-submit" type="button" data-go>미션 참여하러 가기</button>'}`;
  bind();
}

function renderOffer(notice = '') {
  const { offer, click } = data;
  if (offer.type === 'cpa') return renderMission(notice);
  if (['visit', 'content'].includes(offer.type) && click.status === 'completed') {
    return result('completed', offer.repeat === 'daily' ? '오늘은 이미 참여했어요. 내일 다시 참여할 수 있어요.' : '', `<a class="ow-submit" href="${esc(offer.target)}" rel="noopener">페이지 다시 보기 ${svg(icons.external, 18)}</a>`);
  }
  if (click.status !== 'started') return result(click.status, click.status === 'rejected' && click.reason ? `사유: ${click.reason}` : '');
  const body = { visit: visitBody, content: visitBody, follow: followBody, quiz: formBody, survey: formBody }[offer.type]();
  root.innerHTML = `${header(offer)}${notice ? `<p class="ow-notice" role="alert">${esc(notice)}</p>` : ''}${body}`;
  bind();
}

function showError(text) {
  const node = root.querySelector('.ow-error');
  if (!node) return alertBar(text);
  node.textContent = text;
  node.hidden = false;
}

async function send(button, body, path = 'submit', type) {
  root.querySelector('.ow-error')?.setAttribute('hidden', '');
  button.disabled = true;
  try {
    return await call(`/ow/${parts[1]}/${path}${suffix}`, body, type);
  } catch (error) {
    showError(error.message);
    button.disabled = false;
    return null;
  }
}

// 인증 화면은 브라우저에서 다시 그려 JPG로 보냅니다(위치정보 등 사진 정보 제거, 크기 축소).
async function reencode(file) {
  if (!file) throw new Error('캡처 화면을 골라 주세요.');
  if (!/^image\//.test(file.type) || file.size > 15 * 1024 * 1024) throw new Error('15MB 이하의 이미지 파일을 골라 주세요.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(200, Math.round(bitmap.width * scale));
  canvas.height = Math.max(200, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.85, 0.7, 0.55]) {
    const blob = await new Promise(done => canvas.toBlob(done, 'image/jpeg', quality));
    if (blob && blob.size <= 1500 * 1024) return blob;
  }
  throw new Error('이미지가 너무 커요. 다른 캡처 화면을 골라 주세요.');
}

function bind() {
  const { offer } = data;
  const visit = root.querySelector('[data-visit]');
  if (visit) {
    dwell(visit, `${offer.type === 'content' ? '콘텐츠 보고' : '방문하고'} ${format(offer.reward)}${offer.unit} 받기`);
    visit.addEventListener('click', async () => {
      const outcome = await send(visit, {});
      if (!outcome) return;
      if (outcome.status === 'completed' && outcome.url) {
        message('적립 완료!', '광고 페이지로 이동할게요.', 'done');
        if (!preview) setTimeout(() => location.assign(outcome.url), 700);
        return;
      }
      result(outcome.status);
    });
  }
  const follow = root.querySelector('[data-follow]');
  if (follow) {
    dwell(follow, '인증하고 리워드 받기');
    const file = root.querySelector('input[name="proof"]');
    file?.addEventListener('change', () => { root.querySelector('[data-file-label]').textContent = file.files[0]?.name || '캡처 화면 선택'; });
    follow.addEventListener('click', async () => {
      if (offer.verify === 'keyword') {
        const keyword = root.querySelector('input[name="keyword"]').value.trim();
        if (!keyword) return showError('인증 키워드를 입력해 주세요.');
        const outcome = await send(follow, { keyword });
        if (!outcome) return;
        if (outcome.status === 'retry') return renderOffer(`인증 키워드가 달라요. 남은 기회 ${outcome.triesLeft}번`);
        return result(outcome.status);
      }
      let blob;
      try { blob = await reencode(file.files[0]); } catch (error) { return showError(error.message); }
      const outcome = await send(follow, blob, 'proof', 'image/jpeg');
      if (outcome) result(outcome.status);
    });
  }
  const go = root.querySelector('[data-go]');
  if (go) {
    go.addEventListener('click', async () => {
      const outcome = await send(go, {});
      if (!outcome) return;
      if (outcome.url) return location.assign(outcome.url);
      if (preview) { go.disabled = false; return alertBar('미리보기에서는 광고주 페이지로 이동하지 않아요.'); }
      result(outcome.status);
    });
  }
  const form = root.querySelector('.ow-form');
  if (form) {
    const button = form.querySelector('button');
    dwell(button, '제출하기');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const quiz = offer.type === 'quiz';
      const answers = offer.questions.map((_, i) => quiz ? form.querySelector(`input[name="q${i}"]:checked`)?.value : form.elements[`q${i}`].value.trim());
      const missing = answers.findIndex(value => value === undefined || value === '' || (!quiz && value.length < 5));
      if (missing >= 0) {
        showError(quiz ? `${missing + 1}번 문항의 답을 골라 주세요.` : `${missing + 1}번 문항에 5자 이상 답해 주세요.`);
        return form.querySelector(`[name="q${missing}"]`)?.focus();
      }
      const outcome = await send(button, { answers: quiz ? answers.map(Number) : answers });
      if (!outcome) return;
      if (outcome.status === 'retry') {
        data.click.triesLeft = outcome.triesLeft;
        return renderOffer(`정답이 아닌 문항이 있어요. 남은 기회 ${outcome.triesLeft}번 · 내용을 다시 확인해 보세요.`);
      }
      result(outcome.status);
    });
  }
}

async function loadOffer() {
  try {
    data = await call(`/ow/${parts[1]}/state${suffix}`);
    offset = data.now - Date.now();
    document.title = `${data.offer.title} | 애즈폼`;
    renderOffer();
  } catch (error) {
    message('미션을 열 수 없어요', error.message);
  }
}

if (parts[1] === 'expired') message('미션을 열 수 없어요', reasons[new URLSearchParams(location.search).get('r')] || reasons.params);
else if (parts[1] === 'wall') loadWall();
else loadOffer();
