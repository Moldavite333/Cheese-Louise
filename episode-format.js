// Shared recording cues. Old sessions retain their numeric v1 order.
(() => {
  const approved = [
    ['cold_open','Cold open',20,'A quick opening joke, about twenty seconds.'],
    ['theme','Theme music',0,'Theme cue. Record out of order if needed; HQ time is not audio order.'],
    ['welcome_banter','Welcome & banter',180,'Introductions and natural conversation.'],
    ['cheesy_concoctions','Cheesy Concoctions',300,'Introduce, taste and react to the episode cocktail.'],
    ['movie_discussion','Movie discussion',1320,'Use the chronological scenes, separate host notes and confirmed tropes.'],
    ['bingo_reveal','Cheese Grating & Bingo results',300,'Five-minute ending: use verified Cheese Grating and authoritative Bingo results only. If unavailable, say not verified.'],
    ['closing','Closing',180,'Final thoughts and sign-off.']
  ].map(([id,name,seconds,prompt])=>({id,name,seconds,target:seconds/60,prompt}));
  const legacy = [
    ['opening','Opening & banter',180],['cocktail','Cheesy Concoctions',300],
    ['movie','Movie & tropes',1320],['horrorfied','Horror-fied',300],
    ['bingo','Cheese Grating & Bingo results',420],['closing','Closing',180]
  ].map(([id,name,seconds])=>({id,name,seconds,target:seconds/60,prompt:name}));
  const optional={id:'horrorfied',name:'Horror-fied (optional)',seconds:300,target:5,prompt:'Optional mini-game and reactions.'};
  function sections(includeOptional=false){const result=approved.map(s=>({...s}));if(includeOptional)result.splice(5,0,{...optional});return result;}
  function forSession(s){return s?.formatVersion===2?sections(s.includeHorrorfied):legacy.map(x=>({...x}));}
  const headings=()=>sections().map(s=>s.name+(s.seconds?' · '+Math.floor(s.seconds/60)+':'+String(s.seconds%60).padStart(2,'0'):' · cue'));
  function build({title='',credits=[],discussion=[],cocktail='',tropes=[],notes='',grating='' }){
    const content={
      cold_open:['Opening joke / pickup:'],theme:['Theme cue'],welcome_banter:['Welcome and banter:'],
      cheesy_concoctions:[cocktail||'Cocktail not selected — choose it in the episode.'],
      movie_discussion:[...credits,...discussion,notes?'Watch notes:\n'+notes:'','Confirmed movie tropes (not Bingo results):',...tropes],
      bingo_reveal:[grating,'Five-minute reveal. Cheese Grating: verify in HQ. Bingo: use the authoritative results panel; winners not verified in this text.'],
      closing:['Final thoughts and sign-off:']
    };
    return ['CHEESE LOUISE — RECORDING RUNDOWN',title,'',...sections().flatMap((s,i)=>[headings()[i],s.prompt,...content[s.id].filter(Boolean),''])].join('\n').trim();
  }
  globalThis.clEpisodeFormat={sections,forSession,headings,build};
})();
