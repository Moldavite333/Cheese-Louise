// Cheese Louise v1.16 — Romantiverse Bingo
// Uses the existing Cheese Traits table as the single source of truth.

state.bingoCards = state.bingoCards || [];

let rvBingoDraft = null;
let rvBingoPlayMode = false;
let rvBingoPicker = null;
let rvBingoMultiOpen = false;
let rvBingoRecentTraitIds = [];

const RV_BINGO_FREE_INDEX = 12;
const RV_BINGO_SIZE = 25;
const RV_BINGO_LINES = [
  [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],
  [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],
  [0,6,12,18,24],[4,8,12,16,20]
];

function rvBingoActiveTraits(){
  return (state.traits||[]).filter(t=>t.is_active!==false);
}

function rvBingoTraitById(id){ return (state.traits||[]).find(t=>String(t.id)===String(id)) || null; }
function rvBingoTraitName(id){ return rvBingoTraitById(id)?.name || 'Trait removed'; }
function rvBingoTraitCategory(id){ return rvBingoTraitById(id)?.category || 'Wildcard'; }
function rvBingoUnique(arr){ return [...new Set((arr||[]).filter(Boolean))]; }
function rvBingoHas(arr,value){ return (arr||[]).includes(value); }
function rvBingoToggleArray(arr,value){ return rvBingoHas(arr,value) ? arr.filter(x=>x!==value) : [...arr,value]; }
function rvBingoRandomSeed(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }

function rvBingoHashSeed(text){
  let h=2166136261;
  for(const ch of String(text||'')){
    h^=ch.charCodeAt(0);
    h=Math.imul(h,16777619);
  }
  return h>>>0;
}
function rvBingoPrng(seed){
  let a=rvBingoHashSeed(seed||rvBingoRandomSeed());
  return function(){
    a|=0; a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;
  };
}
function rvBingoShuffle(arr,rng=Math.random){
  const out=[...arr];
  for(let i=out.length-1;i>0;i--){
    const j=Math.floor(rng()*(i+1));
    [out[i],out[j]]=[out[j],out[i]];
  }
  return out;
}

function rvBingoBlankDraft(){
  return {
    id:null,
    card_number:null,
    name:'',
    seed_code:'',
    squares:Array(RV_BINGO_SIZE).fill(null),
    locked_indices:[],
    marked_indices:[RV_BINGO_FREE_INDEX],
    excluded_trait_ids:[],
    include_categories:[],
    exclude_categories:[],
    created_at:null
  };
}

function rvBingoDraftFromRow(row){
  const d=rvBingoBlankDraft();
  const squares=Array.isArray(row?.squares)?row.squares.slice(0,RV_BINGO_SIZE):[];
  while(squares.length<RV_BINGO_SIZE) squares.push(null);
  squares[RV_BINGO_FREE_INDEX]=null;
  return {
    ...d,
    ...row,
    squares,
    locked_indices:(row.locked_indices||[]).map(Number).filter(i=>i!==RV_BINGO_FREE_INDEX),
    marked_indices:rvBingoUnique([RV_BINGO_FREE_INDEX,...(row.marked_indices||[]).map(Number)]),
    excluded_trait_ids:row.excluded_trait_ids||[],
    include_categories:row.include_categories||[],
    exclude_categories:row.exclude_categories||[]
  };
}

function rvBingoCategories(){
  return [...new Set(rvBingoActiveTraits().map(t=>t.category||'Wildcard'))].sort((a,b)=>a.localeCompare(b));
}

function rvBingoEligibleTraits(draft=rvBingoDraft){
  if(!draft) return [];
  const includes=new Set(draft.include_categories||[]);
  const excludes=new Set(draft.exclude_categories||[]);
  const excludedTraits=new Set((draft.excluded_trait_ids||[]).map(String));
  return rvBingoActiveTraits().filter(t=>{
    const cat=t.category||'Wildcard';
    if(excludedTraits.has(String(t.id))) return false;
    if(includes.size && !includes.has(cat)) return false;
    if(excludes.has(cat)) return false;
    return true;
  });
}

function rvBingoUsageMap(){
  const map=new Map();
  for(const id of rvBingoRecentTraitIds){ map.set(String(id),(map.get(String(id))||0)+1); }
  return map;
}

function rvBingoBalancedPick(count,{draft=rvBingoDraft,rng=Math.random,usedIds=new Set(),usageMap=rvBingoUsageMap()}={}){
  const eligible=rvBingoEligibleTraits(draft).filter(t=>!usedIds.has(String(t.id)));
  if(eligible.length<count) return null;
  const groups=new Map();
  for(const trait of eligible){
    const cat=trait.category||'Wildcard';
    if(!groups.has(cat)) groups.set(cat,[]);
    groups.get(cat).push(trait);
  }
  for(const [cat,list] of groups){ groups.set(cat,rvBingoShuffle(list,rng)); }
  const categoryCounts=new Map();
  const picks=[];
  while(picks.length<count){
    const available=[...groups.entries()].filter(([,list])=>list.some(t=>!usedIds.has(String(t.id))));
    if(!available.length) break;
    const minCatCount=Math.min(...available.map(([cat])=>categoryCounts.get(cat)||0));
    const least=available.filter(([cat])=>(categoryCounts.get(cat)||0)===minCatCount);
    const [category,list]=least[Math.floor(rng()*least.length)];
    const candidates=list.filter(t=>!usedIds.has(String(t.id)));
    const minUsage=Math.min(...candidates.map(t=>usageMap.get(String(t.id))||0));
    const underused=candidates.filter(t=>(usageMap.get(String(t.id))||0)===minUsage);
    const trait=underused[Math.floor(rng()*underused.length)];
    picks.push(trait);
    usedIds.add(String(trait.id));
    categoryCounts.set(category,(categoryCounts.get(category)||0)+1);
  }
  return picks.length===count?picks:null;
}

