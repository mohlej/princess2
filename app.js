const STORAGE_KEY = window.PrincessData.key('planner');
const subjectsList = document.getElementById('subjectsList');
const subjectTemplate = document.getElementById('subjectTemplate');
const resultSection = document.getElementById('resultSection');
const timeline = document.getElementById('timeline');
const saveStatus = document.getElementById('saveStatus');

const els = {
  startTime: document.getElementById('startTime'),
  defaultStudy: document.getElementById('defaultStudy'),
  breakTime: document.getElementById('breakTime'),
  longBreakEvery: document.getElementById('longBreakEvery'),
  longBreakTime: document.getElementById('longBreakTime'),
  totalDuration: document.getElementById('totalDuration'),
  studyDuration: document.getElementById('studyDuration'),
  finishTime: document.getElementById('finishTime'),
  nowTitle: document.getElementById('nowTitle'),
  nowSubtitle: document.getElementById('nowSubtitle'),
  nowProgress: document.getElementById('nowProgress')
};

let currentPlan = [];
let saveTimer;

const fa = new Intl.NumberFormat('fa-IR');
const pad = n => String(n).padStart(2, '0');

function nowTimeString() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function timeToMinutes(time) {
  if (!time || !time.includes(':')) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToClock(total) {
  const normalized = ((total % 1440) + 1440) % 1440;
  return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`;
}

function durationText(mins) {
  mins = Math.max(0, Math.round(mins));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${fa.format(h)} ساعت و ${fa.format(m)} دقیقه`;
  if (h) return `${fa.format(h)} ساعت`;
  return `${fa.format(m)} دقیقه`;
}

function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 1900);
}

function addSubject(data = {}) {
  const node = subjectTemplate.content.firstElementChild.cloneNode(true);
  const name = node.querySelector('.subject-name');
  const minutes = node.querySelector('.subject-minutes');
  const rounds = node.querySelector('.subject-rounds');

  name.value = data.name || '';
  minutes.value = data.minutes || Number(els.defaultStudy.value) || 45;
  rounds.value = data.rounds || 1;

  node.querySelector('.round-minus').addEventListener('click', () => {
    rounds.value = Math.max(1, Number(rounds.value) - 1);
    autoSave();
  });

  node.querySelector('.round-plus').addEventListener('click', () => {
    rounds.value = Math.min(20, Number(rounds.value) + 1);
    autoSave();
  });

  node.querySelector('.delete-subject').addEventListener('click', () => {
    if (subjectsList.children.length === 1) {
      name.value = '';
      minutes.value = Number(els.defaultStudy.value) || 45;
      rounds.value = 1;
    } else {
      node.remove();
    }
    autoSave();
  });

  node.querySelectorAll('input').forEach(input => input.addEventListener('input', autoSave));
  subjectsList.appendChild(node);
}

function getSubjects() {
  return [...subjectsList.querySelectorAll('.subject-row')].map(row => ({
    name: row.querySelector('.subject-name').value.trim(),
    minutes: Math.max(5, Number(row.querySelector('.subject-minutes').value) || Number(els.defaultStudy.value) || 45),
    rounds: Math.max(1, Number(row.querySelector('.subject-rounds').value) || 1)
  }));
}

function getState() {
  return {
    startTime: els.startTime.value,
    defaultStudy: Number(els.defaultStudy.value) || 45,
    breakTime: Number(els.breakTime.value) || 0,
    longBreakEvery: Number(els.longBreakEvery.value) || 0,
    longBreakTime: Number(els.longBreakTime.value) || 30,
    subjects: getSubjects(),
    planBuilt: !resultSection.classList.contains('hidden')
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getState()));
  saveStatus.textContent = 'ذخیره شد ✓';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveStatus.textContent = 'همه‌چیز خودکار ذخیره می‌شود 💗', 1300);
}

function autoSave() {
  clearTimeout(saveTimer);
  saveStatus.textContent = 'در حال ذخیره…';
  saveTimer = setTimeout(saveState, 250);
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    els.startTime.value = nowTimeString();
    addSubject({name:'جغرافیا', rounds:1});
    addSubject({name:'زبان', rounds:1});
    return;
  }

  try {
    const s = JSON.parse(raw);
    els.startTime.value = s.startTime || nowTimeString();
    els.defaultStudy.value = s.defaultStudy ?? 45;
    els.breakTime.value = s.breakTime ?? 15;
    els.longBreakEvery.value = s.longBreakEvery ?? 3;
    els.longBreakTime.value = s.longBreakTime ?? 30;
    subjectsList.innerHTML = '';
    (s.subjects?.length ? s.subjects : [{}]).forEach(addSubject);
    if (s.planBuilt) buildPlan(false);
  } catch {
    els.startTime.value = nowTimeString();
    addSubject({name:'جغرافیا'});
  }
}

