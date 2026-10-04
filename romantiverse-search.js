// Cheese Louise v1.19 — Romantiverse concept search.
// Turns the global search box into an on-demand TMDB concept/keyword search while
// keeping the existing Movie Radar filters as the narrowing layer.

state.romantiverseSearchResults = state.romantiverseSearchResults || [];

let romantiverseSearchLoading=false;
let romantiverseSearchError='';
let romantiverseSearchLoadedQuery='';
let romantiverseSearchExpandedTerms=[];
let romantiverseSearchTimer=null;
let romantiverseSearchSequence=0;
const romantiverseSearchCache=new Map();

function romantiverseSearchCandidate(id){
  return (state.romantiverseSearchResults||[]).find(c=>Number(c.tmdb_id)===Number(id));
}

function romantiverseSearchMatchesFilters(c){
  if(!c) return false;
  if(movieFilters?.mode==='saved' || movieFilters?.mode==='mutual') return false;
  if(movieFilters?.status && movieFilters.status!=='needs_review') return false;
  if(movieFilters?.holiday && clNorm(c.holiday)!==clNorm(movieFilters.holiday)) return false;
  if(movieFilters?.season && clNorm(c.season)!==clNorm(movieFilters.season)) return false;
  if(typeof v16MatchesNetwork==='function' && !v16MatchesNetwork(c)) return false;
  if(typeof v16MatchesRelease==='function' && !v16MatchesRelease(c)) return false;

  const estimate=typeof discoveryEstimate==='function' ? discoveryEstimate(c) : {score:0,traits:[]};
  if(Number(movieFilters?.minScore||0)>Number(estimate.score||0)) return false;

  if((movieFilters?.traitIds||[]).length){
    const ids=new Set((estimate.traits||[]).map(t=>t.id));
    if(!movieFilters.traitIds.every(id=>ids.has(id))) return false;
  }
  if((movieFilters?.traitCategories||[]).length){
    const categories=new Set((estimate.traits||[]).map(t=>t.category));
    if(!movieFilters.traitCategories.every(category=>categories.has(category))) return false;
  }
  return true;
}

function romantiverseSearchVisibleResults(){
  const existing=typeof discoveryExistingIds==='function' ? discoveryExistingIds() : new Set();
  return (state.romantiverseSearchResults||[]).filter(c=>
    !existing.has((c.tmdb_type||'movie')+':'+Number(c.tmdb_id)) &&
    !(typeof discoveryHidden!=='undefined' && discoveryHidden.has(Number(c.tmdb_id))) &&
    romantiverseSearchMatchesFilters(c)
  );
}

function romantiverseSearchCard(c){
  let html=discoveryCard(c);
  const reasons=(c.search_reasons||[]).slice(0,4);
  const reasonHtml='<div class="rom-search-why"><strong>Why it matched</strong>'+
    (reasons.length
      ? '<div class="pills">'+reasons.map(r=>'<span class="pill rom-search-reason">'+esc(r)+'</span>').join('')+'</div>'
      : '<div class="subtle">TMDB title/keyword/concept match</div>')+
    '</div>';

  html=html.replace('<div class="new-find-score">',reasonHtml+'<div class="new-find-score">');

  const id=Number(c.tmdb_id);
  html=html
    .replaceAll('addDiscoveredMovie('+id+',true)','addRomantiverseSearchMovie('+id+',true)')
    .replaceAll('addDiscoveredMovie('+id+',false)','addRomantiverseSearchMovie('+id+',false)')
    .replaceAll('voteDiscoveredMovie('+id+',','voteRomantiverseSearchMovie('+id+',')
    .replaceAll('hideDiscoveredMovie('+id+')','hideRomantiverseSearchMovie('+id+')');
  return html;
}