function rvBingoGenerateDraft({seed=null,respectLocks=false,usageMap=null}={}){
  if(!rvBingoDraft) rvBingoDraft=rvBingoBlankDraft();
  const seedCode=(seed||rvBingoRandomSeed()).trim().toUpperCase();
  const rng=rvBingoPrng(seedCode);
  const next=rvBingoDraftFromRow(rvBingoDraft);
  next.seed_code=seedCode;
  const locked=new Set(respectLocks?(next.locked_indices||[]):[]);
  const used=new Set();
  for(const i of locked){
    const id=next.squares[i];
    if(id) used.add(String(id));
  }
  const targets=[];
  for(let i=0;i<RV_BINGO_SIZE;i++){
    if(i===RV_BINGO_FREE_INDEX) continue;
    if(!locked.has(i)) targets.push(i);
  }
  const map=usageMap||rvBingoUsageMap();
  const picks=rvBingoBalancedPick(targets.length,{draft:next,rng,usedIds:used,usageMap:map});
  if(!picks){
    alert(`Not enough eligible Cheese Traits. This setup needs ${targets.length} unique traits, but only ${rvBingoEligibleTraits(next).length} are available after filters.`);
    return false;
  }
  const shuffled=rvBingoShuffle(picks,rng);
  targets.forEach((index,n)=>{ next.squares[index]=shuffled[n].id; });
  next.squares[RV_BINGO_FREE_INDEX]=null;
  next.marked_indices=[RV_BINGO_FREE_INDEX];
  if(!respectLocks) next.locked_indices=[];
  rvBingoRecentTraitIds=[...rvBingoRecentTraitIds,...shuffled.map(t=>t.id)].slice(-120);
  rvBingoDraft=next;
  return true;
}

function rvBingoGenerateNew(){
  rvBingoDraft=rvBingoBlankDraft();
  if(rvBingoGenerateDraft({seed:rvBingoRandomSeed(),respectLocks:false})){
    rvBingoPlayMode=false;
    render();
  }
}

function rvBingoBuildOwn(){
  rvBingoDraft=rvBingoBlankDraft();
  rvBingoPlayMode=false;
  render();
}

function rvBingoRegenerateCard(){
  if(!rvBingoDraft) return rvBingoGenerateNew();
  if(rvBingoGenerateDraft({seed:rvBingoRandomSeed(),respectLocks:true})) render();
}

function rvBingoShuffleUnlocked(){
  if(!rvBingoDraft) return;
  const locked=new Set(rvBingoDraft.locked_indices||[]);
  const targets=[];
  const values=[];
  for(let i=0;i<RV_BINGO_SIZE;i++){
    if(i===RV_BINGO_FREE_INDEX||locked.has(i)) continue;
    targets.push(i);
    if(rvBingoDraft.squares[i]) values.push(rvBingoDraft.squares[i]);
  }
  const shuffled=rvBingoShuffle(values);
  targets.forEach((index,n)=>rvBingoDraft.squares[index]=shuffled[n]||null);
  rvBingoDraft.marked_indices=[RV_BINGO_FREE_INDEX];
  render();
}

function rvBingoClearCard(){
  rvBingoDraft=rvBingoBlankDraft();
  rvBingoPlayMode=false;
  render();
}

function rvBingoResetLocks(){
  if(!rvBingoDraft) return;
  rvBingoDraft.locked_indices=[];
  render();
}

function rvBingoToggleLock(index,event){
  if(event) event.stopPropagation();
  if(!rvBingoDraft||index===RV_BINGO_FREE_INDEX) return;
  rvBingoDraft.locked_indices=rvBingoToggleArray(rvBingoDraft.locked_indices,index);
  render();
}

function rvBingoOpenPicker(index){
  if(rvBingoPlayMode||!rvBingoDraft||index===RV_BINGO_FREE_INDEX) return;
  rvBingoPicker={mode:'square',index,search:'',category:'all'};
  render();
}

function rvBingoOpenExcludePicker(){
  if(!rvBingoDraft) rvBingoDraft=rvBingoBlankDraft();
  rvBingoPicker={mode:'exclude',index:null,search:'',category:'all'};
  render();
}

function rvBingoClosePicker(event){
  if(event&&event.target!==event.currentTarget) return;
  rvBingoPicker=null;
  render();
}

function rvBingoPickerSearch(value){ if(rvBingoPicker){rvBingoPicker.search=value||'';render();} }
function rvBingoPickerCategory(value){ if(rvBingoPicker){rvBingoPicker.category=value||'all';render();} }

function rvBingoUsedTraitIds(ignoreIndex=null){
  const used=new Set();
  (rvBingoDraft?.squares||[]).forEach((id,index)=>{
    if(index!==ignoreIndex&&id) used.add(String(id));
  });
  return used;
}

function rvBingoChooseTrait(id){
  if(!rvBingoPicker||rvBingoPicker.mode!=='square'||!rvBingoDraft) return;
  const index=rvBingoPicker.index;
  if(rvBingoUsedTraitIds(index).has(String(id))) return;
  rvBingoDraft.squares[index]=id;
  rvBingoDraft.marked_indices=rvBingoDraft.marked_indices.filter(i=>i!==index);
  rvBingoPicker=null;
  render();
}

function rvBingoRandomizeSquare(){
  if(!rvBingoPicker||rvBingoPicker.mode!=='square'||!rvBingoDraft) return;
  const index=rvBingoPicker.index;
  const used=rvBingoUsedTraitIds(index);
  const candidates=rvBingoEligibleTraits().filter(t=>!used.has(String(t.id))&&String(t.id)!==String(rvBingoDraft.squares[index]||''));
  if(!candidates.length) return alert('No unused eligible Cheese Traits are available for that square.');
  const trait=candidates[Math.floor(Math.random()*candidates.length)];
  rvBingoDraft.squares[index]=trait.id;
  rvBingoPicker=null;
  render();
}

