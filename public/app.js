const icons = {
  home: '<path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 21v-7h6v7"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12m0-12C5 8 5 2 9 3c2 0 3 3 3 5Zm0 0c7 0 7-6 3-5-2 0-3 3-3 5Z"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M4.5 21v-2a5 5 0 0 1 5-5h5a5 5 0 0 1 5 5v2"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  pause: '<path d="M9 5v14m6-14v14"/>',
  play: '<path d="m8 5 12 7-12 7Z"/>',
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
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  wallet: '<path d="M4 7a2 2 0 0 1 2-2h12v4"/><rect x="3" y="9" width="18" height="11" rx="2"/><path d="M16 14.5h.01"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5m4-1v5l3 2"/>',
  download: '<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>'
};
const icon = name => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const roleName = { admin: '최고관리자', operator: '실행사', agency: '대행사', advertiser: '광고주', participant: '참여자' };
const kinds = { quiz: '브랜드 퀴즈', survey: '설문 조사' };
const statuses = { pending: '심사 대기', active: '진행 중', upcoming: '시작 예정', settling: '검수 후 정산', paused: '일시중지', closed: '종료', approved: '승인', rejected: '반려', canceled: '취소', suspended: '이용 정지', withdrawn: '탈퇴' };
const ledgerNames = { opening: '테스트 잔액', charge: '충전 승인', reserve: '광고 예산 배정', release: '미집행 예산 반환', commission: '대행사 충전 수익', mission: '미션 보상', payout: '출금 신청', payout_return: '출금 반환', adjust: '운영 조정' };
const isBusiness = user => ['advertiser', 'agency', 'operator'].includes(user?.role);
const backgrounds = {
  grove: '봄날의 골목 상점', tide: '바닷가 카페', lilac: '라일락 책방', sunset: '노을빛 마켓', night: '저녁의 꽃가게',
  studio: '광고 기획 스튜디오', creator: '콘텐츠 촬영 스튜디오', city: '도심 속 브랜드 광고', showroom: '브랜드 쇼룸', growth: '캠페인 성장 가든'
};
const slogan = '작은 미션, 새로운 연결';
const avatarSheets = ['woodland', 'pets', 'ocean', 'safari', 'garden'];
const avatarFileLimit = 10 * 1024 * 1024;
const avatarFileTypes = ['image/jpeg', 'image/png', 'image/webp'];
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
  ['실행사는 하위 대행사를 어떻게 관리하나요?', '실행사 대시보드에서 하위 대행사를 등록하고, 승인된 충전에서 적립된 수익과 당시 적용률을 수익 원장에서 확인할 수 있습니다.'],
  ['모은 포인트는 어떻게 받나요?', '보상 내역 화면에서 5,000P 이상부터 출금을 신청할 수 있어요. 운영팀이 확인한 뒤 입력한 계좌로 보내 드리며, 반려되면 포인트가 그대로 돌아옵니다.']
];
const missionTypes = [
  { key: 'quiz', icon: 'star', title: '브랜드 퀴즈', intro: '브랜드 이야기를 읽고 정답을 맞혀요.', time: '약 1분', processing: '정답이면 바로 적립' },
  { key: 'survey', icon: 'survey', title: '의견 설문', intro: '상품과 서비스에 대한 생각을 전해요.', time: '약 3분', processing: '응답 검수 후 적립' }
];
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const format = value => new Intl.NumberFormat('ko-KR').format(value);
const day = value => value ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeZone: 'Asia/Seoul' }).format(new Date(value)) : '';
const dateTime = value => value ? new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' }).format(new Date(value)) : '';
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
const bannerInterval = 6000;
let bannerTimer;
let bannerPaused = matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  const scroll = window.scrollY;
  state = await api('/api/state');
  render();
  window.scrollTo(0, scroll);
}

function go(url) {
  if (dialog.open) dialog.close();
  history.pushState({}, '', url);
  render();
  scrollToView(true);
}

function scrollToView(focus) {
  const target = /^#[a-z-]+$/.test(location.hash) ? document.getElementById(location.hash.slice(1)) : null;
  if (target) {
    target.scrollIntoView({ block: 'start' });
    if (focus) target.focus({ preventScroll: true });
  } else if (focus) {
    window.scrollTo(0, 0);
    $('#main').focus({ preventScroll: true });
  }
}

function profileAvatar(user, size = '') {
  const avatar = user?.avatar;
  let image = icon('user');
  if (avatar?.version) {
    image = `<img class="avatar-photo" src="/api/profile/avatar?v=${esc(avatar.version)}" alt="">`;
  } else if (avatar) {
    const sheet = avatarSheets[Math.floor(avatar.variant / 6)];
    const cell = avatar.variant % 6;
    image = `<img class="avatar-sheet avatar-column-${cell % 3} avatar-row-${Math.floor(cell / 3)}" src="/assets/avatars-${sheet}.webp" alt="">`;
  }
  return `<span class="profile-avatar ${size}" aria-hidden="true">${image}</span>`;
}

const seenKey = 'adsform-notice-seen';
const seenNotice = () => { try { return Number(localStorage.getItem(seenKey)) || 0; } catch { return 0; } };
const latestNotice = () => Math.max(0, ...(state.notices || []).map(item => item.id));

const hasUnread = () => latestNotice() > seenNotice() || (state.unreadNotifications || 0) > 0;
const bellButton = (extra = '') => {
  const count = state.unreadNotifications || 0;
  return `<button type="button" class="icon-btn notice-bell ${extra}" data-notices aria-label="알림과 공지${count ? ` · 새 알림 ${count}건` : hasUnread() ? ' · 새 공지 있음' : ''}">${icon('bell')}${count ? `<i class="unread-count">${count > 99 ? '99+' : count}</i>` : hasUnread() ? '<i class="unread-dot"></i>' : ''}</button>`;
};

function nav() {
  const user = state.user;
  $('#header').innerHTML = `<a class="logo" href="/" aria-label="애즈폼 홈">${brandMark}${wordmark}<span class="logo-ko">애즈폼</span></a>
    <div class="header-actions"><button type="button" class="icon-btn" data-guide aria-label="이용 안내">${icon('help')}</button>
    ${bellButton()}
    <a href="${user ? '/manage' : '/login'}" class="login-link">${user ? profileAvatar(user, 'avatar-small') + esc(roleName[user.role]) : '로그인'}${icon('chevron')}</a></div>`;
  const participant = user?.role === 'participant';
  const links = [
    ['/', 'home', '홈'], ['/missions', 'target', '참여'],
    [participant ? '/manage?tab=rewards' : user ? '/manage' : '/login', participant ? 'gift' : 'bag', participant ? '보상' : user ? '대시보드' : '광고 관리'],
    ['/#guide', 'book', '이용방법', true], ['/#faq', 'help', 'FAQ'],
    [user ? '/manage?tab=profile' : '/login', 'user', '내 정보']
  ];
  $('#dock').innerHTML = links.map(([url, glyph, text, desktop]) => {
    const target = new URL(url, location.origin);
    const selected = target.pathname === location.pathname && target.hash === location.hash;
    return `<a href="${url}"${desktop ? ' class="rail-only"' : ''}${selected ? ' aria-current="page"' : ''}>
      ${glyph === 'user' && user ? profileAvatar(user) : `<span class="nav-icon">${icon(glyph)}</span>`}<span>${text}</span></a>`;
  }).join('') + '<span class="rail-wordmark rail-only" aria-hidden="true">ADSFORM</span>';
  $('#support').innerHTML = `<button type="button" class="support-button" data-support>${icon('chat')}<span>문의하기</span></button>`;
}

function openNotices() {
  const items = state.notices || [];
  const mine = state.notifications || [];
  const noticeHtml = items.length
    ? items.map(item => `<details class="notice-item"${item.pinned ? ' open' : ''}><summary>${item.pinned ? '<span class="pin">고정</span>' : ''}<b>${esc(item.title)}</b><small>${day(item.created)}</small></summary><p>${esc(item.body)}</p></details>`).join('')
    : empty('등록된 공지가 없어요.');
  const mineHtml = mine.length
    ? `<ul class="notify-list">${mine.map(item => `<li class="${item.read ? '' : 'unread'}"><a href="${esc(item.link || '/manage')}"><b>${esc(item.title)}</b><span>${esc(item.body)}</span><small>${dateTime(item.created)}</small></a></li>`).join('')}</ul>`
    : empty('새 알림이 없어요. 충전·심사·검수·출금 결과와 문의 답변이 여기에 표시돼요.');
  modal('NOTIFICATIONS', state.user ? '알림·공지' : '공지사항', state.user ? `<h3 class="sub-title">내 알림</h3>${mineHtml}<h3 class="sub-title">공지사항</h3>${noticeHtml}` : noticeHtml);
  try { localStorage.setItem(seenKey, String(latestNotice())); } catch { /* 저장소를 쓸 수 없으면 표시만 유지합니다. */ }
  if (state.unreadNotifications) {
    api('/api/notifications/read', {}).then(() => {
      state.unreadNotifications = 0;
      for (const item of state.notifications) item.read ||= new Date().toISOString();
    }).catch(() => {});
  }
  state.unreadNotifications = 0;
  for (const node of document.querySelectorAll('.notice-bell')) node.querySelector('.unread-dot, .unread-count')?.remove();
}

function bannerCopy(banner) {
  return `<span class="eyebrow">${banner.label}</span>
      <h1>${banner.title.replace('\n', '<br>')}</h1><p>${banner.text}</p>
      <a href="${banner.action}">${banner.cta} ${icon('arrow')}</a>`;
}

const nextSlide = () => (slide + 1) % banners.length;
const bannerCount = () => `0${slide + 1} / 0${banners.length}`;
const bannerLabel = () => `추천 캠페인 ${slide + 1} / ${banners.length}`;
const bannerToggleLabel = () => bannerPaused ? '배너 자동 전환 시작' : '배너 자동 전환 일시정지';

function carousel() {
  const banner = banners[slide];
  return `<section class="hero hero-${banner.name}" aria-label="${bannerLabel()}">
    <div class="hero-art"></div><div class="hero-copy">${bannerCopy(banner)}</div>
    <div class="carousel"><div class="dots">${banners.map((_, i) => `<button type="button" data-slide="${i}" aria-label="배너 ${i + 1}" aria-pressed="${i === slide}"></button>`).join('')}</div>
      <span data-banner-count>${bannerCount()}</span>
      <button type="button" data-next-banner aria-label="다음 배너">${icon('chevron')}</button>
      <button type="button" data-toggle-banner aria-label="${bannerToggleLabel()}">${icon(bannerPaused ? 'play' : 'pause')}</button></div>
  </section>`;
}

function showBanner(index) {
  slide = index;
  const hero = $('#hero-slot .hero');
  const banner = banners[slide];
  hero.className = `hero hero-${banner.name}`;
  hero.setAttribute('aria-label', bannerLabel());
  hero.querySelector('.hero-copy').innerHTML = bannerCopy(banner);
  hero.querySelector('[data-banner-count]').textContent = bannerCount();
  for (const dot of hero.querySelectorAll('[data-slide]')) {
    dot.setAttribute('aria-pressed', String(Number(dot.dataset.slide) === slide));
  }
}

function scheduleBannerRotation() {
  clearTimeout(bannerTimer);
  const copy = $('#hero-slot .hero-copy');
  if (!copy || bannerPaused || document.hidden) return;
  bannerTimer = setTimeout(() => {
    if (!dialog.open && !copy.contains(document.activeElement)) showBanner(nextSlide());
    scheduleBannerRotation();
  }, bannerInterval);
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
  const business = isBusiness(state.user);
  const rewardsUrl = participant ? '/manage?tab=rewards' : state.user ? '/missions' : '/login?next=rewards';
  const available = state.missions.filter(mission => !mission.mine && (mission.remaining > 0 || mission.reservedUntil));
  const featured = (available.length ? available : state.missions).slice(0, 4);
  return `<div class="content home-page">
    <div id="hero-slot">${carousel()}</div>
    <div class="home-brand-line">${brandMark}<div><strong>${slogan}</strong><small>브랜드 퀴즈와 설문으로 만나는 일상의 보상</small></div></div>
    <div class="quick-grid" aria-label="빠른 메뉴">
      ${[
        ['/missions?kind=quiz', 'star', '퀴즈', 'mint'],
        ['/missions?kind=survey', 'survey', '설문', 'violet'],
        state.user && !participant ? ['/manage', 'grid', '대시보드', 'peach'] : [rewardsUrl, 'gift', '내 보상', 'peach'],
        state.user?.role === 'participant' || state.user?.role === 'admin' ? ['/#faq', 'help', 'FAQ', 'yellow'] : ['/manage?tab=new', 'bag', '광고 주문', 'yellow']
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
        <p>참여한 미션의 심사 결과와 적립된 포인트를 보상 내역에서 확인하고, 5,000P부터 출금을 신청할 수 있어요.</p>
        ${state.user && !participant ? '<p class="form-hint">보상 내역은 참여자 계정에서 볼 수 있어요.</p>' : `<a class="btn primary" href="${rewardsUrl}">보상 내역 보기 ${icon('arrow')}</a>`}</div>
    </section>
    <section class="home-section business-story">
      <div class="business-banner"><div><span class="eyebrow">ADSFORM FOR BUSINESS</span><h2>고객의 답변으로<br>다음 캠페인을 준비하세요</h2>
        <p>브랜드 퀴즈로 이야기를 전하고, 설문으로 고객의 선택 이유를 알아보세요.</p><a class="btn" href="${business || !state.user ? '/manage?tab=new' : '/signup?role=advertiser'}">${business || !state.user ? '광고 주문하기' : '광고주로 가입하기'} ${icon('arrow')}</a></div>
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
    <footer class="home-footer"><a class="logo" href="/" aria-label="애즈폼 홈">${brandMark}${wordmark}</a><small>${slogan}</small><nav aria-label="하단 안내"><a href="/missions">오퍼월</a><a href="/#guide">이용방법</a><a href="/#faq">FAQ</a><a href="/terms">이용약관</a><a href="/privacy"><b>개인정보처리방침</b></a></nav>${state.demo ? '<small>로컬 데모 · 테스트 포인트</small>' : ''}</footer>
  </div>`;
}

function missions(params) {
  const kind = params.get('kind');
  const rank = m => m.reservedUntil ? 0 : !m.mine && m.remaining > 0 ? 1 : m.mine ? 3 : 2;
  const selection = state.missions.filter(m => !Object.hasOwn(kinds, kind) || m.kind === kind).sort((a, b) => rank(a) - rank(b) || b.id - a.id);
  return `<div class="content">${pageHead('OFFERWALL', '미션 찾기', '관심 있는 미션을 고르고 포인트를 모아보세요.')}
    <div class="tabs">${[['', '전체'], ...Object.entries(kinds)].map(([key, label]) => `<a class="${(kind || '') === key ? 'on' : ''}" href="/missions${key ? '?kind=' + key : ''}">${label}</a>`).join('')}</div>
    ${state.demo ? '<p class="section-note">테스트 미션 · 예시 포인트</p>' : ''}
    <div class="mission-list">${selection.map(missionCard).join('') || empty('현재 모집 중인 미션이 없어요.')}</div></div>`;
}

function login(params) {
  const next = params.get('next');
  const demoRoles = [['participant', 'gift'], ['advertiser', 'bag'], ['agency', 'people'], ['operator', 'grid'], ['admin', 'lock']];
  const current = state.user ? `<p class="notice">현재 ${esc(state.user.name)}(${roleName[state.user.role]}) 계정으로 로그인되어 있어요. <a href="/manage">대시보드로 가기</a></p>` : '';
  return `<div class="content login-page">${pageHead('WELCOME TO ADSFORM', '애즈폼에 오신 것을<br>환영해요', '계정으로 로그인하고 미션과 광고를 관리하세요.')}
    ${current}
    <form data-form="login" class="form panel">
      ${field('아이디', 'username', 'text', 'autocomplete="username" required placeholder="아이디를 입력하세요"')}
      ${field('비밀번호', 'password', 'password', 'autocomplete="current-password" required placeholder="비밀번호를 입력하세요"')}
      ${btn('로그인', 'type="submit"')}${next ? '<p class="form-hint">로그인 후 요청하신 화면으로 이동합니다.</p>' : ''}
      <p class="form-hint center">아직 계정이 없나요? <a href="/signup${next ? '?next=' + encodeURIComponent(next) : ''}">회원가입</a> · 비밀번호를 잊었다면 <button type="button" class="link-button" data-support>문의하기</button></p>
    </form>
    ${state.demo ? `<section class="demo-login"><div class="section-head"><div><span class="eyebrow">DEMO ACCESS</span><h2>테스트 계정으로 둘러보기</h2></div></div>
      <p>역할을 선택하면 비밀번호 입력 없이 로그인합니다.</p><div class="demo-grid">${demoRoles.map(([role, name]) => `<button type="button" data-demo="${role}">${icon(name)}<strong>${roleName[role]}</strong>${icon('chevron')}</button>`).join('')}</div></section>` : ''}</div>`;
}

