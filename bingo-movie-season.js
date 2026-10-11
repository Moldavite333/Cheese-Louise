// Cheese Louise — Movie + Season Romantiverse Bingo
// Builds a card from the selected movie's actual Cheese Traits plus season-appropriate Romantiverse traits.

let rvBingoMovieSeason = { movieId:'', season:'' };

function rvBingoMovieSeasonMovie(){
  return (state.movies||[]).find(m=>String(m.id)===String(rvBingoMovieSeason.movieId)) || null;
}

function rvBingoInferMovieSeason(movie){
  const explicit=String(movie?.season||'').trim();
  if(RV_BINGO_THEME_SEASONS.includes(explicit)) return explicit;

  const holiday=String(movie?.holiday||'').toLowerCase();
  if(/christmas|new year|valentine/.test(holiday)) return 'Winter';
  if(/easter|mother/.test(holiday)) return 'Spring';
  if(/fourth|4th|father/.test(holiday)) return 'Summer';
  if(/halloween|thanksgiving/.test(holiday)) return 'Fall';

  const raw=movie?.premiere_date||movie?.release_date||null;
  if(raw){
    const d=new Date(raw+'T12:00:00');
    const month=d.getMonth()+1;
    if(month===12||month<=2) return 'Winter';
    if(month<=5) return 'Spring';
    if(month<=8) return 'Summer';
    return 'Fall';
  }
  return 'Fall';
}

function rvBingoMovieSeasonTraits(movie){
  const ids=new Set((movie?.selectedTraitIds||[]).map(String));
  return (state.traits||[]).filter(t=>t.is_active!==false && ids.has(String(t.id)));
}

function rvBingoMovieSeasonPick(pool,count,rng,used,usage){
  const available=pool.filter(t=>!used.has(String(t.id)));
  if(!available.length||count<=0) return [];

  const nicheCategoryCap=2;
  const nichePatterns=[
    /royal|prince|princess|castle|commoner/i,
    /amnesia/i,
    /magic|supernatural|fantasy/i
  ];

  const groups=new Map();
  available.forEach(t=>{
    const cat=t.category||'Wildcard';
    if(!groups.has(cat)) groups.set(cat,[]);
    groups.get(cat).push(t);
  });
  for(const [cat,list] of groups){
    groups.set(cat,rvBingoShuffle(list,rng).sort((a,b)=>(usage.get(String(a.id))||0)-(usage.get(String(b.id))||0)));
  }

  const picks=[];
  const catCounts=new Map();
  const nicheCounts=new Map();

  function nicheKey(trait){
    const text=`${trait?.name||''} ${trait?.category||''}`;
    const idx=nichePatterns.findIndex(re=>re.test(text));
    return idx>=0 ? idx : null;
  }

  while(picks.length<count){
    const choices=[...groups.entries()].map(([cat,list])=>[
      cat,
      list.filter(t=>{
        if(used.has(String(t.id))) return false;
        const nk=nicheKey(t);
        return nk===null || (nicheCounts.get(nk)||0)<nicheCategoryCap;
      })
    ]).filter(([,list])=>list.length);

    if(!choices.length) break;

    const min=Math.min(...choices.map(([cat])=>catCounts.get(cat)||0));
    const cats=choices.filter(([cat])=>(catCounts.get(cat)||0)===min);
    const [cat,list]=cats[Math.floor(rng()*cats.length)];

    const minUsage=Math.min(...list.map(t=>usage.get(String(t.id))||0));
    const underused=list.filter(t=>(usage.get(String(t.id))||0)===minUsage);
    const candidate=underused[Math.floor(rng()*underused.length)];
    if(!candidate) break;

    picks.push(candidate);
    used.add(String(candidate.id));
    catCounts.set(cat,(catCounts.get(cat)||0)+1);

    const nk=nicheKey(candidate);
    if(nk!==null) nicheCounts.set(nk,(nicheCounts.get(nk)||0)+1);
  }

  return picks;
}