function rvBingoToggleExcludedTrait(id){
  if(!rvBingoDraft) return;
  rvBingoDraft.excluded_trait_ids=rvBingoToggleArray(rvBingoDraft.excluded_trait_ids,id);
  render();
}

function rvBingoCycleCategory(category){
  if(!rvBingoDraft) rvBingoDraft=rvBingoBlankDraft();
  const inc=new Set(rvBingoDraft.include_categories||[]);
  const exc=new Set(rvBingoDraft.exclude_categories||[]);
  if(!inc.has(category)&&!exc.has(category)) inc.add(category);
  else if(inc.has(category)){ inc.delete(category); exc.add(category); }
  else exc.delete(category);
  rvBingoDraft.include_categories=[...inc];
  rvBingoDraft.exclude_categories=[...exc];
  render();
}

function rvBingoCategoryState(category){
  if((rvBingoDraft?.include_categories||[]).includes(category)) return 'include';
  if((rvBingoDraft?.exclude_categories||[]).includes(category)) return 'exclude';
  return 'neutral';
}

function rvBingoWinningLines(){
  if(!rvBingoDraft) return [];
  const marked=new Set(rvBingoDraft.marked_indices||[]);
  marked.add(RV_BINGO_FREE_INDEX);
  return RV_BINGO_LINES.filter(line=>line.every(i=>marked.has(i)));
}

function rvBingoWinningIndexes(){ return new Set(rvBingoWinningLines().flat()); }

async function rvBingoToggleMark(index){
  if(!rvBingoDraft||!rvBingoPlayMode||index===RV_BINGO_FREE_INDEX||!rvBingoDraft.squares[index]) return;
  rvBingoDraft.marked_indices=rvBingoToggleArray(rvBingoDraft.marked_indices,index);
  rvBingoDraft.marked_indices=rvBingoUnique([RV_BINGO_FREE_INDEX,...rvBingoDraft.marked_indices]);
  render();
  if(rvBingoDraft.id){
    const {error}=await db.from('romantiverse_bingo_cards').update({marked_indices:rvBingoDraft.marked_indices,updated_at:new Date().toISOString()}).eq('id',rvBingoDraft.id).eq('workspace_id',workspace.id);
    if(error) console.error('Could not save Bingo play state',error);
  }
}

function rvBingoStartPlay(){
  if(!rvBingoCardIsFull()) return alert('Fill all 24 Cheese Trait squares before playing.');
  rvBingoPlayMode=true;
  rvBingoDraft.marked_indices=rvBingoUnique([RV_BINGO_FREE_INDEX,...(rvBingoDraft.marked_indices||[])]);
  render();
  window.scrollTo({top:0,behavior:'smooth'});
}
function rvBingoStopPlay(){ rvBingoPlayMode=false; render(); }

function rvBingoCardIsFull(){
  if(!rvBingoDraft) return false;
  const ids=rvBingoDraft.squares.filter((id,index)=>index!==RV_BINGO_FREE_INDEX&&id);
  return ids.length===24&&new Set(ids.map(String)).size===24;
}

function rvBingoSquareHtml(index){
  const free=index===RV_BINGO_FREE_INDEX;
  const id=rvBingoDraft?.squares?.[index]||null;
  const marked=free||(rvBingoDraft?.marked_indices||[]).includes(index);
  const locked=(rvBingoDraft?.locked_indices||[]).includes(index);
  const winning=rvBingoWinningIndexes().has(index);
  if(free){
    return `<button class="rv-bingo-square rv-bingo-free ${marked?'is-marked':''} ${winning?'is-winning':''}" type="button" aria-label="Free space"><span class="rv-bingo-free-icon">🧀</span><span>FREE SPACE</span></button>`;
  }
  const title=id?rvBingoTraitName(id):'Tap to choose';
  const cat=id?rvBingoTraitCategory(id):'';
  return `<div class="rv-bingo-square-wrap">
    <button class="rv-bingo-square ${marked?'is-marked':''} ${winning?'is-winning':''} ${!id?'is-empty':''}" type="button" onclick="${rvBingoPlayMode?`rvBingoToggleMark(${index})`:`rvBingoOpenPicker(${index})`}" aria-label="${esc(title)}">
      <span class="rv-bingo-square-text">${esc(title)}</span>
      ${!rvBingoPlayMode&&cat?`<span class="rv-bingo-square-category">${esc(cat)}</span>`:''}
      ${rvBingoPlayMode&&marked?'<span class="rv-bingo-hit">✓</span>':''}
    </button>
    ${!rvBingoPlayMode?`<button class="rv-bingo-lock ${locked?'is-locked':''}" type="button" onclick="rvBingoToggleLock(${index},event)" aria-label="${locked?'Unlock':'Lock'} square">${locked?'🔒':'🔓'}</button>`:''}
  </div>`;
}

