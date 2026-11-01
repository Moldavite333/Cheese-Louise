import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

function engine(){
  const elements=new Map();
  const ctx=vm.createContext({console,Map,Set,Date,Promise,AbortSignal,
    setTimeout:()=>0,clearTimeout(){},
    document:{head:{appendChild(){}},createElement:()=>({}),getElementById:id=>elements.get(id)},
    localStorage:{getItem:()=>null,setItem(){}},
    state:{cocktails:[],episodes:[],movies:[],traits:[]},session:null,workspace:null,selectedEpisode:null,selectedMovie:null,
    loadAll(){},episodes(){},home(){},modal(){},go(){},topbar:()=>'',render(){},esc:x=>String(x),
  });
  ctx.window=ctx;
  for(const file of ['cocktail-bar.js','cocktail-intelligence.js','cocktail-intelligence-source-fix.js','cocktail-title-match.js','cocktail-season-tuning.js']){
    vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx,{filename:file});
  }
  ctx.elements=elements;
  return ctx;
}
function drink(name,ingredients,extra={}){
  return {id:name,name,ingredients,cocktail_type:'original',...extra};
}
test('ginger is not gin; recipe labels and directions do not invent ingredients',()=>{
  const e=engine();
  assert.equal(e.clInferBaseSpirit('Vodka, ginger beer, lime'),'Vodka');
  const fp=e.clCandidateFingerprint(drink('Ginger Sunset','Vodka\nGinger beer\nLime',{method:'Serve in a tall glass.'}));
  assert.equal(fp.has('gin'),false);
  assert.equal(fp.has('beer'),false);
  assert.equal(fp.has('tea'),false);
  assert.equal(fp.has('ginger'),true);
});
test('saved text recipes and online ingredient rows produce the same fingerprint',()=>{
  const e=engine();
  const local=drink('Orchard Cup','2 oz Brandy\n3 oz Apple cider\nCinnamon');
  const online={...local,ingredients:'',ingredientRows:[{ingredient:'Brandy'},{ingredient:'Apple cider'},{ingredient:'Cinnamon'}]};
  for(const tag of ['brandy','apple','baking-spice']){
    assert.ok(e.clCandidateFingerprint(local).has(tag),tag);
    assert.ok(e.clCandidateFingerprint(online).has(tag),tag);
  }
});
test('holiday and season choices change recommendations across the full catalog',()=>{
  const e=engine();
  e.state.cocktails=[drink('Cider Porch','Brandy\nApple cider\nMaple syrup\nCinnamon'),drink('Island Cooler','White rum\nPineapple juice\nCoconut\nLime\nSoda'),drink('Holiday Cup','Vodka\nCranberry juice\nRosemary\nGinger\nOrange'),drink('Petal Fizz','Gin\nElderflower\nLemon\nSoda')];
  const cases=[['Fall','', 'Cider Porch'],['Summer','', 'Island Cooler'],['Winter','Christmas','Holiday Cup'],['Spring','', 'Petal Fizz']];
  for(const [season,holiday,expected] of cases){
    const results=e.clSmartOriginalMatches({title:'A Chance Encounter',season,holiday});
    assert.equal(results[0].cocktail.name,expected,season+' '+holiday);
    assert.equal(results.length,e.state.cocktails.length);
  }
});
test('explicit season wins over ambiguous title words; holiday aliases are recognized',()=>{
  const e=engine();const c=drink('Cup','Apple cider\nMaple syrup\nCinnamon');
  assert.equal(e.clCocktailSeasonAuthenticity({title:'Fall in Love',season:'Summer'},c).key,'summer');
  assert.equal(e.clCocktailSeasonAuthenticity({title:'Holiday in June',season:'Summer'},c).key,'summer');
  assert.equal(e.clCocktailSeasonAuthenticity({title:'Our Story',holiday:'Easter'},c).key,'spring');
  assert.equal(e.clCocktailSeasonAuthenticity({title:'Our Story',holiday:'4th of July'},c).key,'summer');
});
test('catalog ranking does not discard recipes after the first 90',()=>{
  const e=engine();
  e.state.cocktails=Array.from({length:120},(_,i)=>drink('Cup '+i,'Vodka\nLemon'));
  assert.equal(e.clSmartOriginalMatches({title:'Our Story'}).length,120);
});
test('recent repeats receive a real penalty; re-rendering remains deterministic',()=>{
  const e=engine();
  e.state.cocktails=[drink('Cider Porch','Brandy\nApple cider\nMaple syrup'),drink('Apple Cup','Brandy\nApple cider\nMaple syrup')];
  const movie={title:'Harvest Weekend',season:'Fall'};
  const before=e.clSmartMatch(movie,e.state.cocktails[0]).score;
  e.state.episodes=[{cocktail_id:'Cider Porch',release_date:'2026-10-30'}];
  const after=e.clSmartMatch(movie,e.state.cocktails[0]).score;
  assert.ok(before-after>=15,`${before} -> ${after}`);
  assert.equal(e.clSmartOriginalMatches(movie)[0].cocktail.name,'Apple Cup');
  assert.equal(e.clSmartOriginalMatches(movie)[0].cocktail.name,'Apple Cup');
});
test('three-way generator does not duplicate bases when the catalog is small',()=>{
  const e=engine(); e.state.cocktails=[drink('Only Cup','Vodka\nLime')];
  assert.equal(e.clPickThreeBases({title:'Our Story'}).length,1);
});
test('movie trait IDs contribute to matching, not just hydrated trait objects',()=>{
  const e=engine();e.state.traits=[{id:'bakery',name:'Bakery owner',category:'Setting'}];
  const fp=e.clMovieFingerprint({title:'Our Story',selectedTraitIds:['bakery']});
  assert.ok(fp.weights.has('bakery'));
});
test('different movie stories in the same season find different cocktails',()=>{
  const e=engine();
  e.state.cocktails=[drink('Aviation','Gin\nLemon\nCreme de violette\nMaraschino liqueur'),drink('Irish Coffee','Irish whiskey\nCoffee\nCream\nSugar'),drink('Orchard Cup','Brandy\nApple cider\nCinnamon')];
  assert.equal(e.clSmartOriginalMatches({title:'Orchard Reunion',summary:'An apple orchard prepares for its cider harvest.',season:'Fall'})[0].cocktail.name,'Orchard Cup');
  assert.equal(e.clSmartOriginalMatches({title:'An Irish Romance',summary:'A barista opens a coffee shop in Ireland.',season:'Fall'})[0].cocktail.name,'Irish Coffee');
});
test('fresh versions rotate among suitable alternatives without shuffling on render',()=>{
  const e=engine();
  e.state.cocktails=Array.from({length:8},(_,i)=>drink('Orchard Cup '+i,'Brandy\nApple cider\nMaple syrup\nCinnamon'));
  const movie={id:'movie',title:'Harvest Weekend',season:'Fall'};
  const first=e.clPickThreeBases(movie).map(p=>p.match.cocktail.name);
  const next=e.clPickThreeBases(movie,first).map(p=>p.match.cocktail.name);
  assert.equal(next.length,3);
  assert.ok(next.every(name=>!first.includes(name)));
  assert.equal(e.clSmartOriginalMatches(movie)[0].cocktail.name,e.clSmartOriginalMatches(movie)[0].cocktail.name);
});
test('catalog loading is shared, retries failed buckets, and keeps partial recipes',async()=>{
  const e=engine();e.clDelay=()=>Promise.resolve();
  const requests=[];let cached=false;
  e.localStorage.setItem=()=>{cached=true};
  e.fetch=async url=>{
    const letter=new URL(url).searchParams.get('f');requests.push(letter);
    assert.ok(!url.includes('/1/1/'));
    if(letter==='b') return {ok:false,status:503};
    return {ok:true,json:async()=>({drinks:letter==='a'?[{idDrink:'1',strDrink:'Apple Cup',strIngredient1:'Brandy',strIngredient2:'Apple cider'}]:null})};
  };
  const one=e.clLoadOnlineCatalog(),two=e.clLoadOnlineCatalog();
  assert.equal(one,two);
  await one;
  assert.equal(requests.filter(l=>l==='a').length,1);
  assert.equal(requests.filter(l=>l==='b').length,2);
  assert.equal(e.state.onlineCocktails.length,1);
  assert.equal(cached,false,'a partial outage must not poison the cache');
  assert.match(e.clOnlineStatusHtml(),/incomplete/);
});
test('saved recipes can generate versions while the online catalog is unavailable',()=>{
  const e=engine();
  e.state.movies=[{id:'movie',title:'Harvest Weekend',season:'Fall'}];
  e.state.cocktails=[drink('Orchard Cup','Brandy\nApple cider\nCinnamon')];
  e.clGenerateThree('movie');
  assert.match(e.clGeneratedVersionsHtml('movie'),/Orchard Cup/);
});
