// Host-recorded evidence, not a popularity score or personal taste signal.
(function(root){
 'use strict';const keys=['schemaVersion','title','observation','basis','limitations','application','observedOn','reviewAfter','status','sources','reviewed'];
 const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),today=()=>new Date().toISOString().slice(0,10);
 function date(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;}
 function sourceUrl(v){try{const u=new URL(v);return /^https:\/\/[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]+)?([/?#][^\s]*)?$/.test(v)&&!/[?&][^=&#]*%/.test(u.search)&&!u.username&&!u.password&&!u.pathname.includes('/storage/v1/object/sign/')&&![...u.searchParams.keys()].some(k=>/^(token|access_token|apikey|api_key|authorization|signature|key|sig|auth|auth_token|client_secret|password|session|jwt|x-amz-.+|x-goog-.+)$/i.test(k))?u.href:null;}catch{return null;}}
 const blank=()=>({schemaVersion:1,title:'',observation:'',basis:'example',limitations:'',application:'',observedOn:'',reviewAfter:'',status:'active',sources:[],reviewed:false});
 const source=id=>({id,title:'',url:'',publishedOn:'',retrievedOn:'',supports:''});
 function validate(d,now=today()){
  if(!d||Object.keys(d).length!==keys.length||keys.some(k=>!Object.hasOwn(d,k))||d.schemaVersion!==1||typeof d.reviewed!=='boolean'||!['example','report','data'].includes(d.basis)||!['active','archived'].includes(d.status)||!Array.isArray(d.sources)||d.sources.length>8||JSON.stringify(d).length>65536)throw Error('Trend observation is invalid or too large.');
  for(const [k,n] of [['title',160],['observation',3000],['limitations',2000],['application',2000]])if(typeof d[k]!=='string'||d[k].length>n||d[k].includes('\u0000'))throw Error('Keep observation fields within their stated limits.');
  for(const k of ['observedOn','reviewAfter'])if(typeof d[k]!=='string'||d[k]&&(!date(d[k])||k==='observedOn'&&d[k]>now))throw Error('Use valid dates; observations cannot be in the future.');
  const ids=new Set();for(const s of d.sources){if(!s||Object.keys(s).length!==6||!uuid(s.id)||ids.has(s.id)||['title','url','supports','publishedOn','retrievedOn'].some(k=>typeof s[k]!=='string'||s[k].includes('\u0000'))||s.title.length>200||s.url.length>2000||s.supports.length>1000||s.url&&!sourceUrl(s.url)||['publishedOn','retrievedOn'].some(k=>s[k]&&(!date(s[k])||s[k]>now)))throw Error('Sources need bounded plain text, public HTTPS links and valid nonfuture dates. Signed or credential-bearing links are not allowed.');ids.add(s.id);}
  return d;
 }
 function missing(d,movie=false,now=today()){validate(d,now);const out=[];if(!d.title.trim())out.push('a title');if(!d.observation.trim())out.push('what you observed');if(!d.limitations.trim())out.push('limitations / uncertainty');if(movie&&!d.application.trim())out.push('spoiler-free relevance to this movie');if(!d.sources.length)out.push('at least one source');if(d.sources.some(s=>!s.title.trim()||!s.url||!s.retrievedOn||!s.supports.trim()))out.push('source titles, public links, retrieval dates and what each supports');return out;}
 function freshness(row,now=today()){const d=row.document;if(d.status==='archived')return 'Archived';if(!d.reviewed||row.reviewed_revision!==row.revision)return 'Draft · not confirmed reviewed';return d.reviewAfter?(d.reviewAfter<=now?'Review due · check sources again':'Next check '+d.reviewAfter):'Reviewed · no next-check date set';}
 const api={blank,source,validate,missing,freshness,sourceUrl,date,today};root.clMixologyTrendsCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