function rvBingoMovieSeasonGenerate(){
  const movie=rvBingoMovieSeasonMovie();
  if(!movie) return alert('Choose a movie first.');
  const season=rvBingoMovieSeason.season||rvBingoInferMovieSeason(movie);
  if(!RV_BINGO_THEME_SEASONS.includes(season)) return alert('Choose a season first.');

  rvBingoThemeFilter.mode='season';
  rvBingoThemeFilter.season=season;

  const seed=rvBingoRandomSeed();
  const rng=rvBingoPrng(seed);
  const draft=rvBingoBlankDraft();
  draft.seed_code=seed;
  draft.name=`${movie.title} — ${season} Bingo`;

  const usage=rvBingoUsageMap();
  const used=new Set();

  // Half the card can come directly from Cheese Traits already attached to the movie.
  const seasonKey=rvBingoThemeNorm(season);
  const movieTraits=rvBingoShuffle(
    rvBingoMovieSeasonTraits(movie).filter(t=>{
      const meta=rvBingoTraitThemeMeta(t);
      return meta.universal || meta.seasons.includes(seasonKey);
    }),
    rng
  );
  const movieTarget=Math.min(12,movieTraits.length);
  const pickedMovie=rvBingoMovieSeasonPick(movieTraits,movieTarget,rng,used,usage);

  // Fill from the selected season. Prefer explicitly seasonal traits before universal traits.
  const seasonalPool=rvBingoThemeOriginalEligibleTraits(draft).filter(t=>rvBingoTraitMatchesTheme(t));
  const seasonalSpecific=seasonalPool.filter(t=>{
    const meta=rvBingoTraitThemeMeta(t);
    return !used.has(String(t.id)) && meta.seasons.includes(seasonKey);
  });
  const universal=seasonalPool.filter(t=>{
    const meta=rvBingoTraitThemeMeta(t);
    return !used.has(String(t.id)) && meta.universal;
  });

  const remaining=24-pickedMovie.length;
  const seasonalTarget=Math.min(Math.ceil(remaining/2),seasonalSpecific.length);
  const pickedSeason=rvBingoMovieSeasonPick(seasonalSpecific,seasonalTarget,rng,used,usage);
  const stillNeeded=remaining-pickedSeason.length;

  const fallbackPool=[
    ...universal,
    ...seasonalSpecific.filter(t=>!used.has(String(t.id)))
  ];
  const pickedFallback=rvBingoMovieSeasonPick(fallbackPool,stillNeeded,rng,used,usage);

  const picks=[...pickedMovie,...pickedSeason,...pickedFallback];
  if(picks.length<24){
    return alert(`This movie/season combination only produced ${picks.length} unique eligible traits. Add more Cheese Traits or loosen the filters.`);
  }

  const shuffled=rvBingoShuffle(picks.slice(0,24),rng);
  let p=0;
  for(let i=0;i<RV_BINGO_SIZE;i++){
    if(i===RV_BINGO_FREE_INDEX){ draft.squares[i]=null; continue; }
    draft.squares[i]=shuffled[p++].id;
  }
  draft.marked_indices=[RV_BINGO_FREE_INDEX];
  rvBingoDraft=draft;
  rvBingoPlayMode=false;
  rvBingoRecentTraitIds=[...rvBingoRecentTraitIds,...shuffled.map(t=>t.id)].slice(-120);
  render();
}

function rvBingoMovieSeasonSetMovie(id){
  rvBingoMovieSeason.movieId=id||'';
  const movie=rvBingoMovieSeasonMovie();
  rvBingoMovieSeason.season=movie?rvBingoInferMovieSeason(movie):'';
  render();
}

function rvBingoMovieSeasonSetSeason(season){
  if(RV_BINGO_THEME_SEASONS.includes(season)) rvBingoMovieSeason.season=season;
  render();
}

function rvBingoMovieSeasonHtml(){
  const movie=rvBingoMovieSeasonMovie();
  const season=rvBingoMovieSeason.season||(movie?rvBingoInferMovieSeason(movie):'');
  const movies=(state.movies||[]).slice().sort((a,b)=>String(a.title||'').localeCompare(String(b.title||'')));
  const count=movie?rvBingoMovieSeasonTraits(movie).length:0;
  return `<div class="card card-pad" style="margin-top:12px">
    <div class="kicker">Movie + Season Card</div>
    <div class="subtle" style="margin:4px 0 10px">Build a board from this movie's actual Cheese Traits, then fill the rest with season-specific and universal Romantiverse tropes.</div>
    <label class="subtle"><strong>Movie</strong>
      <select class="search" style="width:100%;margin-top:5px" onchange="rvBingoMovieSeasonSetMovie(this.value)">
        <option value="">Choose a movie…</option>
        ${movies.map(m=>`<option value="${esc(m.id)}" ${String(m.id)===String(rvBingoMovieSeason.movieId)?'selected':''}>${esc(m.title)}${m.holiday?` · ${esc(m.holiday)}`:''}</option>`).join('')}
      </select>
    </label>
    <label class="subtle" style="display:block;margin-top:10px"><strong>Season</strong>
      <select class="search" style="width:100%;margin-top:5px" onchange="rvBingoMovieSeasonSetSeason(this.value)">
        <option value="">Choose season…</option>
        ${RV_BINGO_THEME_SEASONS.map(s=>`<option value="${s}" ${s===season?'selected':''}>${s}</option>`).join('')}
      </select>
    </label>
    ${movie?`<div class="pills" style="margin-top:10px"><span class="pill">${count} movie-specific Cheese Traits</span><span class="pill">${esc(season||'Season not set')}</span></div>`:''}
    <button class="primary rv-bingo-big-action" style="width:100%;margin-top:12px" onclick="rvBingoMovieSeasonGenerate()" ${!movie?'disabled':''}>GENERATE FROM MOVIE + SEASON</button>
  </div>`;
}

