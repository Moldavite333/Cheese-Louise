// Movie-based recommendations and workspace-scoped discovery history.
let clRecommendationMeta=null;
let clRecommendationSequence=0;
const clRecMemoryHistory=new Map();
function clRecMeta(movie){let meta=movie?.source_metadata||{};if(typeof meta==='string'){try{meta=JSON.parse(meta)}catch{meta={}}}return meta;}
function clRecNorm(title){return String(title||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/^(a|an|the) /,'');}
function clRecYear(movie){
 const meta=clRecMeta(movie);
 const values=[typeof clReleaseYear==='function'?clReleaseYear(movie):null,movie?.year,movie?.release_date,movie?.premiere_date,meta.year,meta.release_date,meta.premiere_date];
 for(const value of values){const match=String(value??'').match(/^(?:19|20)\d{2}/);if(match)return Number(match[0]);}
 return null;
}
function clRecIdentity(movie){const title=clRecNorm(movie?.title),year=clRecYear(movie);return title&&year?title+'|'+year:null;}
function clRecExclusions(movies,history){
 const titleYears=new Set(history.title_years||[]),unknownTitles=new Set(history.unknown_titles||[]);
 for(const movie of movies){const key=clRecIdentity(movie);if(key)titleYears.add(key);else if(clRecNorm(movie.title))unknownTitles.add(clRecNorm(movie.title));}
 return {titleYears,unknownTitles};
}
function clRecExcluded(movie,excluded){
 const title=clRecNorm(movie?.title),key=clRecIdentity(movie);
 return excluded.unknownTitles.has(title)||(key?excluded.titleYears.has(key):[...excluded.titleYears].some(value=>value.startsWith(title+'|')));
}
function clRecStorageKey(){return 'cheeseLouise:recommendations:v2:'+(workspace?.id||'local');}
function clRecHistory(){const key=clRecStorageKey();if(clRecMemoryHistory.has(key))return clRecMemoryHistory.get(key);try{const value=JSON.parse(localStorage.getItem(key)||'{}');return {ids:Array.isArray(value.ids)?value.ids:[],titles:Array.isArray(value.titles)?value.titles:[],title_years:Array.isArray(value.title_years)?value.title_years:[],unknown_titles:Array.isArray(value.unknown_titles)?value.unknown_titles:[],batch:Number(value.batch)||0};}catch{return {ids:[],titles:[],batch:0};}}
function clRecPreferences(){
 const movies=state.movies||[],pref=m=>({title:m.title,year:clRecYear(m),weight:Object.values(m.votes||{}).filter(v=>v==='yes').length>=2?1.5:1});
 return {likes:movies.filter(m=>Object.values(m.votes||{}).includes('yes')&&!Object.values(m.votes||{}).includes('no')).map(pref),
  dislikes:movies.filter(m=>Object.values(m.votes||{}).includes('no')||m.status==='passed').map(pref)};
}
function clRecKnownIds(){return (state.movies||[]).map(m=>{
 const meta=clRecMeta(m);return Number(meta.poster_tmdb_id||(/^tmdb_/.test(meta.source_type||'')?m.tmdb_id:0));
}).filter(Boolean);}
discoverCheeseMovies=async function(force=false){
 if(!workspace||!session||discoveryLoading||(!force&&discoveryLoaded))return;
 const sequence=++clRecommendationSequence,workspaceId=workspace.id;
 const history=clRecHistory(),prefs=clRecPreferences(),exclusions=clRecExclusions(state.movies||[],history);
 discoveryLoading=true;discoveryError='';render();
 try{
  const {data,error}=await db.functions.invoke('recommend-romantiverse',{body:{...prefs,max_results:24,batch:history.batch,
   exclude_ids:[...new Set([...history.ids,...clRecKnownIds(),...discoveryHidden])].slice(-2000),
   exclude_title_years:[...exclusions.titleYears].slice(-2000),
   exclude_unknown_titles:[...exclusions.unknownTitles].slice(-2000),
   filters:{holiday:movieFilters.holiday,season:movieFilters.season,studio:movieFilters.studio,yearMin:movieFilters.yearMin,yearMax:movieFilters.yearMax}}});
  if(sequence!==clRecommendationSequence||workspace?.id!==workspaceId)return;
  if(error)throw error;if(data?.error)throw new Error(data.error);
  if(!Array.isArray(data?.results))throw new Error('Movie recommendations returned an incomplete response.');
  const seen=new Set([...history.ids,...clRecKnownIds()].map(Number));
  state.discoveryResults=data.results.filter(m=>!clMovieIsHorror(m)&&!clRecExcluded(m,exclusions)&&!seen.has(Number(m.tmdb_id)));
  clRecommendationMeta=data;discoveryLoaded=true;
  const next={ids:[...new Set([...history.ids,...state.discoveryResults.map(m=>Number(m.tmdb_id))])].slice(-2000),
   titles:[...new Set([...history.titles,...state.discoveryResults.map(m=>m.title)])].slice(-2000),
   title_years:[...new Set([...(history.title_years||[]),...state.discoveryResults.map(clRecIdentity).filter(Boolean)])].slice(-2000),
   unknown_titles:[...new Set([...(history.unknown_titles||[]),...state.discoveryResults.filter(m=>!clRecIdentity(m)).map(m=>clRecNorm(m.title)).filter(Boolean)])].slice(-2000),
   batch:(history.batch+1)%10000};
  clRecMemoryHistory.set(clRecStorageKey(),next);
  try{localStorage.setItem(clRecStorageKey(),JSON.stringify(next));}catch{clRecommendationMeta.history_warning='This browser could not save discovery history; repeat prevention will last only while this page stays open.';}
 }catch(error){if(sequence===clRecommendationSequence)discoveryError=error?.message||String(error);}
 finally{if(sequence===clRecommendationSequence){discoveryLoading=false;render();}}
};
window.discoverCheeseMovies=discoverCheeseMovies;
window.clFindForUs=()=>{
 movieFilters.mode='all';
 searchText='';const input=document.getElementById('globalSearch');if(input)input.value='';
 clearTimeout(romantiverseSearchTimer);runRomantiverseSearch('');discoverCheeseMovies(true);
};
window.clBroadenFinder=()=>{
 window.clearMovieFilters();clearTimeout(romantiverseSearchTimer);
 if(searchText.trim())runRomantiverseSearch(searchText,true);else discoverCheeseMovies(true);
};
window.clRecStartOver=()=>{clRecMemoryHistory.delete(clRecStorageKey());try{localStorage.removeItem(clRecStorageKey());}catch{}discoverCheeseMovies(true);};
discoveryPanel=function(){
 const title='<div class="new-find-header"><div><div class="page-title small-title">Picked for your taste</div><div class="subtle">Quirky, magical romances based on your favorite movies. Fresh picks skip earlier batches on this browser.</div></div><button class="secondary" onclick="clFindForUs()" '+(discoveryLoading?'disabled':'')+'>Find fresh picks</button></div>';
 if(discoveryLoading)return '<div class="new-find-panel card card-pad">'+title+'<div class="discovery-loading"><span class="discovery-spinner">♥</span> Matching your favorites and finding a fresh batch with posters…</div></div>';
 if(discoveryError)return '<div class="new-find-panel card card-pad">'+title+'<div class="empty" role="status">'+esc(discoveryError)+'<p><button class="secondary" onclick="discoverCheeseMovies(true)">Try again</button></p></div></div>';
 if(!discoveryLoaded)return '<div class="new-find-panel card card-pad">'+title+'<button class="primary" onclick="discoverCheeseMovies(true)">Find movies for us</button></div>';
 let rows=(state.discoveryResults||[]).filter(c=>!discoverySavedMovie(c)&&!discoveryHidden.has(Number(c.tmdb_id))&&discoveryMatchesCurrentView(c));
 if(clTasteSort==='newest')rows=rows.slice().sort((a,b)=>String(b.premiere_date||'').localeCompare(String(a.premiere_date||'')));
 else if(clTasteSort==='relevance')rows=rows.slice().sort((a,b)=>Number(b.recommendation_score||0)-Number(a.recommendation_score||0));
 const meta=clRecommendationMeta||{},matched=meta.matched_favorites||[],unmatched=meta.unmatched_favorites||[];
 return '<div class="new-find-panel">'+title+'<div class="new-find-stats"><span class="pill">'+rows.length+' fresh picks after filters</span><span class="subtle">'+matched.length+' favorite movie records matched</span></div>'+
  (meta.partial?'<p class="subtle">Some movie sources did not respond. Showing the searches that completed.</p>':'')+
  (meta.history_warning?'<p class="subtle" role="status">'+esc(meta.history_warning)+'</p>':'')+
  '<details><summary>Which favorites shaped this batch?</summary><p class="subtle">'+matched.map(m=>esc(m.title)+' ('+Number(m.year)+')').join(' · ')+(unmatched.length?'<br>Could not confidently match: '+unmatched.map(esc).join(' · '):'')+'</p></details>'+
  '<div class="new-find-grid">'+(rows.map(discoveryCard).join('')||'<div class="empty card card-pad">No unseen picks match the current filters. Clear a filter or find another fresh batch.<p><button class="secondary" onclick="clBroadenFinder()">Clear filters & find fresh picks</button></p><button class="secondary" onclick="clRecStartOver()">Include previously shown movies</button></div>')+'</div>'+
  '<div class="subtle">Movie data: TMDB · availability: JustWatch via TMDB. Matching explains metadata similarities; it does not verify scenes.</div></div>';
};
const clRecOriginalSort=window.clSetTasteSort;
window.clSetTasteSort=value=>{clRecOriginalSort(value);sharedRadarRefreshResults();};
const clRecDiscoveryCard=discoveryCard;
discoveryCard=function(movie){
 let html=clRecDiscoveryCard(movie);
 if(movie.recommendation_score){
  html=html.replace(/class="radar-match">[^<]*<\/span>/,'class="radar-match">Taste fit '+Number(movie.recommendation_score)+'/100</span>');
  if(movie.why?.length)html=html.replace('<div class="new-find-score">','<p class="rec-reason">'+esc(movie.why[0])+'</p><div class="new-find-score">');
 }
 return html;
};
if(typeof v16DiscoveryHomeCard==='function')v16DiscoveryHomeCard=function(){
 return '<section class="section"><div class="card card-pad"><div class="kicker">Your movie finder</div><h2>Fresh romances for your taste</h2><p class="subtle">'+(discoveryLoading?'Finding quirky and magical romances…':discoveryError?'The finder needs a retry.':(state.discoveryResults||[]).length+' picks ready to explore.')+'</p><button class="primary" onclick="hqWorkspace.open(\'movies\')">Open Movie Radar</button></div></section>';
};

