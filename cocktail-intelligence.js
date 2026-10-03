// Cheese Louise v1.13 — Cocktail Intelligence
// Live TheCocktailDB catalog + IBA metadata + granular movie fingerprints
// + automated three-way Cheese Louise generator (Familiar / Craft / Wildcard).

state.onlineCocktails = state.onlineCocktails || [];

let clOnlineCatalogStatus = { loaded:false, loading:false, error:'', updatedAt:null };
let clGeneratedVersions = [];
let clGeneratedForMovieId = '';
let clGeneratedContext = 'bar';

const CL_COCKTAILDB_BASE = 'https://www.thecocktaildb.com/api/json/v1/1';
const CL_COCKTAILDB_CACHE_KEY = 'cheeseLouiseCocktailDB_v113';
const CL_COCKTAILDB_CACHE_MS = 24 * 60 * 60 * 1000;
const CL_COCKTAIL_INTELLIGENCE_VERSION = 'v1.13';

const CL_IBA_GROUPS = {
  'The Unforgettables': [
    'Alexander','Americano','Angel Face','Aviation','Between the Sheets','Boulevardier','Brandy Crusta','Casino','Clover Club','Daiquiri','Dry Martini','Gin Fizz','Hanky Panky','John Collins','Last Word','Manhattan','Martinez','Mary Pickford','Monkey Gland','Negroni','Old Fashioned','Paradise','Planters Punch','Porto Flip','Ramos Fizz','Remember the Maine','Rusty Nail','Sazerac','Sidecar','Stinger','Tuxedo','Vieux Carré','Whiskey Sour','White Lady'
  ],
  'Contemporary Classics': [
    'Bellini','Black Russian','Bloody Mary','Caipirinha','Cardinale','Champagne Cocktail','Corpse Reviver #2','Cosmopolitan','Cuba Libre','French 75','French Connection','Garibaldi','Grasshopper','Hemingway Special','Horse’s Neck','Irish Coffee','Kir','Lemon Drop Martini','Long Island Iced Tea','Mai-Tai','Margarita','Mimosa','Mint Julep','Mojito','Moscow Mule','Pina Colada','Pisco Sour','Rabo de Galo','Sea Breeze','Sex on the Beach','Singapore Sling','Tequila Sunrise','Vesper','Zombie'
  ],
  'New Era': [
    'Bee’s Knees','Bramble','Canchanchara','Chartreuse Swizzle','Dark ‘N’ Stormy',"Don's Special Daiquiri",'Espresso Martini','Fernandito','French Martini','Gin Basil Smash','Grand Margarita','IBA Tiki','Illegal','Jungle Bird',"Missionary's Downfall",'Naked and Famous','New York Sour','Old Cuban','Paloma','Paper Plane','Penicillin','Pisco Punch','Porn Star Martini','Russian Spring Punch','Sherry Cobbler','South Side','Spicy Fifty','Spritz','Suffering Bastard','Three Dots and a Dash',"Tommy's Margarita",'Trinidad Sour','Ve.N.To'
  ]
};

