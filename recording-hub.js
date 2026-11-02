// Cheese Louise HQ — Recording & Production Hub (local-first)
(() => {
  const prefix='cheeseLouise:production:v1:';
  const legacySegments=[
    {name:'Opening & banter',target:3,prompt:'Introductions, catch-up, natural opening.'},
    {name:'Cheesy Concoctions',target:5,prompt:'Make the drink, taste it, react, and move into the movie.'},
    {name:'Movie & tropes',target:22,prompt:'Brief premise, then discuss your chosen tropes and observations.'},
    {name:'Horror-fied',target:5,prompt:'Set up the mini-game and react.'},
    {name:'Cheese Grating & Bingo results',target:7,prompt:'Give the Cheese Grating, play the Bingo sting, and announce the winners.'},
    {name:'Closing',target:3,prompt:'Final thoughts and sign-off.'}
  ];
  // Approved show order applies only to new sessions. Historical laps keep their
  // original six-section plan, including optional Horror-fied, without migration.
  const segments=[
    {id:'cold-open',name:'Cold open',targetSeconds:20,prompt:'A short, unscripted Romantiverse question or joke before the theme.'},
    {id:'theme',name:'Theme music',targetSeconds:30,prompt:'Play the Cheese Louise theme.'},
    {id:'welcome',name:'Welcome & banter',targetSeconds:180,prompt:'Welcome listeners and catch up naturally.'},
    {id:'cocktail',name:'Cheesy Concoctions',targetSeconds:300,prompt:'Introduce and taste the movie-matched cocktail.'},
    {id:'discussion',name:'Movie review & discussion',targetSeconds:1800,prompt:'Follow movie chronology and natural conversation; mention tropes when relevant.'},
    {id:'bingo',name:'Bingo & Cheese Grating',targetSeconds:300,prompt:'Play the Bingo sting, reveal confirmed Cheese Grating, marked squares, winning lines and winners.'},
    {id:'closing',name:'Closing',targetSeconds:60,prompt:'Final thoughts and sign-off.'}
  ];
  const sessionSegments=s=>s?.segmentPlan==='approved-v2'?segments:legacySegments;
  let view='record',tick=null;
  const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clock=ms=>{const s=Math.floor(Math.max(0,ms)/1000);return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map((n,i)=>i===0?String(n).padStart(2,'0'):String(n).padStart(2,'0')).join(':');};
  const workspaceId=()=>typeof workspace!=='undefined'&&workspace?.id||'local';
  const movieList=()=>typeof state!=='undefined'?(state.movies||[]):[];
  const key=()=>prefix+workspaceId();
  const memory=new Map();
  let storageWarning=false;
  // Detect edits made by another same-origin HQ tab before overwriting them.
  // This is a read-only safety brake, not an atomic lock or cross-device sync.
  let lastKnownRaw=null,externalChange=false,conflictAt=0,conflictNotified=false;
  try{lastKnownRaw=localStorage.getItem(key())}catch{}
  function stale(){
    if(!externalChange){try{if(localStorage.getItem(key())!==lastKnownRaw){externalChange=true;conflictAt=Date.now();}}catch{}}
    return externalChange;
  }
  function guardExternal(){
    if(!stale())return false;
    if(!conflictNotified){conflictNotified=true;alert('Another HQ tab changed this recording workspace. This tab is now read-only. Copy any unsaved marker note, then reload to review the latest session.');}
    return true;
  }
  const read=()=>{if(memory.has(key()))return memory.get(key());try{const data=JSON.parse(localStorage.getItem(key())||'{}');return data&&typeof data==='object'&&!Array.isArray(data)?data:{}}catch{return {}}};
  const write=data=>{if(guardExternal())return false;memory.set(key(),data);try{const raw=JSON.stringify(data);localStorage.setItem(key(),raw);lastKnownRaw=raw;memory.delete(key());storageWarning=false;return true}catch{if(!storageWarning){storageWarning=true;alert('HQ could not save recording data on this device. Your session is still open in memory. Export the editing sheet before closing or reloading.')}return false}};
  const watchMovieId=()=>{try{return localStorage.getItem('cheeseLouise:watchAlong:'+workspaceId()+':movie')}catch{return null}};
  const currentMovie=()=>movieList().find(m=>m.id===read().movieId)||movieList().find(m=>m.id===watchMovieId())||movieList()[0]||null;
  // An interrupted page must not invent recording time while the browser was closed.
  // Reconciliation is explicit: the RØDECaster, not this timer, is the audio authority.
  const loaded=read(),loadedSession=loaded.sessions?.[loaded.movieId]||loaded.session;
  let pendingRecovery=loadedSession?.runningSince?{
    movieId:loadedSession.movieId,runningSince:loadedSession.runningSince,
    stopAt:Math.max(loadedSession.runningSince,Math.min(Date.now(),
      Number.isFinite(Number(loadedSession.checkpointAt))&&Number(loadedSession.checkpointAt)>=loadedSession.runningSince
        ?Number(loadedSession.checkpointAt):loadedSession.runningSince))
  }:null;
  const isPending=s=>Boolean(pendingRecovery&&s?.movieId===pendingRecovery.movieId&&s.runningSince===pendingRecovery.runningSince);
  const sessionNow=s=>Math.max(0,(s.elapsedMs||0)+(s.runningSince?
    (isPending(s)?pendingRecovery.stopAt:stale()?conflictAt:Date.now())-s.runningSince:0));
  const startOfSegment=s=>s.laps?.reduce((a,l)=>a+(l.durationMs||0),0)||0;
  function rundown(movie){
    const wk='cheeseLouise:watchAlong:'+workspaceId()+':draft:'+movie.id;
    let draft={},hasDraft=false;try{const raw=localStorage.getItem(wk),parsed=JSON.parse(raw||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)){draft=parsed;hasDraft=Boolean(raw)}}catch{}
    const traits=(typeof state!=='undefined'?state.traits:[])||[];
    const byId=new Map(traits.map(t=>[t.id,t]));
    const selectedIds=window.clMovieTraits?.orderedIds(movie,draft)||(draft.traitIds||movie.selectedTraitIds||[]);
    const selected=selectedIds.map(id=>byId.get(id)).filter(Boolean);
    const confirmed=(movie.selectedTraitIds||[]).map(id=>byId.get(id)).filter(Boolean);
    const outlineItems=(Array.isArray(draft.outlineItems)?draft.outlineItems:[]).flatMap(item=>{
      if(!item)return [];
      if(window.clMovieTraits&&item.type==='trait'&&!selectedIds.includes(item.traitId))return [];
      const trait=item.type==='trait'?byId.get(item.traitId):null;
      const text=trait?.name||String(item.text||'');
      return text.trim()?[{type:trait?'trait':'note',text,category:trait?.category||''}]:[];
    });
    if(!outlineItems.length&&String(draft.outline||'').trim())outlineItems.push({type:'note',text:String(draft.outline),category:''});
    if(window.clMovieTraits&&outlineItems.length){const named=new Set(outlineItems.filter(i=>i.type==='trait').map(i=>i.text));for(const trait of selected)if(!named.has(trait.name))outlineItems.push({type:'trait',text:trait.name,category:trait.category||''});}
    return {hasDraft,talkingPoints:selected.map(t=>t.name),outlineItems,notes:String(draft.notes||''),grating:confirmed.reduce((n,t)=>n+Number(t.points||0),0),confirmedCount:confirmed.length};
  }
  const clone=value=>JSON.parse(JSON.stringify(value));
  const hasRecordedWork=s=>Boolean(s&&((s.elapsedMs||0)>0||s.runningSince||(s.laps||[]).length||(s.markers||[]).length||s.finished));
  function archiveSession(data,session){
    if(!hasRecordedWork(session))return false;
    const snapshot=clone(session);
    if(snapshot.runningSince){snapshot.elapsedMs=sessionNow(session);snapshot.runningSince=null;}
    data.sessionHistory=data.sessionHistory||{};
    const history=data.sessionHistory[session.movieId]=data.sessionHistory[session.movieId]||[];
    history.unshift({archiveId:String(Date.now())+'-'+history.length+'-'+Math.random().toString(36).slice(2,8),archivedAt:Date.now(),session:snapshot});
    return true;
  }
  function commitSessionChange(data,original){
    if(guardExternal())return false;
    if(write(data))return true;
    memory.set(key(),original);
    alert('Could not save the session change on this device. Your previous recording remains active in memory. Free storage and try again.');
    return false;
  }
  const save=s=>{const d=read();d.sessions=d.sessions||{};if(d.session?.movieId&&!d.sessions[d.session.movieId])d.sessions[d.session.movieId]=d.session;d.sessions[s.movieId]=s;d.session=s;return write(d);};
  function makeSession(movie){return {movieId:movie.id,title:movie.title||'Untitled',snapshot:rundown(movie),segmentPlan:'approved-v2',segment:0,laps:[],markers:[],elapsedMs:0,runningSince:null,finished:false,createdAt:Date.now()};}
  function getSession(){const d=read(),m=currentMovie();if(!m)return null;return d.sessions?.[m.id]||(d.session?.movieId===m.id?d.session:makeSession(m));}
  function update(fn){if(guardExternal())return false;const s=getSession();if(!s)return false;if(isPending(s)){alert('Resolve the interrupted HQ timer against the RØDECaster recording before editing this session.');return false;}fn(s);const saved=save(s);draw();return saved;}
  const button=(label,handler,extra='')=>'<button type="button" '+extra+(stale()&&/^(start|pause|previous|next|mark|deleteMarker|refreshSnapshot|reset|restoreSession|timelineSave|timelineMove|timelineImport|recoverPause|recoverContinue)/.test(handler)?' disabled':'')+' onclick="window.clProduction.'+handler+'">'+label+'</button>';
  function shellHtml(){
    const d=read(),m=currentMovie();
    return '<main class="clp"><header class="clp-header"><div><span class="clp-eyebrow">CHEESE LOUISE HQ</span><h1>Recording & Production</h1><p>Your notes and talk order, ready for the mic.</p></div></header>'
      +(stale()?'<div class="clp-recovery" role="alert"><strong>Recording workspace changed in another HQ tab.</strong><p>This tab is read-only to protect your notes, timers and editing markers. Copy any unsaved marker note before reloading HQ to review the latest saved session. Do not assume this is cross-device backup.</p></div>':'')
      +'<label class="clp-select">Movie <select onchange="clProduction.movie(this.value)">'+movieList().map(x=>'<option value="'+escapeHtml(x.id)+'" '+(m?.id===x.id?'selected':'')+'>'+escapeHtml(x.title||'Untitled')+'</option>').join('')+'</select></label>'
      +'<div class="clp-tabs">'+[['record','Record'],['edit','Edit'],['socials','Socials']].map(([id,name])=>'<button class="'+(view===id?'selected':'')+'" onclick="clProduction.view(\''+id+'\')">'+name+'</button>').join('')+'</div>'
      +'<section id="clp-body">'+(m?bodyHtml(): '<p>Add a movie in HQ to begin.</p>')+'</section></main>';
  }
  function bodyHtml(){return view==='record'?recordHtml():view==='edit'?editHtml():socialHtml();}
  let expandedSegment=null, pendingMarker=null;
  function movieCredits(movie){
    let meta=movie?.source_metadata||{};
    if(typeof meta==='string'){try{meta=JSON.parse(meta)}catch{meta={}}}
    const names=v=>(Array.isArray(v)?v:[v]).filter(Boolean).map(x=>typeof x==='string'?x:String(x?.name||'')).filter(Boolean).join(', ')||'Not recorded';
    const credits=window.clCredits?.get(movie);
    return '<h4>Movie credits</h4>'+(credits?.missing.length?'<p role="status"><strong>Needs research: '+escapeHtml(credits.missing.join(' and '))+'. Update this movie’s Production credits in Movie Radar.</strong></p>':'')+[
      ['Production',credits?.production.length?credits.production:movie?.production_companies||movie?.production_company||meta.production_companies||meta.production_company],
      ['Director',credits?.director.length?credits.director:movie?.director||meta.director],
      ['Writer',movie?.writers||movie?.writer||meta.writers||meta.writer],
      ['Lead actors',movie?.stars||movie?.cast||meta.stars||meta.cast]
    ].map(([k,v])=>'<p><strong>'+k+':</strong> '+escapeHtml(names(v))+'</p>').join('');
  }
  function rundownSection(n,s){
    const part=sessionSegments(s)[n]||{};
    const id=part.id||({
      'Opening & banter':'welcome','Cheesy Concoctions':'cocktail',
      'Movie & tropes':'discussion','Horror-fied':'horror',
      'Cheese Grating & Bingo results':'bingo','Closing':'closing'
    })[part.name];
    if(id==='cold-open')return '<p>Lead with the roughly 20-second Romantiverse question or joke, then roll the theme. No scripted banter required.</p>';
    if(id==='theme')return '<p>Play the Cheese Louise theme music, then welcome listeners.</p>';
    if(id==='welcome')return '<p>Welcome listeners, introduce yourselves, and settle into natural conversation.</p>';
    if(id==='cocktail')return '<p>Introduce, taste and react to the Cheesy Concoction.</p>';
    if(id==='discussion')return '<p>Give a brief premise, follow the movie timeline and Watch Along notes, and mention tropes naturally.</p>';
    if(id==='horror')return '<p>Optional Horror-fied mini-game and reactions (legacy recording plan).</p>';
    if(id==='bingo')return '<p>Allow about five minutes: reveal confirmed Cheese Grating, play the Bingo theme sting, then distinguish marked squares from completed winning lines and announce winners. Do not actively play on mic.</p>';
    return '<p>Final thoughts and sign-off.</p>';
  }
  function noteBlocks(value){
    const paragraphs=String(value||'').replace(/\r\n?/g,'\n').split(/\n+/).map(text=>text.trim()).filter(Boolean);
    return paragraphs.flatMap(paragraph=>{
      if(paragraph.length<=320||typeof Intl.Segmenter!=='function')return [paragraph];
      const sentences=[...new Intl.Segmenter(undefined,{granularity:'sentence'}).segment(paragraph)].map(item=>item.segment);
      const blocks=[];let current='';
      for(const sentence of sentences){if(current&&current.length+sentence.length>320){blocks.push(current.trim());current='';}current+=sentence;}
      if(current.trim())blocks.push(current.trim());return blocks;
    });
  }
  function cueCard(text,index,type,label){
    return '<li class="clp-cue clp-cue-'+type+'"><span class="clp-cue-number" aria-hidden="true">'+(index+1)+'</span><div><span class="clp-cue-label">'+escapeHtml(label)+'</span><p>'+escapeHtml(text)+'</p></div></li>';
  }
  const timelineEditing=new Set();
  function movieTimeline(){
    const m=currentMovie(),data=read(),raw=data.timelines?.[m?.id]||{};
    const items=Array.isArray(raw.items)?raw.items.filter(i=>i&&typeof i.text==='string'&&i.text.trim()):[];
    return {items,index:Math.max(0,Math.min(items.length,Number.isInteger(raw.index)?raw.index:0))};
  }
  function timelineLines(items){return items.map(i=>(i.time?i.time+' — ':'')+i.text).join('\n');}
  function timelineLabel(item){return (item?.time?'<time>'+escapeHtml(item.time)+'</time> ':'')+escapeHtml(item?.text||'');}
  function movieTimelineHtml(){
    const advanced=window.clAutomaticTimeline?.html({movie:currentMovie(),workspace:workspaceId(),notes:rundown(currentMovie()).notes,confirmed:((typeof state!=='undefined'?state.traits:[])||[]).filter(t=>(currentMovie().selectedTraitIds||[]).includes(t.id)).map(t=>t.name),legacy:movieTimeline().items,redraw:draw});
    const m=currentMovie(),data=read(),timeline=movieTimeline(),{items,index}=timeline;
    const editing=timelineEditing.has(m.id),draft=data.timelineDrafts?.[m.id]??timelineLines(items);
    const current=items[index],next=items[index+1];
    return (window.clMovieResearch?.html(currentMovie())||'')+(advanced||'')+'<section class="clp-movie-timeline" aria-labelledby="clp-timeline-title"><div class="clp-timeline-head"><div><h2 id="clp-timeline-title">Manual talk order</h2><small>Story order · '+(items.length?Math.min(index+1,items.length)+' of '+items.length+(index===items.length?' · complete':''):'No beats added yet')+'</small></div>'+button(editing?'Close editor':'Edit timeline','timelineEdit()')+'</div>'+
      (items.length?'<div class="clp-timeline-focus" aria-live="polite"><div><span class="clp-cue-label">'+(current?'Now':'Finished')+'</span><p>'+ (current?timelineLabel(current):'All movie beats covered.')+'</p></div><div><span class="clp-cue-label">Next</span><p>'+(next?timelineLabel(next):current?'End of movie timeline':'No remaining beats')+'</p></div></div><div class="clp-timeline-actions">'+button('Previous beat','timelineMove(-1)',index===0?'disabled':'')+button(current?'Done · next beat':'Timeline complete','timelineMove(1)',!current?'disabled':'')+'</div><details class="clp-timeline-list"><summary>All '+items.length+' story beats</summary><ol>'+items.map((item,n)=>'<li><button type="button" class="'+(n===index?'current':n<index?'done':'')+'" '+(n===index?'aria-current="step"':'')+' onclick="clProduction.timelineGo('+n+')"><span class="clp-timeline-number">'+(n<index?'✓':n+1)+'</span><span>'+timelineLabel(item)+'</span></button></li>').join('')+'</ol></details>':'<p class="clp-hint">Add the movie’s plot beats in story order to see where you are and what happens next.</p>')+
      (editing?'<div class="clp-timeline-editor"><label for="clp-timeline-text">One plot beat per line. Optional movie time: 12:30 — They meet at the café.</label><textarea id="clp-timeline-text" rows="6" oninput="clProduction.timelineDraft(this.value)">'+escapeHtml(draft)+'</textarea><div class="clp-timeline-actions">'+button('Save timeline','timelineSave()')+button('Import Watch Along order','timelineImport()')+'</div><p class="clp-hint">Imported notes are an editable starting point. Put them in movie order before saving. Movie times are separate from the recording timer.</p></div>':'')+'</section>';
  }
  function timelineMove(delta){
    if(guardExternal())return;
    const m=currentMovie(),timeline=movieTimeline(),data=read();if(!m)return;
    timeline.index=Math.max(0,Math.min(timeline.items.length,timeline.index+delta));
    data.timelines=data.timelines||{};data.timelines[m.id]=timeline;write(data);draw();
  }
  function timelineSave(){
    if(guardExternal())return;
    const m=currentMovie();if(!m)return;
    const data=read(),old=movieTimeline(),text=document.getElementById('clp-timeline-text')?.value??data.timelineDrafts?.[m.id]??'';
    const available=new Map();for(const item of old.items){const k=(item.time||'')+'|'+item.text;if(!available.has(k))available.set(k,[]);available.get(k).push(item.id);}
    const items=String(text).split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map((line,n)=>{
      const match=line.match(/^\[?((?:\d{1,2}:)?\d{1,3}:[0-5]\d)\]?\s*(?:[—–-]\s*)?(.+)$/);
      const time=match?match[1]:'',text=match?match[2].trim():line;
      const reused=available.get(time+'|'+text)?.shift();
      return {id:reused||'beat-'+Date.now()+'-'+n+'-'+Math.random().toString(36).slice(2,7),time,text};
    });
    const currentId=old.items[old.index]?.id,existingIndex=currentId?items.findIndex(i=>i.id===currentId):-1;
    data.timelines=data.timelines||{};data.timelines[m.id]={items,index:existingIndex>=0?existingIndex:Math.min(old.index,items.length)};
    data.timelineDrafts=data.timelineDrafts||{};delete data.timelineDrafts[m.id];
    write(data);timelineEditing.delete(m.id);draw();
  }
  function timelineImport(){
    if(guardExternal())return;
    const m=currentMovie();if(!m)return;
    const source=rundown(m),ordered=source.outlineItems?.length?source.outlineItems.map(i=>i.text):source.talkingPoints||[];
    const notes=String(source.notes||'').split(/\n+/).map(t=>t.replace(/^\s*[•*-]\s*/,'').trim()).filter(Boolean);
    const lines=[...new Set([...ordered,...notes].map(t=>String(t).trim()).filter(Boolean))];
    if(!lines.length){alert('No Watch Along outline or notes found for this movie on this device.');return;}
    const data=read();data.timelineDrafts=data.timelineDrafts||{};
    const existing=data.timelineDrafts[m.id]??timelineLines(movieTimeline().items);
    const merged=existing.split(/\n+/).filter(Boolean);
    const identity=line=>line.replace(/^\[?(?:(?:\d{1,2}:)?\d{1,3}:[0-5]\d)\]?\s*(?:[—–-]\s*)?/,'').trim().toLowerCase();
    const seen=new Set(merged.map(identity));
    for(const line of lines)if(!seen.has(identity(line))){merged.push(line);seen.add(identity(line));}
    data.timelineDrafts[m.id]=merged.join('\n');
    write(data);timelineEditing.add(m.id);draw();
  }
  function recordingNotes(s){
    const latest=rundown(currentMovie()),saved=s.snapshot||{},knownTraits=new Set((state.traits||[]).map(t=>t.name));
    const snap=latest.hasDraft?latest:{...saved,talkingPoints:window.clMovieTraits?[...new Set([...(saved.talkingPoints||[]).filter(text=>!knownTraits.has(text)),...latest.talkingPoints])]:(saved.talkingPoints||latest.talkingPoints),grating:latest.grating,confirmedCount:latest.confirmedCount};
    if(window.clMovieTraits&&!latest.hasDraft&&Array.isArray(snap.outlineItems)){
      snap.outlineItems=snap.outlineItems.filter(i=>i.type!=='trait'||latest.talkingPoints.includes(i.text));
      const named=new Set(snap.outlineItems.filter(i=>i.type==='trait').map(i=>i.text));
      for(const text of latest.talkingPoints)if(!named.has(text))snap.outlineItems.push({type:'trait',text,category:''});
    }
    const ordered=Array.isArray(snap.outlineItems)&&snap.outlineItems.length?snap.outlineItems:(snap.talkingPoints||[]).map(text=>({type:'trait',text}));
    const observations=noteBlocks(snap.notes);
    const earlier=latest.hasDraft&&saved.notes&&saved.notes!==latest.notes?noteBlocks(saved.notes):[];
    return '<section class="clp-notebook" aria-labelledby="clp-notes-title"><div class="clp-notebook-head"><div><span class="clp-eyebrow">AT THE MIC</span><h2 id="clp-notes-title">Recording notes</h2></div><span class="clp-snapshot-label">'+(latest.hasDraft?'Latest Watch Along notes':'Saved recording notes')+' · '+escapeHtml(currentMovie()?.title)+'</span></div>'+
      '<div class="clp-note-legend" aria-label="Note colors"><span class="clp-legend-trait">Cheese Traits</span><span class="clp-legend-note">Talking points</span><span class="clp-legend-observation">Watch notes</span></div>'+
      '<section class="clp-note-group"><h3>Your talk order</h3><ol class="clp-cue-list" tabindex="0">'+(ordered.map((item,index)=>cueCard(item.text,index,item.type==='trait'?'trait':'note',item.type==='trait'?'Cheese Trait'+(item.category?' · '+item.category:''):'Talking point')).join('')||'<li class="clp-note-empty">Build your talk order in Watch Along, then update the snapshot here.</li>')+'</ol></section>'+
      '<section id="clp-watch-observations" tabindex="-1" class="clp-note-group"><h3>Watch Along observations</h3><ol class="clp-cue-list" tabindex="0">'+(observations.map((text,index)=>cueCard(text,index,'observation','Watch note')).join('')||'<li class="clp-note-empty">No Watch Along observations found for this movie on this browser. Open Watch Along to check the movie and its notes.</li>')+'</ol></section>'+
      (earlier.length?'<details class="clp-credit-reference"><summary>Earlier recording-session notes</summary><ol class="clp-cue-list" tabindex="0">'+earlier.map((text,index)=>cueCard(text,index,'observation','Earlier saved note')).join('')+'</ol></details>':'')+
      '<div class="clp-grating-cue"><span>Cheese Grating</span><strong>'+Number(snap.grating||0)+' points</strong><small>'+Number(snap.confirmedCount||0)+' confirmed traits · Bingo results follow the discussion</small></div>'+
      '<details class="clp-credit-reference"><summary>Movie credits & research reference</summary>'+movieCredits(currentMovie())+'</details></section>';
  }
  function recordHtml(){
    const s=getSession(),plan=sessionSegments(s),i=Math.min(s.segment,plan.length-1),total=sessionNow(s),segTime=total-startOfSegment(s);
    const focused=expandedSegment!==null&&expandedSegment>=0?expandedSegment:i;
    const recovering=isPending(s);
    const recoveryHtml=recovering?'<div class="clp-recovery" role="alert"><strong>Verify the interrupted recording timer.</strong><p>HQ is showing the last saved checkpoint, not counting time while this page was closed. Compare with the RØDECaster before using markers. If another HQ tab is still recording, return to that tab instead.</p><div class="clp-actions">'+button('Pause at checkpoint','recoverPause()')+button('Continue counting gap','recoverContinue()')+'</div></div>':'';
    const rows=plan.map((seg,n)=>{
      const lap=s.laps[n],active=n===i;
      return '<button class="clp-segment-choice '+(active?'current':'')+'" aria-pressed="'+(focused===n)+'" onclick="clProduction.expand('+n+')"><span>'+(lap?'✓':n+1)+'. '+escapeHtml(seg.name)+(active?' · NOW':'')+'</span><small>'+(lap?clock(lap.durationMs):'Target '+clock((seg.targetSeconds??seg.target*60)*1000))+'</small></button>';
    }).join('');
    return recoveryHtml+'<div class="clp-note-access"><a href="#clp-watch-observations">Jump to Watch Along notes ↓</a>'+button('Open Watch Along','openWatchAlong()')+'</div><div class="clp-record-grid"><section class="clp-record-primary"><div class="clp-compact-timer" aria-label="Recording timing"><div><span>Total</span><strong id="clp-total">'+clock(total)+'</strong></div><div><span>Segment</span><strong id="clp-segtime">'+clock(segTime)+'</strong></div><small>'+escapeHtml(plan[i].name)+'</small></div><div class="clp-meter"><i id="clp-progress" style="width:'+Math.min(100,total/2700000*100)+'%"></i></div>'+
      '<details class="clp-segment-map"><summary>Episode segments <span>'+escapeHtml(plan[i].name)+'</span></summary><div class="clp-segment-choices">'+rows+'</div><p class="clp-hint">Browse a cue without changing the running segment.</p></details>'+
      '<div class="clp-desk-columns"><section class="clp-desk-story" aria-label="Movie position"><div class="clp-host-cue"><span class="clp-cue-label">Segment cue · '+escapeHtml(plan[focused].name)+'</span>'+rundownSection(focused,s)+'</div>'+movieTimelineHtml()+'</section><section class="clp-desk-discussion" aria-label="Discussion notes">'+recordingNotes(s)+'</section><section class="clp-desk-bingo" aria-label="Bingo card results">'+(window.clRecordingBingo?window.clRecordingBingo.html(currentMovie()):'<p class="clp-hint">Loading Bingo results…</p>')+'</section></div>'+
      '<div class="clp-sticky-actions clp-actions">'+(s.runningSince?button('Pause','pause()',recovering?'disabled':''):button(s.finished?'Finished':s.elapsedMs||s.laps.length?'Resume':'Start timer','start()',recovering||s.finished?'disabled':''))+button('Previous','previous()',recovering||i===0?'disabled':'')+button(i===plan.length-1?'Finish & save':'Lap & next','next()',recovering||s.finished?'disabled':'')+'</div></section><aside class="clp-record-aside"><h3>Editing markers</h3><div class="clp-marker"><label>Type <select id="clp-marker-type"><option>Funny / Clip</option><option>Edit or Cut</option><option>Retake</option><option>Technical Issue</option></select></label><input id="clp-marker-note" data-movie="'+escapeHtml(s.movieId)+'" placeholder="Optional note"><button '+(recovering||!s.runningSince||s.finished?'disabled ':'')+'aria-keyshortcuts="M" onclick="clProduction.mark()">Mark moment</button></div><p class="clp-hint">Press M to mark a moment while the timer runs. Typing in a field is unaffected.</p><div class="clp-list">'+s.markers.slice(-5).reverse().map(m=>'<div><span>'+clock(m.atMs)+' · '+escapeHtml(m.type)+(m.note?' · '+escapeHtml(m.note):'')+'</span></div>').join('')+'</div>'+(s.finished?'<p class="clp-done">Session finished and saved.</p>':'')+'<div class="clp-foot">'+button('Update from Watch Along','refreshSnapshot()',s.runningSince?'disabled':'')+button('New session','reset()',recovering?'disabled':'')+'</div><p class="clp-hint">Update while paused to bring in your latest notes and talk order.</p></aside></div>';
  }
  function sessionHistoryHtml(){
    const m=currentMovie(),history=read().sessionHistory?.[m?.id]||[];
    if(!history.length)return '<p class="clp-hint">No previous recording sessions saved for this movie on this browser.</p>';
    return '<details class="clp-session-history"><summary>Past recording sessions ('+history.length+')</summary><p class="clp-hint">Stored on this device, not yet shared across Nick and Jenny’s devices. Restoring one preserves the current session in this history.</p><div class="clp-list">'+history.map(entry=>{
      const s=entry.session||{},date=new Date(entry.archivedAt).toLocaleString();
      const id=String(entry.archiveId||'');
      if(!/^[a-z0-9-]+$/i.test(id))return '';
      return '<div><span><strong>'+escapeHtml(date)+'</strong> · '+clock(s.elapsedMs||0)+' · '+(s.markers||[]).length+' markers'+(s.finished?' · finished':'')+'</span>'+button('Restore',"restoreSession('"+id+"')")+'</div>';
    }).join('')+'</div></details>';
  }
  function editHtml(){
    const s=getSession();return '<h2>Editing sheet</h2><p>All timestamps are relative to when you started the HQ timer. Start the RØDECaster recording at the same moment for accurate alignment.</p>'
      +'<h3>Segment boundaries</h3><div class="clp-list">'+(s.laps||[]).map(l=>'<div><span>'+clock(l.startMs)+' — '+escapeHtml(l.name)+'</span><strong>'+clock(l.durationMs)+'</strong></div>').join('')+'</div>'
      +'<h3>Markers</h3><div class="clp-list">'+(s.markers||[]).map((m,i)=>'<div><span>'+clock(m.atMs)+' · '+escapeHtml(m.type)+(m.note?' · '+escapeHtml(m.note):'')+'</span><button onclick="clProduction.deleteMarker('+i+')">Remove</button></div>').join('')+'</div>'
      +'<p class="clp-hint">REAPER marker export uses HQ timer time, not recorder time. Align the RØDECaster recording with the HQ timer before editing. In REAPER, use View → Region/Marker Manager → Import regions/markers (merge existing). Importing again creates duplicate markers.</p>'
      +'<div class="clp-actions">'+button('Download CSV','exportCsv()')+button('Download REAPER markers','exportReaper()')+button('Copy editing sheet','copyEdit()')+'</div>'+sessionHistoryHtml();
  }
  function socialHtml(){
    const s=getSession(),m=currentMovie(),d=read(),done=d.socials?.[m.id]||{},tasks=['Teaser prepared','Cocktail post prepared','Episode release post prepared','Funny clip selected','Bingo link checked','Posts scheduled'];
    return '<h2>Jenny’s Socials</h2><p>Prepare and approve posts here. Nothing is published automatically.</p><div class="clp-notes"><strong>'+escapeHtml(m.title)+'</strong><p>Network: '+escapeHtml(m.network||'Not recorded')+' · Season: '+escapeHtml(m.season||'Not recorded')+'</p><p>Cheese Grating: '+Number(rundown(m).grating||0)+' points</p><p>Clip candidates: '+s.markers.filter(x=>x.type==='Funny / Clip').length+'</p></div>'
      +'<h3>Promotion checklist</h3>'+tasks.map((t,i)=>'<label class="clp-check"><input type="checkbox" '+(done[i]?'checked':'')+' onchange="clProduction.social('+i+',this.checked)"> '+escapeHtml(t)+'</label>').join('')
      +'<div class="clp-actions">'+button('Copy episode starter','copySocial()')+'</div><p class="clp-hint">Use the episode title, confirmed details, and your selected clips as the starting point for captions. Add the verified cocktail and Bingo links before publishing.</p>';
  }
  function draw(){const expanded=new Map([...document.querySelectorAll('#clp-body details[data-clp-detail]')].map(el=>[el.dataset.clpDetail,el.open]));const note=document.getElementById('clp-marker-note'),type=document.getElementById('clp-marker-type'),draft=note?.value,category=type?.value;const el=document.getElementById('clp-body');if(el)el.innerHTML=bodyHtml();if(draft!==undefined&&document.getElementById('clp-marker-note'))document.getElementById('clp-marker-note').value=draft;if(category&&document.getElementById('clp-marker-type'))document.getElementById('clp-marker-type').value=category;for(const detail of document.querySelectorAll('#clp-body details[data-clp-detail]'))if(expanded.has(detail.dataset.clpDetail))detail.open=expanded.get(detail.dataset.clpDetail);refreshClock();}
  function refreshClock(){if(view!=='record'||!document.getElementById('clp-total'))return;const s=getSession();if(!s)return;const total=sessionNow(s),segmentMs=total-startOfSegment(s);const a=document.getElementById('clp-total'),b=document.getElementById('clp-segtime'),c=document.getElementById('clp-progress');if(a)a.textContent=clock(total);if(b)b.textContent=clock(segmentMs);const inline=document.getElementById('clp-inline-seg');if(inline)inline.textContent=clock(segmentMs);if(c)c.style.width=Math.min(100,total/2700000*100)+'%';}
  function csv(){const s=getSession();const rows=[['type','timestamp','segment','duration','category','note']];s.laps.forEach(l=>rows.push(['lap',clock(l.startMs),l.name,clock(l.durationMs),'','']));s.markers.forEach(m=>rows.push(['marker',clock(m.atMs),'','',m.type,m.note||'']));return rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');}
  function editingText(){const s=getSession();return ['CHEESE LOUISE EDITING SHEET',s.title,'LAPS',...s.laps.map(l=>clock(l.startMs)+' '+l.name+' ('+clock(l.durationMs)+')'),'MARKERS',...s.markers.map(m=>clock(m.atMs)+' '+m.type+(m.note?' — '+m.note:''))].join('\n');}
  async function copy(t){try{await navigator.clipboard.writeText(t);alert('Copied.')}catch{prompt('Copy this text:',t)}}
  window.clProduction={
    refreshDesk(){const active=document.activeElement,id=active?.id,start=active?.selectionStart,end=active?.selectionEnd;draw();const field=id?document.getElementById(id):null;if(field){field.focus?.();if(typeof start==='number')field.setSelectionRange?.(start,end);}},
    timelineEdit(){const m=currentMovie();if(!m)return;if(timelineEditing.has(m.id))timelineEditing.delete(m.id);else timelineEditing.add(m.id);draw();},
    timelineDraft(text){if(guardExternal())return;const m=currentMovie();if(!m)return;const data=read();data.timelineDrafts=data.timelineDrafts||{};data.timelineDrafts[m.id]=text;write(data);},
    timelineSave,
    timelineImport,
    timelineMove,
    timelineGo(index){if(!Number.isInteger(index))return;const timeline=movieTimeline();timelineMove(Math.max(0,Math.min(timeline.items.length-1,index))-timeline.index);},
    followWatchMovie(){if(guardExternal())return;const id=watchMovieId();if(!id||!movieList().some(m=>m.id===id)||getSession()?.runningSince)return;const d=read();d.movieId=id;write(d);expandedSegment=null;},
    openWatchAlong(){const movie=currentMovie();if(!movie)return;try{localStorage.setItem('cheeseLouise:watchAlong:'+workspaceId()+':movie',movie.id)}catch{}if(window.hqWorkspace?.open)window.hqWorkspace.open('watchalong');else{currentTab='watchalong';render();}},
    expand(i){expandedSegment=expandedSegment===i?-1:i;draw();},
    view(v){view=v;draw();document.querySelectorAll('.clp-tabs button').forEach((b,i)=>b.classList.toggle('selected',['record','edit','socials'][i]===v));},
    movie(id){
      if(guardExternal()){render();return;}
      if(!movieList().some(m=>m.id===id)||currentMovie()?.id===id)return;
      const previous=getSession();
      // Switching the movie during a take must never silently stop the HQ clock.
      if(previous?.runningSince){
        alert('Pause the recording timer before switching movies. Your current recording and markers are unchanged.');
        render(); // Restore the selected movie in the dropdown.
        return;
      }
      if(previous)save(previous);
      const d=read();d.movieId=id;write(d);expandedSegment=null;render();
    },
    recoverPause(){if(guardExternal())return;const s=getSession();if(!isPending(s))return;const total=sessionNow(s);pendingRecovery=null;s.elapsedMs=total;s.runningSince=null;s.checkpointAt=null;save(s);draw();},
    recoverContinue(){if(guardExternal())return;const s=getSession();if(!isPending(s))return;if(!confirm('Only count the gap if the RØDECaster was recording continuously while HQ was closed. Otherwise choose Pause at checkpoint. Continue?'))return;pendingRecovery=null;s.checkpointAt=Date.now();save(s);draw();},
    start(){update(s=>{if(!s.finished&&!s.runningSince){s.runningSince=Date.now();s.checkpointAt=s.runningSince;}});},
    pause(){update(s=>{if(s.runningSince){s.elapsedMs=sessionNow(s);s.runningSince=null;s.checkpointAt=null;}});},
    previous(){expandedSegment=null;update(s=>{if(s.finished){s.finished=false;s.laps.pop();}else if(s.segment>0&&s.laps.length){s.laps.pop();s.segment--;}});},
    next(){expandedSegment=null;update(s=>{if(s.finished)return;const total=sessionNow(s),start=startOfSegment(s);if(total<=start&&!s.runningSince)return;s.laps.push({name:sessionSegments(s)[s.segment].name,startMs:start,durationMs:Math.max(0,total-start)});if(s.segment===sessionSegments(s).length-1){s.elapsedMs=total;s.runningSince=null;s.checkpointAt=null;s.finished=true;}else{s.segment++;}});},
    mark(){
      if(guardExternal())return;
      const s=getSession();
      if(isPending(s)){alert('Resolve the interrupted timer before adding markers. Your note has been kept.');return;}
      if(!s?.runningSince||s.finished){alert('Start or resume the HQ timer before adding an editing marker. Your note has been kept.');return;}
      const type=document.getElementById('clp-marker-type')?.value||'Funny / Clip',note=document.getElementById('clp-marker-note')?.value||'';
      let saved=false;
      const pending=s.markers.find(marker=>marker.markerId===pendingMarker?.markerId);
      if(pendingMarker?.movieId===s.movieId&&pending){
        pending.type=type;pending.note=note;
        saved=save(s);draw();
      }else{
        const scene=window.clAutomaticTimeline?.selected?.()||{};
        const marker={markerId:String(Date.now())+'-'+Math.random().toString(36).slice(2,10),...(scene.scene_id?{scene_id:scene.scene_id}:{}),...(Number.isFinite(scene.movie_time_ms)?{movie_time_ms:scene.movie_time_ms}:{}),atMs:sessionNow(s),type,note};
        saved=update(active=>active.markers.push(marker));
        pendingMarker=saved?null:{movieId:s.movieId,markerId:marker.markerId};
      }
      if(saved){pendingMarker=null;const input=document.getElementById('clp-marker-note');if(input)input.value='';}
    },
    deleteMarker(i){update(s=>s.markers.splice(i,1));},
    refreshSnapshot(){update(s=>{if(!s.runningSince&&confirm('Replace this session’s talking points with the latest Watch Along notes?'))s.snapshot=rundown(currentMovie());});},
    reset(){
      if(guardExternal())return;
      const m=currentMovie(),active=getSession();if(!m||!active)return;
      if(!confirm('Start a new recording session? Your current recording and markers will be kept in Past recording sessions on this device.'))return;
      const data=read(),original=clone(data);
      archiveSession(data,active);
      const fresh=makeSession(m);
      data.sessions=data.sessions||{};data.sessions[m.id]=fresh;data.session=fresh;data.movieId=m.id;
      if(commitSessionChange(data,original))draw();
    },
    restoreSession(archiveId){
      if(guardExternal())return;
      const m=currentMovie(),active=getSession();if(!m||!active)return;
      if(active.runningSince){alert('Pause the recording timer before restoring an earlier session.');return;}
      const data=read(),history=data.sessionHistory?.[m.id]||[],index=history.findIndex(x=>x.archiveId===archiveId);
      if(index<0)return;
      if(!confirm('Restore this earlier recording session? Your current recorded work will be saved in Past recording sessions.'))return;
      const original=clone(data),selected=history.splice(index,1)[0];
      archiveSession(data,active);
      const restored=clone(selected.session);restored.movieId=m.id;restored.runningSince=null;
      data.sessions=data.sessions||{};data.sessions[m.id]=restored;data.session=restored;data.movieId=m.id;
      if(commitSessionChange(data,original))draw();
    },
    social(i,v){if(guardExternal())return;const d=read(),m=currentMovie();d.socials=d.socials||{};d.socials[m.id]=d.socials[m.id]||{};d.socials[m.id][i]=v;write(d);},
    exportCsv(){const blob=new Blob([csv()],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cheese-louise-editing-'+Date.now()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},
    exportReaper(){const s=getSession(),build=window.clReaperMarkers?.build;if(!s||!build){alert('REAPER marker export is unavailable. Reload HQ and try again.');return;}const data=build(s,sessionSegments(s),sessionNow(s));if(data.trim()==='#,Name,Start,End,Length'){alert('Start the HQ timer or add an editing marker before exporting.');return;}const blob=new Blob([data],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cheese-louise-reaper-'+String(s.title||'episode').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,55)+'-'+Date.now()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},
    copyEdit(){copy(editingText());},
    copySocial(){const m=currentMovie(),s=getSession();copy(['CHEESE LOUISE — EPISODE PROMOTION',m.title,'Network: '+(m.network||'Verify network'),'Cheese Grating: '+(rundown(m).grating||0),'Clip candidates:',...s.markers.filter(x=>x.type==='Funny / Clip').map(x=>clock(x.atMs)+' '+x.note),'Add verified cocktail recipe, release date, episode link and Bingo link before posting.'].join('\n'));},
    syncTraits(movieId){if(currentTab!=='recording'||currentMovie()?.id!==movieId)return;const active=document.activeElement,id=active?.id,start=active?.selectionStart,end=active?.selectionEnd;draw();const field=id?document.getElementById(id):null;if(field){field.focus?.();if(typeof start==='number')field.setSelectionRange?.(start,end);}}
  };
  // Persist a bounded checkpoint while the page is active. Hidden tabs can be
  // suspended without firing pagehide, especially on phones.
  function checkpointActive(force=false){
    if(pendingRecovery||stale()||(!force&&document.visibilityState==='hidden'))return;
    const s=getSession();if(!s?.runningSince)return;
    s.checkpointAt=Date.now();save(s);
  }
  window.addEventListener?.('storage',event=>{if(event.key!==key()&&event.key!==null)return;if(stale()&&currentTab==='recording')render();});
  document.addEventListener?.('visibilitychange',()=>{if(document.visibilityState==='hidden')checkpointActive(true);});
  window.addEventListener?.('pagehide',()=>{if(document.visibilityState!=='hidden')checkpointActive(true);});
  setInterval(()=>checkpointActive(),5000);
  // A one-key editing marker matches the quick-cue workflow without stealing text input.
  // Deliberately restricted to an active recording and to non-editable targets.
  function markerShortcut(event){
    if(event.defaultPrevented||event.isComposing||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||String(event.key||'').toLowerCase()!=='m')return;
    if(currentTab!=='recording'||view!=='record'||!getSession()?.runningSince||isPending(getSession()))return;
    const target=event.target||document.activeElement;
    if(target?.isContentEditable||target?.closest?.('[role="dialog"], [contenteditable="true"]')||['INPUT','TEXTAREA','SELECT','BUTTON'].includes(String(target?.tagName||'').toUpperCase()))return;
    event.preventDefault();
    window.clProduction.mark();
  }
  document.addEventListener?.('keydown',markerShortcut);
  const oldTabs=tabs;
  tabs=function(...args){const html=oldTabs.apply(this,args);if(html.includes("go('recording')"))return html;return html.replace('</nav>','<button class="'+(currentTab==='recording'?'active':'')+'" onclick="go(\'recording\')"><span class="tab-icon">🎙️</span>Recording</button></nav>');};
  window.tabs=tabs;
  const oldRender=render;
  render=function(...args){if(currentTab!=='recording')return oldRender.apply(this,args);if(!session)return authScreen();if(!workspace)return onboardingScreen();const note=document.getElementById('clp-marker-note'),draft=note?{movieId:note.getAttribute?.('data-movie'),value:note.value,type:document.getElementById('clp-marker-type')?.value}:null;shell('<div class="app-shell">'+topbar()+shellHtml()+'</div>'+tabs()+modal());if(draft?.movieId===currentMovie()?.id){const field=document.getElementById('clp-marker-note'),type=document.getElementById('clp-marker-type');if(field)field.value=draft.value;if(type&&draft.type)type.value=draft.type;}};
  window.render=render;
  tick=setInterval(refreshClock,250);
})();

