const icons = {
  home: '<path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 21v-7h6v7"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12m0-12C5 8 5 2 9 3c2 0 3 3 3 5Zm0 0c7 0 7-6 3-5-2 0-3 3-3 5Z"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M4.5 21v-2a5 5 0 0 1 5-5h5a5 5 0 0 1 5 5v2"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  star: '<path d="M12 2.5c1.4 6.1 3.4 8.1 9.5 9.5-6.1 1.4-8.1 3.4-9.5 9.5C10.6 15.4 8.6 13.4 2.5 12c6.1-1.4 8.1-3.4 9.5-9.5Z"/>',
  survey: '<rect x="5" y="5" width="14" height="16" rx="2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6m-6 4h6"/>',
  bag: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3m-13 6h18"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18m-14 5h4"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7Zm4 11h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2m1-15a3 3 0 0 1 0 6m2 2a4 4 0 0 1 3 4v3"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.4 9a2.7 2.7 0 0 1 5.2 1c0 1.5-2.6 2-2.6 3.4m0 3.1h.01"/>',
  book: '<path d="M12 5v15M3 4h4a5 5 0 0 1 5 2 5 5 0 0 1 5-2h4v14h-4a6 6 0 0 0-5 2 6 6 0 0 0-5-2H3Z"/>',
  chat: '<path d="M20.5 11.5a8.5 8.5 0 0 1-8.5 8.5 8.3 8.3 0 0 1-3.6-.8L4 20l.8-4.2a8.5 8.5 0 1 1 15.7-4.3Z"/><path d="M8 11.5h.01m4 0h.01m4 0h.01"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>'
};
const icon = name => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const roleName = { admin: '최고관리자', operator: '실행사', agency: '대행사', advertiser: '광고주', participant: '참여자' };
const kinds = { quiz: '브랜드 퀴즈', survey: '설문 조사' };
const statuses = { pending: '심사 대기', active: '진행 중', upcoming: '시작 예정', settling: '검수 후 정산', paused: '일시중지', closed: '종료', approved: '승인', rejected: '반려' };
const ledgerNames = { opening: '테스트 잔액', charge: '충전 승인', reserve: '광고 예산 배정', release: '미집행 예산 반환', commission: '대행사 충전 수익', mission: '미션 보상' };
const backgrounds = { grove: '봄날의 골목 상점', tide: '바닷가 카페', lilac: '라일락 책방', sunset: '노을빛 마켓', night: '저녁의 꽃가게' };
const slogan = '작은 미션, 새로운 연결';
const brandMark = '<img class="mark" src="/icon.svg?v=2" alt="" width="64" height="64">';
const wordmark = '<strong>adsform<span>.</span></strong>';
const banners = [
  { name: 'quiz', label: 'TODAY’S MISSION', title: '가볍게 풀고,\n기분 좋게 적립.', text: '오늘의 브랜드 퀴즈를 만나보세요.', cta: '퀴즈 보러 가기', action: '/missions?kind=quiz' },
  { name: 'survey', label: 'YOUR VOICE', title: '당신의 생각이\n브랜드를 바꿔요.', text: '짧은 설문에 참여하고 포인트를 받아요.', cta: '설문 둘러보기', action: '/missions?kind=survey' },
  { name: 'partner', label: 'FOR BRANDS', title: '새로운 고객과\n만나는 첫걸음.', text: '브랜드 퀴즈와 설문을 직접 만들어 보세요.', cta: '광고 주문하기', action: '/manage?tab=new' }
];
const faq = [
  ['어떻게 포인트를 받을 수 있나요?', '미션 상세에서 참여를 시작하고 안내된 시간까지 답변을 제출하세요. 퀴즈는 정답이면 즉시 적립되고, 설문은 운영자 검수 후 승인되면 적립됩니다.'],
  ['참여 시간이 지나면 어떻게 되나요?', '답변을 제출하지 않으면 확보한 자리가 풀려요. 미션이 진행 중이고 빈자리가 있으면 다시 시작할 수 있습니다.'],
  ['제출한 미션의 결과는 어디서 확인하나요?', '참여자 대시보드의 참여 내역에서 심사 대기·승인·반려 상태와 결과를 확인할 수 있어요. 적립된 포인트는 보상 내역에 표시됩니다.'],
  ['같은 미션에 여러 번 참여할 수 있나요?', '각 미션은 계정당 한 번 참여할 수 있어요. 마감됐거나 이미 제출한 미션은 다시 참여할 수 없습니다.'],
  ['광고는 어떻게 주문하나요?', '광고주·대행사·실행사 계정으로 로그인하고 잔액을 충전한 뒤 주문서를 제출하세요. 승인된 캠페인은 지정 기간에 오퍼월에 표시됩니다.'],
  ['예상 집행비는 어떻게 계산하나요?', '주문 등록 화면에 선택한 미션의 건당 단가와 목표 완료 건수에 따른 집행비가 표시됩니다. 캠페인 종료·정산 시 미집행분은 잔액으로 반환됩니다.'],
  ['실행사는 하위 대행사를 어떻게 관리하나요?', '실행사 대시보드에서 하위 대행사를 등록하고, 승인된 충전에서 적립된 수익과 당시 적용률을 수익 원장에서 확인할 수 있습니다.']
];
const missionTypes = [
  { key: 'quiz', icon: 'star', title: '브랜드 퀴즈', intro: '브랜드 이야기를 읽고 정답을 맞혀요.', time: '약 1분', processing: '정답이면 바로 적립' },
  { key: 'survey', icon: 'survey', title: '의견 설문', intro: '상품과 서비스에 대한 생각을 전해요.', time: '약 3분', processing: '응답 검수 후 적립' }
];
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const format = value => new Intl.NumberFormat('ko-KR').format(value);
const day = value => value ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeZone: 'Asia/Seoul' }).format(new Date(value)) : '';
const clockTime = value => new Intl.DateTimeFormat('ko-KR', { timeStyle: 'medium', timeZone: 'Asia/Seoul' }).format(value);
const badge = status => `<span class="status ${esc(status)}">${esc(statuses[status] || status)}</span>`;
const empty = text => `<div class="empty">${icon('info')}<p>${text}</p></div>`;
const pageHead = (tag, title, text) => `<div class="page-head"><span class="eyebrow">${tag}</span><h1>${title}</h1><p>${text}</p></div>`;
const field = (label, name, type = 'text', attrs = '') => `<label class="field"><span>${label}</span><input name="${name}" type="${type}" ${attrs}></label>`;
const textarea = (label, name, attrs = '') => `<label class="field"><span>${label}</span><textarea name="${name}" ${attrs}></textarea></label>`;
const select = (label, name, options, attrs = '') => `<label class="field"><span>${label}</span><select name="${name}" ${attrs}>${options.map(([val, name]) => `<option value="${esc(val)}">${esc(name)}</option>`).join('')}</select></label>`;
const btn = (text, attrs = '', theme = 'primary') => `<button class="btn ${theme}" ${attrs}>${text}</button>`;
const dialog = $('#dialog');
let state;
let slide = 0;
let toastTimer;

async function api(path, body) {
  const response = await fetch(path, body === undefined ? undefined : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '요청에 실패했습니다.');
  return data;
}

function showToast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('visible'), 4200);
}

