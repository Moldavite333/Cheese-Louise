// Cheese Louise v1.12 — Cocktail Bar + movie/cocktail matchmaker
// Loaded after the Romantiverse rules layer so it can use the final shared state.

state.cocktails = state.cocktails || [];

let cocktailHubView = 'episodes';
let cocktailViewType = 'original';
let cocktailSearch = '';
let editingCocktail = null;
let cocktailDraft = null;
let cocktailMatchMovieId = '';
let cocktailMatchType = 'original';
let episodeCocktailMatchType = null;

const CL_COCKTAIL_TYPES = {
  original: 'Original Cocktail',
  cheese_louise: 'Cheese Louise Cocktail'
};

const CL_BAR_HOLIDAYS = typeof CL_HOLIDAYS !== 'undefined' ? CL_HOLIDAYS : [
  'Christmas','Thanksgiving','Halloween',"Valentine's Day",'New Year\'s','Easter',
  "St. Patrick's Day",'Fourth of July',"Mother's Day","Father's Day",'Other'
];
const CL_BAR_SEASONS = typeof CL_SEASONS !== 'undefined' ? CL_SEASONS : ['Winter','Spring','Summer','Fall'];

const clCocktailOriginalLoadAll = loadAll;
loadAll = async function(){
  await clCocktailOriginalLoadAll();
  if(!workspace){ state.cocktails = []; return; }
  const {data,error} = await db
    .from('cocktails')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('cocktail_type', {ascending:true})
    .order('name', {ascending:true});
  if(error) throw error;
  state.cocktails = data || [];
};

function clCocktailById(id){ return (state.cocktails||[]).find(c=>c.id===id); }
function clParentCocktail(c){ return c?.parent_cocktail_id ? clCocktailById(c.parent_cocktail_id) : null; }
function clCocktailTypeLabel(type){ return CL_COCKTAIL_TYPES[type] || 'Cocktail'; }
function clCleanTag(value){ return String(value||'').trim().toLowerCase().replace(/\s+/g,'-'); }
function clUnique(values){ return [...new Set((values||[]).filter(Boolean))]; }
function clTagLabel(tag){ return String(tag||'').replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); }

function clCocktailTagSet(c){
  const parent = clParentCocktail(c);
  return new Set(clUnique([
    ...(parent?.flavor_tags||[]),
    ...(c?.flavor_tags||[]),
    clCleanTag(parent?.base_spirit), clCleanTag(parent?.style),
    clCleanTag(c?.base_spirit), clCleanTag(c?.style),
    clCleanTag(c?.holiday), clCleanTag(c?.season)
  ]).map(clCleanTag));
}

const CL_HOLIDAY_SIGNALS = {
  'christmas':['holiday','winter','warming','baking-spice','cranberry','herbal','sparkling','cozy'],
  'thanksgiving':['fall','warming','baking-spice','apple','bourbon','cozy'],
  'halloween':['fall','dark','smoky','spiced','berry','playful'],
  "valentine's-day":['romantic','sparkling','berry','pink','elegant','playful'],
  'new-year-s':['sparkling','elegant','celebratory','night'],
  'new-years':['sparkling','elegant','celebratory','night'],
  'easter':['spring','floral','citrus','light','sparkling'],
  'st-patrick-s-day':['herbal','green','whiskey','celebratory'],
  'fourth-of-july':['summer','refreshing','citrus','berry','highball','crowd-friendly']
};

const CL_SEASON_SIGNALS = {
  winter:['winter','warming','cozy','spiced'],
  spring:['spring','floral','light','citrus'],
  summer:['summer','refreshing','citrus','highball'],
  fall:['fall','warming','spiced','apple','bourbon']
};

const CL_TRAIT_SIGNAL_RULES = [
  [/bakery|baker|pastry|cupcake/, ['dessert','sweet','vanilla','baking-spice']],
  [/christmas tree farm|tree farm/, ['herbal','rosemary','winter','holiday']],
  [/royal|prince|princess|duke|duchess|palace/, ['elegant','sparkling','celebratory']],
  [/dead spouse|widow|widower|dead parent|orphan/, ['spirit-forward','bitter','dark']],
  [/fake dating|fake relationship|pretend couple/, ['playful','sparkling','romantic']],
  [/snowed in|snowed-in|blizzard|forced proximity/, ['warming','cozy']],
  [/vineyard|winery|wine/, ['wine','grape','elegant']],
  [/bookstore|book shop|bookshop/, ['cozy','coffee']],
  [/inn|b&b|bed and breakfast/, ['cozy','warming']],
  [/tropical|beach|island|resort/, ['tropical','rum','citrus','refreshing']],
  [/festival|tree lighting|fundraiser/, ['festive','sparkling','crowd-friendly']],
  [/carpenter|handyman|contractor/, ['bourbon','warming']],
  [/rivals|competitors|enemies/, ['bitter','spicy']],
  [/amnesia|time travel|mistaken identity/, ['playful','unexpected']]
];

