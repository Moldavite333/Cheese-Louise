import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const TMDB='https://api.themoviedb.org/3'
const WATCHMODE='https://api.watchmode.com/v1'
const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
}

type InputMovie={
  key?:string|number|null
  catalog_id?:string|null
  title:string
  year?:number|null
  stars?:string[]
  director?:string|null
  studios?:string[]
  imdb_id?:string|null
}

type ResolveResult={
  key:string
  title:string
  verified:boolean
  poster_url:string|null
  backdrop_url:string|null
  poster_source:'tmdb'|'watchmode'|null
  poster_source_id:string|null
  tmdb_id:number|null
  imdb_id:string|null
  match_score:number
  matched_title:string|null
  matched_year:number|null
  matched_cast:string[]
  reason:string
}

function clean(v:any){return String(v??'').trim()}
function norm(v:any){return clean(v).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim()}
function yearOf(v:any){const m=clean(v).match(/\b(19|20)\d{2}\b/);return m?Number(m[0]):null}
function uniq<T>(rows:T[]){return [...new Set(rows)]}
function keyOf(m:InputMovie){return clean(m.key??m.catalog_id??`${m.year||''}|${m.title}`)}
function posterUrl(path:string|null|undefined,size='w780'){return path?`https://image.tmdb.org/t/p/${size}${path}`:null}

async function fetchJson(url:string,headers:Record<string,string>={}){
  const r=await fetch(url,{headers:{accept:'application/json',...headers}})
  if(!r.ok) throw new Error(`${r.status} ${await r.text().then(x=>x.slice(0,220))}`)
  return await r.json()
}
async function tmdb(path:string,token:string){return fetchJson(TMDB+path,{Authorization:`Bearer ${token}`})}
async function mapLimit<T,R>(items:T[],limit:number,fn:(item:T)=>Promise<R>){
  const out=new Array<R>(items.length);let next=0
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(true){const i=next++;if(i>=items.length)break;out[i]=await fn(items[i])}}))
  return out
}

function nameMatch(a:string,b:string){
  const x=norm(a),y=norm(b)
  if(!x||!y)return false
  return x===y||x.includes(y)||y.includes(x)
}

function pickPoster(posters:any[],fallbackPath?:string|null){
  const valid=(posters||[]).filter(p=>{
    const w=Number(p?.width||0),h=Number(p?.height||0),ratio=Number(p?.aspect_ratio||(w&&h?w/h:0))
    return p?.file_path && ratio>=0.55 && ratio<=0.78 && (!w||w>=300) && (!h||h>=450)
  })
  valid.sort((a,b)=>{
    const lang=(p:any)=>p?.iso_639_1==='en'?3:p?.iso_639_1==null?2:1
    return lang(b)-lang(a) || Number(b?.vote_average||0)-Number(a?.vote_average||0) || Number(b?.vote_count||0)-Number(a?.vote_count||0) || Number(b?.width||0)-Number(a?.width||0)
  })
  return valid[0]?.file_path || fallbackPath || null
}

