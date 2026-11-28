import './our-movie-taste.js';
import './movie-title-search.js';
import './movie-content-policy.js';
import {editorialMovies,editorialWeeklyPicks} from './romantiverse-editorial.mjs';
const Taste=globalThis.clOurMovieTasteEngine;
const TitleSearch=globalThis.clMovieTitleSearch;
// The Bingo editorial catalog defines discovery membership. TMDB may enrich an exact identity, never add candidates.
export const CATALOG_URL='https://bingo.cheeselouisepod.com/catalog/movies.json';
export const norm=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const hash=value=>{let n=2166136261;for(const c of value){n^=c.charCodeAt(0);n=Math.imul(n,16777619)}return n>>>0||1;};
export function eligibleCatalog(m){
 if(!m?.title||m.is_demo||m.season==='Horror')return false;
 const genres=[...(m.genres||[]),...(m.genre_ids||[])].map(x=>String(typeof x==='object'?x.id||x.name:x));
 if(genres.some(x=>['16','27','99','28','53','80','10752'].includes(x)||/animation|horror|documentary|thriller|crime/i.test(x)))return false;
 return !/\b(mysteries|mystery|detective|murder|killer|spookley|square pumpkin)\b/i.test(m.title);
}
export function catalogRows(body){
 if(body?.version!==1||!Array.isArray(body.movies))throw Error('The shared Bingo movie catalog could not be read.');
 const seen=new Set();return body.movies.filter(eligibleCatalog).filter(m=>{const id=norm(m.title)+'|'+(m.release_year||'');if(seen.has(id))return false;seen.add(id);return true});
}
function searchCatalogRows(body,editorial){
 if(body?.version!==1||!Array.isArray(body.movies))throw Error('The shared Bingo movie catalog could not be read.');
 const identity=m=>TitleSearch.normalize(m.title)+'|'+(m.release_year||'');
 const reviewed=new Map(editorial.map(movie=>[identity(movie),movie]));
 const rows=body.movies.filter(movie=>movie?.title&&!movie.is_demo).map(movie=>{
  const key=identity(movie),edit=reviewed.get(key);
  reviewed.delete(key);
  return edit?{...movie,...edit}:movie;
 });
 return [...rows,...Array.from(reviewed.values(),movie=>({...movie,id:'editorial:'+identity(movie)}))];
}
const seasons={fall:'Fall',autumn:'Fall',christmas:'Winter',winter:'Winter',spring:'Spring',summer:'Summer'};
function classification(m){const title=norm(m.title);if(m.season==='Fall')return {season:'Fall',holiday:null};if(m.season==='Christmas')return {season:'Winter',holiday:'Christmas'};
 if(/\bvalentine/.test(title))return {season:'Winter',holiday:"Valentine's Day"};if(/\bwinter|snow/.test(title))return {season:'Winter',holiday:null};return {season:null,holiday:null};}
