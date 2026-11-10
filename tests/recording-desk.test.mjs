import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../recording-desk.js',import.meta.url),'utf8');
function harness(){
 const storage=new Map(),draft={movieId:'movie',notes:'Shared observation',hostNotes:{nick:[{id:'n',text:'Nick private note'}],jenny:[{id:'j',text:'Jenny private note'}]}},scene={nick:'Nick scene note',jenny:'Jenny scene note'};let time=1000,blocked=false,draws=0;
 const c={window:null,workspace:{id:'w'},profile:{display_name:'Nick'},crypto:{randomUUID:()=> 'new'},Date:class extends Date{static now(){return time}},setInterval(){},confirm:()=>true,
 document:{getElementById:()=>null,addEventListener(){},documentElement:{classList:{contains:()=>false,toggle(){},remove(){}}}},
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(blocked)throw Error('quota');storage.set(k,v)}},
 clWatchDrafts:{get:()=>JSON.parse(JSON.stringify(draft)),save:value=>{if(blocked)throw Error('quota');Object.assign(draft,JSON.parse(JSON.stringify(value)))}},
 clAutomaticTimeline:{recordingNotes:(ctx,host)=>[{id:'s',title:'Existing scene',text:scene[host]}],recordingEdit:(ctx,id,host,text)=>{scene[host]=text;return true}},
 clRecordingBingo:{html:(movie,{host})=>'<div>'+host+' card</div>'}};
 c.window=c;vm.createContext(c);vm.runInContext(script,c);const ctx={movie:{id:'movie',title:'Test movie',selectedTraitIds:['t']},movies:[{id:'movie',title:'Test movie'}],workspace:'w',traits:[{id:'t',name:'Old flame',points:9}],redraw(){draws++}};
 return {c,storage,draft,scene,ctx,html:()=>c.clRecordingDesk.html(ctx),advance:n=>time+=n,block:()=>blocked=true,draws:()=>draws};
}
test('desk shows only the active host’s own notes plus explicitly shared material',()=>{
 const h=harness(),p=h.c.clRecordingDesk;let html=h.html();assert.match(html,/Nick private note/);assert.match(html,/Nick scene note/);assert.doesNotMatch(html,/Jenny private note|Jenny scene note/);assert.match(html,/Shared observation/);assert.match(html,/Old flame/);assert.match(html,/>9<small>points/);
 p.switchHost('jenny');html=h.html();assert.match(html,/Jenny private note/);assert.doesNotMatch(html,/Nick private note|Nick scene note/);assert.match(html,/jenny card/);
});
test('personal and scene edits preserve other host’s notes and shared notes',()=>{
 const h=harness();h.html();const p=h.c.clRecordingDesk;p.edit('personal','n','Revised Nick');p.edit('scene','s','Revised scene');
 assert.equal(h.draft.hostNotes.nick[0].text,'Revised Nick');assert.equal(h.draft.hostNotes.jenny[0].text,'Jenny private note');assert.equal(h.scene.jenny,'Jenny scene note');assert.equal(h.draft.notes,'Shared observation');
});
test('timer and Done remain independent per host; timer reset retains notes and completion',()=>{
 const h=harness(),p=h.c.clRecordingDesk;h.html();p.done('personal:n',true);p.timer('start');h.advance(65000);p.timer('pause');assert.match(h.html(),/00:01:05/);assert.match(h.html(),/cldesk-note is-done/);
 p.switchHost('jenny');assert.match(h.html(),/00:00:00/);assert.doesNotMatch(h.html(),/cldesk-note is-done/);
 p.switchHost('nick');p.timer('reset');assert.match(h.html(),/00:00:00/);assert.match(h.html(),/cldesk-note is-done/);assert.equal(h.draft.hostNotes.nick[0].text,'Nick private note');
});
test('storage failure keeps edited personal text in memory with explicit warning',()=>{
 const h=harness();h.html();h.block();h.c.clRecordingDesk.edit('personal','n','Do not lose this edit');const html=h.html();assert.match(html,/Do not lose this edit/);assert.match(html,/could not be saved/);assert.equal(h.draft.hostNotes.nick[0].text,'Nick private note');
});
