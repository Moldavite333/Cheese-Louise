// v1.13 source endpoint correction.
// TheCocktailDB's development endpoint is /api/json/v1/1/search.php.
clLoadOnlineCatalog = async function(force=false){
  if(clOnlineCatalogStatus.loading) return;
  if(clOnlineCatalogStatus.loaded && !force) return;

  if(!force){
    const cached=clReadOnlineCache();
    if(cached){
      state.onlineCocktails=cached.items||[];
      clOnlineCatalogStatus={loaded:true,loading:false,error:'',updatedAt:new Date(cached.savedAt)};
      if(cocktailHubView==='bar' || selectedEpisode) render();
      return;
    }
  }

  clOnlineCatalogStatus={...clOnlineCatalogStatus,loading:true,error:''};
  if(cocktailHubView==='bar') render();
  const letters='abcdefghijklmnopqrstuvwxyz'.split('');
  const raw=[];
  try{
    for(let i=0;i<letters.length;i+=5){
      const batch=letters.slice(i,i+5);
      const results=await Promise.all(batch.map(async letter=>{
        const res=await fetch(`${CL_COCKTAILDB_BASE}/search.php?f=${letter}`);
        if(!res.ok) throw new Error(`Cocktail source returned ${res.status}`);
        const json=await res.json();
        return json?.drinks||[];
      }));
      raw.push(...results.flat());
      if(i+5<letters.length) await clDelay(120);
    }
    const byId=new Map();
    raw.forEach(d=>{ if(d?.idDrink) byId.set(String(d.idDrink),clNormalizeExternalDrink(d)); });
    state.onlineCocktails=[...byId.values()].sort((a,b)=>a.name.localeCompare(b.name));
    clWriteOnlineCache(state.onlineCocktails);
    clOnlineCatalogStatus={loaded:true,loading:false,error:'',updatedAt:new Date()};
  }catch(err){
    console.error('CocktailDB catalog load failed',err);
    clOnlineCatalogStatus={loaded:false,loading:false,error:err?.message||String(err),updatedAt:null};
  }
  if(cocktailHubView==='bar' || selectedEpisode) render();
};
window.clLoadOnlineCatalog=clLoadOnlineCatalog;
