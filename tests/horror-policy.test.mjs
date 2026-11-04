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
test('search service only admits editorial catalog members and rejects horror within that catalog',async()=>{
 const {createCatalogHandler}=await import('../supabase/functions/_shared/romantiverse-catalog.mjs');
 const body={version:1,movies:[
  {id:'horror',title:'Mixed Horror Romance',genres:['Romance','Horror'],season:'Christmas'},
  {id:'ghost',title:'Friendly Ghost Romance',genres:['Romance','TV Movie'],season:'Christmas',release_year:2025}
 ]};
 const calls=[],handler=createCatalogHandler({fallback:body,fetcher:async url=>{calls.push(url);return new Response(JSON.stringify(body))}});
 const response=await handler(new Request('https://fixture/search',{method:'POST',body:JSON.stringify({query:'ghost'})}));
 const data=await response.json();assert.equal(response.status,200);assert.deepEqual(data.results.map(m=>m.title),['Friendly Ghost Romance']);
 assert.ok(!calls.some(url=>url.includes('search/movie')),'General film search cannot introduce unknown classifications');
});
