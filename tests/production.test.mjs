import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const recording=readFileSync(new URL('../recording-hub.js',import.meta.url),'utf8');
const reaper=readFileSync(new URL('../reaper-marker-export.js',import.meta.url),'utf8');
const watching=readFileSync(new URL('../watch-along.js',import.meta.url),'utf8');

test('movie timeline shows now and next, persists progress, and stays separate from recording time',()=>{
 const h=harness(recording),p=h.context.clProduction;
 p.timelineDraft('00:05 - Opening\n12:30 - Meeting\n1:02:00 - Reveal');p.timelineSave();p.start();h.advance(15000);
 p.timelineMove(1);h.context.render();
 assert.equal(h.data().timelines.a.items[1].time,'12:30');assert.equal(h.data().timelines.a.items[1].text,'Meeting');
 assert.match(h.html(),/Now<\/span><p><time>12:30<\/time> Meeting/);assert.match(h.html(),/Next<\/span><p><time>1:02:00<\/time> Reveal/);
 assert.equal(h.data().session.runningSince,100000);assert.equal(h.data().session.laps.length,0);p.mark();assert.equal(h.data().session.markers[0].atMs,15000);
 const reloaded=harness(recording,Object.fromEntries(h.storage));reloaded.context.render();assert.match(reloaded.html(),/12:30<\/time> Meeting/);
 p.timelineMove(99);assert.equal(h.data().timelines.a.index,3);p.timelineMove(-99);assert.equal(h.data().timelines.a.index,0);
});

test('timeline edits preserve current beat and isolate movies and unsaved drafts',()=>{
 const h=harness(recording),p=h.context.clProduction;p.timelineDraft('Opening\nMeeting');p.timelineSave();p.timelineMove(1);
 p.timelineDraft('New scene\nOpening\nMeeting');p.timelineSave();assert.equal(h.data().timelines.a.index,2);
 p.movie('b');p.timelineDraft('Other movie');p.timelineSave();assert.equal(h.data().timelines.b.items.length,1);
 p.movie('a');assert.equal(h.data().timelines.a.index,2);p.timelineDraft('<script>draft</script>');
 const r=harness(recording,Object.fromEntries(h.storage));r.context.clProduction.timelineEdit();r.context.render();
 assert.ok(r.html().includes('&lt;script&gt;draft&lt;/script&gt;'));assert.ok(!r.html().includes('<script>draft</script>'));assert.equal(r.data().timelines.a.items.length,3);
});

