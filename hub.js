/* A personal study dashboard: tasks, Persian calendar, statistics, streak, notes, exams. */
(() => {
  'use strict';
  const D = window.PrincessData;
  const $ = id => document.getElementById(id);
  const fa = new Intl.NumberFormat('fa-IR');
  const gregDate = new Intl.DateTimeFormat('fa-IR', {day:'numeric', month:'long',year:'numeric'});
  const jalaliMonth = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {month:'long', year:'numeric'});
  const jalaliParts = new Intl.DateTimeFormat('en-US-u-ca-persian', { year:'numeric', month:'numeric', day:'numeric' });
  const DAY = 86400000;
  const fmt = n => fa.format(Math.max(0, Math.round(n || 0)));
  const html = v => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const local = date => D.localDate(date);
  const today = () => local(new Date());
  const dateAt = iso => new Date(`${iso}T12:00:00`);
  const addDays = (date, num) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + num, 12);
  const hasIsoDate = iso => /^\d{4}-\d\d-\d\d$/.test(iso) && local(dateAt(iso)) === iso;
  const safeArray = v => Array.isArray(v) ? v.filter(x => x && typeof x === 'object' && !Array.isArray(x)) : [];
  const inputDate = id => { $(id).value = today(); };
  let stored = D.read('hub', {});
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) stored = {};
  const db = {
    tasks: safeArray(stored.tasks), notes: safeArray(stored.notes),
    exams: safeArray(stored.exams), sessions: safeArray(stored.sessions)
  };
  let taskFilter = 'all', chartRange = 7, activeNote = null, editingExam = null, editingTask = null;
  let calendarCursor = new Date(), selectedDay = today();
  const save = () => {
    if (!D.write('hub', db)) {
      if (typeof showToast === 'function') showToast('فضای ذخیره‌سازی مرورگر پر شده یا غیرفعال است. از داده‌ها پشتیبان بگیر.');
      return false;
    }
    return true;
  };
  const toast = t => { if (typeof showToast === 'function') showToast(t); };
  function setEmpty(container, message) {
    container.innerHTML = `<div class="empty-state"><span>🌷</span><p>${html(message)}</p></div>`;
  }
  const uniqueId = () => D.makeId();
  const minsOn = iso => db.sessions.reduce((sum,s) => sum + (s && s.date === iso && Number.isFinite(Number(s.minutes)) ? Math.max(0, Number(s.minutes)) : 0), 0);
  const studyDates = () => new Set(db.sessions.filter(s => s && hasIsoDate(s.date) && s.date <= today() && Number(s.minutes) > 0).map(s => s.date));
  const upcomingExams = () => db.exams.filter(x => x && Number.isFinite(examTs(x)) && examTs(x) >= Date.now()).sort((a,b) => examTs(a)-examTs(b));
  function examTs(exam) { if (!hasIsoDate(exam.date)) return NaN; return new Date(`${exam.date}T${/^\d\d:\d\d$/.test(exam.time) ? exam.time : '09:00'}:00`).getTime(); }
  function countdown(ts) {
    const diff = Math.max(0, ts-Date.now());
    const total = Math.ceil(diff / 60000), days = Math.floor(total/1440), hours = Math.floor((total%1440)/60), minutes = total%60;
    if (days > 0) return `${fmt(days)} روز و ${fmt(hours)} ساعت`;
    if (hours > 0) return `${fmt(hours)} ساعت و ${fmt(minutes)} دقیقه`;
    return `${fmt(minutes)} دقیقه`;
  }
  function computeStreak() {
    const studied = studyDates();
    if (!studied.size) return {current:0,best:0,total:0};
    const dates = [...studied].sort();
    let run = 0, best = 0, previous = '';
    for (const iso of dates) {
      run = previous && local(addDays(dateAt(previous), 1)) === iso ? run + 1 : 1;
      best = Math.max(best, run);
      previous = iso;
    }
    let cursor = dateAt(today());
    if (!studied.has(today())) cursor = addDays(cursor, -1);
    let current = 0;
    for (let i = 0; i < dates.length && studied.has(local(cursor)); i++) { current++; cursor=addDays(cursor,-1); }
    return {current,best,total:studied.size};
  }
  function refreshOverview() {
    const todayStr = today(), todayTasks = db.tasks.filter(t => t && t.date === todayStr), streak = computeStreak(), next = upcomingExams()[0];
    $('overviewStudy').textContent = `${fmt(minsOn(todayStr))} دقیقه`;
    $('overviewTasks').textContent = `${fmt(todayTasks.filter(t => t.done).length)} از ${fmt(todayTasks.length)}`;
    $('overviewStreak').textContent = `${fmt(streak.current)} روز`;
    $('overviewExam').textContent = next ? `${html(next.name).slice(0,22)} · ${countdown(examTs(next))}` : 'ثبت نشده';
  }
  // Local profiles (same browser), one-shot backup and restore (JSON).
  function renderProfiles() {
    const select = $('profileSelect'); select.replaceChildren();
    for (const p of D.profiles()) { const opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name; select.appendChild(opt); }
    select.value = D.activeId(); $('profileGreeting').textContent = D.name();
  }
  $('profileSelect').addEventListener('change', e => { if (D.switchTo(e.target.value)) location.reload(); });
  $('addProfileBtn').addEventListener('click', () => {
    const name = prompt('اسم پروفایل جدید چیه؟ (اطلاعات این پروفایل جدا ذخیره می‌شود)');
    if (name === null) return;
    if (!name.trim()) { toast('اسم پروفایل را بنویس 🌸'); return; }
    D.create(name); location.reload();
  });
  $('editProfileBtn').addEventListener('click', () => {
    const name = prompt('چه اسمی صدات کنم؟', D.name());
    if (name === null) return;
    if (!name.trim()) { toast('اسم نمی‌تواند خالی باشد.'); return; }
    D.rename(name); renderProfiles(); toast('اسم پروفایلت ذخیره شد 💗');
  });
  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(D.export(), null, 2)], {type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `princess-study-backup-${today()}.json`; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000); toast('پشتیبان این پروفایل دانلود شد 💾');
  });
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async e => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      if (file.size > 2e6) throw new Error('فایل بیش از حد بزرگ است.');
      const backup = JSON.parse(await file.text());
      if (!confirm('بازیابی، اطلاعات فعلی این پروفایل را با فایل پشتیبان جایگزین می‌کند. ادامه می‌دهی؟')) return;
      D.import(backup); location.reload();
    } catch (err) { toast(err.message || 'فایل پشتیبان قابل خواندن نیست.'); }
    finally { e.target.value = ''; }
  });
  document.querySelectorAll('[data-go-tab]').forEach(button => button.addEventListener('click', () => {
    window.PrincessTabs?.open(button.dataset.goTab);
  }));

  // Checklist, CRUD and filtering.
  function renderTasks() {
    const todayStr = today();
    const tasks = db.tasks.filter(t => t && typeof t.title === 'string');
    const doneCount = tasks.filter(t=>t.done).length;
    $('tasksSummary').textContent = `${fmt(doneCount)} کار از ${fmt(tasks.length)} کار انجام شده ✨`;
    $('taskProgress').style.width = `${tasks.length ? doneCount / tasks.length * 100 : 0}%`;
    document.querySelectorAll('[data-task-filter]').forEach(b => b.classList.toggle('active', b.dataset.taskFilter === taskFilter));
    let filtered = tasks.filter(t => taskFilter === 'all' || (taskFilter === 'today' && t.date === todayStr) || (taskFilter === 'pending' && !t.done) || (taskFilter === 'done' && t.done));
    const order = {high:0,normal:1,low:2};
    filtered = filtered.slice().sort((a,b) => Number(a.done)-Number(b.done) || String(a.date).localeCompare(String(b.date)) || (order[a.priority]??1)-(order[b.priority]??1));
    const target = $('tasksList'); target.replaceChildren();
    if (!filtered.length) { setEmpty(target, 'هنوز کاری توی این بخش نیست. یه هدف کوچیک اضافه کن 💕'); return; }
    for (const t of filtered) {
      const row = document.createElement('div'); row.className = `hub-item task-item${t.done?' is-done':''}`;
      const safeId = html(t.id);
      row.innerHTML = `<label class="task-checkbox"><input type="checkbox" data-toggle-task="${safeId}" ${t.done?'checked':''} aria-label="انجام ${html(t.title)}" /><span class="task-checkmark"></span></label>
        <div class="hub-item-info"><strong>${html(t.title)}</strong><span>${html(hasIsoDate(t.date) ? gregDate.format(dateAt(t.date)) : 'بدون تاریخ')} · ${t.priority==='high'?'🔥 مهم':t.priority==='low'?'☁️ سبک':'🌸 معمولی'}</span></div>
        <div class="item-actions"><button type="button" class="icon-action" data-edit-task="${safeId}" aria-label="ویرایش کار">✏️</button><button type="button" class="icon-action" data-delete-task="${safeId}" aria-label="حذف کار">🗑️</button></div>`;
      target.appendChild(row);
    }
  }
  $('taskForm').addEventListener('submit', e => {
    e.preventDefault(); const title = $('taskTitle').value.trim(), date = $('taskDate').value;
    if (!title || !hasIsoDate(date)) return;
    if (editingTask) {
      const task = db.tasks.find(t => t.id === editingTask);
      if (task) { task.title=title.slice(0,110); task.date=date; task.priority=$('taskPriority').value; }
    } else db.tasks.push({id:uniqueId(),title:title.slice(0,110),date,priority:$('taskPriority').value,done:false,createdAt:Date.now()});
    if (save()) { clearTaskForm(); toast('کارت ذخیره شد 🌸'); updateAll(); $('taskTitle').focus(); }
  });
  function clearTaskForm() {
    editingTask = null; $('taskForm').reset();$('taskDate').value=today();
    $('taskSaveBtn').textContent='＋ اضافه کردن کار';$('taskCancel').classList.add('hidden');
  }
  $('taskCancel').addEventListener('click',clearTaskForm);
  document.querySelectorAll('[data-task-filter]').forEach(b => b.addEventListener('click', () => { taskFilter=b.dataset.taskFilter;renderTasks(); }));
  $('tasksList').addEventListener('change', e => {
    const id = e.target.dataset.toggleTask; if (!id) return;
    const t = db.tasks.find(x => x.id === id); if (!t) return; t.done = e.target.checked;
    t.completedAt = t.done ? Date.now() : null; save(); updateAll(); if (t.done) toast('یه کار دیگه انجام شد! ⭐');
  });
  $('tasksList').addEventListener('click', e => {
    const edit = e.target.closest('[data-edit-task]'), del = e.target.closest('[data-delete-task]');
    if (edit) {
      const t = db.tasks.find(x=>x.id===edit.dataset.editTask); if (!t) return;
      editingTask=t.id;$('taskTitle').value=t.title;$('taskDate').value=t.date;$('taskPriority').value=t.priority||'normal';
      $('taskSaveBtn').textContent='💗 ذخیره تغییرات';$('taskCancel').classList.remove('hidden');
      $('taskForm').scrollIntoView({behavior:'smooth',block:'center'});$('taskTitle').focus();
    } else if (del) {
      const t = db.tasks.find(x => x.id === del.dataset.deleteTask); if (!t || !confirm(`کار «${t.title}» پاک شود؟`)) return;
      db.tasks=db.tasks.filter(x=>x.id!==t.id);if(editingTask===t.id)clearTaskForm();save();updateAll();
    }
  });

  // Study session records: from Pomodoro completion or manual entry.
  function addSession(record) {
    if (!record || !(Number(record.minutes)>0) || db.sessions.some(s=>s.id===record.id)) return;
    db.sessions.push({id:record.id || uniqueId(),date:record.date || today(),minutes:Math.max(1,Math.min(720, Math.round(record.minutes))),source:record.source || 'manual',at:record.at || Date.now()});
    // Keep last 5000 sessions to prevent storage explosion.
    if (db.sessions.length>5000) db.sessions.splice(0,db.sessions.length-5000);
    save(); updateAll();
  }
  window.addEventListener('princess:focus-complete', ev => {
    const info=ev.detail||{}, time=Number(info.at);
    const date = Number.isFinite(time) ? local(new Date(time)) : today();
    addSession({id:info.id,date,minutes:info.minutes,source:'pomodoro',at:time});
    toast('یه دور مطالعه ثبت شد! آفرین 🌟');
  });
  $('manualSessionForm').addEventListener('submit', e => {
    e.preventDefault(); const minutes = Number($('manualMinutes').value), date=$('manualDate').value;
    if (!hasIsoDate(date) || date > today() || !Number.isFinite(minutes) || minutes<1 || minutes>720) {toast('زمان مطالعه باید معتبر باشد و برای امروز یا روزهای گذشته ثبت شود.');return;}
    addSession({id:uniqueId(),date,minutes,source:'manual'});toast('زمان مطالعه ثبت شد 🌸');
  });
  function renderStats() {
    const now = new Date(), last = (count, offset) => Array.from({length:count},(_,i)=>local(addDays(now,-(count-1-i)+offset)));
    $('statToday').textContent = `${fmt(minsOn(today()))} دقیقه`;
    $('statWeek').textContent = `${fmt(last(7,0).reduce((s,d)=>s+minsOn(d),0))} دقیقه`;
    $('statMonth').textContent = `${fmt(last(30,0).reduce((s,d)=>s+minsOn(d),0))} دقیقه`;
    $('statSessions').textContent = `${fmt(db.sessions.filter(s=>s.source==='pomodoro').length)} دور`;
    const days=last(chartRange,0), nums=days.map(minsOn), max=Math.max(60,...nums);
    const graph=$('studyChart');graph.replaceChildren();graph.classList.toggle('month-chart',chartRange===30);
    graph.setAttribute('aria-label',`زمان مطالعه در ${fmt(chartRange)} روز اخیر: ${nums.map((n,i)=>`${days[i]} ${fmt(n)} دقیقه`).join('، ')}`);
    days.forEach((iso,index) => {
      const n=nums[index], column=document.createElement('div');column.className='chart-column';
      const d=dateAt(iso);
      const label = chartRange===7 ? new Intl.DateTimeFormat('fa-IR',{weekday:'short'}).format(d) : new Intl.DateTimeFormat('fa-IR',{day:'numeric'}).format(d);
      const percent=n>0?Math.max(4,100*n/max):0;
      column.title=`${gregDate.format(d)}: ${fmt(n)} دقیقه`;
      column.innerHTML=`<span class="chart-value">${n?fmt(n):''}</span><div class="bar-track"><div class="bar-fill${iso===today()?' is-today':''}" style="height:${percent}%"></div></div><small>${html(label)}</small>`;
      graph.appendChild(column);
    });
    document.querySelectorAll('[data-chart-range]').forEach(b=>b.classList.toggle('active',Number(b.dataset.chartRange)===chartRange));
    const list=$('studySessions');list.replaceChildren();
    const recent=db.sessions.slice().filter(s=>s && hasIsoDate(s.date)).sort((a,b)=>(Number(b.at)||0)-(Number(a.at)||0)).slice(0,12);
    if (!recent.length) {setEmpty(list,'هنوز مطالعه‌ای ثبت نکردی. پومودورو رو امتحان کن یا یه جلسه دستی اضافه کن.');return;}
    recent.forEach(s => {
      const el=document.createElement('div');el.className='hub-item compact-item';
      el.innerHTML=`<span class="session-icon">${s.source==='pomodoro'?'🍅':'📖'}</span><div class="hub-item-info"><strong>${fmt(s.minutes)} دقیقه ${s.source==='pomodoro'?'پومودورو':'مطالعه دستی'}</strong><span>${html(gregDate.format(dateAt(s.date)))}</span></div><button type="button" class="icon-action" data-delete-session="${html(s.id)}" aria-label="حذف جلسه">🗑️</button>`;
      list.appendChild(el);
    });
  }
  $('studySessions').addEventListener('click',e=>{
    const id=e.target.closest('[data-delete-session]')?.dataset.deleteSession;
    if (!id||!confirm('این جلسه از آمار مطالعه حذف شود؟'))return;
    db.sessions=db.sessions.filter(s=>s.id!==id);save();updateAll();
  });
  document.querySelectorAll('[data-chart-range]').forEach(b=>b.addEventListener('click',()=>{chartRange=Number(b.dataset.chartRange);renderStats();}));
  function renderStreak() {
    const streak=computeStreak();
    $('currentStreak').textContent=fmt(streak.current);$('bestStreak').textContent=fmt(streak.best);$('totalStudyDays').textContent=fmt(streak.total);
    const badges=[{n:1,icon:'🌱',title:'اولین قدم'},{n:3,icon:'🌷',title:'شکوفه سه‌روزه'},{n:7,icon:'👑',title:'هفت روز درخشان'},{n:14,icon:'💎',title:'دو هفته تلاش'},{n:30,icon:'🏆',title:'قهرمان ماه'}];
    $('streakBadges').innerHTML=badges.map(b=>`<div class="streak-badge${streak.best>=b.n?' earned':' locked'}"><span>${b.icon}</span><strong>${b.title}</strong><small>${fmt(b.n)} روز</small></div>`).join('');
  }

  // Gregorian input dates, Persian (Jalali) calendar presentation.
  const getPersian = date => {
    const parts=jalaliParts.formatToParts(date);
    const pick=type=>Number(parts.find(p=>p.type===type)?.value);
    return { year:pick('year'),month:pick('month'),day:pick('day') };
  };
  function firstJalaliDay(date) {
    let d = new Date(date.getFullYear(),date.getMonth(),date.getDate(),12);
    for (let i=0;i<33;i++) {if(getPersian(d).day===1)return d;d=addDays(d,-1);}
    return d;
  }
  function renderCalendar() {
    const first=firstJalaliDay(calendarCursor);calendarCursor=first;
    $('calendarMonth').textContent=jalaliMonth.format(first);
    const month=getPersian(first).month, grid=$('calendarGrid');grid.replaceChildren();
    const offset=(first.getDay()+1)%7;
    for(let i=0;i<offset;i++){const blank=document.createElement('span');blank.className='calendar-placeholder';blank.setAttribute('aria-hidden','true');grid.appendChild(blank);}
    let d=first;
    while(getPersian(d).month===month && grid.children.length<44){
      const iso=local(d), studied=minsOn(iso), tasks=db.tasks.filter(t=>t.date===iso), exams=db.exams.filter(x=>x.date===iso);
      const btn=document.createElement('button');btn.type='button';btn.className=`calendar-day${studied?' has-study':''}${iso===today()?' is-today':''}${iso===selectedDay?' selected':''}`;
      btn.setAttribute('role','gridcell');btn.setAttribute('aria-label',`${gregDate.format(d)}؛ ${fmt(studied)} دقیقه مطالعه، ${fmt(tasks.length)} کار، ${fmt(exams.length)} امتحان`);
      btn.innerHTML=`<span class="day-number">${fmt(getPersian(d).day)}</span><span class="day-meta">${studied?'✿':''}${tasks.length?'•':''}${exams.length?'🔴':''}</span>`;
      btn.addEventListener('click',()=>{selectedDay=iso;renderCalendar();renderDayDetails();});
      grid.appendChild(btn);d=addDays(d,1);
    }
    renderDayDetails();
  }
  function renderDayDetails() {
    const d=hasIsoDate(selectedDay)?dateAt(selectedDay):new Date();
    $('calendarSelectedTitle').textContent=`🌸 ${gregDate.format(d)}`;
    const tasks=db.tasks.filter(t=>t.date===selectedDay),exams=db.exams.filter(e=>e.date===selectedDay), minutes=minsOn(selectedDay);
    const el=$('calendarDayContent');el.replaceChildren();
    const lead=document.createElement('div');lead.className='calendar-lead';lead.textContent=`📖 ${fmt(minutes)} دقیقه مطالعه · ✅ ${fmt(tasks.filter(t=>t.done).length)} از ${fmt(tasks.length)} کار انجام‌شده`;
    el.appendChild(lead);
    for(const t of tasks){const p=document.createElement('p');p.className='day-detail';p.textContent=`${t.done?'✅':'⬜'} ${t.title}`;el.appendChild(p);}
    for(const e of exams){const p=document.createElement('p');p.className='day-detail';p.textContent=`🎓 امتحان ${e.name} ـ ساعت ${e.time}`;el.appendChild(p);}
    if(!tasks.length&&!exams.length&&!minutes){const p=document.createElement('p');p.className='small-muted';p.textContent='هنوز برای این روز چیزی ثبت نشده 💗';el.appendChild(p);}
  }
  $('calendarPrev').addEventListener('click',()=>{calendarCursor=addDays(firstJalaliDay(calendarCursor),-1);renderCalendar();});
  $('calendarNext').addEventListener('click',()=>{calendarCursor=addDays(firstJalaliDay(calendarCursor),38);renderCalendar();});
  $('calendarToday').addEventListener('click',()=>{calendarCursor=new Date();selectedDay=today();renderCalendar();});

  // Personal notebook.
  function renderNotes() {
    const filter=$('noteSearch').value.trim().toLocaleLowerCase('fa');
    const notes=db.notes.filter(n=>n && typeof n.title==='string' && `${n.title} ${n.body||''}`.toLocaleLowerCase('fa').includes(filter)).slice().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
    const el=$('notesList');el.replaceChildren();
    if(!notes.length){setEmpty(el,'هنوز یادداشتی ننوشتی 💌');return;}
    for(const n of notes){
      const b=document.createElement('button');b.type='button';b.className=`note-preview${activeNote===n.id?' active':''}`;
      const title=document.createElement('strong');title.textContent=n.title;
      const preview=document.createElement('span');preview.textContent=String(n.body||'').slice(0,70)||'یادداشت خالی';
      b.append(title,preview);b.addEventListener('click',()=>openNote(n.id));el.appendChild(b);
    }
  }
  function openNote(id=null) {
    const n=db.notes.find(n=>n.id===id);activeNote=n?.id||null;
    $('noteTitle').value=n?.title||'';$('noteBody').value=n?.body||'';
    $('noteDelete').disabled=!n;
    $('noteEditedHint').textContent=n?`آخرین ویرایش: ${new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(n.updatedAt||Date.now()))}`:'یادداشت جدید';
    renderNotes();
  }
  $('noteSearch').addEventListener('input',renderNotes);
  $('newNoteBtn').addEventListener('click',()=>{openNote();$('noteTitle').focus();});
  $('noteForm').addEventListener('submit',e=>{
    e.preventDefault();const title=$('noteTitle').value.trim(),body=$('noteBody').value.trim();if(!title||!body)return;
    let n=db.notes.find(x=>x.id===activeNote);
    if(n){n.title=title.slice(0,90);n.body=body.slice(0,12000);n.updatedAt=Date.now();}
    else {n={id:uniqueId(),title:title.slice(0,90),body:body.slice(0,12000),createdAt:Date.now(),updatedAt:Date.now()};db.notes.push(n);}
    if(save()){openNote(n.id);toast('یادداشتت ذخیره شد 💌');}
  });
  $('noteDelete').addEventListener('click',()=>{
    if(!activeNote)return; if(!confirm('این یادداشت برای همیشه پاک شود؟'))return;
    db.notes=db.notes.filter(n=>n.id!==activeNote);save();openNote();toast('یادداشت حذف شد');
  });

  // Exams / live countdown and editing.
  function clearExamForm(){editingExam=null;$('examForm').reset();$('examTime').value='09:00';$('examSaveBtn').textContent='＋ اضافه کردن امتحان';$('examCancel').classList.add('hidden');$('examDate').value=today();}
  function renderExams(){
    const nearest=upcomingExams()[0], feature=$('nextExamFeature');
    feature.classList.toggle('hidden',!nearest);
    if(nearest) feature.innerHTML=`<span>✨ نزدیک‌ترین امتحان</span><strong>${html(nearest.name)}</strong><b>${countdown(examTs(nearest))} باقی مانده ⏰</b>`;
    const list=$('examsList');list.replaceChildren();
    const arr=db.exams.filter(e=>e && hasIsoDate(e.date)).slice().sort((a,b)=>examTs(a)-examTs(b));
    if(!arr.length){setEmpty(list,'هنوز امتحانی ثبت نشده. تاریخ امتحانت رو وارد کن 🌸');return;}
    for(const exam of arr){
      const past=examTs(exam)<Date.now();const card=document.createElement('div');card.className=`hub-item exam-item${past?' is-past':''}`;
      card.innerHTML=`<span class="exam-icon">🎓</span><div class="hub-item-info"><strong>${html(exam.name)}</strong><span>${html(gregDate.format(dateAt(exam.date)))}، ساعت ${html(exam.time)}</span><em>${past?'به پایان رسیده':'⏳ '+countdown(examTs(exam))+' باقی مانده'}</em></div><div class="item-actions"><button type="button" class="icon-action" data-edit-exam="${html(exam.id)}" aria-label="ویرایش امتحان">✏️</button><button type="button" class="icon-action" data-delete-exam="${html(exam.id)}" aria-label="حذف امتحان">🗑️</button></div>`;
      list.appendChild(card);
    }
  }
  $('examForm').addEventListener('submit',e=>{
    e.preventDefault();const name=$('examName').value.trim(),date=$('examDate').value,time=$('examTime').value;
    if(!name||!hasIsoDate(date)||!/^\d\d:\d\d$/.test(time)){toast('مشخصات امتحان را کامل کن.');return;}
    if(editingExam){const exam=db.exams.find(x=>x.id===editingExam);if(exam){exam.name=name.slice(0,90);exam.date=date;exam.time=time;}}
    else db.exams.push({id:uniqueId(),name:name.slice(0,90),date,time,createdAt:Date.now()});
    if(save()){clearExamForm();updateAll();toast('تاریخ امتحانت ذخیره شد 🎓');}
  });
  $('examCancel').addEventListener('click',clearExamForm);
  $('examsList').addEventListener('click',e=>{
    const edit=e.target.closest('[data-edit-exam]'),del=e.target.closest('[data-delete-exam]');
    if(edit){const x=db.exams.find(v=>v.id===edit.dataset.editExam);if(!x)return;
      editingExam=x.id;$('examName').value=x.name;$('examDate').value=x.date;$('examTime').value=x.time;
      $('examSaveBtn').textContent='💗 ذخیره تغییرات';$('examCancel').classList.remove('hidden');$('examForm').scrollIntoView({behavior:'smooth',block:'center'});
    } else if(del){const x=db.exams.find(v=>v.id===del.dataset.deleteExam);if(!x||!confirm(`امتحان «${x.name}» حذف شود؟`))return;
      db.exams=db.exams.filter(v=>v.id!==x.id);if(editingExam===x.id)clearExamForm();save();updateAll();}
  });
  function updateAll(){refreshOverview();renderTasks();renderStats();renderStreak();renderCalendar();renderExams();}
  inputDate('taskDate');inputDate('manualDate');$('manualDate').max = today();inputDate('examDate');
  renderProfiles();renderNotes();updateAll();
  // A live clock updates exam countdown, streak and day boundaries.
  let lastDay=today();
  setInterval(()=>{
    if(today()!==lastDay){lastDay=today();$('manualDate').max=today();updateAll();}
    else {refreshOverview();renderExams();}
  },30000);
  window.addEventListener('princess:tab', e=>{
    if(e.detail?.id==='calendarTab')renderCalendar();
    if(e.detail?.id==='statsTab')renderStats();
  });
})();
