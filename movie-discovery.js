// Cheese Louise — Hallmark-first New Finds intake.
// Keeps the original Movie Radar UX, filters, clickable cards, votes and detail modals.
// Only the discovery source changed: official Hallmark catalog instead of TMDB.

state.discoveryResults = state.discoveryResults || [];
let discoveryLoading = false;
let discoveryLoaded = false;
let discoveryError = '';
let discoveryExpanded = false;
let discoveryHidden = new Set();
let discoveryArtLoading = false;

function discoveryNumericId(value){
  const s=String(value||''); let h=2166136261;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
  return (h>>>0) || 1;
}

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

function discoverySavedMovie(candidate){
  if(!candidate) return null;
  return (state.movies||[]).find(m=>
    Number(m.tmdb_id)===Number(candidate.tmdb_id) &&
    (m.tmdb_type||'movie')===(candidate.tmdb_type||'movie')
  ) || null;
}

function discoveryVoteLabel(value){
  return value==='yes'?'❤️ Yes':value==='maybe'?'🤔 Maybe':value==='no'?'❌ No':'Not voted';
}

function discoverySharedVoteSummary(movie){
  if(!movie) return '<div class="subtle discovery-vote-note">Voting saves this movie to the shared Radar so both of you can weigh in.</div>';
  const rows=(members||[]).map(member=>{
    const name=memberName(member.user_id);
    const value=movie.votes?.[member.user_id];
    return `<span class="pill">${esc(name)}: <strong>${esc(discoveryVoteLabel(value))}</strong></span>`;
  }).join('');
  return `<div class="pills discovery-shared-votes">${rows}</div><div class="subtle discovery-vote-consensus">${esc(consensus(movie))}</div>`;
}

function discoveryVoteControls(candidate,compact=false){
  const saved=discoverySavedMovie(candidate);
  const current=saved?.votes?.[me()];
  const action=(value)=>saved
    ? `vote('${saved.id}','${value}')`
    : `voteDiscoveredMovie(${Number(candidate.tmdb_id)},'${value}')`;
  return `<div class="discovery-watch-choice ${compact?'compact':''}">
    <div class="kicker">Would you watch it?</div>
    <div class="vote-row discovery-vote-row">
      <button class="vote-btn ${current==='yes'?'active-yes':''}" onclick="${action('yes')}">❤️ Yes</button>
      <button class="vote-btn ${current==='maybe'?'active-maybe':''}" onclick="${action('maybe')}">🤔 Maybe</button>
      <button class="vote-btn ${current==='no'?'active-no':''}" onclick="${action('no')}">❌ No</button>
    </div>
    ${discoverySharedVoteSummary(saved)}
  </div>`;
}

async function voteDiscoveredMovie(id,value){
  const candidate=(state.discoveryResults||[]).find(x=>Number(x.tmdb_id)===Number(id));
  if(!candidate||!workspace) return;
  let saved=discoverySavedMovie(candidate);
  if(!saved){
    const estimate=typeof discoveryEstimate==='function'?discoveryEstimate(candidate):{score:0};
    await addDiscoveredMovie(Number(id),false);
    saved=discoverySavedMovie(candidate);
    if(!saved) return;
    if(Number(estimate?.score||0)>0 && Number(saved.cheese_score||0)===0){
      await db.from('movies').update({cheese_score:Math.max(0,Math.min(100,Number(estimate.score||0))),updated_at:new Date().toISOString()}).eq('id',saved.id);
    }
  }
  if(typeof clDiscoveryMovieDetailId!=='undefined') clDiscoveryMovieDetailId=null;
  selectedMovie=saved.id;
  await vote(saved.id,value);
}
window.voteDiscoveredMovie=voteDiscoveredMovie;
window.discoveryVoteControls=discoveryVoteControls;