function clNormName(value){
  return String(value||'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[’‘]/g,"'")
    .replace(/[^a-z0-9]+/g,' ').trim();
}

const CL_IBA_NAME_MAP = (()=>{
  const map = new Map();
  for(const [category,names] of Object.entries(CL_IBA_GROUPS)){
    for(const name of names) map.set(clNormName(name), category);
  }
  map.set(clNormName('Piña Colada'),'Contemporary Classics');
  map.set(clNormName('Mai Tai'),'Contemporary Classics');
  map.set(clNormName("Dark 'N' Stormy"),'New Era');
  map.set(clNormName('Bees Knees'),'New Era');
  return map;
})();

const CL_CRAFT_TREND_LENSES = [
  {
    source:'PUNCH',
    label:'Fall 2026 popular-drink signals',
    url:'https://punchdrink.com/articles/most-popular-best-cocktail-recipes-september-2026/',
    tags:['rye','maple','herbal','chartreuse','martini','rich','spirit-forward']
  },
  {
    source:'Liquor.com',
    label:'Modern-classic / craft technique lens',
    url:'https://www.liquor.com/cocktail-and-other-recipes-4779343',
    tags:['mezcal','amaro','sherry','spritz','martini','aperitivo','modern-classic']
  },
  {
    source:'Imbibe',
    label:'Contemporary bar technique lens',
    url:'https://imbibemagazine.com/',
    tags:['tea','cordial','split-base','low-abv','seasonal','savory','aperitivo']
  }
];

const CL_SPIRIT_RULES = [
  [/rye whiskey|rye\b/i,'Rye'],[/bourbon/i,'Bourbon'],[/scotch/i,'Scotch'],[/irish whiskey/i,'Irish Whiskey'],[/whisk(?:e)?y/i,'Whiskey'],
  [/gin/i,'Gin'],[/dark rum|aged rum/i,'Aged Rum'],[/white rum|light rum/i,'White Rum'],[/rum/i,'Rum'],
  [/mezcal/i,'Mezcal'],[/tequila/i,'Tequila'],[/pisco/i,'Pisco'],[/cachaca|cachaça/i,'Cachaça'],
  [/cognac/i,'Cognac'],[/brandy/i,'Brandy'],[/vodka/i,'Vodka'],[/champagne|prosecco|sparkling wine/i,'Sparkling Wine'],
  [/sherry/i,'Sherry'],[/port\b/i,'Port'],[/vermouth/i,'Vermouth'],[/wine/i,'Wine']
];

const CL_INGREDIENT_TAG_RULES = [
  [/gin|juniper/i,['gin','botanical','herbal']],
  [/rye/i,['rye','whiskey','warming','spirit-forward','amber']],
  [/bourbon/i,['bourbon','whiskey','warming','spirit-forward','amber']],
  [/whisk(?:e)?y|scotch/i,['whiskey','warming','spirit-forward','amber']],
  [/rum/i,['rum']], [/tequila/i,['tequila','agave']], [/mezcal/i,['mezcal','agave','smoky','craft']],
  [/pisco/i,['pisco','brandy','floral']], [/brandy|cognac/i,['brandy','warming','elegant']],
  [/vodka/i,['vodka','clean']],
  [/champagne|prosecco|sparkling wine|cava/i,['sparkling','celebratory','elegant','light']],
  [/vermouth/i,['vermouth','fortified-wine','herbal','elegant']],
  [/sherry/i,['sherry','fortified-wine','nutty','craft','low-abv']],
  [/port\b/i,['port','fortified-wine','rich','dark']],
  [/campari|aperol/i,['aperitivo','bitter','orange','herbal']],
  [/amaro|fernet/i,['amaro','bitter','herbal','craft']],
  [/chartreuse/i,['chartreuse','herbal','craft']],
  [/benedictine|bénédictine/i,['herbal','spiced','craft']],
  [/absinthe|pastis/i,['anise','herbal','craft']],
  [/falernum|orgeat/i,['tiki','spiced','nutty','craft']],
  [/lemon|lime|grapefruit|orange|citrus/i,['citrus','bright','refreshing']],
  [/cranberry|raspberry|blackberry|strawberry|berry/i,['berry','fruity','romantic']],
  [/pineapple|passion fruit|mango|coconut/i,['tropical','fruity','summer']],
  [/apple|cider/i,['apple','orchard','fall']], [/pear/i,['pear','orchard','elegant']],
  [/coffee|espresso|kahlua/i,['coffee','dark','after-dinner','rich']],
  [/chocolate|cacao|creme de cacao|crème de cacao/i,['chocolate','dessert','rich']],
  [/cream|milk|half-and-half/i,['creamy','rich','dessert']], [/egg|egg white/i,['foamy','silky','sour']],
  [/ginger/i,['ginger','spicy','warming']], [/mint/i,['mint','fresh','herbal']],
  [/basil|rosemary|thyme|sage/i,['herbal','fresh','craft']],
  [/cinnamon|nutmeg|allspice|clove/i,['baking-spice','spiced','warming']],
  [/honey/i,['honey','sweet','warming']], [/maple/i,['maple','sweet','fall','warming']],
  [/simple syrup|sugar|syrup|grenadine/i,['sweet']],
  [/bitters/i,['bitter','spiced','spirit-forward']],
  [/soda|club soda|tonic|ginger ale/i,['highball','refreshing','long']],
  [/beer|ale/i,['beer','long','casual']],
  [/tea/i,['tea','craft','low-abv']]
];

const CL_MOVIE_FINGERPRINT_RULES = [
  [/bakery|baker|pastry|cupcake|cake shop/i,['bakery','dessert','sweet','vanilla','baking-spice','cozy']],
  [/christmas tree farm|tree farm/i,['tree-farm','herbal','rosemary','juniper','rustic','winter','holiday']],
  [/farm|ranch|country/i,['rustic','country','warming','bourbon']],
  [/vineyard|winery|winemaker|vintner/i,['vineyard','wine','grape','elegant','romantic']],
  [/royal|prince|princess|duke|duchess|palace|castle/i,['royal','elegant','sparkling','celebratory','gold']],
  [/beach|island|tropical|resort|hawaii|caribbean/i,['tropical','rum','citrus','refreshing','summer']],
  [/mountain|ski|cabin|lodge/i,['mountain','warming','cozy','rustic','winter']],
  [/snow|blizzard|snowed in|winter storm/i,['snow','winter','warming','cozy']],
  [/bookstore|book shop|author|writer|novelist/i,['bookish','cozy','coffee','tea']],
  [/coffee shop|cafe|café|barista/i,['coffee','cozy','casual']],
  [/restaurant|chef|cooking|cook-off|culinary/i,['food','savory','herbal','craft']],
  [/wedding|bride|groom|engagement/i,['wedding','romantic','celebratory','sparkling','floral']],
  [/festival|fundraiser|gala|ball|party|tree lighting/i,['festival','celebratory','crowd-friendly','sparkling']],
  [/competition|contest|rival|rivals/i,['competition','playful','bitter','spicy']],
  [/mystery|detective|secret|hidden/i,['mystery','dark','herbal','spirit-forward']],
  [/magic|magical|witch|wish|enchanted/i,['magical','floral','unexpected','playful']],
  [/time travel|travels? back in time/i,['time-travel','unexpected','retro','spirit-forward']],
  [/fake dating|pretend couple|fake relationship/i,['fake-dating','playful','romantic','sparkling']],
  [/childhood sweetheart|first love|old flame|second chance|reconnect/i,['nostalgic','romantic','warming','classic']],
  [/widow|widower|late husband|late wife|dead spouse|deceased spouse/i,['bittersweet','dark','spirit-forward','warming']],
  [/single mom|single dad|single mother|single father/i,['family','cozy','approachable']],
  [/executive|corporate|lawyer|attorney|ceo|big city|new york|manhattan/i,['city','elegant','martini','night']],
  [/christmas|holiday/i,['holiday','winter','cranberry','warming','baking-spice','sparkling']],
  [/halloween|spooky|haunted/i,['halloween','dark','spiced','berry','playful']],
  [/valentine|valentine's/i,['valentines','romantic','berry','floral','sparkling','pink']],
  [/new year|new year's/i,['new-years','celebratory','sparkling','elegant','night']],
  [/fall|autumn|harvest/i,['fall','apple','maple','warming','spiced']],
  [/spring/i,['spring','floral','light','citrus']],
  [/summer/i,['summer','refreshing','citrus','tropical']],
  [/cozy|fireplace|fireside/i,['cozy','warming','rich']],
  [/glamour|glamorous|luxury|luxurious/i,['glamorous','elegant','sparkling']],
  [/quirky|goofy|wacky|campy|absurd/i,['campy','playful','unexpected']],
  [/music|singer|band|concert/i,['music','night','celebratory']],
  [/road trip|roadtrip|travel/i,['adventure','refreshing','highball']]
];

const CL_VARIATION_ACCENTS = [
  { test:t=>t.has('christmas')||t.has('holiday')||t.has('tree-farm'), label:'cranberry-rosemary cordial', amount:'1/4 oz', tags:['cranberry','rosemary','holiday'], garnish:'Rosemary sprig and orange peel' },
  { test:t=>t.has('bakery')||t.has('dessert')||t.has('baking-spice'), label:'vanilla-cinnamon syrup', amount:'1/4 oz', tags:['vanilla','baking-spice','dessert'], garnish:'Fresh grated nutmeg' },
  { test:t=>t.has('fall')||t.has('apple')||t.has('orchard'), label:'apple-cardamom syrup', amount:'1/4 oz', tags:['apple','cardamom','fall'], garnish:'Thin apple fan' },
  { test:t=>t.has('royal')||t.has('elegant')||t.has('wedding'), label:'elderflower cordial', amount:'1/4 oz', tags:['floral','elegant'], garnish:'Lemon twist' },
  { test:t=>t.has('tropical')||t.has('beach'), label:'passion fruit syrup', amount:'1/4 oz', tags:['tropical','passion-fruit'], garnish:'Lime wheel and mint' },
  { test:t=>t.has('halloween')||t.has('dark')||t.has('mystery'), label:'blackberry-black tea syrup', amount:'1/4 oz', tags:['blackberry','tea','dark'], garnish:'Blackberry and expressed orange peel' },
  { test:t=>t.has('coffee')||t.has('bookish'), label:'coffee-orange cordial', amount:'1/4 oz', tags:['coffee','orange','cozy'], garnish:'Orange peel' },
  { test:t=>t.has('sparkling')||t.has('celebratory'), label:'sparkling wine', amount:'1 oz', tags:['sparkling','celebratory'], garnish:'Lemon twist' },
  { test:t=>t.has('herbal')||t.has('rustic'), label:'rosemary-honey syrup', amount:'1/4 oz', tags:['herbal','honey','rustic'], garnish:'Rosemary sprig' },
  { test:t=>t.has('spicy')||t.has('competition'), label:'ginger-honey syrup', amount:'1/4 oz', tags:['ginger','spicy'], garnish:'Candied ginger' }
];

const CL_CRAFT_TECHNIQUES = [
  { tags:['winter','cozy','fall','warming'], text:'Split the sweetener between maple and black-tea syrup for a richer, drier finish.', add:'1/4 oz maple-black tea syrup', extraTags:['maple','tea','craft'] },
  { tags:['elegant','royal','city','martini'], text:'Use a small fortified-wine split for a modern bar-style lift.', add:'1/4 oz fino sherry or blanc vermouth', extraTags:['sherry','fortified-wine','craft'] },
  { tags:['herbal','tree-farm','rustic'], text:'Layer rosemary and juniper instead of literal pine for a clean forest note.', add:'1/4 oz rosemary-juniper cordial', extraTags:['rosemary','juniper','craft'] },
  { tags:['tropical','summer','beach'], text:'Add a restrained passion-fruit accent and a saline pinch for a sharper tropical profile.', add:'1/4 oz passion fruit syrup + tiny pinch saline', extraTags:['passion-fruit','saline','craft'] },
  { tags:['dark','mystery','halloween'], text:'Use blackberry-black tea as the dark element instead of food coloring.', add:'1/4 oz blackberry-black tea syrup', extraTags:['blackberry','tea','craft'] },
  { tags:['bakery','dessert','baking-spice'], text:'Use a dry vanilla-cardamom cordial so the drink reads pastry without becoming syrupy.', add:'1/4 oz vanilla-cardamom cordial', extraTags:['vanilla','cardamom','craft'] },
  { tags:['floral','spring','romantic','wedding'], text:'Use elderflower plus a touch of dry vermouth for a floral but adult finish.', add:'1/4 oz elderflower cordial + 1/4 oz dry vermouth', extraTags:['floral','vermouth','craft'] }
];

function clDelay(ms){ return new Promise(resolve=>setTimeout(resolve,ms)); }

function clReadOnlineCache(){
  try{
    const raw=localStorage.getItem(CL_COCKTAILDB_CACHE_KEY);
    if(!raw) return null;
    const parsed=JSON.parse(raw);
    if(!parsed?.savedAt || !Array.isArray(parsed?.items)) return null;
    if(Date.now()-parsed.savedAt>CL_COCKTAILDB_CACHE_MS) return null;
    return parsed;
  }catch(_){ return null; }
}

function clWriteOnlineCache(items){
  try{ localStorage.setItem(CL_COCKTAILDB_CACHE_KEY, JSON.stringify({savedAt:Date.now(),items})); }catch(_){ }
}

function clDrinkIngredients(raw){
  const rows=[];
  for(let i=1;i<=15;i++){
    const ingredient=String(raw?.[`strIngredient${i}`]||'').trim();
    const measure=String(raw?.[`strMeasure${i}`]||'').trim();
    if(ingredient) rows.push({ingredient,measure});
  }
  return rows;
}

function clInferBaseSpirit(text){
  for(const [re,label] of CL_SPIRIT_RULES) if(re.test(text)) return label;
  return '';
}

function clInferFamily(candidate){
  const name=String(candidate?.name||candidate?.strDrink||'').toLowerCase();
  const category=String(candidate?.source_category||candidate?.strCategory||'').toLowerCase();
  const ing=String(candidate?.ingredientText||candidate?.ingredients||'').toLowerCase();
  if(/martini|vesper|gibson/.test(name)) return 'Martini';
  if(/old fashioned/.test(name)) return 'Old Fashioned';
  if(/manhattan|martinez|vieux carré|remember the maine/.test(name)) return 'Manhattan';
  if(/negroni|boulevardier|americano/.test(name)) return 'Bitter Aperitivo';
  if(/spritz/.test(name)) return 'Spritz';
  if(/sour|daiquiri|margarita|sidecar|white lady|pisco sour|clover club|last word|paper plane|bee.?s knees/.test(name)) return 'Sour';
  if(/fizz|ramos/.test(name)) return 'Fizz';
  if(/collins/.test(name)) return 'Collins';
  if(/mule|buck/.test(name)) return 'Mule';
  if(/julep|smash/.test(name)) return 'Smash/Julep';
  if(/flip|alexander|grasshopper/.test(name)) return 'Rich / Flip';
  if(/punch|tiki|zombie|mai.?tai|jungle bird|three dots|missionary/.test(name+category)) return 'Tiki / Punch';
  if(/coffee|toddy|hot/.test(name+category)) return 'Hot / Coffee';
  if(/highball|horse.?s neck|cuba libre|sea breeze/.test(name+category)) return 'Highball';
  if(/champagne|mimosa|bellini|kir|old cuban/.test(name+ing)) return 'Sparkling';
  if(category.includes('shot')) return 'Shot';
  if(/lemon|lime/.test(ing) && /syrup|sugar|honey|liqueur/.test(ing)) return 'Sour';
  return category ? category.replace(/\b\w/g,c=>c.toUpperCase()) : 'Cocktail';
}

function clDeriveCocktailTags(candidate){
  const rows=candidate?.ingredientRows||[];
  const text=[candidate?.name,candidate?.source_category,candidate?.glassware,candidate?.method,...rows.map(r=>r.ingredient)].filter(Boolean).join(' ');
  const tags=new Set();
  for(const [re,vals] of CL_INGREDIENT_TAG_RULES) if(re.test(text)) vals.forEach(v=>tags.add(clCleanTag(v)));
  const family=clInferFamily({...candidate,ingredientText:text});
  tags.add(clCleanTag(family));
  const base=clInferBaseSpirit(text);
  if(base) tags.add(clCleanTag(base));
  if(/shake/i.test(candidate?.method||'')) tags.add('shaken');
  if(/stir/i.test(candidate?.method||'')) tags.add('stirred');
  if(/blend/i.test(candidate?.method||'')) tags.add('frozen');
  if(/champagne flute|flute/i.test(candidate?.glassware||'')) tags.add('elegant');
  if(/highball|collins/i.test(candidate?.glassware||'')) tags.add('long');
  return [...tags];
}

function clNormalizeExternalDrink(raw){
  const ingredientRows=clDrinkIngredients(raw);
  const ingredients=ingredientRows.map(r=>`${r.measure?`${r.measure} `:''}${r.ingredient}`.trim()).join('\n');
  const sourceCategory=raw?.strCategory||'';
  const candidate={
    id:`external:${raw.idDrink}`,
    external:true,
    external_id:String(raw.idDrink||''),
    source_name:'TheCocktailDB',
    source_id:String(raw.idDrink||''),
    source_url:`https://www.thecocktaildb.com/drink/${raw.idDrink}`,
    source_category:sourceCategory,
    source_image_url:raw?.strDrinkThumb||'',
    name:raw?.strDrink||'Untitled cocktail',
    cocktail_type:'original',
    ingredientRows,
    ingredients,
    method:raw?.strInstructions||'',
    glassware:raw?.strGlass||'',
    alcoholic:raw?.strAlcoholic||'',
    batchable:false,
    tested:false,
    rating:null,
    season:null,
    holiday:null
  };
  const ingredientText=ingredientRows.map(r=>r.ingredient).join(' ');
  candidate.base_spirit=clInferBaseSpirit(ingredientText);
  candidate.style=clInferFamily({...candidate,ingredientText});
  candidate.flavor_tags=clDeriveCocktailTags(candidate);
  candidate.iba_category=CL_IBA_NAME_MAP.get(clNormName(candidate.name))||null;
  candidate.iba_official=!!candidate.iba_category;
  return candidate;
}

async function clLoadOnlineCatalog(force=false){
  if(clOnlineCatalogStatus.loading) return;
  if(clOnlineCatalogStatus.loaded && !force) return;

  if(!force){
    const cached=clReadOnlineCache();
    if(cached){
      state.onlineCocktails=cached.items||[];
      clOnlineCatalogStatus={loaded:true,loading:false,error:'',updatedAt:new Date(cached.savedAt)};
      if(cocktailHubView==='bar' || selectedEpisode) render();
      return;
    }
  }

  clOnlineCatalogStatus={...clOnlineCatalogStatus,loading:true,error:''};
  if(cocktailHubView==='bar') render();
  const letters='abcdefghijklmnopqrstuvwxyz'.split('');
  const raw=[];
  try{
    for(let i=0;i<letters.length;i+=5){
      const batch=letters.slice(i,i+5);
      const results=await Promise.all(batch.map(async letter=>{
        const res=await fetch(`${CL_COCKTAILDB_BASE}/1/search.php?f=${letter}`);
        if(!res.ok) throw new Error(`Cocktail source returned ${res.status}`);
        const json=await res.json();
        return json?.drinks||[];
      }));
      raw.push(...results.flat());
      if(i+5<letters.length) await clDelay(120);
    }
    const byId=new Map();
    raw.forEach(d=>{ if(d?.idDrink) byId.set(String(d.idDrink),clNormalizeExternalDrink(d)); });
    state.onlineCocktails=[...byId.values()].sort((a,b)=>a.name.localeCompare(b.name));
    clWriteOnlineCache(state.onlineCocktails);
    clOnlineCatalogStatus={loaded:true,loading:false,error:'',updatedAt:new Date()};
  }catch(err){
    console.error('CocktailDB catalog load failed',err);
    clOnlineCatalogStatus={loaded:false,loading:false,error:err?.message||String(err),updatedAt:null};
  }
  if(cocktailHubView==='bar' || selectedEpisode) render();
}

function clWarmOnlineCatalog(){
  if(!clOnlineCatalogStatus.loaded && !clOnlineCatalogStatus.loading){
    setTimeout(()=>clLoadOnlineCatalog(false),0);
  }
}

function clFingerprintAdd(map,tag,weight=1){
  tag=clCleanTag(tag);
  if(!tag) return;
  map.set(tag,(map.get(tag)||0)+Number(weight||1));
}

function clMovieFingerprint(movie){
  const weights=new Map();
  const evidence=[];
  const add=(tags,weight,why)=>{
    for(const tag of tags||[]) clFingerprintAdd(weights,tag,weight);
    if(why) evidence.push(why);
  };

  const base=typeof clMovieCocktailSignals==='function' ? clMovieCocktailSignals(movie) : {tags:[],evidence:[]};
  add(base.tags,2);
  evidence.push(...(base.evidence||[]));

  if(movie?.holiday) add([movie.holiday],5,`${movie.holiday} holiday`);
  if(movie?.season) add([movie.season],3,`${movie.season} season`);
  for(const trait of movie?.selectedTraits||[]) add([trait.name,trait.category],5,`selected Cheese Trait: ${trait.name}`);

  if(typeof romantiverseAnalyze==='function'){
    try{
      const rv=romantiverseAnalyze(movie);
      for(const match of rv?.matches||[]){
        add([match.trait?.name,match.trait?.category],Math.max(2,Math.round((match.confidence||0.75)*4)),`Romantiverse: ${match.trait?.name}`);
      }
    }catch(err){ console.warn('Romantiverse cocktail fingerprint skipped',err); }
  }

  const text=[movie?.title,movie?.summary,movie?.notes,movie?.network,movie?.holiday,movie?.season,...(movie?.tags||[]),...(movie?.providers||[]),...(movie?.selectedTraits||[]).map(t=>`${t.name} ${t.category}`)].filter(Boolean).join(' ');
  for(const [re,tags] of CL_MOVIE_FINGERPRINT_RULES){
    const hit=text.match(re);
    if(hit) add(tags,3,`movie clue: ${hit[0]}`);
  }

  const h=clCleanTag(movie?.holiday||'');
  if(h==='christmas') add(['red','green','gold','cranberry','rosemary'],2);
  if(h==='halloween') add(['orange','dark','blackberry','spiced'],2);
  if(h==='valentine-s-day') add(['pink','red','berry','floral'],2);

  return {weights,evidence:clUnique(evidence)};
}

function clCandidateFingerprint(candidate){
  const weights=new Map();
  const add=(tags,w=1)=>{ for(const t of tags||[]) clFingerprintAdd(weights,t,w); };
  add(candidate?.flavor_tags||[],3);
  add([candidate?.base_spirit,candidate?.style,candidate?.holiday,candidate?.season,candidate?.source_category],3);
  const ingredientRows=candidate?.ingredientRows||[];
  for(const row of ingredientRows){
    const temp={name:candidate?.name,ingredientRows:[row],source_category:candidate?.source_category,glassware:candidate?.glassware,method:candidate?.method};
    add(clDeriveCocktailTags(temp),2);
  }
  if(candidate?.iba_official) add(['classic','iba-official'],2);
  return weights;
}

function clRecentUseRows(){
  const rows=(state.episodes||[]).slice().sort((a,b)=>{
    const ad=a.release_date||a.updated_at||a.created_at||'';
    const bd=b.release_date||b.updated_at||b.created_at||'';
    return String(bd).localeCompare(String(ad));
  });
  return rows.map(e=>{
    const local=clCocktailById(e.cocktail_id);
    return {
      name:local?.name||e.cocktail||'',
      base_spirit:local?.base_spirit||'',
      style:local?.style||'',
      family:local?clInferFamily(local):'',
      id:local?.id||null
    };
  }).filter(x=>x.name);
}

function clDiversityPenalty(candidate){
  const history=clRecentUseRows();
  let penalty=0;
  const notes=[];
  const name=clNormName(candidate?.name);
  const base=clCleanTag(candidate?.base_spirit);
  const family=clCleanTag(clInferFamily(candidate));
  history.slice(0,5).forEach((h,index)=>{
    if(clNormName(h.name)===name){ const p=index<3?24:12; penalty+=p; notes.push(`-${p} recent repeat`); }
  });
  history.slice(0,3).forEach(h=>{
    if(base && clCleanTag(h.base_spirit)===base){ penalty+=5; notes.push('-5 recent base spirit'); }
    if(family && clCleanTag(h.family||h.style)===family){ penalty+=6; notes.push('-6 recent cocktail family'); }
  });
  return {penalty:Math.min(36,penalty),notes:clUnique(notes)};
}

function clSmartMatch(movie,candidate){
  const mf=clMovieFingerprint(movie);
  const cf=clCandidateFingerprint(candidate);
  let overlap=0;
  let movieTotal=0;
  const overlaps=[];
  for(const [tag,mw] of mf.weights){
    movieTotal+=mw;
    const cw=cf.get(tag)||0;
    if(cw){ overlap+=Math.min(mw,cw); overlaps.push({tag,weight:Math.min(mw,cw)}); }
  }
  overlaps.sort((a,b)=>b.weight-a.weight||a.tag.localeCompare(b.tag));
  const ratio=movieTotal?overlap/movieTotal:0;
  let raw=30 + ratio*105;
  if(candidate?.iba_official) raw+=3;
  if(candidate?.tested) raw+=3;
  if(candidate?.rating) raw+=(Number(candidate.rating)-3)*2;
  const diversity=clDiversityPenalty(candidate);
  const adjusted=Math.max(8,Math.min(99,Math.round(raw-diversity.penalty)));
  const reasons=[];
  if(overlaps.length) reasons.push(`matches ${overlaps.slice(0,6).map(x=>clTagLabel(x.tag)).join(', ')}`);
  if(candidate?.iba_official) reasons.push(`IBA ${candidate.iba_category}`);
  if(diversity.penalty) reasons.push(`diversity penalty ${diversity.penalty}`);
  if(!reasons.length) reasons.push('broad structural match');
  return {cocktail:candidate,score:adjusted,rawScore:Math.round(raw),overlaps:overlaps.map(x=>x.tag),reasons,diversity,movieFingerprint:mf,cocktailFingerprint:cf};
}

function clMergedOriginalCatalog(){
  const byName=new Map();
  for(const c of (state.cocktails||[]).filter(x=>x.cocktail_type==='original')){
    const enriched={...c,external:false,iba_category:c.iba_category||CL_IBA_NAME_MAP.get(clNormName(c.name))||null};
    enriched.iba_official=!!(c.iba_official||enriched.iba_category);
    byName.set(clNormName(c.name),enriched);
  }
  for(const c of state.onlineCocktails||[]){
    const key=clNormName(c.name);
    if(!byName.has(key)) byName.set(key,c);
  }
  return [...byName.values()];
}

function clSmartOriginalMatches(movie){
  const candidates=clMergedOriginalCatalog();
  return candidates.map(c=>clSmartMatch(movie,c)).sort((a,b)=>b.score-a.score||b.rawScore-a.rawScore||a.cocktail.name.localeCompare(b.cocktail.name));
}

function clTrendBonus(candidate){
  const tags=new Set((candidate?.flavor_tags||[]).map(clCleanTag));
  const ingredients=(candidate?.ingredientRows||[]).map(r=>clCleanTag(r.ingredient));
  ingredients.forEach(i=>tags.add(i));
  let bonus=0;
  const hits=[];
  for(const lens of CL_CRAFT_TREND_LENSES){
    for(const tag of lens.tags){
      const clean=clCleanTag(tag);
      if([...tags].some(t=>t.includes(clean)||clean.includes(t))){ bonus+=3; hits.push(`${lens.source}: ${tag}`); }
    }
  }
  if(['Mezcal','Sherry','Rye','Pisco'].includes(candidate?.base_spirit)) bonus+=4;
  if(/Martini|Bitter|Spritz|Tiki|Sour/i.test(candidate?.style||'')) bonus+=2;
  return {bonus:Math.min(18,bonus),hits:clUnique(hits).slice(0,4)};
}

function clDifferenceScore(candidate,chosen){
  if(!chosen?.length) return 0;
  let score=0;
  const base=clCleanTag(candidate?.base_spirit);
  const family=clCleanTag(clInferFamily(candidate));
  for(const c of chosen){
    if(base && base!==clCleanTag(c.cocktail?.base_spirit)) score+=5;
    if(family && family!==clCleanTag(clInferFamily(c.cocktail))) score+=7;
    const a=new Set(candidate?.flavor_tags||[]);
    const b=new Set(c.cocktail?.flavor_tags||[]);
    let shared=0; for(const t of a) if(b.has(t)) shared++;
    score+=Math.max(0,5-shared);
  }
  return score;
}

function clPickThreeBases(movie){
  const ranked=clSmartOriginalMatches(movie);
  if(!ranked.length) return [];
  const familiar=ranked[0];
  const craftPool=ranked.slice(0,120).filter(r=>clNormName(r.cocktail.name)!==clNormName(familiar.cocktail.name));
  const craft=(craftPool.length?craftPool:[...ranked]).map(r=>({r,score:r.score+clTrendBonus(r.cocktail).bonus+clDifferenceScore(r.cocktail,[familiar])})).sort((a,b)=>b.score-a.score)[0]?.r || familiar;
  const chosen=[familiar,craft];
  const floor=Math.max(35,(familiar.score||0)-35);
  const wildPool=ranked.slice(0,220).filter(r=>r.score>=floor && !chosen.some(c=>clNormName(c.cocktail.name)===clNormName(r.cocktail.name)));
  const wildcard=(wildPool.length?wildPool:ranked.filter(r=>!chosen.includes(r))).map(r=>({r,score:r.score+clDifferenceScore(r.cocktail,chosen)+(r.cocktail.iba_official?0:4)})).sort((a,b)=>b.score-a.score)[0]?.r || ranked[Math.min(2,ranked.length-1)];
  return [
    {role:'Familiar',match:familiar},
    {role:'Craft',match:craft},
    {role:'Wildcard',match:wildcard}
  ];
}

function clThemeLabel(movie){
  const traits=(movie?.selectedTraits||[]).map(t=>t.name);
  const priority=traits.find(x=>/tree farm|bakery|vineyard|royal|inn|bookstore|fake dating|snowed|widow|festival/i.test(x));
  if(priority) return priority;
  if(movie?.holiday) return movie.holiday;
  if(movie?.season) return movie.season;
  const words=String(movie?.title||'Romantiverse').split(/\s+/).filter(w=>w.length>3 && !/christmas|holiday|love|movie/i.test(w));
  return words.slice(0,2).join(' ') || 'Romantiverse';
}

function clChooseAccent(fingerprint,role){
  const tags=new Set([...fingerprint.weights.keys()]);
  let pool=CL_VARIATION_ACCENTS.filter(a=>a.test(tags));
  if(!pool.length) pool=CL_VARIATION_ACCENTS;
  if(role==='Familiar') return pool[0];
  if(role==='Craft') return pool[Math.min(1,pool.length-1)]||pool[0];
  return pool[pool.length>2?2:pool.length-1]||pool[0];
}

function clChooseCraftTechnique(fingerprint){
  const tags=new Set([...fingerprint.weights.keys()]);
  return CL_CRAFT_TECHNIQUES.find(t=>t.tags.some(tag=>tags.has(clCleanTag(tag)))) || CL_CRAFT_TECHNIQUES[0];
}

function clVariantName(movie,base,role){
  const theme=clThemeLabel(movie);
  if(role==='Familiar') return `${theme} ${base.name}`;
  if(role==='Craft') return `${theme} No. 2`;
  return `The ${theme} Detour`;
}

function clBuildGeneratedVariant(movie,selection,index){
  const base=selection.match.cocktail;
  const fingerprint=selection.match.movieFingerprint||clMovieFingerprint(movie);
  const accent=clChooseAccent(fingerprint,selection.role);
  const technique=selection.role==='Craft'?clChooseCraftTechnique(fingerprint):null;
  const tags=new Set([...(base.flavor_tags||[]),...selection.match.overlaps,...(accent?.tags||[]),...(technique?.extraTags||[]),'cheese-louise']);
  const ingredientLines=String(base.ingredients||'').split('\n').filter(Boolean);
  const changes=[];
  if(accent){
    const hasSweetener=ingredientLines.some(line=>/simple syrup|sugar|honey|maple|syrup/i.test(line));
    changes.push(hasSweetener
      ? `Replace up to 1/4 oz of the existing sweetener with ${accent.amount} ${accent.label}.`
      : `Add ${accent.amount} ${accent.label}; if the base is already sweet, reduce another sweet element by about 1/4 oz.`);
  }
  if(technique) changes.push(technique.text);
  if(selection.role==='Wildcard') changes.push('Keep the base cocktail structure recognizable, but lean into the contrasting spirit/family rather than making it taste like the other two options.');

  const recipe=[...ingredientLines,'','CHEESE LOUISE CHANGES:',...changes.map(x=>`• ${x}`)].join('\n');
  const trend=clTrendBonus(base);
  const rationale=[
    ...selection.match.reasons,
    selection.role==='Craft' && trend.hits.length?`craft lens: ${trend.hits.join(' · ')}`:'',
    selection.role==='Wildcard'?'selected for maximum contrast while preserving movie-fit signals':''
  ].filter(Boolean).join(' · ');
  return {
    key:`${Date.now()}-${index}-${base.source_id||base.id||base.name}`,
    role:selection.role,
    name:clVariantName(movie,base,selection.role),
    base,
    matchScore:selection.match.score,
    rawMatchScore:selection.match.rawScore,
    rationale,
    ingredients:recipe,
    method:`${base.method||'Prepare using the base cocktail method.'} ${changes.join(' ')}`,
    garnish:accent?.garnish||base.garnish||'',
    glassware:base.glassware||'',
    base_spirit:base.base_spirit||'',
    style:base.style||clInferFamily(base),
    flavor_tags:[...tags].slice(0,24),
    season:movie?.season||null,
    holiday:movie?.holiday||null,
    notes:`Generated for ${movie?.title||'this movie'} as the ${selection.role} option. Base: ${base.name}. ${rationale}`,
    batchable:!!base.batchable,
    strength:base.strength||'medium',
    movie_id:movie?.id||null
  };
}

function clGenerateThree(movieId,context='bar'){
  const movie=(state.movies||[]).find(m=>m.id===movieId);
  if(!movie) return;
  if(!clOnlineCatalogStatus.loaded && !(state.onlineCocktails||[]).length){
    clGeneratedVersions=[];
    clGeneratedForMovieId=movieId;
    clGeneratedContext=context;
    clLoadOnlineCatalog(false).then(()=>{
      if(clOnlineCatalogStatus.loaded) clGenerateThree(movieId,context);
    });
    return;
  }
  const picks=clPickThreeBases(movie);
  clGeneratedVersions=picks.map((p,i)=>clBuildGeneratedVariant(movie,p,i));
  clGeneratedForMovieId=movieId;
  clGeneratedContext=context;
  if(context==='bar') render();
  else if(context==='episode'){
    const host=document.getElementById('epCocktailMatches');
    if(host) host.innerHTML=clGeneratedVersionsHtml(movieId,'episode');
  }
}

async function clEnsureLocalOriginal(candidate){
  if(!candidate) return null;
  const bySource=candidate.source_id ? (state.cocktails||[]).find(c=>c.source_name===candidate.source_name && String(c.source_id||'')===String(candidate.source_id)) : null;
  const byName=(state.cocktails||[]).find(c=>c.cocktail_type==='original' && clNormName(c.name)===clNormName(candidate.name));
  if(bySource||byName) return bySource||byName;

  const payload={
    workspace_id:workspace.id,
    name:candidate.name,
    cocktail_type:'original',
    base_spirit:candidate.base_spirit||null,
    style:candidate.style||null,
    flavor_tags:candidate.flavor_tags||[],
    ingredients:candidate.ingredients||'',
    garnish:candidate.garnish||null,
    glassware:candidate.glassware||null,
    method:candidate.method||null,
    batchable:!!candidate.batchable,
    strength:candidate.strength||'medium',
    source_name:candidate.source_name||null,
    source_id:candidate.source_id||null,
    source_url:candidate.source_url||null,
    source_category:candidate.source_category||null,
    source_image_url:candidate.source_image_url||null,
    iba_official:!!candidate.iba_official,
    iba_category:candidate.iba_category||null,
    imported_at:new Date().toISOString(),
    created_by:me(),
    notes:candidate.source_name?`Imported from ${candidate.source_name}${candidate.iba_official?` · IBA ${candidate.iba_category}`:''}.`:null
  };
  const {data,error}=await db.from('cocktails').insert(payload).select().single();
  if(error){
    if(error.code==='23505'){
      const {data:existing}=await db.from('cocktails').select('*').eq('workspace_id',workspace.id).ilike('name',candidate.name).maybeSingle();
      return existing||null;
    }
    throw error;
  }
  state.cocktails=[...(state.cocktails||[]),data];
  await logActivity(`imported Original Cocktail: ${candidate.name}.`,'cocktail',data.id);
  return data;
}

async function clSaveGeneratedVariant(index,useForEpisode=false){
  const v=clGeneratedVersions[index];
  if(!v || !workspace) return;
  try{
    const parent=await clEnsureLocalOriginal(v.base);
    let name=v.name;
    let attempt=0;
    while(attempt<4){
      const payload={
        workspace_id:workspace.id,name,cocktail_type:'cheese_louise',parent_cocktail_id:parent?.id||null,
        base_spirit:v.base_spirit||null,style:v.style||null,flavor_tags:v.flavor_tags||[],season:v.season||null,holiday:v.holiday||null,
        ingredients:v.ingredients||'',garnish:v.garnish||null,glassware:v.glassware||null,method:v.method||null,notes:v.notes||null,
        batchable:!!v.batchable,strength:v.strength||'medium',tested:false,rating:null,created_by:me()
      };
      const {data,error}=await db.from('cocktails').insert(payload).select().single();
      if(!error){
        state.cocktails=[...(state.cocktails||[]),data];
        await logActivity(`saved Cheese Louise Cocktail: ${name}.`,'cocktail',data.id);
        if(useForEpisode && selectedEpisode){
          const select=document.getElementById('epCocktailId');
          if(select){
            const option=document.createElement('option'); option.value=data.id; option.textContent=data.name; select.appendChild(option); select.value=data.id;
          }
        }
        if(clGeneratedContext==='bar') render();
        return data;
      }
      if(error.code!=='23505') throw error;
      attempt++; name=`${v.name} ${attempt+1}`;
    }
  }catch(err){ alert(err?.message||String(err)); }
}

async function clEditGeneratedVariant(index){
  const v=clGeneratedVersions[index];
  if(!v) return;
  try{
    const parent=await clEnsureLocalOriginal(v.base);
    cocktailDraft={
      cocktail_type:'cheese_louise',parent_cocktail_id:parent?.id||null,name:v.name,base_spirit:v.base_spirit||'',style:v.style||'',
      flavor_tags:v.flavor_tags||[],season:v.season||'',holiday:v.holiday||'',ingredients:v.ingredients||'',garnish:v.garnish||'',glassware:v.glassware||'',
      method:v.method||'',notes:v.notes||'',batchable:!!v.batchable,strength:v.strength||'medium',tested:false,rating:null
    };
    editingCocktail='new'; cocktailHubView='bar'; cocktailViewType='cheese_louise'; selectedEpisode=null; selectedMovie=null; render();
  }catch(err){ alert(err?.message||String(err)); }
}

async function clSaveExternalOriginal(sourceId){
  const c=(state.onlineCocktails||[]).find(x=>String(x.source_id)===String(sourceId));
  if(!c) return;
  try{ await clEnsureLocalOriginal(c); render(); }catch(err){ alert(err?.message||String(err)); }
}

async function clUseEpisodeExternal(sourceId){
  const c=(state.onlineCocktails||[]).find(x=>String(x.source_id)===String(sourceId));
  if(!c) return;
  try{
    const local=await clEnsureLocalOriginal(c);
    const select=document.getElementById('epCocktailId');
    if(select && local){
      if(![...select.options].some(o=>o.value===local.id)){
        const option=document.createElement('option'); option.value=local.id; option.textContent=local.name; select.appendChild(option);
      }
      select.value=local.id;
    }
  }catch(err){ alert(err?.message||String(err)); }
}

function clSourceBadge(c){
  const bits=[];
  if(c?.iba_official) bits.push(`<span class="pill cl-source-pill">IBA · ${esc(c.iba_category||'Official')}</span>`);
  if(c?.source_name) bits.push(`<span class="pill cl-source-pill">${esc(c.source_name)}</span>`);
  return bits.join('');
}

function clOnlineStatusHtml(){
  if(clOnlineCatalogStatus.loading) return '<div class="subtle cl-online-status">↻ Loading the live cocktail catalog…</div>';
  if(clOnlineCatalogStatus.error) return `<div class="subtle cl-online-status">Online catalog failed: ${esc(clOnlineCatalogStatus.error)} <button class="secondary" onclick="clLoadOnlineCatalog(true)">Retry</button></div>`;
  if(clOnlineCatalogStatus.loaded) return `<div class="subtle cl-online-status"><strong>${(state.onlineCocktails||[]).length}</strong> online cocktails loaded · IBA official list recognized · <button class="link-button" onclick="clLoadOnlineCatalog(true)">refresh</button></div>`;
  return '<div class="subtle cl-online-status">Online catalog will load automatically.</div>';
}

function clSmartOriginalResultCard(result,index,episode=false){
  const c=result.cocktail;
  const saved=!c.external || (state.cocktails||[]).some(x=>clNormName(x.name)===clNormName(c.name));
  return `<div class="card card-pad cl-match-card cl-smart-match-card">
    <div class="cl-match-score"><strong>#${index+1} ${esc(c.name)}</strong><span class="cheese-score">${result.score}%</span></div>
    <div class="subtle">${esc([c.base_spirit,c.style].filter(Boolean).join(' · '))}</div>
    <div class="pills" style="margin-top:8px">${clSourceBadge(c)}${result.overlaps.slice(0,6).map(t=>`<span class="pill">${esc(clTagLabel(t))}</span>`).join('')}</div>
    <div class="subtle" style="margin-top:8px">${esc(result.reasons.join(' · '))}</div>
    <div class="cl-result-actions">
      ${episode?`<button class="primary" onclick="${c.external?`clUseEpisodeExternal('${esc(c.source_id)}')`:`useEpisodeCocktail('${esc(c.id)}')`}">Use this</button>`:''}
      ${c.external && !saved?`<button class="secondary" onclick="clSaveExternalOriginal('${esc(c.source_id)}')">Save Original</button>`:''}
      ${!episode?`<button class="secondary" onclick="clGenerateOneFromMatch('${esc(c.source_id||c.id)}',${c.external?'true':'false'})">Make Cheese Louise version</button>`:''}
      ${c.source_url?`<a class="button-link" href="${esc(c.source_url)}" target="_blank" rel="noopener">Source ↗</a>`:''}
    </div>
  </div>`;
}

function clGeneratedVersionsHtml(movieId,context='bar'){
  if(clOnlineCatalogStatus.loading && !clGeneratedVersions.length) return '<div class="empty">Loading hundreds of originals, then building your three Cheese Louise versions…</div>';
  if(clOnlineCatalogStatus.error && !clGeneratedVersions.length) return `<div class="empty">Couldn’t reach the online cocktail catalog. ${esc(clOnlineCatalogStatus.error)}</div>`;
  if(clGeneratedForMovieId!==movieId || !clGeneratedVersions.length) return '<div class="subtle" style="margin-top:12px">Tap Cheese Louise Versions and I’ll build three deliberately different options: Familiar, Craft, and Wildcard.</div>';
  return `<div class="cl-generated-grid">${clGeneratedVersions.map((v,i)=>`<article class="card card-pad cl-generated-card cl-role-${v.role.toLowerCase()}">
    <div class="cl-generated-head"><div><div class="kicker">${esc(v.role)}</div><h3>${esc(v.name)}</h3></div><span class="cheese-score">${v.matchScore}%</span></div>
    <div class="subtle">Based on <strong>${esc(v.base.name)}</strong> · ${esc([v.base_spirit,v.style].filter(Boolean).join(' · '))}</div>
    <div class="pills" style="margin-top:8px">${clSourceBadge(v.base)}${(v.flavor_tags||[]).slice(0,7).map(t=>`<span class="pill">${esc(clTagLabel(t))}</span>`).join('')}</div>
    <div class="cl-why-box"><strong>Why this one?</strong><div class="subtle">${esc(v.rationale)}</div></div>
    <details class="cl-recipe-details"><summary>Generated recipe</summary><div class="cl-recipe-block"><strong>Base + changes</strong><div>${esc(v.ingredients).replace(/\n/g,'<br>')}</div></div>${v.garnish?`<div class="subtle">Garnish: ${esc(v.garnish)}</div>`:''}</details>
    <div class="cl-result-actions">
      <button class="primary" onclick="clSaveGeneratedVariant(${i},${context==='episode'?'true':'false'})">${context==='episode'?'Save + use':'Save to Bar'}</button>
      <button class="secondary" onclick="clEditGeneratedVariant(${i})">Edit first</button>
    </div>
  </article>`).join('')}</div>`;
}

function clTrendLensHtml(){
  return `<details class="cl-trend-lens"><summary>Craft / trend lens</summary><div class="subtle" style="margin-top:8px">The online catalog supplies recipes; editorial sources influence techniques and trend weighting without copying their recipes.</div><div class="pills" style="margin-top:8px">${CL_CRAFT_TREND_LENSES.map(x=>`<a class="pill cl-source-link" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.source)} ↗</a>`).join('')}</div></details>`;
}

function clEnhancedBarMatchPanel(){
  clWarmOnlineCatalog();
  const movie=(state.movies||[]).find(m=>m.id===cocktailMatchMovieId);
  const originalResults=movie?clSmartOriginalMatches(movie).slice(0,6):[];
  const fingerprint=movie?clMovieFingerprint(movie):null;
  return `<div class="card card-pad cl-match-panel cl-intelligence-panel">
    <div class="kicker">Movie ↔ Cocktail Intelligence</div>
    <h3 style="margin:6px 0">Match every movie signal against hundreds of drinks</h3>
    ${clOnlineStatusHtml()}
    <select class="search" style="width:100%;margin-top:10px" onchange="setCocktailMatchMovie(this.value)">
      <option value="">Choose a movie…</option>
      ${(state.movies||[]).slice().sort((a,b)=>a.title.localeCompare(b.title)).map(m=>`<option value="${m.id}" ${m.id===cocktailMatchMovieId?'selected':''}>${esc(m.title)}</option>`).join('')}
    </select>
    <div class="cl-dual-buttons" style="margin-top:10px">
      <button class="${cocktailMatchType==='original'?'primary':'secondary'}" onclick="setCocktailMatchType('original')">🍸 Original Match</button>
      <button class="${cocktailMatchType==='cheese_louise'?'primary':'secondary'}" onclick="clOpenCheeseLouiseVersions()">🧀 Cheese Louise Versions</button>
    </div>
    ${movie&&fingerprint?`<div class="cl-fingerprint"><strong>${fingerprint.weights.size}</strong> movie signals in this match · ${(movie.selectedTraits||[]).length} confirmed Cheese Traits${typeof romantiverseAnalyze==='function'?' + Romantiverse inference':''}</div>`:''}
    ${clTrendLensHtml()}
    <div class="cl-match-results">${!movie?'<div class="subtle" style="margin-top:12px">Pick a movie. The engine will use the synopsis, every Cheese Trait, holiday, season, Romantiverse inference, providers/settings, cocktail ingredients, family, spirit, IBA status, and recent-use diversity.</div>':cocktailMatchType==='original'?(originalResults.length?originalResults.map((r,i)=>clSmartOriginalResultCard(r,i,false)).join(''):'<div class="empty">Loading cocktail data…</div>'):`<div class="cl-generate-actions"><button class="primary" onclick="clGenerateThree('${movie.id}','bar')">✨ Generate 3 new versions</button><span class="subtle">Familiar · Craft · Wildcard</span></div>${clGeneratedVersionsHtml(movie.id,'bar')}`}</div>
  </div>`;
}

function clOpenCheeseLouiseVersions(){
  cocktailMatchType='cheese_louise';
  const movie=(state.movies||[]).find(m=>m.id===cocktailMatchMovieId);
  if(movie) clGenerateThree(movie.id,'bar');
  else render();
}

async function clGenerateOneFromMatch(id,isExternal){
  const movie=(state.movies||[]).find(m=>m.id===cocktailMatchMovieId);
  if(!movie) return;
  const base=isExternal?(state.onlineCocktails||[]).find(x=>String(x.source_id)===String(id)):clCocktailById(id);
  if(!base) return;
  const match=clSmartMatch(movie,base);
  const variant=clBuildGeneratedVariant(movie,{role:'Familiar',match},0);
  clGeneratedVersions=[variant]; clGeneratedForMovieId=movie.id; clGeneratedContext='bar';
  await clEditGeneratedVariant(0);
}

clBarMatchPanel = clEnhancedBarMatchPanel;

clEpisodeMatchHtml = function(movieId,type){
  const movie=(state.movies||[]).find(m=>m.id===movieId);
  if(!movie) return '<div class="subtle" style="margin-top:8px">Link a movie first so the matchmaker has something to work with.</div>';
  clWarmOnlineCatalog();
  if(type==='cheese_louise'){
    if(clGeneratedForMovieId!==movieId || clGeneratedContext!=='episode') setTimeout(()=>clGenerateThree(movieId,'episode'),0);
    return `<div class="cl-generate-actions"><button type="button" class="primary" onclick="clGenerateThree('${movieId}','episode')">✨ Generate 3 fresh versions</button><span class="subtle">Familiar · Craft · Wildcard</span></div>${clGeneratedVersionsHtml(movieId,'episode')}`;
  }
  const results=clSmartOriginalMatches(movie).slice(0,4);
  if(!results.length) return '<div class="subtle" style="margin-top:8px">Loading the online original-cocktail catalog…</div>';
  return `<div class="cl-episode-match-list cl-smart-episode-list">${results.map((r,i)=>clSmartOriginalResultCard(r,i,true)).join('')}</div>`;
};

window.showEpisodeCocktailMatches=function(type){
  episodeCocktailMatchType=type==='cheese_louise'?'cheese_louise':'original';
  const movieId=document.getElementById('epMovie')?.value||'';
  const host=document.getElementById('epCocktailMatches');
  if(host) host.innerHTML=clEpisodeMatchHtml(movieId,episodeCocktailMatchType);
};

setCocktailMatchMovie = function(id){
  cocktailMatchMovieId=id||'';
  clGeneratedVersions=[]; clGeneratedForMovieId='';
  if(cocktailMatchMovieId) clWarmOnlineCatalog();
  render();
};
window.setCocktailMatchMovie=setCocktailMatchMovie;

setCocktailMatchType = function(type){
  cocktailMatchType=type==='cheese_louise'?'cheese_louise':'original';
  if(cocktailMatchType==='cheese_louise' && cocktailMatchMovieId) return clGenerateThree(cocktailMatchMovieId,'bar');
  render();
};
window.setCocktailMatchType=setCocktailMatchType;

const clIntOriginalCocktailBarPage = cocktailBarPage;
cocktailBarPage = function(){ clWarmOnlineCatalog(); return clIntOriginalCocktailBarPage(); };

const clIntOriginalCocktailCard = clCocktailCard;
clCocktailCard = function(c){
  let html=clIntOriginalCocktailCard(c);
  const badges=clSourceBadge(c);
  if(badges){
    html=html.replace('<div class="pills" style="margin-top:10px">',`<div class="pills" style="margin-top:10px">${badges}`);
  }
  return html;
};

const clIntOriginalTopbar = topbar;
topbar = function(){
  return clIntOriginalTopbar()
    .replace('>v1.12<',`>${CL_COCKTAIL_INTELLIGENCE_VERSION}<`)
    .replace('>v1.11<',`>${CL_COCKTAIL_INTELLIGENCE_VERSION}<`)
    .replace('>v1.10<',`>${CL_COCKTAIL_INTELLIGENCE_VERSION}<`);
};

window.clLoadOnlineCatalog=clLoadOnlineCatalog;
window.clOpenCheeseLouiseVersions=clOpenCheeseLouiseVersions;
window.clGenerateThree=clGenerateThree;
window.clSaveGeneratedVariant=clSaveGeneratedVariant;
window.clEditGeneratedVariant=clEditGeneratedVariant;
window.clSaveExternalOriginal=clSaveExternalOriginal;
window.clUseEpisodeExternal=clUseEpisodeExternal;
window.clGenerateOneFromMatch=clGenerateOneFromMatch;

let clIntWarmAttempts=0;
(function clIntWaitForWorkspace(){
  if(session && workspace){ clWarmOnlineCatalog(); return; }
  if(clIntWarmAttempts++<20) setTimeout(clIntWaitForWorkspace,350);
})();
