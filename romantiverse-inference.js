// Cheese Louise v1.10 — Romantiverse Interpreter
// Adds context-aware Cheese Trait inference on top of the editable trait library.
// Loaded after movie-discovery.js + v16 audit/filter helpers, and before
// shared-radar-filters.js so the existing fast cache wraps the smarter estimate.

const ROMANTIVERSE_INFERENCE_VERSION = 'v1.10';

const rvBaseSuggestionAliases = typeof suggestionAliases === 'function'
  ? suggestionAliases
  : () => ({});

const ROMANTIVERSE_EXTRA_ALIASES = {
  'Dead parent': [
    'deceased mother','deceased father','deceased parent','deceased parents',
    'her mother died','his mother died','her father died','his father died',
    'lost both parents','parents died','orphan','orphaned'
  ],
  'Dead spouse': [
    'widowed','widow','widower','late husband','late wife','late spouse',
    'her husband died','his wife died','lost her husband','lost his wife'
  ],
  'Bakery': ['bakery','baker','pastry shop','patisserie','cake shop','cupcake shop','bakeshop'],
  'Christmas tree farm': ['christmas tree farm','tree farm','family tree farm'],
  'Inn or B&B': ['inn','bed and breakfast','b&b','guesthouse','family inn'],
  'Vineyard or winery': ['vineyard','winery','winemaker','vintner','wine estate'],
  'Bookstore': ['bookstore','book shop','bookshop','independent bookstore'],
  'Childhood sweetheart': ['childhood sweetheart','high school sweetheart','first love','grew up together','childhood friend'],
  'Old flame': ['old flame','former sweetheart','former boyfriend','former girlfriend','ex boyfriend','ex girlfriend','ex-boyfriend','ex-girlfriend','former fiance','former fiancée','former fiancé'],
  'Fake dating': ['fake dating','pretend to date','pretend couple','fake relationship','pretend relationship','dating for show'],
  'Snowed in together': ['snowed in','snowed-in','blizzard traps','trapped by snow','stranded by snow','stuck together in a storm'],
  'Small-town return': ['returns home','return home','comes home','goes home','moves back home','back to her hometown','back to his hometown','back to their hometown','returns to her hometown','returns to his hometown'],
  'Christmas festival': ['christmas festival','holiday festival','christmas carnival','holiday carnival'],
  'Tree-lighting ceremony': ['tree lighting','tree-lighting','lighting the town tree','christmas tree lighting'],
  'Secret prince or princess': ['secret prince','secret princess','undercover prince','undercover princess','prince in disguise','princess in disguise','royal in disguise','incognito prince','incognito princess'],
  'Commoner meets royal': ['commoner meets royal','ordinary woman meets prince','ordinary man meets princess'],
  'Save the family business': ['save the family business','family business is failing','family business is struggling','family shop is failing','family shop is struggling','keep the family business open'],
  'Inherited family business': ['inherits the family business','inherits her family business','inherits his family business','inherits the bakery','inherits the inn','inherits the shop','takes over the family business'],
  'Property developer villain': ['property developer','real estate developer','redevelopment plan','plans to demolish','plans to tear down','bulldoze the town'],
  'Only one bed': ['only one bed','one bed left','single bed left'],
  'Mysterious hot carpenter': ['mysterious carpenter','handsome carpenter','charming carpenter','local carpenter','handsome handyman','charming handyman'],
  'Saved-the-town fundraiser': ['save the town fundraiser','town fundraiser','fundraiser to save','benefit to save the town'],
  'Save-the-town fundraiser': ['save the town fundraiser','town fundraiser','fundraiser to save','benefit to save the town'],
  'Single parent': ['single mother','single father','single mom','single dad','raising his daughter','raising her daughter','raising his son','raising her son'],
  'Mistaken identity': ['mistaken identity','mistakes him for','mistakes her for','wrong identity'],
  'Forced proximity': ['forced proximity','stuck together','must work together','forced to work together'],
  'Rivals to lovers': ['rivals to lovers','romantic rivals','business rivals','competing against each other'],
  'Time travel': ['time travel','travels back in time','travels through time','sent back in time'],
  'Amnesia': ['amnesia','memory loss','lost her memory','lost his memory']
};

