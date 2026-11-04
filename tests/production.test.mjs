import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const recording=readFileSync(new URL('../recording-hub.js',import.meta.url),'utf8');
const watching=readFileSync(new URL('../watch-along.js',import.meta.url),'utf8');

test('missing scene module shows recovery instead of a competing legacy timeline',()=>{
 const initial={'cheeseLouise:production:v1:workspace-test':JSON.stringify({movieId:'a',timelines:{a:{items:[{text:'Original beat'}]}},timelineDrafts:{a:'Unfinished draft'}})};
 const h=harness(recording,initial);h.context.render();assert.match(h.html(),/Timeline unavailable/);assert.doesNotMatch(h.html(),/Manual talk order/);assert.equal(h.storage.get('cheeseLouise:production:v1:workspace-test'),initial['cheeseLouise:production:v1:workspace-test']);
});

function harness(source,initial={}){
 const storage=new Map(Object.entries(initial));let now=100000,html='',blocked=false;const alerts=[];
 const elements=new Map([['clp-marker-note',{value:'Keep this moment',getAttribute:()=> 'a'}],['clp-marker-type',{value:'Funny / Clip'}],['watchTraitBody',{innerHTML:''}]]);
 const context={window:null,workspace:{id:'workspace-test'},session:{user:{id:'test'}},state:{movies:[{id:'a',title:'Movie A',selectedTraitIds:['t1'],source_metadata:'{"director":"Director A"}'},{id:'b',title:'Movie B',selectedTraitIds:[]}],traits:[{id:'t1',name:'Old flame',points:5,category:'Romance',is_active:true}]},selectedMovie:null,currentTab:'recording',
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(blocked)throw Error('Storage full');storage.set(k,v)},removeItem:k=>storage.delete(k)},
 document:{getElementById:id=>elements.get(id)||null,querySelector:()=>null,querySelectorAll:()=>[]},
 Date:class extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}},
 setInterval:()=>0,setTimeout:()=>0,clearTimeout(){},confirm:()=>true,alert:s=>alerts.push(s),prompt:()=>null,
 tabs:()=>'<nav></nav>',render:()=>{},shell:s=>{html=s;elements.get('clp-marker-note').value='';elements.get('clp-marker-type').value='Funny / Clip'},topbar:()=>'',modal:()=>'',authScreen(){},onboardingScreen(){},
 esc:s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
 navigator:{clipboard:{writeText:async s=>{context.copied=s}}}};
 context.window=context;vm.createContext(context);vm.runInContext(readFileSync(new URL('../episode-format.js',import.meta.url),'utf8'),context);vm.runInContext(source,context);
 return {context,storage,elements,alerts,advance:ms=>{now+=ms},html:()=>html,block:()=>{blocked=true},data:()=>JSON.parse(storage.get('cheeseLouise:production:v1:workspace-test')||'{}')};
}
test('recording sessions and editing markers survive switching episodes and a reload',()=>{
 const h=harness(recording),p=h.context.clProduction;p.start();h.advance(30000);p.mark();p.movie('b');
 assert.equal(h.data().sessions.a.markers.length,1);assert.equal(h.data().sessions.a.runningSince,null);
 p.start();h.advance(15000);p.mark();p.movie('a');p.copyEdit();
 assert.equal(h.data().sessions.a.markers[0].atMs,30000);assert.equal(h.data().sessions.b.markers[0].atMs,15000);
 const reloaded=harness(recording,Object.fromEntries(h.storage));reloaded.context.clProduction.movie('b');
 assert.equal(reloaded.data().sessions.a.markers.length,1);assert.equal(reloaded.data().sessions.b.markers.length,1);
});
test('legacy single-session data is preserved when another episode is selected',()=>{
 const legacy={movieId:'a',session:{movieId:'a',title:'Movie A',snapshot:{},segment:0,laps:[],markers:[{atMs:4000,type:'Retake',note:'Legacy marker'}],elapsedMs:5000,runningSince:null,finished:false}};
 const h=harness(recording,{'cheeseLouise:production:v1:workspace-test':JSON.stringify(legacy)});h.context.clProduction.movie('b');
 assert.equal(h.data().sessions.a.markers[0].note,'Legacy marker');
});
test('a completed final segment can reopen and finish without duplicate laps',()=>{
 const h=harness(recording),p=h.context.clProduction;p.start();for(let i=0;i<7;i++){h.advance(10000);p.next()}
 assert.equal(h.data().session.finished,true);p.previous();assert.equal(h.data().session.finished,false);assert.equal(h.data().session.segment,6);assert.equal(h.data().session.laps.length,6);
 p.start();h.advance(5000);p.next();assert.equal(h.data().session.laps.length,7);assert.equal(h.data().session.elapsedMs,75000);
});
test('next cannot create a zero-time lap before the timer starts',()=>{
 const h=harness(recording);h.context.clProduction.next();assert.equal(h.data().session.laps.length,0);assert.equal(h.data().session.segment,0);
});
test('storage failure keeps the working session exportable and warns the producer',async()=>{
 const h=harness(recording);h.block();h.context.clProduction.start();h.advance(12000);h.context.clProduction.mark();h.context.clProduction.copyEdit();await Promise.resolve();
 assert.equal(h.alerts.filter(s=>s.includes('could not save')).length,1);assert.match(h.context.copied,/00:00:12 Funny \/ Clip/);
});
test('checked-trait view survives redraw and string-encoded movie credits are included',()=>{
 const h=harness(watching);h.context.currentTab='watchalong';h.context.watchAlongShowSelected();h.context.render();
 assert.ok(h.html().includes('Talk order'));assert.ok(!h.html().includes('No Cheese Traits match that search.'));assert.ok(h.html().includes('Director: Director A'));
});