function romantiverseSearchPanel(){
  const q=(searchText||'').trim();
  if(q.length<2){
    return '<div class="rom-search-idle card card-pad"><div class="kicker">Romantiverse Search</div><strong>Search by idea, not just title.</strong><div class="subtle">Try cats, bakery, widow, tree farm, royal, small town, veterinarian… Your normal Radar filters still narrow the results.</div></div>';
  }

  const loaded=romantiverseSearchLoadedQuery===q;
  const visible=loaded?romantiverseSearchVisibleResults():[];

  if(romantiverseSearchLoading){
    return '<div class="rom-search-panel card card-pad"><div class="rom-search-head"><div><div class="kicker">Searching the Romantiverse</div><strong>“'+esc(q)+'”</strong></div><span class="discovery-spinner">🧀</span></div><div class="subtle">Checking TMDB titles, synopses, keywords and related concepts…</div></div>';
  }

  if(romantiverseSearchError && loaded){
    return '<div class="rom-search-panel card card-pad"><div class="kicker">Romantiverse Search</div><strong>Search hit a snag.</strong><div class="subtle">'+esc(romantiverseSearchError)+'</div><button class="secondary" style="margin-top:10px" onclick="runRomantiverseSearch(searchText,true)">Try again</button></div>';
  }

  if(!loaded){
    return '<div class="rom-search-panel card card-pad"><div class="kicker">Romantiverse Search</div><strong>Getting “'+esc(q)+'” ready…</strong></div>';
  }

  const terms=romantiverseSearchExpandedTerms.slice(0,8);
  return '<div class="rom-search-panel">'+
    '<div class="rom-search-head"><div><div class="kicker">Romantiverse Search</div><div class="page-title small-title">Results for “'+esc(q)+'”</div><div class="subtle">Concept search across TMDB metadata. Existing Radar filters are applied below.</div></div><button class="secondary" onclick="runRomantiverseSearch(searchText,true)">↻ Search again</button></div>'+
    (terms.length?'<div class="rom-search-expansion"><span class="subtle">Also looking for:</span><div class="pills">'+terms.map(t=>'<span class="pill">'+esc(t)+'</span>').join('')+'</div></div>':'')+
    '<div class="results-line"><strong>'+visible.length+'</strong> external match'+(visible.length===1?'':'es')+' after your current filters</div>'+
    '<div class="new-find-grid">'+(visible.map(romantiverseSearchCard).join('')||'<div class="empty card card-pad">No external matches survive the current filters. Clear a filter or try a broader idea.</div>')+'</div>'+
    '<div class="subtle rom-search-attribution">Search source: TMDB · streaming availability: JustWatch via TMDB · Cheese Louise expands related concepts before ranking.</div>'+
  '</div>';
}

function refreshRomantiverseSearchPanel(){
  const host=document.getElementById('romantiverseSearchHost');
  if(host) host.innerHTML=romantiverseSearchPanel();
}

async function runRomantiverseSearch(rawQuery,force=false){
  const query=String(rawQuery||'').trim();
  if(query.length<2){
    romantiverseSearchSequence++;
    romantiverseSearchLoading=false;
    romantiverseSearchError='';
    romantiverseSearchLoadedQuery='';
    romantiverseSearchExpandedTerms=[];
    state.romantiverseSearchResults=[];
    refreshRomantiverseSearchPanel();
    return;
  }

  const cacheKey=query.toLowerCase();
  if(!force && romantiverseSearchCache.has(cacheKey)){
    const cached=romantiverseSearchCache.get(cacheKey);
    state.romantiverseSearchResults=cached.results||[];
    romantiverseSearchExpandedTerms=cached.expanded_terms||[];
    romantiverseSearchLoadedQuery=query;
    romantiverseSearchError='';
    romantiverseSearchLoading=false;
    refreshRomantiverseSearchPanel();
    return;
  }

  const seq=++romantiverseSearchSequence;
  romantiverseSearchLoading=true;
  romantiverseSearchError='';
  romantiverseSearchLoadedQuery=query;
  refreshRomantiverseSearchPanel();

  try{
    const {data,error}=await db.functions.invoke('search-romantiverse',{body:{query,max_results:30}});
    if(seq!==romantiverseSearchSequence) return;
    if(error) throw error;
    if(data?.error) throw new Error(data.error);
    const payload={
      results:Array.isArray(data?.results)?data.results:[],
      expanded_terms:Array.isArray(data?.expanded_terms)?data.expanded_terms:[],
      cached_at:Date.now()
    };
    romantiverseSearchCache.set(cacheKey,payload);
    state.romantiverseSearchResults=payload.results;
    romantiverseSearchExpandedTerms=payload.expanded_terms;
    romantiverseSearchLoadedQuery=query;
  }catch(err){
    if(seq!==romantiverseSearchSequence) return;
    state.romantiverseSearchResults=[];
    romantiverseSearchExpandedTerms=[];
    romantiverseSearchError=err?.message||String(err);
    romantiverseSearchLoadedQuery=query;
  }finally{
    if(seq===romantiverseSearchSequence){
      romantiverseSearchLoading=false;
      refreshRomantiverseSearchPanel();
    }
  }
}

