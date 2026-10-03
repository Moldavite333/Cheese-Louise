// Cheese Louise v1.13 — clickable cocktail-match details
// Makes ranked Original Match cards open a read-only cocktail information modal.

let clCocktailDetail = null;

function clDetailSavedCocktail(candidate){
  if(!candidate) return null;
  if(candidate.id && !candidate.external) return clCocktailById(candidate.id) || candidate;
  if(candidate.source_id){
    const bySource=(state.cocktails||[]).find(c=>
      c.cocktail_type==='original' &&
      c.source_name===candidate.source_name &&
      String(c.source_id||'')===String(candidate.source_id)
    );
    if(bySource) return bySource;
  }
  return (state.cocktails||[]).find(c=>c.cocktail_type==='original' && clNormName(c.name)===clNormName(candidate.name)) || null;
}

function clMatchContextFromCard(card){
  if(!card || typeof clSmartOriginalMatches!=='function') return null;
  const episode=!!card.closest('#epCocktailMatches');
  const movieId=episode ? (document.getElementById('epMovie')?.value||'') : (cocktailMatchMovieId||'');
  const movie=(state.movies||[]).find(m=>m.id===movieId);
  if(!movie) return null;
  const scope=card.closest('.cl-smart-episode-list') || card.closest('.cl-match-results') || card.parentElement;
  const cards=scope ? [...scope.querySelectorAll('.cl-smart-match-card')] : [];
  const index=cards.indexOf(card);
  if(index<0) return null;
  const result=clSmartOriginalMatches(movie)[index];
  if(!result) return null;
  return {episode,movie,result,index};
}

function clOpenCocktailMatchDetails(card){
  const ctx=clMatchContextFromCard(card);
  if(!ctx) return;
  clCocktailDetail={
    cocktail:ctx.result.cocktail,
    result:ctx.result,
    movie:ctx.movie,
    episode:ctx.episode
  };
  render();
}

function clCloseCocktailDetails(event){
  if(event && event.target!==event.currentTarget) return;
  clCocktailDetail=null;
  render();
}

function clIngredientRowsForDetail(c){
  if(Array.isArray(c?.ingredientRows) && c.ingredientRows.length){
    return c.ingredientRows.map(row=>{
      const measure=String(row?.measure||'').trim();
      const ingredient=String(row?.ingredient||'').trim();
      return [measure,ingredient].filter(Boolean).join(' ');
    }).filter(Boolean);
  }
  return String(c?.ingredients||'').split('\n').map(x=>x.trim()).filter(Boolean);
}

function clCocktailDetailsModal(){
  if(!clCocktailDetail) return '';
  const c=clCocktailDetail.cocktail;
  const result=clCocktailDetail.result;
  const movie=clCocktailDetail.movie;
  const saved=clDetailSavedCocktail(c);
  const ingredients=clIngredientRowsForDetail(c);
  const sourceUrl=c?.source_url||saved?.source_url||'';
  const imageUrl=c?.source_image_url||saved?.source_image_url||'';
  const method=c?.method||saved?.method||'';
  const glass=c?.glassware||saved?.glassware||'';
  const garnish=c?.garnish||saved?.garnish||'';
  const strength=c?.strength||saved?.strength||'';
  const tags=clUnique([...(c?.flavor_tags||[]),...(result?.overlaps||[])]).slice(0,12);
  const sourceId=c?.source_id||saved?.source_id||'';
  const isExternal=!!c?.external;

  return `<div class="modal-backdrop" onclick="clCloseCocktailDetails(event)"><div class="modal cl-cocktail-detail-modal" onclick="event.stopPropagation()">
    <div class="modal-header">
      <div><div class="kicker">Original Cocktail</div><h2 style="margin:6px 0">${esc(c?.name||'Cocktail')}</h2></div>
      <button class="close" onclick="clCloseCocktailDetails()">×</button>
    </div>

    ${imageUrl?`<img class="cl-cocktail-detail-image" src="${esc(imageUrl)}" alt="${esc(c?.name||'Cocktail')}" loading="lazy">`:''}

    <div class="cl-cocktail-detail-meta">
      <div class="subtle">${esc([c?.base_spirit||saved?.base_spirit,c?.style||saved?.style].filter(Boolean).join(' · ')||'Classic cocktail')}</div>
      <div class="pills" style="margin-top:8px">${clSourceBadge(c)}${tags.map(t=>`<span class="pill">${esc(clTagLabel(t))}</span>`).join('')}</div>
    </div>

    ${result&&movie?`<div class="cl-why-box" style="margin-top:14px"><strong>${result.score}% match for ${esc(movie.title)}</strong><div class="subtle" style="margin-top:5px">${esc(result.reasons.join(' · '))}</div></div>`:''}

    <div class="cl-cocktail-detail-section">
      <h3>Ingredients</h3>
      ${ingredients.length?`<div class="cl-detail-ingredients">${ingredients.map(line=>`<div>${esc(line)}</div>`).join('')}</div>`:'<div class="subtle">Ingredient list unavailable.</div>'}
    </div>

    ${method?`<div class="cl-cocktail-detail-section"><h3>Method</h3><div>${esc(method)}</div></div>`:''}

    ${(glass||garnish||strength)?`<div class="cl-cocktail-detail-section"><h3>Serve</h3><div class="subtle">${[
      glass&&`Glass: ${glass}`,
      garnish&&`Garnish: ${garnish}`,
      strength&&`Strength: ${strength}`
    ].filter(Boolean).map(esc).join(' · ')}</div></div>`:''}

    <div class="episode-editor-actions cl-cocktail-detail-actions">
      ${isExternal&&!saved?`<button class="primary" onclick="clSaveDetailOriginal()">Save Original</button>`:''}
      ${clCocktailDetail.episode?`<button class="primary" onclick="clUseDetailForEpisode()">Use this</button>`:''}
      ${!clCocktailDetail.episode?`<button class="secondary" onclick="clMakeDetailVariation()">Make Cheese Louise version</button>`:''}
      ${saved?`<button class="secondary" onclick="clEditSavedDetailCocktail()">Edit saved cocktail</button>`:''}
      ${sourceUrl?`<a class="button-link" href="${esc(sourceUrl)}" target="_blank" rel="noopener">Source ↗</a>`:''}
      <button class="secondary" onclick="clCloseCocktailDetails()">Close</button>
    </div>
    ${sourceId?`<div class="subtle cl-detail-source-id">Recipe source ID: ${esc(sourceId)}</div>`:''}
  </div></div>`;
}

