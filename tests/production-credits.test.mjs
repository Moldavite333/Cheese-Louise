import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../production-credits.js',import.meta.url),'utf8');
function setup({fail=false}={}){
 const calls=[],movie={id:'movie-a',source_metadata:{tagline:'Keep me'}};let payload;
 const db={from(table){calls.push(['table',table]);let update=false;return {select(){return this},eq(...args){calls.push(args);return this},update(value){update=true;payload=value;return this},async single(){if(!update)return {data:{source_metadata:movie.source_metadata,updated_at:'old-timestamp'}};if(fail)return {data:null,error:{message:'Conflict'}};return {data:{id:movie.id,source_metadata:payload.source_metadata}}}}};
 const ctx={window:null,URL,Date,db,workspace:{id:'workspace-a'},session:{user:{id:'user-a'}},state:{movies:[movie]}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);
 return {api:ctx.clCredits,calls,movie,payload:()=>payload};
}
test('production and director normalize strings, name objects, JSON metadata, and crew',()=>{
 const h=setup();const c=h.api.get({production_companies:[],source_metadata:JSON.stringify({production_companies:[{name:'Studio A'},'Studio A'],credits:{crew:[{name:'Director B',job:'Director'},{name:'Writer C',job:'Writer'}]}})});
 assert.deepEqual(Array.from(c.production),['Studio A']);assert.deepEqual(Array.from(c.director),['Director B']);assert.equal(c.missing.length,0);
});
test('a broadcasting network never counts as a production-company credit',()=>{
 const c=setup().api.get({network:'Hallmark Channel',source_metadata:'null'});assert.deepEqual(Array.from(c.missing),['production company','director']);
});
test('manual researched credits take precedence without changing other metadata',async()=>{
 const h=setup(),status={textContent:''},button={disabled:false},form={dataset:{movieId:'movie-a'},elements:{production:{value:'Studio A; Studio B'},director:{value:'Director C'},source:{value:'https://example.com/credits'}},querySelector:s=>s==='button[type="submit"]'?button:status};
 await h.api.save(form);assert.equal(h.payload().source_metadata.tagline,'Keep me');assert.equal(h.api.get(h.movie).director[0],'Director C');assert.ok(h.calls.some(x=>x[0]==='workspace_id'&&x[1]==='workspace-a'));assert.ok(h.calls.some(x=>x[0]==='updated_at'&&x[1]==='old-timestamp'));assert.match(status.textContent,/Credits saved/);assert.equal(button.disabled,false);
});
test('a rejected credit update reports failure and leaves the movie unchanged',async()=>{
 const h=setup({fail:true}),status={},button={disabled:false},form={dataset:{movieId:'movie-a'},elements:{production:{value:'Studio A'},director:{value:'Director C'},source:{value:'https://example.com/credits'}},querySelector:s=>s==='button[type="submit"]'?button:status};
 await h.api.save(form);assert.match(status.textContent,/not saved/);assert.equal(h.movie.source_metadata.production_credit_override,undefined);assert.equal(button.disabled,false);
});
