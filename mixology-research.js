// Source-backed, bounded discovery/research. Catalog recipes are not claimed as originals.
(function(root){
  'use strict';const C=root.clMixologyCore;
  const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const ingredientKey=value=>norm(value).replace(/^\d+(?:[./]\d+)?\s*(?:ml|oz|cl|tsp|tbsp|dash(?:es)?)\b\s*/,'');
  function sourceUrl(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.origin!=='https://24cocktails.com'||!/^\/cocktail\/[a-z0-9_-]+\/?$/i.test(u.pathname))return null;u.search='';u.hash='';return u.href;}catch{return null;}}
  function profile(c){const ingredients=(c.ingredientRows||[]).map(r=>r.ingredient).join(' ')||c.ingredients||'';const text=norm(ingredients);let family=c.diversityFamily||c.style||'Other';return {family:norm(family),spirit:norm(c.base_spirit),ingredients:new Set((c.ingredientRows||String(c.ingredients||'').split('\n').map(ingredient=>({ingredient}))).map(r=>ingredientKey(r.ingredient))),text};}
  function overlap(a,b){let n=0;for(const x of a)if(b.has(x))n++;const union=a.size+b.size-n;return union?n/union:0;}
  function concepts(ranked,{brief='',movie=null,retrievedAt=new Date().toISOString()}={}){
    const pool=ranked.filter(r=>sourceUrl(r.cocktail?.source_url)&&typeof r.cocktail.name==='string'&&r.cocktail.name.length<=200).map(r=>({...r,p:profile(r.cocktail)}));
    const chosen=[];let broadened=false;
    const ceiling=pool[0]?.score||0;
    for(const widen of [false,true]){
      while(chosen.length<5){let best=null,bestScore=-Infinity;
        for(const r of pool){if(chosen.some(x=>norm(x.cocktail.name)===norm(r.cocktail.name)||x.p.family===r.p.family||overlap(x.p.ingredients,r.p.ingredients)>.85))continue;
          if(!widen&&r.score<ceiling-25)continue;
          const repeatSpirit=chosen.filter(x=>x.p.spirit&&x.p.spirit===r.p.spirit).length;if(repeatSpirit>=2)continue;
          const score=r.score-repeatSpirit*8-chosen.reduce((n,x)=>n+overlap(x.p.ingredients,r.p.ingredients)*12,0);if(score>bestScore){best=r;bestScore=score;}}
        if(!best)break;chosen.push(best);if(widen)broadened=true;
      }
      if(chosen.length===5)break;
    }
    return {concepts:chosen.map((r,i)=>({id:C.id(),sourceId:r.cocktail.source_id,name:(movie?.title?movie.title+' · ':'')+(r.p.family||r.cocktail.style||'Cocktail')+' direction',foundation:r.cocktail.name,family:r.p.family,spirit:r.cocktail.base_spirit||'Not classified',ingredients:String(r.cocktail.ingredients||'').slice(0,3000),sourceUrl:sourceUrl(r.cocktail.source_url),retrievedAt,why:(r.reasons||[]).slice(0,6).map(x=>String(x).slice(0,250)),effort:'Not yet assessed',context:movie?'Adaptation inspired by the saved movie premise; the connection still needs development.':brief?'Direction for your idea: '+brief.slice(0,200):'Standalone direction to develop.',status:'untested_concept',order:i+1})),broadened,coverage:pool.length,warning:chosen.length<5?'Only '+chosen.length+' distinct source-backed directions were found. Broaden the idea or retry; no duplicate slots were invented.':broadened?'Search broadened to find five distinct families. Review weaker thematic connections before selecting.':''};
  }
  function documentFromDetail(detail,uuid=C.id){
    if(!detail||!Array.isArray(detail.ingredients)||!detail.ingredients.length||!Array.isArray(detail.steps)||!detail.steps.length||detail.ingredients.length>100||detail.steps.length>100)throw Error('Source recipe is incomplete.');
    const d={schemaVersion:1,name:String(detail.name||'Selected direction').slice(0,160),servings:1,ingredients:detail.ingredients.map(r=>{if(!r||typeof r.name!=='string')throw Error('Invalid source ingredient.');const ml=r.ml;return {id:uuid(),name:Number.isFinite(ml)&&ml>=0?r.name:[r.amount,r.name].filter(Boolean).join(' '),quantity:Number.isFinite(ml)&&ml>=0?String(ml):'',unit:Number.isFinite(ml)&&ml>=0?'mL':''};}),steps:detail.steps.map(text=>{if(typeof text!=='string')throw Error('Invalid source step.');return {id:uuid(),text};}),glassware:typeof detail.glass==='string'?detail.glass:'',garnish:typeof detail.garnish==='string'?detail.garnish:'',notes:'Imported research foundation. Untested; develop a distinct Cheese Louise variation.'};return C.validate(d);
  }
  function comparison(doc,source){const ours=new Set(doc.ingredients.map(r=>ingredientKey(r.name))),theirs=new Set((source.ingredients||[]).map(r=>ingredientKey(typeof r==='string'?r:r.name)));return {shared:[...ours].filter(x=>theirs.has(x)),oursOnly:[...ours].filter(x=>!theirs.has(x)),sourceOnly:[...theirs].filter(x=>!ours.has(x)),note:'Text-normalized comparison only. Different products and unknown measures are not treated as equivalent.'};}
  class Research {
    constructor({fetcher=(...args)=>globalThis.fetch(...args),now=()=>Date.now()}={}){this.fetcher=fetcher;this.now=now;this.cache=new Map();}
    async get(url,ttl){const cached=this.cache.get(url);if(cached&&this.now()-cached.time<ttl)return {value:cached.value,retrievedAt:new Date(cached.time).toISOString(),cached:true};const response=await this.fetcher(url,{signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error(response.status===429?'Source rate limit reached. Retry later.':'Source unavailable ('+response.status+').');const value=await response.json();const time=this.now();this.cache.set(url,{time,value});return {value,retrievedAt:new Date(time).toISOString(),cached:false};}
    async investigate(concept,doc){
      const source=sourceUrl(concept.sourceUrl);if(!source)throw Error('Unsupported research source.');const slug=new URL(source).pathname.split('/').filter(Boolean).pop(),retrievedAt=new Date(this.now()).toISOString();
      const result={conceptId:concept.id,sourceUrl:source,retrievedAt,status:'unavailable',warnings:[],sources:[],document:null,nameChecks:[],originality:'No claim of absolute originality. This comparison covers one provider and the searched names only.'};
      const names=[...new Set([concept.foundation,doc.name].filter(n=>n&&n!=='Untitled cocktail'))];const outcomes=await Promise.allSettled([this.get('https://24cocktails.com/api/v1/recipe/'+encodeURIComponent(slug)+'?lang=en',3600000),...names.map(name=>this.get('https://24cocktails.com/api/v1/search?q='+encodeURIComponent(name)+'&limit=5&lang=en',300000))]);
      if(outcomes[0].status==='fulfilled'){const detail=outcomes[0].value.value;result.retrievedAt=outcomes[0].value.retrievedAt;if(detail.slug!==slug)result.warnings.push('Source identity mismatch; recipe was not imported.');else{try{result.document=documentFromDetail(detail);result.sources.push({name:String(detail.name),url:source,retrievedAt:outcomes[0].value.retrievedAt,kind:'external_recipe',complete:true,ingredients:detail.ingredients.map(r=>({name:r.name,amount:r.amount||''})),steps:detail.steps,comparison:comparison(doc,detail)});}catch(error){result.warnings.push(error.message);}}}else result.warnings.push('Selected recipe detail could not be retrieved.');
      for(let i=1;i<outcomes.length;i++){
        const check={query:names[i-1],complete:false,matchedNames:[]};result.nameChecks.push(check);
        if(outcomes[i].status!=='fulfilled'){result.warnings.push('Name search could not be completed for '+names[i-1]+'.');continue;}
        const packet=outcomes[i].value,value=packet.value,rows=Array.isArray(value)?value:value.results||value.recipes||value.items;check.retrievedAt=packet.retrievedAt;
        if(!Array.isArray(rows)){result.warnings.push('Name-search response was not recognized.');continue;}
        check.complete=true;check.matchedNames=rows.slice(0,5).filter(r=>typeof r.name==='string').map(r=>r.name);
        for(const r of rows.slice(0,5)){const url=sourceUrl(r.url||('https://24cocktails.com/cocktail/'+r.slug));if(!url||result.sources.some(x=>x.url===url)||typeof r.name!=='string')continue;result.sources.push({name:r.name.slice(0,200),url,retrievedAt:packet.retrievedAt,kind:'external_search_result',complete:false,ingredients:[],steps:[],comparison:null});}
      }
      result.status=result.document?(result.warnings.length?'partial':'complete'):result.sources.length?'partial':'unavailable';return result;
    }
  }
  const api={norm,sourceUrl,concepts,comparison,documentFromDetail,Research};root.clMixologyResearch=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
