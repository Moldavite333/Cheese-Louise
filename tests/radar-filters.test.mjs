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
 v16MatchesNetwork:()=>true,v16MatchesRelease:()=>true,discoveryEstimate:()=>({score:0,traits:[]}),discoveryCard:()=>'<div class="new-find-score"></div>',
 db:{functions:{invoke:async(name,{body})=>{requests.push(body);return respond(body.query)}},from:()=>({upsert:async payload=>{saved=payload;return {error:null}}})}};
 context.window=context;context.setSearch=value=>{context.searchText=value};
 vm.createContext(context);for(const file of ['supabase/functions/_shared/movie-content-policy.js','holiday-season-filters.js','supabase/functions/_shared/our-movie-taste.js','movie-taste.js','romantiverse-search.js','year-filter.js'])vm.runInContext(read(file),context,{filename:file});
 return {context,requests,saved:()=>saved,respond:fn=>{respond=fn},flush:async()=>{for(const [id,timer] of [...timers])if(timer.ms===450){timers.delete(id);timer.fn()}await new Promise(setImmediate)}};
}
test('cached external search results cannot display mixed Horror/Romance or explicit horror metadata',()=>{
 const {context:c}=setup();
 assert.equal(c.romantiverseSearchMatchesFilters({title:'Mixed',genres:['Romance','Horror']}),false);
 assert.equal(c.romantiverseSearchMatchesFilters({title:'Mixed',genre_ids:[10749,27]}),false);
 assert.equal(c.romantiverseSearchMatchesFilters({title:'Unlabeled',keywords:['slasher']}),false);
 assert.equal(c.romantiverseSearchMatchesFilters({title:'Friendly Christmas Ghost',genres:['Romance','TV Movie'],summary:'A woman falls in love with a friendly ghost.'}),true);
});

test('catalog taste discovery uses one bounded request, keeps the catalog pool and rejects general movie rows',async()=>{
 const h=setup(),c=h.context;
 h.respond(async()=>({data:{results:[{tmdb_id:1,title:'Shared Christmas film',source_type:'bingo_catalog'},...Array.from({length:60},(_,i)=>({tmdb_id:i+2,title:'Catalog movie '+i,source_type:'bingo_catalog'})),{tmdb_id:999,title:'Cinderella',source_type:'tmdb_search'}],expanded_terms:[]}}));
 await c.runRomantiverseSearch('',true,true);
 assert.equal(h.requests.length,1);assert.equal(c.state.romantiverseSearchResults.length,61);
 assert.ok(!c.state.romantiverseSearchResults.some(m=>m.title==='Cinderella'));
});

test('catalog failure reports the error and cannot fall back to general movie searches',async()=>{
 const h=setup(),c=h.context;h.respond(async()=>({error:new Error('Catalog offline')}));
 await c.runRomantiverseSearch('',true,true);
 assert.equal(h.requests.length,1);assert.equal(c.state.romantiverseSearchResults.length,0);assert.match(c.romantiverseSearchPanel(),/Catalog offline/);
});

test('taste ranking learns both people’s votes, keeps exact titles first, and separates cheese',()=>{
 const {context:c}=setup();
 const magic={title:'An enchanted wish',summary:'A magical wish comes true.',score:0},other={title:'A regular romance',score:100};
 c.state.movies=[{title:'Our magical pick',summary:'A magical wish comes true.',votes:{a:'yes',b:'yes'}}];assert.equal(c.clTasteRank([other,magic])[0],magic);
 c.state.movies=Array.from({length:6},(_,i)=>({title:'An enchanted wish '+i,votes:{a:'no',b:'no'}}));
 assert.equal(c.clTasteRank([other,magic])[0],other);
 c.searchText='An enchanted wish';assert.equal(c.clTasteRank([other,magic])[0],magic);
 c.state.movies=[{title:'An enchanted wish',summary:'A magical wish comes true.',votes:{a:'yes',b:'yes'}}];
 assert.ok(c.clTasteMatch(magic).score>3);
});

test('ordinary exact-title lookup issues one request and keeps all Radar filters',async()=>{
 const h=setup(),c=h.context;c.movieFilters={mode:'all',yearMin:2025,season:'Fall'};
 await c.runRomantiverseSearch('A Biltmore Christmas');
 assert.equal(h.requests.length,1);assert.equal(h.requests[0].query,'A Biltmore Christmas');
 assert.equal(c.movieFilters.yearMin,2025);assert.equal(c.movieFilters.season,'Fall');
 assert.equal(h.requests[0].lookup_exact,true);
});
test('exact title matches survive filters, hidden flags and existing-movie exclusion',async()=>{
 const h=setup(),c=h.context;c.searchText='Falling Together';c.movieFilters={mode:'mutual',season:'Winter',holiday:'Christmas',yearMin:2025,minScore:100};
 h.respond(async()=>({data:{results:[{tmdb_id:123,title:'Falling Together',year:2024,source_type:'tmdb_exact_title',exact_title_match:true},{tmdb_id:99,title:'Unrelated',source_type:'tmdb_exact_title',exact_title_match:true}]}}));
 c.discoveryHidden=new Set([123]);c.discoveryExistingIds=()=>new Set(['movie:123']);
 await c.runRomantiverseSearch(c.searchText);assert.equal(c.state.romantiverseSearchResults.length,1);assert.equal(c.romantiverseSearchVisibleResults()[0].title,'Falling Together');
 c.state.movies=[{id:'saved',title:'Falling Together',premiere_date:'2024-09-21',status:'recorded'}];
 assert.equal(c.romantiverseSearchVisibleResults().length,1);assert.equal(c.romantiverseSavedResult(c.state.romantiverseSearchResults[0]).id,'saved');
});
test('saved exact title is shown even when the external catalog returns nothing',async()=>{
 const h=setup(),c=h.context;c.searchText='Falling Together';c.state.movies=[{id:'saved',title:'Falling Together'}];h.respond(async()=>({data:{results:[]}}));
 await c.runRomantiverseSearch(c.searchText);assert.equal(c.romantiverseSearchVisibleResults()[0].id,'saved');
});
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
 const h=setup(),c=h.context;c.setSeasonFilter('Fall');await h.flush();assert.ok(h.requests.some(r=>r.query==='autumn'));
 c.setHolidayFilter('Christmas');await h.flush();assert.ok(h.requests.some(r=>r.query==='christmas'));
 c.searchText='A Specific Movie';assert.equal(c.romantiverseFilterQuery(),'A Specific Movie','Do not replace an exact title with a seasonal query');
});
test('a slow old request cannot overwrite a more recent catalog query',async()=>{
 const h=setup(),c=h.context;let finish;
 h.respond(query=>query==='winter'?new Promise(resolve=>{finish=()=>resolve({data:{results:[{tmdb_id:1,title:'winter',source_type:'bingo_catalog'}]}})}):Promise.resolve({data:{results:[{tmdb_id:2,title:query,source_type:'bingo_catalog'}]}}));
 const pending=c.runRomantiverseSearch('winter');await c.runRomantiverseSearch('autumn');finish();await pending;
 assert.equal(c.state.romantiverseSearchResults[0].title,'autumn');
});
