// Cheese Louise v1.7 — one shared Movie Radar filter for New Finds + saved Radar.
// Loaded after v16-radar-filters.js so it inherits provider/release filter logic.

// New Finds are not database movies yet, but they should obey the same Radar
// filters wherever the metadata can be inferred from the discovery result.
const sharedRadarOriginalDiscoveryMatch = discoveryMatchesCurrentView;
discoveryMatchesCurrentView = function(c){
  if(!sharedRadarOriginalDiscoveryMatch(c)) return false;

  const estimate = discoveryEstimate(c);

  // Category filters were previously only being applied to saved Radar movies.
  if((movieFilters.traitCategories||[]).length){
    const categories = new Set((estimate.traits||[]).map(t=>t.category));
    if(!movieFilters.traitCategories.every(category=>categories.has(category))) return false;
  }

  // A discovery candidate is, by definition, waiting for review. If a saved
  // preset requests another explicit database status, it should not appear.
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

// Rebuild the Movies page with the filter controls ABOVE New Finds. Previously
// the New Finds panel appeared first, which made the filter UI look like it only
// belonged to manually-added/saved movies even though some filtering already
// happened behind the scenes.
movies = function(){
  const found = filteredMovies();
  const filterCount = activeFilterCount();
  const newFindCount = sharedRadarCandidateCount();

  return `<section class="section">
    <div class="page-title">Movie Radar</div>
    <div class="subtle">Find, save, vote, discuss — and build the Cheese Rating from actual Romantiverse traits.</div>
    <div class="movie-header-actions">
      <button class="primary" onclick="addMovie()">+ Add movie</button>
      <button class="secondary" onclick="toggleMovieFilters()">⚙ Filters${filterCount?` (${filterCount})`:''}</button>
      <button class="secondary" onclick="openTraitManager()">🧀 Trait Library</button>
    </div>
    <div class="subtle" style="margin-top:10px">Radar filters apply to <strong>both New Finds and movies already added to the Radar</strong>.</div>
  </section>

  <section class="section">
    <div class="toolbar">
      <button class="filter ${movieFilters.mode==='all'?'active-filter':''}" onclick="filterPreset('all')">All</button>
      <button class="filter ${movieFilters.mode==='mutual'?'active-filter':''}" onclick="filterPreset('mutual')">🔥 Mutual</button>
      <button class="filter ${movieFilters.mode==='saved'?'active-filter':''}" onclick="filterPreset('saved')">🔖 Saved</button>
      <button class="filter ${movieFilters.mode==='unreviewed'?'active-filter':''}" onclick="filterPreset('unreviewed')">🆕 Unreviewed</button>
      <button class="filter ${movieFilters.mode==='needs_review'?'active-filter':''}" onclick="filterPreset('needs_review')">👀 Needs Review</button>
    </div>
    ${cheesePresetButtons()}
    ${showMovieFilters?cheeseFilterPanel():''}

    <div class="subtle" style="margin:16px 0 8px"><strong>${newFindCount}</strong> New Find${newFindCount===1?'':'s'} match the current Radar filters</div>
    <div class="discovery-section">${discoveryPanel()}</div>

    <div style="display:flex;justify-content:space-between;gap:12px;align-items:end;margin-top:24px;flex-wrap:wrap">
      <div><div class="kicker">Saved Radar</div><div class="subtle">Movies you and Jenny have already brought into the shared workspace.</div></div>
    </div>
    <div id="resultsLine" class="results-line"><strong>${found.length}</strong> saved movie${found.length===1?'':'s'} match${found.length===1?'es':''}</div>
    <div id="movieGrid" class="movie-grid">${found.map(movieCard).join('')||'<div class="empty">No saved Radar movies match these filters yet.</div>'}</div>
  </section>`;
};

// Make the build change visible without touching the larger audit file.
const sharedRadarOriginalTopbar = topbar;
topbar = function(){
  return sharedRadarOriginalTopbar().replace('>v1.6<','>v1.7<');
};

window.sharedRadarCandidateCount = sharedRadarCandidateCount;