function signup(params) {
  const chosen = params.get('role') === 'advertiser' || params.get('next') === 'order' ? 'advertiser' : 'participant';
  return `<div class="content login-page">${pageHead('JOIN ADSFORM', '애즈폼 회원가입', '참여자는 미션으로 포인트를, 광고주는 캠페인으로 고객의 생각을 만나요.')}
    <form data-form="signup" class="form panel">
      <fieldset class="role-picker"><legend>가입 유형</legend>
        ${[['participant', 'gift', '참여자', '미션에 참여하고 포인트를 모아요'], ['advertiser', 'bag', '광고주', '퀴즈·설문 캠페인을 주문해요']].map(([key, glyph, title, text]) =>
          `<label class="product-option"><input type="radio" name="role" value="${key}"${key === chosen ? ' checked' : ''}><span class="mission-icon ${key === 'participant' ? 'quiz' : 'survey'}">${icon(glyph)}</span><span class="product-copy"><b>${title}</b><small>${text}</small></span></label>`).join('')}
      </fieldset>
      ${field('이름 또는 상호', 'name', 'text', 'required maxlength="60" autocomplete="name"')}
      ${field('아이디', 'username', 'text', 'required minlength="4" maxlength="32" pattern="[a-z0-9][a-z0-9._\\-]+" autocomplete="username" placeholder="영문 소문자·숫자 4자 이상"')}
      ${field('비밀번호', 'password', 'password', 'required minlength="10" maxlength="128" autocomplete="new-password" placeholder="영문과 숫자를 함께 10자 이상"')}
      <label class="check"><input type="checkbox" name="agree" required> <span><a href="/terms" target="_blank">이용약관</a>과 <a href="/privacy" target="_blank">개인정보처리방침</a>에 동의합니다.</span></label>
      ${btn('가입하고 시작하기', 'type="submit"')}
      <p class="form-hint center">이미 계정이 있나요? <a href="/login">로그인</a></p>
    </form></div>`;
}

const policyDate = '2026년 11월 11일';
function terms() {
  const items = [
    ['목적', '이 약관은 애즈폼(이하 “서비스”)이 제공하는 브랜드 퀴즈·설문 미션, 포인트 적립, 광고 주문 기능의 이용 조건과 절차를 정합니다.'],
    ['계정', '회원은 정확한 정보로 가입해야 하며, 계정과 비밀번호를 타인과 공유할 수 없습니다. 운영팀이 만든 계정은 첫 로그인 후 비밀번호를 바꿔야 합니다.'],
    ['미션과 포인트', '각 미션은 계정당 한 번 참여할 수 있습니다. 퀴즈는 정답이면 바로, 설문은 검수 후 승인되면 포인트가 적립됩니다. 부정한 방법으로 얻은 포인트는 회수될 수 있습니다.'],
    ['포인트 출금', '포인트는 5,000P부터 출금을 신청할 수 있고, 1P는 1원으로 계산합니다. 운영팀이 신청 내용을 확인한 뒤 지급하며, 반려된 신청의 포인트는 돌려드립니다.'],
    ['광고 주문', '광고주는 충전한 잔액으로 캠페인을 주문합니다. 주문 시 예산이 배정되고, 캠페인이 끝나면 승인되지 않은 건의 예산은 잔액으로 돌아갑니다. 심사 대기 중인 주문은 직접 취소할 수 있습니다.'],
    ['이용 제한', '약관이나 법령을 위반하거나 서비스 운영을 방해하면 이용이 정지될 수 있습니다.'],
    ['문의', '서비스 이용 중 궁금한 점은 화면의 문의하기로 남겨 주세요.']
  ];
  return policyPage('TERMS', '이용약관', items);
}

function privacy() {
  const items = [
    ['수집하는 항목', '회원가입: 아이디, 이름 또는 상호, 비밀번호(암호화 저장). 문의: 제목, 내용, 답변 받을 이메일(선택). 출금 신청: 받을 계좌 정보. 미션 참여: 제출한 답변과 참여 시각.'],
    ['이용 목적', '회원 식별과 로그인, 미션 참여·포인트 적립과 출금 처리, 광고 캠페인 집행과 결과 리포트 제공, 문의 응대.'],
    ['광고주에게 제공되는 정보', '광고주는 캠페인 리포트에서 설문 답변을 볼 수 있으며, 참여자 이름은 첫 글자만 남기고 가려서 표시합니다.'],
    ['보관 기간', '회원 정보는 탈퇴 또는 이용 종료 시까지 보관합니다. 포인트·충전 거래 기록은 관련 법령에 따라 정해진 기간 동안 보관합니다.'],
    ['이용자의 권리', '이용자는 언제든 자신의 정보 열람·정정·삭제를 요청할 수 있습니다. 요청은 문의하기로 접수해 주세요.'],
    ['안전성 확보', '비밀번호는 복원할 수 없는 방식으로 암호화하고, 로그인 세션은 일정 시간이 지나면 만료됩니다.']
  ];
  return policyPage('PRIVACY', '개인정보처리방침', items);
}

