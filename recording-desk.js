// Personal reading desk. Audio recording and markers live on the RØDECaster.
(() => {
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const args=(method,...values)=>esc('clRecordingDesk.'+method+'('+values.map(v=>JSON.stringify(v)).join(',')+')');
 const memory=new Map(),draftRecovery=new Map();let context=null,warning='';
 const wid=()=>context?.workspace||workspace?.id||'local';
 const hostKey=()=>`cheeseLouise:recordHost:${wid()}`;
 function host(){let value;try{value=localStorage.getItem(hostKey())}catch{}if(['nick','jenny'].includes(value))return value;
  const name=typeof profile!=='undefined'?profile?.display_name||'':'';return /jenny/i.test(name)?'jenny':'nick';}
 const label=h=>h==='jenny'?'Jenny':'Nick';
 const key=()=>`cheeseLouise:recordDesk:v1:${wid()}:${context.movie.id}:${host()}`;
 function read(){if(memory.has(key()))return memory.get(key());let data={};try{data=JSON.parse(localStorage.getItem(key())||'{}')}catch{}
  data={done:{},size:20,...data};memory.set(key(),data);return data;}
 function write(data){memory.set(key(),data);try{localStorage.setItem(key(),JSON.stringify(data));return true}catch{warning='This device could not save your progress. Keep this page open and copy your notes before closing.';return false;}}
 function watchDraft(){return draftRecovery.get(context.movie.id)||window.clWatchDrafts?.get(context.movie.id)||{movieId:context.movie.id};}
 function saveDraft(draft){try{window.clWatchDrafts.save(draft);draftRecovery.delete(context.movie.id);warning='';return true}catch{draftRecovery.set(context.movie.id,draft);warning='Your note is kept in this open page, but could not be saved. Copy it before closing.';return false;}}
 function personal(){return (watchDraft().hostNotes?.[host()]||[]).filter(n=>n&&typeof n.text==='string');}
 function removeHostNote(draft,id){
  const notes=draft.hostNotes?.[host()]||[];
  if(!notes.some(note=>note.id===id))return false;
  draft.hostNotes[host()]=notes.filter(note=>note.id!==id);
  draft.deletedHostNoteIds=[...new Set([...(draft.deletedHostNoteIds||[]),id])];
  return true;
 }
 const notebookId=h=>`recording-notebook-${h}`;
 function notebookText(draft,h){
  const notes=draft?.hostNotes?.[h]||[];
  const notebook=notes.find(note=>note.id===notebookId(h));
  if(notebook)return notebook.text;
  const previous=notes.map(note=>String(note.text||'').trim()).filter(Boolean);
  return [...new Set(previous)].join('\n\n');
 }
 function updateNotebook(draft,h,text){
  draft.hostNotes ||= {};
  const notes=draft.hostNotes[h] ||= [];
  const notebook=notes.find(note=>note.id===notebookId(h));
  if(notebook)notebook.text=text;
  else if(text)notes.push({id:notebookId(h),text});
 }
 function sceneNotes(){return window.clAutomaticTimeline?.recordingNotes({...context,redraw:context.redraw},host())||[];}
 function elapsed(){const timer=read().timer||{};return Math.max(0,(timer.elapsedMs||0)+(timer.runningSince?Date.now()-timer.runningSince:0));}
 const clock=value=>{const s=Math.floor(value/1000);return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(n=>String(n).padStart(2,'0')).join(':');};
 function saveStatus(){const node=document.getElementById('cldesk-status');if(!node)return;const type=window.clProductionSync?.status('watch_along',context.movie.id),timeline=window.clProductionSync?.status('timeline',context.movie.id);
  node.textContent=warning||([type,timeline].includes('conflict')?'A shared edit needs review. Keep your copy open; retry from Prep.':[type,timeline].includes('retry')?'Saved on this device; shared save needs retry.':[type,timeline].includes('saving')?'Saving notes…':'Notes ready · edits save automatically');}
 function fitNotes(){for(const field of document.querySelectorAll('.cldesk-note textarea,.cldesk-shared textarea')){field.style.height='auto';field.style.height=(field.scrollHeight+4)+'px';}}
 function noteCard(note,index,kind){const id=kind+':'+note.id,done=Boolean(read().done[id]);return `<li class="cldesk-note ${done?'is-done':''}" data-note-key="${esc(id)}"><div class="cldesk-note-top"><label><input type="checkbox" aria-label="Done: ${esc(note.title||'Note '+(index+1))}" ${done?'checked':''} onchange="${args('done',id).replace(/\)$/,',this.checked)')}"><span>${esc(note.title||'Note '+(index+1))}</span></label><button type="button" aria-label="Delete ${esc(note.title||'note '+(index+1))}" onclick="${args('remove',kind,note.id)}">Delete</button></div><textarea id="cldesk-note-${esc(note.id)}" aria-label="${esc(label(host())+' note '+(index+1))}" rows="${Math.max(2,Math.min(12,Math.ceil(note.text.length/70)))}" oninput="${args('edit',kind,note.id).replace(/\)$/,',this.value)')}">${esc(note.text)}</textarea></li>`;}
 function checklist(text,kind){
  const occurrences=new Map(),done=read().done;
  return text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{
   const count=(occurrences.get(line)||0)+1;
   occurrences.set(line,count);
   const id=JSON.stringify([kind,line,count]);
   return checkableNote(id,line,done);
  }).join('');
 }
 function checkableNote(id,line,done=read().done){
  return `<li class="cldesk-note ${done[id]?'is-done':''}"><div class="cldesk-note-top"><label><input type="checkbox" ${done[id]?'checked':''} onchange="${args('done',id).replace(/\)$/,',this.checked,this)')}"><span style="white-space:pre-wrap;overflow-wrap:anywhere;font-size:var(--desk-note-size)">${esc(line)}</span></label></div></li>`;
 }
 function notebook(kind,text,title,edit){
  return `<section class="cldesk-shared"><ol class="cldesk-note-list" aria-label="${title}">${checklist(text,kind)}</ol><details data-clp-detail="edit-${kind}" ${text.trim()?'':'open'} ontoggle="if(this.open)clRecordingDesk.fitNotes()"><summary>Edit ${title.toLowerCase()}</summary><textarea aria-label="${title}" rows="4" placeholder="One note per line…" oninput="clRecordingDesk.${edit}(this.value);this.closest('section').querySelector('ol').innerHTML=clRecordingDesk.checklist(this.value,'${kind}')">${esc(text)}</textarea></details></section>`;
 }
 function notesHtml(){
  const h=host(),draft=watchDraft(),previous=[
   ...sceneNotes().map(note=>({...note,kind:'scene'})),
   ...personal().filter(note=>note.id!==notebookId(h)).map(note=>({...note,kind:'personal'})),
  ];
  const shared=String(draft.notes||context.notes||'').trim();
  const outline=(draft.outlineItems||[]).filter(n=>n.type==='note'&&String(n.text||'').trim());
  return `<section class="cldesk-notes" aria-labelledby="cldesk-notes-title" style="--desk-note-size:${Number(read().size)||20}px">
  <header class="cldesk-section-head"><div><h2 id="cldesk-notes-title">${label(h)}’s recording notes</h2></div><div class="cldesk-note-tools"><button type="button" aria-label="Smaller notes" onclick="clRecordingDesk.size(-2)">A−</button><button type="button" aria-label="Larger notes" onclick="clRecordingDesk.size(2)">A+</button></div></header>
  <div class="cldesk-note-scroll">${notebook('host-notebook',notebookText(draft,h),'Recording notes','editNotebook')}
  ${previous.length?`<details data-clp-detail="previous-recording-notes" ontoggle="if(this.open)clRecordingDesk.fitNotes()"><summary>Previous notes (${previous.length})</summary><ol class="cldesk-note-list">${previous.map((note,index)=>noteCard(note,index,note.kind)).join('')}</ol></details>`:''}
  ${shared||outline.length?`<section class="cldesk-shared"><h3>Shared Watch Along notes</h3>${notebook('shared-notebook',shared,'Watch Along notes','editShared')}${outline.length?'<details><summary>Shared talk order</summary><ol class="cldesk-note-list">'+outline.map((n,i)=>checkableNote(JSON.stringify(['talk-order',n.id??i]),n.text)).join('')+'</ol></details>':''}</section>`:''}</div>
  <p id="cldesk-status" role="status" class="cldesk-status">${esc(warning||'Notes ready · edits save automatically')}</p></section>`;}
 function traitsHtml(){const ids=window.clMovieTraits?.orderedIds(context.movie,watchDraft())||context.movie.selectedTraitIds||[],traits=ids.map(id=>(context.traits||[]).find(t=>t.id===id)).filter(Boolean),total=traits.reduce((sum,t)=>sum+Number(t.points||0),0);
  return `<section class="cldesk-traits" aria-labelledby="cldesk-grating-title"><header class="cldesk-section-head"><h2 id="cldesk-grating-title">Cheese Grating</h2><strong class="cldesk-grating">${total}<small>points</small></strong></header><p class="cldesk-caption">${traits.length} checked traits · separate from Bingo</p><ul class="cldesk-trait-list">${traits.map(t=>'<li><span aria-hidden="true">✓</span><span>'+esc(t.name)+'</span><strong>+'+Number(t.points||0)+'</strong></li>').join('')||'<li>No traits checked yet. Add them in Watch Along.</li>'}</ul></section>`;
 }
 function html(ctx){context=ctx;globalThis.requestAnimationFrame?.(fitNotes);const timer=read().timer||{},h=host();return `<div class="cldesk"><header class="cldesk-bar"><div class="cldesk-brand"><span class="cldesk-mic" aria-hidden="true">◉</span><div><span class="cldesk-kicker">CHEESE LOUISE · AT THE MIC</span><label class="cldesk-movie"><span class="sr-only">Recording movie</span><select aria-label="Recording movie" onchange="clProduction.movie(this.value)">${ctx.movies.map(m=>'<option value="'+esc(m.id)+'" '+(m.id===ctx.movie.id?'selected':'')+'>'+esc(m.title)+'</option>').join('')}</select></label></div></div><div class="cldesk-host" role="group" aria-label="Your notes"><button type="button" aria-pressed="${h==='nick'}" onclick="clRecordingDesk.switchHost('nick')">Nick</button><button type="button" aria-pressed="${h==='jenny'}" onclick="clRecordingDesk.switchHost('jenny')">Jenny</button></div><div class="cldesk-timer" aria-label="Elapsed timer"><span class="cldesk-timer-dot ${timer.runningSince?'is-running':''}" aria-hidden="true"></span><time id="cldesk-time">${clock(elapsed())}</time><button type="button" onclick="clRecordingDesk.timer('${timer.runningSince?'pause':'start'}')">${timer.runningSince?'Pause':'Start'}</button><button type="button" aria-label="Reset elapsed timer" onclick="clRecordingDesk.timer('reset')">Reset</button></div><div class="cldesk-view-tools"><button type="button" onclick="clProduction.view('prepare')">Prep</button><button type="button" id="cldesk-fullscreen" onclick="clRecordingDesk.fullscreen()">Full screen</button></div></header><div class="cldesk-layout">${notesHtml()}<aside class="cldesk-reference" aria-label="Cheese Grating, Bingo, and Cheese Traits">${traitsHtml()}<section class="cldesk-bingo">${window.clRecordingBingo?window.clRecordingBingo.html(ctx.movie,{host:h}):'<h2>Your Bingo card</h2><p>Loading card…</p>'}</section></aside></div></div>`;}
 window.clRecordingDesk={html,host,
  fitNotes,checklist,
  watchPanel(movie){
   const h=host(),draft=window.clWatchDrafts?.get(movie.id);
   return `<section class="card card-pad"><div class="watch-panel-head"><h2>${label(h)}’s recording notes</h2><label>Host<select aria-label="Watch Along notes host" onchange="clRecordingDesk.watchHost(this.value)"><option value="nick" ${h==='nick'?'selected':''}>Nick</option><option value="jenny" ${h==='jenny'?'selected':''}>Jenny</option></select></label></div><textarea class="watch-textarea" aria-label="${label(h)}’s recording notes" oninput="${args('watchEditNotebook',movie.id).replace(/\)$/,',this.value)')}">${esc(notebookText(draft,h))}</textarea></section>`;
  },
  watchHost(value){if(!['nick','jenny'].includes(value))return;try{localStorage.setItem(hostKey(),value);render();}catch{alert('Host selection could not be saved on this device.');}},
  watchEditNotebook(movieId,text){
   const draft=window.clWatchDrafts.get(movieId);
   if(!draft)return;
   updateNotebook(draft,host(),text);
   try{window.clWatchDrafts.save(draft);}catch{alert('Your edit could not be saved. Copy the text before closing this page.');}
  },
  switchHost(value){if(!['nick','jenny'].includes(value))return;try{localStorage.setItem(hostKey(),value)}catch{warning='Host selection could not be saved on this device.';return}context.redraw();},
  editNotebook(text){
   const draft=watchDraft();
   updateNotebook(draft,host(),text);
   saveDraft(draft);
   saveStatus();
   globalThis.requestAnimationFrame?.(fitNotes);
  },
  remove(kind,id){
   if(!confirm('Delete this note?'))return;
   if(kind==='scene'){
    if(!window.clAutomaticTimeline?.recordingEdit(context,id,host(),'')){
     warning='This scene note could not be deleted.';saveStatus();return;
    }
   }else{
    const draft=watchDraft();
    if(!removeHostNote(draft,id))return;
    if(!saveDraft(draft)){context.redraw();return;}
   }
   const data=read();
   delete data.done[kind+':'+id];
   write(data);
   context.redraw();
  },
  edit(kind,id,value){if(kind==='scene'){if(!window.clAutomaticTimeline?.recordingEdit(context,id,host(),value))warning='This scene note could not be saved. Keep this page open and copy the text.';}else{const draft=watchDraft(),note=draft.hostNotes?.[host()]?.find(n=>n.id===id);if(note){note.text=value;saveDraft(draft);}}saveStatus();globalThis.requestAnimationFrame?.(fitNotes);},
  editShared(value){const draft=watchDraft();draft.notes=value;saveDraft(draft);saveStatus();globalThis.requestAnimationFrame?.(fitNotes);},
  done(id,value,checkbox){const d=read();if(value)d.done[id]=true;else delete d.done[id];write(d);if(checkbox){checkbox.closest('li').classList.toggle('is-done',value);saveStatus();}else context.redraw();},
  size(delta){const d=read();d.size=Math.max(16,Math.min(30,(Number(d.size)||20)+delta));write(d);context.redraw();},
  timer(action){const d=read(),timer=d.timer||{elapsedMs:0,runningSince:null};if(action==='reset'){if(!confirm('Reset your elapsed timer? Notes, checkboxes and Bingo will be kept.'))return;timer.elapsedMs=0;timer.runningSince=null;}else if(action==='pause'){timer.elapsedMs=elapsed();timer.runningSince=null;}else if(!timer.runningSince)timer.runningSince=Date.now();d.timer=timer;write(d);context.redraw();},
  async fullscreen(){const root=document.getElementById('clp-recording-root');try{if(document.fullscreenElement){await document.exitFullscreen();return}if(!document.documentElement.classList.contains('cldesk-focus')&&root?.requestFullscreen){await root.requestFullscreen();return}}catch{}document.documentElement.classList.toggle('cldesk-focus');const b=document.getElementById('cldesk-fullscreen');if(b)b.textContent=document.documentElement.classList.contains('cldesk-focus')?'Exit full screen':'Full screen';},
 };
 document.addEventListener?.('keydown',event=>{if(event.key==='Escape')document.documentElement.classList.remove('cldesk-focus');});
 setInterval(()=>{const el=document.getElementById('cldesk-time');if(el&&context){el.textContent=clock(elapsed());saveStatus();}},500);
})();
