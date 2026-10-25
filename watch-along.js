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
      outlineItems: [],
      updatedAt: new Date().toISOString()
    };
  }

  function getDraft(movie = watchMovie()) {
    if (!movie) return null;
    try {
      const raw = localStorage.getItem(draftKey(movie.id));
      if (!raw) return defaultDraft(movie);
      const parsed = JSON.parse(raw);
      const traitIds = [...new Set(Array.isArray(parsed.traitIds) ? parsed.traitIds : (movie.selectedTraitIds || []))];
      let outlineItems = Array.isArray(parsed.outlineItems) ? parsed.outlineItems.filter(Boolean) : [];
      if (!outlineItems.length && String(parsed.outline || '').trim()) {
        outlineItems = [{id:'legacy-outline',type:'note',text:String(parsed.outline).trim()}];
      }
      return {
        ...defaultDraft(movie),
        ...parsed,
        movieId: movie.id,
        traitIds,
        outlineItems
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

  function watchOutlineItemId(prefix='item') {
    if (globalThis.crypto?.randomUUID) return prefix + ':' + crypto.randomUUID();
    return prefix + ':' + Date.now() + ':' + Math.random().toString(36).slice(2,9);
  }

  function watchOutlineItems(draft) {
    return Array.isArray(draft?.outlineItems) ? draft.outlineItems.filter(Boolean) : [];
  }

  function watchOutlineTrait(item) {
    if (!item || item.type !== 'trait') return null;
    return (state.traits || []).find(t => t.id === item.traitId) || null;
  }

  function watchOutlineHtml(movie, draft) {
    const items = watchOutlineItems(draft);
    if (!items.length) {
      return '<div class="empty watch-empty">Nothing in the rundown yet. Add checked Cheese Traits or drop in a note.</div>';
    }

    return items.map((item,index) => {
      const trait = watchOutlineTrait(item);
      const isTrait = item.type === 'trait' && trait;
      const label = isTrait ? trait.name : (item.text || 'Untitled note');
      const meta = isTrait ? `Cheese Trait · +${Number(trait.points || 0)} · ${trait.category || 'Other'}` : 'Note';
      const edit = isTrait ? '' : '<button type="button" class="secondary watch-outline-mini" onclick="watchAlongEditOutlineNote(\''+esc(item.id)+'\')">Edit</button>';
      return '<div class="watch-outline-item" draggable="true" data-outline-id="'+esc(item.id)+'"'
        +' ondragstart="watchAlongOutlineDragStart(event,\''+esc(item.id)+'\')"'
        +' ondragend="watchAlongOutlineDragEnd(event)"'
        +' ondragover="watchAlongOutlineDragOver(event)"'
        +' ondrop="watchAlongOutlineDrop(event,\''+esc(item.id)+'\')">'
        +'<div class="watch-outline-grip" title="Drag to reorder" aria-hidden="true">☰</div>'
        +'<div class="watch-outline-number">'+(index+1)+'</div>'
        +'<div class="watch-outline-copy"><strong>'+esc(label)+'</strong><span>'+esc(meta)+'</span></div>'
        +'<div class="watch-outline-actions">'
          +'<button type="button" class="secondary watch-outline-mini" '+(index===0?'disabled':'')+' onclick="watchAlongMoveOutlineItem(\''+esc(item.id)+'\',-1)">↑</button>'
          +'<button type="button" class="secondary watch-outline-mini" '+(index===items.length-1?'disabled':'')+' onclick="watchAlongMoveOutlineItem(\''+esc(item.id)+'\',1)">↓</button>'
          +edit
          +'<button type="button" class="secondary watch-outline-mini" onclick="watchAlongRemoveOutlineItem(\''+esc(item.id)+'\')">×</button>'
        +'</div>'
      +'</div>';
    }).join('');
  }

  function refreshWatchOutline(movie = watchMovie(), draft = getDraft(movie)) {
    const host = document.getElementById('watchOutlineList');
    if (host && movie && draft) host.innerHTML = watchOutlineHtml(movie, draft);
    const count = document.querySelector('[data-watch-outline-count]');
    const total = watchOutlineItems(draft).length;
    if (count) count.textContent = `${total} item${total===1?'':'s'}`;
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
            <div class="watch-panel-head">
              <div><div class="kicker">Episode Rundown</div><h2>Talk about this — in this order</h2></div>
              <span class="pill" data-watch-outline-count>${watchOutlineItems(draft).length} item${watchOutlineItems(draft).length===1?'':'s'}</span>
            </div>
            <div class="subtle">Mix Cheese Traits and your own notes, then drag them into the order you want to hit them on mic.</div>
            <div class="watch-outline-tools">
              <div class="watch-outline-imports">
                <button class="secondary" type="button" onclick="watchAlongAddCheckedTraitsToOutline()">+ Checked traits</button>
                <button class="secondary" type="button" onclick="watchAlongAddWatchNotesToOutline()">+ Watch notes</button>
              </div>
              <div class="watch-outline-note-add">
                <input id="watchOutlineNoteInput" class="search" placeholder="Add a talking point…" onkeydown="watchAlongOutlineNoteKey(event)">
                <button class="primary" type="button" onclick="watchAlongAddOutlineNote()">+ Note</button>
              </div>
            </div>
            <div id="watchOutlineList" class="watch-outline-list">${watchOutlineHtml(movie, draft)}</div>
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
    const wasSelected = set.has(id);
    if (wasSelected) set.delete(id); else set.add(id);
    draft.traitIds = [...set];
    if (wasSelected) {
      draft.outlineItems = watchOutlineItems(draft).filter(item => !(item.type === 'trait' && item.traitId === id));
    }
    putDraft(draft);

    if (button) {
      const on = set.has(id);
      button.classList.toggle('is-selected', on);
      const check = button.querySelector('.watch-trait-check');
      if (check) check.textContent = on ? '✓' : '○';
    }
    const count = document.querySelector('[data-watch-trait-count]');
    if (count) count.textContent = `${draft.traitIds.length} checked`;
    const body = document.getElementById('watchTraitBody');
    if (body && watchTraitQuery === '__selected__') body.innerHTML = watchAlongOrderedSelectedHtml(movie, draft);
    refreshWatchOutline(movie, draft);
  };

  window.watchAlongSaveText = function(field, value) {
    const movie = watchMovie();
    const draft = getDraft(movie);
    if (!draft || !['notes','rules'].includes(field)) return;
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

  function watchAlongOrderedSelectedHtml(movie, draft) {
    const byId = new Map((state.traits || []).map(t => [t.id, t]));
    const ordered = (draft?.traitIds || []).map(id => byId.get(id)).filter(Boolean);
    const confirmed = new Set(movie?.selectedTraitIds || []);
    if (!ordered.length) return '<div class="empty watch-empty">Nothing checked yet.</div>';

    return '<section class="watch-trait-group">'
      +'<div class="watch-trait-group-head"><strong>Talk order</strong><span>'+ordered.length+' checked</span></div>'
      +'<div style="display:grid;gap:8px">'
      +ordered.map((t,index) => {
        const upDisabled=index===0?'disabled':'';
        const downDisabled=index===ordered.length-1?'disabled':'';
        return '<div class="watch-trait is-selected '+(confirmed.has(t.id)?'was-confirmed':'')+'" style="display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:8px;align-items:center">'
          +'<strong style="text-align:center">'+(index+1)+'</strong>'
          +'<button type="button" style="border:0;background:transparent;color:inherit;text-align:left;padding:0;min-width:0" onclick="watchAlongToggleTrait(\''+esc(t.id)+'\',this)">'
            +'<span class="watch-trait-name">'+esc(t.name)+'</span> '
            +'<span class="watch-trait-points">+'+Number(t.points||0)+'</span>'
            +'<span class="subtle" style="display:block">'+esc(t.category||'Other')+'</span>'
          +'</button>'
          +'<span style="display:flex;gap:4px">'
            +'<button type="button" class="secondary" '+upDisabled+' aria-label="Move '+esc(t.name)+' up" onclick="watchAlongMoveTrait(\''+esc(t.id)+'\',-1)">↑</button>'
            +'<button type="button" class="secondary" '+downDisabled+' aria-label="Move '+esc(t.name)+' down" onclick="watchAlongMoveTrait(\''+esc(t.id)+'\',1)">↓</button>'
          +'</span>'
        +'</div>';
      }).join('')
      +'</div>'
      +'<div class="subtle" style="margin-top:10px">This is the order you plan to talk about these traits on mic. It autosaves for this movie.</div>'
      +'</section>';
  }

  window.watchAlongShowSelected = function() {
    watchTraitQuery = '__selected__';
    const movie = watchMovie();
    const draft = getDraft(movie);
    const body = document.getElementById('watchTraitBody');
    if (!body || !movie || !draft) return;
    body.innerHTML = watchAlongOrderedSelectedHtml(movie, draft);
  };

  window.watchAlongMoveTrait = function(id, direction) {
    const movie = watchMovie();
    const draft = getDraft(movie);
    if (!movie || !draft) return;
    const order=[...(draft.traitIds || [])];
    const from=order.indexOf(id);
    if(from<0) return;
    const to=from+Number(direction||0);
    if(to<0 || to>=order.length) return;
    [order[from],order[to]]=[order[to],order[from]];
    draft.traitIds=order;
    putDraft(draft);
    const body=document.getElementById('watchTraitBody');
    if(body && watchTraitQuery==='__selected__') body.innerHTML=watchAlongOrderedSelectedHtml(movie,draft);
  };

  window.watchAlongAddCheckedTraitsToOutline = function() {
    const movie = watchMovie();
    const draft = getDraft(movie);
    if (!movie || !draft) return;
    const items = watchOutlineItems(draft);
    const existing = new Set(items.filter(i => i.type === 'trait').map(i => i.traitId));
    for (const traitId of (draft.traitIds || [])) {
      if (existing.has(traitId)) continue;
      items.push({id:'trait:'+traitId,type:'trait',traitId});
      existing.add(traitId);
    }
    draft.outlineItems = items;
    putDraft(draft);
    refreshWatchOutline(movie, draft);
  };

  window.watchAlongAddWatchNotesToOutline = function() {
    const movie = watchMovie();
    const draft = getDraft(movie);
    if (!movie || !draft) return;
    const notes = String(draft.notes || '')
      .split(/\n+/)
      .map(line => line.replace(/^\s*[•*-]\s*/, '').trim())
      .filter(Boolean);
    if (!notes.length) return alert('There are no Watch Notes to add yet.');
    const items = watchOutlineItems(draft);
    const existingNotes = new Set(items.filter(i => i.type === 'note').map(i => String(i.text || '').trim().toLowerCase()));
    for (const note of notes) {
      const key = note.toLowerCase();
      if (existingNotes.has(key)) continue;
      items.push({id:watchOutlineItemId('note'),type:'note',text:note});
      existingNotes.add(key);
    }
    draft.outlineItems = items;
    putDraft(draft);
    refreshWatchOutline(movie, draft);
  };

  window.watchAlongAddOutlineNote = function() {
    const movie = watchMovie();
    const draft = getDraft(movie);
    const input = document.getElementById('watchOutlineNoteInput');
    const note = input?.value.trim();
    if (!movie || !draft || !note) return;
    draft.outlineItems = [...watchOutlineItems(draft), {id:watchOutlineItemId('note'),type:'note',text:note}];
    putDraft(draft);
    if (input) { input.value=''; input.focus(); }
    refreshWatchOutline(movie, draft);
  };

  window.watchAlongOutlineNoteKey = function(event) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    watchAlongAddOutlineNote();
  };

  window.watchAlongEditOutlineNote = function(id) {
    const movie = watchMovie();
    const draft = getDraft(movie);
    if (!movie || !draft) return;
    const items = [...watchOutlineItems(draft)];
    const item = items.find(i => i.id === id);
    if (!item || item.type !== 'note') return;
    const next = prompt('Edit talking point:', item.text || '');
    if (next === null) return;
    const text = next.trim();
    if (!text) {
      draft.outlineItems = items.filter(i => i.id !== id);
    } else {
      item.text = text;
      draft.outlineItems = items;
    }
    putDraft(draft);
    refreshWatchOutline(movie, draft);
  };

  window.watchAlongRemoveOutlineItem = function(id) {
    const movie = watchMovie();
    const draft = getDraft(movie);
    if (!movie || !draft) return;
    draft.outlineItems = watchOutlineItems(draft).filter(i => i.id !== id);
    putDraft(draft);
    refreshWatchOutline(movie, draft);
  };

  window.watchAlongMoveOutlineItem = function(id, direction) {
    const movie = watchMovie();
    const draft = getDraft(movie);
    if (!movie || !draft) return;
    const items = [...watchOutlineItems(draft)];
    const from = items.findIndex(i => i.id === id);
    if (from < 0) return;
    const to = from + Number(direction || 0);
    if (to < 0 || to >= items.length) return;
    [items[from],items[to]] = [items[to],items[from]];
    draft.outlineItems = items;
    putDraft(draft);
    refreshWatchOutline(movie, draft);
  };

  let watchOutlineDragId = null;

  window.watchAlongOutlineDragStart = function(event, id) {
    watchOutlineDragId = id;
    event.currentTarget?.classList.add('is-dragging');
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', id);
    }
  };

  window.watchAlongOutlineDragEnd = function(event) {
    watchOutlineDragId = null;
    event.currentTarget?.classList.remove('is-dragging');
  };

  window.watchAlongOutlineDragOver = function(event) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  };

  window.watchAlongOutlineDrop = function(event, targetId) {
    event.preventDefault();
    const movie = watchMovie();
    const draft = getDraft(movie);
    if (!movie || !draft) return;
    const sourceId = event.dataTransfer?.getData('text/plain') || watchOutlineDragId;
    watchOutlineDragId = null;
    if (!sourceId || sourceId === targetId) return;
    const items = [...watchOutlineItems(draft)];
    const from = items.findIndex(i => i.id === sourceId);
    const to = items.findIndex(i => i.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = items.splice(from,1);
    items.splice(to,0,moved);
    draft.outlineItems = items;
    putDraft(draft);
    refreshWatchOutline(movie, draft);
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
