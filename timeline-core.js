/* Evidence-first timeline engine. No network, generated facts, or Bingo writes. */
(() => {
  const id=()=>crypto.randomUUID();
  const clone=value=>JSON.parse(JSON.stringify(value));
  function time(value){
    const m=String(value).trim().match(/^(?:(\d{1,3}):)?(\d{2}):(\d{2})(?:[.,](\d{3}))?$/);
    if(!m||+m[2]>59||+m[3]>59)throw Error('Use HH:MM:SS.mmm or MM:SS.');
    return ((+(m[1]||0)*60 + +m[2])*60 + +m[3])*1000+ +(m[4]||0);
  }
  const stamp=ms=>ms==null?'Unknown':new Date(ms).toISOString().slice(11,23);
  function captions(text,offset=0){
    if(!Number.isSafeInteger(offset))throw Error('Caption offset must be whole milliseconds.');
    const cues=[];
    for(const block of String(text).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split(/\n\s*\n/)){
      const lines=block.trim().split('\n');
      if(!block.trim()||/^(WEBVTT|NOTE|STYLE|REGION)(?:\s|$)/.test(lines[0]))continue;
      const n=lines.findIndex(line=>line.includes('-->'));
      if(n<0)throw Error('Malformed caption block: missing timing.');
      const match=lines[n].match(/^(\S+)\s+-->\s+(\S+)(?:\s+.*)?$/);
      if(!match)throw Error('Malformed caption timing.');
      const start=time(match[1])+offset,end=time(match[2])+offset;
      if(start<0||end<=start)throw Error('Caption end must follow its nonnegative start.');
      const raw=lines.slice(n+1).join('\n');
      const speaker=raw.match(/<v\s+([^>]+)>/i)?.[1]||null;
      const dialogue=raw.replace(/<[^>]*>/g,'').trim();
      if(!dialogue)throw Error('Caption has no text.');
      cues.push({start,end,text:dialogue,speaker,raw});
    }
    if(!cues.length)throw Error('No valid captions found.');
    return cues.sort((a,b)=>a.start-b.start);
  }
  function scene(movieId,summary,source,timing={}){
    return {scene_id:id(),movie_id:movieId,episode_id:null,sequence_index:0,title:summary.slice(0,80),summary,
      start_time_ms:timing.start??null,end_time_ms:timing.end??null,timestamp_status:timing.start==null?'Unknown':'Exact caption time',
      evidence_status:'Source-supported',review_status:'Draft',source_references:[source],characters:[],plot_events:[],trope_candidates:[],discussion_prompts:[],
      nick_notes:'',jenny_notes:'',shared_notes:'',recording_markers:[],created_at:new Date().toISOString(),updated_at:new Date().toISOString(),revision:1,manual_fields:[]};
  }
  function create(movie,synopsis='',notes='',legacy=[]){
    const doc={schema_version:1,movie_id:movie.id,identity:{title:movie.title,year:movie.year||movie.release_year||null,tmdb_id:movie.tmdb_id||null},revision:0,mode:'Plot outline',sources:[],scenes:[],selected:null,pickup:null};
    function add(kind,label,text){const source={id:id(),kind,label,text,created_at:new Date().toISOString()};doc.sources.push(source);return source.id;}
    if(synopsis.trim()){const ref=add('synopsis','Saved movie synopsis — chronology unestablished',synopsis);doc.scenes.push(scene(movie.id,synopsis,ref));}
    if(notes.trim()){const ref=add('user-note','Watch Along notes — original text',notes);const s=scene(movie.id,'Watch Along observations (order needs review)',ref);s.shared_notes=notes;s.evidence_status='Unverified';s.review_status='Needs review';doc.scenes.push(s);}
    if(legacy.length){const ref=add('user-note','Existing manual timeline',JSON.stringify(legacy));for(const item of legacy){const s=scene(movie.id,item.text,ref);s.evidence_status='Unverified';s.review_status='Needs review';if(item.time){try{s.start_time_ms=time(item.time);s.timestamp_status='Approximate';}catch{}}doc.scenes.push(s);}}
    doc.scenes.forEach((s,i)=>s.sequence_index=i);doc.selected=doc.scenes[0]?.scene_id||null;return doc;
  }
  function ingest(doc,name,text,offset=0){
    const cues=captions(text,offset),next=clone(doc);
    if(next.sources.some(s=>s.kind==='captions'&&s.text===text&&s.offset===offset))return next;
    const ref=id();next.sources.push({id:ref,kind:'captions',label:name,text,offset,created_at:new Date().toISOString()});
    // Fixed windows are navigation excerpts, never claims about film scene boundaries.
    const groups=[];for(const cue of cues){const bucket=Math.floor(cue.start/120000);let group=groups.at(-1);if(!group||group.bucket!==bucket){group={bucket,cues:[]};groups.push(group);}group.cues.push(cue);}
    for(const group of groups){const cs=group.cues,s=scene(doc.movie_id,cs.map(c=>c.text).join('\n'),ref,{start:cs[0].start,end:cs.at(-1).end});s.title='Caption excerpt · '+stamp(s.start_time_ms);s.characters=[...new Set(cs.map(c=>c.speaker).filter(Boolean))];next.scenes.push(s);}
    next.scenes.sort((a,b)=>(a.start_time_ms??Infinity)-(b.start_time_ms??Infinity));next.scenes.forEach((s,i)=>s.sequence_index=i);next.mode='Caption navigation draft';next.selected=next.selected||next.scenes[0]?.scene_id;return next;
  }
  function validate(doc){
    if(doc.schema_version!==1||!Array.isArray(doc.scenes)||!Array.isArray(doc.sources))throw Error('Invalid timeline document.');
    const ids=new Set(),refs=new Set(doc.sources.map(s=>s.id));
    for(const s of doc.scenes){
      if(ids.has(s.scene_id)||s.movie_id!==doc.movie_id)throw Error('Invalid scene identity.');ids.add(s.scene_id);
      if(!['Unknown','Approximate','Exact caption time'].includes(s.timestamp_status)||!['Verified','Source-supported','Inferred','Unverified'].includes(s.evidence_status)||!['Draft','User-confirmed','Needs review'].includes(s.review_status))throw Error('Invalid evidence state.');
      if(s.start_time_ms!==null&&(!Number.isSafeInteger(s.start_time_ms)||s.start_time_ms<0)||s.end_time_ms!==null&&(!Number.isSafeInteger(s.end_time_ms)||s.end_time_ms<0||s.start_time_ms===null||s.end_time_ms<=s.start_time_ms))throw Error('Invalid scene time.');
      if(s.timestamp_status==='Unknown'&&(s.start_time_ms!==null||s.end_time_ms!==null)||s.timestamp_status!=='Unknown'&&s.start_time_ms===null)throw Error('Timing status conflicts with timestamps.');
      if(!s.source_references.every(ref=>refs.has(ref)))throw Error('Missing source.');
      if(s.timestamp_status==='Exact caption time'&&!doc.sources.some(ref=>s.source_references.includes(ref.id)&&ref.kind==='captions'))throw Error('Exact timing requires captions.');
    }return doc;
  }
  function exportText(doc,title,confirmed=[]){return [title,'CHEESE LOUISE · JENNY’S RUNDOWN',doc.mode,'Opening → Cocktail → Movie discussion → Cheese Grating & Bingo → Closing','',...doc.scenes.flatMap((s,i)=>[`${i+1}. ${stamp(s.start_time_ms)} · ${s.title}`,s.summary,`[${s.evidence_status}; ${s.timestamp_status}; ${s.review_status}]`,s.characters.length?'Characters: '+s.characters.join(', '):'',s.shared_notes,s.jenny_notes,'Additional notes: __________________','']), 'Confirmed movie tropes (not Bingo results):',...confirmed,'','Bingo: use the authoritative results panel.'].filter(x=>x!==undefined).join('\n');}
  globalThis.clTimelineCore={time,stamp,captions,scene,create,ingest,validate,exportText,clone};
})();