test('Watch Along import produces an editable timeline draft and preserves existing movie times',()=>{
 const draft={outlineItems:[{id:'n1',type:'note',text:'Opening'},{id:'n2',type:'note',text:'Meeting'}],notes:'Meeting\nFinal reveal'};
 const h=harness(recording,{'cheeseLouise:watchAlong:workspace-test:draft:a':JSON.stringify(draft)}),p=h.context.clProduction;
 p.timelineDraft('00:05 - Opening');p.timelineSave();p.timelineImport();p.timelineImport();
 assert.equal(h.data().timelines.a.items.length,1);assert.equal(h.data().timelineDrafts.a,'00:05 \u2014 Opening\nMeeting\nFinal reveal');
 p.timelineSave();assert.equal(h.data().timelines.a.items.length,3);assert.equal(h.data().timelines.a.items[0].time,'00:05');
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
 context.window=context;vm.createContext(context);vm.runInContext(source,context);
 return {context,storage,elements,alerts,advance:ms=>{now+=ms},html:()=>html,block:()=>{blocked=true},data:()=>JSON.parse(storage.get('cheeseLouise:production:v1:workspace-test')||'{}')};
}
test('recording sessions and editing markers survive switching episodes and a reload',()=>{
 const h=harness(recording),p=h.context.clProduction;p.start();h.advance(30000);p.mark();p.pause();p.movie('b');
 assert.equal(h.data().sessions.a.markers.length,1);assert.equal(h.data().sessions.a.runningSince,null);
 // The producer must explicitly pause before switching movies during a live take.
 p.start();h.advance(15000);p.mark();p.pause();p.movie('a');p.copyEdit();
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
 const h=harness(recording),p=h.context.clProduction;p.start();for(let i=0;i<6;i++){h.advance(10000);p.next()}
 assert.equal(h.data().session.finished,true);p.previous();assert.equal(h.data().session.finished,false);assert.equal(h.data().session.segment,5);assert.equal(h.data().session.laps.length,5);
 p.start();h.advance(5000);p.next();assert.equal(h.data().session.laps.length,6);assert.equal(h.data().session.elapsedMs,65000);
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

test('starting a new recording archives the old session with elapsed time and markers',()=>{
 const h=harness(recording),p=h.context.clProduction;
 p.start();h.advance(12500);p.mark();p.reset();
 const d=h.data();
 assert.equal(d.session.elapsedMs,0);
 assert.equal(d.session.markers.length,0);
 assert.equal(d.sessionHistory.a.length,1);
 assert.equal(d.sessionHistory.a[0].session.elapsedMs,12500);
 assert.equal(d.sessionHistory.a[0].session.runningSince,null);
 assert.equal(d.sessionHistory.a[0].session.markers[0].note,'Keep this moment');
 p.view('edit');h.context.render();
 assert.match(h.html(),/Past recording sessions \(1\)/);
 assert.match(h.html(),/Restore/);
 const reload=harness(recording,Object.fromEntries(h.storage));
 assert.equal(reload.data().sessionHistory.a[0].session.markers.length,1);
});

test('restoring an archived recording preserves the active session and keeps movies separate',()=>{
 const h=harness(recording),p=h.context.clProduction;
 p.start();h.advance(5000);p.mark();p.reset();
 const first=h.data().sessionHistory.a[0].archiveId;
 p.start();h.advance(8000);p.mark();p.pause();
 p.restoreSession(first);
 const d=h.data();
 assert.equal(d.session.elapsedMs,5000);
 assert.equal(d.session.markers[0].atMs,5000);
 assert.equal(d.sessionHistory.a.length,1);
 assert.equal(d.sessionHistory.a[0].session.elapsedMs,8000);
 p.movie('b');p.reset();
 assert.equal((h.data().sessionHistory.b||[]).length,0);
 p.movie('a');p.copyEdit();assert.equal(h.data().sessions.a.elapsedMs,5000);
});

test('restoring is blocked while recording and storage failure cannot discard a session',()=>{
 const h=harness(recording),p=h.context.clProduction;
 p.start();h.advance(3000);p.mark();p.reset();
 const archive=h.data().sessionHistory.a[0].archiveId;
 p.start();h.advance(2000);
 p.restoreSession(archive);
 assert.equal(h.data().session.runningSince,103000);
 assert.ok(h.alerts.some(a=>a.includes('Pause the recording timer')));
 p.pause();
 const before=JSON.stringify(h.data());
 h.block();p.reset();
 assert.equal(JSON.stringify(h.data()),before);
 assert.ok(h.alerts.some(a=>a.includes('previous recording remains active')));
});

test('editing view exports REAPER marker CSV without changing saved recording data',()=>{
 const h=harness(recording),p=h.context.clProduction;vm.runInContext(reaper,h.context);
 const downloads=[];h.context.Blob=class {constructor(parts,options){this.parts=parts;this.type=options.type}};
 h.context.URL={createObjectURL:blob=>{downloads.push(blob);return 'blob:local'},revokeObjectURL(){}};
 h.context.document.createElement=()=>({click(){}});
 p.start();h.advance(3500);p.mark();p.view('edit');h.context.render();
 assert.match(h.html(),/Download REAPER markers/);const before=JSON.stringify(h.data());
 p.exportReaper();assert.equal(downloads.length,1);
 assert.match(downloads[0].parts[0],/#,Name,Start,End,Length/);
 assert.match(downloads[0].parts[0],/\[Funny \/ Clip\]/);
 assert.equal(JSON.stringify(h.data()),before);
});

test('restored session exports REAPER markers without modifying its archived history',()=>{
 const h=harness(recording),p=h.context.clProduction;vm.runInContext(reaper,h.context);
 const downloads=[];h.context.Blob=class {constructor(parts,options){this.parts=parts;this.type=options.type}};
 h.context.URL={createObjectURL:blob=>{downloads.push(blob);return 'blob:local'},revokeObjectURL(){}};
 h.context.document.createElement=()=>({click(){}});
 p.start();h.advance(4500);p.mark();p.reset();
 const archived=h.data().sessionHistory.a[0].archiveId;
 p.restoreSession(archived);
 const before=JSON.stringify(h.data());
 p.exportReaper();
 assert.equal(downloads.length,1);
 assert.match(downloads[0].parts[0],/Funny \/ Clip/);
 assert.equal(JSON.stringify(h.data()),before);
});


test('switching movies while recording cannot silently pause or redirect the timer',()=>{
 const h=harness(recording),p=h.context.clProduction;
 p.start();h.advance(2000);p.mark();
 const before=h.data(),warningCount=h.alerts.length;
 p.movie('b');
 const blocked=h.data();
 assert.equal(blocked.session.movieId,'a');
 assert.equal(blocked.session.runningSince,before.session.runningSince);
 assert.equal(blocked.session.elapsedMs,0);
 assert.equal(blocked.session.markers.length,1);
 assert.equal(blocked.sessions.b,undefined);
 assert.equal(h.alerts.length,warningCount+1);
 assert.match(h.alerts.at(-1),/Pause the recording timer before switching movies/);
 assert.match(h.html(),/<option value="a" selected>/);
 p.movie('a');
 assert.equal(h.alerts.length,warningCount+1,'Selecting the current movie does not interrupt the take');
 p.pause();p.movie('b');
 const switched=h.data();
 assert.equal(switched.movieId,'b');
 assert.equal(switched.sessions.a.elapsedMs,2000);
 assert.equal(switched.sessions.a.markers[0].atMs,2000);
 assert.equal(switched.sessions.a.runningSince,null);
});