function scoreCandidate(input:InputMovie,detail:any){
  const inputTitle=norm(input.title),candidateTitle=norm(detail?.title||detail?.original_title||'')
  if(!inputTitle||inputTitle!==candidateTitle) return {score:0,verified:false,castMatches:[] as string[],reason:'title mismatch'}

  let score=50
  const inputYear=Number(input.year||0)||null
  const candidateYear=yearOf(detail?.release_date)
  if(inputYear){
    if(candidateYear===inputYear) score+=25
    else return {score:0,verified:false,castMatches:[] as string[],reason:`year mismatch (${candidateYear||'unknown'})`}
  }else if(candidateYear) score+=5

  const sourceStars=(Array.isArray(input.stars)?input.stars:[]).map(clean).filter(Boolean).slice(0,4)
  const castNames=(detail?.credits?.cast||[]).slice(0,16).map((c:any)=>clean(c?.name)).filter(Boolean)
  const castMatches=sourceStars.filter(star=>castNames.some((name:string)=>nameMatch(star,name)))
  if(sourceStars.length){
    if(!castMatches.length) return {score:0,verified:false,castMatches:[] as string[],reason:'lead cast did not match'}
    score+=Math.min(20,castMatches.length*10)
  }

  const director=clean(input.director)
  if(director){
    const directors=(detail?.credits?.crew||[]).filter((c:any)=>String(c?.job||'').toLowerCase()==='director').map((c:any)=>clean(c?.name)).filter(Boolean)
    if(directors.some((name:string)=>nameMatch(director,name))) score+=10
  }

  const studios=(Array.isArray(input.studios)?input.studios:[]).map(clean).filter(Boolean)
  if(studios.length){
    const candidateStudios=(detail?.production_companies||[]).map((c:any)=>clean(c?.name)).filter(Boolean)
    if(studios.some(s=>candidateStudios.some((x:string)=>nameMatch(s,x)))) score+=5
  }

  return {score:Math.min(100,score),verified:score>=75,castMatches,reason:'verified by title/year/cast'}
}

async function resolveWithTmdb(input:InputMovie,token:string){
  const params=new URLSearchParams({query:input.title,language:'en-US',include_adult:'false',page:'1'})
  if(input.year) params.set('year',String(input.year))
  const search=await tmdb('/search/movie?'+params.toString(),token)
  const candidates=(search?.results||[]).slice(0,8)
  if(!candidates.length) return null

  const enriched=await mapLimit(candidates,4,async (row:any)=>{
    try{
      const detail=await tmdb(`/movie/${Number(row.id)}?`+new URLSearchParams({language:'en-US',append_to_response:'credits,external_ids'}).toString(),token)
      const match=scoreCandidate(input,detail)
      return {detail,match}
    }catch(_){return null}
  })
  const verified=enriched.filter(Boolean).filter((x:any)=>x.match.verified).sort((a:any,b:any)=>b.match.score-a.match.score)
  const best:any=verified[0]
  if(!best) return null

  let images:any={posters:[],backdrops:[]}
  try{images=await tmdb(`/movie/${best.detail.id}/images?`+new URLSearchParams({include_image_language:'en,null'}).toString(),token)}catch(_){}
  const path=pickPoster(images?.posters||[],best.detail?.poster_path||null)
  const backdrop=(images?.backdrops||[]).filter((x:any)=>x?.file_path).sort((a:any,b:any)=>Number(b?.vote_average||0)-Number(a?.vote_average||0))[0]?.file_path||best.detail?.backdrop_path||null

  return {
    id:Number(best.detail.id),
    imdb_id:clean(best.detail?.external_ids?.imdb_id)||null,
    title:clean(best.detail?.title)||input.title,
    year:yearOf(best.detail?.release_date),
    castMatches:best.match.castMatches,
    score:Number(best.match.score||0),
    poster_url:posterUrl(path,'w780'),
    backdrop_url:posterUrl(backdrop,'w1280')
  }
}

async function resolveWithWatchmode(input:InputMovie,tmdbMatch:any,apiKey:string){
  try{
    let search:any=null
    if(tmdbMatch?.id){
      search=await fetchJson(`${WATCHMODE}/search/?`+new URLSearchParams({search_field:'tmdb_movie_id',search_value:String(tmdbMatch.id),types:'movie'}).toString(),{'X-API-Key':apiKey})
    }else{
      search=await fetchJson(`${WATCHMODE}/search/?`+new URLSearchParams({search_field:'name',search_value:input.title,types:'movie'}).toString(),{'X-API-Key':apiKey})
    }
    const rows=Array.isArray(search?.title_results)?search.title_results:[]
    const exact=rows.find((r:any)=>norm(r?.name)===norm(input.title) && (!input.year||Number(r?.year)===Number(input.year)))
    if(!exact?.id) return null
    const detail=await fetchJson(`${WATCHMODE}/title/${exact.id}/details/`,{'X-API-Key':apiKey})
    const poster=detail?.posterLarge||detail?.posterMedium||detail?.poster||null
    if(!poster) return null
    return {id:String(exact.id),poster_url:String(poster),backdrop_url:detail?.backdrop?String(detail.backdrop):null,imdb_id:clean(detail?.imdb_id||exact?.imdb_id)||null}
  }catch(_){return null}
}

