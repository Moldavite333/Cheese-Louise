// Cheese Louise — Romantiverse Bingo theme filters
// Extends the existing Bingo generator with Season / Holiday / Non-Holiday Season pools.

const RV_BINGO_THEME_HOLIDAYS = [
  'Christmas','Thanksgiving','Halloween',"Valentine's Day","New Year's",'Easter',
  "St. Patrick's Day",'Fourth of July',"Mother's Day","Father's Day",'Other'
];
const RV_BINGO_THEME_SEASONS = ['Winter','Spring','Summer','Fall'];

let rvBingoThemeFilter = {
  mode:'all',
  holiday:'Christmas',
  season:'Winter'
};

function rvBingoThemeNorm(value){ return String(value||'').trim().toLowerCase(); }
function rvBingoThemeArray(value){
  if(Array.isArray(value)) return value.map(rvBingoThemeNorm).filter(Boolean);
  if(!value) return [];
  return String(value).split(/[,|/]/).map(rvBingoThemeNorm).filter(Boolean);
}
function rvBingoThemeHasText(text,words){ return words.some(word=>text.includes(word)); }

function rvBingoTraitThemeMeta(trait){
  const text=`${trait?.name||''} ${trait?.category||''} ${(trait?.description||'')} ${(trait?.notes||'')}`.toLowerCase();
  const holidays=new Set([
    ...rvBingoThemeArray(trait?.holiday),
    ...rvBingoThemeArray(trait?.holidays)
  ]);
  const seasons=new Set([
    ...rvBingoThemeArray(trait?.season),
    ...rvBingoThemeArray(trait?.seasons)
  ]);

  const holidayKeywords={
    'christmas':['christmas','xmas','mistletoe','tree lighting','christmas tree','santa','ornament','carol','wreath','holiday market','christmas market'],
    'thanksgiving':['thanksgiving','turkey dinner','friendsgiving'],
    'halloween':['halloween','haunted','costume','pumpkin carving','trick or treat','spooky'],
    "valentine's day":['valentine','valentines','february 14'],
    "new year's":['new year','new years','midnight kiss','countdown'],
    'easter':['easter','egg hunt'],
    "st. patrick's day":['st patrick','st. patrick','shamrock'],
    'fourth of july':['fourth of july','4th of july','independence day','fireworks'],
    "mother's day":['mother’s day',"mother's day",'mothers day'],
    "father's day":['father’s day',"father's day",'fathers day']
  };
  Object.entries(holidayKeywords).forEach(([holiday,words])=>{
    if(rvBingoThemeHasText(text,words)) holidays.add(holiday);
  });

  const seasonKeywords={
    'winter':['winter','snow','snowman','snowball','ice skating','skating rink','ski lodge','skiing','sleigh','hot cocoa','frozen pond'],
    'spring':['spring','garden party','spring festival','flower festival','blossom','easter'],
    'summer':['summer','beach','boardwalk','lake house','lakehouse','summer camp','county fair','fourth of july','4th of july','barbecue','bbq'],
    'fall':['fall','autumn','pumpkin','apple orchard','harvest','hayride','corn maze','halloween','thanksgiving']
  };
  Object.entries(seasonKeywords).forEach(([season,words])=>{
    if(rvBingoThemeHasText(text,words)) seasons.add(season);
  });

  // Holiday-to-season defaults keep filtering useful even when only holiday metadata exists.
  if(holidays.has('christmas')||holidays.has("new year's")||holidays.has("valentine's day")) seasons.add('winter');
  if(holidays.has('easter')||holidays.has("mother's day")) seasons.add('spring');
  if(holidays.has('fourth of july')||holidays.has("father's day")) seasons.add('summer');
  if(holidays.has('halloween')||holidays.has('thanksgiving')) seasons.add('fall');

  return {holidays:[...holidays],seasons:[...seasons],universal:holidays.size===0&&seasons.size===0};
}

function rvBingoTraitMatchesTheme(trait){
  const f=rvBingoThemeFilter;
  if(!f||f.mode==='all') return true;
  const meta=rvBingoTraitThemeMeta(trait);
  const season=rvBingoThemeNorm(f.season);
  const holiday=rvBingoThemeNorm(f.holiday);

  if(f.mode==='holiday'){
    // Universal tropes stay available; specific tropes must match the selected holiday.
    return meta.universal || meta.holidays.includes(holiday);
  }
  if(f.mode==='season'){
    // Seasonal mode allows holiday tropes that belong to that season.
    return meta.universal || meta.seasons.includes(season);
  }
  if(f.mode==='nonholiday'){
    // Same seasonal pool, but strip every holiday-specific trope.
    return meta.holidays.length===0 && (meta.universal || meta.seasons.includes(season));
  }
  return true;
}

