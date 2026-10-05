import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
}

type Source={url:string;collection:string;year:number;season?:string|null;holiday?:string|null}
type CatalogMovie={catalog_id:string;title:string;summary:string|null;stars:string[];premiere_date:string|null;year:number;collection:string;network:string;season:string|null;holiday:string|null;official_source_url:string;source_type:'hallmark_official'}

const SOURCES:Source[]=[
  {url:'https://www.hallmarkchannel.com/new-year-new-movies/new-year-new-movies-2024',collection:'New Year New Movies',year:2024,season:'Winter'},
  {url:'https://www.hallmarkchannel.com/loveuary/loveuary-2024-movies',collection:'Loveuary',year:2024,season:'Winter',holiday:"Valentine's Day"},
  {url:'https://www.hallmarkchannel.com/spring-into-love/spring-into-love-2024-movies',collection:'Spring Into Love',year:2024,season:'Spring'},
  {url:'https://www.hallmarkchannel.com/summer-nights/summer-nights-2024-movies',collection:'Summer Nights',year:2024,season:'Summer'},
  {url:'https://www.hallmarkchannel.com/fall-into-love/fall-into-love-2024-movies',collection:'Fall Into Love',year:2024,season:'Fall'},
  {url:'https://www.hallmarkchannel.com/winter-escape/winter-escape-2025-movies',collection:'Winter Escape',year:2025,season:'Winter'},
  {url:'https://www.hallmarkchannel.com/loveuary/loveuary-2025-movies',collection:'Loveuary',year:2025,season:'Winter',holiday:"Valentine's Day"},
  {url:'https://www.hallmarkchannel.com/spring-into-love/spring-into-love-2025-movies',collection:'Spring Into Love',year:2025,season:'Spring'},
  {url:'https://www.hallmarkchannel.com/passport-to-love/passport-to-love-2025-movies',collection:'Passport to Love',year:2025,season:'Summer'},
  {url:'https://www.hallmarkchannel.com/summer-nights/summer-nights-2025-movies',collection:'Summer Nights',year:2025,season:'Summer'},
  {url:'https://www.hallmarkchannel.com/fall-into-love/fall-into-love-2025-movies',collection:'Fall Into Love',year:2025,season:'Fall'},
  {url:'https://www.hallmarkchannel.com/spring-into-love',collection:'Spring Into Love',year:2026,season:'Spring'},
  {url:'https://www.hallmarkchannel.com/fall-harvest/',collection:'Fall Into Love',year:2026,season:'Fall'},
  {url:'https://www.hallmarkchannel.com/christmas/countdown-to-christmas-2026-preview/',collection:'Countdown to Christmas',year:2026,season:'Winter',holiday:'Christmas'},
  {url:'https://www.hallmarkchannel.com/hallmark-plus/new-this-month',collection:'Hallmark+ New This Month',year:2026}
]

const SKIP_TITLES=/^(movie guide|video|classic moments|meet the stars|fall into love|spring into love|summer nights|loveuary|winter escape|passport to love|countdown to christmas|new year new movies|streaming on hallmark\+|more from the movie|related movies|bonus premiere)$/i

function decode(s:string){
  return s.replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&rsquo;|&lsquo;/gi,"'").replace(/&ldquo;|&rdquo;/gi,'"').replace(/&ndash;|&mdash;/gi,'-').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
}
function strip(html:string){
  return decode(html.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,' ')).replace(/[ \t]+/g,' ').replace(/\s*\n\s*/g,'\n').trim()
}
function cleanLine(s:string){return s.replace(/\s+/g,' ').trim()}
function hashId(value:string){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return 'hallmark-'+(h>>>0).toString(36)}

