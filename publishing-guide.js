(() => {
  const buzzsprout = 'https://app.buzzsprout.com/';
  const help = 'https://www.buzzsprout.com/help/';
  const hindenburg = 'https://hindenburg.com/academy/guides/guides-hindenburg-pro/';
  const link = (url, label) => '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
  const steps = [
    ['master', 'Check the final mix in Hindenburg',
      'Export a full-episode WAV to keep as your master. Play the exported file. Check both voices, the theme, music stabs, the Grit Whimsy closer, and the ending. If the export peaks or sounds distorted, fix the mix before sending it.',
      link(hindenburg, 'Hindenburg export guide')],
    ['upload', 'Send the audio to Buzzsprout',
      'In Hindenburg Pro, open Publish, create or select the Buzzsprout publish target, then send the full episode. Open Buzzsprout and find the upload under Episodes. If the target fails, check Episodes for an existing upload first. If there is none, use Upload a New Episode with your WAV or a high-quality MP3. Keep it unpublished while you review.',
      link(buzzsprout, 'Open Buzzsprout') + ' · ' + link(help + '3', 'Manual upload guide')],
    ['details', 'Paste the episode details',
      'Copy the title and description below into the episode editor. Add the official movie title early in the description and verify the public links. Use Full for a regular episode, Trailer for a launch preview, or Bonus for a special. Set the episode number in its own field if you use numbering. Review the final audio for strong language before setting Explicit Content.',
      link(help + '127-episode-type', 'Episode types') + ' · ' + link(help + '212-explicit-content', 'Explicit content')],
    ['review', 'Review the processed draft',
      'Play the processed Buzzsprout audio before scheduling. Compare voice and music levels, check for the correct duration, and confirm the ending plays. Default audio is mono. If the stereo mix matters for the Grit Whimsy song, compare a test using the Mostly Music stereo option before making it your preset. If you add chapters or a transcript, check chapter times against the final audio and proofread the names.',
      link(help + '163-audio-optimization', 'Mono and stereo settings') + ' · ' + link(help + '51-edit-a-podcast-audio-file', 'Replace audio in the same episode')],
    ['schedule', 'Schedule the release',
      'Choose Schedule for future, enter the intended date and time, then click Save and Update Episode. Verify the time zone shown in Buzzsprout and confirm the scheduled timestamp in Episodes. The Cheese Louise target is Monday, 4–5 a.m. Eastern (2–3 a.m. Mountain).',
      link(help + '4-schedule', 'Scheduling guide')],
    ['live', 'Verify that listeners can play it',
      'After release, play the public Buzzsprout episode and check the Apple Podcasts and Spotify listings once the show is listed. Directory updates can take up to 24 hours. Use the verified public episode link in Marketing and on the Cheese Louise website.',
      link(help + '133-directories-updating', 'Directory timing')]
  ];

  let selectedId;
  const pending = new Map();
  const keyFor = id => 'cheeseLouise:publishing:v1:' + workspace.id + ':' + id;

  function read(id) {
    const key = keyFor(id);
    if (pending.has(key)) return pending.get(key);
    try {
      return JSON.parse(localStorage.getItem(key)) || {};
    } catch {
      return {};
    }
  }

  function status(message) {
    document.getElementById('publishing-status').textContent = message;
  }

  function save(data) {
    const key = keyFor(selectedId);
    try {
      localStorage.setItem(key, JSON.stringify(data));
      pending.delete(key);
      status('Saved in this browser.');
    } catch {
      pending.set(key, data);
      status('Browser storage is unavailable. These changes will last until HQ reloads.');
    }
  }

  function updateProgress(checks = {}) {
    const completed = steps.filter(([key]) => checks[key]).length;
    const next = steps.find(([key]) => !checks[key]);
    document.getElementById('publishing-progress').textContent =
      completed + ' of ' + steps.length + ' complete. ' + (next ? 'Next: ' + next[1] + '.' : 'Release verified.');
  }

  function field(key, label, value, rows) {
    return `<div class="marketing-draft">
      <label for="publishing-${key}">${label}</label>
      <textarea id="publishing-${key}" rows="${rows}" oninput="clPublishing.edit('${key}', this.value)">${esc(value)}</textarea>
      <button type="button" class="secondary" aria-label="Copy ${label}" onclick="clPublishing.copy('${key}')">Copy</button>
    </div>`;
  }

  function page() {
    const episodes = state.episodes || [];
    const episode = episodes.find(item => item.id === selectedId)
      || episodes.find(item => ['editing', 'recorded', 'scheduled'].includes(item.status))
      || episodes[0];
    const heading = `<section class="section">
      <h1 class="page-title">Production</h1>
      <p class="subtle">Take an episode from the final Hindenburg mix to a verified Buzzsprout release.</p>
    </section>
    <details class="section card card-pad"${episode ? '' : ' open'}>
      <summary>Set up Buzzsprout once</summary>
      <ol>
        <li>Verify your Buzzsprout account email. In Settings → Podcast Settings, review the show name, description, language, category, artwork, and explicit setting. TV &amp; Film → Film Reviews is a starting category for Cheese Louise.</li>
        <li>Choose an upload allowance that fits the recording schedule. Four 45-minute episodes use three hours and five use three hours and 45 minutes. Uploads count in the cycle when you send them. Episodes on the free plan expire after 90 days. ${link(help + '231-what-is-included-in-the-free-plan', 'Free-plan details')}</li>
        <li>Set up the Buzzsprout publish target in Hindenburg once. Enter any requested connection details in Hindenburg itself. ${link(hindenburg, 'Hindenburg publish-target walkthrough')}</li>
        <li>Publish a trailer or your first episode, then open Buzzsprout → Directories and submit to Apple Podcasts and Spotify. Allow time for initial approval. Future episodes are picked up from your feed. ${link(help + '139-submitting-to-directories', 'Directory setup')}</li>
      </ol>
    </details>`;

    if (!episode) {
      return heading + `<section class="section card card-pad"><p>Create an episode to start the release checklist.</p>
        <button type="button" class="primary" onclick="hqWorkspace.open('episodes')">Open Episodes</button></section>`;
    }

    selectedId = episode.id;
    const movie = state.movies.find(item => item.id === episode.movie_id);
    const saved = read(episode.id);
    const checks = saved.checks || {};
    const next = steps.find(([key]) => !checks[key]);
    const complete = steps.filter(([key]) => checks[key]).length;
    const movieTitle = movie?.title || episode.title;
    const drink = episode.cocktail ? ' This week’s Cheesy Concoction is ' + episode.cocktail + '.' : '';
    const description = 'Nick and Jenny watch ' + movieTitle
      + ' and break down the tropes over a themed cocktail and a round of Romantiverse Bingo.'
      + drink + '\n\nPlay along at https://cheeselouisepod.com';
    const tags = [...new Set(['Romantiverse Bingo', 'Cheesy Concoctions', ...(Array.isArray(movie?.tags) ? movie.tags : [])]
      .filter(tag => typeof tag === 'string' && tag.trim()).map(tag => tag.trim()))].join(', ');
    return heading + `
      <section class="section card card-pad marketing-context">
        <label for="publishing-episode">Episode</label>
        <select id="publishing-episode" onchange="clPublishing.select(this.value)">
          ${episodes.map(item => `<option value="${esc(item.id)}"${item.id === selectedId ? ' selected' : ''}>${esc(item.title)}</option>`).join('')}
        </select>
        <p class="subtle">${esc(episode.release_date ? 'HQ release date: ' + fmtDate(episode.release_date) : 'HQ release date has not been set.')}</p>
        <p id="publishing-status" role="status" class="subtle">${pending.has(keyFor(episode.id)) ? 'Changes are saved for this session only.' : 'Checklist and drafts save in this browser.'}</p>
      </section>
      <div class="section marketing-grid">
        <section class="card card-pad">
          <h2>Release checklist</h2>
          <p id="publishing-progress" aria-live="polite">${complete} of ${steps.length} complete. ${next ? 'Next: ' + next[1] + '.' : 'Release verified.'}</p>
          ${steps.map(([key, title, instructions, resources]) => `
            <details class="section"${key === next?.[0] ? ' open' : ''}>
              <summary>${title}</summary>
              <p>${instructions}</p>
              <p>${resources}</p>
              <label><input type="checkbox" ${checks[key] ? 'checked' : ''} onchange="clPublishing.check('${key}', this)"> Mark complete</label>
            </details>`).join('')}
        </section>
        <section class="card card-pad">
          <h2>Copy to Buzzsprout</h2>
          ${field('title', 'Episode title', saved.fields?.title ?? episode.title, 2)}
          <p class="subtle">Add a specific, spoiler-free hook from your conversation before pasting the description.</p>
          ${field('description', 'Episode description', saved.fields?.description ?? description, 5)}
          <p class="subtle">Optional tags organize Buzzsprout embed players. In Edit → See more options, paste comma-separated tags without hashtags. For listener search, put the exact movie title and a clear hook in the episode title or description.</p>
          ${field('tags', 'Episode tags', saved.fields?.tags ?? tags, 2)}
          <details><summary>Show keywords and categories</summary>
            <p>Set these once under Settings → Podcast Settings. Keywords belong to the whole show. Try made-for-TV romance, Hallmark movies, Lifetime movies, Romantiverse Bingo, and themed cocktails. Categories describe the show to directories. ${link(help + '174-tags-keywords', 'How Buzzsprout uses tags and keywords')}</p>
          </details>
        </section>
      </div>`;
  }

  window.clPublishing = {
    page,
    select(id) {
      selectedId = id;
      render();
      document.getElementById('publishing-episode')?.focus();
    },
    edit(key, value) {
      const saved = read(selectedId);
      save({ ...saved, fields: { ...saved.fields, [key]: value } });
    },
    check(key, checkbox) {
      const saved = read(selectedId);
      const checks = { ...saved.checks, [key]: checkbox.checked };
      save({ ...saved, checks });
      updateProgress(checks);
      const next = steps.find(([id]) => !checks[id]);
      const checkboxes = [...document.querySelectorAll('#publishing-progress ~ details input')];
      const nextBox = checkboxes[steps.indexOf(next)];
      if (checkbox.checked && nextBox) nextBox.closest('details').open = true;
    },
    async copy(key) {
      const input = document.getElementById('publishing-' + key);
      try {
        await navigator.clipboard.writeText(input.value);
        status('Copied to clipboard.');
      } catch {
        input.focus();
        input.select();
        status('Text selected. Use your device’s Copy command.');
      }
    }
  };
})();