test('an edited rundown persists separately from Watch Notes and can be rebuilt deliberately',()=>{
 const h=harness(watching);h.context.currentTab='watchalong';
 h.context.watchAlongSaveRundown('Custom opening\nCustom closing');
 assert.equal(JSON.parse(h.storage.get('cheeseLouise:watchAlong:workspace-test:draft:a')).rundownText,'Custom opening\nCustom closing');
 h.context.watchAlongGenerateRundown();
 const saved=JSON.parse(h.storage.get('cheeseLouise:watchAlong:workspace-test:draft:a'));
 assert.match(saved.rundownText,/CHEESE LOUISE — RECORDING RUNDOWN/);
 assert.ok(!saved.rundownText.includes('Custom opening'));
});

test('live recording redraw keeps an unfinished marker note and its category',()=>{
 const h=harness(recording);h.elements.get('clp-marker-note').value='Do not lose this pickup';h.elements.get('clp-marker-type').value='Retake';h.context.render();assert.equal(h.elements.get('clp-marker-note').value,'Do not lose this pickup');assert.equal(h.elements.get('clp-marker-type').value,'Retake');
});
test('recording uses Watch Along talk order and separates observations into labeled cue cards',()=>{
 const draft={traitIds:['t1'],outlineItems:[{id:'note1',type:'note',text:'Lead with the coffee joke.'},{id:'trait1',type:'trait',traitId:'t1'},{id:'note2',type:'note',text:'Return to the opening callback.'}],notes:'First observation.\nSecond observation.'};
 const h=harness(recording,{'cheeseLouise:watchAlong:workspace-test:draft:a':JSON.stringify(draft)});h.context.render();
 const html=h.html();assert.ok(html.indexOf('Lead with the coffee joke.')<html.indexOf('Old flame'));assert.ok(html.indexOf('Old flame')<html.indexOf('Return to the opening callback.'));
 assert.equal((html.match(/class="clp-cue clp-cue-observation"/g)||[]).length,2);
 assert.ok(html.includes('clp-cue-trait'));assert.ok(html.includes('clp-cue-note'));assert.ok(html.includes('clp-compact-timer'));
});
test('long note chunks keep every sentence and escape markup without changing recording timing',()=>{
 const sentences=Array.from({length:12},(_,i)=>'Observation '+i+': the long callback belongs in our discussion.');
 const draft={notes:sentences.join(' ')+' <script>unsafe</script>'};
 const h=harness(recording,{'cheeseLouise:watchAlong:workspace-test:draft:a':JSON.stringify(draft)});h.context.clProduction.start();h.advance(5000);h.context.render();
 const html=h.html();for(const sentence of sentences)assert.ok(html.includes(sentence));assert.ok(!html.includes('<script>unsafe</script>'));assert.ok(html.includes('&lt;script&gt;unsafe&lt;/script&gt;'));
 assert.ok((html.match(/class="clp-cue clp-cue-observation"/g)||[]).length>1);
 assert.equal(h.data().session.runningSince,100000);assert.equal(h.data().session.laps.length,0);
});
test('older recording snapshots retain their notes and talking points in the new reading layout',()=>{
 const legacy={movieId:'a',session:{movieId:'a',title:'Movie A',snapshot:{talkingPoints:['Keep this old talking point'],notes:'Keep this old note'},segment:2,laps:[],markers:[],elapsedMs:9000,runningSince:null,finished:false}};
 const h=harness(recording,{'cheeseLouise:production:v1:workspace-test':JSON.stringify(legacy)});h.context.render();
 assert.ok(h.html().includes('Keep this old talking point'));assert.ok(h.html().includes('Keep this old note'));assert.equal(h.data().session.elapsedMs,9000);
});
test('a stale recording snapshot cannot hide the latest Watch Along notes',()=>{
 const saved={movieId:'a',session:{movieId:'a',title:'Movie A',snapshot:{notes:'Earlier saved observation'},segment:1,laps:[],markers:[{note:'Keep marker'}],elapsedMs:9000,runningSince:null,finished:false}};
 const initial={'cheeseLouise:production:v1:workspace-test':JSON.stringify(saved),'cheeseLouise:watchAlong:workspace-test:draft:a':JSON.stringify({notes:'Latest Watch Along observation',outlineItems:[{type:'note',text:'Latest talk order'}]})};
 const h=harness(recording,initial);h.context.render();
 assert.ok(h.html().includes('Latest Watch Along observation'));assert.ok(h.html().includes('Latest talk order'));assert.ok(h.html().includes('Earlier saved observation'));
 assert.equal(h.storage.get('cheeseLouise:production:v1:workspace-test'),initial['cheeseLouise:production:v1:workspace-test'],'Reading notes does not rewrite the saved session');
});
test('recording initially follows the Watch Along movie rather than the first saved movie',()=>{
 const h=harness(recording,{'cheeseLouise:watchAlong:workspace-test:movie':'b','cheeseLouise:watchAlong:workspace-test:draft:b':JSON.stringify({notes:'Movie B observation'})});h.context.render();
 assert.ok(h.html().includes('Movie B observation'));assert.ok(h.html().includes('<option value="b" selected>Movie B'));
});
test('Watch Along handoff preserves previous sessions and never switches a running timer',()=>{
 const saved={movieId:'a',session:{movieId:'a',title:'Movie A',snapshot:{notes:'Movie A note'},segment:1,laps:[],markers:[],elapsedMs:9000,runningSince:null,finished:false}};
 const h=harness(recording,{'cheeseLouise:production:v1:workspace-test':JSON.stringify(saved),'cheeseLouise:watchAlong:workspace-test:movie':'b'});
 h.context.clProduction.followWatchMovie();assert.equal(h.data().movieId,'b');assert.equal(h.data().session.elapsedMs,9000);
 saved.session.runningSince=100000;const running=harness(recording,{'cheeseLouise:production:v1:workspace-test':JSON.stringify(saved),'cheeseLouise:watchAlong:workspace-test:movie':'b'});
 running.context.clProduction.followWatchMovie();assert.equal(running.data().movieId,'a');assert.equal(running.data().session.runningSince,100000);
});


