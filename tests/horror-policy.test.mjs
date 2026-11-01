import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import '../supabase/functions/_shared/movie-content-policy.js';
import {eligible} from '../supabase/functions/recommend-romantiverse/engine.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('horror is excluded by numeric genres, mixed genres, names, keywords and stored metadata',()=>{
 for(const movie of [
  {genre_ids:[10749,27]}, {genres:[{id:10749,name:'Romance'},{id:27,name:'Horror'}]},
  {genres:['Romance','Horror']}, {genres:['Romantic Horror Comedy']},
  {keywords:[{name:'slasher'}]}, {keywords:{keywords:[{name:'psychological horror'}]}},
  {source_metadata:'{"genres":["Horror","Romance"]}'}, {summary:'A masked killer stalks the town.'},
  {title:'Krampus',genres:['Fantasy','Comedy']}, {title:'An Unrelated Title',genres:['Comedy'],summary:'Krampus returns to hunt children.'}
 ]){assert.equal(clMovieIsHorror(movie),true);assert.equal(eligible({...movie,runtime:90}),false);}
});
test('friendly ghosts, magical wishes and Halloween romance remain eligible',()=>{
 for(const title of ['A Friendly Ghost Romance','A Magical Christmas Wish','Halloween at the Café']){
  const movie={title,genres:[{id:10749,name:'Romance'},{id:10770,name:'TV Movie'}],summary:'A woman falls in love with a friendly ghost.',keywords:['ghost','halloween']};
  assert.equal(clMovieIsHorror(movie),false);assert.equal(eligible(movie),true);
 }
});
test('search service excludes early horror, late-enriched horror and unknown classifications',async()=>{
 let handler;const detailRequests=[];
 const rows=[{id:1,title:'Mixed Horror Romance',genre_ids:[10749,27]},{id:2,title:'Friendly Ghost Romance',overview:'A woman falls in love with a friendly ghost.',genre_ids:[10749,10770]},{id:3,title:'Wrongly Tagged Romance',genre_ids:[10749]},{id:4,title:'Unknown Movie'}];
 const context={console,URLSearchParams,Response,Request,Set,Map,Date,
  Deno:{env:{get:()=> 'fixture-token'},serve:fn=>{handler=fn}},
  fetch:async url=>{const path=new URL(url).pathname;let data={results:[]};
   if(path.endsWith('/search/movie'))data={results:rows};
   const match=path.match(/\/movie\/(\d+)$/);if(match){const id=Number(match[1]);detailRequests.push(id);data={...rows.find(m=>m.id===id),genres:id===2?[{id:10749,name:'Romance'},{id:10770,name:'TV Movie'}]:id===3?[{id:27,name:'Horror'}]:[],keywords:{keywords:[]},credits:{cast:[]}};}
   if(path.endsWith('/watch/providers'))data={results:{US:{}}};
   return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
  }};
 vm.createContext(context);vm.runInContext(read('supabase/functions/_shared/movie-content-policy.js'),context);
 const source=stripTypeScriptTypes(read('supabase/functions/search-romantiverse/index.ts')).replace(/^import .*$/mg,'');vm.runInContext(source,context);
 const response=await handler(new Request('https://fixture/search',{method:'POST',body:JSON.stringify({query:'ghost'})}));
 const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));
 assert.deepEqual(data.results.map(m=>m.tmdb_id),[2]);assert.ok(!detailRequests.includes(1));
});
