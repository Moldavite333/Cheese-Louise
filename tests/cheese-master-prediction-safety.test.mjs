import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

function masterFixture(){
  const alerts=[],movieUpdates=[],legacyCalls=[];
  const traitA={id:'bakery',name:'Bakery',points:75,is_active:true,category:'Business'};
  const traitB={id:'farm',name:'Christmas tree farm',points:65,is_active:true,category:'Business'};
  const candidate={tmdb_id:9,title:'A Christmas Village',summary:'A bakery owner meets a farmer.'};
  const state={
    movies:[{id:'movie-9',tmdb_id:9,title:candidate.title,summary:candidate.summary,selectedTraitIds:[],source_metadata:{}}],
    discoveryResults:[candidate],traits:[traitA,traitB],traitFeedback:[]
  };
  const context={
    state,workspace:{id:'workspace-1'},window:null,document:{
      createElement:()=>({}),head:{appendChild(){}},querySelectorAll:()=>[]
    },
    setInterval:()=>1,clearInterval(){},setTimeout:()=>1,
    me:()=> 'nick',render(){},topbar:()=>'',loadAll:async()=>{},
    alert:msg=>{alerts.push(String(msg));},
    logActivity:async()=>{},suggestTraits:async()=>{},toggleMovieTrait:async()=>{},
    addDiscoveredMovie:async(id,applyTraits)=>{legacyCalls.push({id,applyTraits});},
    romantiverseAnalyze:()=>({matches:[]}),
    discoveryEstimate:()=>({score:0,traits:[]}),
    discoveryTraitSuggestions:()=>[],
    rvMatchDetailsHtml:()=>'',rvConfidenceLabel:()=> 'Possible',
    esc:value=>String(value),
    db:{from(table){
      if(table==='movies')return {update(payload){movieUpdates.push(payload);return {eq:async()=>({error:null})}}};
      if(table==='trait_feedback')return {select(){return this},eq(){return this},order(){return this},limit:async()=>({data:[],error:null})};
      throw Error('Unexpected write/read of '+table);
    }}
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(read('cheese-master.js'),context);
  return {context,alerts,movieUpdates,legacyCalls,traitA,traitB};
}

test('Cheese Master predictions remain uncapped, while match quality is separate',()=>{
  const h=masterFixture();
  h.context.cmTraitMatch=(trait)=>({trait,confidence:0.9,reason:'Synopsis clue',evidence:['Synopsis clue']});
  h.context.cmConceptSet=()=>new Set();
  const result=h.context.cheeseMasterAnalyze({title:'A Christmas Village'});
  assert.equal(result.score,140);
  assert.equal(result.rawScore,140);
  assert.ok(result.matchScore<=100);
});

test('Suggest from synopsis previews only and never inserts verified traits',async()=>{
  const h=masterFixture();
  h.context.cheeseMasterAnalyze=()=>({matches:[
    {trait:h.traitA,confidence:0.9,evidence:['bakery'],reason:'bakery'},
    {trait:h.traitB,confidence:0.8,evidence:['tree farm'],reason:'tree farm'}
  ],score:140});
  await h.context.suggestTraits('movie-9');
  assert.equal(h.alerts.length,1);
  assert.match(h.alerts[0],/predictions \(not verified\)/i);
  assert.match(h.alerts[0],/Predicted Cheese Grating: 140 points/);
  assert.match(h.alerts[0],/Nothing has been added/);
  assert.equal(h.movieUpdates.length,0);
});

test('legacy true argument cannot cause master wrapper to confirm guessed traits',async()=>{
  const h=masterFixture();
  await h.context.addDiscoveredMovie(9,true);
  assert.deepEqual(h.legacyCalls,[{id:9,applyTraits:false}]);
  assert.equal(h.movieUpdates.length,1); // metadata enrichment only
  assert.equal(h.context.state.movies[0].selectedTraitIds.length,0);
});

test('Romantiverse discovery card offers Add to Radar, not accept-predictions',()=>{
  const context={
    state:{traits:[]},window:null,discoveryTraitSuggestions:()=>[],
    discoveryEstimate:()=>({score:0,traits:[]}),
    discoveryCard:()=>'',suggestTraits:async()=>{},
    romantiverseAnalyze:()=>({matches:[]}),
    rvMatchDetailsHtml:()=>'',rvConfidenceLabel:()=> 'Possible',
    suggestionAliases:()=>({}),topbar:()=>'',esc:v=>String(v),
    addDiscoveredMovie:async()=>{},hideDiscoveredMovie:()=>{}
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(read('romantiverse-inference.js'),context);
  context.discoveryEstimate=()=>({score:140,traits:[{id:'bakery',name:'Bakery',points:140}],matches:[],confidenceLabel:'Possible'});
  const html=context.discoveryCard({tmdb_id:9,title:'A Christmas Village',summary:'A bakery owner meets a farmer.',providers:[],why:[]});
  assert.match(html,/Predicted Cheese Grating/);
  assert.match(html,/🧀 140/);
  assert.match(html,/Confirm each trait after watching/);
  assert.match(html,/Add to Radar/);
  assert.doesNotMatch(html,/Add \+ accept|Add only|addDiscoveredMovie\(9,true\)/);
});


test('fallback Romantiverse Interpreter only previews synopsis matches',async()=>{
  const alerts=[];
  const context={
    state:{movies:[{id:'m',title:'A Christmas Village',selectedTraitIds:[]}],traits:[]},
    window:null,discoveryTraitSuggestions:()=>[],discoveryEstimate:()=>({score:0,traits:[]}),
    discoveryCard:()=>'',suggestTraits:async()=>{},romantiverseAnalyze:()=>({matches:[]}),
    rvMatchDetailsHtml:()=>'',rvConfidenceLabel:()=> 'Possible',suggestionAliases:()=>({}),
    topbar:()=>'',esc:v=>String(v),alert:msg=>alerts.push(String(msg))
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(read('romantiverse-inference.js'),context);
  context.romantiverseAnalyze=()=>({matches:[{trait:{id:'t',name:'Bakery',points:75},confidence:0.8,reason:'Synopsis'}]});
  await context.suggestTraits('m');
  assert.equal(alerts.length,1);
  assert.match(alerts[0],/unverified/);
  assert.match(alerts[0],/Nothing has been added/);
});

test('base Cheese Traits suggestion fallback never inserts predicted traits',async()=>{
  const alerts=[];
  const context={
    state:{movies:[{id:'m',title:'A Christmas Village',summary:'She owns a bakery.',selectedTraitIds:[]}],
      traits:[{id:'t',name:'Bakery',points:75,is_active:true}],filterPresets:[]},
    workspace:{id:'w'},session:null,window:null,loadAll:async()=>{},
    movies:()=>'',movieCard:()=>'',filteredMovies:()=>[],modal:()=>'',addMovie:async()=>{},
    setTimeout:()=>1,me:()=> 'nick',consensus:()=>'',render(){},esc:v=>String(v),
    alert:msg=>alerts.push(String(msg)),db:{from(){throw Error('Unexpected database call')}}
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(read('cheese-traits.js'),context);
  await context.suggestTraits('m');
  assert.equal(alerts.length,1);
  assert.match(alerts[0],/unverified/);
  assert.match(alerts[0],/Nothing has been added/);
});