// Resolve missing saved artwork in small batches, preserving existing/manual images.
const clPosterPending=new Map(),clPosterAttempted=new Set();
let clPosterTimer=null;
function clPosterKey(movie){return (workspace?.id||'local')+':'+movie.id+':'+movie.title+':'+(window.clPosterResolver?.input(movie)?.year||'');}
function clQueueSavedPoster(movie){
 if(!window.clPosterResolver||movie.poster_url||clRecMeta(movie).poster_locked)return;
 const key=clPosterKey(movie);if(clPosterAttempted.has(key)||clPosterPending.has(key))return;
 try{const cached=JSON.parse(localStorage.getItem('clPoster:v2:'+key)||'null');if(cached?.url&&Date.now()-cached.at<604800000){movie.poster_url=cached.url;return;}}catch{}
 clPosterPending.set(key,movie);clearTimeout(clPosterTimer);clPosterTimer=setTimeout(clHydrateSavedPosters,100);
}
async function clHydrateSavedPosters(){
 const entries=[...clPosterPending].slice(0,8);if(!entries.length)return;
 for(const [key] of entries){clPosterPending.delete(key);clPosterAttempted.add(key);}
 const workspaceId=workspace?.id;
 try{
  const results=await window.clPosterResolver.resolve(entries.map(([,m])=>m));
  if(workspace?.id!==workspaceId)return;
  for(const result of results){if(!result.verified||!result.poster_url)continue;
   const movie=(state.movies||[]).find(m=>String(m.id)===String(result.key));if(!movie||movie.poster_url||clRecMeta(movie).poster_locked)continue;
   movie.poster_url=result.poster_url;
   try{localStorage.setItem('clPoster:v2:'+clPosterKey(movie),JSON.stringify({url:result.poster_url,at:Date.now()}));}catch{}
   for(const card of document.querySelectorAll('[data-movie-id]'))if(card.getAttribute('data-movie-id')===String(movie.id)){
    const poster=card.querySelector('.poster');if(poster&&!poster.querySelector('img')){const img=document.createElement('img');img.className='radar-poster-image';img.alt=movie.title+' poster';img.src=movie.poster_url;img.loading='lazy';img.onerror=()=>{img.hidden=true};poster.prepend(img);}
   }
  }
 }catch(error){console.warn('Saved poster lookup needs a retry',error);}
 finally{if(clPosterPending.size)clPosterTimer=setTimeout(clHydrateSavedPosters,100);}
}
const clRecMovieCard=movieCard;
movieCard=function(movie){clQueueSavedPoster(movie);return clRecMovieCard(movie);};
if(typeof movieMatchesCheeseFilters==='function'){
 const previous=movieMatchesCheeseFilters;
 movieMatchesCheeseFilters=movie=>!clMovieIsHorror(movie)&&previous(movie);
}
