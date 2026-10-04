// Cheese Louise v1.32 — adaptive Cheese Master
// Rich evidence + concept inference + feedback learning on top of the editable Cheese Trait library.

state.traitFeedback = state.traitFeedback || [];
const CHEESE_MASTER_VERSION = 'v1.32';
let cmFeedbackModelCache = null;

function cmNorm(value){
  return String(value || '')
    .toLowerCase()
    .replace(/[’‘]/g,"'")
    .replace(/&/g,' and ')
    .replace(/[^a-z0-9']+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function cmArr(value){ return Array.isArray(value) ? value.filter(Boolean) : []; }
function cmPhrase(text,phrase){
  const p=cmNorm(phrase); if(!p) return false;
  return (' '+text+' ').includes(' '+p+' ');
}
function cmUnique(values){ return [...new Set((values||[]).filter(Boolean))]; }

const CM_STOP = new Set([
  'a','an','and','are','as','at','be','because','been','but','by','for','from','had','has','have','he','her','hers','him','his','i','in','into','is','it','its','of','on','or','our','she','that','the','their','them','they','this','to','was','we','were','when','where','who','will','with','you','your',
  'movie','film','story','love','romance','romantic','christmas','holiday'
]);
function cmTokens(value){
  return cmNorm(value).split(' ').filter(function(t){ return t.length>2 && !CM_STOP.has(t); });
}

function cmSourceParts(source){
  const metadata=source && source.source_metadata && typeof source.source_metadata==='object' ? source.source_metadata : {};
  return {
    title:source?.title || '',
    synopsis:source?.summary || '',
    notes:source?.notes || '',
    tagline:source?.tagline || metadata.tagline || '',
    keywords:cmUnique([].concat(cmArr(source?.keywords),cmArr(metadata.keywords))),
    genres:cmUnique([].concat(cmArr(source?.genres),cmArr(metadata.genres))),
    companies:cmUnique([].concat(cmArr(source?.production_companies),cmArr(metadata.production_companies))),
    characters:cmUnique([].concat(cmArr(source?.cast_characters),cmArr(metadata.cast_characters))),
    providers:cmUnique([].concat(cmArr(source?.providers),cmArr(metadata.providers))),
    why:cmArr(source?.why),
    tags:cmArr(source?.tags),
    holiday:source?.holiday || metadata.holiday || '',
    season:source?.season || metadata.season || '',
    network:source?.network || metadata.network || ''
  };
}
function cmSourceText(source){
  const p=cmSourceParts(source);
  return cmNorm([
    p.title,p.synopsis,p.notes,p.tagline,p.holiday,p.season,p.network,
    p.keywords.join(' '),p.genres.join(' '),p.companies.join(' '),
    p.characters.join(' '),p.providers.join(' '),p.why.join(' '),p.tags.join(' ')
  ].filter(Boolean).join(' '));
}
function cmFeedbackText(source){
  const p=cmSourceParts(source);
  return [p.title,p.synopsis,p.tagline,p.keywords.join(', '),p.characters.join(', ')].filter(Boolean).join(' | ').slice(0,4000);
}

const CM_CONCEPTS = {
  homecoming:/\b(return(?:s|ed|ing)?|come(?:s)?|came|go(?:es)?|went|move(?:s|d)?) (?:back )?(?:home|to (?:her|his|their|the) hometown|to (?:her|his|their) small town)\b|\bback (?:home|in (?:her|his|their) hometown)\b|\bhometown\b/,
  small_town:/\bsmall town\b|\bsmall-town\b|\bquaint town\b|\btight knit community\b|\bclose knit community\b/,
  big_city:/\bnew york\b|\bmanhattan\b|\bchicago\b|\blos angeles\b|\bboston\b|\bseattle\b|\bbig city\b|\bcity life\b|\bcorporate world\b/,
  career:/\bcareer\b|\bexecutive\b|\bcorporate\b|\bceo\b|\blawyer\b|\battorney\b|\bpublicist\b|\bmarketing\b|\barchitect\b|\beditor\b|\breporter\b|\bdesigner\b|\bpromotion\b|\bjob offer\b|\bassignment\b/,
  promotion:/\bpromotion\b|\bpromoted\b|\bjob offer\b|\bcareer opportunity\b|\bpartnership\b/,
  assignment:/\bassignment\b|\bsent to\b|\btasked with\b|\bcommissioned to\b|\bwork project\b|\bclient\b/,
  bakery:/\bbakery\b|\bbaker\b|\bbakeshop\b|\bpastry\b|\bpatisserie\b|\bcupcake\b|\bcake shop\b|\bcookie shop\b/,
  tree_farm:/\bchristmas tree farm\b|\btree farm\b|\bevergreen farm\b/,
  inn:/\binn\b|\bbed and breakfast\b|\bb and b\b|\bguesthouse\b|\blodge\b/,
  winery:/\bvineyard\b|\bwinery\b|\bwinemaker\b|\bvintner\b|\bwine estate\b/,
  coffee_shop:/\bcoffee shop\b|\bcafe\b|\bcafé\b|\bcoffeehouse\b/,
  bookstore:/\bbookstore\b|\bbook shop\b|\bbookshop\b/,
  restaurant:/\bfamily restaurant\b|\brestaurant\b|\bdiner\b|\bbistro\b/,
  flower_shop:/\bflower shop\b|\bflorist\b|\bfloral shop\b/,
  newspaper:/\bnewspaper\b|\blocal paper\b|\breporter\b|\bjournalist\b/,
  event_planner:/\bevent planner\b|\bwedding planner\b|\bparty planner\b|\bplans? (?:the|a) (?:festival|event|gala|wedding)\b/,
  family_business:/\bfamily business\b|\bfamily owned\b|\bfamily-owned\b|\bparents'? (?:shop|store|bakery|inn|farm|restaurant|business)\b|\bmother'?s (?:shop|store|bakery|inn|farm|restaurant)\b|\bfather'?s (?:shop|store|bakery|inn|farm|restaurant)\b/,
  business_risk:/\bstruggling\b|\bfailing\b|\bforeclosure\b|\bdebt\b|\bclosing\b|\bclosure\b|\bshut down\b|\bkeep .* open\b|\bsave (?:the|her|his|their)\b|\blast chance\b|\bin danger\b/,
  inheritance:/\binherit(?:s|ed|ing|ance)?\b|\bleft (?:her|him|them) (?:the|a)\b|\bwill stipulates\b|\bestate\b/,
  condition:/\bcondition\b|\bmust (?:marry|stay|live|run|keep|work)\b|\bonly if\b|\bin order to inherit\b|\bstipulation\b/,
  dead_parent:/\b(?:late|deceased) (?:mother|father|mom|dad|parent|grandmother|grandfather|grandparent)\b|\b(?:mother|father|mom|dad|parent|grandmother|grandfather|grandparent) (?:died|passed away)\b|\borphan(?:ed)?\b|\bloss of (?:her|his|their) (?:mother|father|parent|grandparent)\b/,
  dead_spouse:/\bwidow(?:ed|er)?\b|\b(?:late|deceased) (?:husband|wife|spouse)\b|\b(?:husband|wife|spouse) (?:died|passed away)\b|\blost (?:her|his|their) (?:husband|wife|spouse)\b/,
  single_parent:/\bsingle (?:mother|father|mom|dad|parent)\b|\braising (?:her|his|their) (?:daughter|son|child|children)\b|\b(?:daughter|son|child|children) and (?:her|his) (?:mom|dad|mother|father)\b/,
  sick_family:/\b(?:ailing|ill|sick) (?:mother|father|mom|dad|grandmother|grandfather|grandparent)\b|\bcare for (?:her|his|their) (?:mother|father|parent|grandparent)\b/,
  estranged:/\bestranged\b|\bhasn'?t spoken\b|\bfamily rift\b|\bfeud\b|\bfalling out\b/,
  childhood:/\bchildhood\b|\bgrew up together\b|\bsince they were kids\b|\bhigh school\b/,
  old_flame:/\bold flame\b|\bformer (?:boyfriend|girlfriend|fiance|fiancee|love|sweetheart)\b|\bex[- ](?:boyfriend|girlfriend|fiance|fiancee)\b|\bfirst love\b|\brekindl(?:e|es|ed|ing)\b|\breconnect(?:s|ed|ing)?\b/,
  friends:/\bbest friend\b|\blongtime friend\b|\bclose friend\b|\bfriends since\b|\bfriendship\b/,
  rivals:/\brival(?:s|ry)?\b|\bcompetitor(?:s)?\b|\bcompeting against\b|\bopposing\b|\badversar(?:y|ies)\b/,
  fake_romance:/\bfake dat(?:e|ing)\b|\bpretend to date\b|\bpretend couple\b|\bfake relationship\b|\bpose as (?:a )?couple\b|\bpretend (?:boyfriend|girlfriend)\b/,
  fake_engagement:/\bfake engagement\b|\bpretend engagement\b|\bpretend to be engaged\b|\bfiance for (?:the|a)\b/,
  forced_proximity:/\bforced to work together\b|\bmust work together\b|\bhave to work together\b|\bstuck together\b|\bshare (?:a|the) room\b|\broommates?\b/,
  snow_trap:/\bsnowed in\b|\bblizzard\b|\bsnowstorm\b|\broad closure\b|\broad is closed\b|\bstranded by snow\b|\btrapped by snow\b/,
  one_bed:/\bonly one bed\b|\bone bed left\b|\bsingle bed left\b|\bone room left\b/,
  festival:/\bfestival\b|\bfair\b|\bcarnival\b|\bpageant\b|\bparade\b|\btown event\b|\bgala\b/,
  tree_lighting:/\btree lighting\b|\btree-lighting\b|\blighting (?:of )?(?:the )?(?:town |christmas )?tree\b/,
  cookie_contest:/\bcookie (?:contest|competition|bake off|bake-off)\b|\bgingerbread (?:contest|competition)\b|\bbaking contest\b/,
  save_event:/\bsave (?:christmas|the festival|the parade|the pageant|the event)\b|\bkeep (?:the )?(?:festival|parade|pageant) alive\b/,
  christmas_magic:/\bchristmas magic\b|\bmagical christmas\b|\bholiday magic\b|\bmiracle\b|\bmagic\b/,
  christmas_wish:/\bchristmas wish\b|\bwishes? for\b|\bwish comes true\b|\bmakes? a wish\b/,
  christmas_star:/\bchristmas star\b|\bstar of christmas\b/,
  santa:/\bsanta\b|\bkris kringle\b|\bmysterious stranger\b/,
  deadline:/\bdeadline\b|\bbefore christmas\b|\bby christmas\b|\blast minute\b|\blast-minute\b|\bin time for christmas\b/,
  fundraiser:/\bfundraiser\b|\bfundraising\b|\bbenefit\b|\bcharity event\b|\braise money\b/,
  developer:/\bproperty developer\b|\breal estate developer\b|\bredevelopment\b|\bdevelopment company\b|\bbulldoze\b|\bdemolish\b|\btear down\b/,
  mistaken_identity:/\bmistaken identity\b|\bmistakes? (?:him|her|them) for\b|\bwrong identity\b|\bassumes? (?:he|she|they) is\b/,
  amnesia:/\bamnesia\b|\bmemory loss\b|\blost (?:her|his|their) memory\b|\bcan'?t remember (?:her|his|their) past\b/,
  contest:/\bcontest\b|\bcompetition\b|\btournament\b|\bbake off\b|\bcook off\b|\bcompete\b/,
  misunderstanding:/\bmisunderstanding\b|\bmiscommunication\b|\boverhears?\b|\bwrong conclusion\b|\bassumption\b/,
  royalty:/\bprince\b|\bprincess\b|\broyal\b|\bkingdom\b|\bduke\b|\bduchess\b|\bpalace\b|\bcrown prince\b|\bcrown princess\b/,
  castle:/\bcastle\b|\bpalace\b|\broyal estate\b/,
  secret_identity:/\bsecret prince\b|\bsecret princess\b|\bundercover (?:prince|princess|royal)\b|\bincognito\b|\bin disguise\b|\bhidden identity\b/,
  royal_engagement:/\broyal engagement\b|\barranged marriage\b|\bbetrothed\b|\bmust marry\b|\broyal wedding\b/,
  wedding:/\bwedding\b|\bbride\b|\bgroom\b|\bengagement\b|\bmaid of honor\b|\bbest man\b/,
  destination:/\bdestination wedding\b|\btravels? to\b|\bflies? to\b|\bforeign country\b|\bisland wedding\b/,
  mountain:/\bmountain town\b|\bmountain village\b|\bski town\b|\balpine\b|\bmountains?\b/,
  seaside:/\bseaside\b|\bcoastal town\b|\bbeach town\b|\bcoast\b|\bby the sea\b|\bharbor town\b|\bharbour town\b/,
  farm:/\bfarm\b|\branch\b|\bfarmhouse\b|\bcountry ranch\b/,
  ex_returns:/\bex[- ](?:boyfriend|girlfriend|fiance|fiancee)\b|\bformer (?:boyfriend|girlfriend|fiance|fiancee)\b|\bold flame\b/,
  matchmaker:/\bmatchmaker\b|\bsets? (?:her|him|them) up\b|\bset up on a date\b|\bplaying cupid\b/,
  child_matchmaker:/\b(?:daughter|son|child|kid) (?:sets|tries to set|wants) .* (?:up|together)\b|\bchild plays matchmaker\b/,
  town_meddling:/\bwhole town\b|\beveryone in town\b|\btown knows\b|\bcommunity knows\b/,
  labor:/\brenovat(?:e|es|ed|ing|ion)\b|\brestore\b|\brepair\b|\bfix up\b|\bdecorate\b|\bbuild\b|\bworking side by side\b/,
  breakup:/\bbreaks? up\b|\bwalks? away\b|\bleaves? town\b|\brelationship ends\b|\bcalled off\b/,
  grand_gesture:/\bgrand gesture\b|\bpublic declaration\b|\bproposes?\b|\bsurprise gesture\b|\braces? to (?:the airport|stop her|stop him)\b/,
  kiss:/\bkiss\b|\balmost kiss\b|\binterrupted\b/
};

function cmConceptSet(text){
  const set=new Set();
  Object.keys(CM_CONCEPTS).forEach(function(key){ if(CM_CONCEPTS[key].test(text)) set.add(key); });
  return set;
}

const CM_PROFILE_LIBRARY = {
  'big promotion vs hometown':{concepts:['promotion','homecoming'],cues:['promotion back in the city','career opportunity back in the city']},
  'career-or-love ultimatum':{concepts:['career','homecoming'],cues:['choose between love and career','career or love','job or relationship']},
  'boss sends them home':{concepts:['assignment','homecoming'],cues:['boss sends her home','boss sends him home','sent to her hometown','sent to his hometown']},
  'work assignment creates romance':{concepts:['assignment'],cues:['work assignment','assigned to work with','sent to cover','sent to plan']},
  'christmas festival':{concepts:['festival'],cues:['christmas festival','holiday festival','christmas fair','holiday fair']},
  'tree-lighting ceremony':{concepts:['tree_lighting']},
  'cookie contest':{concepts:['cookie_contest','contest']},
  'save christmas event':{concepts:['save_event','festival']},
  'christmas pageant':{concepts:['festival'],cues:['christmas pageant','holiday pageant']},
  'magical santa stranger':{concepts:['santa','christmas_magic'],cues:['mysterious santa','stranger who may be santa']},
  'last-minute christmas deadline':{concepts:['deadline'],cues:['before christmas','by christmas eve','in time for christmas']},
  'christmas star':{concepts:['christmas_star']},
  'christmas wish':{concepts:['christmas_wish']},
  'christmas magic':{concepts:['christmas_magic']},
  'dead parent/grandparent':{concepts:['dead_parent'],aliases:['dead parent','dead mother','dead father','late mother','late father','late grandmother','late grandfather']},
  'dead spouse':{concepts:['dead_spouse']},
  'widowed single parent':{all:['dead_spouse','single_parent'],cues:['widowed father','widowed mother','widowed dad','widowed mom']},
  'estranged family':{concepts:['estranged']},
  'sick parent or grandparent':{concepts:['sick_family']},
  'inherited family business':{all:['inheritance','family_business'],cues:['inherits the bakery','inherits the inn','inherits the family business','takes over the family business']},
  'bakery':{concepts:['bakery']},
  'christmas tree farm':{concepts:['tree_farm']},
  'inn or b&b':{concepts:['inn']},
  'vineyard or winery':{concepts:['winery']},
  'coffee shop':{concepts:['coffee_shop']},
  'bookstore':{concepts:['bookstore']},
  'family restaurant':{concepts:['restaurant'],context:['family','parents']},
  'flower shop':{concepts:['flower_shop']},
  'small-town newspaper':{all:['newspaper','small_town'],concepts:['newspaper']},
  'event planner':{concepts:['event_planner']},
  'big-city corporate job':{all:['career','big_city'],concepts:['career','big_city']},
  'small-town return':{concepts:['homecoming'],context:['hometown','small town']},
  'quaint mountain town':{all:['mountain','small_town'],concepts:['mountain']},
  'family farm or ranch':{concepts:['farm'],context:['family','parents']},
  'seaside town':{concepts:['seaside']},
  'royal castle':{all:['royalty','castle'],concepts:['castle']},
  'destination wedding':{all:['wedding','destination'],concepts:['wedding','destination']},
  'saved-the-town fundraiser':{all:['fundraiser','business_risk'],concepts:['fundraiser'],context:['town','community','save']},
  'save the family business':{all:['family_business','business_risk'],concepts:['family_business','business_risk']},
  'inheritance with conditions':{all:['inheritance','condition'],concepts:['inheritance']},
  'mistaken identity':{concepts:['mistaken_identity']},
  'amnesia':{concepts:['amnesia']},
  'fake engagement':{concepts:['fake_engagement']},
  'contest or competition':{concepts:['contest']},
  'property developer villain':{concepts:['developer']},
  'convenient storm or road closure':{concepts:['snow_trap'],cues:['road closure','storm strands','blizzard traps']},
  'misunderstanding one sentence could fix':{concepts:['misunderstanding']},
  'inherent family business':{concepts:['family_business'],aliases:['family business','family-owned business']},
  'festival':{concepts:['festival']},
  'family fued':{concepts:['estranged'],aliases:['family feud','feuding families','family rivalry']},
  'childhood sweetheart':{all:['childhood','old_flame'],concepts:['childhood'],cues:['childhood sweetheart','high school sweetheart','first love']},
  'old flame':{concepts:['old_flame']},
  'fake dating':{concepts:['fake_romance']},
  'friends to lovers':{concepts:['friends'],context:['sparks','feelings','attraction','romance','love']},
  'rivals to lovers':{concepts:['rivals'],context:['sparks','chemistry','attraction','romance','love']},
  'accidental roommates':{concepts:['forced_proximity'],cues:['accidental roommates','forced to share a room','unexpected roommates']},
  'snowed in together':{all:['snow_trap','forced_proximity'],concepts:['snow_trap'],cues:['snowed in together','stranded together by snow']},
  'single-parent romance':{concepts:['single_parent']},
  'matchmaking scheme':{concepts:['matchmaker']},
  'interrupted kiss':{concepts:['kiss'],cues:['interrupted kiss','almost kiss interrupted']},
  'ex appears at worst time':{concepts:['ex_returns'],context:['returns','shows up','appears','arrives']},
  'child plays matchmaker':{concepts:['child_matchmaker'],all:['single_parent','matchmaker']},
  'town knows before they do':{concepts:['town_meddling'],context:['romance','couple','together','chemistry']},
  'only one bed':{concepts:['one_bed']},
  'wholesome labor montage':{concepts:['labor'],context:['together','restore','renovate','decorate','repair']},
  'third-act breakup':{concepts:['breakup']},
  'grand romantic gesture':{concepts:['grand_gesture']},
  'secret prince or princess':{all:['royalty','secret_identity'],concepts:['secret_identity']},
  'royal mistaken identity':{all:['royalty','mistaken_identity'],concepts:['mistaken_identity']},
  'commoner meets royal':{concepts:['royalty'],context:['baker','teacher','writer','journalist','designer','chef','photographer','doctor','nurse','shop owner','ordinary','commoner']},
  'royal engagement problem':{concepts:['royal_engagement']}
};

function cmProfile(trait){
  const built=CM_PROFILE_LIBRARY[cmNorm(trait.name)] || {};
  const custom=trait.recognition && typeof trait.recognition==='object' ? trait.recognition : {};
  return {
    aliases:cmUnique([trait.name].concat(cmArr(built.aliases),cmArr(custom.aliases))),
    cues:cmUnique([].concat(cmArr(built.cues),cmArr(custom.cues))),
    concepts:cmUnique([].concat(cmArr(built.concepts),cmArr(custom.concepts))),
    all:cmUnique([].concat(cmArr(built.all),cmArr(custom.all))),
    context:cmUnique([].concat(cmArr(built.context),cmArr(custom.context))),
    exclusions:cmUnique([].concat(cmArr(built.exclusions),cmArr(custom.exclusions)))
  };
}

function cmBuildFeedbackModel(){
  if(cmFeedbackModelCache) return cmFeedbackModelCache;
  const model={};
  (state.traitFeedback||[]).forEach(function(row){
    const id=row.trait_id; if(!id) return;
    const bucket=model[id] || (model[id]={pos:0,neg:0,posTokens:{},negTokens:{}});
    const positive=row.decision==='accepted' || row.decision==='manual_added';
    if(positive) bucket.pos++; else bucket.neg++;
    const seen=new Set(cmTokens(row.source_text||''));
    seen.forEach(function(tok){
      const target=positive?bucket.posTokens:bucket.negTokens;
      target[tok]=(target[tok]||0)+1;
    });
  });
  cmFeedbackModelCache=model;
  return model;
}

function cmLearningAdjustment(trait,text){
  const bucket=cmBuildFeedbackModel()[trait.id];
  if(!bucket || bucket.pos+bucket.neg<2) return {delta:0,reason:null};
  let evidence=0;
  const tokens=new Set(cmTokens(text));
  tokens.forEach(function(tok){
    const p=bucket.posTokens[tok]||0, n=bucket.negTokens[tok]||0;
    if(p>=2 && p>n) evidence += Math.min(0.035,0.012*(p-n));
    if(n>=2 && n>p) evidence -= Math.min(0.04,0.014*(n-p));
  });
  const prior=(bucket.pos-bucket.neg)/(bucket.pos+bucket.neg);
  evidence += Math.max(-0.05,Math.min(0.05,prior*0.04));
  const delta=Math.max(-0.14,Math.min(0.14,evidence));
  return {
    delta:delta,
    reason:Math.abs(delta)>=0.025 ? 'learned from '+bucket.pos+' accepted/manual and '+bucket.neg+' rejected/removed examples' : null
  };
}

function cmTraitMatch(trait,source,text,concepts,legacyById){
  const profile=cmProfile(trait);
  let confidence=0;
  const evidence=[];
  let sourceType='semantic';

  const alias=profile.aliases.find(function(x){ return cmPhrase(text,x); });
  if(alias){
    confidence=Math.max(confidence,0.97);
    evidence.push('direct phrase: "'+alias+'"');
    sourceType='direct';
  }

  const cue=profile.cues.find(function(x){ return cmPhrase(text,x); });
  if(cue){
    confidence=Math.max(confidence,0.90);
    evidence.push('story cue: "'+cue+'"');
    sourceType=sourceType==='direct'?'direct':'cue';
  }

  if(profile.all.length && profile.all.every(function(c){ return concepts.has(c); })){
    confidence=Math.max(confidence,0.88);
    evidence.push('combined clues: '+profile.all.join(' + ').replace(/_/g,' '));
  }else{
    const conceptHits=profile.concepts.filter(function(c){ return concepts.has(c); });
    if(conceptHits.length){
      confidence=Math.max(confidence,Math.min(0.86,0.70+conceptHits.length*0.07));
      evidence.push('semantic clue'+(conceptHits.length===1?'':'s')+': '+conceptHits.join(', ').replace(/_/g,' '));
    }
  }

  if(profile.context.length){
    const hits=profile.context.filter(function(x){ return cmPhrase(text,x); });
    if(hits.length){
      confidence=Math.max(confidence,0.66+Math.min(0.12,hits.length*0.04));
      evidence.push('context: '+hits.slice(0,3).join(', '));
    }
  }

  const parts=cmSourceParts(source);
  const keywordText=cmNorm(parts.keywords.join(' '));
  const keywordHit=profile.aliases.concat(profile.cues).find(function(x){ return cmPhrase(keywordText,x); });
  if(keywordHit){
    confidence=Math.max(confidence,0.91);
    evidence.push('TMDB keyword: "'+keywordHit+'"');
    sourceType='metadata';
  }

  const legacy=legacyById && legacyById.get(trait.id);
  if(legacy){
    confidence=Math.max(confidence,Number(legacy.confidence||0));
    if(legacy.reason) evidence.push('legacy rule: '+legacy.reason);
  }

  const nameTokens=cmTokens(trait.name);
  const richTokens=new Set(cmTokens(parts.keywords.join(' ')+' '+parts.tagline+' '+parts.characters.join(' ')));
  const overlap=nameTokens.filter(function(t){ return richTokens.has(t); });
  if(overlap.length>=2){
    confidence=Math.max(confidence,0.72);
    evidence.push('metadata meaning overlap: '+overlap.join(', '));
  }

  const exclusion=profile.exclusions.find(function(x){ return cmPhrase(text,x); });
  if(exclusion){
    confidence-=0.35;
    evidence.push('counter-signal: "'+exclusion+'"');
  }

  const learned=cmLearningAdjustment(trait,text);
  if(learned.delta){
    confidence+=learned.delta;
    if(learned.reason) evidence.push(learned.reason);
  }

  confidence=Math.max(0,Math.min(0.99,confidence));
  if(confidence<0.58) return null;
  return {
    trait:trait,
    confidence:confidence,
    reason:evidence[0] || 'multiple synopsis/metadata clues line up with this trait',
    evidence:evidence.slice(0,5),
    source:sourceType
  };
}

function cmTier(value){
  if(value>=0.90) return 'Direct';
  if(value>=0.74) return 'Strong';
  return 'Possible';
}

const cmLegacyAnalyze = typeof romantiverseAnalyze==='function' ? romantiverseAnalyze : null;
function cheeseMasterAnalyze(source){
  const text=cmSourceText(source);
  const concepts=cmConceptSet(text);
  const legacyById=new Map();
  if(cmLegacyAnalyze){
    try{
      const legacy=cmLegacyAnalyze(source);
      (legacy?.matches||[]).forEach(function(m){ legacyById.set(m.trait.id,m); });
    }catch(err){ console.warn('Legacy Romantiverse analysis failed',err); }
  }

  const matches=(state.traits||[])
    .filter(function(t){ return t.is_active; })
    .map(function(t){ return cmTraitMatch(t,source,text,concepts,legacyById); })
    .filter(Boolean)
    .sort(function(a,b){
      return b.confidence-a.confidence || Number(b.trait.points||0)-Number(a.trait.points||0) || a.trait.name.localeCompare(b.trait.name);
    });

  let weighted=0;
  const categoryCounts={};
  matches.forEach(function(m){
    const category=m.trait.category||'Other';
    const n=categoryCounts[category]||0;
    categoryCounts[category]=n+1;
    const redundancy=Math.max(0.72,1-(n*0.08));
    weighted += Number(m.trait.points||0) * (0.55+0.45*m.confidence) * redundancy;
  });

  let compoundBonus=0;
  if(concepts.has('homecoming') && concepts.has('career')) compoundBonus+=2;
  if(concepts.has('family_business') && concepts.has('business_risk')) compoundBonus+=3;
  if(concepts.has('old_flame') && concepts.has('homecoming')) compoundBonus+=2;
  if(concepts.has('royalty') && (concepts.has('secret_identity')||concepts.has('mistaken_identity'))) compoundBonus+=2;
  if(concepts.has('festival') && (source?.holiday || /\bchristmas\b|\bholiday\b/.test(text))) compoundBonus+=2;

  const raw=matches.reduce(function(sum,m){ return sum+Number(m.trait.points||0); },0);
  const score=Math.max(0,Math.min(100,Math.round(weighted+compoundBonus)));
  const confidence=matches.length ? matches.reduce(function(sum,m){ return sum+m.confidence; },0)/matches.length : 0;
  return {
    traits:matches.map(function(m){ return m.trait; }),
    matches:matches,
    score:score,
    rawScore:raw,
    confidence:confidence,
    confidenceLabel:matches.length?cmTier(confidence):'Not enough data',
    concepts:[...concepts],
    compoundBonus:compoundBonus,
    engine:CHEESE_MASTER_VERSION
  };
}

romantiverseAnalyze=cheeseMasterAnalyze;
discoveryEstimate=cheeseMasterAnalyze;
discoveryTraitSuggestions=function(candidate){
  return cheeseMasterAnalyze(candidate).matches
    .filter(function(m){ return m.confidence>=0.68; })
    .map(function(m){ return m.trait; });
};
rvConfidenceLabel=cmTier;
window.romantiverseAnalyze=cheeseMasterAnalyze;
window.cheeseMasterAnalyze=cheeseMasterAnalyze;
window.discoveryEstimate=discoveryEstimate;
window.discoveryTraitSuggestions=discoveryTraitSuggestions;

rvMatchDetailsHtml=function(est){
  if(!est.matches?.length) return '<div class="subtle">Cheese Master did not get enough evidence yet. A thin synopsis can still hide a shocking amount of cheese.</div>';
  const rows=est.matches.slice(0,12).map(function(m){
    const evidence=(m.evidence||[]).slice(0,2).join(' · ');
    return '<div class="subtle cm-evidence-row"><strong>'+esc(m.trait.name)+'</strong> <span class="pill">'+esc(cmTier(m.confidence))+' '+Math.round(m.confidence*100)+'%</span> — '+esc(evidence||m.reason)+'</div>';
  }).join('');
  const more=est.matches.length>12?'<div class="subtle cm-evidence-row">+ '+(est.matches.length-12)+' more plausible trait'+(est.matches.length-12===1?'':'s')+'</div>':'';
  return rows+more;
};

async function cmLoadFeedback(){
  if(!workspace) return;
  const res=await db.from('trait_feedback').select('*').eq('workspace_id',workspace.id).order('created_at',{ascending:false}).limit(600);
  if(res.error){ console.warn('Cheese Master feedback unavailable',res.error); return; }
  state.traitFeedback=res.data||[];
  cmFeedbackModelCache=null;
}
const cmOriginalLoadAll=loadAll;
loadAll=async function(){
  await cmOriginalLoadAll();
  await cmLoadFeedback();
};

async function cmRecordFeedback(source,trait,decision,match,movieId){
  if(!workspace || !trait) return;
  const row={
    workspace_id:workspace.id,
    movie_id:movieId||null,
    tmdb_id:source?.tmdb_id?Number(source.tmdb_id):null,
    trait_id:trait.id,
    user_id:me(),
    decision:decision,
    source_text:cmFeedbackText(source),
    evidence:{
      engine:CHEESE_MASTER_VERSION,
      confidence:match?Number(match.confidence||0):null,
      reason:match?.reason||null,
      evidence:match?.evidence||[],
      concepts:cheeseMasterAnalyze(source).concepts
    }
  };
  const res=await db.from('trait_feedback').insert(row);
  if(res.error) console.warn('Could not save Cheese Master feedback',res.error);
  else{
    state.traitFeedback.unshift({...row,id:'local-'+Date.now(),created_at:new Date().toISOString()});
    cmFeedbackModelCache=null;
  }
}

const cmOriginalToggleMovieTrait=toggleMovieTrait;
toggleMovieTrait=async function(movieId,traitId){
  const movie=(state.movies||[]).find(function(m){ return m.id===movieId; });
  const trait=(state.traits||[]).find(function(t){ return t.id===traitId; });
  if(!movie||!trait) return cmOriginalToggleMovieTrait(movieId,traitId);
  const selected=movie.selectedTraitIds?.includes(traitId);
  const row=(cheeseTraitRows||[]).find(function(mt){ return mt.movie_id===movieId && mt.trait_id===traitId; });
  const analysis=cheeseMasterAnalyze(movie);
  const match=analysis.matches.find(function(m){ return m.trait.id===traitId; })||null;
  await cmOriginalToggleMovieTrait(movieId,traitId);
  const decision=selected ? (row?.selection_source==='cheese_master'?'rejected':'manual_removed') : (match?'accepted':'manual_added');
  await cmRecordFeedback(movie,trait,decision,match,movieId);
};
window.toggleMovieTrait=toggleMovieTrait;

suggestTraits=async function(movieId){
  const movie=(state.movies||[]).find(function(x){ return x.id===movieId; });
  if(!movie) return;
  const analysis=cheeseMasterAnalyze(movie);
  const suggestions=analysis.matches.filter(function(m){ return !movie.selectedTraitIds?.includes(m.trait.id); });
  if(!suggestions.length) return alert('Cheese Master did not find any new plausible Cheese Traits yet.');
  const lines=suggestions.slice(0,18).map(function(m){
    return '• '+m.trait.name+' (+'+m.trait.points+') — '+cmTier(m.confidence)+' '+Math.round(m.confidence*100)+'%: '+((m.evidence||[])[0]||m.reason);
  });
  if(suggestions.length>18) lines.push('• +'+(suggestions.length-18)+' more possible traits');
  if(!confirm('Cheese Master found '+suggestions.length+' possible traits.\\n\\n'+lines.join('\\n')+'\\n\\nEstimated Cheese Rating: '+analysis.score+'/100\\n\\nAdd all of these? You can remove anything it got wrong; removals teach it too.')) return;

  const rows=suggestions.map(function(m){
    return {
      workspace_id:workspace.id,
      movie_id:movieId,
      trait_id:m.trait.id,
      selected_by:me(),
      selection_source:'cheese_master',
      confidence:m.confidence,
      evidence:{engine:CHEESE_MASTER_VERSION,reason:m.reason,evidence:m.evidence||[]}
    };
  });
  const res=await db.from('movie_traits').insert(rows);
  if(res.error) return alert(res.error.message);
  for(const m of suggestions) await cmRecordFeedback(movie,m.trait,'accepted',m,movieId);
  await logActivity('accepted '+suggestions.length+' Cheese Master suggestion'+(suggestions.length===1?'':'s')+' for '+movie.title+'.','movie',movieId);
  await loadAll(); render();
};
window.suggestTraits=suggestTraits;

const cmOriginalAddDiscoveredMovie=addDiscoveredMovie;
addDiscoveredMovie=async function(tmdbId,applyTraits){
  const candidate=(state.discoveryResults||[]).find(function(x){ return Number(x.tmdb_id)===Number(tmdbId); });
  const analysis=candidate?cheeseMasterAnalyze(candidate):null;
  await cmOriginalAddDiscoveredMovie(tmdbId,applyTraits);
  if(!candidate||!workspace) return;
  const saved=(state.movies||[]).find(function(m){ return Number(m.tmdb_id)===Number(tmdbId); });
  if(!saved) return;

  const metadata={
    tagline:candidate.tagline||null,
    keywords:cmArr(candidate.keywords),
    genres:cmArr(candidate.genres),
    production_companies:cmArr(candidate.production_companies),
    cast_characters:cmArr(candidate.cast_characters),
    external_ids:candidate.external_ids||{},
    providers:cmArr(candidate.providers),
    holiday:candidate.holiday||null,
    season:candidate.season||null,
    network:candidate.network||null,
    cheese_master_version:CHEESE_MASTER_VERSION
  };
  await db.from('movies').update({source_metadata:metadata,updated_at:new Date().toISOString()}).eq('id',saved.id);

  if(applyTraits && analysis){
    const accepted=analysis.matches.filter(function(m){ return m.confidence>=0.68; });
    for(const m of accepted){
      await db.from('movie_traits').update({
        selection_source:'cheese_master',
        confidence:m.confidence,
        evidence:{engine:CHEESE_MASTER_VERSION,reason:m.reason,evidence:m.evidence||[]}
      }).eq('movie_id',saved.id).eq('trait_id',m.trait.id);
      await cmRecordFeedback(candidate,m.trait,'accepted',m,saved.id);
    }
  }
  await loadAll();
  selectedMovie=saved.id;
  render();
};
window.addDiscoveredMovie=addDiscoveredMovie;

function cmCsv(value){
  return String(value||'').split(',').map(function(x){ return x.trim(); }).filter(Boolean);
}
async function cmTeachTrait(id){
  const trait=(state.traits||[]).find(function(t){ return t.id===id; });
  if(!trait) return;
  const current=cmProfile(trait);
  const aliases=prompt('Cheese Master aliases / equivalent phrases (comma separated):',current.aliases.filter(function(x){return cmNorm(x)!==cmNorm(trait.name);}).join(', '));
  if(aliases===null) return;
  const cues=prompt('Story cues that should suggest this trait (comma separated):',current.cues.join(', '));
  if(cues===null) return;
  const context=prompt('Helpful context words/phrases (comma separated):',current.context.join(', '));
  if(context===null) return;
  const exclusions=prompt('False-positive phrases to push this trait DOWN (comma separated):',current.exclusions.join(', '));
  if(exclusions===null) return;
  const recognition={
    aliases:cmCsv(aliases),
    cues:cmCsv(cues),
    context:cmCsv(context),
    exclusions:cmCsv(exclusions),
    concepts:cmArr(trait.recognition?.concepts),
    all:cmArr(trait.recognition?.all),
    taught_at:new Date().toISOString()
  };
  const res=await db.from('cheese_traits').update({recognition:recognition,updated_at:new Date().toISOString()}).eq('id',id);
  if(res.error) return alert(res.error.message);
  await logActivity('taught Cheese Master how to recognize "'+trait.name+'".','trait',id);
  await loadAll(); render();
}
window.cmTeachTrait=cmTeachTrait;

function cmEnhanceTraitManager(){
  document.querySelectorAll('.trait-art-manager-row').forEach(function(row){
    if(row.querySelector('.cm-teach-button')) return;
    const edit=[...row.querySelectorAll('button')].find(function(b){ return /editTrait/.test(b.getAttribute('onclick')||''); });
    if(!edit) return;
    const match=(edit.getAttribute('onclick')||'').match(/editTrait\\((['"])([^'"]+)\\1\\)/);
    if(!match) return;
    const id=match[2];
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='secondary cm-teach-button';
    btn.textContent='Teach';
    btn.title='Teach Cheese Master aliases, story cues, and false positives';
    btn.onclick=function(){ cmTeachTrait(id); };
    const actions=row.querySelector('.trait-art-manager-actions')||edit.parentElement;
    actions?.appendChild(btn);
  });
}
const cmOriginalRender=render;
render=function(){
  const result=cmOriginalRender.apply(this,arguments);
  setTimeout(cmEnhanceTraitManager,0);
  return result;
};

const cmOriginalTopbar=topbar;
topbar=function(){
  return cmOriginalTopbar().replace(/>v1\\.\\d+</,'>'+CHEESE_MASTER_VERSION+'<');
};

const cmStyle=document.createElement('style');
cmStyle.id='cheeseMasterStyles';
cmStyle.textContent='.cm-evidence-row{margin-top:8px;line-height:1.45}.cm-teach-button{border-color:#6fce8a!important}.new-find-score .cheese-score{font-variant-numeric:tabular-nums}';
document.head.appendChild(cmStyle);

(function cmWarmStart(){
  let tries=0;
  const timer=setInterval(function(){
    if(workspace){ clearInterval(timer); cmLoadFeedback().then(function(){ render(); }); }
    else if(++tries>24) clearInterval(timer);
  },250);
})();
