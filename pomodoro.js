/* تایمر مستقل پومودورو؛ برنامه‌ریز روزانه بدون تغییر کار می‌کند. */
(() => {
  'use strict';

  const STORAGE = 'princessPomodoro_v1';
  const TAB_STORAGE = 'princessActiveTab_v1';
  const MODES = {
    focus: { label: 'زمان مطالعه', finished: '🎉 زمان مطالعه تموم شد! حالا وقت یه استراحته 💗' },
    short: { label: 'استراحت کوتاه', finished: '🌷 استراحت کوتاه تموم شد! آماده‌ی ادامه‌ای؟' },
    long:  { label: 'استراحت بلند', finished: '✨ استراحت بلند تموم شد! با انرژی برگرد 🌸' }
  };
  const $ = id => document.getElementById(id);
  const el = {
    plannerTab: $('plannerTab'), pomodoroTab: $('pomodoroTab'),
    plannerPanel: $('plannerPanel'), pomodoroPanel: $('pomodoroPanel'),
    clock: $('pomodoroClock'), time: $('pomodoroTime'), modeLabel: $('pomodoroModeLabel'),
    status: $('pomodoroStatus'), finished: $('pomodoroFinished'), rounds: $('pomodoroRounds'),
    start: $('pomodoroStart'), pause: $('pomodoroPause'), reset: $('pomodoroReset'),
    focus: $('pomoFocusMinutes'), short: $('pomoShortMinutes'), long: $('pomoLongMinutes'),
    sound: $('pomoSoundEnabled'), test: $('pomoTestSound'), notify: $('pomoEnableNotifications'),
    soundHint: $('pomoSoundHint')
  };
  const baseTitle = document.title;
  const modeButtons = [...document.querySelectorAll('[data-pomo-mode]')];

  // Deadline بر اساس ساعت واقعی ثبت می‌شود؛ تأخیر setInterval در تب پس‌زمینه
  // باعث نمی‌شود شمارش زمان از کار بیفتد.
  const timer = { mode: 'focus', status: 'idle', remainingMs: 25 * 60000,
    totalMs: 25 * 60000, deadline: null, rounds: 0 };

  let audioContext = null;
  let scheduledAlarm = [];
  let scheduledDeadline = null;

  const minutesFor = mode => Math.round(Number(el[mode].value) || (mode === 'focus' ? 25 : mode === 'short' ? 5 : 15));
  const clamp = (n, low, high) => Math.min(high, Math.max(low, Number.isFinite(n) ? n : low));
  const currentDuration = () => minutesFor(timer.mode) * 60000;
  const persianNum = number => new Intl.NumberFormat('fa-IR').format(number);

  function persist() {
    try {
      localStorage.setItem(STORAGE, JSON.stringify({
        mode: timer.mode, status: timer.status, remainingMs: timer.remainingMs,
        totalMs: timer.totalMs, deadline: timer.deadline, rounds: timer.rounds,
        settings: { focus: minutesFor('focus'), short: minutesFor('short'), long: minutesFor('long'),
          sound: el.sound.checked }
      }));
    } catch { /* فضای ذخیره‌سازی ممکن است غیرفعال باشد. */ }
  }

  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
      if (!saved || typeof saved !== 'object') return;
      for (const name of ['focus', 'short', 'long']) {
        const field = el[name];
        const value = Number(saved.settings?.[name]);
        if (Number.isFinite(value) && value >= 1 && value <= Number(field.max)) field.value = value;
      }
      el.sound.checked = saved.settings?.sound !== false;
      if (Object.hasOwn(MODES, saved.mode)) timer.mode = saved.mode;
      const max = 180 * 60000;
      const savedTotal = Number(saved.totalMs);
      const savedRemaining = Number(saved.remainingMs);
      timer.totalMs = savedTotal > 0 && savedTotal <= max ? savedTotal : currentDuration();
      timer.remainingMs = Number.isFinite(savedRemaining) ? clamp(savedRemaining, 0, timer.totalMs) : timer.totalMs;
      timer.rounds = clamp(Math.floor(Number(saved.rounds) || 0), 0, 99999);
      if (saved.status === 'running' && Number.isFinite(saved.deadline) && saved.deadline > 0) {
        timer.status = 'running';
        timer.deadline = saved.deadline;
        timer.remainingMs = Math.max(0, timer.deadline - Date.now());
      } else if (saved.status === 'paused') {
        timer.status = 'paused';
      } else if (saved.status === 'finished') {
        timer.status = 'finished';
        timer.remainingMs = 0;
      } else {
        timer.status = 'idle';
        timer.totalMs = currentDuration();
        timer.remainingMs = timer.totalMs;
      }
    } catch { /* اگر اطلاعات خراب بود، از مقادیر پیش‌فرض شروع کن. */ }
  }

  function setTab(which, save = true) {
    const isPomo = which === 'pomodoro';
    el.plannerPanel.hidden = isPomo;
    el.plannerPanel.classList.toggle('hidden', isPomo);
    el.pomodoroPanel.hidden = !isPomo;
    el.pomodoroPanel.classList.toggle('hidden', !isPomo);
    for (const [tab, active] of [[el.plannerTab, !isPomo], [el.pomodoroTab, isPomo]]) {
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    }
    if (save) {
      try { localStorage.setItem(TAB_STORAGE, isPomo ? 'pomodoro' : 'planner'); } catch {}
    }
    if (isPomo) refreshTimer();
  }

  function clockText(ms) {
    const secs = Math.ceil(Math.max(0, ms) / 1000);
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function render() {
    const remaining = Math.max(0, timer.remainingMs);
    el.time.textContent = clockText(remaining);
    el.modeLabel.textContent = MODES[timer.mode].label;
    el.clock.style.setProperty('--pomo-angle', `${(1 - remaining / timer.totalMs) * 360}deg`);
    el.rounds.textContent = persianNum(timer.rounds);
    modeButtons.forEach(button => {
      const active = button.dataset.pomoMode === timer.mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    el.start.disabled = timer.status === 'running';
    el.start.textContent = timer.status === 'paused' ? '▶ ادامه' : timer.status === 'finished' ? '▶ دوباره شروع' : '▶ شروع';
    el.pause.disabled = timer.status !== 'running';
    el.finished.classList.toggle('hidden', timer.status !== 'finished');
    el.finished.textContent = MODES[timer.mode].finished;

    const messages = {
      idle: 'آماده‌ای؟ روی «شروع» بزن 💗',
      running: 'در حال شمارش... تو از پسش برمیای! 🌟',
      paused: 'تایمر متوقف شده؛ هر وقت خواستی ادامه بده 🌷',
      finished: 'زمان به پایان رسید! 🎉'
    };
    el.status.textContent = messages[timer.status];
    if (timer.status === 'running') {
      document.title = `⏳ ${clockText(remaining)} | پومودورو`;
    } else if (timer.status === 'finished') {
      document.title = '🔔 زمان پومودورو تمام شد!';
    } else {
      document.title = baseTitle;
    }
  }

  // صدای پایان از همان لحظه‌ی کلیک روی «شروع»، با ساعت Web Audio
  // برای زمان پایان زمان‌بندی می‌شود. بنابراین در دسکتاپ معمولاً حتی وقتی
  // فراخوانی‌های JS در پس‌زمینه کند شوند هم صدا به‌موقع پخش می‌شود.
  function chime(at, track = false) {
    if (!audioContext || audioContext.state !== 'running') return;
    const notes = [
      [0.00, 784, .20], [.27, 988, .20], [.54, 1175, .38],
      [1.22, 784, .20], [1.49, 988, .20], [1.76, 1175, .52]
    ];
    for (const [offset, frequency, duration] of notes) {
      const t = at + offset;
      const oscillator = audioContext.createOscillator();
      const volume = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, t);
      volume.gain.setValueAtTime(0.0001, t);
      volume.gain.exponentialRampToValueAtTime(.19, t + .03);
      volume.gain.exponentialRampToValueAtTime(.0001, t + duration);
      oscillator.connect(volume);
      volume.connect(audioContext.destination);
      oscillator.start(t);
      oscillator.stop(t + duration + .02);
      if (track) scheduledAlarm.push(oscillator);
      oscillator.onended = () => {
        oscillator.disconnect();
        volume.disconnect();
        const i = scheduledAlarm.indexOf(oscillator);
        if (i >= 0) scheduledAlarm.splice(i, 1);
      };
    }
  }

  function cancelScheduledAlarm() {
    for (const oscillator of scheduledAlarm) {
      try { oscillator.stop(); } catch {}
      try { oscillator.disconnect(); } catch {}
    }
    scheduledAlarm = [];
    scheduledDeadline = null;
  }

  function scheduleAlarm() {
    if (!el.sound.checked || timer.status !== 'running' || !timer.deadline ||
        !audioContext || audioContext.state !== 'running') return;
    if (scheduledDeadline === timer.deadline) return;
    cancelScheduledAlarm();
    const secondsLeft = Math.max(0.02, (timer.deadline - Date.now()) / 1000);
    scheduledDeadline = timer.deadline;
    chime(audioContext.currentTime + secondsLeft, true);
  }

  function activateAudio(preview = false) {
    if (!el.sound.checked && !preview) return;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) {
      el.soundHint.textContent = 'این مرورگر از پخش صدای هشدار پشتیبانی نمی‌کند.';
      return;
    }
    try {
      if (!audioContext) audioContext = new AudioCtor();
      // resume باید مستقیماً بر اثر کلیک کاربر فراخوانی شود.
      Promise.resolve(audioContext.resume()).then(() => {
        const ready = audioContext.state === 'running';
        if (preview && ready) chime(audioContext.currentTime + .04);
        if (ready) scheduleAlarm();
      }).catch(() => {
        el.soundHint.textContent = 'مرورگر اجازه‌ی پخش صدا نداد. روی «تست صدا» بزن و مجدد امتحان کن.';
      });
    } catch {
      el.soundHint.textContent = 'امکان فعال‌سازی صدا در این مرورگر فراهم نیست.';
    }
  }

  async function sendBackgroundNotification() {
    if (!document.hidden || !('Notification' in window) || Notification.permission !== 'granted') return;
    const message = MODES[timer.mode].finished;
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration.showNotification) {
          await registration.showNotification('⏰ پومودورو', { body: message, tag: 'pomodoro-done', icon: undefined });
          return;
        }
      }
      new Notification('⏰ پومودورو', { body: message, tag: 'pomodoro-done' });
    } catch { /* حتی بدون اعلان، پیام داخل سایت نمایش داده می‌شود. */ }
  }

  function finishTimer() {
    if (timer.status !== 'running') return;
    timer.status = 'finished';
    timer.remainingMs = 0;
    timer.deadline = null;
    if (timer.mode === 'focus') timer.rounds += 1;
    // صدای از پیش برنامه‌ریزی‌شده را قطع نکن. اگر به‌خاطر رفرش یا
    // محدودیت مرورگر تنظیم نشده بود، پخش مستقیم را امتحان کن.
    if (el.sound.checked && (scheduledDeadline === null || audioContext?.state !== 'running')) {
      // تلاش دوم در مرورگرهایی که پس‌زمینه Web Audio را معلق کرده‌اند.
      // بسته به سیاست مرورگر، پخش بدون کلیک تازه ممکن است محدود شود.
      activateAudio(true);
    }
    scheduledDeadline = null;
    render();
    persist();
    void sendBackgroundNotification();
  }

  function refreshTimer() {
    if (timer.status === 'running') {
      timer.remainingMs = Math.max(0, timer.deadline - Date.now());
      if (timer.remainingMs <= 0) {
        finishTimer();
        return;
      }
    }
    render();
  }

  function startTimer() {
    if (timer.status === 'running') return;
    if (timer.status === 'idle' || timer.status === 'finished') {
      cancelScheduledAlarm();
      timer.totalMs = currentDuration();
      timer.remainingMs = timer.totalMs;
    }
    timer.status = 'running';
    timer.deadline = Date.now() + timer.remainingMs;
    persist();
    render();
    activateAudio();
  }

  function pauseTimer() {
    if (timer.status !== 'running') return;
    refreshTimer();
    if (timer.status !== 'running') return; // ممکن است همین لحظه تمام شده باشد.
    timer.remainingMs = Math.max(0, timer.deadline - Date.now());
    timer.deadline = null;
    timer.status = 'paused';
    cancelScheduledAlarm();
    render();
    persist();
  }

  function resetTimer() {
    cancelScheduledAlarm();
    timer.status = 'idle';
    timer.deadline = null;
    timer.totalMs = currentDuration();
    timer.remainingMs = timer.totalMs;
    render();
    persist();
  }

  function changeMode(mode) {
    if (!Object.hasOwn(MODES, mode) || mode === timer.mode) return;
    cancelScheduledAlarm();
    timer.mode = mode;
    timer.status = 'idle';
    timer.deadline = null;
    timer.totalMs = currentDuration();
    timer.remainingMs = timer.totalMs;
    render();
    persist();
  }

  async function enableNotifications() {
    if (!('Notification' in window) || !window.isSecureContext) {
      el.notify.textContent = 'اعلان در این مرورگر در دسترس نیست';
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      el.notify.textContent = permission === 'granted' ? '✅ اعلان‌ها فعال شدند'
        : 'اعلان مجاز نشد؛ صدای تایمر همچنان فعال است';
    } catch {
      el.notify.textContent = 'دریافت مجوز اعلان ممکن نشد';
    }
  }

  el.plannerTab.addEventListener('click', () => setTab('planner'));
  el.pomodoroTab.addEventListener('click', () => setTab('pomodoro'));
  [el.plannerTab, el.pomodoroTab].forEach(tab => {
    tab.addEventListener('keydown', event => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const next = tab === el.plannerTab ? el.pomodoroTab : el.plannerTab;
        setTab(next === el.pomodoroTab ? 'pomodoro' : 'planner');
        next.focus();
      }
    });
  });
  modeButtons.forEach(btn => btn.addEventListener('click', () => changeMode(btn.dataset.pomoMode)));
  el.start.addEventListener('click', startTimer);
  el.pause.addEventListener('click', pauseTimer);
  el.reset.addEventListener('click', resetTimer);
  el.test.addEventListener('click', () => activateAudio(true));
  el.notify.addEventListener('click', enableNotifications);
  el.sound.addEventListener('change', () => {
    if (el.sound.checked) activateAudio();
    else cancelScheduledAlarm();
    persist();
  });

  ['focus', 'short', 'long'].forEach(mode => {
    el[mode].addEventListener('change', () => {
      const num = Number(el[mode].value);
      el[mode].value = clamp(Math.round(num || 1), 1, Number(el[mode].max));
      if (timer.mode === mode && ['idle', 'finished'].includes(timer.status)) {
        timer.status = 'idle';
        timer.totalMs = currentDuration();
        timer.remainingMs = timer.totalMs;
      }
      render();
      persist();
    });
  });

  restore();
  if (timer.status === 'running') {
    el.soundHint.textContent = 'تایمر بعد از بازشدن دوباره ادامه دارد. برای فعال‌کردن مجدد صدای پس‌زمینه روی «تست صدا» بزن.';
  }
  refreshTimer();
  let savedTab = 'planner';
  try { savedTab = localStorage.getItem(TAB_STORAGE) || 'planner'; } catch {}
  setTab(savedTab, false);
  setInterval(refreshTimer, 500);
  document.addEventListener('visibilitychange', refreshTimer);
  window.addEventListener('pageshow', refreshTimer);
})();
