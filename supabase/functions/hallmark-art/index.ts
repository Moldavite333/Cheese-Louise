import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
}

type InputMovie={catalog_id:string;title:string;year?:number|null;stars?:string[];official_source_url?:string|null}
type ImgCandidate={url:string;alt:string;width:number;height:number;score:number;source:'detail'|'gallery'|'hallmark+'}

function decode(s:string){
  return String(s||'').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&rsquo;|&lsquo;/gi,"'").replace(/&ldquo;|&rdquo;/gi,'"').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
}
function strip(s:string){ return decode(String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim() }
function norm(s:string){ return strip(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim() }
function slugify(s:string){return norm(s).replace(/\s+/g,'-')}
function abs(url:string,base='https://www.hallmarkchannel.com'){
  const v=decode(url||'').trim(); if(!v)return null;
  try{return new URL(v,base).toString()}catch(_){return null}
}
function attr(tag:string,name:string){
  const m=tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`,'i'));
  return m?decode(m[1]):''
}
function numAttr(tag:string,name:string){const v=Number(attr(tag,name));return Number.isFinite(v)?v:0}
async function mapLimit<T,R>(items:T[],limit:number,fn:(v:T)=>Promise<R>){
  const out=new Array<R>(items.length); let next=0;
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(true){const i=next++;if(i>=items.length)break;out[i]=await fn(items[i])}}));
  return out
}
async function fetchText(url:string){
  try{
    const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (compatible; CheeseLouiseCatalog/3.0)','accept':'text/html,application/xhtml+xml'}});
    return r.ok?await r.text():'';
  }catch(_){return ''}
}

function titleLinks(html:string,base:string){
  const map=new Map<string,string>();
  const rx=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for(const m of html.matchAll(rx)){
    const text=norm(m[2]); if(!text)continue;
    const url=abs(m[1],base); if(!url||!/hallmarkchannel\.com/i.test(url))continue;
    if(!map.has(text))map.set(text,url);
  }
  return map;
}
function findLink(html:string,base:string,test:(href:string,text:string)=>boolean){
  const rx=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for(const m of html.matchAll(rx)){
    const href=abs(m[1],base); const text=strip(m[2]);
    if(href&&test(href,text))return href;
  }
  return null;
}
function castLinks(html:string,base:string){
  const out=new Map<string,string>();
  const rx=/<a\b[^>]*href=["']([^"']*\/cast\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for(const m of html.matchAll(rx)){
    const href=abs(m[1],base); if(!href)continue;
    const label=strip(m[2]);
    const slug=href.split('/').filter(Boolean).pop()||'';
    if(label)out.set(norm(label),href);
    out.set(norm(slug.replace(/-/g,' ')),href);
  }
  return out;
}

function parseStarNames(text:string){
  return text.replace(/\.$/,'').split(/,|\band\b/i).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,8)
}
function extractStarsFromDetail(html:string){
  const text=strip(html);
  const m=text.match(/\bStarring\s+(.+?)(?=\s+(?:Streaming|Watch|Preview|Q\s*&\s*A|Photos|More from|About\b)|\.(?:\s|$)|$)/i)
    || text.match(/\bStars\s+(.+?)(?=\s+(?:Streaming|Watch|Preview|Photos|More from|About\b)|\.(?:\s|$)|$)/i);
  return m?parseStarNames(m[1]):[];
}

function identityScore(html:string,movie:InputMovie,detailUrl:string,verifiedStars:string[]=[]){
  const text=norm(html); const title=norm(movie.title); const slug=slugify(movie.title);
  let score=0; let titleMatched=false; let starMatches=0;
  const h1=[...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m=>norm(m[1]));
  const titleTag=norm(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
  if(h1.some(x=>x===title||x.includes(title))||titleTag.includes(title)){score+=50;titleMatched=true}
  else if(text.includes(title)){score+=35;titleMatched=true}
  const stars=(verifiedStars.length?verifiedStars:(Array.isArray(movie.stars)?movie.stars:[])).filter(Boolean);
  for(const star of stars.slice(0,3)){ if(text.includes(norm(star))){score+=15;starMatches++} }
  if(movie.year&&new RegExp(`\\b${Number(movie.year)}\\b`).test(text))score+=10;
  if(detailUrl.toLowerCase().includes(slug))score+=10;
  return {score:Math.min(100,score),verified:titleMatched&&score>=70,titleMatched,starMatches}
}

function imageCandidates(html:string,base:string,movie:InputMovie,source:'detail'|'gallery'|'hallmark+',starsOverride:string[]=[]){
  const title=norm(movie.title); const stars=(starsOverride.length?starsOverride:(movie.stars||[])).map(norm).filter(Boolean);
  const collectionRx=/spring into love|fall into love|countdown to christmas|subscribe|watch new hallmark|movie guide/i;
  const badRx=/logo|wordmark|network-logo|network logo|placeholder|sprite|favicon|icon|checkmark|check mark|hallmark logo/i;
  const out:ImgCandidate[]=[];
  for(const m of html.matchAll(/<img\b[^>]*>/gi)){
    const tag=m[0]; const alt=norm(attr(tag,'alt')); let src=attr(tag,'src')||attr(tag,'data-src')||attr(tag,'data-lazy-src');
    if(!src){const ss=attr(tag,'srcset');if(ss)src=ss.split(',').map(x=>x.trim().split(/\s+/)[0]).filter(Boolean).pop()||''}
    const url=abs(src,base); if(!url||/scorecardresearch|doubleclick|googletag|data:image/i.test(url))continue;
    const hay=`${alt} ${norm(url)}`;
    if(collectionRx.test(hay)||badRx.test(hay))continue;
    let score=source==='gallery'?30:source==='hallmark+'?20:0;
    if(alt===title)score+=35;
    else if(alt.includes(title)||title.includes(alt))score+=25;
    let matchedStars=0;
    for(const star of stars.slice(0,3)){
      const last=star.split(' ').filter(Boolean).pop()||star;
      if(alt.includes(star)||alt.includes(last)){score+=25;matchedStars++}
    }
    if(matchedStars>=2)score+=30;
    const width=numAttr(tag,'width'),height=numAttr(tag,'height');
    if(width>=500||height>=500)score+=10;
    if(/brightspotcdn\.com/i.test(url))score+=5;
    // We only want movie-specific artwork, never generic page/site art.
    if(!(alt.includes(title)||matchedStars>0))score-=50;
    out.push({url,alt,width,height,score,source});
  }
  return out.sort((a,b)=>b.score-a.score);
}

function directorFromHallmarkPlus(html:string){
  const text=strip(html);
  const m=text.match(/\bDirector:\s*([A-Z][A-Za-zÀ-ÿ .'-]{2,70}?)(?=\s+(?:Actors:|Writers?:|Genres?:|Studio:|Released:|Run Time:|Rated:|Languages?:|$))/i)
    || text.match(/\bDirector:\s*([A-Z][A-Za-zÀ-ÿ .'-]{2,55})/i);
  return m?m[1].replace(/\s+/g,' ').trim():null;
}

function personPageImage(html:string,person:string,base:string){
  const target=norm(person);
  const h1=norm(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');
  if(h1 && !(h1.includes(target)||target.includes(h1)))return null;
  for(const m of html.matchAll(/<img\b[^>]*>/gi)){
    const tag=m[0]; const alt=norm(attr(tag,'alt'));
    if(!alt||!(alt===target||alt.includes(target)||target.includes(alt)))continue;
    let src=attr(tag,'src')||attr(tag,'data-src')||attr(tag,'data-lazy-src');
    if(!src){const ss=attr(tag,'srcset');if(ss)src=ss.split(',').map(x=>x.trim().split(/\s+/)[0]).filter(Boolean).pop()||''}
    const url=abs(src,base);
    if(url&&!/logo|placeholder|sprite|icon|checkmark/i.test(url))return url;
  }
  return null;
}

async function actorImagesFromCastPages(detailHtml:string,detailUrl:string,stars:string[]){
  const links=castLinks(detailHtml,detailUrl);
  const picks=stars.slice(0,3).map(star=>{
    const n=norm(star); const last=n.split(' ').pop()||n;
    let url=links.get(n)||null;
    if(!url){ for(const [key,value] of links){if(key.includes(n)||n.includes(key)||key.endsWith(last)){url=value;break}} }
    if(!url)url=`${detailUrl.replace(/\/$/,'')}/cast/${slugify(star)}`;
    return {star,url};
  });
  const rows=await mapLimit(picks,3,async pick=>{
    const html=await fetchText(pick.url);
    const image=html?personPageImage(html,pick.star,pick.url):null;
    return image?{name:pick.star,image_url:image,source_url:pick.url}:null;
  });
  return rows.filter(Boolean);
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return new Response(JSON.stringify({error:'POST required'}),{status:405,headers:{...cors,'Content-Type':'application/json'}});
  try{
    const input=await req.json().catch(()=>({}));
    const movies=(Array.isArray(input?.movies)?input.movies:[]).slice(0,120) as InputMovie[];
    const grouped=new Map<string,InputMovie[]>();
    for(const m of movies){
      const source=String(m?.official_source_url||'').trim();
      if(!source||!m?.title)continue;
      if(!grouped.has(source))grouped.set(source,[]);
      grouped.get(source)!.push(m);
    }

    const sourceRows=await mapLimit([...grouped.entries()],5,async([source,rows])=>{
      const html=await fetchText(source);
      return {source,rows,links:titleLinks(html,source)};
    });

    const targets:any[]=[];
    for(const row of sourceRows){
      for(const movie of row.rows){
        const key=norm(movie.title);
        const exact=row.links.get(key)||null;
        const likely=exact||`https://www.hallmarkchannel.com/${slugify(movie.title)}`;
        targets.push({...movie,detail_url:likely});
      }
    }

    const results=await mapLimit(targets,5,async movie=>{
      const detailHtml=await fetchText(movie.detail_url);
      const detailStars=extractStarsFromDetail(detailHtml);
      const verifiedStars=detailStars.length?detailStars:(movie.stars||[]);
      const identity=identityScore(detailHtml,movie,movie.detail_url,verifiedStars);
      if(!identity.verified){
        return {catalog_id:movie.catalog_id,title:movie.title,detail_url:movie.detail_url,poster_url:null,actor_images:[],verified_stars:verifiedStars,director:null,hallmark_plus_url:null,identity_confidence:identity.score,identity_verified:false,art_confidence:0,art_source:null};
      }

      const plusUrl=findLink(detailHtml,movie.detail_url,(href)=>/hallmarkplus\.com\/details\//i.test(href));
      let director:string|null=null;
      let plusHtml='';
      if(plusUrl){
        plusHtml=await fetchText(plusUrl);
        if(plusHtml)director=directorFromHallmarkPlus(plusHtml);
      }

      let candidates=imageCandidates(detailHtml,movie.detail_url,movie,'detail',verifiedStars);
      if(plusHtml&&plusUrl)candidates=[...imageCandidates(plusHtml,plusUrl,movie,'hallmark+',verifiedStars),...candidates].sort((a,b)=>b.score-a.score);
      const galleryUrl=findLink(detailHtml,movie.detail_url,(href,text)=>/\/photos\//i.test(href)||/photo gallery/i.test(text));
      if(!candidates.length||candidates[0].score<65){
        if(galleryUrl){const galleryHtml=await fetchText(galleryUrl); if(galleryHtml)candidates=[...imageCandidates(galleryHtml,galleryUrl,movie,'gallery',verifiedStars),...candidates].sort((a,b)=>b.score-a.score)}
      }

      // Never substitute og:image or site art. A movie visual must explicitly match
      // the title or cast, otherwise we show verified cast headshots instead.
      const chosen=(candidates[0]&&candidates[0].score>=60)?candidates[0]:null;
      const actor_images=chosen?[]:await actorImagesFromCastPages(detailHtml,movie.detail_url,verifiedStars);

      return {
        catalog_id:movie.catalog_id,title:movie.title,detail_url:movie.detail_url,
        poster_url:chosen?.url||null,actor_images,verified_stars:verifiedStars,director,hallmark_plus_url:plusUrl,
        identity_confidence:identity.score,identity_verified:true,
        art_confidence:chosen?.score||0,art_source:chosen?.source||null
      };
    });

    return new Response(JSON.stringify({count:results.length,results}),{headers:{...cors,'Content-Type':'application/json','Cache-Control':'private, max-age=900'}});
  }catch(e){
    return new Response(JSON.stringify({error:e instanceof Error?e.message:String(e)}),{status:500,headers:{...cors,'Content-Type':'application/json'}});
  }
});
