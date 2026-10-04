import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const TMDB='https://api.themoviedb.org/3'
const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
}

type Movie={
  id:number
  title?:string
  original_title?:string
  overview?:string
  release_date?:string
  poster_path?:string|null
  backdrop_path?:string|null
  genre_ids?:number[]
  popularity?:number
  vote_average?:number
  vote_count?:number
  adult?:boolean
}

type Provider={provider_id:number;provider_name:string;logo_path?:string}

const CONCEPT_EXPANSIONS:Record<string,string[]>={
  cat:['cat','cats','kitten','kittens','feline','cat cafe','animal shelter','pet','veterinarian'],
  cats:['cat','cats','kitten','kittens','feline','cat cafe','animal shelter','pet','veterinarian'],
  dog:['dog','dogs','puppy','puppies','canine','pet','animal shelter','veterinarian'],
  dogs:['dog','dogs','puppy','puppies','canine','pet','animal shelter','veterinarian'],
  bakery:['bakery','baker','baking','pastry','pastry shop','cake shop','cafe'],
  baker:['bakery','baker','baking','pastry','pastry shop','cake shop'],
  widow:['widow','widower','late husband','late wife','bereavement','second chance'],
  widower:['widow','widower','late husband','late wife','bereavement','second chance'],
  royal:['royal','royalty','prince','princess','king','queen','duke','duchess','kingdom'],
  royalty:['royal','royalty','prince','princess','king','queen','duke','duchess','kingdom'],
  farm:['farm','farmer','ranch','orchard','vineyard','tree farm'],
  'tree farm':['tree farm','christmas tree farm','farm','christmas trees'],
  christmas:['christmas','holiday','xmas','mistletoe','santa','yuletide','festive'],
  holiday:['holiday','christmas','festive','seasonal','mistletoe'],
  'small town':['small town','small-town','hometown','village','community'],
  hometown:['hometown','homecoming','returns home','back home','small town'],
  inn:['inn','lodge','bed and breakfast','b&b','hotel'],
  bookstore:['bookstore','book shop','bookseller','library','author'],
  vineyard:['vineyard','winery','winemaker','wine'],
  wedding:['wedding','bride','groom','engagement','fiance','marriage'],
  'fake dating':['fake dating','pretend couple','pretend relationship','fake relationship'],
  snow:['snow','snowstorm','blizzard','snowed in','winter'],
  chef:['chef','restaurant','cooking','culinary','kitchen'],
  coffee:['coffee','cafe','coffee shop','barista'],
  cafe:['cafe','coffee shop','coffee','bakery'],
  veterinarian:['veterinarian','vet','animal clinic','pet','animal shelter'],
  firefighter:['firefighter','fireman','fire station'],
  teacher:['teacher','school','classroom'],
  writer:['writer','author','journalist','novelist'],
  inheritance:['inheritance','inherits','inherited','estate','will'],
  fundraiser:['fundraiser','fundraising','charity','benefit','save the'],
  festival:['festival','fair','parade','town event','celebration']
}

function norm(v:unknown){
  return String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()
}

function unique<T>(arr:T[]){return [...new Set(arr)]}

function queryTerms(query:string){
  const q=norm(query)
  const terms=[q]
  const words=q.split(/\s+/).filter(Boolean)
  for(const w of words){
    terms.push(w)
    if(w.endsWith('s')&&w.length>3) terms.push(w.slice(0,-1))
    if(CONCEPT_EXPANSIONS[w]) terms.push(...CONCEPT_EXPANSIONS[w])
  }
  if(CONCEPT_EXPANSIONS[q]) terms.push(...CONCEPT_EXPANSIONS[q])
  return unique(terms.map(norm).filter(x=>x.length>=2)).slice(0,12)
}

function phrase(text:string,term:string){
  const t=norm(text), q=norm(term)
  if(!q) return false
  return t.includes(q)
}

