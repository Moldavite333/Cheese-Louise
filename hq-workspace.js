// HQ workspace navigation, production overview, and editing safeguards.
(() => {
 let moreOpen=false,pendingRefresh=false;
 const escape=value=>esc(String(value??''));
 const local=key=>{try{return JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{return {}}};
 const routes=[
  ['home','Today','Plan'],['movies','Movie Radar','Plan'],['episodes','Episodes','Plan'],['schedule','Calendar','Plan'],
  ['watchalong','Watch Along','Make'],['recording','Recording','Make'],
  ['cocktails','Cocktail Bar','Library'],['cheesetray','Cheese Grating','Library'],['traits','Trope Library','Library'],['bingo','Bingo Builder','Library'],
  ['producer','Producer Desk','Resources'],['checklist','Podcast 101','Resources'],['lab','Show Lab','Resources'],['rules','Rules archive','Resources'],['ruleify','Ruleify archive','Resources']
 ];
 function active(id){
  if(id==='cocktails')return currentTab==='episodes'&&typeof cocktailHubView!=='undefined'&&cocktailHubView==='bar';
  if(id==='episodes')return currentTab==='episodes'&&!(typeof cocktailHubView!=='undefined'&&cocktailHubView==='bar');
  if(['bingo','checklist','lab','rules','ruleify'].includes(id))return currentTab==='ideas'&&typeof romantiverseHubView!=='undefined'&&romantiverseHubView===id;
  return currentTab===id;
 }
 function navButton(id,label){return '<button type="button" data-hq-route="'+id+'" '+(active(id)?'aria-current="page" class="is-active"':'')+' onclick="hqWorkspace.open(\''+id+'\')">'+escape(label)+'</button>'}
 function tools(){return ['Plan','Make','Library','Resources'].map(group=>'<section><h2>'+group+'</h2>'+routes.filter(r=>r[2]===group).map(r=>navButton(r[0],r[1])).join('')+'</section>').join('')}
 function nav(){
  return '<a class="hq-skip" href="#hq-main">Skip to workspace</a><aside class="hq-sidebar" aria-label="HQ workspace navigation"><div class="hq-sidebar-brand"><span>CL</span><strong>Cheese Louise<small>Production HQ</small></strong></div>'+tools()+'<p class="hq-local-note">Watch Along notes and recording sessions stay on this browser.</p></aside>'
   +'<nav class="hq-mobile-nav" aria-label="Primary navigation">'+[['home','Today'],['movies','Movies'],['watchalong','Watch'],['recording','Record']].map(r=>navButton(...r)).join('')+'<button type="button" id="hq-more-button" aria-expanded="'+moreOpen+'" aria-controls="hq-more-panel" onclick="hqWorkspace.more()">More</button></nav>'
   +'<div id="hq-more-panel" class="hq-more-panel" '+(!moreOpen?'hidden':'')+'><div class="hq-more-heading"><strong>All workspace tools</strong><button type="button" aria-label="Close tools menu" onclick="hqWorkspace.more(false)">Close</button></div>'+tools()+'</div>';
 }
 function dirtyModal(){return document.querySelector('.modal-backdrop .modal[data-hq-dirty="true"]')}
 function open(id){
  if(dirtyModal()&&!confirm('Leave this editor? Changes you have not saved will be lost.'))return;
  moreOpen=false;selectedMovie=null;
  const actions={cocktails:'openCocktailBar',traits:'openTraitManager',bingo:'openRomantiverseBingo',checklist:'openPodcastLaunchChecklist',lab:'openShowLabView',rules:'openRomantiverseRules',ruleify:'openRuleify'};
  if(actions[id]&&typeof window[actions[id]]==='function')window[actions[id]]();
  else if(id==='episodes'){if(typeof cocktailHubView!=='undefined')cocktailHubView='episodes';go('episodes')}
  else if(routes.some(r=>r[0]===id))go(id);
  window.scrollTo({top:0,behavior:'instant'});
 }
 function nextEpisode(episodes){
  const done=/^(published|released|complete|completed|cancelled|canceled|retired)$/i;
  const today=new Date();today.setHours(0,0,0,0);
  return (episodes||[]).filter(e=>!done.test(String(e.status||''))).slice().sort((a,b)=>{
   const date=e=>{const raw=e.release_date;if(!raw)return Infinity;const time=new Date(raw+'T12:00:00').getTime();return Number.isFinite(time)?time:Infinity};
   return date(a)-date(b)||String(a.created_at||'').localeCompare(String(b.created_at||''));
  })[0]||null;
 }
 function dashboard(){
  const movies=state.movies||[],episodes=state.episodes||[],next=nextEpisode(episodes);
  const missing=movies.filter(m=>window.clCredits?.get(m).missing.length);
  const wid=workspace?.id||'local',production=local('cheeseLouise:production:v1:'+wid),saved=production.sessions?.[production.movieId]||production.session;
  const cards=[['movies','Find a movie','Search seasons, holidays, titles, and story ideas.'],['watchalong','Watch & capture','Keep notes and put the tropes in talk order.'],['recording','Run the recording','Your rundown, segment timer, and edit markers.'],['episodes','Prepare the release','Episode details, cocktail, and release planning.']];
  return '<section class="section hq-today"><div class="hq-page-eyebrow">YOUR PRODUCTION WORKSPACE</div><h1>Make the next episode.</h1><p class="hq-lede">Find it. Watch it. Record it. Bring it to the show.</p><div class="hq-workflow">'+cards.map(([id,title,body],i)=>'<button type="button" onclick="hqWorkspace.open(\''+id+'\')"><span class="hq-step">'+(i+1)+'</span><strong>'+title+'</strong><span>'+body+'</span><b aria-hidden="true">↗</b></button>').join('')+'</div></section>'
   +'<section class="section hq-overview"><article class="card card-pad"><div class="kicker">Next unfinished episode</div><h2>'+escape(next?.title||'Choose your next episode')+'</h2><p class="subtle">'+(next?escape(next.status||'Planning')+' · '+(next.release_date?'Release '+escape(fmtDate(next.release_date)):'Release date not set'):'Create an episode when your movie is chosen.')+'</p><button class="primary" onclick="hqWorkspace.open(\'episodes\')">Open episode planning</button></article>'
   +'<article class="card card-pad"><div class="kicker">Recording desk</div><h2>'+escape(saved?.title||'Ready when you are')+'</h2><p class="subtle">'+(saved?escape(saved.finished?'Session completed':saved.runningSince?'Timer running':'Saved on this browser')+' · '+(saved.markers?.length||0)+' editing markers':'Pick a movie and prepare the recording rundown.')+'</p><button class="secondary" onclick="hqWorkspace.open(\'recording\')">Open recording</button></article></section>'
   +'<section class="section"><div class="hq-section-title"><div><div class="kicker">Prep check</div><h2>Research before the microphones go on</h2></div><span class="pill">'+missing.length+' need credits</span></div><div class="hq-research-list">'+(missing.slice(0,5).map(m=>'<button data-hq-movie="'+escape(m.id)+'" onclick="openMovie(this.dataset.hqMovie)"><strong>'+escape(m.title)+'</strong><span>'+escape(clCredits.get(m).missing.join(' · '))+' missing</span><b aria-hidden="true">→</b></button>').join('')||'<div class="empty">'+(movies.length?'Production company and director are recorded for your saved movies.':'Save movies to start preparing the show.')+'</div>')+'</div></section>'
   +'<section class="section"><div class="hq-section-title"><h2>Recent activity</h2><button class="secondary" onclick="hqWorkspace.open(\'schedule\')">Open calendar</button></div><div class="activity-list">'+(state.activity||[]).slice(0,5).map(a=>'<div class="activity-item"><div><strong>'+escape(memberName(a.user_id))+'</strong> '+escape(a.action)+'</div></div>').join('')+'</div></section>';
 }
 function top(){
  return '<header class="topbar hq-topbar"><div class="hq-topbar-line"><strong>Cheese Louise HQ</strong><details class="hq-account"><summary>'+escape(profile?.display_name||'Account')+'</summary><div><p>Shared workspace · '+(members||[]).length+' members</p><p>Join code: <strong>'+escape(workspace?.join_code||'Not available')+'</strong></p><button class="secondary" onclick="signOut()">Sign out</button></div></details></div><div class="search-row"><label class="hq-search-label" for="globalSearch">Search Movie Radar</label><input id="globalSearch" class="search" type="search" placeholder="Movie title, story idea, actor, or studio" value="'+escape(searchText)+'" oninput="setSearch(this.value)" aria-label="Search Movie Radar"><button class="quick-add" aria-label="Add a show idea" title="Add a show idea" onclick="quickAdd()">+</button></div><button type="button" id="hq-refresh" class="hq-refresh" '+(!pendingRefresh?'hidden':'')+' onclick="hqWorkspace.refresh()">Shared updates available. Refresh when ready.</button></header>';
 }
 const oldShell=shell;
 shell=function(content){oldShell(content);const host=document.querySelector('#app > .app-shell');document.body.classList.toggle('hq-signed-in',!!(session&&workspace));if(host){host.id='hq-main';host.tabIndex=-1}annotateDialogs()};
 tabs=nav;window.tabs=tabs;topbar=top;window.topbar=topbar;home=dashboard;window.home=home;
 function shouldDeferRefresh(){
  const editing=document.activeElement?.matches?.('input,textarea,select,[contenteditable="true"]');
  if(editing||document.querySelector('.modal-backdrop')||['recording','watchalong'].includes(currentTab)){pendingRefresh=true;const button=document.getElementById('hq-refresh');if(button)button.hidden=false;return true}return false;
 }
 async function refresh(){if(dirtyModal()&&!confirm('Refresh this editor? Unsaved changes will be lost.'))return;try{await loadAll();pendingRefresh=false;render()}catch(error){loadError(error)}}
 function loadError(){pendingRefresh=true;const button=document.getElementById('hq-refresh');if(button){button.hidden=false;button.textContent='Shared data could not refresh. Your current view is kept. Tap to retry.'}}
 function more(value){moreOpen=typeof value==='boolean'?value:!moreOpen;const panel=document.getElementById('hq-more-panel'),button=document.getElementById('hq-more-button');if(panel)panel.hidden=!moreOpen;if(button)button.setAttribute('aria-expanded',String(moreOpen));if(moreOpen)panel?.querySelector('button')?.focus();else button?.focus()}
 function annotateDialogs(){
  const dialog=document.querySelector('.modal-backdrop .modal');
  document.body.classList.toggle('hq-modal-open',!!dialog);
  if(!dialog||dialog.dataset.hqDialog)return;
  dialog.dataset.hqDialog='true';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',dialog.querySelector('h2,h3')?.textContent?.trim()||'HQ editor');
  requestAnimationFrame(()=>dialog.querySelector('.close,button,input,textarea')?.focus({preventScroll:true}));
 }
 const observer=new MutationObserver(annotateDialogs);observer.observe(document.getElementById('app'),{childList:true,subtree:true});
 document.addEventListener('input',event=>{const dialog=event.target.closest?.('.modal');if(dialog)dialog.dataset.hqDirty='true'},true);
 document.addEventListener('change',event=>{const dialog=event.target.closest?.('.modal');if(dialog)dialog.dataset.hqDirty='true'},true);
 document.addEventListener('click',event=>{if(!event.target.closest?.('.modal .close,[data-close-modal]'))return;if(dirtyModal()&&!confirm('Close without saving your changes?')){event.preventDefault();event.stopImmediatePropagation()}},true);
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&moreOpen){event.preventDefault();event.stopImmediatePropagation();more(false);return}
  const dialog=document.querySelector('.modal-backdrop .modal');
  if(!dialog)return;
  if(event.key==='Escape'&&dirtyModal()&&!confirm('Close without saving your changes?')){event.preventDefault();event.stopImmediatePropagation();return}
  if(event.key==='Tab'){
   const controls=[...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex="0"]')].filter(el=>el.getClientRects().length);
   if(!controls.length){event.preventDefault();return}
   const first=controls[0],last=controls[controls.length-1];
   if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus()}
  }
 },true);
 window.hqWorkspace={open,more,refresh,shouldDeferRefresh,nextEpisode,loadError};
 // Respect the existing auth/recovery startup. Repaint only an already authenticated workspace.
 if(session&&workspace)render();
})();
