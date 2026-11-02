// Original, movie-specific songwriting. No canned lyric fallback.
(() => {
 const drafts=new Map();let enginePromise;
 const engine=()=>enginePromise||(enginePromise=import('./supabase/functions/grit-lyrics/engine.mjs?v=2'));
 const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const wid=()=>typeof workspace!=='undefined'&&workspace?.id||'local';
 const storageKey=()=> 'cheeseLouise:grit:v2:'+wid();
 let warned=false;
 function read(){try{const x=JSON.parse(localStorage.getItem(storageKey())||'{}');return x&&typeof x==='object'&&!Array.isArray(x)?x:{}}catch{return {}}}
 function persist(){const data=read();data.drafts={...(data.drafts||{})};for(const [key,entry]of drafts)if(key.startsWith(wid()+':'))data.drafts[key]={...entry,busy:false,status:''};try{localStorage.setItem(storageKey(),JSON.stringify(data))}catch{if(!warned){warned=true;alert('HQ could not save this song on this device. Copy your lyrics before closing.')}}}
 function movieFor(kind,id){
  if(kind==='saved')return (state.movies||[]).find(m=>String(m.id)===String(id));
  return [...(state.discoveryResults||[]),...(state.romantiverseSearchResults||[])].find(m=>String(m.tmdb_id)===String(id));
 }
 function meta(m){try{return typeof m.source_metadata==='string'?JSON.parse(m.source_metadata):m.source_metadata||{}}catch{return {}}}
 function keyFor(kind,id){const m=movieFor(kind,id),md=m?meta(m):{};const tmdb=m?.tmdb_id||md.tmdb_id;return wid()+':'+(tmdb?'tmdb:'+tmdb+':'+(m.tmdb_type||md.tmdb_type||'movie'):kind+':'+id)}
 function get(kind,id){const key=keyFor(kind,id);if(!drafts.has(key)){const old=read().drafts?.[key];drafts.set(key,{lyrics:'',details:'',take:0,web:true,...old,busy:false,status:''})}return drafts.get(key)}
 function movieMaterial(kind,id){
  const m=movieFor(kind,id),md=meta(m);let watch={};try{watch=JSON.parse(localStorage.getItem('cheeseLouise:watchAlong:'+wid()+':draft:'+m.id)||'{}')}catch{}
  const selected=kind==='saved'?(m.selectedTraits||[]).map(t=>t.name):[];
  const traits=selected.length?selected:kind==='saved'?(state.traits||[]).filter(t=>(m.selectedTraitIds||[]).includes(t.id)).map(t=>t.name):[];
  const outline=(watch.outlineItems||[]).map(x=>x.type==='trait'?(state.traits||[]).find(t=>t.id===x.traitId)?.name:x.text).filter(Boolean);
  const comments=(m.comments||[]).map(c=>c.body||c.text).filter(Boolean);
  return {title:m.title,year:m.year||String(m.premiere_date||m.release_date||md.release_date||'').slice(0,4),summary:m.summary||md.overview||'',network:m.network,
   tmdb_id:m.tmdb_id||md.tmdb_id,tmdb_type:m.tmdb_type||md.tmdb_type||'movie',characters:(m.cast||md.cast||[]).filter(x=>x&&typeof x==='object').map(x=>({name:x.character,actor:x.name})),
   traits,notes:[m.notes,...comments].filter(Boolean).join('\n'),watch_notes:[watch.notes,...outline].filter(Boolean).join('\n')};
 }
 function history(){return Array.isArray(read().history)?read().history:[]}
 function remember(kind,id,lyrics){if(!lyrics.trim())return;const data=read();data.history=[...(Array.isArray(data.history)?data.history:[]),{movie:movieFor(kind,id)?.title,lyrics:lyrics.slice(0,12000)}].slice(-12);try{localStorage.setItem(storageKey(),JSON.stringify(data))}catch{}}
 function args(kind,id){const entry=get(kind,id);return {workspace_id:wid(),movie:movieMaterial(kind,id),details:entry.details,research:entry.research||null,history:history(),take:entry.take,web_research:entry.web}}
 async function invoke(body){const {data,error}=await db.functions.invoke('grit-lyrics',{body});if(error){let message;try{message=(await error.context?.json())?.error}catch{}throw Error(message||'Songwriting could not connect. Your draft is safe. Use Copy songwriting brief to continue in ChatGPT.')}if(data?.error)throw Error(data.error);return data}
 function links(sources){return (sources||[]).filter(s=>{try{return new URL(s.url).protocol==='https:'}catch{return false}}).map(s=>'<a href="'+e(s.url)+'" target="_blank" rel="noopener noreferrer">'+e(s.title||'Movie source')+' ↗</a>').join(' · ')}
 function panel(kind,id){
  const entry=get(kind,id),key=keyFor(kind,id),call=fn=>fn+'('+JSON.stringify(kind)+','+JSON.stringify(String(id))+')';
  const button=(label,fn,primary=false)=>'<button type="button" class="'+(primary?'primary':'secondary')+'" '+(entry.busy?'disabled':'')+' onclick="'+e(call(fn))+'">'+label+'</button>';
  const ready=entry.ready===false?'<p class="subtle">Automatic songwriting needs its server connection. You can still research the movie and copy a complete songwriting brief into ChatGPT.</p>':'';
  return '<div class="cl-grit-panel" aria-busy="'+!!entry.busy+'"><div class="cl-grit-panel-head"><div><div class="kicker">Grit Whimsy &amp; the Post-Podcast Players</div><h3>Movie songwriting</h3></div><div class="cl-grit-actions">'+button(entry.lyrics?'Write a new take':'Write song','clRegenerateGritLyrics',true)+button('Copy lyrics','clCopyGritLyrics')+'</div></div>'+
   '<p class="subtle">Original story-specific lyrics from the synopsis, your movie comments, and Watch Along notes. Drafts and recent song history save on this device.</p>'+ready+
   '<label>More story details or a new angle<textarea class="cl-grit-details" maxlength="12000" '+(entry.busy?'disabled':'')+' oninput="'+e(call('clGritDetails').replace(/\)$/,',this.value)'))+'" placeholder="Add specific scenes, character names, a longer synopsis, or observations. Viewer comments are opinions, not confirmed plot.">'+e(entry.details)+'</textarea></label>'+
   '<div class="cl-grit-actions">'+button('Research movie','clResearchGrit')+button('Copy songwriting brief','clCopyGritBrief')+'</div>'+
   '<label class="cl-grit-research-option"><input type="checkbox" '+(entry.web?'checked ':'')+(entry.busy?'disabled ':'')+' onchange="'+e(call('clGritWeb').replace(/\)$/,',this.checked)'))+'"> Search public synopses and reviews before writing. Spoilers may appear.</label>'+
   '<p role="status" aria-live="polite">'+e(entry.status||entry.error||'')+'</p>'+
   (entry.songTitle?'<h4>'+e(entry.songTitle)+'</h4><p class="subtle">'+e(entry.angle||'')+'</p>':'')+
   '<textarea aria-label="Editable Grit song lyrics" class="cl-grit-lyrics" '+(entry.busy?'readonly ':'')+' data-grit-key="'+e(key)+'" oninput="'+e(call('clUpdateGritLyrics').replace(/\)$/,',this.value)'))+'" placeholder="Your original movie song will appear here.">'+e(entry.lyrics)+'</textarea>'+
   (entry.storyDetails?.length?'<details><summary>Story details used</summary><ul>'+entry.storyDetails.map(x=>'<li>'+e(x)+'</li>').join('')+'</ul></details>':'')+
   (entry.research?'<details class="cl-grit-research"><summary>Movie research and sources</summary><p>'+e(entry.research.overview||'')+'</p><p style="white-space:pre-wrap">'+e(entry.research.web_summary||'')+'</p><p class="subtle">Public reviews are viewer opinions. Lyrics should use original wording.</p><div>'+links(entry.research.sources)+'</div><p class="subtle">'+e((entry.research.warnings||[]).join(' '))+'</p><p class="subtle">Movie data: TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.</p></details>':'')+'</div>';
 }
 function refresh(kind,id){const host=document.getElementById('clGritLyricsPanel');if(host&&host.dataset.gritKey===keyFor(kind,id))host.innerHTML=panel(kind,id)}
 function mount(kind,id){const host=document.getElementById('clGritLyricsPanel');if(host){host.dataset.gritKey=keyFor(kind,id);host.innerHTML=panel(kind,id)}}
 window.clGritDetails=(kind,id,text)=>{get(kind,id).details=String(text).slice(0,12000);persist()};
 window.clGritWeb=(kind,id,value)=>{const entry=get(kind,id);entry.web=!!value;entry.research=null;persist()};
 window.clUpdateGritLyrics=(kind,id,value)=>{const entry=get(kind,id);entry.lyrics=String(value).slice(0,12000);entry.edited=true;persist()};
 window.clOpenGritLyrics=async(kind,id)=>{
  if(!movieFor(kind,id))return;mount(kind,id);document.querySelector('.cl-grit-panel')?.scrollIntoView({behavior:'smooth',block:'nearest'});
  const entry=get(kind,id);if(entry.lyrics||entry.busy)return;
  try{const r=await fetch(SUPABASE_URL+'/functions/v1/grit-lyrics');if(r.ok){const health=await r.json();entry.ready=health.ready;refresh(kind,id);if(!health.ready)return}}catch{}
  return window.clRegenerateGritLyrics(kind,id);
 };
 window.clResearchGrit=async(kind,id)=>{
  const entry=get(kind,id);if(entry.busy)return;entry.busy=true;entry.error='';entry.status='Researching this movie…';refresh(kind,id);
  try{const data=await invoke({...args(kind,id),action:'research'});entry.research=data.research;entry.status='Research ready. Review the sources, then write a song or copy the brief.'}
  catch(error){entry.error=error.message;entry.status=''}finally{entry.busy=false;persist();refresh(kind,id)}
 };
 window.clRegenerateGritLyrics=async(kind,id)=>{
  const entry=get(kind,id);if(entry.busy)return;if(entry.edited&&entry.lyrics&&!confirm('Write a new take? Your current edited lyrics will stay in recent song history.'))return;
  if(entry.lyrics)remember(kind,id,entry.lyrics);
  entry.busy=true;entry.error='';entry.status='Writing a new movie-specific song…';entry.take++;refresh(kind,id);
  try{const data=await invoke({...args(kind,id),action:'generate'});entry.lyrics=data.song.lyrics;entry.songTitle=data.song.title;entry.angle=data.song.angle;entry.storyDetails=data.song.story_details;entry.research=data.research;entry.edited=false;entry.ready=true;entry.status='New take ready. Edit the lyrics or copy them.';remember(kind,id,entry.lyrics)}
  catch(error){entry.error=error.message;entry.status=''}finally{entry.busy=false;persist();refresh(kind,id)}
 };
 async function copy(text){try{await navigator.clipboard.writeText(text)}catch{const temp=document.createElement('textarea');temp.value=text;temp.style.position='fixed';document.body.appendChild(temp);temp.select();const ok=document.execCommand('copy');temp.remove();if(!ok)throw Error('Could not copy. Select and copy the text manually.')}}
 window.clCopyGritLyrics=async(kind,id)=>{const entry=get(kind,id);if(!entry.lyrics)return;try{await copy(entry.lyrics);entry.status='Lyrics copied.'}catch(error){entry.error=error.message;entry.status=''}refresh(kind,id)};
 window.clCopyGritBrief=async(kind,id)=>{const entry=get(kind,id);try{const module=await engine();const brief=module.buildBrief(args(kind,id));await copy(brief.prompt+'\n\nResearch the exact movie on the web first if the supplied details are insufficient. Cite sources separately after the lyrics. Return a readable song, not JSON.');entry.status='Songwriting brief copied. Paste into ChatGPT to write and research this movie.'}catch(error){entry.error=error.message;entry.status=''}refresh(kind,id)};
  function injectGrit(html,kind,id){
    if(!html || html.includes('clOpenGritLyrics(')) return html;
    const button='<button class="secondary cl-grit-button" type="button" onclick="clOpenGritLyrics(\''+e(kind)+'\',\''+e(id)+'\')">🎸 Grit Lyrics</button>';
    html=html.replace('<div class="kicker">Full synopsis</div>','<div class="cl-synopsis-head"><div class="kicker">Full synopsis</div>'+button+'</div>');
    html=html.replace('</p>\n    </section>','</p><div id="clGritLyricsPanel" data-grit-key="'+e(keyFor(kind,id))+'">'+(drafts.has(keyFor(kind,id))?panel(kind,id):'')+'</div>\n    </section>');
    return html;
  }

  if(typeof clSavedMovieDetailModal==='function'){
    const originalSaved=clSavedMovieDetailModal;
    clSavedMovieDetailModal=function(){
      const id=selectedMovie;
      return injectGrit(originalSaved(), 'saved', id);
    };
  }

  if(typeof clDiscoveryMovieDetailModal==='function'){
    const originalDiscovery=clDiscoveryMovieDetailModal;
    clDiscoveryMovieDetailModal=function(){
      const id=clDiscoveryMovieDetailId;
      return injectGrit(originalDiscovery(), 'discovery', id);
    };
  }

  (function injectGritStyles(){
    if(document.getElementById('clGritLyricsStyles')) return;
    const style=document.createElement('style');
    style.id='clGritLyricsStyles';
    style.textContent=`
      .cl-synopsis-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .cl-grit-button{white-space:nowrap}
      .cl-grit-panel{margin-top:14px;padding:14px;border:1px solid rgba(244,200,75,.35);border-radius:14px;background:rgba(244,200,75,.05)}
      .cl-grit-panel-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
      .cl-grit-panel-head h3{margin:4px 0 0}
      .cl-grit-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
      .cl-grit-details{display:block;width:100%;min-height:100px;margin:8px 0;padding:10px;background:var(--panel2,#20232c);color:inherit;border:1px solid #666;border-radius:8px;font:inherit}.cl-grit-research-option{display:flex;gap:8px;align-items:center;margin-top:12px}.cl-grit-research-option input{width:auto}.cl-grit-research a{overflow-wrap:anywhere}.cl-grit-actions button{min-height:44px}.cl-grit-lyrics{width:100%;min-height:330px;margin-top:12px;resize:vertical;line-height:1.5;font:inherit;border-radius:12px;padding:12px 13px;background:var(--panel2,#20232c);color:inherit;border:1px solid rgba(255,255,255,.12);outline:none}
      .cl-grit-lyrics:focus{border-color:rgba(244,200,75,.72);box-shadow:0 0 0 3px rgba(244,200,75,.12)}
      @media(max-width:680px){
        .cl-synopsis-head,.cl-grit-panel-head{align-items:stretch;display:grid}
        .cl-grit-actions{justify-content:flex-start}
        .cl-grit-lyrics{min-height:360px}
      }
    `;
    document.head.appendChild(style);
  })();
})();