async function reload() {
  state = await api('/api/state');
  render();
}

function go(url) {
  if (dialog.open) dialog.close();
  history.pushState({}, '', url);
  render();
  scrollToView(true);
}

function scrollToView(focus) {
  const section = { '#guide': 'guide', '#faq': 'faq' }[location.hash];
  const target = section && document.getElementById(section);
  if (target) {
    target.scrollIntoView({ block: 'start' });
    if (focus) target.focus({ preventScroll: true });
  } else if (focus) {
    window.scrollTo(0, 0);
    $('#main').focus({ preventScroll: true });
  }
}

function nav() {
  const user = state.user;
  $('#header').innerHTML = `<a class="logo" href="/" aria-label="애즈폼 홈">${brandMark}${wordmark}<span class="logo-ko">애즈폼</span></a>
    <div class="header-actions"><button type="button" class="icon-btn" data-guide aria-label="이용 안내">${icon('bell')}</button>
    <a href="${user ? '/manage' : '/login'}" class="login-link">${user ? esc(roleName[user.role]) : '로그인'}${icon('chevron')}</a></div>`;
  const participant = user?.role === 'participant';
  const links = [
    ['/', 'home', '홈'], ['/missions', 'target', '오퍼월'],
    [participant ? '/manage?tab=rewards' : '/manage', participant ? 'gift' : 'bag', participant ? '보상' : '광고 관리'],
    ['/#guide', 'book', '이용방법', true], ['/#faq', 'help', 'FAQ'],
    [user ? '/manage?tab=profile' : '/login', 'user', '내 정보']
  ];
  $('#dock').innerHTML = links.map(([url, glyph, text, desktop]) => {
    const target = new URL(url, location.origin);
    const selected = target.pathname === location.pathname && target.hash === location.hash;
    return `<a href="${url}"${desktop ? ' class="rail-only"' : ''}${selected ? ' aria-current="page"' : ''}>
      <span class="nav-icon">${icon(glyph)}</span><span>${text}</span></a>`;
  }).join('') + '<span class="rail-wordmark rail-only" aria-hidden="true">ADSFORM</span>';
  $('#support').innerHTML = `<button type="button" class="support-button" data-support>${icon('chat')}<span>문의하기</span></button>`;
}

function carousel() {
  const banner = banners[slide];
  return `<section class="hero hero-${banner.name}" aria-label="추천 캠페인 ${slide + 1} / 3">
    <div class="hero-art"></div><div class="hero-copy"><span class="eyebrow">${banner.label}</span>
      <h1>${banner.title.replace('\n', '<br>')}</h1><p>${banner.text}</p>
      <a href="${banner.action}">${banner.cta} ${icon('arrow')}</a></div>
    <div class="carousel"><div class="dots">${banners.map((_, i) => `<button type="button" data-slide="${i}" aria-label="배너 ${i + 1}" aria-pressed="${i === slide}"></button>`).join('')}</div>
      <span>0${slide + 1} / 03</span><button type="button" data-slide="${(slide + 1) % banners.length}" aria-label="다음 배너">${icon('chevron')}</button></div>
  </section>`;
}

function missionCard(mission) {
  const quiz = mission.kind === 'quiz';
  return `<button type="button" class="mission-row" data-mission="${mission.id}">
    <span class="mission-icon ${mission.kind}">${icon(quiz ? 'star' : 'survey')}</span>
    <span class="mission-text"><span class="mission-tag">${kinds[mission.kind]} <i></i> ${quiz ? '약 1분' : '약 3분'}</span>
      <strong>${esc(mission.title)}</strong><small>${esc(mission.brand)} · ${mission.mine ? statuses[mission.mine] : mission.reservedUntil ? '참여 중' : mission.remaining ? '참여 가능' : '빈자리 없음'}</small></span>
    <span class="mission-points">+${format(mission.reward)} <small>P</small></span>${icon('chevron')}
  </button>`;
}

function home() {
  const participant = state.user?.role === 'participant';
  const rewardsUrl = participant ? '/manage?tab=rewards' : '/login?next=rewards';
  const available = state.missions.filter(mission => !mission.mine && (mission.remaining > 0 || mission.reservedUntil));
  const featured = (available.length ? available : state.missions).slice(0, 4);
  return `<div class="content home-page">
    <div id="hero-slot">${carousel()}</div>
    <div class="home-brand-line">${brandMark}<div><strong>${slogan}</strong><small>브랜드 퀴즈와 설문으로 만나는 일상의 보상</small></div></div>
    <div class="quick-grid" aria-label="빠른 메뉴">
      ${[
        ['/missions?kind=quiz', 'star', '퀴즈', 'mint'],
        ['/missions?kind=survey', 'survey', '설문', 'violet'],
        [rewardsUrl, 'gift', '내 보상', 'peach'],
        ['/manage?tab=new', 'bag', '광고 주문', 'yellow']
      ].map(([href, name, text, tone]) => `<a href="${href}"><span class="quick-icon ${tone}">${icon(name)}</span>${text}</a>`).join('')}
    </div>
    <section class="home-missions home-section">
      <div class="section-head"><div><span class="eyebrow"><i></i> THE OFFERWALL</span><h2>오늘의 추천 미션</h2></div><a href="/missions">전체보기 ${icon('chevron')}</a></div>
      <p class="home-description">보상과 조건을 확인하고 마음에 드는 미션부터 시작해 보세요.</p>
      <div class="home-list-label"><span>${state.demo ? '테스트 미션' : '오퍼월'} · 참여 가능 ${format(available.length)}건</span><span>미션별 적립 포인트</span></div>
      <div class="mission-list">${featured.map(missionCard).join('') || empty('현재 모집 중인 미션이 없어요.')}</div>
    </section>
    <section class="home-section" aria-labelledby="mission-types-title">
      <span class="eyebrow">PICK YOUR MISSION</span><h2 id="mission-types-title">어떤 미션을 해볼까요?</h2>
      <div class="home-types">${missionTypes.map(type => {
        const open = available.filter(mission => mission.kind === type.key);
        const highest = open.reduce((max, mission) => Math.max(max, mission.reward), 0);
        return `<a class="type-card ${type.key}" href="/missions?kind=${type.key}">
          <div class="type-top"><span class="mission-icon ${type.key}">${icon(type.icon)}</span><span>${format(open.length)}건 참여 가능</span></div>
          <h3>${type.title}</h3><p>${type.intro}</p><small>${icon('clock')} ${type.time} · ${type.processing}</small>
          <span class="type-bottom">${highest ? `최대 ${format(highest)} P` : '미션 둘러보기'} ${icon('arrow')}</span>
        </a>`;
      }).join('')}</div>
    </section>
    <section class="starter-guide home-section" id="guide" tabindex="-1"><span class="eyebrow">HOW IT WORKS</span><h2>보상까지, 세 걸음</h2>
      <ol>${[
        ['미션 고르기', '미션 상세에서 받을 포인트와 참여 조건을 확인해요.', 'target'],
        ['답변 제출하기', '퀴즈 정답을 선택하거나 설문에 의견을 남겨요.', 'survey'],
        ['결과 확인하기', '퀴즈는 바로 채점하고, 설문은 검수 뒤 결과가 표시돼요.', 'gift']
      ].map(([title, text, glyph], index) => `<li><div><span>0${index + 1}</span>${icon(glyph)}</div><b>${title}</b><small>${text}</small></li>`).join('')}</ol>
    </section>
    <section class="reward-story home-section">
      <img src="/assets/home-reward.webp" alt="" width="1200" height="800" loading="lazy">
      <div><span class="eyebrow">MY REWARDS</span><h2>${participant ? `나의 보상 ${format(state.balances.reward)} P` : '모은 포인트를 한눈에'}</h2>
        <p>참여한 미션의 심사 결과와 적립된 포인트를 보상 내역에서 확인할 수 있어요.</p>
        <a class="btn primary" href="${rewardsUrl}">보상 내역 보기 ${icon('arrow')}</a></div>
    </section>
    <section class="home-section business-story">
      <div class="business-banner"><div><span class="eyebrow">ADSFORM FOR BUSINESS</span><h2>고객의 답변으로<br>다음 캠페인을 준비하세요</h2>
        <p>브랜드 퀴즈로 이야기를 전하고, 설문으로 고객의 선택 이유를 알아보세요.</p><a class="btn" href="/manage?tab=new">광고 주문하기 ${icon('arrow')}</a></div>
        <img src="/assets/home-business.webp" alt="매장에서 고객 설문을 살펴보는 소상공인" width="1200" height="800" loading="lazy"></div>
      <div class="business-roles">${[
        ['bag', '광고주', '미션 유형과 목표 건수를 정하고 캠페인을 주문해요.'],
        ['people', '대행사', '접수한 광고의 심사와 완료 건수를 확인해요.'],
        ['grid', '실행사', '하위 대행사를 등록하고 충전 수익을 확인해요.']
      ].map(([glyph, title, text]) => `<div><span>${icon(glyph)}</span><h3>${title}</h3><p>${text}</p></div>`).join('')}</div>
      <div class="home-quote">
        <div><span class="eyebrow">CAMPAIGN EXAMPLE</span><h3>목표 20건 집행 예시</h3><small>실제 견적은 주문 화면에서 확인할 수 있어요.</small></div>
        <dl>${Object.entries(state.products).map(([key, product]) => `<div><dt>${kinds[key]}</dt><dd>${format(product.cost * 20)}원</dd></div>`).join('')}</dl>
      </div>
    </section>
    <section class="faq home-section" id="faq" tabindex="-1"><span class="eyebrow">HELP CENTER</span><h2>자주 묻는 질문</h2>${faq.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</section>
    <section class="home-contact"><span class="quick-icon mint">${icon('chat')}</span><div><h2>궁금한 점이 있으신가요?</h2><p>미션, 포인트, 광고 주문에 관한 문의를 남겨주세요.</p></div>${btn('문의하기', 'type="button" data-support', 'quiet')}</section>
    <footer class="home-footer"><a class="logo" href="/" aria-label="애즈폼 홈">${brandMark}${wordmark}</a><small>${slogan}</small><nav aria-label="하단 안내"><a href="/missions">오퍼월</a><a href="/#guide">이용방법</a><a href="/#faq">FAQ</a></nav>${state.demo ? '<small>로컬 데모 · 테스트 포인트</small>' : ''}</footer>
  </div>`;
}

