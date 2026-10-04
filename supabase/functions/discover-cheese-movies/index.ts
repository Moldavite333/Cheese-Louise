import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const TMDB='https://api.themoviedb.org/3'
const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
}

type Movie={id:number;title?:string;original_title?:string;overview?:string;release_date?:string;poster_path?:string|null;backdrop_path?:string|null;genre_ids?:number[];popularity?:number;vote_average?:number;vote_count?:number;adult?:boolean}
type Provider={provider_id:number;provider_name:string;logo_path?:string}

function iso(d:Date){return d.toISOString().slice(0,10)}
function plusDays(d:Date,n:number){const x=new Date(d);x.setUTCDate(x.getUTCDate()+n);return x}

function signals(m:Movie){
  const text=((m.title||'')+' '+(m.overview||'')).toLowerCase()
  const g=new Set(m.genre_ids||[])
  let score=0
  const why:string[]=[]
  const add=(label:string,pts:number,patterns:string[])=>{if(patterns.some(p=>text.includes(p))){score+=pts;why.push(label)}}
  if(g.has(10749)){score+=8;why.push('romance')}
  if(g.has(10770)){score+=7;why.push('TV movie')}
  if(g.has(35))score+=2
  if(g.has(10751))score+=2
  add('Christmas',14,['christmas','mistletoe','santa','yuletide'])
  add('holiday',8,['holiday','festive'])
  add('Halloween',12,['halloween','pumpkin'])
  add("Valentine's",10,['valentine'])
  add('Thanksgiving',10,['thanksgiving'])
  add('wedding',9,['wedding','bride','groom','engagement'])
  add('royalty',10,['prince','princess','royal','kingdom','duke','duchess'])
  add('small town',10,['small town','small-town'])
  add('hometown return',9,['hometown','returns home','return home','back home','comes home'])
  add('bakery',10,['bakery','baker','pastry shop'])
  add('Christmas tree farm',12,['tree farm','christmas tree farm'])
  add('inn / lodge',7,[' inn ','lodge','bed and breakfast','b&b'])
  add('vineyard / winery',8,['vineyard','winery','winemaker'])
  add('ranch / farm',6,['ranch',' family farm','farmhouse'])
  add('dead spouse',9,['widow','widower','late husband','late wife'])
  add('single parent',6,['single mom','single mother','single dad','single father'])
  add('old flame',7,['old flame','first love','childhood sweetheart','former sweetheart','reconnects with'])
  add('family business',8,['family business','family shop','family store','family bakery','family inn'])
  add('festival / town event',6,['festival','tree lighting','tree-lighting','parade','town event'])
  add('snowed-in',6,['snowed in','blizzard','snowstorm'])
  add('magic / wish',7,['magic','magical','wish comes true','christmas wish'])
  add('fake relationship',8,['fake dating','pretend to date','pretend couple','fake relationship'])
  add('save-the-something plot',5,['save the ','saving the ','keep the ','struggling'])
  add('inheritance',6,['inherits','inheritance','inherited'])
  if(g.has(27))score-=10
  if(g.has(80))score-=8
  if(g.has(53))score-=6
  if(g.has(10752))score-=10
  if(!m.overview)score-=2
  return {score:Math.max(0,score),why:[...new Set(why)].slice(0,10)}
}

function holidayText(title:string,overview:string,keywords:string[]){
  const t=(title+' '+overview+' '+keywords.join(' ')).toLowerCase()
  if(/christmas|mistletoe|santa|yuletide/.test(t))return 'Christmas'
  if(/halloween|pumpkin/.test(t))return 'Halloween'
  if(/thanksgiving/.test(t))return 'Thanksgiving'
  if(/valentine/.test(t))return "Valentine's Day"
  if(/new year/.test(t))return "New Year's"
  if(/easter/.test(t))return 'Easter'
  if(/st\. patrick|saint patrick/.test(t))return "St. Patrick's Day"
  if(/fourth of july|4th of july|independence day/.test(t))return 'Fourth of July'
  return null
}

