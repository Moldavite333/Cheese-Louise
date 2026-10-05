// Cheese Louise — Hallmark-first Movie Radar catalog.
// Official Hallmark pages power discovery; Hallmark artwork is hydrated separately.

(() => {
  state.hallmarkCatalog = state.hallmarkCatalog || [];
  let hallmarkLoading = false;
  let hallmarkLoaded = false;
  let hallmarkError = '';
  let hallmarkMeta = null;
  let hallmarkYear = 'all';
  let hallmarkArtLoading = false;
  let hallmarkArtLoaded = false;

  function hmNorm(v){ return String(v || '').trim().toLowerCase(); }
  function hmExistingKey(m){ return `${Number(m?.premiere_date?.slice?.(0,4) || m?.source_metadata?.year || 0)}|${hmNorm(m?.title).replace(/[^a-z0-9]+/g,' ')}`; }
  function hmCatalogKey(c){ return `${Number(c?.year || c?.premiere_date?.slice?.(0,4) || 0)}|${hmNorm(c?.title).replace(/[^a-z0-9]+/g,' ')}`; }
  function hmExistingKeys(){ return new Set((state.movies || []).map(hmExistingKey)); }
  function hmUnsaved(){ const existing=hmExistingKeys(); return (state.hallmarkCatalog||[]).filter(c=>!existing.has(hmCatalogKey(c))); }

  async function hydrateHallmarkArt(force=false){
    if(hallmarkArtLoading || (!force && hallmarkArtLoaded) || !(state.hallmarkCatalog||[]).length) return;
    hallmarkArtLoading=true;
    try{
      const movies=(state.hallmarkCatalog||[]).map(c=>({catalog_id:c.catalog_id,title:c.title,official_source_url:c.official_source_url}));
      const {data,error}=await db.functions.invoke('hallmark-art',{body:{movies}});
      if(error) throw error;
      const rows=Array.isArray(data?.results)?data.results:[];
      const byId=new Map(rows.map(row=>[String(row.catalog_id),row]));
      state.hallmarkCatalog=(state.hallmarkCatalog||[]).map(c=>{
        const art=byId.get(String(c.catalog_id));
        return art?{...c,poster_url:art.poster_url||c.poster_url||null,detail_url:art.detail_url||c.detail_url||c.official_source_url}:{...c};
      });
      hallmarkArtLoaded=true;
    }catch(err){ console.warn('Hallmark artwork lookup failed',err); }
    finally{ hallmarkArtLoading=false; render(); }
  }

  async function loadHallmarkCatalog(force=false){
    if(hallmarkLoading) return;
    if(hallmarkLoaded && !force) return;
    hallmarkLoading = true;
    hallmarkError = '';
    if(force) hallmarkArtLoaded=false;
    render();
    try {
      const {data,error} = await db.functions.invoke('discover-hallmark-movies',{body:{}});
      if(error) throw error;
      if(data?.error) throw new Error(data.error);
      state.hallmarkCatalog = Array.isArray(data?.results) ? data.results : [];
      hallmarkMeta = data || null;
      hallmarkLoaded = true;
      setTimeout(()=>hydrateHallmarkArt(force),0);
    } catch(err){
      hallmarkError = err?.message || String(err);
    } finally {
      hallmarkLoading = false;
      render();
    }
  }

  function hallmarkCandidateMatches(c){
    const q = hmNorm(searchText);
    if(q){
      const hay = [c.title,c.summary,c.collection,c.network,c.season,c.holiday,...(c.stars||[])].filter(Boolean).join(' ').toLowerCase();
      if(!hay.includes(q)) return false;
    }
    if(hallmarkYear !== 'all' && Number(c.year)!==Number(hallmarkYear)) return false;
    if(movieFilters?.yearMin && Number(c.year) < Number(movieFilters.yearMin)) return false;
    if(movieFilters?.yearMax && Number(c.year) > Number(movieFilters.yearMax)) return false;
    if(movieFilters?.holiday && hmNorm(c.holiday)!==hmNorm(movieFilters.holiday)) return false;
    if(movieFilters?.season && hmNorm(c.season)!==hmNorm(movieFilters.season)) return false;
    return true;
  }

  function hallmarkCard(c){
    const exists = hmExistingKeys().has(hmCatalogKey(c));
    const meta = [c.premiere_date ? fmtDate(c.premiere_date) : c.year, c.collection, c.holiday, c.season].filter(Boolean);
    const source=c.detail_url||c.official_source_url;
    return `<article class="card hm-catalog-card">
      ${c.poster_url?`<a class="hm-art" href="${esc(source)}" target="_blank" rel="noopener"><img src="${esc(c.poster_url)}" alt="${esc(c.title)} artwork" loading="lazy"></a>`:''}
      <div class="hm-card-content">
        <div class="hm-card-top">
          <div>
            <div class="kicker">Official Hallmark catalog</div>
            <h3>${esc(c.title)}</h3>
            <div class="subtle">${esc(meta.join(' · '))}</div>
          </div>
          <span class="pill hm-source-pill">Hallmark</span>
        </div>
        ${(c.stars||[]).length?`<div class="hm-stars"><strong>Starring:</strong> ${esc(c.stars.join(' · '))}</div>`:''}
        <p>${esc(c.summary || 'Hallmark lists this title, but the synopsis was not available in this catalog block.')}</p>
        <div class="hm-card-actions">
          <button class="${exists?'secondary':'primary'}" ${exists?'disabled':''} onclick="addOfficialHallmarkMovie('${esc(c.catalog_id)}')">${exists?'✓ In Radar':'＋ Add to Radar'}</button>
          <a class="button-link" href="${esc(source)}" target="_blank" rel="noopener">Hallmark source ↗</a>
        </div>
      </div>
    </article>`;
  }

  function hallmarkCatalogPanel(){
    const existing = hmExistingKeys();
    const all = (state.hallmarkCatalog || []).filter(c=>!existing.has(hmCatalogKey(c)) && hallmarkCandidateMatches(c));
    const years = [...new Set((state.hallmarkCatalog||[]).map(c=>Number(c.year)).filter(Boolean))].sort((a,b)=>b-a);
    const coverage = hallmarkMeta?.coverage || {};

    const header = `<div class="hm-catalog-head">
      <div>
        <div class="page-title small-title">Hallmark Catalog</div>
        <div class="subtle">Official Hallmark pages power New Finds. Movie artwork is pulled from Hallmark's own title pages.</div>
      </div>
      <button class="secondary" onclick="loadHallmarkCatalog(true)">↻ Refresh Hallmark</button>
    </div>`;

    if(hallmarkLoading) return `<section class="section hm-catalog-section"><div class="card card-pad">${header}<div class="discovery-loading"><span class="discovery-spinner">♥</span> Reading Hallmark's official catalog…</div></div></section>`;
    if(hallmarkError) return `<section class="section hm-catalog-section"><div class="card card-pad">${header}<div class="empty"><strong>Hallmark catalog could not load.</strong><div class="subtle">${esc(hallmarkError)}</div><button class="primary" style="margin-top:10px" onclick="loadHallmarkCatalog(true)">Try again</button></div></div></section>`;
    if(!hallmarkLoaded) return `<section class="section hm-catalog-section"><div class="card card-pad">${header}<button class="primary" onclick="loadHallmarkCatalog(true)">Load official Hallmark catalog</button></div></section>`;

    return `<section class="section hm-catalog-section">
      <div class="card card-pad hm-catalog-toolbar">
        ${header}
        <div class="hm-source-note"><strong>Source of truth:</strong> Hallmark Channel official collection and premiere pages.${hallmarkArtLoading?' · Loading artwork…':''}</div>
        <div class="toolbar hm-year-toolbar">
          <button class="filter ${hallmarkYear==='all'?'active-filter':''}" onclick="setHallmarkYear('all')">All years</button>
          ${years.map(y=>`<button class="filter ${Number(hallmarkYear)===y?'active-filter':''}" onclick="setHallmarkYear('${y}')">${y} <span class="subtle">${Number(coverage[y]||0)}</span></button>`).join('')}
        </div>
        <div class="results-line"><strong>${all.length}</strong> official Hallmark title${all.length===1?'':'s'} not yet in your Radar</div>
      </div>
      <div class="hm-catalog-grid">${all.map(hallmarkCard).join('') || '<div class="empty card card-pad">No Hallmark titles match the current filters — or you already added them.</div>'}</div>
    </section>`;
  }

  async function addOfficialHallmarkMovie(catalogId){
    const c=(state.hallmarkCatalog||[]).find(x=>String(x.catalog_id)===String(catalogId));
    if(!c||!workspace) return;
    if(hmExistingKeys().has(hmCatalogKey(c))) return alert('That Hallmark title is already in your Radar.');

    const stars=Array.isArray(c.stars)?c.stars:[];
    const officialUrl=c.detail_url||c.official_source_url||null;
    const sourceMetadata={
      source_type:'hallmark_official',
      official_hallmark_url:officialUrl,
      hallmark_url:officialUrl,
      official_url:officialUrl,
      poster_url:c.poster_url||null,
      collection:c.collection||null,
      stars,
      cast:stars,
      year:Number(c.year)||null,
      season:c.season||null,
      holiday:c.holiday||null,
      network:'Hallmark Channel',
      catalog_id:c.catalog_id,
      data_sources:['Hallmark Channel official catalog','Hallmark Channel title page artwork']
    };
    const payload={
      workspace_id:workspace.id,
      title:c.title,
      network:'Hallmark Channel',
      cheese_score:0,
      status:'needs_review',
      summary:c.summary||null,
      tags:['Hallmark official catalog',c.collection].filter(Boolean),
      source_url:officialUrl,
      poster_url:c.poster_url||null,
      holiday:c.holiday||null,
      season:c.season||null,
      source_metadata:sourceMetadata,
      created_by:me()
    };
    if(/^\d{4}-\d{2}-\d{2}$/.test(c.premiere_date||'')) payload.premiere_date=c.premiere_date;
    const {data,error}=await db.from('movies').insert(payload).select().single();
    if(error) return alert(error.message);
    await logActivity(`added ${c.title} from the official Hallmark catalog.`,'movie',data.id);
    await loadAll();
    selectedMovie=data.id;
    render();
  }

  // Retire automatic TMDB discovery from Movie Radar.
  discoveryLoaded = true;
  discoveryLoading = false;
  state.discoveryResults = [];
  discoveryPanel = function(){ return ''; };
  discoverCheeseMovies = async function(){ return; };
  window.discoverCheeseMovies = discoverCheeseMovies;

  // Replace the old TMDB home "Movie Hunter" card with Hallmark catalog health.
  if(typeof v16DiscoveryHomeCard === 'function'){
    v16DiscoveryHomeCard = function(){
      let body='';
      if(hallmarkLoading){
        body='<div class="home-discovery-status"><span class="discovery-spinner">♥</span><strong>Reading Hallmark…</strong><span class="subtle">Checking the official movie catalog.</span></div>';
      }else if(hallmarkError){
        body=`<div class="home-discovery-status"><strong>Hallmark catalog needs attention.</strong><span class="subtle">${esc(hallmarkError)}</span><button class="secondary" onclick="loadHallmarkCatalog(true)">Try again</button></div>`;
      }else if(hallmarkLoaded){
        const candidates=hmUnsaved();
        const y=new Date().getFullYear();
        const thisYear=candidates.filter(c=>Number(c.year)===y).length;
        const today=new Date().toISOString().slice(0,10);
        const upcoming=candidates.filter(c=>c.premiere_date && c.premiere_date>=today).length;
        body=`<div class="home-discovery-stats"><div><strong>${candidates.length}</strong><span>new finds</span></div><div><strong>${thisYear}</strong><span>${y} titles</span></div><div><strong>${upcoming}</strong><span>upcoming</span></div></div>`;
      }else{
        body='<div class="home-discovery-status"><strong>Hallmark movie hunter is ready.</strong><span class="subtle">It reads Hallmark directly instead of guessing through TMDB.</span></div>';
      }
      return `<section class="section"><div class="card card-pad home-discovery-card">
        <div class="home-discovery-head"><div><div class="kicker">Movie hunter</div><h2>New Finds</h2></div><span class="pill">HALLMARK</span></div>
        ${body}
        <div class="home-discovery-actions"><button class="primary" onclick="go('movies')">Open Movie Radar</button><button class="secondary" onclick="loadHallmarkCatalog(true)">↻ Refresh Hallmark</button></div>
      </div></section>`;
    };
  }
  if(typeof v16KickDiscovery === 'function'){
    v16KickDiscovery = function(){
      if(!session||!workspace||hallmarkLoaded||hallmarkLoading||hallmarkError)return;
      setTimeout(()=>loadHallmarkCatalog(false),0);
    };
  }
  window.retryDiscoveryFromHome=()=>loadHallmarkCatalog(true);
  window.refreshDiscoveryFromHome=()=>loadHallmarkCatalog(true);

  const originalMovies = movies;
  movies = function(){
    let html = originalMovies();
    const firstEnd = html.indexOf('</section>');
    const panel = hallmarkCatalogPanel();
    if(firstEnd>=0) html = html.slice(0,firstEnd+10) + panel + html.slice(firstEnd+10);
    else html = panel + html;
    if(session && workspace && !hallmarkLoaded && !hallmarkLoading && !hallmarkError){ setTimeout(()=>loadHallmarkCatalog(false),0); }
    return html;
  };

  if(typeof topbar === 'function'){
    const originalTopbar = topbar;
    topbar = function(){
      return originalTopbar()
        .replace('Search movies, studios, notes, ideas…','Search titles, stars, studios, synopses…')
        .replace('Search movies, notes, ideas…','Search titles, stars, studios, synopses…');
    };
  }

  const style=document.createElement('style');
  style.textContent=`
    .discovery-section{display:none!important}
    .hm-catalog-section{margin-top:4px}
    .hm-catalog-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}
    .hm-catalog-toolbar{display:grid;gap:12px}
    .hm-source-note{padding:9px 11px;border-left:3px solid var(--accent,#f4c84b);background:rgba(244,200,75,.07);border-radius:0 8px 8px 0}
    .hm-year-toolbar{overflow-x:auto;flex-wrap:nowrap}
    .hm-catalog-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin-top:14px}
    .hm-catalog-card{padding:0;overflow:hidden;display:grid}
    .hm-card-content{padding:16px;display:grid;gap:11px}
    .hm-art{display:block;aspect-ratio:16/9;background:#111;overflow:hidden;border-bottom:1px solid var(--line,#2a2d35)}
    .hm-art img{width:100%;height:100%;display:block;object-fit:cover}
    .hm-card-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
    .hm-catalog-card h3{margin:4px 0 3px;font-size:1.15rem}
    .hm-catalog-card p{margin:0;line-height:1.5}
    .hm-stars{font-size:.94rem;line-height:1.45}
    .hm-source-pill{white-space:nowrap}
    .hm-card-actions{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-top:auto}
    @media(max-width:700px){
      .hm-catalog-head{display:grid}
      .hm-catalog-grid{grid-template-columns:1fr}
      .hm-card-actions .primary,.hm-card-actions .secondary{min-height:44px}
      .hm-art{aspect-ratio:16/8.5}
    }
  `;
  document.head.appendChild(style);

  window.loadHallmarkCatalog=loadHallmarkCatalog;
  window.hydrateHallmarkArt=hydrateHallmarkArt;
  window.setHallmarkYear=value=>{hallmarkYear=value;render();};
  window.addOfficialHallmarkMovie=addOfficialHallmarkMovie;
})();