const policyPage = (tag, title, items) => `<div class="content policy-page">${pageHead(tag, title, `시행일 ${policyDate}`)}
  <section class="panel">${items.map(([head, text], index) => `<h2>제${index + 1}조 ${head}</h2><p>${text}</p>`).join('')}</section>
  ${state.demo ? '<p class="notice">로컬 데모용 기본 문안입니다. 실제 서비스 오픈 전에 사업자 정보와 법률 검토 내용을 반영해 주세요.</p>' : ''}</div>`;

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
    ${reserved ? `<p class="notice countdown" data-deadline="${mission.reservedUntil}">남은 시간 <b data-remaining>${remainingText(mission.reservedUntil)}</b> · 제출 마감 ${clockTime(mission.reservedUntil)}</p>
      <form data-form="mission" class="form"><input type="hidden" name="id" value="${id}"><p class="question">${esc(mission.prompt)}</p>${input}${btn('미션 답변 제출', 'type="submit"')}</form>`
      : mission.mine ? `<p>${badge(mission.mine)} · 이미 제출한 미션입니다.</p>`
      : !mission.remaining ? '<p>지금은 빈자리가 없어요. 잠시 후 다시 확인해 주세요.</p>'
      : participant ? `<form data-form="mission/reserve" class="form"><input type="hidden" name="id" value="${id}">
        <p>참여를 시작하면 최대 ${format(state.reservationMinutes)}분간 자리를 확보합니다. 마감 시간이 지나면 자리가 풀립니다.</p>${btn('참여 시작', 'type="submit"')}</form>`
      : state.user ? `<p class="notice">미션 참여는 참여자 계정에서 할 수 있어요. 지금은 ${roleName[state.user.role]} 계정으로 로그인되어 있습니다.</p>`
      : `<div class="actions"><a class="btn primary" href="/login?next=missions">참여자 계정으로 로그인</a><a class="btn quiet" href="/signup">회원가입</a></div>`}`);
}

const remainingText = until => {
  const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
  return `${Math.floor(left / 60)}분 ${String(left % 60).padStart(2, '0')}초`;
};
let countdownTimer;
function tickCountdown() {
  clearInterval(countdownTimer);
  const node = dialog.querySelector('[data-deadline]');
  if (!node) return;
  countdownTimer = setInterval(() => {
    if (!dialog.open || !node.isConnected) return clearInterval(countdownTimer);
    const until = Number(node.dataset.deadline);
    node.querySelector('[data-remaining]').textContent = remainingText(until);
    node.classList.toggle('urgent', until - Date.now() < 60_000);
    if (until <= Date.now()) {
      clearInterval(countdownTimer);
      node.textContent = '참여 시간이 끝나 자리가 풀렸어요. 빈자리가 있으면 다시 시작할 수 있습니다.';
      dialog.querySelector('form[data-form="mission"]')?.remove();
    }
  }, 1000);
}

function modal(tag, title, body, wide = false) {
  dialog.setAttribute('aria-labelledby', 'dialog-title');
  dialog.classList.toggle('wide', wide);
  dialog.innerHTML = `<div class="dialog-inner"><form method="dialog"><button class="icon-btn dialog-close" aria-label="닫기">${icon('close')}</button></form><span class="eyebrow">${tag}</span><h2 id="dialog-title">${title}</h2>${body}<p class="dialog-error" role="alert" hidden></p></div>`;
  if (!dialog.open) dialog.showModal();
  tickCountdown();
}

function openSupport() {
  modal('ADSFORM SUPPORT', '무엇을 도와드릴까요?', `<p>광고 주문, 포인트, 미션 참여에 관한 문의를 남겨주세요.</p>
    <form class="form" data-form="inquiry">
      ${field('제목', 'subject', 'text', 'required minlength="3" maxlength="80" placeholder="문의 제목을 입력하세요"')}
      ${textarea('문의 내용', 'message', 'required minlength="10" maxlength="1200" rows="5" placeholder="10자 이상 입력해 주세요"')}
      ${field(state.user ? '답변 받을 이메일 (선택)' : '답변 받을 이메일', 'email', 'email', `maxlength="120" autocomplete="email" placeholder="name@example.com"${state.user ? '' : ' required'}`)}
      <p class="form-hint">${state.user ? '답변은 프로필 화면의 ‘내 문의’에서 확인할 수 있어요.' : '비회원 문의의 답변은 입력한 이메일로 보내 드립니다.'} 입력한 정보는 문의 응대에만 사용합니다. <a href="/privacy">개인정보처리방침</a></p>
      ${btn('문의 접수', 'type="submit"')}
    </form>`);
}

const consoleNav = {
  admin: [
    ['운영', [['overview', '운영 대시보드', 'grid'], ['orders', '주문 심사', 'bag'], ['submissions', '미션 검수', 'survey'], ['charges', '충전 승인', 'card'], ['payouts', '출금 승인', 'wallet']]],
    ['설정', [['partners', '계정·수익률', 'people'], ['notices', '공지사항', 'bell'], ['inquiries', '문의 내역', 'chat'], ['audit', '운영 기록', 'history'], ['design', 'PC 배경', 'star']]]
  ],
  participant: [
    ['내 활동', [['overview', '참여 대시보드', 'grid'], ['history', '참여 내역', 'survey'], ['rewards', '보상·출금', 'gift']]]
  ],
  business: [
    ['캠페인', [['overview', '광고 대시보드', 'grid'], ['new', '주문 등록', 'target'], ['orders', '주문 내역', 'bag']]],
    ['예산', [['charges', '잔액 충전', 'card'], ['ledger', '잔액 내역', 'book']]]
  ],
  operator: [
    ['파트너', [['agencies', '하위 대행사', 'people'], ['revenue', '수익·출금', 'gift']]]
  ]
};

/* ---------- 차트와 공통 구성요소 ---------- */
const shortDay = value => `${Number(value.slice(5, 7))}.${Number(value.slice(8, 10))}`;
const compact = value => {
  const abs = Math.abs(value);
  if (abs >= 1e8) return `${+(value / 1e8).toFixed(1)}억`;
  if (abs >= 1e4) return `${+(value / 1e4).toFixed(abs >= 1e5 ? 0 : 1)}만`;
  return format(value);
};
const percent = (part, whole) => whole ? Math.round(part / whole * 1000) / 10 : 0;
const niceMax = value => {
  if (value <= 0) return 4;
  if (value <= 12) return Math.ceil(value / 4) * 4;
  const power = 10 ** Math.floor(Math.log10(value));
  return [1, 1.2, 1.6, 2, 2.4, 3.2, 4, 6, 8, 10].find(step => step * power >= value - 1e-9) * power;
};
const sum = (items, key) => items.reduce((total, item) => total + (typeof key === 'function' ? key(item) : item[key] || 0), 0);
const monthOf = value => value.slice(0, 7);

function barChart(rows, series, { height = 230, stacked = true, unit = '건', label = '일별 추이', width = 680 } = {}) {
  const W = width, H = height, L = 46, R = 10, T = 14, B = 28;
  const totals = rows.map(row => stacked ? sum(series, item => row[item.key] || 0) : Math.max(...series.map(item => row[item.key] || 0)));
  const max = niceMax(Math.max(0, ...totals));
  const iw = W - L - R, ih = H - T - B, step = iw / rows.length;
  const groupWidth = Math.min(30, step * 0.62);
  const barWidth = stacked ? groupWidth : groupWidth / series.length;
  const y = value => T + ih - ih * value / max;
  const grid = [0, 1, 2, 3, 4].map(i => {
    const value = max * i / 4;
    return `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(value)}" y2="${y(value)}"/><text class="axis" x="${L - 8}" y="${y(value) + 4}" text-anchor="end">${compact(value)}</text>`;
  }).join('');
  const every = Math.ceil(rows.length / Math.max(3, Math.round(W / 85)));
  const columns = rows.map((row, index) => {
    const center = L + step * index + step / 2;
    let base = 0;
    const bars = series.map((item, n) => {
      const value = row[item.key] || 0;
      if (!value) return '';
      const x = stacked ? center - groupWidth / 2 : center - groupWidth / 2 + n * barWidth;
      const top = stacked ? y(base + value) : y(value);
      const bottom = stacked ? y(base) : y(0);
      if (stacked) base += value;
      return `<rect class="bar ${item.cls}" x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${Math.max(1, barWidth - (stacked ? 0 : 2)).toFixed(1)}" height="${Math.max(0.5, bottom - top).toFixed(1)}" rx="2.5"/>`;
    }).join('');
    const tip = `${shortDay(row.day)} · ${series.map(item => `${item.label} ${format(row[item.key] || 0)}${unit}`).join(' · ')}`;
    const text = index % every === 0 || index === rows.length - 1 ? `<text class="axis" x="${center}" y="${H - 8}" text-anchor="middle">${shortDay(row.day)}</text>` : '';
    return `<g class="col"><title>${esc(tip)}</title><rect class="hit" x="${(center - step / 2).toFixed(1)}" y="${T}" width="${step.toFixed(1)}" height="${ih}"/>${bars}${text}</g>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${grid}<line class="base" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/>${columns}</svg>`;
}

function lineChart(rows, key, { height = 200, unit = '원', label = '추이', cls = 'c1', width = 680 } = {}) {
  const W = width, H = height, L = 50, R = 12, T = 14, B = 28;
  const max = niceMax(Math.max(0, ...rows.map(row => row[key] || 0)));
  const iw = W - L - R, ih = H - T - B;
  const x = index => L + (rows.length === 1 ? iw / 2 : iw * index / (rows.length - 1));
  const y = value => T + ih - ih * value / max;
  const points = rows.map((row, index) => `${x(index).toFixed(1)},${y(row[key] || 0).toFixed(1)}`);
  const grid = [0, 1, 2, 3, 4].map(i => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(max * i / 4)}" y2="${y(max * i / 4)}"/><text class="axis" x="${L - 8}" y="${y(max * i / 4) + 4}" text-anchor="end">${compact(max * i / 4)}</text>`).join('');
  const every = Math.ceil(rows.length / Math.max(3, Math.round(W / 85)));
  const dots = rows.map((row, index) => `<g class="col"><title>${shortDay(row.day)} · ${format(row[key] || 0)}${unit}</title><rect class="hit" x="${(x(index) - iw / rows.length / 2).toFixed(1)}" y="${T}" width="${(iw / rows.length).toFixed(1)}" height="${ih}"/>
    ${row[key] ? `<circle class="dot ${cls}" cx="${x(index).toFixed(1)}" cy="${y(row[key]).toFixed(1)}" r="3.2"/>` : ''}
    ${index % every === 0 || index === rows.length - 1 ? `<text class="axis" x="${x(index).toFixed(1)}" y="${H - 8}" text-anchor="middle">${shortDay(row.day)}</text>` : ''}</g>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${grid}
    <path class="area ${cls}" d="M${x(0).toFixed(1)},${y(0)} L${points.join(' L')} L${x(rows.length - 1).toFixed(1)},${y(0)} Z"/>
    <polyline class="line ${cls}" points="${points.join(' ')}"/>${dots}</svg>`;
}

function sparkline(values, cls = 'c1') {
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => `${(index * 100 / Math.max(1, values.length - 1)).toFixed(1)},${(26 - value / max * 22).toFixed(1)}`);
  return `<svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><path class="area ${cls}" d="M0,28 L${points.join(' L')} L100,28 Z"/><polyline class="line ${cls}" points="${points.join(' ')}" vector-effect="non-scaling-stroke"/></svg>`;
}

function donut(segments, center, caption) {
  const total = sum(segments, 'value');
  let offset = 0;
  const rings = total ? segments.filter(item => item.value).map(item => {
    const share = item.value / total * 100;
    const ring = `<circle class="seg ${item.cls}" cx="21" cy="21" r="15.915" stroke-dasharray="${share.toFixed(2)} ${(100 - share).toFixed(2)}" stroke-dashoffset="${(25 - offset).toFixed(2)}"><title>${esc(item.label)} ${format(item.value)}</title></circle>`;
    offset += share;
    return ring;
  }).join('') : '';
  return `<div class="donut-wrap"><svg class="donut" viewBox="0 0 42 42" role="img" aria-label="${esc(caption)}"><circle class="seg-track" cx="21" cy="21" r="15.915"/>${rings}
    <text x="21" y="20.5" text-anchor="middle" class="donut-value">${esc(center)}</text><text x="21" y="26" text-anchor="middle" class="donut-caption">${esc(caption)}</text></svg>
    <ul class="legend">${segments.map(item => `<li><i class="dot ${item.cls}"></i><span>${esc(item.label)}</span><b>${format(item.value)}</b><small>${percent(item.value, total)}%</small></li>`).join('')}</ul></div>`;
}

const legend = series => `<div class="chart-legend">${series.map(item => `<span><i class="dot ${item.cls}"></i>${item.label}</span>`).join('')}</div>`;
const delta = (current, previous, suffix = '어제 대비') => {
  const diff = current - previous;
  return `<span class="delta ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}">${diff > 0 ? '▲' : diff < 0 ? '▼' : '−'} ${format(Math.abs(diff))} <small>${suffix}</small></span>`;
};
const panelHead = (title, sub = '', link = '') => `<div class="panel-head"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${link}</div>`;
const moreLink = (href, text = '전체보기') => `<a class="more" href="${href}">${text} ${icon('chevron')}</a>`;
const meter = (value, max, label) => `<progress class="meter" value="${Math.min(value, max)}" max="${max || 1}" aria-label="${esc(label)}"></progress>`;

function kpiTiles(items) {
  return `<div class="kpi-grid">${items.map(item => `<a class="kpi ${item.tone || ''}" href="${item.href}">
    <div class="kpi-top"><span class="kpi-icon">${icon(item.icon)}</span><span>${item.label}</span>${icon('chevron')}</div>
    <strong>${item.raw ?? format(item.value)}<small> ${item.unit}</small></strong>
    <div class="kpi-foot">${item.foot || ''}</div>${item.spark ? sparkline(item.spark, item.sparkCls) : ''}</a>`).join('')}</div>`;
}

function noticeList(limit = 4) {
  const items = (state.notices || []).slice(0, limit);
  return items.map(item => `<details class="notice-item"><summary>${item.pinned ? '<span class="pin">고정</span>' : ''}<b>${esc(item.title)}</b><small>${day(item.created)}</small></summary><p>${esc(item.body)}</p></details>`).join('') || empty('등록된 공지가 없어요.');
}

const phaseTone = { pending: 'c3', upcoming: 'c5', active: 'c1', paused: 'c4', settling: 'c2', closed: 'c6', rejected: 'c7' };
const phaseLabels = [['active', '진행 중'], ['pending', '심사 대기'], ['upcoming', '시작 예정'], ['paused', '일시중지'], ['settling', '검수 후 정산'], ['closed', '종료'], ['rejected', '반려']];
const trendSeries = [{ key: 'approved', label: '승인', cls: 'c1' }, { key: 'pending', label: '검수 대기', cls: 'c3' }, { key: 'rejected', label: '반려', cls: 'c7' }];

function campaignPhase(order) {
  if (['active', 'paused'].includes(order.status) && order.end_date < state.date) return 'settling';
  if (order.status === 'active' && order.start_date > state.date) return 'upcoming';
  return order.status;
}

function statusDonut(orders) {
  const segments = phaseLabels.map(([key, label]) => ({ label, cls: phaseTone[key], value: orders.filter(order => campaignPhase(order) === key).length })).filter(item => item.value);
  return donut(segments.length ? segments : [{ label: '캠페인 없음', cls: 'c6', value: 0 }], format(orders.length), '전체 캠페인');
}

function trendPanel(trend, days = 14, title = '참여 추이', sub = '') {
  const rows = trend.slice(-days);
  const approved = sum(rows, 'approved');
  const best = rows.reduce((top, row) => row.approved > top.approved ? row : top, rows[0] || { approved: 0, day: state.date });
  return `<section class="panel">${panelHead(title, sub || `최근 ${days}일 · 제출일 기준`, legend(trendSeries))}
    <dl class="mini-stats"><div><dt>승인 합계</dt><dd>${format(approved)}건</dd></div><div><dt>일평균 승인</dt><dd>${format(Math.round(approved / days * 10) / 10)}건</dd></div>
      <div><dt>최고 승인일</dt><dd>${best.approved ? `${shortDay(best.day)} · ${format(best.approved)}건` : '−'}</dd></div><div><dt>검수 대기</dt><dd>${format(sum(rows, 'pending'))}건</dd></div></dl>
    ${barChart(rows, trendSeries, { label: title })}</section>`;
}

function campaignTable(list, { owner = false, limit = 8 } = {}) {
  const rows = list.slice(0, limit);
  if (!rows.length) return empty('표시할 캠페인이 없어요.');
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>캠페인</th>${owner ? '<th>주문자</th>' : '<th>기간</th>'}<th>진행률</th><th class="num">오늘</th><th class="num">검수</th><th class="num">집행액</th><th>상태</th></tr></thead><tbody>
    ${rows.map(order => `<tr><td><button class="console-text-button" type="button" data-order="${order.id}">${esc(order.title)}</button><small>${kinds[order.kind]} · #${order.id}</small></td>
      ${owner ? `<td><small>${esc(order.owner || '애즈폼 예시')}</small></td>` : `<td><small>${order.start_date.slice(5).replace('-', '.')} ~ ${order.end_date.slice(5).replace('-', '.')}</small></td>`}
      <td class="progress-cell">${meter(order.approved, order.goal, '진행률')}<small>${format(order.approved)} / ${format(order.goal)} · ${percent(order.approved, order.goal)}%</small></td>
      <td class="num">${format(order.today)}${order.daily_cap ? `<small>/${format(order.daily_cap)}</small>` : ''}</td>
      <td class="num">${format(order.reviewing)}</td><td class="num">${format(order.approved * order.cost)}원</td><td>${badge(campaignPhase(order))}</td></tr>`).join('')}
  </tbody></table></div>`;
}

function ledgerTable(rows, unit) {
  if (!rows.length) return empty('아직 기록이 없어요.');
  return `<div class="table-wrap"><table class="data-table compact"><thead><tr><th>일시</th><th>구분</th><th>내용</th><th class="num">금액</th><th class="num">잔액</th></tr></thead><tbody>
    ${rows.map(item => `<tr><td><small>${dateTime(item.created)}</small></td><td><span class="kind-chip ${item.amount < 0 ? 'out' : 'in'}">${ledgerNames[item.kind] || esc(item.kind)}</span></td><td>${esc(item.memo || item.ref)}</td>
      <td class="num ${item.amount < 0 ? 'minus' : 'plus'}">${item.amount > 0 ? '+' : ''}${format(item.amount)}${unit}</td><td class="num">${format(item.after)}${unit}</td></tr>`).join('')}</tbody></table></div>`;
}

const ledgerRows = (wallet, unit, limit = 30) => ledgerTable(state.ledger.filter(item => item.wallet === wallet).slice(0, limit), unit);

function pager(page, pages, base) {
  if (pages <= 1) return '';
  const link = (n, text, label = '') => `<a href="${base}${base.includes('?') ? '&amp;' : '?'}page=${n}"${n === page ? ' aria-current="page"' : ''}${label ? ` aria-label="${label}"` : ''}>${text}</a>`;
  const from = Math.max(1, Math.min(page - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, i) => from + i);
  return `<nav class="pager" aria-label="페이지">${page > 1 ? link(page - 1, '‹', '이전 페이지') : ''}${numbers.map(n => link(n, n)).join('')}${page < pages ? link(page + 1, '›', '다음 페이지') : ''}</nav>`;
}

const query = (params, keys) => keys.filter(key => params.get(key)).map(key => `${key}=${encodeURIComponent(params.get(key))}`).join('&amp;');
const asyncSlot = (name, params) => `<div class="async-slot" data-async="${name}" data-query="${esc(params.toString())}"><p class="loading">불러오는 중입니다.</p></div>`;
const asyncViews = {};

async function hydrate() {
  for (const slot of document.querySelectorAll('[data-async]')) {
    const name = slot.dataset.async;
    slot.removeAttribute('data-async');
    try {
      slot.innerHTML = await asyncViews[name](new URLSearchParams(slot.dataset.query));
    } catch (error) {
      slot.innerHTML = empty(esc(error.message));
    }
    labelTables(slot);
  }
}

// 좁은 화면에서는 표를 카드처럼 보여 주기 위해 각 칸에 머리글을 붙입니다.
function labelTables(root = document) {
  for (const table of root.querySelectorAll('.data-table')) {
    const heads = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
    for (const row of table.querySelectorAll('tbody tr')) {
      [...row.children].forEach((cell, index) => {
        if (cell.dataset.label !== undefined) return;
        cell.dataset.label = heads[index] || '';
        cell.innerHTML = `<div class="cell">${cell.innerHTML}</div>`;
      });
    }
  }
}

asyncViews.ledger = async params => {
  const wallet = params.get('wallet');
  const unit = wallet === 'reward' ? 'P' : '원';
  const data = await api(`/api/ledger?wallet=${wallet}&page=${params.get('page') || 1}`);
  const base = `/manage?tab=${params.get('tab')}`;
  return `<div class="summary-strip">${[['현재 잔액', `${format(data.balance)}${unit}`], ['들어온 금액', `${data.income ? '+' : ''}${format(data.income)}${unit}`], ['나간 금액', `${data.outgo ? '−' : ''}${format(data.outgo)}${unit}`], ['전체 기록', `${format(data.count)}건`]]
    .map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('')}</div>
    <section class="panel dash-block">${panelHead(params.get('title') || '내역', data.count ? `${format(data.count)}건 중 ${format((data.page - 1) * 20 + 1)}~${format(Math.min(data.page * 20, data.count))}번째 · 거래 후 잔액 포함` : '거래 후 잔액 포함',
      data.count ? `<a class="btn quiet small" href="/api/export?type=ledger&amp;wallet=${esc(wallet)}" download>${icon('download')} 전체 CSV</a>` : '')}
    ${ledgerTable(data.items, unit)}${pager(data.page, data.pages, base)}</section>`;
};

/* ---------- 참여자 ---------- */
const levels = [[0, '새싹', 5], [5, '잎새', 15], [15, '나무', 40], [40, '숲', Infinity]];

function participationList(items) {
  return items.map(item => `<div class="record"><div><b>${esc(item.title)}</b><small>${item.brand ? esc(item.brand) + ' · ' : ''}${day(item.created)}${item.reason ? ' · ' + esc(item.reason) : ''}</small>
    ${item.response ? `<details class="my-answer"><summary>내 답변</summary><p>${esc(item.response)}</p></details>` : ''}</div>
    ${item.status === 'approved' ? `<strong class="credit">+${format(item.reward)} P</strong>` : badge(item.status)}</div>`).join('') || empty('아직 제출한 미션이 없어요.');
}

function participantOverview() {
  const items = state.submissions;
  const approved = items.filter(item => item.status === 'approved').length;
  const rejected = items.filter(item => item.status === 'rejected').length;
  const pending = items.filter(item => item.status === 'pending').length;
  const [floor, level, next] = levels.findLast(([min]) => approved >= min);
  const open = state.missions.filter(mission => !mission.mine && (mission.remaining > 0 || mission.reservedUntil));
  const week = state.trend.slice(-7);
  return `<section class="dash-hero participant"><div class="dash-hero-main"><span class="eyebrow">MY REWARDS</span>
      <h2>${esc(state.user.name)}님의 보상 지갑</h2>
      <div class="hero-balance"><span>보유 포인트</span><strong>${format(state.balances.reward)}<small> P</small></strong></div>
      <div class="hero-actions"><a class="btn lime" href="/missions">미션 찾기 ${icon('arrow')}</a><a class="btn ghost" href="/manage?tab=rewards">적립 내역</a></div></div>
    <div class="level-card"><span class="eyebrow">MY LEVEL</span><strong>${level}</strong>
      <p>${next === Infinity ? '최고 등급이에요. 꾸준한 참여 고마워요!' : `다음 등급까지 승인 ${format(next - approved)}건`}</p>
      ${next === Infinity ? '' : `<progress class="meter light" value="${approved - floor}" max="${next - floor}" aria-label="다음 등급 진행률"></progress>`}
      <small>승인 ${format(approved)}건 · 최근 7일 ${format(sum(week, 'total'))} P 적립</small></div></section>` +
    kpiTiles([
      { label: '제출한 미션', value: items.length, unit: '건', icon: 'survey', href: '/manage?tab=history' },
      { label: '심사 대기', value: pending, unit: '건', icon: 'clock', href: '/manage?tab=history&status=pending', tone: pending ? 'warn' : '' },
      { label: '승인 완료', value: approved, unit: '건', icon: 'check', href: '/manage?tab=history&status=approved' },
      { label: '승인율', raw: percent(approved, approved + rejected), unit: '%', icon: 'star', href: '/manage?tab=history', foot: `반려 ${format(rejected)}건` }
    ]) + `<div class="dash-grid g-2-1">
      <section class="panel">${panelHead('포인트 적립 추이', '최근 14일 · 승인일 기준')}${barChart(state.trend, [{ key: 'total', label: '적립', cls: 'c1' }], { unit: 'P', label: '포인트 적립 추이', height: 210 })}</section>
      <section class="panel">${panelHead('공지사항')}${noticeList()}</section></div>
    <div class="dash-grid g-1-1">
      <section class="panel">${panelHead('지금 참여할 수 있는 미션', `${format(open.length)}건 참여 가능`, moreLink('/missions'))}<div class="mission-list">${open.slice(0, 4).map(missionCard).join('') || empty('지금은 참여 가능한 미션이 없어요.')}</div></section>
      <section class="panel">${panelHead('최근 참여 내역', '', moreLink('/manage?tab=history'))}${participationList(items.slice(0, 6))}</section></div>`;
}

/* ---------- 광고주·대행사·실행사 ---------- */
function businessOverview(user) {
  const operator = user.role === 'operator';
  const orders = state.campaigns;
  const trend = state.trend;
  const todayRow = trend.at(-1);
  const yesterday = trend.at(-2);
  const month = trend.filter(row => monthOf(row.day) === monthOf(state.date));
  const live = orders.filter(order => ['active', 'paused', 'pending'].includes(order.status));
  const committed = sum(live, order => order.cost * (order.goal - order.approved));
  const approvedAll = sum(orders, 'approved');
  const rejectedAll = sum(orders, 'rejected');
  const running = orders.filter(order => campaignPhase(order) === 'active');
  const spent = sum(orders, order => order.approved * order.cost);
  const returned = sum(orders, 'returned');
  const pendingCharges = state.charges.filter(charge => charge.status === 'pending' && charge.user_id === user.id);
  return `<section class="dash-hero"><div class="dash-hero-main"><span class="eyebrow">CAMPAIGN CENTER</span>
      <h2>${esc(user.name)}님, 오늘 캠페인 현황이에요</h2>
      <div class="hero-balance"><span>사용 가능 잔액</span><strong>${format(state.balances.credit)}<small> 원</small></strong>${pendingCharges.length ? `<em>충전 승인 대기 ${format(sum(pendingCharges, 'amount'))}원</em>` : ''}</div>
      <div class="hero-actions"><a class="btn lime" href="/manage?tab=new">새 광고 주문 ${icon('arrow')}</a><a class="btn ghost" href="/manage?tab=charges">잔액 충전</a></div></div>
    <dl class="hero-side">
      <div><dt>이번 달 집행액</dt><dd>${format(sum(month, 'spend'))}원</dd></div>
      <div><dt>집행 대기 예산</dt><dd>${format(committed)}원</dd></div>
      <div><dt>누적 집행액</dt><dd>${format(spent)}원</dd></div>
      <div><dt>반환 완료</dt><dd>${format(returned)}원</dd></div>
    </dl></section>` +
    kpiTiles([
      { label: '진행 중 캠페인', value: running.length, unit: '건', icon: 'target', href: '/manage?tab=orders&status=active', foot: `심사 대기 ${format(orders.filter(o => o.status === 'pending').length)}건` },
      { label: '오늘 승인 참여', value: todayRow?.approved || 0, unit: '건', icon: 'check', href: '/manage?tab=orders', foot: delta(todayRow?.approved || 0, yesterday?.approved || 0), spark: trend.slice(-14).map(row => row.approved) },
      { label: '검수 대기 응답', value: sum(orders, 'reviewing'), unit: '건', icon: 'clock', href: '/manage?tab=orders', tone: sum(orders, 'reviewing') ? 'warn' : '', foot: '설문 응답 운영자 검수' },
      operator
        ? { label: '대행사 충전 수익', value: state.balances.revenue, unit: '원', icon: 'gift', href: '/manage?tab=revenue', foot: `적용 수익률 ${state.rate / 100}%`, spark: state.revenueTrend.slice(-14).map(row => row.total), sparkCls: 'c2' }
        : { label: '평균 승인율', raw: percent(approvedAll, approvedAll + rejectedAll), unit: '%', icon: 'star', href: '/manage?tab=orders', foot: `승인 ${format(approvedAll)} · 반려 ${format(rejectedAll)}` }
    ]) + `<div class="dash-grid g-2-1">${trendPanel(trend)}
      <section class="panel">${panelHead('캠페인 상태', '주문 전체 기준', moreLink('/manage?tab=orders'))}${statusDonut(orders)}</section></div>
    <section class="panel dash-block">${panelHead('캠페인 현황', '진행 중인 캠페인부터 표시합니다', moreLink('/manage?tab=orders'))}
      ${campaignTable([...orders].sort((a, b) => (campaignPhase(a) === 'active' ? 0 : 1) - (campaignPhase(b) === 'active' ? 0 : 1)))}</section>
    <div class="dash-grid g-1-1-1">
      <section class="panel">${panelHead('빠른 주문', '상품을 고르면 주문서가 열려요')}<div class="quick-products">${Object.entries(state.products).map(([key, product]) => `<a href="/manage?tab=new&amp;kind=${key}" class="quick-product ${key}">
        <span class="mission-icon ${key}">${icon(key === 'quiz' ? 'star' : 'survey')}</span><span><b>${kinds[key]}</b><small>건당 ${format(product.cost)}원 · 보상 ${format(product.reward)}P</small></span>${icon('chevron')}</a>`).join('')}</div>
        <p class="panel-note">${icon('info')} 일일 한도를 정하면 기간 동안 참여가 고르게 분배됩니다.</p></section>
      <section class="panel">${panelHead('일별 집행 금액', '최근 14일 · 승인 기준')}${lineChart(trend.slice(-14), 'spend', { label: '일별 집행 금액', height: 230, width: 400 })}</section>
      <section class="panel">${panelHead('공지사항')}${noticeList(3)}</section></div>
    <div class="dash-grid g-1-1">
      <section class="panel">${panelHead('최근 잔액 내역', '', moreLink('/manage?tab=ledger'))}${ledgerRows('credit', '원', 6)}</section>
      ${operator ? `<section class="panel">${panelHead('하위 대행사 실적', `${format(state.agencies.length)}곳`, moreLink('/manage?tab=agencies'))}${agencyTable(5)}</section>`
        : `<section class="panel">${panelHead('예산 사용 구성', '주문 배정 예산 기준')}${donut([
          { label: '승인 집행', value: spent, cls: 'c1' }, { label: '집행 대기', value: committed, cls: 'c3' }, { label: '반환 완료', value: returned, cls: 'c5' }
        ], compact(spent + committed + returned), '배정 예산(원)')}</section>`}</div>`;
}

/* ---------- 최고관리자 ---------- */
function adminOverview() {
  const orders = state.campaigns;
  const trend = state.trend;
  const todayRow = trend.at(-1);
  const pendingOrders = orders.filter(order => order.status === 'pending');
  const pendingCharges = state.charges.filter(charge => charge.status === 'pending');
  const queue = [
    ['주문 심사', pendingOrders.length, '/manage?tab=orders&status=pending', 'bag'],
    ['충전 승인', pendingCharges.length, '/manage?tab=charges&status=pending', 'card'],
    ['미션 검수', state.adminCounts.pendingSubmissions, '/manage?tab=submissions&status=pending', 'survey'],
    ['출금 승인', state.adminCounts.pendingPayouts, '/manage?tab=payouts&status=pending', 'wallet'],
    ['미확인 문의', state.adminCounts.unreadInquiries, '/manage?tab=inquiries', 'chat']
  ];
  const todo = sum(queue, item => item[1]);
  const month = trend.filter(row => monthOf(row.day) === monthOf(state.date));
  const chargeMonth = state.chargeTrend.filter(row => monthOf(row.day) === monthOf(state.date));
  const byKind = Object.keys(kinds).map(kind => {
    const list = orders.filter(order => order.kind === kind);
    const approved = sum(list, 'approved');
    return { kind, count: list.length, approved, rate: percent(approved, approved + sum(list, 'rejected')), spend: sum(list, order => order.approved * order.cost) };
  });
  const top = [...orders].filter(order => order.approved).sort((a, b) => b.approved * b.cost - a.approved * a.cost);
  const roles = state.roleCounts;
  return `<section class="dash-hero admin"><div class="dash-hero-main"><span class="eyebrow">OPERATION CENTER</span>
      <h2>${todo ? `오늘 처리할 업무 ${format(todo)}건` : '대기 중인 업무가 없어요'}</h2>
      <p>심사·충전·검수·출금·문의를 순서대로 처리하면 캠페인과 보상이 지연 없이 처리됩니다.</p>
      <div class="queue">${queue.map(([label, value, href, glyph]) => `<a href="${href}" class="${value ? 'on' : ''}">${icon(glyph)}<span>${label}</span><b>${format(value)}</b></a>`).join('')}</div></div>
    <dl class="hero-side">
      <div><dt>오늘 제출</dt><dd>${format((todayRow?.approved || 0) + (todayRow?.pending || 0) + (todayRow?.rejected || 0))}건</dd></div>
      <div><dt>오늘 충전 승인</dt><dd>${format(state.chargeTrend.at(-1)?.total || 0)}원</dd></div>
      <div><dt>진행 중 캠페인</dt><dd>${format(orders.filter(order => campaignPhase(order) === 'active').length)}건</dd></div>
      <div><dt>14일 활성 참여자</dt><dd>${format(state.kpi.activeParticipants)}명</dd></div>
    </dl></section>` +
    kpiTiles([
      { label: '누적 충전 승인', raw: compact(state.kpi.charged), unit: '원', icon: 'card', href: '/manage?tab=charges', foot: `이번 달 ${format(sum(chargeMonth, 'total'))}원`, spark: state.chargeTrend.slice(-14).map(row => row.total), sparkCls: 'c2' },
      { label: '이번 달 광고 집행', value: sum(month, 'spend'), unit: '원', icon: 'target', href: '/manage?tab=orders', foot: `승인 ${format(sum(month, 'approved'))}건`, spark: trend.slice(-14).map(row => row.spend) },
      { label: '지급 포인트 누적', value: state.kpi.rewards, unit: 'P', icon: 'gift', href: '/manage?tab=submissions', foot: `이번 달 ${format(sum(month, 'rewards'))}P`, spark: trend.slice(-14).map(row => row.rewards), sparkCls: 'c5' },
      { label: '실행사 수익 누적', value: state.kpi.commission, unit: '원', icon: 'grid', href: '/manage?tab=partners', foot: `기본 수익률 ${state.defaultRate / 100}%` }
    ]) + `<div class="dash-grid g-2-1">${trendPanel(trend, 14, '참여·검수 추이')}
      <section class="panel">${panelHead('캠페인 상태', '', moreLink('/manage?tab=orders'))}${statusDonut(orders)}</section></div>
    <div class="dash-grid g-1-1">
      <section class="panel">${panelHead('일별 충전 승인액', '최근 14일')}${barChart(state.chargeTrend.slice(-14), [{ key: 'total', label: '충전 승인', cls: 'c2' }], { unit: '원', label: '일별 충전 승인액', height: 210 })}</section>
      <section class="panel">${panelHead('상품별 성과')}<div class="kind-perf">${byKind.map(item => `<div class="kind-row"><span class="mission-icon ${item.kind}">${icon(item.kind === 'quiz' ? 'star' : 'survey')}</span>
          <div><b>${kinds[item.kind]}</b><small>캠페인 ${format(item.count)}건 · 승인 ${format(item.approved)}건</small>${meter(item.rate, 100, '승인율')}</div>
          <dl><div><dt>승인율</dt><dd>${item.rate}%</dd></div><div><dt>집행액</dt><dd>${compact(item.spend)}원</dd></div></dl></div>`).join('')}</div>
        <h3 class="sub-title">계정 구성</h3><div class="role-bars">${['advertiser', 'agency', 'operator', 'participant'].map(key => `<div><span>${roleName[key]}</span>${meter(roles[key] || 0, Math.max(...Object.values(roles)), roleName[key])}<b>${format(roles[key] || 0)}</b></div>`).join('')}</div></section></div>
    <div class="dash-grid g-3-2">
      <section class="panel">${panelHead('집행액 상위 캠페인', '', moreLink('/manage?tab=orders'))}${campaignTable(top, { owner: true, limit: 6 })}</section>
      <section class="panel">${panelHead('최근 운영 기록', '', moreLink('/manage?tab=audit'))}<ol class="timeline">${state.audit.slice(0, 8).map(item => `<li><b>${esc(item.action)} <small>#${esc(item.subject)}</small></b><small>${esc(item.name || '시스템')}${item.detail ? ' · ' + esc(statuses[item.detail] || roleName[item.detail] || item.detail) : ''} · ${dateTime(item.created)}</small></li>`).join('') || empty('아직 운영 기록이 없어요.')}</ol></section></div>`;
}

function overview(user) {
  if (user.role === 'participant') return participantOverview();
  if (user.role === 'admin') return adminOverview();
  return businessOverview(user);
}

/* ---------- 주문 ---------- */
const actions = {
  approve: '승인', reject: '반려', pause: '일시중지', resume: '재개', close: '종료·정산', cancel: '취소', suspend: '이용 정지', activate: '정지 해제'
};
const decision = (scope, id, action, label = actions[action]) => btn(label, `type="button" data-decision="${scope}" data-id="${id}" data-action="${action}" data-label="${esc(label)}"`, action === 'approve' ? 'primary small' : 'quiet small');
const findOrder = id => state.campaigns?.find(item => item.id === id) || state.agencyCampaigns?.find(item => item.id === id);

function orderCard(c, allowActions) {
  const phase = campaignPhase(c);
  const mine = c.owner_id === state.user.id;
  const choices = allowActions
    ? { pending: ['approve', 'reject'], upcoming: ['pause', 'close'], active: ['pause', 'close'], paused: ['resume', 'close'], settling: ['close'] }[phase] || []
    : mine ? { pending: ['cancel'], upcoming: ['pause', 'close'], active: ['pause', 'close'], paused: c.reason === '운영자 일시중지' ? ['close'] : ['resume', 'close'], settling: ['close'] }[phase] || [] : [];
  const rate = percent(c.approved, c.approved + c.rejected);
  return `<article class="panel order-card"><div class="row-top"><span class="eyebrow">${kinds[c.kind]} · #${c.id}${c.owner && allowActions ? ' · ' + esc(c.owner) : ''}</span>${badge(phase)}</div>
    <h3><button class="console-text-button" type="button" data-order="${c.id}">${esc(c.title)}</button></h3>
    <p>${esc(c.brand)} · ${c.start_date} ~ ${c.end_date}${c.daily_cap ? ` · 일일 한도 ${format(c.daily_cap)}건` : ''}</p>
    <dl class="order-stats"><div><dt>승인</dt><dd>${format(c.approved)}<small>/${format(c.goal)}</small></dd></div><div><dt>오늘</dt><dd>${format(c.today)}</dd></div>
      <div><dt>검수</dt><dd>${format(c.reviewing)}</dd></div><div><dt>승인율</dt><dd>${c.approved + c.rejected ? rate + '%' : '−'}</dd></div><div><dt>집행액</dt><dd>${compact(c.approved * c.cost)}<small>원</small></dd></div></dl>
    <div class="order-progress"><span>진행률 ${percent(c.approved, c.goal)}% · 예약 ${format(c.reserved)}</span><strong>${format(c.cost * c.goal)}원</strong></div>
    ${meter(c.approved, c.goal, '승인 완료 진행률')}
    ${c.memo ? `<p class="order-memo">${icon('book')} ${esc(c.memo)}</p>` : ''}
    ${c.reason ? `<p class="order-note ${c.status === 'rejected' ? 'error-inline' : ''}">${esc(c.reason)}</p>` : ''}
    <div class="actions">${btn('상세 리포트', `type="button" data-order="${c.id}"`, 'quiet small')}
      ${mine && c.status === 'pending' ? btn('주문 내용 수정', `type="button" data-edit-order="${c.id}"`, 'quiet small') : ''}
      ${mine && ['active', 'paused', 'upcoming'].includes(phase) ? btn('연장·증액', `type="button" data-extend-order="${c.id}"`, 'quiet small') : ''}
      ${mine ? `<a class="btn quiet small" href="/manage?tab=new&amp;copy=${c.id}">같은 조건으로 재주문</a>` : ''}
      ${choices.map(a => decision('campaign/decision', c.id, a, a === 'cancel' ? '주문 취소' : actions[a])).join('')}</div></article>`;
}

function orders(params, admin) {
  const filter = params.get('status') || 'all';
  const q = (params.get('q') || '').trim().toLowerCase();
  const kind = params.get('kind') || '';
  const period = params.get('period') || '';
  const since = period ? new Date(Date.parse(state.date) - (Number(period) - 1) * 86_400_000).toISOString().slice(0, 10) : '';
  const base = state.campaigns.filter(c => (!q || `${c.title} ${c.brand} ${c.owner || ''} ${c.id}`.toLowerCase().includes(q)) && (!kind || c.kind === kind) && (!since || c.created.slice(0, 10) >= since));
  const list = base.filter(c => filter === 'all' || campaignPhase(c) === filter);
  const keep = key => [['q', params.get('q')], ['kind', kind], ['period', period], ['status', key]].filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&amp;');
  const tabs = [['all', '전체'], ['pending', '대기'], ['upcoming', '예정'], ['active', '진행'], ['paused', '중지'], ['settling', '정산 대기'], ['closed', '종료'], ['rejected', '반려'], ['canceled', '취소']];
  return `<div class="summary-strip">${[
      ['조회 캠페인', `${format(list.length)}건`], ['목표 합계', `${format(sum(list, 'goal'))}건`], ['승인 합계', `${format(sum(list, 'approved'))}건`],
      ['집행액', `${format(sum(list, c => c.approved * c.cost))}원`], ['배정 예산', `${format(sum(list, c => c.goal * c.cost))}원`]
    ].map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('')}</div>
    <form class="filter-bar" data-filter="orders">
      <label class="search">${icon('target')}<input name="q" type="search" value="${esc(params.get('q') || '')}" placeholder="캠페인명, 브랜드${admin ? ', 주문자' : ''}, 번호 검색"></label>
      <select name="kind" aria-label="상품 유형"><option value="">전체 상품</option>${Object.entries(kinds).map(([key, label]) => `<option value="${key}"${key === kind ? ' selected' : ''}>${label}</option>`).join('')}</select>
      <select name="period" aria-label="등록 기간"><option value="">전체 기간</option>${[['7', '최근 7일'], ['30', '최근 30일'], ['90', '최근 90일']].map(([key, label]) => `<option value="${key}"${key === period ? ' selected' : ''}>${label}</option>`).join('')}</select>
      <input type="hidden" name="status" value="${esc(filter)}">${btn('검색', 'type="submit"', 'primary small')}
      ${q || kind || period ? '<a class="btn quiet small" href="/manage?tab=orders">초기화</a>' : ''}${admin ? `<a class="btn quiet small" href="/api/export?type=campaigns" download>${icon('download')} 전체 캠페인 CSV</a>` : ''}</form>
    <div class="tabs">${tabs.map(([key, label]) => {
      const n = key === 'all' ? base.length : base.filter(c => campaignPhase(c) === key).length;
      return `<a href="/manage?tab=orders&amp;${keep(key)}" class="${key === filter ? 'on' : ''}">${label} <span class="count">${format(n)}</span></a>`;
    }).join('')}</div>
    <div class="order-grid">${list.map(c => orderCard(c, admin)).join('') || empty('조건에 맞는 주문이 없습니다.')}</div>`;
}

async function openOrder(id) {
  const order = findOrder(id);
  if (!order) return;
  const choices = JSON.parse(order.choices);
  const spent = order.cost * order.approved;
  const waiting = Math.max(0, order.cost * (order.goal - order.approved) - order.returned);
  const phase = campaignPhase(order);
  const days = Math.round((Date.parse(order.end_date) - Date.parse(order.start_date)) / 86_400_000) + 1;
  modal(`${kinds[order.kind]} · #${order.id}`, esc(order.title), `<p>${esc(order.brand)}${order.owner && order.owner !== order.brand ? ' · ' + esc(order.owner) : ''} · ${order.start_date} ~ ${order.end_date} (${days}일)</p>
    <div class="report-kpis">${[
      ['목표', order.goal], ['승인', order.approved], ['검수', order.reviewing], ['반려', order.rejected], ['오늘', order.today]
    ].map(([label, value]) => `<div><span>${label}</span><b>${format(value)}</b></div>`).join('')}</div>
    <div class="order-progress"><span>${badge(phase)} 진행률 ${percent(order.approved, order.goal)}%${order.daily_cap ? ` · 일일 한도 ${format(order.daily_cap)}건` : ''}</span><strong>${format(order.cost * order.goal)}원</strong></div>
    ${meter(order.approved, order.goal, '진행률')}
    <div class="actions report-actions"><a class="btn quiet small" href="/api/export?type=responses&amp;id=${order.id}" download>${icon('download')} 응답 전체 CSV</a></div>
    <div id="report-body" class="report-body"><p class="loading">리포트를 불러오는 중입니다.</p></div>
    <h3>참여 안내</h3><p>${esc(order.details)}</p><h3>참여 질문</h3><p>${esc(order.prompt)}</p>
    ${choices.length && state.user.role === 'admin' ? `<ol>${choices.map((choice, i) => `<li>${esc(choice)}${i === order.answer ? ' · 정답' : ''}</li>`).join('')}</ol>` : ''}
    <dl class="settlement-summary">
      <div><dt>건당 단가 · 참여 보상</dt><dd>${format(order.cost)}원 · ${format(order.reward)}P</dd></div>
      <div><dt>승인 집행액</dt><dd>${format(spent)}원</dd></div>
      <div><dt>정산 전 잔여</dt><dd>${format(waiting)}원</dd></div>
      <div><dt>반환 완료</dt><dd>${format(order.returned)}원</dd></div>
    </dl>
    ${order.reason ? `<p class="notice">${esc(order.reason)}</p>` : ''}
    ${order.owner_id === state.user.id || state.user.role === 'admin' ? `<form class="form memo-form" data-form="campaign/memo"><input type="hidden" name="id" value="${order.id}">
      ${textarea('운영 메모', 'memo', 'maxlength="300" rows="2" placeholder="담당자 메모를 남겨 두세요"')}${btn('메모 저장', 'type="submit"', 'quiet small')}</form>` : ''}`, true);
  const memo = dialog.querySelector('textarea[name="memo"]');
  if (memo) memo.value = order.memo || '';
  try {
    const report = await api('/api/report?id=' + id);
    const target = dialog.querySelector('#report-body');
    if (!target) return;
    if (report.notStarted) {
      target.innerHTML = `<p class="notice">${order.status === 'pending' ? '운영자 심사가 끝나면 집행이 시작됩니다.' : ['rejected', 'canceled'].includes(order.status) ? '집행되지 않은 주문입니다. 배정 예산은 잔액으로 돌아갔어요.' : `${order.start_date}부터 참여를 받습니다.`} 참여가 시작되면 일별·시간대별 리포트가 여기에 표시됩니다.</p>
        ${report.history.length ? `<h3>처리 이력</h3><ol class="timeline">${report.history.map(item => `<li><b>${esc(item.action)}${item.detail ? ` · ${esc(statuses[item.detail] || item.detail)}` : ''}</b><small>${esc(item.name || '시스템')} · ${dateTime(item.created)}</small></li>`).join('')}</ol>` : ''}`;
      return;
    }
    const max = Math.max(1, ...report.hours);
    const peak = report.hours.indexOf(Math.max(...report.hours));
    const choiceTotal = sum(report.choices, 'total');
    target.innerHTML = `<h3>일별 참여</h3>${legend(trendSeries)}${barChart(report.daily, trendSeries, { label: '일별 참여', height: 190 })}
      <h3>시간대별 참여 <small>${report.hours.some(Boolean) ? `가장 활발한 시간 ${peak}시` : ''}</small></h3>
      <div class="hour-bars" aria-label="시간대별 참여">${report.hours.map((value, hour) => `<span title="${hour}시 ${value}건"><progress value="${value}" max="${max}"></progress><small>${hour % 6 === 0 ? hour : ''}</small></span>`).join('')}</div>
      ${report.choices.length ? `<h3>선택지 응답 분포</h3><div class="choice-bars">${report.choices.map(item => `<div><span>${esc(item.choice)}${item.correct ? ' <b class="status approved">정답</b>' : ''}</span>${meter(item.total, choiceTotal, item.choice)}<b>${format(item.total)} · ${percent(item.total, choiceTotal)}%</b></div>`).join('')}</div>` : ''}
      ${report.responses.length ? `<h3>설문 응답 <small>최근 ${format(report.responses.length)}건</small></h3><div class="responses">${report.responses.map(item => `<blockquote><span>${esc(item.who)} · ${dateTime(item.created)} ${badge(item.status)}</span>${esc(item.response)}</blockquote>`).join('')}</div>` : ''}
      ${report.history.length ? `<h3>처리 이력</h3><ol class="timeline">${report.history.map(item => `<li><b>${esc(item.action)}${item.detail ? ` · ${esc(statuses[item.detail] || item.detail)}` : ''}</b><small>${esc(item.name || '시스템')} · ${dateTime(item.created)}</small></li>`).join('')}</ol>` : ''}`;
  } catch (error) {
    dialog.querySelector('#report-body')?.replaceChildren(Object.assign(document.createElement('p'), { textContent: error.message }));
  }
}

function orderForm(params) {
  const today = state.date;
  const copy = state.campaigns.find(item => String(item.id) === params.get('copy'));
  const kind = copy?.kind || (Object.hasOwn(kinds, params.get('kind')) ? params.get('kind') : 'quiz');
  const end = new Date(Date.parse(today) + 13 * 86_400_000).toISOString().slice(0, 10);
  const choices = copy ? JSON.parse(copy.choices) : [];
  const v = (key, fallback = '') => esc(copy ? copy[key] ?? fallback : fallback);
  return `<form data-form="campaign" class="order-layout">
    <div class="order-main">
      <section class="panel"><div class="step-head"><span>1</span><div><h2>상품 선택</h2><p>목표에 맞는 미션 유형을 고르세요.</p></div></div>
        <div class="product-picker">${Object.entries(state.products).map(([key, product]) => {
          const type = missionTypes.find(item => item.key === key);
          return `<label class="product-option"><input type="radio" name="kind" value="${key}"${key === kind ? ' checked' : ''}>
            <span class="mission-icon ${key}">${icon(type.icon)}</span><span class="product-copy"><b>${kinds[key]}</b><small>${type.intro}</small>
            <small>${type.time} · ${type.processing}</small></span><span class="product-price"><b>${format(product.cost)}원</b><small>건당 · 보상 ${format(product.reward)}P</small></span></label>`;
        }).join('')}</div></section>
      <section class="panel"><div class="step-head"><span>2</span><div><h2>미션 내용</h2><p>참여자에게 보이는 문구입니다.</p></div></div>
        <div class="form">
          <div class="two">${field('캠페인 제목', 'title', 'text', `required maxlength="80" placeholder="예시 · 로컬 브랜드 퀴즈" value="${v('title')}"`)}${field('브랜드명', 'brand', 'text', `required maxlength="50" value="${v('brand')}"`)}</div>
          ${textarea('미션 안내', 'details', 'required maxlength="500" rows="3" placeholder="참여자에게 브랜드와 미션을 소개해 주세요"')}
          ${field('참여 질문', 'prompt', 'text', `required maxlength="200" value="${v('prompt')}"`)}
          ${quizFields(choices)}
        </div></section>
      <section class="panel"><div class="step-head"><span>3</span><div><h2>수량과 일정</h2><p>일일 한도를 정하면 기간 동안 고르게 모집합니다.</p></div></div>
        <div class="form">
          <div class="two">${field('목표 완료 건수', 'goal', 'number', `required min="1" max="50000" value="${v('goal', 100)}"`)}${field('일일 한도 (선택)', 'daily_cap', 'number', `min="0" max="50000" placeholder="제한 없음" value="${copy?.daily_cap ?? ''}"`)}</div>
          <div class="two">${field('시작일', 'start', 'date', `required min="${today}" value="${today}"`)}${field('종료일', 'end', 'date', `required min="${today}" value="${end}"`)}</div>
          <div class="chips" aria-label="기간 빠른 선택">${[[7, '1주'], [14, '2주'], [30, '30일']].map(([n, label]) => `<button type="button" class="chip" data-span="${n}">${label}</button>`).join('')}</div>
          ${field('운영 메모 (선택)', 'memo', 'text', `maxlength="300" placeholder="주문자와 애즈폼 운영팀만 보는 메모" value="${v('memo')}"`)}
        </div></section>
    </div>
    <aside class="order-aside"><section class="panel quote-panel"><span class="eyebrow">ESTIMATE</span><h2>견적 요약</h2><div class="quote" aria-live="polite"></div>
      ${btn('견적 확인 및 주문 제출', 'type="submit"')}<p class="form-hint">제출하면 예산이 배정되고 운영자 심사 후 집행됩니다. 심사 전에는 직접 취소할 수 있고, 종료 시 미집행분은 자동 반환돼요.</p></section></aside>
    <div class="quote-sticky"><div><small>예상 집행비</small><b data-quote-total>0원</b></div>${btn('주문 제출', 'type="submit"', 'primary small')}</div>
  </form>`;
}

function quizFields(choices = [], answer = 0) {
  return `<fieldset class="quiz-fields"><legend>퀴즈 선택지 <small>2~5개 · 비워 둔 칸은 제외돼요</small></legend>
    ${[1, 2, 3, 4, 5].map(i => field(`선택지 ${i}${i > 2 ? ' (선택)' : ''}`, 'option' + i, 'text', `${i <= 2 ? 'required ' : ''}maxlength="60" value="${esc(choices[i - 1] || '')}"`)).join('')}
    ${select('정답', 'answer', [1, 2, 3, 4, 5].map(i => [i, '선택지 ' + i]))}</fieldset>`;
}

function syncAnswerOptions(form) {
  const answer = form.elements.answer;
  if (!answer) return;
  for (const option of answer.options) {
    const filled = Boolean(form.elements['option' + option.value]?.value.trim());
    option.disabled = !filled;
    option.textContent = filled ? `선택지 ${option.value} · ${form.elements['option' + option.value].value.trim().slice(0, 20)}` : `선택지 ${option.value} (비어 있음)`;
  }
  if (answer.selectedOptions[0]?.disabled) answer.value = [...answer.options].find(option => !option.disabled)?.value || '1';
}

function openEditOrder(id) {
  const order = findOrder(id);
  if (!order) return;
  const choices = JSON.parse(order.choices);
  modal(`${kinds[order.kind]} · #${order.id}`, '주문 내용 수정', `<p>심사 대기 중에는 문구와 선택지를 고칠 수 있어요. 수량·기간을 바꾸려면 주문을 취소하고 다시 주문해 주세요.</p>
    <form class="form" data-form="campaign/edit"><input type="hidden" name="id" value="${order.id}">
      ${field('캠페인 제목', 'title', 'text', `required maxlength="80" value="${esc(order.title)}"`)}${field('브랜드명', 'brand', 'text', `required maxlength="50" value="${esc(order.brand)}"`)}
      ${textarea('미션 안내', 'details', 'required maxlength="500" rows="3"')}${field('참여 질문', 'prompt', 'text', `required maxlength="200" value="${esc(order.prompt)}"`)}
      ${order.kind === 'quiz' ? quizFields(choices) : ''}${btn('수정 내용 저장', 'type="submit"')}</form>`, true);
  const form = dialog.querySelector('form[data-form]');
  form.elements.details.value = order.details;
  if (order.kind === 'quiz') {
    form.elements.answer.value = String(order.answer + 1);
    syncAnswerOptions(form);
  }
}

function openExtend(id) {
  const order = findOrder(id);
  if (!order) return;
  modal(`${kinds[order.kind]} · #${order.id}`, '캠페인 연장·증액', `<p>목표 건수를 늘리거나 종료일을 미룰 수 있어요. 늘린 건수만큼 예산이 추가로 배정되고, 끝난 뒤 미집행분은 자동으로 돌아옵니다.</p>
    <form class="form" data-form="campaign/extend" data-cost="${order.cost}" data-goal="${order.goal}" data-start="${order.start_date}"><input type="hidden" name="id" value="${order.id}">
      <div class="two">${field('목표 완료 건수', 'goal', 'number', `required min="${order.goal}" max="50000" value="${order.goal}"`)}${field('종료일', 'end', 'date', `required min="${order.end_date}" value="${order.end_date}"`)}</div>
      ${field('일일 한도 (선택)', 'daily_cap', 'number', `min="0" max="50000" placeholder="제한 없음" value="${order.daily_cap ?? ''}"`)}
      <div class="extend-quote" aria-live="polite"></div>${btn('연장·증액 신청', 'type="submit"')}</form>`);
  updateExtendForm(dialog.querySelector('form[data-form="campaign/extend"]'));
}

function updateExtendForm(form) {
  const goal = Number(form.elements.goal.value || 0);
  const extra = Math.max(0, goal - Number(form.dataset.goal)) * Number(form.dataset.cost);
  const after = state.balances.credit - extra;
  const days = form.elements.end.value ? Math.round((Date.parse(form.elements.end.value) - Date.parse(form.dataset.start)) / 86_400_000) + 1 : 0;
  const cap = Number(form.elements.daily_cap.value || 0);
  form.querySelector('.extend-quote').innerHTML = `<dl class="quote-balance"><div><dt>추가 배정 예산</dt><dd>${format(extra)}원</dd></div>
    <div><dt>신청 후 잔액</dt><dd class="${after < 0 ? 'minus' : ''}">${format(after)}원</dd></div><div><dt>전체 집행 기간</dt><dd>${days ? format(days) + '일' : '−'}</dd></div></dl>
    ${after < 0 ? `<p class="quote-warn">잔액이 ${format(-after)}원 부족해요. <a href="/manage?tab=charges">충전 신청하기</a></p>` : ''}
    ${cap && days && cap * days < goal ? `<p class="quote-warn">일일 한도 ${format(cap)}건 × ${format(days)}일로는 목표를 채울 수 없어요.</p>` : ''}`;
}

function updateOrderForm(form) {
  const kind = form.elements.kind.value;
  const quiz = kind === 'quiz';
  const fields = form.querySelector('.quiz-fields');
  fields.hidden = !quiz;
  fields.disabled = !quiz;
  syncAnswerOptions(form);
  const { cost, reward } = state.products[kind];
  const goal = Math.max(0, Number(form.elements.goal.value || 0));
  const cap = Number(form.elements.daily_cap.value || 0);
  const start = form.elements.start.value;
  const end = form.elements.end.value;
  const days = start && end && end >= start ? Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1 : 0;
  const total = cost * goal;
  const after = state.balances.credit - total;
  const capShort = cap && days && cap * days < goal;
  const sticky = form.querySelector('[data-quote-total]');
  if (sticky) sticky.textContent = `${format(total)}원${after < 0 ? ' · 잔액 부족' : ''}`;
  form.querySelector('.quote').innerHTML = `<dl>
      <div><dt>상품</dt><dd>${kinds[kind]}</dd></div>
      <div><dt>건당 단가</dt><dd>${format(cost)}원</dd></div>
      <div><dt>목표 건수</dt><dd>${format(goal)}건</dd></div>
      <div><dt>집행 기간</dt><dd>${days ? `${format(days)}일` : '날짜 확인'}</dd></div>
      <div><dt>하루 평균 필요</dt><dd>${days ? `${format(Math.ceil(goal / days))}건` : '−'}</dd></div>
      <div><dt>참여 보상</dt><dd>${format(reward)}P / 건</dd></div>
    </dl>
    <div class="quote-total"><span>예상 집행비</span><strong>${format(total)}원</strong></div>
    <dl class="quote-balance"><div><dt>사용 가능 잔액</dt><dd>${format(state.balances.credit)}원</dd></div><div><dt>주문 후 잔액</dt><dd class="${after < 0 ? 'minus' : ''}">${format(after)}원</dd></div></dl>
    ${after < 0 ? `<p class="quote-warn">잔액이 ${format(-after)}원 부족해요. <a href="/manage?tab=charges">충전 신청하기</a></p>` : ''}
    ${capShort ? `<p class="quote-warn">일일 한도 ${format(cap)}건 × ${format(days)}일로는 목표를 채울 수 없어요.</p>` : ''}`;
}

/* ---------- 예산 ---------- */
function charges(params, admin) {
  const status = params.get('status') || 'all';
  // 실행사는 하위 대행사 충전도 내려받지만, 이 화면에는 본인 신청만 보여 줍니다.
  const own = admin ? state.charges : state.charges.filter(charge => charge.user_id === state.user.id);
  const list = own.filter(charge => status === 'all' || charge.status === status);
  const approved = own.filter(charge => charge.status === 'approved');
  const pending = own.filter(charge => charge.status === 'pending');
  return `<div class="summary-strip">${[
      [admin ? '승인 대기' : '승인 대기 금액', admin ? `${format(pending.length)}건 · ${format(sum(pending, 'amount'))}원` : `${format(sum(pending, 'amount'))}원`],
      ['누적 승인액', `${format(sum(approved, 'amount'))}원`], ['승인 건수', `${format(approved.length)}건`],
      [admin ? '실행사 수익' : '사용 가능 잔액', `${format(admin ? sum(approved, 'commission') : state.balances.credit)}원`]
    ].map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('')}</div>
    ${admin ? '' : `<section class="panel charge-panel"><div>${panelHead('광고 잔액 충전', '부가세 포함 금액을 입금하면 운영팀이 확인 후 승인하고, 충전 금액이 잔액에 반영됩니다.')}
      <form class="form" data-form="charge">${field('충전 금액 (원)', 'amount', 'number', 'required min="1000" max="10000000" step="1000" value="100000"')}
        <div class="chips">${[100000, 300000, 500000, 1000000].map(n => `<button type="button" class="chip" data-amount="${n}">+${compact(n)}</button>`).join('')}<button type="button" class="chip" data-amount="0">초기화</button></div>
        ${btn('충전 신청', 'type="submit"')}</form></div>
      <div class="charge-receipt" aria-live="polite"></div></section>
      ${state.demo ? '<p class="notice">테스트 충전입니다. 실제로 결제되거나 입금되지 않습니다.</p>' : '<p class="notice">외부 결제는 아직 연결되어 있지 않습니다. 담당자와 입금 계좌를 확인한 후 신청해 주세요.</p>'}`}
    <section class="panel dash-block">${panelHead(admin ? '충전 승인 요청' : '충전 신청 내역', '', admin ? `<a class="btn quiet small" href="/api/export?type=charges" download>${icon('download')} CSV 내려받기</a>` : '')}
    <div class="tabs">${[['all', '전체'], ['pending', '대기'], ['approved', '승인'], ['rejected', '반려'], ['canceled', '취소']].map(([key, label]) => `<a href="/manage?tab=charges&amp;status=${key}" class="${key === status ? 'on' : ''}">${label} <span class="count">${format(key === 'all' ? own.length : own.filter(c => c.status === key).length)}</span></a>`).join('')}</div>
    ${list.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>번호</th><th>신청일</th>${admin ? '<th>신청 계정</th>' : ''}<th class="num">충전액</th><th class="num">입금액(부가세 포함)</th><th>실행사 수익</th><th>상태</th><th></th></tr></thead><tbody>
      ${list.map(c => `<tr><td>#${c.id}</td><td><small>${dateTime(c.created)}</small></td>${admin ? `<td>${esc(c.owner)}<small>${roleName[c.ownerRole] || ''}</small></td>` : ''}
        <td class="num">${format(c.amount)}원</td><td class="num"><small>${format(c.amount + c.vat)}원</small></td>
        <td>${c.operator ? `${esc(c.operator)}<small>${format(c.commission)}원 (${c.rate / 100}%)</small>` : '<small>−</small>'}</td><td>${badge(c.status)}${c.reason ? `<small>${esc(c.reason)}</small>` : ''}</td>
        <td class="row-actions">${c.status !== 'pending' ? '' : admin ? decision('charge/decision', c.id, 'approve') + decision('charge/decision', c.id, 'reject') : decision('charge/cancel', c.id, 'cancel', '신청 취소')}</td></tr>`).join('')}
    </tbody></table></div>` : empty('충전 요청이 없습니다.')}</section>`;
}

function updateChargeForm(form) {
  const amount = Math.max(0, Number(form.elements.amount.value || 0));
  const vat = Math.round(amount * 0.1);
  const target = form.closest('.charge-panel')?.querySelector('.charge-receipt');
  if (target) target.innerHTML = `<span class="eyebrow">RECEIPT PREVIEW</span><dl>
    <div><dt>충전 잔액</dt><dd>${format(amount)}원</dd></div><div><dt>부가세 (10%)</dt><dd>${format(vat)}원</dd></div>
    <div class="total"><dt>입금 예정액</dt><dd>${format(amount + vat)}원</dd></div><div><dt>충전 후 잔액</dt><dd>${format(state.balances.credit + amount)}원</dd></div></dl>
    <small>세금계산서가 필요하면 충전 신청 후 문의하기로 사업자 정보를 보내 주세요.</small>`;
}

function ledgerView(params) {
  return asyncSlot('ledger', new URLSearchParams({ tab: 'ledger', wallet: 'credit', title: '잔액 내역', page: params.get('page') || '1' }));
}

/* ---------- 계정·파트너 ---------- */
function accountForm(admin) {
  const operators = admin ? state.accounts.filter(a => a.role === 'operator') : [];
  return `<form class="form" data-form="account">
    ${admin ? select('계정 유형', 'role', [['advertiser', '광고주'], ['operator', '실행사'], ['agency', '대행사'], ['participant', '참여자']]) : ''}
    ${admin ? `<div class="parent-field" hidden>${select('소속 실행사', 'parent_id', [['', '선택 안 함'], ...operators.map(a => [a.id, a.name])])}</div>` : ''}
    ${field('표시 이름', 'name', 'text', 'required maxlength="60"')}
    ${field('로그인 아이디', 'username', 'text', 'required minlength="4" maxlength="32" autocomplete="off"')}
    ${field('임시 비밀번호', 'password', 'password', 'required minlength="10" maxlength="128" autocomplete="new-password" placeholder="영문과 숫자를 함께 10자 이상"')}
    <p class="form-hint">새 계정은 첫 로그인 후 비밀번호를 바꾸도록 안내됩니다.</p>
    ${btn(admin ? '계정 만들기' : '하위 대행사 등록', 'type="submit"')}
  </form>`;
}

const accountStatus = a => ['suspended', 'withdrawn'].includes(a.status) ? badge(a.status) : '';
const manageButton = a => a.is_demo ? '<small>테스트 계정</small>' : a.status === 'withdrawn' ? '<small>탈퇴 계정</small>'
  : btn(state.user.role === 'admin' ? '상세·관리' : '관리', `type="button" data-account="${a.id}"`, 'quiet small');

function openAccount(id) {
  const admin = state.user.role === 'admin';
  const a = admin ? state.accounts.find(item => item.id === id) : { ...state.agencies.find(item => item.id === id), role: 'agency' };
  if (!a?.id) return;
  const hidden = action => `<input type="hidden" name="id" value="${a.id}"><input type="hidden" name="action" value="${action}">`;
  const operators = admin ? state.accounts.filter(item => item.role === 'operator') : [];
  const walletNames = { credit: '광고 잔액', revenue: '실행사 수익', reward: '포인트' };
  const wallets = a.role === 'participant' ? ['reward'] : a.role === 'operator' ? ['credit', 'revenue'] : ['credit'];
  modal(`${roleName[a.role]} · ${esc(a.username)}`, `${esc(a.name)} 계정 관리`, `
    ${admin ? `<div class="account-detail" data-account-detail="${a.id}"><p class="loading">계정 정보를 불러오는 중입니다.</p></div>
    <form class="form" data-form="account/adjust"><input type="hidden" name="id" value="${a.id}">
      <h3 class="sub-title">잔액 수동 조정</h3>
      <div class="two">${select('지갑', 'wallet', wallets.map(w => [w, walletNames[w]]))}${field('조정 금액', 'amount', 'text', 'required inputmode="numeric" pattern="-?[0-9]+" placeholder="지급 5000 · 차감 -5000"')}</div>
      ${field('조정 사유', 'reason', 'text', 'required minlength="2" maxlength="100" placeholder="예) 이벤트 보상, 오지급 회수"')}
      <p class="form-hint">조정 내역은 원장과 운영 기록에 남고, 해당 계정에 알림이 갑니다.</p>${btn('잔액 조정', 'type="submit"', 'quiet small')}</form>` : ''}
    <form class="form form-separated" data-form="account/update">${hidden('reset_password')}
      ${field('임시 비밀번호로 재설정', 'password', 'password', 'required minlength="10" maxlength="128" autocomplete="new-password" placeholder="영문과 숫자를 함께 10자 이상"')}
      <p class="form-hint">재설정하면 기존 로그인이 모두 끊기고, 다음 로그인 때 비밀번호를 바꾸도록 안내합니다.</p>${btn('비밀번호 재설정', 'type="submit"', 'quiet small')}</form>
    ${admin ? `<form class="form form-separated" data-form="account/update">${hidden('rename')}${field('표시 이름', 'name', 'text', `required maxlength="60" value="${esc(a.name)}"`)}${btn('이름 저장', 'type="submit"', 'quiet small')}</form>` : ''}
    ${admin && a.role === 'agency' ? `<form class="form form-separated" data-form="account/update">${hidden('parent')}${select('소속 실행사', 'parent_id', [['', '소속 없음'], ...operators.map(o => [o.id, o.name])])}${btn('소속 저장', 'type="submit"', 'quiet small')}</form>` : ''}
    <form class="form form-separated" data-form="account/update">${hidden(a.status === 'suspended' ? 'activate' : 'suspend')}
      <p>${a.status === 'suspended' ? '정지를 해제하면 다시 로그인할 수 있습니다.' : '이용을 정지하면 즉시 로그아웃되고 로그인할 수 없습니다. 거래 기록은 그대로 보관됩니다.'}</p>
      ${btn(a.status === 'suspended' ? '정지 해제' : '이용 정지', 'type="submit"', a.status === 'suspended' ? 'primary small' : 'danger small')}</form>`);
  const parent = dialog.querySelector('select[name="parent_id"]');
  if (parent) parent.value = a.parent_id ? String(a.parent_id) : '';
  if (admin) loadAccountDetail(a.id);
}

async function loadAccountDetail(id) {
  const slot = dialog.querySelector(`[data-account-detail="${id}"]`);
  if (!slot) return;
  try {
    const d = await api('/api/account/detail?id=' + id);
    const names = { credit: '광고 잔액', revenue: '실행사 수익', reward: '포인트' };
    const unit = wallet => wallet === 'reward' ? 'P' : '원';
    const stats = [
      ...d.wallets.map(w => [names[w], `${format(d.balances[w])}${unit(w)}`]),
      ...(d.account.role === 'participant' ? [['제출', `${format(d.submissions.approved + d.submissions.pending + d.submissions.rejected)}건`], ['승인·반려', `${format(d.submissions.approved)} · ${format(d.submissions.rejected)}`], ['출금 완료', `${format(d.paid)}P`]]
        : [['캠페인', `${format(d.campaigns.total || 0)}건 · 진행 ${format(d.campaigns.live || 0)}`], ['충전 승인', `${format(d.charged)}원`]])
    ];
    slot.innerHTML = `<dl class="settlement-summary">${[['가입일', day(d.account.created) || '−'], ['최근 로그인', dateTime(d.account.last_login) || '기록 없음'], ...(d.account.parent ? [['소속', esc(d.account.parent)]] : []), ...stats]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      ${d.ledger.length ? `<h3 class="sub-title">최근 거래</h3><div class="table-wrap"><table class="data-table compact"><thead><tr><th>일시</th><th>지갑</th><th>구분</th><th>내용</th><th class="num">금액</th></tr></thead><tbody>
        ${d.ledger.map(item => `<tr><td><small>${dateTime(item.created)}</small></td><td><small>${names[item.wallet]}</small></td><td><span class="kind-chip ${item.amount < 0 ? 'out' : 'in'}">${ledgerNames[item.kind] || esc(item.kind)}</span></td>
          <td>${esc(item.memo || item.ref)}</td><td class="num ${item.amount < 0 ? 'minus' : 'plus'}">${item.amount > 0 ? '+' : ''}${format(item.amount)}${unit(item.wallet)}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${d.recent.length ? `<h3 class="sub-title">최근 참여</h3>${d.recent.map(item => `<div class="record"><div><b>${esc(item.title)}</b><small>제출 #${item.id} · ${dateTime(item.created)}</small></div>${badge(item.status)}</div>`).join('')}` : ''}`;
    labelTables(slot);
  } catch (error) {
    slot.innerHTML = `<p class="notice">${esc(error.message)}</p>`;
  }
}

function partnerAdmin(params) {
  const operators = state.accounts.filter(a => a.role === 'operator');
  const filter = params.get('role') || '';
  const q = (params.get('q') || '').trim().toLowerCase();
  const list = state.accounts.filter(a => (!filter || (['suspended', 'withdrawn'].includes(filter) ? a.status === filter : a.role === filter)) && (!q || `${a.name} ${a.username}`.toLowerCase().includes(q)));
  return `<div class="dash-grid g-1-1"><section class="panel">${panelHead('실행사 수익률 설정', `하위 대행사의 충전 승인액 기준 · 최대 ${state.maxRate / 100}%. 개별 설정이 기본값보다 우선합니다.`)}
    <form class="form" data-form="rates">${field('전체 기본 수익률 (%)', 'rate', 'number', `required min="0" max="${state.maxRate / 100}" step="0.01" value="${state.defaultRate / 100}"`)}${btn('기본 수익률 저장', 'type="submit"')}</form>
    ${operators.length ? `<form class="form form-separated" data-form="rates">
      ${select('개별 실행사', 'operator_id', operators.map(a => [a.id, a.name + (a.rate === null ? ' · 기본값' : ` · ${a.rate / 100}%`)]))}
      ${field('개별 수익률 (%)', 'rate', 'number', `min="0" max="${state.maxRate / 100}" step="0.01" placeholder="비우면 기본값을 사용합니다"`)}
      ${btn('개별 설정 저장', 'type="submit"')}</form>` : ''}</section>
    <section class="panel">${panelHead('새 계정 등록')}${accountForm(true)}</section></div>
    <section class="panel dash-block">${panelHead('등록 계정', `참여자 ${format(state.roleCounts.participant || 0)}명 포함 전체 ${format(sum(Object.values(state.roleCounts), v => v))}개`)}
      <form class="filter-bar" data-filter="partners"><label class="search">${icon('search')}<input name="q" type="search" value="${esc(params.get('q') || '')}" placeholder="이름, 아이디 검색"></label>
        <input type="hidden" name="role" value="${esc(filter)}">${btn('검색', 'type="submit"', 'primary small')}</form>
      <div class="tabs">${[['', '전체'], ['advertiser', '광고주'], ['agency', '대행사'], ['operator', '실행사'], ['participant', '참여자'], ['admin', '관리자'], ['suspended', '이용 정지'], ['withdrawn', '탈퇴']].map(([key, label]) => `<a href="/manage?tab=partners${key ? '&amp;role=' + key : ''}" class="${key === filter ? 'on' : ''}">${label}</a>`).join('')}</div>
      ${list.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>이름</th><th>아이디</th><th>유형</th><th>소속</th><th class="num">광고 잔액</th><th>수익률</th><th></th></tr></thead><tbody>
      ${list.map(a => `<tr><td><b>${esc(a.name)}</b> ${accountStatus(a)}</td><td><small>${esc(a.username)}</small></td><td><span class="status">${roleName[a.role]}</span></td><td>${esc(a.parent || '−')}</td>
        <td class="num">${partners.includes(a.role) ? format(a.credit) + '원' : '−'}</td><td>${a.role === 'operator' ? (a.rate === null ? `기본 ${state.defaultRate / 100}%` : `${a.rate / 100}%`) : '−'}</td>
        <td class="row-actions">${a.role === 'admin' ? '' : manageButton(a)}</td></tr>`).join('')}
      </tbody></table></div>` : empty('조건에 맞는 계정이 없어요.')}${state.demo ? '<p class="panel-note">데모 참여자 180명은 목록에서 생략하고 수만 표시합니다. 테스트 계정은 변경할 수 없습니다.</p>' : ''}</section>`;
}
const partners = ['advertiser', 'agency', 'operator'];

function agencyTable(limit, manage = false) {
  const list = state.agencies.slice(0, limit);
  if (!list.length) return empty('등록한 대행사가 없어요.');
  return `<div class="table-wrap"><table class="data-table compact"><thead><tr><th>대행사</th><th class="num">충전 승인</th><th class="num">내 수익</th><th class="num">캠페인</th><th>최근 충전</th>${manage ? '<th></th>' : ''}</tr></thead><tbody>
    ${list.map(a => `<tr><td><b>${esc(a.name)}</b> ${accountStatus(a)}<small>${esc(a.username)}${a.pendingCharges ? ` · 충전 대기 ${a.pendingCharges}건` : ''}</small></td><td class="num">${format(a.charged)}원</td>
      <td class="num plus">+${format(a.commission)}원</td><td class="num">${format(a.activeCampaigns)}<small>/${format(a.campaigns)}</small></td><td><small>${a.lastCharge ? day(a.lastCharge) : '−'}</small></td>
      ${manage ? `<td class="row-actions">${manageButton(a)}</td>` : ''}</tr>`).join('')}
  </tbody></table></div>`;
}

function agencies() {
  return `<div class="summary-strip">${[['소속 대행사', `${format(state.agencies.length)}곳`], ['대행사 충전 승인', `${format(sum(state.agencies, 'charged'))}원`],
      ['누적 수익', `${format(sum(state.agencies, 'commission'))}원`], ['진행 중 캠페인', `${format(sum(state.agencies, 'activeCampaigns'))}건`]]
    .map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('')}</div>
    <div class="dash-grid g-2-1"><section class="panel">${panelHead('대행사별 실적', '관리 버튼으로 비밀번호 재설정과 이용 정지를 할 수 있어요.')}${agencyTable(100, true)}</section>
    <section class="panel">${panelHead('하위 대행사 등록', '생성한 대행사는 이 실행사에 연결됩니다.')}${accountForm(false)}</section></div>
    <section class="panel dash-block">${panelHead('하위 대행사 캠페인', '캠페인명을 누르면 상세 리포트를 볼 수 있어요.')}${campaignTable(state.agencyCampaigns, { owner: true, limit: 50 })}</section>`;
}

function payoutPanel(wallet) {
  const unit = wallet === 'reward' ? 'P' : '원';
  const min = state.payoutMinimum[wallet];
  const available = state.balances[wallet];
  return `<section class="panel payout-panel">${panelHead(wallet === 'reward' ? '포인트 출금 신청' : '수익 출금 신청', `${format(min)}${unit}부터 신청할 수 있어요. 운영팀 확인 후 지급되며, 반려되면 금액이 돌아옵니다.`)}
    ${available >= min ? `<form class="form" data-form="payout">
      ${field(`출금 금액 (${unit})`, 'amount', 'number', `required min="${min}" max="${Math.min(available, 10000000)}" step="1" value="${Math.min(available, 10000000)}"`)}
      ${field('받을 계좌', 'destination', 'text', 'required minlength="5" maxlength="120" placeholder="예) 국민은행 123456-78-901234 홍길동" autocomplete="off"')}
      ${btn('출금 신청', 'type="submit"')}</form>` : `<p class="notice">출금 가능 금액이 ${format(available)}${unit}이에요. ${format(min - available)}${unit} 더 모으면 신청할 수 있어요.</p>`}
    ${state.demo ? '<p class="form-hint">테스트 환경에서는 실제로 지급되지 않습니다.</p>' : ''}
    <h3 class="sub-title">출금 신청 내역</h3>${payoutTable(state.payouts || [], false)}</section>`;
}

function payoutTable(list, admin) {
  if (!list.length) return empty('출금 신청 내역이 없어요.');
  return `<div class="table-wrap"><table class="data-table compact"><thead><tr><th>번호</th><th>신청일</th>${admin ? '<th>신청 계정</th>' : ''}<th class="num">금액</th><th>받을 계좌</th><th>상태</th><th></th></tr></thead><tbody>
    ${list.map(p => `<tr><td>#${p.id}</td><td><small>${dateTime(p.created)}</small></td>${admin ? `<td>${esc(p.owner)}<small>${roleName[p.ownerRole] || ''}</small></td>` : ''}
      <td class="num">${format(p.amount)}${p.wallet === 'reward' ? 'P' : '원'}</td><td><small>${esc(p.destination)}</small></td><td>${badge(p.status)}${p.reason ? `<small>${esc(p.reason)}</small>` : ''}</td>
      <td class="row-actions">${p.status !== 'pending' ? '' : admin ? decision('payout/decision', p.id, 'approve', '지급 완료') + decision('payout/decision', p.id, 'reject') : decision('payout/cancel', p.id, 'cancel', '신청 취소')}</td></tr>`).join('')}
  </tbody></table></div>`;
}

function revenue(params) {
  const month = state.revenueTrend.filter(row => monthOf(row.day) === monthOf(state.date));
  return `<section class="dash-hero"><div class="dash-hero-main"><span class="eyebrow">PARTNER REVENUE</span><h2>대행사 충전 수익</h2>
      <div class="hero-balance"><span>출금 가능 수익</span><strong>${format(state.balances.revenue)}<small> 원</small></strong></div></div>
    <dl class="hero-side"><div><dt>이번 달 수익</dt><dd>${format(sum(month, 'total'))}원</dd></div><div><dt>적용 수익률</dt><dd>${state.rate / 100}%</dd></div>
      <div><dt>누적 수익</dt><dd>${format(sum(state.agencies, 'commission'))}원</dd></div><div><dt>소속 대행사</dt><dd>${format(state.agencies.length)}곳</dd></div></dl></section>
    <div class="dash-grid g-1-1"><section class="panel">${panelHead('일별 수익', '최근 31일 · 충전 승인일 기준')}${barChart(state.revenueTrend, [{ key: 'total', label: '수익', cls: 'c2' }], { unit: '원', label: '일별 수익', height: 210 })}</section>
    ${payoutPanel('revenue')}</div>
    ${asyncSlot('ledger', new URLSearchParams({ tab: 'revenue', wallet: 'revenue', title: '수익 원장', page: params.get('page') || '1' }))}`;
}

function payoutsAdmin(params) {
  const status = params.get('status') || 'all';
  const list = state.payouts.filter(p => status === 'all' || p.status === status);
  const pending = state.payouts.filter(p => p.status === 'pending');
  return `<div class="summary-strip">${[['지급 대기', `${format(pending.length)}건`], ['대기 포인트', `${format(sum(pending.filter(p => p.wallet === 'reward'), 'amount'))}P`],
      ['대기 수익 출금', `${format(sum(pending.filter(p => p.wallet === 'revenue'), 'amount'))}원`], ['표시 범위', '최근 100건']].map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('')}</div>
    <section class="panel dash-block">${panelHead('출금 신청', '지급을 마친 뒤 ‘지급 완료’를 누르세요. 반려하면 금액이 신청자에게 돌아갑니다.', `<a class="btn quiet small" href="/api/export?type=payouts" download>${icon('download')} CSV 내려받기</a>`)}
    <div class="tabs">${[['all', '전체'], ['pending', '대기'], ['approved', '지급 완료'], ['rejected', '반려'], ['canceled', '취소']].map(([key, label]) => `<a href="/manage?tab=payouts&amp;status=${key}" class="${key === status ? 'on' : ''}">${label} <span class="count">${format(key === 'all' ? state.payouts.length : state.payouts.filter(p => p.status === key).length)}</span></a>`).join('')}</div>
    ${payoutTable(list, true)}</section>`;
}

/* ---------- 관리자 운영 ---------- */
function submissions(params) {
  return asyncSlot('submissions', params);
}

asyncViews.submissions = async params => {
  const status = params.get('status') || '';
  const kind = params.get('kind') || '';
  const data = await api('/api/submissions?' + new URLSearchParams({ status: status === 'all' ? '' : status, kind, q: params.get('q') || '', page: params.get('page') || '1' }));
  const link = changes => {
    const next = new URLSearchParams({ tab: 'submissions', status, kind, q: params.get('q') || '', ...changes });
    for (const [k, v] of [...next]) if (!v || v === 'all') next.delete(k);
    return '/manage?' + next.toString().replaceAll('&', '&amp;');
  };
  const pending = data.items.filter(item => item.status === 'pending');
  const pagePoints = sum(pending, 'reward');
  return `<div class="summary-strip">${[['검수 대기', `${format(data.counts.pending)}건`], ['대기 보상 합계', `${format(data.pendingReward)}P`],
      ['승인', `${format(data.counts.approved)}건`], ['반려', `${format(data.counts.rejected)}건`]].map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('')}</div>
    <form class="filter-bar" data-filter="submissions"><label class="search">${icon('search')}<input name="q" type="search" value="${esc(params.get('q') || '')}" placeholder="캠페인명, 참여자, 답변 내용 검색"></label>
      <input type="hidden" name="status" value="${esc(status)}"><input type="hidden" name="kind" value="${esc(kind)}">${btn('검색', 'type="submit"', 'primary small')}
      ${params.get('q') ? `<a class="btn quiet small" href="${link({ q: '', page: '' })}">초기화</a>` : ''}</form>
    <div class="toolbar"><div class="tabs">${[['all', '전체', data.counts.all], ['pending', '검수 대기', data.counts.pending], ['approved', '승인', data.counts.approved], ['rejected', '반려', data.counts.rejected]].map(([key, label, n]) => `<a href="${link({ status: key, page: '' })}" class="${key === (status || 'all') ? 'on' : ''}">${label} <span class="count">${format(n)}</span></a>`).join('')}</div>
      <div class="tabs">${[['', '전체 상품'], ...Object.entries(kinds)].map(([key, label]) => `<a href="${link({ kind: key, page: '' })}" class="${key === kind ? 'on' : ''}">${label}</a>`).join('')}</div>
      ${pending.length > 1 ? btn(`이 페이지 대기 ${format(pending.length)}건 일괄 승인`, `type="button" data-bulk-approve="${pending.map(item => item.id).join(',')}" data-points="${pagePoints}"`, 'primary small') : ''}</div>
    <div class="order-grid">${data.items.map(item => `<article class="panel order-card"><div class="row-top"><span class="eyebrow">제출 #${item.id} · ${dateTime(item.created)}</span>${badge(item.status)}</div>
      <h3>${esc(item.title)}</h3><p>${esc(item.name)} · ${kinds[item.kind]} · 보상 ${format(item.reward)}P</p>
      <p class="review-question"><small>질문</small> ${esc(item.prompt)}</p><blockquote>${esc(item.response)}</blockquote>
      <div class="review-signals"><span>${format([...item.response].length)}자</span><span>참여자 이력 승인 ${format(item.userApproved)} · 반려 ${format(item.userRejected)}</span>
        ${item.joined ? `<span>가입 ${day(item.joined)}</span>` : ''}${item.kind === 'survey' && item.dupes ? `<span class="flag">같은 답변 ${format(item.dupes)}건</span>` : ''}
        ${item.userRejected >= 3 && item.userRejected > item.userApproved ? '<span class="flag">반려 많음</span>' : ''}</div>
      ${item.reason ? `<p class="order-note">${esc(item.reason)}</p>` : ''}
      ${item.status === 'pending' ? `<div class="actions">${decision('mission/review', item.id, 'approve')}${decision('mission/review', item.id, 'reject')}</div>` : ''}</article>`).join('') || empty('조건에 맞는 제출이 없어요.')}</div>
    ${pager(data.page, data.pages, link({ page: '' }))}`;
};

const audiences = { all: '전체', business: '광고 계정', participant: '참여자' };
const noticeForm = (path, item = {}) => `<form class="form" data-form="${path}">${item.id ? `<input type="hidden" name="id" value="${item.id}">` : ''}
  ${field('제목', 'title', 'text', `required minlength="2" maxlength="80" value="${esc(item.title || '')}"`)}
  ${textarea('내용', 'body', 'required minlength="2" maxlength="1000" rows="5"')}
  ${select('공지 대상', 'audience', Object.entries(audiences))}
  <label class="check"><input type="checkbox" name="pinned" value="1"${item.pinned ? ' checked' : ''}> 상단 고정</label>${btn(item.id ? '수정 내용 저장' : '공지 등록', 'type="submit"')}</form>`;

function notices() {
  return `<div class="dash-grid g-1-1"><section class="panel">${panelHead('공지 등록', '대상별로 대시보드와 상단 종 아이콘에 표시됩니다.')}${noticeForm('notice')}</section>
    <section class="panel">${panelHead('등록된 공지', `${format(state.notices.length)}건`)}${state.notices.map(item => `<article class="notice-row"><div class="row-top"><span class="eyebrow">${audiences[item.audience]} · ${day(item.created)}${item.updated ? ' · 수정됨' : ''}</span>${item.pinned ? '<span class="pin">고정</span>' : ''}</div>
      <h3>${esc(item.title)}</h3><p>${esc(item.body)}</p><div class="actions">${btn('수정', `type="button" data-edit-notice="${item.id}"`, 'quiet small')}
      <form data-form="notice/delete"><input type="hidden" name="id" value="${item.id}">${btn('삭제', 'type="submit"', 'quiet small')}</form></div></article>`).join('') || empty('등록된 공지가 없어요.')}</section></div>`;
}

function openEditNotice(id) {
  const item = state.notices.find(notice => notice.id === id);
  if (!item) return;
  modal('NOTICE', '공지 수정', noticeForm('notice/update', item));
  const form = dialog.querySelector('form[data-form]');
  form.elements.body.value = item.body;
  form.elements.audience.value = item.audience;
}

function design() {
  return `<section class="panel"><h2>PC 화면 양옆 배경</h2><p class="muted">기존 감성 배경 5종과 광고 테마 5종 중 선택하세요. 선택한 배경은 애즈폼 PC 화면에 즉시 적용됩니다.</p>
    <div class="background-grid">${Object.entries(backgrounds).map(([key, name]) => `<button type="button" data-background="${key}" aria-pressed="${state.background === key}">
    <img src="/assets/wallpaper-${key}.webp" alt="" loading="lazy"><span>${name}</span>${state.background === key ? icon('check') : ''}</button>`).join('')}</div></section>`;
}

function inquiries(params) {
  const filter = params.get('status') || 'all';
  const list = state.inquiries.filter(item => filter === 'all' || (filter === 'open' ? !item.reply : Boolean(item.reply)));
  return `<section><div class="section-head"><h2>접수된 문의</h2><span class="status pending">${format(state.adminCounts.unreadInquiries)}건 미확인</span></div>
    <div class="tabs">${[['all', '전체'], ['open', '답변 전'], ['answered', '답변 완료']].map(([key, label]) => `<a href="/manage?tab=inquiries&amp;status=${key}" class="${key === filter ? 'on' : ''}">${label}</a>`).join('')}</div>
    <div class="order-grid">${list.map(item => `<article class="panel order-card"><div class="row-top"><span class="eyebrow">문의 #${item.id} · ${day(item.created)}</span>
      <span class="status ${item.reply ? 'approved' : item.reviewed ? 'paused' : 'pending'}">${item.reply ? '답변 완료' : item.reviewed ? '확인' : '미확인'}</span></div>
      <h3>${esc(item.subject)}</h3><p>${esc(item.sender || '비회원')}${item.email ? ' · ' + esc(item.email) : ''}</p>
      <blockquote>${esc(item.message)}</blockquote>
      ${item.reply ? `<div class="reply"><span class="eyebrow">답변 · ${dateTime(item.replied)}</span><p>${esc(item.reply)}</p></div>` : ''}
      <form class="form" data-form="inquiry/reply"><input type="hidden" name="id" value="${item.id}">${textarea(item.reply ? '답변 고치기' : '답변 작성', 'reply', `required minlength="2" maxlength="2000" rows="3" data-prefill="${esc(item.reply || '')}"`)}
        <p class="form-hint">${item.sender ? '회원은 프로필의 ‘내 문의’에서 답변을 봅니다.' : item.email ? '비회원 문의입니다. 답변을 저장한 뒤 위 이메일로도 보내 주세요.' : '연락처가 없는 문의입니다.'}</p>
        <div class="actions">${btn('답변 저장', 'type="submit"', 'primary small')}</div></form>
      ${item.reviewed ? '' : `<form class="actions" data-form="inquiry/review"><input type="hidden" name="id" value="${item.id}">${btn('답변 없이 확인 처리', 'type="submit"', 'quiet small')}</form>`}</article>`).join('') || empty('접수된 문의가 없어요.')}</div></section>`;
}

function auditView(params) {
  return asyncSlot('audit', params);
}

asyncViews.audit = async params => {
  const data = await api('/api/audit?' + new URLSearchParams({ q: params.get('q') || '', page: params.get('page') || '1' }));
  const base = `/manage?tab=audit${params.get('q') ? '&amp;q=' + encodeURIComponent(params.get('q')) : ''}`;
  return `<form class="filter-bar" data-filter="audit"><label class="search">${icon('search')}<input name="q" type="search" value="${esc(params.get('q') || '')}" placeholder="작업명, 처리자, 번호, 내용 검색"></label>${btn('검색', 'type="submit"', 'primary small')}
      ${params.get('q') ? '<a class="btn quiet small" href="/manage?tab=audit">초기화</a>' : ''}</form>
    <section class="panel dash-block">${panelHead('운영 기록', `${format(data.total)}건`)}
    ${data.items.length ? `<div class="table-wrap"><table class="data-table compact"><thead><tr><th>일시</th><th>작업</th><th>대상</th><th>처리자</th><th>내용</th></tr></thead><tbody>
      ${data.items.map(item => `<tr><td><small>${dateTime(item.created)}</small></td><td><b>${esc(item.action)}</b></td><td>#${esc(item.subject)}</td><td>${esc(item.name || '시스템')}</td><td><small>${esc(statuses[item.detail] || roleName[item.detail] || item.detail || '−')}</small></td></tr>`).join('')}
    </tbody></table></div>` : empty('기록이 없어요.')}${pager(data.page, data.pages, base)}</section>`;
};

function participantHistory(params) {
  const status = params.get('status') || 'all';
  const items = state.submissions.filter(item => status === 'all' || item.status === status);
  return `<section class="panel"><div class="tabs">${[['all', '전체'], ['pending', '심사 대기'], ['approved', '승인'], ['rejected', '반려']].map(([key, label]) => `<a class="${status === key ? 'on' : ''}" href="/manage?tab=history&amp;status=${key}">${label} <span class="count">${format(key === 'all' ? state.submissions.length : state.submissions.filter(s => s.status === key).length)}</span></a>`).join('')}</div>
    ${items.length ? participationList(items) : empty('해당 상태의 참여 내역이 없어요.')}</section>`;
}

function participantRewards(params) {
  return `<section class="dash-hero participant"><div class="dash-hero-main"><span class="eyebrow">MY REWARDS</span><h2>보유 포인트</h2>
      <div class="hero-balance"><strong>${format(state.balances.reward)}<small> P</small></strong></div><div class="hero-actions"><a class="btn lime" href="/missions">미션 둘러보기 ${icon('arrow')}</a></div></div>
    <dl class="hero-side"><div><dt>최근 14일 적립</dt><dd>${format(sum(state.trend, 'total'))}P</dd></div><div><dt>승인 미션</dt><dd>${format(state.submissions.filter(s => s.status === 'approved').length)}건</dd></div></dl></section>
    ${payoutPanel('reward')}
    ${asyncSlot('ledger', new URLSearchParams({ tab: 'rewards', wallet: 'reward', title: '포인트 적립·사용 기록', page: params.get('page') || '1' }))}`;
}

function profileImageEditor(user) {
  return `<div class="profile-image-editor">
    ${profileAvatar(user, 'avatar-large')}
    <div><h3>프로필 이미지</h3><p class="muted">${user.avatar?.version ? '등록한 사진을 사용 중입니다.' : '기본 캐릭터를 사용 중입니다.'}</p></div>
  </div>
  <form class="form profile-image-form" data-avatar-upload>
    ${field('이미지 선택', 'photo', 'file', 'accept="image/jpeg,image/png,image/webp" aria-describedby="profile-image-hint" required')}
    <p class="form-hint" id="profile-image-hint">JPG, PNG, WebP · 최대 10MB. 사진 중앙을 정사각형으로 맞춥니다.</p>
    <div class="actions">${btn('프로필 이미지 저장', 'type="submit"')}
    ${user.avatar?.version ? btn('기본 캐릭터 사용', 'type="button" data-reset-avatar', 'quiet') : ''}</div>
  </form>`;
}

async function avatarPhoto(file) {
  if (!file?.size || !avatarFileTypes.includes(file.type)) throw new Error('JPG, PNG, WebP 이미지를 선택해 주세요.');
  if (file.size > avatarFileLimit) throw new Error('이미지는 10MB 이하로 선택해 주세요.');
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('이미지를 열 수 없습니다. 다른 파일을 선택해 주세요.');
  });
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    context.fillStyle = '#f7f9f6';
    context.fillRect(0, 0, 256, 256);
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
  } finally {
    bitmap.close();
  }
  const photo = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!photo) throw new Error('프로필 이미지를 만들 수 없습니다.');
  return photo;
}