function seasonText(title:string,overview:string,keywords:string[],h:string|null){
  if(h==='Christmas'||h==="New Year's"||h==="Valentine's Day")return 'Winter'
  if(h==='Halloween'||h==='Thanksgiving')return 'Fall'
  if(h==='Easter'||h==="St. Patrick's Day")return 'Spring'
  if(h==='Fourth of July')return 'Summer'
  const t=(title+' '+overview+' '+keywords.join(' ')).toLowerCase()
  if(/summer|beach|seaside|summer camp|island vacation/.test(t))return 'Summer'
  if(/autumn|fall festival|pumpkin|harvest/.test(t))return 'Fall'
  if(/winter|snow|ski lodge|blizzard/.test(t))return 'Winter'
  if(/spring|springtime|garden festival/.test(t))return 'Spring'
  return null
}

function providerLabel(names:string[]){
  const order=[/hallmark/i,/lifetime/i,/netflix/i,/prime video|amazon prime/i,/hulu/i,/peacock/i,/tubi/i,/roku/i,/up faith|uptv/i,/great american|pure flix/i]
  for(const rx of order){const hit=names.find(n=>rx.test(n));if(hit)return hit}
  return names[0]||'Streaming / TV'
}

async function tmdb(path:string,token:string){
  const r=await fetch(TMDB+path,{headers:{Authorization:'Bearer '+token,accept:'application/json'}})
  if(!r.ok)throw new Error('TMDB '+r.status+': '+(await r.text()).slice(0,240))
  return await r.json()
}

