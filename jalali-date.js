/* Local Jalali date fields. Display and accept Persian dates; retain ISO Gregorian dates in existing storage. */
(() => {
  'use strict';
  const ids = ['taskDate', 'manualDate', 'examDate'];
  const fmt = new Intl.DateTimeFormat('en-US-u-ca-persian', {year:'numeric', month:'numeric', day:'numeric'});
  const fa = new Intl.NumberFormat('fa-IR', {useGrouping:false});
  const MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  const WEEK = ['ش','ی','د','س','چ','پ','ج'];
  const pad = x => String(x).padStart(2,'0');
  const digits = text => String(text || '').replace(/[۰-۹]/g,x=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(x))).replace(/[٠-٩]/g,x=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(x)));
  const atNoon = (year,month,day) => new Date(year,month,day,12,0,0);
  const parts = date => {
    const list=fmt.formatToParts(date);
    const value=key=>Number(list.find(item=>item.type===key)?.value);
    return {year:value('year'), month:value('month'),day:value('day')};
  };
  const isoDate = date => `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  function fromIso(iso) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(iso||'')) return '';
    const [y,m,d]=iso.split('-').map(Number);
    const date=atNoon(y,m-1,d);
    if(isoDate(date)!==iso)return '';
    const p=parts(date);
    return `${fa.format(p.year)}/${fa.format(p.month).padStart(2,'۰')}/${fa.format(p.day).padStart(2,'۰')}`;
  }
  const normalized = str => {
    const match=digits(str).trim().replace(/[\-\.]/g,'/').match(/^(\d{4})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})$/);
    if(!match)return null;
    const [year,month,day]=match.slice(1).map(Number);
    return year >= 1000 && year <= 1999 && month >= 1 && month <= 12 && day >= 1 && day <= 31 ? {year,month,day} : null;
  };
  // Find Persian New Year's Day in Gregorian March. Calendar arithmetic is then
  // done with real Date objects, followed by round-trip validation (incl. leap years).
  function toIso(input) {
    const j=normalized(input);if(!j)return '';
    const year=j.year+621;
    let first;
    for(let day=17;day<=25;day++) {
      const d=atNoon(year,2,day),p=parts(d);
      if(p.year===j.year&&p.month===1&&p.day===1){first=d;break;}
    }
    if(!first)return '';
    const offset=(j.month<=6 ? (j.month-1)*31 : 186+(j.month-7)*30)+(j.day-1);
    const candidate=atNoon(first.getFullYear(),first.getMonth(),first.getDate()+offset);
    const checked=parts(candidate);
    return checked.year===j.year&&checked.month===j.month&&checked.day===j.day ? isoDate(candidate) : '';
  }
  const shift = (year,month,dir) => {
    const n=year*12+month-1+dir;
    return {year:Math.floor(n/12),month:((n%12)+12)%12+1};
  };
  const fields={};
  let openId=null;
  function close(){for(const f of Object.values(fields)){f.popup.hidden=true;f.button.setAttribute('aria-expanded','false');}openId=null;}
  function set(id,iso) {
    const f=fields[id];if(!f)return;
    f.input.value=fromIso(iso);
    f.input.setCustomValidity('');
    f.input.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function get(id) {return toIso(fields[id]?.input.value||'');}
  function render(id) {
    const f=fields[id], {year,month}=f.cursor;
    const firstIso=toIso(`${year}/${month}/1`);
    if(!firstIso){f.cursor=parts(new Date());return render(id);}
    const [gy,gm,gd]=firstIso.split('-').map(Number);
    const offset=(atNoon(gy,gm-1,gd).getDay()+1)%7;
    const selected=get(id), today=isoDate(new Date());
    let content=`<div class="jalali-picker-header"><button type="button" data-move="-1" aria-label="ماه قبل">❯</button><strong>${MONTHS[month-1]} ${fa.format(year)}</strong><button type="button" data-move="1" aria-label="ماه بعد">❮</button></div>`;
    content+=`<div class="jalali-picker-grid" role="grid" aria-label="روزهای ${MONTHS[month-1]}">${WEEK.map(w=>`<span class="jalali-weekday">${w}</span>`).join('')}${'<span class="jalali-pad"></span>'.repeat(offset)}`;
    for(let day=1;day<=31;day++) {
      const iso=toIso(`${year}/${month}/${day}`);
      if(!iso)break;
      content+=`<button type="button" class="jalali-day${iso===selected?' selected':''}${iso===today?' today':''}" data-day="${day}" aria-label="${fa.format(day)} ${MONTHS[month-1]}">${fa.format(day)}</button>`;
    }
    f.popup.innerHTML=content+'</div><button type="button" class="jalali-picker-today">امروز</button>';
    f.popup.querySelectorAll('[data-move]').forEach(b=>b.addEventListener('click',()=>{f.cursor=shift(year,month,Number(b.dataset.move));render(id);}));
    f.popup.querySelectorAll('[data-day]').forEach(b=>b.addEventListener('click',()=>{set(id,toIso(`${year}/${month}/${b.dataset.day}`));close();f.input.focus();}));
    f.popup.querySelector('.jalali-picker-today').addEventListener('click',()=>{set(id,isoDate(new Date()));close();f.input.focus();});
  }
  function toggle(id) {
    if(openId===id){close();return;}
    close(); const f=fields[id];
    const iso=get(id);
    if (iso) {const [y,m,d]=iso.split('-').map(Number);f.cursor=parts(atNoon(y,m-1,d));}
    else f.cursor=parts(new Date());
    render(id);f.popup.hidden=false;f.button.setAttribute('aria-expanded','true');openId=id;
  }
  for(const id of ids){
    const input=document.getElementById(id);
    if(!input)continue;
    input.type='text';input.inputMode='numeric';input.autocomplete='off';input.maxLength=10;
    input.placeholder='۱۴۰۵/۰۷/۱۹';input.dir='ltr';input.setAttribute('aria-label','تاریخ شمسی، سال/ماه/روز');
    const original=input.parentElement;
    const wrapper=document.createElement('div');wrapper.className=original.className+' jalali-date-field';
    const label=document.createElement('label');label.htmlFor=id;
    label.textContent=original.querySelector('span')?.textContent || 'تاریخ شمسی';
    const control=document.createElement('div');control.className='jalali-date-control';
    const button=document.createElement('button');button.type='button';button.className='jalali-date-button';button.textContent='📅';
    button.setAttribute('aria-label','انتخاب تاریخ از تقویم شمسی');button.setAttribute('aria-expanded','false');
    const popup=document.createElement('div');popup.className='jalali-picker-popover';popup.hidden=true;
    original.parentNode.replaceChild(wrapper,original);wrapper.append(label,control,popup);control.append(input,button);
    const field={input,button,popup,cursor:parts(new Date())};fields[id]=field;
    button.addEventListener('click',()=>toggle(id));
    input.addEventListener('input',()=>input.setCustomValidity(''));
    input.addEventListener('blur',()=>{const iso=get(id);if(iso)set(id,iso);});
    input.addEventListener('keydown',event=>{if(event.key==='ArrowDown'&&event.altKey){event.preventDefault();toggle(id);}});
  }
  document.addEventListener('pointerdown', event=>{if(openId&&!fields[openId].popup.contains(event.target)&&!fields[openId].button.contains(event.target))close();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&openId)close();});
  window.PrincessJalali={toIso,fromIso,set,get,close,parts};
})();