function romantiverseSuggestionAliases(){
  const base = rvBaseSuggestionAliases() || {};
  const merged = {};
  for(const [name,terms] of Object.entries(base)) merged[name] = [...new Set(terms || [])];
  for(const [name,terms] of Object.entries(ROMANTIVERSE_EXTRA_ALIASES)){
    merged[name] = [...new Set([...(merged[name] || []), ...(terms || [])])];
  }
  return merged;
}

// Keep legacy suggestion callers compatible while expanding the vocabulary.
suggestionAliases = romantiverseSuggestionAliases;
window.suggestionAliases = suggestionAliases;

function rvNormalize(value){
  return String(value || '')
    .toLowerCase()
    .replace(/[’‘]/g,"'")
    .replace(/&/g,' and ')
    .replace(/[^a-z0-9']+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function rvSourceText(source){
  return rvNormalize([
    source?.title,
    source?.summary,
    source?.notes,
    source?.network,
    source?.holiday,
    source?.season,
    ...(Array.isArray(source?.providers) ? source.providers : []),
    ...(Array.isArray(source?.why) ? source.why : []),
    ...(Array.isArray(source?.tags) ? source.tags : [])
  ].filter(Boolean).join(' '));
}

function rvContainsPhrase(text, phrase){
  const needle = rvNormalize(phrase);
  if(!needle) return false;
  return (` ${text} `).includes(` ${needle} `);
}

function rvTokens(value){
  const stop = new Set(['a','an','and','or','the','to','of','in','on','for','with','from','at','is']);
  return rvNormalize(value).split(' ').filter(t=>t && !stop.has(t));
}

function rvTraitSimilarity(a,b){
  const aa = new Set(rvTokens(a));
  const bb = new Set(rvTokens(b));
  if(!aa.size || !bb.size) return 0;
  let overlap = 0;
  for(const token of aa) if(bb.has(token)) overlap++;
  if(overlap < 2) return 0;
  return overlap / new Set([...aa,...bb]).size;
}

function rvResolveTrait(targets){
  const active = (state.traits || []).filter(t=>t.is_active);
  const names = Array.isArray(targets) ? targets : [targets];

  for(const target of names){
    const exact = active.find(t=>rvNormalize(t.name)===rvNormalize(target));
    if(exact) return exact;
  }

  let best = null;
  let bestScore = 0;
  for(const target of names){
    for(const trait of active){
      const score = rvTraitSimilarity(target, trait.name);
      if(score > bestScore){ bestScore = score; best = trait; }
    }
  }
  return bestScore >= 0.6 ? best : null;
}

const RV_RULES = [
  {
    targets:['Small-town return','Return to hometown','Back home'], confidence:0.94,
    reason:'returns to a hometown or home community',
    test:({text})=>/\b(return(?:s|ed|ing)?|come(?:s)?|came|go(?:es)?|went|move(?:s|d)?) (?:back )?(?:home|to (?:her|his|their|the) hometown|to (?:her|his|their) small town)\b/.test(text)
      || /\bback (?:home|in (?:her|his|their) hometown)\b/.test(text)
  },
  {
    targets:['Big-city career woman','Big city career','High-powered career'], confidence:0.78,
    reason:'high-powered city career collides with hometown life',
    test:({text})=>/\b(executive|corporate|career driven|career-driven|lawyer|attorney|marketing director|publicist|architect|businesswoman|ceo|editor)\b/.test(text)
      && /\b(new york|manhattan|chicago|los angeles|big city|city life|hometown|returns home|return home)\b/.test(text)
      && /\b(she|her|woman|businesswoman|female)\b/.test(text)
  },
  {
    targets:['Dead parent'], confidence:0.97,
    reason:'a parent is explicitly deceased or absent through death',
    test:({text})=>/\b(late|deceased) (?:mother|father|mom|dad|parent)\b/.test(text)
      || /\b(?:mother|father|mom|dad|parent|parents) (?:died|passed away)\b/.test(text)
      || /\b(?:orphan|orphaned)\b/.test(text)
  },
  {
    targets:['Dead spouse'], confidence:0.98,
    reason:'the protagonist is widowed or has a deceased spouse',
    test:({text})=>/\b(widow|widower|widowed)\b/.test(text)
      || /\b(late|deceased) (?:husband|wife|spouse)\b/.test(text)
      || /\b(?:husband|wife|spouse) (?:died|passed away)\b/.test(text)
  },
  {
    targets:['Childhood sweetheart','Childhood friends to lovers'], confidence:0.93,
    reason:'a first love or childhood connection is rekindled',
    test:({text})=>/\b(childhood sweetheart|high school sweetheart|first love|grew up together|childhood friend)\b/.test(text)
      || /\breconnect(?:s|ed|ing)? with (?:her|his|their) (?:childhood|high school)\b/.test(text)
  },
  {
    targets:['Old flame','Second-chance romance'], confidence:0.91,
    reason:'a former romantic connection returns',
    test:({text})=>/\b(old flame|former sweetheart|former (?:boyfriend|girlfriend|fiance|fiancee)|ex boyfriend|ex girlfriend|ex-boyfriend|ex-girlfriend)\b/.test(text)
      || /\breconnect(?:s|ed|ing)? with (?:an?|her|his|their) (?:ex|former love|old love)\b/.test(text)
  },
  {
    targets:['Fake dating','Fake relationship'], confidence:0.98,
    reason:'the leads agree to pretend to be romantically involved',
    test:({text})=>/\b(fake dating|pretend to date|pretend couple|fake relationship|pretend relationship|pose as (?:a )?couple)\b/.test(text)
  },
  {
    targets:['Snowed in together','Stranded together'], confidence:0.96,
    reason:'weather strands the leads together',
    test:({text})=>/\b(snowed in|trapped by (?:a )?(?:snowstorm|blizzard|snow)|stranded by (?:a )?(?:snowstorm|blizzard|snow)|stuck together (?:during|in) (?:a )?(?:storm|blizzard))\b/.test(text)
  },
  {
    targets:['Only one bed'], confidence:0.99,
    reason:'there is, catastrophically, only one bed',
    test:({text})=>/\b(only one bed|one bed left|single bed left)\b/.test(text)
  },
  {
    targets:['Inherited family business','Inherits family business'], confidence:0.94,
    reason:'a family business or property is inherited/taken over',
    test:({text})=>/\binherit(?:s|ed|ing)? (?:her |his |their |the )?(?:family )?(?:business|bakery|inn|shop|store|farm|vineyard|winery|bookstore|cafe|restaurant)\b/.test(text)
      || /\btakes? over (?:her |his |their |the )?family (?:business|bakery|inn|shop|store|farm|vineyard|winery|bookstore|cafe|restaurant)\b/.test(text)
  },
  {
    targets:['Save the family business','Saving the family business'], confidence:0.90,
    reason:'a struggling family business must be rescued',
    test:({text})=>/\b(?:family|parents'?|mother'?s|father'?s) (?:business|bakery|inn|shop|store|farm|vineyard|winery|bookstore|cafe|restaurant)\b/.test(text)
      && /\b(save|saving|struggling|failing|close|closing|closure|foreclosure|keep .* open)\b/.test(text)
  },
  {
    targets:['Christmas festival','Holiday festival'], confidence:0.97,
    reason:'the plot revolves around a Christmas/holiday festival',
    test:({text})=>/\b(christmas|holiday) (?:festival|carnival|fair|fest)\b/.test(text)
  },
  {
    targets:['Tree-lighting ceremony','Tree lighting'], confidence:0.98,
    reason:'a ceremonial tree lighting appears in the plot',
    test:({text})=>/\b(tree lighting|tree-lighting|lighting (?:of )?(?:the )?(?:town |christmas )?tree)\b/.test(text)
  },
  {
    targets:['Christmas tree farm'], confidence:0.99,
    reason:'Christmas tree farm detected',
    test:({text})=>/\bchristmas tree farm\b/.test(text) || /\bfamily tree farm\b/.test(text)
  },
  {
    targets:['Bakery'], confidence:0.98,
    reason:'bakery/baking business is part of the premise',
    test:({text})=>/\b(bakery|baker|bakeshop|pastry shop|patisserie|cake shop|cupcake shop)\b/.test(text)
  },
  {
    targets:['Inn or B&B','Inn','Bed and breakfast'], confidence:0.95,
    reason:'an inn or B&B is central to the setting',
    test:({text})=>/\b(inn|bed and breakfast|b and b|guesthouse)\b/.test(text)
  },
  {
    targets:['Vineyard or winery','Vineyard','Winery'], confidence:0.97,
    reason:'vineyard/winery setting detected',
    test:({text})=>/\b(vineyard|winery|winemaker|vintner|wine estate)\b/.test(text)
  },
  {
    targets:['Bookstore','Book shop'], confidence:0.98,
    reason:'bookstore setting detected',
    test:({text})=>/\b(bookstore|bookshop|book shop)\b/.test(text)
  },
  {
    targets:['Secret prince or princess','Secret royal','Royal in disguise'], confidence:0.97,
    reason:'royal identity is hidden or disguised',
    test:({text})=>/\b(secret|undercover|incognito|disguised?) (?:prince|princess|royal)\b/.test(text)
      || /\b(?:prince|princess|royal) (?:in disguise|traveling incognito|travelling incognito)\b/.test(text)
  },
  {
    targets:['Commoner meets royal','Royal/commoner romance'], confidence:0.83,
    reason:'an ordinary protagonist is paired with royalty',
    test:({text})=>/\b(prince|princess|duke|duchess|royal)\b/.test(text)
      && /\b(baker|teacher|writer|journalist|designer|chef|photographer|doctor|nurse|shop owner|small town|ordinary|commoner)\b/.test(text)
  },
  {
    targets:['Property developer villain','Developer villain'], confidence:0.88,
    reason:'a development/redevelopment threat creates the conflict',
    test:({text})=>/\b(developer|redevelopment|development company|real estate company)\b/.test(text)
      && /\b(demolish|tear down|bulldoze|buy out|buyout|threaten|replace|redevelop|close)\b/.test(text)
  },
  {
    targets:['Mysterious hot carpenter','Hot carpenter','Handyman love interest'], confidence:0.74,
    reason:'a suspiciously useful carpenter/handyman love-interest archetype appears',
    test:({text})=>/\b(carpenter|handyman|contractor|builder|woodworker)\b/.test(text)
      && /\b(handsome|charming|mysterious|local|helps|restore|renovate|repair)\b/.test(text)
  },
  {
    targets:['Saved-the-town fundraiser','Save-the-town fundraiser','Town fundraiser'], confidence:0.88,
    reason:'a fundraiser/benefit is being used to save a local institution or town tradition',
    test:({text})=>/\b(fundraiser|benefit|charity event|raise money|fundraising)\b/.test(text)
      && /\b(save|keep .* open|town|community|festival|school|library|business)\b/.test(text)
  },
  {
    targets:['Single parent'], confidence:0.91,
    reason:'single-parent household is explicit in the premise',
    test:({text})=>/\b(single (?:mother|father|mom|dad|parent))\b/.test(text)
      || /\b(?:raising|raises) (?:her|his|their) (?:daughter|son|child|children) alone\b/.test(text)
  },
  {
    targets:['Mistaken identity'], confidence:0.95,
    reason:'the romance starts with a mistaken identity',
    test:({text})=>/\b(mistaken identity|mistakes? (?:him|her) for|wrong identity)\b/.test(text)
  },
  {
    targets:['Forced proximity'], confidence:0.82,
    reason:'the leads are forced to spend time/work together',
    test:({text})=>/\b(forced to work together|must work together|stuck together|forced proximity|have to work together)\b/.test(text)
  },
  {
    targets:['Rivals to lovers','Romantic rivals'], confidence:0.84,
    reason:'the leads begin as rivals or competitors',
    test:({text})=>/\b(rivals?|competitors?|competing against each other|business rivals)\b/.test(text)
      && /\b(love|romance|romantic|sparks|attraction|chemistry)\b/.test(text)
  },
  {
    targets:['Time travel'], confidence:0.99,
    reason:'time travel is explicit in the premise',
    test:({text})=>/\b(time travel|travels? back in time|travels? through time|sent back in time)\b/.test(text)
  },
  {
    targets:['Amnesia'], confidence:0.99,
    reason:'amnesia/memory loss is explicit in the premise',
    test:({text})=>/\b(amnesia|memory loss|lost (?:her|his|their) memory|cannot remember (?:her|his|their) past)\b/.test(text)
  }
];

const RV_COMBOS = [
  {
    targets:['Small-town return'], confidence:0.82,
    reason:'hometown language plus an out-of-town career strongly implies a return-home setup',
    test:({text})=>/\b(hometown|small town)\b/.test(text)
      && /\b(executive|corporate|career|new york|chicago|los angeles|city)\b/.test(text)
  },
  {
    targets:['Old flame','Second-chance romance'], confidence:0.79,
    reason:'reconnection language plus a shared past suggests a second-chance romance',
    test:({text})=>/\b(reconnect|reunite|returns to|back home)\b/.test(text)
      && /\b(former|past|years ago|once loved|old friend|first love)\b/.test(text)
  },
  {
    targets:['Save the family business','Saving the family business'], confidence:0.78,
    reason:'family-owned setting plus closure/debt language implies a rescue-the-business plot',
    test:({text})=>/\b(family owned|family-owned|family (?:shop|store|inn|bakery|farm|business))\b/.test(text)
      && /\b(debt|foreclosure|closing|closure|struggling|failing|last chance)\b/.test(text)
  }
];

function rvConfidenceLabel(value){
  if(value >= 0.88) return 'High';
  if(value >= 0.74) return 'Medium';
  return 'Possible';
}

function rvAddMatch(map, trait, confidence, reason, source){
  if(!trait) return;
  const next = {trait, confidence, reason, source};
  const current = map.get(trait.id);
  if(!current || confidence > current.confidence){
    map.set(trait.id, next);
  }
}

function romantiverseAnalyze(source){
  const text = rvSourceText(source);
  const matches = new Map();
  const aliases = romantiverseSuggestionAliases();

  for(const trait of (state.traits || []).filter(t=>t.is_active)){
    const terms = [trait.name, ...(aliases[trait.name] || [])];
    const hit = terms.find(term=>rvContainsPhrase(text, term));
    if(hit){
      rvAddMatch(matches, trait, 0.98, `Synopsis directly signals “${hit}”`, 'exact');
    }
  }

  const ctx = {source, text};
  for(const rule of [...RV_RULES, ...RV_COMBOS]){
    let matched = false;
    try{ matched = !!rule.test(ctx); }catch(err){ console.warn('Romantiverse rule failed', err); }
    if(!matched) continue;
    const trait = rvResolveTrait(rule.targets);
    rvAddMatch(matches, trait, rule.confidence, rule.reason, 'inferred');
  }

  const ordered = [...matches.values()]
    .filter(m=>m.confidence >= 0.72)
    .sort((a,b)=>b.confidence-a.confidence || Number(b.trait.points||0)-Number(a.trait.points||0) || a.trait.name.localeCompare(b.trait.name));

  const score = ordered.reduce((sum,m)=>sum+Number(m.trait.points||0),0);
  const weighted = ordered.reduce((sum,m)=>sum+(m.confidence*Math.max(1,Number(m.trait.points||0))),0);
  const weight = ordered.reduce((sum,m)=>sum+Math.max(1,Number(m.trait.points||0)),0);
  const confidence = weight ? weighted/weight : 0;

  return {
    traits: ordered.map(m=>m.trait),
    matches: ordered,
    score,
    confidence,
    confidenceLabel: ordered.length ? rvConfidenceLabel(confidence) : 'Not enough data'
  };
}

// Upgrade both the discovery intake and the saved-movie suggestion button.
discoveryTraitSuggestions = function(candidate){
  return romantiverseAnalyze(candidate).traits;
};

discoveryEstimate = function(candidate){
  return romantiverseAnalyze(candidate);
};

function rvMatchDetailsHtml(est){
  if(!est.matches?.length){
    return '<div class="subtle">The synopsis does not contain enough Romantiverse evidence for a useful estimate yet. Add the movie anyway and score it manually after watching.</div>';
  }
  const rows = est.matches.slice(0,8).map(m=>{
    const label = rvConfidenceLabel(m.confidence);
    return `<div class="subtle" style="margin-top:6px"><strong>${esc(m.trait.name)}</strong> <span class="pill">${label}</span> — ${esc(m.reason)}</div>`;
  }).join('');
  const more = est.matches.length>8 ? `<div class="subtle" style="margin-top:6px">+ ${est.matches.length-8} more likely trait${est.matches.length-8===1?'':'s'}</div>` : '';
  return rows + more;
}

discoveryCard = function(c){
  const est = discoveryEstimate(c);
  const providerText = (c.providers||[]).slice(0,3).join(' · ') || c.network || 'Provider not listed yet';
  const date = c.premiere_date || 'Date TBA';
  const meta = [c.holiday,c.season].filter(Boolean).join(' · ');
  const why = (c.why||[]).slice(0,6);
  const confidence = est.traits.length ? `${est.confidenceLabel} confidence · ${est.traits.length} likely Cheese Tray-T${est.traits.length===1?'':'s'}` : 'Synopsis too thin for a confident estimate';

  return `<article class="new-find-card card">
    <div class="new-find-poster">${c.poster_url?`<img src="${esc(c.poster_url)}" alt="${esc(c.title)} poster" loading="lazy">`:`<div class="new-find-poster-fallback">CL</div>`}</div>
    <div class="new-find-body">
      <div class="new-find-topline"><span class="kicker">${esc(c.network||'Streaming / TV')}</span><span class="radar-match">🎯 ${Number(c.match_score||0)} match</span></div>
      <h3>${esc(c.title)}</h3>
      <div class="subtle">${esc(date)}${meta?` · ${esc(meta)}`:''}</div>
      <div class="subtle provider-line">${esc(providerText)}</div>
      <p>${esc(c.summary||'No synopsis yet.')}</p>
      <div class="new-find-score"><strong>Romantiverse Estimate</strong><span class="cheese-score">🧀 ${est.score}</span></div>
      <div class="subtle">${esc(confidence)}</div>
      ${est.traits.length?`<div class="pills">${est.matches.slice(0,5).map(m=>`<span class="pill trait-pill">${esc(m.trait.name)} <b>+${m.trait.points}</b></span>`).join('')}${est.traits.length>5?`<span class="pill">+${est.traits.length-5} more</span>`:''}</div>`:''}
      <details class="new-find-why"><summary>Why does the Romantiverse Interpreter think that?</summary>${rvMatchDetailsHtml(est)}</details>
      ${why.length?`<details class="new-find-why"><summary>Why is this on my radar?</summary><div class="pills">${why.map(x=>`<span class="pill">${esc(x)}</span>`).join('')}</div></details>`:''}
      <div class="new-find-actions">
        <button class="primary" onclick="addDiscoveredMovie(${Number(c.tmdb_id)},true)">${est.traits.length?`Add + accept ${est.traits.length} likely traits`:'Add to Radar'}</button>
        ${est.traits.length?`<button class="secondary" onclick="addDiscoveredMovie(${Number(c.tmdb_id)},false)">Add only</button>`:''}
        <button class="secondary" onclick="hideDiscoveredMovie(${Number(c.tmdb_id)})">Hide for now</button>
        <a class="button-link" href="${esc(c.source_url||'#')}" target="_blank" rel="noopener">TMDB ↗</a>
      </div>
    </div>
  </article>`;
};

suggestTraits = async function(movieId){
  const movie = state.movies.find(x=>x.id===movieId);
  if(!movie) return;
  const analysis = romantiverseAnalyze(movie);
  const suggestions = analysis.matches.filter(m=>!movie.selectedTraitIds?.includes(m.trait.id));
  if(!suggestions.length){
    return alert('The Romantiverse Interpreter did not find any new likely Cheese Traits in this synopsis yet. You can still score the movie manually.');
  }

  const lines = suggestions.map(m=>`• ${m.trait.name} (+${m.trait.points}) — ${rvConfidenceLabel(m.confidence)}: ${m.reason}`);
  if(!confirm(`Romantiverse Interpreter suggests:\n\n${lines.join('\n')}\n\nEstimated added cheese: +${suggestions.reduce((s,m)=>s+Number(m.trait.points||0),0)}\n\nAdd all of these? You can remove any of them afterward.`)) return;

  const rows = suggestions.map(m=>({workspace_id:workspace.id,movie_id:movieId,trait_id:m.trait.id,selected_by:me()}));
  const {error} = await db.from('movie_traits').insert(rows);
  if(error) return alert(error.message);
  await logActivity(`accepted ${suggestions.length} Romantiverse Interpreter suggestion${suggestions.length===1?'':'s'} for ${movie.title}.`,'movie',movieId);
  await loadAll();
  render();
};
window.suggestTraits = suggestTraits;
window.romantiverseAnalyze = romantiverseAnalyze;

// Make the new inference build visible. shared-radar-filters loads next and leaves
// v1.10 alone because it only upgrades older v1.6/v1.7 labels.
const rvOriginalTopbar = topbar;
topbar = function(){
  return rvOriginalTopbar()
    .replace('>v1.6<','>v1.10<')
    .replace('>v1.7<','>v1.10<')
    .replace('>v1.8<','>v1.10<')
    .replace('>v1.9<','>v1.10<');
};