function holidayText(title:string,overview:string,keywords:string[]){
  const t=norm(title+' '+overview+' '+keywords.join(' '))
  if(/christmas|mistletoe|santa|yuletide|xmas/.test(t))return 'Christmas'
  if(/halloween|pumpkin/.test(t))return 'Halloween'
  if(/thanksgiving/.test(t))return 'Thanksgiving'
  if(/valentine/.test(t))return "Valentine's Day"
  if(/new year/.test(t))return "New Year's"
  if(/easter/.test(t))return 'Easter'
  if(/st patrick|saint patrick/.test(t))return "St. Patrick's Day"
  if(/fourth of july|4th of july|independence day/.test(t))return 'Fourth of July'
  return null
}

function seasonText(title:string,overview:string,keywords:string[],h:string|null){
  if(h==='Christmas'||h==="New Year's"||h==="Valentine's Day")return 'Winter'
  if(h==='Halloween'||h==='Thanksgiving')return 'Fall'
  if(h==='Easter'||h==="St. Patrick's Day")return 'Spring'
  if(h==='Fourth of July')return 'Summer'
  const t=norm(title+' '+overview+' '+keywords.join(' '))
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
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
    while(true){
      const i=next++
      if(i>=items.length)break
      out[i]=await fn(items[i])
    }
  }))
  return out
}

function baseRomantiverseScore(m:Movie,terms:string[]){
  const title=norm(m.title||m.original_title)
  const overview=norm(m.overview)
  const genres=new Set(m.genre_ids||[])
  let score=0
  if(genres.has(10749)) score+=34
  if(genres.has(10770)) score+=24
  if(genres.has(35)) score+=8
  if(genres.has(10751)) score+=6
  if(/christmas|holiday|valentine|wedding|small town|hometown|bakery|royal|prince|princess|widow|farm|inn|cafe|festival/.test(title+' '+overview)) score+=20
  terms.forEach((term,i)=>{
    if(phrase(title,term)) score+=i===0?90:55
    if(phrase(overview,term)) score+=i===0?70:38
  })
  score+=Math.min(18,Math.log10(Math.max(1,Number(m.popularity||0))+1)*7)
  return score
}

