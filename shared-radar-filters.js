// Cheese Louise v1.8 — shared Movie Radar filters + fast interaction path.
// Loaded after v16-radar-filters.js so it inherits provider/release filter logic.

// ---------------------------------------------------------------------------
// Cache discovery Cheese estimates. The old filter path recalculated trait
// suggestions repeatedly for every candidate on every click, then rebuilt the
// entire app. On slower phones that could make a filter tap feel frozen.
// ---------------------------------------------------------------------------
const sharedRadarUncachedDiscoveryEstimate = discoveryEstimate;
let sharedRadarEstimateCache = new Map();
let sharedRadarTraitFingerprint = '';

function sharedRadarCurrentTraitFingerprint(){
  return (state.traits||[])
    .map(t=>`${t.id}:${t.name}:${t.category}:${t.points}:${t.is_active?1:0}`)
    .join('|');
}

discoveryEstimate = function(c){
  const fingerprint = sharedRadarCurrentTraitFingerprint();
  if(fingerprint !== sharedRadarTraitFingerprint){
    sharedRadarTraitFingerprint = fingerprint;
    sharedRadarEstimateCache.clear();
  }
  const key = `${c.tmdb_type||'movie'}:${Number(c.tmdb_id)||0}:${c.title||''}:${c.summary||''}`;
  if(sharedRadarEstimateCache.has(key)) return sharedRadarEstimateCache.get(key);
  const estimate = sharedRadarUncachedDiscoveryEstimate(c);
  sharedRadarEstimateCache.set(key, estimate);
  return estimate;
};

// New Finds are not database movies yet, but they should obey the same Radar
// filters wherever the metadata can be inferred from the discovery result.
const sharedRadarOriginalDiscoveryMatch = discoveryMatchesCurrentView;
discoveryMatchesCurrentView = function(c){
  if(!sharedRadarOriginalDiscoveryMatch(c)) return false;

  const estimate = discoveryEstimate(c);

  if((movieFilters.traitCategories||[]).length){
    const categories = new Set((estimate.traits||[]).map(t=>t.category));
    if(!movieFilters.traitCategories.every(category=>categories.has(category))) return false;
  }

  if(movieFilters.status && movieFilters.status !== 'needs_review') return false;
  return true;
};

function sharedRadarCandidateCount(){
  if(!Array.isArray(state.discoveryResults)) return 0;
  const existing = discoveryExistingIds();
  return state.discoveryResults.filter(c =>
    !existing.has(`${c.tmdb_type||'movie'}:${Number(c.tmdb_id)}`) &&
    !discoveryHidden.has(Number(c.tmdb_id)) &&
    discoveryMatchesCurrentView(c)
  ).length;
}

function sharedRadarToolbarHtml(){
  return `<div class="toolbar" id="radarModeToolbar">
    <button class="filter ${movieFilters.mode==='all'?'active-filter':''}" onclick="filterPreset('all')">All</button>
    <button class="filter ${movieFilters.mode==='mutual'?'active-filter':''}" onclick="filterPreset('mutual')">🔥 Mutual</button>
    <button class="filter ${movieFilters.mode==='saved'?'active-filter':''}" onclick="filterPreset('saved')">🔖 Saved</button>
    <button class="filter ${movieFilters.mode==='unreviewed'?'active-filter':''}" onclick="filterPreset('unreviewed')">🆕 Unreviewed</button>
    <button class="filter ${movieFilters.mode==='needs_review'?'active-filter':''}" onclick="filterPreset('needs_review')">👀 Needs Review</button>
  </div>`;
}

