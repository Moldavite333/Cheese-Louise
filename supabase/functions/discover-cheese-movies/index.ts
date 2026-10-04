import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const TMDB='https://api.themoviedb.org/3'
const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
}

type Movie={id:number;title?:string;original_title?:string;overview?:string;release_date?:string;poster_path?:string|null;backdrop_path?:string|null;genre_ids?:number[];popularity?:number;vote_average?:number;vote_count?:number;adult?:boolean}
type Provider={provider_id:number;provider_name:string;logo_path?:string}
type Ranked={movie:Movie;score:number;why:string[];rawHoliday:string|null;rawSeason:string|null;bucket:string}

function iso(d:Date){return d.toISOString().slice(0,10)}
function plusDays(d:Date,n:number){const x=new Date(d);x.setUTCDate(x.getUTCDate()+n);return x}

const GENERIC_WHY=new Set(['romance','TV movie','Christmas','holiday','Halloween','Thanksgiving',"Valentine's",'Fall / harvest','Winter','Spring','Summer'])
const TRUSTED_CHEESE_MAKERS=[
  /hallmark|crown media/i,
  /lifetime|a&e television/i,
  /marvista/i,
  /reel one/i,
  /great american|gac family|great american family/i,
  /up faith|uptv/i,
  /nicely entertainment/i,
  /incendo/i,
  /front street pictures/i,
  /johnson production group/i,
  /brain power studio/i,
  /champlain media/i,
  /cmw .*productions|cmw horizon/i,
  /muse entertainment/i,
  /larry levinson/i
]

function signals(m:Movie){
  const text=((m.title||'')+' '+(m.overview||'')).toLowerCase()
  const g=new Set(m.genre_ids||[])
  let score=0
  const why:string[]=[]
  const add=(label:string,pts:number,patterns:string[])=>{if(patterns.some(p=>text.includes(p))){score+=pts;why.push(label)}}

  if(g.has(10749)){score+=10;why.push('romance')}
  if(g.has(10770)){score+=10;why.push('TV movie')}
  if(g.has(35))score+=2
  if(g.has(10751))score+=2

  add('Christmas',5,['christmas','mistletoe','santa','yuletide','christmas tree'])
  add('holiday',3,['holiday','festive'])
  add('Halloween',6,['halloween','haunted','spooky','trick or treat','costume party'])
  add('Thanksgiving',6,['thanksgiving','friendsgiving','turkey dinner'])
  add("Valentine's",5,['valentine','february 14'])
  add('Fall / harvest',6,['autumn','fall festival','harvest','october','pumpkin patch','apple orchard','apple picking','cider','hayride','corn maze'])
  add('Winter',3,['winter','snow','ski lodge','ski resort','blizzard'])
  add('Spring',3,['spring','springtime','garden festival','flower festival'])
  add('Summer',3,['summer','beach','seaside','lake house','summer camp','boardwalk','island vacation'])

  add('wedding',7,['wedding','bride','groom','engagement'])
  add('royalty',7,['prince','princess','royal','kingdom','duke','duchess'])
  add('small town',9,['small town','small-town'])
  add('hometown return',8,['hometown','returns home','return home','back home','comes home'])
  add('bakery',8,['bakery','baker','pastry shop'])
  add('tree farm',7,['tree farm'])
  add('inn / lodge',6,[' inn ','lodge','bed and breakfast','b&b'])
  add('vineyard / winery',7,['vineyard','winery','winemaker'])
  add('ranch / farm',6,['ranch',' family farm','farmhouse'])
  add('dead spouse',7,['widow','widower','late husband','late wife'])
  add('single parent',6,['single mom','single mother','single dad','single father'])
  add('old flame',7,['old flame','first love','childhood sweetheart','former sweetheart','reconnects with'])
  add('family business',7,['family business','family shop','family store','family bakery','family inn'])
  add('festival / town event',6,['festival','tree lighting','tree-lighting','parade','town event','county fair','fairgrounds'])
  add('snowed-in',5,['snowed in','blizzard','snowstorm'])
  add('magic / wish',5,['magic','magical','wish comes true','christmas wish'])
  add('fake relationship',7,['fake dating','pretend to date','pretend couple','fake relationship'])
  add('save-the-something plot',5,['save the ','saving the ','keep the ','struggling'])
  add('inheritance',6,['inherits','inheritance','inherited'])
  add('competition',5,['competition','contest','regatta','bake-off','cook-off','pageant'])
  add('career-vs-love',6,['promotion','career opportunity','job offer','big city job','dream job'])

  if(g.has(27))score-=20
  if(g.has(80))score-=14
  if(g.has(53))score-=12
  if(g.has(10752))score-=20
  if(g.has(28))score-=10
  if(g.has(99))score-=20
  if(!m.overview)score-=2
  return {score:Math.max(0,score),why:[...new Set(why)].slice(0,14)}
}

