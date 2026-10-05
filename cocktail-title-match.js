// Cheese Louise — Cocktail Matchmaker v2.
// Treat movies and cocktails like dating profiles: retrieve likely candidates first,
// then score compatibility across six explainable dimensions.

(() => {
  if (typeof clNormName !== 'function' || typeof clMovieFingerprint !== 'function' || typeof clCandidateFingerprint !== 'function' || typeof clMergedOriginalCatalog !== 'function') return;

  const TITLE_STOP = new Set([
    'a','an','the','and','or','of','to','in','on','at','for','from','with','by','as','is','are','was','were','be','been',
    'my','your','our','their','his','her','this','that','these','those','one','two','three','movie','story','tale'
  ]);
  const TITLE_WEAK = new Set([
    'love','romance','romantic','christmas','holiday','winter','spring','summer','fall','autumn','wedding','heart','hearts','home','hometown'
  ]);

  const MM_SYMBOLS = [
    {movie:/\bbirds?\b/i,cocktail:/\bjungle bird\b/i,label:'bird ↔ Jungle Bird',points:10},
    {movie:/\bplane\b|\bflight\b|\bpilot\b|\bairline\b/i,cocktail:/\bpaper plane\b|\baviation\b/i,label:'flight ↔ Paper Plane / Aviation',points:10},
    {movie:/\baviation\b|\baviator\b/i,cocktail:/\baviation\b/i,label:'aviation ↔ Aviation',points:10},
    {movie:/\bbee\b|\bbees\b|\bhoney\b/i,cocktail:/bee.?s knees/i,label:'bee / honey ↔ Bee’s Knees',points:10},
    {movie:/\bhorse\b|\bhorses\b|\bequestrian\b|\branch\b/i,cocktail:/horse.?s neck/i,label:'horse / ranch ↔ Horse’s Neck',points:9},
    {movie:/casino|gambl|poker|blackjack/i,cocktail:/\bcasino\b/i,label:'gambling ↔ Casino',points:10},
    {movie:/\bangel\b|\bheaven\b|\bheavenly\b/i,cocktail:/angel face/i,label:'angel ↔ Angel Face',points:10},
    {movie:/\bparadise\b/i,cocktail:/\bparadise\b/i,label:'paradise ↔ Paradise',points:10},
    {movie:/\bjungle\b/i,cocktail:/jungle bird/i,label:'jungle ↔ Jungle Bird',points:10},
    {movie:/corpse|ghost|afterlife|undead|death|dead\b/i,cocktail:/corpse reviver/i,label:'afterlife ↔ Corpse Reviver',points:10},
    {movie:/\bzombie\b/i,cocktail:/\bzombie\b/i,label:'zombie ↔ Zombie',points:10},
    {movie:/paper|writer|author|novelist|publisher|bookstore|book shop/i,cocktail:/paper plane/i,label:'paper / writer ↔ Paper Plane',points:8},
    {movie:/new york|manhattan|big city/i,cocktail:/manhattan|new york sour/i,label:'New York ↔ Manhattan / New York Sour',points:9},
    {movie:/\bmonkey\b/i,cocktail:/monkey gland/i,label:'monkey ↔ Monkey Gland',points:10},
    {movie:/\bclover\b/i,cocktail:/clover club/i,label:'clover ↔ Clover Club',points:10},
    {movie:/\bmary\b/i,cocktail:/bloody mary|mary pickford/i,label:'Mary ↔ named Mary cocktail',points:8},
    {movie:/\blady\b/i,cocktail:/white lady/i,label:'lady ↔ White Lady',points:8},
    {movie:/dark|storm|stormy|thunder/i,cocktail:/dark .?n.? stormy/i,label:'storm ↔ Dark ’N’ Stormy',points:9},
    {movie:/sunrise|dawn/i,cocktail:/tequila sunrise/i,label:'sunrise ↔ Tequila Sunrise',points:9},
    {movie:/sea|seaside|ocean|coast|beach/i,cocktail:/sea breeze/i,label:'seaside ↔ Sea Breeze',points:8},
    {movie:/paris|france|french/i,cocktail:/french 75|french martini|french connection/i,label:'French setting ↔ French cocktail',points:8},
    {movie:/russia|russian/i,cocktail:/black russian|russian spring punch/i,label:'Russian theme ↔ Russian cocktail',points:9},
    {movie:/cuba|cuban/i,cocktail:/cuba libre|old cuban/i,label:'Cuba ↔ Cuban cocktail',points:9},
    {movie:/singapore/i,cocktail:/singapore sling/i,label:'Singapore ↔ Singapore Sling',points:10},
    {movie:/ireland|irish/i,cocktail:/irish coffee/i,label:'Irish theme ↔ Irish Coffee',points:9},
    {movie:/island|tropical|caribbean|hawaii|beach/i,cocktail:/mai.?tai|pina colada|jungle bird/i,label:'island / tropical ↔ tiki classic',points:7},
    {movie:/royal|prince|princess|queen|king|duke|duchess/i,cocktail:/royal|queen|king/i,label:'royalty ↔ royal-name cocktail',points:8}
  ];

  const MM_PERSONALITY = [
    {movie:['playful','campy','quirky','competition'],cocktail:['playful','fruity','tiki','sparkling','spicy'],points:5,label:'playful energy'},
    {movie:['elegant','royal','glamorous','city'],cocktail:['elegant','martini','sparkling','floral','sherry','vermouth'],points:5,label:'elegant personality'},
    {movie:['rustic','country','farm','ranch','mountain'],cocktail:['whiskey','bourbon','rye','warming','apple','maple','herbal'],points:5,label:'rustic personality'},
    {movie:['cozy','family','bookish','bakery'],cocktail:['cozy','coffee','tea','dessert','creamy','warming','approachable'],points:5,label:'cozy personality'},
    {movie:['adventure','travel','road-trip','summer'],cocktail:['tropical','highball','refreshing','citrus','tiki'],points:5,label:'adventurous personality'},
    {movie:['mystery','dark','halloween'],cocktail:['dark','bitter','herbal','spirit-forward','amaro','spiced'],points:5,label:'dark / mysterious personality'},
    {movie:['nostalgic','second-chance','old-flame'],cocktail:['classic','warming','whiskey','brandy','spirit-forward'],points:5,label:'nostalgic personality'},
    {movie:['romantic','wedding','valentines'],cocktail:['romantic','berry','floral','sparkling','elegant'],points:5,label:'romantic personality'}
  ];

  const MM_MOODS = [
    {movie:['cozy','warming'],cocktail:['warming','rich','coffee','tea','creamy'],points:5,label:'cozy mood'},
    {movie:['celebratory','festival','wedding','new-years'],cocktail:['celebratory','sparkling','bright'],points:5,label:'celebratory mood'},
    {movie:['light','spring','refreshing'],cocktail:['light','refreshing','citrus','floral','highball'],points:5,label:'light mood'},
    {movie:['dark','mystery','halloween','bittersweet'],cocktail:['dark','bitter','herbal','spirit-forward'],points:5,label:'moody / dark tone'},
    {movie:['playful','campy','competition'],cocktail:['playful','spicy','fruity','tiki'],points:5,label:'playful tone'},
    {movie:['romantic','elegant'],cocktail:['romantic','floral','sparkling','elegant'],points:5,label:'romantic tone'}
  ];

  function mmCleanWord(word){
    let w=String(word||'').toLowerCase().trim();
    if(!w || w==='s') return '';
    if(w.length>4 && w.endsWith('ies')) w=w.slice(0,-3)+'y';
    else if(w.length>3 && w.endsWith('s') && !w.endsWith('ss')) w=w.slice(0,-1);
    return w;
  }
  function mmWords(value){ return clNormName(value).split(/\s+/).map(mmCleanWord).filter(Boolean); }
  function mmStrongWords(value){ return [...new Set(mmWords(value).filter(w=>w.length>=3&&!TITLE_STOP.has(w)&&!TITLE_WEAK.has(w)))]; }
  function mmWeakWords(value){ return [...new Set(mmWords(value).filter(w=>TITLE_WEAK.has(w)))]; }
  function mmSet(map){ return new Set(map instanceof Map?[...map.keys()]:(Array.isArray(map)?map:[])); }
  function mmHasAny(set,values){ return (values||[]).some(v=>set.has(clCleanTag(v))); }
  function mmMovieText(movie){
    return [movie?.title,movie?.summary,movie?.notes,movie?.holiday,movie?.season,...(movie?.tags||[]),...(movie?.selectedTraits||[]).map(t=>`${t.name} ${t.category}`)].filter(Boolean).join(' ');
  }

  function clTitleCocktailNameMatch(movie,candidate){
    const mt=String(movie?.title||'').trim();
    const cn=String(candidate?.name||candidate?.strDrink||'').trim();
    if(!mt||!cn) return {score:0,tokens:[],reason:null,type:null};
    const mn=clNormName(mt), cnorm=clNormName(cn);
    const ms=mmStrongWords(mt), cs=mmStrongWords(cn), cset=new Set(cs);
    const shared=ms.filter(w=>cset.has(w));
    const mw=new Set(mmWeakWords(mt)), cw=new Set(mmWeakWords(cn));
    const sharedWeak=[...mw].filter(w=>cw.has(w));
    let score=0,type=null;
    if(mn===cnorm){score=25;type='exact title/name chemistry';}
    else if(cnorm.length>=4 && (` ${mn} `.includes(` ${cnorm} `)||` ${cnorm} `.includes(` ${mn} `))){score=22;type='title/name phrase chemistry';}
    else if(shared.length){score=Math.min(22,14+(shared[0]?.length>=6?4:2)+Math.max(0,shared.length-1)*3);type='title/name word chemistry';}
    if(sharedWeak.length){score=Math.min(25,score+(score?2:Math.min(4,2+sharedWeak.length)));if(!type)type='title/name theme chemistry';}
    const tokens=[...shared,...sharedWeak];
    return {score,tokens,type,reason:score?`${type}: ${tokens.length?tokens.join(', '):cn}`:null};
  }

  function mmSymbolism(movie,candidate){
    const text=mmMovieText(movie);
    const name=String(candidate?.name||'');
    const hits=MM_SYMBOLS.filter(rule=>rule.movie.test(text)&&rule.cocktail.test(name));
    if(!hits.length) return {score:0,hits:[],reason:null};
    const score=Math.min(10,Math.max(...hits.map(h=>h.points)));
    return {score,hits:hits.map(h=>h.label),reason:`story-symbol connection: ${hits.map(h=>h.label).join(' · ')}`};
  }

  function mmRuleScore(movieSet,cocktailSet,rules,max){
    let score=0; const hits=[];
    for(const r of rules){
      if(mmHasAny(movieSet,r.movie)&&mmHasAny(cocktailSet,r.cocktail)){
        score+=r.points; hits.push(r.label);
      }
    }
    return {score:Math.min(max,score),hits};
  }

  function mmDirectOverlap(movieSet,cocktailSet,allowed,maxBonus){
    const hits=[];
    for(const tag of movieSet){ if(cocktailSet.has(tag)&&(!allowed||allowed.has(tag))) hits.push(tag); }
    return {bonus:Math.min(maxBonus,hits.length*2),hits};
  }

  function mmSeason(movie,candidate,cocktailSet){
    const holiday=clCleanTag(movie?.holiday||'');
    const season=clCleanTag(movie?.season||'');
    let score=0; const hits=[];
    if(holiday&&cocktailSet.has(holiday)){score+=9;hits.push(holiday);}
    if(season&&cocktailSet.has(season)){score+=6;hits.push(season);}
    const bridges={
      christmas:['holiday','winter','cranberry','rosemary','baking-spice','warming','sparkling'],
      halloween:['halloween','dark','spiced','blackberry','orange','playful'],
      thanksgiving:['fall','apple','maple','warming','spiced'],
      'valentine-s-day':['romantic','berry','floral','sparkling','pink'],
      'new-year-s':['celebratory','sparkling','elegant','night'],
      fall:['fall','apple','maple','warming','spiced'],winter:['winter','warming','cozy','spiced'],spring:['spring','floral','light','citrus'],summer:['summer','refreshing','citrus','tropical']
    };
    const key=holiday||season;
    const bridge=bridges[key]||[];
    const bridgeHits=bridge.filter(t=>cocktailSet.has(clCleanTag(t)));
    score+=Math.min(holiday?6:9,bridgeHits.length*2);
    hits.push(...bridgeHits);
    return {score:Math.min(15,score),hits:[...new Set(hits)]};
  }

  function mmNovelty(candidate){
    const d=typeof clDiversityPenalty==='function'?clDiversityPenalty(candidate):{penalty:0,notes:[]};
    let score=5-Math.min(5,Number(d.penalty||0)/6.5);
    if(candidate?.tested&&Number(candidate?.rating||0)>=4) score+=0.5;
    return {score:Math.max(0,Math.min(5,Math.round(score*10)/10)),diversity:d};
  }

  function mmDealbreakers(movie,candidate,movieSet,cocktailSet,chemistry,symbolism){
    const text=mmMovieText(movie).toLowerCase();
    const family=clCleanTag(typeof clInferFamily==='function'?clInferFamily(candidate):candidate?.style||'');
    let penalty=0; const reasons=[];
    const strongHook=chemistry>=18||symbolism>=8;
    const add=(n,why)=>{penalty+=strongHook?Math.round(n*0.45):n;reasons.push(why)};
    if(/summer|beach|island|tropical/.test(text) && mmHasAny(cocktailSet,['winter','holiday','hot','creamy']) && mmHasAny(cocktailSet,['rich','warming','creamy'])) add(9,'heavy winter drink against a summer movie');
    if(/christmas|winter|snow|ski|lodge/.test(text) && mmHasAny(cocktailSet,['summer','tropical']) && !/island|beach|tropical/.test(text)) add(6,'tropical drink against a winter movie');
    if(mmHasAny(movieSet,['elegant','royal','wedding','glamorous']) && /shot/.test(family)) add(10,'shot-style drink against an elegant movie');
    if(mmHasAny(movieSet,['light','spring','floral']) && mmHasAny(cocktailSet,['smoky','dark','spirit-forward']) && mmHasAny(cocktailSet,['mezcal','amaro','whiskey'])) add(5,'very dark/spirit-forward against a light movie');
    return {penalty:Math.min(18,penalty),reasons};
  }

  function mmCompatibility(movie,candidate){
    const movieFingerprint=clMovieFingerprint(movie);
    const cocktailFingerprint=clCandidateFingerprint(candidate);
    const movieSet=mmSet(movieFingerprint.weights);
    const cocktailSet=mmSet(cocktailFingerprint);

    const chemistry=clTitleCocktailNameMatch(movie,candidate);
    const symbolism=mmSymbolism(movie,candidate);

    const personalityBase=mmRuleScore(movieSet,cocktailSet,MM_PERSONALITY,25);
    const pDirect=mmDirectOverlap(movieSet,cocktailSet,null,7);
    const personality={score:Math.min(25,personalityBase.score+pDirect.bonus),hits:[...personalityBase.hits,...pDirect.hits.slice(0,3)]};

    const moodBase=mmRuleScore(movieSet,cocktailSet,MM_MOODS,20);
    const MOOD_TAGS=new Set(['cozy','warming','celebratory','sparkling','light','refreshing','dark','mystery','playful','campy','romantic','elegant','bittersweet']);
    const mDirect=mmDirectOverlap(movieSet,cocktailSet,MOOD_TAGS,6);
    const mood={score:Math.min(20,moodBase.score+mDirect.bonus),hits:[...moodBase.hits,...mDirect.hits]};

    const season=mmSeason(movie,candidate,cocktailSet);
    const novelty=mmNovelty(candidate);
    const dealbreakers=mmDealbreakers(movie,candidate,movieSet,cocktailSet,chemistry.score,symbolism.score);

    let total=chemistry.score+personality.score+mood.score+season.score+symbolism.score+novelty.score-dealbreakers.penalty;
    if(candidate?.iba_official) total+=1;
    if(candidate?.tested&&Number(candidate?.rating||0)>=4) total+=1;
    total=Math.max(8,Math.min(99,Math.round(total)));

    const dimensions={
      chemistry:{score:chemistry.score,max:25,label:'Name chemistry'},
      personality:{score:personality.score,max:25,label:'Personality'},
      mood:{score:mood.score,max:20,label:'Mood'},
      season:{score:season.score,max:15,label:'Season'},
      symbolism:{score:symbolism.score,max:10,label:'Story symbol'},
      novelty:{score:novelty.score,max:5,label:'Novelty'}
    };

    const reasons=[];
    if(chemistry.reason) reasons.push(chemistry.reason);
    if(symbolism.reason) reasons.push(symbolism.reason);
    if(personality.hits.length) reasons.push(`personality fit: ${personality.hits.slice(0,3).join(', ')}`);
    if(mood.hits.length) reasons.push(`mood fit: ${mood.hits.slice(0,2).join(', ')}`);
    if(season.hits.length) reasons.push(`season fit: ${season.hits.slice(0,4).join(', ')}`);
    if(novelty.diversity?.penalty) reasons.push(`recent-use penalty: ${novelty.diversity.penalty}`);
    if(dealbreakers.reasons.length) reasons.push(`compatibility caution: ${dealbreakers.reasons.join(', ')}`);
    if(candidate?.iba_official) reasons.push(`IBA ${candidate.iba_category}`);
    if(!reasons.length) reasons.push('balanced profile compatibility');

    const overlap=[];
    for(const tag of movieSet) if(cocktailSet.has(tag)) overlap.push(tag);

    return {
      cocktail:candidate,
      score:total,
      rawScore:Math.round(total+dealbreakers.penalty),
      overlaps:overlap.slice(0,12),
      reasons,
      diversity:novelty.diversity,
      movieFingerprint,
      cocktailFingerprint,
      compatibility:dimensions,
      dealbreakers,
      titleNameMatch:chemistry,
      symbolism,
      matchmakerVersion:'v2'
    };
  }

  function mmRetrieveScore(movie,candidate){
    const chemistry=clTitleCocktailNameMatch(movie,candidate).score;
    const symbolism=mmSymbolism(movie,candidate).score;
    const mf=clMovieFingerprint(movie), cf=clCandidateFingerprint(candidate);
    const ms=mmSet(mf.weights), cs=mmSet(cf);
    let overlap=0;
    for(const tag of ms) if(cs.has(tag)) overlap++;
    let seasonal=0;
    const h=clCleanTag(movie?.holiday||''), s=clCleanTag(movie?.season||'');
    if(h&&cs.has(h)) seasonal+=8;
    if(s&&cs.has(s)) seasonal+=5;
    return chemistry*2.2+symbolism*2.4+Math.min(24,overlap*3)+seasonal;
  }

  clSmartMatch=function(movie,candidate){ return mmCompatibility(movie,candidate); };

  clSmartOriginalMatches=function(movie){
    const catalog=clMergedOriginalCatalog();
    if(!catalog.length) return [];
    const retrieved=catalog.map(c=>({c,retrieve:mmRetrieveScore(movie,c)})).sort((a,b)=>b.retrieve-a.retrieve||String(a.c.name).localeCompare(String(b.c.name)));
    const mustKeep=retrieved.filter(x=>clTitleCocktailNameMatch(movie,x.c).score>=10||mmSymbolism(movie,x.c).score>0);
    const pool=[]; const seen=new Set();
    for(const row of [...mustKeep,...retrieved.slice(0,90)]){
      const key=clNormName(row.c.name); if(seen.has(key)) continue; seen.add(key); pool.push(row.c);
    }
    return pool.map(c=>mmCompatibility(movie,c)).sort((a,b)=>b.score-a.score||b.titleNameMatch.score-a.titleNameMatch.score||b.symbolism.score-a.symbolism.score||String(a.cocktail.name).localeCompare(String(b.cocktail.name)));
  };

  // Three distinct recommendations: overall best, strongest chemistry/symbolism,
  // and a high-quality wildcard that differs in family/base spirit.
  if(typeof clPickThreeBases==='function'){
    clPickThreeBases=function(movie){
      const ranked=clSmartOriginalMatches(movie);
      if(!ranked.length) return [];
      const best=ranked[0];
      const notBest=ranked.filter(r=>clNormName(r.cocktail.name)!==clNormName(best.cocktail.name));
      const chemistry=(notBest.length?notBest:ranked).slice().sort((a,b)=>
        ((b.titleNameMatch?.score||0)*2+(b.symbolism?.score||0)*2+b.score*.35)-((a.titleNameMatch?.score||0)*2+(a.symbolism?.score||0)*2+a.score*.35)
      )[0]||best;
      const chosen=[best,chemistry];
      const wildcardPool=ranked.slice(0,80).filter(r=>!chosen.some(x=>clNormName(x.cocktail.name)===clNormName(r.cocktail.name)));
      const difference=(r)=>{
        let d=0;
        const family=clCleanTag(clInferFamily(r.cocktail));
        const base=clCleanTag(r.cocktail.base_spirit||'');
        for(const x of chosen){
          if(family&&family!==clCleanTag(clInferFamily(x.cocktail))) d+=9;
          if(base&&base!==clCleanTag(x.cocktail.base_spirit||'')) d+=7;
        }
        return d;
      };
      const wildcard=(wildcardPool.length?wildcardPool:notBest).slice().sort((a,b)=>(b.score+difference(b))-(a.score+difference(a)))[0]||best;
      return [
        {role:'Familiar',match:best,matchmakerLabel:'Best Match'},
        {role:'Craft',match:chemistry,matchmakerLabel:'Chemistry Pick'},
        {role:'Wildcard',match:wildcard,matchmakerLabel:'Wildcard'}
      ];
    };
  }

  // Make ranking transparent in the existing cards without replacing the Cocktail UI.
  if(typeof clSmartOriginalResultCard==='function'){
    const originalResultCard=clSmartOriginalResultCard;
    clSmartOriginalResultCard=function(result,index,episode=false){
      let html=originalResultCard(result,index,episode);
      if(!result?.compatibility) return html;
      const d=result.compatibility;
      const chips=[d.chemistry,d.personality,d.mood,d.season,d.symbolism,d.novelty]
        .map(x=>`<span class="pill cl-mm-dim">${esc(x.label)} <strong>${Math.round(Number(x.score||0))}/${x.max}</strong></span>`).join('');
      const hook=(result.titleNameMatch?.score||0)>=12||(result.symbolism?.score||0)>=7
        ? `<div class="cl-mm-hook">💘 <strong>Chemistry hook:</strong> ${esc(result.titleNameMatch?.reason||result.symbolism?.reason||'strong thematic connection')}</div>`:'';
      const breakdown=`<div class="cl-mm-breakdown"><div class="pills">${chips}</div>${hook}</div>`;
      return html.replace('<div class="pills" style="margin-top:8px">',`${breakdown}<div class="pills" style="margin-top:8px">`);
    };
  }

  const style=document.createElement('style');
  style.id='clCocktailMatchmakerV2Styles';
  style.textContent=`
    .cl-mm-breakdown{margin-top:10px;padding:9px 10px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(255,255,255,.025)}
    .cl-mm-breakdown .pills{margin:0}.cl-mm-dim{font-size:.69rem}.cl-mm-dim strong{margin-left:3px}
    .cl-mm-hook{margin-top:8px;font-size:.78rem;line-height:1.35}
  `;
  document.head.appendChild(style);

  window.clSmartMatch=clSmartMatch;
  window.clSmartOriginalMatches=clSmartOriginalMatches;
  window.clTitleCocktailNameMatch=clTitleCocktailNameMatch;
  window.clCocktailMatchmakerCompatibility=mmCompatibility;
  window.clCocktailMatchmakerRetrieveScore=mmRetrieveScore;
})();