function rvBingoCardHtml(){
  if(!rvBingoDraft) return '';
  const wins=rvBingoWinningLines().length;
  return `<div class="rv-bingo-card-shell ${rvBingoPlayMode?'rv-bingo-playing':''}">
    <div class="rv-bingo-label-head">
      <div class="rv-bingo-brand-small">CHEESE LOUISE</div>
      <div class="rv-bingo-title">ROMANTIVERSE BINGO</div>
      <div class="rv-bingo-tagline">Unlocking the Rules of the Romantiverse</div>
      <div class="rv-bingo-card-meta">${rvBingoDraft.card_number?`Card #${rvBingoDraft.card_number}`:'Unsaved card'}${rvBingoDraft.seed_code?` · Seed ${esc(rvBingoDraft.seed_code)}`:''}</div>
    </div>
    ${wins?`<div class="rv-bingo-celebration">🎉 ROMANTIVERSE BINGO! ${wins>1?`· ${wins} lines`:''}</div>`:''}
    <div class="rv-bingo-board">${Array.from({length:RV_BINGO_SIZE},(_,i)=>rvBingoSquareHtml(i)).join('')}</div>
  </div>`;
}

function rvBingoEditorControls(){
  if(!rvBingoDraft||rvBingoPlayMode) return '';
  const eligible=rvBingoEligibleTraits().length;
  return `<div class="rv-bingo-editor-controls">
    <label class="rv-bingo-name-label">Card name<input id="rvBingoName" class="search" value="${esc(rvBingoDraft.name||'')}" placeholder="Christmas at the Evergreen Bakery" oninput="rvBingoSetName(this.value)"></label>
    <div class="rv-bingo-action-grid">
      <button class="primary rv-bingo-big-action" onclick="rvBingoGenerateNew()">GENERATE NEW CARD</button>
      <button class="secondary" onclick="rvBingoBuildOwn()">BUILD YOUR OWN</button>
      <button class="secondary" onclick="rvBingoRegenerateCard()">Randomize card</button>
      <button class="secondary" onclick="rvBingoShuffleUnlocked()">Shuffle unlocked squares</button>
      <button class="secondary" onclick="rvBingoResetLocks()">Reset locks</button>
      <button class="secondary" onclick="rvBingoClearCard()">Clear card</button>
    </div>
    <div class="rv-bingo-save-row">
      <button class="primary" onclick="rvBingoSaveCard()">${rvBingoDraft.id?'Save changes':'Save card'}</button>
      <button class="primary" onclick="rvBingoStartPlay()">▶ PLAY CARD</button>
      ${rvBingoDraft.id?`<button class="secondary" onclick="rvBingoDuplicateCurrent()">Duplicate card</button>`:''}
    </div>
    <details class="card card-pad rv-bingo-advanced">
      <summary><strong>Advanced generation</strong><span class="subtle"> ${eligible} available traits</span></summary>
      <div class="rv-bingo-advanced-body">
        <div><div class="kicker">Seeded generation</div><div class="rv-bingo-seed-row"><input id="rvBingoSeed" class="search" value="${esc(rvBingoDraft.seed_code||'')}" placeholder="ABC123" maxlength="20"><button class="secondary" onclick="rvBingoUseSeed()">Generate from seed</button></div></div>
        <div><div class="kicker">Category filters</div><div class="subtle">Tap a category: first tap = include only, second tap = exclude, third tap = neutral.</div><div class="rv-bingo-category-chips">${rvBingoCategories().map(cat=>{const s=rvBingoCategoryState(cat);return `<button class="rv-bingo-cat-chip ${s}" onclick="rvBingoCycleCategory('${esc(cat).replace(/'/g,"\\'")}')">${s==='include'?'+ ':s==='exclude'?'− ':''}${esc(cat)}</button>`}).join('')}</div></div>
        <div class="rv-bingo-filter-actions"><button class="secondary" onclick="rvBingoOpenExcludePicker()">Exclude specific traits (${rvBingoDraft.excluded_trait_ids.length})</button><button class="secondary" onclick="rvBingoClearGenerationFilters()">Clear filters</button></div>
        ${rvBingoRecentTraitIds.length?`<div><div class="kicker">Recently used</div><div class="pills">${rvBingoUnique(rvBingoRecentTraitIds.slice(-12).reverse()).slice(0,8).map(id=>`<span class="pill">${esc(rvBingoTraitName(id))}</span>`).join('')}</div></div>`:''}
      </div>
    </details>
    <div class="rv-bingo-export-row"><button class="secondary" onclick="rvBingoShareCard()">↗ SHARE CARD</button><button class="secondary" onclick="rvBingoExportPng()">Export PNG</button><button class="secondary" onclick="rvBingoPrintView()">Print view</button><button class="secondary" onclick="rvBingoOpenMulti()">Generate multiple cards</button></div>
  </div>`;
}

function rvBingoPlayerControls(){
  if(!rvBingoDraft||!rvBingoPlayMode) return '';
  return `<div class="rv-bingo-player-controls"><button class="secondary" onclick="rvBingoStopPlay()">← Edit card</button><button class="secondary" onclick="rvBingoShareCard()">Share card</button><button class="secondary" onclick="rvBingoResetMarks()">Reset hits</button></div>`;
}

function rvBingoSetName(value){ if(rvBingoDraft) rvBingoDraft.name=value||''; }
function rvBingoUseSeed(){
  const seed=(document.getElementById('rvBingoSeed')?.value||'').trim();
  if(!seed) return alert('Enter a short seed code first.');
  if(rvBingoGenerateDraft({seed,respectLocks:true})) render();
}
function rvBingoClearGenerationFilters(){
  if(!rvBingoDraft) return;
  rvBingoDraft.excluded_trait_ids=[];
  rvBingoDraft.include_categories=[];
  rvBingoDraft.exclude_categories=[];
  render();
}
async function rvBingoResetMarks(){
  if(!rvBingoDraft) return;
  rvBingoDraft.marked_indices=[RV_BINGO_FREE_INDEX];
  render();
  if(rvBingoDraft.id) await db.from('romantiverse_bingo_cards').update({marked_indices:[RV_BINGO_FREE_INDEX],updated_at:new Date().toISOString()}).eq('id',rvBingoDraft.id).eq('workspace_id',workspace.id);
}

function rvBingoSavedCardsHtml(){
  const cards=state.bingoCards||[];
  return `<section class="section"><div class="rv-bingo-section-head"><div><h2 style="margin:0">Saved Cards</h2><div class="subtle">Reopen, duplicate, rename, delete, or hand different boards to watch-along players.</div></div><span class="pill">${cards.length} saved</span></div>
    <div class="rv-bingo-saved-grid">${cards.map(card=>{
      const filled=(card.squares||[]).filter(Boolean).length;
      return `<article class="card card-pad rv-bingo-saved-card"><div class="kicker">Card #${card.card_number} · ${esc(fmtDate(card.created_at))}</div><h3>${esc(card.name)}</h3><div class="subtle">${filled}/24 traits · Share ID ${esc(String(card.id).slice(0,8).toUpperCase())}</div><div class="rv-bingo-saved-actions"><button class="primary" onclick="rvBingoOpenSaved('${card.id}')">Open</button><button class="secondary" onclick="rvBingoDuplicateSaved('${card.id}')">Duplicate</button><button class="secondary" onclick="rvBingoRenameSaved('${card.id}')">Rename</button><button class="secondary rv-bingo-danger" onclick="rvBingoDeleteSaved('${card.id}')">Delete</button></div></article>`;
    }).join('')||'<div class="empty">No saved Bingo cards yet. Generate one and save it when you like the board.</div>'}</div>
  </section>`;
}

function rvBingoPage(){
  if(!rvBingoDraft) rvBingoDraft=rvBingoBlankDraft();
  return `<section class="section rv-bingo-intro"><div class="page-title">Romantiverse Bingo</div><div class="subtle">Build watch-along cards directly from the live Cheese Traits library. ${rvBingoActiveTraits().length} active traits are currently eligible.</div></section>
  <section class="section rv-bingo-workspace">${rvBingoPlayerControls()}${rvBingoCardHtml()}${rvBingoEditorControls()}</section>
  ${rvBingoPlayMode?'':rvBingoSavedCardsHtml()}`;
}

function rvBingoPickerModal(){
  if(!rvBingoPicker||!rvBingoDraft) return '';
  const squareMode=rvBingoPicker.mode==='square';
  const current=squareMode?rvBingoDraft.squares[rvBingoPicker.index]:null;
  const used=rvBingoUsedTraitIds(squareMode?rvBingoPicker.index:null);
  const q=(rvBingoPicker.search||'').trim().toLowerCase();
  const category=rvBingoPicker.category||'all';
  const traits=(state.traits||[]).filter(t=>{
    if(t.is_active===false&&!current) return false;
    const cat=t.category||'Wildcard';
    if(category!=='all'&&cat!==category) return false;
    if(q&&!`${t.name} ${cat}`.toLowerCase().includes(q)) return false;
    return true;
  }).sort((a,b)=>(a.category||'').localeCompare(b.category||'')||a.name.localeCompare(b.name));
  return `<div class="modal-backdrop" onclick="rvBingoClosePicker(event)"><div class="modal rv-bingo-picker-modal" onclick="event.stopPropagation()"><div class="modal-header"><div><div class="kicker">${squareMode?`Square ${rvBingoPicker.index+1}`:'Generation filters'}</div><h2>${squareMode?'Choose a Cheese Trait':'Exclude Cheese Traits'}</h2></div><button class="close" onclick="rvBingoClosePicker()">×</button></div>
    ${squareMode?`<div class="rv-bingo-picker-actions"><button class="primary" onclick="rvBingoRandomizeSquare()">🎲 Randomize only this square</button><button class="secondary" onclick="rvBingoToggleLock(${rvBingoPicker.index});rvBingoClosePicker()">${(rvBingoDraft.locked_indices||[]).includes(rvBingoPicker.index)?'Unlock square':'Lock square'}</button></div>`:''}
    <div class="rv-bingo-picker-filters"><input class="search" placeholder="Search Cheese Traits…" value="${esc(rvBingoPicker.search||'')}" oninput="rvBingoPickerSearch(this.value)"><select class="search" onchange="rvBingoPickerCategory(this.value)"><option value="all">All categories</option>${rvBingoCategories().map(cat=>`<option value="${esc(cat)}" ${cat===category?'selected':''}>${esc(cat)}</option>`).join('')}</select></div>
    <div class="rv-bingo-trait-picker-list">${traits.map(t=>{
      const already=used.has(String(t.id));
      const selected=String(current||'')===String(t.id);
      const excluded=(rvBingoDraft.excluded_trait_ids||[]).includes(t.id);
      if(squareMode) return `<button class="rv-bingo-trait-option ${already?'is-used':''} ${selected?'is-selected':''}" ${already?'disabled':''} onclick="rvBingoChooseTrait('${t.id}')"><span><strong>${esc(t.name)}</strong><small>${esc(t.category||'Wildcard')}</small></span><span>${selected?'✓':already?'Used':''}</span></button>`;
      return `<button class="rv-bingo-trait-option ${excluded?'is-excluded':''}" onclick="rvBingoToggleExcludedTrait('${t.id}')"><span><strong>${esc(t.name)}</strong><small>${esc(t.category||'Wildcard')}</small></span><span>${excluded?'Excluded':'Include'}</span></button>`;
    }).join('')||'<div class="empty">No traits match this search.</div>'}</div>
    <div class="episode-editor-actions"><button class="secondary" onclick="rvBingoClosePicker()">Done</button></div></div></div>`;
}

function rvBingoMultiModal(){
  if(!rvBingoMultiOpen) return '';
  return `<div class="modal-backdrop" onclick="rvBingoCloseMulti(event)"><div class="modal rv-bingo-multi-modal" onclick="event.stopPropagation()"><div class="modal-header"><div><div class="kicker">Watch-along batch</div><h2>Generate multiple cards</h2></div><button class="close" onclick="rvBingoCloseMulti()">×</button></div><div class="subtle">Each card gets an independent balanced draw. The generator penalizes traits already used in the batch so cards spread apart as much as the Cheese Traits library allows.</div><div class="rv-bingo-multi-presets"><button class="secondary" onclick="rvBingoSetMultiCount(2)">2</button><button class="secondary" onclick="rvBingoSetMultiCount(5)">5</button><button class="secondary" onclick="rvBingoSetMultiCount(10)">10</button></div><label style="display:block;margin-top:14px"><strong>Number of cards</strong><input id="rvBingoMultiCount" class="search" type="number" min="2" max="50" value="5"></label><label style="display:block;margin-top:14px"><strong>Optional shared name prefix</strong><input id="rvBingoMultiPrefix" class="search" placeholder="Christmas Watch-Along"></label><div class="episode-editor-actions"><button class="primary" onclick="rvBingoGenerateMultiple()">Generate & save cards</button><button class="secondary" onclick="rvBingoCloseMulti()">Cancel</button></div></div></div>`;
}
function rvBingoOpenMulti(){ rvBingoMultiOpen=true; render(); }
function rvBingoCloseMulti(event){ if(event&&event.target!==event.currentTarget)return; rvBingoMultiOpen=false; render(); }
function rvBingoSetMultiCount(n){ const el=document.getElementById('rvBingoMultiCount'); if(el) el.value=n; }

function rvBingoNextNumber(){ return Math.max(0,...(state.bingoCards||[]).map(c=>Number(c.card_number)||0))+1; }
function rvBingoPayload(draft,cardNumber,name){
  return {
    workspace_id:workspace.id,
    card_number:cardNumber,
    name,
    seed_code:draft.seed_code||null,
    squares:draft.squares,
    locked_indices:draft.locked_indices||[],
    marked_indices:rvBingoUnique([RV_BINGO_FREE_INDEX,...(draft.marked_indices||[])]),
    excluded_trait_ids:draft.excluded_trait_ids||[],
    include_categories:draft.include_categories||[],
    exclude_categories:draft.exclude_categories||[],
    updated_at:new Date().toISOString()
  };
}

async function rvBingoSaveCard(){
  if(!workspace||!rvBingoDraft) return;
  const input=document.getElementById('rvBingoName');
  if(input) rvBingoDraft.name=input.value.trim();
  try{
    if(rvBingoDraft.id){
      const name=rvBingoDraft.name||`Romantiverse Bingo #${rvBingoDraft.card_number}`;
      const payload=rvBingoPayload(rvBingoDraft,rvBingoDraft.card_number,name);
      const {data,error}=await db.from('romantiverse_bingo_cards').update(payload).eq('id',rvBingoDraft.id).eq('workspace_id',workspace.id).select().single();
      if(error) throw error;
      rvBingoDraft=rvBingoDraftFromRow(data);
    }else{
      let number=rvBingoNextNumber();
      let result;
      for(let attempt=0;attempt<3;attempt++){
        const name=rvBingoDraft.name||`Romantiverse Bingo #${number}`;
        const payload={...rvBingoPayload(rvBingoDraft,number,name),created_by:me()};
        result=await db.from('romantiverse_bingo_cards').insert(payload).select().single();
        if(!result.error) break;
        if(result.error.code!=='23505') throw result.error;
        number++;
      }
      if(result?.error) throw result.error;
      rvBingoDraft=rvBingoDraftFromRow(result.data);
      await logActivity(`saved Romantiverse Bingo card #${rvBingoDraft.card_number}.`,'bingo',rvBingoDraft.id);
    }
    await loadAll();
    render();
  }catch(err){ alert(err?.message||String(err)); }
}

