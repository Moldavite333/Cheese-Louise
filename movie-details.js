// Cheese Louise v1.13 — expanded clickable movie details
// Makes saved Radar cards and New Finds open a large, read-friendly detail view.

let clDiscoveryMovieDetailId = null;

function clMovieDetailInteractiveTarget(target){
  return !!target?.closest?.('button,a,input,select,textarea,summary,details,label');
}

function clMovieDetailProviderPills(providers){
  const vals=[...new Set((providers||[]).filter(Boolean))];
  if(!vals.length) return '<span class="subtle">No streaming provider listed yet.</span>';
  return `<div class="pills">${vals.map(p=>`<span class="pill">${esc(p)}</span>`).join('')}</div>`;
}

function clMovieDetailLinks(item){
  const links=[];
  if(item?.watch_url) links.push(`<a class="button-link" href="${esc(item.watch_url)}" target="_blank" rel="noopener">▶ Watch / provider ↗</a>`);
  if(item?.source_url) links.push(`<a class="button-link" href="${esc(item.source_url)}" target="_blank" rel="noopener">TMDB / source ↗</a>`);
  return links.length ? `<div class="cl-movie-detail-links">${links.join('')}</div>` : '<div class="subtle">No direct links are available yet.</div>';
}

function clMovieDetailPoster(item){
  return item?.poster_url
    ? `<img class="cl-movie-detail-poster" src="${esc(item.poster_url)}" alt="${esc(item.title||'Movie')} poster" loading="lazy">`
    : `<div class="cl-movie-detail-poster cl-movie-detail-poster-fallback">CL</div>`;
}

function clOpenDiscoveryMovieDetails(tmdbId){
  const id=Number(tmdbId);
  // Romantiverse Search keeps external matches in its own state array.
  // Promote the clicked candidate before opening so the existing detail,
  // vote, and add-to-Radar flows can all resolve the same movie.
  if(typeof ensureRomantiverseCandidateInDiscovery==='function'){
    ensureRomantiverseCandidateInDiscovery(id);
  }
  clDiscoveryMovieDetailId=id;
  selectedMovie=null;
  render();
}

function clCloseDiscoveryMovieDetails(event){
  if(event && event.target!==event.currentTarget) return;
  clDiscoveryMovieDetailId=null;
  render();
}

function clCloseSavedMovieDetails(event){
  if(event && event.target!==event.currentTarget) return;
  selectedMovie=null;
  if(typeof traitSearch!=='undefined') traitSearch='';
  if(typeof traitSelectedOnly!=='undefined') traitSelectedOnly=false;
  render();
}

async function clAddDiscoveryFromDetail(tmdbId,applyTraits){
  clDiscoveryMovieDetailId=null;
  await addDiscoveredMovie(Number(tmdbId),!!applyTraits);
}

function clHideDiscoveryFromDetail(tmdbId){
  clDiscoveryMovieDetailId=null;
  hideDiscoveredMovie(Number(tmdbId));
}

