// Cheese Louise v1.3 — Cheese Traits, automatic Cheese Rating, and trait filters.
// Loaded after app.js and before auth-enhancements.js so password-recovery guards
// still wrap the finished application.

state.traits = state.traits || [];
state.filterPresets = state.filterPresets || [];

let cheeseTraitRows = [];
let showMovieFilters = false;
let showTraitManager = false;
let traitSearch = '';
let traitSelectedOnly = false;
let movieFilters = { mode:'all', minScore:0, traitIds:[], traitCategories:[], status:null };

const traitById = (id) => state.traits.find(t => t.id === id);

// --- Data ------------------------------------------------------------------
const cheeseOriginalLoadAll = loadAll;
loadAll = async function(){
  await cheeseOriginalLoadAll();
  if(!workspace) return;

  const wid = workspace.id;
  const [traitsRes, movieTraitsRes, presetsRes] = await Promise.all([
    db.from('cheese_traits').select('*').eq('workspace_id',wid).order('sort_order').order('name'),
    db.from('movie_traits').select('*').eq('workspace_id',wid),
    db.from('filter_presets').select('*').eq('workspace_id',wid).order('name')
  ]);

  const err = traitsRes.error || movieTraitsRes.error || presetsRes.error;
  if(err) throw err;

  state.traits = traitsRes.data || [];
  state.filterPresets = presetsRes.data || [];
  cheeseTraitRows = movieTraitsRes.data || [];

  state.movies = state.movies.map(m => {
    const selectedTraitIds = cheeseTraitRows.filter(mt => mt.movie_id === m.id).map(mt => mt.trait_id);
    const selectedTraits = selectedTraitIds.map(traitById).filter(Boolean);
    return {
      ...m,
      score: Number(m.cheese_score ?? 0),
      selectedTraitIds,
      selectedTraits
    };
  });
};

// --- Movie cards and filtering ---------------------------------------------
function cheeseTraitPills(m, limit=3){
  const traits=(m.selectedTraits||[]).slice().sort((a,b)=>b.points-a.points || a.name.localeCompare(b.name));
  if(!traits.length) return (m.tags||[]).slice(0,limit).map(t=>`<span class="pill">${esc(t)}</span>`).join('');
  return traits.slice(0,limit).map(t=>`<span class="pill trait-pill">${esc(t.name)} <b>+${t.points}</b></span>`).join('');
}

movieCard = function(m){
  const v=m.votes?.[me()];
  const b=!!m.bookmarks?.[me()];
  const count=m.selectedTraitIds?.length||0;
  return `<article class="movie-card card">
    <div class="poster" onclick="openMovie('${m.id}')"><div class="poster-title">${esc(m.title)}</div></div>
    <div class="movie-body">
      <div class="score-row"><span class="subtle">${esc(m.network||'Unknown')} • ${esc(m.date)}</span><span class="cheese-score">🧀 ${esc(m.score)}</span></div>
      <div class="pills">${cheeseTraitPills(m)}</div>
      <div class="subtle">${count ? `${count} Cheese Trait${count===1?'':'s'} · ` : ''}${consensus(m)}</div>
      <div class="vote-row">
        <button class="vote-btn ${v==='yes'?'active-yes':''}" onclick="vote('${m.id}','yes')">❤️ Yes</button>
        <button class="vote-btn ${v==='maybe'?'active-maybe':''}" onclick="vote('${m.id}','maybe')">🤔 Maybe</button>
        <button class="vote-btn ${v==='no'?'active-no':''}" onclick="vote('${m.id}','no')">❌ No</button>
      </div>
      <div class="actions">
        <button class="${b?'active':''}" onclick="bookmark('${m.id}')">🔖 ${b?'Saved':'Save'}</button>
        <button onclick="openMovie('${m.id}')">🧀 Score</button>
        <button onclick="scheduleMovie('${m.id}')">📅</button>
      </div>
    </div>
  </article>`;
};

