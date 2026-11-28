// HQ workspace navigation, production overview, and editing safeguards.
(() => {
 let moreOpen=false,pendingRefresh=false;
 const headerObserver=new ResizeObserver(entries=>{
  for(const entry of entries){
   const key=entry.target.classList.contains('hq-topbar')?'--hq-header-height':'--hq-nav-height';
   document.documentElement.style.setProperty(key,Math.ceil(entry.target.getBoundingClientRect().height)+'px');
  }
 });
 const escape=value=>esc(String(value??''));
 const local=key=>{try{return JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{return {}}};
 const routes=[
  ['home','Today','Plan'],['movies','Movie Radar','Plan'],['ourmovies','Our Movies','Plan'],['episodes','Episodes','Plan'],['schedule','Calendar','Plan'],
  ['watchalong','Watch Along','Make'],['recording','Recording','Make'],['production','Production','Make'],['marketing','Marketing','Make'],
  ['cocktails','Cocktail Bar','Library'],['cheesetray','Cheese Grating','Library'],['traits','Trope Library','Library'],['bingo','Bingo Builder','Library'],
  ['producer','Producer Desk','Resources'],['checklist','Podcast 101','Resources'],['lab','Show Lab','Resources']
 ];
 function active(id){
  if(id==='cocktails')return currentTab==='episodes'&&typeof cocktailHubView!=='undefined'&&cocktailHubView==='bar';
  if(id==='episodes')return currentTab==='episodes'&&!(typeof cocktailHubView!=='undefined'&&cocktailHubView==='bar');
  if(['bingo','checklist','lab'].includes(id))return currentTab==='ideas'&&typeof romantiverseHubView!=='undefined'&&romantiverseHubView===id;
  return currentTab===id;
 }
 function navButton(id,label){return '<button type="button" data-hq-route="'+id+'" '+(active(id)?'aria-current="page" class="is-active"':'')+' onclick="hqWorkspace.open(\''+id+'\')">'+escape(label)+'</button>'}
 function tools(){
  return ['Plan','Make','Library','Resources'].map(group=>{
   const actions=routes.filter(r=>r[2]===group).map(r=>navButton(r[0],r[1])).join('');
   if(group==='Library'||group==='Resources'){
    const selected=routes.some(r=>r[2]===group&&active(r[0]));
    return '<details class="hq-nav-group" '+(selected?'open':'')+'><summary>'+group+'</summary><section>'+actions+'</section></details>';
   }
   return '<section><h2>'+group+'</h2>'+actions+'</section>';
  }).join('');
 }
 function nav(){
  return '<a class="hq-skip" href="#hq-main">Skip to workspace</a><aside class="hq-sidebar" aria-label="HQ workspace navigation"><div class="hq-sidebar-brand"><span>CL</span><strong>Cheese Louise<small>Production HQ</small></strong></div>'+tools()+'<p class="hq-local-note">Watch Along notes and recording sessions stay on this browser.</p></aside>'
   +'<nav class="hq-mobile-nav" aria-label="Primary navigation">'+[['home','Today'],['movies','Movies'],['watchalong','Watch'],['recording','Record']].map(r=>navButton(...r)).join('')+'<button type="button" id="hq-more-button" aria-haspopup="dialog" aria-expanded="'+moreOpen+'" aria-controls="hq-more-panel" onclick="hqWorkspace.more()">More</button></nav>'
   +'<button type="button" class="hq-more-backdrop" aria-label="Close workspace tools" '+(!moreOpen?'hidden':'')+' onclick="hqWorkspace.more(false)"></button>'
   +'<div id="hq-more-panel" class="hq-more-panel" role="dialog" aria-modal="true" aria-label="All workspace tools" '+(!moreOpen?'hidden':'')+'><div class="hq-more-heading"><strong>All workspace tools</strong><button type="button" aria-label="Close tools menu" onclick="hqWorkspace.more(false)">Close</button></div>'+tools()+'</div>';
 }
 function dirtyModal(){return document.querySelector('.modal-backdrop .modal[data-hq-dirty="true"]')}
 function open(id){
  if(dirtyModal()&&!confirm('Leave this editor? Changes you have not saved will be lost.'))return;
  if(id==='recording'&&currentTab==='watchalong')window.clProduction?.followWatchMovie?.();
  moreOpen=false;selectedMovie=null;
  const actions={cocktails:'openCocktailBar',traits:'openTraitManager',bingo:'openRomantiverseBingo',checklist:'openPodcastLaunchChecklist',lab:'openShowLabView'};
  if(actions[id]&&typeof window[actions[id]]==='function')window[actions[id]]();
  else if(id==='episodes'){if(typeof cocktailHubView!=='undefined')cocktailHubView='episodes';go('episodes')}
  else if(routes.some(r=>r[0]===id))go(id);
  window.scrollTo({top:0,behavior:'instant'});
  if(!document.querySelector('.modal-backdrop'))document.getElementById('hq-main')?.focus({preventScroll:true});
 }
 function nextEpisode(episodes){
  const done=/^(published|released|complete|completed|cancelled|canceled|retired)$/i;
  return (episodes||[]).filter(e=>!done.test(String(e.status||''))).slice().sort((a,b)=>{
   const date=e=>{const raw=e.release_date;if(!raw)return Infinity;const time=new Date(String(raw).includes('T')?raw:raw+'T12:00:00').getTime();return Number.isFinite(time)?time:Infinity};
   return date(a)-date(b)||String(a.created_at||'').localeCompare(String(b.created_at||''));
  })[0]||null;
 }
 function transcriptSuggestions(){
  const workspaceId=workspace?.id;
  if(!workspaceId)return '';
  queueMicrotask(async()=>{
   const card=document.getElementById('hq-transcript-suggestions');
   if(!card||card.dataset.workspace!==workspaceId)return;
   const body=card.querySelector('div');
   try{
    const {data,error}=await db.from('transcript_suggestions').select('episode_title,source_url,report').eq('workspace_id',workspaceId).order('published_at',{ascending:false}).order('episode_key',{ascending:false}).limit(1);
    if(error)throw error;
    if(!card.isConnected||workspace?.id!==workspaceId)return;
    const report=data?.[0];
    if(!report){body.textContent='Suggestions will appear after a transcript is reviewed.';return;}
    card.querySelector('summary').textContent='Transcript Suggestions · '+report.episode_title;
    const content=document.createElement('p');
    content.style.whiteSpace='pre-wrap';
    content.textContent=report.report;
    const source=document.createElement('a');
    source.href=report.source_url;
    source.textContent='Open episode transcript';
    body.replaceChildren(content,source);
   }catch(error){
    if(card.isConnected)body.textContent='Suggestions could not load. Refresh Today to try again.';
   }
  });
  return '<details id="hq-transcript-suggestions" class="hq-home-extras" data-workspace="'+escape(workspaceId)+'"><summary>Transcript Suggestions</summary><div aria-live="polite">Loading suggestions…</div></details>';
 }
 function dashboard(){
  const next=nextEpisode(state.episodes||[]);
  const stages=[
   ['Plan the episode',[
    ['movies','Find a movie'],
    ['watchalong','Watch Along'],
    ['cocktails','Cocktail Bar'],
    ['bingo','Bingo Builder']
   ]],
   ['Record and edit',[
    ['recording','Recording'],
    ['episodes','Episode details']
   ]],
   ['Publish and promote',[
    ['production','Release checklist'],
    ['schedule','Calendar'],
    ['marketing','Marketing']
   ]]
  ];
  const steps=stages.map(([title,actions])=>
   '<li class="hq-workflow-stage"><h3>'+escape(title)+'</h3><ul>'+actions.map(([id,label])=>
    '<li>'+navButton(id,label)+'</li>'
   ).join('')+'</ul></li>'
  ).join('');
  const nextAction=next?'episodes':'movies';
  return '<section class="section hq-today hq-home-simple"><h1>Today</h1>'
   +'<article class="hq-next-item"><div class="kicker">'+(next?'Next unfinished episode':'Next episode')+'</div><h2>'+escape(next?.title||'Choose a movie')+'</h2>'
   +(next?'<p class="subtle">'+escape(next.status||'Planning')+(next.release_date?' · '+escape(fmtDate(next.release_date)):'')+'</p>':'')
   +'<button type="button" class="primary" onclick="hqWorkspace.open(&quot;'+nextAction+'&quot;)">'+(next?'Open Episodes':'Find a movie')+'</button></article>'
   +'<div class="hq-simple-heading"><h2>Episode workflow</h2></div><ol class="hq-workflow">'+steps+'</ol>'
   +transcriptSuggestions()+'</section>';
 }
 function top(){
  return '<header class="topbar hq-topbar"><div class="hq-topbar-line"><strong>Cheese Louise HQ</strong><details class="hq-account"><summary>'+escape(profile?.display_name||'Account')+'</summary><div><p>Shared workspace · '+(members||[]).length+' members</p><p>Join code: <strong>'+escape(workspace?.join_code||'Not available')+'</strong></p><button class="secondary" onclick="signOut()">Sign out</button></div></details></div><div class="search-row"><label class="hq-search-label" for="globalSearch">Search Movie Radar</label><input id="globalSearch" class="search" type="search" placeholder="Movie title, story idea, actor, or studio" value="'+escape(searchText)+'" oninput="setSearch(this.value)" aria-label="Search Movie Radar"></div><button type="button" id="hq-refresh" class="hq-refresh" '+(!pendingRefresh?'hidden':'')+' onclick="hqWorkspace.refresh()">Shared updates available. Refresh when ready.</button></header>';
 }
 const originalTop=top;
 top=function(){
  const showSearch=['home','movies'].includes(currentTab),route=routes.find(r=>active(r[0]));
  let html=originalTop().replace('<strong>Cheese Louise HQ</strong>','<div class="hq-location"><strong>Cheese Louise HQ</strong><span>'+escape(route?.[1]||'Workspace')+'</span></div>');
  if(!showSearch){const start=html.indexOf('<div class="search-row">'),end=html.indexOf('<button type="button" id="hq-refresh"');
   html=html.slice(0,start)+'<button class="secondary hq-search-shortcut" onclick="hqWorkspace.search()">Find a movie <span aria-hidden="true">↗</span></button>'+html.slice(end);
  }
  return html;
 };
 const oldShell=shell;
 shell=function(content){const focused=document.activeElement,searchFocus=focused?.id==='globalSearch'?{start:focused.selectionStart,end:focused.selectionEnd}:null;oldShell(content);if(searchFocus&&!document.querySelector('.modal-backdrop')){const field=document.getElementById('globalSearch');if(field){field.focus({preventScroll:true});try{field.setSelectionRange(searchFocus.start,searchFocus.end)}catch{}}}const host=document.querySelector('#app > .app-shell');document.body.classList.toggle('hq-signed-in',!!(session&&workspace));if(host){host.id='hq-main';host.tabIndex=-1}annotateDialogs()};
 const layoutShell=shell;
 shell=function(content){
  layoutShell(content);
  const main=document.getElementById('hq-main');
  if(main){main.dataset.hqView=currentTab;main.setAttribute('role','main');main.inert=moreOpen;}
  document.body.classList.toggle('hq-tools-open',moreOpen);
  headerObserver.disconnect();
  for(const selector of ['.hq-topbar','.hq-mobile-nav']){const element=document.querySelector(selector);if(element)headerObserver.observe(element);}
 };
 tabs=nav;window.tabs=tabs;topbar=top;window.topbar=topbar;home=dashboard;window.home=home;
 function shouldDeferRefresh(){
  const editing=document.activeElement?.matches?.('input,textarea,select,[contenteditable="true"]');
  if(editing||document.querySelector('.modal-backdrop')||['recording','watchalong','production'].includes(currentTab)){pendingRefresh=true;const button=document.getElementById('hq-refresh');if(button)button.hidden=false;return true}return false;
 }
 async function refresh(){if(dirtyModal()&&!confirm('Refresh this editor? Unsaved changes will be lost.'))return;try{await loadAll();pendingRefresh=false;render()}catch(error){loadError(error)}}
 function loadError(){pendingRefresh=true;const button=document.getElementById('hq-refresh');if(button){button.hidden=false;button.textContent='Shared data could not refresh. Your current view is kept. Tap to retry.'}}
 function more(value){moreOpen=typeof value==='boolean'?value:!moreOpen;const panel=document.getElementById('hq-more-panel'),button=document.getElementById('hq-more-button');if(panel)panel.hidden=!moreOpen;if(button)button.setAttribute('aria-expanded',String(moreOpen));const backdrop=document.querySelector('.hq-more-backdrop');if(backdrop)backdrop.hidden=!moreOpen;const main=document.getElementById('hq-main');if(main)main.inert=moreOpen;document.body.classList.toggle('hq-tools-open',moreOpen);if(moreOpen)panel?.querySelector('button')?.focus();else button?.focus()}
 function annotateDialogs(){
  const dialog=document.querySelector('.modal-backdrop .modal');
  document.body.classList.toggle('hq-modal-open',!!dialog);
  if(!dialog||dialog.dataset.hqDialog)return;
  dialog.dataset.hqDialog='true';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',dialog.querySelector('h2,h3')?.textContent?.trim()||'HQ editor');
  requestAnimationFrame(()=>dialog.querySelector('.close,button,input,textarea')?.focus({preventScroll:true}));
 }
 window.matchMedia('(min-width:901px)').addEventListener('change',event=>{
  if(event.matches&&moreOpen){more(false);document.getElementById('hq-main')?.focus({preventScroll:true});}
 });
 const observer=new MutationObserver(annotateDialogs);observer.observe(document.getElementById('app'),{childList:true,subtree:true});
 document.addEventListener('input',event=>{const dialog=event.target.closest?.('.modal');if(dialog){event.target.dataset.hqDirtyField='true';dialog.dataset.hqDirty='true'}},true);
 document.addEventListener('change',event=>{const dialog=event.target.closest?.('.modal');if(dialog)dialog.dataset.hqDirty='true'},true);
 document.addEventListener('click',event=>{if(!event.target.closest?.('.modal .close,[data-close-modal]'))return;if(dirtyModal()&&!confirm('Close without saving your changes?')){event.preventDefault();event.stopImmediatePropagation()}},true);
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&moreOpen){event.preventDefault();event.stopImmediatePropagation();more(false);return}
  if(event.key==='Tab'&&moreOpen){
   const controls=[...document.querySelectorAll('#hq-more-panel button')].filter(el=>el.getClientRects().length),first=controls[0],last=controls[controls.length-1];
   if(event.shiftKey&&(document.activeElement===first||!controls.includes(document.activeElement))){event.preventDefault();last?.focus()}
   else if(!event.shiftKey&&(document.activeElement===last||!controls.includes(document.activeElement))){event.preventDefault();first?.focus()}
   return;
  }
  const dialog=document.querySelector('.modal-backdrop .modal');
  if(!dialog)return;
  if(event.key==='Escape'&&dirtyModal()){if(!confirm('Close without saving your changes?')){event.preventDefault();event.stopImmediatePropagation();return}dialog.dataset.hqDirty='false'}
  if(event.key==='Tab'){
   const controls=[...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex="0"]')].filter(el=>el.getClientRects().length);
   if(!controls.length){event.preventDefault();return}
   const first=controls[0],last=controls[controls.length-1];
   if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus()}
  }
 },true);
 function cleanForm(form){form.querySelectorAll('[data-hq-dirty-field]').forEach(field=>delete field.dataset.hqDirtyField);const modal=form.closest('.modal');if(modal)modal.dataset.hqDirty=String(!!modal.querySelector('[data-hq-dirty-field="true"]'))}
 const originalMovies=movies;
 function quickFilters(){
  const select=(id,label,values,current,handler)=>'<label for="'+id+'">'+label+'<select id="'+id+'" onchange="'+handler+'(this.value)"><option value="">All '+label.toLowerCase()+'s</option><option value="__unknown__" '+(current==='__unknown__'?'selected':'')+'>Not classified</option>'+values.map(value=>'<option value="'+escape(value)+'" '+(value===current?'selected':'')+'>'+escape(value)+'</option>').join('')+'</select></label>';
  return '<div class="hq-quick-filters" aria-label="Quick movie filters">'+select('hq-season','Season',CL_SEASONS,movieFilters.season,'setSeasonFilter')+select('hq-holiday','Holiday',CL_HOLIDAYS,movieFilters.holiday,'setHolidayFilter')+'<button class="secondary" type="button" onclick="clearMovieFilters()">Reset filters</button><p>Choose a season or holiday to find more candidates. Use Filters for year, studio, votes, and other details.</p></div>';
 }
 movies=function(...args){return originalMovies.apply(this,args).replace('<div id="movieFilterHost">',quickFilters()+'<div id="movieFilterHost">')};
 for(const name of ['setSeasonFilter','setHolidayFilter','applyFilterPreset','clearMovieFilters']){
  const previous=window[name];
  window[name]=function(...args){const result=previous.apply(this,args);for(const [id,key] of [['hq-season','season'],['hq-holiday','holiday']]){const control=document.getElementById(id);if(control)control.value=movieFilters[key]||''}if(name==='applyFilterPreset'||name==='clearMovieFilters')scheduleRomantiverseSearch(searchText);return result};
 }
 document.addEventListener('click',event=>{const action=event.target.closest?.('button[onclick]')?.getAttribute('onclick')||'';if(!dirtyModal())return;if(action.includes('scheduleEpisode(')){event.preventDefault();event.stopImmediatePropagation();alert('Save your episode edits before scheduling the recording.');return}if(action.includes('openCocktailBarFromEpisode(')&&!confirm('Open the Cocktail Bar without saving episode edits?')){event.preventDefault();event.stopImmediatePropagation()}},true);
 window.hqWorkspace={open,more,refresh,shouldDeferRefresh,nextEpisode,loadError,cleanForm,search(){open('movies');requestAnimationFrame(()=>document.getElementById('globalSearch')?.focus())}};
 // Respect the existing auth/recovery startup. Repaint only an already authenticated workspace.
 if(session&&workspace)render();
})();