function missions(params) {
  const kind = params.get('kind');
  const selection = state.missions.filter(m => !Object.hasOwn(kinds, kind) || m.kind === kind);
  return `<div class="content">${pageHead('OFFERWALL', '미션 찾기', '관심 있는 미션을 고르고 포인트를 모아보세요.')}
    <div class="tabs">${[['', '전체'], ...Object.entries(kinds)].map(([key, label]) => `<a class="${(kind || '') === key ? 'on' : ''}" href="/missions${key ? '?kind=' + key : ''}">${label}</a>`).join('')}</div>
    ${state.demo ? '<p class="section-note">테스트 미션 · 예시 포인트</p>' : ''}
    <div class="mission-list">${selection.map(missionCard).join('') || empty('현재 모집 중인 미션이 없어요.')}</div></div>`;
}

function login(params) {
  const next = params.get('next');
  const demoRoles = [['participant', 'gift'], ['advertiser', 'bag'], ['agency', 'people'], ['operator', 'grid'], ['admin', 'lock']];
  return `<div class="content login-page">${pageHead('WELCOME TO ADSFORM', '애즈폼에 오신 것을\n환영해요'.replace('\n', '<br>'), '계정으로 로그인하고 미션과 광고를 관리하세요.')}
    <form data-form="login" class="form panel">
      ${field('아이디', 'username', 'text', 'autocomplete="username" required placeholder="아이디를 입력하세요"')}
      ${field('비밀번호', 'password', 'password', 'autocomplete="current-password" required placeholder="비밀번호를 입력하세요"')}
      ${btn('로그인', 'type="submit"')}${next ? '<p class="form-hint">로그인 후 요청하신 화면으로 이동합니다.</p>' : ''}
    </form>
    ${state.demo ? `<section class="demo-login"><div class="section-head"><div><span class="eyebrow">DEMO ACCESS</span><h2>테스트 계정으로 둘러보기</h2></div></div>
      <p>역할을 선택하면 비밀번호 입력 없이 로그인합니다.</p><div class="demo-grid">${demoRoles.map(([role, name]) => `<button type="button" data-demo="${role}">${icon(name)}<strong>${roleName[role]}</strong>${icon('chevron')}</button>`).join('')}</div></section>` : ''}</div>`;
}

function account() {
  const user = state.user;
  const isParticipant = user.role === 'participant';
  const wallet = isParticipant ? 'reward' : 'credit';
  const entries = state.ledger.filter(entry => entry.wallet === wallet);
  return `<div class="content">${pageHead('MY ADSFORM', esc(user.name), `${roleName[user.role]} · ${esc(user.username)}`)}
    <div class="balance-card"><div>${icon(isParticipant ? 'gift' : 'card')}<span>${isParticipant ? '보유 포인트' : '광고 잔액'}</span></div><strong>${format(state.balances[wallet])}<small> ${isParticipant ? 'P' : '원'}</small></strong>
      <a href="${isParticipant ? '/missions' : '/manage'}">${isParticipant ? '미션 둘러보기' : '관리 화면 열기'} ${icon('arrow')}</a></div>
    ${isParticipant ? `<section class="section"><h2>내 참여 내역</h2>${state.submissions.length ? state.submissions.map(s => `<div class="record"><div><b>${esc(s.title)}</b><small>${esc(s.reason || day(s.created))}</small></div>${badge(s.status)}</div>`).join('') : empty('아직 참여한 미션이 없어요.')}</section>` : ''}
    <section class="section"><h2>${isParticipant ? '포인트 적립 내역' : '잔액 내역'}</h2>
      ${entries.length ? entries.map(item => `<div class="record"><div><b>${ledgerNames[item.kind]}</b><small>${day(item.created)}</small></div><strong class="credit">${item.amount > 0 ? '+' : ''}${format(item.amount)} ${isParticipant ? 'P' : '원'}</strong></div>`).join('') : empty('아직 기록이 없어요.')}</section>
    ${btn('로그아웃', 'type="button" data-logout', 'quiet')}${state.demo ? '<a class="switch-role" href="/login">다른 테스트 계정 선택</a>' : ''}
  </div>`;
}

