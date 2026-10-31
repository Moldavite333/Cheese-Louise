import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function setup(){
 const timers=new Map(),requests=[];let nextTimer=0,saved=null,respond=async query=>({data:{results:[{tmdb_id:query==='autumn'?10:20,title:query,season:'Fall'}],expanded_terms:[]}});
 const context={
 window:null,state:{movies:[],traits:[],filterPresets:[],discoveryResults:[]},movieFilters:{mode:'all',traitIds:[],traitCategories:[],minScore:0},searchText:'',currentTab:'movies',workspace:{id:'ws'},
 movieMatchesCheeseFilters:()=>true,activeFilterCount:()=>0,cheeseFilterPanel:()=>'<div class="score-filter"></div><div class="preset-actions"></div>',movieCard:()=>'',cheeseMovieModal:()=>'',movies:()=>'',topbar:()=>'',render(){},loadAll:async()=>{},me:()=> 'test',esc:value=>String(value??''),alert(){},prompt:()=> 'Saved view',
 document:{getElementById:()=>null},setTimeout:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id},clearTimeout:id=>timers.delete(id),
 v16MatchesNetwork:()=>true,v16MatchesRelease:()=>true,discoveryEstimate:()=>({score:0,traits:[]}),
 db:{functions:{invoke:async(name,{body})=>{requests.push(body);return respond(body.query)}},from:()=>({upsert:async payload=>{saved=payload;return {error:null}}})}};
 context.window=context;context.setSearch=value=>{context.searchText=value};
 vm.createContext(context);for(const file of ['holiday-season-filters.js','romantiverse-search.js','year-filter.js'])vm.runInContext(read(file),context,{filename:file});
 return {context,requests,saved:()=>saved,respond:fn=>{respond=fn},flush:async()=>{for(const [id,timer] of [...timers])if(timer.ms===450){timers.delete(id);timer.fn()}await new Promise(setImmediate)}};
}
test('season and holiday aliases match explicit metadata, including serialized source metadata',()=>{
 const {context:c}=setup();
 c.movieFilters={season:'Fall',holiday:"Valentine's Day"};
 assert.equal(c.clMatchesSeasonHoliday({season:'Autumn',holiday:'Valentine’s Day'}),true);
 c.movieFilters={season:'Winter',holiday:'Christmas'};
 assert.equal(c.clMatchesSeasonHoliday({source_metadata:JSON.stringify({season:'winter',holiday:'Xmas'})}),true);
 assert.equal(c.clMatchesSeasonHoliday({title:'Christmas Cabin',premiere_date:'2026-12-20'}),false,'Do not fabricate classification from title or release month');
});
test('not-classified filter exposes missing data separately rather than blending it with matches',()=>{
 const {context:c}=setup();c.movieFilters={season:'__unknown__'};
 assert.equal(c.clMatchesSeasonHoliday({season:null}),true);assert.equal(c.clMatchesSeasonHoliday({season:'Winter'}),false);
 c.movieFilters={holiday:'__unknown__'};assert.equal(c.clMatchesSeasonHoliday({holiday:"New Year's Eve"}),false);
});
test('year filters accept year-only catalog entries and metadata instead of requiring a date',()=>{
 const {context:c}=setup();c.movieFilters={yearMin:2025,yearMax:2025};
 assert.equal(c.clReleaseYear({year:2025}),2025);assert.equal(c.clPassesYearFilter({year:2025}),true);
 assert.equal(c.clPassesYearFilter({source_metadata:'{"year":2025}'}),true);assert.equal(c.clPassesYearFilter({year:2024}),false);
});
test('saving and applying year/studio presets also preserves network and release timing',async()=>{
 const h=setup(),c=h.context;c.movieFilters={mode:'all',yearMin:2024,yearMax:2026,studio:'Studio A',network:'Hallmark',releaseWindow:'upcoming'};
 await c.saveCurrentFilterPreset();const criteria=h.saved().criteria;assert.equal(criteria.network,'Hallmark');assert.equal(criteria.release_window,'upcoming');
 c.state.filterPresets=[{id:'view',criteria}];c.applyFilterPreset('view');
 assert.equal(c.movieFilters.network,'Hallmark');assert.equal(c.movieFilters.releaseWindow,'upcoming');assert.equal(c.movieFilters.yearMin,2024);
});
test('external search respects the same year, studio, and vote-scope filters',()=>{
 const {context:c}=setup();const movie={title:'Harvest',season:'Fall',year:2025,production_companies:['Studio A']};
 c.movieFilters={mode:'all',yearMin:2025,yearMax:2025,studio:'Studio A'};assert.equal(c.romantiverseSearchMatchesFilters(movie),true);
 c.movieFilters.yearMax=2024;assert.equal(c.romantiverseSearchMatchesFilters(movie),false);
 c.movieFilters={mode:'yes'};assert.equal(c.romantiverseSearchMatchesFilters(movie),false);
});
test('choosing season or holiday requests more relevant titles without requiring typed search',async()=>{
 const h=setup(),c=h.context;c.setSeasonFilter('Fall');await h.flush();assert.equal(h.requests.at(-1).query,'autumn');
 c.setHolidayFilter('Christmas');await h.flush();assert.equal(h.requests.at(-1).query,'christmas');
 c.searchText='A Specific Movie';assert.equal(c.romantiverseFilterQuery(),'A Specific Movie','Do not replace an exact title with a seasonal query');
});
test('a slow old request cannot overwrite a more recent cached query',async()=>{
 const h=setup(),c=h.context;await c.runRomantiverseSearch('autumn');
 let finish;h.respond(query=>new Promise(resolve=>{finish=()=>resolve({data:{results:[{title:query}],expanded_terms:[]}})}));
 const pending=c.runRomantiverseSearch('winter');await c.runRomantiverseSearch('autumn');finish();await pending;
 assert.equal(c.state.romantiverseSearchResults[0].title,'autumn');
});