function clSavedMovieDetailModal(){
  const m=(state.movies||[]).find(x=>x.id===selectedMovie);
  if(!m) return '';
  const v=m.votes?.[me()];
  const saved=!!m.bookmarks?.[me()];
  const traits=(m.selectedTraits||[]).slice().sort((a,b)=>Number(b.points||0)-Number(a.points||0)||a.name.localeCompare(b.name));
  const meta=[m.network,m.premiere_date?fmtDate(m.premiere_date):m.date,m.holiday,m.season].filter(Boolean);
  const notes=(m.notes||'').trim();

  return `<div class="modal-backdrop" onclick="clCloseSavedMovieDetails(event)"><div class="modal cl-movie-detail-modal" onclick="event.stopPropagation()">
    <div class="modal-header cl-movie-detail-header">
      <div><div class="kicker">Saved Movie · ${esc(m.status||'radar')}</div><h2>${esc(m.title)}</h2><div class="subtle">${esc(meta.join(' · ')||'Movie details')}</div></div>
      <button class="close" onclick="clCloseSavedMovieDetails()">×</button>
    </div>

    <div class="cl-movie-detail-hero">
      <div>${clMovieDetailPoster(m)}</div>
      <div class="cl-movie-detail-hero-copy">
        <div class="cl-movie-detail-score-row"><div><div class="kicker">Cheese Rating</div><div class="cl-movie-detail-big-score">🧀 ${esc(m.score??m.cheese_score??0)}</div></div><div><div class="kicker">Shared verdict</div><strong>${esc(consensus(m))}</strong></div></div>
        <div><div class="kicker">Where it is</div>${clMovieDetailProviderPills(m.providers)}</div>
        ${clMovieDetailLinks(m)}
        <div class="cl-movie-detail-actions">
          <button class="${saved?'primary':'secondary'}" onclick="bookmark('${m.id}')">🔖 ${saved?'Saved':'Save'}</button>
          <button class="secondary" onclick="scheduleMovie('${m.id}')">📅 Schedule</button>
        </div>
      </div>
    </div>

    <section class="cl-movie-detail-section cl-synopsis-section">
      <div class="kicker">Full synopsis</div>
      <p>${esc(m.summary||'No synopsis is available yet.')}</p>
    </section>

    ${notes?`<section class="cl-movie-detail-section"><div class="kicker">Notes</div><div>${esc(notes).replace(/\n/g,'<br>')}</div></section>`:''}

    <section class="cl-movie-detail-section">
      <div class="cl-movie-detail-section-head"><div><div class="kicker">Romantiverse fingerprint</div><h3>Cheese Traits</h3></div><span class="pill">${traits.length} confirmed</span></div>
      ${traits.length?`<div class="pills cl-movie-detail-traits">${traits.map(t=>`<span class="pill trait-pill">${esc(t.name)} <b>+${Number(t.points||0)}</b></span>`).join('')}</div>`:'<div class="subtle">No confirmed Cheese Traits yet.</div>'}
      ${(m.tags||[]).length?`<div class="pills cl-movie-detail-tags">${(m.tags||[]).map(t=>`<span class="pill">${esc(t)}</span>`).join('')}</div>`:''}
    </section>

    <section class="cl-movie-detail-section">
      <div class="kicker">Your votes</div>
      <div class="vote-row cl-detail-votes">
        <button class="vote-btn ${v==='yes'?'active-yes':''}" onclick="vote('${m.id}','yes')">❤️ Yes</button>
        <button class="vote-btn ${v==='maybe'?'active-maybe':''}" onclick="vote('${m.id}','maybe')">🤔 Maybe</button>
        <button class="vote-btn ${v==='no'?'active-no':''}" onclick="vote('${m.id}','no')">❌ No</button>
      </div>
      ${typeof discoverySharedVoteSummary==='function'?discoverySharedVoteSummary(m):`<div class="subtle">${esc(consensus(m))}</div>`}
    </section>

    <section class="cl-movie-detail-section">
      <div class="kicker">Radar status</div>
      <div class="movie-status-row cl-detail-status-row">
        <button class="filter ${m.status==='needs_review'?'active-filter':''}" onclick="setMovieStatus('${m.id}','needs_review')">Needs Review</button>
        <button class="filter ${m.status==='radar'?'active-filter':''}" onclick="setMovieStatus('${m.id}','radar')">Radar</button>
        <button class="filter ${m.status==='watched'?'active-filter':''}" onclick="setMovieStatus('${m.id}','watched')">Watched</button>
        <button class="filter ${m.status==='passed'?'active-filter':''}" onclick="setMovieStatus('${m.id}','passed')">Passed</button>
      </div>
    </section>

    ${typeof traitPickerHtml==='function'?`<details class="cl-movie-detail-section cl-detail-editor"><summary><strong>Edit Cheese Traits & score</strong></summary><div class="trait-tools"><input id="traitSearch" class="search" placeholder="Search Cheese Traits…" value="${esc(typeof traitSearch!=='undefined'?traitSearch:'')}" oninput="setTraitSearch(this.value)"><button class="secondary ${typeof traitSelectedOnly!=='undefined'&&traitSelectedOnly?'active-filter':''}" onclick="toggleSelectedTraitsOnly()">Selected only</button></div><div class="trait-actions"><button class="secondary" onclick="suggestTraits('${m.id}')">✨ Suggest from synopsis</button><button class="secondary" onclick="openTraitManager()">⚙ Edit trait library</button></div><div id="traitPickerBody" class="trait-picker">${traitPickerHtml(m)}</div></details>`:''}

    <section class="cl-movie-detail-section">
      <div class="kicker">Discussion</div>
      <h3>Comments</h3>
      ${(m.comments||[]).map(c=>`<div class="comment"><strong>${esc(memberName(c.user_id))}</strong><div>${esc(c.body)}</div></div>`).join('')||'<div class="subtle">No comments yet.</div>'}
      <div class="comment-box"><input id="commentInput" placeholder="Add a note…"><button class="primary" onclick="comment('${m.id}')">Send</button></div>
    </section>
  </div></div>`;
}