function openMission(id) {
  const mission = state.missions.find(item => item.id === id);
  if (!mission) return showToast('이 미션은 더 이상 열려 있지 않습니다.');
  const participant = state.user?.role === 'participant';
  const reserved = mission.reservedUntil > Date.now();
  const input = mission.kind === 'quiz'
    ? mission.choices.map((choice, i) => `<label class="choice"><input type="radio" name="response" value="${i}" required> ${esc(choice)}</label>`).join('')
    : textarea('나의 답변', 'response', 'minlength="10" maxlength="1000" required rows="4" placeholder="10자 이상 입력해 주세요"');
  modal(kinds[mission.kind], esc(mission.title), `<p>${esc(mission.details)}</p>
    <div class="mission-summary"><strong>+${format(mission.reward)} P</strong><span>남은 자리 ${format(mission.remaining)}명</span></div>
    ${reserved ? `<p class="notice">제출 마감 ${clockTime(mission.reservedUntil)} (한국 시간)</p>
      <form data-form="mission" class="form"><input type="hidden" name="id" value="${id}"><p class="question">${esc(mission.prompt)}</p>${input}${btn('미션 답변 제출', 'type="submit"')}</form>`
      : mission.mine ? `<p>${badge(mission.mine)} · 이미 제출한 미션입니다.</p>`
      : !mission.remaining ? '<p>지금은 빈자리가 없어요. 잠시 후 다시 확인해 주세요.</p>'
      : participant ? `<form data-form="mission/reserve" class="form"><input type="hidden" name="id" value="${id}">
        <p>참여를 시작하면 최대 ${format(state.reservationMinutes)}분간 자리를 확보합니다. 마감 시간이 지나면 자리가 풀립니다.</p>${btn('참여 시작', 'type="submit"')}</form>`
      : '<a class="btn primary" href="/login?next=missions">참여자 계정으로 로그인</a>'}`);
}

function modal(tag, title, body) {
  dialog.setAttribute('aria-labelledby', 'dialog-title');
  dialog.innerHTML = `<div class="dialog-inner"><form method="dialog"><button class="icon-btn dialog-close" aria-label="닫기">${icon('close')}</button></form><span class="eyebrow">${tag}</span><h2 id="dialog-title">${title}</h2>${body}<p class="dialog-error" role="alert" hidden></p></div>`;
  if (!dialog.open) dialog.showModal();
}

function openSupport() {
  modal('ADSFORM SUPPORT', '무엇을 도와드릴까요?', `<p>광고 주문, 포인트, 미션 참여에 관한 문의를 남겨주세요.</p>
    <form class="form" data-form="inquiry">
      ${field('제목', 'subject', 'text', 'required minlength="3" maxlength="80" placeholder="문의 제목을 입력하세요"')}
      ${textarea('문의 내용', 'message', 'required minlength="10" maxlength="1200" rows="5" placeholder="10자 이상 입력해 주세요"')}
      ${field('답변 받을 이메일 (선택)', 'email', 'email', 'maxlength="120" autocomplete="email" placeholder="name@example.com"')}
      <p class="form-hint">입력한 이메일은 문의 확인과 답변에 사용됩니다.</p>
      ${btn('문의 접수', 'type="submit"')}
    </form>`);
}

const consoleNav = {
  admin: [
    ['운영', [['overview', '운영 대시보드', 'grid'], ['orders', '주문 심사', 'bag'], ['submissions', '미션 검수', 'survey'], ['charges', '충전 승인', 'card']]],
    ['설정', [['partners', '계정·수익률', 'people'], ['design', 'PC 배경', 'star'], ['inquiries', '문의 내역', 'chat']]]
  ],
  participant: [
    ['내 활동', [['overview', '참여 대시보드', 'grid'], ['history', '참여 내역', 'survey'], ['rewards', '보상 내역', 'gift']]]
  ],
  business: [
    ['캠페인', [['overview', '광고 대시보드', 'grid'], ['new', '주문 등록', 'target'], ['orders', '주문 내역', 'bag']]],
    ['예산', [['charges', '잔액 충전', 'card']]]
  ],
  operator: [
    ['파트너', [['agencies', '하위 대행사', 'people'], ['revenue', '수익 원장', 'gift']]]
  ]
};

function consoleMetrics(metrics) {
  return `<div class="console-metrics">${metrics.map(([label, value, unit, glyph, href]) => `<a href="${href}">
    <span class="console-metric-icon">${icon(glyph)}</span><span>${label}</span><strong>${format(value)}<small> ${unit}</small></strong><i>${icon('chevron')}</i></a>`).join('')}</div>`;
}

function consoleHero(label, title, description, href, action) {
  return `<section class="console-hero"><div><span class="eyebrow">${label}</span><h2>${title}</h2><p>${description}</p></div>
    <a href="${href}" class="btn">${action} ${icon('arrow')}</a></section>`;
}

function stateBreakdown(items, phases) {
  return `<div class="state-breakdown">${phases.map(([key, label]) => {
    const value = items.filter(item => item.status === key).length;
    return `<div><span>${label}</span><progress max="${items.length || 1}" value="${value}" aria-label="${label} ${value}건"></progress><strong>${format(value)}건</strong></div>`;
  }).join('')}</div>`;
}

function campaignPhase(order) {
  if (['active', 'paused'].includes(order.status) && order.end_date < state.date) return 'settling';
  if (order.status === 'active' && order.start_date > state.date) return 'upcoming';
  return order.status;
}

function participationList(items) {
  return items.map(item => `<div class="record"><div><b>${esc(item.title)}</b><small>${day(item.created)}${item.reason ? ' · ' + esc(item.reason) : ''}</small></div>
    ${item.status === 'approved' ? `<strong class="credit">+${format(item.reward)} P</strong>` : badge(item.status)}</div>`).join('') || empty('아직 제출한 미션이 없어요.');
}

function participantOverview() {
  const items = state.submissions;
  return consoleHero('MY MISSION', '나의 미션과 보상', '제출한 답변과 적립된 포인트를 한곳에서 확인하세요.', '/missions', '미션 찾기') + consoleMetrics([
    ['보유 포인트', state.balances.reward, 'P', 'gift', '/manage?tab=rewards'],
    ['제출한 미션', items.length, '건', 'survey', '/manage?tab=history'],
    ['심사 대기', items.filter(item => item.status === 'pending').length, '건', 'clock', '/manage?tab=history&status=pending'],
    ['승인 완료', items.filter(item => item.status === 'approved').length, '건', 'check', '/manage?tab=history&status=approved']
  ]) + `<div class="console-split">
    <section class="panel"><div class="section-head"><h2>최근 참여 내역</h2><a href="/manage?tab=history">전체보기 ${icon('chevron')}</a></div>${participationList(items.slice(0, 5))}</section>
    <section class="panel"><h2>참여 상태</h2>${stateBreakdown(items, [['pending', '심사 대기'], ['approved', '승인 완료'], ['rejected', '반려']])}</section>
  </div>`;
}

