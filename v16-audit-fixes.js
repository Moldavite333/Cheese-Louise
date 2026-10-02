// Cheese Louise v1.6 — reliability pass and missing core UI.
// Loaded after movie-discovery.js and before auth-enhancements.js.

const CL_BUILD = 'v1.6';
let selectedEpisode = null;

// ---------------------------------------------------------------------------
// Make the active build obvious so stale browser caches are easy to spot.
// ---------------------------------------------------------------------------
const v16OriginalTopbar = topbar;
topbar = function(){
  let html = v16OriginalTopbar();
  const brand = '<div class="brand"><div class="brand-mark">CL</div><div>Cheese Louise HQ</div></div>';
  return html.replace(brand, `${brand}<span class="build-pill">${CL_BUILD}</span>`);
};

// ---------------------------------------------------------------------------
// Discovery should happen quietly after login, not only after opening Movies.
// ---------------------------------------------------------------------------
function v16KickDiscovery(){
  if(!session || !workspace || typeof discoverCheeseMovies !== 'function') return;
  if(discoveryLoaded || discoveryLoading || discoveryError) return;
  setTimeout(()=>discoverCheeseMovies(false), 0);
}

function v16NewFindCandidates(){
  if(!Array.isArray(state.discoveryResults)) return [];
  const existing = typeof discoveryExistingIds === 'function' ? discoveryExistingIds() : new Set();
  return state.discoveryResults.filter(c => !existing.has(`${c.tmdb_type||'movie'}:${Number(c.tmdb_id)}`));
}

function v16DiscoveryHomeCard(){
  let body = '';
  if(discoveryLoading){
    body = '<div class="home-discovery-status"><span class="discovery-spinner">🧀</span><strong>Hunting for cheese…</strong><span class="subtle">Scanning real movie releases in the background.</span></div>';
  }else if(discoveryError){
    body = `<div class="home-discovery-status"><strong>Movie scan needs attention.</strong><span class="subtle">${esc(discoveryError)}</span><button class="secondary" onclick="retryDiscoveryFromHome()">Try again</button></div>`;
  }else if(discoveryLoaded){
    const candidates = v16NewFindCandidates();
    const strong = candidates.filter(c => Number(c.match_score||0) >= 20).length;
    const upcoming = candidates.filter(c => c.premiere_date && c.premiere_date >= new Date().toISOString().slice(0,10)).length;
    body = `<div class="home-discovery-stats"><div><strong>${candidates.length}</strong><span>new finds</span></div><div><strong>${strong}</strong><span>strong matches</span></div><div><strong>${upcoming}</strong><span>upcoming</span></div></div>`;
  }else{
    body = '<div class="home-discovery-status"><strong>Movie hunter is ready.</strong><span class="subtle">It will scan automatically after the shared HQ loads.</span></div>';
  }

  return `<section class="section"><div class="card card-pad home-discovery-card">
    <div class="home-discovery-head"><div><div class="kicker">Movie hunter</div><h2>New Finds</h2></div><span class="pill">TMDB</span></div>
    ${body}
    <div class="home-discovery-actions"><button class="primary" onclick="go('movies')">Open Movie Radar</button><button class="secondary" onclick="refreshDiscoveryFromHome()">↻ Refresh scan</button></div>
  </div></section>`;
}

const v16OriginalHome = home;
home = function(){ return v16DiscoveryHomeCard() + v16OriginalHome(); };

window.retryDiscoveryFromHome = function(){
  discoveryError = '';
  discoveryLoaded = false;
  discoverCheeseMovies(true);
};
window.refreshDiscoveryFromHome = function(){ discoverCheeseMovies(true); };

// ---------------------------------------------------------------------------
// Saved Radar movies should keep their real poster/provider/watch information.
// ---------------------------------------------------------------------------
const v16OriginalMovieCard = movieCard;
movieCard = function(m){
  let html = v16OriginalMovieCard(m);
  if(m.poster_url){
    const placeholder = `<div class="poster" onclick="openMovie('${m.id}')"><div class="poster-title">${esc(m.title)}</div></div>`;
    const realPoster = `<div class="poster real-poster" onclick="openMovie('${m.id}')"><img src="${esc(m.poster_url)}" alt="${esc(m.title)} poster" loading="lazy"></div>`;
    html = html.replace(placeholder, realPoster);
  }
  if(Array.isArray(m.providers) && m.providers.length){
    const providerLine = `<div class="subtle saved-provider-line">${esc(m.providers.slice(0,3).join(' · '))}</div>`;
    html = html.replace('<div class="pills">', `${providerLine}<div class="pills">`);
  }
  return html;
};

