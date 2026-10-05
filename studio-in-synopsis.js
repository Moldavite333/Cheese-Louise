// Cheese Louise — show production company/studio with the movie synopsis.
// Uses production_companies already stored in source_metadata when available.

(() => {
  function parseSourceMetadata(item) {
    const raw = item?.source_metadata;
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch (_) { return {}; }
    }
    return {};
  }

  function productionCompanies(item) {
    const meta = parseSourceMetadata(item);
    const direct = Array.isArray(item?.production_companies) ? item.production_companies : [];
    const stored = Array.isArray(meta?.production_companies) ? meta.production_companies : [];
    return [...new Set([...direct, ...stored].map(v => String(v || '').trim()).filter(Boolean))];
  }

  function productionLine(item) {
    const companies = productionCompanies(item);
    if (!companies.length) {
      return '<div class="cl-production-line"><strong>Produced by:</strong> <span class="subtle">Not listed in the source data yet.</span></div>';
    }
    return `<div class="cl-production-line"><strong>Produced by:</strong> ${companies.map(esc).join(' · ')}</div>`;
  }

  function addProductionToSynopsis(html, item) {
    if (!html || !html.includes('<div class="kicker">Full synopsis</div>')) return html;
    return html.replace(
      '<div class="kicker">Full synopsis</div>',
      `<div class="kicker">Full synopsis</div>${productionLine(item)}`
    );
  }

  if (typeof clSavedMovieDetailModal === 'function') {
    const originalSaved = clSavedMovieDetailModal;
    clSavedMovieDetailModal = function() {
      const movie = (state.movies || []).find(x => x.id === selectedMovie);
      return addProductionToSynopsis(originalSaved(), movie);
    };
  }

  if (typeof clDiscoveryMovieDetailModal === 'function') {
    const originalDiscovery = clDiscoveryMovieDetailModal;
    clDiscoveryMovieDetailModal = function() {
      const item = (state.discoveryResults || []).find(x => Number(x.tmdb_id) === Number(clDiscoveryMovieDetailId));
      return addProductionToSynopsis(originalDiscovery(), item);
    };
  }

  const style = document.createElement('style');
  style.textContent = `
    .cl-production-line{
      margin:8px 0 12px;
      padding:9px 11px;
      border-left:3px solid var(--accent,#f4c84b);
      background:rgba(244,200,75,.07);
      border-radius:0 8px 8px 0;
      line-height:1.35;
    }
  `;
  document.head.appendChild(style);
})();
