import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

function appFixture(oldData=null){
  const inserted=[],asked=[];
  const client={
    auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange(){}},
    from(table){
      assert.equal(table,'movies');
      return {
        select(_columns,opts){
          if(opts?.head)return {eq:async()=>({count:0})};
          return this;
        },
        insert(payload){
          inserted.push(payload);
          return {select(){return {single:async()=>({data:{id:'movie-'+inserted.length},error:null})}}};
        }
      };
    }
  };
  const context={
    supabase:{createClient:()=>client},
    document:{getElementById:()=>({innerHTML:''})},
    localStorage:{getItem:key=>key==='cheeseLouiseV11'&&oldData?JSON.stringify(oldData):null},
    prompt:message=>{asked.push(message);return ['Example Movie','Hallmark','Small town','Short premise'][asked.length-1]??'';},
    alert:message=>{throw Error(message)},console
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(read('app.js'),context);
  vm.runInContext(`workspace={id:'workspace-1'};session={user:{id:'host-1'}};profile={display_name:'Nick'};logActivity=async()=>{};loadAll=async()=>{};render=()=>{};`,context);
  return {context,inserted,asked};
}

test('base movie entry never prompts for or writes a predicted Cheese Grating',async()=>{
  const h=appFixture();
  await h.context.addMovie();
  assert.equal(h.inserted.length,1);
  assert.equal(h.inserted[0].cheese_score,0);
  assert.equal(h.asked.length,4);
  assert.ok(h.asked.every(q=>!q.includes('Cheese potential')));
});

test('v1.1 import retains historical estimate in summary but starts verified score at zero',async()=>{
  const h=appFixture({movies:[{id:'old-1',title:'Legacy Movie',network:'Lifetime',
    score:87,tags:['Christmas'],summary:'Original summary'}],episodes:[],schedule:[],ideas:[]});
  await h.context.importV11Data();
  assert.equal(h.inserted.length,1);
  assert.equal(h.inserted[0].cheese_score,0);
  assert.match(h.inserted[0].summary,/Original summary/);
  assert.match(h.inserted[0].summary,/Imported v1\.1 estimate: 87 points; unverified Cheese Grating/);
});

test('v1.1 missing or invalid estimate does not create a fabricated provenance note',async()=>{
  const h=appFixture({movies:[{id:'old-1',title:'Legacy Movie',score:'not a number'}]});
  await h.context.importV11Data();
  assert.equal(h.inserted[0].cheese_score,0);
  assert.doesNotMatch(h.inserted[0].summary,/Imported v1\.1 estimate/);
});

test('optimistic trait calculation keeps stored score and unknown trait IDs intact',()=>{
  const movie={id:'movie-1',cheese_score:23,selectedTraitIds:['known','missing']};
  const context={
    window:null,state:{movies:[movie],traits:[{id:'known',points:65}]},
    workspace:{id:'workspace-1'},loadAll:async()=>{},
    document:{querySelectorAll:()=>[]},localStorage:{getItem:()=>null,setItem(){}},
    me:()=> 'host-1',console
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(read('cheese-grating-integrity.js'),context);
  vm.runInContext(read('movie-trait-sync.js'),context);
  context.clMovieTraits.score(movie);
  assert.equal(movie.score,65);
  assert.equal(movie.cheese_score,23);
  assert.deepEqual(Array.from(movie.selectedTraitIds),['known','missing']);
  assert.equal(movie.gratingAudit.complete,false);
  assert.equal(movie.gratingAudit.needsReview,true);
  assert.deepEqual(Array.from(movie.gratingAudit.unknownTraitIds),['missing']);
});
