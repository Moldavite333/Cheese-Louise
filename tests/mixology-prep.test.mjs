import {createRequire} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),P=require('../mixology-prep.js');
const recipe={servings:2,ingredients:[{id:'a',name:'Brandy',quantity:'1 1/2',unit:'oz'},{id:'b',name:'Club soda',quantity:'2',unit:'oz'},{id:'c',name:'Lime juice to taste',quantity:'',unit:''},{id:'d',name:'Bitters',quantity:'1/2',unit:'dash'}],steps:[{id:'s',text:'Stir, then top with soda.'}],garnish:'Orange peel'};
test('fractional scaling preserves source, units, identities and preparation order',()=>{const before=JSON.stringify(recipe),p=P.plan(recipe,8);assert.equal(p.ingredients[0].scaledQuantity,'6');assert.equal(p.ingredients[3].scaledQuantity,'2');assert.equal(p.ingredients[0].unit,'oz');assert.equal(p.steps[0].text,recipe.steps[0].text);p.steps[0].text='Changed';assert.equal(JSON.stringify(recipe),before);});
test('ambiguous quantities stay ambiguous and carbonation, citrus and seasoning have guidance',()=>{const p=P.plan(recipe,8);assert.equal(p.ingredients[2].scaledQuantity,'');assert.match(p.ingredients[2].notes.join(' '),/unspecified.*fresh juice/);assert.match(p.ingredients[1].notes.join(' '),/service/);assert.match(p.ingredients[3].notes.join(' '),/small batch/);});
test('invalid target sizes and invalid fraction arithmetic cannot produce batch amounts',()=>{for(const n of [0,-1,NaN,Infinity,1001])assert.throws(()=>P.plan(recipe,n));for(const q of ['1/0','to taste','1 oz','-2',''])assert.equal(P.amount(q),null);assert.equal(P.amount('0'),0);});
