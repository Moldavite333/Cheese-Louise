// Cheese Louise v1.6 — provider/network and release-timing filters.
// Loaded after holiday-season-filters.js, movie-discovery.js, and v16-audit-fixes.js.

movieFilters.network = movieFilters.network || null;
movieFilters.releaseWindow = movieFilters.releaseWindow || 'all';

function v16NetworkValues(){
  const values=new Set();
  for(const m of (state.movies||[])){
    if(m.network) values.add(String(m.network).trim());
    for(const p of (m.providers||[])) if(p) values.add(String(p).trim());
  }
  for(const c of (state.discoveryResults||[])){
    if(c.network) values.add(String(c.network).trim());
    for(const p of (c.providers||[])) if(p) values.add(String(p).trim());
  }
  return [...values].filter(Boolean).sort((a,b)=>a.localeCompare(b));
}

function v16MatchesNetwork(item){
  if(!movieFilters.network) return true;
  const needle=clNorm(movieFilters.network);
  const values=[item.network,...(item.providers||[])].filter(Boolean).map(clNorm);
  return values.some(v=>v===needle || v.includes(needle) || needle.includes(v));
}

function v16MatchesRelease(item){
  const mode=movieFilters.releaseWindow||'all';
  if(mode==='all') return true;
  const raw=item.premiere_date;
  if(!raw) return false;
  const date=new Date(`${String(raw).slice(0,10)}T12:00:00`);
  if(Number.isNaN(date.getTime())) return false;
  const now=new Date(); now.setHours(0,0,0,0);
  if(mode==='upcoming') return date>=now;
  if(mode==='released') return date<now;
  if(mode==='next30'){
    const end=new Date(now); end.setDate(end.getDate()+30);
    return date>=now && date<=end;
  }
  return true;
}

const v16RadarOriginalMovieMatch=movieMatchesCheeseFilters;
movieMatchesCheeseFilters=function(m){
  return v16RadarOriginalMovieMatch(m) && v16MatchesNetwork(m) && v16MatchesRelease(m);
};

const v16RadarOriginalDiscoveryMatch=discoveryMatchesCurrentView;
discoveryMatchesCurrentView=function(c){
  return v16RadarOriginalDiscoveryMatch(c) && v16MatchesNetwork(c) && v16MatchesRelease(c);
};

const v16RadarOriginalActiveCount=activeFilterCount;
activeFilterCount=function(){
  return v16RadarOriginalActiveCount() + (movieFilters.network?1:0) + ((movieFilters.releaseWindow||'all')!=='all'?1:0);
};

function v16RadarExtraFilterHtml(){
  const networks=v16NetworkValues();
  return `<div class="filter-category">
    <div class="kicker">Network / Streaming Provider</div>
    <select class="search" style="width:100%;margin-top:8px" onchange="setNetworkFilter(this.value)">
      <option value="">All networks & providers</option>
      ${networks.map(v=>`<option value="${esc(v)}" ${clNorm(v)===clNorm(movieFilters.network)?'selected':''}>${esc(v)}</option>`).join('')}
    </select>
  </div>
  <div class="filter-category">
    <div class="kicker">Release timing</div>
    <div class="trait-chip-grid">
      <button class="trait-chip ${(movieFilters.releaseWindow||'all')==='all'?'selected':''}" onclick="setReleaseWindow('all')">All</button>
      <button class="trait-chip ${movieFilters.releaseWindow==='upcoming'?'selected':''}" onclick="setReleaseWindow('upcoming')">Coming up</button>
      <button class="trait-chip ${movieFilters.releaseWindow==='next30'?'selected':''}" onclick="setReleaseWindow('next30')">Next 30 days</button>
      <button class="trait-chip ${movieFilters.releaseWindow==='released'?'selected':''}" onclick="setReleaseWindow('released')">Already released</button>
    </div>
  </div>`;
}

const v16RadarOriginalFilterPanel=cheeseFilterPanel;
cheeseFilterPanel=function(){
  const html=v16RadarOriginalFilterPanel();
  return html.replace('<div class="preset-actions">', `${v16RadarExtraFilterHtml()}<div class="preset-actions">`);
};

saveCurrentFilterPreset=async function(){
  const name=prompt('Name this movie filter:'); if(!name) return;
  const criteria={
    mode:movieFilters.mode,
    min_score:Number(movieFilters.minScore||0),
    trait_ids:[...(movieFilters.traitIds||[])],
    trait_categories:[...(movieFilters.traitCategories||[])],
    status:movieFilters.status||null,
    holiday:movieFilters.holiday||null,
    season:movieFilters.season||null,
    network:movieFilters.network||null,
    release_window:movieFilters.releaseWindow||'all'
  };
  const {error}=await db.from('filter_presets').upsert({workspace_id:workspace.id,name:name.trim(),criteria,created_by:me()},{onConflict:'workspace_id,name'});
  if(error) return alert(error.message);
  await loadAll(); render();
};

applyFilterPreset=function(id){
  const p=state.filterPresets.find(x=>x.id===id); if(!p) return;
  const c=p.criteria||{};
  const ids=new Set(c.trait_ids||[]);
  for(const name of (c.trait_names||[])){
    const t=state.traits.find(x=>x.name===name); if(t) ids.add(t.id);
  }
  movieFilters={
    mode:c.mode||'all',
    minScore:Number(c.min_score||0),
    traitIds:[...ids],
    traitCategories:[...(c.trait_categories||[])],
    status:c.status||null,
    holiday:c.holiday||null,
    season:c.season||null,
    network:c.network||null,
    releaseWindow:c.release_window||'all'
  };
  showMovieFilters=true;
  render();
};

window.setNetworkFilter=(value)=>{movieFilters.network=value||null;render();};
window.setReleaseWindow=(value)=>{movieFilters.releaseWindow=value||'all';render();};
window.saveCurrentFilterPreset=saveCurrentFilterPreset;
window.applyFilterPreset=applyFilterPreset;
window.clearMovieFilters=()=>{
  movieFilters={mode:'all',minScore:0,traitIds:[],traitCategories:[],status:null,holiday:null,season:null,network:null,releaseWindow:'all'};
  render();
};