function movieMatchesCheeseFilters(m){
  const q=searchText.trim().toLowerCase();
  if(q){
    const hay=[m.title,m.network,m.summary,m.notes,...(m.tags||[]),...(m.comments||[]).map(c=>c.body),...(m.selectedTraits||[]).map(t=>`${t.name} ${t.category}`)].join(' ').toLowerCase();
    if(!hay.includes(q)) return false;
  }
  if(movieFilters.mode==='mutual' && Object.values(m.votes||{}).filter(v=>v==='yes').length<2) return false;
  if(movieFilters.mode==='saved' && !m.bookmarks?.[me()]) return false;
  if(movieFilters.mode==='unreviewed' && m.votes?.[me()]) return false;
  if(movieFilters.mode==='needs_review' && m.status!=='needs_review') return false;
  if(Number(m.score||0) < Number(movieFilters.minScore||0)) return false;
  if(movieFilters.status && m.status!==movieFilters.status) return false;
  if((movieFilters.traitIds||[]).length && !movieFilters.traitIds.every(id=>m.selectedTraitIds?.includes(id))) return false;
  if((movieFilters.traitCategories||[]).length){
    const cats=new Set((m.selectedTraits||[]).map(t=>t.category));
    if(!movieFilters.traitCategories.every(c=>cats.has(c))) return false;
  }
  return true;
}

filteredMovies = function(){ return state.movies.filter(movieMatchesCheeseFilters); };

function activeFilterCount(){
  return (movieFilters.mode!=='all'?1:0) + (movieFilters.minScore?1:0) + (movieFilters.traitIds?.length||0) + (movieFilters.traitCategories?.length||0) + (movieFilters.status?1:0);
}

function cheeseFilterPanel(){
  const activeTraits=state.traits.filter(t=>t.is_active);
  const grouped=activeTraits.reduce((a,t)=>((a[t.category]??=[]).push(t),a),{});
  return `<div class="card card-pad filter-panel">
    <div class="filter-panel-head">
      <div><strong>Find the exact flavor of cheese</strong><div class="subtle">Selected traits use AND logic: every selected trait must be present.</div></div>
      <button class="secondary" onclick="clearMovieFilters()">Clear</button>
    </div>
    <div class="score-filter">
      <label for="minCheese"><strong>Minimum Cheese Rating</strong></label>
      <input id="minCheese" type="range" min="0" max="75" step="5" value="${Number(movieFilters.minScore||0)}" oninput="previewMinCheese(this.value)" onchange="setMinCheese(this.value)">
      <span id="minCheeseValue" class="cheese-score">🧀 ${Number(movieFilters.minScore||0)}+</span>
    </div>
    ${Object.entries(grouped).map(([category,traits])=>`<div class="filter-category"><div class="kicker">${esc(category)}</div><div class="trait-chip-grid">${traits.map(t=>`<button class="trait-chip ${(movieFilters.traitIds||[]).includes(t.id)?'selected':''}" onclick="toggleMovieFilterTrait('${t.id}')">${esc(t.name)} <b>+${t.points}</b></button>`).join('')}</div></div>`).join('')}
    <div class="preset-actions"><button class="secondary" onclick="saveCurrentFilterPreset()">Save current filter</button><button class="secondary" onclick="openTraitManager()">Manage Cheese Traits</button></div>
  </div>`;
}

function cheesePresetButtons(){
  if(!state.filterPresets.length) return '';
  return `<div class="preset-row">${state.filterPresets.map(p=>`<span class="preset-wrap"><button class="filter preset-button" onclick="applyFilterPreset('${p.id}')">${esc(p.name)}</button><button class="preset-delete" title="Delete preset" onclick="deleteFilterPreset('${p.id}')">×</button></span>`).join('')}</div>`;
}

movies = function(){
  const found=filteredMovies();
  const filterCount=activeFilterCount();
  return `<section class="section">
    <div class="page-title">Movie Radar</div>
    <div class="subtle">Find, save, vote, discuss — and build the Cheese Rating from actual Romantiverse traits.</div>
    <div class="movie-header-actions"><button class="primary" onclick="addMovie()">+ Add movie</button><button class="secondary" onclick="toggleMovieFilters()">⚙ Filters${filterCount?` (${filterCount})`:''}</button><button class="secondary" onclick="openTraitManager()">🧀 Trait Library</button></div>
  </section>
  <section class="section">
    <div class="toolbar"><button class="filter ${movieFilters.mode==='all'?'active-filter':''}" onclick="filterPreset('all')">All</button><button class="filter ${movieFilters.mode==='mutual'?'active-filter':''}" onclick="filterPreset('mutual')">🔥 Mutual</button><button class="filter ${movieFilters.mode==='saved'?'active-filter':''}" onclick="filterPreset('saved')">🔖 Saved</button><button class="filter ${movieFilters.mode==='unreviewed'?'active-filter':''}" onclick="filterPreset('unreviewed')">🆕 Unreviewed</button><button class="filter ${movieFilters.mode==='needs_review'?'active-filter':''}" onclick="filterPreset('needs_review')">👀 Needs Review</button></div>
    ${cheesePresetButtons()}
    ${showMovieFilters?cheeseFilterPanel():''}
    <div id="resultsLine" class="results-line"><strong>${found.length}</strong> movie${found.length===1?'':'s'} match${found.length===1?'es':''}</div>
    <div id="movieGrid" class="movie-grid">${found.map(movieCard).join('')||'<div class="empty">Nothing matches those filters. That may be too specific even for Hallmark.</div>'}</div>
  </section>`;
};