const aliases={autumn:['autumn','fall','harvest','pumpkin','october'],fall:['autumn','fall','harvest','pumpkin','october'],cat:['cat','cats','kitten','catnip'],cats:['cat','cats','kitten','catnip'],coffee:['coffee','cafe','brewing'],cafe:['coffee','cafe','brewing'],bakery:['bakery','baking','baker'],royal:['prince','princess','royal','king'],magic:['wish','magic','magical','nutcracker','spirit','timeless','biltmore']};
export function selectCatalog(body,input={},recommend=false,editorial=editorialMovies){
 const query=norm(input.query),filters=input.filters||{},seasonQuery=['fall','autumn','christmas','winter','spring','summer'].includes(query)?seasons[query]:null;
 const direct=!recommend&&input.title_search===true;
 const titleQuery=direct?TitleSearch.parse(input.query):null;
 const requestedSeason=seasons[norm(filters.season)]||null,holiday=norm(filters.holiday);
 const excluded=new Set((input.exclude_titles||[]).map(norm)),excludedIds=new Set((input.exclude_ids||[]).map(Number));
 const words=query.split(' ').filter(Boolean),terms=aliases[query]||words;
 const likes=(input.likes||[]).map(x=>norm(x.title));
 const catalog=direct||recommend?searchCatalogRows(body,editorial):catalogRows(body);
 const results=catalog.flatMap(m=>{
  if(direct&&titleQuery.key.length<2)return [];
  const cls=classification(m),id=hash('bingo:'+norm(m.title)+'|'+(m.release_year||''));
  const titleScore=direct?TitleSearch.score(m,titleQuery):0;
  const exact=!recommend&&input.lookup_exact===true&&query&&norm(m.title)===query;
  const studios=[m.network,...(m.production_companies||[])].filter(Boolean).join(' ');
  if(!direct){
   if(!exact&&(excluded.has(norm(m.title))||excludedIds.has(id)))return [];
   if(seasonQuery&&cls.season!==seasonQuery)return [];
   if(query==='christmas'&&cls.holiday!=='Christmas')return [];
   if(!exact&&requestedSeason&&cls.season!==requestedSeason)return [];
   if(!exact&&holiday&&holiday!=='__unknown__'&&norm(cls.holiday)!==holiday)return [];
   if(!exact&&filters.yearMin&&(!m.release_year||m.release_year<Number(filters.yearMin)))return [];
   if(!exact&&filters.yearMax&&(!m.release_year||m.release_year>Number(filters.yearMax)))return [];
   if(!exact&&filters.studio&&!norm(studios).includes(norm(filters.studio)))return [];
  }
  const text=norm([m.title,m.synopsis,m.summary,m.network,direct?studios:null,...Object.values(m.story_facts||{}).flat()].filter(Boolean).join(' '));
  if(!titleScore&&query&&(!seasonQuery||direct)&&!(aliases[query]?terms.some(t=>text.includes(t)):words.every(t=>text.includes(t))))return [];
  let score=norm(m.title)===query?100:query&&norm(m.title).includes(query)?95:80;
  if(recommend&&likes.some(t=>t.includes('christmas'))&&cls.holiday==='Christmas')score+=4;
  const summary=String(m.synopsis||m.summary||''),reason='From the same editorial movie catalog used by Romantiverse Bingo';
  const editorial=m.episode_hook?{status:'eligible',reason:m.episode_hook,source:m.source_url}:null;
  const excludedContent=!eligibleCatalog(m)||globalThis.clMovieIsHorror(m);
  const source_metadata={catalog_id:m.id,source_type:'bingo_catalog',verification_status:m.verification_status,year:m.release_year,
   romantiverse:excludedContent?{status:'excluded',reason:'Outside the podcast’s romance policy',source:m.source_url||null}:editorial||globalThis.clRomantiverseEligibility(m),
   genres:m.genres||m.genre_ids||[]};
  if(m.premiere?.verified&&String(m.premiere.source_url||'').startsWith('https://'))source_metadata.premiere=m.premiere;
  if(Array.isArray(m.availability))source_metadata.availability=m.availability.filter(entry=>entry?.verified&&entry.provider&&String(entry.source_url||'').startsWith('https://'));
  const companies=m.production_companies||(m.production_company?[m.production_company]:[]);
  return [{title:m.title,year:m.release_year||null,premiere_date:m.premiere_date||null,tmdb_id:id,tmdb_type:'catalog',catalog_id:m.id,source_type:'bingo_catalog',network:m.network||null,summary,poster_url:m.poster_url||null,source_url:m.source_url||CATALOG_URL,source_metadata,...cls,production_companies:companies,providers:[],search_score:score,match_score:score,recommendation_score:score,search_reasons:[reason],why:[reason],stars:TitleSearch.cast(m),cast:m.cast||[],verified_aliases:m.verified_aliases||[],original_title:m.original_title||null,...(direct?{title_search_score:titleScore||10}:{})}];
 }).sort((a,b)=>direct?TitleSearch.compare(a,b,titleQuery):b.search_score-a.search_score||a.title.localeCompare(b.title));
 const limit=Math.max(1,Math.min(120,Number(input.max_results)||36)),batch=Math.max(0,Math.trunc(Number(input.batch)||0));
 if(recommend)return recommendationPage(results,input,{catalog_count:catalog.length,source:'romantiverse_bingo_editorial_catalog',expanded_terms:terms});
 return {results:results.slice(0,limit),count:Math.min(limit,results.length),catalog_count:catalogRows(body).length,source:'romantiverse_bingo_editorial_catalog',expanded_terms:terms,matched_favorites:[],unmatched_favorites:[],partial:false};
}
export function recommendationPage(rows,input,meta={}){
 const eligible=rows.filter(movie=>globalThis.clRomantiverseFeedAllows(movie));
 const review=meta.review||rows.map(movie=>({title:movie.title,year:movie.year,...globalThis.clRomantiverseEligibility(movie)}))
  .filter(movie=>movie.status==='review_required');
 const profile=Taste.profile(input),ranked=profile.count?Taste.rank(eligible,profile):eligible,close=ranked.filter(m=>m.taste_tier==='close'),pool=profile.count&&!input.include_broader?close:ranked;
 const limit=Math.max(1,Math.min(120,Number(input.max_results)||24));
 return {...meta,review,weekly_editorial:editorialWeeklyPicks,results:pool.slice(0,limit),count:Math.min(limit,pool.length),close_count:close.length,broader_count:ranked.length-close.length,profile_count:profile.count,both_yes_count:profile.both,matched_favorites:profile.likes.map(m=>({title:m.title,year:m.year,signal:m.signal})),unmatched_favorites:[],partial:false,personalized:profile.count>0,include_broader:!!input.include_broader};
}

