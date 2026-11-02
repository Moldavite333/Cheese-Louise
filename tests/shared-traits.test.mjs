import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

function harness(saved={}){
  const storage=new Map(Object.entries(saved)),server=new Map([['a',new Set(['t1'])],['b',new Set()]]);
  let html='',fail=false,gate=null;
  const score={textContent:'5',dataset:{cheeseScoreMovie:'a'}},badge={textContent:''};
  const subtotals=[{textContent:'5'},{textContent:'5'}],subtotalCounts=[{textContent:''},{textContent:''}];
  const elements=new Map([['watchRundownPreview',{value:''}],['watchTraitBody',{innerHTML:''}],['clp-body',{innerHTML:''}],['clp-marker-note',{value:'Keep typing',getAttribute:()=> 'a'}],['clp-marker-type',{value:'Funny / Clip'}]]);
  const sync={textContent:''},retry={hidden:true};
  const ctx=vm.createContext({console:{...console,warn(){}},Map,Set,Date,Promise,workspace:{id:'w'},session:{user:{id:'u'}},me:()=> 'u',
    state:{movies:[{id:'a',title:'Movie A',selectedTraitIds:['t1'],score:5},{id:'b',title:'Movie B',selectedTraitIds:[],score:0}],traits:[{id:'t1',name:'Old flame',points:5,is_active:true},{id:'t2',name:'Bakery',points:9,is_active:true}]},
    selectedMovie:null,currentTab:'watchalong',localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    document:{getElementById:id=>elements.get(id)||null,querySelector:s=>s==='[data-watch-trait-sync]'?sync:s==='[data-watch-trait-retry]'?retry:null,querySelectorAll:s=>s==='[data-cheese-score-movie]'?[score]:s==='[data-watch-grating]'?[badge]:s==='[data-watch-grating-value]'?subtotals:s==='[data-watch-grating-count]'?subtotalCounts:[],activeElement:null},
    navigator:{clipboard:{writeText:async value=>{ctx.copied=value}}},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,confirm:()=>true,alert(){},
    tabs:()=>'<nav></nav>',render(){},shell:s=>{html=s;},topbar:()=>'',modal:()=>'',authScreen(){},onboardingScreen(){},esc:x=>String(x??''),
    async loadAll(){const copy=new Map([...server].map(([k,v])=>[k,[...v]]));if(gate)await gate;ctx.state.movies=ctx.state.movies.map(m=>({...m,selectedTraitIds:copy.get(m.id)||[],cheese_score:999,score:999}));},
    db:{from(table){assert.equal(table,'movie_traits');return {
      insert:row=>write(true,row.movie_id,row.trait_id),
      delete(){const filter={};const chain={eq(k,v){filter[k]=v;return chain;},then(resolve,reject){return write(false,filter.movie_id,filter.trait_id).then(resolve,reject);}};return chain;}
    };}}
  });ctx.window=ctx;
  async function write(on,movieId,traitId){if(gate)await gate;if(fail)return {error:{message:'Offline'}};if(on)server.get(movieId).add(traitId);else server.get(movieId).delete(traitId);return {error:null};}
  for(const file of ['watch-along.js','recording-hub.js','movie-trait-sync.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx,{filename:file});
  return {ctx,storage,server,elements,score,badge,subtotals,subtotalCounts,sync,retry,html:()=>html,fail:v=>{fail=v},block:()=>{let release;gate=new Promise(r=>{release=r});return ()=>{gate=null;release();}}};
}

test('a Watch Along check immediately updates the score, card and rundown and saves to shared traits',async()=>{
  const h=harness();await h.ctx.loadAll();
  h.ctx.watchAlongToggleTrait('t2');
  assert.equal(h.ctx.state.movies[0].score,14);assert.equal(h.score.textContent,'14');
  assert.ok(h.subtotals.every(el=>el.textContent==='14'));assert.ok(h.subtotalCounts.every(el=>el.textContent==='2 tropes checked'));
  assert.match(h.badge.textContent,/14 points/);assert.match(h.elements.get('watchRundownPreview').value,/14 points from 2 confirmed/);
  await h.ctx.clMovieTraits.retry('a');assert.equal(h.server.get('a').has('t2'),true);
  assert.equal(h.ctx.clMovieTraits.status('a').pending,0);
  await h.ctx.clMovieTraits.set('a','t1',false);assert.equal(h.score.textContent,'9');
  assert.ok(h.subtotals.every(el=>el.textContent==='9'));assert.ok(h.subtotalCounts.every(el=>el.textContent==='1 trope checked'));
});
test('rapid on/off taps persist the last intent without duplicate counting',async()=>{
  const h=harness();await h.ctx.loadAll();const release=h.block();
  const first=h.ctx.clMovieTraits.set('a','t2',true);
  const second=h.ctx.clMovieTraits.set('a','t2',false);
  assert.equal(h.ctx.state.movies[0].score,5);release();await Promise.all([first,second]);
  assert.equal(h.server.get('a').has('t2'),false);assert.equal(h.ctx.state.movies[0].score,5);
});
test('a failed save remains explicitly unsynced and can be retried without losing notes',async()=>{
  const h=harness();await h.ctx.loadAll();h.ctx.watchAlongSaveText('notes','Keep this observation');h.fail(true);
  await h.ctx.clMovieTraits.set('a','t2',true);
  assert.equal(h.ctx.clMovieTraits.status('a').error,true);assert.equal(h.retry.hidden,false);
  assert.equal(h.server.get('a').has('t2'),false);
  h.fail(false);await h.ctx.clMovieTraits.retry('a');
  assert.equal(h.server.get('a').has('t2'),true);assert.equal(h.retry.hidden,true);
  assert.match(h.storage.get('cheeseLouise:watchAlong:w:draft:a'),/Keep this observation/);
});
test('a shared refresh imports another device’s traits and replaces stale draft membership',async()=>{
  const h=harness();await h.ctx.loadAll();h.ctx.watchAlongSaveText('notes','Notes stay here');
  h.server.get('a').add('t2');await h.ctx.loadAll();
  assert.equal(h.score.textContent,'14');assert.match(h.elements.get('watchRundownPreview').value,/Bakery/);
  h.server.get('a').delete('t1');await h.ctx.loadAll();assert.equal(h.score.textContent,'9');
  const draft=JSON.parse(h.storage.get('cheeseLouise:watchAlong:w:draft:a'));
  assert.deepEqual(draft.traitIds,['t2']);assert.equal(draft.notes,'Notes stay here');
});
test('recording and socials use the live grating while retaining the running session and marker draft',async()=>{
  const h=harness();await h.ctx.loadAll();h.ctx.currentTab='recording';h.ctx.clProduction.start();
  const before=JSON.parse(h.storage.get('cheeseLouise:production:v1:w'));
  await h.ctx.clMovieTraits.set('a','t2',true);
  assert.match(h.elements.get('clp-body').innerHTML,/14 points/);
  assert.equal(h.elements.get('clp-marker-note').value,'Keep typing');
  const after=JSON.parse(h.storage.get('cheeseLouise:production:v1:w'));
  assert.equal(after.sessions.a.runningSince,before.sessions.a.runningSince);
  h.ctx.clProduction.copySocial();await Promise.resolve();assert.match(h.ctx.copied,/Cheese Grating: 14/);
});
test('pending changes survive reload and clearing Watch Along notes keeps the shared score',async()=>{
  const h=harness();await h.ctx.loadAll();h.fail(true);await h.ctx.clMovieTraits.set('a','t2',true);
  const reloaded=harness(Object.fromEntries(h.storage));await reloaded.ctx.loadAll();await reloaded.ctx.clMovieTraits.retry('a');
  assert.equal(reloaded.server.get('a').has('t2'),true);assert.equal(reloaded.ctx.state.movies[0].score,14);
  reloaded.ctx.watchAlongClearDraft();assert.equal(reloaded.ctx.state.movies[0].score,14);
});
test('a refresh started before a tap cannot replace the optimistic score with an older result',async()=>{
  const h=harness();await h.ctx.loadAll();const release=h.block();
  const refresh=h.ctx.loadAll();const save=h.ctx.clMovieTraits.set('a','t2',true);
  release();await Promise.all([refresh,save]);
  assert.equal(h.ctx.state.movies[0].score,14);assert.equal(h.score.textContent,'14');
});
test('older device-only checks migrate once without removing shared selections or notes',async()=>{
  const h=harness({'cheeseLouise:watchAlong:w:draft:a':JSON.stringify({traitIds:['t2'],notes:'Legacy observation'})});
  await h.ctx.loadAll();await h.ctx.clMovieTraits.retry('a');
  assert.equal(h.server.get('a').has('t1'),true);assert.equal(h.server.get('a').has('t2'),true);
  assert.equal(h.ctx.state.movies[0].score,14);
  const draft=JSON.parse(h.storage.get('cheeseLouise:watchAlong:w:draft:a'));assert.equal(draft.notes,'Legacy observation');
  assert.equal(draft.sharedTraitsVersion,1);
  h.server.get('a').delete('t2');await h.ctx.loadAll();assert.equal(h.ctx.state.movies[0].score,5);
});
test('a refresh started during a save cannot restore the pre-save selection after acknowledgment',async()=>{
  const h=harness();await h.ctx.loadAll();const release=h.block();
  const save=h.ctx.clMovieTraits.set('a','t2',true);const refresh=h.ctx.loadAll();
  release();await Promise.all([save,refresh]);
  assert.equal(h.server.get('a').has('t2'),true);assert.equal(h.score.textContent,'14');
});
