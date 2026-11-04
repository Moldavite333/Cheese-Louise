// The Bingo editorial catalog defines discovery membership. TMDB may enrich an exact identity, never add candidates.
export const CATALOG_URL='https://bingo.cheeselouisepod.com/catalog/movies.json';
export const norm=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const hash=value=>{let n=2166136261;for(const c of value){n^=c.charCodeAt(0);n=Math.imul(n,16777619)}return n>>>0||1;};
export function eligibleCatalog(m){
 if(!m?.title||m.is_demo||m.season==='Horror')return false;
 const genres=[...(m.genres||[]),...(m.genre_ids||[])].map(x=>String(typeof x==='object'?x.id||x.name:x));
 if(genres.some(x=>['16','27','99','28','53','80','10752'].includes(x)||/animation|horror|documentary|thriller|crime/i.test(x)))return false;
 return !/\b(mysteries|mystery|detective|murder|killer|cinderella|spookley|square pumpkin)\b/i.test(m.title);
}
export function catalogRows(body){
 if(body?.version!==1||!Array.isArray(body.movies))throw Error('The shared Bingo movie catalog could not be read.');
 const seen=new Set();return body.movies.filter(eligibleCatalog).filter(m=>{const id=norm(m.title)+'|'+(m.release_year||'');if(seen.has(id))return false;seen.add(id);return true});
}
const seasons={fall:'Fall',autumn:'Fall',christmas:'Winter',winter:'Winter',spring:'Spring',summer:'Summer'};
function classification(m){const title=norm(m.title);if(m.season==='Fall')return {season:'Fall',holiday:null};if(m.season==='Christmas')return {season:'Winter',holiday:'Christmas'};
 if(/\bvalentine/.test(title))return {season:'Winter',holiday:"Valentine's Day"};if(/\bwinter|snow/.test(title))return {season:'Winter',holiday:null};return {season:null,holiday:null};}
