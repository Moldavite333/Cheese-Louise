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
  while(picks.length<count){
    const choices=[...groups.entries()].filter(([,list])=>list.some(t=>!used.has(String(t.id))));
    if(!choices.length) break;
    const min=Math.min(...choices.map(([cat])=>catCounts.get(cat)||0));
    const cats=choices.filter(([cat])=>(catCounts.get(cat)||0)===min);
    const [cat,list]=cats[Math.floor(rng()*cats.length)];
    const candidate=list.find(t=>!used.has(String(t.id)));
    if(!candidate) break;
    picks.push(candidate);
    used.add(String(candidate.id));
    catCounts.set(cat,(catCounts.get(cat)||0)+1);
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
  const movieTraits=rvBingoShuffle(rvBingoMovieSeasonTraits(movie),rng);
  const movieTarget=Math.min(12,movieTraits.length);
  const pickedMovie=rvBingoMovieSeasonPick(movieTraits,movieTarget,rng,used,usage);

  // Fill from the selected season. Prefer explicitly seasonal traits before universal traits.
  const seasonalPool=rvBingoThemeOriginalEligibleTraits(draft).filter(t=>rvBingoTraitMatchesTheme(t));
  const seasonKey=rvBingoThemeNorm(season);
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
    ...seasonalSpecific.filter(t=>!used.has(String(t.id))),
    ...rvBingoThemeOriginalEligibleTraits(draft).filter(t=>!used.has(String(t.id)))
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