async function mapLimit<T,R>(items:T[],limit:number,fn:(v:T)=>Promise<R>){
  const out=new Array<R>(items.length);let next=0
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(true){const i=next++;if(i>=items.length)break;out[i]=await fn(items[i])}}))
  return out
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return new Response(JSON.stringify({error:'POST required'}),{status:405,headers:{...cors,'Content-Type':'application/json'}})
  try{
    const token=Deno.env.get('TMDB_READ_ACCESS_TOKEN')
    if(!token)throw new Error('TMDB_READ_ACCESS_TOKEN is not configured')
    const input=await req.json().catch(()=>({}))
    const daysBack=Math.max(30,Math.min(1460,Number(input.days_back??730)))
    const daysForward=Math.max(30,Math.min(730,Number(input.days_forward??365)))
    const maxResults=Math.max(10,Math.min(80,Number(input.max_results??48)))
    const today=new Date(), start=iso(plusDays(today,-daysBack)), end=iso(plusDays(today,daysForward)), upcomingStart=iso(plusDays(today,-30))

    const jobs:Promise<any>[]=[]
    const addDiscover=(genres:string,from:string,to:string,pages:number,streamingOnly:boolean)=>{
      for(let page=1;page<=pages;page++){
        const q=new URLSearchParams({language:'en-US',region:'US',include_adult:'false',sort_by:'primary_release_date.desc','primary_release_date.gte':from,'primary_release_date.lte':to,with_genres:genres,page:String(page)})
        if(streamingOnly){q.set('watch_region','US');q.set('with_watch_monetization_types','flatrate|free|ads')}
        jobs.push(tmdb('/discover/movie?'+q.toString(),token))
      }
    }
    addDiscover('10749',start,end,3,true)
    addDiscover('10770',start,end,3,true)
    addDiscover('10749',upcomingStart,end,3,false)
    addDiscover('10770',upcomingStart,end,3,false)

    const pages=await Promise.all(jobs)
    const byId=new Map<number,Movie>()
    for(const page of pages){for(const m of(page.results||[])){if(!m?.id||m.adult)continue;const old=byId.get(m.id);if(!old||Number(m.popularity||0)>Number(old.popularity||0))byId.set(m.id,m)}}

    const ranked=[...byId.values()].map(movie=>({movie,...signals(movie)})).filter(x=>x.score>=7).sort((a,b)=>b.score-a.score||Number(b.movie.popularity||0)-Number(a.movie.popularity||0)).slice(0,Math.min(56,maxResults+8))

    const enriched=await mapLimit(ranked,6,async(entry)=>{
      let detail:any={}
      let providerData:any={}
      try{
        const q=new URLSearchParams({language:'en-US',append_to_response:'keywords,credits,external_ids'})
        const results=await Promise.all([
          tmdb('/movie/'+entry.movie.id+'?'+q.toString(),token),
          tmdb('/movie/'+entry.movie.id+'/watch/providers',token)
        ])
        detail=results[0]||{}
        providerData=results[1]||{}
      }catch(_){
        try{providerData=await tmdb('/movie/'+entry.movie.id+'/watch/providers',token)}catch(__){}
      }

      const us=providerData?.results?.US||{}
      const all=[...(us.flatrate||[]),...(us.free||[]),...(us.ads||[])] as Provider[]
      const seen=new Set<number>()
      const providers=all.filter(p=>p?.provider_id&&!seen.has(p.provider_id)&&seen.add(p.provider_id))
      const names=providers.map(p=>p.provider_name).filter(Boolean)
      const watchUrl=us.link||null

      const keywords=(detail?.keywords?.keywords||[]).map((k:any)=>k?.name).filter(Boolean).slice(0,24)
      const genres=(detail?.genres||[]).map((g:any)=>g?.name).filter(Boolean)
      const productionCompanies=(detail?.production_companies||[]).map((c:any)=>c?.name).filter(Boolean).slice(0,12)
      const castCharacters=(detail?.credits?.cast||[]).map((c:any)=>c?.character).filter(Boolean).slice(0,16)
      const title=detail?.title||entry.movie.title||entry.movie.original_title||'Untitled'
      const overview=detail?.overview||entry.movie.overview||''
      const h=holidayText(title,overview,keywords)
      const s=seasonText(title,overview,keywords,h)

      return {
        tmdb_id:entry.movie.id,
        tmdb_type:'movie',
        title,
        summary:overview,
        tagline:detail?.tagline||null,
        keywords,
        genres,
        production_companies:productionCompanies,
        cast_characters:castCharacters,
        external_ids:detail?.external_ids||{},
        premiere_date:detail?.release_date||entry.movie.release_date||null,
        poster_url:(detail?.poster_path||entry.movie.poster_path)?'https://image.tmdb.org/t/p/w500'+(detail?.poster_path||entry.movie.poster_path):null,
        backdrop_url:(detail?.backdrop_path||entry.movie.backdrop_path)?'https://image.tmdb.org/t/p/w780'+(detail?.backdrop_path||entry.movie.backdrop_path):null,
        source_url:'https://www.themoviedb.org/movie/'+entry.movie.id,
        watch_url:watchUrl,
        providers:names,
        network:providerLabel(names),
        holiday:h,
        season:s,
        match_score:Math.min(100,entry.score),
        why:entry.why,
        popularity:Number(detail?.popularity??entry.movie.popularity??0),
        vote_average:Number(detail?.vote_average??entry.movie.vote_average??0),
        vote_count:Number(detail?.vote_count??entry.movie.vote_count??0)
      }
    })

    enriched.sort((a,b)=>b.match_score-a.match_score||(b.premiere_date||'').localeCompare(a.premiere_date||'')||b.popularity-a.popularity)
    return new Response(JSON.stringify({
      generated_at:new Date().toISOString(),
      window:{start,end},
      count:Math.min(maxResults,enriched.length),
      results:enriched.slice(0,maxResults),
      attribution:{movie_data:'TMDB',streaming_availability:'JustWatch via TMDB',enrichment:['TMDB keywords','TMDB tagline','TMDB genres','TMDB production companies','TMDB cast character names']}
    }),{headers:{...cors,'Content-Type':'application/json','Cache-Control':'private, max-age=900'}})
  }catch(e){
    const message=e instanceof Error?e.message:String(e)
    console.error(message)
    return new Response(JSON.stringify({error:message}),{status:500,headers:{...cors,'Content-Type':'application/json'}})
  }
})
