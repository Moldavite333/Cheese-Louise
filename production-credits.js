// Shared production credits. Unknown credits stay unknown; never infer a studio from its network.
(() => {
 const metaOf=movie=>{let m=movie?.source_metadata;if(typeof m==='string'){try{m=JSON.parse(m)}catch{m={}}}return m&&typeof m==='object'&&!Array.isArray(m)?m:{}};
 const names=value=>[...new Set((Array.isArray(value)?value:value?[value]:[]).map(x=>typeof x==='string'?x.trim():String(x?.name||'').trim()).filter(x=>x&&!/^(unknown|not recorded|not listed|n\/a)$/i.test(x)))];
 const firstNames=(...values)=>values.map(names).find(value=>value.length)||[];
 function get(movie){
  const meta=metaOf(movie),manual=meta.production_credit_override||{};
  const production=firstNames(manual.production_companies,movie?.production_companies,movie?.production_company,meta.production_companies,meta.production_company);
  const crew=Array.isArray(meta.credits?.crew)?meta.credits.crew:Array.isArray(meta.crew)?meta.crew:[];
  const director=firstNames(manual.director,movie?.director,meta.director,meta.directors,crew.filter(x=>x.job==='Director'));
  return {production,director,missing:[...(!production.length?['production company']:[]),...(!director.length?['director']:[])],source:manual.source_url||''};
 }
 function editor(movie){
  const credits=get(movie),safe=esc;
  return '<section class="cl-movie-detail-section"><h3>Production credits</h3><p role="status">'+(credits.missing.length?'Needs research: '+safe(credits.missing.join(' and ')):'Production company and director recorded.')+'</p><form data-movie-id="'+safe(movie.id)+'" onsubmit="event.preventDefault();clCredits.save(this)"><label>Production company or companies<input class="search" name="production" required value="'+safe(credits.production.join('; '))+'" placeholder="Separate multiple companies with semicolons"></label><label>Director<input class="search" name="director" required value="'+safe(credits.director.join('; '))+'"></label><label>Credit source link<input class="search" name="source" type="url" required value="'+safe(credits.source)+'" placeholder="https://…"></label><p class="subtle">Use the movie’s end credits or a reliable credit listing. The broadcasting network is not automatically the production company.</p><button class="primary" type="submit">Save verified credits</button><p data-credit-status role="status" aria-live="polite"></p></form></section>';
 }
 async function save(form){
  const status=form.querySelector('[data-credit-status]'),button=form.querySelector('button[type="submit"]');
  if(button.disabled)return;
  const production=names(form.elements.production.value.split(';')),director=names(form.elements.director.value.split(';'));let source;
  try{source=new URL(form.elements.source.value.trim());if(source.protocol!=='https:')throw Error()}catch{status.textContent='Enter an HTTPS link to the credit source.';return}
  if(!production.length||!director.length){status.textContent='Enter both the production company and director.';return}
  if(!workspace?.id||!session){status.textContent='Sign in to save shared credits.';return}
  button.disabled=true;status.textContent='Saving shared credits…';
  try{
   const id=form.dataset.movieId;
   const {data:current,error:readError}=await db.from('movies').select('source_metadata,updated_at').eq('id',id).eq('workspace_id',workspace.id).single();
   if(readError||!current)throw Error(readError?.message||'Movie could not be loaded.');
   const metadata={...metaOf(current),production_credit_override:{production_companies:production,director,source_url:source.href,verified_at:new Date().toISOString()}};
   let query=db.from('movies').update({source_metadata:metadata,updated_at:new Date().toISOString()}).eq('id',id).eq('workspace_id',workspace.id);
   if(current.updated_at)query=query.eq('updated_at',current.updated_at);
   const {data,error}=await query.select('id,source_metadata').single();
   if(error||!data)throw Error(error?.message||'The movie changed while saving. Try again.');
   const movie=(state.movies||[]).find(m=>m.id===id);if(movie)movie.source_metadata=data.source_metadata;
   window.hqWorkspace?.cleanForm(form);
   status.textContent='Credits saved to the shared movie record. Refresh any existing recording snapshot when needed.';
  }catch(error){status.textContent='Credits not saved: '+error.message}finally{button.disabled=false}
 }
 window.clCredits={get,save};
 if(typeof clSavedMovieDetailModal==='function'){
  const original=clSavedMovieDetailModal;
  clSavedMovieDetailModal=function(...args){const html=original.apply(this,args),movie=(state.movies||[]).find(m=>m.id===selectedMovie);if(!movie||!html)return html;const marker='<section class="cl-movie-detail-section cl-synopsis-section">';return html.replace(marker,editor(movie)+marker)};
 }
})();
