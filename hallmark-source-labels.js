// Cheese Louise — source-label cleanup after switching New Finds to Hallmark.
// This intentionally changes labels only; it does not replace Movie Radar rendering or filters.

(() => {
  if (typeof v16DiscoveryHomeCard === 'function') {
    v16DiscoveryHomeCard = function(){
      let body='';
      if(discoveryLoading){
        body='<div class="home-discovery-status"><span class="discovery-spinner">🧀</span><strong>Reading Hallmark…</strong><span class="subtle">Checking the official Hallmark catalog in the background.</span></div>';
      }else if(discoveryError){
        body=`<div class="home-discovery-status"><strong>Hallmark scan needs attention.</strong><span class="subtle">${esc(discoveryError)}</span><button class="secondary" onclick="retryDiscoveryFromHome()">Try again</button></div>`;
      }else if(discoveryLoaded){
        const candidates=typeof v16NewFindCandidates==='function'?v16NewFindCandidates():[];
        const strong=candidates.filter(c=>Number(c.match_score||0)>=20).length;
        const upcoming=candidates.filter(c=>c.premiere_date&&c.premiere_date>=new Date().toISOString().slice(0,10)).length;
        body=`<div class="home-discovery-stats"><div><strong>${candidates.length}</strong><span>new finds</span></div><div><strong>${strong}</strong><span>official matches</span></div><div><strong>${upcoming}</strong><span>upcoming</span></div></div>`;
      }else{
        body='<div class="home-discovery-status"><strong>Movie hunter is ready.</strong><span class="subtle">It will read Hallmark automatically after the shared HQ loads.</span></div>';
      }
      return `<section class="section"><div class="card card-pad home-discovery-card">
        <div class="home-discovery-head"><div><div class="kicker">Movie hunter</div><h2>New Finds</h2></div><span class="pill">HALLMARK</span></div>
        ${body}
        <div class="home-discovery-actions"><button class="primary" onclick="go('movies')">Open Movie Radar</button><button class="secondary" onclick="refreshDiscoveryFromHome()">↻ Refresh Hallmark</button></div>
      </div></section>`;
    };
  }

  if (typeof clMovieDetailLinks === 'function') {
    clMovieDetailLinks = function(item){
      const links=[];
      if(item?.watch_url) links.push(`<a class="button-link" href="${esc(item.watch_url)}" target="_blank" rel="noopener">▶ Watch / provider ↗</a>`);
      if(item?.source_url) links.push(`<a class="button-link" href="${esc(item.source_url)}" target="_blank" rel="noopener">Hallmark / source ↗</a>`);
      return links.length?`<div class="cl-movie-detail-links">${links.join('')}</div>`:'<div class="subtle">No direct links are available yet.</div>';
    };
  }
})();
