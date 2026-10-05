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
  {url:'https://www.hallmarkchannel.com/spring-into-love/spring-into-love-2026-movies',collection:'Spring Into Love',year:2026,season:'Spring'},
  {url:'https://www.hallmarkchannel.com/fall-into-love/fall-into-love-2026-schedule/',collection:'Fall Into Love',year:2026,season:'Fall'},
  {url:'https://www.hallmarkchannel.com/fall-harvest/',collection:'Fall Into Love',year:2026,season:'Fall'},
  {url:'https://www.hallmarkchannel.com/christmas',collection:'Countdown to Christmas',year:2026,season:'Winter',holiday:'Christmas'},
  {url:'https://www.hallmarkchannel.com/hallmark-plus/new-this-month',collection:'Hallmark+ New This Month',year:2026}
]

const SKIP=/^(movie guide|video|classic moments|meet the stars|start streaming|fall into love|spring into love|summer nights|loveuary|winter escape|passport to love|countdown to christmas|new year new movies|streaming on hallmark\+|more from the movie|related movies|bonus premiere|image:|align-right|what are the latest|this october|the most wonderful time|check out our complete list)/i
const CTA=/^(check out|watch|stream|view|meet|find out|read on|catch |you can |don't miss|see |preview|first look|image:|start streaming|streaming next day)/i
const MARKER=/^(premieres?|streaming)\b/i

function decode(s:string){
  return s.replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&rsquo;|&lsquo;/gi,"'").replace(/&ldquo;|&rdquo;/gi,'"').replace(/&ndash;|&mdash;/gi,'-').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
}
function linesFromHtml(html:string){
  const cleaned=html
    .replace(/<script[\s\S]*?<\/script>/gi,'')
    .replace(/<style[\s\S]*?<\/style>/gi,'')
    .replace(/<br\s*\/?\s*>/gi,'\n')
    .replace(/<\/(?:p|div|section|article|li|h[1-6]|a|button)>/gi,'\n')
    .replace(/<(?:p|div|section|article|li|h[1-6]|a|button)\b[^>]*>/gi,'\n')
    .replace(/<[^>]+>/g,' ')
  return decode(cleaned)
    .split(/\n+/)
    .map(s=>s.replace(/\s+/g,' ').trim())
    .filter(Boolean)
}
function clean(s:string){return s.replace(/\s+/g,' ').trim()}
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
  if(/christmas|mistletoe|santa|yuletide|holiday touchdown/.test(t))return 'Christmas'
  if(/halloween|haunted|spooky|ghost/.test(t))return 'Halloween'
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
function isPlausibleTitle(line:string){
  const s=clean(line)
  if(!s||s.length<2||s.length>100||SKIP.test(s)||MARKER.test(s)||/^starring\b|^stars\b/i.test(s)||CTA.test(s))return false
  if(/[.!?]$/.test(s)&&s.split(' ').length>7)return false
  return true
}
function findTitle(lines:string[],markerIndex:number){
  for(let i=markerIndex-1;i>=Math.max(0,markerIndex-7);i--){
    if(isPlausibleTitle(lines[i]))return lines[i]
  }
  return ''
}
function extractStars(block:string){
  const m=block.match(/\b(?:Starring|Stars)\s+(.+?)(?=(?:\.|\n|$))/i)
  if(!m)return []
  return m[1].replace(/\.$/,'').split(/,|\band\b/i).map(clean).filter(Boolean).slice(0,8)
}
function extractSummary(bodyLines:string[]){
  for(const raw of bodyLines){
    let s=clean(raw)
    if(!s||CTA.test(s)||MARKER.test(s)||/^starring\b|^stars\b/i.test(s)||SKIP.test(s))continue
    s=s.replace(/\s+(?:Starring|Stars)\s+.+$/i,'').trim()
    if(s.length>=45)return s.slice(0,1200)
  }
  return null
}

function parsePage(html:string,source:Source){
  const lines=linesFromHtml(html)
  const markers=lines.map((line,i)=>MARKER.test(line)?i:-1).filter(i=>i>=0)
  const out:CatalogMovie[]=[]
  for(let n=0;n<markers.length;n++){
    const i=markers[n]
    const title=findTitle(lines,i)
    if(!title)continue
    const next=markers[n+1]??lines.length
    const end=Math.max(i+1,next-1)
    const body=lines.slice(i+1,end)
    const bodyText=body.join('\n')
    const stars=extractStars(bodyText)
    const summary=extractSummary(body)
    const premiere_date=parseDate(lines[i],source.year)
    const holiday=inferHoliday(title,summary,source)
    const season=inferSeason(source,holiday)
    out.push({catalog_id:hashId(`${source.year}|${source.collection}|${title.toLowerCase()}`),title,summary,stars,premiere_date,year:source.year,collection:source.collection,network:'Hallmark Channel',season,holiday,official_source_url:source.url,source_type:'hallmark_official'})
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
    return new Response(JSON.stringify({generated_at:new Date().toISOString(),source_of_truth:'Hallmark Channel official pages',count:results.length,coverage,pages:batches.map(b=>({url:b.source.url,collection:b.source.collection,year:b.source.year,ok:b.ok,status:b.status,count:b.movies.length})),results}),{headers:{...cors,'Content-Type':'application/json','Cache-Control':'private, max-age=900'}})
  }catch(e){
    return new Response(JSON.stringify({error:e instanceof Error?e.message:String(e)}),{status:500,headers:{...cors,'Content-Type':'application/json'}})
  }
})