async function resolveOne(input:InputMovie,token:string,watchmodeKey:string|null):Promise<ResolveResult>{
  const key=keyOf(input)
  try{
    const tm=await resolveWithTmdb(input,token)
    if(tm?.poster_url){
      return {key,title:input.title,verified:true,poster_url:tm.poster_url,backdrop_url:tm.backdrop_url||null,poster_source:'tmdb',poster_source_id:String(tm.id),tmdb_id:tm.id,imdb_id:tm.imdb_id||null,match_score:tm.score,matched_title:tm.title,matched_year:tm.year,matched_cast:tm.castMatches||[],reason:'TMDB poster verified against Hallmark title/year/cast'}
    }
    if(watchmodeKey){
      const wm=await resolveWithWatchmode(input,tm,watchmodeKey)
      if(wm?.poster_url){
        return {key,title:input.title,verified:true,poster_url:wm.poster_url,backdrop_url:wm.backdrop_url||tm?.backdrop_url||null,poster_source:'watchmode',poster_source_id:String(wm.id),tmdb_id:tm?.id||null,imdb_id:wm.imdb_id||tm?.imdb_id||null,match_score:tm?.score||75,matched_title:tm?.title||input.title,matched_year:tm?.year||Number(input.year)||null,matched_cast:tm?.castMatches||[],reason:'Watchmode poster matched after canonical movie verification'}
      }
    }
    return {key,title:input.title,verified:false,poster_url:null,backdrop_url:tm?.backdrop_url||null,poster_source:null,poster_source_id:null,tmdb_id:tm?.id||null,imdb_id:tm?.imdb_id||null,match_score:tm?.score||0,matched_title:tm?.title||null,matched_year:tm?.year||null,matched_cast:tm?.castMatches||[],reason:tm?'Verified movie found, but no usable poster was available':'No sufficiently verified poster match'}
  }catch(e){
    return {key,title:input.title,verified:false,poster_url:null,backdrop_url:null,poster_source:null,poster_source_id:null,tmdb_id:null,imdb_id:null,match_score:0,matched_title:null,matched_year:null,matched_cast:[],reason:e instanceof Error?e.message:String(e)}
  }
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return new Response(JSON.stringify({error:'POST required'}),{status:405,headers:{...cors,'Content-Type':'application/json'}})
  try{
    const token=Deno.env.get('TMDB_READ_ACCESS_TOKEN')
    if(!token) throw new Error('TMDB_READ_ACCESS_TOKEN is not configured')
    const watchmodeKey=Deno.env.get('WATCHMODE_API_KEY')||null
    const body=await req.json().catch(()=>({}))
    const rows=(Array.isArray(body?.movies)?body.movies:[body?.movie]).filter(Boolean).slice(0,120) as InputMovie[]
    const valid=rows.filter(row=>clean(row?.title))
    const results=await mapLimit(valid,5,row=>resolveOne(row,token,watchmodeKey))
    return new Response(JSON.stringify({count:results.length,watchmode_fallback_configured:!!watchmodeKey,results}),{headers:{...cors,'Content-Type':'application/json','Cache-Control':'private, max-age=3600'}})
  }catch(e){
    return new Response(JSON.stringify({error:e instanceof Error?e.message:String(e)}),{status:500,headers:{...cors,'Content-Type':'application/json'}})
  }
})
