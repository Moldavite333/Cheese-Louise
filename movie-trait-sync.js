// One shared movie-trait selection, with immediate scores and per-trait writes.
(() => {
  const pending=new Map(),recent=new Map();
  let version=0,loadedWorkspace='';
  const movie=id=>(state.movies||[]).find(m=>m.id===id);
  const key=(movieId,traitId)=>`${movieId}:${traitId}`;
  const storageKey=()=>`cheeseLouise:sharedTraits:${workspace?.id||'local'}`;
  function persist(){
    try{localStorage.setItem(storageKey(),JSON.stringify([...pending.values()].map(j=>({movieId:j.movieId,traitId:j.traitId,desired:j.desired,confirmed:j.confirmed}))));}catch{}
  }
  function score(m){
    const byId=new Map((state.traits||[]).map(t=>[t.id,t]));
    // Retain unknown trait IDs so the provenance audit can flag missing definitions.
    const ids=[...new Set(m.selectedTraitIds||[])];
    const selectedTraits=ids.map(id=>byId.get(id)).filter(Boolean);
    const total=selectedTraits.reduce((sum,t)=>sum+(Number(t.points)||0),0);
    const gratingAudit=window.clCheeseGratingIntegrity?.audit?.(m,ids,state.traits);
    // Never overwrite the original stored cheese_score with an optimistic UI total.
    Object.assign(m,{selectedTraitIds:ids,selectedTraits,score:gratingAudit?.confirmedScore??total});
    if(gratingAudit)m.gratingAudit=gratingAudit;
  }
  function orderedIds(m,draft={}){
    const selected=new Set(m?.selectedTraitIds||[]);
    return [...new Set([...(draft.traitIds||[]).filter(id=>selected.has(id)),...selected])];
  }
  function syncDraft(m){
    const k=`cheeseLouise:watchAlong:${workspace?.id||'local'}:draft:${m.id}`;
    try{
      const raw=localStorage.getItem(k);if(!raw)return;
      const draft=JSON.parse(raw);if(!draft||Array.isArray(draft))return;
      // Carry older device-only checks into the shared movie once. Add checks;
      // never use an old local draft to delete selections from another device.
      const legacy=draft.sharedTraitsVersion===1?[]:(draft.traitIds||[]).filter(id=>(state.traits||[]).some(t=>t.id===id)&&!m.selectedTraitIds.includes(id));
      draft.sharedTraitsVersion=1;
      draft.traitIds=orderedIds(m,draft);
      if(Array.isArray(draft.outlineItems)) draft.outlineItems=draft.outlineItems.filter(i=>i?.type!=='trait'||draft.traitIds.includes(i.traitId));
      localStorage.setItem(k,JSON.stringify(draft));
      for(const traitId of legacy)void set(m.id,traitId,true);
    }catch{}
  }
  function notify(movieId){
    const m=movie(movieId);if(!m)return;
    syncDraft(m);
    for(const el of document.querySelectorAll?.('[data-cheese-score-movie]')||[]){
      if(el.dataset.cheeseScoreMovie===movieId)el.textContent=String(m.score)+(el.dataset.cheeseScoreSuffix||'');
    }
    if(typeof selectedMovie!=='undefined'&&selectedMovie===movieId){
      const total=document.querySelector('.movie-modal .cheese-total strong');if(total)total.textContent=String(m.score);
      const count=document.querySelector('.movie-modal .cheese-total + .subtle');if(count)count.textContent=`${m.selectedTraitIds.length} traits selected · Higher = cheesier, not better.`;
      const picker=document.getElementById('traitPickerBody');if(picker&&typeof traitPickerHtml==='function')picker.innerHTML=traitPickerHtml(m);
    }
    window.watchAlongRefreshSharedTraits?.(movieId);
    window.clProduction?.syncTraits?.(movieId);
  }
  function apply(movieId,traitId,selected){
    const m=movie(movieId);if(!m)return;
    const ids=new Set(m.selectedTraitIds||[]);
    if(selected)ids.add(traitId);else ids.delete(traitId);
    m.selectedTraitIds=[...ids];score(m);
  }
  function status(movieId){
    const jobs=[...pending.values()].filter(j=>j.movieId===movieId);
    return {pending:jobs.length,error:jobs.some(j=>j.error),text:jobs.some(j=>j.error)?'Trait changes not synced. Retry to save them.':jobs.length?'Saving traits to shared workspace…':'Traits saved to shared workspace'};
  }
  async function drain(job){
    if(job.promise)return job.promise;
    job.error=false;
    job.promise=(async()=>{
      try{
        while(job.confirmed!==job.desired){
          const desired=job.desired;
          let result;
          if(desired){
            result=await db.from('movie_traits').insert({workspace_id:job.workspaceId,movie_id:job.movieId,trait_id:job.traitId,selected_by:me()});
            if(result.error?.code==='23505')result={error:null};
          }else{
            result=await db.from('movie_traits').delete().eq('workspace_id',job.workspaceId).eq('movie_id',job.movieId).eq('trait_id',job.traitId);
          }
          if(result.error)throw result.error;
          job.confirmed=desired;
        }
        pending.delete(key(job.movieId,job.traitId));
        recent.set(key(job.movieId,job.traitId),{movieId:job.movieId,traitId:job.traitId,desired:job.desired,version:++version});
      }catch(error){job.error=true;console.warn('Shared trait save failed',error?.message||error);}
      finally{job.promise=null;persist();notify(job.movieId);}
    })();
    return job.promise;
  }
  function set(movieId,traitId,selected){
    const m=movie(movieId);if(!m||!workspace||(state.traits||[]).every(t=>t.id!==traitId))return Promise.resolve();
    if(!loadedWorkspace)loadedWorkspace=workspace.id;
    const k=key(movieId,traitId);
    const job=pending.get(k)||{movieId,traitId,workspaceId:workspace.id,confirmed:(m.selectedTraitIds||[]).includes(traitId)};
    job.desired=!!selected;job.error=false;
    recent.set(k,{movieId,traitId,desired:!!selected,version:++version});
    pending.set(k,job);persist();apply(movieId,traitId,!!selected);notify(movieId);
    return drain(job);
  }
  async function retry(movieId){await Promise.all([...pending.values()].filter(j=>!movieId||j.movieId===movieId).map(drain));}
  function reconcile(startVersion){
    if(!workspace)return;
    if(loadedWorkspace!==workspace.id){
      pending.clear();recent.clear();loadedWorkspace=workspace.id;
      try{
        const saved=JSON.parse(localStorage.getItem(storageKey())||'[]');
        for(const j of Array.isArray(saved)?saved:[]){
          const m=movie(j.movieId);if(!m)continue;
          pending.set(key(j.movieId,j.traitId),{...j,workspaceId:workspace.id,confirmed:(m.selectedTraitIds||[]).includes(j.traitId),restored:true});
        }
      }catch{}
    }
    for(const m of state.movies||[])score(m);
    for(const r of recent.values())if(r.version>startVersion)apply(r.movieId,r.traitId,r.desired);
    for(const j of pending.values())apply(j.movieId,j.traitId,j.desired);
    for(const m of state.movies||[])notify(m.id);
    for(const j of pending.values())if(j.restored){j.restored=false;void drain(j);}
  }
  const originalLoadAll=loadAll;
  loadAll=async function(...args){const startVersion=version;await originalLoadAll.apply(this,args);reconcile(startVersion);};
  window.loadAll=loadAll;
  window.clMovieTraits={set,retry,status,orderedIds,score,refresh:()=>reconcile(version)};
})();
