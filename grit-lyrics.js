// Cheese Louise HQ — Grit Whimsy & the Post-Podcast Players lyric drafts.
// Local-first: turns the movie synopsis + Cheese Traits into a short copy-ready house-band song.

(() => {
  const gritDrafts = new Map();

  function gritKey(kind,id){ return kind+':'+String(id); }

  function gritMovie(kind,id){
    if(kind==='saved') return (state.movies||[]).find(m=>String(m.id)===String(id))||null;
    const n=Number(id);
    return (state.discoveryResults||[]).find(m=>Number(m.tmdb_id)===n)
      || (state.romantiverseSearchResults||[]).find(m=>Number(m.tmdb_id)===n)
      || null;
  }

  function gritTraits(movie,kind){
    if(kind==='saved') return (movie?.selectedTraits||[]).map(t=>String(t?.name||'')).filter(Boolean);
    try{
      const est=typeof discoveryEstimate==='function'?discoveryEstimate(movie):null;
      return (est?.traits||[]).map(t=>String(t?.name||'')).filter(Boolean);
    }catch(_){ return []; }
  }

  function gritNorm(v){ return String(v||'').replace(/\s+/g,' ').trim(); }

  function gritSynopsisBits(summary){
    const text=gritNorm(summary);
    if(!text) return [];
    return text.split(/(?<=[.!?])\s+/)
      .map(s=>s.replace(/^[\"“”']+|[\"“”']+$/g,'').trim())
      .filter(Boolean)
      .slice(0,3)
      .map(s=>s.length>105?s.slice(0,102).replace(/\s+\S*$/,'')+'…':s);
  }

  function gritSignalText(movie,traits){
    return gritNorm([
      movie?.title,movie?.summary,movie?.season,movie?.holiday,movie?.network,
      ...(movie?.tags||[]),...(movie?.keywords||[]),...traits
    ].join(' ')).toLowerCase();
  }

  const signalLines=[
    [/bakery|baker|pastry|cake shop/,[
      "There's flour on the counter and feelings in the dough",
      "The bakery's warm and somebody's heart is running hot",
      "They came for the pastries and stayed for the eye contact"
    ]],
    [/small town|small-town|hometown|return home|back home/,[
      "Somebody came home swearing they weren't gonna stay",
      "That little town remembers everything they tried to forget",
      "One trip back home and the old life starts calling"
    ]],
    [/old flame|childhood sweetheart|second chance|first love/,[
      "An old flame's waiting right where the past left off",
      "The first love never quite got the memo that it was over",
      "Second chances grow wild around here"
    ]],
    [/wedding|bride|groom|engagement/,[
      "There's a wedding on the calendar and panic in the pews",
      "Somebody planned a wedding and forgot to plan for feelings",
      "The flowers are ordered, but the heart's off-script"
    ]],
    [/royal|prince|princess|kingdom|duke|duchess/,[
      "Somebody's hiding a crown under a perfectly normal coat",
      "Royal blood's doing a terrible job of staying undercover",
      "There's a castle somewhere and nobody bothered to mention it"
    ]],
    [/fake dating|pretend couple|fake relationship/,[
      "They're faking the sparks till the sparks turn real",
      "It started as pretend and nobody warned the heart",
      "One fake date later and reality's already losing"
    ]],
    [/family business|save the|struggling business|inherit/,[
      "The family place is hanging on by a thread and a miracle",
      "Love showed up right when the business started going under",
      "There's a deed, a deadline, and entirely too much eye contact"
    ]],
    [/festival|tree lighting|parade|regatta|contest|competition/,[
      "The whole town's betting everything on one suspiciously important festival",
      "Naturally the town event will decide the future of everybody's heart",
      "There's a contest, a crowd, and absolutely no normal stakes"
    ]],
    [/snow|winter|blizzard|snowed in/,[
      "Snow shuts down the road and opens up the feelings",
      "The weather says stay put, so naturally romance takes over",
      "One blizzard later and personal boundaries are gone"
    ]],
    [/christmas|mistletoe|holiday|tree farm/,[
      "String lights are blinking and common sense has left town",
      "Mistletoe's doing more work than the entire supporting cast",
      "Christmas showed up early and brought emotional complications"
    ]],
    [/widow|widower|dead spouse|late husband|late wife/,[
      "A guarded heart is learning how to open one inch at a time",
      "Grief came along for the ride, but so did another chance",
      "The past still hurts, but the future keeps knocking"
    ]],
    [/farm|ranch|orchard|vineyard|winery/,[
      "There's dirt on the boots and romance in the acreage",
      "The land needs saving and apparently so do their love lives",
      "Somewhere between the rows, the whole damn plan changed"
    ]],
    [/chef|restaurant|cafe|coffee|barista/,[
      "The coffee's hot and the boundaries are getting weak",
      "Somebody put feelings on the menu without asking",
      "The kitchen's busy and the chemistry's worse"
    ]]
  ];

  function gritSignalLines(text,variant){
    const out=[];
    for(const [rx,choices] of signalLines){
      if(!rx.test(text)) continue;
      out.push(choices[variant%choices.length]);
      if(out.length>=3) break;
    }
    return out;
  }

  const openings=[
    "Another little town, another heart on the line",
    "Well, here we go again where the porch lights shine",
    "There's trouble in the air and a casserole somewhere"
  ];

  const choruses=[
    title=>[
      title+", Lord, the cheese is getting thick",
      "One look, one kiss, one Romantiverse trick",
      "Reality packed up and romance took the wheel",
      "Around here, that's how you know it's real"
    ],
    title=>[
      "Oh "+title+", we know how this goes",
      "A deadline, a hometown, maybe somebody in the snow",
      "Common sense is gone but the chemistry survives",
      "That's the Romantiverse keeping love alive"
    ],
    title=>[
      title+", raise a glass and let it ride",
      "There's a perfectly good reason nobody can explain why",
      "But two hearts found the road they were supposed to find",
      "Cheese Louise — leave reality behind"
    ]
  ];

  function gritTraitLine(traits,variant){
    if(!traits.length) return '';
    const clean=[...new Set(traits)].slice(0,4);
    if(clean.length===1) return "And wouldn't you know it — "+clean[0].toLowerCase();
    const pick=clean.slice(0,3).map(x=>x.toLowerCase());
    const joins=[
      pick.join(', '),
      pick.length===2?pick.join(' and '):pick.slice(0,-1).join(', ')+', and '+pick.at(-1),
      pick.join(' / ')
    ];
    return "We've got "+joins[variant%joins.length]+" — naturally";
  }

  function gritStoryLine(bits,variant){
    if(!bits.length) return '';
    const sentence=bits[variant%bits.length]
      .replace(/^[A-Z][a-z]+\s+(?:is|was|has|must|returns?|travels?|heads?|comes?|goes?)\s+/,'')
      .replace(/\.$/,'');
    if(!sentence) return '';
    return sentence.charAt(0).toUpperCase()+sentence.slice(1);
  }

  function makeGritLyrics(movie,kind,variant=0){
    const title=gritNorm(movie?.title)||'This Beautiful Mess';
    const traits=gritTraits(movie,kind);
    const bits=gritSynopsisBits(movie?.summary);
    const text=gritSignalText(movie,traits);
    const signal=gritSignalLines(text,variant);
    const traitLine=gritTraitLine(traits,variant);
    const story=gritStoryLine(bits,variant);
    const opening=openings[variant%openings.length];
    const chorus=choruses[variant%choruses.length](title);

    const verse1=[opening, signal[0], story].filter(Boolean).slice(0,3);
    const verse2=[signal[1],traitLine,signal[2]].filter(Boolean).slice(0,3);
    if(verse2.length<2 && bits[1]) verse2.push(gritStoryLine(bits,variant+1));

    return [
      "[Verse 1]",
      ...verse1,
      "",
      "[Chorus]",
      ...chorus,
      "",
      "[Verse 2]",
      ...verse2,
      "",
      "[Final Chorus]",
      ...chorus.slice(0,2),
      "Cheese Louise, somebody cue the band",
      "",
      "[Spoken — Grit]",
      "\"That ain't a plot hole, partner. That's romance.\""
    ].join('\n');
  }

  function gritEscapeAttr(v){
    return String(v??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function gritPanelHtml(kind,id){
    const key=gritKey(kind,id);
    const entry=gritDrafts.get(key);
    if(!entry) return '';
    return '<div class="cl-grit-panel">'
      +'<div class="cl-grit-panel-head"><div><div class="kicker">Grit Whimsy &amp; the Post-Podcast Players</div><h3>Movie song draft</h3></div>'
      +'<div class="cl-grit-actions"><button class="secondary" type="button" onclick="clRegenerateGritLyrics(\''+gritEscapeAttr(kind)+'\',\''+gritEscapeAttr(id)+'\')">↻ Regenerate</button>'
      +'<button class="primary" type="button" onclick="clCopyGritLyrics(\''+gritEscapeAttr(kind)+'\',\''+gritEscapeAttr(id)+'\',this)">📋 Copy Lyrics</button></div></div>'
      +'<div class="subtle">Short house-band draft built from this movie\'s synopsis and Cheese Traits.</div>'
      +'<textarea class="cl-grit-lyrics" data-grit-key="'+gritEscapeAttr(key)+'" oninput="clUpdateGritLyrics(\''+gritEscapeAttr(kind)+'\',\''+gritEscapeAttr(id)+'\',this.value)">'+esc(entry.lyrics)+'</textarea>'
      +'</div>';
  }

  function refreshGritPanel(kind,id){
    const host=document.getElementById('clGritLyricsPanel');
    if(host) host.innerHTML=gritPanelHtml(kind,id);
  }

  window.clOpenGritLyrics=function(kind,id){
    const movie=gritMovie(kind,id);
    if(!movie) return;
    const key=gritKey(kind,id);
    if(!gritDrafts.has(key)) gritDrafts.set(key,{variant:0,lyrics:makeGritLyrics(movie,kind,0)});
    refreshGritPanel(kind,id);
    document.querySelector('.cl-grit-panel')?.scrollIntoView({behavior:'smooth',block:'nearest'});
  };

  window.clRegenerateGritLyrics=function(kind,id){
    const movie=gritMovie(kind,id);
    if(!movie) return;
    const key=gritKey(kind,id);
    const current=gritDrafts.get(key)||{variant:0};
    const variant=(Number(current.variant)||0)+1;
    gritDrafts.set(key,{variant,lyrics:makeGritLyrics(movie,kind,variant)});
    refreshGritPanel(kind,id);
  };

  window.clUpdateGritLyrics=function(kind,id,value){
    const key=gritKey(kind,id);
    const current=gritDrafts.get(key)||{variant:0};
    gritDrafts.set(key,{...current,lyrics:String(value||'')});
  };

  window.clCopyGritLyrics=async function(kind,id,button){
    const key=gritKey(kind,id);
    const textarea=document.querySelector('.cl-grit-lyrics[data-grit-key="'+CSS.escape(key)+'"]');
    const text=textarea?.value||gritDrafts.get(key)?.lyrics||'';
    if(!text) return;
    try{
      await navigator.clipboard.writeText(text);
    }catch(_){
      const temp=document.createElement('textarea');
      temp.value=text; temp.style.position='fixed'; temp.style.opacity='0';
      document.body.appendChild(temp); temp.select(); document.execCommand('copy'); temp.remove();
    }
    if(button){
      const old=button.textContent;
      button.textContent='✓ Copied';
      setTimeout(()=>{button.textContent=old},1200);
    }
  };

  function injectGrit(html,kind,id){
    if(!html || html.includes('clOpenGritLyrics(')) return html;
    const button='<button class="secondary cl-grit-button" type="button" onclick="clOpenGritLyrics(\''+gritEscapeAttr(kind)+'\',\''+gritEscapeAttr(id)+'\')">🎸 Grit Lyrics</button>';
    html=html.replace('<div class="kicker">Full synopsis</div>','<div class="cl-synopsis-head"><div class="kicker">Full synopsis</div>'+button+'</div>');
    html=html.replace('</p>\n    </section>','</p><div id="clGritLyricsPanel"></div>\n    </section>');
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
      .cl-grit-lyrics{width:100%;min-height:330px;margin-top:12px;resize:vertical;line-height:1.5;font:inherit;border-radius:12px;padding:12px 13px;background:var(--panel2,#20232c);color:inherit;border:1px solid rgba(255,255,255,.12);outline:none}
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