async function rvBingoInsertCopy(source,nameOverride=null,usageMap=null){
  let number=rvBingoNextNumber();
  const draft=rvBingoDraftFromRow(source);
  draft.id=null; draft.card_number=null; draft.created_at=null;
  const name=nameOverride||`${source.name||'Romantiverse Bingo'} — Copy`;
  for(let attempt=0;attempt<3;attempt++){
    const payload={...rvBingoPayload(draft,number,name),created_by:me()};
    const {data,error}=await db.from('romantiverse_bingo_cards').insert(payload).select().single();
    if(!error) return data;
    if(error.code!=='23505') throw error;
    number++;
  }
  throw new Error('Could not assign a card number. Try again.');
}

async function rvBingoDuplicateCurrent(){ if(rvBingoDraft?.id){ const row=await rvBingoInsertCopy(rvBingoDraft); await loadAll(); rvBingoDraft=rvBingoDraftFromRow(row); render(); } }
async function rvBingoDuplicateSaved(id){ const c=(state.bingoCards||[]).find(x=>x.id===id); if(!c)return; try{const row=await rvBingoInsertCopy(c);await loadAll();rvBingoDraft=rvBingoDraftFromRow(row);window.scrollTo(0,0);render();}catch(err){alert(err.message||String(err));} }
function rvBingoOpenSaved(id){ const c=(state.bingoCards||[]).find(x=>x.id===id); if(!c)return; rvBingoDraft=rvBingoDraftFromRow(c);rvBingoPlayMode=false;window.scrollTo(0,0);render(); }

