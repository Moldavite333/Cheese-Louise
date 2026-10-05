import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
}

function decode(s:string){
  return String(s||'').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&rsquo;|&lsquo;/gi,"'").replace(/&ldquo;|&rdquo;/gi,'"').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
}
function strip(s:string){ return decode(String(s||'').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim() }
function norm(s:string){ return strip(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim() }
function abs(url:string,base='https://www.hallmarkchannel.com'){
  const v=decode(url||'').trim(); if(!v)return null;
  try{return new URL(v,base).toString()}catch(_){return null}
}
function attr(tag:string,name:string){
  const m=tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`,'i'));
  return m?decode(m[1]):''
}
async function mapLimit<T,R>(items:T[],limit:number,fn:(v:T)=>Promise<R>){
  const out=new Array<R>(items.length); let next=0;
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(true){const i=next++;if(i>=items.length)break;out[i]=await fn(items[i])}}));
  return out
}

function titleLinks(html:string,base:string){
  const map=new Map<string,string>();
  const rx=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for(const m of html.matchAll(rx)){
    const text=norm(m[2]); if(!text)continue;
    const url=abs(m[1],base); if(!url)continue;
    if(!/hallmarkchannel\.com/i.test(url))continue;
    if(!map.has(text))map.set(text,url);
  }
  return map;
}

function imageFromDetail(html:string,title:string,base:string){
  const target=norm(title);
  let fallback:string|null=null;
  const tags=[...html.matchAll(/<img\b[^>]*>/gi)].map(m=>m[0]);
  for(const tag of tags){
    const alt=norm(attr(tag,'alt'));
    let src=attr(tag,'src')||attr(tag,'data-src')||attr(tag,'data-lazy-src');
    if(!src){
      const srcset=attr(tag,'srcset');
      if(srcset)src=srcset.split(',').map(x=>x.trim().split(/\s+/)[0]).filter(Boolean).pop()||'';
    }
    const url=abs(src,base); if(!url||/scorecardresearch|doubleclick|googletag/i.test(url))continue;
    if(!fallback && /brightspotcdn\.com/i.test(url))fallback=url;
    if(alt && (alt===target || alt.includes(target) || target.includes(alt))) return url;
  }
  const og=html.match(/<meta\b[^>]*(?:property|name)=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i)
    || html.match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image["'][^>]*>/i);
  return abs(og?.[1]||'',base)||fallback;
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return new Response(JSON.stringify({error:'POST required'}),{status:405,headers:{...cors,'Content-Type':'application/json'}});
  try{
    const input=await req.json().catch(()=>({}));
    const movies=Array.isArray(input?.movies)?input.movies.slice(0,120):[];
    const grouped=new Map<string,any[]>();
    for(const m of movies){
      const source=String(m?.official_source_url||'').trim();
      if(!source||!m?.title)continue;
      if(!grouped.has(source))grouped.set(source,[]);
      grouped.get(source)!.push(m);
    }

    const sourceRows=await mapLimit([...grouped.entries()],5,async([source,rows])=>{
      try{
        const r=await fetch(source,{headers:{'user-agent':'Mozilla/5.0 (compatible; CheeseLouiseCatalog/1.0)','accept':'text/html'}});
        const html=r.ok?await r.text():'';
        return {source,rows,links:titleLinks(html,source)};
      }catch(_){return {source,rows,links:new Map<string,string>()}}
    });

    const targets:any[]=[];
    for(const row of sourceRows){
      for(const movie of row.rows){
        const key=norm(movie.title);
        const detail=row.links.get(key)||row.source;
        targets.push({...movie,detail_url:detail});
      }
    }

    const results=await mapLimit(targets,7,async movie=>{
      let poster_url:string|null=null;
      try{
        const r=await fetch(movie.detail_url,{headers:{'user-agent':'Mozilla/5.0 (compatible; CheeseLouiseCatalog/1.0)','accept':'text/html'}});
        if(r.ok){ const html=await r.text(); poster_url=imageFromDetail(html,movie.title,movie.detail_url); }
      }catch(_){ }
      return {catalog_id:movie.catalog_id,title:movie.title,detail_url:movie.detail_url,poster_url};
    });

    return new Response(JSON.stringify({count:results.length,results}),{headers:{...cors,'Content-Type':'application/json','Cache-Control':'private, max-age=3600'}});
  }catch(e){
    return new Response(JSON.stringify({error:e instanceof Error?e.message:String(e)}),{status:500,headers:{...cors,'Content-Type':'application/json'}});
  }
});
