import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {checkIdentity,identity,reportSchema,researchPrompt,validateReport,webEvidence} from '../supabase/functions/movie-research/engine.mjs';
import {createHandler} from '../supabase/functions/movie-research/handler.mjs';
const wid='11111111-1111-4111-8111-111111111111',mid='22222222-2222-4222-8222-222222222222';
const movie={id:mid,workspace_id:wid,title:'A Winter Bakery',premiere_date:'2025-11-01',summary:'A baker returns home to save the family bakery before a town festival.',source_metadata:{},status:'saved'};
const source={id:'saved-synopsis',title:'Saved synopsis',url:'',text:movie.summary,kind:'saved_synopsis'};
const item={source_ids:[source.id],evidence_anchor:'save the family bakery',title:'The bakery deadline',summary:'A baker tries to save the family bakery.'};
const output={matched_title:movie.title,matched_year:'2025',coverage:'detailed',premise:'Never trust this unanchored premise.',story_beats:[item],characters:[{...item,name:'The baker',actor:'',motivation:'Save the family bakery',discussion_angle:'What does the bakery cost the family?'}],discussion:[{...item,observation:'The bakery needs saving.',question:'What would a realistic rescue plan cost?',basis:'interpretation'}],trope_candidates:[{...item,trope_id:'trope-1',why:'A family business needs saving.'}],research_gaps:['How is the deadline resolved?']};
function fixture({member=true,key=true,provider=200,cached=false,changeMovie=false}={}){
 const calls=[],tasks=[],rows=new Map();let movieReads=0;
 if(cached)rows.set(mid,{movie_id:mid,workspace_id:wid,status:'ready',report:{schema_version:1,movie_id:mid},input_hash:'cached'});
 const env=name=>({SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_ANON_KEY:'public-fixture',SUPABASE_SERVICE_ROLE_KEY:'service-fixture',OPENAI_API_KEY:key?'api-fixture':''})[name];
 const json=(v,status=200)=>new Response(JSON.stringify(v),{status});
 const fetcher=async(url,options={})=>{
  calls.push({url,options});const u=new URL(url),body=options.body?JSON.parse(options.body):{};
  if(u.pathname==='/auth/v1/user')return json({id:'member-fixture'});
  if(u.pathname.endsWith('/workspace_members'))return json(member?[{workspace_id:wid}]:[]);
  if(u.pathname.endsWith('/movies')){movieReads++;return json([{...movie,...(changeMovie&&movieReads>2?{summary:'A corrected and different movie summary.'}:{})}]);}
  if(u.pathname.endsWith('/cheese_traits'))return json([{id:'trope-1',name:'Family business rescue',category:'Business',recognition:{}}]);
  if(u.pathname.endsWith('/rpc/request_movie_research')){if(cached)return json(false);rows.set(mid,{movie_id:mid,workspace_id:wid,status:'queued',report:{},input_hash:body.p_input_hash});return json(true);}
  if(u.pathname.endsWith('/rpc/claim_requested_movie_research')){const row=rows.get(mid);if(row?.status!=='queued')return json([]);row.status='generating';row.lease_token='lease-fixture';return json([row]);}
  if(u.pathname.endsWith('/movie_research_briefs')){if(options.method==='PATCH'){Object.assign(rows.get(mid),body);return json(options.headers?.Prefer==='return=representation'?[rows.get(mid)]:null);}return json([...rows.values()]);}
  if(u.pathname.endsWith('/movie_research_versions'))return new Response(null,{status:204});
  if(u.pathname==='/v1/responses'){
   if(provider!==200)return json({error:'PRIVATE PROVIDER SECRET'},provider);
   if(body.tools)return json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'The family bakery is threatened by a deadline. [1]',annotations:[{type:'url_citation',url:'https://network.example/movie',title:'Official movie page',start_index:46,end_index:49}]}]}]});
   return json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output)}]}]});
  }
  if(u.pathname==='/functions/v1/movie-research')return json({status:'accepted'},202);
  throw Error('Unexpected fixture request '+url);
 };
 const handler=createHandler({env,fetcher,background:task=>tasks.push(task)});
 const call=(data={},auth='user-fixture')=>handler(new Request('https://fixture/research',{method:'POST',headers:auth?{Authorization:'Bearer '+auth}:{},body:JSON.stringify({workspace_id:wid,movie_id:mid,action:'prepare',...data})}));
 return {handler,call,calls,rows,tasks,finish:()=>Promise.all(tasks)};
}
test('research identity distinguishes same-title releases and alternate titles',()=>{
 assert.equal(identity({...movie,source_metadata:'null'}).year,'2025');
 assert.equal(checkIdentity({...movie,tmdb_id:7},{id:7,title:movie.title,release_date:'1999-01-01'}),false);
 assert.equal(checkIdentity({...movie,tmdb_id:7},{id:8,title:movie.title,release_date:'2025-11-01'}),false);
 assert.equal(checkIdentity({...movie,tmdb_id:7},{id:7,title:'Winter Baker',release_date:'2025-11-01',alternative_titles:{titles:[{title:movie.title}]}}),true);
});
test('research requests do not send private host notes into web search',()=>{
 const prompt=researchPrompt({...movie,notes:'PRIVATE HOST NOTE',comments:[{body:'PRIVATE'}]});assert.ok(!JSON.stringify(prompt).includes('PRIVATE'));assert.ok(prompt.instructions.includes('untrusted reference DATA'));assert.ok(reportSchema.additionalProperties===false);
});
test('only actual inline search citations become source evidence',()=>{
 const sources=webEvidence({output:[{type:'message',content:[{type:'output_text',text:'This movie concerns the family bakery. [1]',annotations:[{type:'url_citation',url:'javascript:bad',start_index:38},{type:'url_citation',url:'https://official.example/movie',title:'Official synopsis',start_index:38}]}]}]});assert.equal(sources.length,1);assert.equal(sources[0].url,'https://official.example/movie');
});
test('unsupported anchors, forged sources, timestamps and unknown trope IDs do not become facts',()=>{
 const raw=structuredClone(output);raw.story_beats.push({...item,summary:'Invented wedding',evidence_anchor:'a wedding that never appeared'});raw.story_beats.push({...item,source_ids:['made-up']});raw.story_beats[0].start_time_ms=12000;raw.trope_candidates.push({...item,trope_id:'invented'});
 const r=validateReport(raw,movie,[source],[{id:'trope-1'}]);assert.equal(r.story_beats.length,1);assert.equal(r.story_beats[0].start_time_ms,undefined);assert.equal(r.trope_candidates.length,1);assert.equal(r.trope_candidates[0].state,'source-supported candidate');assert.ok(!r.premise.includes('Never trust'));assert.equal(r.coverage,'limited');assert.throws(()=>validateReport({...raw,matched_year:'1999'},movie,[source],[]));
});
test('unsigned and nonmember requests cannot enqueue jobs or spend API credit',async()=>{
 const h=fixture({member:false});assert.equal((await h.call({},null)).status,401);assert.equal((await h.call()).status,403);assert.ok(!h.calls.some(c=>c.url.includes('openai')||c.url.includes('/rpc/')));
});
test('signed user cannot invoke internal drain and internal credential cannot invoke browser actions',async()=>{
 const h=fixture();assert.equal((await h.call({action:'drain'})).status,400);assert.equal((await h.call({action:'prepare_library'},'service-fixture')).status,403);assert.equal(h.tasks.length,0);
});
test('explicit requests use saved identity, persist one brief and never continue the library queue',async()=>{
 const h=fixture();assert.equal((await h.call({movie:{title:'Injected title'}})).status,202);await h.finish();const row=h.rows.get(mid);assert.equal(row.status,'limited');assert.equal(row.report.identity.title,movie.title);assert.equal(row.lease_token,null);assert.ok(h.calls.some(c=>c.url.includes('movie_research_versions')));assert.ok(!h.calls.some(c=>c.url.includes('/functions/v1/movie-research')));
 const publicBody=await (await h.call({action:'status'})).text();assert.ok(!publicBody.includes('service-fixture'));assert.ok(!publicBody.includes('input_hash'));assert.ok(!publicBody.includes('lease_token'));
});
test('cached briefs do not cause new AI calls and missing provider config is actionable',async()=>{
 const h=fixture({cached:true});await h.call();await h.finish();assert.ok(!h.calls.some(c=>c.url.includes('openai')));const missing=fixture({key:false});assert.equal((await missing.call()).status,503);assert.ok(!missing.calls.some(c=>c.url.includes('/rpc/')));
});
test('passive status reads and legacy library-generation requests never enqueue, claim or spend AI credit',async()=>{
 const h=fixture();assert.equal((await h.call({action:'library_status'})).status,200);assert.equal((await h.call({action:'status'})).status,200);assert.equal((await h.call({action:'prepare_library'})).status,400);await h.finish();assert.equal(h.tasks.length,0);assert.ok(!h.calls.some(c=>c.url.includes('/rpc/')||c.url.includes('openai')));
});
test('provider failure is sanitized and a movie edit during generation rejects the stale result',async()=>{
 const h=fixture({provider:429});await h.call();await h.finish();assert.equal(h.rows.get(mid).status,'error');assert.ok(!JSON.stringify(h.rows.get(mid)).includes('PRIVATE PROVIDER'));const changed=fixture({changeMovie:true});await changed.call();await changed.finish();assert.equal(changed.rows.get(mid).status,'error');assert.equal(changed.rows.get(mid).error_code,'movie_changed_retry');
});
test('research import adds untimed notes without replacing manual scenes and does not duplicate',()=>{
 const ctx={crypto:webcrypto,Date};vm.createContext(ctx);vm.runInContext(readFileSync(new URL('../timeline-core.js',import.meta.url),'utf8'),ctx);const C=ctx.clTimelineCore;
 const original=C.create(movie,'Saved synopsis','Keep user note');original.scenes[0].summary='Manual correction';original.scenes[0].manual_fields=['summary'];
 const report=validateReport(output,movie,[source],[{id:'trope-1'}]);const next=C.mergeResearch(original,report);assert.equal(next.scenes[0].summary,'Manual correction');assert.equal(next.scenes[1].shared_notes,'Keep user note');assert.equal(next.scenes.at(-1).start_time_ms,null);assert.equal(next.scenes.at(-1).discussion_prompts.length,1);assert.equal(C.mergeResearch(next,report).scenes.length,next.scenes.length);assert.throws(()=>C.mergeResearch(next,{...report,movie_id:'other'}));assert.match(C.exportText(next,movie.title),/realistic rescue plan/);
});
test('regeneration preserves edited and approved scene descriptions, stable IDs, bookmarks and notes',()=>{
 const ctx={crypto:webcrypto,Date};vm.createContext(ctx);vm.runInContext(readFileSync(new URL('../timeline-core.js',import.meta.url),'utf8'),ctx);const C=ctx.clTimelineCore;
 const report=validateReport(output,movie,[source],[{id:'trope-1'}]);let doc=C.mergeResearch(C.create(movie),report);const original=doc.scenes[0];original.title='My corrected title';original.summary='My corrected scene';original.manual_fields=['title','summary'];original.nick_notes='Keep this observation';doc.pickup=original.scene_id;
 const nextReport=structuredClone(report);nextReport.generated_at='2026-11-03T00:00:00.000Z';nextReport.story_beats[0].summary='New generated version';doc=C.mergeResearch(doc,nextReport);assert.equal(doc.scenes.length,1);assert.equal(doc.scenes[0].summary,'My corrected scene');assert.equal(doc.scenes[0].nick_notes,'Keep this observation');assert.equal(doc.scenes[0].scene_id,original.scene_id);assert.equal(doc.pickup,original.scene_id);
 doc.scenes[0].manual_fields=[];doc.scenes[0].review_status='User-confirmed';nextReport.generated_at='2026-11-04T00:00:00.000Z';assert.equal(C.mergeResearch(doc,nextReport).scenes[0].summary,'My corrected scene');
});
test('browser research caches shared reports, escapes movie material and keeps workspace responses isolated',async()=>{
 let resolvePending;const store=new Map(),timers=[];const report=validateReport(output,movie,[source],[{id:'trope-1'}]);report.premise='<script>unsafe</script>';
 const ctx={console,Date,URL,Blob,workspace:{id:wid},session:{user:{id:'user'}},state:{movies:[movie],traits:[{id:'trope-1',name:'Business rescue'}]},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},document:{visibilityState:'visible',querySelectorAll:()=>[]},db:{functions:{invoke:async()=>({data:{briefs:[{movie_id:mid,workspace_id:wid,status:'ready',report}]}})}}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(readFileSync(new URL('../movie-research.js',import.meta.url),'utf8'),ctx);await ctx.clMovieResearch.prepare(mid);assert.match(ctx.clMovieResearch.html(movie),/&lt;script&gt;unsafe/);assert.match(ctx.clMovieResearch.html(movie),/Business rescue/);assert.match(ctx.clMovieResearch.text(mid),/STORY BEATS/);assert.ok(store.size>0);
 ctx.db.functions.invoke=()=>new Promise(resolve=>resolvePending=resolve);const pending=ctx.clMovieResearch.prepare(mid);ctx.workspace={id:'other-workspace'};resolvePending({data:{briefs:[{movie_id:mid,workspace_id:wid,status:'ready',report}]}});await pending;assert.equal(ctx.clMovieResearch.getReport(mid),null);
});
test('loading the movie library only reads saved research and labels paid generation explicitly',async()=>{
 const actions=[],timers=[];const ctx={Date,URL,Blob,workspace:{id:wid},session:{user:{id:'user'}},state:{movies:[movie],traits:[]},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},localStorage:{getItem:()=>null,setItem(){}},document:{visibilityState:'visible',querySelectorAll:()=>[]},db:{functions:{invoke:async(name,{body})=>{actions.push(body.action);return {data:{briefs:[]}};}}}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(readFileSync(new URL('../movie-research.js',import.meta.url),'utf8'),ctx);await timers.shift()();assert.deepEqual(actions,['library_status']);assert.match(ctx.clMovieResearch.html(movie),/Generate movie timeline \(uses API credits\)/);assert.ok(!actions.includes('prepare_library'));
});
test('undo stores scene deltas instead of copying large source evidence on every keystroke',()=>{
 const ctx={crypto:webcrypto,Date};vm.createContext(ctx);vm.runInContext(readFileSync(new URL('../timeline-core.js',import.meta.url),'utf8'),ctx);const C=ctx.clTimelineCore;
 const before=C.create(movie,'A'.repeat(30000));before.scenes[0].summary='Short scene';const after=C.clone(before);after.scenes[0].nick_notes='New note';const delta=C.undoDelta(before,after);assert.ok(JSON.stringify(delta).length<2000);const restored=C.applyUndoDelta(after,delta);assert.equal(restored.scenes[0].nick_notes,'');assert.equal(restored.sources[0].text.length,30000);
 const added=C.clone(before);const s=C.scene(mid,'Added scene',added.sources[0].id);added.scenes.unshift(s);const undone=C.applyUndoDelta(added,C.undoDelta(before,added));assert.equal(undone.scenes.length,1);assert.equal(undone.scenes[0].scene_id,before.scenes[0].scene_id);C.validate(undone);
});
