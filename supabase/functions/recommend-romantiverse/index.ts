import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import {favorites,norm,eligible,scoreMovie,diversify,names,identityKey,excludedByIdentity} from './engine.mjs'

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}
const cache=new Map<string,{at:number;value:any}>()
async function mapLimit<T,R>(rows:T[],limit:number,fn:(row:T)=>Promise<R>){
 const out=new Array<R>(rows.length);let next=0
 await Promise.all(Array.from({length:Math.min(limit,rows.length)},async()=>{while(next<rows.length){const i=next++;out[i]=await fn(rows[i])}}));return out
}
async function tmdb(path:string,token:string){
 const hit=cache.get(path);if(hit&&Date.now()-hit.at<1800000)return hit.value
 const response=await fetch('https://api.themoviedb.org/3'+path,{headers:{Authorization:'Bearer '+token,accept:'application/json'},signal:AbortSignal.timeout(7000)})
 if(!response.ok)throw new Error('Movie data provider returned '+response.status)
 const value=await response.json();if(cache.size>=600)cache.delete(cache.keys().next().value!);cache.set(path,{at:Date.now(),value});return value
}
const detail=(id:number,token:string)=>tmdb('/movie/'+id+'?append_to_response=keywords,credits,recommendations&language=en-US',token)
async function resolve(input:any,token:string){
 try{
  if(!input?.title||String(input.title).length>150)return null
  const query=new URLSearchParams({query:input.title,language:'en-US',include_adult:'false'})
  if(input.year)query.set('year',String(input.year))
  const response=await tmdb('/search/movie?'+query,token)
  const exact=(response.results||[]).filter((m:any)=>norm(m.title)===norm(input.title)&&(!input.year||String(m.release_date||'').slice(0,4)===String(input.year)))
  if(exact.length!==1)return null // ambiguous and partial titles are not silently made into favorites
  const movie=await detail(exact[0].id,token)
  if(movie.adult||movie.runtime&&movie.runtime<60)return null
  return {...movie,preference_weight:Math.max(.5,Math.min(2,Number(input.weight||1)))}
 }catch{return null}
}
function matches(movie:any,filters:any){
 const year=Number(String(movie.release_date||'').slice(0,4))
 if(filters.yearMin&&(!year||year<Number(filters.yearMin)))return false
 if(filters.yearMax&&(!year||year>Number(filters.yearMax)))return false
 const body=[movie.title,movie.overview,...names(movie.keywords?.keywords)].join(' ')
 const christmas=/\b(christmas|mistletoe|yuletide)\b/i.test(body)
 const autumn=/\b(autumn|pumpkin|harvest|fall festival|regatta)\b/i.test(body)
 const holiday=christmas?'Christmas':/\bhalloween\b/i.test(body)?'Halloween':/\bthanksgiving\b/i.test(body)?'Thanksgiving':/\bvalentine\b/i.test(body)?"Valentine's Day":null
 const season=christmas?'Winter':autumn||holiday==='Halloween'||holiday==='Thanksgiving'?'Fall':/\bsummer|beach|seaside\b/i.test(body)?'Summer':/\bspring\b/i.test(body)?'Spring':null
 if(filters.holiday&&filters.holiday!=='__unknown__'&&filters.holiday!==holiday)return false
 if(filters.season&&filters.season!=='__unknown__'&&filters.season!==season)return false
 if(filters.studio&&!names(movie.production_companies).some((n:string)=>norm(n)===norm(filters.studio)))return false
 return {holiday,season}
}
export async function recommend(input:any,token:string){
 const liked=(Array.isArray(input.likes)?input.likes:[]).slice(0,8)
 const disliked=(Array.isArray(input.dislikes)?input.dislikes:[]).slice(0,6)
 const rawSeeds=[...liked,...favorites].filter((x,i,a)=>a.findIndex(y=>(identityKey(y)||norm(y.title))===(identityKey(x)||norm(x.title)))===i).slice(0,16)
 const resolved=await mapLimit(rawSeeds,5,s=>resolve(s,token))
 const seeds=resolved.filter(Boolean),negative=(await mapLimit(disliked,3,s=>resolve(s,token))).filter(Boolean)
 if(!seeds.length)throw new Error('Could not match your favorites to movie records. Please try again.')
 const excluded=new Set((Array.isArray(input.exclude_ids)?input.exclude_ids:[]).slice(0,2000).map(Number))
 // Legacy exclude_titles is accepted for older HQ clients; new clients supply year-aware identities.
 const excludedTitles=new Set([...(Array.isArray(input.exclude_titles)?input.exclude_titles:[]),...(Array.isArray(input.exclude_unknown_titles)?input.exclude_unknown_titles:[])].slice(0,2000).map(norm))
 const excludedTitleYears=new Set((Array.isArray(input.exclude_title_years)?input.exclude_title_years:[]).slice(0,2000).filter((v:any)=>typeof v==='string'&&/^[a-z0-9 ]+\|(?:19|20)\d{2}$/.test(v)))
 for(const seed of [...seeds,...negative]){excluded.add(seed.id);const key=identityKey(seed);if(key)excludedTitleYears.add(key);else excludedTitles.add(norm(seed.title))}
 const candidates=new Map<number,any>()
 function add(rows:any[],seedId?:number,probe=false){for(const movie of rows||[]){
  if(!movie.id||movie.adult||excludedByIdentity(movie,excluded,excludedTitleYears,excludedTitles))continue
  const old=candidates.get(movie.id);candidates.set(movie.id,{...movie,probe:probe||old?.probe||false,seed_ids:[...new Set([...(old?.seed_ids||[]),...(seedId?[seedId]:[])])]})
 }}
 for(const seed of seeds)add(seed.recommendations?.results||[],seed.id)
 const batch=Math.max(0,Math.min(10000,Math.trunc(Number(input.batch)||0))),page=1+batch%5
 const keywordCounts=new Map<number,number>()
 for(const seed of seeds)for(const k of seed.keywords?.keywords||[])keywordCounts.set(k.id,(keywordCounts.get(k.id)||0)+1)
 const keywordIds=[...keywordCounts].sort((a,b)=>b[1]-a[1]).slice(0,16).map(x=>x[0])
 const specificKeywordIds=[...new Set(seeds.flatMap(s=>(s.keywords?.keywords||[]).filter((k:any)=>/time travel|time loop|ghost|supernatural|magic|wish|body swap|alternate reality|parallel universe|pretend|fake relationship|fairy tale/i.test(k.name)).map((k:any)=>k.id)))]
 const companies=[...new Set(seeds.flatMap(s=>(s.production_companies||[]).map((c:any)=>c.id)))].slice(0,12)
 const jobs=[]
 const discover=(params:any)=>'/discover/movie?'+new URLSearchParams({language:'en-US',include_adult:'false',with_genres:'10749',without_genres:'27|99|16|28|80|53|10752',page:String(page),...params})
 const premiseTerms=['time travel','time loop','ghost','magic','wish','body swap','pretend relationship'];
 const premiseKeywords=await mapLimit(premiseTerms,5,async query=>{try{const data=await tmdb('/search/keyword?'+new URLSearchParams({query}),token);return (data.results||[]).find((k:any)=>norm(k.name)===norm(query))?.id}catch{return null}})
 for(const id of premiseKeywords.filter(Boolean)){
  for(const sort_by of ['popularity.desc','primary_release_date.desc'])jobs.push(discover({with_keywords:String(id),with_genres:'10749,10770',sort_by,page:String(1+batch%3)}))
 }
 if(specificKeywordIds.length){jobs.push(discover({with_keywords:specificKeywordIds.join('|'),sort_by:'popularity.desc'}));jobs.push(discover({with_keywords:specificKeywordIds.join('|'),sort_by:'primary_release_date.desc'}))}
 if(keywordIds.length){jobs.push(discover({with_keywords:keywordIds.join('|'),sort_by:'popularity.desc'}));jobs.push(discover({with_keywords:keywordIds.join('|'),sort_by:'primary_release_date.desc','primary_release_date.lte':new Date().toISOString().slice(0,10)}))}
 if(companies.length)jobs.push(discover({with_companies:companies.join('|'),sort_by:batch%2?'primary_release_date.desc':'popularity.desc'}))
 // Specific premise searches introduce lesser-known TV romances without coffee/holiday-only matches.
 for(const query of ['magical christmas','christmas wish','time for christmas','ghost of christmas','autumn romance','christmas movie'])jobs.push('/search/movie?'+new URLSearchParams({query,include_adult:'false',language:'en-US',page:String(1+batch%3)}))
 // Identity-checked title probes complement sparse TV-movie keyword tagging.
 const probes=['A Timeless Christmas','A Kiss Before Christmas','Journey Back to Christmas','Snowmance',"Holly's Holiday",'A Christmas Switch','Christmas on Repeat','A Christmas Perfection','12 Dates of Christmas','Christmas Do-Over','The Knight Before Christmas','A Dream of Christmas','Love Strikes Twice','A Kindhearted Christmas','A Heavenly Christmas','Take Me Back for Christmas','A Royal Christmas Crush','Love at Second Sight'];
 const probeStartIndex=jobs.length;
 for(const query of probes)jobs.push('/search/movie?'+new URLSearchParams({query,include_adult:'false',language:'en-US',page:'1'}))
 const retrieved=await mapLimit(jobs,5,async path=>{try{return await tmdb(path,token)}catch{return null}})
 retrieved.forEach((response,i)=>{
  const probe=i>=probeStartIndex;
  const query=probe?new URLSearchParams(jobs[i].split('?')[1]).get('query'):'';
  add((response?.results||[]).filter((m:any)=>!probe||norm(m.title)===norm(query)),undefined,probe);
 })
 const diagnostics:any[]=[];
 const prelim=[...candidates.values()].map(movie=>({movie,score:(movie.probe?90:0)+(scoreMovie(movie,seeds,negative)?.score||0)})).sort((a,b)=>b.score-a.score).slice(0,150).map(row=>row.movie)
 const enriched=await mapLimit(prelim,7,async row=>{
  try{const movie={...await detail(row.id,token),seed_ids:row.seed_ids};const classification=matches(movie,input.filters||{});if(!classification)return null
   const fit=scoreMovie(movie,seeds,negative);
   if(row.probe&&input.debug===true)diagnostics.push({title:movie.title,genres:names(movie.genres),eligible:eligible(movie),fit:fit?.score,overview:movie.overview});
   if(!fit||fit.score<55||!movie.poster_path)return null
   return {movie,fit,classification}
  }catch{return null}
 })
 const ranked=diversify(enriched.filter(Boolean),Math.max(8,Math.min(36,Number(input.max_results)||24)))
 const results=await mapLimit(ranked,6,async({movie:m,fit,classification}:any)=>{
  let us:any={};try{us=(await tmdb('/movie/'+m.id+'/watch/providers',token))?.results?.US||{}}catch{}
  const providers=[...new Set(names([...(us.flatrate||[]),...(us.free||[]),...(us.ads||[])].map(p=>({name:p.provider_name}))))]
  return {tmdb_id:m.id,tmdb_type:'movie',source_type:'tmdb_recommendation',title:m.title,summary:m.overview,tagline:m.tagline,
   premiere_date:m.release_date,year:Number(String(m.release_date||'').slice(0,4))||null,poster_url:'https://image.tmdb.org/t/p/w500'+m.poster_path,
   backdrop_url:m.backdrop_path?'https://image.tmdb.org/t/p/w780'+m.backdrop_path:null,poster_verified:true,
   source_url:'https://www.themoviedb.org/movie/'+m.id,watch_url:us.link||null,providers,network:providers[0]||'Romance',
   genres:names(m.genres),production_companies:names(m.production_companies),keywords:names(m.keywords?.keywords),
   stars:names((m.credits?.cast||[]).slice(0,5)),cast:(m.credits?.cast||[]).slice(0,8).map((c:any)=>({name:c.name,character:c.character})),
   director:names((m.credits?.crew||[]).filter((c:any)=>c.job==='Director')).join(', '),external_ids:m.external_ids||{},
   ...classification,match_score:fit.score,recommendation_score:fit.score,search_score:fit.score,why:fit.reasons,search_reasons:fit.reasons}
 })
 return {results,count:results.length,scanned:candidates.size,eligible_count:enriched.filter(Boolean).length,batch,...(input.debug===true?{diagnostics}:{}),
  matched_favorites:seeds.map(s=>({title:s.title,year:Number(s.release_date.slice(0,4)),tmdb_id:s.id})),
  unmatched_favorites:rawSeeds.filter((_,i)=>!resolved[i]).map(s=>s.title),partial:retrieved.some(x=>!x),
  attribution:{movie_data:'TMDB',streaming_availability:'JustWatch via TMDB'}}
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
 if(req.method!=='POST')return new Response('POST required',{status:405,headers:cors})
 try{const token=Deno.env.get('TMDB_READ_ACCESS_TOKEN');if(!token)throw new Error('Movie data is not configured')
  const input=await req.json();const result=await recommend(input,token)
  return new Response(JSON.stringify(result),{headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}})
 }catch(error){return new Response(JSON.stringify({error:error instanceof Error?error.message:'Recommendations could not load'}),{status:500,headers:{...cors,'Content-Type':'application/json'}})}
})
