/* Princess Study Hub — profile-specific, offline-first browser data storage. */
(() => {
  'use strict';
  const P = 'princess_profiles_v3', A = 'princess_active_profile_v3';
  const read = (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
  const put = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  const makeId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  const cleanName = name => String(name || '').trim().slice(0, 32) || 'پرنسس من';
  const localDate = date => { const d = date instanceof Date ? date : new Date(date); if (Number.isNaN(d.getTime())) return ''; return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  let profiles = read(P, []);
  if (!Array.isArray(profiles)) profiles = [];
  profiles = profiles.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string');
  let fresh = profiles.length === 0;
  if (fresh) {
    profiles = [{ id: makeId(), name: 'پرنسس من', createdAt: Date.now() }];
    put(P, profiles);
  }
  let active = localStorage.getItem(A);
  if (!profiles.some(p => p.id === active)) active = profiles[0].id;
  localStorage.setItem(A, active);
  const key = name => `princess_v3_${active}_${name}`;
  // Keep existing visitors' saved plans and timers (copy, never erase the originals).
  if (fresh) {
    for (const [oldKey, newKey] of [['princessStudyPlanner_v1','planner'],['princessPomodoro_v1','pomodoro'],['princessActiveTab_v1','activeTab']]) {
      const previous = localStorage.getItem(oldKey);
      if (previous != null) localStorage.setItem(key(newKey), newKey === 'activeTab' ? JSON.stringify(previous === 'pomodoro' ? 'pomodoroTab' : 'plannerTab') : previous);
    }
  }
  const api = {
    key, makeId, localDate, read: (name, fallback) => read(key(name), fallback),
    write: (name, data) => put(key(name), data),
    name: () => profiles.find(p => p.id === active)?.name || 'پرنسس من',
    profiles: () => profiles.map(p => ({...p})),
    activeId: () => active,
    rename: name => { const p = profiles.find(p => p.id === active); if (!p) return; p.name = cleanName(name); put(P, profiles); },
    create: name => {
      const p = { id: makeId(), name: cleanName(name), createdAt: Date.now() };
      profiles.push(p); put(P, profiles); active = p.id; localStorage.setItem(A, p.id); return p;
    },
    switchTo: id => { if (!profiles.some(p => p.id === id)) return false; active = id; localStorage.setItem(A, id); return true; },
    export: () => ({ format: 'princess2-backup', version: 3, exportedAt: new Date().toISOString(),
      profileName: api.name(), items: Object.fromEntries(['planner','pomodoro','activeTab','hub'].map(n => [n, localStorage.getItem(key(n))])) }),
    import: obj => {
      if (!obj || obj.format !== 'princess2-backup' || obj.version !== 3 || !obj.items || typeof obj.items !== 'object') throw new Error('این فایل، پشتیبان معتبر سایت نیست.');
      for (const n of ['planner','pomodoro','activeTab','hub']) {
        const value = obj.items[n];
        if (value !== null && value !== undefined) {
          if (typeof value !== 'string' || value.length > 2e6) throw new Error('اطلاعات پشتیبان معتبر نیست.');
          // Validate parsed JSON, except active tab stored as plain string.
          if (n !== 'activeTab') JSON.parse(value);
        }
      }
      for (const n of ['planner','pomodoro','activeTab','hub']) {
        if (obj.items[n] == null) localStorage.removeItem(key(n));
        else localStorage.setItem(key(n), obj.items[n]);
      }
    }
  };
  window.PrincessData = api;
})();
