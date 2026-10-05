// Cheese Louise — Movie Intelligence v2
// Information-first presentation for Movie Radar. Keeps the existing app/data model,
// but exposes the metadata we already collect instead of hiding most of it.

(() => {
  let clMovieInfoMode = 'all';
  let clMovieSort = 'newest';

  function clMeta(item){
    const raw=item?.source_metadata;
    if(!raw) return {};
    if(typeof raw==='object') return raw;
    if(typeof raw==='string'){
      try{return JSON.parse(raw)}catch(_){return {}}
    }
    return {};
  }

  function clArr(...values){
    const out=[];
    for(const value of values){
      if(Array.isArray(value)) out.push(...value);
    }
    return [...new Set(out.map(v=>String(v||'').trim()).filter(Boolean))];
  }

  function clStudios(item){
    const meta=clMeta(item);
    return clArr(item?.production_companies,meta.production_companies);
  }

  function clGenres(item){
    const meta=clMeta(item);
    return clArr(item?.genres,meta.genres);
  }

  function clKeywords(item){
    const meta=clMeta(item);
    return clArr(item?.keywords,meta.keywords);
  }

  function clCharacters(item){
    const meta=clMeta(item);
    return clArr(item?.cast_characters,meta.cast_characters);
  }

  function clCast(item){
    const meta=clMeta(item);
    const raw=Array.isArray(item?.cast)?item.cast:(Array.isArray(meta.cast)?meta.cast:[]);
    return raw.map(row=>{
      if(typeof row==='string') return {name:row,character:''};
      return {name:String(row?.name||'').trim(),character:String(row?.character||'').trim()};
    }).filter(row=>row.name);
  }

  function clProviders(item){
    const meta=clMeta(item);
    return clArr(item?.providers,meta.providers);
  }

  function clExternalIds(item){
    const meta=clMeta(item);
    return item?.external_ids || meta.external_ids || {};
  }

  function clYear(item){
    const value=item?.premiere_date || item?.release_date || clMeta(item)?.release_date || '';
    const m=String(value).match(/^(\d{4})/);
    return m?Number(m[1]):null;
  }

  function clHallmarkUrl(item){
    const meta=clMeta(item);
    return item?.hallmark_url || meta.hallmark_url || meta.official_url || null;
  }

  function clImdbUrl(item){
    const id=String(clExternalIds(item)?.imdb_id||'').trim();
    return /^tt\d+$/.test(id)?`https://www.imdb.com/title/${id}/`:null;
  }

  function clCoverage(item){
    const checks=[
      ['release date',!!(item?.premiere_date||item?.release_date)],
      ['synopsis',!!String(item?.summary||'').trim()],
      ['network',!!String(item?.network||clMeta(item)?.network||'').trim()],
      ['production studio',clStudios(item).length>0],
      ['genres',clGenres(item).length>0],
      ['where to watch',clProviders(item).length>0],
      ['IMDb record',!!clImdbUrl(item)],
      ['official Hallmark page',!!clHallmarkUrl(item)]
    ];
    const present=checks.filter(([,ok])=>ok).length;
    return {present,total:checks.length,percent:Math.round((present/checks.length)*100),missing:checks.filter(([,ok])=>!ok).map(([label])=>label)};
  }

  function clPills(values,limit=8){
    const vals=(values||[]).slice(0,limit);
    if(!vals.length) return '<span class="subtle">Not listed yet.</span>';
    return `<div class="pills">${vals.map(v=>`<span class="pill">${esc(v)}</span>`).join('')}${values.length>limit?`<span class="pill">+${values.length-limit} more</span>`:''}</div>`;
  }

  function clLinkButton(url,label){
    if(!url) return '';
    return `<a class="button-link cl-source-link" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)} ↗</a>`;
  }

  function clSourceLinks(item){
    const links=[];
    const hallmark=clHallmarkUrl(item);
    const imdb=clImdbUrl(item);
    const legacy=item?.source_url||null;
    if(hallmark) links.push(clLinkButton(hallmark,'Hallmark official'));
    if(imdb) links.push(clLinkButton(imdb,'IMDb'));
    if(legacy && legacy!==hallmark && legacy!==imdb){
      const label=/themoviedb\.org/i.test(legacy)?'Legacy TMDB record':'Source record';
      links.push(clLinkButton(legacy,label));
    }
    return links.length?`<div class="cl-source-links">${links.join('')}</div>`:'<span class="subtle">No source links stored yet.</span>';
  }

  function clFacts(item){
    const meta=clMeta(item);
    const studios=clStudios(item);
    const genres=clGenres(item);
    const providers=clProviders(item);
    const cast=clCast(item);
    const characters=clCharacters(item);
    const keywords=clKeywords(item);
    const coverage=clCoverage(item);
    const year=clYear(item);
    const date=item?.premiere_date||item?.release_date||'';
    const holiday=item?.holiday||meta.holiday||'';
    const season=item?.season||meta.season||'';
    const tagline=item?.tagline||meta.tagline||'';
    const network=item?.network||meta.network||'';

    return `<section class="cl-movie-detail-section cl-intelligence-panel">
      <div class="cl-intelligence-head">
        <div>
          <div class="kicker">Movie Intelligence</div>
          <h3>What we actually know</h3>
        </div>
        <div class="cl-coverage-badge ${coverage.percent<50?'is-thin':coverage.percent<80?'is-mid':'is-good'}">${coverage.present}/${coverage.total} core fields</div>
      </div>

      <div class="cl-coverage-track" aria-label="Information coverage ${coverage.percent}%"><span style="width:${coverage.percent}%"></span></div>

      <div class="cl-fact-grid">
        <div class="cl-fact"><span>Release</span><strong>${esc(date?fmtDate(date):(year||'Not listed'))}</strong></div>
        <div class="cl-fact"><span>Network / home</span><strong>${esc(network||'Not listed')}</strong></div>
        <div class="cl-fact"><span>Production</span><strong>${esc(studios.join(' · ')||'Not listed')}</strong></div>
        <div class="cl-fact"><span>Season</span><strong>${esc([holiday,season].filter(Boolean).join(' · ')||'Not classified')}</strong></div>
      </div>

      ${tagline?`<div class="cl-tagline"><span>Tagline</span><strong>${esc(tagline)}</strong></div>`:''}

      <details class="cl-info-details" ${studios.length||genres.length||providers.length?'open':''}>
        <summary>Credits, genres & availability</summary>
        <div class="cl-info-stack">
          <div><div class="kicker">Production companies</div>${clPills(studios,10)}</div>
          <div><div class="kicker">Genres</div>${clPills(genres,10)}</div>
          <div><div class="kicker">Where to watch</div>${clPills(providers,10)}</div>
          ${cast.length?`<div><div class="kicker">Cast</div>${clPills(cast.map(row=>row.character?`${row.name} — ${row.character}`:row.name),12)}</div>`:''}
          ${!cast.length&&characters.length?`<div><div class="kicker">Characters in source data</div>${clPills(characters,12)}</div>`:''}
          ${keywords.length?`<div><div class="kicker">Source keywords</div>${clPills(keywords,14)}</div>`:''}
        </div>
      </details>

      <div class="cl-source-block">
        <div><div class="kicker">Source records</div><div class="subtle">Hallmark is our preferred catalog source; IMDb is the verification/reference record. Older entries may still carry a legacy TMDB link.</div></div>
        ${clSourceLinks(item)}
      </div>

      ${coverage.missing.length?`<details class="cl-missing-info"><summary>Missing information (${coverage.missing.length})</summary><div class="pills">${coverage.missing.map(v=>`<span class="pill">${esc(v)}</span>`).join('')}</div></details>`:''}
    </section>`;
  }

  window.clMovieInfoCoverage=clCoverage;
  window.clMovieStudiosV2=clStudios;

  // Expand saved movie search to the metadata that matters when researching an episode.
  if(typeof movieMatchesCheeseFilters==='function'){
    const originalMovieMatches=movieMatchesCheeseFilters;
    movieMatchesCheeseFilters=function(movie){
      const q=String(searchText||'').trim().toLowerCase();
      if(!q) return originalMovieMatches(movie);
      const previous=searchText;
      let base=false;
      try{ searchText=''; base=originalMovieMatches(movie); }
      finally{ searchText=previous; }
      if(!base) return false;
      const meta=clMeta(movie);
      const hay=[
        movie.title,movie.network,movie.summary,movie.notes,movie.holiday,movie.season,
        ...(movie.tags||[]),...(movie.comments||[]).map(c=>c.body),
        ...(movie.selectedTraits||[]).map(t=>`${t.name} ${t.category}`),
        ...clStudios(movie),...clGenres(movie),...clKeywords(movie),...clCharacters(movie),...clProviders(movie),
        clExternalIds(movie)?.imdb_id,meta.tagline
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    };
  }

  if(typeof discoveryMatchesCurrentView==='function'){
    const originalDiscoveryMatches=discoveryMatchesCurrentView;
    discoveryMatchesCurrentView=function(item){
      const q=String(searchText||'').trim().toLowerCase();
      if(!q) return originalDiscoveryMatches(item);
      const previous=searchText;
      let base=false;
      try{ searchText=''; base=originalDiscoveryMatches(item); }
      finally{ searchText=previous; }
      if(!base) return false;
      const hay=[item.title,item.summary,item.network,item.holiday,item.season,...clStudios(item),...clGenres(item),...clKeywords(item),...clCharacters(item),...clProviders(item),clExternalIds(item)?.imdb_id].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    };
  }

  // Information-quality mode + practical sort controls.
  if(typeof filteredMovies==='function'){
    const originalFilteredMovies=filteredMovies;
    filteredMovies=function(){
      let rows=originalFilteredMovies();
      if(clMovieInfoMode==='needs-info') rows=rows.filter(m=>clCoverage(m).percent<75);
      rows=[...rows];
      if(clMovieSort==='az') rows.sort((a,b)=>String(a.title||'').localeCompare(String(b.title||'')));
      else if(clMovieSort==='cheese') rows.sort((a,b)=>Number(b.score||0)-Number(a.score||0)||String(a.title||'').localeCompare(String(b.title||'')));
      else if(clMovieSort==='coverage') rows.sort((a,b)=>clCoverage(a).percent-clCoverage(b).percent||String(a.title||'').localeCompare(String(b.title||'')));
      else rows.sort((a,b)=>String(b.premiere_date||'').localeCompare(String(a.premiere_date||''))||String(a.title||'').localeCompare(String(b.title||'')));
      return rows;
    };
  }

  window.setMovieInfoMode=value=>{clMovieInfoMode=value==='needs-info'?'needs-info':'all';render()};
  window.setMovieSort=value=>{clMovieSort=value||'newest';render()};

  // Make cards research-friendly without turning them into giant walls of text.
  if(typeof movieCard==='function'){
    const originalMovieCard=movieCard;
    movieCard=function(movie){
      let html=originalMovieCard(movie);
      const studios=clStudios(movie);
      const coverage=clCoverage(movie);
      const year=clYear(movie);
      const compact=`<div class="cl-card-intel">
        <div class="cl-card-meta">${[year,studios[0]].filter(Boolean).map(esc).join(' · ')||'More source info needed'}</div>
        <div class="cl-mini-coverage"><span style="width:${coverage.percent}%"></span></div>
        <small>${coverage.present}/${coverage.total} info fields${coverage.missing.length?` · missing ${esc(coverage.missing.slice(0,2).join(', '))}`:''}</small>
      </div>`;
      return html.replace('<div class="vote-row">',`${compact}<div class="vote-row">`);
    };
  }

  if(typeof movies==='function'){
    const originalMovies=movies;
    movies=function(){
      let html=originalMovies();
      const rows=state.movies||[];
      const good=rows.filter(m=>clCoverage(m).percent>=75).length;
      const thin=rows.filter(m=>clCoverage(m).percent<50).length;
      const controls=`<div class="cl-library-tools card card-pad">
        <div class="cl-library-health">
          <div><div class="kicker">Movie Library</div><strong>${rows.length} saved · ${good} well documented · ${thin} thin records</strong></div>
          <div class="cl-library-mode">
            <button class="filter ${clMovieInfoMode==='all'?'active-filter':''}" onclick="setMovieInfoMode('all')">All saved</button>
            <button class="filter ${clMovieInfoMode==='needs-info'?'active-filter':''}" onclick="setMovieInfoMode('needs-info')">Needs info</button>
          </div>
        </div>
        <label class="cl-sort-control"><span>Sort</span><select class="search" onchange="setMovieSort(this.value)">
          <option value="newest" ${clMovieSort==='newest'?'selected':''}>Newest first</option>
          <option value="az" ${clMovieSort==='az'?'selected':''}>Title A–Z</option>
          <option value="cheese" ${clMovieSort==='cheese'?'selected':''}>Cheesiest first</option>
          <option value="coverage" ${clMovieSort==='coverage'?'selected':''}>Needs information first</option>
        </select></label>
      </div>`;
      return html.replace('<div class="toolbar">',`${controls}<div class="toolbar">`);
    };
  }

  // Insert the Intelligence panel into both saved movies and New Finds.
  if(typeof clSavedMovieDetailModal==='function'){
    const originalSavedDetail=clSavedMovieDetailModal;
    clSavedMovieDetailModal=function(){
      const movie=(state.movies||[]).find(x=>x.id===selectedMovie);
      let html=originalSavedDetail();
      if(!movie||!html) return html;
      return html.replace('<section class="cl-movie-detail-section cl-synopsis-section">',`${clFacts(movie)}<section class="cl-movie-detail-section cl-synopsis-section">`);
    };
  }

  if(typeof clDiscoveryMovieDetailModal==='function'){
    const originalDiscoveryDetail=clDiscoveryMovieDetailModal;
    clDiscoveryMovieDetailModal=function(){
      const item=(state.discoveryResults||[]).find(x=>Number(x.tmdb_id)===Number(clDiscoveryMovieDetailId));
      let html=originalDiscoveryDetail();
      if(!item||!html) return html;
      return html.replace('<section class="cl-movie-detail-section cl-synopsis-section">',`${clFacts(item)}<section class="cl-movie-detail-section cl-synopsis-section">`);
    };
  }

  const style=document.createElement('style');
  style.id='clMovieIntelligenceV2Styles';
  style.textContent=`
    .cl-library-tools{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:end;margin:12px 0 16px}
    .cl-library-health{display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap}
    .cl-library-mode{display:flex;gap:7px;flex-wrap:wrap}
    .cl-sort-control{display:grid;gap:5px;min-width:190px}.cl-sort-control>span{font-size:.76rem;opacity:.72;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
    .cl-card-intel{margin:10px 0 2px;padding:9px 10px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:rgba(255,255,255,.025)}
    .cl-card-meta{font-weight:700;font-size:.83rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .cl-card-intel small{display:block;margin-top:4px;opacity:.66;font-size:.72rem}
    .cl-mini-coverage,.cl-coverage-track{height:5px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.09)}
    .cl-mini-coverage{margin-top:7px}.cl-mini-coverage span,.cl-coverage-track span{display:block;height:100%;background:currentColor;opacity:.75;border-radius:inherit}
    .cl-intelligence-panel{border:1px solid rgba(244,200,75,.2)!important;background:linear-gradient(180deg,rgba(244,200,75,.055),rgba(255,255,255,.015))}
    .cl-intelligence-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.cl-intelligence-head h3{margin:4px 0 0}
    .cl-coverage-badge{white-space:nowrap;padding:7px 10px;border-radius:999px;font-size:.77rem;font-weight:800;background:rgba(255,255,255,.07)}
    .cl-coverage-badge.is-thin{outline:1px solid rgba(255,120,120,.35)}.cl-coverage-badge.is-mid{outline:1px solid rgba(244,200,75,.35)}.cl-coverage-badge.is-good{outline:1px solid rgba(116,220,160,.35)}
    .cl-coverage-track{margin:12px 0 16px;height:7px}
    .cl-fact-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
    .cl-fact{padding:10px;border-radius:9px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)}
    .cl-fact span,.cl-tagline span{display:block;font-size:.69rem;text-transform:uppercase;letter-spacing:.07em;opacity:.62;font-weight:800;margin-bottom:4px}.cl-fact strong{font-size:.9rem;line-height:1.25}
    .cl-tagline{margin-top:10px;padding:10px 12px;border-left:3px solid var(--accent,#f4c84b);background:rgba(244,200,75,.05)}
    .cl-info-details,.cl-missing-info{margin-top:13px}.cl-info-details>summary,.cl-missing-info>summary{cursor:pointer;font-weight:800}
    .cl-info-stack{display:grid;gap:13px;margin-top:12px}.cl-info-stack .kicker{margin-bottom:6px}
    .cl-source-block{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;margin-top:15px;padding-top:14px;border-top:1px solid rgba(255,255,255,.08)}
    .cl-source-links{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.cl-source-link{white-space:nowrap}
    .cl-missing-info .pills{margin-top:9px}
    @media(max-width:700px){
      .cl-library-tools{grid-template-columns:1fr}.cl-sort-control{min-width:0}.cl-library-health{align-items:flex-start}.cl-library-mode{width:100%}.cl-library-mode .filter{flex:1}
      .cl-fact-grid{grid-template-columns:1fr}.cl-intelligence-head{align-items:center}.cl-source-block{grid-template-columns:1fr}.cl-source-links{justify-content:flex-start}
    }
  `;
  document.head.appendChild(style);
})();