function clMovieCocktailSignals(movie){
  if(!movie) return {tags:[], evidence:[]};
  const tags = new Set();
  const evidence = [];
  const add = (vals, why)=>{
    for(const value of vals||[]) tags.add(clCleanTag(value));
    if(why) evidence.push(why);
  };

  if(movie.holiday){
    const key = clCleanTag(movie.holiday);
    add([key, ...(CL_HOLIDAY_SIGNALS[key]||[])], `${movie.holiday} setting`);
  }
  if(movie.season){
    const key = clCleanTag(movie.season);
    add([key, ...(CL_SEASON_SIGNALS[key]||[])], `${movie.season} setting`);
  }

  const traitText = (movie.selectedTraits||[]).map(t=>t.name).join(' | ').toLowerCase();
  const text = `${traitText} ${movie.title||''} ${movie.summary||''} ${(movie.tags||[]).join(' ')}`.toLowerCase();
  for(const [re,vals] of CL_TRAIT_SIGNAL_RULES){
    if(re.test(text)) add(vals, `Romantiverse clue: ${text.match(re)?.[0]||'movie trait'}`);
  }
  if(/christmas|holiday/.test(text)) add(['holiday','winter','warming'], 'holiday language');
  if(/coffee|cafe|café/.test(text)) add(['coffee','cozy'], 'coffee/café setting');
  if(/farm|country|ranch/.test(text)) add(['bourbon','herbal','rustic'], 'farm/country setting');
  if(/city|executive|corporate/.test(text)) add(['elegant','night'], 'big-city career energy');

  return {tags:[...tags], evidence:clUnique(evidence)};
}

function clCocktailMatch(movie, cocktail){
  const signals = clMovieCocktailSignals(movie);
  const cocktailTags = clCocktailTagSet(cocktail);
  const overlaps = signals.tags.filter(tag=>cocktailTags.has(tag));
  const holidayMatch = !!(movie?.holiday && cocktail?.holiday && clCleanTag(movie.holiday)===clCleanTag(cocktail.holiday));
  const seasonMatch = !!(movie?.season && cocktail?.season && clCleanTag(movie.season)===clCleanTag(cocktail.season));
  const parent = clParentCocktail(cocktail);

  let score = 24 + Math.min(5, overlaps.length) * 11;
  if(holidayMatch) score += 20;
  if(seasonMatch) score += 10;
  if(cocktail.batchable && signals.tags.includes('crowd-friendly')) score += 7;
  if(cocktail.tested) score += 3;
  score = Math.max(12, Math.min(99, score));

  const reasons = [];
  if(holidayMatch) reasons.push(`built for ${movie.holiday}`);
  if(seasonMatch) reasons.push(`${movie.season} match`);
  if(overlaps.length) reasons.push(`matches ${overlaps.slice(0,4).map(clTagLabel).join(', ')}`);
  if(parent) reasons.push(`Cheese Louise variation of ${parent.name}`);
  if(!reasons.length) reasons.push('general style match; add more movie traits for a sharper recommendation');

  return {cocktail, score, overlaps, reasons, signals};
}

function clMatchCocktails(movie, type){
  return (state.cocktails||[])
    .filter(c=>!type || c.cocktail_type===type)
    .map(c=>clCocktailMatch(movie,c))
    .sort((a,b)=>b.score-a.score || a.cocktail.name.localeCompare(b.cocktail.name));
}

