import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {eligible,scoreMovie,diversify,norm,featureNames,identityKey,excludedByIdentity} from '../supabase/functions/recommend-romantiverse/engine.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const seed={id:1,title:'Favorite magical romance',overview:'A magical wish sends her back in time to find love.',genres:[{id:10749},{id:10770}],keywords:{keywords:[]}};
const romance={id:2,title:'A Christmas Wish',overview:'A magical wish helps a woman fall in love.',runtime:88,genres:[{id:10749},{id:10770}],keywords:{keywords:[]},seed_ids:[1]};
test('seasonal words cannot admit horror, documentaries, shorts or non-romantic Christmas movies',()=>{
 assert.equal(eligible({...romance,genres:[{id:27},{id:10749}]}),false);
 assert.equal(eligible({...romance,genres:[{id:99},{id:10749}]}),false);
 assert.equal(eligible({...romance,runtime:12}),false);
 assert.equal(eligible({title:'Ghost of Christmas',overview:'A terrifying haunting.',genres:[{id:10770}]}),false);
});
test('specific magical similarities outrank a generic holiday romance',()=>{
 const specific=scoreMovie(romance,[seed]);
 const generic=scoreMovie({...romance,title:'Christmas Together',overview:'Two people fall in love at Christmas.'},[seed]);
 assert.ok(specific.score>generic.score);
 assert.match(specific.reasons.join(' '),/Favorite magical romance/);
 assert.equal(scoreMovie({...romance,title:'Christmas Together',overview:'Two people fall in love.',seed_ids:[]},[seed]),null,'No fabricated favorite relationship');
});
test('negative votes lower related premise scores without making generic seasonal matches a hard ban',()=>{
 const before=scoreMovie(romance,[seed]);
 const after=scoreMovie(romance,[seed],[{...seed,preference_weight:1.5}]);
 assert.ok(after.score<before.score);
});
test('diversity breaks up tied batches from the same favorite',()=>{
 const rows=[1,2,3,4].map(id=>({movie:{id},fit:{score:70,anchor:1,lane:'quirky'}}));
 rows.push({movie:{id:5},fit:{score:69,anchor:2,lane:'autumn'}});
 assert.equal(diversify(rows,3)[1].movie.id,5);
});
test('favorite normalization handles articles and apostrophe variations',()=>{
 assert.equal(norm("Something’s Brewing"),norm("Something's Brewing"));
 assert.equal(norm('A Christmas Movie Christmas'),norm('Christmas Movie Christmas'));
});
test('Christmas spirit and ordinary hopes do not fabricate ghost or magical premises',()=>{
 const features=featureNames({title:'Christmas Together',overview:'She hopes for romance and discovers the magic of Christmas and Christmas spirit.'});
 assert.ok(!features.includes('romantic ghost story'));assert.ok(!features.includes('magical romance'));
});
test('alternate realities, changing centuries and Fantasy metadata surface sparsely tagged romances',()=>{
 const time={...romance,title:'A Different Century',overview:'He travels from 1903 to 2020 and finds love.'};
 assert.ok(featureNames(time).includes('time-travel romance'));
 assert.ok(featureNames({...romance,overview:'She wakes up in a new reality.'}).includes('time-travel romance'));
 const fantasy={...romance,overview:'A snow sculpture comes to life.',genres:[{id:10749},{id:10770},{id:14}],seed_ids:[]};
 assert.ok(scoreMovie(fantasy,[{...seed,genres:[{id:10749},{id:10770},{id:14}]}]).score>=55);
 assert.ok(!featureNames({...romance,overview:'She is transported to Seattle for work.'}).includes('time-travel romance'));
});
function client(storageFails=false){
 const storage=new Map(),requests=[];
 const context={window:null,session:{},workspace:{id:'one'},state:{movies:[],discoveryResults:[]},discoveryHidden:new Set(),discoveryLoaded:false,discoveryLoading:false,discoveryError:'',movieFilters:{},movieCard:()=>'',discoveryCard:()=>'',render(){},searchText:'',
  document:{getElementById:()=>null},localStorage:{getItem:key=>storage.get(key)||null,setItem:(k,v)=>{if(storageFails)throw Error('full');storage.set(k,v)},removeItem:key=>storage.delete(key)},
  setTimeout:()=>0,clearTimeout(){},clSetTasteSort(){},sharedRadarRefreshResults(){},
  db:{functions:{invoke:async(name,{body})=>{requests.push({name,body});return {data:{results:[{tmdb_id:body.batch+10,title:'Fresh movie '+body.batch}],matched_favorites:[]}}}}}};
 context.window=context;vm.createContext(context);vm.runInContext(read('supabase/functions/_shared/movie-content-policy.js'),context);vm.runInContext(read('movie-recommendations.js'),context);
 return {c:context,requests};
}
test('fresh picks exclude earlier batches and saved films and retain discovery history',async()=>{
 const {c,requests}=client();c.state.movies=[{title:'Already saved',votes:{a:'yes',b:'yes'},source_metadata:{year:2023}}];
 await c.discoverCheeseMovies(true);await c.discoverCheeseMovies(true);
 assert.equal(requests[0].name,'recommend-romantiverse');assert.equal(requests[1].body.batch,1);
 assert.ok(requests[1].body.exclude_ids.includes(10));assert.ok(requests[1].body.exclude_title_years.includes('already saved|2023'));
 assert.ok(!requests[1].body.exclude_unknown_titles.includes('already saved'));
 assert.ok(requests[1].body.exclude_unknown_titles.includes('fresh movie 0'),'Unknown-year recommendation is retained in history');
 assert.equal(requests[0].body.likes[0].weight,1.5);
 assert.equal(c.state.discoveryResults[0].tmdb_id,11);
});
test('history stays isolated by workspace and works in memory if storage is unavailable',async()=>{
 const {c,requests}=client(true);await c.discoverCheeseMovies(true);await c.discoverCheeseMovies(true);
 assert.ok(requests[1].body.exclude_ids.includes(10));
 c.workspace={id:'two'};await c.discoverCheeseMovies(true);
 assert.equal(requests[2].body.batch,0);assert.equal(requests[2].body.exclude_ids.length,0);
});
test('poster lookup uses year-only catalog records, batches requests and preserves TMDB save provenance',async()=>{
 const calls=[];let originalSaves=0;
 const c={window:null,state:{discoveryResults:[{tmdb_id:42,source_type:'tmdb_recommendation'}]},workspace:{id:'w'},addDiscoveredMovie:async()=>{originalSaves++},document:{createElement:()=>({}),head:{appendChild(){}}},
 db:{functions:{invoke:async(name,{body})=>{calls.push(body.movies);return {data:{results:body.movies.map(m=>({key:m.key,verified:true,poster_url:'https://image.tmdb.org/t/p/w500/test.jpg'}))}}}}}};
 c.window=c;vm.createContext(c);vm.runInContext(read('poster-resolver.js'),c);
 assert.equal(c.clPosterResolver.input({title:'Only a Year',year:2023}).year,2023);
 await c.clPosterResolver.resolve(Array.from({length:17},(_,i)=>({id:i,title:'Movie '+i,year:2023})));
 assert.deepEqual(calls.map(x=>x.length),[8,8,1]);
 await c.addDiscoveredMovie(42,false);assert.equal(originalSaves,1);
});


