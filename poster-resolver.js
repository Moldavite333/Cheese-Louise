// Cheese Louise — isolated poster resolver client.
// Hallmark remains the discovery source. TMDB/Watchmode are used only to resolve
// a verified canonical poster after the movie identity is already known.

(() => {
  function prMeta(item){
    const raw=item?.source_metadata;
    if(!raw) return {};
    if(typeof raw==='object') return {...raw};
    if(typeof raw==='string'){ try{return JSON.parse(raw)}catch(_){return {}} }
    return {};
  }

  function prYear(item){
    const meta=prMeta(item);
    const raw=item?.premiere_date||item?.release_date||meta.year||meta.release_date||'';
    const m=String(raw).match(/\b(19|20)\d{2}\b/);
    return m?Number(m[0]):null;
  }

  function prStars(item){
    const meta=prMeta(item);
    const raw=Array.isArray(item?.stars)?item.stars:(Array.isArray(meta.stars)?meta.stars:(Array.isArray(meta.cast)?meta.cast:[]));
    return raw.map(row=>typeof row==='string'?row:row?.name).map(v=>String(v||'').trim()).filter(Boolean).slice(0,6);
  }

  function prStudios(item){
    const meta=prMeta(item);
    const values=[...(Array.isArray(item?.production_companies)?item.production_companies:[]),...(Array.isArray(meta.production_companies)?meta.production_companies:[])];
    return [...new Set(values.map(v=>String(v||'').trim()).filter(Boolean))];
  }

  function prInput(item,key){
    const meta=prMeta(item);
    return {
      key:key??item?.catalog_id??item?.id??`${prYear(item)||''}|${item?.title||''}`,
      catalog_id:item?.catalog_id||meta.catalog_id||null,
      title:item?.title||'',
      year:prYear(item),
      stars:prStars(item),
      director:item?.director||meta.director||null,
      studios:prStudios(item),
      imdb_id:meta?.external_ids?.imdb_id||meta?.poster_imdb_id||null
    };
  }

  async function prResolve(items){
    const movies=(items||[]).filter(Boolean).map((item,index)=>prInput(item,item?.catalog_id??item?.id??index));
    if(!movies.length) return [];
    const {data,error}=await db.functions.invoke('resolve-movie-poster',{body:{movies}});
    if(error) throw error;
    if(data?.error) throw new Error(data.error);
    return Array.isArray(data?.results)?data.results:[];
  }

  // Keep the existing New Finds architecture intact. We only replace the old
  // Hallmark-page artwork lookup with the isolated canonical poster resolver.
  if(typeof discoveryMapHallmark==='function'){
    discoveryMapHallmark=function(row){
      const key=String(row.catalog_id||`${row.year||''}|${row.title||''}`);
      return {
        ...row,
        tmdb_id:discoveryNumericId(key), // legacy internal card key, not a TMDB identity
        tmdb_type:'movie',               // keeps the existing DB constraint happy
        source_type:'hallmark_official',
        network:row.network||'Hallmark Channel',
        providers:row.providers||[],
        source_url:row.official_source_url||row.source_url||null,
        poster_url:null,
        match_score:100,
        why:[row.collection?`Official Hallmark: ${row.collection}`:'Official Hallmark catalog',row.holiday,row.season].filter(Boolean)
      };
    };
    window.discoveryMapHallmark=discoveryMapHallmark;
  }

  if(typeof discoveryHydratePosters==='function'){
    discoveryHydratePosters=async function(force=false){
      if(discoveryArtLoading || !(state.discoveryResults||[]).length) return;
      discoveryArtLoading=true;
      render();
      try{
        const rows=await prResolve(state.discoveryResults||[]);
        const byKey=new Map(rows.map(row=>[String(row.key),row]));
        state.discoveryResults=(state.discoveryResults||[]).map(c=>{
          const key=String(c.catalog_id||c.id||`${prYear(c)||''}|${c.title||''}`);
          const resolved=byKey.get(key);
          if(!resolved) return c;
          return {
            ...c,
            poster_url:resolved.verified?resolved.poster_url||null:null,
            backdrop_url:resolved.backdrop_url||null,
            poster_source:resolved.poster_source||null,
            poster_source_id:resolved.poster_source_id||null,
            poster_tmdb_id:resolved.tmdb_id||null,
            poster_imdb_id:resolved.imdb_id||null,
            poster_match_score:Number(resolved.match_score||0),
            poster_verified:!!resolved.verified,
            poster_reason:resolved.reason||null
          };
        });
      }catch(err){
        console.warn('Canonical poster lookup failed',err);
      }finally{
        discoveryArtLoading=false;
        render();
      }
    };
    window.discoveryHydratePosters=discoveryHydratePosters;
  }

  // Save Hallmark movies exactly as before, but keep poster identity metadata
  // separate from the Hallmark catalog identity.
  if(typeof addDiscoveredMovie==='function'){
    addDiscoveredMovie=async function(id,applyTraits){
      const c=(state.discoveryResults||[]).find(x=>Number(x.tmdb_id)===Number(id));
      if(!c||!workspace) return;
      const existing=typeof discoverySavedMovie==='function'?discoverySavedMovie(c):null;
      if(existing){ selectedMovie=existing.id; render(); return; }

      const sourceMetadata={
        source_type:'hallmark_official',
        catalog_id:c.catalog_id||null,
        collection:c.collection||null,
        official_hallmark_url:c.source_url||c.official_source_url||null,
        hallmark_plus_url:c.hallmark_plus_url||null,
        stars:Array.isArray(c.stars)?c.stars:[],
        cast:Array.isArray(c.stars)?c.stars:[],
        director:c.director||null,
        year:Number(c.year)||prYear(c)||null,
        season:c.season||null,
        holiday:c.holiday||null,
        poster_source:c.poster_source||null,
        poster_source_id:c.poster_source_id||null,
        poster_tmdb_id:c.poster_tmdb_id||null,
        poster_imdb_id:c.poster_imdb_id||null,
        poster_match_score:Number(c.poster_match_score||0),
        poster_verified_at:c.poster_verified?new Date().toISOString():null,
        poster_locked:false,
        external_ids:c.poster_imdb_id?{imdb_id:c.poster_imdb_id}:{},
        data_sources:['Hallmark Channel official catalog','Canonical poster resolver'].filter(Boolean)
      };

      const payload={
        workspace_id:workspace.id,
        title:c.title,
        network:c.network||'Hallmark Channel',
        cheese_score:0,
        status:'needs_review',
        summary:c.summary||null,
        tags:['Hallmark official catalog',...(c.why||[]).slice(0,6)],
        source_url:c.source_url||null,
        poster_url:c.poster_verified?c.poster_url||null:null,
        holiday:c.holiday||null,
        season:c.season||null,
        providers:c.providers||[],
        tmdb_id:Number(c.tmdb_id),
        tmdb_type:'movie',
        source_metadata:sourceMetadata,
        created_by:me()
      };
      if(/^\d{4}-\d{2}-\d{2}$/.test(c.premiere_date||'')) payload.premiere_date=c.premiere_date;

      const {data,error}=await db.from('movies').insert(payload).select().single();
      if(error) return alert(error.message);

      const suggestions=applyTraits&&typeof discoveryTraitSuggestions==='function'?discoveryTraitSuggestions(c):[];
      if(suggestions.length){
        const rows=suggestions.map(t=>({workspace_id:workspace.id,movie_id:data.id,trait_id:t.id,selected_by:me()}));
        const {error:traitError}=await db.from('movie_traits').insert(rows);
        if(traitError) alert(`Movie added, but the suggested traits hit an error: ${traitError.message}`);
      }

      discoveryHidden.add(Number(id));
      await logActivity(`found and added ${c.title} from Hallmark${suggestions.length?` with ${suggestions.length} confirmed Cheese Traits`:''}.`,'movie',data.id);
      await loadAll();
      selectedMovie=data.id;
      if(typeof traitSearch!=='undefined') traitSearch='';
      if(typeof traitSelectedOnly!=='undefined') traitSelectedOnly=false;
      render();
    };
    window.addDiscoveredMovie=addDiscoveredMovie;
  }

  function prPosterPanel(movie){
    const meta=prMeta(movie);
    const source=meta.poster_source||'not resolved';
    const locked=meta.poster_locked===true;
    const verified=meta.poster_verified_at||null;
    const score=Number(meta.poster_match_score||0);
    return `<section class="cl-movie-detail-section cl-poster-tools">
      <div class="cl-poster-tools-head">
        <div><div class="kicker">Poster</div><h3>Movie poster source</h3></div>
        <span class="pill">${locked?'🔒 Locked':'🔓 Auto'}</span>
      </div>
      <div class="subtle">${movie.poster_url?`Source: ${esc(source)}${score?` · identity ${score}%`:''}${verified?` · verified ${esc(String(verified).slice(0,10))}`:''}`:'No verified poster saved yet.'}</div>
      <div class="cl-poster-tools-actions">
        <button class="secondary" onclick="refreshMoviePoster('${movie.id}')">🔎 ${movie.poster_url?'Find better poster':'Find poster'}</button>
        <button class="secondary" onclick="pasteMoviePoster('${movie.id}')">🔗 Paste poster URL</button>
        <button class="secondary" onclick="toggleMoviePosterLock('${movie.id}')">${locked?'🔓 Unlock poster':'🔒 Lock poster'}</button>
      </div>
      <div class="subtle">Poster lookup is isolated from Movie Radar: it cannot change filters, votes, traits, or Hallmark discovery.</div>
    </section>`;
  }

  async function prSavePoster(movie,result,options={}){
    const current=prMeta(movie);
    const keepLocked=current.poster_locked===true || options.lock===true;
    const meta={
      ...current,
      poster_source:options.source||result?.poster_source||current.poster_source||null,
      poster_source_id:options.sourceId||result?.poster_source_id||current.poster_source_id||null,
      poster_tmdb_id:result?.tmdb_id||current.poster_tmdb_id||null,
      poster_imdb_id:result?.imdb_id||current.poster_imdb_id||null,
      poster_match_score:Number(result?.match_score||current.poster_match_score||0),
      poster_verified_at:new Date().toISOString(),
      poster_locked:keepLocked,
      external_ids:{...(current.external_ids||{}),...(result?.imdb_id?{imdb_id:result.imdb_id}:{})}
    };
    const poster=options.url||result?.poster_url||null;
    const {error}=await db.from('movies').update({poster_url:poster,source_metadata:meta,updated_at:new Date().toISOString()}).eq('id',movie.id);
    if(error) throw error;
    await loadAll();
    render();
  }

  window.refreshMoviePoster=async function(movieId){
    const movie=(state.movies||[]).find(m=>m.id===movieId);
    if(!movie) return;
    const meta=prMeta(movie);
    if(meta.poster_locked===true && !confirm('This poster is locked. Search for and replace it anyway?')) return;
    try{
      const results=await prResolve([movie]);
      const result=results[0];
      if(!result?.verified||!result?.poster_url){
        alert(result?.reason||'No sufficiently verified poster match was found. The current poster was left unchanged.');
        return;
      }
      await prSavePoster(movie,result,{lock:meta.poster_locked===true});
    }catch(err){ alert(err?.message||String(err)); }
  };

  window.pasteMoviePoster=async function(movieId){
    const movie=(state.movies||[]).find(m=>m.id===movieId);
    if(!movie) return;
    const url=(prompt('Paste the direct HTTPS movie-poster image URL:','')||'').trim();
    if(!url) return;
    if(!/^https:\/\//i.test(url)) return alert('Please use a direct HTTPS image URL.');
    try{
      await prSavePoster(movie,{poster_url:url,match_score:100},{url,source:'manual',sourceId:null,lock:true});
    }catch(err){ alert(err?.message||String(err)); }
  };

  window.toggleMoviePosterLock=async function(movieId){
    const movie=(state.movies||[]).find(m=>m.id===movieId);
    if(!movie) return;
    const current=prMeta(movie);
    const meta={...current,poster_locked:current.poster_locked!==true};
    const {error}=await db.from('movies').update({source_metadata:meta,updated_at:new Date().toISOString()}).eq('id',movieId);
    if(error) return alert(error.message);
    await loadAll();
    render();
  };

  // Add poster controls to the existing detail view without replacing the modal
  // or any Movie Radar click/filter behavior.
  if(typeof clSavedMovieDetailModal==='function'){
    const originalSavedMovieDetail=clSavedMovieDetailModal;
    clSavedMovieDetailModal=function(){
      const movie=(state.movies||[]).find(m=>m.id===selectedMovie);
      let html=originalSavedMovieDetail();
      if(!movie||!html) return html;
      return html.replace('<section class="cl-movie-detail-section cl-synopsis-section">',`${prPosterPanel(movie)}<section class="cl-movie-detail-section cl-synopsis-section">`);
    };
  }

  const style=document.createElement('style');
  style.id='clPosterResolverStyles';
  style.textContent=`
    .cl-poster-tools{border:1px solid rgba(255,255,255,.08)!important}
    .cl-poster-tools-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
    .cl-poster-tools-head h3{margin:4px 0 0}
    .cl-poster-tools-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 8px}
    @media(max-width:700px){.cl-poster-tools-actions>button{flex:1 1 140px;min-height:44px}}
  `;
  document.head.appendChild(style);
})();