function clDiscoveryMovieDetailModal(){
  const c=(state.discoveryResults||[]).find(x=>Number(x.tmdb_id)===Number(clDiscoveryMovieDetailId));
  if(!c) return '';
  const est=typeof discoveryEstimate==='function'?discoveryEstimate(c):{traits:[],score:0};
  const traits=est?.traits||[];
  const why=c.why||[];
  const meta=[c.network,c.premiere_date?fmtDate(c.premiere_date):'Date TBA',c.holiday,c.season].filter(Boolean);

  return `<div class="modal-backdrop" onclick="clCloseDiscoveryMovieDetails(event)"><div class="modal cl-movie-detail-modal" onclick="event.stopPropagation()">
    <div class="modal-header cl-movie-detail-header">
      <div><div class="kicker">New Find · ${esc(c.network||'Streaming / TV')}</div><h2>${esc(c.title)}</h2><div class="subtle">${esc(meta.join(' · '))}</div></div>
      <button class="close" onclick="clCloseDiscoveryMovieDetails()">×</button>
    </div>

    <div class="cl-movie-detail-hero">
      <div>${clMovieDetailPoster(c)}</div>
      <div class="cl-movie-detail-hero-copy">
        <div class="cl-movie-detail-score-row"><div><div class="kicker">Radar match</div><div class="cl-movie-detail-big-score">🎯 ${Number(c.match_score||0)}</div></div><div><div class="kicker">Estimated Cheese Rating</div><div class="cl-movie-detail-big-score">🧀 ${Number(est?.score||0)}</div></div></div>
        <div><div class="kicker">Where it is</div>${clMovieDetailProviderPills(c.providers)}</div>
        ${clMovieDetailLinks(c)}
      </div>
    </div>

    <section class="cl-movie-detail-section cl-synopsis-section">
      <div class="kicker">Full synopsis</div>
      <p>${esc(c.summary||'No synopsis is available yet.')}</p>
    </section>

    <section class="cl-movie-detail-section cl-discovery-vote-section">
      ${typeof discoveryVoteControls==='function'?discoveryVoteControls(c,false):''}
    </section>

    <section class="cl-movie-detail-section">
      <div class="cl-movie-detail-section-head"><div><div class="kicker">Romantiverse estimate</div><h3>Likely Cheese Traits</h3></div><span class="pill">${traits.length} likely</span></div>
      ${traits.length?`<div class="pills cl-movie-detail-traits">${traits.map(t=>`<span class="pill trait-pill">${esc(t.name)} <b>+${Number(t.points||0)}</b></span>`).join('')}</div>`:'<div class="subtle">No Cheese Traits are confidently inferred yet.</div>'}
      ${typeof rvMatchDetailsHtml==='function' && est?.matches?.length?`<details class="new-find-why" style="margin-top:12px"><summary>Show Cheese Master evidence</summary>${rvMatchDetailsHtml(est)}</details>`:''}
      ${(c.keywords||[]).length?`<details class="new-find-why" style="margin-top:10px"><summary>Extra TMDB clues used</summary><div class="pills">${(c.keywords||[]).slice(0,12).map(k=>`<span class="pill">${esc(k)}</span>`).join('')}</div></details>`:''}
    </section>

    ${why.length?`<section class="cl-movie-detail-section"><div class="kicker">Why it surfaced</div><div class="pills cl-movie-detail-tags">${why.map(x=>`<span class="pill">${esc(x)}</span>`).join('')}</div></section>`:''}

    <div class="episode-editor-actions cl-movie-detail-footer-actions">
      <button class="primary" onclick="clAddDiscoveryFromDetail(${Number(c.tmdb_id)},true)">${traits.length?`Add + confirm ${traits.length} traits`:'Add to Radar'}</button>
      ${traits.length?`<button class="secondary" onclick="clAddDiscoveryFromDetail(${Number(c.tmdb_id)},false)">Add only</button>`:''}
      <button class="secondary" onclick="clHideDiscoveryFromDetail(${Number(c.tmdb_id)})">Hide for now</button>
      <button class="secondary" onclick="clCloseDiscoveryMovieDetails()">Close</button>
    </div>
  </div></div>`;
}

