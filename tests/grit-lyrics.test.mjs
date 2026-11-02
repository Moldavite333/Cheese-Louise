import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBrief,repeatedLines,sourceLinks} from '../supabase/functions/grit-lyrics/engine.mjs';
import {createHandler} from '../supabase/functions/grit-lyrics/handler.mjs';
const movie={title:'Christmas at the Catnip Cafe',year:2025,summary:'A woman opens a cat cafe and works with a local veterinarian to find homes for rescued cats before Christmas.'};
const song={status:'ready',title:'A Table for the Strays',angle:'The cats witness a rescue',story_details:['cat cafe','veterinarian','rescue cats','Christmas adoptions'],lyrics:'[Verse 1]\n'+Array.from({length:20},(_,i)=>'The rescued cat studies the veterinarian and the cafe window '+i).join('\n'),question:''};
const response=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
function setup({key=true,member=true,responses=[song],providerStatus=200}={}){
 const calls=[];let n=0;
 const handler=createHandler({env:name=>({OPENAI_API_KEY:key?'server-only-secret':'',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_ANON_KEY:'anon'}[name]),fetcher:async(url,options)=>{
  calls.push({url,options});if(url.endsWith('/auth/v1/user'))return response({id:'user-a'});
  if(url.includes('/rest/v1/'))return response(member?[{workspace_id:'workspace-a'}]:[]);
  if(url==='https://api.openai.com/v1/responses'){if(providerStatus!==200)return new Response('private provider error',{status:providerStatus});return response({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(responses[Math.min(n++,responses.length-1)])}]}]})}
  throw Error('Unexpected URL '+url);
 }});
 const call=body=>handler(new Request('https://fixture/grit-lyrics',{method:'POST',headers:{Authorization:'Bearer signed-user-token'},body:JSON.stringify({workspace_id:'workspace-a',movie,research:{},action:'generate',...body})}));return {handler,call,calls};
}
test('song brief includes actual story, characters, Watch Along notes and previous songs, not a title-swapped template',()=>{
 const a=buildBrief({movie:{...movie,characters:[{name:'Ada',actor:'Actor'}],watch_notes:'The cats choose the Christmas tree.',notes:'The adoption paperwork makes no sense.'},details:'The vet is afraid of cats.',history:[{lyrics:'My previous unique hook belongs to another movie'}]});
 for(const text of ['Catnip Cafe','Ada','Christmas tree','adoption paperwork','afraid of cats','previous unique hook'])assert.ok(a.prompt.includes(text));
 assert.ok(a.prompt.includes('four distinct concrete movie details'));assert.notEqual(a.prompt,buildBrief({movie:{title:'Forgotten Holiday',summary:'A woman pretends not to know her husband.'}}).prompt);
});
test('repetition guard catches prior songs and old canned choruses while allowing a new chorus inside one song',()=>{
 assert.equal(repeatedLines('My brand new hook\nMy brand new hook',[]).length,0);
 assert.equal(repeatedLines('REALITY packed up and romance took the wheel!',[]).length,1);
 assert.equal(repeatedLines('The cat ate the Christmas adoption forms',[{lyrics:'The cat ate the Christmas adoption forms'}]).length,1);
});
test('only HTTPS research links survive and provider citations are retained',()=>{
 const sources=sourceLinks({output:[{type:'web_search_call',action:{sources:[{url:'https://example.com/plot',title:'Plot'}]}},{type:'message',content:[{annotations:[{type:'url_citation',url:'javascript:alert(1)'},{type:'url_citation',url:'https://example.com/plot'}]}]}]});assert.equal(sources.length,1);
});
test('generation checks real user and workspace membership before spending API credit',async()=>{
 const h=setup({member:false});assert.equal((await h.call({})).status,403);assert.ok(!h.calls.some(x=>x.url.includes('openai')));
 assert.equal((await h.handler(new Request('https://fixture/grit',{method:'POST',body:'{}'}))).status,401);
});
test('missing songwriting connection returns an actionable error instead of fabricated stock lyrics',async()=>{
 const h=setup({key:false});const r=await h.call({});assert.equal(r.status,503);assert.match((await r.json()).error,/Copy songwriting brief/);
 const health=await h.handler(new Request('https://fixture/grit'));const text=await health.text();assert.ok(!text.includes('secret'));assert.equal(JSON.parse(text).ready,false);
});
test('a repeated line triggers a fresh rewrite and only the successful new song is returned',async()=>{
 const repeated={...song,lyrics:song.lyrics+'\nReality packed up and romance took the wheel'};
 const h=setup({responses:[repeated,song]});const r=await h.call({});assert.equal(r.status,200);assert.equal((await r.json()).song.title,song.title);
 const requests=h.calls.filter(x=>x.url.includes('openai'));assert.equal(requests.length,2);assert.ok(JSON.parse(requests[1].options.body).instructions.includes('previous attempt recycled'));
 assert.equal(JSON.parse(requests[0].options.body).store,false);
});
test('persistent repetition, thin material, and provider failures never return a generic fallback',async()=>{
 const h=setup({responses:[{...song,lyrics:song.lyrics+'\nReality packed up and romance took the wheel'}]});assert.equal((await h.call({})).status,422);
 const thin=setup();assert.equal((await thin.call({movie:{title:'Unknown movie'}})).status,422);assert.ok(!thin.calls.some(x=>x.url.includes('openai')));
 const fail=setup({providerStatus:429});const r=await fail.call({});assert.equal(r.status,502);assert.ok(!(await r.text()).includes('private provider error'));
});
test('a request for more facts from the songwriter is shown instead of storing empty lyrics',async()=>{
 const h=setup({responses:[{...song,status:'needs_details',lyrics:'',question:'What goes wrong at the cat adoption?'}]});const r=await h.call({});assert.equal(r.status,422);assert.match((await r.json()).error,/cat adoption/);
});
