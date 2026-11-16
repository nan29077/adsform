// 콘솔의 숏폼 배포 메뉴
//  · 최고관리자 : 숏폼 배포 관리(캠페인 심사·배포 검수·정산·작업 현황), 부업회원·채널 인증, 단가·정책
//  · 광고 계정  : 숏폼 캠페인 등록(예산 배정)·선정·시안 검토·성과 리포트·연장·증액
//  · 부업회원   : 부업 대시보드, 캠페인 찾기, 내 작업(시안·게시·성과), 내 SNS 채널, 수익·출금
export function setupShortformConsole(h) {
  const { api, esc, format, field, textarea, select, btn, empty, panelHead, icon, modal, dialog, dateTime, day, pager, showToast } = h;
  let admin = null;      // 관리자 화면 데이터
  let mine = null;       // 광고 계정 화면 데이터
  let me = null;         // 부업회원 화면 데이터
  let detail = null;     // 열려 있는 캠페인 상세
  let reopen = 0;        // 처리 후 다시 열 캠페인 상세 번호

  const label = () => h.label();
  const platformKeys = ['youtube', 'instagram', 'facebook', 'tiktok'];
  const platformName = { youtube: '유튜브', instagram: '인스타그램', facebook: '페이스북', tiktok: '틱톡' };
  const platformLong = { youtube: '유튜브 쇼츠', instagram: '인스타그램 릴스', facebook: '페이스북 릴스', tiktok: '틱톡' };
  const modeName = { produce: '제작 + 배포', distribute: '배포만' };
  const modeIntro = { produce: `부업회원이 가이드에 맞춰 숏폼을 직접 만들어 자기 계정에 올려요.`, distribute: '준비한 영상을 부업회원 계정에 그대로 올려요.' };
  const campaignStatus = { review: ['심사 대기', 'pending'], active: ['진행 중', 'active'], paused: ['일시중지', 'paused'], closed: ['종료', 'withdrawn'], rejected: ['반려', 'rejected'], canceled: ['취소', 'withdrawn'],
    upcoming: ['시작 예정', 'upcoming'], settling: ['검수 후 정산', 'settling'] };
  const taskStatus = { applied: ['선정 대기', 'pending'], accepted: ['작업 중', 'active'], drafted: ['시안 검토 중', 'pending'], revise: ['시안 수정 요청', 'paused'], ready: ['게시 대기', 'active'],
    posted: ['배포 검수 중', 'pending'], approved: ['승인 · 정산 대기', 'approved'], paid: ['정산 완료', 'approved'], declined: ['미선정', 'withdrawn'], canceled: ['취소', 'withdrawn'],
    expired: ['기한 만료', 'rejected'], rejected: ['반려', 'rejected'], revoked: ['승인 취소', 'rejected'] };
  const creatorStatus = { pending: ['승인 대기', 'pending'], approved: ['활동 중', 'active'], rejected: ['승인 반려', 'rejected'], suspended: ['이용 정지', 'paused'] };
  const channelStatus = { pending: ['인증 대기', 'pending'], verified: ['인증 완료', 'approved'], rejected: ['인증 반려', 'rejected'] };
  const gradeName = { basic: '일반', pro: '우수', partner: '파트너' };
  const tag = ([text, cls]) => `<span class="status ${cls}">${text}</span>`;
  const chip = p => `<span class="sf-chip ${p}">${platformName[p]}</span>`;
  const percent = (part, whole) => whole ? Math.round(part / whole * 1000) / 10 : 0;
  const strip = items => `<div class="summary-strip">${items.map(([name, value]) => `<div><span>${name}</span><b>${value}</b></div>`).join('')}</div>`;
  const won = value => `${format(value || 0)}원`;
  const ext = (url, text) => url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text || url)}</a>` : '';
  const short = (url, max = 42) => {
    try {
      const u = new URL(url);
      const text = u.hostname.replace(/^www\./, '') + u.pathname;
      return text.length > max ? text.slice(0, max - 1) + '…' : text;
    } catch { return url; }
  };
  const followers = n => n >= 10000 ? `${+(n / 10000).toFixed(n >= 100000 ? 0 : 1)}만` : format(n);
  const phase = c => {
    if (['active', 'paused'].includes(c.status) && c.end_date < h.today()) return 'settling';
    if (c.status === 'active' && c.start_date > h.today()) return 'upcoming';
    return c.status;
  };
  const dueText = at => {
    if (!at) return '';
    const left = at - Date.now();
    if (left <= 0) return '기한 지남';
    const days = Math.floor(left / 86_400_000);
    const hours = Math.floor(left % 86_400_000 / 3_600_000);
    return `${days ? `${days}일 ` : ''}${hours}시간 남음 · ${dateTime(new Date(at).toISOString())}까지`;
  };
  // 사유 입력이 필요한 처리는 공용 확인창 대신 이 창으로 받습니다.
  const act = (path, id, action, text, { reason = '', theme = '', extra = '' } = {}) =>
    btn(text, `type="button" data-sf-act="${path}" data-id="${id}" data-action="${action}" data-label="${esc(text)}" data-reason="${reason}" data-extra="${extra}"`, theme || (['approve', 'accept', 'verify', 'settle', 'activate'].includes(action) ? 'primary small' : 'quiet small'));
  const actExplain = {
    'campaign/status:approve': '승인하면 시작일부터 부업회원 모집이 열립니다.',
    'campaign/status:reject': '반려하면 배정된 예산 전액이 광고 계정 잔액으로 돌아가요. 사유는 광고 계정에 표시됩니다.',
    'campaign/status:pause': '새 참여를 막아요. 진행 중인 작업과 검수는 계속할 수 있어요.',
    'campaign/status:resume': '캠페인을 다시 열어 참여를 받습니다.',
    'campaign/status:close': '게시 전 작업을 정리하고 승인 건 기준으로 남은 예산을 돌려드려요. 검수 대기 배포가 있으면 종료할 수 없어요.',
    'campaign/status:cancel': '심사 전 캠페인을 취소하고 배정한 예산을 모두 돌려받아요.',
    'task/select:accept': '선정하면 부업회원에게 알림이 가고 제출 기한이 시작돼요.',
    'task/select:decline': '선정하지 않으면 자리가 다시 열립니다.',
    'task/draft-review:approve': '시안을 승인하면 부업회원이 자기 채널에 게시하고 주소를 제출합니다.',
    'task/draft-review:revise': '수정 요청 내용을 구체적으로 적어 주세요. 부업회원에게 그대로 전달돼요.',
    'task/review:approve': '승인하면 정산 보류 기간이 지난 뒤 부업회원에게 지급되고, 이 건의 집행액이 확정돼요.',
    'task/review:redo': '게시물을 고쳐서 다시 제출하도록 요청해요. (해시태그 누락, 태그 오류 등)',
    'task/review:reject': '반려하면 작업이 끝나고 자리가 다시 열려요. 부정·가이드 위반일 때 사용하세요.',
    'task/settle:settle': '정산 보류 기간을 기다리지 않고 지금 부업 수익으로 지급합니다.',
    'task/settle:revoke': '게시물 삭제·비공개 등을 확인했을 때 승인을 취소해요. 지급되지 않으며 집행액은 광고 계정에 남거나 환급됩니다.',
    'creator/decision:approve': '승인하면 SNS 채널을 등록·인증한 뒤 캠페인에 참여할 수 있어요.',
    'creator/decision:reject': '반려 사유는 신청자에게 표시되고, 보완해서 다시 신청할 수 있어요.',
    'creator/decision:suspend': '정지하면 새 참여를 막고 게시 전 작업을 취소해요. 검수·정산 중인 건은 그대로 처리됩니다.',
    'creator/decision:activate': '정지를 풀고 다시 참여할 수 있게 합니다.',
    'channel/decision:verify': '프로필 소개글의 인증 코드와 팔로워 수를 확인했다면 인증하세요.',
    'channel/decision:reject': '반려 사유는 부업회원에게 표시돼요.',
    'channel/decision:followers': '확인한 팔로워 수로 갱신합니다.',
    'task/cancel:cancel': '게시 전 작업을 취소해요. 같은 캠페인에 다시 참여할 수 있어요.',
    'channel/remove:remove': '채널을 목록에서 지웁니다. 진행 중인 작업에 쓰는 채널은 지울 수 없어요.'
  };

  /* ---------- 캠페인 카드 (관리자·광고 계정) ---------- */
  function platformRows(c) {
    return `<ul class="sf-platforms">${Object.entries(c.items).map(([p, item]) => {
      const u = c.usage[p] || {};
      return `<li>${chip(p)}<div class="sf-platform-bar"><div><b>${format(u.done || 0)}</b> / ${format(item.count)}건 완료<small>${u.applied ? ` · 선정 대기 ${format(u.applied)}` : ''}${u.working ? ` · 작업 ${format(u.working)}` : ''}${u.posted ? ` · 검수 ${format(u.posted)}` : ''}</small></div>
        <progress class="meter" value="${Math.min(u.done || 0, item.count)}" max="${item.count}" aria-label="${platformName[p]} 진행률"></progress></div>
        <span class="sf-unit">건당 ${won(item.cost)}${h.isAdmin() ? `<small>지급 ${won(item.pay)}</small>` : ''}</span></li>`;
    }).join('')}</ul>`;
  }

  function campaignCard(c, role) {
    const p = phase(c);
    const isAdmin = role === 'admin';
    const ended = ['closed', 'rejected', 'canceled'].includes(c.status);
    const transitions = isAdmin
      ? { review: [['approve', '승인 · 모집 시작'], ['reject', '반려']], active: [['pause', '일시중지'], ['close', '종료·정산']], paused: [['resume', '재개'], ['close', '종료·정산']] }
      : { review: [['cancel', '등록 취소']], active: [['pause', '일시중지'], ['close', '종료·정산']], paused: [['resume', '재개'], ['close', '종료·정산']] };
    const left = Math.max(0, c.budget - c.committed - (ended ? c.returned : 0));
    return `<article class="panel order-card sf-campaign"><div class="row-top"><span class="eyebrow">${modeName[c.mode]} · #${c.id}</span>${tag(campaignStatus[p])}</div>
      <h3><button type="button" class="console-text-button" data-sf-campaign="${c.id}">${esc(c.title)}</button></h3>
      <p>${esc(c.brand)}${isAdmin ? ` · ${esc(c.owner || '운영팀')}` : ''} · ${c.start_date} ~ ${c.end_date} · ${c.length_sec}초 · 게시 유지 ${c.keep_days}일${c.min_followers ? ` · 팔로워 ${followers(c.min_followers)}+` : ''}</p>
      <p class="sf-flags"><span>${c.selection === 'manual' ? '직접 선정' : '선착순 자동 선정'}</span>${c.draft_review ? '<span>시안 검토</span>' : ''}</p>
      ${c.reason ? `<p class="order-note">${esc(c.reason)}</p>` : ''}
      ${platformRows(c)}
      <div class="order-progress"><span>전체 ${format(c.totals.done)} / ${format(c.totals.count)}건 · 누적 조회 ${format(c.totals.views)}</span><strong>${percent(c.totals.done, c.totals.count)}%</strong></div>
      <div class="review-signals"><span>예산 ${won(c.budget)}</span><span>집행 ${won(c.committed)}</span>${ended ? `<span>반환 ${won(c.returned)}</span>` : `<span>남은 예산 ${won(left)}</span>`}
        ${isAdmin ? `<span>지급 ${won(c.payTotal)}</span><span>이익 ${won(c.committed - c.payTotal)}</span>` : ''}</div>
      ${isAdmin && c.memo ? `<p class="form-hint">운영 메모 · ${esc(c.memo)}</p>` : ''}
      <div class="actions">${btn('상세·리포트', `type="button" data-sf-campaign="${c.id}"`, 'quiet small')}
        ${(isAdmin && !ended) || (!isAdmin && c.status === 'review') ? btn('수정', `type="button" data-sf-edit="${c.id}"`, 'quiet small') : ''}
        ${!isAdmin && ['active', 'paused'].includes(c.status) && c.end_date >= h.today() ? btn('연장·증액', `type="button" data-sf-extend="${c.id}"`, 'quiet small') : ''}
        ${(transitions[c.status] || []).map(([action, text]) => act('campaign/status', c.id, action, text, { reason: action === 'reject' ? 'required' : '', theme: action === 'approve' ? 'primary small' : '' })).join('')}</div></article>`;
  }

  /* ---------- 캠페인 상세 (모달) ---------- */
  async function openCampaign(id) {
    detail = await api('/api/shortform/campaign?id=' + id);
    const c = detail.campaign;
    const isAdmin = h.isAdmin();
    const rows = detail.tasks;
    const brief = [['상품·서비스', c.product], [c.mode === 'produce' ? '제작 가이드' : '게시 안내', c.guide], ['필수 해시태그', c.hashtags], ['필수 문구·계정 태그', c.mention], ['금지 표현', c.forbidden]]
      .filter(([, value]) => value).map(([name, value]) => `<div><dt>${name}</dt><dd>${esc(value)}</dd></div>`).join('');
    const taskActions = t => {
      const list = [];
      if (t.status === 'applied') list.push(act('task/select', t.id, 'accept', '선정'), act('task/select', t.id, 'decline', '미선정', { reason: 'optional' }));
      if (t.status === 'drafted') list.push(act('task/draft-review', t.id, 'approve', '시안 승인', { reason: 'optional' }), act('task/draft-review', t.id, 'revise', '수정 요청', { reason: 'required' }));
      if (isAdmin && t.status === 'posted') list.push(act('task/review', t.id, 'approve', '배포 승인', { extra: 'views' }), act('task/review', t.id, 'redo', '수정 요청', { reason: 'required' }), act('task/review', t.id, 'reject', '반려', { reason: 'required' }));
      if (isAdmin && t.status === 'approved') list.push(act('task/settle', t.id, 'settle', '즉시 정산'), act('task/settle', t.id, 'revoke', '승인 취소', { reason: 'required' }));
      return list.join('');
    };
    modal('SHORT-FORM CAMPAIGN', esc(c.title), `<p>${modeName[c.mode]} · ${esc(c.brand)} · ${c.start_date} ~ ${c.end_date} · ${tag(campaignStatus[phase(c)])}</p>
      ${platformRows(c)}
      ${strip([['완료', `${format(c.totals.done)} / ${format(c.totals.count)}건`], ['검수 대기', `${format(c.totals.posted)}건`], ['누적 조회', format(c.totals.views)], ['집행', won(c.committed)], ['예산', won(c.budget)]])}
      <details class="sf-brief"><summary>캠페인 가이드 보기</summary><dl class="ow-kv">${brief}
        ${c.source_url ? `<div><dt>${c.mode === 'distribute' ? '배포 영상' : '참고 자료'}</dt><dd>${ext(c.source_url, short(c.source_url))}</dd></div>` : ''}
        ${c.landing_url ? `<div><dt>연결 링크</dt><dd>${ext(c.landing_url, short(c.landing_url))}</dd></div>` : ''}</dl></details>
      <div class="sf-detail-head"><h3 class="sub-title">참여 ${format(rows.length)}건</h3><a class="btn quiet small" href="/api/shortform/export?id=${c.id}" download>${icon('download')} CSV</a></div>
      ${rows.length ? `<div class="table-wrap"><table class="data-table compact sf-task-table"><thead><tr><th>채널</th><th>${isAdmin ? '참여자' : label()}</th><th>상태</th><th>게시물 · 시안</th><th class="num">조회</th><th></th></tr></thead><tbody>
        ${rows.map(t => `<tr><td>${chip(t.platform)} ${ext(t.channel_url, '@' + t.handle)}<small>팔로워 ${followers(t.followers)}</small></td>
          <td>${esc(t.creator)}<small>완료 ${format(t.done_count)} · 실패 ${format(t.fail_count)}</small>${t.note ? `<small>“${esc(t.note)}”</small>` : ''}</td>
          <td>${tag(taskStatus[t.status])}${t.reason ? `<small>${esc(t.reason)}</small>` : ''}${t.feedback && ['revise', 'ready'].includes(t.status) ? `<small>요청: ${esc(t.feedback)}</small>` : ''}</td>
          <td>${t.post_url ? `${ext(t.post_url, short(t.post_url, 30))}<small>${dateTime(t.posted)}</small>` : ''}${t.draft_url && ['drafted', 'revise', 'ready'].includes(t.status) ? `${ext(t.draft_url, '시안 보기')}<small>${format(t.drafts)}차${t.draft_note ? ` · ${esc(t.draft_note)}` : ''}</small>` : ''}
            ${t.proof_id ? `<a href="/api/shortform/image?id=${t.proof_id}" target="_blank" rel="noopener"><small>게시 캡처</small></a>` : ''}</td>
          <td class="num">${t.views === null ? '−' : format(t.views)}${t.likes !== null ? `<small>♥ ${format(t.likes)}</small>` : ''}</td>
          <td class="row-actions">${taskActions(t)}</td></tr>`).join('')}</tbody></table></div>` : empty(c.status === 'review' ? '승인 후 모집이 시작되면 참여 현황이 여기에 표시돼요.' : '아직 참여한 사람이 없어요.')}`, true);
    h.labelTables(dialog);
  }

  /* ---------- 최고관리자 ---------- */
  const adminTabs = {
    shortform: [['campaigns', '캠페인 심사·관리'], ['review', '배포 검수·정산'], ['tasks', '작업 현황']],
    sfcreators: [['creators', '부업회원'], ['channels', '채널 인증']]
  };
  async function adminView(tab, params) {
    const views = adminTabs[tab];
    const current = tab === 'sfpolicy' ? 'policy' : views.some(([key]) => key === params.get('view')) ? params.get('view') : views[0][0];
    const query = new URLSearchParams({ view: current === 'channels' ? 'creators' : current === 'policy' ? 'policy' : current, status: params.get('status') || '', q: params.get('q') || '', page: params.get('page') || '1' });
    admin = await api('/api/shortform/admin?' + query);
    const k = admin.kpi;
    const counts = admin.counts;
    if (tab === 'sfpolicy') return policyView();
    const badges = { campaigns: counts.campaigns, review: counts.posted, creators: counts.creators, channels: counts.channels };
    const head = tab === 'shortform'
      ? strip([['진행 캠페인', `${format(k.live)}개`], ['심사 대기', `${format(counts.campaigns)}건`], ['배포 검수 대기', `${format(counts.posted)}건`], ['오늘 승인', `${format(k.approvedToday)}건`],
        ['정산 보류', won(k.holding)], ['누적 이익', won(k.profit)]])
      : strip([[`활동 ${label()}`, `${format(k.creators)}명`], ['가입 승인 대기', `${format(counts.creators)}명`], ['채널 인증 대기', `${format(counts.channels)}개`], ['누적 지급', won(k.paid)], ['정산 보류', won(k.holding)]]);
    const names = { creators: label() };
    return `${head}<div class="toolbar"><div class="tabs">${views.map(([key, text]) => `<a href="/manage?tab=${tab}&amp;view=${key}" class="${key === current ? 'on' : ''}">${names[key] || text}${badges[key] ? ` <span class="count">${format(badges[key])}</span>` : ''}</a>`).join('')}</div>
      ${tab === 'shortform' ? '<a class="btn quiet small" href="/manage?tab=sfpolicy">단가·정책</a>' : ''}</div>
      ${{ campaigns: campaignsView, review: reviewView, tasks: tasksView, creators: creatorsView, channels: channelsView }[current](params)}`;
  }

  function campaignsView(params) {
    const filter = params.get('status') || '';
    const filters = [['', '전체'], ['review', '심사 대기'], ['active', '진행 중'], ['paused', '일시중지'], ['closed', '종료'], ['rejected', '반려'], ['canceled', '취소']];
    const list = admin.campaigns.filter(c => !filter || c.status === filter);
    return `<div class="tabs">${filters.map(([key, text]) => `<a href="/manage?tab=shortform&amp;view=campaigns${key ? '&amp;status=' + key : ''}" class="${key === filter ? 'on' : ''}">${text} <span class="count">${format(key ? admin.campaigns.filter(c => c.status === key).length : admin.campaigns.length)}</span></a>`).join('')}</div>
      ${list.length ? `<div class="order-grid">${list.map(c => campaignCard(c, 'admin')).join('')}</div>` : empty('조건에 맞는 숏폼 캠페인이 없어요.')}`;
  }

  function reviewView() {
    const checklist = t => [t.hashtags && `해시태그 ${esc(t.hashtags)}`, t.mention && `필수 ${esc(t.mention)}`, t.forbidden && `금지 ${esc(t.forbidden)}`].filter(Boolean).map(item => `<li>${item}</li>`).join('');
    return `${admin.posted.length ? `<div class="order-grid">${admin.posted.map(t => `<article class="panel order-card sf-review"><div class="row-top"><span class="eyebrow">배포 #${t.id} · ${dateTime(t.posted)}</span>${tag(taskStatus.posted)}</div>
        <h3>${esc(t.title)}</h3><p>${chip(t.platform)} ${ext(t.channel_url, '@' + t.handle)} · 팔로워 ${followers(t.followers)} · ${esc(t.creator)}</p>
        <a class="sf-post-link" href="${esc(t.post_url)}" target="_blank" rel="noopener noreferrer">${icon('play')}<span>${esc(short(t.post_url, 48))}</span>${icon('chevron')}</a>
        ${t.proof_id ? `<a href="/api/shortform/image?id=${t.proof_id}" target="_blank" rel="noopener"><img class="ow-proof" src="/api/shortform/image?id=${t.proof_id}" alt="게시 캡처"></a>` : ''}
        ${checklist(t) ? `<ul class="sf-checklist">${checklist(t)}<li>게시 유지 ${t.keep_days}일</li></ul>` : ''}
        ${t.post_note ? `<blockquote>${esc(t.post_note)}</blockquote>` : ''}
        <div class="review-signals"><span>조회 ${t.views === null ? '미입력' : format(t.views)}</span><span>지급 ${won(t.pay)} · 집행 ${won(t.cost)}</span><span>완료 이력 ${format(t.done_count)}</span>${t.fail_count ? `<span class="flag">실패 이력 ${format(t.fail_count)}</span>` : ''}</div>
        <div class="actions">${act('task/review', t.id, 'approve', '배포 승인', { extra: 'views' })}${act('task/review', t.id, 'redo', '수정 요청', { reason: 'required' })}${act('task/review', t.id, 'reject', '반려', { reason: 'required' })}</div></article>`).join('')}</div>`
      : empty('검수할 배포가 없어요. 부업회원이 게시물 주소를 제출하면 여기에 표시돼요.')}
      <section class="panel dash-block">${panelHead('정산 보류 중', `승인 후 ${admin.policy.holdDays}일 동안 게시 유지를 확인한 뒤 자동 정산돼요. 삭제·비공개가 확인되면 승인을 취소하세요.`)}
        ${admin.holding.length ? `<div class="table-wrap"><table class="data-table compact"><thead><tr><th>작업</th><th>채널</th><th>게시물</th><th class="num">지급액</th><th>정산 예정</th><th></th></tr></thead><tbody>
          ${admin.holding.map(t => `<tr><td><b>${esc(t.title)}</b><small>#${t.id} · ${esc(t.creator)}</small></td><td>${chip(t.platform)} @${esc(t.handle)}</td><td>${ext(t.post_url, short(t.post_url, 30))}</td>
            <td class="num">${won(t.pay)}</td><td><small>${t.settle_at ? dateTime(new Date(t.settle_at).toISOString()) : ''}</small></td>
            <td class="row-actions">${act('task/settle', t.id, 'settle', '즉시 정산')}${act('task/settle', t.id, 'revoke', '승인 취소', { reason: 'required' })}</td></tr>`).join('')}</tbody></table></div>` : empty('정산 보류 중인 건이 없어요.')}</section>
      ${admin.drafts.length ? `<section class="panel dash-block">${panelHead('시안 검토 대기', '보통 광고 계정이 검토하지만, 운영팀이 대신 처리할 수도 있어요.')}
        <div class="table-wrap"><table class="data-table compact"><thead><tr><th>작업</th><th>채널</th><th>시안</th><th></th></tr></thead><tbody>
        ${admin.drafts.map(t => `<tr><td><b>${esc(t.title)}</b><small>#${t.id} · ${esc(t.creator)}</small></td><td>${chip(t.platform)} @${esc(t.handle)}</td><td>${ext(t.draft_url, '시안 보기')}<small>${format(t.drafts)}차${t.draft_note ? ` · ${esc(t.draft_note)}` : ''}</small></td>
          <td class="row-actions">${act('task/draft-review', t.id, 'approve', '시안 승인', { reason: 'optional' })}${act('task/draft-review', t.id, 'revise', '수정 요청', { reason: 'required' })}</td></tr>`).join('')}</tbody></table></div></section>` : ''}`;
  }

  function tasksView(params) {
    const status = params.get('status') || '';
    const link = changes => {
      const next = new URLSearchParams({ tab: 'shortform', view: 'tasks', status, q: params.get('q') || '', ...changes });
      for (const [key, value] of [...next]) if (!value) next.delete(key);
      return '/manage?' + next.toString().replaceAll('&', '&amp;');
    };
    const groups = [['', '전체'], ['applied', '선정 대기'], ['accepted', '작업 중'], ['drafted', '시안 검토'], ['ready', '게시 대기'], ['posted', '배포 검수'], ['approved', '정산 대기'], ['paid', '정산 완료'], ['expired', '만료'], ['rejected', '반려'], ['revoked', '승인 취소']];
    return `<form class="filter-bar" data-filter="shortform"><label class="search">${icon('search')}<input name="q" type="search" value="${esc(params.get('q') || '')}" placeholder="캠페인, 참여자, 채널 검색"></label>
        <input type="hidden" name="view" value="tasks"><input type="hidden" name="status" value="${esc(status)}">${btn('검색', 'type="submit"', 'primary small')}</form>
      <div class="tabs">${groups.map(([key, text]) => `<a href="${link({ status: key, page: '' })}" class="${key === status ? 'on' : ''}">${text}${key && admin.statusCounts[key] ? ` <span class="count">${format(admin.statusCounts[key])}</span>` : ''}</a>`).join('')}</div>
      <section class="panel dash-block">${panelHead('숏폼 작업', `${format(admin.total)}건 · 최근 순`)}
      ${admin.tasks.length ? `<div class="table-wrap"><table class="data-table compact"><thead><tr><th>작업</th><th>참여자 · 채널</th><th>상태</th><th>게시물</th><th class="num">조회</th><th class="num">지급 / 집행</th></tr></thead><tbody>
        ${admin.tasks.map(t => `<tr><td><button type="button" class="console-text-button" data-sf-campaign="${t.campaign_id}">${esc(t.title)}</button><small>#${t.id} · ${dateTime(t.created)}</small></td>
          <td>${esc(t.creator)}<small>${chip(t.platform)} @${esc(t.handle)} · ${followers(t.followers)}</small></td><td>${tag(taskStatus[t.status])}${t.reason ? `<small>${esc(t.reason)}</small>` : ''}${t.due_at && ['accepted', 'revise', 'ready'].includes(t.status) ? `<small>${dueText(t.due_at)}</small>` : ''}</td>
          <td>${t.post_url ? ext(t.post_url, short(t.post_url, 28)) : '−'}</td><td class="num">${t.views === null ? '−' : format(t.views)}</td><td class="num">${won(t.pay)}<small>${won(t.cost)}</small></td></tr>`).join('')}</tbody></table></div>` : empty('조건에 맞는 작업이 없어요.')}
      ${pager(admin.page, admin.pages, link({ page: '' }))}</section>`;
  }

  function creatorsView(params) {
    const status = params.get('status') || '';
    const pending = admin.creators.filter(c => c.status === 'pending');
    const list = admin.creators.filter(c => c.status !== 'pending' || status === 'pending');
    const link = key => `/manage?tab=sfcreators&amp;view=creators${key ? '&amp;status=' + key : ''}${params.get('q') ? '&amp;q=' + encodeURIComponent(params.get('q')) : ''}`;
    return `<form class="filter-bar" data-filter="sfcreators"><label class="search">${icon('search')}<input name="q" type="search" value="${esc(params.get('q') || '')}" placeholder="이름, 아이디 검색"></label>
        <input type="hidden" name="view" value="creators"><input type="hidden" name="status" value="${esc(status)}">${btn('검색', 'type="submit"', 'primary small')}</form>
      <div class="tabs">${[['', '전체'], ['pending', '승인 대기'], ['approved', '활동 중'], ['rejected', '반려'], ['suspended', '이용 정지']].map(([key, text]) => `<a href="${link(key)}" class="${key === status ? 'on' : ''}">${text} <span class="count">${format(key ? admin.statusCounts[key] || 0 : Object.values(admin.statusCounts).reduce((a, b) => a + b, 0))}</span></a>`).join('')}</div>
      ${pending.length && status !== 'pending' ? `<h3 class="ow-sub">가입 승인 대기 ${format(pending.length)}명</h3>` : ''}
      ${(status === 'pending' || !status) && pending.length ? `<div class="order-grid">${pending.map(c => `<article class="panel order-card"><div class="row-top"><span class="eyebrow">신청 ${day(c.created)}</span>${tag(creatorStatus.pending)}</div>
        <h3>${esc(c.name)} <small class="muted">${esc(c.username)}</small></h3><p>주 활동 ${c.main_platform ? chip(c.main_platform) : '−'} · 등록 채널 ${format(c.verified_channels + c.pending_channels)}개</p>
        <blockquote>${esc(c.intro) || '소개 없음'}</blockquote>
        <div class="actions">${act('creator/decision', c.id, 'approve', '가입 승인')}${act('creator/decision', c.id, 'reject', '반려', { reason: 'required' })}</div></article>`).join('')}</div>` : ''}
      ${status !== 'pending' ? `<section class="panel dash-block">${panelHead(`${label()} 목록`, `${format(list.length)}명`)}
        ${list.length ? `<div class="table-wrap"><table class="data-table compact"><thead><tr><th>${label()}</th><th>상태 · 등급</th><th>인증 채널</th><th class="num">진행</th><th class="num">완료 / 실패</th><th class="num">누적 수익</th><th class="num">출금 가능</th><th></th></tr></thead><tbody>
          ${list.map(c => `<tr><td><b>${esc(c.name)}</b><small>${esc(c.username)} · 가입 ${day(c.joined)}</small></td><td>${tag(creatorStatus[c.status])}<small>${gradeName[c.grade] || c.grade}${c.reason ? ` · ${esc(c.reason)}` : ''}</small></td>
            <td>${format(c.verified_channels)}개<small>팔로워 합계 ${followers(c.followers)}${c.pending_channels ? ` · 대기 ${c.pending_channels}` : ''}</small></td><td class="num">${format(c.open_tasks)}</td>
            <td class="num">${format(c.done_count)} / ${format(c.fail_count)}</td><td class="num">${won(c.earned)}</td><td class="num">${won(c.balance)}</td>
            <td class="row-actions">${btn('관리', `type="button" data-sf-creator="${c.id}"`, 'quiet small')}</td></tr>`).join('')}</tbody></table></div>` : empty(`조건에 맞는 ${label()}이 없어요.`)}</section>` : ''}`;
  }

  function openCreator(id) {
    const c = admin.creators.find(item => item.id === id);
    const transitions = { pending: [['approve', '가입 승인'], ['reject', '반려']], rejected: [['approve', '가입 승인']], approved: [['suspend', '이용 정지']], suspended: [['activate', '정지 해제']] }[c.status] || [];
    modal('SIDE CREATOR', `${esc(c.name)} 관리`, `<dl class="ow-kv"><div><dt>아이디</dt><dd>${esc(c.username)}</dd></div><div><dt>상태</dt><dd>${tag(creatorStatus[c.status])}${c.reason ? ` ${esc(c.reason)}` : ''}</dd></div>
        <div><dt>주 활동</dt><dd>${c.main_platform ? platformLong[c.main_platform] : '−'}</dd></div><div><dt>소개</dt><dd>${esc(c.intro) || '−'}</dd></div>
        <div><dt>실적</dt><dd>완료 ${format(c.done_count)} · 실패 ${format(c.fail_count)} · 누적 수익 ${won(c.earned)}</dd></div><div><dt>최근 로그인</dt><dd>${c.last_login ? dateTime(c.last_login) : '−'}</dd></div></dl>
      <form class="form" data-form="shortform/creator/update"><input type="hidden" name="id" value="${c.id}">
        ${select('등급', 'grade', Object.entries(gradeName))}${textarea('운영 메모 (운영팀만 보임)', 'memo', `maxlength="500" rows="2" data-prefill="${esc(c.memo)}"`)}${btn('저장', 'type="submit"', 'quiet small')}</form>
      <div class="actions">${transitions.map(([action, text]) => act('creator/decision', c.id, action, text, { reason: ['reject', 'suspend'].includes(action) ? 'required' : '' })).join('')}
        <a class="btn quiet small" href="/manage?tab=shortform&amp;view=tasks&amp;q=${encodeURIComponent(c.username)}">작업 보기</a></div>`);
    const form = dialog.querySelector('form');
    form.elements.grade.value = c.grade;
    form.elements.memo.value = c.memo || '';
  }

  function channelsView() {
    const pending = admin.channels.filter(c => c.status === 'pending');
    const others = admin.channels.filter(c => c.status !== 'pending');
    return `${pending.length ? `<div class="order-grid">${pending.map(c => `<article class="panel order-card"><div class="row-top"><span class="eyebrow">채널 #${c.id} · ${day(c.created)}</span>${tag(channelStatus.pending)}</div>
        <h3>${chip(c.platform)} ${ext(c.url, '@' + c.handle)}</h3><p>${esc(c.owner)} · ${tag(creatorStatus[c.creator_status] || ['−', ''])}${c.category ? ` · ${esc(c.category)}` : ''}</p>
        <dl class="ow-kv"><div><dt>인증 코드</dt><dd><code class="ow-code">${esc(c.code)}</code> <small>프로필 소개글에 있는지 확인</small></dd></div><div><dt>신고 팔로워</dt><dd>${format(c.followers)}명</dd></div></dl>
        ${c.proof_id ? `<a href="/api/shortform/image?id=${c.proof_id}" target="_blank" rel="noopener"><img class="ow-proof" src="/api/shortform/image?id=${c.proof_id}" alt="채널 인증 화면"></a>` : ''}
        <div class="actions"><a class="btn quiet small" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">채널 열기</a>${act('channel/decision', c.id, 'verify', '인증', { extra: 'followers:' + c.followers })}${act('channel/decision', c.id, 'reject', '반려', { reason: 'required' })}</div></article>`).join('')}</div>`
      : empty('인증을 기다리는 채널이 없어요.')}
      <section class="panel dash-block">${panelHead('인증·반려된 채널', `${format(others.length)}개`)}
        ${others.length ? `<div class="table-wrap"><table class="data-table compact"><thead><tr><th>채널</th><th>${label()}</th><th class="num">팔로워</th><th>상태</th><th></th></tr></thead><tbody>
          ${others.map(c => `<tr><td>${chip(c.platform)} ${ext(c.url, '@' + c.handle)}<small>${esc(c.category || '')}</small></td><td>${esc(c.owner)}</td><td class="num">${format(c.followers)}</td>
            <td>${tag(channelStatus[c.status])}${c.reason ? `<small>${esc(c.reason)}</small>` : ''}<small>${c.verified ? `인증 ${day(c.verified)}` : ''}</small></td>
            <td class="row-actions">${c.status === 'verified' ? act('channel/decision', c.id, 'followers', '팔로워 갱신', { extra: 'followers:' + c.followers }) : act('channel/decision', c.id, 'verify', '인증', { extra: 'followers:' + c.followers })}</td></tr>`).join('')}</tbody></table></div>` : empty('아직 처리한 채널이 없어요.')}</section>`;
  }

  function policyView() {
    const p = admin.policy;
    return `<section class="panel">${panelHead('숏폼 배포 단가와 지급액', '광고 단가는 광고 계정이 내는 건당 금액, 지급액은 부업회원에게 정산되는 금액입니다. 차액이 애즈폼 이익이에요. 바꾼 단가는 새로 등록하는 캠페인부터 적용됩니다.')}
      <form class="form" data-form="shortform/settings">
        <div class="table-wrap"><table class="data-table compact sf-rate-table"><thead><tr><th>유형 · 플랫폼</th><th>광고 단가 (원)</th><th>지급액 (원)</th><th class="num">이익</th></tr></thead><tbody>
          ${Object.keys(modeName).map(mode => platformKeys.map(pk => `<tr><td><b>${modeName[mode]}</b><small>${platformLong[pk]}</small></td>
            <td><input class="sf-rate" name="${mode}_${pk}_cost" type="number" min="100" max="10000000" required value="${p.rates[mode][pk].cost}" aria-label="${modeName[mode]} ${platformName[pk]} 광고 단가"></td>
            <td><input class="sf-rate" name="${mode}_${pk}_pay" type="number" min="0" max="10000000" required value="${p.rates[mode][pk].pay}" aria-label="${modeName[mode]} ${platformName[pk]} 지급액"></td>
            <td class="num" data-sf-margin="${mode}_${pk}">${won(p.rates[mode][pk].cost - p.rates[mode][pk].pay)}</td></tr>`).join('')).join('')}</tbody></table></div>
        <h3 class="sub-title">운영 정책</h3>
        <div class="two">${field('부업회원 명칭 (메뉴·안내 문구에 표시)', 'label', 'text', `required minlength="2" maxlength="12" value="${esc(p.label)}"`)}${field('정산 보류 기간 (일)', 'hold_days', 'number', `required min="0" max="60" value="${p.holdDays}"`)}</div>
        <div class="two">${field('선정 후 제출 기한 (일)', 'due_days', 'number', `required min="1" max="60" value="${p.dueDays}"`)}${field('1인 동시 진행 작업 수', 'max_open', 'number', `required min="1" max="50" value="${p.maxOpen}"`)}</div>
        <label class="check"><input type="checkbox" name="auto_creator" value="1"${p.autoCreator ? ' checked' : ''}> ${label()} 가입을 운영팀 확인 없이 바로 승인 (채널 인증은 계속 필요)</label>
        <p class="form-hint">정산 보류 기간: 배포를 승인한 뒤 게시물 유지를 확인하는 기간입니다. 0일이면 승인 즉시 지급돼요. 명칭을 바꾸면 가입 화면·메뉴·알림 문구에 바로 반영됩니다.</p>
        ${btn('단가·정책 저장', 'type="submit"')}</form></section>`;
  }

  /* ---------- 광고 계정 ---------- */
  async function ownerView() {
    mine = await api('/api/shortform/mine');
    const live = mine.campaigns.filter(c => ['active', 'paused'].includes(c.status));
    const done = mine.campaigns.reduce((sum, c) => sum + c.totals.done, 0);
    const views = mine.campaigns.reduce((sum, c) => sum + c.totals.views, 0);
    const reserved = live.reduce((sum, c) => sum + Math.max(0, c.budget - c.committed), 0);
    const todo = [mine.pending.applied && `<a href="#sf-list">선정을 기다리는 신청 <b>${format(mine.pending.applied)}건</b></a>`, mine.pending.drafted && `<a href="#sf-list">검토할 시안 <b>${format(mine.pending.drafted)}건</b></a>`].filter(Boolean);
    return `${strip([['진행 캠페인', `${format(live.length)}개`], ['심사 대기', `${format(mine.campaigns.filter(c => c.status === 'review').length)}건`], ['배포 완료', `${format(done)}건`],
        ['누적 조회', format(views)], ['진행 캠페인 남은 예산', won(reserved)], ['사용 가능 잔액', won(mine.balance)]])}
      <section class="panel sf-hero"><div><span class="eyebrow">SHORT-FORM DISTRIBUTION</span><h2>${label()}이 만들고, 실제 계정에 배포해요</h2>
        <p>캠페인을 등록하면 인증된 ${label()} ${format(mine.creators)}명이 유튜브 쇼츠·인스타그램 릴스·페이스북 릴스·틱톡의 <b>자기 계정</b>에 숏폼을 올립니다. 운영팀이 게시물을 검수해 승인한 건만 집행되고, 남은 예산은 종료 시 돌려드려요.</p>
        <ul class="sf-channel-count">${platformKeys.map(p => `<li>${chip(p)}<b>${format(mine.channels[p] || 0)}</b><small>인증 채널</small></li>`).join('')}</ul>
        <div class="actions">${btn(`${icon('play')} 숏폼 캠페인 등록`, 'type="button" data-sf-new', 'primary')}</div></div>
        <ol class="sf-steps">${[['캠페인 등록', '유형·플랫폼별 배포 건수를 정하면 예산이 배정돼요.'], ['운영팀 심사', '가이드와 소재를 확인하고 모집을 열어요.'], [`${label()} 제작·게시`, '선착순 또는 직접 선정한 회원이 제작해 게시해요.'], ['검수·리포트', '승인 건만 집행되고 게시물·조회수를 확인해요.']]
          .map(([title, text], i) => `<li><span>${i + 1}</span><b>${title}</b><small>${text}</small></li>`).join('')}</ol></section>
      <div class="sf-rate-cards">${Object.keys(modeName).map(mode => `<div><b>${modeName[mode]}</b><span>${modeIntro[mode].replace('부업회원', label())}</span>
        <ul>${platformKeys.map(p => `<li>${chip(p)} 건당 ${won(mine.rates[mode][p].cost)}</li>`).join('')}</ul></div>`).join('')}</div>
      ${todo.length ? `<p class="notice">${icon('bell')} ${todo.join(' · ')}</p>` : ''}
      <div id="sf-list">${mine.campaigns.length ? `<div class="order-grid">${mine.campaigns.map(c => campaignCard(c, 'owner')).join('')}</div>` : empty('아직 등록한 숏폼 캠페인이 없어요. ‘숏폼 캠페인 등록’으로 시작해 보세요.')}</div>`;
  }

  function campaignForm(c) {
    const editing = Boolean(c);
    const mode = c?.mode || 'produce';
    const today = h.today();
    const rates = mine?.rates || admin?.policy?.rates;
    const plus = n => new Date(Date.parse(today) + n * 86_400_000).toISOString().slice(0, 10);
    return `<form class="form sf-form" data-form="${editing ? 'shortform/campaign/update' : 'shortform/campaign'}">${editing ? `<input type="hidden" name="id" value="${c.id}"><input type="hidden" name="mode" value="${mode}">
        <p class="notice">${modeName[mode]} 캠페인 · ${h.isAdmin() ? '가이드와 소재 정보를 고칠 수 있어요. 배포 건수와 기간은 바꿀 수 없어요.' : '심사 전에는 가이드와 소재를 고칠 수 있어요. 배포 건수·기간을 바꾸려면 취소 후 다시 등록해 주세요.'}</p>` : `
      <div class="ow-type-picker sf-mode-picker" role="radiogroup" aria-label="캠페인 유형">${Object.keys(modeName).map(key => `<label><input type="radio" name="mode" value="${key}"${key === mode ? ' checked' : ''}><b>${modeName[key]}</b><small>${modeIntro[key].replace('부업회원', label())}</small></label>`).join('')}</div>`}
      <div class="two">${field('캠페인 제목', 'title', 'text', `required minlength="2" maxlength="60" placeholder="예: 가을 신메뉴 숏폼 리뷰" value="${esc(c?.title || '')}"`)}${field('브랜드명', 'brand', 'text', `required maxlength="40" value="${esc(c?.brand || '')}"`)}</div>
      ${textarea('상품·서비스 소개', 'product', 'required minlength="10" maxlength="1500" rows="3" placeholder="무엇을 알리고 싶은지, 핵심 특징과 혜택을 적어 주세요."')}
      ${textarea(mode === 'produce' ? '제작 가이드 (장면 구성·필수 장면·톤)' : '게시 안내 (본문 문구·게시 방법)', 'guide', 'required minlength="5" maxlength="2000" rows="4" data-sf-guide')}
      <div class="two">${field('필수 해시태그', 'hashtags', 'text', `maxlength="200" placeholder="#브랜드 #캠페인 #광고" value="${esc(c?.hashtags || '')}"`)}${field('필수 문구·계정 태그', 'mention', 'text', `maxlength="200" placeholder="@brand 태그, “유료 광고 포함” 표시" value="${esc(c?.mention || '')}"`)}</div>
      ${field('금지 표현 (선택)', 'forbidden', 'text', `maxlength="300" placeholder="경쟁사 언급, 과장 효능 표현 등" value="${esc(c?.forbidden || '')}"`)}
      <div class="two">${field(mode === 'distribute' ? '배포할 영상 주소 (https · 필수)' : '참고 자료 주소 (선택)', 'source_url', 'url', `maxlength="1000" placeholder="https://" value="${esc(c?.source_url || '')}" data-sf-source`)}${field('연결할 링크 (선택 · 프로필·고정 댓글)', 'landing_url', 'url', `maxlength="1000" placeholder="https://" value="${esc(c?.landing_url || '')}"`)}</div>
      <div class="two">${select('영상 길이', 'duration', [[15, '15초 이하'], [30, '30초 이하'], [60, '60초 이하'], [90, '90초 이하']])}${field('게시 유지 기간 (일)', 'keep_days', 'number', `required min="7" max="365" value="${c?.keep_days ?? 30}"`)}</div>
      <div class="two">${select('참여 채널 최소 팔로워', 'min_followers', [[0, '제한 없음'], [1000, '1천 명 이상'], [5000, '5천 명 이상'], [10000, '1만 명 이상'], [50000, '5만 명 이상'], [100000, '10만 명 이상']])}${editing ? '<span></span>' : select('참여자 선정', 'selection', [['auto', '선착순 자동 선정'], ['manual', '신청자 중 직접 선정']])}</div>
      ${editing ? '' : `<label class="check sf-draft-check"><input type="checkbox" name="draft_review" value="1" checked> 게시 전에 시안(영상 링크)을 먼저 확인할게요 <small>(제작 + 배포만)</small></label>
      <fieldset class="sf-count-set"><legend>플랫폼별 배포 건수 <small>건수 × 건당 단가만큼 예산이 배정돼요</small></legend>
        ${platformKeys.map(p => `<label class="sf-count">${chip(p)}<span data-sf-cost="${p}">건당 ${won(rates[mode][p].cost)}</span><input name="count_${p}" type="number" min="0" max="1000" value="${p === 'instagram' ? 5 : 0}" aria-label="${platformName[p]} 배포 건수"><em>건</em></label>`).join('')}</fieldset>
      <div class="two">${field('시작일', 'start', 'date', `required min="${today}" value="${today}"`)}${field('종료일', 'end', 'date', `required min="${today}" value="${plus(20)}"`)}</div>
      <div class="sf-estimate" aria-live="polite"></div>`}
      <p class="form-hint">${editing ? '' : '등록하면 예산이 잔액에서 배정되고 운영팀 심사 후 모집이 시작됩니다. 승인된 배포만 집행되고, 종료 시 남은 예산은 돌려드려요.'}</p>
      ${btn(editing ? '저장' : '캠페인 등록 (예산 배정)', 'type="submit"')}</form>`;
  }

  function syncCampaignForm(form) {
    const mode = form.querySelector('input[name="mode"]:checked')?.value || form.elements.mode?.value;
    const source = form.querySelector('[data-sf-source]');
    if (source) {
      source.required = mode === 'distribute';
      source.closest('.field').querySelector('span').textContent = mode === 'distribute' ? '배포할 영상 주소 (https · 필수)' : '참고 자료 주소 (선택)';
    }
    const guide = form.querySelector('[data-sf-guide]');
    if (guide) guide.closest('.field').querySelector('span').textContent = mode === 'produce' ? '제작 가이드 (장면 구성·필수 장면·톤)' : '게시 안내 (본문 문구·게시 방법)';
    const draft = form.querySelector('.sf-draft-check');
    if (draft) {
      draft.hidden = mode !== 'produce';
      draft.querySelector('input').disabled = mode !== 'produce';
    }
    const estimate = form.querySelector('.sf-estimate');
    if (!estimate || !mine) return;
    const lines = platformKeys.map(p => {
      form.querySelector(`[data-sf-cost="${p}"]`).textContent = `건당 ${won(mine.rates[mode][p].cost)}`;
      return [p, Number(form.elements[`count_${p}`].value || 0)];
    }).filter(([, n]) => n > 0);
    const budget = lines.reduce((sum, [p, n]) => sum + n * mine.rates[mode][p].cost, 0);
    const after = mine.balance - budget;
    estimate.innerHTML = `<dl class="quote-balance">${lines.map(([p, n]) => `<div><dt>${platformName[p]} ${format(n)}건</dt><dd>${won(n * mine.rates[mode][p].cost)}</dd></div>`).join('')}
      <div><dt>배정 예산</dt><dd>${won(budget)}</dd></div><div><dt>등록 후 잔액</dt><dd class="${after < 0 ? 'minus' : ''}">${won(after)}</dd></div></dl>
      ${!lines.length ? '<p class="quote-warn">배포할 플랫폼의 건수를 1건 이상 입력해 주세요.</p>' : ''}
      ${after < 0 ? `<p class="quote-warn">잔액이 ${won(-after)} 부족해요. <a href="/manage?tab=charges">충전 신청하기</a></p>` : ''}`;
  }

  function openForm(id) {
    const source = h.isAdmin() ? admin?.campaigns : mine?.campaigns;
    const c = id ? (source || []).find(item => item.id === id) || detail?.campaign : null;
    modal('SHORT-FORM CAMPAIGN', c ? '숏폼 캠페인 수정' : '숏폼 캠페인 등록', campaignForm(c), true);
    const form = dialog.querySelector('form[data-form]');
    form.elements.product.value = c?.product || '';
    form.elements.guide.value = c?.guide || '';
    form.elements.duration.value = String(c?.length_sec || 30);
    form.elements.min_followers.value = String(c?.min_followers || 0);
    if (c && h.isAdmin()) form.querySelector('button[type="submit"]').insertAdjacentHTML('beforebegin', textarea('운영 메모 (운영팀만 보임)', 'memo', 'maxlength="500" rows="2"'));
    if (c && h.isAdmin()) form.elements.memo.value = c.memo || '';
    syncCampaignForm(form);
  }

  function openExtend(id) {
    const c = mine.campaigns.find(item => item.id === id);
    modal('SHORT-FORM CAMPAIGN', '연장·증액', `<p>배포 건수를 늘리거나 종료일을 미룰 수 있어요. 기존 플랫폼은 등록 당시 단가, 새로 더하는 플랫폼은 현재 단가로 예산이 추가 배정됩니다.</p>
      <form class="form" data-form="shortform/campaign/extend"><input type="hidden" name="id" value="${c.id}">
        <fieldset class="sf-count-set"><legend>추가 배포 건수</legend>${platformKeys.map(p => {
          const unit = c.items[p]?.cost ?? mine.rates[c.mode][p].cost;
          return `<label class="sf-count">${chip(p)}<span>${c.items[p] ? `현재 ${format(c.items[p].count)}건 · ` : '새로 추가 · '}건당 ${won(unit)}</span><input name="add_${p}" type="number" min="0" max="1000" value="0" data-unit="${unit}" aria-label="${platformName[p]} 추가 건수"><em>건</em></label>`;
        }).join('')}</fieldset>
        ${field('종료일', 'end', 'date', `required min="${c.end_date}" value="${c.end_date}"`)}
        <p class="form-hint" data-sf-extra>추가 예산 0원 · 사용 가능 잔액 ${won(mine.balance)}</p>${btn('연장·증액', 'type="submit"')}</form>`);
  }

  /* ---------- 부업회원 ---------- */
  async function loadMe() {
    me = await api('/api/shortform/me');
    return me;
  }
  const approved = () => me?.profile.status === 'approved';
  function statusBanner() {
    const p = me.profile;
    if (p.status === 'approved') return '';
    if (p.status === 'pending') return `<p class="notice">${icon('clock')} ${label()} 가입을 운영팀이 확인하고 있어요. 승인 전에도 SNS 채널을 미리 등록해 두면 함께 확인해 드려요.</p>`;
    if (p.status === 'suspended') return `<p class="notice warn">${icon('lock')} 이용이 정지된 계정입니다.${p.reason ? ` 사유: ${esc(p.reason)}` : ''} 문의하기로 연락해 주세요.</p>`;
    return `<section class="panel dash-block"><p class="notice warn">${icon('info')} 가입이 반려됐어요.${p.reason ? ` 사유: ${esc(p.reason)}` : ''} 내용을 보완해 다시 신청할 수 있어요.</p>
      <form class="form" data-form="shortform/creator/reapply">${select('주로 활동하는 SNS', 'main_platform', platformKeys.map(k => [k, platformLong[k]]))}
        ${textarea('활동 소개', 'intro', `required minlength="10" maxlength="500" rows="3" data-prefill="${esc(p.intro)}"`)}${btn('다시 신청', 'type="submit"')}</form></section>`;
  }

  async function creatorHome() {
    await loadMe();
    const todo = me.tasks.filter(t => ['accepted', 'revise', 'ready'].includes(t.status));
    const verified = me.channels.filter(c => c.status === 'verified').length;
    const steps = [['가입 승인', me.profile.status === 'approved'], ['SNS 채널 인증', verified > 0], ['캠페인 참여', me.tasks.length > 0], ['제작·게시', me.tasks.some(t => ['posted', 'approved', 'paid'].includes(t.status))], ['검수·정산', me.tasks.some(t => t.status === 'paid')]];
    const rows = Array.from({ length: 31 }, (_, i) => {
      const dayKey = new Date(Date.parse(h.today()) - (30 - i) * 86_400_000).toISOString().slice(0, 10);
      return { day: dayKey, total: me.earned.find(row => row.day === dayKey)?.total || 0 };
    });
    const open = me.jobs.filter(j => !j.mine && j.eligible.length).slice(0, 3);
    return `${statusBanner()}
      <section class="dash-hero participant sf-creator-hero"><div class="dash-hero-main"><span class="eyebrow">SHORT-FORM SIDE JOB</span><h2>내 부업 수익</h2>
          <div class="hero-balance"><span>출금 가능</span><strong>${format(me.balance)}<small> 원</small></strong></div>
          <div class="hero-actions"><a class="btn lime" href="/manage?tab=sfjobs">캠페인 찾기 ${icon('arrow')}</a></div></div>
        <dl class="hero-side"><div><dt>정산 예정</dt><dd>${won(me.pendingPay)}</dd></div><div><dt>누적 수익</dt><dd>${won(me.totalPaid)}</dd></div>
          <div><dt>누적 조회수</dt><dd>${format(me.totalViews)}</dd></div><div><dt>등급</dt><dd>${gradeName[me.profile.grade] || '일반'}</dd></div></dl></section>
      <ol class="sf-progress">${steps.map(([text, done], i) => `<li class="${done ? 'done' : ''}"><span>${done ? icon('check') : i + 1}</span>${text}</li>`).join('')}</ol>
      <div class="dash-grid g-1-1"><section class="panel">${panelHead('지금 할 일', todo.length ? `${format(todo.length)}건` : '')}
          ${todo.length ? `<ul class="sf-todo">${todo.map(t => `<li><a href="/manage?tab=sftasks">${chip(t.platform)}<b>${esc(t.title)}</b><small>${taskStatus[t.status][0]} · ${dueText(t.due_at)}</small></a></li>`).join('')}</ul>`
            : verified ? empty('진행할 작업이 없어요. 새 캠페인에 참여해 보세요.') : empty('먼저 SNS 채널을 등록하고 인증을 받아 주세요. <a href="/manage?tab=sfchannels">채널 등록하기</a>')}</section>
        <section class="panel">${panelHead('최근 31일 정산', `합계 ${won(rows.reduce((s, r) => s + r.total, 0))}`)}${h.barChart(rows, [{ key: 'total', label: '정산', cls: 'c2' }], { unit: '원', label: '일별 정산', height: 200 })}</section></div>
      <section class="panel dash-block">${panelHead('참여할 수 있는 캠페인', '', `<a class="more" href="/manage?tab=sfjobs">전체보기 ${icon('chevron')}</a>`)}
        ${open.length ? `<div class="order-grid">${open.map(jobCard).join('')}</div>` : empty(approved() ? '지금 내 채널로 참여할 수 있는 캠페인이 없어요.' : '승인과 채널 인증을 마치면 참여할 수 있는 캠페인이 표시돼요.')}</section>`;
  }

  function jobCard(job) {
    const slots = Object.entries(job.slots);
    const maxPay = Math.max(...slots.map(([, s]) => s.pay));
    const canJoin = approved() && !job.mine && job.eligible.length;
    return `<article class="panel order-card sf-job"><div class="row-top"><span class="eyebrow">${modeName[job.mode]} · ${job.selection === 'manual' ? '선정형' : '선착순'}</span>${job.mine ? tag(taskStatus[job.mine]) : `<span class="sf-pay">최대 ${won(maxPay)}</span>`}</div>
      <h3>${esc(job.title)}</h3><p>${esc(job.brand)} · ~${job.end_date} · ${job.length_sec}초${job.min_followers ? ` · 팔로워 ${followers(job.min_followers)}+` : ''}${job.draft_review ? ' · 시안 검토' : ''}</p>
      <ul class="sf-slots">${slots.map(([p, s]) => `<li class="${s.left ? '' : 'full'}">${chip(p)}<span>${s.left ? `${format(s.left)}자리 남음` : '마감'}</span><b>${won(s.pay)}</b></li>`).join('')}</ul>
      <div class="actions">${btn(canJoin ? '가이드 보고 참여하기' : '가이드 보기', `type="button" data-sf-job="${job.id}"`, canJoin ? 'primary small' : 'quiet small')}</div></article>`;
  }

  async function jobsView(params) {
    await loadMe();
    const filter = platformKeys.includes(params.get('platform')) ? params.get('platform') : '';
    const list = me.jobs.filter(j => !filter || j.slots[filter]);
    const verified = me.channels.filter(c => c.status === 'verified');
    return `${statusBanner()}${approved() && !verified.length ? `<p class="notice">${icon('info')} 인증된 SNS 채널이 있어야 참여할 수 있어요. <a href="/manage?tab=sfchannels">채널 등록하기</a></p>` : ''}
      <div class="tabs">${[['', '전체'], ...platformKeys.map(p => [p, platformName[p]])].map(([key, text]) => `<a href="/manage?tab=sfjobs${key ? '&amp;platform=' + key : ''}" class="${key === filter ? 'on' : ''}">${text} <span class="count">${format(key ? me.jobs.filter(j => j.slots[key]).length : me.jobs.length)}</span></a>`).join('')}</div>
      ${list.length ? `<div class="order-grid">${list.map(jobCard).join('')}</div>` : empty('지금 모집 중인 캠페인이 없어요. 새 캠페인이 열리면 알려 드릴게요.')}`;
  }

  function briefHtml(c) {
    return `<dl class="ow-kv sf-guide">${[['상품·서비스', c.product], [c.mode === 'produce' ? '제작 가이드' : '게시 안내', c.guide], ['필수 해시태그', c.hashtags], ['필수 문구·계정 태그', c.mention], ['금지 표현', c.forbidden]]
      .filter(([, v]) => v).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}
      ${c.source_url ? `<div><dt>${c.mode === 'distribute' ? '배포할 영상' : '참고 자료'}</dt><dd>${ext(c.source_url, short(c.source_url))}</dd></div>` : ''}
      ${c.landing_url ? `<div><dt>연결 링크</dt><dd>${ext(c.landing_url, short(c.landing_url))}</dd></div>` : ''}
      <div><dt>조건</dt><dd>${c.length_sec}초 이하 세로 영상 · 게시 후 ${c.keep_days}일 이상 유지${c.draft_review ? ' · 게시 전 시안 검토' : ''}</dd></div></dl>`;
  }

  function openJob(id) {
    const job = me.jobs.find(j => j.id === id);
    const channels = me.channels.filter(c => job.eligible.includes(c.id));
    const reason = !approved() ? `${label()} 승인 후 참여할 수 있어요.` : job.mine ? `이미 참여한 캠페인이에요. (${taskStatus[job.mine][0]})`
      : !channels.length ? (me.channels.some(c => c.status === 'verified' && job.slots[c.platform]) ? '내 채널의 플랫폼 자리가 찼거나 팔로워 조건에 맞지 않아요.' : `이 캠페인의 플랫폼(${Object.keys(job.slots).map(p => platformName[p]).join('·')})에 인증된 채널이 필요해요.`) : '';
    modal('SHORT-FORM JOB', esc(job.title), `<p>${modeName[job.mode]} · ${esc(job.brand)} · ${job.start_date} ~ ${job.end_date} · ${job.selection === 'manual' ? '광고주가 신청자 중에서 선정해요' : '신청하면 바로 선정돼요'}</p>
      <ul class="sf-slots">${Object.entries(job.slots).map(([p, s]) => `<li class="${s.left ? '' : 'full'}">${chip(p)}<span>${s.left ? `${format(s.left)} / ${format(s.count)}자리` : '마감'}</span><b>${won(s.pay)}</b></li>`).join('')}</ul>
      ${briefHtml(job)}
      ${reason ? `<p class="notice">${reason}</p>` : `<form class="form" data-form="shortform/join"><input type="hidden" name="campaign" value="${job.id}">
        ${select('참여할 내 채널', 'channel', channels.map(c => [c.id, `${platformName[c.platform]} @${c.handle} · 팔로워 ${followers(c.followers)} · ${won(job.slots[c.platform].pay)}`]))}
        ${field('광고주에게 한마디 (선택)', 'note', 'text', 'maxlength="300" placeholder="예: 매장 근처에 살아서 직접 방문 촬영 가능해요"')}
        <label class="check"><input type="checkbox" name="agree" value="1" required> 가이드를 지키고, 게시물을 ${job.keep_days}일 이상 유지할게요. 선정 후 ${me.policy.dueDays}일 안에 제출하지 않으면 자동 취소돼요.</label>
        ${btn(job.selection === 'manual' ? '참여 신청' : '참여하기', 'type="submit"')}</form>`}`, true);
  }

  async function tasksViewCreator(params) {
    await loadMe();
    const groups = { doing: ['applied', 'accepted', 'drafted', 'revise', 'ready'], review: ['posted', 'approved'], done: ['paid'], ended: ['declined', 'canceled', 'expired', 'rejected', 'revoked'] };
    const current = Object.hasOwn(groups, params.get('filter')) ? params.get('filter') : 'doing';
    const names = { doing: '진행 중', review: '검수·정산 대기', done: '정산 완료', ended: '종료' };
    const list = me.tasks.filter(t => groups[current].includes(t.status));
    return `${statusBanner()}<div class="tabs">${Object.keys(groups).map(key => `<a href="/manage?tab=sftasks&amp;filter=${key}" class="${key === current ? 'on' : ''}">${names[key]} <span class="count">${format(me.tasks.filter(t => groups[key].includes(t.status)).length)}</span></a>`).join('')}</div>
      ${list.length ? `<div class="order-grid">${list.map(taskCard).join('')}</div>` : empty(current === 'doing' ? '진행 중인 작업이 없어요. <a href="/manage?tab=sfjobs">캠페인 찾기</a>' : '해당하는 작업이 없어요.')}`;
  }

  function taskCard(t) {
    const draftNeeded = t.mode === 'produce' && t.draft_review === 1;
    const canPost = t.status === 'ready' || (t.status === 'accepted' && !draftNeeded);
    const actions = [];
    if (['accepted', 'revise'].includes(t.status) && draftNeeded) actions.push(btn(t.status === 'revise' ? '시안 다시 제출' : '시안 제출', `type="button" data-sf-draft="${t.id}"`, 'primary small'));
    if (canPost) actions.push(btn('게시물 주소 제출', `type="button" data-sf-post="${t.id}"`, 'primary small'));
    if (['posted', 'approved', 'paid'].includes(t.status)) actions.push(btn('조회수 입력', `type="button" data-sf-metrics="${t.id}"`, 'quiet small'));
    if (['applied', 'accepted', 'drafted', 'revise', 'ready'].includes(t.status)) actions.push(act('task/cancel', t.id, 'cancel', t.status === 'applied' ? '신청 취소' : '작업 취소'));
    const info = {
      applied: '광고주가 신청자를 검토하고 있어요.', accepted: draftNeeded ? '가이드에 맞춰 영상을 만들고 시안 링크(구글 드라이브·비공개 유튜브 등)를 제출해 주세요.' : '가이드에 맞춰 내 채널에 게시하고 게시물 주소를 제출해 주세요.',
      drafted: '시안을 검토하고 있어요. 승인되면 게시할 수 있어요.', revise: '수정 요청을 반영해 시안을 다시 제출해 주세요.', ready: t.post_url ? '게시물 수정 요청이 있어요. 고친 뒤 다시 제출해 주세요.' : '시안이 승인됐어요. 내 채널에 게시하고 주소를 제출해 주세요.',
      posted: '운영팀이 게시물을 검수하고 있어요.', approved: `승인됐어요. 게시물을 유지하면 ${t.settle_at ? dateTime(new Date(t.settle_at).toISOString()) : ''}에 정산돼요.`, paid: `${dateTime(t.paid)} 정산 완료`
    }[t.status];
    return `<article class="panel order-card sf-task"><div class="row-top"><span class="eyebrow">${modeName[t.mode]} · 작업 #${t.id}</span>${tag(taskStatus[t.status])}</div>
      <h3>${esc(t.title)}</h3><p>${chip(t.platform)} @${esc(t.handle)} · ${esc(t.brand)} · 지급 <b>${won(t.pay)}</b></p>
      ${info ? `<p class="form-hint">${info}</p>` : ''}
      ${t.due_at && ['accepted', 'revise', 'ready'].includes(t.status) ? `<p class="sf-due">${icon('clock')} ${dueText(t.due_at)}</p>` : ''}
      ${t.feedback && ['revise', 'ready'].includes(t.status) ? `<p class="order-note">요청 · ${esc(t.feedback)}</p>` : ''}
      ${t.reason && ['declined', 'canceled', 'expired', 'rejected', 'revoked'].includes(t.status) ? `<p class="order-note">${esc(t.reason)}</p>` : ''}
      ${t.post_url ? `<a class="sf-post-link" href="${esc(t.post_url)}" target="_blank" rel="noopener noreferrer">${icon('play')}<span>${esc(short(t.post_url, 44))}</span>${icon('chevron')}</a>` : ''}
      ${t.views !== null ? `<div class="review-signals"><span>조회 ${format(t.views)}</span>${t.likes !== null ? `<span>좋아요 ${format(t.likes)}</span>` : ''}${t.comments !== null ? `<span>댓글 ${format(t.comments)}</span>` : ''}<span>${dateTime(t.metrics_at)} 기준</span></div>` : ''}
      <details class="sf-brief"><summary>캠페인 가이드</summary>${briefHtml(t)}</details>
      <div class="actions">${actions.join('')}</div></article>`;
  }

  function proofPicker(name, text) {
    return `<div class="sf-proof"><input type="hidden" name="${name}" value=""><span class="sf-proof-preview">없음</span>
      <label class="btn quiet small">${text}<input type="file" accept="image/*" data-sf-image="${name}" hidden></label><small>JPG로 자동 변환 · 위치 정보 제거</small></div>`;
  }
  function openDraft(id) {
    const t = me.tasks.find(item => item.id === id);
    modal('SHORT-FORM DRAFT', '시안 제출', `<p>${esc(t.title)} · ${chip(t.platform)} @${esc(t.handle)}</p>${t.feedback && t.status === 'revise' ? `<p class="order-note">요청 · ${esc(t.feedback)}</p>` : ''}
      <form class="form" data-form="shortform/task/draft"><input type="hidden" name="id" value="${t.id}">
        ${field('시안 영상 주소 (https)', 'url', 'url', 'required maxlength="1000" placeholder="구글 드라이브 공유 링크, 비공개 유튜브 등"')}
        ${textarea('시안 설명 (선택)', 'note', 'maxlength="500" rows="3" placeholder="구성 의도, 사용한 음원 등"')}
        <p class="form-hint">시안은 광고주만 볼 수 있는 링크로 올려 주세요. 승인되면 내 채널에 게시합니다.</p>${btn('시안 제출', 'type="submit"')}</form>`);
  }
  function openPost(id) {
    const t = me.tasks.find(item => item.id === id);
    const example = { youtube: 'https://youtube.com/shorts/영상ID', instagram: 'https://www.instagram.com/reel/코드', facebook: 'https://www.facebook.com/reel/숫자', tiktok: `https://www.tiktok.com/@${t.handle}/video/숫자` }[t.platform];
    modal('SHORT-FORM POST', '게시물 주소 제출', `<p>${esc(t.title)} · ${chip(t.platform)} @${esc(t.handle)}</p>${t.feedback && t.status === 'ready' ? `<p class="order-note">요청 · ${esc(t.feedback)}</p>` : ''}
      <ul class="sf-checklist">${[t.hashtags && `해시태그 ${esc(t.hashtags)}`, t.mention && `${esc(t.mention)}`, t.forbidden && `금지 ${esc(t.forbidden)}`, `게시 후 ${t.keep_days}일 이상 유지`].filter(Boolean).map(item => `<li>${item}</li>`).join('')}</ul>
      <form class="form" data-form="shortform/task/post"><input type="hidden" name="id" value="${t.id}">
        ${field(`${platformLong[t.platform]} 게시물 주소`, 'url', 'url', `required maxlength="1000" placeholder="${esc(example)}"`)}
        ${proofPicker('proof_id', '게시 화면 캡처 올리기 (선택)')}
        ${field('메모 (선택)', 'note', 'text', 'maxlength="300"')}
        <p class="form-hint">등록한 채널(@${esc(t.handle)})에 공개로 올린 게시물만 인정돼요. 같은 게시물은 한 번만 제출할 수 있어요.</p>${btn('제출하고 검수 요청', 'type="submit"')}</form>`);
  }
  function openMetrics(id) {
    const t = me.tasks.find(item => item.id === id);
    modal('SHORT-FORM REPORT', '성과 입력', `<p>${esc(t.title)} · ${chip(t.platform)} ${ext(t.post_url, short(t.post_url, 36))}</p>
      <form class="form" data-form="shortform/task/metrics"><input type="hidden" name="id" value="${t.id}">
        <div class="two">${field('조회수', 'views', 'number', `required min="0" max="2000000000" value="${t.views ?? ''}"`)}${field('좋아요 (선택)', 'likes', 'number', `min="0" max="2000000000" value="${t.likes ?? ''}"`)}</div>
        <div class="two">${field('댓글 (선택)', 'comments', 'number', `min="0" max="2000000000" value="${t.comments ?? ''}"`)}<span></span></div>
        ${proofPicker('proof_id', '인사이트 캡처 올리기 (선택)')}
        <p class="form-hint">입력한 성과는 광고주 리포트에 표시돼요. 캡처를 함께 올리면 신뢰도가 높아집니다.</p>${btn('저장', 'type="submit"')}</form>`);
  }

  async function channelsViewCreator() {
    await loadMe();
    return `${statusBanner()}<div class="dash-grid g-1-1"><section class="panel">${panelHead('SNS 채널 등록', '유튜브·인스타그램·페이스북·틱톡 계정을 등록하고 인증을 받으면 해당 플랫폼 캠페인에 참여할 수 있어요.')}
        <form class="form" data-form="shortform/channel">${select('SNS', 'platform', platformKeys.map(k => [k, platformLong[k]]))}
          <div class="two">${field('계정 이름 (@ 뒤)', 'handle', 'text', 'required maxlength="60" placeholder="mychannel" autocomplete="off"')}${field('팔로워(구독자) 수', 'followers', 'number', 'required min="0" max="100000000" placeholder="0"')}</div>
          ${field('채널 주소 (https)', 'url', 'url', 'required maxlength="1000" placeholder="https://www.instagram.com/mychannel"')}
          ${field('채널 분야 (선택)', 'category', 'text', 'maxlength="40" placeholder="뷰티, 맛집, 육아, 여행…"')}
          ${proofPicker('proof_id', '프로필 화면 캡처 (선택)')}
          <p class="form-hint">등록하면 인증 코드가 발급돼요. 코드를 채널 프로필 소개글에 잠시 넣어 두면 운영팀이 본인 채널인지 확인합니다. 비밀번호는 절대 받지 않아요.</p>
          ${btn('채널 등록하고 인증 요청', 'type="submit"')}</form></section>
      <section class="panel">${panelHead('내 채널', `${format(me.channels.length)}개`)}
        ${me.channels.length ? `<ul class="sf-channel-list">${me.channels.map(c => `<li><div>${chip(c.platform)} ${ext(c.url, '@' + c.handle)} ${tag(channelStatus[c.status])}<small>팔로워 ${format(c.followers)}${c.category ? ` · ${esc(c.category)}` : ''}</small>
            ${c.status !== 'verified' ? `<small>인증 코드 <code class="ow-code">${esc(c.code)}</code> ${btn('복사', `type="button" data-sf-copy="${esc(c.code)}"`, 'quiet small')}</small>` : ''}
            ${c.reason ? `<small class="ow-error-text">${esc(c.reason)}</small>` : ''}</div>
          <div class="row-actions">${c.status !== 'verified' ? btn('캡처로 인증', `type="button" data-sf-prove="${c.id}"`, 'quiet small') : ''}${act('channel/remove', c.id, 'remove', '삭제')}</div></li>`).join('')}</ul>` : empty('아직 등록한 채널이 없어요.')}</section></div>`;
  }

  function openProve(id) {
    const c = me.channels.find(item => item.id === id);
    modal('CHANNEL VERIFY', `@${esc(c.handle)} 인증`, `<p>프로필 소개글에 인증 코드 <code class="ow-code">${esc(c.code)}</code>가 보이도록 캡처해 올려 주세요. 운영팀이 확인 후 인증합니다.</p>
      <form class="form" data-form="shortform/channel/proof"><input type="hidden" name="id" value="${c.id}">${proofPicker('proof_id', '캡처 올리기')}${btn('인증 요청', 'type="submit"')}</form>`);
  }

  async function earnView(params) {
    await loadMe();
    const ledger = await api(`/api/ledger?wallet=earning&page=${params.get('page') || 1}`);
    const paid = me.tasks.filter(t => ['approved', 'paid'].includes(t.status));
    const net = Math.floor(me.balance * 0.967);
    return `<section class="dash-hero participant"><div class="dash-hero-main"><span class="eyebrow">SIDE JOB EARNINGS</span><h2>부업 수익</h2>
        <div class="hero-balance"><span>출금 가능</span><strong>${format(me.balance)}<small> 원</small></strong></div></div>
      <dl class="hero-side"><div><dt>정산 예정</dt><dd>${won(me.pendingPay)}</dd></div><div><dt>누적 정산</dt><dd>${won(me.totalPaid)}</dd></div>
        <div><dt>정산 보류 기간</dt><dd>승인 후 ${me.policy.holdDays}일</dd></div></dl></section>
      <div class="dash-grid g-1-1">${h.payoutPanel('earning')}
        <section class="panel">${panelHead('정산 내역', '승인된 배포')}
          <p class="form-hint">부업 수익은 사업소득으로 신고돼 지급 시 3.3%(소득세·지방소득세)를 떼고 보내 드려요. 지금 전액 출금 시 예상 실지급액 약 ${won(net)}.</p>
          ${paid.length ? `<div class="table-wrap"><table class="data-table compact"><thead><tr><th>캠페인</th><th>상태</th><th class="num">금액</th></tr></thead><tbody>
            ${paid.slice(0, 20).map(t => `<tr><td><b>${esc(t.title)}</b><small>${chip(t.platform)} @${esc(t.handle)}</small></td><td>${tag(taskStatus[t.status])}<small>${t.status === 'paid' ? dateTime(t.paid) : t.settle_at ? `${dateTime(new Date(t.settle_at).toISOString())} 예정` : ''}</small></td><td class="num">${won(t.pay)}</td></tr>`).join('')}</tbody></table></div>` : empty('아직 정산된 배포가 없어요.')}</section></div>
      <section class="panel dash-block">${panelHead('수익 원장', `${format(ledger.count)}건 · 거래 후 잔액 포함`, ledger.count ? `<a class="btn quiet small" href="/api/export?type=ledger&amp;wallet=earning" download>${icon('download')} 전체 CSV</a>` : '')}
        ${h.ledgerTable(ledger.items, '원')}${pager(ledger.page, ledger.pages, '/manage?tab=sfearn')}</section>`;
  }

  /* ---------- 이미지 업로드 ---------- */
  async function uploadImage(input) {
    const file = input.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type) || file.size > 15 * 1024 * 1024) return showToast('15MB 이하의 이미지 파일을 골라 주세요.');
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1080 / bitmap.width, 2400 / bitmap.height);
      const width = Math.max(200, Math.round(bitmap.width * scale));
      const height = Math.max(200, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      let blob;
      for (const quality of [0.86, 0.72, 0.58, 0.45]) {
        blob = await new Promise(done => canvas.toBlob(done, 'image/jpeg', quality));
        if (blob.size < 680 * 1024) break;
      }
      const response = await fetch('/api/shortform/asset', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '이미지를 올리지 못했어요.');
      const box = input.closest('.sf-proof');
      box.querySelector(`input[name="${input.dataset.sfImage}"]`).value = result.id;
      box.querySelector('.sf-proof-preview').innerHTML = `<img src="/api/shortform/image?id=${result.id}" alt="">`;
      showToast('이미지를 올렸어요.');
    } catch (error) {
      showToast(error.message || '이미지를 읽지 못했어요.');
    }
  }

  return {
    adminView,
    ownerView,
    creatorHome,
    jobsView,
    tasksView: tasksViewCreator,
    channelsView: channelsViewCreator,
    earnView,
    click(button) {
      const d = button.dataset;
      if ('sfCampaign' in d) {
        h.run(button, () => openCampaign(Number(d.sfCampaign)));
        return true;
      }
      if ('sfNew' in d) return openForm(0), true;
      if ('sfEdit' in d) return openForm(Number(d.sfEdit)), true;
      if ('sfExtend' in d) return openExtend(Number(d.sfExtend)), true;
      if ('sfCreator' in d) return openCreator(Number(d.sfCreator)), true;
      if ('sfJob' in d) return openJob(Number(d.sfJob)), true;
      if ('sfDraft' in d) return openDraft(Number(d.sfDraft)), true;
      if ('sfPost' in d) return openPost(Number(d.sfPost)), true;
      if ('sfMetrics' in d) return openMetrics(Number(d.sfMetrics)), true;
      if ('sfProve' in d) return openProve(Number(d.sfProve)), true;
      if ('sfCopy' in d) {
        navigator.clipboard?.writeText(d.sfCopy).then(() => showToast('복사했습니다.'), () => showToast('복사하지 못했어요. 직접 선택해 복사해 주세요.'));
        return true;
      }
      if ('sfAct' in d) {
        reopen = dialog.open && detail && dialog.querySelector('.sf-task-table') ? detail.campaign.id : 0;
        const key = `${d.sfAct}:${d.action}`;
        const followerValue = d.extra.startsWith('followers:') ? d.extra.slice(10) : '';
        const danger = ['reject', 'cancel', 'revoke', 'suspend', 'remove', 'decline'].includes(d.action);
        modal('SHORT-FORM', `${d.label} 확인`, `<p>${actExplain[key] || `선택한 항목을 ${d.label} 처리합니다.`}</p>
          <form class="form" data-form="shortform/${d.sfAct}"><input type="hidden" name="id" value="${esc(d.id)}"><input type="hidden" name="action" value="${esc(d.action)}">
            ${d.extra === 'views' ? field('확인한 조회수 (선택)', 'views', 'number', 'min="0" max="2000000000" placeholder="비워 두면 부업회원 입력값 유지"') : ''}
            ${followerValue ? field('확인한 팔로워 수', 'followers', 'number', `required min="0" max="100000000" value="${esc(followerValue)}"`) : ''}
            ${d.reason ? textarea(d.reason === 'required' ? '사유·요청 내용' : '메모 (선택)', 'reason', `${d.reason === 'required' ? 'required ' : ''}maxlength="300" rows="3"`) : ''}
            ${btn(d.label, 'type="submit"', danger ? 'danger' : 'primary')}</form>`);
        return true;
      }
      return false;
    },
    input(event) {
      const target = event.target;
      if (target.matches?.('[data-sf-image]')) return uploadImage(target);
      const form = target.form;
      if (!form) return;
      if (form.dataset.form === 'shortform/campaign') syncCampaignForm(form);
      if (form.dataset.form === 'shortform/campaign/extend') {
        const extra = platformKeys.reduce((sum, p) => sum + Number(form.elements[`add_${p}`].value || 0) * Number(form.elements[`add_${p}`].dataset.unit), 0);
        form.querySelector('[data-sf-extra]').innerHTML = `추가 예산 <b>${won(extra)}</b> · 사용 가능 잔액 ${won(mine.balance)}${extra > mine.balance ? ' · <span class="minus">잔액 부족</span>' : ''}`;
      }
      if (form.dataset.form === 'shortform/settings' && /_(cost|pay)$/.test(target.name)) {
        const base = target.name.replace(/_(cost|pay)$/, '');
        form.querySelector(`[data-sf-margin="${base}"]`).textContent = won(Number(form.elements[`${base}_cost`].value || 0) - Number(form.elements[`${base}_pay`].value || 0));
      }
    },
    // 저장 후 안내. true면 기본 안내를 건너뜁니다.
    after(path, result, data) {
      const messages = {
        'shortform/campaign': `숏폼 캠페인을 등록했어요. 예산 ${won(result?.budget)}을 배정했고, 운영팀 심사 후 모집이 시작돼요.`,
        'shortform/campaign/update': '캠페인 내용을 저장했어요.',
        'shortform/campaign/extend': result?.extra ? `연장·증액했어요. 추가 예산 ${won(result.extra)}을 배정했어요.` : '종료일을 변경했어요.',
        'shortform/campaign/status': { approve: '캠페인을 승인했어요. 모집이 시작됩니다.', reject: '캠페인을 반려했어요. 예산은 광고 계정으로 돌아갔어요.', pause: '캠페인을 일시중지했어요.', resume: '캠페인을 다시 열었어요.',
          close: result?.returned ? `캠페인을 종료했어요. 남은 예산 ${won(result.returned)}을 돌려드렸어요.` : '캠페인을 종료·정산했어요.', cancel: '등록을 취소했어요. 예산을 모두 돌려드렸어요.' }[data?.action],
        'shortform/task/select': data?.action === 'accept' ? '선정했어요. 부업회원에게 알림을 보냈어요.' : '미선정 처리했어요.',
        'shortform/task/draft-review': data?.action === 'approve' ? '시안을 승인했어요.' : '수정을 요청했어요.',
        'shortform/task/review': { approve: '배포를 승인했어요. 정산 보류 기간 뒤 지급됩니다.', redo: '게시물 수정을 요청했어요.', reject: '배포를 반려했어요.' }[data?.action],
        'shortform/task/settle': data?.action === 'settle' ? '즉시 정산했어요.' : '승인을 취소했어요.',
        'shortform/task/metrics': '성과를 저장했어요.',
        'shortform/join': result?.status === 'accepted' ? '참여 완료! 가이드를 확인하고 작업을 시작해 주세요.' : '참여를 신청했어요. 광고주가 선정하면 알려 드릴게요.',
        'shortform/task/cancel': '작업을 취소했어요.',
        'shortform/task/draft': '시안을 제출했어요. 검토 결과를 알려 드릴게요.',
        'shortform/task/post': '게시물을 제출했어요. 운영팀 검수 후 승인돼요.',
        'shortform/channel/proof': '인증 화면을 올렸어요. 운영팀이 확인할게요.',
        'shortform/channel/remove': '채널을 삭제했어요.',
        'shortform/channel/decision': { verify: '채널을 인증했어요.', reject: '채널 인증을 반려했어요.', followers: '팔로워 수를 갱신했어요.' }[data?.action],
        'shortform/creator/reapply': '다시 신청했어요. 운영팀이 확인할게요.',
        'shortform/creator/decision': { approve: '가입을 승인했어요.', reject: '가입을 반려했어요.', suspend: '이용을 정지했어요.', activate: '정지를 해제했어요.' }[data?.action],
        'shortform/creator/update': '저장했어요.',
        'shortform/settings': '단가·정책을 저장했어요.'
      };
      if (path === 'shortform/channel') {
        modal('CHANNEL VERIFY', '채널을 등록했어요', `<p>아래 인증 코드를 채널 <b>프로필 소개글</b>에 넣어 주세요. 운영팀이 코드를 확인하면 인증이 끝나고, 그 뒤에는 지워도 됩니다.</p>
          <p class="sf-code"><code class="ow-code">${esc(result.code)}</code> ${btn('복사', `type="button" data-sf-copy="${esc(result.code)}"`, 'quiet small')}</p>
          <p class="form-hint">소개글을 바꾸기 어렵다면 ‘캡처로 인증’으로 프로필 화면을 올려도 돼요.</p>`);
        return true;
      }
      if (path === 'shortform/campaign') h.go('/manage?tab=sfads');
      showToast(messages[path] || '처리했어요.');
      if (reopen && ['shortform/task/select', 'shortform/task/draft-review', 'shortform/task/review', 'shortform/task/settle'].includes(path)) {
        const id = reopen;
        reopen = 0;
        openCampaign(id).catch(() => {});
      }
      return true;
    }
  };
}