// Add stable IDs to cards without replacing the existing rendering logic.
const clMovieDetailsOriginalMovieCard=movieCard;
movieCard=function(m){
  const html=clMovieDetailsOriginalMovieCard(m);
  return html.replace('<article class="movie-card card">',`<article class="movie-card card cl-clickable-movie-card" data-movie-id="${esc(m.id)}" role="button" tabindex="0" aria-label="Open ${esc(m.title)} details" title="Tap to open movie details">`);
};

const clMovieDetailsOriginalDiscoveryCard=discoveryCard;
discoveryCard=function(c){
  const html=clMovieDetailsOriginalDiscoveryCard(c);
  return html.replace('<article class="new-find-card card">',`<article class="new-find-card card cl-clickable-movie-card" data-discovery-tmdb-id="${Number(c.tmdb_id)}" role="button" tabindex="0" aria-label="Open ${esc(c.title)} details" title="Tap to open movie details">`);
};

// Replace the old compact saved-movie modal with the expanded information view,
// while preserving higher-priority trait/cocktail editors layered above it.
const clMovieDetailsOriginalModal=modal;
modal=function(){
  if(typeof showTraitManager!=='undefined' && showTraitManager) return clMovieDetailsOriginalModal();
  if(typeof clCocktailDetail!=='undefined' && clCocktailDetail) return clMovieDetailsOriginalModal();
  if(typeof editingCocktail!=='undefined' && editingCocktail) return clMovieDetailsOriginalModal();
  if(clDiscoveryMovieDetailId) return clDiscoveryMovieDetailModal();
  if(selectedMovie) return clSavedMovieDetailModal();
  return clMovieDetailsOriginalModal();
};

document.addEventListener('click',event=>{
  const card=event.target.closest?.('.cl-clickable-movie-card');
  if(!card || clMovieDetailInteractiveTarget(event.target)) return;
  const movieId=card.dataset.movieId;
  const tmdbId=card.dataset.discoveryTmdbId;
  if(movieId){ selectedMovie=movieId; clDiscoveryMovieDetailId=null; render(); return; }
  if(tmdbId) clOpenDiscoveryMovieDetails(Number(tmdbId));
});

document.addEventListener('keydown',event=>{
  if(event.key!=='Enter' && event.key!==' ') return;
  const card=event.target.closest?.('.cl-clickable-movie-card');
  if(!card || event.target!==card) return;
  event.preventDefault();
  const movieId=card.dataset.movieId;
  const tmdbId=card.dataset.discoveryTmdbId;
  if(movieId){ selectedMovie=movieId; clDiscoveryMovieDetailId=null; render(); return; }
  if(tmdbId) clOpenDiscoveryMovieDetails(Number(tmdbId));
});

