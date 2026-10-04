// Cheese Louise v1.14 — editable schedule + calendar view
// Adds month calendar, list view, and full add/edit/delete schedule-item controls.

let clScheduleView = 'calendar';
let clScheduleCursor = (()=>{ const d=new Date(); return new Date(d.getFullYear(),d.getMonth(),1); })();
let clEditingScheduleItem = null;
let clScheduleDraft = null;

const CL_SCHEDULE_TYPES = ['watch','record','edit','release','premiere','guest','other'];
const CL_SCHEDULE_TYPE_LABELS = {
  watch:'Watch', record:'Record', edit:'Edit', release:'Release', premiere:'Premiere', guest:'Guest', other:'Other'
};

function clPad2(n){ return String(n).padStart(2,'0'); }
function clLocalDateKey(value){
  const d=value instanceof Date?value:new Date(value);
  if(Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${clPad2(d.getMonth()+1)}-${clPad2(d.getDate())}`;
}
function clDateTimeLocalValue(value){
  if(!value) return '';
  const d=new Date(value);
  if(Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${clPad2(d.getMonth()+1)}-${clPad2(d.getDate())}T${clPad2(d.getHours())}:${clPad2(d.getMinutes())}`;
}
function clScheduleTypeLabel(type){ return CL_SCHEDULE_TYPE_LABELS[type] || 'Other'; }
function clScheduleEpisode(item){ return item?.episode_id ? (state.episodes||[]).find(e=>e.id===item.episode_id) : null; }

function clScheduleTypeIcon(type){
  return ({watch:'👀',record:'🎙',edit:'✂️',release:'🚀',premiere:'🎬',guest:'👤',other:'•'})[type] || '•';
}

function clScheduleItemButton(item,compact=false){
  const start=new Date(item.starts_at);
  const time=start.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
  const episode=clScheduleEpisode(item);
  if(compact){
    return `<button class="cl-cal-event cl-type-${esc(item.item_type||'other')}" onclick="clEditScheduleItem('${item.id}')" title="${esc(item.title)} · ${esc(time)}"><span>${clScheduleTypeIcon(item.item_type)}</span><span class="cl-cal-event-time">${esc(time)}</span><span class="cl-cal-event-title">${esc(item.title)}</span></button>`;
  }
  return `<article class="card card-pad cl-schedule-list-card" onclick="clEditScheduleItem('${item.id}')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();clEditScheduleItem('${item.id}')}" aria-label="Edit ${esc(item.title)}">
    <div class="cl-schedule-list-head"><div><div class="kicker">${clScheduleTypeIcon(item.item_type)} ${esc(clScheduleTypeLabel(item.item_type))}</div><h3 style="margin:5px 0">${esc(item.title)}</h3></div><button class="secondary" onclick="event.stopPropagation();clEditScheduleItem('${item.id}')">Edit</button></div>
    <div class="subtle">${esc(fmtDateTime(item.starts_at))}${item.ends_at?` → ${esc(fmtDateTime(item.ends_at))}`:''}${episode?` · Episode: ${esc(episode.title)}`:''}</div>
    ${item.notes?`<p>${esc(item.notes)}</p>`:''}
  </article>`;
}

function clScheduleMonthTitle(){
  return clScheduleCursor.toLocaleDateString(undefined,{month:'long',year:'numeric'});
}

function clCalendarMonthHtml(){
  const year=clScheduleCursor.getFullYear();
  const month=clScheduleCursor.getMonth();
  const first=new Date(year,month,1);
  const last=new Date(year,month+1,0);
  const gridStart=new Date(year,month,1-first.getDay());
  const totalDays=Math.ceil((first.getDay()+last.getDate())/7)*7;
  const todayKey=clLocalDateKey(new Date());
  const itemsByDay=new Map();
  for(const item of (state.schedule||[])){
    const key=clLocalDateKey(item.starts_at);
    if(!key) continue;
    if(!itemsByDay.has(key)) itemsByDay.set(key,[]);
    itemsByDay.get(key).push(item);
  }
  for(const arr of itemsByDay.values()) arr.sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));

  const cells=[];
  for(let i=0;i<totalDays;i++){
    const day=new Date(gridStart);
    day.setDate(gridStart.getDate()+i);
    const key=clLocalDateKey(day);
    const inMonth=day.getMonth()===month;
    const events=itemsByDay.get(key)||[];
    const visible=events.slice(0,3);
    cells.push(`<div class="cl-cal-day ${inMonth?'':'cl-cal-outside'} ${key===todayKey?'cl-cal-today':''}">
      <button class="cl-cal-day-number" onclick="clAddSchedule('${key}')" title="Add item on ${esc(day.toLocaleDateString())}">${day.getDate()}</button>
      <div class="cl-cal-events">${visible.map(e=>clScheduleItemButton(e,true)).join('')}${events.length>3?`<button class="cl-cal-more" onclick="clOpenDayAgenda('${key}')">+${events.length-3} more</button>`:''}</div>
    </div>`);
  }

  return `<div class="cl-calendar-shell">
    <div class="cl-calendar-toolbar">
      <button class="secondary" onclick="clScheduleMoveMonth(-1)">‹</button>
      <button class="secondary" onclick="clScheduleToday()">Today</button>
      <div class="cl-calendar-title">${esc(clScheduleMonthTitle())}</div>
      <button class="secondary" onclick="clScheduleMoveMonth(1)">›</button>
    </div>
    <div class="cl-calendar-weekdays">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div>${d}</div>`).join('')}</div>
    <div class="cl-calendar-grid">${cells.join('')}</div>
  </div>`;
}

function clScheduleListHtml(){
  const sorted=(state.schedule||[]).slice().sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
  if(!sorted.length) return '<div class="empty">Nothing scheduled yet.</div>';
  const now=Date.now();
  const upcoming=sorted.filter(x=>new Date(x.starts_at).getTime()>=now);
  const past=sorted.filter(x=>new Date(x.starts_at).getTime()<now).reverse();
  return `${upcoming.length?`<div class="cl-schedule-section-title">Upcoming</div><div class="list">${upcoming.map(x=>clScheduleItemButton(x)).join('')}</div>`:'<div class="empty">Nothing upcoming.</div>'}
    ${past.length?`<details class="cl-past-schedule"><summary>Past items (${past.length})</summary><div class="list" style="margin-top:10px">${past.map(x=>clScheduleItemButton(x)).join('')}</div></details>`:''}`;
}

function clSchedulePage(){
  return `<section class="section">
    <div class="page-title">Schedule</div>
    <div class="subtle">Watch, record, edit, release, premieres, and guests — all in one shared production calendar.</div>
    <div class="cl-schedule-top-actions">
      <button class="primary" onclick="clAddSchedule()">+ Add schedule item</button>
      <div class="cl-schedule-view-toggle"><button class="${clScheduleView==='calendar'?'primary':'secondary'}" onclick="clSetScheduleView('calendar')">📅 Calendar</button><button class="${clScheduleView==='list'?'primary':'secondary'}" onclick="clSetScheduleView('list')">☰ List</button></div>
    </div>
  </section>
  <section class="section">${clScheduleView==='calendar'?clCalendarMonthHtml():clScheduleListHtml()}</section>`;
}

schedule = clSchedulePage;

function clSetScheduleView(view){ clScheduleView=view==='list'?'list':'calendar'; render(); }
function clScheduleMoveMonth(delta){ clScheduleCursor=new Date(clScheduleCursor.getFullYear(),clScheduleCursor.getMonth()+Number(delta||0),1); render(); }
function clScheduleToday(){ const d=new Date(); clScheduleCursor=new Date(d.getFullYear(),d.getMonth(),1); render(); }

function clDefaultScheduleStart(dateKey=''){
  const d=dateKey ? new Date(`${dateKey}T19:00:00`) : new Date();
  if(!dateKey){ d.setMinutes(Math.ceil(d.getMinutes()/30)*30,0,0); }
  return d;
}

function clAddSchedule(dateKey='',prefill={}){
  const start=prefill.starts_at ? new Date(prefill.starts_at) : clDefaultScheduleStart(dateKey);
  clEditingScheduleItem='new';
  clScheduleDraft={
    title:prefill.title||'',
    item_type:prefill.item_type||'watch',
    starts_at:start.toISOString(),
    ends_at:prefill.ends_at||null,
    notes:prefill.notes||'',
    episode_id:prefill.episode_id||null
  };
  render();
}

addSchedule = function(){ clAddSchedule(); };

scheduleMovie = function(id){
  const m=(state.movies||[]).find(x=>x.id===id);
  if(!m) return;
  clAddSchedule('',{title:m.title,item_type:'watch',notes:`Movie: ${m.title}`});
};

function clEditScheduleItem(id){
  const item=(state.schedule||[]).find(x=>x.id===id);
  if(!item) return;
  clEditingScheduleItem=id;
  clScheduleDraft=null;
  render();
}

function clCloseScheduleEditor(event){
  if(event && event.target!==event.currentTarget) return;
  clEditingScheduleItem=null;
  clScheduleDraft=null;
  render();
}

function clScheduleTypeOptions(current){
  return CL_SCHEDULE_TYPES.map(t=>`<option value="${t}" ${t===current?'selected':''}>${esc(clScheduleTypeLabel(t))}</option>`).join('');
}

function clScheduleEpisodeOptions(current){
  return `<option value="">No linked episode</option>${(state.episodes||[]).slice().sort((a,b)=>a.title.localeCompare(b.title)).map(e=>`<option value="${e.id}" ${e.id===current?'selected':''}>${esc(e.title)}</option>`).join('')}`;
}

function clScheduleEditorModal(){
  if(!clEditingScheduleItem) return '';
  const isNew=clEditingScheduleItem==='new';
  const item=isNew ? clScheduleDraft : (state.schedule||[]).find(x=>x.id===clEditingScheduleItem);
  if(!item) return '';
  return `<div class="modal-backdrop" onclick="clCloseScheduleEditor(event)"><div class="modal cl-schedule-editor" onclick="event.stopPropagation()">
    <div class="modal-header"><div><div class="kicker">Production Schedule</div><h2 style="margin:6px 0">${isNew?'Add schedule item':'Edit schedule item'}</h2></div><button class="close" onclick="clCloseScheduleEditor()">×</button></div>
    <div class="episode-editor-grid">
      <label class="wide">Title<input id="clSchTitle" class="search" value="${esc(item.title||'')}" placeholder="Watch Snowbound for the Holidays"></label>
      <label>Type<select id="clSchType" class="search">${clScheduleTypeOptions(item.item_type||'other')}</select></label>
      <label>Linked episode<select id="clSchEpisode" class="search">${clScheduleEpisodeOptions(item.episode_id||'')}</select></label>
      <label>Starts<input id="clSchStart" class="search" type="datetime-local" value="${esc(clDateTimeLocalValue(item.starts_at))}"></label>
      <label>Ends <span class="subtle">(optional)</span><input id="clSchEnd" class="search" type="datetime-local" value="${esc(clDateTimeLocalValue(item.ends_at))}"></label>
      <label class="wide">Notes<textarea id="clSchNotes" class="search" rows="5" placeholder="Recording details, guest timing, edit deadline…">${esc(item.notes||'')}</textarea></label>
    </div>
    <div class="episode-editor-actions cl-schedule-editor-actions">
      <button class="primary" onclick="clSaveScheduleItem()">${isNew?'Add to schedule':'Save changes'}</button>
      ${!isNew?`<button class="secondary cl-danger-button" onclick="clDeleteScheduleItem('${item.id}')">Delete</button>`:''}
      <button class="secondary" onclick="clCloseScheduleEditor()">Cancel</button>
    </div>
  </div></div>`;
}

async function clSaveScheduleItem(){
  if(!workspace || !clEditingScheduleItem) return;
  const title=(document.getElementById('clSchTitle')?.value||'').trim();
  const type=document.getElementById('clSchType')?.value||'other';
  const startValue=document.getElementById('clSchStart')?.value||'';
  const endValue=document.getElementById('clSchEnd')?.value||'';
  const episodeId=document.getElementById('clSchEpisode')?.value||null;
  const notes=(document.getElementById('clSchNotes')?.value||'').trim()||null;
  if(!title) return alert('Give the schedule item a title.');
  if(!startValue) return alert('Choose a start date and time.');
  const start=new Date(startValue);
  if(Number.isNaN(start.getTime())) return alert('That start date/time is not valid.');
  let end=null;
  if(endValue){
    end=new Date(endValue);
    if(Number.isNaN(end.getTime())) return alert('That end date/time is not valid.');
    if(end.getTime()<start.getTime()) return alert('End time needs to be after the start time.');
  }
  const payload={
    workspace_id:workspace.id,
    title,
    item_type:CL_SCHEDULE_TYPES.includes(type)?type:'other',
    starts_at:start.toISOString(),
    ends_at:end?end.toISOString():null,
    episode_id:episodeId,
    notes
  };
  try{
    if(clEditingScheduleItem==='new'){
      payload.created_by=me();
      const {data,error}=await db.from('schedule_items').insert(payload).select().single();
      if(error) throw error;
      await logActivity(`added ${title} to the schedule.`,'schedule',data?.id||null);
    }else{
      const id=clEditingScheduleItem;
      const {error}=await db.from('schedule_items').update(payload).eq('id',id).eq('workspace_id',workspace.id);
      if(error) throw error;
      await logActivity(`updated scheduled item ${title}.`,'schedule',id);
    }
    clEditingScheduleItem=null; clScheduleDraft=null;
    clScheduleCursor=new Date(start.getFullYear(),start.getMonth(),1);
    await loadAll(); render();
  }catch(err){ alert(err?.message||String(err)); }
}

async function clDeleteScheduleItem(id){
  const item=(state.schedule||[]).find(x=>x.id===id);
  if(!item) return;
  if(!confirm(`Delete “${item.title}” from the schedule?`)) return;
  try{
    const {error}=await db.from('schedule_items').delete().eq('id',id).eq('workspace_id',workspace.id);
    if(error) throw error;
    await logActivity(`deleted scheduled item ${item.title}.`,'schedule',id);
    clEditingScheduleItem=null; clScheduleDraft=null;
    await loadAll(); render();
  }catch(err){ alert(err?.message||String(err)); }
}

function clOpenDayAgenda(dateKey){
  const dayItems=(state.schedule||[]).filter(x=>clLocalDateKey(x.starts_at)===dateKey).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
  if(!dayItems.length) return clAddSchedule(dateKey);
  clScheduleView='list';
  render();
  setTimeout(()=>{
    const first=document.querySelector(`[data-schedule-day="${dateKey}"]`);
    if(first) first.scrollIntoView({behavior:'smooth',block:'center'});
  },0);
}

const clScheduleOriginalModal=modal;
modal=function(){
  if(clEditingScheduleItem) return clScheduleEditorModal();
  return clScheduleOriginalModal();
};

const clScheduleOriginalTopbar=topbar;
topbar=function(){
  return clScheduleOriginalTopbar()
    .replace('>v1.13<','>v1.14<')
    .replace('>v1.12<','>v1.14<')
    .replace('>v1.11<','>v1.14<');
};

(function clScheduleStyles(){
  if(document.getElementById('clScheduleStyles')) return;
  const style=document.createElement('style');
  style.id='clScheduleStyles';
  style.textContent=`
    .cl-schedule-top-actions{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin-top:14px}
    .cl-schedule-view-toggle{display:flex;gap:8px}
    .cl-calendar-shell{background:var(--panel,#181a21);border:1px solid rgba(255,255,255,.08);border-radius:16px;overflow:hidden}
    .cl-calendar-toolbar{display:grid;grid-template-columns:auto auto 1fr auto;gap:8px;align-items:center;padding:12px}
    .cl-calendar-title{text-align:center;font-weight:800;font-size:1.08rem}
    .cl-calendar-weekdays{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-top:1px solid rgba(255,255,255,.08);border-bottom:1px solid rgba(255,255,255,.08)}
    .cl-calendar-weekdays>div{text-align:center;padding:8px 2px;font-size:.76rem;font-weight:800;opacity:.7}
    .cl-calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}
    .cl-cal-day{min-height:112px;padding:6px;border-right:1px solid rgba(255,255,255,.07);border-bottom:1px solid rgba(255,255,255,.07);overflow:hidden}
    .cl-cal-day:nth-child(7n){border-right:0}
    .cl-cal-outside{opacity:.38}
    .cl-cal-today{box-shadow:inset 0 0 0 2px rgba(244,200,75,.65)}
    .cl-cal-day-number{border:0;background:transparent;color:inherit;font-weight:800;padding:2px 5px;border-radius:999px;cursor:pointer}
    .cl-cal-day-number:hover{background:rgba(255,255,255,.08)}
    .cl-cal-events{display:grid;gap:4px;margin-top:4px}
    .cl-cal-event{display:grid;grid-template-columns:auto auto minmax(0,1fr);gap:4px;align-items:center;width:100%;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);color:inherit;border-radius:7px;padding:4px;text-align:left;cursor:pointer;font-size:.68rem;min-width:0}
    .cl-cal-event-time{opacity:.72;white-space:nowrap}
    .cl-cal-event-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}
    .cl-cal-more{border:0;background:transparent;color:inherit;opacity:.72;text-align:left;padding:2px;font-size:.7rem;cursor:pointer}
    .cl-schedule-list-card{cursor:pointer}
    .cl-schedule-list-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
    .cl-schedule-section-title{font-weight:800;margin:0 0 10px}
    .cl-past-schedule{margin-top:18px}
    .cl-schedule-editor{max-width:720px}
    .cl-schedule-editor-actions{flex-wrap:wrap}
    .cl-danger-button{border-color:rgba(232,92,120,.65)!important;color:#ff9db0!important}
    @media(max-width:720px){
      .cl-calendar-toolbar{grid-template-columns:auto auto 1fr auto;padding:8px;gap:5px}
      .cl-calendar-toolbar button{padding:8px 9px}
      .cl-calendar-title{font-size:.95rem}
      .cl-cal-day{min-height:84px;padding:3px}
      .cl-calendar-weekdays>div{font-size:.66rem;padding:6px 1px}
      .cl-cal-event{grid-template-columns:auto minmax(0,1fr);font-size:.62rem;padding:3px}
      .cl-cal-event-time{display:none}
      .cl-cal-day-number{font-size:.78rem;padding:1px 4px}
    }
  `;
  document.head.appendChild(style);
})();

window.clSetScheduleView=clSetScheduleView;
window.clScheduleMoveMonth=clScheduleMoveMonth;
window.clScheduleToday=clScheduleToday;
window.clAddSchedule=clAddSchedule;
window.clEditScheduleItem=clEditScheduleItem;
window.clCloseScheduleEditor=clCloseScheduleEditor;
window.clSaveScheduleItem=clSaveScheduleItem;
window.clDeleteScheduleItem=clDeleteScheduleItem;
window.clOpenDayAgenda=clOpenDayAgenda;