function clVariationPlan(movie, parent){
  const signals = clMovieCocktailSignals(movie);
  const tags = new Set([...(parent?.flavor_tags||[]), ...signals.tags]);
  const additions = [];
  let garnish = parent?.garnish || '';

  const has = tag=>signals.tags.includes(tag);
  if(has('cranberry') || clCleanTag(movie?.holiday)==='christmas'){
    additions.push('1/4 oz cranberry-spice syrup');
    garnish = 'Rosemary sprig and orange peel';
    tags.add('cranberry'); tags.add('rosemary'); tags.add('holiday');
  }
  if(has('dessert') || has('baking-spice')){
    additions.push('1/4 oz vanilla-cinnamon syrup');
    garnish = garnish || 'Fresh grated nutmeg';
    tags.add('vanilla'); tags.add('baking-spice');
  }
  if(has('apple') && additions.length<2){
    additions.push('1/4 oz apple-cinnamon syrup');
    garnish = 'Thin apple slice and cinnamon stick';
    tags.add('apple');
  }
  if(has('berry') && additions.length<2){
    additions.push('1/4 oz raspberry or blackberry syrup');
    garnish = 'Fresh berries and lemon twist';
    tags.add('berry');
  }
  if(has('tropical') && additions.length<2){
    additions.push('1/2 oz pineapple juice or 1/4 oz passion fruit syrup');
    garnish = 'Lime wheel and mint';
    tags.add('tropical');
  }
  if(has('sparkling') && !clCocktailTagSet(parent).has('sparkling') && additions.length<2){
    additions.push('1 oz sparkling wine to finish');
    garnish = garnish || 'Lemon twist';
    tags.add('sparkling');
  }
  if(has('dark') && additions.length<2){
    additions.push('1 dash aromatic bitters or 1/4 oz dark berry syrup');
    tags.add('dark');
  }
  if(!additions.length){
    additions.push('1/4 oz house seasonal syrup');
    tags.add('house-variation');
  }

  const theme = (movie?.selectedTraits||[]).find(t=>/christmas tree farm|bakery|royal|vineyard/i.test(t.name))?.name
    || movie?.holiday || movie?.season || 'Romantiverse';
  const name = `${theme} ${parent?.name||'Cocktail'}`;
  const ingredientBlock = `${parent?.ingredients||''}${parent?.ingredients?'\n':''}${additions.map(x=>`Cheese Louise variation: ${x}`).join('\n')}`;
  const method = `${parent?.method||'Prepare as usual.'} Add the Cheese Louise variation ingredient with the base drink unless the note says to finish on top.`;
  const notes = `Generated for ${movie?.title||'a movie'} from ${parent?.name||'an Original Cocktail'}. Suggested because of: ${signals.evidence.slice(0,4).join('; ')||signals.tags.slice(0,5).map(clTagLabel).join(', ')}. Edit freely before saving.`;

  return {
    name,
    cocktail_type:'cheese_louise',
    parent_cocktail_id:parent?.id||null,
    base_spirit:parent?.base_spirit||'',
    style:parent?.style||'',
    flavor_tags:[...tags].slice(0,16),
    season:movie?.season||parent?.season||'',
    holiday:movie?.holiday||parent?.holiday||'',
    ingredients:ingredientBlock,
    garnish,
    glassware:parent?.glassware||'',
    method,
    notes,
    batchable:!!parent?.batchable,
    strength:parent?.strength||'medium',
    tested:false,
    rating:null
  };
}

function clGenerateVariation(movieId, parentId=null){
  const movie = (state.movies||[]).find(m=>m.id===movieId);
  if(!movie) return alert('Pick a movie first.');
  let parent = parentId ? clCocktailById(parentId) : null;
  if(!parent){
    parent = clMatchCocktails(movie,'original')[0]?.cocktail || (state.cocktails||[]).find(c=>c.cocktail_type==='original');
  }
  if(!parent) return alert('Add at least one Original Cocktail first.');
  cocktailDraft = clVariationPlan(movie,parent);
  editingCocktail = 'new';
  cocktailHubView = 'bar';
  cocktailViewType = 'cheese_louise';
  selectedEpisode = null;
  selectedMovie = null;
  render();
}

function clBarHubNav(){
  return `<section class="section"><div class="toolbar cl-hub-tabs">
    <button class="filter ${cocktailHubView==='episodes'?'active-filter':''}" onclick="openEpisodeWorkspace()">🎙 Episodes</button>
    <button class="filter ${cocktailHubView==='bar'?'active-filter':''}" onclick="openCocktailBar()">🍸 Cheese Louise Bar</button>
  </div></section>`;
}

function clCocktailMatchesSearch(c){
  if(c.cocktail_type!==cocktailViewType) return false;
  const q=cocktailSearch.trim().toLowerCase();
  if(!q) return true;
  const parent=clParentCocktail(c);
  return [c.name,c.base_spirit,c.style,c.holiday,c.season,c.ingredients,c.notes,parent?.name,...(c.flavor_tags||[])].join(' ').toLowerCase().includes(q);
}

