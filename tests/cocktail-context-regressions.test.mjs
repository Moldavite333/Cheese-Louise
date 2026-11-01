import test from 'node:test';
import assert from 'node:assert/strict';
import {cocktailHarness,recipe} from './cocktail-context-harness.mjs';
test('saved recipe text contributes actual ingredients to its fingerprint',()=>{
 const h=cocktailHarness();const tags=h.context.clCandidateFingerprint(recipe('Orchard Sip','2 oz apple brandy\n1 oz cider\n1 tsp maple syrup','Brandy'));
 assert.ok(tags.has('apple'));assert.ok(tags.has('maple'));
});
test('ingredient words and measures do not invent gin, tea, beer or low-alcohol ingredients',()=>{
 const h=cocktailHarness();const drink=h.context.clNormalizeExternalDrink({idDrink:'1',strDrink:'Ginger Buck',strIngredient1:'Vodka',strIngredient2:'Ginger beer',strIngredient3:'Lime juice',strInstructions:'Add a teaspoon of sugar.'});
 assert.equal(drink.base_spirit,'Vodka');for(const tag of ['gin','tea','beer','low-abv'])assert.ok(!drink.flavor_tags.includes(tag),tag);
});
test('explicit holiday and season win over unrelated notes and Autumn is normalized',()=>{
 const h=cocktailHarness(),drink=recipe('Orchard Sip','apple cider\nmaple syrup','Brandy');
 assert.equal(h.context.clCocktailSeasonAuthenticity({title:'Home Again',season:'Summer',holiday:'Fourth of July',notes:'Compare last Christmas cocktail'},drink).key,'summer');
 assert.equal(h.context.clCocktailSeasonAuthenticity({title:'Home Again',season:'Autumn',notes:'A winter drink we rejected'},drink).key,'fall');
});
test('matching uses synopsis/overview when a movie has no summary',()=>{
 const h=cocktailHarness();const movie={title:'A Fresh Start',synopsis:'A florist tends roses and lavender at a spring garden wedding.'};
 const tags=h.context.clMovieFingerprint(movie).weights;assert.ok(tags.has('floral'));assert.ok(tags.has('wedding'));
});
test('recommendations search the complete catalog instead of discarding low-retrieval candidates',()=>{
 const h=cocktailHarness();h.context.state.cocktails=Array.from({length:150},(_,i)=>recipe('Recipe '+i,'vodka\nlemon juice','Vodka'));
 assert.equal(h.context.clSmartOriginalMatches({title:'Home Again'}).length,150);
});
test('recent-use penalties remain meaningful rather than being reduced to five points',()=>{
 const h=cocktailHarness();const drink=recipe('Orchard Sip','apple cider\nbrandy','Brandy');h.context.state.cocktails=[drink];
 const movie={title:'Orchard Promise',summary:'An apple orchard harvest festival.',season:'Fall'};const fresh=h.context.clSmartMatch(movie,drink).score;
 h.context.state.episodes=[{cocktail_id:drink.id,cocktail:drink.name,release_date:'2026-11-01'}];
 assert.ok(fresh-h.context.clSmartMatch(movie,drink).score>=12);
});
test('one failed catalog letter retains successful recipes and reports partial coverage',async()=>{
 let calls=0;const h=cocktailHarness({fetcher:async url=>{calls++;const letter=new URL(url).searchParams.get('f');return letter==='c'?{ok:false,status:503}:{ok:true,json:async()=>({drinks:[{idDrink:letter,strDrink:'Drink '+letter,strIngredient1:'Vodka',strIngredient2:'Lime juice'}]})}}});
 h.run('clDelay=async()=>{}');await h.run('clCocktailDBFallback(true)');
 assert.ok(calls>=26&&calls<=27);assert.equal(h.context.state.onlineCocktails.length,25);assert.match(h.run('clOnlineCatalogStatus.error'),/partial|unavailable|failed|incomplete/i);
});

test('pineapple is tropical fruit, not an apple-orchard ingredient',()=>{
 const h=cocktailHarness();const tags=h.context.clCandidateFingerprint(recipe('Island Cooler','pineapple juice\nwhite rum','Rum'));
 assert.ok(tags.has('tropical'));assert.ok(!tags.has('apple'));assert.ok(!tags.has('orchard'));
});
test('season and looking do not invent seaside or royal cocktail name hooks',()=>{
 const h=cocktailHarness(),movie={title:'A Season for Love',summary:'A woman is looking for a fresh start.'};
 for(const name of ['Sea Breeze','Royal Fizz'])assert.equal(h.context.clSmartMatch(movie,recipe(name,'vodka\nlime','Vodka')).symbolism.score,0,name);
});

test('generic holiday and island title words stay weak while distinctive name hooks remain available',()=>{
 const h=cocktailHarness();assert.ok(h.context.clTitleCocktailNameMatch({title:'Christmas Island'},recipe('Christmas','rum')).score<=4);
 assert.ok(h.context.clTitleCocktailNameMatch({title:'An Aviation Mystery'},recipe('Aviation','gin')).score>=18);
});

test('recent use of a renamed Cheese Louise variation also counts against its original base',()=>{
 const h=cocktailHarness(),original=recipe('Orchard Sip','apple cider\nbrandy','Brandy'),variation={...recipe('Our Movie Night','apple cider\nbrandy','Brandy'),cocktail_type:'cheese_louise',parent_cocktail_id:original.id};
 h.context.state.cocktails=[original,variation];h.context.state.episodes=[{cocktail_id:variation.id}];assert.ok(h.context.clDiversityPenalty(original).penalty>=24);
});
test('changing season on the same movie invalidates stale generated suggestions without overwriting saved recipes',async()=>{
 const h=cocktailHarness(),movie={id:'m',title:'Home Again',season:'Fall',summary:'A family orchard.'};
 h.context.state.movies=[movie];h.context.state.cocktails=[recipe('Apple','apple cider\nbrandy','Brandy'),recipe('Island','rum\npineapple','Rum'),recipe('Floral','gin\nelderflower','Gin')];
 h.run('clOnlineCatalogStatus={loaded:true,loading:false,error:"",updatedAt:null}');await h.context.clGenerateThree('m');
 assert.match(h.context.clGeneratedVersionsHtml('m'),/cl-generated-card/);movie.season='Summer';assert.match(h.context.clGeneratedVersionsHtml('m'),/Movie details or the cocktail library changed/);
 assert.equal(h.context.state.cocktails.length,3);await h.context.clGenerateThree('m');assert.match(h.context.clGeneratedVersionsHtml('m'),/cl-generated-card/);
});
