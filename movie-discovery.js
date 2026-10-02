// Cheese Louise v1.5 — automatic TMDB discovery / New Finds intake.
// Loaded after holiday-season-filters.js.

state.discoveryResults = state.discoveryResults || [];
let discoveryLoading = false;
let discoveryLoaded = false;
let discoveryError = '';
let discoveryExpanded = false;
let discoveryHidden = new Set();

function discoveryExistingIds(){
  return new Set((state.movies||[]).filter(m=>m.tmdb_id).map(m=>`${m.tmdb_type||'movie'}:${Number(m.tmdb_id)}`));
}

function discoveryTraitSuggestions(candidate){
  const text = `${candidate.title||''} ${candidate.summary||''} ${(candidate.why||[]).join(' ')}`.toLowerCase();
  const aliases = typeof suggestionAliases === 'function' ? suggestionAliases() : {};
  return (state.traits||[]).filter(t=>{
    if(!t.is_active) return false;
    const direct=t.name && t.name.length>4 && text.includes(t.name.toLowerCase());
    const alias=(aliases[t.name]||[]).some(k=>text.includes(String(k).toLowerCase()));
    return direct || alias;
  });
}

function discoveryEstimate(candidate){
  const traits=discoveryTraitSuggestions(candidate);
  return {traits,score:Math.min(100,traits.reduce((sum,t)=>sum+Number(t.points||0),0))};
}

function discoveryMatchesCurrentView(c){
  const q=(searchText||'').trim().toLowerCase();
  if(q){
    const hay=[c.title,c.summary,c.network,c.holiday,c.season,...(c.providers||[]),...(c.why||[])].filter(Boolean).join(' ').toLowerCase();
    if(!hay.includes(q)) return false;
  }
  if(movieFilters?.holiday && clNorm(c.holiday)!==clNorm(movieFilters.holiday)) return false;
  if(movieFilters?.season && clNorm(c.season)!==clNorm(movieFilters.season)) return false;
  if(movieFilters?.mode==='saved' || movieFilters?.mode==='mutual') return false;
  const estimate=discoveryEstimate(c);
  if(Number(movieFilters?.minScore||0) > estimate.score) return false;
  if((movieFilters?.traitIds||[]).length){
    const ids=new Set(estimate.traits.map(t=>t.id));
    if(!movieFilters.traitIds.every(id=>ids.has(id))) return false;
  }
  return true;
}

function discoveryCard(c){
  const est=discoveryEstimate(c);
  const providerText=(c.providers||[]).slice(0,3).join(' · ') || c.network || 'Provider not listed yet';
  const date=c.premiere_date||'Date TBA';
  const meta=[c.holiday,c.season].filter(Boolean).join(' · ');
  const why=(c.why||[]).slice(0,6);
  return `<article class="new-find-card card">
    <div class="new-find-poster">${c.poster_url?`<img src="${esc(c.poster_url)}" alt="${esc(c.title)} poster" loading="lazy">`:`<div class="new-find-poster-fallback">CL</div>`}</div>
    <div class="new-find-body">
      <div class="new-find-topline"><span class="kicker">${esc(c.network||'Streaming / TV')}</span><span class="radar-match">🎯 ${Number(c.match_score||0)} match</span></div>
      <h3>${esc(c.title)}</h3>
      <div class="subtle">${esc(date)}${meta?` · ${esc(meta)}`:''}</div>
      <div class="subtle provider-line">${esc(providerText)}</div>
      <p>${esc(c.summary||'No synopsis yet.')}</p>
      <div class="new-find-score"><strong>Estimated Cheese Rating</strong><span class="cheese-score">🧀 ${est.score}</span></div>
      ${est.traits.length?`<div class="pills">${est.traits.slice(0,5).map(t=>`<span class="pill trait-pill">${esc(t.name)} <b>+${t.points}</b></span>`).join('')}${est.traits.length>5?`<span class="pill">+${est.traits.length-5} more</span>`:''}</div>`:'<div class="subtle">No exact Cheese Traits confidently matched yet.</div>'}
      ${why.length?`<details class="new-find-why"><summary>Why is this on my radar?</summary><div class="pills">${why.map(x=>`<span class="pill">${esc(x)}</span>`).join('')}</div></details>`:''}
      <div class="new-find-actions">
        <button class="primary" onclick="addDiscoveredMovie(${Number(c.tmdb_id)},true)">${est.traits.length?`Add + confirm ${est.traits.length} traits`:'Add to Radar'}</button>
        ${est.traits.length?`<button class="secondary" onclick="addDiscoveredMovie(${Number(c.tmdb_id)},false)">Add only</button>`:''}
        <button class="secondary" onclick="hideDiscoveredMovie(${Number(c.tmdb_id)})">Hide for now</button>
        <a class="button-link" href="${esc(c.source_url||'#')}" target="_blank" rel="noopener">TMDB ↗</a>
      </div>
    </div>
  </article>`;
}