async function rvBingoRenameSaved(id){
  const c=(state.bingoCards||[]).find(x=>x.id===id); if(!c)return;
  const name=prompt('Card name:',c.name||`Romantiverse Bingo #${c.card_number}`); if(name===null)return;
  const clean=name.trim()||`Romantiverse Bingo #${c.card_number}`;
  const {error}=await db.from('romantiverse_bingo_cards').update({name:clean,updated_at:new Date().toISOString()}).eq('id',id).eq('workspace_id',workspace.id);
  if(error)return alert(error.message);
  await loadAll();render();
}
async function rvBingoDeleteSaved(id){
  const c=(state.bingoCards||[]).find(x=>x.id===id); if(!c)return;
  if(!confirm(`Delete “${c.name}”?`))return;
  const {error}=await db.from('romantiverse_bingo_cards').delete().eq('id',id).eq('workspace_id',workspace.id);
  if(error)return alert(error.message);
  if(rvBingoDraft?.id===id) rvBingoDraft=rvBingoBlankDraft();
  await loadAll();render();
}

async function rvBingoGenerateMultiple(){
  const count=Math.max(2,Math.min(50,Number(document.getElementById('rvBingoMultiCount')?.value||5)));
  const prefix=(document.getElementById('rvBingoMultiPrefix')?.value||'').trim();
  const template=rvBingoDraft?rvBingoDraftFromRow(rvBingoDraft):rvBingoBlankDraft();
  template.id=null;template.card_number=null;template.locked_indices=[];template.marked_indices=[RV_BINGO_FREE_INDEX];
  if(rvBingoEligibleTraits(template).length<24) return alert('At least 24 eligible Cheese Traits are needed to generate a card.');
  rvBingoMultiOpen=false;
  const usage=new Map();
  for(const id of rvBingoRecentTraitIds) usage.set(String(id),(usage.get(String(id))||0)+1);
  let nextNumber=rvBingoNextNumber();
  try{
    const created=[];
    for(let n=0;n<count;n++){
      rvBingoDraft=rvBingoDraftFromRow(template);
      const seed=rvBingoRandomSeed();
      if(!rvBingoGenerateDraft({seed,respectLocks:false,usageMap:usage})) throw new Error('Could not generate enough unique traits for the batch.');
      for(const id of rvBingoDraft.squares.filter(Boolean)) usage.set(String(id),(usage.get(String(id))||0)+1);
      let saved=null;
      for(let attempt=0;attempt<4;attempt++){
        const name=prefix?`${prefix} #${n+1}`:`Romantiverse Bingo #${nextNumber}`;
        const payload={...rvBingoPayload(rvBingoDraft,nextNumber,name),created_by:me()};
        const res=await db.from('romantiverse_bingo_cards').insert(payload).select().single();
        if(!res.error){ saved=res.data; break; }
        if(res.error.code!=='23505') throw res.error;
        nextNumber++;
      }
      if(!saved) throw new Error('Could not save one of the generated cards.');
      created.push(saved);
      nextNumber++;
    }
    await loadAll();
    rvBingoDraft=rvBingoDraftFromRow(created[0]);
    await logActivity(`generated ${created.length} Romantiverse Bingo cards.`,'bingo',created[0]?.id||null);
    render();
  }catch(err){ alert(err?.message||String(err)); await loadAll(); render(); }
}