// Build the Movies page with stable DOM targets. Filter taps update only the
// results that changed instead of destroying/recreating the whole application.
movies = function(){
  const found = filteredMovies();
  const filterCount = activeFilterCount();
  const newFindCount = sharedRadarCandidateCount();

  return `<section class="section">
    <div class="page-title">Movie Radar</div>
    <div class="subtle">Find, save, vote, discuss — and build the Cheese Rating from actual Romantiverse traits.</div>
    <div class="movie-header-actions">
      <button class="primary" onclick="addMovie()">+ Add movie</button>
      <button id="radarFiltersButton" class="secondary" onclick="toggleMovieFilters()">⚙ Filters${filterCount?` (${filterCount})`:''}</button>
      <button class="secondary" onclick="openTraitManager()">🧀 Trait Library</button>
    </div>
    <div class="subtle" style="margin-top:10px">Radar filters apply to <strong>both New Finds and movies already added to the Radar</strong>.</div>
  </section>

  <section class="section">
    ${sharedRadarToolbarHtml()}
    ${cheesePresetButtons()}
    <div id="movieFilterHost">${showMovieFilters?cheeseFilterPanel():''}</div>

    <div id="newFindMatchLine" class="subtle" style="margin:16px 0 8px"><strong>${newFindCount}</strong> New Find${newFindCount===1?'':'s'} match the current Radar filters</div>
    <div id="radarDiscoveryResults" class="discovery-section">${discoveryPanel()}</div>

    <div style="display:flex;justify-content:space-between;gap:12px;align-items:end;margin-top:24px;flex-wrap:wrap">
      <div><div class="kicker">Saved Radar</div><div class="subtle">Movies you and Jenny have already brought into the shared workspace.</div></div>
    </div>
    <div id="resultsLine" class="results-line"><strong>${found.length}</strong> saved movie${found.length===1?'':'s'} match${found.length===1?'es':''}</div>
    <div id="movieGrid" class="movie-grid">${found.map(movieCard).join('')||'<div class="empty">No saved Radar movies match these filters yet.</div>'}</div>
  </section>`;
};

function sharedRadarUpdateFilterButton(){
  const button=document.getElementById('radarFiltersButton');
  if(!button) return;
  const count=activeFilterCount();
  button.textContent=`⚙ Filters${count?` (${count})`:''}`;
}

function sharedRadarRefreshFilterPanel(){
  const host=document.getElementById('movieFilterHost');
  if(host && showMovieFilters) host.innerHTML=cheeseFilterPanel();
}

function sharedRadarRefreshToolbar(){
  const toolbar=document.getElementById('radarModeToolbar');
  if(!toolbar) return;
  const wrapper=document.createElement('div');
  wrapper.innerHTML=sharedRadarToolbarHtml();
  toolbar.replaceWith(wrapper.firstElementChild);
}

let sharedRadarRefreshTimer=null;
function sharedRadarRefreshResults(){
  if(currentTab!=='movies') return;
  const found=filteredMovies();
  const newFindCount=sharedRadarCandidateCount();

  const line=document.getElementById('newFindMatchLine');
  if(line) line.innerHTML=`<strong>${newFindCount}</strong> New Find${newFindCount===1?'':'s'} match the current Radar filters`;

  const discovery=document.getElementById('radarDiscoveryResults');
  if(discovery) discovery.innerHTML=discoveryPanel();

  const resultsLine=document.getElementById('resultsLine');
  if(resultsLine) resultsLine.innerHTML=`<strong>${found.length}</strong> saved movie${found.length===1?'':'s'} match${found.length===1?'es':''}`;

  const grid=document.getElementById('movieGrid');
  if(grid) grid.innerHTML=found.map(movieCard).join('')||'<div class="empty">No saved Radar movies match these filters yet.</div>';

  sharedRadarUpdateFilterButton();
}

function sharedRadarQueueResultsRefresh(){
  clearTimeout(sharedRadarRefreshTimer);
  // Let the selected state paint first so the tap feels immediate.
  sharedRadarRefreshTimer=setTimeout(sharedRadarRefreshResults,0);
}

function sharedRadarSetTraitButtonState(id,selected){
  for(const button of document.querySelectorAll('#movieFilterHost .trait-chip')){
    if(button.getAttribute('onclick')===`toggleMovieFilterTrait('${id}')`){
      button.classList.toggle('selected',selected);
    }
  }
}