function overview(user) {
  if (user.role === 'participant') return participantOverview();
  const admin = user.role === 'admin';
  const operator = user.role === 'operator';
  const orders = state.campaigns;
  const pendingOrders = orders.filter(order => order.status === 'pending').length;
  const activeOrders = orders.filter(order => campaignPhase(order) === 'active').length;
  const metrics = admin ? [
    ['주문 심사 대기', pendingOrders, '건', 'bag', '/manage?tab=orders&status=pending'],
    ['충전 승인 대기', state.charges.filter(charge => charge.status === 'pending').length, '건', 'card', '/manage?tab=charges&status=pending'],
    ['미션 검수 대기', state.adminCounts.pendingSubmissions, '건', 'survey', '/manage?tab=submissions'],
    ['미확인 문의', state.adminCounts.unreadInquiries, '건', 'chat', '/manage?tab=inquiries']
  ] : [
    ['사용 가능 잔액', state.balances.credit, '원', 'card', '/manage?tab=charges'],
    ['집행 중 캠페인', activeOrders, '건', 'target', '/manage?tab=orders&status=active'],
    ['승인 완료 참여', orders.reduce((sum, order) => sum + order.approved, 0), '건', 'check', '/manage?tab=orders'],
    operator ? ['대행사 충전 누적 수익', state.balances.revenue, '원', 'gift', '/manage?tab=revenue'] : ['주문 심사 대기', pendingOrders, '건', 'clock', '/manage?tab=orders&status=pending']
  ];
  return consoleHero(admin ? 'OPERATION CENTER' : 'CAMPAIGN CENTER', admin ? '오늘 처리할 운영 업무' : '캠페인 현황을 확인하세요',
    admin ? '심사, 충전, 문의 대기 건을 확인하고 바로 처리하세요.' : '광고 잔액과 주문 진행 상황을 확인하고 다음 미션을 등록하세요.',
    admin ? '/manage?tab=orders&status=pending' : '/manage?tab=new', admin ? '대기 주문 보기' : '새 광고 주문') +
    consoleMetrics(metrics) + `<div class="console-split">
      <section class="panel"><div class="section-head"><h2>최근 캠페인</h2><a href="/manage?tab=orders">전체보기 ${icon('chevron')}</a></div>
      ${orders.slice(0, 5).map(order => `<div class="record"><div><button class="console-text-button" type="button" data-order="${order.id}">${esc(order.title)}</button>
      <small>${esc(order.owner || order.brand)} · 완료 ${format(order.approved)}/${format(order.goal)}건</small></div>${badge(campaignPhase(order))}</div>`).join('') || empty('아직 주문이 없어요.')}</section>
      <section class="panel"><h2>캠페인 상태</h2>${stateBreakdown(orders.map(order => ({ status: campaignPhase(order) })), [['pending', '심사 대기'], ['upcoming', '시작 예정'], ['active', '진행 중'], ['paused', '일시중지'], ['settling', '검수 후 정산'], ['closed', '종료'], ['rejected', '반려']])}
      ${operator ? `<a class="console-inline-link" href="/manage?tab=agencies">하위 대행사 ${format(state.agencies.length)}곳 ${icon('arrow')}</a>` : ''}</section>
    </div>
    ${admin ? `<section class="panel console-activity"><h2>최근 운영 기록</h2>${state.audit.slice(0, 6).map(item => `<div class="record"><div><b>${esc(item.action)} · ${esc(item.subject)}</b><small>${esc(item.name)}${item.detail ? ' · ' + esc(item.detail) : ''}</small></div><small>${day(item.created)}</small></div>`).join('') || empty('아직 운영 기록이 없어요.')}</section>` : ''}`;
}

const actions = {
  approve: '승인', reject: '반려', pause: '일시중지', resume: '재개', close: '종료·정산'
};
const decision = (scope, id, action) => btn(actions[action], `type="button" data-decision="${scope}" data-id="${id}" data-action="${action}"`, action === 'approve' ? 'primary small' : 'quiet small');

function orderCard(c, allowActions) {
  const phase = campaignPhase(c);
  const choices = { pending: ['approve', 'reject'], upcoming: ['pause', 'close'], active: ['pause', 'close'], paused: ['resume', 'close'] }[phase] || [];
  return `<article class="panel order-card"><div class="row-top"><span class="eyebrow">${kinds[c.kind]} · #${c.id}</span>${badge(phase)}</div>
    <h3>${esc(c.title)}</h3><p>${esc(c.owner || c.brand)} · ${c.start_date} ~ ${c.end_date}</p>
    <div class="order-progress"><span>완료 <b>${format(c.approved)} / ${format(c.goal)}</b> · 검수 ${format(c.reviewing)} · 예약 ${format(c.reserved)}</span><strong>${format(c.cost * c.goal)}원</strong></div>
    <progress value="${c.approved}" max="${c.goal}" aria-label="승인 완료 진행률"></progress>
    ${c.reason ? `<p class="order-note ${c.status === 'rejected' ? 'error-inline' : ''}">${esc(c.reason)}</p>` : ''}
    <div class="actions">${btn('주문 상세', `type="button" data-order="${c.id}"`, 'quiet small')}
      ${allowActions ? choices.map(a => decision('campaign/decision', c.id, a)).join('') : ''}</div></article>`;
}

function openOrder(id) {
  const order = state.campaigns?.find(item => item.id === id);
  if (!order) return;
  const choices = JSON.parse(order.choices);
  const spent = order.cost * order.approved;
  const waiting = order.cost * (order.goal - order.approved) - order.returned;
  modal(kinds[order.kind], esc(order.title), `<p>${esc(order.brand)} · ${order.start_date} ~ ${order.end_date}</p>
    <div class="mission-summary"><strong>${format(order.cost * order.goal)}원</strong><span>목표 ${format(order.goal)}건</span></div>
    <h3>참여 안내</h3><p>${esc(order.details)}</p><h3>참여 질문</h3><p>${esc(order.prompt)}</p>
    ${choices.length ? `<ol>${choices.map((choice, i) => `<li>${esc(choice)}${i === order.answer ? ' · 정답' : ''}</li>`).join('')}</ol>` : ''}
    <p>${badge(campaignPhase(order))} · 승인 ${format(order.approved)}건 · 검수 ${format(order.reviewing)}건 · 예약 ${format(order.reserved)}건</p>
    ${order.owner ? `<dl class="settlement-summary">
      <div><dt>승인 집행액</dt><dd>${format(spent)}원</dd></div>
      <div><dt>정산 전 잔여</dt><dd>${format(waiting)}원</dd></div>
      <div><dt>반환 완료</dt><dd>${format(order.returned)}원</dd></div>
    </dl>` : ''}
    ${order.reason ? `<p>${esc(order.reason)}</p>` : ''}`);
}

function orders(params, admin) {
  const filter = params.get('status') || 'all';
  const list = state.campaigns.filter(c => filter === 'all' || campaignPhase(c) === filter);
  return `<div class="section-head"><h2>${admin ? '캠페인 주문 심사' : '광고 주문 내역'}</h2></div>
    <div class="tabs">${[['all', '전체'], ['pending', '대기'], ['upcoming', '예정'], ['active', '진행'], ['paused', '중지'], ['settling', '정산 대기'], ['closed', '종료'], ['rejected', '반려']].map(([key, label]) => `<a href="/manage?tab=orders&amp;status=${key}" class="${key === filter ? 'on' : ''}">${label}</a>`).join('')}</div>
    ${list.map(c => orderCard(c, admin)).join('') || empty('해당 상태의 주문이 없습니다.')}`;
}

