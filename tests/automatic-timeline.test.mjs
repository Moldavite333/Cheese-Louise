import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
const core=readFileSync(new URL('../timeline-core.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('../automatic-timeline.js',import.meta.url),'utf8');
function harness(storage=new Map()){
 let blocked=false,readsBlocked=false,downloaded;const status={textContent:''};
 const ctx={crypto:webcrypto,Date,console,confirm:()=>true,setTimeout:fn=>fn(),Blob:class{constructor(parts){downloaded=parts.join('');}},URL:{createObjectURL:()=> 'blob:fixture',revokeObjectURL(){}},localStorage:{getItem(k){if(readsBlocked)throw Error('Storage access denied');return storage.get(k)||null;},setItem(k,v){if(blocked)throw Error('quota');storage.set(k,v);}},document:{getElementById:()=>status,createElement:()=>({click(){}})},navigator:{clipboard:{writeText:async()=>{}}}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(readFileSync(new URL('../episode-format.js',import.meta.url),'utf8'),ctx);vm.runInContext(core,ctx);vm.runInContext(ui,ctx);
 const C=ctx.clTimelineCore,A=ctx.clAutomaticTimeline;
 const context={movie:{id:'m1',title:'Same title',year:2023,summary:'A shop owner returns home.'},workspace:'w1',notes:'Keep original note',legacy:[],confirmed:[],redraw(){}};
 const html=()=>A.html(context);html();
 const data=()=>JSON.parse(storage.get('cheeseLouise:timeline:v1:w1:m1')).doc;
 return {C,A,ctx,storage,status,context,html,data,downloaded:()=>JSON.parse(downloaded),block:()=>blocked=true,blockReads:()=>readsBlocked=true};
}
const srt='1\n00:00:01,250 --> 00:00:04,500\n<v Jenny>Hello</v>\n\n2\n00:04:05,000 --> 00:04:06,000\n[Door closes]';
test('each scene card exposes delete; deleting another scene preserves selection and undo restores its notes',()=>{
 const h=harness();h.A.add();h.A.edit('nick_notes','Keep this recoverable note');const added=h.data().selected;h.A.select(0);const selected=h.data().selected;
 assert.match(h.html(),/cl-story-delete/);h.A.remove(added);assert.equal(h.data().selected,selected);assert.ok(!h.data().scenes.some(s=>s.scene_id===added));
 h.A.undo();assert.equal(h.data().scenes.find(s=>s.scene_id===added).nick_notes,'Keep this recoverable note');
 h.ctx.confirm=()=>false;const count=h.data().scenes.length;h.A.remove(added);assert.equal(h.data().scenes.length,count);
});
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
test('a stale-tab conflict keeps the rejected text and subsequent edits available for recovery',()=>{
 const h=harness();h.A.edit('nick_notes','Initial');const other=harness(h.storage);other.A.edit('nick_notes','Other tab');h.A.edit('nick_notes','Recover this rejected edit');assert.match(h.html(),/Recover this rejected edit/);h.A.edit('shared_notes','Also recover this');assert.match(h.html(),/Also recover this/);h.A.backup();assert.equal(h.downloaded().doc.scenes[0].nick_notes,'Recover this rejected edit');assert.equal(h.downloaded().doc.scenes[0].shared_notes,'Also recover this');assert.equal(h.data().scenes[0].nick_notes,'Other tab');assert.notEqual(h.data().scenes[0].shared_notes,'Also recover this');
});
test('storage read denial keeps typed notes in memory without changing the persisted draft',()=>{
 const h=harness();h.A.edit('nick_notes','Saved');h.blockReads();h.A.edit('nick_notes','Pending while storage is denied');assert.match(h.status.textContent,/Unsaved/);assert.match(h.html(),/Pending while storage is denied/);h.A.backup();assert.equal(h.downloaded().doc.scenes[0].nick_notes,'Pending while storage is denied');assert.equal(h.data().scenes[0].nick_notes,'Saved');
});
test('Jenny export includes evidence and confirmed movie tropes without Bingo claims',()=>{
 const {C}=harness(),d=C.create({id:'m'},'Opening','Shared note');d.scenes[0].jenny_notes='Jenny callback';const text=C.exportText(d,'Movie',['Hometown return']);assert.match(text,/Jenny callback/);assert.match(text,/Unknown/);assert.match(text,/Hometown return/);assert.match(text,/not Bingo results/);assert.match(text,/Additional notes/);
});
test('workspace and movie keys isolate drafts',()=>{
 const h=harness();h.A.edit('nick_notes','Private to original');h.context.workspace='w2';h.html();h.A.edit('nick_notes','Other workspace');assert.equal(h.data().scenes[0].nick_notes,'Private to original');
});
test('storyboard cards retain scene order, unknown times and separate editable host notes',()=>{
 const h=harness();h.A.edit('nick_notes','Nick callback');h.A.edit('jenny_notes','Jenny observation');h.A.add();h.A.edit('title','The next scene');h.A.edit('start_time_ms','12:30');const html=h.html();assert.match(html,/cl-story-track/);assert.match(html,/cl-story-card/);assert.ok(html.indexOf('A shop owner returns home.')<html.indexOf('The next scene'));assert.match(html,/Time unknown/);assert.match(html,/00:12:30/);h.A.select(0);const selected=h.html();assert.match(selected,/Nick callback/);assert.match(selected,/Jenny observation/);assert.match(selected,/No observations added/);assert.match(selected,/None linked to this scene/);assert.equal(h.storage.size,1);
});
test('storyboard keyboard navigation preserves selection, bookmark and notes across rerenders and reload',()=>{
 const h=harness();h.A.add();h.A.edit('nick_notes','Keep my place');h.A.bookmark();const selected=h.data().selected;let prevented=false;h.A.cardKey({key:'Home',preventDefault(){prevented=true;}},2);assert.equal(h.data().selected,h.data().scenes[0].scene_id);assert.equal(prevented,true);h.A.pickup();h.html();assert.equal(h.data().selected,selected);const loaded=harness(h.storage);assert.equal(loaded.data().selected,selected);assert.match(loaded.html(),/Keep my place/);assert.match(loaded.html(),/Next scene/);
});
test('funny observations and plot-hole notes survive merge and undo without treating trope candidates as confirmed',()=>{
 const h=harness();h.A.edit('funny_observations','The oversized order\nThe coffee callback');h.A.edit('plot_holes','Who pays the rent?');h.A.edit('discussion_prompts','What does this decision cost?');h.A.merge();assert.match(h.html(),/Who pays the rent/);assert.equal(h.data().scenes[0].funny_observations.length,2);h.A.undo();assert.equal(h.data().scenes.length,2);assert.equal(h.data().scenes[0].plot_holes[0],'Who pays the rent?');
});
test('scene trope links require a confirmed movie trait and remain user-confirmed rather than independently verified',()=>{
 const h=harness();h.context.confirmedTraits=[{id:'known',name:'Business rescue'}];h.context.traits=h.context.confirmedTraits;h.A.trope('unknown',true);assert.equal(h.data().scenes[0].trope_candidates.length,0);h.A.trope('known',true);assert.match(h.html(),/Business rescue · user-confirmed/);assert.equal(h.data().scenes[0].trope_candidates[0].evidence_status,'Unverified');h.A.trope('known',false);assert.equal(h.data().scenes[0].trope_candidates.length,0);
});
test('merging scenes retains marker associations without modifying original recording timestamps',()=>{
 const h=harness();const second=h.data().scenes[1].scene_id;h.context.recordingMarkers=[{scene_id:second,atMs:12345,type:'Retake',note:'Keep this marker'}];h.A.merge();assert.match(h.html(),/Keep this marker/);assert.equal(h.context.recordingMarkers[0].atMs,12345);h.A.undo();assert.equal(h.data().scenes[1].scene_id,second);
});


test('delete middle scene, reload and undo restore identity, notes, order and bookmark',()=>{
 const h=harness();h.A.add();h.A.select(1);h.A.edit('jenny_notes','Jenny draft');h.A.bookmark();const before=h.data();h.A.remove();const loaded=harness(h.storage);assert.equal(loaded.data().pickup,null);assert.deepEqual(loaded.data().scenes.map(s=>s.scene_id),[before.scenes[0].scene_id,before.scenes[2].scene_id]);loaded.A.undo();assert.deepEqual(loaded.data().scenes,before.scenes);assert.equal(loaded.data().pickup,before.pickup);assert.equal(loaded.data().deleted_scenes,undefined);
});
test('navigation does not consume destructive undo history',()=>{
 const h=harness();const removed=h.data().scenes[1].scene_id;h.A.remove(removed);for(let i=0;i<30;i++){h.A.select(0);h.A.bookmark();}h.A.undo();assert.ok(h.data().scenes.some(s=>s.scene_id===removed));
});
test('marker-only scene requires confirmation and leaves original markers intact',()=>{
 const h=harness();h.A.edit('summary','');const id=h.data().selected;h.context.recordingMarkers=[{scene_id:id,atMs:456,type:'Retake'}];let prompt='';h.ctx.confirm=text=>{prompt=text;return false;};h.A.remove();assert.match(prompt,/markers.*retained/);assert.equal(h.data().selected,id);h.ctx.confirm=()=>true;h.A.remove();assert.equal(h.context.recordingMarkers[0].atMs,456);h.A.undo();assert.match(h.html(),/Retake/);
});
test('stale tab undo cannot resurrect another tab deletion; draft remains exportable',()=>{
 const h=harness();h.A.edit('nick_notes','Pending host draft');const other=harness(h.storage);other.A.remove();h.A.undo();assert.match(h.status.textContent,/Another tab/);assert.equal(h.data().scenes.length,1);h.A.backup();assert.equal(h.downloaded().doc.scenes.length,2);
});
test('missing storage cannot be silently replaced by a stale cached timeline',()=>{
 const h=harness();h.A.edit('nick_notes','Saved');h.storage.clear();h.A.edit('jenny_notes','Recover me');assert.equal(h.storage.size,0);h.A.backup();assert.equal(h.downloaded().doc.scenes[0].jenny_notes,'Recover me');
});
test('deleted research beat stays deleted on refresh and Undo removes its tombstone',()=>{
 const h=harness(),report={schema_version:1,movie_id:'m1',generated_at:'r1',sources:[{id:'s',title:'Source',text:'Evidence'}],story_beats:[{id:'beat',title:'Research scene',summary:'Research description',source_ids:['s']}],discussion:[],trope_candidates:[]};
 h.ctx.clMovieResearch={getReport:()=>report};h.html();const id=h.data().scenes.at(-1).scene_id;h.A.remove(id);const deleted=h.data();const refreshed=h.C.mergeResearch(deleted,{...report,generated_at:'r2'});assert.ok(!refreshed.scenes.some(s=>s.research_origin?.beat_id==='beat'));h.A.undo();assert.ok(h.data().scenes.some(s=>s.scene_id===id));assert.equal(h.data().deleted_scenes,undefined);
});
