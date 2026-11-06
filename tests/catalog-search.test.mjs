import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectCatalog,createCatalogHandler} from '../supabase/functions/_shared/romantiverse-catalog.mjs';
const catalog=JSON.parse(readFileSync(new URL('../supabase/functions/_shared/romantiverse-catalog.json',import.meta.url),'utf8'));
test('Fall and Autumn return the same real seasonal TV romances, never pumpkin cartoons or general movies',()=>{
 const fall=selectCatalog(catalog,{query:'fall',max_results:120}).results,autumn=selectCatalog(catalog,{query:'autumn',max_results:120}).results;
 assert.equal(fall.length,12);assert.deepEqual(fall.map(m=>m.title).sort(),autumn.map(m=>m.title).sort());
 for(const title of ['Pumpkin Pie Wars','Autumn at Apple Hill','Sweet Autumn','October Kiss'])assert.ok(fall.some(m=>m.title===title));
 assert.ok(fall.every(m=>m.source_type==='bingo_catalog'&&m.season==='Fall'));assert.ok(!fall.some(m=>/cinderella|square pumpkin|spookley/i.test(m.title)));
});
test('specific searches use the same Bingo catalog and mystery franchises stay out of romance discovery',()=>{
 assert.equal(selectCatalog(catalog,{query:'A Christmas Village'}).results[0].title,'A Christmas Village');
 assert.equal(selectCatalog(catalog,{query:'cinderella'}).results.length,0);assert.equal(selectCatalog(catalog,{query:'square pumpkin'}).results.length,0);
 assert.ok(!selectCatalog(catalog,{query:'mystery'}).results.some(m=>/mystery|mysteries|detective/i.test(m.title)));
 const recommendations=selectCatalog(catalog,{filters:{season:'Autumn'},max_results:120},true).results;assert.equal(recommendations.length,12);
 assert.ok(!recommendations.some(m=>/murder|mystery/i.test(m.title)));
});
test('failed shared catalog fetch uses the bundled Bingo catalog and never falls back to broad movie search',async()=>{
 const calls=[],handler=createCatalogHandler({fallback:catalog,fetcher:async url=>{calls.push(url);throw Error('Offline')}});
 const r=await handler(new Request('https://fixture/search',{method:'POST',body:JSON.stringify({query:'fall'})}));assert.equal(r.status,200);assert.equal((await r.json()).results.length,12);assert.equal(calls.length,1);assert.ok(calls[0].includes('/catalog/movies.json'));
});
test('metadata enrichment cannot add a different title or remake to a catalog result',async()=>{
 const handler=createCatalogHandler({fallback:catalog,env:()=> 'fixture-token',fetcher:async url=>new Response(JSON.stringify(url.includes('/catalog/')?catalog:{results:[{id:1,title:'Cinderella',release_date:'2015-01-01',genre_ids:[10749]}]}))});
 const r=await handler(new Request('https://fixture/search',{method:'POST',body:JSON.stringify({query:'Pumpkin Pie Wars'})}));const rows=(await r.json()).results;assert.equal(rows.length,1);assert.equal(rows[0].title,'Pumpkin Pie Wars');assert.equal(rows[0].poster_url,null);
});
