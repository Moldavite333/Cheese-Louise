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
let romantiverseSearchForUs=false;
let romantiverseSearchWarning='';
let romantiverseSearchBroaderLookup=false;
const romantiverseSearchCache=new Map();
const romantiverseTitleSearch=globalThis.clMovieTitleSearch;
let romantiverseSearchController;

function romantiverseWorkspaceMatches(rawQuery){
 const query=romantiverseTitleSearch.parse(rawQuery);
 return (state.movies||[]).map(movie=>({...movie,title_search_score:romantiverseTitleSearch.score(movie,query)}))
  .filter(movie=>movie.title_search_score);
}

function romantiverseSearchCandidate(id){
  return (state.romantiverseSearchResults||[]).find(c=>Number(c.tmdb_id)===Number(id));
}

function romantiverseTitleKey(value){return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function romantiverseExactTitle(c){
 return !romantiverseSearchForUs&&String(searchText||'').trim().length>=2&&romantiverseTitleKey(c?.title)===romantiverseTitleKey(searchText);
}
function romantiverseSavedResult(c){
 const year=c.year||c.source_metadata?.year||String(c.premiere_date||'').slice(0,4);
 return (state.movies||[]).find(m=>{
  const meta=typeof m.source_metadata==='string'?(()=>{try{return JSON.parse(m.source_metadata)}catch{return {}}})():m.source_metadata||{};
  const savedYear=m.year||meta.year||String(m.premiere_date||'').slice(0,4);
  return romantiverseTitleKey(m.title)===romantiverseTitleKey(c.title)&&(!year||!savedYear||Number(year)===Number(savedYear));
 });
}
function romantiverseSearchMatchesFilters(c){
  if(!c) return false;
  if(typeof clMovieIsHorror!=='function'||clMovieIsHorror(c))return false;
  if(romantiverseExactTitle(c))return true;
  if(['saved','mutual','yes'].includes(movieFilters?.mode)) return false;
  if(movieFilters?.status && movieFilters.status!=='needs_review') return false;
  if(!clMatchesSeasonHoliday(c)) return false;
  if(typeof window.clPassesYearFilter==='function'&&!window.clPassesYearFilter(c))return false;
  if(movieFilters?.studio){
    const wanted=clNorm(movieFilters.studio),meta=clClassificationMeta(c);
    const raw=window.clCredits?.get(c)?.production||c.production_companies||meta.production_companies||[];
    const studios=(Array.isArray(raw)?raw:[raw]).map(x=>clNorm(typeof x==='string'?x:x?.name));
    if(!studios.includes(wanted))return false;
  }
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
  if(!romantiverseSearchForUs&&String(searchText||'').trim().length>=2){
    const query=romantiverseTitleSearch.parse(searchText);
    const workspaceMatches=romantiverseWorkspaceMatches(searchText);
    const external=romantiverseSearchLoadedQuery===romantiverseFilterQuery()?(state.romantiverseSearchResults||[]):[];
    const combined=new Map(workspaceMatches.map(movie=>['workspace:'+movie.id,movie]));
    for(const candidate of external){
      const score=candidate.title_search_score??romantiverseTitleSearch.score(candidate,query);
      const saved=romantiverseSearchLinkedMovie(candidate);
      const key=saved?'workspace:'+saved.id:(candidate.tmdb_type||'movie')+':'+candidate.tmdb_id;
      if(!combined.has(key))combined.set(key,{...(saved||candidate),title_search_score:score});
      if(saved&&combined.has(key)&&!romantiverseTitleSearch.metadata(saved).availability?.length){
        const availability=romantiverseTitleSearch.metadata(candidate).availability;
        if(availability?.length)combined.set(key,{...combined.get(key),source_metadata:{...romantiverseTitleSearch.metadata(saved),availability}});
      }
    }
    return [...combined.values()].sort((a,b)=>romantiverseTitleSearch.compare(a,b,query)).slice(0,120);
  }
  const existing=typeof discoveryExistingIds==='function' ? discoveryExistingIds() : new Set();
  const pool=[...(state.romantiverseSearchResults||[])];
  for(const m of state.movies||[])if(romantiverseExactTitle(m)&&!pool.some(c=>romantiverseSavedResult(c)?.id===m.id))pool.push(m);
  const results=pool.filter(c=>!clMovieIsHorror(c)&&(romantiverseExactTitle(c)||(
    !existing.has((c.tmdb_type||'movie')+':'+Number(c.tmdb_id)) &&
    !(typeof discoveryHidden!=='undefined' && discoveryHidden.has(Number(c.tmdb_id))) &&
    romantiverseSearchMatchesFilters(c)
  )));
  // Exact-title matches must never be buried below taste-ranked suggestions.
  const ranked=typeof clTasteRank==='function'?clTasteRank(results):results;
  return ranked.slice().sort((a,b)=>Number(romantiverseExactTitle(b))-Number(romantiverseExactTitle(a)));
}

function romantiverseSearchLinkedMovie(candidate){
 const byId=discoverySavedMovie(candidate);
 if(byId)return byId;
 const title=romantiverseTitleSearch.normalize(candidate.title),year=romantiverseTitleSearch.year(candidate);
 if(!year)return null;
 const providerId=movie=>(movie.tmdb_type||'movie')==='movie'?Number(movie.tmdb_id):Number(romantiverseTitleSearch.metadata(movie).poster_tmdb_id);
 const candidates=(state.movies||[]).filter(movie=>{
  if(romantiverseTitleSearch.normalize(movie.title)!==title||romantiverseTitleSearch.year(movie)!==year)return false;
  const savedId=providerId(movie),sourceId=providerId(candidate);
  if(savedId&&sourceId)return savedId===sourceId;
  return !movie.tmdb_id||movie.tmdb_type!==candidate.tmdb_type||Number(movie.tmdb_id)===Number(candidate.tmdb_id);
 });
 return candidates.length===1?candidates[0]:null;
}

function romantiverseTitleCard(movie){
 const cast=romantiverseTitleSearch.cast(movie).slice(0,4);
 const availability=romantiverseTitleSearch.metadata(movie).availability;
 const watch=Array.isArray(availability)?availability.slice(0,2).filter(option=>option?.verified&&option.provider):[];
 const saved=!!movie.id;
 const votes=Object.values(movie.votes||{});
 const release=romantiverseTitleSearch.release(movie);
 const status=(saved?[
  romantiverseTitleSearch.recorded(movie,state.episodes)?'Recorded':null,
  votes.filter(v=>v==='no').length>=2?'Both No':null,
  votes.filter(v=>v==='yes').length>=2?'Both Yes':null,
  Object.values(movie.bookmarks||{}).some(Boolean)||movie.status==='saved'?'Saved':null,
  release==='today'?'Premieres today':release==='upcoming'?'Upcoming':null,
  romantiverseTitleSearch.metadata(movie).source_type==='manual'?'Manual entry':null
 ]:[movie.source_type==='tmdb_exact_title'?'TMDB · exact title':movie.source_type==='tmdb_title_lookup'?'TMDB · possible match':'Romantiverse Bingo catalog',
   movie.title_search_score<100?'Related result':null]).filter(Boolean);
 return `<article class="new-find-card card">
  <div class="new-find-poster">${movie.poster_url?`<img src="${esc(movie.poster_url)}" alt="" loading="lazy">`:'<div class="new-find-poster-fallback">CL</div>'}</div>
  <div class="new-find-body"><h3>${esc(movie.title)}</h3>
   <div class="subtle">${[romantiverseTitleSearch.year(movie),movie.network].filter(Boolean).map(esc).join(' · ')}</div>
   ${status.length?`<div class="subtle">${status.map(esc).join(' · ')}</div>`:''}
   ${cast.length?`<div class="subtle">${cast.map(esc).join(' · ')}</div>`:''}
   ${watch.map(option=>`<div class="subtle">${[option.provider,option.access_type,option.market,option.available_from?'from '+option.available_from:''].filter(Boolean).map(esc).join(' · ')}</div>`).join('')}
   ${movie.summary?`<p>${esc(movie.summary)}</p>`:''}
   ${saved?`<button class="primary" onclick="openMovie('${esc(movie.id)}')">Open movie</button>`:
    `<button class="primary" onclick="addRomantiverseSearchMovie(${Number(movie.tmdb_id)},false)">Add and open</button>`}
  </div></article>`;
}

function romantiverseSearchCard(c){
  const saved=romantiverseExactTitle(c)&&romantiverseSavedResult(c);
  if(saved&&typeof movieCard==='function')return movieCard(saved);
  let html=discoveryCard(c);
  const reasons=(c.search_reasons||[]).slice(0,4);
  if(typeof clTasteMatch==='function') reasons.unshift(...clTasteMatch(c).reasons.map(reason=>'Your taste: '+reason));
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


function romantiverseFilterQuery(rawQuery=searchText){
 const typed=String(rawQuery||'').trim().slice(0,100);
 if(typed)return typed;
 if(movieFilters?.holiday&&movieFilters.holiday!=='__unknown__'){
  const holiday=clCanonicalHoliday(movieFilters.holiday);
  return ({"Valentine's Day":'valentine',"New Year's":'new year',"St. Patrick's Day":'saint patrick',"Mother's Day":'mothers day',"Father's Day":'fathers day','Fourth of July':'fourth of july'})[holiday]|| (holiday==='Other'?'':holiday.toLowerCase());
 }
 if(movieFilters?.season&&movieFilters.season!=='__unknown__'){
  return ({Winter:'winter',Spring:'spring',Summer:'summer',Fall:'autumn'})[clCanonicalSeason(movieFilters.season)]||'';
 }
 return '';
}
window.romantiverseFilterQuery=romantiverseFilterQuery;

function romantiverseSearchPanel(){
  const taste=typeof clTastePanel==='function'?clTastePanel():'';
  const q=romantiverseFilterQuery();
  if(!romantiverseSearchForUs&&String(searchText||'').trim().length>=2){
    const visible=romantiverseSearchVisibleResults();
    const loaded=romantiverseSearchLoadedQuery===q;
    const busy=romantiverseSearchLoading||!loaded;
    const query=romantiverseTitleSearch.parse(q);
    const manual=!busy&&query.key.length>=2&&!visible.some(movie=>romantiverseTitleSearch.confident(movie,query));
    const status=busy?'Searching movie titles…':romantiverseSearchError||romantiverseSearchWarning||
      (visible.length?'':'No movies match this search.');
    return `<section class="rom-search-panel" aria-label="Movie search results">
      <div class="rom-search-head"><h2>Results for “${esc(q)}”</h2>
      ${!busy&&(romantiverseSearchError||romantiverseSearchWarning)?'<button class="secondary" onclick="runRomantiverseSearch(searchText,true,false,romantiverseSearchBroaderLookup)">Retry</button>':''}</div>
      <div role="status" class="subtle">${esc(status)}</div>
      <div class="new-find-grid">${visible.map(romantiverseTitleCard).join('')}</div>
      ${manual?'<button class="secondary" onclick="runRomantiverseSearch(searchText,true,false,true)">Look up on TMDB</button> <button class="secondary" onclick="addMovie(searchText)">Add a movie manually</button>':''}
    </section>`;
  }
  if(q.length<2&&!romantiverseSearchForUs){
    return taste+'<div class="rom-search-idle card card-pad"><div class="kicker">Romantiverse Search</div><strong>Search by idea, not just title.</strong><div class="subtle">Try cats, bakery, widow, tree farm, royal, small town, veterinarian… Choose a season or holiday to search for more titles, or type a movie title or idea. “Not classified” only filters records already loaded; it does not guess unknown classifications.</div></div>';
  }

  const label=romantiverseSearchForUs?'Your shared taste':q;
  const loaded=romantiverseSearchLoadedQuery===(romantiverseSearchForUs?'__taste__':q);
  const visible=loaded?romantiverseSearchVisibleResults():[];

  if(romantiverseSearchLoading){
    return taste+'<div class="rom-search-panel card card-pad"><div class="rom-search-head"><div><div class="kicker">Searching the Romantiverse</div><strong>“'+esc(label)+'”</strong></div><span class="discovery-spinner">🧀</span></div><div class="subtle">Searching the shared Romantiverse Bingo movie catalog…</div></div>';
  }

  if(romantiverseSearchError && loaded){
    return taste+'<div class="rom-search-panel card card-pad"><div class="kicker">Romantiverse Search</div><strong>Search hit a snag.</strong><div class="subtle">'+esc(romantiverseSearchError)+'</div><button class="secondary" style="margin-top:10px" onclick="runRomantiverseSearch(searchText,true,romantiverseSearchForUs)">Try again</button></div>';
  }

  if(!loaded){
    return taste+'<div class="rom-search-panel card card-pad"><div class="kicker">Romantiverse Search</div><strong>Getting “'+esc(label)+'” ready…</strong></div>';
  }

  const terms=romantiverseSearchExpandedTerms.slice(0,8);
  return taste+'<div class="rom-search-panel">'+
    '<div class="rom-search-head"><div><div class="kicker">Romantiverse Search</div><div class="page-title small-title">Results for “'+esc(label)+'”</div><div class="subtle">Exact titles are shown first. Filters apply to other catalog matches.</div></div><button class="secondary" onclick="runRomantiverseSearch(searchText,true,romantiverseSearchForUs)">↻ Search again</button></div>'+
    (romantiverseSearchWarning?'<p role="status" class="subtle">'+esc(romantiverseSearchWarning)+'</p>':'')+
    (terms.length?'<div class="rom-search-expansion"><span class="subtle">Also looking for:</span><div class="pills">'+terms.map(t=>'<span class="pill">'+esc(t)+'</span>').join('')+'</div></div>':'')+
    '<div class="results-line"><strong>'+visible.length+'</strong> external match'+(visible.length===1?'':'es')+' from '+state.romantiverseSearchResults.length+' unique finds after filters, hidden titles and saved movies</div>'+
    '<div class="new-find-grid">'+(visible.map(romantiverseSearchCard).join('')||'<div class="empty card card-pad">No external matches survive the current filters. Clear a filter or try a broader idea.</div>')+'</div>'+
    '<div class="subtle rom-search-attribution">Search sources: your saved movies, the Bingo catalog, and exact-title TMDB lookup. Recommendations are unchanged.</div>'+
  '</div>';
}

function refreshRomantiverseSearchPanel(){
  const host=document.getElementById('romantiverseSearchHost');
  if(host) host.innerHTML=romantiverseSearchPanel();
  const browse=document.getElementById('radarBrowseResults');
  if(browse)browse.hidden=String(searchText||'').trim().length>=2;
}

async function runRomantiverseSearch(rawQuery,force=false,forUs=false,broaderLookup=false){
 clearTimeout(romantiverseSearchTimer);
 romantiverseSearchController?.abort();
 const controller=new AbortController();
 romantiverseSearchController=controller;
 const query=romantiverseFilterQuery(rawQuery),seq=++romantiverseSearchSequence;
 const direct=!forUs&&String(rawQuery||'').trim().length>=2;
 romantiverseSearchBroaderLookup=direct&&broaderLookup;
 romantiverseSearchForUs=forUs;romantiverseSearchWarning='';
 const loadedQuery=forUs?'__taste__':query;
 if(query.length<2&&!forUs){romantiverseSearchLoading=false;romantiverseSearchError='';romantiverseSearchLoadedQuery='';romantiverseSearchExpandedTerms=[];state.romantiverseSearchResults=[];refreshRomantiverseSearchPanel();return;}
 if(romantiverseSearchLoadedQuery!==loadedQuery)state.romantiverseSearchResults=[];
 romantiverseSearchLoading=true;romantiverseSearchError='';romantiverseSearchLoadedQuery=loadedQuery;refreshRomantiverseSearchPanel();
 try{
  const filters={holiday:movieFilters.holiday,season:movieFilters.season,studio:movieFilters.studio,yearMin:movieFilters.yearMin,yearMax:movieFilters.yearMax};
  const parsed=romantiverseTitleSearch.parse(query);
  const workspaceExact=direct&&romantiverseWorkspaceMatches(query).some(movie=>romantiverseTitleSearch.confident(movie,parsed));
  const {data,error}=await db.functions.invoke(forUs?'recommend-romantiverse':'search-romantiverse',{signal:controller.signal,body:{query:forUs?'':query,filters:direct?{}:filters,max_results:120,include_broader:true,title_search:direct,workspace_exact:workspaceExact,lookup_exact:direct&&broaderLookup,broader_lookup:direct&&broaderLookup,...(forUs&&typeof clRecPreferences==='function'?clRecPreferences():{})}});
  if(seq!==romantiverseSearchSequence)return;
  if(error||data?.error)throw Error(data?.error||error?.message||'The Cheese Louise movie catalog could not load.');
  if(!Array.isArray(data?.results))throw Error('The movie catalog returned an incomplete response.');
  state.romantiverseSearchResults=data.results.filter(c=>(c.source_type==='bingo_catalog'||
   (direct&&c.source_type==='tmdb_exact_title'&&c.exact_title_match===true&&romantiverseTitleSearch.normalize(c.title)===parsed.key)||
   (direct&&broaderLookup&&c.source_type==='tmdb_title_lookup'&&romantiverseTitleSearch.score(c,parsed)>=200))&&!clMovieIsHorror(c));
  romantiverseSearchExpandedTerms=data.expanded_terms||[];
  romantiverseSearchWarning=[data.catalog_stale?'The shared catalog could not refresh. Showing available catalog and workspace results.':'',data.exact_lookup_warning].filter(Boolean).join(' ');
 }catch(error){if(seq!==romantiverseSearchSequence)return;state.romantiverseSearchResults=[];romantiverseSearchExpandedTerms=[];romantiverseSearchError=error.message||String(error);}
 finally{if(seq===romantiverseSearchSequence){romantiverseSearchLoading=false;refreshRomantiverseSearchPanel();}}
}
function scheduleRomantiverseSearch(value){
  clearTimeout(romantiverseSearchTimer);
  romantiverseSearchController?.abort();
  romantiverseSearchSequence++;
  const q=romantiverseFilterQuery(value);
  if(q.length<2){
    runRomantiverseSearch('');
    return;
  }
  romantiverseSearchForUs=false;
  refreshRomantiverseSearchPanel();
  romantiverseSearchTimer=setTimeout(()=>runRomantiverseSearch(value,false),250);
}

function ensureRomantiverseCandidateInDiscovery(id){
  const c=romantiverseSearchCandidate(id);
  if(!c) return null;
  if(typeof clMovieIsHorror!=='function'||clMovieIsHorror(c))return null;
  const rest=(state.discoveryResults||[]).filter(x=>Number(x.tmdb_id)!==Number(id));
  state.discoveryResults=[c,...rest];
  return c;
}

async function addRomantiverseSearchMovie(id,applyTraits){
  const candidate=romantiverseSearchCandidate(id);
  if(!candidate||clMovieIsHorror(candidate))return;
  const saved=romantiverseSearchLinkedMovie(candidate);
  if(saved){openMovie(saved.id);return;}
  await persistDiscoveredMovie(Number(id),!!applyTraits,candidate);
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
  const marker='<div id="radarBrowseResults"';
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

// Selecting a classification now searches beyond the already-loaded catalog.
for(const name of ['setHolidayFilter','setSeasonFilter']){
 const previous=window[name];
 window[name]=function(value){const result=previous?.(value);scheduleRomantiverseSearch(searchText);return result};
}