function holidayText(title:string,overview:string,keywords:string[]){
  const t=(title+' '+overview+' '+keywords.join(' ')).toLowerCase()
  if(/christmas|mistletoe|santa|yuletide/.test(t))return 'Christmas'
  if(/halloween|trick.?or.?treat|haunted|costume party|spooky season/.test(t))return 'Halloween'
  if(/thanksgiving|friendsgiving|turkey dinner/.test(t))return 'Thanksgiving'
  if(/valentine|february 14/.test(t))return "Valentine's Day"
  if(/new year/.test(t))return "New Year's"
  if(/easter/.test(t))return 'Easter'
  if(/st\. patrick|saint patrick/.test(t))return "St. Patrick's Day"
  if(/fourth of july|4th of july|independence day/.test(t))return 'Fourth of July'
  if(/mother'?s day|mothers day/.test(t))return "Mother's Day"
  if(/father'?s day|fathers day/.test(t))return "Father's Day"
  return null
}

function seasonText(title:string,overview:string,keywords:string[],h:string|null){
  if(h==='Christmas'||h==="New Year's"||h==="Valentine's Day")return 'Winter'
  if(h==='Halloween'||h==='Thanksgiving')return 'Fall'
  if(h==='Easter'||h==="St. Patrick's Day"||h==="Mother's Day")return 'Spring'
  if(h==='Fourth of July'||h==="Father's Day")return 'Summer'
  const t=(title+' '+overview+' '+keywords.join(' ')).toLowerCase()
  if(/autumn|\bfall\b|fall festival|harvest|october|pumpkin|apple orchard|apple picking|cider|hayride|corn maze|leaf peep|changing leaves/.test(t))return 'Fall'
  if(/winter|snow|ski lodge|ski resort|blizzard|ice skating|frozen lake/.test(t))return 'Winter'
  if(/spring|springtime|garden festival|flower festival|blossom|tulip/.test(t))return 'Spring'
  if(/summer|beach|seaside|summer camp|island vacation|boardwalk|lake house|lakehouse|county fair|barbecue|bbq/.test(t))return 'Summer'
  return null
}

function themeBucket(holiday:string|null,season:string|null){
  if(holiday==='Halloween')return 'Halloween'
  if(holiday==='Thanksgiving')return 'Thanksgiving'
  if(holiday==='Christmas')return 'Christmas'
  if(holiday==="Valentine's Day")return "Valentine's"
  if(holiday)return holiday
  if(season==='Fall')return 'Fall / Harvest'
  if(season==='Winter')return 'Winter / Non-Christmas'
  if(season==='Spring')return 'Spring'
  if(season==='Summer')return 'Summer'
  return 'General Romance'
}

function providerLabel(names:string[]){
  const order=[/hallmark/i,/lifetime/i,/great american|gac|pure flix/i,/up faith|uptv/i,/netflix/i,/prime video|amazon prime/i,/hulu/i,/peacock/i,/tubi/i,/roku/i]
  for(const rx of order){const hit=names.find(n=>rx.test(n));if(hit)return hit}
  return names[0]||'Streaming / TV'
}

function cheeseLouiseProfile(args:{
  title:string; overview:string; keywords:string[]; genres:string[];
  productionCompanies:string[]; providers:string[]; why:string[];
  holiday:string|null; season:string|null
}){
  const genreText=args.genres.join(' ').toLowerCase()
  const combined=(args.title+' '+args.overview+' '+args.keywords.join(' ')).toLowerCase()
  const hasRomance=/\bromance\b/.test(genreText) || /\bromance\b|falls? (?:in )?love|falling in love|love interest|sweetheart|matchmaker|dating|engaged|fianc[eé]|wedding/.test(combined)
  const isTvMovie=/tv movie/.test(genreText)
  const trustedText=[...args.productionCompanies,...args.providers].join(' ')
  const trusted=TRUSTED_CHEESE_MAKERS.some(rx=>rx.test(trustedText))
  const hardGenre=/horror|crime|thriller|war|documentary|action/.test(genreText)
  const tropeHits=[...new Set(args.why.filter(x=>!GENERIC_WHY.has(x)))]
  const seasonal=Boolean(args.holiday||args.season)

  let eligible=false
  let fit=''
  if(hardGenre && !hasRomance){
    eligible=false
  }else if(isTvMovie && hasRomance){
    eligible=true;fit='TV romance'
  }else if(trusted && hasRomance){
    eligible=true;fit='trusted Romantiverse studio'
  }else if(trusted && (isTvMovie||tropeHits.length>=1)){
    eligible=true;fit='trusted made-for-TV cheese maker'
  }else if(hasRomance && seasonal && tropeHits.length>=1){
    eligible=true;fit='seasonal Romantiverse romance'
  }else if(hasRomance && tropeHits.length>=3){
    eligible=true;fit='strong Romantiverse trope profile'
  }

  const bonus=(isTvMovie?10:0)+(trusted?12:0)+Math.min(18,tropeHits.length*3)+(seasonal?3:0)
  return {eligible,fit,bonus,tropeHits,hasRomance,isTvMovie,trusted}
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

function sortRanked(a:Ranked,b:Ranked){
  return b.score-a.score || (b.movie.release_date||'').localeCompare(a.movie.release_date||'') || Number(b.movie.popularity||0)-Number(a.movie.popularity||0)
}

function balancedTake<T extends {bucket:string}>(items:T[],limit:number,bucketOrder:string[]){
  const groups=new Map<string,T[]>()
  for(const item of items){
    const key=item.bucket||'General Romance'
    if(!groups.has(key))groups.set(key,[])
    groups.get(key)!.push(item)
  }
  const order=[...bucketOrder,...[...groups.keys()].filter(k=>!bucketOrder.includes(k))]
  const out:T[]=[]
  let cursor=0
  while(out.length<limit){
    let added=false
    for(const key of order){
      const group=groups.get(key)
      if(group&&cursor<group.length){out.push(group[cursor]);added=true;if(out.length>=limit)break}
    }
    if(!added)break
    cursor++
  }
  return out
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return new Response(JSON.stringify({error:'POST required'}),{status:405,headers:{...cors,'Content-Type':'application/json'}})
  try{
    const token=Deno.env.get('TMDB_READ_ACCESS_TOKEN')
    if(!token)throw new Error('TMDB_READ_ACCESS_TOKEN is not configured')
    const input=await req.json().catch(()=>({}))
    const daysBack=Math.max(365,Math.min(5475,Number(input.days_back??5475)))
    const daysForward=Math.max(30,Math.min(730,Number(input.days_forward??730)))
    const maxResults=Math.max(24,Math.min(120,Number(input.max_results??120)))
    const today=new Date(), start=iso(plusDays(today,-daysBack)), end=iso(plusDays(today,daysForward))

    const minYear=new Date(start+'T00:00:00Z').getUTCFullYear()
    const maxYear=new Date(end+'T00:00:00Z').getUTCFullYear()
    const currentYear=today.getUTCFullYear()
    const jobs:string[]=[]
    const addDiscover=(genres:string,from:string,to:string,pages:number)=>{
      for(let page=1;page<=pages;page++){
        const q=new URLSearchParams({language:'en-US',region:'US',include_adult:'false',sort_by:'primary_release_date.desc','primary_release_date.gte':from,'primary_release_date.lte':to,with_genres:genres,page:String(page)})
        jobs.push('/discover/movie?'+q.toString())
      }
    }

    for(let year=minYear;year<=maxYear;year++){
      const from=year===minYear?start:`${year}-01-01`
      const to=year===maxYear?end:`${year}-12-31`
      const pages=Math.abs(year-currentYear)<=2?4:3
      addDiscover('10749',from,to,pages)
      addDiscover('10770',from,to,pages)
    }

    const pages=await mapLimit(jobs,8,path=>tmdb(path,token))
    const byId=new Map<number,Movie>()
    for(const page of pages){
      for(const m of(page?.results||[])){
        if(!m?.id||m.adult)continue
        const old=byId.get(m.id)
        if(!old||Number(m.popularity||0)>Number(old.popularity||0))byId.set(m.id,m)
      }
    }

    const ranked:Ranked[]=[...byId.values()].map(movie=>{
      const sig=signals(movie)
      const title=movie.title||movie.original_title||''
      const overview=movie.overview||''
      const rawHoliday=holidayText(title,overview,[])
      const rawSeason=seasonText(title,overview,[],rawHoliday)
      return {movie,...sig,rawHoliday,rawSeason,bucket:themeBucket(rawHoliday,rawSeason)}
    }).filter(x=>x.score>=8)

    const bucketOrder=['Fall / Harvest','Halloween','Thanksgiving','General Romance','Christmas','Winter / Non-Christmas','Spring','Summer',"Valentine's"]
    const sortedRanked=[...ranked].sort(sortRanked)
    const preEnrichLimit=Math.min(sortedRanked.length,Math.max(maxResults*3,260))
    const preselected=balancedTake(sortedRanked,preEnrichLimit,bucketOrder)

    const enriched=await mapLimit(preselected,8,async(entry)=>{
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
      const all=[...(us.flatrate||[]),...(us.free||[]),...(us.ads||[]),...(us.buy||[]),...(us.rent||[])] as Provider[]
      const seen=new Set<number>()
      const providers=all.filter(p=>p?.provider_id&&!seen.has(p.provider_id)&&seen.add(p.provider_id))
      const names=providers.map(p=>p.provider_name).filter(Boolean)
      const watchUrl=us.link||null

      const keywords=(detail?.keywords?.keywords||[]).map((k:any)=>k?.name).filter(Boolean).slice(0,30)
      const genres=(detail?.genres||[]).map((g:any)=>g?.name).filter(Boolean)
      const productionCompanies=(detail?.production_companies||[]).map((c:any)=>c?.name).filter(Boolean).slice(0,16)
      const castCharacters=(detail?.credits?.cast||[]).map((c:any)=>c?.character).filter(Boolean).slice(0,16)
      const title=detail?.title||entry.movie.title||entry.movie.original_title||'Untitled'
      const overview=detail?.overview||entry.movie.overview||''
      const detailedGenreIds=(detail?.genres||[]).map((g:any)=>Number(g?.id)).filter(Boolean)
      const sig=signals({...entry.movie,title,overview,genre_ids:detailedGenreIds.length?detailedGenreIds:entry.movie.genre_ids})
      const h=holidayText(title,overview,keywords)
      const s=seasonText(title,overview,keywords,h)
      const bucket=themeBucket(h,s)
      const profile=cheeseLouiseProfile({title,overview,keywords,genres,productionCompanies,providers:names,why:sig.why,holiday:h,season:s})

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
        bucket,
        cheese_louise_eligible:profile.eligible,
        cheese_louise_fit:profile.fit,
        match_score:Math.min(100,sig.score+profile.bonus),
        why:[...new Set([profile.fit?`Cheese Louise: ${profile.fit}`:'',...entry.why,...sig.why])].filter(Boolean).slice(0,14),
        popularity:Number(detail?.popularity??entry.movie.popularity??0),
        vote_average:Number(detail?.vote_average??entry.movie.vote_average??0),
        vote_count:Number(detail?.vote_count??entry.movie.vote_count??0)
      }
    })

    const cheeseOnly=enriched.filter((x:any)=>x.cheese_louise_eligible)
    cheeseOnly.sort((a:any,b:any)=>b.match_score-a.match_score||(b.premiere_date||'').localeCompare(a.premiere_date||'')||b.popularity-a.popularity)
    const balanced=balancedTake(cheeseOnly,maxResults,bucketOrder)
    const coverage=balanced.reduce((acc:any,item:any)=>{const k=item.bucket||'General Romance';acc[k]=(acc[k]||0)+1;return acc},{})

    return new Response(JSON.stringify({
      generated_at:new Date().toISOString(),
      window:{start,end},
      scanned_candidates:byId.size,
      enriched_candidates:enriched.length,
      cheese_louise_candidates:cheeseOnly.length,
      rejected_non_romantiverse:Math.max(0,enriched.length-cheeseOnly.length),
      count:balanced.length,
      coverage,
      results:balanced,
      mode:'cheese-louise-only',
      attribution:{movie_data:'TMDB',streaming_availability:'JustWatch via TMDB',enrichment:['TMDB keywords','TMDB tagline','TMDB genres','TMDB production companies','TMDB cast character names']}
    }),{headers:{...cors,'Content-Type':'application/json','Cache-Control':'private, max-age=900'}})
  }catch(e){
    const message=e instanceof Error?e.message:String(e)
    console.error(message)
    return new Response(JSON.stringify({error:message}),{status:500,headers:{...cors,'Content-Type':'application/json'}})
  }
})