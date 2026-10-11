(() => {
  'use strict';
  const tabs = [...document.querySelectorAll('.app-tab[role="tab"]')];
  const DATA = window.PrincessData;
  function open(id, remember = true) {
    const chosen = tabs.find(t => t.id === id) || tabs[0];
    tabs.forEach(t => {
      const active = t === chosen;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', String(active));
      t.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) { panel.hidden = !active; panel.classList.toggle('hidden', !active); }
    });
    if (remember) DATA.write('activeTab', chosen.id);
    chosen.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    window.dispatchEvent(new CustomEvent('princess:tab', { detail: { id: chosen.id } }));
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => open(t.id));
    t.addEventListener('keydown', e => {
      if (['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) {
        e.preventDefault();
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1
          : (i + (e.key === 'ArrowLeft' ? 1 : -1) + tabs.length) % tabs.length;
        open(tabs[next].id);
        tabs[next].focus();
      }
    });
  });
  const saved = DATA.read('activeTab', 'plannerTab');
  open(saved === 'pomodoro' ? 'pomodoroTab' : saved === 'planner' ? 'plannerTab' : saved, false);
  window.PrincessTabs = {open};
})();