function discoveryMatchesCurrentView(c){
  const q=(searchText||'').trim().toLowerCase();
  if(q){
    const hay=[c.title,c.summary,c.network,c.holiday,c.season,c.director,...(c.providers||[]),...(c.why||[]),...(c.stars||[])].filter(Boolean).join(' ').toLowerCase();
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
  const providerText=(c.providers||[]).slice(0,3).join(' · ') || c.network || 'Hallmark';
  const date=c.premiere_date||String(c.year||'Date TBA');
  const meta=[c.holiday,c.season].filter(Boolean).join(' · ');
  const why=(c.why||[]).slice(0,6);
  return `<article class="new-find-card card">
    <div class="new-find-poster">${c.poster_url?`<img src="${esc(c.poster_url)}" alt="${esc(c.title)} poster" loading="lazy">`:`<div class="new-find-poster-fallback">CL</div>`}</div>
    <div class="new-find-body">
      <div class="new-find-topline"><span class="kicker">${esc(c.network||'Hallmark')}</span><span class="radar-match">🎯 ${Number(c.match_score||100)} match</span></div>
      <h3>${esc(c.title)}</h3>
      <div class="subtle">${esc(date)}${meta?` · ${esc(meta)}`:''}</div>
      <div class="subtle provider-line">${esc(providerText)}</div>
      ${(c.stars||[]).length?`<div class="subtle"><strong>Starring:</strong> ${esc(c.stars.join(' · '))}</div>`:''}
      <p>${esc(c.summary||'No synopsis yet.')}</p>
      <div class="new-find-score"><strong>Estimated Cheese Rating</strong><span class="cheese-score">🧀 ${est.score}</span></div>
      ${est.traits.length?`<div class="pills">${est.traits.slice(0,5).map(t=>`<span class="pill trait-pill">${esc(t.name)} <b>+${t.points}</b></span>`).join('')}${est.traits.length>5?`<span class="pill">+${est.traits.length-5} more</span>`:''}</div>`:'<div class="subtle">No exact Cheese Traits confidently matched yet.</div>'}
      ${why.length?`<details class="new-find-why"><summary>Why is this on my radar?</summary><div class="pills">${why.map(x=>`<span class="pill">${esc(x)}</span>`).join('')}</div></details>`:''}
      ${discoveryVoteControls(c,true)}
      <div class="new-find-actions">
        <button class="primary" onclick="addDiscoveredMovie(${Number(c.tmdb_id)},true)">${est.traits.length?`Add + confirm ${est.traits.length} traits`:'Add to Radar'}</button>
        ${est.traits.length?`<button class="secondary" onclick="addDiscoveredMovie(${Number(c.tmdb_id)},false)">Add only</button>`:''}
        <button class="secondary" onclick="hideDiscoveredMovie(${Number(c.tmdb_id)})">Hide for now</button>
        <a class="button-link" href="${esc(c.source_url||'#')}" target="_blank" rel="noopener">Hallmark ↗</a>
      </div>
    </div>
  </article>`;
}

function discoveryPanel(){
  const existing=discoveryExistingIds();
  const candidates=(state.discoveryResults||[]).filter(c=>!existing.has(`${c.tmdb_type||'movie'}:${Number(c.tmdb_id)}`) && !discoveryHidden.has(Number(c.tmdb_id)) && discoveryMatchesCurrentView(c));
  const shown=discoveryExpanded?candidates:candidates.slice(0,8);
  const header=`<div class="new-find-header"><div><div class="page-title small-title">New Finds</div><div class="subtle">Cheese Louise reads Hallmark's official catalog directly. Same Movie Radar — better source.</div></div><button class="secondary" onclick="discoverCheeseMovies(true)">↻ Refresh</button></div>`;
  if(discoveryLoading) return `<div class="new-find-panel card card-pad">${header}<div class="discovery-loading"><span class="discovery-spinner">🧀</span> Reading Hallmark's catalog…</div></div>`;
  if(discoveryError) return `<div class="new-find-panel card card-pad">${header}<div class="empty"><strong>Hallmark scan hit a snag.</strong><div class="subtle">${esc(discoveryError)}</div><button class="primary" style="margin-top:10px" onclick="discoverCheeseMovies(true)">Try again</button></div></div>`;
  if(!discoveryLoaded) return `<div class="new-find-panel card card-pad">${header}<button class="primary" onclick="discoverCheeseMovies(true)">🔎 Find Hallmark movies</button></div>`;
  return `<div class="new-find-panel">
    ${header}
    <div class="new-find-stats"><span class="pill">${candidates.length} new candidate${candidates.length===1?'':'s'}</span><span class="subtle">Movie catalog: Hallmark official${discoveryArtLoading?' · fetching verified posters…':''}</span></div>
    <div class="new-find-grid">${shown.map(discoveryCard).join('')||'<div class="empty card card-pad">Nothing new matches these filters right now.</div>'}</div>
    ${candidates.length>8?`<button class="secondary discovery-more" onclick="toggleDiscoveryExpanded()">${discoveryExpanded?'Show fewer':`Show ${candidates.length-8} more`}</button>`:''}
  </div>`;
}

function discoveryMapHallmark(row){
  const key=String(row.catalog_id||`${row.year||''}|${row.title||''}`);
  return {
    ...row,
    tmdb_id:discoveryNumericId(key), // legacy internal key only; no TMDB lookup is performed
    tmdb_type:'hallmark',
    source_type:'hallmark_official',
    network:row.network||'Hallmark Channel',
    providers:row.providers||[],
    source_url:row.official_source_url||row.source_url||null,
    poster_url:null,
    match_score:100,
    why:[row.collection?`Official Hallmark: ${row.collection}`:'Official Hallmark catalog',row.holiday,row.season].filter(Boolean)
  };
}

async function discoveryHydratePosters(force=false){
  if(discoveryArtLoading || !(state.discoveryResults||[]).length) return;
  discoveryArtLoading=true; render();
  try{
    const movies=(state.discoveryResults||[]).map(c=>({catalog_id:c.catalog_id,title:c.title,year:Number(c.year)||null,stars:Array.isArray(c.stars)?c.stars:[],official_source_url:c.official_source_url||c.source_url}));
    const {data,error}=await db.functions.invoke('hallmark-art',{body:{movies,posters_only:true,force:!!force}});
    if(error) throw error;
    const byId=new Map((Array.isArray(data?.results)?data.results:[]).map(x=>[String(x.catalog_id),x]));
    state.discoveryResults=(state.discoveryResults||[]).map(c=>{
      const art=byId.get(String(c.catalog_id)); if(!art) return c;
      return {...c,poster_url:art.poster_url||null,director:art.director||null,hallmark_plus_url:art.hallmark_plus_url||null,source_url:art.detail_url||c.source_url,identity_verified:!!art.identity_verified,art_verified:!!art.art_verified};
    });
  }catch(err){console.warn('Hallmark poster lookup failed',err)}
  finally{discoveryArtLoading=false;render();}
}

async function discoverCheeseMovies(force=false){
  if(discoveryLoading) return;
  if(discoveryLoaded && !force) return;
  discoveryLoading=true; discoveryError=''; render();
  try{
    const {data,error}=await db.functions.invoke('discover-hallmark-movies',{body:{}});
    if(error) throw error;
    if(data?.error) throw new Error(data.error);
    state.discoveryResults=(Array.isArray(data?.results)?data.results:[]).map(discoveryMapHallmark);
    discoveryLoaded=true;
  }catch(err){
    discoveryError=err?.message||String(err);
  }finally{
    discoveryLoading=false; render();
  }
  if(discoveryLoaded) setTimeout(()=>discoveryHydratePosters(force),0);
}

async function addDiscoveredMovie(id,applyTraits){
  const c=(state.discoveryResults||[]).find(x=>Number(x.tmdb_id)===Number(id));
  if(!c||!workspace) return;
  const existing=discoverySavedMovie(c);
  if(existing){ selectedMovie=existing.id; render(); return; }

  const sourceMetadata={
    source_type:'hallmark_official',catalog_id:c.catalog_id||null,collection:c.collection||null,
    official_hallmark_url:c.source_url||c.official_source_url||null,hallmark_plus_url:c.hallmark_plus_url||null,
    stars:Array.isArray(c.stars)?c.stars:[],cast:Array.isArray(c.stars)?c.stars:[],director:c.director||null,
    year:Number(c.year)||null,season:c.season||null,holiday:c.holiday||null,
    identity_verified:!!c.identity_verified,art_verified:!!c.art_verified,
    data_sources:['Hallmark Channel official catalog','Hallmark title metadata']
  };
  const payload={
    workspace_id:workspace.id,title:c.title,network:c.network||'Hallmark Channel',cheese_score:0,status:'needs_review',summary:c.summary||null,
    tags:['Hallmark official catalog',...(c.why||[]).slice(0,6)],source_url:c.source_url||null,poster_url:c.poster_url||null,
    holiday:c.holiday||null,season:c.season||null,providers:c.providers||[],
    tmdb_id:Number(c.tmdb_id),tmdb_type:'hallmark',source_metadata:sourceMetadata,created_by:me()
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

  discoveryHidden.add(Number(id));
  await logActivity(`found and added ${c.title} from Hallmark${suggestions.length?` with ${suggestions.length} confirmed Cheese Traits`:''}.`,'movie',data.id);
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
  if(session && workspace && !discoveryLoaded && !discoveryLoading && !discoveryError){ setTimeout(()=>discoverCheeseMovies(false),0); }
  return html;
};

window.discoverCheeseMovies=discoverCheeseMovies;
window.discoveryHydratePosters=discoveryHydratePosters;
window.addDiscoveredMovie=addDiscoveredMovie;
window.hideDiscoveredMovie=hideDiscoveredMovie;
window.toggleDiscoveryExpanded=toggleDiscoveryExpanded;
