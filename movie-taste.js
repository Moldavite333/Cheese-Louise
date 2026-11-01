// Shared taste is derived from shared Radar votes, never from Cheese scores.
const clTasteFavorites = ['Coupled Up for Christmas','A Christmas Movie Christmas','Everything Christmas','A Biltmore Christmas','A Very Nutty Christmas','Pumpkin Regatta Romance','The Spirit of Christmas',"Something’s Brewing"];
const clTasteThemes = [
  {name:'Christmas romance',query:'christmas',pattern:/\b(christmas|mistletoe|yuletide|santa)\b/i,weight:3},
  {name:'A little magic',query:'magical romance',pattern:/\b(magic|magical|ghost|spirit|enchanted|time travel|time loop|nutcracker|wish)\b/i,weight:3},
  {name:'Playful romance',query:'fake dating',pattern:/\b(pretend|fake dating|fake relationship|matchmaker|romantic comedy)\b/i,weight:2},
  {name:'Autumn and town events',query:'autumn',pattern:/\b(autumn|pumpkin|harvest|festival|regatta|small town|hometown)\b/i,weight:2},
  {name:'Cozy cafés',query:'coffee',pattern:/\b(coffee|cafe|café|barista|bakery|brewing)\b/i,weight:2}
];
function clTasteText(movie){
  return [movie.title,movie.summary,movie.tagline,...(Array.isArray(movie.keywords)?movie.keywords:[])].filter(Boolean).join(' ');
}
function clTasteWeights(){
  return clTasteThemes.map(theme=>{
    let weight=theme.weight;
    for(const movie of state.movies||[]){
      if(!theme.pattern.test(clTasteText(movie)))continue;
      for(const vote of Object.values(movie.votes||{})) weight+=vote==='yes'?1:vote==='no'?-1:0;
    }
    return {...theme,weight:Math.max(-4,Math.min(8,weight))};
  });
}
function clTasteMatch(movie,weights=clTasteWeights()){
  const matched=weights.filter(theme=>theme.pattern.test(clTasteText(movie)));
  const yes=Object.values(movie.votes||{}).filter(v=>v==='yes').length;
  const no=Object.values(movie.votes||{}).filter(v=>v==='no').length;
  return {score:matched.reduce((sum,t)=>sum+t.weight,0)+yes*3-no*3,
    reasons:matched.filter(t=>t.weight>0).map(t=>t.name)};
}
let clTasteSort='taste';
function clTasteRank(results){
  const weights=clTasteWeights();
  const scores=new Map(results.map(movie=>[movie,clTasteMatch(movie,weights).score]));
  return results.slice().sort((a,b)=>{
    const q=String(searchText||'').trim().toLowerCase();
    if(q){const exact=Number(String(b.title).toLowerCase()===q)-Number(String(a.title).toLowerCase()===q);if(exact)return exact;}
    if(clTasteSort==='newest')return String(b.premiere_date||'').localeCompare(String(a.premiere_date||''));
    if(clTasteSort==='relevance')return Number(b.search_score||0)-Number(a.search_score||0);
    return scores.get(b)-scores.get(a)||Number(b.search_score||0)-Number(a.search_score||0);
  });
}
window.clSetTasteSort=value=>{clTasteSort=['taste','newest','relevance'].includes(value)?value:'taste';refreshRomantiverseSearchPanel();};
window.clFindForUs=()=>{
  searchText='';
  const input=document.getElementById('globalSearch');if(input)input.value='';
  clearTimeout(romantiverseSearchTimer);
  runRomantiverseSearch('',true,true);
};
window.clBroadenFinder=()=>{
  window.clearMovieFilters();
  clearTimeout(romantiverseSearchTimer);
  runRomantiverseSearch(searchText,true,romantiverseSearchForUs);
};
const clFinderFilterLabels={mode:'View',holiday:'Holiday',season:'Season',network:'Network',studio:'Studio',yearMin:'From year',yearMax:'To year',releaseWindow:'Release',status:'Status',minScore:'Minimum cheese',traitIds:'Required traits',traitCategories:'Trait categories'};
window.clRemoveFinderFilter=key=>{
  if(!Object.hasOwn(clFinderFilterLabels,key))return;
  movieFilters[key]=key==='mode'||key==='releaseWindow'?'all':key==='minScore'?0:key==='traitIds'||key==='traitCategories'?[]:null;
  render();
  runRomantiverseSearch(searchText,false,romantiverseSearchForUs);
};
function clTastePanel(){
  const votes=(state.movies||[]).reduce((n,m)=>n+Object.values(m.votes||{}).filter(v=>v==='yes'||v==='no').length,0);
  const filters=Object.entries(clFinderFilterLabels).filter(([key])=>{
    const v=movieFilters[key];return Array.isArray(v)?v.length:v&&v!=='all';
  }).map(([key,label])=>'<button class="filter" onclick="clRemoveFinderFilter(\''+key+'\')">'+esc(label)+': '+esc(Array.isArray(movieFilters[key])?movieFilters[key].length:movieFilters[key])+' ×</button>').join('');
  return '<div class="card card-pad cl-taste-profile"><div class="kicker">Your shared taste</div>'+
    '<div class="pills">'+clTasteWeights().filter(t=>t.weight>0).map(t=>'<span class="pill">'+esc(t.name)+'</span>').join('')+'</div>'+
    '<details><summary>Your favorites & how matching works · '+votes+' shared votes</summary><p>Starting favorites: '+clTasteFavorites.map(esc).join(' · ')+'.</p><p>A starting profile inferred from your favorites. Learns from both people’s shared Yes and No votes. Match reasons come from movie metadata, not verified scenes. Cheese Rating stays separate.</p></details>'+
    '<div class="cl-taste-actions"><button class="primary" onclick="clFindForUs()">Find movies for us</button><button class="secondary" onclick="clBroadenFinder()">Clear filters & search wider</button>'+
    '<label>Sort finds <select onchange="clSetTasteSort(this.value)"><option value="taste" '+(clTasteSort==='taste'?'selected':'')+'>Our taste</option><option value="relevance" '+(clTasteSort==='relevance'?'selected':'')+'>Search relevance</option><option value="newest" '+(clTasteSort==='newest'?'selected':'')+'>Newest</option></select></label></div>'+
    (filters?'<div class="subtle" style="margin-top:12px">Active filters — tap one to remove it:</div><div class="cl-taste-actions">'+filters+'</div>':'')+'</div>';
}

