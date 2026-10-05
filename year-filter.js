// Cheese Louise — release year filtering for Movie Radar + New Finds.
// Adds From / To year controls without changing the broad Romantiverse scanner.

(() => {
  function clReleaseYear(item) {
    const raw = item?.premiere_date || item?.release_date || item?.date || '';
    const match = String(raw).match(/\b(19|20)\d{2}\b/);
    return match ? Number(match[0]) : null;
  }

  function clKnownYears() {
    const years = new Set();
    for (const movie of (state.movies || [])) {
      const year = clReleaseYear(movie);
      if (year) years.add(year);
    }
    for (const candidate of (state.discoveryResults || [])) {
      const year = clReleaseYear(candidate);
      if (year) years.add(year);
    }
    years.add(new Date().getFullYear());
    return [...years].sort((a, b) => b - a);
  }

  function clPassesYearFilter(item) {
    const min = Number(movieFilters?.yearMin || 0);
    const max = Number(movieFilters?.yearMax || 0);
    if (!min && !max) return true;
    const year = clReleaseYear(item);
    if (!year) return false;
    if (min && year < min) return false;
    if (max && year > max) return false;
    return true;
  }

  window.clReleaseYear = clReleaseYear;

  if (typeof movieMatchesCheeseFilters === 'function') {
    const originalMovieMatches = movieMatchesCheeseFilters;
    movieMatchesCheeseFilters = function(movie) {
      return originalMovieMatches(movie) && clPassesYearFilter(movie);
    };
  }

  if (typeof discoveryMatchesCurrentView === 'function') {
    const originalDiscoveryMatches = discoveryMatchesCurrentView;
    discoveryMatchesCurrentView = function(candidate) {
      return originalDiscoveryMatches(candidate) && clPassesYearFilter(candidate);
    };
  }

  function clYearFilterHtml() {
    const years = clKnownYears();
    const min = String(movieFilters?.yearMin || '');
    const max = String(movieFilters?.yearMax || '');
    const options = years.map(year => `<option value="${year}">${year}</option>`).join('');
    const current = new Date().getFullYear();

    return `<div class="year-filter" style="margin:14px 0 18px">
      <div class="kicker" style="margin-bottom:8px">Release Year</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <label class="subtle">From
          <select class="search" style="width:100%;margin-top:5px" onchange="setYearFilter('min',this.value)">
            <option value="" ${!min?'selected':''}>Any year</option>
            ${years.map(year=>`<option value="${year}" ${min===String(year)?'selected':''}>${year}</option>`).join('')}
          </select>
        </label>
        <label class="subtle">To
          <select class="search" style="width:100%;margin-top:5px" onchange="setYearFilter('max',this.value)">
            <option value="" ${!max?'selected':''}>Any year</option>
            ${years.map(year=>`<option value="${year}" ${max===String(year)?'selected':''}>${year}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="trait-chip-grid" style="margin-top:9px">
        <button class="trait-chip" onclick="setYearRange(${current-4},${current+1})">Recent 5 years</button>
        <button class="trait-chip" onclick="setYearRange(${current},${current})">${current} only</button>
        <button class="trait-chip ${!min&&!max?'selected':''}" onclick="setYearRange(null,null)">All years</button>
      </div>
    </div>`;
  }

  if (typeof cheeseFilterPanel === 'function') {
    const originalCheeseFilterPanel = cheeseFilterPanel;
    cheeseFilterPanel = function() {
      const html = originalCheeseFilterPanel();
      return html.replace('<div class="score-filter">', `${clYearFilterHtml()}<div class="score-filter">`);
    };
  }

  if (typeof activeFilterCount === 'function') {
    const originalActiveFilterCount = activeFilterCount;
    activeFilterCount = function() {
      return originalActiveFilterCount() + ((movieFilters?.yearMin || movieFilters?.yearMax) ? 1 : 0);
    };
  }

  window.setYearFilter = (which, value) => {
    const year = value ? Number(value) : null;
    if (which === 'min') movieFilters.yearMin = year;
    if (which === 'max') movieFilters.yearMax = year;
    if (movieFilters.yearMin && movieFilters.yearMax && movieFilters.yearMin > movieFilters.yearMax) {
      if (which === 'min') movieFilters.yearMax = movieFilters.yearMin;
      else movieFilters.yearMin = movieFilters.yearMax;
    }
    render();
  };

  window.setYearRange = (min, max) => {
    movieFilters.yearMin = min ? Number(min) : null;
    movieFilters.yearMax = max ? Number(max) : null;
    render();
  };

  // Preserve year + studio selections in saved filter presets.
  window.saveCurrentFilterPreset = saveCurrentFilterPreset = async function() {
    const name = prompt('Name this movie filter:');
    if (!name) return;
    const criteria = {
      mode: movieFilters.mode,
      min_score: Number(movieFilters.minScore || 0),
      trait_ids: [...(movieFilters.traitIds || [])],
      trait_categories: [...(movieFilters.traitCategories || [])],
      status: movieFilters.status || null,
      holiday: movieFilters.holiday || null,
      season: movieFilters.season || null,
      studio: movieFilters.studio || null,
      year_min: movieFilters.yearMin || null,
      year_max: movieFilters.yearMax || null
    };
    const { error } = await db.from('filter_presets').upsert({
      workspace_id: workspace.id,
      name: name.trim(),
      criteria,
      created_by: me()
    }, { onConflict: 'workspace_id,name' });
    if (error) return alert(error.message);
    await loadAll();
    render();
  };

  window.applyFilterPreset = applyFilterPreset = function(id) {
    const preset = state.filterPresets.find(x => x.id === id);
    if (!preset) return;
    const c = preset.criteria || {};
    const ids = new Set(c.trait_ids || []);
    for (const name of (c.trait_names || [])) {
      const trait = state.traits.find(x => x.name === name);
      if (trait) ids.add(trait.id);
    }
    movieFilters = {
      mode: c.mode || 'all',
      minScore: Number(c.min_score || 0),
      traitIds: [...ids],
      traitCategories: [...(c.trait_categories || [])],
      status: c.status || null,
      holiday: c.holiday || null,
      season: c.season || null,
      studio: c.studio || null,
      yearMin: c.year_min ? Number(c.year_min) : null,
      yearMax: c.year_max ? Number(c.year_max) : null
    };
    showMovieFilters = true;
    render();
  };

  window.clearMovieFilters = () => {
    movieFilters = {
      mode: 'all',
      minScore: 0,
      traitIds: [],
      traitCategories: [],
      status: null,
      holiday: null,
      season: null,
      studio: null,
      yearMin: null,
      yearMax: null
    };
    render();
  };
})();
