// Movie-based recommendations and workspace-scoped discovery history.
let clRecommendationMeta=null;
let clRecommendationSequence=0;
const clRecMemoryHistory=new Map();
function clRecMeta(movie){let meta=movie?.source_metadata||{};if(typeof meta==='string'){try{meta=JSON.parse(meta)}catch{meta={}}}return meta;}
function clRecNorm(title){return String(title||'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/^(a|an|the) /,'');}
function clRecStorageKey(){return 'cheeseLouise:recommendations:v3:'+(workspace?.id||'local');}
function clRecHistory(){const key=clRecStorageKey();if(clRecMemoryHistory.has(key))return clRecMemoryHistory.get(key);try{const value=JSON.parse(localStorage.getItem(key)||'{}');return {ids:Array.isArray(value.ids)?value.ids:[],titles:Array.isArray(value.titles)?value.titles:[],batch:Number(value.batch)||0};}catch{return {ids:[],titles:[],batch:0};}}
function clRecPreferences(){return clOurMovieTasteEngine.preferences(state.movies||[],state.episodes||[]);}
let clRecIncludeBroader=true,clRecProfileSignature='',clRecRefreshTimer=null;
let clRecLastFetchAt=0;
function clRecKnownIds(){return (state.movies||[]).map(m=>{
 const meta=clRecMeta(m);return Number(meta.poster_tmdb_id||(/^tmdb_/.test(meta.source_type||'')?m.tmdb_id:0));
}).filter(Boolean);}
discoverCheeseMovies=async function(force=false){
 if(!workspace||!session||discoveryLoading||(!force&&discoveryLoaded))return;
 const sequence=++clRecommendationSequence,workspaceId=workspace.id;
 const history=clRecHistory(),prefs=clRecPreferences(),profileSignature=JSON.stringify(prefs);
 discoveryLoading=true;discoveryError='';render();
 try{
  const {data,error}=await db.functions.invoke('recommend-romantiverse',{body:{...prefs,max_results:120,batch:0,include_broader:clRecIncludeBroader,
   exclude_ids:[],
   exclude_titles:[],
   filters:{holiday:movieFilters.holiday,season:movieFilters.season,studio:movieFilters.studio,yearMin:movieFilters.yearMin,yearMax:movieFilters.yearMax}}});
  if(sequence!==clRecommendationSequence||workspace?.id!==workspaceId)return;
  if(error)throw error;if(data?.error)throw new Error(data.error);
  if(!Array.isArray(data?.results))throw new Error('Movie recommendations returned an incomplete response.');
  if(data.catalog_stale&&state.discoveryResults?.length){
   discoveryError='The catalog could not refresh. Showing the previous picks.';
   return;
  }
  state.discoveryResults=data.results.filter(m=>m.source_type==='bingo_catalog'&&clRomantiverseFeedAllows(m));
  clRecommendationMeta=data;clRecProfileSignature=profileSignature;discoveryLoaded=true;
  if(!data.catalog_stale)clRecLastFetchAt=Date.parse(data.catalog_checked_at)||Date.now();
  const next={ids:[...new Set([...history.ids,...state.discoveryResults.map(m=>Number(m.tmdb_id))])].slice(-2000),titles:[...new Set([...history.titles,...state.discoveryResults.map(m=>m.title)])].slice(-2000),batch:(history.batch+1)%10000};
  clRecMemoryHistory.set(clRecStorageKey(),next);
  try{localStorage.setItem(clRecStorageKey(),JSON.stringify(next));}catch{clRecommendationMeta.history_warning='This browser could not save discovery history; repeat prevention will last only while this page stays open.';}
 }catch(error){if(sequence===clRecommendationSequence)discoveryError=error?.message||String(error);}
 finally{if(sequence===clRecommendationSequence){discoveryLoading=false;render();}}
};
window.discoverCheeseMovies=discoverCheeseMovies;
window.clFindForUs=()=>{
 clRecIncludeBroader=true;
 movieFilters.mode='all';
 searchText='';const input=document.getElementById('globalSearch');if(input)input.value='';
 clearTimeout(romantiverseSearchTimer);runRomantiverseSearch('');discoverCheeseMovies(true);
};
window.clShowBroaderMatches=()=>{clRecIncludeBroader=true;discoverCheeseMovies(true);};
window.clBroadenFinder=()=>{
 clRecIncludeBroader=true;
 window.clearMovieFilters();clearTimeout(romantiverseSearchTimer);
 if(searchText.trim())runRomantiverseSearch(searchText,true);else discoverCheeseMovies(true);
};
window.clRecStartOver=()=>{clRecMemoryHistory.delete(clRecStorageKey());try{localStorage.removeItem(clRecStorageKey());}catch{}discoverCheeseMovies(true);};
discoveryPanel=function(){
 const currentProfile=JSON.stringify(clRecPreferences());if(clRecommendationMeta&&clRecProfileSignature!==currentProfile&&!discoveryLoading){clearTimeout(clRecRefreshTimer);clRecRefreshTimer=setTimeout(()=>discoverCheeseMovies(true),100);}
 const title='<h2 class="page-title small-title">Your Cheese Louise feed</h2>';
 if(discoveryLoading&&!discoveryLoaded)return '<div class="new-find-panel card card-pad">'+title+'<div class="discovery-loading"><span class="discovery-spinner">♥</span> Matching your favorites and finding a fresh batch with posters…</div></div>';
 if(discoveryError&&!discoveryLoaded)return '<div class="new-find-panel card card-pad">'+title+'<div class="empty" role="status">'+esc(discoveryError)+'</div></div>';
 if(!discoveryLoaded)return '<div class="new-find-panel card card-pad">'+title+'<button class="primary" onclick="discoverCheeseMovies(true)">Find movies for us</button></div>';
 let rows=(state.discoveryResults||[]).filter(c=>{
  const saved=clRecSavedMovie(c);
  if(!clRomantiverseFeedAllows(c,saved)||clMovieTitleSearch.recorded(saved,state.episodes))return false;
  return (saved||!discoveryHidden.has(Number(c.tmdb_id)))&&discoveryMatchesCurrentView(c);
 });
 if(clTasteSort==='taste')rows=clTasteRank(rows);
 if(clTasteSort==='newest')rows=rows.slice().sort((a,b)=>String(b.premiere_date||'').localeCompare(String(a.premiere_date||'')));
 else if(clTasteSort==='relevance')rows=rows.slice().sort((a,b)=>Number(b.recommendation_score||0)-Number(a.recommendation_score||0));
 rows=rows.slice().sort((a,b)=>clRecYesCount(b)-clRecYesCount(a));
 const meta=clRecommendationMeta||{},matched=meta.matched_favorites||[],unmatched=meta.unmatched_favorites||[];
 const weekly=clRecWeeklyPick(rows,meta.weekly_editorial);
 const sections=clRecDiscoverySections(rows.filter(movie=>movie!==weekly));
 if(sections.top.length>2&&sections.top.length<20)sections.more.unshift(...sections.top.splice(-Math.min(3,Math.floor(sections.top.length/3))));
 return '<div class="new-find-panel">'+
  (discoveryError||meta.catalog_stale?'<p role="status" class="subtle">'+esc(discoveryError||'The live catalog did not respond. Showing the bundled catalog.')+'</p>':'')+
  (meta.partial?'<p class="subtle">Some movie sources did not respond. Showing the searches that completed.</p>':'')+
  (meta.history_warning?'<p class="subtle" role="status">'+esc(meta.history_warning)+'</p>':'')+
  '<section class="cl-weekly-pick" aria-label="Pick of the Week"><h3>Pick of the Week</h3>'+
   (weekly?clRecFeedCard(weekly,false,true):'<p class="subtle">No eligible weekly pick in this view.</p>')+'</section>'+
  clRecShelf('coming-soon','Coming Soon',sections.soon,'No verified upcoming premieres in this view.',true)+
  clRecShelf('top-picks','Top 20 for Cheese Louise',sections.top,'No confirmed released movies match this view.')+
  clRecShelf('more-picks','More Movies to Discover',sections.more,'You’ve reached the end of the eligible picks in this view.')+
  (!rows.length?'<button class="secondary" onclick="clBroadenFinder()">Clear filters</button>':'')+
  '<details><summary>About these picks</summary><p class="subtle">'+rows.length+' matches · '+matched.length+' favorites informed this feed</p><p class="subtle">'+matched.map(m=>esc(m.title)+(m.year?' ('+Number(m.year)+')':'')).join(' · ')+(unmatched.length?'<br>Unmatched favorites: '+unmatched.map(esc).join(' · '):'')+'</p></details>'+
  (meta.review?.length?'<details><summary>Needs review ('+meta.review.length+')</summary><ul>'+meta.review.map(movie=>'<li><strong>'+esc(movie.title)+'</strong> '+esc(movie.year||'')+' · '+esc(movie.reason)+'</li>').join('')+'</ul></details>':'')+'</div>';
};
function clRecShelf(id,label,movies,empty,upcoming=false){
 const title='movie-shelf-'+id;
 const controls=movies.length>1?'<div class="cl-shelf-controls">'+[-1,1].map(direction=>
  '<button type="button" class="secondary" aria-label="'+(direction<0?'Previous ':'Next ')+esc(label)+' movies" aria-controls="'+id+
  '" data-direction="'+direction+'" onclick="clScrollMovieShelf(this)">'+(direction<0?'‹':'›')+'</button>').join('')+'</div>':'';
 return '<section class="cl-movie-shelf" aria-labelledby="'+title+'"><div class="cl-shelf-heading"><h3 id="'+title+'">'+esc(label)+'</h3>'+controls+'</div>'+
  (movies.length?'<div id="'+id+'" class="cl-shelf-track" aria-labelledby="'+title+'" role="group" tabindex="0">'+movies.map(movie=>clRecFeedCard(movie,upcoming)).join('')+'</div>':
   '<p class="subtle">'+esc(empty)+'</p>')+'</section>';
}
window.clScrollMovieShelf=button=>{
 const shelf=document.getElementById(button.getAttribute('aria-controls'));
 if(!shelf)return;
 shelf.scrollBy({left:Number(button.dataset.direction)*Math.round(shelf.clientWidth*.85),
  behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
};
function clRecWeeklyPick(rows,editorial={},now=new Date()){
 const monday=new Date(now);
 monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
 const pick=editorial[monday.toISOString().slice(0,10)];
 const released=rows.filter(movie=>clMovieTitleSearch.release(clRecFeedIdentity(movie,clRecSavedMovie(movie)),now)==='released');
 return (pick&&released.find(movie=>clMovieTitleSearch.normalize(movie.title)===clMovieTitleSearch.normalize(pick.title)&&
  clMovieTitleSearch.year(movie)===pick.year))||released.slice().sort((a,b)=>clRecYesCount(b)-clRecYesCount(a))[0]||null;
}
function clRecFeedIdentity(movie,saved){
 if(!saved)return movie;
 const sourceMeta=clRecMeta(movie);
 const sourcePremiere=!saved.premiere_date||saved.premiere_date===movie.premiere_date?sourceMeta.premiere:null;
 return {...movie,...saved,premiere_date:saved.premiere_date||movie.premiere_date,
  source_metadata:{...sourceMeta,premiere:sourcePremiere,...clRecMeta(saved)}};
}
function clRecDiscoverySections(rows,now=new Date()){
 const search=globalThis.clMovieTitleSearch;
 const soon=[],top=[],more=[];
 for(const movie of rows){
  const saved=clRecSavedMovie(movie);
  const identity=clRecFeedIdentity(movie,saved);
  const meta=clRecMeta(identity);
  const release=search.release(identity,now);
  const source=identity.source_url||'';
  const verified=source.startsWith('https://')&&(meta.source_type==='hallmark_official'||meta.verification_status==='metadata_verified'||meta.premiere?.verified);
  if((release==='upcoming'||release==='today')&&verified)soon.push({movie,identity});
  else if(release==='released'&&top.length<20)top.push(movie);
  else more.push(movie);
 }
 soon.sort((a,b)=>String(a.identity.premiere_date||'').localeCompare(String(b.identity.premiere_date||''))||
  String(clRecMeta(a.identity).premiere?.at||'').localeCompare(String(clRecMeta(b.identity).premiere?.at||''))||
  String(a.movie.tmdb_id).localeCompare(String(b.movie.tmdb_id)));
 return {soon:soon.map(item=>item.movie),top,more};
}
const clRecOriginalSort=window.clSetTasteSort;
window.clSetTasteSort=value=>{clRecOriginalSort(value);sharedRadarRefreshResults();};
function clRecSavedMovie(candidate){
 const direct=discoverySavedMovie(candidate);if(direct)return direct;
 if(typeof romantiverseSearchLinkedMovie==='function')return romantiverseSearchLinkedMovie(candidate);
 const year=clMovieTitleSearch.year(candidate);
 const matches=(state.movies||[]).filter(m=>clRecNorm(m.title)===clRecNorm(candidate.title)&&year&&clMovieTitleSearch.year(m)===year);
 return matches.length===1?matches[0]:null;
}
function clRecYesCount(candidate){return Object.values(clRecSavedMovie(candidate)?.votes||{}).filter(v=>v==='yes').length;}
function clRecFeedCard(candidate,upcoming=false,weekly=false){
 const saved=clRecSavedMovie(candidate),movie=clRecFeedIdentity(candidate,saved),meta=clRecMeta(movie);
 const mutual=Object.values(saved?.votes||{}).filter(v=>v==='yes').length>=2;
 const upcomingDate=meta.premiere?.verified&&Number.isFinite(Date.parse(meta.premiere.at))
  ?new Date(meta.premiere.at).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'})
  :movie.premiere_date&&new Date(movie.premiere_date+'T12:00:00').toLocaleDateString([], {month:'short',day:'numeric'});
 const premiere=upcoming?[upcomingDate||'Premiere date to be confirmed',meta.premiere?.platform||movie.network].filter(Boolean).join(' · '):'';
 const watch=Array.isArray(meta.availability)?meta.availability.find(entry=>entry?.verified&&entry.provider):null;
 const watchText=watch?[watch.provider,watch.access_type,watch.available_from?'from '+watch.available_from:null].filter(Boolean).join(' · '):'';
 const title=esc(movie.title),year=clMovieTitleSearch.year(movie);
 const credits=[year,movie.network].filter(Boolean).map(esc).join(' · ');
 const cast=clMovieTitleSearch.cast(movie).slice(0,2).map(esc).join(' · ');
 const reason=clRomantiverseEligibility(candidate).reason;
 const source=meta.premiere?.source_url||candidate.source_url;
 const image=/^(https:\/\/|\/(?!\/))/i.test(movie.poster_url||'')?
  '<img src="'+esc(movie.poster_url)+'" alt="" loading="'+(weekly?'eager':'lazy')+'" decoding="async" onerror="this.remove()">':'';
 const art='<span aria-hidden="true">CL</span>'+image;
 const action=saved?'openMovie(this.dataset.movieId)':'clOpenDiscoveryMovieDetails(Number(this.dataset.movieId))';
 const movieId=saved?.id||candidate.tmdb_id;
 const currentVote=saved?.votes?.[typeof me==='function'?me():null];
 const voteAction=saved?'vote(this.dataset.movieId,this.dataset.vote)':'voteDiscoveredMovie(Number(this.dataset.movieId),this.dataset.vote)';
 const votes=weekly?'<div class="cl-weekly-votes" role="group" aria-label="Rate this pick">'+['yes','no'].map(value=>
  '<button type="button" class="secondary" data-movie-id="'+esc(movieId)+'" data-vote="'+value+'" aria-pressed="'+(currentVote===value)+
  '" onclick="'+voteAction+'">'+(value==='yes'?'👍 Thumbs Up':'👎 Thumbs Down')+'</button>').join('')+'</div>':'';
 return '<div class="cl-feed-card'+(weekly?' cl-feed-card--weekly':'')+(mutual?' cl-feed-card--spotlight':'')+'">'+
  (mutual?'<div class="cl-feed-spotlight"><span aria-hidden="true">✦</span> <strong>Don’t miss</strong><span>Both Hosts Voted Yes</span></div>':'')+
  '<article class="cl-editorial-card card">'+(weekly&&image?'<div class="cl-weekly-backdrop" aria-hidden="true">'+image+'</div>':'')+
  '<button type="button" class="cl-editorial-poster" tabindex="-1" data-movie-id="'+esc(movieId)+'" aria-label="Open '+title+'" onclick="'+action+'">'+art+'</button><div class="cl-editorial-copy">'+
  '<h4>'+title+'</h4>'+
  (credits?'<p class="cl-editorial-meta">'+credits+'</p>':'')+
  (cast?'<p class="cl-editorial-meta">'+cast+'</p>':'')+
  (premiere?'<p class="cl-editorial-watch">'+esc(premiere)+'</p>':'')+
  (upcoming&&/^https:\/\//i.test(source||'')?'<a class="cl-editorial-source" href="'+esc(source)+'" target="_blank" rel="noopener">Premiere source</a>':'')+
  (watchText?'<p class="cl-editorial-watch">'+esc(watchText)+'</p>':'')+
  (weekly&&reason?'<p class="cl-weekly-reason">'+esc(reason)+'</p>':'')+
  votes+
  '<button type="button" class="secondary cl-editorial-action" data-movie-id="'+esc(movieId)+'" aria-label="View '+title+'" onclick="'+action+'">View movie</button>'+
  '<button type="button" class="'+(weekly?'primary':'secondary')+'" data-movie-id="'+esc(movieId)+'" aria-label="Start Episode Setup for '+title+'" onclick="clEpisodeWizard.'+(saved?'useMovie(this.dataset.movieId)':'useCandidate(Number(this.dataset.movieId))')+'">Start Episode Setup</button>'+
  '</div></article></div>';
}
const clRecDiscoveryCard=discoveryCard;
discoveryCard=function(movie){
 let html=clRecDiscoveryCard(movie);
 if(movie.taste_tier){html=html.replace(/class="radar-match">[^<]*<\/span>/,'class="radar-match">'+(movie.taste_tier==='close'?'Close to Our Movies':'Broader catalog match')+'</span>');if(movie.why?.length)html=html.replace('<div class="new-find-score">','<p class="rec-reason">'+esc(movie.why[0])+'</p><div class="new-find-score">');return html;}
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


/* Check for fresh recommendations only when the Movie Radar is actively in use.
 * This refreshes the feed; server-side discovery sources retain their own schedules. */
function clRecCheckFreshness(){
 if(!session||!workspace||currentTab!=='movies'||document.hidden||discoveryLoading)return;
 if(document.querySelector('.modal-backdrop'))return;
 if(document.activeElement?.matches?.('input,textarea,select,[contenteditable="true"]'))return;
 if(!discoveryLoaded||Date.now()-clRecLastFetchAt>=45*60*1000)void discoverCheeseMovies(true);
}
// Feature-detect browser hooks so isolated test environments can load the feed logic.
if(typeof document!=='undefined'&&typeof document.addEventListener==='function')
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)clRecCheckFreshness();});
if(typeof window!=='undefined'&&typeof window.addEventListener==='function')
 window.addEventListener('focus',clRecCheckFreshness);
if(typeof window!=='undefined'&&typeof window.setInterval==='function')
 window.setInterval(clRecCheckFreshness,5*60*1000);
if(typeof window!=='undefined'&&typeof window.go==='function'){
 const clRecPreviousGo=window.go;
 window.go=function(view,...args){const result=clRecPreviousGo(view,...args);if(view==='movies')window.setTimeout?.(clRecCheckFreshness,0);return result;};
}
