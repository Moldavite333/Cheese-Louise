// Cheese Louise — production studio search + filter
// Makes production companies first-class searchable movie metadata.

(() => {
  function movieStudios(item) {
    const direct = Array.isArray(item?.production_companies) ? item.production_companies : [];
    const nested = Array.isArray(item?.source_metadata?.production_companies)
      ? item.source_metadata.production_companies
      : [];
    return [...new Set([...direct, ...nested].filter(Boolean).map(String))];
  }

  function allKnownStudios() {
    const names = new Set();
    for (const movie of (state.movies || [])) movieStudios(movie).forEach(name => names.add(name));
    for (const candidate of (state.discoveryResults || [])) movieStudios(candidate).forEach(name => names.add(name));
    return [...names].sort((a, b) => a.localeCompare(b));
  }

  function movieSearchHaystack(movie) {
    return [
      movie?.title,
      movie?.network,
      movie?.summary,
      movie?.notes,
      movie?.holiday,
      movie?.season,
      ...(movie?.tags || []),
      ...(movie?.comments || []).map(c => c.body),
      ...(movie?.selectedTraits || []).map(t => `${t.name} ${t.category}`),
      ...movieStudios(movie)
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function discoverySearchHaystack(candidate) {
    return [
      candidate?.title,
      candidate?.summary,
      candidate?.network,
      candidate?.holiday,
      candidate?.season,
      ...(candidate?.providers || []),
      ...(candidate?.why || []),
      ...(candidate?.keywords || []),
      ...movieStudios(candidate)
    ].filter(Boolean).join(' ').toLowerCase();
  }

  window.clMovieStudios = movieStudios;

  // Saved Movie Radar search: preserve every existing Cheese Louise filter,
  // but handle free-text search here so studio names are searchable too.
  if (typeof movieMatchesCheeseFilters === 'function') {
    const originalMovieMatches = movieMatchesCheeseFilters;
    movieMatchesCheeseFilters = function(movie) {
      const q = String(searchText || '').trim().toLowerCase();
      let passesBase = false;

      if (q) {
        const previousSearch = searchText;
        try {
          searchText = '';
          passesBase = originalMovieMatches(movie);
        } finally {
          searchText = previousSearch;
        }
      } else {
        passesBase = originalMovieMatches(movie);
      }

      if (!passesBase) return false;
      if (q && !movieSearchHaystack(movie).includes(q)) return false;

      const studio = String(movieFilters?.studio || '').trim();
      if (studio) {
        const wanted = studio.toLowerCase();
        if (!movieStudios(movie).some(name => name.toLowerCase() === wanted)) return false;
      }
      return true;
    };
  }

  // New Finds search uses the same studio behavior when the scanner returns
  // production-company metadata.
  if (typeof discoveryMatchesCurrentView === 'function') {
    const originalDiscoveryMatches = discoveryMatchesCurrentView;
    discoveryMatchesCurrentView = function(candidate) {
      const q = String(searchText || '').trim().toLowerCase();
      let passesBase = false;

      if (q) {
        const previousSearch = searchText;
        try {
          searchText = '';
          passesBase = originalDiscoveryMatches(candidate);
        } finally {
          searchText = previousSearch;
        }
      } else {
        passesBase = originalDiscoveryMatches(candidate);
      }

      if (!passesBase) return false;
      if (q && !discoverySearchHaystack(candidate).includes(q)) return false;

      const studio = String(movieFilters?.studio || '').trim();
      if (studio) {
        const wanted = studio.toLowerCase();
        if (!movieStudios(candidate).some(name => name.toLowerCase() === wanted)) return false;
      }
      return true;
    };
  }

  // Add a dedicated studio dropdown to the existing Movie Radar filter panel.
  if (typeof cheeseFilterPanel === 'function') {
    const originalCheeseFilterPanel = cheeseFilterPanel;
    cheeseFilterPanel = function() {
      const html = originalCheeseFilterPanel();
      const studios = allKnownStudios();
      if (!studios.length) return html;

      const selected = String(movieFilters?.studio || '');
      const options = [
        '<option value="">All production studios</option>',
        ...studios.map(name => `<option value="${esc(name)}" ${selected === name ? 'selected' : ''}>${esc(name)}</option>`)
      ].join('');

      const studioBlock = `<div class="studio-filter" style="display:grid;gap:7px;margin:14px 0 18px">
        <label for="studioFilter"><strong>Production Studio</strong></label>
        <select id="studioFilter" class="search" onchange="setStudioFilter(this.value)">${options}</select>
        <div class="subtle">Find movies from Hallmark Media, The Cartel, MarVista, Reel One, Front Street, and other Romantiverse producers.</div>
      </div>`;

      return html.replace('<div class="score-filter">', `${studioBlock}<div class="score-filter">`);
    };
  }

  if (typeof activeFilterCount === 'function') {
    const originalActiveFilterCount = activeFilterCount;
    activeFilterCount = function() {
      return originalActiveFilterCount() + (movieFilters?.studio ? 1 : 0);
    };
  }

  window.setStudioFilter = value => {
    movieFilters.studio = value || null;
    render();
  };

  // Make the global search box advertise that studios are searchable.
  if (typeof topbar === 'function') {
    const originalTopbar = topbar;
    topbar = function() {
      return originalTopbar().replace(
        'Search movies, notes, ideas…',
        'Search movies, studios, notes, ideas…'
      );
    };
  }
})();