function buildPlan(scroll = true) {
  const subjects = getSubjects().filter(s => s.name);
  if (!subjects.length) {
    showToast('اول حداقل اسم یک درس را بنویس 🌸');
    subjectsList.querySelector('.subject-name')?.focus();
    return;
  }
  if (!els.startTime.value) {
    showToast('زمان شروع را انتخاب کن ⏰');
    els.startTime.focus();
    return;
  }

  const start = timeToMinutes(els.startTime.value);
  const shortBreak = Math.max(0, Number(els.breakTime.value) || 0);
  const longEvery = Math.max(0, Number(els.longBreakEvery.value) || 0);
  const longBreak = Math.max(0, Number(els.longBreakTime.value) || 0);
  const studyBlocks = subjects.flatMap(subject =>
    Array.from({length: subject.rounds}, (_, i) => ({ ...subject, round: i + 1 }))
  );

  let cursor = start;
  let studiedMinutes = 0;
  currentPlan = [];

  studyBlocks.forEach((block, index) => {
    const blockStart = cursor;
    const blockEnd = cursor + block.minutes;
    currentPlan.push({
      type: 'study',
      name: block.name,
      round: block.round,
      duration: block.minutes,
      start: blockStart,
      end: blockEnd
    });
    studiedMinutes += block.minutes;
    cursor = blockEnd;

    const isLast = index === studyBlocks.length - 1;
    if (!isLast) {
      const completed = index + 1;
      const shouldLongBreak = longEvery > 0 && completed % longEvery === 0;
      const breakDuration = shouldLongBreak ? longBreak : shortBreak;
      if (breakDuration > 0) {
        currentPlan.push({
          type: 'break',
          name: shouldLongBreak ? 'استراحت بلند' : 'استراحت کوتاه',
          duration: breakDuration,
          start: cursor,
          end: cursor + breakDuration
        });
        cursor += breakDuration;
      }
    }
  });

  const total = cursor - start;
  els.totalDuration.textContent = durationText(total);
  els.studyDuration.textContent = durationText(studiedMinutes);
  els.finishTime.textContent = minutesToClock(cursor) + (cursor >= 1440 ? ' +۱ روز' : '');

  renderTimeline();
  resultSection.classList.remove('hidden');
  updateNowStatus();
  saveState();

  if (scroll) {
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('برنامه‌ات آماده شد 👑');
  }
}

function renderTimeline() {
  timeline.innerHTML = '';
  currentPlan.forEach((item, index) => {
    const row = document.createElement('article');
    row.className = `timeline-item ${item.type === 'break' ? 'break' : 'study'}`;
    row.dataset.index = index;
    const detail = item.type === 'study'
      ? `دور ${fa.format(item.round)} • ${durationText(item.duration)}`
      : durationText(item.duration);

    row.innerHTML = `
      <div class="time-range">${minutesToClock(item.start)} – ${minutesToClock(item.end)}</div>
      <div class="timeline-rail"><span class="timeline-dot"></span></div>
      <div class="timeline-content">
        <strong>${item.type === 'study' ? '📚 ' : '☕ '}${escapeHtml(item.name)}</strong>
        <span>${detail}</span>
      </div>`;
    timeline.appendChild(row);
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

function updateNowStatus() {
  if (!currentPlan.length) return;
  const d = new Date();
  const now = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  const first = currentPlan[0];
  const last = currentPlan[currentPlan.length - 1];

  document.querySelectorAll('.timeline-item').forEach(el => el.classList.remove('active','done'));

  if (now < first.start) {
    els.nowTitle.textContent = 'برنامه هنوز شروع نشده 👑';
    els.nowSubtitle.textContent = `شروع برنامه ساعت ${minutesToClock(first.start)} است.`;
    els.nowProgress.style.width = '0%';
    return;
  }

  if (now >= last.end) {
    els.nowTitle.textContent = 'آفرین! برنامه‌ی امروز تمام شد 🎉';
    els.nowSubtitle.textContent = 'حالا وقتشه به خودت افتخار کنی 💗';
    els.nowProgress.style.width = '100%';
    document.querySelectorAll('.timeline-item').forEach(el => el.classList.add('done'));
    return;
  }

  const index = currentPlan.findIndex(item => now >= item.start && now < item.end);
  if (index < 0) return;
  const item = currentPlan[index];
  const progress = Math.min(100, Math.max(0, ((now - item.start) / (item.end - item.start)) * 100));

  document.querySelectorAll('.timeline-item').forEach((el, i) => {
    if (i < index) el.classList.add('done');
    if (i === index) el.classList.add('active');
  });

  els.nowTitle.textContent = item.type === 'study' ? `الان: ${item.name} 📖` : `الان: ${item.name} ☕`;
  els.nowSubtitle.textContent = `تا ساعت ${minutesToClock(item.end)} • حدود ${durationText(item.end - now)} مانده`;
  els.nowProgress.style.width = `${progress}%`;
}

function clearAllSubjects() {
  subjectsList.innerHTML = '';
  addSubject();
  resultSection.classList.add('hidden');
  currentPlan = [];
  saveState();
  showToast('لیست درس‌ها پاک شد');
}

function resetToday() {
  localStorage.removeItem(STORAGE_KEY);
  subjectsList.innerHTML = '';
  els.startTime.value = nowTimeString();
  els.defaultStudy.value = 45;
  els.breakTime.value = 15;
  els.longBreakEvery.value = 3;
  els.longBreakTime.value = 30;
  addSubject({name:'جغرافیا'});
  addSubject({name:'زبان'});
  resultSection.classList.add('hidden');
  currentPlan = [];
  saveState();
  window.scrollTo({top:0, behavior:'smooth'});
  showToast('یک روز تازه شروع شد ✨');
}

document.getElementById('addSubjectBtn').addEventListener('click', () => {
  addSubject();
  subjectsList.lastElementChild.querySelector('.subject-name').focus();
  autoSave();
});
document.getElementById('buildPlanBtn').addEventListener('click', () => buildPlan(true));
document.getElementById('clearAllBtn').addEventListener('click', clearAllSubjects);
document.getElementById('resetTodayBtn').addEventListener('click', resetToday);

[els.startTime, els.defaultStudy, els.breakTime, els.longBreakEvery, els.longBreakTime].forEach(el => {
  el.addEventListener('input', () => {
    autoSave();
    if (el === els.defaultStudy) {
      [...subjectsList.querySelectorAll('.subject-minutes')].forEach(inp => {
        if (!inp.value) inp.value = els.defaultStudy.value;
      });
    }
  });
});

loadState();
setInterval(updateNowStatus, 30000);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
