(() => {
  const drafts = [
    ['description', 'Episode description', 5],
    ['launch', 'Instagram / Facebook caption', 5],
    ['teaser', 'Short teaser caption', 3]
  ];
  const tasks = [
    ['audio', 'Upload and schedule the episode'],
    ['links', 'Verify the episode, cocktail, and Bingo links'],
    ['clip', 'Choose and export a promo clip'],
    ['posts', 'Schedule or publish the social posts'],
    ['site', 'Update the Cheese Louise website']
  ];
  let selectedId;
  const fallback = new Map();
  const keyFor = id => 'cheeseLouise:marketing:v1:' + workspace.id + ':' + id;

  function read(id) {
    const key = keyFor(id);
    if (fallback.has(key)) return fallback.get(key);
    try {
      return JSON.parse(localStorage.getItem(key)) || {};
    } catch {
      return {};
    }
  }

  function save(id, data) {
    const key = keyFor(id);
    let message = 'Saved in this browser.';
    try {
      localStorage.setItem(key, JSON.stringify(data));
      fallback.delete(key);
    } catch {
      fallback.set(key, data);
      message = 'Browser storage is unavailable. Changes will be lost when HQ reloads.';
    }
    document.getElementById('marketing-status').textContent = message;
  }

  function starterCopy(episode, movie) {
    const topic = movie ? 'Nick and Jenny watch ' + movie.title + '. ' : '';
    const drink = episode.cocktail ? ' This week’s Cheesy Concoction is ' + episode.cocktail + '.' : '';
    return {
      description: topic + 'Join Nick and Jenny on Cheese Louise for a made-for-TV romance, a themed cocktail, and a round of Romantiverse Bingo.' + drink,
      launch: 'This week on Cheese Louise: ' + episode.title + '. ' + topic + 'Mix a drink and play along with Romantiverse Bingo.' + drink + '\n\nhttps://cheeselouisepod.com',
      teaser: 'What would you put on the Bingo card for ' + (movie?.title || 'this week’s movie') + '?'
    };
  }

  function page() {
    const episodes = state.episodes;
    const heading = '<section class="section"><h1 class="page-title">Marketing</h1><p class="subtle">Promo copy and release checklist. Edits stay in this browser.</p></section>';
    if (!episodes.length) {
      return heading + '<section class="section card card-pad"><p>Add an episode to start preparing its release.</p><button class="primary" type="button" onclick="hqWorkspace.open(\'episodes\')">Open Episodes</button></section>';
    }

    const episode = episodes.find(item => item.id === selectedId) || episodes[0];
    selectedId = episode.id;
    const movie = state.movies.find(item => item.id === episode.movie_id);
    const saved = read(selectedId);
    const starter = starterCopy(episode, movie);
    const release = episode.release_date ? 'Release ' + fmtDate(episode.release_date) : 'Release date TBD';
    const done = tasks.filter(([key]) => saved.checks?.[key]).length;
    return heading + `
      <section class="section card card-pad marketing-context">
        <label for="marketing-episode">Episode</label>
        <select id="marketing-episode" onchange="clMarketing.select(this.value)">
          ${episodes.map(item => `<option value="${esc(item.id)}" ${item.id === episode.id ? 'selected' : ''}>${esc(item.title)}</option>`).join('')}
        </select>
        <p class="subtle">${esc([release, movie?.title, episode.cocktail].filter(Boolean).join(' · '))}</p>
        <p id="marketing-status" class="subtle" role="status">${fallback.has(keyFor(episode.id)) ? 'Changes are saved for this session only.' : 'Changes save as you edit.'}</p>
      </section>
      <div class="section marketing-grid">
        <section class="card card-pad marketing-copy" aria-labelledby="marketing-copy-title">
          <h2 id="marketing-copy-title">Promo drafts</h2>
          ${drafts.map(([key, label, rows]) => `
            <div class="marketing-draft">
              <label for="marketing-${key}">${label}</label>
              <textarea id="marketing-${key}" rows="${rows}" oninput="clMarketing.edit('${key}', this.value)">${esc(saved.drafts?.[key] ?? starter[key])}</textarea>
              <button class="secondary" type="button" aria-label="Copy ${label}" onclick="clMarketing.copy('${key}')">Copy</button>
            </div>`).join('')}
        </section>
        <section class="card card-pad marketing-checklist" aria-labelledby="marketing-checklist-title">
          <h2 id="marketing-checklist-title">Release checklist</h2>
          <p class="subtle" id="marketing-progress" aria-live="polite">${done} of ${tasks.length} complete</p>
          ${tasks.map(([key, label]) => `<label><input type="checkbox" ${saved.checks?.[key] ? 'checked' : ''} onchange="clMarketing.check('${key}', this.checked)"> ${label}</label>`).join('')}
        </section>
      </div>`;
  }

  window.clMarketing = {
    page,
    select(id) {
      selectedId = id;
      render();
      document.getElementById('marketing-episode')?.focus();
    },
    edit(key, value) {
      const saved = read(selectedId);
      save(selectedId, { ...saved, drafts: { ...saved.drafts, [key]: value } });
    },
    check(key, checked) {
      const saved = read(selectedId);
      const checks = { ...saved.checks, [key]: checked };
      save(selectedId, { ...saved, checks });
      const done = tasks.filter(([id]) => checks[id]).length;
      document.getElementById('marketing-progress').textContent = done + ' of ' + tasks.length + ' complete';
    },
    async copy(key) {
      const field = document.getElementById('marketing-' + key);
      const status = document.getElementById('marketing-status');
      try {
        await navigator.clipboard.writeText(field.value);
        status.textContent = 'Copied to clipboard.';
      } catch {
        field.focus();
        field.select();
        status.textContent = 'Draft selected. Press Ctrl+C or use your device’s Copy command.';
      }
    }
  };
})();