const v16OriginalCheeseMovieModal = cheeseMovieModal;
cheeseMovieModal = function(){
  const m = state.movies.find(x=>x.id===selectedMovie);
  let html = v16OriginalCheeseMovieModal();
  if(!m) return html;

  const providers = Array.isArray(m.providers) && m.providers.length
    ? `<div class="pills source-pills">${m.providers.slice(0,5).map(p=>`<span class="pill">${esc(p)}</span>`).join('')}</div>`
    : '';
  const links = [
    m.watch_url ? `<a class="button-link" href="${esc(m.watch_url)}" target="_blank" rel="noopener">Where to watch ↗</a>` : '',
    m.source_url ? `<a class="button-link" href="${esc(m.source_url)}" target="_blank" rel="noopener">TMDB ↗</a>` : ''
  ].filter(Boolean).join('');
  if(providers || links){
    const sourceBox = `<div class="movie-source-box">${providers}<div class="movie-source-links">${links}</div></div>`;
    html = html.replace('<div class="movie-status-row">', `${sourceBox}<div class="movie-status-row">`);
  }
  return html;
};

// movie-discovery.js already saves all other TMDB metadata. Preserve the
// JustWatch/TMDB provider link too now that the database has a watch_url field.
const v16OriginalAddDiscoveredMovie = addDiscoveredMovie;
addDiscoveredMovie = async function(tmdbId, applyTraits){
  const candidate = (state.discoveryResults||[]).find(x=>Number(x.tmdb_id)===Number(tmdbId));
  await v16OriginalAddDiscoveredMovie(tmdbId, applyTraits);
  if(!candidate?.watch_url || !workspace) return;
  const saved = (state.movies||[]).find(m=>Number(m.tmdb_id)===Number(tmdbId));
  if(!saved || saved.watch_url===candidate.watch_url) return;
  const {error}=await db.from('movies').update({watch_url:candidate.watch_url,updated_at:new Date().toISOString()}).eq('id',saved.id);
  if(error){ console.error('Could not save watch link', error); return; }
  await loadAll();
  render();
};
window.addDiscoveredMovie = addDiscoveredMovie;

// ---------------------------------------------------------------------------
// Episode pipeline: expose the database fields that already existed but had no
// usable editor, especially the podcast outline.
// ---------------------------------------------------------------------------
function v16EpisodeStatusOptions(current){
  const statuses=['idea','planning','watched','ready','recorded','editing','scheduled','released'];
  return statuses.map(s=>`<option value="${s}" ${s===current?'selected':''}>${s.replace(/^./,c=>c.toUpperCase())}</option>`).join('');
}

function v16MovieOptions(current){
  const options=(state.movies||[]).slice().sort((a,b)=>a.title.localeCompare(b.title));
  return `<option value="">No movie linked</option>${options.map(m=>`<option value="${m.id}" ${m.id===current?'selected':''}>${esc(m.title)}</option>`).join('')}`;
}

function v16EpisodeModal(){
  const e=(state.episodes||[]).find(x=>x.id===selectedEpisode);
  if(!e) return '';
  return `<div class="modal-backdrop" onclick="closeEpisode(event)"><div class="modal episode-editor" onclick="event.stopPropagation()">
    <div class="modal-header"><div><div class="kicker">Episode workspace</div><h2 style="margin:6px 0">${esc(e.title)}</h2></div><button class="close" onclick="closeEpisode()">×</button></div>
    <div class="episode-editor-grid">
      <label class="wide">Episode title<input id="epTitle" class="search" value="${esc(e.title||'')}"></label>
      <label>Status<select id="epStatus" class="search">${v16EpisodeStatusOptions(e.status||'idea')}</select></label>
      <label>Release date<input id="epRelease" class="search" type="date" value="${esc(e.release_date||'')}"></label>
      <label class="wide">Movie<select id="epMovie" class="search">${v16MovieOptions(e.movie_id||'')}</select></label>
      <label>Guest<input id="epGuest" class="search" value="${esc(e.guest||'')}"></label>
      <label>Cocktail<input id="epCocktail" class="search" value="${esc(e.cocktail||'')}"></label>
      <label class="wide">Episode outline<textarea id="epOutline" class="search" rows="12" placeholder="Welcome / intro\nCocktail of the week\nGame\nGuest intro\nRecap + discussion\nRules of the Romantiverse\nRomantiverse Bingo…">${esc(e.outline||'')}</textarea></label>
      <label class="wide">Working notes<textarea id="epNotes" class="search" rows="6" placeholder="Bits, callbacks, research, things to remember…">${esc(e.notes||'')}</textarea></label>
    </div>
    <div class="episode-editor-actions"><button class="primary" onclick="saveEpisode('${e.id}')">Save episode</button><button class="secondary" onclick="scheduleEpisode('${e.id}')">📅 Schedule recording</button></div>
  </div></div>`;
}

