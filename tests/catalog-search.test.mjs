import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectCatalog,createCatalogHandler} from '../supabase/functions/_shared/romantiverse-catalog.mjs';
const catalog=JSON.parse(readFileSync(new URL('../supabase/functions/_shared/romantiverse-catalog.json',import.meta.url),'utf8'));
const titleSearch=globalThis.clMovieTitleSearch;
const reportedQueries=JSON.parse(readFileSync(new URL('./fixtures/movie-search-queries.json',import.meta.url),'utf8'));

test('reported queries retain their supplied spelling and resolve against known workspace and public titles',()=>{
 const local=[
  {title:'Return to Santa',year:2026,stars:['Paul Campbell','Rachel Boston']},
  ...['Adventures in Love & Birding','Pumpkin Regatta Romance','The Nights Before Christmas','Hot Frosty',
   'Christmas at the Catnip Café','A Grand Biltmore Christmas','Coupled Up for Christmas',
   'A Christmas Movie Christmas','Craft Me a Romance'].map(title=>({title}))
 ];
 for(const [input,expected] of reportedQueries){
  const query=titleSearch.parse(input);
  const names=[...local,...catalog.movies].filter(movie=>titleSearch.score(movie,query)).map(movie=>movie.title);
  if(expected)assert.ok(names.includes(expected),input);
  else assert.equal(names.length,0,input);
 }
});

test('direct search ranks real catalog titles before the limit and ignores discovery filters',()=>{
 const movie=catalog.movies.find(m=>m.title==='Love, Fall & Order');
 assert.ok(movie&&catalog.movies.indexOf(movie)>20);
 const result=selectCatalog(catalog,{query:'Love Fall and Order 2019',title_search:true,max_results:1,filters:{season:'Winter',yearMin:2099}});
 assert.equal(result.results[0].catalog_id,movie.id);
 assert.equal(result.results[0].title_search_score,700);
});

test('premiere-day, spelling, partial titles, actor names, and verified alias resolve without conflating identities',()=>{
 const query=text=>titleSearch.parse(text);
 const santa={title:'Return to Santa',premiere_date:'2026-11-27',source_metadata:{stars:['Paul Campbell','Rachel Boston']}};
 for(const text of ['Return to Santa','Return Santa','Return to Snta','Santa Return','Return to','Paul Campbell','Rachel Boston']){
  assert.ok(titleSearch.score(santa,query(text)),text);
 }
 const birding={title:'Adventures in Love & Birding',year:2025};
 for(const text of ['Adventures in Love and Birding','Adventures in Birding']){
  assert.ok(titleSearch.score(birding,query(text)),text);
 }
 const original={title:'A Biltmore Christmas',year:2023,verified_aliases:['Biltmore Christmas']};
 const sequel={title:'A Grand Biltmore Christmas',year:2026};
 assert.equal(titleSearch.score(original,query('Biltmore Christmas')),500);
 assert.ok(titleSearch.compare(original,sequel,query('A Biltmore Christmas'))<0);
 assert.ok(titleSearch.compare(original,sequel,query('A Grand Biltmore Christmas'))>0);
 assert.ok(titleSearch.compare(original,{...original,year:2028},query('A Biltmore Christmas (2023)'))<0);
});

test('a confident workspace result suppresses provider lookup even when the shared catalog is stale',async()=>{
 const {handler,calls}=exactHandler();
 const response=await handler(new Request('https://fixture/search',{method:'POST',body:JSON.stringify({
  query:'Return to Santa',title_search:true,lookup_exact:true,workspace_exact:true
 })}));
 assert.equal(response.status,200);
 assert.equal(calls.length,1);
});

test('a verified time can cross the premiere boundary without changing the movie identity',()=>{
 const releaseDay=new Date(2026,10,27,12);
 const movie={id:'catalog-return-to-santa-2026',title:'Return to Santa',premiere_date:'2026-11-27'};
 assert.equal(titleSearch.release(movie,releaseDay),'today');
 assert.equal(titleSearch.release(movie,new Date(2026,10,28,12)),'released');
 const timed={...movie,source_metadata:{premiere:{verified:true,at:'2026-11-27T20:00:00-05:00'}}};
 assert.equal(titleSearch.release(timed,new Date('2026-11-28T00:59:00Z')),'upcoming');
 assert.equal(titleSearch.release(timed,new Date('2026-11-28T01:00:00Z')),'released');
 assert.equal(movie.id,timed.id);
});
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
 const r=await handler(new Request('https://fixture/search',{method:'POST',body:JSON.stringify({query:'fall'})}));
 const data=await r.json();
 assert.equal(r.status,200);assert.equal(data.results.length,12);assert.equal(data.catalog_stale,true);
 assert.equal(data.catalog_checked_at,null);assert.equal(calls.length,1);assert.ok(calls[0].includes('/catalog/movies.json'));
});
test('metadata enrichment cannot add a different title or remake to a catalog result',async()=>{
 const handler=createCatalogHandler({fallback:catalog,env:()=> 'fixture-token',fetcher:async url=>new Response(JSON.stringify(url.includes('/catalog/')?catalog:{results:[{id:1,title:'Cinderella',release_date:'2015-01-01',genre_ids:[10749]}]}))});
 const r=await handler(new Request('https://fixture/search',{method:'POST',body:JSON.stringify({query:'Pumpkin Pie Wars'})}));const rows=(await r.json()).results;assert.equal(rows.length,1);assert.equal(rows[0].title,'Pumpkin Pie Wars');assert.equal(rows[0].poster_url,null);
});
