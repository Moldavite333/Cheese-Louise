// Same-origin broad index: no third-party CORS or API-key dependency for matching.
const clCocktailDBFallback=clLoadOnlineCatalog;
let clFullCatalogPromise=null;
const clRecipeDetailCache=new Map();

function clNormalizeCatalogRecipe(row){
  const url=new URL(row.url);
  if(url.origin!=='https://24cocktails.com'||!url.pathname.startsWith('/cocktail/')) throw new Error('Invalid recipe source');
  const slug=url.pathname.split('/').filter(Boolean).pop();
  const ingredientRows=row.ingredients.map(ingredient=>({ingredient:String(ingredient),measure:''}));
  const candidate={id:`external:24:${slug}`,external:true,source_id:`24:${slug}`,source_name:'24cocktails.com',source_url:url.href,
    name:row.name,cocktail_type:'original',ingredientRows,ingredients:row.ingredients.join('\n'),
    base_spirit:row.base,style:'',glassware:row.glass,garnish:row.garnish,
    method:`${row.method||'See source'}. Open the linked recipe for complete preparation.`,method_kind:row.method,
    needs_recipe_detail:true,abv:row.abv,flavor_tags:[],tested:false,batchable:false};
  candidate.style=clInferFamily(candidate);
  candidate.flavor_tags=clDeriveCocktailTags(candidate);
  candidate.iba_category=CL_IBA_NAME_MAP.get(clNormName(candidate.name))||null;
  candidate.iba_official=!!candidate.iba_category;
  return candidate;
}

clLoadOnlineCatalog=function(force=false){
  if(clFullCatalogPromise) return clFullCatalogPromise;
  if(clOnlineCatalogStatus.loaded&&!force) return Promise.resolve();
  clOnlineCatalogStatus={...clOnlineCatalogStatus,loading:true,error:''};
  clFullCatalogPromise=(async()=>{
    try{
      const response=await fetch('data/cocktail-catalog.json',{cache:force?'reload':'default',signal:AbortSignal.timeout(45000)});
      if(!response.ok) throw new Error(`Matching catalog returned ${response.status}`);
      const catalog=await response.json();
      if(catalog.schemaVersion!==1||!Array.isArray(catalog.recipes)) throw new Error('Invalid matching catalog');
      const byName=new Map();
      for(const row of catalog.recipes){
        if(!row?.name||!Array.isArray(row.ingredients)||!row.ingredients.length) continue;
        const candidate=clNormalizeCatalogRecipe(row);
        byName.set(clNormName(candidate.name),candidate);
      }
      if(byName.size<1000) throw new Error(`Broad catalog is incomplete: ${byName.size} recipes`);
      state.onlineCocktails=[...byName.values()];
      clOnlineCatalogStatus={loaded:true,loading:false,error:'',updatedAt:new Date(catalog.fetchedAt),source:catalog.source,broad:true};
    }catch(error){
      // Keep an already loaded broad catalog through a failed refresh.
      if((state.onlineCocktails||[]).length>=1000){
        clOnlineCatalogStatus={...clOnlineCatalogStatus,loaded:true,loading:false,error:`Refresh unavailable; using ${state.onlineCocktails.length} previously loaded recipes.`};
      }else{
        clOnlineCatalogStatus={...clOnlineCatalogStatus,loaded:false};
        await clCocktailDBFallback(force);
        clOnlineCatalogStatus={...clOnlineCatalogStatus,broad:false,error:`Broad catalog unavailable (${error.message}). Limited mode: ${clMergedOriginalCatalog().length} recipes available. ${clOnlineCatalogStatus.error||''}`};
      }
    }
  })().finally(()=>{
    clFullCatalogPromise=null;
    if(cocktailHubView==='bar'||selectedEpisode) render();
  });
  return clFullCatalogPromise;
};
window.clLoadOnlineCatalog=clLoadOnlineCatalog;

function clCatalogStats(){
  return {total:clMergedOriginalCatalog().length,saved:(state.cocktails||[]).filter(c=>c.cocktail_type==='original').length,
    catalog:(state.onlineCocktails||[]).length,broad:!!clOnlineCatalogStatus.broad};
}

async function clHydrateCatalogRecipe(candidate){
  if(!candidate?.needs_recipe_detail) return candidate;
  const cached=clRecipeDetailCache.get(candidate.source_id);
  if(cached&&Date.now()-cached.time<3600000) return cached.recipe;
  const slug=String(candidate.source_id).replace(/^24:/,'');
  try{
    const response=await fetch(`https://24cocktails.com/api/v1/recipe/${encodeURIComponent(slug)}?lang=en`,{signal:AbortSignal.timeout(8000)});
    if(!response.ok) return candidate;
    const detail=await response.json();
    if(detail.slug!==slug||!Array.isArray(detail.steps)||!detail.steps.length) return candidate;
    const recipe={...candidate,method:detail.steps.join('\n'),needs_recipe_detail:false};
    clRecipeDetailCache.set(candidate.source_id,{time:Date.now(),recipe});
    return recipe;
  }catch{return candidate;}
}
window.clHydrateCatalogRecipe=clHydrateCatalogRecipe;