// ---------------------------------------------------------------------------
// Fast filter handlers. These deliberately avoid render(), which rebuilt the
// entire page, New Finds cards, poster images, and the full trait panel.
// ---------------------------------------------------------------------------
window.toggleMovieFilters=()=>{
  showMovieFilters=!showMovieFilters;
  const host=document.getElementById('movieFilterHost');
  if(host) host.innerHTML=showMovieFilters?cheeseFilterPanel():'';
};

window.toggleMovieFilterTrait=(id)=>{
  const selected=new Set(movieFilters.traitIds||[]);
  if(selected.has(id)) selected.delete(id); else selected.add(id);
  movieFilters.traitIds=[...selected];
  sharedRadarSetTraitButtonState(id,selected.has(id));
  sharedRadarUpdateFilterButton();
  sharedRadarQueueResultsRefresh();
};

window.setHolidayFilter=(value)=>{
  movieFilters.holiday=value||null;
  sharedRadarRefreshFilterPanel();
  sharedRadarUpdateFilterButton();
  sharedRadarQueueResultsRefresh();
};

window.setSeasonFilter=(value)=>{
  movieFilters.season=value||null;
  sharedRadarRefreshFilterPanel();
  sharedRadarUpdateFilterButton();
  sharedRadarQueueResultsRefresh();
};

window.setNetworkFilter=(value)=>{
  movieFilters.network=value||null;
  sharedRadarRefreshFilterPanel();
  sharedRadarUpdateFilterButton();
  sharedRadarQueueResultsRefresh();
};

window.setReleaseWindow=(value)=>{
  movieFilters.releaseWindow=value||'all';
  sharedRadarRefreshFilterPanel();
  sharedRadarUpdateFilterButton();
  sharedRadarQueueResultsRefresh();
};

window.setMinCheese=(value)=>{
  movieFilters.minScore=Number(value)||0;
  sharedRadarUpdateFilterButton();
  sharedRadarQueueResultsRefresh();
};

window.filterPreset=(type)=>{
  movieFilters.mode=type;
  sharedRadarRefreshToolbar();
  sharedRadarUpdateFilterButton();
  sharedRadarQueueResultsRefresh();
};

window.clearMovieFilters=()=>{
  movieFilters={mode:'all',minScore:0,traitIds:[],traitCategories:[],status:null,holiday:null,season:null,network:null,releaseWindow:'all'};
  sharedRadarRefreshToolbar();
  sharedRadarRefreshFilterPanel();
  sharedRadarUpdateFilterButton();
  sharedRadarQueueResultsRefresh();
};

window.applyFilterPreset=(id)=>{
  const p=state.filterPresets.find(x=>x.id===id); if(!p) return;
  const c=p.criteria||{};
  const ids=new Set(c.trait_ids||[]);
  for(const name of (c.trait_names||[])){
    const t=state.traits.find(x=>x.name===name); if(t) ids.add(t.id);
  }
  movieFilters={
    mode:c.mode||'all',
    minScore:Number(c.min_score||0),
    traitIds:[...ids],
    traitCategories:[...(c.trait_categories||[])],
    status:c.status||null,
    holiday:c.holiday||null,
    season:c.season||null,
    network:c.network||null,
    releaseWindow:c.release_window||'all'
  };
  showMovieFilters=true;
  const host=document.getElementById('movieFilterHost');
  if(host) host.innerHTML=cheeseFilterPanel();
  sharedRadarRefreshToolbar();
  sharedRadarUpdateFilterButton();
  sharedRadarQueueResultsRefresh();
};

// Search now refreshes both halves of Movie Radar, not just saved movies.
window.setSearch=(value)=>{
  searchText=value;
  if(currentTab!=='movies' && value.trim()){
    currentTab='movies';
    render();
    return;
  }
  sharedRadarQueueResultsRefresh();
};

// Make the build change visible without touching the larger audit file.
const sharedRadarOriginalTopbar = topbar;
topbar = function(){
  return sharedRadarOriginalTopbar().replace('>v1.6<','>v1.8<').replace('>v1.7<','>v1.8<');
};

window.sharedRadarCandidateCount = sharedRadarCandidateCount;
window.sharedRadarRefreshResults = sharedRadarRefreshResults;