function discoveryPanel(){
  const existing=discoveryExistingIds();
  const candidates=(state.discoveryResults||[]).filter(c=>!existing.has(`${c.tmdb_type||'movie'}:${Number(c.tmdb_id)}`) && !discoveryHidden.has(Number(c.tmdb_id)) && discoveryMatchesCurrentView(c));
  const shown=discoveryExpanded?candidates:candidates.slice(0,8);
  const header=`<div class="new-find-header"><div><div class="page-title small-title">New Finds</div><div class="subtle">Cheese Louise scans TMDB for suspicious romances and TV movies so you don't have to enter them by hand.</div></div><button class="secondary" onclick="discoverCheeseMovies(true)">↻ Refresh</button></div>`;
  if(discoveryLoading) return `<div class="new-find-panel card card-pad">${header}<div class="discovery-loading"><span class="discovery-spinner">🧀</span> Hunting for cheese…</div></div>`;
  if(discoveryError) return `<div class="new-find-panel card card-pad">${header}<div class="empty"><strong>Movie scan hit a snag.</strong><div class="subtle">${esc(discoveryError)}</div><button class="primary" style="margin-top:10px" onclick="discoverCheeseMovies(true)">Try again</button></div></div>`;
  if(!discoveryLoaded) return `<div class="new-find-panel card card-pad">${header}<button class="primary" onclick="discoverCheeseMovies(true)">🔎 Find movies for me</button></div>`;
  return `<div class="new-find-panel">
    ${header}
    <div class="new-find-stats"><span class="pill">${candidates.length} new candidate${candidates.length===1?'':'s'}</span><span class="subtle">Movie data: TMDB · Streaming availability: JustWatch via TMDB</span></div>
    <div class="new-find-grid">${shown.map(discoveryCard).join('')||'<div class="empty card card-pad">Nothing new matches these filters right now.</div>'}</div>
    ${candidates.length>8?`<button class="secondary discovery-more" onclick="toggleDiscoveryExpanded()">${discoveryExpanded?'Show fewer':`Show ${candidates.length-8} more`}</button>`:''}
  </div>`;
}

async function discoverCheeseMovies(force=false){
  if(discoveryLoading) return;
  if(discoveryLoaded && !force) return;
  discoveryLoading=true; discoveryError=''; render();
  try{
    const {data,error}=await db.functions.invoke('discover-cheese-movies',{body:{days_back:730,days_forward:365,max_results:48}});
    if(error) throw error;
    if(data?.error) throw new Error(data.error);
    state.discoveryResults=Array.isArray(data?.results)?data.results:[];
    discoveryLoaded=true;
  }catch(err){
    discoveryError=err?.message||String(err);
  }finally{
    discoveryLoading=false; render();
  }
}

async function addDiscoveredMovie(tmdbId,applyTraits){
  const c=(state.discoveryResults||[]).find(x=>Number(x.tmdb_id)===Number(tmdbId));
  if(!c||!workspace) return;
  const existing=(state.movies||[]).find(m=>Number(m.tmdb_id)===Number(tmdbId) && (m.tmdb_type||'movie')===(c.tmdb_type||'movie'));
  if(existing){ selectedMovie=existing.id; render(); return; }

  const payload={
    workspace_id:workspace.id,
    title:c.title,
    network:c.network||null,
    cheese_score:0,
    status:'needs_review',
    summary:c.summary||null,
    tags:['TMDB discovery',...(c.why||[]).slice(0,6)],
    source_url:c.source_url||null,
    poster_url:c.poster_url||null,
    holiday:c.holiday||null,
    season:c.season||null,
    providers:c.providers||[],
    tmdb_id:Number(c.tmdb_id),
    tmdb_type:c.tmdb_type||'movie',
    created_by:me()
  };
  if(/^\d{4}-\d{2}-\d{2}$/.test(c.premiere_date||'')) payload.premiere_date=c.premiere_date;

  const {data,error}=await db.from('movies').insert(payload).select().single();
  if(error) return alert(error.message);

  const suggestions=applyTraits?discoveryTraitSuggestions(c):[];
  if(suggestions.length){
    const rows=suggestions.map(t=>({workspace_id:workspace.id,movie_id:data.id,trait_id:t.id,selected_by:me()}));
    const {error:traitError}=await db.from('movie_traits').insert(rows);
    if(traitError) alert(`Movie added, but the suggested traits hit an error: ${traitError.message}`);
  }

  discoveryHidden.add(Number(tmdbId));
  await logActivity(`found and added ${c.title} from TMDB${suggestions.length?` with ${suggestions.length} confirmed Cheese Traits`:''}.`,'movie',data.id);
  await loadAll();
  selectedMovie=data.id; traitSearch=''; traitSelectedOnly=false; render();
}

function hideDiscoveredMovie(id){ discoveryHidden.add(Number(id)); render(); }
function toggleDiscoveryExpanded(){ discoveryExpanded=!discoveryExpanded; render(); }

const discoveryOriginalMovies=movies;
movies=function(){
  let html=discoveryOriginalMovies();
  const panel=`<section class="section discovery-section">${discoveryPanel()}</section>`;
  const firstEnd=html.indexOf('</section>');
  if(firstEnd>=0) html=html.slice(0,firstEnd+10)+panel+html.slice(firstEnd+10);
  else html=panel+html;

  if(session && workspace && !discoveryLoaded && !discoveryLoading && !discoveryError){
    setTimeout(()=>discoverCheeseMovies(false),0);
  }
  return html;
};

window.discoverCheeseMovies=discoverCheeseMovies;
window.addDiscoveredMovie=addDiscoveredMovie;
window.hideDiscoveredMovie=hideDiscoveredMovie;
window.toggleDiscoveryExpanded=toggleDiscoveryExpanded;
