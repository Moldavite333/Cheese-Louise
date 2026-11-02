import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../movie-discovery.js',import.meta.url),'utf8');

function fixture(){
  const candidate={
    tmdb_id:558815,tmdb_type:'movie',title:'A Christmas Village',
    summary:'A bakery owner meets a farmer.',network:'UPtv',genres:['Romance'],
    source_url:'https://www.themoviedb.org/movie/558815'
  };
  const state={movies:[],discoveryResults:[candidate],traits:[
    {id:'bakery',name:'Bakery',points:75,is_active:true},
    {id:'farmer',name:'Farmer',points:65,is_active:true}
  ]};
  let insertedMovie=null;
  const updates=[],insertedTraits=[],votes=[];
  const context={
    state,workspace:{id:'test-workspace'},session:null,
    movies:()=>'<section></section>',window:null,render(){},setTimeout(){},
    me:()=> 'host-1',logActivity:async()=>{},alert:message=>{throw Error(message)},
    esc:s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
    db:{from(table){
      if(table==='movies')return {
        insert(payload){insertedMovie=payload;return {select(){return {single:async()=>({data:{id:'movie-1',...payload},error:null})}}}},
        update(payload){updates.push(payload);return {eq:async()=>({error:null})}}
      };
      if(table==='movie_traits')return {insert:async rows=>{insertedTraits.push(...rows);return {error:null}}};
      throw Error('Unexpected table '+table);
    }},
    loadAll:async()=>{if(insertedMovie)state.movies=[{id:'movie-1',...insertedMovie,selectedTraitIds:[],votes:{}}]},
    vote:async(id,value)=>{votes.push({id,value})}
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(source,context);
  return {context,state,candidate,updates,insertedTraits,votes,getInserted:()=>insertedMovie};
}

test('prediction sums all suggested trope points and is visibly unverified',()=>{
  const h=fixture();
  assert.equal(h.context.discoveryEstimate(h.candidate).score,140);
  const html=h.context.discoveryCard(h.candidate);
  assert.match(html,/Predicted Cheese Grating/);
  assert.match(html,/🧀 140/);
  assert.match(html,/checked traits determine the official tally/);
  assert.doesNotMatch(html,/Cheese Rating/);
});

test('voting Yes on a new discovery never writes a predicted score into verified Cheese Grating',async()=>{
  const h=fixture();
  await h.context.voteDiscoveredMovie(558815,'yes');
  assert.equal(h.getInserted().cheese_score,0);
  assert.equal(h.updates.length,0);
  assert.equal(h.insertedTraits.length,0);
  assert.equal(h.state.movies[0].cheese_score,0);
  assert.deepEqual(h.votes,[{id:'movie-1',value:'yes'}]);
});

test('adding from Radar never treats metadata-matched tropes as verified',async()=>{
  const h=fixture();
  const html=h.context.discoveryCard(h.candidate);
  assert.match(html,/Add to Radar/);
  assert.match(html,/Review 2 predicted Cheese Traits after watching/);
  assert.doesNotMatch(html,/Add \+ confirm/);
  await h.context.addDiscoveredMovie(558815);
  assert.equal(h.insertedTraits.length,0);
  assert.equal(h.getInserted().cheese_score,0);
});

test('legacy addDiscoveredMovie true argument cannot auto-confirm suggested tropes',async()=>{
  const h=fixture();
  await h.context.addDiscoveredMovie(558815,true);
  assert.equal(h.insertedTraits.length,0);
  assert.equal(h.getInserted().cheese_score,0);
});