async function saveAvatar(file, userId) {
  const photo = await avatarPhoto(file);
  const response = await fetch('/api/profile/avatar?account=' + userId, {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg' },
    body: photo
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || '프로필 이미지를 저장하지 못했습니다.');
  }
  await reload();
  showToast('프로필 이미지를 저장했습니다.');
}

function consoleProfile(user) {
  const inquiries = state.myInquiries || [];
  return `<div class="dash-grid g-1-1"><section class="panel console-profile"><h2>${esc(user.name)}</h2>${profileImageEditor(user)}
    <dl><div><dt>계정 유형</dt><dd>${roleName[user.role]}</dd></div><div><dt>로그인 아이디</dt><dd>${esc(user.username)}</dd></div>
      ${user.role === 'participant' ? `<div><dt>보유 포인트</dt><dd>${format(state.balances.reward)}P</dd></div>` : user.role !== 'admin' ? `<div><dt>광고 잔액</dt><dd>${format(state.balances.credit)}원</dd></div>` : ''}</dl>
    <div class="actions">${btn('로그아웃', 'type="button" data-logout', 'quiet')}
      ${state.demo ? '<a class="btn primary" href="/login">테스트 계정 전환</a>' : ''}</div></section>
    <section class="panel">${panelHead('계정 설정')}
      ${user.is_demo ? '<p class="notice">테스트 계정은 이름과 비밀번호를 바꿀 수 없습니다.</p>' : `
      <form class="form" data-form="profile">${field('표시 이름', 'name', 'text', `required maxlength="60" value="${esc(user.name)}" autocomplete="name"`)}${btn('이름 저장', 'type="submit"', 'quiet small')}</form>
      <form class="form form-separated" data-form="password" id="password-form">
        <input type="text" name="username" value="${esc(user.username)}" autocomplete="username" hidden>
        ${field('현재 비밀번호', 'current', 'password', 'required maxlength="128" autocomplete="current-password"')}
        ${field('새 비밀번호', 'password', 'password', 'required minlength="10" maxlength="128" autocomplete="new-password" placeholder="영문과 숫자를 함께 10자 이상"')}
        ${field('새 비밀번호 확인', 'confirm', 'password', 'required minlength="10" maxlength="128" autocomplete="new-password"')}
        <p class="form-hint">변경하면 다른 기기의 로그인은 모두 끊어집니다.</p>${btn('비밀번호 변경', 'type="submit"')}</form>`}
    </section></div>
    ${user.role === 'admin' ? '' : `<section class="panel dash-block" id="my-inquiries" tabindex="-1">${panelHead('내 문의', `${format(inquiries.length)}건`, btn('새 문의', 'type="button" data-support', 'quiet small'))}
      ${inquiries.map(item => `<article class="notice-row"><div class="row-top"><span class="eyebrow">문의 #${item.id} · ${day(item.created)}</span><span class="status ${item.reply ? 'approved' : 'pending'}">${item.reply ? '답변 완료' : '답변 대기'}</span></div>
        <h3>${esc(item.subject)}</h3><p>${esc(item.message)}</p>${item.reply ? `<div class="reply"><span class="eyebrow">애즈폼 운영팀 · ${dateTime(item.replied)}</span><p>${esc(item.reply)}</p></div>` : ''}</article>`).join('') || empty('남긴 문의가 없어요.')}</section>`}
    ${['participant', 'advertiser'].includes(user.role) && !user.is_demo ? `<section class="panel dash-block withdraw-panel">${panelHead('회원 탈퇴', '탈퇴하면 같은 계정으로 다시 로그인할 수 없어요.')}
      <details><summary>탈퇴 안내 보기</summary>
        <ul class="plain-list">${user.role === 'participant'
          ? `<li>보유 포인트 ${format(state.balances.reward)}P는 탈퇴와 함께 사라집니다. 5,000P 이상이면 먼저 출금을 신청해 주세요.</li><li>처리 중인 출금이 있으면 탈퇴할 수 없어요.</li>`
          : `<li>진행 중이거나 심사 중인 캠페인은 먼저 종료·취소해 주세요.</li><li>광고 잔액이 남아 있으면 문의하기로 환불을 요청한 뒤 탈퇴할 수 있어요.</li><li>승인 전 충전 신청은 자동으로 취소됩니다.</li>`}
          <li>거래·정산 기록은 관련 법령에 따라 보관되며, 이름과 아이디는 지워집니다.</li></ul>
        <form class="form" data-form="account/withdraw">${field('비밀번호', 'password', 'password', 'required maxlength="128" autocomplete="current-password"')}
          ${field('확인을 위해 ‘탈퇴’를 입력하세요', 'confirm', 'text', 'required pattern="탈퇴" autocomplete="off"')}${btn('회원 탈퇴', 'type="submit"', 'danger small')}</form></details></section>` : ''}`;
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
  const requested = params.get('tab');
  const [tab, title] = pages.find(([key]) => key === requested) || pages[0];
  const missing = requested && requested !== tab;
  const badges = admin ? { orders: state.campaigns.filter(c => c.status === 'pending').length, submissions: state.adminCounts.pendingSubmissions,
    charges: state.charges.filter(c => c.status === 'pending').length, inquiries: state.adminCounts.unreadInquiries, payouts: state.adminCounts.pendingPayouts } : {};
  const views = { overview: () => overview(user), new: () => orderForm(params), orders: () => orders(params, admin), charges: () => charges(params, admin), ledger: () => ledgerView(params),
    partners: () => partnerAdmin(params), notices, design, inquiries: () => inquiries(params), agencies, revenue: () => revenue(params), submissions: () => submissions(params),
    history: () => participantHistory(params), rewards: () => participantRewards(params), profile: () => consoleProfile(user), payouts: () => payoutsAdmin(params), audit: () => auditView(params) };
  const banners = [
    missing ? `<p class="notice">${requested === 'new' ? '광고 주문은 광고주·대행사·실행사 계정에서 할 수 있어요.' : '이 계정에서 사용할 수 없는 메뉴라 대시보드를 보여 드려요.'}</p>` : '',
    user.must_change && tab !== 'profile' ? `<p class="notice warn">${icon('lock')} 운영팀이 만든 임시 비밀번호를 쓰고 있어요. <a href="/manage?tab=profile#password-form">비밀번호 변경하기</a></p>` : ''
  ].join('');
  const menuLink = ([key, label, glyph]) => `<a href="/manage?tab=${key}"${key === tab ? ' aria-current="page"' : ''}>${key === 'profile' ? profileAvatar(user, 'avatar-small') : icon(glyph)}<span>${label}</span>${badges[key] ? `<em class="nav-badge">${format(badges[key])}</em>` : ''}</a>`;
  const balanceLine = participant ? `${format(state.balances.reward)} P` : admin ? '' : `${format(state.balances.credit)}원`;
  return `<div class="console-frame">
    <div class="console-mobile-bar"><button type="button" class="icon-btn" data-console-menu aria-controls="console-sidebar" aria-expanded="false" aria-label="관리 메뉴 열기">${icon('menu')}</button>
      <strong>${title}</strong>${bellButton('mobile-bell')}<a class="console-mobile-profile" href="/manage?tab=profile" aria-label="프로필">${profileAvatar(user)}${roleName[user.role]}</a></div>
    <div class="console-backdrop" data-console-close hidden></div>
    <aside id="console-sidebar" class="console-sidebar">
      <div class="console-brand"><a class="logo" href="/manage" aria-label="애즈폼 대시보드">${brandMark}${wordmark}</a>
        <button type="button" class="icon-btn console-close" data-console-close aria-label="관리 메뉴 닫기">${icon('close')}</button></div>
      <div class="console-identity">${profileAvatar(user)}<div><strong>${esc(user.name)}</strong><small>${roleName[user.role]}${state.demo ? ' · 로컬 데모' : ''}</small></div></div>
      ${balanceLine ? `<a class="console-wallet" href="/manage?tab=${participant ? 'rewards' : 'ledger'}"><span>${participant ? '보유 포인트' : '광고 잔액'}</span><b>${balanceLine}</b></a>` : ''}
      <nav aria-label="관리 메뉴">${groups.map(([group, items]) => `<div class="console-nav-group"><span>${group}</span>${items.map(menuLink).join('')}</div>`).join('')}
      ${participant ? `<div class="console-nav-group"><a href="/missions">${icon('target')}<span>미션 찾기</span></a></div>` : ''}</nav>
      <nav class="console-bottom" aria-label="프로필과 메인 이동">${menuLink(profile)}<a href="/">${icon('home')}<span>메인으로</span></a></nav>
    </aside>
    <div class="console-workspace"><div class="console-content">
      <header class="console-head"><div><span class="eyebrow">${admin ? 'ADSFORM STUDIO' : participant ? 'ADSFORM REWARDS' : 'ADSFORM BUSINESS'}</span><h1>${title}</h1></div>
        <div class="console-head-side">${tab !== 'new' && !admin && !participant ? `<a class="btn primary small" href="/manage?tab=new">${icon('target')} 새 주문</a>` : ''}${bellButton()}<time datetime="${state.date}">${day(state.date)}</time></div></header>
      <div class="console-view">${banners}${views[tab]()}</div>
    </div></div>
  </div>`;
}

