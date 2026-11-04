// Our Movies is the preference source; Cheese Grating is never a taste signal.
const clTasteFavorites=[];
function clTasteProfile(){return clOurMovieTasteEngine.profile(clOurMovieTasteEngine.preferences(state.movies||[]));}
function clTasteWeights(){return clTasteProfile().learned.map(feature=>({...feature,query:feature.name}));}
function clTasteText(movie){return [movie.title,movie.summary,movie.synopsis,movie.tagline].filter(Boolean).join(' ');}
function clTasteMatch(movie,profile=clTasteProfile()){const fit=clOurMovieTasteEngine.match(movie,profile);return {score:fit.score,reasons:fit.features,tier:fit.tier,anchor:fit.anchor};}
let clTasteSort='taste';
function clTasteRank(results){
  const weights=clTasteProfile();
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
 const profile=clTasteProfile();
 const filters=Object.entries(clFinderFilterLabels).filter(([key])=>{const v=movieFilters[key];return Array.isArray(v)?v.length:v&&v!=='all';}).map(([key,label])=>'<button class="filter" onclick="clRemoveFinderFilter(\''+key+'\')">'+esc(label)+': '+esc(Array.isArray(movieFilters[key])?movieFilters[key].length:movieFilters[key])+' ×</button>').join('');
 const themes=profile.learned.filter(f=>f.weight>0).sort((a,b)=>b.weight-a.weight).slice(0,6);
 const examples=profile.likes.slice().sort((a,b)=>b.weight-a.weight||a.title.localeCompare(b.title)).slice(0,6);
 return '<div class="card card-pad cl-taste-profile"><div class="kicker">Your shared taste</div><p class="subtle">Our Movies: '+profile.count+' choices guide the feed · '+profile.both+' both-Yes picks</p><div class="pills">'+themes.map(t=>'<span class="pill">'+esc(t.name)+'</span>').join('')+'</div>'+
 '<details><summary>How Our Movies shapes your feed</summary><p>Both Yes votes carry the most weight, followed by one Yes, Saved, and tentative Maybe choices. No votes reduce similar story matches. Cheese Grating does not influence preference.</p><p>'+examples.map(m=>esc(m.title)+' ('+esc(m.signal==='both_yes'?'both Yes':m.signal)+')').join(' · ')+'</p><p>Close story matches appear first. A shared holiday or network alone does not qualify a movie as a close match. Results stay inside the Bingo movie catalog.</p></details>'+
 '<div class="cl-taste-actions"><button class="primary" onclick="clFindForUs()">Find movies for us</button><button class="secondary" onclick="clBroadenFinder()">Clear filters & search wider</button><label>Sort finds <select onchange="clSetTasteSort(this.value)"><option value="taste" '+(clTasteSort==='taste'?'selected':'')+'>Our taste</option><option value="relevance" '+(clTasteSort==='relevance'?'selected':'')+'>Search relevance</option><option value="newest" '+(clTasteSort==='newest'?'selected':'')+'>Newest</option></select></label></div>'+
 (filters?'<div class="subtle" style="margin-top:12px">Active filters — tap one to remove it:</div><div class="cl-taste-actions">'+filters+'</div>':'')+'</div>';
}
