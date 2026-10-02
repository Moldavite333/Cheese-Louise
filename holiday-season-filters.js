// Cheese Louise v1.9 — Holiday + season metadata and Movie Radar filters.
// Loaded after cheese-traits.js so it extends the existing Cheese Radar UI.

const CL_HOLIDAYS = [
  'Christmas',
  'Thanksgiving',
  'Halloween',
  "Valentine's Day",
  "New Year's",
  'Easter',
  "St. Patrick's Day",
  'Fourth of July',
  "Mother's Day",
  "Father's Day",
  'Other'
];
const CL_SEASONS = ['Winter','Spring','Summer','Fall'];

movieFilters.holiday = movieFilters.holiday || null;
movieFilters.season = movieFilters.season || null;

function clNorm(value){ return String(value || '').trim().toLowerCase(); }
function clOption(value, current){ return `<option value="${esc(value)}" ${clNorm(value)===clNorm(current)?'selected':''}>${esc(value)}</option>`; }

const clOriginalMovieMatchesCheeseFilters = movieMatchesCheeseFilters;
movieMatchesCheeseFilters = function(m){
  if(!clOriginalMovieMatchesCheeseFilters(m)) return false;
  if(movieFilters.holiday && clNorm(m.holiday)!==clNorm(movieFilters.holiday)) return false;
  if(movieFilters.season && clNorm(m.season)!==clNorm(movieFilters.season)) return false;
  return true;
};

const clOriginalActiveFilterCount = activeFilterCount;
activeFilterCount = function(){
  return clOriginalActiveFilterCount() + (movieFilters.holiday?1:0) + (movieFilters.season?1:0);
};

function clHolidaySeasonFilterHtml(){
  return `<div class="filter-category">
    <div class="kicker">Holiday / Special</div>
    <div class="trait-chip-grid">
      <button class="trait-chip ${!movieFilters.holiday?'selected':''}" onclick="setHolidayFilter('')">All</button>
      ${CL_HOLIDAYS.map((v,i)=>`<button class="trait-chip ${clNorm(movieFilters.holiday)===clNorm(v)?'selected':''}" onclick="setHolidayFilterByIndex(${i})">${esc(v)}</button>`).join('')}
    </div>
  </div>
  <div class="filter-category">
    <div class="kicker">Season</div>
    <div class="trait-chip-grid">
      <button class="trait-chip ${!movieFilters.season?'selected':''}" onclick="setSeasonFilter('')">All</button>
      ${CL_SEASONS.map((v,i)=>`<button class="trait-chip ${clNorm(movieFilters.season)===clNorm(v)?'selected':''}" onclick="setSeasonFilterByIndex(${i})">${esc(v)}</button>`).join('')}
    </div>
  </div>`;
}

const clOriginalCheeseFilterPanel = cheeseFilterPanel;
cheeseFilterPanel = function(){
  const html=clOriginalCheeseFilterPanel();
  return html.replace('<div class="preset-actions">', `${clHolidaySeasonFilterHtml()}<div class="preset-actions">`);
};

const clOriginalMovieCard = movieCard;
movieCard = function(m){
  let html=clOriginalMovieCard(m);
  const meta=[m.holiday,m.season].filter(Boolean);
  if(meta.length){
    html=html.replace('<div class="pills">', `<div class="pills"><span class="pill">${meta.map(esc).join(' · ')}</span></div><div class="pills">`);
  }
  return html;
};

function clMetadataEditor(m){
  return `<div class="card card-pad" style="margin-top:14px">
    <div class="kicker">When does this cheese happen?</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">
      <label class="subtle">Holiday / Special
        <select class="search" style="width:100%;margin-top:5px" onchange="setMovieHolidaySeason('${m.id}','holiday',this.value)">
          <option value="">None / not specific</option>
          ${CL_HOLIDAYS.map(v=>clOption(v,m.holiday)).join('')}
        </select>
      </label>
      <label class="subtle">Season
        <select class="search" style="width:100%;margin-top:5px" onchange="setMovieHolidaySeason('${m.id}','season',this.value)">
          <option value="">Not set</option>
          ${CL_SEASONS.map(v=>clOption(v,m.season)).join('')}
        </select>
      </label>
    </div>
  </div>`;
}

