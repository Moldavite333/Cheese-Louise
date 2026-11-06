// Workspace production documents. Local copies remain available for recovery.
(() => {
  const jobs=new Map(),migrated=new Set();
  const clone=value=>JSON.parse(JSON.stringify(value));
  const valid=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const id=(type,movieId)=>type+':'+movieId;
  const row=(type,movieId)=>state.productionDocuments?.[id(type,movieId)]||null;
  const marker=(type,movieId)=>`cheeseLouise:productionPending:${workspace?.id||'local'}:${id(type,movieId)}`;
  const seenKey=(type,movieId)=>`cheeseLouise:productionSeen:${workspace?.id||'local'}:${id(type,movieId)}`;
  const canonical=value=>JSON.stringify(value,(key,item)=>valid(item)?Object.fromEntries(Object.keys(item).sort().map(k=>[k,item[k]])):item);
  const same=(a,b)=>canonical(a)===canonical(b);
  function seen(type,movieId){try{return localStorage.getItem(seenKey(type,movieId))}catch{return null}}
  function remember(type,movieId,document){try{localStorage.setItem(seenKey(type,movieId),canonical(document))}catch{}}
  function meaningful(type,document){
    if(!valid(document))return false;
    if(type==='watch_along')return ['notes','rules','rundownText','outline'].some(k=>String(document[k]||'').trim())||Boolean(document.outlineItems?.length);
    if(type==='timeline')return Number(document.doc?.revision)>0||Boolean(document.history?.length);
    if(type==='bingo')return Boolean(document.cards?.length);
    return Boolean(document.session||document.timeline||document.timelineDraft||document.social);
  }
  function mergeWatch(shared,local){
    const merged={...shared,...local};
    for(const field of ['notes','rules','rundownText','outline']){
      const a=String(shared[field]||'').trim(),b=String(local[field]||'').trim();
      merged[field]=!a?b:!b||a===b||a.includes(b)?a:b.includes(a)?b:`${a}\n\n--- Notes from another device ---\n\n${b}`;
    }
    merged.traitIds=[...new Set([...(shared.traitIds||[]),...(local.traitIds||[])])];
    const items=[...(shared.outlineItems||[])];
    for(const item of local.outlineItems||[]){
      if(items.some(existing=>same(existing,item)))continue;
      const copy=clone(item);
      if(copy.id&&items.some(existing=>existing.id===copy.id))copy.id=`${copy.id}-other-device-${items.length}`;
      items.push(copy);
    }
    merged.outlineItems=items;
    merged.updatedAt=new Date().toISOString();
    return merged;
  }
  function watchContains(shared,local){
    return ['notes','rules','rundownText','outline'].every(field=>!String(local[field]||'').trim()||String(shared[field]||'').includes(String(local[field]).trim()))
      &&(local.outlineItems||[]).every(item=>(shared.outlineItems||[]).some(existing=>same(existing,item)||same({...existing,id:null},{...item,id:null})))
      &&(local.traitIds||[]).every(value=>(shared.traitIds||[]).includes(value));
  }
  const active=()=>Boolean(workspace?.id&&me?.()&&typeof db!=='undefined');
  function pending(type,movieId){try{const value=JSON.parse(localStorage.getItem(marker(type,movieId))||'null');return valid(value)?value:null}catch{return null}}
  function mark(type,movieId,document,base,blocked=false){try{localStorage.setItem(marker(type,movieId),JSON.stringify({document,base,blocked}))}catch{}}
  function clear(type,movieId){try{localStorage.removeItem(marker(type,movieId))}catch{}}
  function status(type,movieId){const job=jobs.get(id(type,movieId));if(job)return job.status;const local=pending(type,movieId);return local?(local.blocked?'conflict':'retry'):row(type,movieId)?'saved':'local';}
  function read(type,movieId,localDocument){
    const job=jobs.get(id(type,movieId));if(job)return clone(job.document);
    const unsynced=pending(type,movieId);
    if(valid(unsynced?.document)){
      if(unsynced.blocked){jobs.set(id(type,movieId),{type,movieId,document:clone(unsynced.document),version:0,status:'conflict',running:false,base:unsynced.base,blocked:true});return clone(unsynced.document)}
      if(active()&&!migrated.has(id(type,movieId))){migrated.add(id(type,movieId));void save(type,movieId,unsynced.document,unsynced.base)}
      return clone(unsynced.document);
    }
    const shared=row(type,movieId)?.document;
    if(valid(shared)){
      if(type==='watch_along'&&meaningful(type,localDocument)&&watchContains(shared,localDocument)){
        remember(type,movieId,shared);
        return clone(shared);
      }
      if(meaningful(type,localDocument)&&!same(localDocument,shared)&&seen(type,movieId)!==canonical(localDocument)){
        if(type==='watch_along'&&active()){
          const merged=mergeWatch(shared,localDocument);
          save(type,movieId,merged,row(type,movieId).revision);
          return clone(merged);
        }
        mark(type,movieId,localDocument,row(type,movieId).revision,true);
        jobs.set(id(type,movieId),{type,movieId,document:clone(localDocument),version:0,status:'conflict',running:false,base:row(type,movieId).revision,blocked:true});
        return clone(localDocument);
      }
      remember(type,movieId,shared);
      return clone(shared);
    }
    if(valid(localDocument)&&active()&&!migrated.has(id(type,movieId))){migrated.add(id(type,movieId));void save(type,movieId,localDocument)}
    return valid(localDocument)?clone(localDocument):null;
  }
  function save(type,movieId,document,knownBase){
    if(!valid(document)||!movieId)return Promise.resolve(false);
    const key=id(type,movieId),job=jobs.get(key)||{type,movieId,version:0,status:'saving',running:false,base:knownBase??row(type,movieId)?.revision??0};
    job.document=clone(document);job.version++;job.status='saving';jobs.set(key,job);
    mark(type,movieId,job.document,job.base,Boolean(job.blocked));
    if(job.blocked){job.status='conflict';return Promise.resolve(false)}
    if(job.timer)clearTimeout(job.timer);
    job.timer=setTimeout(()=>{job.timer=null;void flush(job)},350);
    return Promise.resolve(true);
  }
  async function flush(job){
    if(job.running)return;
    if(!active()){job.status='retry';return}
    job.running=true;
    const version=job.version,document=clone(job.document),base=job.base;
    const identity={workspace_id:workspace.id,movie_id:job.movieId,document_type:job.type};
    let result;
    try{
      if(base){
        result=await db.from('production_documents').update({document,revision:base+1,updated_by:me(),updated_at:new Date().toISOString()})
          .eq('workspace_id',identity.workspace_id).eq('movie_id',identity.movie_id).eq('document_type',identity.document_type).eq('revision',base).select().maybeSingle();
      }else result=await db.from('production_documents').insert({...identity,document,revision:1,updated_by:me()}).select().single();
      if(result.error)throw result.error;
      if(!result.data){job.status='conflict';return}
      state.productionDocuments ||= {};
      state.productionDocuments[id(job.type,job.movieId)]={document:result.data.document,revision:result.data.revision,updatedAt:result.data.updated_at,updatedBy:result.data.updated_by};
      remember(job.type,job.movieId,result.data.document);
      job.base=result.data.revision;
      if(job.version===version){jobs.delete(id(job.type,job.movieId));clear(job.type,job.movieId)}
      else mark(job.type,job.movieId,job.document,job.base);
    }catch(error){
      job.status=error?.code==='23505'?'conflict':'retry';
      console.warn('Shared production save failed',error?.message||error);
    }finally{
      job.running=false;
      if(job.version!==version&&job.status!=='conflict')job.timer=setTimeout(()=>{job.timer=null;void flush(job)},0);
    }
  }
  async function retry(type,movieId){const job=jobs.get(id(type,movieId));if(job){if(job.status==='conflict')return false;job.status='saving';await flush(job);return !jobs.has(id(type,movieId))}const local=pending(type,movieId);if(!valid(local?.document))return true;if(local.blocked)return false;save(type,movieId,local.document,local.base);return true}
  window.clProductionSync={read,save,status,retry};
})();
