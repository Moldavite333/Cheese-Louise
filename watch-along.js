// Cheese Louise HQ — Watch Along Desk v1
// A low-friction, local-first working surface for movie nights.

(() => {
  const STORAGE_PREFIX = 'cheeseLouise:watchAlong';
  let watchTraitQuery = '';
  let savePulseTimer = null;

  function workspaceKey(suffix='') {
    const wid = workspace?.id || 'local';
    return `${STORAGE_PREFIX}:${wid}${suffix ? `:${suffix}` : ''}`;
  }

  function selectedWatchMovieId() {
    const saved = localStorage.getItem(workspaceKey('movie'));
    if (saved && (state.movies || []).some(m => m.id === saved)) return saved;
    if (selectedMovie && (state.movies || []).some(m => m.id === selectedMovie)) return selectedMovie;
    return (state.movies || [])[0]?.id || null;
  }

  function setWatchMovieId(id) {
    if (!id) return;
    localStorage.setItem(workspaceKey('movie'), id);
  }

  function watchMovie() {
    const id = selectedWatchMovieId();
    return (state.movies || []).find(m => m.id === id) || null;
  }

  function draftKey(movieId) {
    return workspaceKey(`draft:${movieId}`);
  }

  function defaultDraft(movie) {
    return {
      movieId: movie.id,
      traitIds: [...new Set(movie.selectedTraitIds || [])],
      notes: '',
      rules: '',
      outline: '',
      updatedAt: new Date().toISOString()
    };
  }

  function getDraft(movie = watchMovie()) {
    if (!movie) return null;
    try {
      const raw = localStorage.getItem(draftKey(movie.id));
      if (!raw) return defaultDraft(movie);
      const parsed = JSON.parse(raw);
      return {
        ...defaultDraft(movie),
        ...parsed,
        movieId: movie.id,
        traitIds: [...new Set(Array.isArray(parsed.traitIds) ? parsed.traitIds : (movie.selectedTraitIds || []))]
      };
    } catch {
      return defaultDraft(movie);
    }
  }

  function putDraft(draft) {
    if (!draft?.movieId) return;
    draft.updatedAt = new Date().toISOString();
    localStorage.setItem(draftKey(draft.movieId), JSON.stringify(draft));
    pulseSaved();
  }

  function pulseSaved() {
    const el = document.querySelector('[data-watch-save-state]');
    if (!el) return;
    el.textContent = 'Saved';
    el.classList.add('is-saved');
    clearTimeout(savePulseTimer);
    savePulseTimer = setTimeout(() => {
      el.classList.remove('is-saved');
      el.textContent = 'Autosaves on this device';
    }, 1200);
  }

  function sortedMovies() {
    return [...(state.movies || [])].sort((a,b) => String(a.title || '').localeCompare(String(b.title || '')));
  }

  function traitGroups(movie, draft) {
    const q = watchTraitQuery.trim().toLowerCase();
    const selected = new Set(draft?.traitIds || []);
    const traits = (state.traits || [])
      .filter(t => t.is_active || selected.has(t.id))
      .filter(t => !q || `${t.name} ${t.category}`.toLowerCase().includes(q));

    return traits.reduce((acc, trait) => {
      const key = trait.category || 'Other';
      (acc[key] ||= []).push(trait);
      return acc;
    }, {});
  }

  function traitGridHtml(movie, draft) {
    const selected = new Set(draft?.traitIds || []);
    const confirmed = new Set(movie?.selectedTraitIds || []);
    const groups = traitGroups(movie, draft);
    const entries = Object.entries(groups);
    if (!entries.length) return '<div class="empty watch-empty">No Cheese Traits match that search.</div>';

    return entries.map(([category, traits]) => `
      <section class="watch-trait-group">
        <div class="watch-trait-group-head">
          <strong>${esc(category)}</strong>
          <span>${traits.filter(t => selected.has(t.id)).length}/${traits.length}</span>
        </div>
        <div class="watch-trait-grid">
          ${traits.map(t => {
            const on = selected.has(t.id);
            const wasConfirmed = confirmed.has(t.id);
            return `<button type="button"
              class="watch-trait ${on ? 'is-selected' : ''} ${wasConfirmed ? 'was-confirmed' : ''}"
              data-watch-trait="${esc(t.id)}"
              onclick="watchAlongToggleTrait('${esc(t.id)}', this)">
              <span class="watch-trait-check">${on ? '✓' : '○'}</span>
              <span class="watch-trait-name">${esc(t.name)}</span>
              <span class="watch-trait-points">+${Number(t.points || 0)}</span>
            </button>`;
          }).join('')}
        </div>
      </section>
    `).join('');
  }

  function watchAlongPage() {
    const movie = watchMovie();
    if (!movie) {
      return `<section class="section"><div class="page-title">Watch Along</div><div class="empty">Add a movie first, then come back here.</div></section>`;
    }
    setWatchMovieId(movie.id);
    const draft = getDraft(movie);
    const selectedCount = draft.traitIds.length;
    const movieOptions = sortedMovies().map(m => `<option value="${esc(m.id)}" ${m.id === movie.id ? 'selected' : ''}>${esc(m.title)}</option>`).join('');

    return `
      <section class="section watch-desk-header">
        <div class="watch-title-row">
          <div>
            <div class="kicker">Movie-night workspace</div>
            <div class="page-title">Watch Along</div>
            <div class="subtle">Everything stays on one screen. No timer. No forced order. Capture it and keep watching.</div>
          </div>
          <div class="watch-save-state" data-watch-save-state>Autosaves on this device</div>
        </div>

        <div class="watch-movie-bar">
          <label>
            <span class="kicker">Watching</span>
            <select class="search watch-movie-select" onchange="watchAlongChangeMovie(this.value)">${movieOptions}</select>
          </label>
          <div class="watch-movie-meta">
            <strong>${esc(movie.title)}</strong>
            <span>${esc([movie.network, movie.season, movie.holiday].filter(Boolean).join(' · ') || 'Saved movie')}</span>
          </div>
          <button class="secondary watch-clear-button" type="button" onclick="watchAlongClearDraft()">Clear this draft</button>
        </div>

        <div class="watch-quick-capture">
          <input id="watchQuickNote" class="search" placeholder="Quick thought — type it, hit Enter, keep watching…" onkeydown="watchAlongQuickKey(event)">
          <button class="primary" type="button" onclick="watchAlongQuickAdd()">+ Add note</button>
        </div>
      </section>

      <section class="section watch-desk-grid">
        <div class="card card-pad watch-traits-panel">
          <div class="watch-panel-head">
            <div>
              <div class="kicker">Cheese Traits</div>
              <h2>Tap what happens</h2>
            </div>
            <span class="pill" data-watch-trait-count>${selectedCount} checked</span>
          </div>
          <div class="watch-trait-tools">
            <input class="search" placeholder="Search traits…" value="${esc(watchTraitQuery)}" oninput="watchAlongSearchTraits(this.value)">
            <button class="secondary" type="button" onclick="watchAlongShowSelected()">Show checked</button>
            <button class="secondary" type="button" onclick="watchAlongShowAll()">Show all</button>
          </div>
          <div id="watchTraitBody" class="watch-trait-body">${traitGridHtml(movie, draft)}</div>
        </div>

        <div class="watch-writing-stack">
          <div class="card card-pad watch-writing-card">
            <div class="watch-panel-head"><div><div class="kicker">Watch Notes</div><h2>Stuff we noticed</h2></div></div>
            <textarea class="watch-textarea watch-notes" placeholder="The marina has no boat stuff. Just croissants and a cappuccino machine…" oninput="watchAlongSaveText('notes', this.value)">${esc(draft.notes)}</textarea>
          </div>

          <div class="card card-pad watch-writing-card">
            <div class="watch-panel-head"><div><div class="kicker">Rules Scratch Pad</div><h2>Possible Romantiverse rules</h2></div></div>
            <textarea class="watch-textarea" placeholder="A town festival can resolve any family feud…" oninput="watchAlongSaveText('rules', this.value)">${esc(draft.rules)}</textarea>
          </div>

          <div class="card card-pad watch-writing-card watch-outline-card">
            <div class="watch-panel-head"><div><div class="kicker">Episode Outline</div><h2>Talk about this</h2></div></div>
            <textarea class="watch-textarea watch-outline" placeholder="• Marina rant\n• Dad feud\n• Jenny's background-guy catch\n• Ending makes no sense" oninput="watchAlongSaveText('outline', this.value)">${esc(draft.outline)}</textarea>
          </div>
        </div>
      </section>
    `;
  }

  function patchTabs() {
    if (typeof tabs !== 'function') return;
    const originalTabs = tabs;
    tabs = function(...args) {
      const html = originalTabs.apply(this, args);
      if (html.includes("go('watchalong')")) return html;
      const active = currentTab === 'watchalong' ? 'active' : '';
      const button = `<button class="${active}" onclick="go('watchalong')"><span class="tab-icon">👀</span>Watch Along</button>`;
      return html.replace('</nav>', `${button}</nav>`);
    };
    window.tabs = tabs;
  }

  function patchRender() {
    if (typeof render !== 'function') return;
    const originalRender = render;
    render = function(...args) {
      if (currentTab !== 'watchalong') return originalRender.apply(this, args);
      if (!session) return authScreen();
      if (!workspace) return onboardingScreen();
      shell(`<div class="app-shell">${topbar()}${watchAlongPage()}</div>${tabs()}${modal()}`);
    };
    window.render = render;
  }

  window.watchAlongChangeMovie = function(id) {
    setWatchMovieId(id);
    watchTraitQuery = '';
    render();
    window.scrollTo({top:0, behavior:'instant'});
  };

  window.watchAlongToggleTrait = function(id, button) {
    const movie = watchMovie();
    const draft = getDraft(movie);
    if (!movie || !draft) return;
    const set = new Set(draft.traitIds || []);
    if (set.has(id)) set.delete(id); else set.add(id);
    draft.traitIds = [...set];
    putDraft(draft);

    if (button) {
      const on = set.has(id);
      button.classList.toggle('is-selected', on);
      const check = button.querySelector('.watch-trait-check');
      if (check) check.textContent = on ? '✓' : '○';
    }
    const count = document.querySelector('[data-watch-trait-count]');
    if (count) count.textContent = `${draft.traitIds.length} checked`;
  };

  window.watchAlongSaveText = function(field, value) {
    const movie = watchMovie();
    const draft = getDraft(movie);
    if (!draft || !['notes','rules','outline'].includes(field)) return;
    draft[field] = value;
    putDraft(draft);
  };

  window.watchAlongQuickAdd = function() {
    const input = document.getElementById('watchQuickNote');
    const text = input?.value.trim();
    if (!text) return;
    const movie = watchMovie();
    const draft = getDraft(movie);
    if (!draft) return;
    draft.notes = `${draft.notes ? `${draft.notes.trimEnd()}\n` : ''}• ${text}`;
    putDraft(draft);
    const notes = document.querySelector('.watch-notes');
    if (notes) notes.value = draft.notes;
    input.value = '';
    input.focus();
  };

  window.watchAlongQuickKey = function(event) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    watchAlongQuickAdd();
  };

  window.watchAlongSearchTraits = function(value) {
    watchTraitQuery = value || '';
    const movie = watchMovie();
    const draft = getDraft(movie);
    const body = document.getElementById('watchTraitBody');
    if (body && movie && draft) body.innerHTML = traitGridHtml(movie, draft);
  };

  window.watchAlongShowSelected = function() {
    watchTraitQuery = '__selected__';
    const movie = watchMovie();
    const draft = getDraft(movie);
    const selected = new Set(draft?.traitIds || []);
    const body = document.getElementById('watchTraitBody');
    if (!body || !movie || !draft) return;
    const originalQuery = watchTraitQuery;
    watchTraitQuery = '';
    const active = (state.traits || []).filter(t => selected.has(t.id));
    const groups = active.reduce((acc,t)=>((acc[t.category||'Other'] ||= []).push(t),acc),{});
    const confirmed = new Set(movie.selectedTraitIds || []);
    const html = Object.entries(groups).map(([category, traits]) => `
      <section class="watch-trait-group"><div class="watch-trait-group-head"><strong>${esc(category)}</strong><span>${traits.length}</span></div><div class="watch-trait-grid">
        ${traits.map(t => `<button type="button" class="watch-trait is-selected ${confirmed.has(t.id)?'was-confirmed':''}" onclick="watchAlongToggleTrait('${esc(t.id)}',this)"><span class="watch-trait-check">✓</span><span class="watch-trait-name">${esc(t.name)}</span><span class="watch-trait-points">+${Number(t.points||0)}</span></button>`).join('')}
      </div></section>`).join('') || '<div class="empty watch-empty">Nothing checked yet.</div>';
    body.innerHTML = html;
    watchTraitQuery = originalQuery;
  };

  window.watchAlongShowAll = function() {
    watchTraitQuery = '';
    const search = document.querySelector('.watch-trait-tools input.search');
    if (search) search.value = '';
    const movie = watchMovie();
    const draft = getDraft(movie);
    const body = document.getElementById('watchTraitBody');
    if (body && movie && draft) body.innerHTML = traitGridHtml(movie, draft);
  };

  window.watchAlongClearDraft = function() {
    const movie = watchMovie();
    if (!movie) return;
    if (!confirm(`Clear the Watch Along draft for “${movie.title}”? This only clears the temporary Watch Along notes and checks on this device.`)) return;
    localStorage.removeItem(draftKey(movie.id));
    watchTraitQuery = '';
    render();
  };

  patchTabs();
  patchRender();
})();
