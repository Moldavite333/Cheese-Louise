// Cheese Louise HQ — Recording & Production Hub (local-first)
(() => {
  const prefix='cheeseLouise:production:v1:';
  const segments=[
    {name:'Opening & banter',target:3,prompt:'Introductions, catch-up, natural opening.'},
    {name:'Cheesy Concoctions',target:5,prompt:'Make the drink, taste it, react, and move into the movie.'},
    {name:'Movie & tropes',target:22,prompt:'Brief premise, then discuss your chosen tropes and observations.'},
    {name:'Horror-fied',target:5,prompt:'Set up the mini-game and react.'},
    {name:'Cheese Grating & Bingo results',target:7,prompt:'Give the Cheese Grating, play the Bingo sting, and announce the winners.'},
    {name:'Closing',target:3,prompt:'Final thoughts and sign-off.'}
  ];
  let view='record',tick=null;
  const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clock=ms=>{const s=Math.floor(Math.max(0,ms)/1000);return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map((n,i)=>i===0?String(n).padStart(2,'0'):String(n).padStart(2,'0')).join(':');};
  const workspaceId=()=>typeof workspace!=='undefined'&&workspace?.id||'local';
  const movieList=()=>typeof state!=='undefined'?(state.movies||[]):[];
  const key=()=>prefix+workspaceId();
  const memory=new Map();
  let storageWarning=false;
  const read=()=>{if(memory.has(key()))return memory.get(key());try{const data=JSON.parse(localStorage.getItem(key())||'{}');return data&&typeof data==='object'&&!Array.isArray(data)?data:{}}catch{return {}}};
  const write=data=>{memory.set(key(),data);try{localStorage.setItem(key(),JSON.stringify(data));memory.delete(key());storageWarning=false;return true}catch{if(!storageWarning){storageWarning=true;alert('HQ could not save recording data on this device. Your session is still open in memory. Export the editing sheet before closing or reloading.')}return false}};
  const currentMovie=()=>movieList().find(m=>m.id===read().movieId)||movieList()[0]||null;
  const sessionNow=s=>Math.max(0,(s.elapsedMs||0)+(s.runningSince?Date.now()-s.runningSince:0));
  const startOfSegment=s=>s.laps?.reduce((a,l)=>a+(l.durationMs||0),0)||0;
  function rundown(movie){
    const wk='cheeseLouise:watchAlong:'+workspaceId()+':draft:'+movie.id;
    let draft={};try{draft=JSON.parse(localStorage.getItem(wk)||'{}')}catch{}
    const traits=(typeof state!=='undefined'?state.traits:[])||[];
    const byId=new Map(traits.map(t=>[t.id,t]));
    const selected=(draft.traitIds||movie.selectedTraitIds||[]).map(id=>byId.get(id)).filter(Boolean);
    const confirmed=(movie.selectedTraitIds||[]).map(id=>byId.get(id)).filter(Boolean);
    return {talkingPoints:selected.map(t=>t.name),notes:String(draft.notes||''),grating:confirmed.reduce((n,t)=>n+Number(t.points||0),0),confirmedCount:confirmed.length};
  }
  const save=s=>{const d=read();d.sessions=d.sessions||{};if(d.session?.movieId&&!d.sessions[d.session.movieId])d.sessions[d.session.movieId]=d.session;d.sessions[s.movieId]=s;d.session=s;write(d);};
  function makeSession(movie){return {movieId:movie.id,title:movie.title||'Untitled',snapshot:rundown(movie),segment:0,laps:[],markers:[],elapsedMs:0,runningSince:null,finished:false,createdAt:Date.now()};}
  function getSession(){const d=read(),m=currentMovie();if(!m)return null;return d.sessions?.[m.id]||(d.session?.movieId===m.id?d.session:makeSession(m));}
  function update(fn){const s=getSession();if(!s)return;fn(s);save(s);draw();}
  const button=(label,handler,extra='')=>'<button type="button" '+extra+' onclick="window.clProduction.'+handler+'">'+label+'</button>';
  function shellHtml(){
    const d=read(),m=currentMovie();
    return '<main class="clp"><header class="clp-header"><div><span class="clp-eyebrow">CHEESE LOUISE HQ</span><h1>Recording & Production</h1><p>One episode, from recording to release.</p></div></header>'
      +'<label class="clp-select">Episode <select onchange="clProduction.movie(this.value)">'+movieList().map(x=>'<option value="'+escapeHtml(x.id)+'" '+(m?.id===x.id?'selected':'')+'>'+escapeHtml(x.title||'Untitled')+'</option>').join('')+'</select></label>'
      +'<div class="clp-tabs">'+[['record','Record'],['edit','Edit'],['socials','Socials']].map(([id,name])=>'<button class="'+(view===id?'selected':'')+'" onclick="clProduction.view(\''+id+'\')">'+name+'</button>').join('')+'</div>'
      +'<section id="clp-body">'+(m?bodyHtml(): '<p>Add a movie in HQ to begin.</p>')+'</section></main>';
  }
  function bodyHtml(){return view==='record'?recordHtml():view==='edit'?editHtml():socialHtml();}
  let expandedSegment=null;
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
    const snap=s.snapshot||{};
    if(n===0)return '<p>Introduce yourselves, share a quick story and settle into the conversation.</p>';
    if(n===1)return '<p>Introduce, taste and react to the Cheesy Concoction.</p>';
    if(n===2)return '<div class="clp-notes">'+movieCredits(currentMovie())+'<p><strong>Premise:</strong> Brief setup, not a scene-by-scene recap.</p><h4>Ordered tropes</h4><ol>'+((snap.talkingPoints||[]).map(t=>'<li>'+escapeHtml(t)+'</li>').join('')||'<li>No traits selected in Watch Along.</li>')+'</ol><h4>Watch Along notes</h4><p class="clp-watch-notes">'+(snap.notes?escapeHtml(snap.notes):'No notes recorded yet.')+'</p><p><strong>Cheese Grating:</strong> '+Number(snap.grating||0)+' points from '+Number(snap.confirmedCount||0)+' confirmed traits.</p></div>';
    if(n===3)return '<p>Horror-fied mini-game and reactions.</p>';
    if(n===4)return '<p>Give the Cheese Grating, play the Bingo theme sting, and announce the winners. Mention squares naturally during the movie discussion.</p>';
    return '<p>Final thoughts and sign-off.</p>';
  }
  function recordHtml(){
    const s=getSession(),i=Math.min(s.segment,segments.length-1),total=sessionNow(s),segTime=total-startOfSegment(s);
    const rows=segments.map((seg,n)=>{
      const lap=s.laps[n],active=n===i,expanded=expandedSegment===null?active:expandedSegment===n;
      return '<div class="clp-rundown-row '+(active?'current':'')+'"><button class="clp-rundown-toggle" aria-expanded="'+expanded+'" onclick="clProduction.expand('+n+')"><span>'+(lap?'✓':n+1)+'. '+escapeHtml(seg.name)+(active?' · NOW':'')+'</span><span>'+(lap?clock(lap.durationMs):active?'<span id="clp-inline-seg">'+clock(segTime)+'</span>':'Target '+seg.target+':00')+' '+(expanded?'▴':'▾')+'</span></button>'+(expanded?'<div class="clp-rundown-detail">'+rundownSection(n,s)+'</div>':'')+'</div>';
    }).join('');
    return '<div class="clp-record-grid"><section class="clp-record-primary"><div class="clp-two-clocks"><div><small>TOTAL TIME</small><strong id="clp-total">'+clock(total)+'</strong><small>Target 45:00</small></div><div><small>CURRENT SEGMENT</small><strong id="clp-segtime">'+clock(segTime)+'</strong><small>'+escapeHtml(segments[i].name)+'</small></div></div><div class="clp-meter"><i id="clp-progress" style="width:'+Math.min(100,total/2700000*100)+'%"></i></div><h2>Episode rundown</h2><div class="clp-rundown">'+rows+'</div><div class="clp-sticky-actions clp-actions">'+(s.runningSince?button('Pause','pause()'):button(s.finished?'Finished':s.elapsedMs||s.laps.length?'Resume':'Start timer','start()',s.finished?'disabled':''))+button('Previous','previous()',i===0?'disabled':'')+button(i===segments.length-1?'Finish & save':'Lap & next','next()',s.finished?'disabled':'')+'</div></section><aside class="clp-record-aside"><h3>Editing markers</h3><div class="clp-marker"><label>Type <select id="clp-marker-type"><option>Funny / Clip</option><option>Edit or Cut</option><option>Retake</option><option>Technical Issue</option></select></label><input id="clp-marker-note" data-movie="'+escapeHtml(s.movieId)+'" placeholder="Optional note"><button onclick="clProduction.mark()">Mark moment</button></div><div class="clp-list">'+s.markers.slice(-5).reverse().map(m=>'<div><span>'+clock(m.atMs)+' · '+escapeHtml(m.type)+(m.note?' · '+escapeHtml(m.note):'')+'</span></div>').join('')+'</div>'+(s.finished?'<p class="clp-done">Session finished and saved.</p>':'')+'<div class="clp-foot">'+button('Refresh rundown snapshot','refreshSnapshot()',s.runningSince?'disabled':'')+button('New session','reset()')+'</div></aside></div>';
  }
  function editHtml(){
    const s=getSession();return '<h2>Editing sheet</h2><p>All timestamps are relative to when you started the HQ timer. Start the RØDECaster recording at the same moment for accurate alignment.</p>'
      +'<h3>Segment boundaries</h3><div class="clp-list">'+(s.laps||[]).map(l=>'<div><span>'+clock(l.startMs)+' — '+escapeHtml(l.name)+'</span><strong>'+clock(l.durationMs)+'</strong></div>').join('')+'</div>'
      +'<h3>Markers</h3><div class="clp-list">'+(s.markers||[]).map((m,i)=>'<div><span>'+clock(m.atMs)+' · '+escapeHtml(m.type)+(m.note?' · '+escapeHtml(m.note):'')+'</span><button onclick="clProduction.deleteMarker('+i+')">Remove</button></div>').join('')+'</div>'
      +'<div class="clp-actions">'+button('Download CSV','exportCsv()')+button('Copy editing sheet','copyEdit()')+'</div>';
  }
  function socialHtml(){
    const s=getSession(),m=currentMovie(),d=read(),done=d.socials?.[m.id]||{},tasks=['Teaser prepared','Cocktail post prepared','Episode release post prepared','Funny clip selected','Bingo link checked','Posts scheduled'];
    return '<h2>Jenny’s Socials</h2><p>Prepare and approve posts here. Nothing is published automatically.</p><div class="clp-notes"><strong>'+escapeHtml(m.title)+'</strong><p>Network: '+escapeHtml(m.network||'Not recorded')+' · Season: '+escapeHtml(m.season||'Not recorded')+'</p><p>Cheese Grating: '+Number(s.snapshot?.grating||0)+' points</p><p>Clip candidates: '+s.markers.filter(x=>x.type==='Funny / Clip').length+'</p></div>'
      +'<h3>Promotion checklist</h3>'+tasks.map((t,i)=>'<label class="clp-check"><input type="checkbox" '+(done[i]?'checked':'')+' onchange="clProduction.social('+i+',this.checked)"> '+escapeHtml(t)+'</label>').join('')
      +'<div class="clp-actions">'+button('Copy episode starter','copySocial()')+'</div><p class="clp-hint">Use the episode title, confirmed details, and your selected clips as the starting point for captions. Add the verified cocktail and Bingo links before publishing.</p>';
  }
  function draw(){const note=document.getElementById('clp-marker-note'),type=document.getElementById('clp-marker-type'),draft=note?.value,category=type?.value;const el=document.getElementById('clp-body');if(el)el.innerHTML=bodyHtml();if(draft!==undefined&&document.getElementById('clp-marker-note'))document.getElementById('clp-marker-note').value=draft;if(category&&document.getElementById('clp-marker-type'))document.getElementById('clp-marker-type').value=category;refreshClock();}
  function refreshClock(){if(view!=='record'||!document.getElementById('clp-total'))return;const s=getSession();if(!s)return;const total=sessionNow(s),segmentMs=total-startOfSegment(s);const a=document.getElementById('clp-total'),b=document.getElementById('clp-segtime'),c=document.getElementById('clp-progress');if(a)a.textContent=clock(total);if(b)b.textContent=clock(segmentMs);const inline=document.getElementById('clp-inline-seg');if(inline)inline.textContent=clock(segmentMs);if(c)c.style.width=Math.min(100,total/2700000*100)+'%';}
  function csv(){const s=getSession();const rows=[['type','timestamp','segment','duration','category','note']];s.laps.forEach(l=>rows.push(['lap',clock(l.startMs),l.name,clock(l.durationMs),'','']));s.markers.forEach(m=>rows.push(['marker',clock(m.atMs),'','',m.type,m.note||'']));return rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');}
  function editingText(){const s=getSession();return ['CHEESE LOUISE EDITING SHEET',s.title,'LAPS',...s.laps.map(l=>clock(l.startMs)+' '+l.name+' ('+clock(l.durationMs)+')'),'MARKERS',...s.markers.map(m=>clock(m.atMs)+' '+m.type+(m.note?' — '+m.note:''))].join('\n');}
  async function copy(t){try{await navigator.clipboard.writeText(t);alert('Copied.')}catch{prompt('Copy this text:',t)}}
  window.clProduction={
    expand(i){expandedSegment=expandedSegment===i?-1:i;draw();},
    view(v){view=v;draw();document.querySelectorAll('.clp-tabs button').forEach((b,i)=>b.classList.toggle('selected',['record','edit','socials'][i]===v));},
    movie(id){if(!movieList().some(m=>m.id===id))return;const previous=getSession();if(previous){if(previous.runningSince){previous.elapsedMs=sessionNow(previous);previous.runningSince=null;}save(previous);}const d=read();d.movieId=id;write(d);expandedSegment=null;render();},
    start(){update(s=>{if(!s.finished&&!s.runningSince)s.runningSince=Date.now();});},
    pause(){update(s=>{if(s.runningSince){s.elapsedMs=sessionNow(s);s.runningSince=null;}});},
    previous(){expandedSegment=null;update(s=>{if(s.finished){s.finished=false;s.laps.pop();}else if(s.segment>0&&s.laps.length){s.laps.pop();s.segment--;}});},
    next(){expandedSegment=null;update(s=>{if(s.finished)return;const total=sessionNow(s),start=startOfSegment(s);if(total<=start&&!s.runningSince)return;s.laps.push({name:segments[s.segment].name,startMs:start,durationMs:Math.max(0,total-start)});if(s.segment===segments.length-1){s.elapsedMs=total;s.runningSince=null;s.finished=true;}else{s.segment++;}});},
    mark(){const type=document.getElementById('clp-marker-type')?.value||'Funny / Clip',note=document.getElementById('clp-marker-note')?.value||'';const input=document.getElementById('clp-marker-note');if(input)input.value='';update(s=>s.markers.push({atMs:sessionNow(s),type,note}));},
    deleteMarker(i){update(s=>s.markers.splice(i,1));},
    refreshSnapshot(){update(s=>{if(!s.runningSince&&confirm('Replace this session’s talking points with the latest Watch Along notes?'))s.snapshot=rundown(currentMovie());});},
    reset(){if(confirm('Start a new session? The current session and its markers will be replaced. Export the editing sheet first.'))update(s=>Object.assign(s,makeSession(currentMovie())));},
    social(i,v){const d=read(),m=currentMovie();d.socials=d.socials||{};d.socials[m.id]=d.socials[m.id]||{};d.socials[m.id][i]=v;write(d);},
    exportCsv(){const blob=new Blob([csv()],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cheese-louise-editing-'+Date.now()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},
    copyEdit(){copy(editingText());},
    copySocial(){const m=currentMovie(),s=getSession();copy(['CHEESE LOUISE — EPISODE PROMOTION',m.title,'Network: '+(m.network||'Verify network'),'Cheese Grating: '+(s.snapshot?.grating||0),'Clip candidates:',...s.markers.filter(x=>x.type==='Funny / Clip').map(x=>clock(x.atMs)+' '+x.note),'Add verified cocktail recipe, release date, episode link and Bingo link before posting.'].join('\n'));}
  };
  const oldTabs=tabs;
  tabs=function(...args){const html=oldTabs.apply(this,args);if(html.includes("go('recording')"))return html;return html.replace('</nav>','<button class="'+(currentTab==='recording'?'active':'')+'" onclick="go(\'recording\')"><span class="tab-icon">🎙️</span>Recording</button></nav>');};
  window.tabs=tabs;
  const oldRender=render;
  render=function(...args){if(currentTab!=='recording')return oldRender.apply(this,args);if(!session)return authScreen();if(!workspace)return onboardingScreen();const note=document.getElementById('clp-marker-note'),draft=note?{movieId:note.getAttribute?.('data-movie'),value:note.value,type:document.getElementById('clp-marker-type')?.value}:null;shell('<div class="app-shell">'+topbar()+shellHtml()+'</div>'+tabs()+modal());if(draft?.movieId===currentMovie()?.id){const field=document.getElementById('clp-marker-note'),type=document.getElementById('clp-marker-type');if(field)field.value=draft.value;if(type&&draft.type)type.value=draft.type;}};
  window.render=render;
  tick=setInterval(refreshClock,250);
})();