function render() {
  if (!state) return;
  document.body.className = `theme-${state.background}${location.pathname === '/manage' && state.user ? ' console-mode' : ''}`;
  nav();
  const params = new URLSearchParams(location.search);
  if (location.pathname === '/account') history.replaceState({}, '', state.user ? '/manage?tab=profile' : '/login');
  if (['/login', '/signup'].includes(location.pathname) && state.user && !state.demo) history.replaceState({}, '', '/manage');
  document.body.classList.toggle('console-mode', location.pathname === '/manage' && Boolean(state.user));
  const pages = { '/': home, '/missions': missions, '/login': login, '/signup': signup, '/terms': terms, '/privacy': privacy, '/manage': manage };
  $('#main').innerHTML = (pages[location.pathname] || home)(params);
  labelTables($('#main'));
  hydrate();
  scheduleBannerRotation();
  const campaign = $('[data-form="campaign"]');
  if (campaign) {
    const copy = state.campaigns?.find(item => String(item.id) === params.get('copy'));
    if (copy) {
      campaign.elements.details.value = copy.details;
      if (copy.answer !== null) campaign.elements.answer.value = String(copy.answer + 1);
    }
    updateOrderForm(campaign);
  }
  const charge = $('[data-form="charge"]');
  if (charge) updateChargeForm(charge);
  for (const area of document.querySelectorAll('textarea[data-prefill]')) area.value = area.dataset.prefill;
}

