// Cheese Louise v1.18 — permanent Cheese Trait deletion
// Retire remains the normal historical option; Delete is for typos, duplicates, and mistakes.

function traitDeleteSameId(a,b){ return String(a||'')===String(b||''); }

function traitDeleteStoragePath(url){
  if(!url || typeof url!=='string') return null;
  const marker='/storage/v1/object/public/trait-art/';
  const i=url.indexOf(marker);
  if(i<0) return null;
  try { return decodeURIComponent(url.slice(i+marker.length).split('?')[0]); }
  catch { return url.slice(i+marker.length).split('?')[0]; }
}

function traitDeleteEnhanceUi(){
  const manager=document.querySelector('.trait-art-manager');
  if(manager){
    const note=manager.querySelector('.modal-header .subtle');
    if(note && !note.dataset.deleteExplained){
      note.dataset.deleteExplained='1';
      note.textContent='Retire keeps a trait for old movies. Delete permanently removes mistakes, typos, and duplicates.';
    }
  }

  document.querySelectorAll('.trait-art-manager-row').forEach(row=>{
    if(row.querySelector('.trait-delete-button')) return;
    const buttons=[...row.querySelectorAll('button')];
    const edit=buttons.find(b=>/editTrait\((['"])[^'"]+\1\)/.test(b.getAttribute('onclick')||''));
    if(!edit) return;
    const match=(edit.getAttribute('onclick')||'').match(/editTrait\((['"])([^'"]+)\1\)/);
    if(!match) return;
    const id=match[2];
    const actions=row.querySelector('.trait-art-manager-actions')||edit.parentElement;
    if(!actions) return;
    const del=document.createElement('button');
    del.type='button';
    del.className='secondary trait-delete-button';
    del.textContent='Delete';
    del.title='Permanently delete this Cheese Trait';
    del.addEventListener('click',()=>deleteCheeseTrait(id));
    actions.appendChild(del);
  });
}

async function traitDeleteCleanSavedCards(traitId){
  const {data:cards,error}=await db.from('romantiverse_bingo_cards').select('*').eq('workspace_id',workspace.id);
  if(error) throw error;
  let affected=0;
  for(const card of (cards||[])){
    const squares=Array.isArray(card.squares)?[...card.squares]:[];
    const removed=[];
    squares.forEach((value,index)=>{ if(traitDeleteSameId(value,traitId)){ squares[index]=null; removed.push(index); } });
    const excluded=(card.excluded_trait_ids||[]).filter(id=>!traitDeleteSameId(id,traitId));
    if(!removed.length && excluded.length===(card.excluded_trait_ids||[]).length) continue;
    affected++;
    const locked=(card.locked_indices||[]).map(Number).filter(i=>!removed.includes(i));
    const marked=[...new Set([12,...(card.marked_indices||[]).map(Number).filter(i=>!removed.includes(i))])];
    const {error:updateError}=await db.from('romantiverse_bingo_cards').update({
      squares,
      locked_indices:locked,
      marked_indices:marked,
      excluded_trait_ids:excluded,
      updated_at:new Date().toISOString()
    }).eq('id',card.id).eq('workspace_id',workspace.id);
    if(updateError) throw updateError;
  }
  return affected;
}

async function traitDeleteCleanPresets(traitId){
  const {data:presets,error}=await db.from('filter_presets').select('*').eq('workspace_id',workspace.id);
  if(error) throw error;
  for(const preset of (presets||[])){
    const criteria={...(preset.criteria||{})};
    let changed=false;
    for(const key of ['traitIds','trait_ids','traits']){
      if(Array.isArray(criteria[key])){
        const next=criteria[key].filter(id=>!traitDeleteSameId(id,traitId));
        if(next.length!==criteria[key].length){ criteria[key]=next; changed=true; }
      }
    }
    if(changed){
      const {error:updateError}=await db.from('filter_presets').update({criteria,updated_at:new Date().toISOString()}).eq('id',preset.id).eq('workspace_id',workspace.id);
      if(updateError) throw updateError;
    }
  }
}

async function deleteCheeseTrait(traitId){
  const trait=(state.traits||[]).find(t=>traitDeleteSameId(t.id,traitId));
  if(!trait || !workspace) return;

  const movieCount=(cheeseTraitRows||[]).filter(mt=>traitDeleteSameId(mt.trait_id,traitId)).length;
  const {data:cards}=await db.from('romantiverse_bingo_cards').select('id,squares').eq('workspace_id',workspace.id);
  const bingoCount=(cards||[]).filter(card=>Array.isArray(card.squares)&&card.squares.some(id=>traitDeleteSameId(id,traitId))).length;

  let message=`Permanently delete “${trait.name}”?\n\nThis is for mistakes, typos, and duplicates. Use Retire when you want to preserve a real old trait.`;
  if(movieCount||bingoCount){
    message+=`\n\nThis trait is currently used on ${movieCount} movie${movieCount===1?'':'s'} and ${bingoCount} saved Bingo card${bingoCount===1?'':'s'}. Deleting it will remove it from those movies and leave those Bingo squares blank.`;
  }
  message+='\n\nThis cannot be undone.';
  if(!confirm(message)) return;

  try{
    // Clean non-FK references first. movie_traits are removed automatically by the DB cascade.
    await traitDeleteCleanSavedCards(traitId);
    await traitDeleteCleanPresets(traitId);

    const {error}=await db.from('cheese_traits').delete().eq('id',traitId).eq('workspace_id',workspace.id);
    if(error) throw error;

    const customPath=trait.image_source==='custom'?traitDeleteStoragePath(trait.image_url):null;
    if(customPath){
      const {error:storageError}=await db.storage.from('trait-art').remove([customPath]);
      if(storageError) console.warn('Trait deleted, but its custom art could not be removed from Storage.',storageError);
    }

    movieFilters.traitIds=(movieFilters.traitIds||[]).filter(id=>!traitDeleteSameId(id,traitId));
    try{
      if(typeof rvBingoDraft!=='undefined' && rvBingoDraft){
        const removed=[];
        rvBingoDraft.squares=(rvBingoDraft.squares||[]).map((id,index)=>{
          if(traitDeleteSameId(id,traitId)){ removed.push(index); return null; }
          return id;
        });
        rvBingoDraft.locked_indices=(rvBingoDraft.locked_indices||[]).filter(i=>!removed.includes(Number(i)));
        rvBingoDraft.marked_indices=[...new Set([12,...(rvBingoDraft.marked_indices||[]).filter(i=>!removed.includes(Number(i)))])];
        rvBingoDraft.excluded_trait_ids=(rvBingoDraft.excluded_trait_ids||[]).filter(id=>!traitDeleteSameId(id,traitId));
      }
    }catch(err){ console.warn('Could not clean the open Bingo draft after trait deletion.',err); }

    await loadAll();
    render();
  }catch(err){
    console.error('Could not delete Cheese Trait',err);
    alert(`Could not delete “${trait.name}”. ${err?.message||'Please try again.'}`);
  }
}

const traitDeleteOriginalRender=render;
render=function(){
  const result=traitDeleteOriginalRender.apply(this,arguments);
  setTimeout(traitDeleteEnhanceUi,0);
  return result;
};

const traitDeleteOriginalTopbar=topbar;
topbar=function(){ return traitDeleteOriginalTopbar().replace('>v1.17<','>v1.18<').replace('>v1.16<','>v1.18<'); };

const traitDeleteStyle=document.createElement('style');
traitDeleteStyle.textContent=`
.trait-delete-button{border-color:#87404a!important;color:#ffb2bd!important;background:#291b20!important}
.trait-delete-button:hover{background:#4a232b!important;border-color:#e85c78!important;color:#fff!important}
`;
document.head.appendChild(traitDeleteStyle);

window.deleteCheeseTrait=deleteCheeseTrait;
setTimeout(traitDeleteEnhanceUi,0);