test('marker revisions and deletion undo retain original recording time across reload',()=>{
 const h=harness(recording),p=h.context.clProduction;p.start();h.advance(12345);p.mark();h.context.prompt=()=> 'Revised pickup';p.editMarker(0);const at=h.data().session.markers[0].atMs;
 p.deleteMarker(0);assert.equal(h.data().session.markers.length,0);const r=harness(recording,Object.fromEntries(h.storage));r.context.clProduction.undoMarker();assert.equal(r.data().session.markers[0].atMs,at);assert.equal(r.data().session.markers[0].note,'Revised pickup');
});
test('new sessions use stable section IDs, reload keeps current cue and old sessions keep Horror-fied',()=>{
 const h=harness(recording),p=h.context.clProduction;p.start();h.advance(20000);p.next();assert.equal(h.data().session.segmentId,'theme');assert.equal(h.data().session.laps[0].segmentId,'cold_open');
 const r=harness(recording,Object.fromEntries(h.storage));r.context.render();assert.match(r.html(),/Theme music/);assert.equal(r.data().session.runningSince,100000);
 const legacy={movieId:'a',session:{movieId:'a',title:'Movie A',snapshot:{},segment:3,laps:[{name:'Original opening',startMs:0,durationMs:500}],markers:[],elapsedMs:5000,runningSince:null,finished:false}};
 const old=harness(recording,{'cheeseLouise:production:v1:workspace-test':JSON.stringify(legacy)});old.context.render();assert.match(old.html(),/Horror-fied/);old.context.clProduction.start();old.advance(1000);old.context.clProduction.next();assert.equal(old.data().session.laps[1].name,'Horror-fied');assert.equal(old.data().session.laps[0].name,'Original opening');
});
test('rundown includes episode cocktail and all approved cues; explicit rebuild is reversible after reload',()=>{
 const h=harness(watching);h.context.state.episodes=[{movie_id:'a',cocktail_id:'drink'}];h.context.state.cocktails=[{id:'drink',name:'Orchard spritz',ingredients:'Apple juice and soda',method:'Stir over ice'}];
 const text=h.context.clEpisodeRundown.text(h.context.state.movies[0]);assert.match(text,/Orchard spritz/);assert.match(text,/Apple juice and soda/);assert.match(text,/Cold open · 0:20/);assert.match(text,/Cheese Grating & Bingo results · 5:00/);assert.ok(!text.includes('Horror-fied'));
 h.context.watchAlongSaveRundown('Our edited script');h.context.watchAlongGenerateRundown();const r=harness(watching,Object.fromEntries(h.storage));r.context.watchAlongUndoRundown();assert.equal(r.context.clEpisodeRundown.text(r.context.state.movies[0]),'Our edited script');
});

