// Optional guide. Progress is local; the existing tools own all production data.
(() => {
 const steps=['Find a movie','Watch Along','Make the cocktail','Set up the episode','Draft social posts'];
 const key=()=>session&&workspace?'cheeseLouise:episodeWizard:'+workspace.id+':'+me():null;
 const memory=new Map();
 let selecting=false,creating=false;
 function read(){
  const scope=key();
  if(!scope)return null;
  if(memory.has(scope))return memory.get(scope);
  try{return JSON.parse(localStorage.getItem(scope))||null;}catch{return null;}
 }
 function write(value){
  const scope=key();
  if(!scope)return;
  memory.set(scope,value);
  try{localStorage.setItem(scope,JSON.stringify(value));}catch{}
 }
 const movieFor=id=>(state.movies||[]).find(movie=>movie.id===id);
 const episodesFor=id=>(state.episodes||[]).filter(episode=>episode.movie_id===id);
 function episodeFor(progress){
  const episodes=episodesFor(progress.movieId);
  return episodes.find(episode=>episode.id===progress.episodeId)||(episodes.length===1?episodes[0]:null);
 }
 function start(){
  if(read()){show();return;}
  write({step:0});
  hqWorkspace.search();
 }
 function useMovie(id){
  if(!movieFor(id))return;
  const existing=read();
  if(existing?.movieId&&existing.movieId!==id&&!confirm('Change the movie in this setup? Your saved work stays with the original movie.'))return;
  if(!hqWorkspace.open('watchalong'))return;
  write(existing?.movieId===id?{...existing,step:1}:{step:1,movieId:id});
  window.watchAlongChangeMovie(id);
 }
 async function useCandidate(id,fromSearch=false){
  if(selecting)return;
  const candidate=fromSearch?romantiverseSearchCandidate(id):(state.discoveryResults||[]).find(movie=>Number(movie.tmdb_id)===Number(id));
  if(!candidate||(!fromSearch&&!clRomantiverseFeedAllows(candidate)))return;
  const scope=key();
  selecting=true;
  try{
   const linked=romantiverseSearchLinkedMovie(candidate);
   const movieId=linked?.id||await persistDiscoveredMovie(candidate.tmdb_id,false,candidate);
   if(movieId&&scope===key()){
    if(fromSearch&&typeof clSearchMovieDetail!=='undefined'&&clSearchMovieDetail)clCloseDiscoveryMovieDetails();
    useMovie(movieId);
   }
  }catch(error){alert(error.message||String(error));}
  finally{selecting=false;}
 }
 function show(){
  const progress=read();
  if(!progress)return;
  if(progress.step===0||!movieFor(progress.movieId)){hqWorkspace.search();return;}
  if(progress.step===1){if(hqWorkspace.open('watchalong'))window.watchAlongChangeMovie(progress.movieId);return;}
  if(progress.step===2){window.clMixology.openForMovie(progress.movieId);return;}
  const episode=episodeFor(progress);
  if(progress.step===3){if(episode)hqWorkspace.resumeEpisode(episode.id);else hqWorkspace.open('episodes');return;}
  if(episode&&hqWorkspace.open('marketing'))window.clMarketing.select(episode.id);
 }
 function move(delta){
  const progress=read();
  if(!progress)return;
  const step=Math.max(0,Math.min(steps.length-1,progress.step+delta));
  if(step>0&&!movieFor(progress.movieId))return;
  if(step===4&&!episodeFor(progress))return;
  if(step===1&&!hqWorkspace.open('watchalong'))return;
  if(step===4&&!hqWorkspace.open('marketing'))return;
  write({...progress,step});
  if(step===0)hqWorkspace.search();
  else if(step===1)window.watchAlongChangeMovie(progress.movieId);
  else if(step===4)window.clMarketing.select(episodeFor(progress).id);
  else render();
 }
 function chooseEpisode(id){
  const progress=read();
  if(!progress||!episodesFor(progress.movieId).some(episode=>episode.id===id))return;
  write({...progress,episodeId:id});
  render();
 }
 async function createEpisode(){
  const progress=read(),scope=key();
  if(creating||!progress||!movieFor(progress.movieId)||episodesFor(progress.movieId).length)return;
  creating=true;
  try{
   const episodeId=await addEpisode({movieId:progress.movieId});
   if(episodeId&&scope===key()&&read()?.movieId===progress.movieId)chooseEpisode(episodeId);
  }catch(error){alert(error.message||String(error));}
  finally{creating=false;}
 }
 function panel(){
  const progress=read();
  if(!progress)return '';
  const movie=movieFor(progress.movieId),step=movie?progress.step:0;
  const episode=episodeFor(progress),episodes=movie?episodesFor(movie.id):[];
  const action=['Find a movie','Open Watch Along','Develop cocktail','Open episode','Open social drafts'][step];
  const needsLink=step===3&&!episode;
  const chooser=needsLink&&episodes.length
   ?'<label>Choose an episode <select onchange="clEpisodeWizard.chooseEpisode(this.value)"><option value="">Select…</option>'+
     episodes.map(item=>'<option value="'+esc(item.id)+'">'+esc(item.title)+'</option>').join('')+'</select></label>':'';
  return '<section class="hq-episode-wizard card" aria-label="Episode setup"><div><strong>Episode setup</strong><span>Step '+(step+1)+' of '+steps.length+' · '+steps[step]+'</span>'+
   (movie?'<p>'+esc(movie.title)+(episode?' · '+esc(episode.title):'')+'</p>':'<p>Search Movie Radar, then choose Start Episode Setup on a movie.</p>')+'</div>'+
   '<div class="hq-wizard-actions">'+chooser+
    (needsLink&&!episodes.length?'<button class="primary" type="button" onclick="clEpisodeWizard.createEpisode()">Create linked episode</button>':'')+
    (!needsLink?'<button class="primary" type="button" onclick="clEpisodeWizard.show()">'+action+'</button>':'')+
    (step>0?'<button class="secondary" type="button" onclick="clEpisodeWizard.move(-1)">Back</button>':'')+
    (step>0&&step<steps.length-1&&!(step===3&&!episode)?'<button class="secondary" type="button" onclick="clEpisodeWizard.move(1)">Next step</button>':'')+
    '<button class="secondary" type="button" onclick="clEpisodeWizard.end()">'+(step===4?'Finish setup':'Exit setup')+'</button>'+
   '</div></section>';
 }
 function end(){
  write(null);
  document.querySelector('.hq-episode-wizard')?.remove();
 }
 window.clEpisodeWizard={start,useMovie,useCandidate,show,move,chooseEpisode,createEpisode,panel,end};
})();