function clCocktailCard(c){
  const parent=clParentCocktail(c);
  const typeLabel=clCocktailTypeLabel(c.cocktail_type);
  const rating=c.rating?` · ${'★'.repeat(Number(c.rating))}`:'';
  return `<article class="card card-pad cl-cocktail-card">
    <div class="cl-cocktail-card-head"><div><div class="kicker">${esc(typeLabel)}</div><h3>${esc(c.name)}</h3></div><button class="secondary" onclick="editCocktail('${c.id}')">Edit</button></div>
    <div class="subtle">${esc([c.base_spirit,c.style].filter(Boolean).join(' · ')||'Style not set')}${c.tested?' · ✓ Tested':''}${rating}</div>
    ${parent?`<div class="subtle" style="margin-top:5px">Based on <strong>${esc(parent.name)}</strong></div>`:''}
    <div class="pills" style="margin-top:10px">${(c.flavor_tags||[]).slice(0,7).map(t=>`<span class="pill">${esc(clTagLabel(t))}</span>`).join('')}</div>
    <details class="cl-recipe-details"><summary>Recipe</summary>
      ${c.ingredients?`<div class="cl-recipe-block"><strong>Ingredients</strong><div>${esc(c.ingredients).replace(/\n/g,'<br>')}</div></div>`:''}
      ${c.method?`<div class="cl-recipe-block"><strong>Method</strong><div>${esc(c.method)}</div></div>`:''}
      <div class="subtle">${[c.glassware&&`Glass: ${c.glassware}`,c.garnish&&`Garnish: ${c.garnish}`,c.batchable?'Batchable':''].filter(Boolean).map(esc).join(' · ')}</div>
    </details>
  </article>`;
}

function clMatchResultCard(result, index){
  const c=result.cocktail;
  return `<div class="card card-pad cl-match-card">
    <div class="cl-match-score"><strong>#${index+1} ${esc(c.name)}</strong><span class="cheese-score">${result.score}%</span></div>
    <div class="subtle">${esc(result.reasons.join(' · '))}</div>
    <div class="pills" style="margin-top:8px">${result.overlaps.slice(0,5).map(t=>`<span class="pill">${esc(clTagLabel(t))}</span>`).join('')}</div>
    ${c.cocktail_type==='original'?`<button class="secondary" style="margin-top:10px" onclick="clGenerateVariation('${cocktailMatchMovieId}','${c.id}')">Make Cheese Louise variation</button>`:''}
  </div>`;
}

function clBarMatchPanel(){
  const movie=(state.movies||[]).find(m=>m.id===cocktailMatchMovieId);
  const results=movie?clMatchCocktails(movie,cocktailMatchType).slice(0,5):[];
  return `<div class="card card-pad cl-match-panel">
    <div class="kicker">Movie ↔ Cocktail Matchmaker</div>
    <h3 style="margin:6px 0">Match the drink to the movie</h3>
    <select class="search" style="width:100%" onchange="setCocktailMatchMovie(this.value)">
      <option value="">Choose a movie…</option>
      ${(state.movies||[]).slice().sort((a,b)=>a.title.localeCompare(b.title)).map(m=>`<option value="${m.id}" ${m.id===cocktailMatchMovieId?'selected':''}>${esc(m.title)}</option>`).join('')}
    </select>
    <div class="cl-dual-buttons" style="margin-top:10px">
      <button class="${cocktailMatchType==='original'?'primary':'secondary'}" onclick="setCocktailMatchType('original')">Original Cocktail</button>
      <button class="${cocktailMatchType==='cheese_louise'?'primary':'secondary'}" onclick="setCocktailMatchType('cheese_louise')">Cheese Louise Cocktail</button>
    </div>
    ${movie?`<div class="subtle" style="margin-top:10px">Matching against ${esc(movie.holiday||movie.season||'its Romantiverse clues')} and ${(movie.selectedTraits||[]).length} Cheese Trait${(movie.selectedTraits||[]).length===1?'':'s'}.</div>`:''}
    ${movie && cocktailMatchType==='cheese_louise'?`<button class="primary" style="margin-top:12px" onclick="clGenerateVariation('${movie.id}')">✨ Generate a Cheese Louise variation</button>`:''}
    <div class="cl-match-results">${movie?(results.length?results.map(clMatchResultCard).join(''):`<div class="empty">No ${esc(clCocktailTypeLabel(cocktailMatchType))} recipes yet. ${cocktailMatchType==='cheese_louise'?'Generate one from an Original Cocktail.':'Add an Original Cocktail to start the library.'}</div>`):'<div class="subtle" style="margin-top:12px">Pick a movie and the matchmaker will rank drinks already in your shared library.</div>'}</div>
  </div>`;
}

