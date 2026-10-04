// Cheese Louise v1.20 — Ruleify™
// Turns rough movie-night observations into proposed Rules of the Romantiverse.

let ruleifyObservation = '';
let ruleifyResults = [];
let ruleifySavingIndex = -1;

const RULEIFY_CATEGORIES = [
  'Romance Physics',
  'Career & Economics',
  'Geography',
  'Family',
  'Communication',
  'Holidays & Community',
  'Time & Logistics',
  'Villains',
  'General Physics'
];

function ruleifyNorm(value){
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,' ')
    .trim();
}

function ruleifySentence(value){
  const s = String(value || '').trim().replace(/[.!?]+$/,'');
  if(!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
}

function ruleifyCategoryFor(text){
  const t = ruleifyNorm(text);
  if(/single dad|single father|single mom|single mother|child|children|kid|daughter|son|parent|grandma|grandmother|grandpa|grandfather|family/.test(t)) return 'Family';
  if(/job|career|boss|promotion|corporate|office|business|bakery|bookstore|shop|store|inn|money|financial|inherit|save the/.test(t)) return 'Career & Economics';
  if(/small town|hometown|city|mountain town|village|distance|drive|flight|geography|snowed in/.test(t)) return 'Geography';
  if(/misunderstand|conversation|overhear|tell him|tell her|talk|communicat|secret|phone call|text message/.test(t)) return 'Communication';
  if(/christmas|holiday|festival|parade|tree lighting|fair|wedding|community event|fundraiser/.test(t)) return 'Holidays & Community';
  if(/deadline|three weeks|one week|days|overnight|relocat|move across|suitcase|time/.test(t)) return 'Time & Logistics';
  if(/villain|fiance|fiancee|boyfriend|girlfriend|rival|ex |antagonist|developer/.test(t)) return 'Villains';
  if(/love|romance|kiss|attraction|chemistry|date|dating|forced proximity|fall in love/.test(t)) return 'Romance Physics';
  return 'General Physics';
}

function ruleifyKeywords(text){
  const stop = new Set(['the','a','an','and','or','but','if','then','when','whenever','who','that','this','to','of','for','in','on','at','with','from','is','are','was','were','be','been','being','will','would','can','could','should','must','you','your','yours','they','their','them','he','his','she','her','it','its','any','anyone','someone']);
  return [...new Set(ruleifyNorm(text).split(' ').filter(w => w.length > 2 && !stop.has(w)))];
}

function ruleifySimilarity(a,b){
  const aa = new Set(ruleifyKeywords(a));
  const bb = new Set(ruleifyKeywords(b));
  if(!aa.size || !bb.size) return 0;
  let hit = 0;
  aa.forEach(w => { if(bb.has(w)) hit++; });
  return hit / Math.max(aa.size, bb.size);
}

function ruleifyOverlap(title){
  let best = null;
  let bestScore = 0;
  for(const rule of (state.rules || [])){
    const score = ruleifySimilarity(title, rule.title || '');
    if(score > bestScore){
      bestScore = score;
      best = rule;
    }
  }
  return bestScore >= 0.34 && best ? {rule:best, score:bestScore} : null;
}

function ruleifyCleanSubject(subject){
  return String(subject || '').trim().replace(/^(?:a|an|the)\s+/i,'');
}

function ruleifyThirdPersonPossessive(value, subject){
  let s = String(value || '').trim();
  const lower = ruleifyNorm(subject);
  const possessive = /dad|father|man|widower|boyfriend|fiance/.test(lower) ? 'his' : /mom|mother|woman|widow|girlfriend|fiancee/.test(lower) ? 'her' : 'their';
  s = s.replace(/\byour\b/gi, possessive).replace(/\byours\b/gi, possessive);
  return s;
}

function ruleifySpecial(raw){
  const t = ruleifyNorm(raw);

  if(/single (dad|father)/.test(t) && /(take care|takes care|care for|cares for|look after|looks after|help with|helps with)/.test(t) && /(child|children|kid|kids|daughter|son)/.test(t)){
    return {
      category:'Family',
      confidence:0.98,
      options:[
        {style:'Canon', title:'A single father will inevitably develop romantic feelings for any eligible adult who demonstrates competent care for his children.'},
        {style:'Romantiverse Science', title:'For a single father, romantic attachment increases in direct proportion to competent childcare provided by an eligible partner.'},
        {style:'Constitutional', title:'No single father may receive meaningful childcare assistance from an eligible romantic prospect without eventually falling in love with them.'}
      ]
    };
  }

  if(/(successful|career|corporate|promotion|big city|city job)/.test(t) && /(small town|hometown|return home|moves home|goes home)/.test(t)){
    return {
      category:'Career & Economics',
      confidence:0.94,
      options:[
        {style:'Canon', title:'No successful metropolitan career can survive prolonged exposure to a charming small town.'},
        {style:'Romantiverse Science', title:'Professional ambition decreases in direct proportion to time spent in a sufficiently charming hometown.'},
        {style:'Constitutional', title:'Any protagonist entering a charming small town with a successful city career must reconsider that career before the final act.'}
      ]
    };
  }

  if(/misunderstand|overhear|heard only|walks away|won t explain|doesn t explain|could just talk|one conversation/.test(t)){
    return {
      category:'Communication',
      confidence:0.93,
      options:[
        {style:'Canon', title:'No romantic misunderstanding may be resolved before it has caused unnecessary emotional damage.'},
        {style:'Romantiverse Science', title:'The easier a misunderstanding is to solve with one honest conversation, the longer the Romantiverse requires it to remain unresolved.'},
        {style:'Constitutional', title:'Any conflict solvable in under thirty seconds of direct conversation must remain active until the plot no longer needs it.'}
      ]
    };
  }

  if(/festival|tree lighting|parade|town fair|community event|fundraiser/.test(t) && /love|kiss|romance|relationship|couple|together/.test(t)){
    return {
      category:'Holidays & Community',
      confidence:0.91,
      options:[
        {style:'Canon', title:'Every small town must maintain at least one community event capable of advancing or resolving a romantic relationship.'},
        {style:'Romantiverse Science', title:'Romantic probability rises sharply within the geographic boundary of a town festival, parade, fundraiser, or tree-lighting ceremony.'},
        {style:'Constitutional', title:'No annual community celebration may conclude without materially affecting at least one romantic pairing.'}
      ]
    };
  }

  if(/bakery|bookstore|inn|shop|family business|small business/.test(t) && /(failing|struggling|save|closing|money|financial|foreclosure|sell)/.test(t)){
    return {
      category:'Career & Economics',
      confidence:0.9,
      options:[
        {style:'Canon', title:'A struggling small-town business can always be rescued if its owner has enough romantic motivation.'},
        {style:'Romantiverse Science', title:'The financial viability of a small-town business increases dramatically once its owner becomes romantically invested in staying.'},
        {style:'Constitutional', title:'No beloved small-town business may permanently close before every available romantic solution has been exhausted.'}
      ]
    };
  }

  if(/snow|snowstorm|blizzard|snowed in/.test(t) && /love|kiss|romance|together|closer|attraction/.test(t)){
    return {
      category:'Romance Physics',
      confidence:0.89,
      options:[
        {style:'Canon', title:'Heavy snowfall increases romantic probability and decreases the practical value of personal boundaries.'},
        {style:'Romantiverse Science', title:'Romantic attraction increases as outdoor temperature and transportation reliability decrease.'},
        {style:'Constitutional', title:'Any snowstorm severe enough to disrupt travel must create at least one opportunity for forced romantic proximity.'}
      ]
    };
  }

  return null;
}

function ruleifyGeneric(raw){
  const cleaned = String(raw || '').trim().replace(/[.!?]+$/,'');
  const category = ruleifyCategoryFor(cleaned);
  let canon = '';
  let science = '';
  let constitutional = '';

  const whenYou = cleaned.match(/^when\s+you(?:'re| are)\s+(.+?),\s*you(?:'ll| will)\s+(.+)$/i);
  if(whenYou){
    const subject = ruleifyCleanSubject(whenYou[1]);
    const outcome = ruleifyThirdPersonPossessive(whenYou[2], subject);
    canon = `Any ${subject} will inevitably ${outcome}`;
    science = `For any ${subject}, the probability of ${outcome.replace(/^fall in love/i,'romantic attachment')} approaches certainty once the required conditions are met`;
    constitutional = `No ${subject} may encounter the stated conditions without eventually ${outcome}`;
  }else{
    const statement = cleaned.replace(/^apparently\s*,?\s*/i,'').replace(/^in these movies\s*,?\s*/i,'');
    canon = `In the Romantiverse, ${statement.charAt(0).toLowerCase()+statement.slice(1)}`;
    science = `Romantiverse physics strongly predicts that ${statement.charAt(0).toLowerCase()+statement.slice(1)}`;
    constitutional = `The Romantiverse requires that ${statement.charAt(0).toLowerCase()+statement.slice(1)}`;
  }

  return {
    category,
    confidence:0.68,
    options:[
      {style:'Canon', title:ruleifySentence(canon)},
      {style:'Romantiverse Science', title:ruleifySentence(science)},
      {style:'Constitutional', title:ruleifySentence(constitutional)}
    ]
  };
}

function runRuleify(){
  const input = document.getElementById('ruleifyInput');
  const raw = String(input?.value || ruleifyObservation || '').trim();
  if(raw.length < 8){
    alert('Give Ruleify a little more to work with — a full observation works best.');
    return;
  }
  ruleifyObservation = raw;
  const analysis = ruleifySpecial(raw) || ruleifyGeneric(raw);
  ruleifyResults = analysis.options.map((option,index) => {
    const overlap = ruleifyOverlap(option.title);
    return {
      ...option,
      index,
      category:analysis.category,
      confidence:analysis.confidence,
      overlap
    };
  });
  render();
}

function ruleifyExample(text){
  ruleifyObservation = text;
  ruleifyResults = [];
  render();
  setTimeout(() => {
    const el = document.getElementById('ruleifyInput');
    if(el){ el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  },0);
}

function ruleifyResultCard(result, index){
  const overlap = result.overlap;
  const saving = ruleifySavingIndex === index;
  return `<article class="ruleify-result card card-pad">
    <div class="ruleify-result-head">
      <div>
        <div class="kicker">${esc(result.style)}</div>
        <span class="pill">${esc(result.category)}</span>
      </div>
      <span class="ruleify-confidence">${Math.round(Number(result.confidence||0)*100)}% fit</span>
    </div>
    <div class="ruleify-law">${esc(result.title)}</div>
    ${overlap ? `<div class="ruleify-overlap"><strong>Possible precedent:</strong> Rule #${Number(overlap.rule.rule_number)} — ${esc(overlap.rule.title)} <span class="subtle">(${Math.round(overlap.score*100)}% wording overlap)</span></div>` : ''}
    <div class="ruleify-actions">
      <button class="primary" ${saving?'disabled':''} onclick="saveRuleifyResult(${index})">${saving?'Saving…':'Save as Proposed Rule'}</button>
      <button class="secondary" onclick="copyRuleifyResult(${index})">Copy wording</button>
    </div>
  </article>`;
}

function ruleifyPage(){
  const examples = [
    "When you're a single dad, you will fall in love with anyone who takes care of your children.",
    'The big-city career always starts looking terrible after three days in a charming hometown.',
    'If one honest conversation could solve the misunderstanding, nobody is allowed to have it.'
  ];
  return `<section class="section ruleify-hero">
    <div class="kicker">Rules of the Romantiverse</div>
    <div class="page-title">Ruleify™</div>
    <div class="subtle">Say the messy thing you noticed. Ruleify turns it into fake-authoritative Romantiverse law, checks the existing canon for overlap, and lets you save the winner as a proposed rule.</div>

    <div class="card card-pad ruleify-input-card">
      <label for="ruleifyInput"><strong>What did you notice?</strong></label>
      <textarea id="ruleifyInput" class="search ruleify-input" rows="5" placeholder="Example: When you're a single dad, you will fall in love with anyone who takes care of your children." oninput="ruleifyObservation=this.value">${esc(ruleifyObservation)}</textarea>
      <div class="ruleify-input-actions">
        <button class="primary ruleify-big-button" onclick="runRuleify()">⚖️ Ruleify it</button>
        ${ruleifyObservation ? '<button class="secondary" onclick="clearRuleify()">Clear</button>' : ''}
      </div>
    </div>

    <div class="ruleify-examples">
      <span class="subtle">Try one:</span>
      ${examples.map((x,i)=>`<button class="filter" onclick='ruleifyExample(${JSON.stringify(x)})'>Example ${i+1}</button>`).join('')}
    </div>
  </section>

  ${ruleifyResults.length ? `<section class="section">
    <div class="ruleify-results-head">
      <div>
        <div class="page-title small-title">Choose your law</div>
        <div class="subtle">Same observation, three levels of unnecessary legal authority.</div>
      </div>
      <span class="pill">Default status: 📝 Proposed</span>
    </div>
    <div class="ruleify-results">${ruleifyResults.map(ruleifyResultCard).join('')}</div>
  </section>` : ''}`;
}

function clearRuleify(){
  ruleifyObservation = '';
  ruleifyResults = [];
  ruleifySavingIndex = -1;
  render();
}

async function copyRuleifyResult(index){
  const item = ruleifyResults[index];
  if(!item) return;
  try{
    await navigator.clipboard.writeText(item.title);
  }catch(_){
    const ta = document.createElement('textarea');
    ta.value = item.title;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

async function saveRuleifyResult(index){
  if(!workspace) return alert('Open a Cheese Louise workspace first.');
  const item = ruleifyResults[index];
  if(!item || ruleifySavingIndex >= 0) return;
  ruleifySavingIndex = index;
  render();

  try{
    let ruleNumber = await rvNextRuleNumber();
    const payload = {
      workspace_id:workspace.id,
      rule_number:ruleNumber,
      title:item.title,
      notes:null,
      status:'proposed',
      category:item.category,
      source_observation:ruleifyObservation,
      ruleify_metadata:{
        version:'1.20',
        style:item.style,
        confidence:Number(item.confidence||0),
        overlap_rule_id:item.overlap?.rule?.id || null,
        overlap_rule_number:item.overlap?.rule?.rule_number || null,
        overlap_score:item.overlap?.score || null,
        generated_at:new Date().toISOString()
      },
      created_by:me()
    };

    let result = await db.from('romantiverse_rules').insert(payload).select().single();
    if(result.error?.code === '23505'){
      ruleNumber = await rvNextRuleNumber();
      payload.rule_number = ruleNumber;
      result = await db.from('romantiverse_rules').insert(payload).select().single();
    }
    if(result.error) throw result.error;

    await logActivity(`ruleified proposed Romantiverse Rule #${ruleNumber}: ${item.title}`,'rule',result.data.id);
    ruleifyObservation = '';
    ruleifyResults = [];
    ruleifySavingIndex = -1;
    romantiverseHubView = 'rules';
    romantiverseRuleStatus = 'proposed';
    await loadAll();
    render();
  }catch(error){
    ruleifySavingIndex = -1;
    render();
    alert(error?.message || String(error));
  }
}

function openRuleify(){
  romantiverseHubView = 'ruleify';
  editingRomantiverseRule = null;
  currentTab = 'ideas';
  render();
}

// Extend the existing Show Lab / Rulebook sub-navigation with Ruleify.
rvRulesHubNav = function(){
  return `<section class="section">
    <div class="toolbar" style="margin-bottom:0">
      <button class="filter ${romantiverseHubView==='lab'?'active-filter':''}" onclick="openShowLabView()">💡 Show Lab</button>
      <button class="filter ${romantiverseHubView==='rules'?'active-filter':''}" onclick="openRomantiverseRules()">📜 Rules of the Romantiverse</button>
      <button class="filter ${romantiverseHubView==='ruleify'?'active-filter':''}" onclick="openRuleify()">⚖️ Ruleify</button>
    </div>
  </section>`;
};

const ruleifyOriginalIdeas = ideas;
ideas = function(){
  if(romantiverseHubView === 'ruleify') return rvRulesHubNav() + ruleifyPage();
  return ruleifyOriginalIdeas();
};

// Make category and the original movie-night observation visible in the rulebook.
const ruleifyOriginalRuleCard = rvRuleCard;
rvRuleCard = function(rule){
  let html = ruleifyOriginalRuleCard(rule);
  if(rule.category){
    html = html.replace(`<div class="kicker">Rule #${Number(rule.rule_number)}</div>`, `<div class="kicker">Rule #${Number(rule.rule_number)}</div><div style="margin-top:6px"><span class="pill">${esc(rule.category)}</span></div>`);
  }
  if(rule.source_observation){
    html = html.replace('<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:14px;flex-wrap:wrap">', `<div class="ruleify-source"><strong>Original observation:</strong> ${esc(rule.source_observation)}</div><div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:14px;flex-wrap:wrap">`);
  }
  return html;
};

rvRuleMatches = function(rule){
  if(romantiverseRuleStatus !== 'all' && rule.status !== romantiverseRuleStatus) return false;
  const q = romantiverseRuleSearch.trim().toLowerCase();
  if(!q) return true;
  return `${rule.rule_number} ${rule.title||''} ${rule.notes||''} ${rule.category||''} ${rule.source_observation||''} ${rvRuleStatusLabel(rule.status)}`
    .toLowerCase()
    .includes(q);
};

const ruleifyOriginalTopbar = topbar;
topbar = function(){
  return ruleifyOriginalTopbar().replace(/>v1\.\d+</, '>v1.20<');
};

window.openRuleify = openRuleify;
window.runRuleify = runRuleify;
window.clearRuleify = clearRuleify;
window.ruleifyExample = ruleifyExample;
window.copyRuleifyResult = copyRuleifyResult;
window.saveRuleifyResult = saveRuleifyResult;