function refreshMovieGrid(){
  if(currentTab!=='movies') return;
  const arr=filteredMovies();
  const grid=document.getElementById('movieGrid');
  const line=document.getElementById('resultsLine');
  if(grid) grid.innerHTML=arr.map(movieCard).join('')||'<div class="empty">Nothing matches those filters. That may be too specific even for Hallmark.</div>';
  if(line) line.innerHTML=`<strong>${arr.length}</strong> movie${arr.length===1?'':'s'} match${arr.length===1?'es':''}`;
}

// --- Movie Cheese Trait picker ---------------------------------------------
function traitPickerHtml(m){
  const q=traitSearch.trim().toLowerCase();
  const selected=new Set(m.selectedTraitIds||[]);
  const available=state.traits.filter(t=>(t.is_active||selected.has(t.id)) && (!traitSelectedOnly||selected.has(t.id)) && (!q||`${t.name} ${t.category}`.toLowerCase().includes(q)));
  const grouped=available.reduce((acc,t)=>((acc[t.category]??=[]).push(t),acc),{});
  if(!available.length) return '<div class="empty">No Cheese Traits match this view.</div>';
  return Object.entries(grouped).map(([category,traits])=>`<div class="trait-category"><div class="trait-category-title"><span>${esc(category)}</span><span class="subtle">${traits.filter(t=>selected.has(t.id)).length} selected</span></div><div class="trait-toggle-list">${traits.map(t=>`<button class="trait-toggle ${selected.has(t.id)?'selected':''} ${!t.is_active?'retired':''}" onclick="toggleMovieTrait('${m.id}','${t.id}')"><span class="trait-check">${selected.has(t.id)?'✓':'○'}</span><span class="trait-name">${esc(t.name)}${!t.is_active?' <em>(retired)</em>':''}</span><span class="trait-points">+${t.points}</span></button>`).join('')}</div></div>`).join('');
}

function cheeseMovieModal(){
  const m=state.movies.find(x=>x.id===selectedMovie);
  if(!m) return '';
  const v=m.votes?.[me()];
  const count=m.selectedTraitIds?.length||0;
  return `<div class="modal-backdrop" onclick="closeMovie(event)"><div class="modal movie-modal" onclick="event.stopPropagation()">
    <div class="modal-header"><div><div class="kicker">${esc(m.network||'Unknown')} • ${esc(m.date)}</div><h2 style="margin:6px 0">${esc(m.title)}</h2><div class="cheese-total"><span>🧀 Cheese Rating</span><strong>${esc(m.score)}</strong></div><div class="subtle">${count} trait${count===1?'':'s'} selected · Higher = cheesier, not “better.”</div></div><button class="close" onclick="selectedMovie=null;traitSearch='';traitSelectedOnly=false;render()">×</button></div>
    <p>${esc(m.summary||'No summary yet.')}</p>
    <div class="movie-status-row"><span class="subtle">Radar status</span><button class="filter ${m.status==='needs_review'?'active-filter':''}" onclick="setMovieStatus('${m.id}','needs_review')">Needs Review</button><button class="filter ${m.status==='radar'?'active-filter':''}" onclick="setMovieStatus('${m.id}','radar')">Radar</button><button class="filter ${m.status==='watched'?'active-filter':''}" onclick="setMovieStatus('${m.id}','watched')">Watched</button><button class="filter ${m.status==='passed'?'active-filter':''}" onclick="setMovieStatus('${m.id}','passed')">Passed</button></div>
    <div class="trait-tools"><input id="traitSearch" class="search" placeholder="Search Cheese Traits…" value="${esc(traitSearch)}" oninput="setTraitSearch(this.value)"><button class="secondary ${traitSelectedOnly?'active-filter':''}" onclick="toggleSelectedTraitsOnly()">Selected only</button></div>
    <div class="trait-actions"><button class="secondary" onclick="suggestTraits('${m.id}')">✨ Suggest from synopsis</button><button class="secondary" onclick="openTraitManager()">⚙ Edit trait library</button></div>
    <div id="traitPickerBody" class="trait-picker">${traitPickerHtml(m)}</div>
    <div style="margin-top:18px"><strong>${consensus(m)}</strong></div>
    <div class="vote-row" style="margin-top:10px"><button class="vote-btn ${v==='yes'?'active-yes':''}" onclick="vote('${m.id}','yes')">❤️ Yes</button><button class="vote-btn ${v==='maybe'?'active-maybe':''}" onclick="vote('${m.id}','maybe')">🤔 Maybe</button><button class="vote-btn ${v==='no'?'active-no':''}" onclick="vote('${m.id}','no')">❌ No</button></div>
    <h3 style="margin-top:22px">Comments</h3>${m.comments.map(c=>`<div class="comment"><strong>${esc(memberName(c.user_id))}</strong><div>${esc(c.body)}</div></div>`).join('')||'<div class="subtle" style="margin-top:8px">No comments yet.</div>'}<div class="comment-box"><input id="commentInput" placeholder="Add a note…"><button class="primary" onclick="comment('${m.id}')">Send</button></div>
  </div></div>`;
}