const rvBingoThemeOriginalEligibleTraits=rvBingoEligibleTraits;
rvBingoEligibleTraits=function(draft=rvBingoDraft){
  return rvBingoThemeOriginalEligibleTraits(draft).filter(rvBingoTraitMatchesTheme);
};

function rvBingoThemeCount(){
  if(!rvBingoDraft) return 0;
  return rvBingoEligibleTraits(rvBingoDraft).length;
}

function rvBingoThemeFilterHtml(){
  const f=rvBingoThemeFilter;
  const seasonNeeded=f.mode==='season'||f.mode==='nonholiday';
  const holidayNeeded=f.mode==='holiday';
  return `<div class="card card-pad" style="margin-top:12px">
    <div class="kicker">Card theme</div>
    <div class="subtle" style="margin:4px 0 10px">Choose which Romantiverse pool the generator can pull from. Universal tropes remain available so the board can still reach 24 unique squares.</div>
    <div class="trait-chip-grid" style="margin-bottom:10px">
      <button class="trait-chip ${f.mode==='all'?'selected':''}" onclick="rvBingoSetThemeMode('all')">All Movies</button>
      <button class="trait-chip ${f.mode==='season'?'selected':''}" onclick="rvBingoSetThemeMode('season')">Season</button>
      <button class="trait-chip ${f.mode==='holiday'?'selected':''}" onclick="rvBingoSetThemeMode('holiday')">Holiday</button>
      <button class="trait-chip ${f.mode==='nonholiday'?'selected':''}" onclick="rvBingoSetThemeMode('nonholiday')">Non-Holiday Season</button>
    </div>
    ${seasonNeeded?`<label class="subtle"><strong>Season</strong><select class="search" style="width:100%;margin-top:5px" onchange="rvBingoSetThemeSeason(this.value)">${RV_BINGO_THEME_SEASONS.map(v=>`<option value="${v}" ${v===f.season?'selected':''}>${v}</option>`).join('')}</select></label>`:''}
    ${holidayNeeded?`<label class="subtle"><strong>Holiday / Special</strong><select class="search" style="width:100%;margin-top:5px" onchange="rvBingoSetThemeHoliday(this.value)">${RV_BINGO_THEME_HOLIDAYS.map(v=>`<option value="${esc(v)}" ${v===f.holiday?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`:''}
    <div class="pills" style="margin-top:10px"><span class="pill">${rvBingoThemeCount()} eligible traits</span>${f.mode==='nonholiday'?'<span class="pill">Holiday tropes excluded</span>':''}</div>
  </div>`;
}

const rvBingoThemeOriginalEditorControls=rvBingoEditorControls;
rvBingoEditorControls=function(){
  const html=rvBingoThemeOriginalEditorControls();
  if(!html) return html;
  return html.replace('<div class="rv-bingo-action-grid">',`${rvBingoThemeFilterHtml()}<div class="rv-bingo-action-grid">`);
};

const rvBingoThemeOriginalCardHtml=rvBingoCardHtml;
rvBingoCardHtml=function(){
  let html=rvBingoThemeOriginalCardHtml();
  if(!html||rvBingoThemeFilter.mode==='all') return html;
  const label=rvBingoThemeFilter.mode==='holiday'
    ? rvBingoThemeFilter.holiday
    : `${rvBingoThemeFilter.season}${rvBingoThemeFilter.mode==='nonholiday'?' · Non-Holiday':''}`;
  return html.replace('<div class="rv-bingo-card-meta">',`<div class="rv-bingo-card-meta"><span class="pill" style="margin-right:6px">${esc(label)}</span></div><div class="rv-bingo-card-meta">`);
};

const rvBingoThemeOriginalClearFilters=rvBingoClearGenerationFilters;
rvBingoClearGenerationFilters=function(){
  rvBingoThemeFilter={mode:'all',holiday:'Christmas',season:'Winter'};
  return rvBingoThemeOriginalClearFilters();
};

function rvBingoSetThemeMode(mode){
  rvBingoThemeFilter.mode=['all','season','holiday','nonholiday'].includes(mode)?mode:'all';
  render();
}
function rvBingoSetThemeSeason(season){
  if(RV_BINGO_THEME_SEASONS.includes(season)) rvBingoThemeFilter.season=season;
  render();
}
function rvBingoSetThemeHoliday(holiday){
  if(RV_BINGO_THEME_HOLIDAYS.includes(holiday)) rvBingoThemeFilter.holiday=holiday;
  render();
}

window.rvBingoSetThemeMode=rvBingoSetThemeMode;
window.rvBingoSetThemeSeason=rvBingoSetThemeSeason;
window.rvBingoSetThemeHoliday=rvBingoSetThemeHoliday;
window.rvBingoClearGenerationFilters=rvBingoClearGenerationFilters;