const v16OriginalEpisodes = episodes;
episodes = function(){
  const cards=(state.episodes||[]).map(e=>{
    const linked=(state.movies||[]).find(m=>m.id===e.movie_id);
    return `<div class="card episode-card clickable" onclick="openEpisode('${e.id}')">
      <div class="episode-card-top"><div class="kicker">${esc(e.status||'idea')}</div><span class="subtle">Edit →</span></div>
      <h2 style="margin:5px 0 4px">${esc(e.title)}</h2>
      <div class="subtle">Release: ${esc(e.release_date?fmtDate(e.release_date):'TBD')}${e.guest?` · Guest: ${esc(e.guest)}`:''}</div>
      ${linked?`<div class="pill" style="margin-top:8px">🎬 ${esc(linked.title)}</div>`:''}
      ${e.cocktail?`<div class="pill" style="margin-top:8px">🍸 ${esc(e.cocktail)}</div>`:''}
      ${e.outline?'<div class="subtle" style="margin-top:8px">📝 Outline started</div>':''}
      ${e.notes?`<p>${esc(e.notes)}</p>`:''}
    </div>`;
  }).join('') || '<div class="empty">No episodes yet.</div>';
  return `<section class="section"><div class="page-title">Episodes</div><div class="subtle">Everything from movie choice to release — including the actual show outline.</div><div style="margin-top:12px"><button class="primary" onclick="addEpisode()">+ New episode</button></div></section>
  <section class="section"><div class="list">${cards}</div></section>`;
};

window.openEpisode = function(id){ selectedMovie=null; showTraitManager=false; selectedEpisode=id; render(); };
window.closeEpisode = function(){ selectedEpisode=null; render(); };
window.saveEpisode = async function(id){
  const payload={
    title:(document.getElementById('epTitle')?.value||'').trim(),
    status:document.getElementById('epStatus')?.value||'idea',
    release_date:document.getElementById('epRelease')?.value||null,
    movie_id:document.getElementById('epMovie')?.value||null,
    guest:(document.getElementById('epGuest')?.value||'').trim()||null,
    cocktail:(document.getElementById('epCocktail')?.value||'').trim()||null,
    outline:document.getElementById('epOutline')?.value||null,
    notes:document.getElementById('epNotes')?.value||null,
    updated_at:new Date().toISOString()
  };
  if(!payload.title) return alert('Give the episode a title first.');
  const {error}=await db.from('episodes').update(payload).eq('id',id);
  if(error) return alert(error.message);
  await logActivity(`updated episode ${payload.title}.`,'episode',id);
  await loadAll(); render();
};
window.scheduleEpisode = async function(id){
  const e=(state.episodes||[]).find(x=>x.id===id); if(!e) return;
  const when=prompt('Recording date/time (example: 2026-10-12 19:00):',''); if(!when) return;
  const d=new Date(when); if(Number.isNaN(d.getTime())) return alert('That date/time did not parse. Try YYYY-MM-DD HH:MM.');
  const {error}=await db.from('schedule_items').insert({workspace_id:workspace.id,episode_id:id,title:`Record: ${e.title}`,item_type:'record',starts_at:d.toISOString(),created_by:me()});
  if(error) return alert(error.message);
  await logActivity(`scheduled recording for ${e.title}.`,'episode',id);
  await loadAll(); render();
};

// Give Show Lab an explicit add button instead of hiding creation behind the +.
const v16OriginalIdeas = ideas;
ideas = function(){
  let html=v16OriginalIdeas();
  return html.replace('</section>', '<div style="margin-top:12px"><button class="primary" onclick="addShowIdea()">+ Add Show Lab idea</button></div></section>');
};
window.addShowIdea = async function(){
  const title=prompt('Show idea:'); if(!title) return;
  const category=prompt('Category:','Format / bit')||'Idea';
  const notes=prompt('Notes (optional):','')||'';
  const {data,error}=await db.from('show_ideas').insert({workspace_id:workspace.id,title:title.trim(),category:category.trim()||'Idea',notes:notes||null,status:'ideas',created_by:me()}).select().single();
  if(error) return alert(error.message);
  await logActivity(`added a new Show Lab idea: ${title.trim()}`,'idea',data.id);
  await loadAll(); render();
};

// Keep modals mutually exclusive when navigating.
const v16OriginalGo = window.go;
window.go = function(t){
  if(t!=='episodes') selectedEpisode=null;
  if(t!=='movies') selectedMovie=null;
  return v16OriginalGo(t);
};

// Add the episode editor after the normal page/modal render and launch discovery
// in the background. Auth recovery wraps this function after this file loads.
const v16OriginalRender = render;
render = function(){
  const result=v16OriginalRender();
  if(selectedEpisode && currentTab==='episodes' && session && workspace){
    document.getElementById('app')?.insertAdjacentHTML('beforeend', v16EpisodeModal());
  }
  v16KickDiscovery();
  return result;
};

// app.js starts booting before enhancement files finish loading. Retry briefly so
// a fast cached login still gets the automatic first scan.
let v16BootAttempts=0;
(function v16WaitForWorkspace(){
  if(session && workspace){ v16KickDiscovery(); return; }
  if(v16BootAttempts++<24) setTimeout(v16WaitForWorkspace,250);
})();
