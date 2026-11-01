import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

function engine(){
  const ctx=vm.createContext({console,Map,Set,Date,Promise,AbortSignal,URL,setTimeout:()=>0,clearTimeout(){},
    document:{head:{appendChild(){}},createElement:()=>({}),getElementById:()=>null},localStorage:{getItem:()=>null,setItem(){}},
    state:{cocktails:[],episodes:[],movies:[],traits:[]},session:null,workspace:null,selectedEpisode:null,selectedMovie:null,
    loadAll(){},episodes(){},home(){},modal(){},go(){},topbar:()=>'',render(){},esc:x=>String(x)});
  ctx.window=ctx;
  for(const file of ['cocktail-bar.js','cocktail-intelligence.js','cocktail-intelligence-source-fix.js']) vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx,{filename:file});
  vm.runInContext("clLoadOnlineCatalog=async function(){state.onlineCocktails=[];clOnlineCatalogStatus={loaded:true,loading:false,error:''};}",ctx);
  for(const file of ['cocktail-catalog.js','cocktail-title-match.js','cocktail-season-tuning.js']) vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx,{filename:file});
  return ctx;
}
const smallRow={name:'Maple Cup',url:'https://24cocktails.com/cocktail/maple_cup',base:'brandy',method:'stirred',glass:'Coupe',garnish:'Apple',ingredients:['Brandy 45 ml','Maple syrup 10 ml']};

test('the shipped catalog contains thousands of real source-linked recipes and all are scored',async()=>{
  const data=JSON.parse(readFileSync(new URL('../data/cocktail-catalog.json',import.meta.url),'utf8'));
  assert.ok(data.count>=1000,`Only ${data.count} recipes`);
  const e=engine();
  e.fetch=async url=>{assert.equal(url,'data/cocktail-catalog.json');return {ok:true,json:async()=>data};};
  await e.clLoadOnlineCatalog();
  const stats=e.clCatalogStats();assert.ok(stats.catalog>=1000);assert.equal(stats.broad,true);
  const results=e.clSmartOriginalMatches({title:'An Autumn Orchard',summary:'Apple and maple harvest.',season:'Fall'});
  assert.equal(results.length,stats.total,'ranking cannot quietly use a small subset');
  assert.ok(results.every(r=>r.cocktail.source_url.startsWith('https://24cocktails.com/cocktail/')));
  assert.match(e.clOnlineStatusHtml(),new RegExp(stats.total.toLocaleString()));
  console.log(`Verified ${stats.total} unique candidates participate in ranking.`);
});
test('incomplete catalog explicitly reports limited mode instead of pretending to search thousands',async()=>{
  const e=engine();e.state.cocktails=Array.from({length:16},(_,i)=>({id:i,name:'Saved '+i,cocktail_type:'original',ingredients:'Vodka'}));
  e.fetch=async()=>({ok:true,json:async()=>({schemaVersion:1,recipes:[smallRow]})});
  await e.clLoadOnlineCatalog();
  assert.equal(e.clCatalogStats().total,16);assert.equal(e.clCatalogStats().broad,false);
  assert.match(e.clOnlineStatusHtml(),/Limited mode: 16 recipes/);
});
test('source identity, measures and preparation completeness survive normalization',async()=>{
  const e=engine();const candidate=e.clNormalizeCatalogRecipe(smallRow);
  assert.equal(candidate.source_id,'24:maple_cup');assert.match(candidate.ingredients,/Brandy 45 ml/);
  assert.equal(candidate.needs_recipe_detail,true);
  e.fetch=async url=>{assert.match(url,/api\/v1\/recipe\/maple_cup/);return {ok:true,json:async()=>({slug:'maple_cup',steps:['Stir with ice.','Strain into the glass.']})};};
  const recipe=await e.clHydrateCatalogRecipe(candidate);
  assert.equal(recipe.needs_recipe_detail,false);assert.match(recipe.method,/Strain/);
  assert.equal(recipe.source_url,smallRow.url);
});
