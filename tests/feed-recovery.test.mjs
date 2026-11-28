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
 c.window=c;vm.createContext(c);vm.runInContext(read('supabase/functions/_shared/movie-content-policy.js'),c);vm.runInContext(read('supabase/functions/_shared/our-movie-taste.js'),c);vm.runInContext(read('supabase/functions/_shared/movie-title-search.js'),c);vm.runInContext(read('movie-recommendations.js'),c);
 return {c,requests,storage};
}
test('a sparse favorite cannot empty the eligible catalog, even after repeated refreshes',async()=>{
 const {c,requests,storage}=client();
 c.state.movies=[{title:'Favorite',votes:{nick:'yes',jenny:'yes'},summary:''}];
 storage.set('cheeseLouise:recommendations:v3:one',JSON.stringify({ids:[1,2,3],titles:catalog.movies.map(m=>m.title),batch:90}));
 await c.discoverCheeseMovies(true);const first=c.state.discoveryResults.map(m=>m.title);
 assert.ok(first.length>=10);assert.equal(requests[0].include_broader,true);assert.equal(requests[0].exclude_titles.length,0);assert.equal(requests[0].exclude_ids.length,0);
 await c.discoverCheeseMovies(true);assert.deepEqual(c.state.discoveryResults.map(m=>m.title),first);
});
test('saved Yes and split votes remain; recorded and both-No are removed from the visible feed',async()=>{
 const {c}=client();await c.discoverCheeseMovies(true);const picks=c.state.discoveryResults.slice(0,4);
 c.state.movies=picks.map((m,i)=>({title:m.title,year:m.year,status:i===2?'recorded':'needs_review',votes:i===0?{nick:'yes',jenny:'yes'}:i===1?{nick:'no',jenny:'yes'}:{nick:'no',jenny:'no'}}));
 c.discoveryHidden.add(picks[0].tmdb_id);
 const html=c.discoveryPanel();assert.ok(html.includes('<h4>'+picks[0].title+'</h4>'));assert.ok(html.includes('<h4>'+picks[1].title+'</h4>'));
 assert.ok(!html.includes('<h4>'+picks[2].title+'</h4>'));assert.ok(!html.includes('<h4>'+picks[3].title+'</h4>'));
 assert.ok(html.indexOf('Coming Soon')<html.indexOf('Top 20 for Cheese Louise'));
 assert.ok(html.indexOf('Top 20 for Cheese Louise')<html.indexOf('More Movies to Discover'));
});
test('a verified future premiere never uses a released Top 20 slot',()=>{
 const {c}=client();
 const now=new Date('2026-11-28T00:59:00Z');
 const santa={title:'Return to Santa',year:2026,premiere_date:'2026-11-27',tmdb_id:999,
  source_url:'https://www.hallmarkchannel.com/return-to-santa',source_metadata:{premiere:{verified:true,at:'2026-11-27T20:00:00-05:00'}}};
 const released=Array.from({length:20},(_,index)=>({title:'Released '+index,year:2025,tmdb_id:index+1}));
 const before=c.clRecDiscoverySections([santa,...released],now);
 assert.equal(before.soon[0].title,santa.title);
 assert.equal(before.top.length,20);
 const after=c.clRecDiscoverySections([santa,...released],new Date('2026-11-28T01:00:00Z'));
 assert.equal(after.soon.length,0);
 assert.equal(after.top[0].title,santa.title);
 assert.equal(after.more.length,1);
});
test('the gold spotlight is reserved for mutual Yes and verified watch options are labeled',()=>{
 const {c}=client();
 const movie={title:'Return to Santa',year:2026,tmdb_id:1,premiere_date:'2026-11-27',network:'Hallmark Channel',
  source_metadata:{availability:[{provider:'Hallmark+',access_type:'Subscription',available_from:'2026-11-28',verified:true}]}};
 c.state.movies=[{id:'santa',title:movie.title,year:2026,votes:{nick:'yes',jenny:'yes'}}];
 const featured=c.clRecFeedCard(movie,true);
 assert.match(featured,/cl-feed-card--spotlight[\s\S]*Don’t miss[\s\S]*Both Hosts Voted Yes/);
 assert.match(featured,/Hallmark Channel[\s\S]*Hallmark\+ · Subscription · from 2026-11-28/);
 c.state.movies[0].votes.jenny='no';
 assert.doesNotMatch(c.clRecFeedCard(movie),/cl-feed-card--spotlight/);
});
test('recorded and released episode links supersede stale movie review status',async()=>{
 const {c}=client();await c.discoverCheeseMovies(true);
 const picks=c.state.discoveryResults.slice(0,3);
 c.state.movies=picks.map((movie,i)=>({id:'movie-'+i,title:movie.title,year:movie.year,status:'needs_review',votes:{nick:'yes'}}));
 c.state.episodes=['recorded','released','watched'].map((status,i)=>({movie_id:'movie-'+i,status}));
 const html=c.discoveryPanel();
 assert.ok(!html.includes('<h4>'+picks[0].title+'</h4>'));
 assert.ok(!html.includes('<h4>'+picks[1].title+'</h4>'));
 assert.ok(html.includes('<h4>'+picks[2].title+'</h4>'));
});
test('season filters still restrict the pool to actual catalog Fall romances',async()=>{
 const {c}=client();c.movieFilters.season='Fall';await c.discoverCheeseMovies(true);
 assert.ok(c.state.discoveryResults.length>=4);assert.ok(c.state.discoveryResults.every(m=>m.season==='Fall'&&m.source_type==='bingo_catalog'));
 assert.ok(c.state.discoveryResults.some(m=>m.title==='Pumpkin Pie Wars'));
});
test('the weekly pick and every shelf respect editorial eligibility and both-No votes',async()=>{
 const {c}=client();await c.discoverCheeseMovies(true);
 const current=c.clRecWeeklyPick(c.state.discoveryResults,{},new Date('2027-01-01'));
 const displayNow=c.clRecWeeklyPick(c.state.discoveryResults);
 const pick=displayNow||current;
 c.state.movies=[{id:'picked',title:pick.title,year:pick.year,votes:{a:'no',b:'no'}}];
 c.state.episodes=[{id:'draft',movie_id:'picked',status:'planning'}];
 c.state.discoveryResults.push({title:'Unreviewed Movie',year:1999,tmdb_id:9199,source_type:'bingo_catalog'});
 const html=c.discoveryPanel();
 assert.doesNotMatch(html,new RegExp('<h4>'+pick.title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'</h4>'));
 assert.doesNotMatch(html,/<h4>Unreviewed Movie<\/h4>/);
 assert.match(html,/cl-feed-card--weekly/);
 assert.equal(c.state.episodes[0].movie_id,'picked');
});
test('catalog and service failures remain errors instead of widening to unrelated movies',async()=>{
 const {c}=client();c.db.functions.invoke=async()=>({error:new Error('Catalog unavailable')});
 await c.discoverCheeseMovies(true);assert.equal(c.discoveryError,'Catalog unavailable');assert.equal(c.discoveryLoading,false);
 assert.equal(c.state.discoveryResults.length,0);
});
test('a stale refresh preserves the existing picks and last successful check',async()=>{
 const {c}=client();await c.discoverCheeseMovies(true);
 const existing=c.state.discoveryResults;
 c.db.functions.invoke=async()=>({data:{results:[],catalog_stale:true,catalog_checked_at:null}});
 await c.discoverCheeseMovies(true);
 assert.equal(c.state.discoveryResults,existing);
 assert.match(c.discoveryPanel(),/could not refresh\. Showing the previous picks/);
});
