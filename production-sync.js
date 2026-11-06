// Workspace production documents. Local copies remain available for recovery.
(() => {
  const jobs=new Map(),migrated=new Set();
  const clone=value=>JSON.parse(JSON.stringify(value));
  const valid=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const id=(type,movieId)=>type+':'+movieId;
  const row=(type,movieId)=>state.productionDocuments?.[id(type,movieId)]||null;
  const marker=(type,movieId)=>`cheeseLouise:productionPending:${workspace?.id||'local'}:${id(type,movieId)}`;
  const active=()=>Boolean(workspace?.id&&me?.()&&typeof db!=='undefined');
  function pending(type,movieId){try{const value=JSON.parse(localStorage.getItem(marker(type,movieId))||'null');return valid(value)?value:null}catch{return null}}
  function mark(type,movieId,document,base){try{localStorage.setItem(marker(type,movieId),JSON.stringify({document,base}))}catch{}}
  function clear(type,movieId){try{localStorage.removeItem(marker(type,movieId))}catch{}}
  function status(type,movieId){const job=jobs.get(id(type,movieId));return job?.status||(pending(type,movieId)?'retry':row(type,movieId)?'saved':'local');}
  function read(type,movieId,localDocument){
    const job=jobs.get(id(type,movieId));if(job)return clone(job.document);
    const unsynced=pending(type,movieId);
    if(valid(unsynced?.document)){if(active()&&!migrated.has(id(type,movieId))){migrated.add(id(type,movieId));void save(type,movieId,unsynced.document,unsynced.base)}return clone(unsynced.document)}
    const shared=row(type,movieId)?.document;
    if(valid(shared))return clone(shared);
    if(valid(localDocument)&&active()&&!migrated.has(id(type,movieId))){migrated.add(id(type,movieId));void save(type,movieId,localDocument)}
    return valid(localDocument)?clone(localDocument):null;
  }
  function save(type,movieId,document,knownBase){
    if(!valid(document)||!movieId)return Promise.resolve(false);
    const key=id(type,movieId),job=jobs.get(key)||{type,movieId,version:0,status:'saving',running:false,base:knownBase??row(type,movieId)?.revision??0};
    job.document=clone(document);job.version++;job.status='saving';jobs.set(key,job);
    mark(type,movieId,job.document,job.base);
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
  async function retry(type,movieId){const job=jobs.get(id(type,movieId));if(job){if(job.status==='conflict')return false;job.status='saving';await flush(job);return !jobs.has(id(type,movieId))}const local=pending(type,movieId);if(!valid(local?.document))return true;save(type,movieId,local.document,local.base);return true}
  window.clProductionSync={read,save,status,retry};
})();