function afterLogin(user) {
  const next = new URLSearchParams(location.search).get('next');
  if (user.must_change) return '/manage?tab=profile';
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
  if (link && (link.hasAttribute('download') || link.getAttribute('href').startsWith('/api/'))) return;
  if (link && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    if (link.target === '_blank') return window.open(link.href, '_blank', 'noopener');
    let href = link.getAttribute('href');
    if (href.startsWith('/manage') && !state?.user) href = href.includes('tab=new') ? '/login?next=order' : '/login';
    if (href.includes('tab=new') && ['participant', 'admin'].includes(state?.user?.role)) {
      return showToast('광고 주문은 광고주·대행사·실행사 계정에서 할 수 있어요.');
    }
    go(href);
    return;
  }
  const button = event.target.closest('button');
  if (!button || !state) return;
  const d = button.dataset;
  if ('consoleClose' in d) setConsoleMenu(false);
  if ('consoleMenu' in d) setConsoleMenu(button.getAttribute('aria-expanded') !== 'true');
  if ('slide' in d || 'nextBanner' in d) {
    showBanner('slide' in d ? Number(d.slide) : nextSlide());
    scheduleBannerRotation();
    return;
  }
  if ('toggleBanner' in d) {
    bannerPaused = !bannerPaused;
    button.setAttribute('aria-label', bannerToggleLabel());
    button.innerHTML = icon(bannerPaused ? 'play' : 'pause');
    scheduleBannerRotation();
    return;
  }
  if ('resetAvatar' in d) {
    act(button, async () => {
      await api('/api/profile/avatar/reset', { account: state.user.id });
      await reload();
      showToast('기본 캐릭터로 돌아갔습니다.');
    });
    return;
  }
  if ('mission' in d) act(button, async () => {
    await reload();
    openMission(Number(d.mission));
  });
  if ('order' in d) openOrder(Number(d.order));
  if ('editOrder' in d) openEditOrder(Number(d.editOrder));
  if ('extendOrder' in d) openExtend(Number(d.extendOrder));
  if ('editNotice' in d) openEditNotice(Number(d.editNotice));
  if ('account' in d) openAccount(Number(d.account));
  if ('notices' in d) openNotices();
  if ('amount' in d) {
    const input = button.form.elements.amount;
    input.value = Number(d.amount) ? Math.min(10000000, Number(input.value || 0) + Number(d.amount)) : 0;
    updateChargeForm(button.form);
  }
  if ('span' in d) {
    const form = button.closest('form');
    const start = form.elements.start.value || state.date;
    form.elements.end.value = new Date(Date.parse(start) + (Number(d.span) - 1) * 86_400_000).toISOString().slice(0, 10);
    updateOrderForm(form);
  }
  if ('bulkApprove' in d) {
    const count = d.bulkApprove.split(',').length;
    modal('ADSFORM STUDIO', '일괄 승인 확인', `<p>검수 대기 <b>${format(count)}건</b>을 승인하고 참여자에게 모두 <b>${format(Number(d.points))}P</b>를 지급합니다. 승인 후에는 되돌릴 수 없어요.</p>
      <form class="form" data-form="mission/review/bulk"><input type="hidden" name="ids" value="${esc(d.bulkApprove)}">${btn(`${format(count)}건 승인`, 'type="submit"')}</form>`);
  }
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
    const reason = d.action === 'reject';
    const label = d.label || actions[d.action];
    const explanation = {
      'campaign/decision:pause': '참여자에게 열려 있던 자리는 해제됩니다. 이미 제출한 응답은 검수할 수 있습니다.',
      'campaign/decision:close': '미제출 예약을 해제하고 승인 완료 건 기준으로 미집행 예산을 반환합니다. 검수 중인 응답이 있으면 종료할 수 없어요.',
      'campaign/decision:cancel': '심사 전 주문을 취소하고 배정된 예산을 모두 잔액으로 돌려드립니다.',
      'campaign/decision:resume': '캠페인을 다시 열어 참여를 받습니다.',
      'charge/decision:reject': '반려 사유는 신청자의 충전 내역에 표시됩니다.',
      'charge/cancel:cancel': '승인 전 충전 신청을 취소합니다.',
      'payout/decision:approve': '계좌로 지급을 마친 경우에만 지급 완료로 처리하세요.',
      'payout/decision:reject': '반려하면 신청 금액이 신청자에게 돌아갑니다. 사유는 신청자에게 표시됩니다.',
      'payout/cancel:cancel': '출금 신청을 취소하고 금액을 돌려받습니다.',
      'mission/review:reject': '반려 사유는 참여자의 참여 내역에 표시됩니다.'
    }[`${d.decision}:${d.action}`];
    modal('ADSFORM', label + ' 확인', `<p>${explanation || `선택한 항목을 ${label} 처리합니다.`}</p>
      <form data-form="${esc(d.decision)}" class="form"><input type="hidden" name="id" value="${esc(d.id)}"><input type="hidden" name="action" value="${esc(d.action)}">
      ${reason ? textarea('반려 사유', 'reason', 'required maxlength="200" rows="3"') : ''}${btn(label + ' 처리', 'type="submit"', d.action === 'reject' || d.action === 'cancel' ? 'danger' : 'primary')}</form>`);
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !dialog.open && $('.console-frame.menu-open')) setConsoleMenu(false);
});