const months:{[key:string]:number}={jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12}
function parseDate(text:string,year:number){
  const m=text.match(/(?:premieres?|streaming)\s+(?:friday|saturday|sunday|monday|tuesday|wednesday|thursday)?\s*,?\s*([A-Za-z]{3,9})\s+(\d{1,2})/i)||text.match(/(?:premieres?|streaming)\s+(?:friday|saturday|sunday|monday|tuesday|wednesday|thursday)?\s*,?\s*(\d{1,2})\/(\d{1,2})/i)
  if(!m)return null
  let month:number,day:number
  if(/^[A-Za-z]/.test(m[1])){month=months[m[1].toLowerCase()]||0;day=Number(m[2])}
  else{month=Number(m[1]);day=Number(m[2])}
  if(!month||!day)return null
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}
function inferHoliday(title:string,summary:string|null,source:Source){
  if(source.holiday)return source.holiday
  const t=(title+' '+(summary||'')).toLowerCase()
  if(/christmas|mistletoe|santa|holiday touchdown|yuletide/.test(t))return 'Christmas'
  if(/halloween|haunted|spirit of halloween|ghost/.test(t))return 'Halloween'
  if(/thanksgiving|friendsgiving/.test(t))return 'Thanksgiving'
  if(/valentine/.test(t))return "Valentine's Day"
  if(/easter/.test(t))return 'Easter'
  return null
}
function inferSeason(source:Source,holiday:string|null){
  if(source.season)return source.season
  if(holiday==='Christmas'||holiday==="Valentine's Day")return 'Winter'
  if(holiday==='Halloween'||holiday==='Thanksgiving')return 'Fall'
  if(holiday==='Easter')return 'Spring'
  return null
}
function starsFrom(text:string){
  const m=text.match(/\bStarring\s+([^\n]+?)(?=\n|\s+(?:Premieres?|Streaming|Check out|Watch|Stream|View|Meet)\b|$)/i)
  if(!m)return []
  return m[1].replace(/\.$/,'').split(/,|\band\b/i).map(cleanLine).filter(Boolean).slice(0,8)
}
function synopsisFrom(text:string){
  const lines=text.split('\n').map(cleanLine).filter(Boolean)
  let start=lines.findIndex(x=>/^Starring\b/i.test(x))
  if(start<0)start=lines.findIndex(x=>/\bStarring\b/i.test(x))
  const candidates=(start>=0?lines.slice(start+1):lines).filter(line=>
    line.length>45 &&
    !/^(Premieres?|Streaming|Check out|Watch|Stream|View|Meet|Image:|Find out more|Catch |You can |Don't miss|See |Read on)/i.test(line) &&
    !/hallmark\+/i.test(line)
  )
  return candidates[0]?.slice(0,1200)||null
}

function parsePage(html:string,source:Source){
  const cleaned=html.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'')
  const headingRx=/<h([2-4])[^>]*>([\s\S]*?)<\/h\1>/gi
  const matches=[...cleaned.matchAll(headingRx)]
  const out:CatalogMovie[]=[]
  for(let i=0;i<matches.length;i++){
    const title=cleanLine(strip(matches[i][2]))
    if(!title||title.length<2||title.length>120||SKIP_TITLES.test(title))continue
    const start=(matches[i].index||0)+matches[i][0].length
    const end=i+1<matches.length?(matches[i+1].index||cleaned.length):cleaned.length
    const block=strip(cleaned.slice(start,end))
    if(!/(premieres?|streaming)\b/i.test(block))continue
    if(!/\b(starring|stars)\b/i.test(block))continue
    const summary=synopsisFrom(block)
    const premiere_date=parseDate(block,source.year)
    const stars=starsFrom(block)
    const holiday=inferHoliday(title,summary,source)
    const season=inferSeason(source,holiday)
    out.push({
      catalog_id:hashId(`${source.year}|${source.collection}|${title.toLowerCase()}`),
      title,summary,stars,premiere_date,year:source.year,collection:source.collection,network:'Hallmark Channel',season,holiday,
      official_source_url:source.url,source_type:'hallmark_official'
    })
  }
  return out
}

async function fetchSource(source:Source){
  try{
    const r=await fetch(source.url,{headers:{'user-agent':'Mozilla/5.0 (compatible; CheeseLouiseCatalog/1.0)','accept':'text/html,application/xhtml+xml'}})
    if(!r.ok)return {source,ok:false,status:r.status,movies:[] as CatalogMovie[]}
    const html=await r.text()
    return {source,ok:true,status:r.status,movies:parsePage(html,source)}
  }catch(_){return {source,ok:false,status:0,movies:[] as CatalogMovie[]}}
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return new Response(JSON.stringify({error:'POST required'}),{status:405,headers:{...cors,'Content-Type':'application/json'}})
  try{
    const input=await req.json().catch(()=>({}))
    const years=Array.isArray(input?.years)?new Set(input.years.map((x:any)=>Number(x))):null
    const selected=years?SOURCES.filter(s=>years.has(s.year)):SOURCES
    const batches=await Promise.all(selected.map(fetchSource))
    const map=new Map<string,CatalogMovie>()
    for(const batch of batches){
      for(const movie of batch.movies){
        const key=`${movie.year}|${movie.title.toLowerCase().replace(/[^a-z0-9]+/g,' ')}`
        const prior=map.get(key)
        if(!prior){map.set(key,movie);continue}
        map.set(key,{...prior,...movie,summary:movie.summary||prior.summary,stars:movie.stars.length?movie.stars:prior.stars,premiere_date:movie.premiere_date||prior.premiere_date})
      }
    }
    const results=[...map.values()].sort((a,b)=>(b.premiere_date||`${b.year}`).localeCompare(a.premiere_date||`${a.year}`)||a.title.localeCompare(b.title))
    const coverage=results.reduce((acc:any,m)=>{acc[m.year]=(acc[m.year]||0)+1;return acc},{})
    return new Response(JSON.stringify({
      generated_at:new Date().toISOString(),
      source_of_truth:'Hallmark Channel official pages',
      count:results.length,
      coverage,
      pages:batches.map(b=>({url:b.source.url,collection:b.source.collection,year:b.source.year,ok:b.ok,status:b.status,count:b.movies.length})),
      results
    }),{headers:{...cors,'Content-Type':'application/json','Cache-Control':'private, max-age=900'}})
  }catch(e){
    return new Response(JSON.stringify({error:e instanceof Error?e.message:String(e)}),{status:500,headers:{...cors,'Content-Type':'application/json'}})
  }
})
