import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
function setup(storage=new Map()){
 let now=0,html='',deny=false;const status={textContent:''};
 const c={crypto:webcrypto,Date:class extends Date {static now(){return now;}},setTimeout:()=>0,confirm:()=>true,console,window:null,
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(deny)throw Error('quota');storage.set(k,v);}},document:{getElementById:()=>status,querySelector:()=>null},};c.window=c;vm.createContext(c);
 for(const f of ['episode-format.js','timeline-core.js','automatic-timeline.js'])vm.runInContext(readFileSync(new URL('../'+f,import.meta.url),'utf8'),c);
 const context={movie:{id:'m',title:'Movie',summary:'Opening'},workspace:'w',legacy:[],notes:'',redraw(){}};
 const render=()=>html=c.clAutomaticTimeline.html(context);render();const key='cheeseLouise:timeline:v1:w:m';
 return {c,a:c.clAutomaticTimeline,storage,context,render,status,data:()=>JSON.parse(storage.get(key)),advance:ms=>now+=ms,deny:()=>deny=true};
}
test('100 keystrokes save immediately as one action; deletion remains undoable after reload',()=>{
 const h=setup();h.a.add();const removed=h.data().doc.selected;h.a.remove();
 const before=h.data().history.length;
 for(let i=1;i<=120;i++){h.a.edit('nick_notes','x'.repeat(i));assert.equal(h.data().doc.scenes[0].nick_notes.length,i);}
 assert.equal(h.data().history.length,before+1);
 const reloaded=setup(h.storage);reloaded.a.undo();assert.equal(reloaded.data().doc.scenes[0].nick_notes,'');reloaded.a.undo();assert.ok(reloaded.data().doc.scenes.some(s=>s.scene_id===removed));
});
test('field switch, blur, idle boundary and scene switch separate text transactions',()=>{
 const h=setup();h.a.edit('nick_notes','Nick');h.a.edit('jenny_notes','Jenny');h.a.endEdit();h.a.edit('jenny_notes','Jenny again');h.advance(1600);h.a.edit('jenny_notes','Later');
 assert.equal(h.data().history.length,4);h.a.undo();assert.equal(h.data().doc.scenes[0].jenny_notes,'Jenny again');h.a.undo();assert.equal(h.data().doc.scenes[0].jenny_notes,'Jenny');h.a.undo();assert.equal(h.data().doc.scenes[0].jenny_notes,'');assert.equal(h.data().doc.scenes[0].nick_notes,'Nick');
});
test('grouped conflicting input does not overwrite another tab deletion or notes',()=>{
 const h=setup(),other=setup(h.storage);other.a.edit('jenny_notes','Other tab');h.a.edit('nick_notes','Stale draft');h.a.edit('nick_notes','Stale draft continued');assert.match(h.status.textContent,/Another tab/);assert.equal(h.data().doc.scenes[0].jenny_notes,'Other tab');assert.equal(h.a.snapshot().scenes[0].nick_notes,'Stale draft continued');
});
test('legacy committed and unsaved drafts import once with original source backup and stable IDs',()=>{
 const h=setup();h.context.legacy=[{time:'12:30',text:'Meeting'}];h.context.legacyDraft='12:30 — Meeting\nUnfinished observation';h.render();
 const before=h.data();assert.equal(before.doc.scenes.filter(s=>s.summary==='Meeting').length,1);assert.ok(before.doc.scenes.some(s=>s.summary==='Unfinished observation'));assert.match(before.doc.sources.at(-1).text,/Unfinished observation/);
 h.render();assert.deepEqual(h.data(),before);const reloaded=setup(h.storage);assert.deepEqual(reloaded.data(),before);
});
test('two independent devices remain explicitly local, and cannot claim cloud synchronization',()=>{
 const laptop=setup(),phone=setup();laptop.a.edit('nick_notes','Laptop');assert.equal(phone.data().doc.scenes[0].nick_notes,'');assert.match(phone.render(),/cloud sync is unavailable/);
});
test('shared format preserves legacy numeric labels and approved section IDs, targets and optional mini-game',()=>{
 const h=setup(),f=h.c.clEpisodeFormat;assert.equal(f.forSession({segment:3})[3].name,'Horror-fied');assert.equal(f.forSession({segment:4})[4].seconds,420);
 const modern=f.forSession({formatVersion:2});assert.equal(modern[0].id,'cold_open');assert.equal(modern[0].seconds,20);assert.equal(modern[5].id,'bingo_reveal');assert.equal(modern[5].seconds,300);assert.ok(!modern.some(s=>s.id==='horrorfied'));assert.equal(f.forSession({formatVersion:2,includeHorrorfied:true})[5].id,'horrorfied');
});

test('recovery import validates movie identity, retains sources, persists and can be undone',async()=>{
 const h=setup();h.a.edit('nick_notes','Current note');const incoming=h.data();incoming.doc.scenes[0].nick_notes='Recovered note';
 const input={files:[{size:100,text:async()=>JSON.stringify(incoming)}],value:'file'};await h.a.restoreFile(input);assert.equal(input.value,'');assert.equal(h.data().doc.scenes[0].nick_notes,'Recovered note');h.a.undo();assert.equal(h.data().doc.scenes[0].nick_notes,'Current note');
 incoming.doc.movie_id='other';for(const s of incoming.doc.scenes)s.movie_id='other';await h.a.restoreFile({files:[{size:100,text:async()=>JSON.stringify(incoming)}],value:'file'});assert.match(h.status.textContent,/another movie/);assert.equal(h.data().doc.scenes[0].nick_notes,'Current note');
});

test('damaged stored timeline offers raw backup and accepts a validated recovery without losing its content',async()=>{
 const source=setup();source.a.edit('jenny_notes','Recovered Jenny note');const recovery=source.data();
 const broken=new Map([['cheeseLouise:timeline:v1:w:m','{damaged']]);const h=setup(broken);assert.match(h.render(),/Download original stored data/);
 h.c.Blob=class{};h.c.URL={createObjectURL:()=> 'blob:test',revokeObjectURL(){}};h.c.document.createElement=()=>({click(){}});
 await h.a.restoreFile({files:[{size:100,text:async()=>JSON.stringify(recovery)}],value:'file'});assert.equal(h.data().doc.scenes[0].jenny_notes,'Recovered Jenny note');assert.match(h.render(),/Recovered Jenny note/);
});
