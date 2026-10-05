import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
}

type InputMovie={catalog_id:string;title:string;year?:number|null;stars?:string[];official_source_url?:string|null}

function decode(s:string){return String(s||'').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&rsquo;|&lsquo;/gi,"'").replace(/&ldquo;|&rdquo;/gi,'"').replace(/\\u0026/g,'&').replace(/\\u002F/g,'/').replace(/\\\//g,'/').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))}
function strip(s:string){return decode(String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim()}
function norm(s:string){return strip(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function slugify(s:string){return norm(s).replace(/\s+/g,'-')}
function abs(url:string,base:string){const v=decode(url||'').trim();if(!v)return null;try{return new URL(v,base).toString()}catch(_){return null}}
async function fetchText(url:string){try{const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (compatible; CheeseLouiseCatalog/4.0)','accept':'text/html,application/xhtml+xml'}});return r.ok?await r.text():''}catch(_){return ''}}
async function mapLimit<T,R>(items:T[],limit:number,fn:(v:T)=>Promise<R>){const out=new Array<R>(items.length);let next=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(true){const i=next++;if(i>=items.length)break;out[i]=await fn(items[i])}}));return out}

function titleLinks(html:string,base:string){
  const map=new Map<string,string>();
  for(const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    const text=norm(m[2]);const url=abs(m[1],base);if(!text||!url||!/hallmarkchannel\.com/i.test(url))continue;if(!map.has(text))map.set(text,url)
  }
  return map
}
function findHallmarkPlusLink(html:string,base:string){
  for(const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)){
    const url=abs(m[1],base);if(url&&/hallmarkplus\.com\/details\//i.test(url))return url
  }
  const raw=decode(html).match(/https:\/\/www\.hallmarkplus\.com\/details\/[A-Za-z0-9_\-/?=&.%]+/i);
  return raw?raw[0]:null
}
function extractStars(html:string){
  const text=strip(html);
  const m=text.match(/\b(?:Starring|Stars|Actors:)\s+(.+?)(?=\s+(?:Director:|Streaming|Watch|Preview|Photos|More from|About\b|Genres?:|Released:|Run Time:|Rated:)|\.(?:\s|$)|$)/i);
  return m?m[1].replace(/\.$/,'').split(/,|\band\b/i).map(x=>x.trim()).filter(Boolean).slice(0,8):[]
}
function identity(html:string,movie:InputMovie,url:string,stars:string[]){
  const text=norm(html),title=norm(movie.title);let score=0;
  const h1=[...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m=>norm(m[1]));
  const tt=norm(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
  const titleMatch=h1.some(x=>x===title||x.includes(title))||tt.includes(title)||text.includes(title);
  if(titleMatch)score+=55;
  for(const star of stars.slice(0,3))if(text.includes(norm(star)))score+=15;
  if(movie.year&&new RegExp(`\\b${Number(movie.year)}\\b`).test(text))score+=10;
  if(url.toLowerCase().includes(slugify(movie.title)))score+=5;
  return {verified:titleMatch&&score>=70,score:Math.min(100,score)}
}
function directorFromPlus(html:string){
  const text=strip(html);
  const m=text.match(/\bDirector:\s*([A-Z][A-Za-zÀ-ÿ .'-]{2,70}?)(?=\s+(?:Actors:|Writers?:|Genres?:|Studio:|Released:|Run Time:|Rated:|Languages?:|$))/i)||text.match(/\bDirector:\s*([A-Z][A-Za-zÀ-ÿ .'-]{2,55})/i);
  return m?m[1].replace(/\s+/g,' ').trim():null
}
function badImage(url:string){return !url||/logo|wordmark|favicon|sprite|icon|checkmark|check-mark|placeholder|site-logo|brandmark/i.test(url)}
function metaImage(html:string,base:string){
  const patterns=[
    /<meta\b[^>]*(?:property|name)=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image(?::secure_url)?["'][^>]*>/i,
    /<meta\b[^>]*(?:property|name)=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']twitter:image["'][^>]*>/i
  ];
  for(const rx of patterns){const m=html.match(rx);const u=abs(m?.[1]||'',base);if(u&&!badImage(u))return u}
  return null
}
function structuredImage(html:string,base:string,title:string){
  const target=norm(title);
  const keys=['posterUrl','poster_url','poster','imageUrl','image_url','image'];
  for(const key of keys){
    const rx=new RegExp(`["']${key}["']\\s*:\\s*["']([^"']+)["']`,'gi');
    for(const m of html.matchAll(rx)){const u=abs(m[1],base);if(!u||badImage(u))continue;const around=norm(html.slice(Math.max(0,(m.index||0)-500),(m.index||0)+800));if(around.includes(target))return u}
  }
  return null
}
function imgByTitle(html:string,base:string,title:string){
  const target=norm(title);
  for(const m of html.matchAll(/<img\b[^>]*>/gi)){
    const tag=m[0];const alt=norm(tag.match(/alt\s*=\s*["']([^"']+)["']/i)?.[1]||'');if(!alt||!(alt===target||alt.includes(target)||target.includes(alt)))continue;
    let src=tag.match(/(?:src|data-src|data-lazy-src)\s*=\s*["']([^"']+)["']/i)?.[1]||'';
    if(!src){const ss=tag.match(/srcset\s*=\s*["']([^"']+)["']/i)?.[1]||'';if(ss)src=ss.split(',').map(x=>x.trim().split(/\s+/)[0]).filter(Boolean).pop()||''}
    const u=abs(src,base);if(u&&!badImage(u))return u
  }
  return null
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return new Response(JSON.stringify({error:'POST required'}),{status:405,headers:{...cors,'Content-Type':'application/json'}});
  try{
    const input=await req.json().catch(()=>({}));
    const movies=(Array.isArray(input?.movies)?input.movies:[]).slice(0,120) as InputMovie[];
    const grouped=new Map<string,InputMovie[]>();
    for(const m of movies){const source=String(m.official_source_url||'').trim();if(!source||!m.title)continue;if(!grouped.has(source))grouped.set(source,[]);grouped.get(source)!.push(m)}

    const sourceRows=await mapLimit([...grouped.entries()],5,async([source,rows])=>({source,rows,links:titleLinks(await fetchText(source),source)}));
    const targets:any[]=[];
    for(const row of sourceRows)for(const movie of row.rows){const detail=row.links.get(norm(movie.title))||`https://www.hallmarkchannel.com/${slugify(movie.title)}`;targets.push({...movie,detail_url:detail})}

    const results=await mapLimit(targets,6,async movie=>{
      const detailHtml=await fetchText(movie.detail_url);
      const detailStars=extractStars(detailHtml);const stars=detailStars.length?detailStars:(movie.stars||[]);
      const id=identity(detailHtml,movie,movie.detail_url,stars);
      if(!id.verified)return {catalog_id:movie.catalog_id,title:movie.title,detail_url:movie.detail_url,poster_url:null,director:null,hallmark_plus_url:null,identity_verified:false,identity_confidence:id.score,art_verified:false};

      const plusUrl=findHallmarkPlusLink(detailHtml,movie.detail_url);
      if(!plusUrl)return {catalog_id:movie.catalog_id,title:movie.title,detail_url:movie.detail_url,poster_url:null,director:null,hallmark_plus_url:null,identity_verified:true,identity_confidence:id.score,art_verified:false};

      const plusHtml=await fetchText(plusUrl);
      const plusStars=extractStars(plusHtml);const plusId=identity(plusHtml,movie,plusUrl,plusStars.length?plusStars:stars);
      const director=directorFromPlus(plusHtml);
      if(!plusId.verified)return {catalog_id:movie.catalog_id,title:movie.title,detail_url:movie.detail_url,poster_url:null,director,hallmark_plus_url:plusUrl,identity_verified:true,identity_confidence:id.score,art_verified:false};

      const poster=metaImage(plusHtml,plusUrl)||structuredImage(plusHtml,plusUrl,movie.title)||imgByTitle(plusHtml,plusUrl,movie.title);
      return {catalog_id:movie.catalog_id,title:movie.title,detail_url:movie.detail_url,poster_url:poster,director,hallmark_plus_url:plusUrl,identity_verified:true,identity_confidence:Math.max(id.score,plusId.score),art_verified:!!poster,art_source:poster?'hallmark+':null};
    });

    return new Response(JSON.stringify({count:results.length,results}),{headers:{...cors,'Content-Type':'application/json','Cache-Control':'private, max-age=900'}});
  }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:String(e)}),{status:500,headers:{...cors,'Content-Type':'application/json'}})}
});