export function createCatalogHandler({fallback,env=()=>'',fetcher=fetch,recommend=false,editorial=editorialMovies}){
 let cached=null,at=0,pendingCatalog,failedAt=0;const detailCache=new Map();
 const staleCatalog=()=>({body:cached||fallback,stale:true,checkedAt:at?new Date(at).toISOString():null});
 async function load(){
  if(cached&&Date.now()-at<900000)return {body:cached,stale:false,checkedAt:new Date(at).toISOString()};
  if(failedAt&&Date.now()-failedAt<30000)return staleCatalog();
  if(pendingCatalog)return pendingCatalog;
  pendingCatalog=(async()=>{
   try{
    const response=await fetcher(CATALOG_URL,{signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw Error('Catalog unavailable');
    const value=await response.json();
    if(value?.version!==1||!Array.isArray(value.movies)||!value.movies.some(movie=>movie?.title&&!movie.is_demo))throw Error('Catalog empty');
    cached=value;at=Date.now();failedAt=0;
    return {body:cached,stale:false,checkedAt:new Date(at).toISOString()};
   }catch{failedAt=Date.now();return staleCatalog();}
  })();
  try{return await pendingCatalog;}finally{pendingCatalog=undefined;}
 }
 function applyMetadata(row,remote){
  const merged={...row,...remote,source_metadata:{...row.source_metadata,...remote.source_metadata}};
  for(const field of ['summary','poster_url','production_companies','stars','cast']){
   if(row[field]?.length)merged[field]=row[field];
  }
  merged.verified_aliases=[...new Set([...(row.verified_aliases||[]),...(remote.verified_aliases||[])])];
  return merged;
 }
 async function enrich(row){
  const providerId=row.tmdb_type==='movie'?Number(row.tmdb_id):0;
  const cacheKey=providerId?'tmdb:'+providerId:String(row.catalog_id||norm(row.title))+'|'+(row.year||''),hit=detailCache.get(cacheKey);if(hit&&Date.now()-hit.at<86400000)return applyMetadata(row,hit.metadata);
  const token=env('TMDB_READ_ACCESS_TOKEN');if(!token)return row;
  const get=async path=>{const r=await fetcher('https://api.themoviedb.org/3'+path,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();return r.json()};
  try{
   let id=providerId;
   if(!id){
    const q=new URLSearchParams({query:row.title,include_adult:'false',language:'en-US'});if(row.year)q.set('year',String(row.year));
    const found=await get('/search/movie?'+q);
    const matches=(found.results||[]).filter(m=>norm(m.title)===norm(row.title)&&(!row.year||String(m.release_date||'').slice(0,4)===String(row.year))&&!m.adult&&!(m.genre_ids||[]).some(g=>[16,27,99,53,80].includes(g)));
    if(matches.length!==1)return row;
    id=matches[0].id;
   }
   const m=await get('/movie/'+id+'?append_to_response=credits,keywords,external_ids,alternative_titles');
   if(m.adult||norm(m.title)!==norm(row.title)||(row.year&&String(m.release_date||'').slice(0,4)!==String(row.year)))return row;
   const metadata={summary:m.overview||'',poster_url:m.poster_path?'https://image.tmdb.org/t/p/w500'+m.poster_path:null,
    production_companies:(m.production_companies||[]).map(c=>c.name),stars:(m.credits?.cast||[]).slice(0,5).map(c=>c.name),
    cast:(m.credits?.cast||[]).slice(0,8).map(c=>({name:c.name,character:c.character})),genres:(m.genres||[]).map(g=>g.name),
    keywords:(m.keywords?.keywords||[]).map(k=>k.name),
    verified_aliases:(m.alternative_titles?.titles||[]).map(item=>item.title).filter(Boolean).slice(0,25),
    source_metadata:{poster_tmdb_id:m.id,identity_verified:true}};
   if(detailCache.size>=600)detailCache.delete(detailCache.keys().next().value);detailCache.set(cacheKey,{at:Date.now(),metadata});return applyMetadata(row,metadata);
  }catch{return row}
 }

 async function titleLookup(input){
  const parsed=TitleSearch.parse(input.query),query=input.title_search?parsed.title:String(input.query||'').trim().slice(0,100),token=env('TMDB_READ_ACCESS_TOKEN');
  if(!token)return {rows:[],warning:'Exact-title lookup is not configured. Catalog matches are still shown.'};
  try{
   const q=new URLSearchParams({query,include_adult:'false',language:'en-US'});
   const response=await fetcher('https://api.themoviedb.org/3/search/movie?'+q,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(5000)});
   if(!response.ok)throw Error('lookup failed');
   const found=await response.json();
   if(!Array.isArray(found.results))throw Error('lookup incomplete');
   const matches=found.results.filter(m=>{
    if(m.adult||!m.id||!m.title)return false;
    if(!input.title_search&&!eligibleCatalog(m))return false;
    if(TitleSearch.score({...m,year:String(m.release_date||'').slice(0,4)},parsed)>=500)return true;
    return input.broader_lookup===true&&TitleSearch.score(m,parsed)>=200;
   })
    .sort((a,b)=>TitleSearch.compare({...a,year:String(a.release_date||'').slice(0,4)},{...b,year:String(b.release_date||'').slice(0,4)},parsed)).slice(0,8);
   const rows=await Promise.all(matches.map(async m=>{
    const year=Number(String(m.release_date||'').slice(0,4))||null,exact=TitleSearch.normalize(m.title)===TitleSearch.normalize(query);
    const sourceType=exact?'tmdb_exact_title':'tmdb_title_lookup',reason=exact?'Exact title match from TMDB':'Possible title match from TMDB';
    return enrich({title:m.title,original_title:m.original_title||null,year,premiere_date:m.release_date,tmdb_id:m.id,tmdb_type:'movie',source_type:sourceType,source_url:'https://www.themoviedb.org/movie/'+m.id,source_metadata:{source_type:sourceType,year,poster_tmdb_id:m.id},summary:m.overview||'',poster_url:m.poster_path?'https://image.tmdb.org/t/p/w500'+m.poster_path:null,genre_ids:m.genre_ids||[],providers:[],holiday:null,season:null,search_score:100,match_score:100,exact_title_match:exact,search_reasons:[reason],why:[reason]});
   }));
   return {rows,warning:''};
  }catch{return {rows:[],warning:'Exact-title lookup is temporarily unavailable. Retry to check beyond the catalog.'}}
 }
 return async req=>{const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'},json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return json({error:'POST required'},405);
  try{
   const input=await req.json(),catalog=await load();
   const result={...selectCatalog(catalog.body,recommend?{...input,max_results:120,include_broader:true}:input,recommend,editorial),catalog_stale:catalog.stale,catalog_checked_at:catalog.checkedAt};
   const rows=result.results.slice(),started=Date.now();
   let exactWarning='';
   if(!recommend&&input.title_search===true){
    const query=TitleSearch.parse(input.query);
    let warning='';
    if(query.key.length>=2&&(input.broader_lookup===true||(input.lookup_exact===true&&!input.workspace_exact&&!rows.some(m=>TitleSearch.confident(m,query))))){
     const lookup=await titleLookup(input);
     warning=lookup.warning;
     for(const m of lookup.rows){
      if(!rows.some(r=>Number(r.source_metadata?.poster_tmdb_id)===Number(m.tmdb_id))){
       rows.push({...m,title_search_score:TitleSearch.score(m,query)});
      }
     }
     rows.sort((a,b)=>TitleSearch.compare(a,b,query));
    }
    const limit=Math.max(1,Math.min(120,Number(input.max_results)||36));
    const page=rows.slice(0,limit);
    return json({...result,results:page,count:page.length,exact_lookup_warning:warning});
   }
   if(!recommend&&input.lookup_exact===true&&norm(input.query).length>=2){
    const existingExact=rows.filter(m=>norm(m.title)===norm(input.query));
    if(!existingExact.length){
     const lookup=await titleLookup(input);exactWarning=lookup.warning;
     for(const m of lookup.rows)if(!rows.some(r=>norm(r.title)===norm(m.title)&&r.year===m.year))rows.push(m);
    }
    for(const m of rows)if(norm(m.title)===norm(input.query))m.exact_title_match=true;
    rows.sort((a,b)=>Number(!!b.exact_title_match)-Number(!!a.exact_title_match)||b.search_score-a.search_score);
   }
   let next=0;await Promise.all(Array.from({length:Math.min(8,rows.length)},async()=>{while(next<rows.length&&Date.now()-started<12000){const n=next++;if(!rows[n].exact_title_match||rows[n].source_type==='bingo_catalog'){if(recommend||n<12)rows[n]=await enrich(rows[n])}}}));
   return json(recommend?recommendationPage(rows,input,result):{...result,results:rows,count:rows.length,exact_lookup_warning:exactWarning});
  }catch{return json({error:'The Cheese Louise catalog could not load. Please retry.'},503)}
 };
}