function rvBingoCanvas(){
  if(!rvBingoDraft) return null;
  const canvas=document.createElement('canvas');
  canvas.width=1400; canvas.height=1600;
  const ctx=canvas.getContext('2d');
  const cream='#f4ead1', green='#173f36', red='#a9362b', gold='#c99a32', ink='#1c211e';
  ctx.fillStyle=cream;ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle=green;ctx.fillRect(0,0,canvas.width,210);
  ctx.textAlign='center';ctx.fillStyle=gold;ctx.font='700 30px Georgia';ctx.fillText('CHEESE LOUISE',700,48);
  ctx.fillStyle=cream;ctx.font='900 68px Arial';ctx.fillText('ROMANTIVERSE BINGO',700,118);
  ctx.font='28px Georgia';ctx.fillText('Unlocking the Rules of the Romantiverse',700,165);
  ctx.fillStyle=red;ctx.fillRect(80,230,1240,8);
  const x0=80,y0=270,size=248;
  function wrap(text,x,y,maxWidth,maxLines=5){
    const words=String(text).split(/\s+/);let lines=[],line='';
    for(const w of words){const test=line?`${line} ${w}`:w;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=w;}else line=test;}
    if(line)lines.push(line);while(lines.length>maxLines){const last=lines.pop();lines[lines.length-1]+=' '+last;}
    const lh=34,start=y-(lines.length-1)*lh/2;lines.forEach((l,i)=>ctx.fillText(l,x,start+i*lh));
  }
  for(let i=0;i<25;i++){
    const col=i%5,row=Math.floor(i/5),x=x0+col*size,y=y0+row*size;
    const free=i===12;
    ctx.fillStyle=free?gold:'#fffaf0';ctx.fillRect(x,y,size,size);
    ctx.strokeStyle=green;ctx.lineWidth=5;ctx.strokeRect(x,y,size,size);
    ctx.fillStyle=free?green:ink;ctx.font=free?'900 34px Arial':'700 30px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
    wrap(free?'FREE SPACE':rvBingoTraitName(rvBingoDraft.squares[i]),x+size/2,y+size/2,size-30,5);
  }
  ctx.textBaseline='alphabetic';ctx.fillStyle=green;ctx.font='24px Arial';ctx.fillText(rvBingoDraft.name||`Romantiverse Bingo${rvBingoDraft.card_number?` #${rvBingoDraft.card_number}`:''}`,700,1540);
  return canvas;
}
function rvBingoCanvasBlob(canvas){ return new Promise(resolve=>canvas.toBlob(resolve,'image/png')); }
async function rvBingoExportPng(){
  const canvas=rvBingoCanvas(); if(!canvas)return;
  const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download=`${(rvBingoDraft.name||'romantiverse-bingo').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'romantiverse-bingo'}.png`;document.body.appendChild(a);a.click();a.remove();
}
async function rvBingoShareCard(){
  const canvas=rvBingoCanvas(); if(!canvas)return;
  const blob=await rvBingoCanvasBlob(canvas); if(!blob)return rvBingoExportPng();
  const file=new File([blob],'romantiverse-bingo.png',{type:'image/png'});
  if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
    try{await navigator.share({title:rvBingoDraft.name||'Romantiverse Bingo',text:'Cheese Louise · Romantiverse Bingo',files:[file]});return;}catch(err){if(err?.name==='AbortError')return;}
  }
  await rvBingoExportPng();
}
function rvBingoPrintView(){
  if(!rvBingoDraft)return;
  const win=window.open('','_blank'); if(!win)return alert('Allow pop-ups to open the print view.');
  const cells=Array.from({length:25},(_,i)=>`<div class="cell ${i===12?'free':''}">${i===12?'FREE SPACE':esc(rvBingoTraitName(rvBingoDraft.squares[i]))}</div>`).join('');
  win.document.write(`<!doctype html><html><head><title>${esc(rvBingoDraft.name||'Romantiverse Bingo')}</title><style>body{font-family:Arial,sans-serif;background:#fffdf4;color:#173f36;padding:24px}.wrap{max-width:850px;margin:auto}.brand{text-align:center}.brand small{font-weight:700;letter-spacing:.18em}.brand h1{margin:8px 0 4px}.board{display:grid;grid-template-columns:repeat(5,1fr);border:2px solid #173f36;margin-top:18px}.cell{aspect-ratio:1;display:flex;align-items:center;justify-content:center;text-align:center;padding:8px;border:1px solid #173f36;font-weight:700;font-size:14px}.free{background:#eee5c8}@media print{body{padding:0}.board{break-inside:avoid}}</style></head><body><div class="wrap"><div class="brand"><small>CHEESE LOUISE</small><h1>ROMANTIVERSE BINGO</h1><div>${esc(rvBingoDraft.name||'')}</div></div><div class="board">${cells}</div></div><script>window.onload=()=>window.print()<\/script></body></html>`);win.document.close();
}