const clOriginalCheeseMovieModal = cheeseMovieModal;
cheeseMovieModal = function(){
  const m=state.movies.find(x=>x.id===selectedMovie);
  const html=clOriginalCheeseMovieModal();
  if(!m) return html;
  return html.replace('<div class="trait-tools">', `${clMetadataEditor(m)}<div class="trait-tools">`);
};

async function setMovieHolidaySeason(id,field,value){
  if(!['holiday','season'].includes(field)) return;
  const patch={updated_at:new Date().toISOString()};
  patch[field]=value || null;
  const {error}=await db.from('movies').update(patch).eq('id',id);
  if(error) return alert(error.message);
  await loadAll(); render();
}

addMovie = async function(){
  const title=prompt('Movie title:'); if(!title) return;
  const network=prompt('Network / studio:','Hallmark')||'';
  const summary=prompt('Short premise / synopsis:','')||'';
  const premiere=prompt('Premiere date (YYYY-MM-DD, optional):','')||'';
  const holiday=(prompt('Holiday / special (optional — Christmas, Halloween, Thanksgiving, etc.):','')||'').trim();
  const season=(prompt('Season (optional — Winter, Spring, Summer, Fall):','')||'').trim();
  const payload={workspace_id:workspace.id,title,network,cheese_score:0,tags:[],summary,status:'radar',holiday:holiday||null,season:season||null,created_by:me()};
  if(/^\d{4}-\d{2}-\d{2}$/.test(premiere)) payload.premiere_date=premiere;
  const {data,error}=await db.from('movies').insert(payload).select().single();
  if(error) return alert(error.message);
  await logActivity(`added ${title} to the Movie Radar.`,'movie',data.id);
  await loadAll();
  selectedMovie=data.id;
  traitSearch=''; traitSelectedOnly=false;
  render();
};

saveCurrentFilterPreset = async function(){
  const name=prompt('Name this movie filter:'); if(!name) return;
  const criteria={
    mode:movieFilters.mode,
    min_score:Number(movieFilters.minScore||0),
    trait_ids:[...(movieFilters.traitIds||[])],
    trait_categories:[...(movieFilters.traitCategories||[])],
    status:movieFilters.status||null,
    holiday:movieFilters.holiday||null,
    season:movieFilters.season||null
  };
  const {error}=await db.from('filter_presets').upsert({workspace_id:workspace.id,name:name.trim(),criteria,created_by:me()},{onConflict:'workspace_id,name'});
  if(error) return alert(error.message);
  await loadAll(); render();
};

applyFilterPreset = function(id){
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
    season:c.season||null
  };
  showMovieFilters=true;
  render();
};

window.setHolidayFilter=(value)=>{movieFilters.holiday=value||null;render()};
window.setSeasonFilter=(value)=>{movieFilters.season=value||null;render()};
// Use numeric indexes in inline HTML handlers so apostrophes/quotes in holiday names
// cannot break the onclick attribute. These wrappers call whatever fast handler is
// currently installed (v1.8+ overrides setHolidayFilter/setSeasonFilter later).
window.setHolidayFilterByIndex=(index)=>window.setHolidayFilter(CL_HOLIDAYS[Number(index)]||'');
window.setSeasonFilterByIndex=(index)=>window.setSeasonFilter(CL_SEASONS[Number(index)]||'');
window.setMovieHolidaySeason=setMovieHolidaySeason;
window.addMovie=addMovie;
window.saveCurrentFilterPreset=saveCurrentFilterPreset;
window.applyFilterPreset=applyFilterPreset;
window.clearMovieFilters=()=>{movieFilters={mode:'all',minScore:0,traitIds:[],traitCategories:[],status:null,holiday:null,season:null};render()};