function searchEvidence(detail:any,terms:string[],query:string){
  const title=detail?.title||detail?.original_title||''
  const overview=detail?.overview||''
  const tagline=detail?.tagline||''
  const keywords=(detail?.keywords?.keywords||[]).map((k:any)=>String(k?.name||'')).filter(Boolean)
  const companies=(detail?.production_companies||[]).map((c:any)=>String(c?.name||'')).filter(Boolean)
  const characters=(detail?.credits?.cast||[]).map((c:any)=>String(c?.character||'')).filter(Boolean)
  const reasons:string[]=[]
  let relevance=0
  const q=norm(query)

  if(phrase(title,q)){relevance+=120;reasons.push('title matches "'+query+'"')}
  if(phrase(overview,q)){relevance+=95;reasons.push('synopsis mentions "'+query+'"')}
  if(phrase(tagline,q)){relevance+=75;reasons.push('tagline matches "'+query+'"')}

  for(let i=0;i<terms.length;i++){
    const term=terms[i]
    const isOriginal=term===q
    if(!isOriginal && phrase(title,term)){relevance+=62;reasons.push('title matches related concept "'+term+'"')}
    if(!isOriginal && phrase(overview,term)){relevance+=45;reasons.push('synopsis matches related concept "'+term+'"')}
    const keyword=keywords.find((k:string)=>phrase(k,term)||phrase(term,k))
    if(keyword){relevance+=isOriginal?88:58;reasons.push('TMDB keyword: '+keyword)}
    const character=characters.find((x:string)=>phrase(x,term))
    if(character){relevance+=25;reasons.push('character metadata: '+character)}
    const company=companies.find((x:string)=>phrase(x,term))
    if(company){relevance+=20;reasons.push('production metadata: '+company)}
  }

  const genres=(detail?.genres||[]).map((g:any)=>g?.id)
  if(genres.includes(10749)){relevance+=32;reasons.push('Romance')}
  if(genres.includes(10770)){relevance+=22;reasons.push('TV Movie')}
  if(/christmas|holiday|valentine|wedding|small town|hometown|bakery|royal|prince|princess|widow|farm|inn|cafe|festival/.test(norm(title+' '+overview+' '+keywords.join(' ')))) relevance+=18

  relevance+=Math.min(16,Math.log10(Math.max(1,Number(detail?.popularity||0))+1)*6)
  return {relevance:Math.round(relevance),reasons:unique(reasons).slice(0,6),keywords,companies,characters}
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return new Response(JSON.stringify({error:'POST required'}),{status:405,headers:{...cors,'Content-Type':'application/json'}})
  try{
    const token=Deno.env.get('TMDB_READ_ACCESS_TOKEN')
    if(!token)throw new Error('TMDB_READ_ACCESS_TOKEN is not configured')
    const input=await req.json().catch(()=>({}))
    const query=String(input.query||'').trim()
    if(query.length<2)return new Response(JSON.stringify({query,results:[],count:0}),{headers:{...cors,'Content-Type':'application/json'}})
    if(query.length>100)throw new Error('Search query is too long')

    const maxResults=Math.max(8,Math.min(36,Number(input.max_results||24)))
    const terms=queryTerms(query)
    const candidateMap=new Map<number,Movie>()
    const addMovies=(rows:any[])=>{
      for(const raw of rows||[]){
        if(!raw?.id||raw.adult)continue
        const m=raw as Movie
        const old=candidateMap.get(m.id)
        if(!old||baseRomantiverseScore(m,terms)>baseRomantiverseScore(old,terms)) candidateMap.set(m.id,m)
      }
    }

    const searchTerms=terms.slice(0,6)
    const searchJobs:Promise<any>[]=[]
    for(const term of searchTerms){
      const pages=term===norm(query)||term===terms[1]?2:1
      for(let page=1;page<=pages;page++){
        const q=new URLSearchParams({query:term,language:'en-US',region:'US',include_adult:'false',page:String(page)})
        searchJobs.push(tmdb('/search/movie?'+q.toString(),token).catch(()=>({results:[]})))
      }
    }

    const keywordJobs=terms.slice(0,8).map(term=>{
      const q=new URLSearchParams({query:term,page:'1'})
      return tmdb('/search/keyword?'+q.toString(),token).catch(()=>({results:[]}))
    })

    const [searchPages,keywordPages]=await Promise.all([Promise.all(searchJobs),Promise.all(keywordJobs)])
    searchPages.forEach(p=>addMovies(p?.results||[]))

    const keywordIds:number[]=[]
    const keywordNames:Record<number,string>={}
    keywordPages.forEach((p,idx)=>{
      const term=terms[idx]
      const ranked=(p?.results||[]).filter((k:any)=>k?.id&&k?.name).sort((a:any,b:any)=>{
        const an=norm(a.name),bn=norm(b.name)
        const ae=an===term?2:(an.includes(term)||term.includes(an)?1:0)
        const be=bn===term?2:(bn.includes(term)||term.includes(bn)?1:0)
        return be-ae
      }).slice(0,3)
      ranked.forEach((k:any)=>{keywordIds.push(Number(k.id));keywordNames[Number(k.id)]=String(k.name)})
    })

    const ids=unique(keywordIds).slice(0,18)
    if(ids.length){
      const keywordParam=ids.join('|')
      const discoverJobs:Promise<any>[]=[]
      for(let page=1;page<=3;page++){
        const q=new URLSearchParams({language:'en-US',region:'US',include_adult:'false',sort_by:'primary_release_date.desc',with_keywords:keywordParam,page:String(page)})
        discoverJobs.push(tmdb('/discover/movie?'+q.toString(),token).catch(()=>({results:[]})))
      }
      for(let page=1;page<=2;page++){
        const q=new URLSearchParams({language:'en-US',region:'US',include_adult:'false',sort_by:'popularity.desc',with_keywords:keywordParam,page:String(page)})
        discoverJobs.push(tmdb('/discover/movie?'+q.toString(),token).catch(()=>({results:[]})))
      }
      const discovered=await Promise.all(discoverJobs)
      discovered.forEach(p=>addMovies(p?.results||[]))
    }

    const prelim=[...candidateMap.values()]
      .map(movie=>({movie,score:baseRomantiverseScore(movie,terms)}))
      .sort((a,b)=>b.score-a.score)
      .slice(0,56)

    const enriched=await mapLimit(prelim,7,async(entry)=>{
      let detail:any={}
      let providerData:any={}
      try{
        const q=new URLSearchParams({language:'en-US',append_to_response:'keywords,credits,external_ids'})
        const pair=await Promise.all([
          tmdb('/movie/'+entry.movie.id+'?'+q.toString(),token),
          tmdb('/movie/'+entry.movie.id+'/watch/providers',token).catch(()=>({}))
        ])
        detail=pair[0]||{}
        providerData=pair[1]||{}
      }catch(_){detail=entry.movie}

      const evidence=searchEvidence(detail,terms,query)
      const us=providerData?.results?.US||{}
      const all=[...(us.flatrate||[]),...(us.free||[]),...(us.ads||[])] as Provider[]
      const seen=new Set<number>()
      const providers=all.filter(p=>p?.provider_id&&!seen.has(p.provider_id)&&seen.add(p.provider_id))
      const names=providers.map(p=>p.provider_name).filter(Boolean)
      const title=detail?.title||entry.movie.title||entry.movie.original_title||'Untitled'
      const overview=detail?.overview||entry.movie.overview||''
      const h=holidayText(title,overview,evidence.keywords)
      const s=seasonText(title,overview,evidence.keywords,h)
      const genres=(detail?.genres||[]).map((g:any)=>g?.name).filter(Boolean)

      return {
        tmdb_id:entry.movie.id,
        tmdb_type:'movie',
        title,
        summary:overview,
        tagline:detail?.tagline||null,
        keywords:evidence.keywords.slice(0,30),
        genres,
        production_companies:evidence.companies.slice(0,12),
        cast_characters:evidence.characters.slice(0,18),
        external_ids:detail?.external_ids||{},
        premiere_date:detail?.release_date||entry.movie.release_date||null,
        poster_url:(detail?.poster_path||entry.movie.poster_path)?'https://image.tmdb.org/t/p/w500'+(detail?.poster_path||entry.movie.poster_path):null,
        backdrop_url:(detail?.backdrop_path||entry.movie.backdrop_path)?'https://image.tmdb.org/t/p/w780'+(detail?.backdrop_path||entry.movie.backdrop_path):null,
        source_url:'https://www.themoviedb.org/movie/'+entry.movie.id,
        watch_url:us.link||null,
        providers:names,
        network:providerLabel(names),
        holiday:h,
        season:s,
        match_score:Math.min(100,Math.max(1,evidence.relevance)),
        search_score:evidence.relevance,
        search_reasons:evidence.reasons,
        search_terms:terms,
        why:[],
        popularity:Number(detail?.popularity??entry.movie.popularity??0),
        vote_average:Number(detail?.vote_average??entry.movie.vote_average??0),
        vote_count:Number(detail?.vote_count??entry.movie.vote_count??0)
      }
    })

    enriched.sort((a,b)=>b.search_score-a.search_score||b.popularity-a.popularity)
    const results=enriched.slice(0,maxResults)

    return new Response(JSON.stringify({
      query,
      expanded_terms:terms,
      keyword_ids:ids.map(id=>({id,name:keywordNames[id]||null})),
      count:results.length,
      results,
      attribution:{
        movie_data:'TMDB',
        streaming_availability:'JustWatch via TMDB',
        search_methods:['TMDB title search','TMDB keyword search','TMDB keyword discovery','Cheese Louise concept expansion']
      }
    }),{headers:{...cors,'Content-Type':'application/json','Cache-Control':'private, max-age=300'}})
  }catch(e){
    const message=e instanceof Error?e.message:String(e)
    console.error(message)
    return new Response(JSON.stringify({error:message}),{status:500,headers:{...cors,'Content-Type':'application/json'}})
  }
})