function cheeseTraitManagerModal(){
  const categories=[...new Set(state.traits.map(t=>t.category))].sort();
  return `<div class="modal-backdrop" onclick="closeTraitManager(event)"><div class="modal trait-manager" onclick="event.stopPropagation()">
    <div class="modal-header"><div><div class="kicker">Cheese Louise scoring system</div><h2 style="margin:6px 0">Cheese Trait Library</h2><div class="subtle">Edit points once and every movie using that trait updates automatically. Retired traits stay on old movies.</div></div><button class="close" onclick="closeTraitManager()">×</button></div>
    <div class="trait-manager-actions"><button class="primary" onclick="addTrait()">+ Add Cheese Trait</button><span class="pill">${state.traits.filter(t=>t.is_active).length} active</span><span class="pill">${state.traits.filter(t=>!t.is_active).length} retired</span></div>
    ${categories.map(category=>{const traits=state.traits.filter(t=>t.category===category).sort((a,b)=>a.sort_order-b.sort_order||a.name.localeCompare(b.name));return `<div class="manager-category"><div class="trait-category-title"><strong>${esc(category)}</strong><span class="subtle">${traits.length}</span></div>${traits.map(t=>`<div class="manager-trait ${!t.is_active?'retired-row':''}"><div><strong>${esc(t.name)}</strong><div class="subtle">${t.is_active?'Active':'Retired'}</div></div><div class="manager-points">+${t.points}</div><button class="secondary" onclick="editTrait('${t.id}')">Edit</button><button class="secondary" onclick="setTraitActive('${t.id}',${t.is_active?'false':'true'})">${t.is_active?'Retire':'Restore'}</button></div>`).join('')}</div>`}).join('')}
  </div></div>`;
}

const cheeseOriginalModal = modal;
modal = function(){
  if(showTraitManager) return cheeseTraitManagerModal();
  if(selectedMovie) return cheeseMovieModal();
  return cheeseOriginalModal();
};

// --- Mutations --------------------------------------------------------------
addMovie = async function(){
  const title=prompt('Movie title:'); if(!title) return;
  const network=prompt('Network / studio:','Hallmark')||'';
  const summary=prompt('Short premise / synopsis:','')||'';
  const premiere=prompt('Premiere date (YYYY-MM-DD, optional):','')||'';
  const payload={workspace_id:workspace.id,title,network,cheese_score:0,tags:[],summary,status:'radar',created_by:me()};
  if(/^\d{4}-\d{2}-\d{2}$/.test(premiere)) payload.premiere_date=premiere;
  const {data,error}=await db.from('movies').insert(payload).select().single();
  if(error) return alert(error.message);
  await logActivity(`added ${title} to the Movie Radar.`,'movie',data.id);
  await loadAll();
  selectedMovie=data.id;
  traitSearch=''; traitSelectedOnly=false;
  render();
};

async function toggleMovieTrait(movieId,traitId){
  const movie=state.movies.find(m=>m.id===movieId); if(!movie) return;
  const selected=movie.selectedTraitIds?.includes(traitId);
  if(selected){
    const {error}=await db.from('movie_traits').delete().eq('movie_id',movieId).eq('trait_id',traitId);
    if(error) return alert(error.message);
  }else{
    const {error}=await db.from('movie_traits').insert({workspace_id:workspace.id,movie_id:movieId,trait_id:traitId,selected_by:me()});
    if(error) return alert(error.message);
  }
  await loadAll(); render();
}

