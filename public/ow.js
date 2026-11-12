// 오퍼월 매체(버즈빌·애드팝콘 등)에서 들어온 회원이 퀴즈·설문에 참여하는 페이지입니다.
const root = document.getElementById('ow');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const format = value => new Intl.NumberFormat('ko-KR').format(value);
const parts = location.pathname.split('/').filter(Boolean);
const slug = parts[1];
const preview = new URLSearchParams(location.search).get('preview') === '1';
const suffix = preview ? '?preview=1' : '';
let data;
let offset = 0;
let timer;

const kindName = { quiz: '브랜드 퀴즈', survey: '설문 조사' };
const results = {
  completed: ['참여 완료', '참여가 확인됐어요. 리워드는 참여하신 앱에서 잠시 후 지급됩니다.', 'done'],
  pending: ['답변 검수 중', '답변을 확인한 뒤 리워드가 지급돼요. 결과는 참여하신 앱에서 확인해 주세요.', 'wait'],
  failed: ['아쉬워요', '정답과 일치하지 않아 리워드를 받을 수 없어요. 다른 미션에 도전해 보세요.', 'fail'],
  rejected: ['답변 반려', '답변이 검수 기준에 맞지 않아 리워드가 지급되지 않았어요.', 'fail'],
  expired: ['참여 시간이 지났어요', '참여하신 앱의 미션 목록에서 다시 들어와 주세요.', 'fail'],
  full: ['모집이 마감됐어요', '아쉽게도 방금 참여 인원이 모두 찼어요. 다른 미션에 참여해 주세요.', 'fail'],
  closed: ['종료된 미션이에요', '지금은 참여를 받지 않는 미션입니다. 다른 미션에 참여해 주세요.', 'fail']
};
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
const marks = {
  done: '<path d="m7 12.5 3.2 3.2L17 9"/>',
  wait: '<circle cx="12" cy="12" r="0.5"/><path d="M12 7.5V12l3 2"/>',
  fail: '<path d="M12 8v5m0 3.2h.01"/>'
};

function message(title, text, tone = 'fail') {
  root.innerHTML = `<section class="ow-result ${tone}"><span class="ow-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/>${marks[tone]}</svg></span>
    <h1>${esc(title)}</h1><p>${esc(text)}</p>${preview ? '<p class="ow-preview-note">미리보기 결과입니다. 기록과 포스트백은 남지 않아요.</p>' : ''}</section>`;
  root.focus();
}

function result(status, extra = '') {
  const [title, text, tone] = results[status] || results.closed;
  message(title, extra || text, tone);
}

function render(notice = '') {
  const { offer, click } = data;
  if (click.status !== 'started') return result(click.status, click.status === 'rejected' && click.reason ? `사유: ${click.reason}` : '');
  const quiz = offer.kind === 'quiz';
  root.innerHTML = `${preview ? '<p class="ow-preview">관리자 미리보기 · 제출해도 기록되지 않아요</p>' : ''}
    <header class="ow-head"><span class="ow-tag">${kindName[offer.kind]} · ${esc(offer.brand)}</span><h1>${esc(offer.title)}</h1>
      ${offer.reward !== undefined ? `<p class="ow-reward"><b>${format(offer.reward)}</b> 리워드 · ${esc(offer.network)}에서 지급</p>` : ''}</header>
    <section class="ow-intro"><p>${esc(offer.intro).replace(/\n/g, '<br>')}</p></section>
    ${notice ? `<p class="ow-notice" role="alert">${esc(notice)}</p>` : ''}
    <form class="ow-form" novalidate>
      ${offer.questions.map((question, i) => `<fieldset class="ow-question"><legend><span>Q${i + 1}</span>${esc(question.prompt)}</legend>
        ${quiz ? question.choices.map((choice, c) => `<label class="ow-choice"><input type="radio" name="q${i}" value="${c}" required><span>${esc(choice)}</span></label>`).join('')
          : `<textarea name="q${i}" rows="4" minlength="5" maxlength="1000" required placeholder="5자 이상 입력해 주세요"></textarea>`}</fieldset>`).join('')}
      <p class="ow-error" role="alert" hidden></p>
      ${quiz && offer.attempts > 1 ? `<p class="ow-hint">남은 응시 기회 ${format(click.triesLeft)}번</p>` : ''}
      <button class="ow-submit" type="submit" disabled>제출하기</button>
    </form>`;
  const form = root.querySelector('form');
  const button = form.querySelector('button');
  const ready = () => {
    const left = Math.ceil(offer.minDwell - (Date.now() + offset - click.opened) / 1000);
    if (left > 0) {
      button.disabled = true;
      button.textContent = `내용을 읽어 주세요 · ${left}초`;
      return false;
    }
    button.disabled = false;
    button.textContent = '제출하기';
    return true;
  };
  clearInterval(timer);
  if (!ready()) timer = setInterval(() => ready() && clearInterval(timer), 500);
  form.addEventListener('submit', event => {
    event.preventDefault();
    submit(form, button);
  });
}

async function submit(form, button) {
  const error = form.querySelector('.ow-error');
  error.hidden = true;
  const quiz = data.offer.kind === 'quiz';
  const answers = data.offer.questions.map((_, i) => quiz ? form.querySelector(`input[name="q${i}"]:checked`)?.value : form.elements[`q${i}`].value.trim());
  const missing = answers.findIndex(value => value === undefined || value === '' || (!quiz && value.length < 5));
  if (missing >= 0) {
    error.textContent = quiz ? `${missing + 1}번 문항의 답을 골라 주세요.` : `${missing + 1}번 문항에 5자 이상 답해 주세요.`;
    error.hidden = false;
    return form.querySelector(`[name="q${missing}"]`)?.focus();
  }
  button.disabled = true;
  try {
    const response = await fetch(`/ow/${slug}/submit${suffix}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: quiz ? answers.map(Number) : answers }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || '제출하지 못했어요. 잠시 후 다시 시도해 주세요.');
    if (body.status === 'retry') {
      data.click.triesLeft = body.triesLeft;
      return render(`정답이 아닌 문항이 있어요. 남은 기회 ${body.triesLeft}번 · 내용을 다시 확인해 보세요.`);
    }
    result(body.status);
  } catch (failure) {
    error.textContent = failure.message;
    error.hidden = false;
    button.disabled = false;
  }
}

async function load() {
  if (parts[1] === 'expired') return message('미션을 열 수 없어요', reasons[new URLSearchParams(location.search).get('r')] || reasons.params);
  try {
    const response = await fetch(`/ow/${slug}/state${suffix}`);
    const body = await response.json();
    if (!response.ok) return message('미션을 열 수 없어요', body.error || '참여하신 앱에서 다시 들어와 주세요.');
    data = body;
    offset = body.now - Date.now();
    document.title = `${body.offer.title} | 애즈폼`;
    render();
  } catch {
    message('연결이 불안정해요', '네트워크 상태를 확인한 뒤 다시 시도해 주세요.');
  }
}
load();