function cocktailBarPage(){
  const found=(state.cocktails||[]).filter(clCocktailMatchesSearch);
  return `<section class="section">
    <div class="page-title">Cheese Louise Bar</div>
    <div class="subtle">Keep the classics intact, then build Cheese Louise variations without losing the original recipe.</div>
    <div class="cl-dual-buttons" style="margin-top:14px">
      <button class="${cocktailViewType==='original'?'primary':'secondary'}" onclick="setCocktailViewType('original')">🍸 Original Cocktail</button>
      <button class="${cocktailViewType==='cheese_louise'?'primary':'secondary'}" onclick="setCocktailViewType('cheese_louise')">🧀 Cheese Louise Cocktail</button>
    </div>
    <div class="cl-bar-actions">
      <button class="primary" onclick="addCocktail('${cocktailViewType}')">+ Add ${esc(clCocktailTypeLabel(cocktailViewType))}</button>
      <input class="search" placeholder="Search cocktails…" value="${esc(cocktailSearch)}" oninput="setCocktailSearch(this.value)">
    </div>
  </section>
  <section class="section">${clBarMatchPanel()}</section>
  <section class="section"><div class="results-line"><strong>${found.length}</strong> ${esc(clCocktailTypeLabel(cocktailViewType))}${found.length===1?'':'s'}</div><div class="cl-cocktail-grid">${found.map(clCocktailCard).join('')||'<div class="empty">Nothing here yet.</div>'}</div></section>`;
}

function openEpisodeWorkspace(){ cocktailHubView='episodes'; editingCocktail=null; render(); }
function openCocktailBar(){ cocktailHubView='bar'; selectedEpisode=null; editingCocktail=null; currentTab='episodes'; render(); }
function setCocktailViewType(type){ cocktailViewType=type==='cheese_louise'?'cheese_louise':'original'; cocktailSearch=''; render(); }
function setCocktailSearch(value){ cocktailSearch=value||''; if(cocktailHubView==='bar') render(); }
function setCocktailMatchMovie(id){ cocktailMatchMovieId=id||''; render(); }
function setCocktailMatchType(type){ cocktailMatchType=type==='cheese_louise'?'cheese_louise':'original'; render(); }

const clOriginalEpisodes = episodes;
episodes = function(){
  return clBarHubNav() + (cocktailHubView==='bar' ? cocktailBarPage() : clOriginalEpisodes());
};

const clOriginalHome = home;
home = function(){
  return clOriginalHome() + `<section class="section"><div class="card card-pad cl-home-bar"><div class="kicker">Cocktail of the Week</div><h2>Cheese Louise Bar</h2><div class="subtle">${(state.cocktails||[]).filter(c=>c.cocktail_type==='original').length} originals · ${(state.cocktails||[]).filter(c=>c.cocktail_type==='cheese_louise').length} Cheese Louise drinks</div><button class="primary" style="margin-top:12px" onclick="openCocktailBar()">Open Cocktail Bar</button></div></section>`;
};

function addCocktail(type='original'){
  cocktailDraft={cocktail_type:type,parent_cocktail_id:null,name:'',base_spirit:'',style:'',flavor_tags:[],season:'',holiday:'',ingredients:'',garnish:'',glassware:'',method:'',notes:'',batchable:false,strength:'medium',tested:false,rating:null};
  editingCocktail='new';
  selectedEpisode=null; selectedMovie=null;
  render();
}

function editCocktail(id){
  if(!clCocktailById(id)) return;
  cocktailDraft=null;
  editingCocktail=id;
  selectedEpisode=null; selectedMovie=null;
  render();
}

function closeCocktailEditor(event){
  if(event && event.target!==event.currentTarget) return;
  editingCocktail=null; cocktailDraft=null; render();
}

function clSelectOptions(values,current,blankLabel='—'){
  return `<option value="">${esc(blankLabel)}</option>${values.map(v=>`<option value="${esc(v)}" ${v===current?'selected':''}>${esc(v)}</option>`).join('')}`;
}