const aliases={autumn:['autumn','fall','harvest','pumpkin','october'],fall:['autumn','fall','harvest','pumpkin','october'],cat:['cat','cats','kitten','catnip'],cats:['cat','cats','kitten','catnip'],coffee:['coffee','cafe','brewing'],cafe:['coffee','cafe','brewing'],bakery:['bakery','baking','baker'],royal:['prince','princess','royal','king'],magic:['wish','magic','magical','nutcracker','spirit','timeless','biltmore']};
export function selectCatalog(body,input={},recommend=false){
 const query=norm(input.query),filters=input.filters||{},seasonQuery=['fall','autumn','christmas','winter','spring','summer'].includes(query)?seasons[query]:null;
 const requestedSeason=seasons[norm(filters.season)]||null,holiday=norm(filters.holiday);
 const excluded=new Set((input.exclude_titles||[]).map(norm)),excludedIds=new Set((input.exclude_ids||[]).map(Number));
 const words=query.split(' ').filter(Boolean),terms=aliases[query]||words;
 const likes=(input.likes||[]).map(x=>norm(x.title));
 const results=catalogRows(body).flatMap(m=>{
  const cls=classification(m),id=hash('bingo:'+norm(m.title)+'|'+(m.release_year||''));
  if(excluded.has(norm(m.title))||excludedIds.has(id))return [];
  if(seasonQuery&&cls.season!==seasonQuery)return [];
  if(query==='christmas'&&cls.holiday!=='Christmas')return [];
  if(requestedSeason&&cls.season!==requestedSeason)return [];
  if(holiday&&holiday!=='__unknown__'&&norm(cls.holiday)!==holiday)return [];
  if(filters.yearMin&&(!m.release_year||m.release_year<Number(filters.yearMin)))return [];
  if(filters.yearMax&&(!m.release_year||m.release_year>Number(filters.yearMax)))return [];
  const studios=[m.network,...(m.production_companies||[])].filter(Boolean).join(' ');
  if(filters.studio&&!norm(studios).includes(norm(filters.studio)))return [];
  const text=norm([m.title,m.synopsis,m.summary,m.network,...Object.values(m.story_facts||{}).flat()].filter(Boolean).join(' '));
  if(query&&!seasonQuery&&!(aliases[query]?terms.some(t=>text.includes(t)):words.every(t=>text.includes(t))))return [];
  let score=norm(m.title)===query?100:query&&norm(m.title).includes(query)?95:80;
  if(recommend&&likes.some(t=>t.includes('christmas'))&&cls.holiday==='Christmas')score+=4;
  const summary=String(m.synopsis||m.summary||''),reason='From the same editorial movie catalog used by Romantiverse Bingo';
  return [{title:m.title,year:m.release_year||null,tmdb_id:id,tmdb_type:'catalog',catalog_id:m.id,source_type:'bingo_catalog',network:m.network||'Romantiverse Bingo catalog',summary,poster_url:m.poster_url||null,source_url:m.source_url||CATALOG_URL,source_metadata:{catalog_id:m.id,source_type:'bingo_catalog',verification_status:m.verification_status,year:m.release_year},...cls,production_companies:m.production_companies||[],providers:[],search_score:score,match_score:score,recommendation_score:score,search_reasons:[reason],why:[reason]}];
 }).sort((a,b)=>b.search_score-a.search_score||a.title.localeCompare(b.title));
 const limit=Math.max(1,Math.min(120,Number(input.max_results)||36)),batch=Math.max(0,Math.trunc(Number(input.batch)||0));
 const start=recommend&&results.length?batch*limit%results.length:0;
 return {results:(recommend?[...results.slice(start),...results.slice(0,start)]:results).slice(0,limit),count:Math.min(limit,results.length),catalog_count:catalogRows(body).length,source:'romantiverse_bingo_editorial_catalog',expanded_terms:terms,matched_favorites:(input.likes||[]).filter(l=>body.movies.some(m=>norm(m.title)===norm(l.title))),unmatched_favorites:[],partial:false};
}
export function createCatalogHandler({fallback,env=()=>'',fetcher=fetch,recommend=false}){
 let cached=null,at=0;
 async function load(){if(cached&&Date.now()-at<900000)return cached;try{const r=await fetcher(CATALOG_URL,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();const value=await r.json();catalogRows(value);cached=value;at=Date.now();return value}catch{return cached||fallback}}
 async function enrich(row){
  const token=env('TMDB_READ_ACCESS_TOKEN');if(!token)return row;
  const get=async path=>{const r=await fetcher('https://api.themoviedb.org/3'+path,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();return r.json()};
  try{const q=new URLSearchParams({query:row.title,include_adult:'false',language:'en-US'});if(row.year)q.set('year',String(row.year));const found=await get('/search/movie?'+q);
   const matches=(found.results||[]).filter(m=>norm(m.title)===norm(row.title)&&(!row.year||String(m.release_date||'').slice(0,4)===String(row.year))&&!m.adult&&!(m.genre_ids||[]).some(g=>[16,27,99,53,80].includes(g)));
   if(matches.length!==1)return row;const m=await get('/movie/'+matches[0].id+'?append_to_response=credits,keywords,external_ids');
   return {...row,summary:m.overview||row.summary,poster_url:m.poster_path?'https://image.tmdb.org/t/p/w500'+m.poster_path:row.poster_url,production_companies:(m.production_companies||[]).map(c=>c.name),stars:(m.credits?.cast||[]).slice(0,5).map(c=>c.name),cast:(m.credits?.cast||[]).slice(0,8).map(c=>({name:c.name,character:c.character})),genres:(m.genres||[]).map(g=>g.name),source_metadata:{...row.source_metadata,poster_tmdb_id:m.id,identity_verified:true}};
  }catch{return row}
 }
 return async req=>{const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'},json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return json({error:'POST required'},405);
  try{const input=await req.json(),result=selectCatalog(await load(),input,recommend),rows=result.results.slice();let next=0;await Promise.all(Array.from({length:Math.min(6,rows.length)},async()=>{while(next<rows.length){const n=next++;if(n<12)rows[n]=await enrich(rows[n])}}));return json({...result,results:rows})}catch{return json({error:'The Cheese Louise catalog could not load. Please retry; broad movie search is disabled.'},503)}
 };
}
