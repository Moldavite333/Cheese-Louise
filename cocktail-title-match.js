// Cheese Louise — Movie-title ↔ cocktail-name matching layer.
// Adds a strong lexical "title hook" without replacing Cocktail Intelligence.
// Example: a movie title containing "Bird" strongly boosts Jungle Bird.

(() => {
  if (typeof clSmartMatch !== 'function' || typeof clNormName !== 'function') return;

  const originalSmartMatch = clSmartMatch;

  // Words that are too common in Romantiverse titles to deserve a large name-match bonus.
  const TITLE_STOP = new Set([
    'a','an','the','and','or','of','to','in','on','at','for','from','with','by','as','is','are','was','were','be','been',
    'my','your','our','their','his','her','this','that','these','those','one','two','three','movie','story','tale'
  ]);

  // These are useful signals, but common enough that they only get a small boost.
  const TITLE_WEAK = new Set([
    'love','romance','romantic','christmas','holiday','winter','spring','summer','fall','autumn','wedding','heart','hearts','home','hometown'
  ]);

  function titleCanonicalWord(word){
    let w=String(word||'').toLowerCase().trim();
    if(!w || w==='s') return '';
    // Light singularization so Birds/Bee's/Roses still match Bird/Bee/Rose.
    if(w.length>4 && w.endsWith('ies')) w=w.slice(0,-3)+'y';
    else if(w.length>3 && w.endsWith('s') && !w.endsWith('ss')) w=w.slice(0,-1);
    return w;
  }

  function titleWords(value){
    return clNormName(value).split(/\s+/).map(titleCanonicalWord).filter(Boolean);
  }

  function titleStrongWords(value){
    return [...new Set(titleWords(value).filter(w=>w.length>=3 && !TITLE_STOP.has(w) && !TITLE_WEAK.has(w)))];
  }

  function phraseContains(haystack,needle){
    const h=` ${clNormName(haystack)} `;
    const n=` ${clNormName(needle)} `;
    return n.trim().length>0 && h.includes(n);
  }

  function clTitleCocktailNameMatch(movie,candidate){
    const movieTitle=String(movie?.title||'').trim();
    const cocktailName=String(candidate?.name||candidate?.strDrink||'').trim();
    if(!movieTitle || !cocktailName) return {bonus:0,tokens:[],reason:null,type:null};

    const movieNorm=clNormName(movieTitle);
    const cocktailNorm=clNormName(cocktailName);
    const movieStrong=titleStrongWords(movieTitle);
    const cocktailStrong=titleStrongWords(cocktailName);
    const cocktailSet=new Set(cocktailStrong);
    const sharedStrong=movieStrong.filter(w=>cocktailSet.has(w));

    const movieWeak=new Set(titleWords(movieTitle).filter(w=>TITLE_WEAK.has(w)));
    const cocktailWeak=new Set(titleWords(cocktailName).filter(w=>TITLE_WEAK.has(w)));
    const sharedWeak=[...movieWeak].filter(w=>cocktailWeak.has(w));

    let bonus=0;
    let type=null;

    if(movieNorm===cocktailNorm){
      bonus=50;
      type='exact title/name match';
    }else if(cocktailStrong.length && (phraseContains(movieTitle,cocktailName) || phraseContains(cocktailName,movieTitle))){
      bonus=38;
      type='title/name phrase match';
    }else if(sharedStrong.length){
      const first=sharedStrong[0];
      bonus = first.length>=6 ? 27 : first.length>=4 ? 24 : 19;
      bonus += Math.min(14,Math.max(0,sharedStrong.length-1)*7);
      type='title/name word match';
    }

    // Generic Romantiverse words can help break ties, but cannot create a huge match by themselves.
    if(sharedWeak.length){
      bonus += Math.min(7,4 + Math.max(0,sharedWeak.length-1)*2);
      if(!type) type='title/name theme word';
    }

    bonus=Math.min(50,bonus);
    const tokens=[...sharedStrong,...sharedWeak];
    const reason=bonus
      ? `${type}: ${tokens.length?tokens.join(', '):cocktailName}`
      : null;
    return {bonus,tokens,reason,type};
  }

  clSmartMatch = function(movie,candidate){
    const result=originalSmartMatch(movie,candidate);
    const titleMatch=clTitleCocktailNameMatch(movie,candidate);
    if(!titleMatch.bonus) return {...result,titleNameMatch:titleMatch};

    const raw=Math.min(125,Number(result.rawScore||result.score||0)+titleMatch.bonus);
    const diversityPenalty=Number(result?.diversity?.penalty||0);
    const adjusted=Math.max(8,Math.min(99,Math.round(raw-diversityPenalty)));
    const reasons=[titleMatch.reason,...(result.reasons||[])].filter(Boolean);

    return {
      ...result,
      score:adjusted,
      rawScore:Math.round(raw),
      reasons,
      titleNameMatch:titleMatch
    };
  };

  window.clSmartMatch=clSmartMatch;
  window.clTitleCocktailNameMatch=clTitleCocktailNameMatch;
})();
