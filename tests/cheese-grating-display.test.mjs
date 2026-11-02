import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

function fixture(storedScore,traitRows,traits){
  const movie={id:'movie-1',title:'A Christmas Village',date:'2018',network:'UPtv',
    cheese_score:storedScore,tags:[],votes:{},bookmarks:{},comments:[],status:'radar'};
  const rows={'cheese_traits':traits,'movie_traits':traitRows,'filter_presets':[]};
  const context={
    state:{movies:[movie],traits:[],filterPresets:[]},workspace:{id:'w'},session:null,
    selectedMovie:'movie-1',currentTab:'movies',searchText:'',
    loadAll:async()=>{},movies:()=>'',movieCard:()=>'',filteredMovies:()=>[],modal:()=>'',addMovie:async()=>{},
    setTimeout:()=>{},me:()=> 'host',consensus:()=> 'Needs discussion',
    esc:s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
    db:{from(table){
      if(!(table in rows))throw Error('Unexpected table: '+table);
      const q={select(){return q},eq(){return q},order(){return q},
        then(resolve){resolve({data:rows[table],error:null})}};
      return q;
    }}
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(read('cheese-grating-integrity.js'),context);
  vm.runInContext(read('cheese-traits.js'),context);
  return context;
}

test('loaded movie, card and modal display confirmed zero, retaining legacy 23',async()=>{
  const c=fixture(23,[],[]);
  await c.loadAll();
  const m=c.state.movies[0];
  assert.equal(m.score,0);
  assert.equal(m.cheese_score,23);
  assert.equal(m.gratingAudit.needsReview,true);
  assert.match(c.movieCard(m),/Score needs review/);
  assert.match(c.modal(),/Cheese Grating/);
  assert.match(c.modal(),/saved legacy value 23; checked total 0/);
});

test('Radar score filter uses confirmed uncapped total instead of legacy value',async()=>{
  const c=fixture(100,[
    {movie_id:'movie-1',trait_id:'one'},{movie_id:'movie-1',trait_id:'two'}
  ],[{id:'one',points:75,is_active:true},{id:'two',points:65,is_active:true}]);
  await c.loadAll();
  assert.equal(c.state.movies[0].score,140);
  vm.runInContext('movieFilters.minScore=110',c);
  assert.equal(c.filteredMovies().length,1);
});