async function setMovieStatus(id,status){
  const {error}=await db.from('movies').update({status,updated_at:new Date().toISOString()}).eq('id',id);
  if(error) return alert(error.message);
  await loadAll(); render();
}

function suggestionAliases(){
  return {
    'Dead parent':['dead mother','dead father','late mother','late father','lost her mother','lost his mother','lost her father','lost his father','orphaned'],
    'Dead spouse':['late husband','late wife','widow','widower'],
    'Bakery':['bakery','baker','pastry shop','pastries'],
    'Christmas tree farm':['christmas tree farm','tree farm'],
    'Inn or B&B':['bed and breakfast','b&b','family inn'],
    'Vineyard or winery':['vineyard','winery','winemaker'],
    'Bookstore':['bookstore','book shop'],
    'Childhood sweetheart':['childhood sweetheart','first love','grew up together'],
    'Old flame':['old flame','former sweetheart','ex-boyfriend','ex-girlfriend'],
    'Fake dating':['fake dating','pretend to date','pretend couple'],
    'Snowed in together':['snowed in','blizzard traps','stuck together in a storm'],
    'Small-town return':['returns home','return home','back to her hometown','back to his hometown','comes home'],
    'Christmas festival':['christmas festival','holiday festival'],
    'Tree-lighting ceremony':['tree lighting','tree-lighting'],
    'Secret prince or princess':['secret prince','secret princess','undercover prince','undercover princess'],
    'Commoner meets royal':['prince','princess','royal family'],
    'Save the family business':['save the family business','business is failing','family business'],
    'Property developer villain':['developer','redevelopment','bulldoze'],
    'Only one bed':['only one bed','one bed']
  };
}

async function suggestTraits(movieId){
  const m=state.movies.find(x=>x.id===movieId); if(!m) return;
  const text=`${m.title||''} ${m.summary||''} ${m.notes||''}`.toLowerCase();
  const aliases=suggestionAliases();
  const suggested=state.traits.filter(t=>t.is_active && !m.selectedTraitIds?.includes(t.id) && ((aliases[t.name]||[]).some(k=>text.includes(k)) || (t.name.length>5 && text.includes(t.name.toLowerCase()))));
  if(!suggested.length) return alert('No obvious trait matches jumped out of that synopsis yet.');
  if(!confirm(`Suggested Cheese Traits:\n\n${suggested.map(t=>`• ${t.name} (+${t.points})`).join('\n')}\n\nAdd all of these?`)) return;
  const rows=suggested.map(t=>({workspace_id:workspace.id,movie_id:movieId,trait_id:t.id,selected_by:me()}));
  const {error}=await db.from('movie_traits').insert(rows);
  if(error) return alert(error.message);
  await logActivity(`added ${suggested.length} suggested Cheese Traits to ${m.title}.`,'movie',movieId);
  await loadAll(); render();
}

async function addTrait(){
  const name=prompt('New Cheese Trait:'); if(!name) return;
  const category=prompt('Category:','Romantiverse Rules')||'Other';
  const raw=prompt('Point value (0–50):','5');
  const points=Math.max(0,Math.min(50,Number(raw)||0));
  const maxSort=Math.max(0,...state.traits.map(t=>Number(t.sort_order)||0));
  const {error}=await db.from('cheese_traits').insert({workspace_id:workspace.id,name:name.trim(),category:category.trim()||'Other',points,sort_order:maxSort+10,created_by:me()});
  if(error) return alert(error.message);
  await logActivity(`added Cheese Trait “${name.trim()}” (+${points}).`,'trait');
  await loadAll(); render();
}

async function editTrait(id){
  const t=traitById(id); if(!t) return;
  const name=prompt('Trait name:',t.name); if(name===null) return;
  const category=prompt('Category:',t.category); if(category===null) return;
  const raw=prompt('Point value:',String(t.points)); if(raw===null) return;
  const points=Math.max(0,Math.min(50,Number(raw)||0));
  const {error}=await db.from('cheese_traits').update({name:name.trim()||t.name,category:category.trim()||'Other',points}).eq('id',id);
  if(error) return alert(error.message);
  await logActivity(`updated Cheese Trait “${name.trim()||t.name}” to +${points}.`,'trait',id);
  await loadAll(); render();
}

async function setTraitActive(id,isActive){
  const t=traitById(id); if(!t) return;
  const {error}=await db.from('cheese_traits').update({is_active:isActive}).eq('id',id);
  if(error) return alert(error.message);
  await logActivity(`${isActive?'restored':'retired'} Cheese Trait “${t.name}”.`,'trait',id);
  await loadAll(); render();
}

