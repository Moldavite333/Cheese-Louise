import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectCatalog,createCatalogHandler} from '../supabase/functions/_shared/romantiverse-catalog.mjs';
const catalog=JSON.parse(readFileSync(new URL('../supabase/functions/_shared/romantiverse-catalog.json',import.meta.url),'utf8'));
test('explicit exact catalog titles bypass conflicting filters without changing discovery',()=>{
 const input={query:'A Biltmore Christmas',lookup_exact:true,filters:{season:'Fall',yearMin:2025,studio:'Other'}};
 assert.equal(selectCatalog(catalog,input).results[0].title,'A Biltmore Christmas');
 assert.equal(selectCatalog(catalog,{...input,lookup_exact:false}).results.length,0);
});
function exactHandler(options={}){
 const calls=[];const movie={id:123,title:'Falling Together',release_date:'2024-09-21',genre_ids:[10749,10770],overview:'Neighbors find romance.'};
 const handler=createCatalogHandler({fallback:catalog,env:()=> 'fixture-token',...options,fetcher:async url=>{
  calls.push(url);if(url.includes('/catalog/'))return Response.json(catalog);
  if(options.offline)throw Error('offline');
  if(url.includes('/search/movie'))return Response.json({results:[movie,{...movie,id:999,title:'Falling Apart'},{...movie,id:888,adult:true}]});
  return Response.json({...movie,genres:[{id:10749,name:'Romance'},{id:10770,name:'TV Movie'}],credits:{cast:[{name:'Ashley Williams'},{name:'Paul Campbell'}]}});
 }});
 return {calls,handler};
}
test('Falling Together can be found outside the catalog by exact title, including cast',async()=>{
 const {handler}=exactHandler();const r=await handler(new Request('https://fixture/search',{method:'POST',body:JSON.stringify({query:'falling together',lookup_exact:true,filters:{holiday:'Christmas'}})}));
 const data=await r.json();assert.equal(r.status,200);assert.equal(data.results.length,1);
 const m=data.results[0];assert.equal(m.title,'Falling Together');assert.equal(m.year,2024);assert.equal(m.source_type,'tmdb_exact_title');assert.equal(m.exact_title_match,true);assert.deepEqual(m.stars,['Ashley Williams','Paul Campbell']);
});
test('concept search and recommendations cannot acquire exact-lookup candidates',async()=>{
 for(const recommend of [false,true]){
  const {handler,calls}=exactHandler({recommend});await handler(new Request('https://fixture/search',{method:'POST',body:JSON.stringify({query:'falling together',lookup_exact:recommend})}));
  assert.ok(!calls.some(url=>url.includes('/search/movie')));
 }
});
test('external title lookup failure is reported honestly instead of treated as no such movie',async()=>{
 const {handler}=exactHandler({offline:true});const r=await handler(new Request('https://fixture/search',{method:'POST',body:JSON.stringify({query:'Falling Together',lookup_exact:true})}));
 const data=await r.json();assert.equal(r.status,200);assert.match(data.exact_lookup_warning,/temporarily unavailable/);
});
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
