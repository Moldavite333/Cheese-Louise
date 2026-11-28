// One content rule used by the browser, search service and recommendation engine.
(() => {
  function metadata(movie){let meta=movie?.source_metadata||{};if(typeof meta==='string'){try{meta=JSON.parse(meta)||{}}catch{meta={}}}return meta;}
  function entries(movie){const meta=metadata(movie);return [movie?.genres,movie?.genre_ids,meta.genres,meta.genre_ids].flatMap(value=>Array.isArray(value)?value:[]);}
  globalThis.clMovieHasGenres=movie=>entries(movie).length>0;
  globalThis.clMovieIsHorror=movie=>{
    if(entries(movie).some(value=>Number(typeof value==='object'?value?.id:value)===27||/\bhorror\b/i.test(String(typeof value==='object'?value?.name:value))))return true;
    const meta=metadata(movie),raw=movie?.keywords?.keywords||movie?.keywords||meta.keywords||[];
    const keywords=(Array.isArray(raw)?raw:[]).map(value=>typeof value==='string'?value:value?.name).filter(Boolean);
    if(keywords.some(value=>/\bhorror\b|\bslasher\b|\bsplatter\b|\bgore\b|\bdemonic possession\b|\bserial killer\b/i.test(value)))return true;
    return /\b(krampus|slasher|serial killer|masked killer|demonic possession|sadistic killer|bloodthirsty|gory|horror film|horror movie)\b/i.test([movie?.title,movie?.overview,movie?.summary,movie?.tagline].filter(Boolean).join(' '));
  };
  globalThis.clRomantiverseEligibility=movie=>{
    const meta=metadata(movie), evidence=meta.romantiverse||movie.romantiverse||{};
    if(globalThis.clMovieIsHorror(movie))return {status:'excluded',reason:'Horror content'};
    if(evidence.status==='excluded')return evidence;
    if(evidence.status==='eligible'&&evidence.reason&&/^https:\/\//i.test(evidence.source))return evidence;
    if(entries(movie).some(genre=>/^romantic comedy$/i.test(typeof genre==='object'?genre?.name:genre))){
      return {status:'excluded',reason:'Romantic comedies are outside the podcast’s recommendation policy',source:movie.source_url||null};
    }
    return {status:'review_required',reason:'Verify TV romance format and an episode hook',source:movie.source_url||null};
  };
  globalThis.clRomantiverseFeedAllows=(movie,saved)=>{
    const verdict=metadata(saved).romantiverse;
    const votes=Object.values(saved?.votes||{});
    return verdict?.status!=='excluded'&&(!saved||!globalThis.clMovieIsHorror(saved))&&
      votes.filter(vote=>vote==='no').length<2&&globalThis.clRomantiverseEligibility(movie).status==='eligible';
  };
})();
