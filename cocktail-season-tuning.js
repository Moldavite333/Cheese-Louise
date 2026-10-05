// Cheese Louise — seasonal cocktail tuning v1
// Loaded after Cocktail Matchmaker v2. Tightens Fall/Christmas/etc. scoring around
// actual recipe ingredients, spirit and style rather than generic inherited tags.

(() => {
  if (typeof clSmartOriginalMatches !== 'function' ||
      typeof clMergedOriginalCatalog !== 'function' ||
      typeof clCleanTag !== 'function') return;

  const baseCatalogMatches = clSmartOriginalMatches;
  const baseCompatibility = window.clCocktailMatchmakerCompatibility || clSmartMatch;

  const PROFILES = {
    fall: {
      label:'Autumn',
      ingredients:[
        [/\bapple\b|apple cider|calvados|applejack/i,'apple / cider',4],
        [/\bpear\b/i,'pear',3],
        [/\bmaple\b/i,'maple',3],
        [/pumpkin/i,'pumpkin',4],
        [/cinnamon|nutmeg|allspice|clove|cardamom/i,'baking spice',2.5],
        [/cranberry/i,'cranberry',2],
        [/ginger/i,'ginger',1.5],
        [/black tea|chai|tea\b/i,'tea',1.5],
        [/walnut|pecan|hazelnut|orgeat/i,'nutty',2.5],
        [/\bfig\b|date syrup|\bdates?\b/i,'fig / date',2],
        [/caramel|brown sugar|molasses/i,'brown-sugar richness',2.5],
        [/honey/i,'honey',1]
      ],
      spirits:[
        [/bourbon|rye|whisk(?:e)?y/i,'whiskey',2.5],
        [/brandy|cognac|calvados|applejack/i,'brandy',2.5],
        [/aged rum|dark rum/i,'aged rum',2]
      ],
      styles:[
        [/warming|spiced|spirit-forward|old fashioned|manhattan/i,'warming / spirit-forward',2],
        [/rich|herbal|tea/i,'rich / herbal',1]
      ],
      negatives:[
        [/coconut|pineapple|passion ?fruit|mango/i,'tropical fruit',3.5],
        [/watermelon/i,'watermelon',3],
        [/cucumber/i,'cucumber',2.5],
        [/peppermint/i,'peppermint',2]
      ]
    },
    winter: {
      label:'Winter',
      ingredients:[
        [/cinnamon|nutmeg|allspice|clove|cardamom/i,'baking spice',3],
        [/coffee|espresso/i,'coffee',2.5],
        [/chocolate|cacao|cocoa/i,'chocolate',2.5],
        [/cream|milk|eggnog/i,'cream / eggnog',2.5],
        [/maple|molasses|brown sugar/i,'dark sweetener',2],
        [/ginger/i,'ginger',2],
        [/black tea|chai|tea\b/i,'tea',1.5],
        [/orange/i,'orange',1.5],
        [/cranberry/i,'cranberry',2]
      ],
      spirits:[
        [/bourbon|rye|whisk(?:e)?y/i,'whiskey',2.5],
        [/brandy|cognac/i,'brandy',2.5],
        [/dark rum|aged rum/i,'aged rum',2]
      ],
      styles:[
        [/warming|rich|creamy|spirit-forward|hot/i,'warming / rich',2.5]
      ],
      negatives:[
        [/coconut|pineapple|passion ?fruit|mango/i,'tropical fruit',3],
        [/watermelon|cucumber/i,'summer produce',2.5]
      ]
    },
    christmas: {
      label:'Christmas',
      ingredients:[
        [/cranberry/i,'cranberry',3.5],
        [/rosemary/i,'rosemary',2.5],
        [/orange|mandarin|tangerine/i,'orange',1.5],
        [/cinnamon|clove|nutmeg|allspice|cardamom/i,'Christmas spice',3],
        [/ginger|gingerbread/i,'ginger',2.5],
        [/peppermint|candy cane|mint/i,'peppermint / mint',2.5],
        [/chocolate|cacao|cocoa/i,'chocolate',2.5],
        [/coffee|espresso/i,'coffee',1.5],
        [/cream|eggnog|milk/i,'cream / eggnog',3],
        [/vanilla/i,'vanilla',1.5],
        [/molasses|gingerbread/i,'molasses / gingerbread',2.5],
        [/champagne|prosecco|sparkling wine|cava/i,'sparkling wine',2.5],
        [/pomegranate/i,'pomegranate',2],
        [/cherry/i,'cherry',1.5]
      ],
      spirits:[
        [/brandy|cognac/i,'brandy',2.5],
        [/bourbon|rye|whisk(?:e)?y/i,'whiskey',2],
        [/aged rum|dark rum/i,'aged rum',2],
        [/gin/i,'gin / juniper',1.5],
        [/champagne|prosecco|sparkling wine/i,'sparkling wine',2.5]
      ],
      styles:[
        [/sparkling|celebratory/i,'celebratory',2],
        [/warming|creamy|dessert|rich|spiced/i,'cozy holiday style',2]
      ],
      negatives:[
        [/coconut|pineapple|passion ?fruit|mango/i,'tropical fruit',4],
        [/watermelon/i,'watermelon',4],
        [/cucumber/i,'cucumber',2.5],
        [/blue cura[cç]ao|blue curacao/i,'blue tropical style',3]
      ]
    },
    thanksgiving: {
      label:'Thanksgiving',
      ingredients:[
        [/pumpkin/i,'pumpkin',4],
        [/cranberry/i,'cranberry',3.5],
        [/apple|apple cider/i,'apple / cider',3.5],
        [/pear/i,'pear',2.5],
        [/maple/i,'maple',3],
        [/pecan|walnut|hazelnut/i,'nuts',3],
        [/cinnamon|nutmeg|allspice|clove|cardamom/i,'baking spice',3],
        [/brown sugar|molasses|caramel/i,'brown-sugar richness',2.5],
        [/ginger/i,'ginger',1.5]
      ],
      spirits:[
        [/bourbon|rye|whisk(?:e)?y/i,'whiskey',2.5],
        [/brandy|cognac|calvados/i,'brandy',2.5],
        [/aged rum|dark rum/i,'aged rum',2]
      ],
      styles:[[/warming|rich|spiced|spirit-forward/i,'warming / rich',2]],
      negatives:[
        [/coconut|pineapple|passion ?fruit|mango/i,'tropical fruit',4],
        [/watermelon|cucumber/i,'summer produce',3]
      ]
    },
    halloween: {
      label:'Halloween',
      ingredients:[
        [/blackberry|black currant|cassis/i,'dark berries',3.5],
        [/blood orange/i,'blood orange',3.5],
        [/pomegranate|cherry/i,'deep red fruit',2.5],
        [/black tea|coffee|espresso/i,'dark roast / tea',2],
        [/cinnamon|clove|allspice/i,'dark spice',2],
        [/absinthe/i,'absinthe',2.5],
        [/amaro|fernet/i,'amaro',2.5]
      ],
      spirits:[
        [/mezcal/i,'smoky mezcal',3],
        [/dark rum/i,'dark rum',2.5],
        [/whisk(?:e)?y|rye|bourbon/i,'dark spirit',2]
      ],
      styles:[[/dark|smoky|bitter|spiced|herbal|spirit-forward/i,'dark / dramatic',2.5]],
      negatives:[[/coconut|watermelon/i,'sunny tropical profile',2.5]]
    },
    spring: {
      label:'Spring',
      ingredients:[
        [/elderflower/i,'elderflower',4],
        [/lavender|rose water|rose syrup|hibiscus/i,'floral',3.5],
        [/cucumber/i,'cucumber',3],
        [/lemon|grapefruit/i,'bright citrus',2],
        [/strawberry/i,'strawberry',2.5],
        [/mint|basil/i,'fresh herbs',2],
        [/aperol/i,'aperitivo',1.5],
        [/champagne|prosecco|sparkling wine|cava/i,'sparkling wine',2]
      ],
      spirits:[
        [/gin/i,'gin',2.5],
        [/champagne|prosecco|sparkling wine/i,'sparkling wine',2]
      ],
      styles:[[/floral|light|refreshing|sparkling|spritz|bright/i,'light / floral',2.5]],
      negatives:[
        [/eggnog|molasses|brown sugar/i,'heavy winter richness',3],
        [/coffee|espresso|chocolate|cacao/i,'dark dessert profile',2.5],
        [/dark rum/i,'dark rum',2]
      ]
    },
    summer: {
      label:'Summer',
      ingredients:[
        [/pineapple|passion ?fruit|mango|guava/i,'tropical fruit',3.5],
        [/coconut/i,'coconut',3],
        [/watermelon/i,'watermelon',3.5],
        [/lime|lemon|grapefruit/i,'citrus',2],
        [/cucumber/i,'cucumber',2.5],
        [/mint/i,'mint',2],
        [/soda|tonic|sparkling water/i,'bubbles',1.5]
      ],
      spirits:[
        [/white rum|light rum|rum\b/i,'rum',2.5],
        [/tequila/i,'tequila',2.5],
        [/mezcal/i,'mezcal',1.5],
        [/gin/i,'gin',1.5]
      ],
      styles:[[/refreshing|highball|spritz|tiki|frozen|long/i,'refreshing / long',2.5]],
      negatives:[
        [/eggnog|cream|heavy cream/i,'heavy cream',3.5],
        [/coffee|espresso|chocolate|cacao/i,'dark dessert profile',2.5],
        [/molasses|cinnamon|clove|nutmeg/i,'winter spice',2.5]
      ]
    },
    valentine: {
      label:'Valentine’s',
      ingredients:[
        [/strawberry|raspberry|blackberry/i,'berries',3.5],
        [/cherry/i,'cherry',2.5],
        [/rose water|rose syrup|hibiscus/i,'rose / hibiscus',3],
        [/chocolate|cacao|cocoa/i,'chocolate',3],
        [/elderflower/i,'elderflower',2.5],
        [/champagne|prosecco|sparkling wine|cava/i,'sparkling wine',3]
      ],
      spirits:[[/champagne|prosecco|sparkling wine/i,'sparkling wine',2.5],[/gin/i,'gin',1.5]],
      styles:[[/romantic|floral|sparkling|elegant|pink/i,'romantic / elegant',2.5]],
      negatives:[[/savory|beer|ale/i,'savory / beer-forward',2.5]]
    },
    newyear: {
      label:'New Year’s',
      ingredients:[
        [/champagne|prosecco|sparkling wine|cava/i,'sparkling wine',5],
        [/lemon|orange|grapefruit/i,'citrus',1.5],
        [/elderflower/i,'elderflower',2],
        [/pomegranate|cherry/i,'jewel-toned fruit',2]
      ],
      spirits:[[/cognac|brandy/i,'cognac / brandy',2],[/gin|vodka/i,'clean spirit',1.5]],
      styles:[[/sparkling|celebratory|elegant|martini/i,'celebratory / elegant',3]],
      negatives:[[/creamy|eggnog|hot coffee/i,'heavy nightcap style',2]]
    }
  };

  function stMovieText(movie){
    return [movie?.title,movie?.summary,movie?.notes,movie?.holiday,movie?.season,...(movie?.tags||[]),...(movie?.selectedTraits||[]).map(t=>`${t.name} ${t.category}`)]
      .filter(Boolean).join(' ').toLowerCase();
  }

  function stKey(movie){
    const holiday=clCleanTag(movie?.holiday||'');
    const season=clCleanTag(movie?.season||'');
    const text=stMovieText(movie);
    if(holiday.includes('christmas') || /\bchristmas\b|mistletoe|santa|xmas/.test(text)) return 'christmas';
    if(holiday.includes('halloween') || /\bhalloween\b|spooky|haunted/.test(text)) return 'halloween';
    if(holiday.includes('thanksgiving') || /\bthanksgiving\b/.test(text)) return 'thanksgiving';
    if(holiday.includes('valentine') || /valentine/.test(text)) return 'valentine';
    if(holiday.includes('new-year') || /new year/.test(text)) return 'newyear';
    if(season==='fall' || season==='autumn' || /\bfall\b|\bautumn\b|harvest/.test(text)) return 'fall';
    if(season==='winter' || /\bwinter\b|snow|ski|lodge/.test(text)) return 'winter';
    if(season==='spring' || /\bspring\b/.test(text)) return 'spring';
    if(season==='summer' || /\bsummer\b/.test(text)) return 'summer';
    return '';
  }

  function stIngredientText(candidate){
    const rows=Array.isArray(candidate?.ingredientRows)
      ? candidate.ingredientRows.map(r=>`${r?.measure||''} ${r?.ingredient||''}`).join(' ')
      : '';
    return [rows,candidate?.ingredients,candidate?.garnish].filter(Boolean).join(' ').toLowerCase();
  }

  function stSpiritText(candidate){
    return [candidate?.base_spirit,candidate?.ingredients,...(candidate?.ingredientRows||[]).map(r=>r?.ingredient)]
      .filter(Boolean).join(' ').toLowerCase();
  }

  function stStyleText(candidate){
    return [candidate?.name,candidate?.style,candidate?.source_category,candidate?.method,candidate?.glassware,...(candidate?.flavor_tags||[])]
      .filter(Boolean).join(' ').toLowerCase();
  }

  function stWeightedHits(text,rules,cap){
    let score=0; const hits=[];
    for(const [re,label,points] of rules||[]){
      if(re.test(text)){ score+=Number(points||0); hits.push(label); }
    }
    return {score:Math.min(cap,score),hits:[...new Set(hits)]};
  }

  function stSeasonScore(movie,candidate){
    const key=stKey(movie);
    const profile=PROFILES[key];
    if(!profile) return null;

    const ingredientText=stIngredientText(candidate);
    const spiritText=stSpiritText(candidate);
    const styleText=stStyleText(candidate);
    const movieText=stMovieText(movie);

    const ingredients=stWeightedHits(ingredientText,profile.ingredients,10);
    const spirits=stWeightedHits(spiritText,profile.spirits,3);
    const styles=stWeightedHits(styleText,profile.styles,3);
    const negatives=stWeightedHits(`${ingredientText} ${spiritText} ${styleText}`,profile.negatives,7);

    let explicit=0;
    const ch=clCleanTag(candidate?.holiday||'');
    const cs=clCleanTag(candidate?.season||'');
    if(ch && ((key==='valentine'&&ch.includes('valentine')) || (key==='newyear'&&ch.includes('new-year')) || ch.includes(key))) explicit+=3;
    if(cs && ((key==='fall'&&['fall','autumn'].includes(cs)) || cs===key)) explicit+=2;

    let negativeScore=negatives.score;
    const tropicalStory=/beach|island|tropical|hawaii|caribbean|resort/.test(movieText);
    if(tropicalStory && ['christmas','winter','fall','thanksgiving'].includes(key) && /tropical fruit|watermelon|cucumber|summer produce/.test(negatives.hits.join(' '))){
      negativeScore*=0.2;
    }

    let score=ingredients.score+spirits.score+styles.score+explicit-negativeScore;

    // Authenticity gate: generic tags alone cannot create a near-perfect seasonal score.
    // A 12–15 should normally mean the recipe itself contains recognizable seasonal cues.
    if(ingredients.score===0 && explicit<3) score=Math.min(score,6);
    else if(ingredients.score<2.5 && explicit<3) score=Math.min(score,9);

    score=Math.max(0,Math.min(15,Math.round(score*10)/10));
    const hits=[...ingredients.hits,...spirits.hits,...styles.hits].filter(Boolean);
    return {
      key,
      label:profile.label,
      score,
      hits:[...new Set(hits)],
      negatives:negatives.hits,
      ingredientScore:ingredients.score,
      negativeScore:Math.round(negativeScore*10)/10
    };
  }

  function stTuneResult(movie,result){
    if(!result?.cocktail || !result?.compatibility?.season) return result;
    const season=stSeasonScore(movie,result.cocktail);
    if(!season) return result;

    const oldSeason=Number(result.compatibility.season.score||0);
    const delta=season.score-oldSeason;
    const score=Math.max(8,Math.min(99,Math.round(Number(result.score||0)+delta)));
    const reasons=(result.reasons||[]).filter(r=>!/^season fit:/i.test(String(r)) && !/^season authenticity:/i.test(String(r)));
    const evidence=season.hits.length ? season.hits.slice(0,5).join(', ') : 'no strong recipe cues';
    reasons.push(`season authenticity: ${season.label} — ${evidence}`);
    if(season.negatives.length) reasons.push(`season contrast: ${season.negatives.slice(0,3).join(', ')}`);

    return {
      ...result,
      score,
      rawScore:Math.round(Number(result.rawScore||result.score||0)+delta),
      reasons,
      compatibility:{
        ...result.compatibility,
        season:{score:season.score,max:15,label:'Season'}
      },
      seasonProfile:season,
      matchmakerVersion:'v2-seasonal-1'
    };
  }

  clSmartMatch=function(movie,candidate){
    return stTuneResult(movie,baseCompatibility(movie,candidate));
  };

  clSmartOriginalMatches=function(movie){
    const baseResults=baseCatalogMatches(movie)||[];
    const catalog=clMergedOriginalCatalog()||[];
    const resultByName=new Map();

    for(const result of baseResults){
      if(!result?.cocktail) continue;
      resultByName.set(clNormName(result.cocktail.name),stTuneResult(movie,result));
    }

    // Add seasonally authentic recipes that the broad first-pass matcher may have missed.
    const seasonalCandidates=catalog
      .map(c=>({c,season:stSeasonScore(movie,c)}))
      .filter(x=>x.season && x.season.score>=5)
      .sort((a,b)=>b.season.score-a.season.score)
      .slice(0,90);

    for(const row of seasonalCandidates){
      const key=clNormName(row.c.name);
      if(resultByName.has(key)) continue;
      resultByName.set(key,stTuneResult(movie,baseCompatibility(movie,row.c)));
    }

    return [...resultByName.values()].sort((a,b)=>
      Number(b.score||0)-Number(a.score||0) ||
      Number(b.titleNameMatch?.score||0)-Number(a.titleNameMatch?.score||0) ||
      Number(b.symbolism?.score||0)-Number(a.symbolism?.score||0) ||
      String(a.cocktail?.name||'').localeCompare(String(b.cocktail?.name||''))
    );
  };

  window.clSmartMatch=clSmartMatch;
  window.clSmartOriginalMatches=clSmartOriginalMatches;
  window.clCocktailSeasonAuthenticity=stSeasonScore;
})();