document.addEventListener('input', event => {
  const form = event.target.form;
  if (form?.dataset.form === 'campaign') updateOrderForm(form);
  if (form?.dataset.form === 'campaign/edit') syncAnswerOptions(form);
  if (form?.dataset.form === 'campaign/extend') updateExtendForm(form);
  if (form?.dataset.form === 'charge') updateChargeForm(form);
  if (form?.dataset.form === 'account' && event.target.name === 'role') {
    const parent = form.querySelector('.parent-field');
    parent.hidden = event.target.value !== 'agency';
  }
});

document.addEventListener('submit', event => {
  const form = event.target;
  if (form.hasAttribute('data-avatar-upload')) {
    event.preventDefault();
    const button = event.submitter || form.querySelector('button[type="submit"]');
    const file = form.elements.photo.files[0];
    const userId = state.user.id;
    act(button, () => saveAvatar(file, userId));
    return;
  }
  if (form.dataset.filter) {
    event.preventDefault();
    const query = new URLSearchParams({ tab: form.dataset.filter });
    for (const [key, value] of new FormData(form)) if (String(value).trim()) query.set(key, String(value).trim());
    go('/manage?' + query);
    return;
  }
  const path = form.dataset.form;
  if (!path) return;
  event.preventDefault();
  const button = event.submitter || form.querySelector('button[type="submit"]');
  act(button, async () => {
    const data = Object.fromEntries(new FormData(form));
    if (['campaign', 'charge', 'inquiry', 'payout'].includes(path)) {
      form.dataset.key ||= crypto.randomUUID();
      data.key = form.dataset.key;
    }
    if (path === 'password' && data.password !== data.confirm) throw new Error('새 비밀번호 확인이 일치하지 않습니다.');
    if (path === 'mission/review/bulk') data.ids = data.ids.split(',').map(Number);
    const result = await api('/api/' + path, data);
    if (path === 'mission/reserve') {
      await reload();
      openMission(Number(data.id));
      return;
    }
    if (dialog.open) dialog.close();
    if (path === 'account/withdraw') {
      state = await api('/api/state');
      go('/');
      return showToast('탈퇴 처리했습니다. 그동안 이용해 주셔서 고마워요.');
    }
    if (path === 'login' || path === 'signup') {
      const next = path === 'signup' ? (result.user.role === 'participant' ? '/missions' : '/manage?tab=charges') : afterLogin(result.user);
      state = await api('/api/state');
      go(next);
    } else if (path !== 'inquiry') {
      await reload();
      if (path === 'campaign') go('/manage?tab=orders');
    }
    if (path === 'inquiry' && state.user) await reload();
    const messages = { campaign: '광고 주문을 접수했습니다.', charge: '충전을 신청했습니다.', account: '계정을 등록했습니다.', rates: '수익률 설정을 저장했습니다.', login: '로그인했습니다.',
      signup: '가입을 환영해요!', inquiry: `문의 #${result.id}을 접수했습니다.`, 'inquiry/review': '문의 확인 상태를 저장했습니다.', 'inquiry/reply': '답변을 저장했습니다.',
      'campaign/memo': '메모를 저장했습니다.', 'campaign/extend': result.extra ? `캠페인을 연장·증액했습니다. 추가 예산 ${format(result.extra)}원을 배정했어요.` : '캠페인 일정을 변경했습니다.',
      'account/adjust': '잔액을 조정했습니다.', 'campaign/edit': '주문 내용을 수정했습니다.', notice: '공지를 등록했습니다.', 'notice/update': '공지를 수정했습니다.', 'notice/delete': '공지를 삭제했습니다.',
      password: '비밀번호를 변경했습니다.', profile: '이름을 저장했습니다.', 'account/update': '계정 정보를 저장했습니다.', payout: '출금을 신청했습니다.',
      'payout/cancel': '출금 신청을 취소했습니다.', 'payout/decision': '출금 신청을 처리했습니다.', 'charge/cancel': '충전 신청을 취소했습니다.', 'charge/decision': '충전 요청을 처리했습니다.',
      'campaign/decision': '캠페인 상태를 변경했습니다.', 'mission/review': '검수 결과를 저장했습니다.', 'mission/review/bulk': `${format(result.done || 0)}건을 승인했습니다.` };
    const actionMessages = { 'campaign/decision:cancel': '주문을 취소했습니다. 예산은 잔액으로 돌아갔어요.', 'campaign/decision:close': '캠페인을 종료하고 정산했습니다.',
      'campaign/decision:pause': '캠페인을 일시중지했습니다.', 'campaign/decision:resume': '캠페인을 다시 시작했습니다.', 'account/update:suspend': '이용을 정지했습니다.',
      'account/update:activate': '정지를 해제했습니다.', 'account/update:reset_password': '임시 비밀번호로 재설정했습니다.', 'payout/decision:approve': '지급 완료로 처리했습니다.',
      'payout/decision:reject': '출금 신청을 반려했습니다.', 'charge/decision:approve': '충전을 승인했습니다.', 'charge/decision:reject': '충전을 반려했습니다.' };
    if (actionMessages[`${path}:${data.action}`]) return showToast(actionMessages[`${path}:${data.action}`]);
    showToast(path === 'mission' ? ({ pending: '답변을 제출했습니다. 검수 후 결과를 확인하세요.', approved: '정답입니다. 포인트를 적립했어요!', rejected: '정답이 일치하지 않아 적립되지 않았습니다.' }[result.status]) : messages[path] || '처리했습니다.');
  });
});

addEventListener('popstate', () => {
  render();
  scrollToView(false);
});
document.addEventListener('visibilitychange', scheduleBannerRotation);
reload().then(() => scrollToView(false)).catch(error => {
  $('#main').textContent = error.message;
  showToast('서버 상태를 확인해 주세요.');
});