async function clSaveDetailOriginal(){
  const c=clCocktailDetail?.cocktail;
  if(!c) return;
  try{
    const local=await clEnsureLocalOriginal(c);
    if(local) clCocktailDetail.cocktail={...c,...local,external:false};
    render();
  }catch(err){ alert(err?.message||String(err)); }
}

async function clUseDetailForEpisode(){
  const detail=clCocktailDetail;
  if(!detail?.cocktail) return;
  try{
    const local=detail.cocktail.external ? await clEnsureLocalOriginal(detail.cocktail) : (clDetailSavedCocktail(detail.cocktail)||detail.cocktail);
    if(!local?.id) return;
    clCocktailDetail=null;
    render();
    setTimeout(()=>{
      const select=document.getElementById('epCocktailId');
      if(!select) return;
      if(![...select.options].some(o=>o.value===local.id)){
        const option=document.createElement('option');
        option.value=local.id;
        option.textContent=local.name;
        select.appendChild(option);
      }
      select.value=local.id;
    },0);
  }catch(err){ alert(err?.message||String(err)); }
}

async function clMakeDetailVariation(){
  const detail=clCocktailDetail;
  if(!detail?.cocktail) return;
  const id=detail.cocktail.source_id||detail.cocktail.id;
  const external=!!detail.cocktail.external;
  clCocktailDetail=null;
  await clGenerateOneFromMatch(id,external);
}

function clEditSavedDetailCocktail(){
  const saved=clDetailSavedCocktail(clCocktailDetail?.cocktail);
  if(!saved?.id) return;
  clCocktailDetail=null;
  editCocktail(saved.id);
}

const clDetailOriginalModal=modal;
modal=function(){
  if(clCocktailDetail) return clCocktailDetailsModal();
  return clDetailOriginalModal();
};

function clDecorateSmartMatchCards(){
  document.querySelectorAll('.cl-smart-match-card').forEach(card=>{
    if(card.dataset.clDetailsReady==='1') return;
    card.dataset.clDetailsReady='1';
    card.setAttribute('role','button');
    card.setAttribute('tabindex','0');
    card.setAttribute('aria-label','Open cocktail details');
    card.title='Tap to open cocktail details';
  });
}

document.addEventListener('click',event=>{
  const card=event.target.closest?.('.cl-smart-match-card');
  if(!card) return;
  if(event.target.closest('button,a,input,select,textarea,summary,details')) return;
  clOpenCocktailMatchDetails(card);
});

document.addEventListener('keydown',event=>{
  if(event.key!=='Enter' && event.key!==' ') return;
  const card=event.target.closest?.('.cl-smart-match-card');
  if(!card || event.target!==card) return;
  event.preventDefault();
  clOpenCocktailMatchDetails(card);
});

const clDetailObserver=new MutationObserver(()=>clDecorateSmartMatchCards());
if(document.body) clDetailObserver.observe(document.body,{childList:true,subtree:true});
setTimeout(clDecorateSmartMatchCards,0);

(function clInjectCocktailDetailStyles(){
  if(document.getElementById('clCocktailDetailStyles')) return;
  const style=document.createElement('style');
  style.id='clCocktailDetailStyles';
  style.textContent=`
    .cl-smart-match-card{cursor:pointer}
    .cl-smart-match-card:focus-visible{outline:2px solid currentColor;outline-offset:3px}
    .cl-smart-match-card .cl-match-score strong{text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px}
    .cl-cocktail-detail-modal{max-width:620px}
    .cl-cocktail-detail-image{width:100%;max-height:300px;object-fit:cover;border-radius:14px;margin:4px 0 12px}
    .cl-cocktail-detail-section{margin-top:18px}
    .cl-cocktail-detail-section h3{margin:0 0 8px}
    .cl-detail-ingredients{display:grid;gap:6px}
    .cl-cocktail-detail-actions{flex-wrap:wrap}
    .cl-detail-source-id{margin-top:12px}
  `;
  document.head.appendChild(style);
})();

window.clOpenCocktailMatchDetails=clOpenCocktailMatchDetails;
window.clCloseCocktailDetails=clCloseCocktailDetails;
window.clSaveDetailOriginal=clSaveDetailOriginal;
window.clUseDetailForEpisode=clUseDetailForEpisode;
window.clMakeDetailVariation=clMakeDetailVariation;
window.clEditSavedDetailCocktail=clEditSavedDetailCocktail;