function orderForm() {
  const today = state.date;
  return `<section class="panel"><h2>새 캠페인 주문</h2><p class="muted">승인된 캠페인은 지정한 기간에 오퍼월에 표시됩니다.</p>
    <form data-form="campaign" class="form">
      ${select('상품 유형', 'kind', Object.entries(kinds))}
      ${field('캠페인 제목', 'title', 'text', 'required maxlength="80" placeholder="예시 · 로컬 브랜드 퀴즈"')}
      ${field('브랜드명', 'brand', 'text', 'required maxlength="50"')}
      ${textarea('미션 안내', 'details', 'required maxlength="500" rows="3"')}
      ${field('참여 질문', 'prompt', 'text', 'required maxlength="200"')}
      <fieldset class="quiz-fields"><legend>퀴즈 선택지</legend>
        ${[1, 2, 3].map(i => field('선택지 ' + i, 'option' + i, 'text', 'required maxlength="60"')).join('')}
        ${select('정답', 'answer', [[1, '선택지 1'], [2, '선택지 2'], [3, '선택지 3']])}</fieldset>
      ${field('목표 완료 건수', 'goal', 'number', 'required min="1" max="50000" value="20"')}
      <div class="two">${field('시작일', 'start', 'date', `required min="${today}" value="${today}"`)}${field('종료일', 'end', 'date', `required min="${today}" value="${today}"`)}</div>
      <div class="quote" aria-live="polite"></div>
      ${btn('견적 확인 및 주문 제출', 'type="submit"')}
    </form></section>`;
}

function charges(params, admin) {
  const status = params.get('status') || 'all';
  const list = state.charges.filter(charge => status === 'all' || charge.status === status);
  return `${admin ? '' : `<section class="panel"><h2>광고 잔액 충전</h2><p class="muted">최고관리자가 승인하면 잔액에 반영됩니다.</p>
    ${state.demo ? '<p class="notice">테스트 충전입니다. 실제로 결제되거나 입금되지 않습니다.</p>' : '<p class="notice">담당자와 입금 절차를 확인한 후 충전을 신청하세요.</p>'}
    <form class="form" data-form="charge">${field('충전 금액 (원)', 'amount', 'number', 'required min="1000" max="10000000" value="100000"')}${btn('충전 신청', 'type="submit"')}</form></section>`}
    <section class="section"><h2>${admin ? '충전 승인 요청' : '충전·정산 내역'}</h2>
    <div class="tabs">${[['all', '전체'], ['pending', '대기'], ['approved', '승인'], ['rejected', '반려']].map(([key, label]) => `<a href="/manage?tab=charges&amp;status=${key}" class="${key === status ? 'on' : ''}">${label}</a>`).join('')}</div>
    ${list.map(c => `<article class="panel order-card"><div class="row-top"><span class="eyebrow">충전 #${c.id} · ${day(c.created)}</span>${badge(c.status)}</div><h3>${format(c.amount)}원</h3>
      <p>${esc(c.owner)}${c.operator ? ` · ${esc(c.operator)} 수익 ${format(c.commission)}원 (${c.rate / 100}%)` : ''}</p>
      ${admin && c.status === 'pending' ? `<div class="actions">${decision('charge/decision', c.id, 'approve')}${decision('charge/decision', c.id, 'reject')}</div>` : ''}</article>`).join('') || empty('충전 요청이 없습니다.')}</section>`;
}

function accountForm(admin) {
  const operators = admin ? state.accounts.filter(a => a.role === 'operator') : [];
  return `<form class="form" data-form="account">
    ${admin ? select('계정 유형', 'role', [['advertiser', '광고주'], ['operator', '실행사'], ['agency', '대행사'], ['participant', '참여자']]) : ''}
    ${admin ? `<div class="parent-field" hidden>${select('소속 실행사', 'parent_id', [['', '선택 안 함'], ...operators.map(a => [a.id, a.name])])}</div>` : ''}
    ${field('표시 이름', 'name', 'text', 'required maxlength="60"')}
    ${field('로그인 아이디', 'username', 'text', 'required minlength="4" maxlength="32" autocomplete="off"')}
    ${field('임시 비밀번호', 'password', 'password', 'required minlength="10" maxlength="128" autocomplete="new-password"')}
    ${btn(admin ? '계정 만들기' : '하위 대행사 등록', 'type="submit"')}
  </form>`;
}

function partnerAdmin() {
  const operators = state.accounts.filter(a => a.role === 'operator');
  return `<section class="panel"><h2>실행사 수익률 설정</h2><p class="muted">하위 대행사의 충전 승인액을 기준으로 계산합니다. 실행사 개별 설정이 기본값보다 우선합니다.</p>
    <form class="form" data-form="rates">${field('전체 기본 수익률 (%)', 'rate', 'number', `required min="0" max="100" step="0.01" value="${state.defaultRate / 100}"`)}${btn('기본 수익률 저장', 'type="submit"')}</form>
    ${operators.length ? `<form class="form form-separated" data-form="rates">
      ${select('개별 실행사', 'operator_id', operators.map(a => [a.id, a.name + (a.rate === null ? ' · 기본값' : ` · ${a.rate / 100}%`)]))}
      ${field('개별 수익률 (%)', 'rate', 'number', 'min="0" max="100" step="0.01" placeholder="비우면 기본값을 사용합니다"')}
      ${btn('개별 설정 저장', 'type="submit"')}</form>` : ''}</section>
    <section class="panel section"><h2>새 계정 등록</h2>${accountForm(true)}</section>
    <section class="section"><h2>등록 계정</h2>${state.accounts.map(a => `<div class="record"><div><b>${esc(a.name)}</b><small>${esc(a.username)}${a.parent ? ' · 소속 ' + esc(a.parent) : ''}</small></div><span class="status">${roleName[a.role]}</span></div>`).join('')}</section>`;
}

function agencies() {
  return `<section class="panel"><h2>하위 대행사 등록</h2><p class="muted">생성한 대행사는 이 실행사에 연결됩니다.</p>${accountForm(false)}</section>
    <section class="section"><h2>소속 대행사 · ${state.agencies.length}곳</h2>${state.agencies.map(a => `<div class="record"><div><b>${esc(a.name)}</b><small>${esc(a.username)}</small></div><span class="status">대행사</span></div>`).join('') || empty('등록한 대행사가 없어요.')}</section>`;
}

