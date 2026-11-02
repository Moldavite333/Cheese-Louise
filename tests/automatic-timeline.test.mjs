import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
const core=readFileSync(new URL('../timeline-core.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('../automatic-timeline.js',import.meta.url),'utf8');
function harness(storage=new Map()){
 let blocked=false;const status={textContent:''};
 const ctx={crypto:webcrypto,Date,console,setTimeout,Blob,URL,localStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){if(blocked)throw Error('quota');storage.set(k,v);}},document:{getElementById:()=>status},navigator:{clipboard:{writeText:async()=>{}}}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(core,ctx);vm.runInContext(ui,ctx);
 const C=ctx.clTimelineCore,A=ctx.clAutomaticTimeline;
 const context={movie:{id:'m1',title:'Same title',year:2023,summary:'A shop owner returns home.'},workspace:'w1',notes:'Keep original note',legacy:[],confirmed:[],redraw(){}};
 const html=()=>A.html(context);html();
 const data=()=>JSON.parse(storage.get('cheeseLouise:timeline:v1:w1:m1')).doc;
 return {C,A,ctx,storage,status,context,html,data,block:()=>blocked=true};
}
const srt='1\n00:00:01,250 --> 00:00:04,500\n<v Jenny>Hello</v>\n\n2\n00:04:05,000 --> 00:04:06,000\n[Door closes]';
test('caption timing, explicit speakers, sound cues and offsets survive parsing',()=>{
 const {C}=harness(),cues=C.captions(srt,500);assert.equal(cues[0].start,1750);assert.equal(cues[0].speaker,'Jenny');assert.equal(cues[1].text,'[Door closes]');
 const vtt=C.captions('WEBVTT\n\nNOTE permitted\nannotation\n\na\n00:01.000 --> 00:02.000 align:start\nHello');assert.equal(vtt[0].start,1000);
});
test('malformed, empty, reversed and negative caption times fail atomically',()=>{
 const {C}=harness();for(const value of ['hello','WEBVTT','1\n00:62:01,000 --> 00:63:02,000\nHi','1\n00:02.000 --> 00:01.000\nHi','1\n00:01.000 --> 00:02.000'])assert.throws(()=>C.captions(value));assert.throws(()=>C.captions(srt,-2000));
});
test('synopsis remains an untimed outline and identity stays tied to saved movie',()=>{
 const {C}=harness(),d=C.create({id:'m2',title:'Same title',year:1999},'A couple meets. They marry.');assert.equal(d.mode,'Plot outline');assert.equal(d.identity.year,1999);assert.equal(d.scenes.length,1);assert.equal(d.scenes[0].start_time_ms,null);assert.equal(d.scenes[0].timestamp_status,'Unknown');assert.equal(d.scenes[0].evidence_status,'Source-supported');C.validate(d);
});
test('caption imports preserve manual edits and notes, deduplicate and do not infer scene gaps',()=>{
 const {C}=harness(),d=C.create({id:'m'},'Setup','Original note');d.scenes[0].summary='Manual correction';const next=C.ingest(d,'authorized.srt',srt);assert.equal(next.scenes.length,4);assert.equal(next.scenes.find(s=>s.shared_notes).shared_notes,'Original note');assert.ok(next.scenes.some(s=>s.summary==='Manual correction'));assert.equal(C.ingest(next,'again.srt',srt).scenes.length,4);assert.equal(next.mode,'Caption navigation draft');assert.equal(d.scenes.length,2);C.validate(next);
});
test('schema rejects unsupported exact times, broken references and duplicate scene identity',()=>{
 const {C}=harness(),d=C.create({id:'m'},'A setup');d.scenes[0].start_time_ms=1000;d.scenes[0].timestamp_status='Exact caption time';assert.throws(()=>C.validate(d));d.scenes[0].timestamp_status='Approximate';C.validate(d);d.scenes.push(C.clone(d.scenes[0]));assert.throws(()=>C.validate(d));
});
test('edits autosave, escape HTML, reload, bookmark and survive moves and duplicate',()=>{
 const h=harness();h.A.edit('summary','<script>bad</script>');h.A.edit('nick_notes','Keep Nick');h.A.bookmark();const id=h.data().selected;h.A.duplicate();h.A.move(-1);h.A.pickup();assert.equal(h.data().selected,id);assert.match(h.html(),/&lt;script&gt;bad/);assert.doesNotMatch(h.html(),/<script>bad/);assert.equal(harness(h.storage).data().scenes.find(s=>s.scene_id===id).nick_notes,'Keep Nick');
});
test('merge and split retain source and manual notes; destructive changes have recovery',()=>{
 const h=harness();h.A.edit('nick_notes','Do not lose');h.A.merge();assert.equal(h.data().scenes.length,1);assert.equal(h.data().scenes[0].nick_notes,'Do not lose');assert.match(h.data().scenes[0].shared_notes,/Keep original note/);h.A.split();assert.equal(h.data().scenes.length,2);assert.equal(h.data().scenes[0].nick_notes,'Do not lose');h.A.remove();assert.equal(h.data().scenes.length,1);h.A.undo();assert.equal(h.data().scenes.length,2);
});
test('quota failure exposes unsaved state and preserves typed material for recovery',()=>{
 const h=harness();h.A.edit('nick_notes','Saved');h.block();h.A.edit('nick_notes','Pending text');assert.match(h.status.textContent,/Unsaved/);assert.match(h.html(),/Pending text/);assert.equal(h.data().scenes[0].nick_notes,'Saved');
});
test('concurrent tab edits are rejected without replacing newer disk material',()=>{
 const h=harness();h.A.edit('nick_notes','Initial');const other=harness(h.storage);other.A.edit('nick_notes','Other tab');h.A.edit('nick_notes','Stale write');assert.match(h.status.textContent,/Another tab/);assert.equal(h.data().scenes[0].nick_notes,'Other tab');
});
test('Jenny export includes evidence and confirmed movie tropes without Bingo claims',()=>{
 const {C}=harness(),d=C.create({id:'m'},'Opening','Shared note');d.scenes[0].jenny_notes='Jenny callback';const text=C.exportText(d,'Movie',['Hometown return']);assert.match(text,/Jenny callback/);assert.match(text,/Unknown/);assert.match(text,/Hometown return/);assert.match(text,/not Bingo results/);assert.match(text,/Additional notes/);
});
test('workspace and movie keys isolate drafts',()=>{
 const h=harness();h.A.edit('nick_notes','Private to original');h.context.workspace='w2';h.html();h.A.edit('nick_notes','Other workspace');assert.equal(h.data().scenes[0].nick_notes,'Private to original');
});