test('automatic Watch notes refresh never prompts or overwrites an edited or intentionally empty rundown',()=>{
 const h=harness(watching);h.context.watchAlongSaveRundown('Our script');h.context.confirm=()=>{throw Error('Unexpected confirmation while typing');};h.context.watchAlongSaveText('notes','A new observation');assert.equal(h.context.clEpisodeRundown.text(h.context.state.movies[0]),'Our script');h.context.watchAlongSaveRundown('');h.context.watchAlongSaveText('notes','Another observation');assert.equal(h.context.clEpisodeRundown.text(h.context.state.movies[0]),'');
});
test('same-field rundown tab conflict preserves both versions and quota failure retains local draft',()=>{
 const h=harness(watching);const movie=h.context.state.movies[0];h.context.watchAlongSaveRundown('Initial');h.context.clEpisodeRundown.text(movie);
 const other=harness(watching);other.context.localStorage=h.context.localStorage;other.context.clEpisodeRundown.text(other.context.state.movies[0]);other.context.watchAlongSaveRundown('Other tab version');h.context.watchAlongSaveRundown('My conflicted draft');assert.equal(JSON.parse(h.storage.get('cheeseLouise:watchAlong:workspace-test:draft:a')).rundownText,'Other tab version');assert.equal(h.context.clEpisodeRundown.text(movie),'My conflicted draft');
 const quota=harness(watching);quota.block();quota.context.watchAlongSaveRundown('Unsaved but recoverable');assert.equal(quota.context.clEpisodeRundown.text(quota.context.state.movies[0]),'Unsaved but recoverable');
});
