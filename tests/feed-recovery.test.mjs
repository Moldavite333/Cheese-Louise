import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {selectCatalog} from '../supabase/functions/_shared/romantiverse-catalog.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const catalog=JSON.parse(read('supabase/functions/_shared/romantiverse-catalog.json'));
function client(){
 const requests=[],storage=new Map();
 const c={window:null,session:{},workspace:{id:'one'},state:{movies:[],discoveryResults:[]},discoveryHidden:new Set(),discoveryLoaded:false,discoveryLoading:false,discoveryError:'',movieFilters:{mode:'all'},searchText:'',
 document:{getElementById:()=>null},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setTimeout:()=>0,clearTimeout(){},render(){},esc:String,
 movieCard:m=>'<article>SAVED '+m.title+'</article>',discoveryCard:m=>'<article>'+m.title+'</article>',discoverySavedMovie:()=>null,discoveryMatchesCurrentView:()=>true,
 clSetTasteSort(){},sharedRadarRefreshResults(){},clTasteSort:'taste',clTasteRank:rows=>rows,
 db:{functions:{invoke:async(name,{body})=>{requests.push(body);return {data:selectCatalog(catalog,body,true)}}}}};
 c.window=c;vm.createContext(c);vm.runInContext(read('supabase/functions/_shared/movie-content-policy.js'),c);vm.runInContext(read('supabase/functions/_shared/our-movie-taste.js'),c);vm.runInContext(read('movie-recommendations.js'),c);
 return {c,requests,storage};
}
test('a sparse favorite cannot empty the eligible catalog, even after repeated refreshes',async()=>{
 const {c,requests,storage}=client();
 c.state.movies=[{title:'Favorite',votes:{nick:'yes',jenny:'yes'},summary:''}];
 storage.set('cheeseLouise:recommendations:v3:one',JSON.stringify({ids:[1,2,3],titles:catalog.movies.map(m=>m.title),batch:90}));
 await c.discoverCheeseMovies(true);const first=c.state.discoveryResults.map(m=>m.title);
 assert.ok(first.length>=20);assert.equal(requests[0].include_broader,true);assert.equal(requests[0].exclude_titles.length,0);assert.equal(requests[0].exclude_ids.length,0);
 await c.discoverCheeseMovies(true);assert.deepEqual(c.state.discoveryResults.map(m=>m.title),first);
});
test('saved Yes and split votes remain; recorded and both-No are removed from the visible feed',async()=>{
 const {c}=client();await c.discoverCheeseMovies(true);const picks=c.state.discoveryResults.slice(0,4);
 c.state.movies=picks.map((m,i)=>({title:m.title,year:m.year,status:i===2?'recorded':'needs_review',votes:i===0?{nick:'yes',jenny:'yes'}:i===1?{nick:'no',jenny:'yes'}:{nick:'no',jenny:'no'}}));
 c.discoveryHidden.add(picks[0].tmdb_id);
 const html=c.discoveryPanel();assert.ok(html.includes('SAVED '+picks[0].title));assert.ok(html.includes('SAVED '+picks[1].title));
 assert.ok(!html.includes('<article>SAVED '+picks[2].title));assert.ok(!html.includes('<article>SAVED '+picks[3].title));assert.ok(html.includes('More matches'));
});
test('season filters still restrict the pool to actual catalog Fall romances',async()=>{
 const {c}=client();c.movieFilters.season='Fall';await c.discoverCheeseMovies(true);
 assert.equal(c.state.discoveryResults.length,12);assert.ok(c.state.discoveryResults.every(m=>m.season==='Fall'&&m.source_type==='bingo_catalog'));
 assert.ok(c.state.discoveryResults.some(m=>m.title==='Pumpkin Pie Wars'));
});
test('catalog and service failures remain errors instead of widening to unrelated movies',async()=>{
 const {c}=client();c.db.functions.invoke=async()=>({error:new Error('Catalog unavailable')});
 await c.discoverCheeseMovies(true);assert.equal(c.discoveryError,'Catalog unavailable');assert.equal(c.discoveryLoading,false);
 assert.equal(c.state.discoveryResults.length,0);
});