test('year-aware identity permits remakes but blocks same-year duplicates',()=>{
 const years=new Set([identityKey({title:'A Christmas Village',release_date:'2018-12-01'})]),unknown=new Set();
 assert.equal(excludedByIdentity({id:20,title:'A Christmas Village',release_date:'2018-11-30'},new Set(),years,unknown),true);
 assert.equal(excludedByIdentity({id:21,title:'A Christmas Village',release_date:'2026-11-30'},new Set(),years,unknown),false);
 assert.equal(excludedByIdentity({id:22,title:'A Christmas Village'},new Set(),years,unknown),true,'Missing year must not silently duplicate an existing title');
 assert.equal(excludedByIdentity({id:21,title:'A Christmas Village',release_date:'2026-11-30'},new Set([21]),years,unknown),true,'TMDB ID wins');
 assert.equal(excludedByIdentity({id:30,title:'Unknown release',release_date:'2026-01-01'},new Set(),years,new Set(['unknown release'])),true);
});
test('recommendation client distinguishes a remake and preserves year-qualified history',async()=>{
 const {c,requests}=client();
 c.state.movies=[{title:'A Christmas Village',year:2018,tmdb_id:123,source_metadata:{source_type:'tmdb_search'}}];
 const excludes=c.clRecExclusions(c.state.movies,{title_years:[],unknown_titles:[]});
 assert.equal(c.clRecExcluded({title:'A Christmas Village',year:2018},excludes),true);
 assert.equal(c.clRecExcluded({title:'A Christmas Village',year:2026},excludes),false);
 assert.equal(c.clRecExcluded({title:'A Christmas Village'},excludes),true);
 await c.discoverCheeseMovies(true);
 assert.ok(requests[0].body.exclude_title_years.includes('christmas village|2018'));
 assert.ok(!requests[0].body.exclude_unknown_titles.includes('christmas village'));
});
