// One shared catalog request; retain useful recipes if one alphabet bucket fails.
let clCatalogLoadPromise=null;
clLoadOnlineCatalog=function(force=false){
  if(clCatalogLoadPromise) return clCatalogLoadPromise;
  if(clOnlineCatalogStatus.loaded && !force) return Promise.resolve();
  clCatalogLoadPromise=(async()=>{
    if(!force){
      const cached=clReadOnlineCache();
      if(cached?.items?.length){
        state.onlineCocktails=cached.items.map(c=>({...c,base_spirit:clInferBaseSpirit(clRecipeRows(c).map(r=>r.ingredient).join(' ')),flavor_tags:clDeriveCocktailTags(c)}));
        clOnlineCatalogStatus={loaded:true,loading:false,error:'',updatedAt:new Date(cached.savedAt)};
        return;
      }
    }
    clOnlineCatalogStatus={...clOnlineCatalogStatus,loading:true,error:''};
    const byId=new Map((state.onlineCocktails||[]).map(c=>[String(c.source_id||c.id),c]));
    const failed=[];
    const letters='abcdefghijklmnopqrstuvwxyz'.split('');
    for(let i=0;i<letters.length;i+=5){
      const batch=letters.slice(i,i+5);
      const results=await Promise.allSettled(batch.map(async letter=>{
        for(let attempt=0;attempt<2;attempt++){
          try{
            const response=await fetch(`${CL_COCKTAILDB_BASE}/search.php?f=${letter}`,{signal:AbortSignal.timeout(12000)});
            if(!response.ok) throw new Error(`Cocktail source returned ${response.status}`);
            const json=await response.json();
            if(!Object.hasOwn(json||{},'drinks') || (json.drinks!==null&&!Array.isArray(json.drinks))) throw new Error('Invalid cocktail catalog response');
            return json.drinks||[];
          }catch(error){if(attempt===1) throw error;await clDelay(250);}
        }
      }));
      results.forEach((result,index)=>{
        if(result.status==='rejected'){failed.push(batch[index]);return;}
        for(const drink of result.value) if(drink?.idDrink) byId.set(String(drink.idDrink),clNormalizeExternalDrink(drink));
      });
      if(i+5<letters.length) await clDelay(120);
    }
    state.onlineCocktails=[...byId.values()].sort((a,b)=>a.name.localeCompare(b.name));
    // Never cache an outage as tomorrow's tiny catalog.
    if(!failed.length && state.onlineCocktails.length) clWriteOnlineCache(state.onlineCocktails);
    clOnlineCatalogStatus={loaded:true,loading:false,
      error:failed.length?`Catalog incomplete (${failed.join(', ').toUpperCase()}); matching ${state.onlineCocktails.length} available online recipes plus saved drinks. Retry to fetch missing recipes.`:'',
      updatedAt:new Date()};
  })().catch(error=>{
    clOnlineCatalogStatus={loaded:true,loading:false,error:error?.message||String(error),updatedAt:null};
  }).finally(()=>{
    clCatalogLoadPromise=null;
    if(cocktailHubView==='bar' || selectedEpisode) render();
  });
  return clCatalogLoadPromise;
};
window.clLoadOnlineCatalog=clLoadOnlineCatalog;