function scheduleRomantiverseSearch(value){
  clearTimeout(romantiverseSearchTimer);
  const q=String(value||'').trim();
  if(q.length<2){
    runRomantiverseSearch('');
    return;
  }
  romantiverseSearchTimer=setTimeout(()=>runRomantiverseSearch(q,false),450);
}

function ensureRomantiverseCandidateInDiscovery(id){
  const c=romantiverseSearchCandidate(id);
  if(!c) return null;
  const rest=(state.discoveryResults||[]).filter(x=>Number(x.tmdb_id)!==Number(id));
  state.discoveryResults=[c,...rest];
  return c;
}

async function addRomantiverseSearchMovie(id,applyTraits){
  if(!ensureRomantiverseCandidateInDiscovery(id)) return;
  await addDiscoveredMovie(Number(id),!!applyTraits);
}

async function voteRomantiverseSearchMovie(id,value){
  if(!ensureRomantiverseCandidateInDiscovery(id)) return;
  await voteDiscoveredMovie(Number(id),value);
}

function hideRomantiverseSearchMovie(id){
  if(typeof discoveryHidden!=='undefined') discoveryHidden.add(Number(id));
  refreshRomantiverseSearchPanel();
}

const romantiverseSearchOriginalMovies=movies;
movies=function(){
  let html=romantiverseSearchOriginalMovies();
  const host='<div id="romantiverseSearchHost" class="rom-search-host">'+romantiverseSearchPanel()+'</div>';
  const marker='<div id="newFindMatchLine"';
  const at=html.indexOf(marker);
  if(at>=0) html=html.slice(0,at)+host+html.slice(at);
  else html=host+html;
  return html;
};

if(typeof sharedRadarRefreshResults==='function'){
  const romantiverseSearchOriginalRefresh=sharedRadarRefreshResults;
  sharedRadarRefreshResults=function(){
    romantiverseSearchOriginalRefresh();
    refreshRomantiverseSearchPanel();
  };
  window.sharedRadarRefreshResults=sharedRadarRefreshResults;
}

const romantiverseSearchOriginalSetSearch=window.setSearch;
window.setSearch=(value)=>{
  romantiverseSearchOriginalSetSearch(value);
  scheduleRomantiverseSearch(value);
};

const romantiverseSearchOriginalTopbar=topbar;
topbar=function(){
  return romantiverseSearchOriginalTopbar()
    .replace('placeholder="Search movies, notes, ideas…"', 'placeholder="Search the Romantiverse — cats, bakery, widow…"');
};

window.runRomantiverseSearch=runRomantiverseSearch;
window.addRomantiverseSearchMovie=addRomantiverseSearchMovie;
window.voteRomantiverseSearchMovie=voteRomantiverseSearchMovie;
window.hideRomantiverseSearchMovie=hideRomantiverseSearchMovie;