function revenue() {
  const records = state.ledger.filter(item => item.wallet === 'revenue');
  return `<div class="balance-card"><div>${icon('card')}<span>대행사 충전 누적 수익</span></div><strong>${format(state.balances.revenue)}<small> 원</small></strong><p>현재 적용 수익률 ${state.rate / 100}%</p></div>
    <section class="section"><h2>수익 원장</h2>${records.map(r => {
      const charge = state.charges.find(c => c.id === Number(r.ref));
      return `<div class="record"><div><b>${esc(charge?.owner || '대행사')} 충전 수익</b><small>#${esc(r.ref)} · ${format(charge?.amount || 0)}원 × ${(charge?.rate || 0) / 100}% · ${day(r.created)}</small></div><strong class="credit">+${format(r.amount)}원</strong></div>`;
    }).join('') || empty('정산된 대행사 충전 수익이 없어요.')}</section>`;
}

function submissions() {
  return `<section><div class="section-head"><h2>참여 응답 검수</h2><span class="status pending">${format(state.adminCounts.pendingSubmissions)}건 대기</span></div>
    ${state.submissions.map(s => `<article class="panel order-card"><div class="row-top"><span class="eyebrow">제출 #${s.id} · ${day(s.created)}</span>${badge(s.status)}</div>
      <h3>${esc(s.title)}</h3><p>${esc(s.name)} · 보상 ${format(s.reward)}P</p><blockquote>${esc(s.response)}</blockquote>
      ${s.status === 'pending' ? `<div class="actions">${decision('mission/review', s.id, 'approve')}${decision('mission/review', s.id, 'reject')}</div>` : ''}</article>`).join('') || empty('제출된 답변이 없어요.')}</section>`;
}

function design() {
  return `<section class="panel"><h2>PC 화면 양옆 배경</h2><p class="muted">배경을 선택하면 애즈폼 PC 화면에 즉시 적용됩니다.</p>
    <div class="background-grid">${Object.entries(backgrounds).map(([key, name]) => `<button type="button" data-background="${key}" aria-pressed="${state.background === key}">
    <img src="/assets/wallpaper-${key}.webp" alt=""><span>${name}</span>${state.background === key ? icon('check') : ''}</button>`).join('')}</div></section>`;
}

function inquiries() {
  return `<section><div class="section-head"><h2>접수된 문의</h2><span class="status pending">${format(state.adminCounts.unreadInquiries)}건 미확인</span></div>
    ${state.inquiries.map(item => `<article class="panel order-card"><div class="row-top"><span class="eyebrow">문의 #${item.id} · ${day(item.created)}</span>
      <span class="status ${item.reviewed ? 'approved' : 'pending'}">${item.reviewed ? '확인 완료' : '미확인'}</span></div>
      <h3>${esc(item.subject)}</h3><p>${esc(item.sender || '비회원')}${item.email ? ' · ' + esc(item.email) : ''}</p>
      <blockquote>${esc(item.message)}</blockquote>
      ${item.reviewed ? '' : `<form class="actions" data-form="inquiry/review"><input type="hidden" name="id" value="${item.id}">${btn('확인 완료로 표시', 'type="submit"', 'quiet small')}</form>`}</article>`).join('') || empty('접수된 문의가 없어요.')}</section>`;
}

function participantHistory(params) {
  const status = params.get('status') || 'all';
  const items = state.submissions.filter(item => status === 'all' || item.status === status);
  return `<section class="panel"><div class="tabs">${[['all', '전체'], ['pending', '심사 대기'], ['approved', '승인'], ['rejected', '반려']].map(([key, label]) => `<a class="${status === key ? 'on' : ''}" href="/manage?tab=history&amp;status=${key}">${label}</a>`).join('')}</div>
    ${items.length ? participationList(items) : empty('해당 상태의 참여 내역이 없어요.')}</section>`;
}

function participantRewards() {
  const entries = state.ledger.filter(entry => entry.wallet === 'reward');
  return consoleHero('MY REWARDS', `${format(state.balances.reward)} P`, '승인된 미션에서 적립된 현재 포인트입니다.', '/missions', '미션 둘러보기') +
    `<section class="panel console-activity"><h2>포인트 적립 기록</h2>${entries.map(entry => `<div class="record"><div><b>${ledgerNames[entry.kind]}</b><small>${day(entry.created)}</small></div><strong class="credit">+${format(entry.amount)} P</strong></div>`).join('') || empty('아직 적립된 포인트가 없어요.')}</section>`;
}

function consoleProfile(user) {
  return `<section class="panel console-profile"><span class="console-avatar">${icon('user')}</span><h2>${esc(user.name)}</h2>
    <dl><div><dt>계정 유형</dt><dd>${roleName[user.role]}</dd></div><div><dt>로그인 아이디</dt><dd>${esc(user.username)}</dd></div></dl>
    <div class="actions">${btn('로그아웃', 'type="button" data-logout', 'quiet')}
      ${state.demo ? '<a class="btn primary" href="/login">테스트 계정 전환</a>' : ''}</div></section>`;
}

function manage(params) {
  const user = state.user;
  if (!user) return login(params);
  const admin = user.role === 'admin';
  const participant = user.role === 'participant';
  const groups = admin ? consoleNav.admin : participant ? consoleNav.participant :
    [...consoleNav.business, ...(user.role === 'operator' ? consoleNav.operator : [])];
  const profile = ['profile', '프로필', 'user'];
  const pages = [...groups.flatMap(([, items]) => items), profile];
  const [tab, title] = pages.find(([key]) => key === params.get('tab')) || pages[0];
  const views = { overview: () => overview(user), new: orderForm, orders: () => orders(params, admin), charges: () => charges(params, admin),
    partners: partnerAdmin, design, inquiries, agencies, revenue, submissions, history: () => participantHistory(params), rewards: participantRewards, profile: () => consoleProfile(user) };
  const menuLink = ([key, label, glyph]) => `<a href="/manage?tab=${key}"${key === tab ? ' aria-current="page"' : ''}>${icon(glyph)}<span>${label}</span></a>`;
  return `<div class="console-frame">
    <div class="console-mobile-bar"><button type="button" class="icon-btn" data-console-menu aria-controls="console-sidebar" aria-expanded="false" aria-label="관리 메뉴 열기">${icon('menu')}</button>
      <strong>${title}</strong><span>${roleName[user.role]}</span></div>
    <div class="console-backdrop" data-console-close hidden></div>
    <aside id="console-sidebar" class="console-sidebar">
      <div class="console-brand"><a class="logo" href="/manage" aria-label="애즈폼 대시보드">${brandMark}${wordmark}</a>
        <button type="button" class="icon-btn console-close" data-console-close aria-label="관리 메뉴 닫기">${icon('close')}</button></div>
      <div class="console-identity"><span class="console-avatar">${icon('user')}</span><div><strong>${esc(user.name)}</strong><small>${roleName[user.role]}${state.demo ? ' · 로컬 데모' : ''}</small></div></div>
      <nav aria-label="관리 메뉴">${groups.map(([group, items]) => `<div class="console-nav-group"><span>${group}</span>${items.map(menuLink).join('')}</div>`).join('')}
      ${participant ? `<div class="console-nav-group"><a href="/missions">${icon('target')}<span>미션 찾기</span></a></div>` : ''}</nav>
      <nav class="console-bottom" aria-label="프로필과 메인 이동">${menuLink(profile)}<a href="/">${icon('home')}<span>메인으로</span></a></nav>
    </aside>
    <div class="console-workspace"><div class="console-content">
      <header class="console-head"><div><span class="eyebrow">${admin ? 'ADSFORM STUDIO' : participant ? 'ADSFORM REWARDS' : 'ADSFORM BUSINESS'}</span><h1>${title}</h1></div>
        <time datetime="${state.date}">${day(state.date)}</time></header>
      <div class="console-view">${views[tab]()}</div>
    </div></div>
  </div>`;
}

function updateOrderForm(form) {
  const kind = form.elements.kind.value;
  const quiz = kind === 'quiz';
  const fields = form.querySelector('.quiz-fields');
  fields.hidden = !quiz;
  fields.disabled = !quiz;
  const { cost, reward } = state.products[kind];
  const total = cost * Number(form.elements.goal.value || 0);
  form.querySelector('.quote').innerHTML = `<span>건당 ${format(cost)}원 · 참여 보상 ${format(reward)}P</span><strong>예상 집행비 ${format(total)}원</strong><small>현재 사용 가능 ${format(state.balances.credit)}원</small>`;
}

function render() {
  if (!state) return;
  document.body.className = `theme-${state.background}${location.pathname === '/manage' && state.user ? ' console-mode' : ''}`;
  nav();
  const params = new URLSearchParams(location.search);
  const pages = { '/': home, '/missions': missions, '/login': login, '/account': state.user ? account : login, '/manage': manage };
  $('#main').innerHTML = (pages[location.pathname] || home)(params);
  const campaign = $('[data-form="campaign"]');
  if (campaign) updateOrderForm(campaign);
}

function afterLogin(user) {
  const next = new URLSearchParams(location.search).get('next');
  if (next === 'missions' && user.role === 'participant') return '/missions';
  if (next === 'rewards' && user.role === 'participant') return '/manage?tab=rewards';
  if (next === 'order' && !['participant', 'admin'].includes(user.role)) return '/manage?tab=new';
  return '/manage';
}

function setConsoleMenu(open) {
  const button = $('[data-console-menu]');
  if (!button) return;
  $('.console-frame').classList.toggle('menu-open', open);
  $('[data-console-close]').hidden = !open;
  button.setAttribute('aria-expanded', String(open));
  button.setAttribute('aria-label', open ? '관리 메뉴 닫기' : '관리 메뉴 열기');
  if (open) {
    requestAnimationFrame(() => $('.console-frame.menu-open #console-sidebar a[aria-current="page"]')?.focus());
  } else {
    button.focus();
  }
}

async function act(button, action) {
  button.disabled = true;
  const inlineError = dialog.contains(button) ? dialog.querySelector('.dialog-error') : null;
  if (inlineError) inlineError.hidden = true;
  try {
    await action();
  } catch (error) {
    if (inlineError && dialog.open) {
      inlineError.textContent = error.message;
      inlineError.hidden = false;
    } else {
      showToast(error.message);
    }
  } finally {
    button.disabled = false;
  }
}

document.addEventListener('click', event => {
  if (event.target.matches('[data-console-close]')) return setConsoleMenu(false);
  const link = event.target.closest('a[href^="/"]');
  if (link && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    let href = link.getAttribute('href');
    if (href.startsWith('/manage') && !state?.user) href = href.includes('tab=new') ? '/login?next=order' : '/login';
    go(href);
    return;
  }
  const button = event.target.closest('button');
  if (!button || !state) return;
  const d = button.dataset;
  if ('consoleClose' in d) setConsoleMenu(false);
  if ('consoleMenu' in d) setConsoleMenu(button.getAttribute('aria-expanded') !== 'true');
  if ('slide' in d) {
    slide = Number(d.slide);
    const nextControl = button.hasAttribute('aria-pressed') ? `[data-slide="${slide}"][aria-pressed]` : '[aria-label="다음 배너"]';
    $('#hero-slot').innerHTML = carousel();
    $(nextControl)?.focus({ preventScroll: true });
  }
  if ('mission' in d) act(button, async () => {
    await reload();
    openMission(Number(d.mission));
  });
  if ('order' in d) openOrder(Number(d.order));
  if ('guide' in d) modal('HELP CENTER', '이용 안내', faq.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join(''));
  if ('support' in d) openSupport();
  if ('demo' in d) act(button, async () => {
    const { user } = await api('/api/demo', { role: d.demo });
    const next = afterLogin(user);
    state = await api('/api/state');
    go(next);
    showToast(`${roleName[user.role]} 테스트 계정으로 로그인했습니다.`);
  });
  if ('logout' in d) act(button, async () => {
    await api('/api/logout', {});
    await reload();
    go('/');
    showToast('로그아웃했습니다.');
  });
  if ('background' in d) act(button, async () => {
    await api('/api/background', { value: d.background });
    await reload();
    showToast('PC 화면 배경을 적용했습니다.');
  });
  if ('decision' in d) {
    const reason = d.action === 'reject' && d.decision !== 'charge/decision';
    const explanation = { pause: '참여자에게 열려 있던 자리는 해제됩니다. 이미 제출한 응답은 검수할 수 있습니다.', close: '미제출 예약을 해제하고 승인 완료 건 기준으로 미집행 예산을 반환합니다.' };
    modal('ADSFORM STUDIO', actions[d.action] + ' 확인', `<p>${explanation[d.action] || `선택한 항목을 ${actions[d.action]} 처리합니다.`}</p>
      <form data-form="${d.decision}" class="form"><input type="hidden" name="id" value="${d.id}"><input type="hidden" name="action" value="${d.action}">
      ${reason ? textarea('반려 사유', 'reason', 'required maxlength="200" rows="3"') : ''}${btn(actions[d.action] + ' 처리', 'type="submit"')}</form>`);
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !dialog.open && $('.console-frame.menu-open')) setConsoleMenu(false);
});

document.addEventListener('input', event => {
  const form = event.target.form;
  if (form?.dataset.form === 'campaign') updateOrderForm(form);
  if (form?.dataset.form === 'account' && event.target.name === 'role') {
    const parent = form.querySelector('.parent-field');
    parent.hidden = event.target.value !== 'agency';
  }
});

document.addEventListener('submit', event => {
  const form = event.target;
  const path = form.dataset.form;
  if (!path) return;
  event.preventDefault();
  const button = event.submitter || form.querySelector('button[type="submit"]');
  act(button, async () => {
    const data = Object.fromEntries(new FormData(form));
    if (['campaign', 'charge', 'inquiry'].includes(path)) {
      form.dataset.key ||= crypto.randomUUID();
      data.key = form.dataset.key;
    }
    const result = await api('/api/' + path, data);
    if (path === 'mission/reserve') {
      await reload();
      openMission(Number(data.id));
      return;
    }
    if (dialog.open) dialog.close();
    if (path === 'login') {
      const next = afterLogin(result.user);
      state = await api('/api/state');
      go(next);
    } else if (path !== 'inquiry') {
      await reload();
      if (path === 'campaign') go('/manage?tab=orders');
    }
    const messages = { campaign: '광고 주문을 접수했습니다.', charge: '충전을 신청했습니다.', account: '계정을 등록했습니다.', rates: '수익률 설정을 저장했습니다.', login: '로그인했습니다.', inquiry: `문의 #${result.id}을 접수했습니다.`, 'inquiry/review': '문의 확인 상태를 저장했습니다.' };
    showToast(path === 'mission' ? ({ pending: '답변을 제출했습니다. 검수 후 결과를 확인하세요.', approved: '정답입니다. 포인트를 적립했어요!', rejected: '정답이 일치하지 않아 적립되지 않았습니다.' }[result.status]) : messages[path] || '처리했습니다.');
  });
});

addEventListener('popstate', () => {
  render();
  scrollToView(false);
});
reload().then(() => scrollToView(false)).catch(error => {
  $('#main').textContent = error.message;
  showToast('서버 상태를 확인해 주세요.');
});