const rvBingoMovieSeasonOriginalEditor=rvBingoEditorControls;
rvBingoEditorControls=function(){
  const html=rvBingoMovieSeasonOriginalEditor();
  if(!html) return html;
  return html.replace('<div class="rv-bingo-action-grid">',`${rvBingoMovieSeasonHtml()}<div class="rv-bingo-action-grid">`);
};

window.rvBingoMovieSeasonSetMovie=rvBingoMovieSeasonSetMovie;
window.rvBingoMovieSeasonSetSeason=rvBingoMovieSeasonSetSeason;
window.rvBingoMovieSeasonGenerate=rvBingoMovieSeasonGenerate;


// Movie detail integration: one-click Bingo creation from a saved movie.
function rvBingoCreateForMovie(movieId){
  const movie=(state.movies||[]).find(m=>String(m.id)===String(movieId));
  if(!movie) return alert('That movie is no longer available in Movie Radar.');

  rvBingoMovieSeason.movieId=movie.id;
  rvBingoMovieSeason.season=rvBingoInferMovieSeason(movie);
  selectedMovie=null;
  rvBingoPicker=null;
  rvBingoMultiOpen=false;
  romantiverseHubView='bingo';
  currentTab='ideas';
  rvBingoMovieSeasonGenerate();
  window.scrollTo(0,0);
}

if(typeof clSavedMovieDetailModal==='function'){
  const rvBingoOriginalSavedMovieDetailModal=clSavedMovieDetailModal;
  clSavedMovieDetailModal=function(){
    const movie=(state.movies||[]).find(m=>m.id===selectedMovie);
    let html=rvBingoOriginalSavedMovieDetailModal();
    if(!movie||!html) return html;

    const button=`<button class="primary" onclick="rvBingoCreateForMovie('${String(movie.id).replace(/'/g,"\\'")}')">🎯 Create Bingo Card</button>`;
    const scheduleButton=`<button class="secondary" onclick="scheduleMovie('${String(movie.id).replace(/'/g,"\\'")}')">📅 Schedule</button>`;

    if(html.includes(scheduleButton)){
      html=html.replace(scheduleButton, scheduleButton + button);
    }else{
      html=html.replace('<div class="cl-movie-detail-actions">','<div class="cl-movie-detail-actions">'+button);
    }
    return html;
  };
}

window.rvBingoCreateForMovie=rvBingoCreateForMovie;


// Publish the currently reviewed Bingo card to the public Romantiverse website.
let rvBingoPublishing=false;

async function rvBingoPublishToWebsite(){
  if(!workspace) return alert('Open the Cheese Louise workspace first.');
  if(!rvBingoDraft || !rvBingoCardIsFull()) return alert('Generate and review a full Bingo card first.');

  const movie=rvBingoMovieSeasonMovie();
  const season=rvBingoMovieSeason.season || (movie ? rvBingoInferMovieSeason(movie) : rvBingoThemeFilter?.season || '');
  const pool=(rvBingoDraft.squares||[])
    .map((id,index)=> index===RV_BINGO_FREE_INDEX || !id ? null : ({id:String(id),label:rvBingoTraitName(id)}))
    .filter(Boolean);

  if(pool.length!==24) return alert('The public card needs 24 playable squares.');

  rvBingoPublishing=true;
  render();
  try{
    const payload={
      workspace_id:workspace.id,
      movie_id:movie?.id || null,
      movie_title:movie?.title || rvBingoDraft.name || 'Romantiverse Bingo',
      season:season || null,
      holiday:movie?.holiday || null,
      description:movie?.summary || `A Cheese Louise Romantiverse Bingo card for ${movie?.title || rvBingoDraft.name || 'this week'}.`,
      pool,
      published_by:me()
    };
    const {error}=await db.from('published_bingo_cards').insert(payload);
    if(error) throw error;
    alert(`Published to the website: ${payload.movie_title}`);
  }catch(error){
    console.error('Could not publish Bingo card',error);
    alert(error?.message || 'Could not publish the Bingo card.');
  }finally{
    rvBingoPublishing=false;
    render();
  }
}

const rvBingoPublishOriginalEditor=rvBingoEditorControls;
rvBingoEditorControls=function(){
  const html=rvBingoPublishOriginalEditor();
  if(!html || !rvBingoDraft || rvBingoPlayMode) return html;
  const button=`<button class="primary" onclick="rvBingoPublishToWebsite()" ${rvBingoPublishing?'disabled':''}>🌐 ${rvBingoPublishing?'Publishing…':'Publish to Website'}</button>`;
  if(html.includes('<div class="rv-bingo-export-row">')){
    return html.replace('<div class="rv-bingo-export-row">',`<div class="rv-bingo-export-row">${button}`);
  }
  return html + button;
};

window.rvBingoPublishToWebsite=rvBingoPublishToWebsite;
