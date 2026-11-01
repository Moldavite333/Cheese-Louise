import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function setup(){
 const c={window:null,state:{movies:[]},members:[{user_id:'me'},{user_id:'partner'}],movieFilters:{mode:'mutual',minScore:100,yearMin:2099},searchText:'unrelated Radar query',
  esc:value=>String(value??''),memberName:id=>id==='partner'?'Jenny':'Nick',movieCard:()=>'<article><div class="vote-row"></div></article>',
  document:{getElementById:()=>null,querySelectorAll:()=>[]},render(){},session:{},workspace:{id:'test'}};
 c.window=c;vm.createContext(c);vm.runInContext(read('supabase/functions/_shared/movie-content-policy.js'),c);vm.runInContext(read('our-movies.js'),c);return c;
}
test('Our Movies includes either person’s Yes, Maybe or Save and excludes No-only/unreviewed records',()=>{
 const c=setup();c.state.movies=[
  {id:'yes',title:'A',votes:{partner:'yes'}},
  {id:'maybe',title:'B',votes:{partner:'maybe'}},
  {id:'saved',title:'C',bookmarks:{partner:true}},
  {id:'mixed',title:'D',votes:{me:'no',partner:'yes'}},
  {id:'no',title:'E',votes:{me:'no',partner:'no'}},
  {id:'pending',title:'F',votes:{},bookmarks:{me:false}},
  {id:'both',title:'G',votes:{me:'maybe'},bookmarks:{partner:true},status:'watched'}
 ];
 assert.deepEqual(Array.from(c.clOurMovies.rows(),m=>m.id),['yes','maybe','saved','mixed','both']);
});
test('collection views use shared choices and stay independent of restrictive Radar filters',()=>{
 const c=setup();c.state.movies=[{id:'partner-maybe',title:'Magic Café',votes:{partner:'maybe'}},{id:'partner-save',title:'Christmas Inn',bookmarks:{partner:true}}];
 c.clOurMovies.setView('maybe');assert.deepEqual(Array.from(c.clOurMovies.rows(),m=>m.id),['partner-maybe']);
 c.clOurMovies.setView('saved');assert.deepEqual(Array.from(c.clOurMovies.rows(),m=>m.id),['partner-save']);
 c.clOurMovies.setView('all');c.clOurMovies.setQuery('café');assert.deepEqual(Array.from(c.clOurMovies.rows(),m=>m.id),['partner-maybe']);
 assert.equal(c.movieFilters.mode,'mutual');assert.equal(c.movieFilters.yearMin,2099);assert.equal(c.searchText,'unrelated Radar query');
});
test('each person’s vote and saved state are visible, without duplicating a movie',()=>{
 const c=setup();const movie={title:'Our pick',votes:{me:'no',partner:'maybe'},bookmarks:{partner:true}};c.state.movies=[movie];
 assert.equal(c.clOurMovies.rows().length,1);
 const html=c.clOurMovieChoices(movie);assert.match(html,/Jenny/);assert.match(html,/Maybe · Saved/);assert.match(html,/Nick/);assert.match(html,/>No</);
});
test('permanent horror exclusion also applies to Our Movies without changing stored records',()=>{
 const c=setup();c.state.movies=[{id:'horror',title:'Mixed Genre',genres:['Romance','Horror'],votes:{partner:'yes'}},{id:'safe',title:'Friendly Ghost',genres:['Romance','TV Movie'],votes:{me:'maybe'}}];
 assert.deepEqual(Array.from(c.clOurMovies.rows(),m=>m.id),['safe']);assert.equal(c.state.movies.length,2);
});
