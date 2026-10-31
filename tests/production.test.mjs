import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const recording=readFileSync(new URL('../recording-hub.js',import.meta.url),'utf8');
const watching=readFileSync(new URL('../watch-along.js',import.meta.url),'utf8');
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