(function clInjectMovieDetailStyles(){
  if(document.getElementById('clMovieDetailStyles')) return;
  const style=document.createElement('style');
  style.id='clMovieDetailStyles';
  style.textContent=`
    .cl-clickable-movie-card{cursor:pointer}
    .cl-clickable-movie-card:focus-visible{outline:2px solid currentColor;outline-offset:3px}
    .cl-movie-detail-modal{width:min(940px,calc(100vw - 24px));max-width:940px;max-height:92vh;overflow:auto;padding:22px}
    .cl-movie-detail-header{position:sticky;top:-22px;z-index:2;background:var(--panel,#181a21);padding:18px 0 12px;margin-top:-18px}
    .cl-movie-detail-header h2{font-size:clamp(1.45rem,4vw,2.15rem);margin:6px 0}
    .cl-movie-detail-hero{display:grid;grid-template-columns:minmax(180px,260px) 1fr;gap:22px;align-items:start;margin-top:8px}
    .cl-movie-detail-poster{width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:16px;background:var(--panel2,#20232c)}
    .cl-movie-detail-poster-fallback{display:grid;place-items:center;font-size:2rem;font-weight:800}
    .cl-movie-detail-hero-copy{display:grid;gap:18px}
    .cl-movie-detail-score-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .cl-movie-detail-big-score{font-size:1.35rem;font-weight:800;margin-top:4px}
    .cl-movie-detail-links,.cl-movie-detail-actions,.cl-movie-detail-footer-actions{display:flex;flex-wrap:wrap;gap:8px}
    .cl-movie-detail-section{margin-top:22px;padding-top:18px;border-top:1px solid rgba(255,255,255,.09)}
    .cl-movie-detail-section h3{margin:4px 0 10px}
    .cl-movie-detail-section-head{display:flex;justify-content:space-between;gap:12px;align-items:end}
    .cl-synopsis-section p{font-size:1.05rem;line-height:1.65;margin:8px 0 0;white-space:normal}
    .cl-movie-detail-traits,.cl-movie-detail-tags{margin-top:10px}
    .cl-detail-votes,.cl-detail-status-row{margin-top:10px;flex-wrap:wrap}
    .discovery-watch-choice{display:grid;gap:10px}
    .discovery-watch-choice.compact{margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.09)}
    .discovery-vote-row{display:flex;flex-wrap:wrap;gap:8px}
    .discovery-vote-row .vote-btn{min-height:44px;min-width:96px}
    .discovery-shared-votes{margin-top:2px}
    .discovery-vote-consensus,.discovery-vote-note{margin-top:2px}
    .cl-discovery-vote-section{background:rgba(244,200,75,.05);border-radius:14px;padding:16px}
    .cl-detail-editor{padding-bottom:4px}
    .cl-detail-editor>summary{cursor:pointer;padding:4px 0 10px}
    @media(max-width:680px){
      .cl-movie-detail-modal{width:calc(100vw - 12px);max-height:96vh;padding:16px}
      .cl-movie-detail-header{top:-16px;margin-top:-12px;padding-top:14px}
      .cl-movie-detail-hero{grid-template-columns:105px 1fr;gap:14px}
      .cl-movie-detail-score-row{grid-template-columns:1fr}
      .cl-movie-detail-poster{border-radius:12px}
      .cl-synopsis-section p{font-size:1rem;line-height:1.58}
    }
  `;
  document.head.appendChild(style);
})();

window.clOpenDiscoveryMovieDetails=clOpenDiscoveryMovieDetails;
window.clCloseDiscoveryMovieDetails=clCloseDiscoveryMovieDetails;
window.clCloseSavedMovieDetails=clCloseSavedMovieDetails;
window.clAddDiscoveryFromDetail=clAddDiscoveryFromDetail;
window.clHideDiscoveryFromDetail=clHideDiscoveryFromDetail;