async function saveCurrentFilterPreset(){
  const name=prompt('Name this movie filter:'); if(!name) return;
  const criteria={mode:movieFilters.mode,min_score:Number(movieFilters.minScore||0),trait_ids:[...(movieFilters.traitIds||[])],trait_categories:[...(movieFilters.traitCategories||[])],status:movieFilters.status||null};
  const {error}=await db.from('filter_presets').upsert({workspace_id:workspace.id,name:name.trim(),criteria,created_by:me()},{onConflict:'workspace_id,name'});
  if(error) return alert(error.message);
  await loadAll(); render();
}

function applyFilterPreset(id){
  const p=state.filterPresets.find(x=>x.id===id); if(!p) return;
  const c=p.criteria||{};
  const ids=new Set(c.trait_ids||[]);
  for(const name of (c.trait_names||[])){
    const t=state.traits.find(x=>x.name===name); if(t) ids.add(t.id);
  }
  movieFilters={mode:c.mode||'all',minScore:Number(c.min_score||0),traitIds:[...ids],traitCategories:[...(c.trait_categories||[])],status:c.status||null};
  showMovieFilters=true;
  render();
}

async function deleteFilterPreset(id){
  const p=state.filterPresets.find(x=>x.id===id); if(!p) return;
  if(!confirm(`Delete saved filter “${p.name}”?`)) return;
  const {error}=await db.from('filter_presets').delete().eq('id',id);
  if(error) return alert(error.message);
  await loadAll(); render();
}

// --- Window handlers --------------------------------------------------------
window.openMovie=(id)=>{selectedMovie=id;traitSearch='';traitSelectedOnly=false;showTraitManager=false;render()};
window.closeMovie=()=>{selectedMovie=null;traitSearch='';traitSelectedOnly=false;render()};
window.filterPreset=(type)=>{movieFilters.mode=type;render()};
window.toggleMovieFilters=()=>{showMovieFilters=!showMovieFilters;render()};
window.previewMinCheese=(v)=>{const el=document.getElementById('minCheeseValue');if(el)el.textContent=`🧀 ${Number(v)||0}+`};
window.setMinCheese=(v)=>{movieFilters.minScore=Number(v)||0;refreshMovieGrid()};
window.toggleMovieFilterTrait=(id)=>{const s=new Set(movieFilters.traitIds||[]);s.has(id)?s.delete(id):s.add(id);movieFilters.traitIds=[...s];render()};
window.clearMovieFilters=()=>{movieFilters={mode:'all',minScore:0,traitIds:[],traitCategories:[],status:null};render()};
window.applyFilterPreset=applyFilterPreset;
window.saveCurrentFilterPreset=saveCurrentFilterPreset;
window.deleteFilterPreset=deleteFilterPreset;
window.setTraitSearch=(v)=>{traitSearch=v;const m=state.movies.find(x=>x.id===selectedMovie);const body=document.getElementById('traitPickerBody');if(m&&body)body.innerHTML=traitPickerHtml(m)};
window.toggleSelectedTraitsOnly=()=>{traitSelectedOnly=!traitSelectedOnly;const m=state.movies.find(x=>x.id===selectedMovie);const body=document.getElementById('traitPickerBody');if(m&&body)body.innerHTML=traitPickerHtml(m);const btn=document.querySelector('.trait-tools .secondary');if(btn)btn.classList.toggle('active-filter',traitSelectedOnly)};
window.openTraitManager=()=>{showTraitManager=true;render()};
window.closeTraitManager=()=>{showTraitManager=false;render()};
window.toggleMovieTrait=toggleMovieTrait;
window.setMovieStatus=setMovieStatus;
window.suggestTraits=suggestTraits;
window.addTrait=addTrait;
window.editTrait=editTrait;
window.setTraitActive=setTraitActive;
window.addMovie=addMovie;

// Stop the global search box from destroying focus on every keystroke while in Movie Radar.
window.setSearch=(v)=>{
  searchText=v;
  if(currentTab!=='movies' && v.trim()) { currentTab='movies'; render(); return; }
  refreshMovieGrid();
};

// If app.js finished its first async boot before this enhancement loaded, refresh once.
setTimeout(async()=>{
  if(session && workspace){
    try{ await loadAll(); render(); }catch(err){ console.error('Cheese Traits refresh failed',err); }
  }
},0);