const rvBingoOriginalLoadAll=loadAll;
loadAll=async function(){
  await rvBingoOriginalLoadAll();
  if(!workspace){state.bingoCards=[];return;}
  const {data,error}=await db.from('romantiverse_bingo_cards').select('*').eq('workspace_id',workspace.id).order('created_at',{ascending:false});
  if(error){console.error('Could not load Romantiverse Bingo cards',error);state.bingoCards=[];return;}
  state.bingoCards=data||[];
  if(rvBingoDraft?.id){
    const fresh=state.bingoCards.find(c=>c.id===rvBingoDraft.id);
    if(fresh&&!rvBingoPlayMode) rvBingoDraft=rvBingoDraftFromRow(fresh);
  }
};

function openRomantiverseBingo(){
  romantiverseHubView='bingo';
  currentTab='ideas';
  selectedMovie=null;
  rvBingoPicker=null;
  rvBingoMultiOpen=false;
  render();
  window.scrollTo(0,0);
}

rvRulesHubNav=function(){
  return `<section class="section"><div class="toolbar" style="margin-bottom:0">
    <button class="filter ${romantiverseHubView==='lab'?'active-filter':''}" onclick="openShowLabView()">💡 Show Lab</button>
    <button class="filter ${romantiverseHubView==='rules'?'active-filter':''}" onclick="openRomantiverseRules()">📜 Rules of the Romantiverse</button>
    <button class="filter ${romantiverseHubView==='checklist'?'active-filter':''}" onclick="openPodcastLaunchChecklist()">🚀 Podcast 101</button>
    <button class="filter ${romantiverseHubView==='bingo'?'active-filter':''}" onclick="openRomantiverseBingo()">🎯 Romantiverse Bingo</button>
  </div></section>`;
};

const rvBingoOriginalIdeas=ideas;
ideas=function(){
  if(romantiverseHubView==='bingo') return rvRulesHubNav()+rvBingoPage();
  return rvBingoOriginalIdeas();
};

const rvBingoOriginalModal=modal;
modal=function(){
  if(rvBingoPicker) return rvBingoPickerModal();
  if(rvBingoMultiOpen) return rvBingoMultiModal();
  return rvBingoOriginalModal();
};

const rvBingoOriginalGo=window.go;
window.go=function(tab){
  if(tab!=='ideas'){rvBingoPicker=null;rvBingoMultiOpen=false;rvBingoPlayMode=false;}
  return rvBingoOriginalGo(tab);
};

const rvBingoOriginalTopbar=topbar;
topbar=function(){
  return rvBingoOriginalTopbar()
    .replace('>v1.15<','>v1.16<')
    .replace('>v1.14<','>v1.16<');
};

window.openRomantiverseBingo=openRomantiverseBingo;
window.rvBingoGenerateNew=rvBingoGenerateNew;
window.rvBingoBuildOwn=rvBingoBuildOwn;
window.rvBingoRegenerateCard=rvBingoRegenerateCard;
window.rvBingoShuffleUnlocked=rvBingoShuffleUnlocked;
window.rvBingoClearCard=rvBingoClearCard;
window.rvBingoResetLocks=rvBingoResetLocks;
window.rvBingoToggleLock=rvBingoToggleLock;
window.rvBingoOpenPicker=rvBingoOpenPicker;
window.rvBingoOpenExcludePicker=rvBingoOpenExcludePicker;
window.rvBingoClosePicker=rvBingoClosePicker;
window.rvBingoPickerSearch=rvBingoPickerSearch;
window.rvBingoPickerCategory=rvBingoPickerCategory;
window.rvBingoChooseTrait=rvBingoChooseTrait;
window.rvBingoRandomizeSquare=rvBingoRandomizeSquare;
window.rvBingoToggleExcludedTrait=rvBingoToggleExcludedTrait;
window.rvBingoCycleCategory=rvBingoCycleCategory;
window.rvBingoStartPlay=rvBingoStartPlay;
window.rvBingoStopPlay=rvBingoStopPlay;
window.rvBingoToggleMark=rvBingoToggleMark;
window.rvBingoResetMarks=rvBingoResetMarks;
window.rvBingoSetName=rvBingoSetName;
window.rvBingoUseSeed=rvBingoUseSeed;
window.rvBingoClearGenerationFilters=rvBingoClearGenerationFilters;
window.rvBingoSaveCard=rvBingoSaveCard;
window.rvBingoDuplicateCurrent=rvBingoDuplicateCurrent;
window.rvBingoOpenSaved=rvBingoOpenSaved;
window.rvBingoDuplicateSaved=rvBingoDuplicateSaved;
window.rvBingoRenameSaved=rvBingoRenameSaved;
window.rvBingoDeleteSaved=rvBingoDeleteSaved;
window.rvBingoOpenMulti=rvBingoOpenMulti;
window.rvBingoCloseMulti=rvBingoCloseMulti;
window.rvBingoSetMultiCount=rvBingoSetMultiCount;
window.rvBingoGenerateMultiple=rvBingoGenerateMultiple;
window.rvBingoShareCard=rvBingoShareCard;
window.rvBingoExportPng=rvBingoExportPng;
window.rvBingoPrintView=rvBingoPrintView;