function clCocktailEditorModal(){
  if(!editingCocktail) return '';
  const isNew=editingCocktail==='new';
  const c=isNew ? (cocktailDraft||{}) : clCocktailById(editingCocktail);
  if(!c) return '';
  const originals=(state.cocktails||[]).filter(x=>x.cocktail_type==='original' && x.id!==c.id).sort((a,b)=>a.name.localeCompare(b.name));
  return `<div class="modal-backdrop" onclick="closeCocktailEditor(event)"><div class="modal cl-cocktail-editor" onclick="event.stopPropagation()">
    <div class="modal-header"><div><div class="kicker">Cheese Louise Bar</div><h2 style="margin:6px 0">${isNew?'Add Cocktail':`Edit ${esc(c.name)}`}</h2></div><button class="close" onclick="closeCocktailEditor()">×</button></div>
    <div class="episode-editor-grid">
      <label>Type<select id="clType" class="search" onchange="clCocktailTypeChanged(this.value)"><option value="original" ${c.cocktail_type==='original'?'selected':''}>Original Cocktail</option><option value="cheese_louise" ${c.cocktail_type==='cheese_louise'?'selected':''}>Cheese Louise Cocktail</option></select></label>
      <label>Name<input id="clName" class="search" value="${esc(c.name||'')}"></label>
      <label id="clParentLabel" class="wide" style="${c.cocktail_type==='cheese_louise'?'':'display:none'}">Based on Original Cocktail<select id="clParent" class="search"><option value="">No parent / fully original house drink</option>${originals.map(x=>`<option value="${x.id}" ${x.id===c.parent_cocktail_id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
      <label>Base spirit<input id="clBase" class="search" value="${esc(c.base_spirit||'')}" placeholder="Gin, bourbon, rum…"></label>
      <label>Style<input id="clStyle" class="search" value="${esc(c.style||'')}" placeholder="Sour, tiki, highball…"></label>
      <label>Season<select id="clSeason" class="search">${clSelectOptions(CL_BAR_SEASONS,c.season,'Any season')}</select></label>
      <label>Holiday<select id="clHoliday" class="search">${clSelectOptions(CL_BAR_HOLIDAYS,c.holiday,'No specific holiday')}</select></label>
      <label class="wide">Flavor / matching tags<input id="clTags" class="search" value="${esc((c.flavor_tags||[]).join(', '))}" placeholder="citrus, warming, bakery, sparkling…"></label>
      <label class="wide">Ingredients<textarea id="clIngredients" class="search" rows="8" placeholder="2 oz bourbon\n3/4 oz lemon…">${esc(c.ingredients||'')}</textarea></label>
      <label>Glassware<input id="clGlass" class="search" value="${esc(c.glassware||'')}"></label>
      <label>Garnish<input id="clGarnish" class="search" value="${esc(c.garnish||'')}"></label>
      <label class="wide">Method<textarea id="clMethod" class="search" rows="4">${esc(c.method||'')}</textarea></label>
      <label>Strength<select id="clStrength" class="search"><option value="light" ${c.strength==='light'?'selected':''}>Light</option><option value="medium" ${!c.strength||c.strength==='medium'?'selected':''}>Medium</option><option value="strong" ${c.strength==='strong'?'selected':''}>Strong</option></select></label>
      <label>Rating<select id="clRating" class="search"><option value="">Not rated</option>${[1,2,3,4,5].map(n=>`<option value="${n}" ${Number(c.rating)===n?'selected':''}>${n} star${n===1?'':'s'}</option>`).join('')}</select></label>
      <label><span>Tested</span><div style="margin-top:10px"><input id="clTested" type="checkbox" ${c.tested?'checked':''}> We actually made it</div></label>
      <label><span>Batchable</span><div style="margin-top:10px"><input id="clBatchable" type="checkbox" ${c.batchable?'checked':''}> Easy to batch</div></label>
      <label class="wide">Notes<textarea id="clNotes" class="search" rows="5" placeholder="Why it works, changes to try, episode notes…">${esc(c.notes||'')}</textarea></label>
    </div>
    <div class="episode-editor-actions"><button class="primary" onclick="saveCocktail()">Save cocktail</button><button class="secondary" onclick="closeCocktailEditor()">Cancel</button></div>
  </div></div>`;
}

function clCocktailTypeChanged(type){
  const label=document.getElementById('clParentLabel');
  if(label) label.style.display=type==='cheese_louise'?'block':'none';
}

async function saveCocktail(){
  if(!workspace || !editingCocktail) return;
  const cocktail_type=document.getElementById('clType')?.value==='cheese_louise'?'cheese_louise':'original';
  const name=(document.getElementById('clName')?.value||'').trim();
  if(!name) return alert('Give the cocktail a name first.');
  const payload={
    workspace_id:workspace.id,
    name,
    cocktail_type,
    parent_cocktail_id:cocktail_type==='cheese_louise'?(document.getElementById('clParent')?.value||null):null,
    base_spirit:(document.getElementById('clBase')?.value||'').trim()||null,
    style:(document.getElementById('clStyle')?.value||'').trim()||null,
    season:document.getElementById('clSeason')?.value||null,
    holiday:document.getElementById('clHoliday')?.value||null,
    flavor_tags:clUnique((document.getElementById('clTags')?.value||'').split(',').map(clCleanTag).filter(Boolean)),
    ingredients:document.getElementById('clIngredients')?.value||'',
    glassware:(document.getElementById('clGlass')?.value||'').trim()||null,
    garnish:(document.getElementById('clGarnish')?.value||'').trim()||null,
    method:(document.getElementById('clMethod')?.value||'').trim()||null,
    strength:document.getElementById('clStrength')?.value||'medium',
    rating:document.getElementById('clRating')?.value?Number(document.getElementById('clRating').value):null,
    tested:!!document.getElementById('clTested')?.checked,
    batchable:!!document.getElementById('clBatchable')?.checked,
    notes:(document.getElementById('clNotes')?.value||'').trim()||null,
    updated_at:new Date().toISOString()
  };

  let result;
  if(editingCocktail==='new'){
    payload.created_by=me();
    result=await db.from('cocktails').insert(payload).select().single();
  }else{
    result=await db.from('cocktails').update(payload).eq('id',editingCocktail).select().single();
  }
  if(result.error){
    if(result.error.code==='23505') return alert('There is already a cocktail with that name in the shared library.');
    return alert(result.error.message);
  }
  await logActivity(`${editingCocktail==='new'?'added':'updated'} ${clCocktailTypeLabel(cocktail_type)}: ${name}.`,'cocktail',result.data.id);
  editingCocktail=null; cocktailDraft=null;
  await loadAll(); render();
}

function clCocktailOptions(current){
  const originals=(state.cocktails||[]).filter(c=>c.cocktail_type==='original').sort((a,b)=>a.name.localeCompare(b.name));
  const house=(state.cocktails||[]).filter(c=>c.cocktail_type==='cheese_louise').sort((a,b)=>a.name.localeCompare(b.name));
  const group=(label,arr)=>arr.length?`<optgroup label="${esc(label)}">${arr.map(c=>`<option value="${c.id}" ${c.id===current?'selected':''}>${esc(c.name)}</option>`).join('')}</optgroup>`:'';
  return `<option value="">No cocktail selected</option>${group('Original Cocktails',originals)}${group('Cheese Louise Cocktails',house)}`;
}

function clEpisodeMatchHtml(movieId,type){
  const movie=(state.movies||[]).find(m=>m.id===movieId);
  if(!movie) return '<div class="subtle" style="margin-top:8px">Link a movie first so the matchmaker has something to work with.</div>';
  const results=clMatchCocktails(movie,type).slice(0,3);
  if(!results.length) return `<div class="subtle" style="margin-top:8px">No ${esc(clCocktailTypeLabel(type))} recipes yet. Open the Cocktail Bar to add one${type==='cheese_louise'?' or generate a variation':''}.</div>`;
  return `<div class="cl-episode-match-list">${results.map(r=>`<button class="cl-episode-match-option" onclick="useEpisodeCocktail('${r.cocktail.id}')"><span><strong>${esc(r.cocktail.name)}</strong><small>${esc(r.reasons.join(' · '))}</small></span><b>${r.score}%</b></button>`).join('')}</div>`;
}

v16EpisodeModal = function(){
  const e=(state.episodes||[]).find(x=>x.id===selectedEpisode);
  if(!e) return '';
  return `<div class="modal-backdrop" onclick="closeEpisode(event)"><div class="modal episode-editor" onclick="event.stopPropagation()">
    <div class="modal-header"><div><div class="kicker">Episode workspace</div><h2 style="margin:6px 0">${esc(e.title)}</h2></div><button class="close" onclick="closeEpisode()">×</button></div>
    <div class="episode-editor-grid">
      <label class="wide">Episode title<input id="epTitle" class="search" value="${esc(e.title||'')}"></label>
      <label>Status<select id="epStatus" class="search">${v16EpisodeStatusOptions(e.status||'idea')}</select></label>
      <label>Release date<input id="epRelease" class="search" type="date" value="${esc(e.release_date||'')}"></label>
      <label class="wide">Movie<select id="epMovie" class="search" onchange="episodeCocktailMovieChanged()">${v16MovieOptions(e.movie_id||'')}</select></label>
      <label>Guest<input id="epGuest" class="search" value="${esc(e.guest||'')}"></label>
      <label class="wide cl-episode-cocktail-field">Cocktail of the Week<select id="epCocktailId" class="search" onchange="episodeCocktailSelected(this.value)">${clCocktailOptions(e.cocktail_id||'')}</select>
        ${e.cocktail && !e.cocktail_id?`<div class="subtle" style="margin-top:6px">Legacy cocktail note: ${esc(e.cocktail)}</div>`:''}
        <div class="cl-dual-buttons" style="margin-top:10px"><button type="button" class="secondary" onclick="showEpisodeCocktailMatches('original')">Original Cocktail</button><button type="button" class="secondary" onclick="showEpisodeCocktailMatches('cheese_louise')">Cheese Louise Cocktail</button></div>
        <div id="epCocktailMatches">${episodeCocktailMatchType?clEpisodeMatchHtml(e.movie_id,episodeCocktailMatchType):'<div class="subtle" style="margin-top:8px">Use either button to rank cocktails against the linked movie.</div>'}</div>
      </label>
      <label class="wide">Episode outline<textarea id="epOutline" class="search" rows="12" placeholder="Welcome / intro\nCocktail of the week\nGame\nGuest intro\nRecap + discussion\nRules of the Romantiverse\nRomantiverse Bingo…">${esc(e.outline||'')}</textarea></label>
      <label class="wide">Working notes<textarea id="epNotes" class="search" rows="6" placeholder="Bits, callbacks, research, things to remember…">${esc(e.notes||'')}</textarea></label>
    </div>
    <div class="episode-editor-actions"><button class="primary" onclick="saveEpisode('${e.id}')">Save episode</button><button class="secondary" onclick="scheduleEpisode('${e.id}')">📅 Schedule recording</button><button class="secondary" onclick="openCocktailBarFromEpisode()">🍸 Cocktail Bar</button></div>
  </div></div>`;
};

window.showEpisodeCocktailMatches=function(type){
  episodeCocktailMatchType=type==='cheese_louise'?'cheese_louise':'original';
  const movieId=document.getElementById('epMovie')?.value||'';
  const host=document.getElementById('epCocktailMatches');
  if(host) host.innerHTML=clEpisodeMatchHtml(movieId,episodeCocktailMatchType);
};
window.episodeCocktailMovieChanged=function(){
  if(episodeCocktailMatchType) window.showEpisodeCocktailMatches(episodeCocktailMatchType);
};
window.episodeCocktailSelected=function(){};
window.useEpisodeCocktail=function(id){
  const select=document.getElementById('epCocktailId');
  if(select){ select.value=id; select.dispatchEvent(new Event('change')); }
};
window.openCocktailBarFromEpisode=function(){
  selectedEpisode=null; episodeCocktailMatchType=null; cocktailHubView='bar'; currentTab='episodes'; render();
};

window.saveEpisode = async function(id){
  const cocktailId=document.getElementById('epCocktailId')?.value||null;
  const chosen=cocktailId?clCocktailById(cocktailId):null;
  const payload={
    title:(document.getElementById('epTitle')?.value||'').trim(),
    status:document.getElementById('epStatus')?.value||'idea',
    release_date:document.getElementById('epRelease')?.value||null,
    movie_id:document.getElementById('epMovie')?.value||null,
    guest:(document.getElementById('epGuest')?.value||'').trim()||null,
    cocktail_id:cocktailId,
    cocktail:chosen?.name||null,
    outline:document.getElementById('epOutline')?.value||null,
    notes:document.getElementById('epNotes')?.value||null,
    updated_at:new Date().toISOString()
  };
  if(!payload.title) return alert('Give the episode a title first.');
  const {error}=await db.from('episodes').update(payload).eq('id',id);
  if(error) return alert(error.message);
  await logActivity(`updated episode ${payload.title}${chosen?` with ${chosen.name}`:''}.`,'episode',id);
  episodeCocktailMatchType=null;
  await loadAll(); render();
};

const clOriginalModal = modal;
modal = function(){
  if(editingCocktail) return clCocktailEditorModal();
  return clOriginalModal();
};

const clOriginalGo = window.go;
window.go = function(tab){
  if(tab!=='episodes'){
    editingCocktail=null;
    cocktailDraft=null;
    episodeCocktailMatchType=null;
  }
  return clOriginalGo(tab);
};

const clOriginalTopbar = topbar;
topbar = function(){
  return clOriginalTopbar()
    .replace('>v1.11<','>v1.12<')
    .replace('>v1.10<','>v1.12<')
    .replace('>v1.9<','>v1.12<');
};

window.openEpisodeWorkspace=openEpisodeWorkspace;
window.openCocktailBar=openCocktailBar;
window.setCocktailViewType=setCocktailViewType;
window.setCocktailSearch=setCocktailSearch;
window.setCocktailMatchMovie=setCocktailMatchMovie;
window.setCocktailMatchType=setCocktailMatchType;
window.addCocktail=addCocktail;
window.editCocktail=editCocktail;
window.closeCocktailEditor=closeCocktailEditor;
window.clCocktailTypeChanged=clCocktailTypeChanged;
window.saveCocktail=saveCocktail;
window.clGenerateVariation=clGenerateVariation;
