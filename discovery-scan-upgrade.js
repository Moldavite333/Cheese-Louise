// Cheese Louise — broader, balanced Romantiverse discovery scan.
// Loaded after movie-discovery.js. Keeps the existing UI, but asks the Edge Function
// for a much deeper catalog and surfaces coverage across seasonal buckets.

let discoveryScanCoverage = {};
let discoveryScanMeta = null;

discoverCheeseMovies = async function(force=false){
  if(discoveryLoading) return;
  if(discoveryLoaded && !force) return;
  discoveryLoading=true;
  discoveryError='';
  render();

  try{
    const {data,error}=await db.functions.invoke('discover-cheese-movies',{
      body:{
        days_back:3650,
        days_forward:730,
        max_results:96
      }
    });
    if(error) throw error;
    if(data?.error) throw new Error(data.error);

    state.discoveryResults=Array.isArray(data?.results)?data.results:[];
    discoveryScanCoverage=data?.coverage||{};
    discoveryScanMeta={
      scanned:Number(data?.scanned_candidates||0),
      enriched:Number(data?.enriched_candidates||0),
      returned:Number(data?.count||state.discoveryResults.length),
      window:data?.window||null,
      generated_at:data?.generated_at||null
    };
    discoveryLoaded=true;
  }catch(err){
    discoveryError=err?.message||String(err);
  }finally{
    discoveryLoading=false;
    render();
  }
};

const discoveryScanOriginalPanel=discoveryPanel;
discoveryPanel=function(){
  let html=discoveryScanOriginalPanel();
  if(!discoveryLoaded||!discoveryScanMeta) return html;

  const coverageEntries=Object.entries(discoveryScanCoverage||{}).filter(([,count])=>Number(count)>0);
  const coverage=coverageEntries.length
    ? `<div class="pills" style="margin:10px 0 14px">${coverageEntries.map(([label,count])=>`<span class="pill">${esc(label)} <strong>${Number(count)}</strong></span>`).join('')}</div>`
    : '';
  const scanLine=`<div class="subtle" style="margin:8px 0 4px">Deep scan: <strong>${discoveryScanMeta.scanned}</strong> catalog candidates checked · <strong>${discoveryScanMeta.returned}</strong> balanced finds returned · roughly 10 years back + 2 years forward.</div>`;

  return html.replace('<div class="new-find-grid">',`${scanLine}${coverage}<div class="new-find-grid">`);
};

window.discoverCheeseMovies=discoverCheeseMovies;
