// Shared shortlist: interest from either person qualifies; Radar filters do not apply.
let clOurMoviesView='all',clOurMoviesQuery='';
function clOurMovieInterest(movie){
  const votes=Object.values(movie.votes||{});
  return {yes:votes.includes('yes'),maybe:votes.includes('maybe'),saved:Object.values(movie.bookmarks||{}).some(value=>value===true)};
}
function clOurMoviesRows(){
  const query=clOurMoviesQuery.trim().toLowerCase();
  return (state.movies||[]).filter(movie=>{
    if(clMovieIsHorror(movie))return false;
    const interest=clOurMovieInterest(movie);
    if(!interest.yes&&!interest.maybe&&!interest.saved)return false;
    if(clOurMoviesView!=='all'&&!interest[clOurMoviesView])return false;
    return !query||[movie.title,movie.summary,movie.network,movie.season,movie.holiday].filter(Boolean).join(' ').toLowerCase().includes(query);
  }).slice().sort((a,b)=>String(a.title||'').localeCompare(String(b.title||'')));
}
function clOurMovieChoices(movie){
  const people=[...new Set([...(members||[]).map(member=>member.user_id),...Object.keys(movie.votes||{}),...Object.keys(movie.bookmarks||{})])];
  return '<div class="our-movie-choices" aria-label="Shared movie choices">'+people.map(id=>{
    const vote=movie.votes?.[id],saved=movie.bookmarks?.[id]===true;
    const label=[vote==='yes'?'Yes':vote==='maybe'?'Maybe':vote==='no'?'No':'Not voted',saved?'Saved':''].filter(Boolean).join(' · ');
    return '<span class="our-movie-choice our-choice-'+(vote||'pending')+'"><strong>'+esc(memberName(id))+'</strong><span>'+esc(label)+'</span></span>';
  }).join('')+'</div>';
}
function clOurMovieCard(movie){
  return movieCard(movie).replace('<div class="vote-row">',clOurMovieChoices(movie)+'<div class="vote-row">');
}
function clOurMoviesResults(){
  const rows=clOurMoviesRows();
  return {line:'<strong>'+rows.length+'</strong> movie'+(rows.length===1?'':'s')+' in this view',grid:rows.map(clOurMovieCard).join('')||'<div class="empty">'+(clOurMoviesQuery.trim()?'No movies in this collection match your search.':'Movies appear here when either of you votes Yes or Maybe, or saves one in Movie Radar.')+'</div>'};
}
function clOurMoviesPage(){
  const results=clOurMoviesResults();
  return '<section class="section"><div class="our-movies-heading"><div><div class="kicker">YOUR SHARED COLLECTION</div><h1 class="page-title">Our Movies</h1><p class="subtle">Every movie either of you marked Yes, Maybe, or Saved. A No from the other person does not hide it.</p></div><button class="secondary" onclick="hqWorkspace.open(\'movies\')">Find more movies</button></div>'+
    '<div class="our-movies-tools"><label for="ourMoviesSearch">Search our movies<input id="ourMoviesSearch" class="search" type="search" value="'+esc(clOurMoviesQuery)+'" oninput="clOurMovies.setQuery(this.value)" placeholder="Title, season, or story…"></label>'+
    '<div class="toolbar" aria-label="Our Movies views">'+[['all','All ours'],['yes','Yes'],['maybe','Maybe'],['saved','Saved']].map(([value,label])=>'<button class="filter '+(clOurMoviesView===value?'active-filter':'')+'" data-our-view="'+value+'" aria-pressed="'+(clOurMoviesView===value)+'" onclick="clOurMovies.setView(\''+value+'\')">'+label+'</button>').join('')+'</div></div>'+
    '<div id="ourMoviesCount" class="results-line" aria-live="polite">'+results.line+'</div><div id="ourMoviesGrid" class="movie-grid">'+results.grid+'</div></section>';
}
function clOurMoviesRefresh(){
  const results=clOurMoviesResults(),line=document.getElementById('ourMoviesCount'),grid=document.getElementById('ourMoviesGrid');
  if(line)line.innerHTML=results.line;if(grid)grid.innerHTML=results.grid;
  for(const button of document.querySelectorAll('[data-our-view]')){const selected=button.getAttribute('data-our-view')===clOurMoviesView;button.classList.toggle('active-filter',selected);button.setAttribute('aria-pressed',String(selected));}
}
window.clOurMovies={interest:clOurMovieInterest,rows:clOurMoviesRows,setQuery(value){clOurMoviesQuery=String(value||'');clOurMoviesRefresh();},setView(value){clOurMoviesView=['all','yes','maybe','saved'].includes(value)?value:'all';clOurMoviesRefresh();}};
const clOurMoviesOriginalRender=render;
render=function(...args){
  if(currentTab!=='ourmovies')return clOurMoviesOriginalRender.apply(this,args);
  if(!session)return authScreen();if(!workspace)return onboardingScreen();
  shell('<div class="app-shell">'+topbar()+clOurMoviesPage()+'</div>'+tabs()+modal());
};
window.render=render;
