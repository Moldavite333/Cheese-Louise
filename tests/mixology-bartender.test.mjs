import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {createHandler} from '../supabase/functions/mixology-bartender/handler.mjs';
const require=createRequire(import.meta.url),C=require('../mixology-core.js'),U='11111111-1111-4111-8111-111111111111',W='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',R='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const msg={id:crypto.randomUUID(),role:'user',actorId:U,text:'Try less sweetness',createdAt:new Date().toISOString()},base=C.fromLegacy({name:'Trial',ingredients:'Brandy\nCranberry syrup',method:'Build over ice.'});
const input=()=>({action:'ask',workspace_id:W,recipe_id:R,recipe_revision:4,request_id:crypto.randomUUID(),message_id:msg.id});
function fixture({enabled=true,forbidden=false,providerStatus=200,output,stale=false,claimedState,finishFails=false}={}){
 const envs={SUPABASE_URL:'https://fixture.supabase.test',SUPABASE_ANON_KEY:'public-fixture-key',SUPABASE_SERVICE_ROLE_KEY:'private-fixture-key',OPENAI_API_KEY:'private-provider-key',MIXOLOGY_AI_ENABLED:enabled?'true':'false',MIXOLOGY_AI_MODEL:'fixture-model'};
 const requests=[],claims=new Map();let modelCalls=0;
 const fetcher=async(url,options={})=>{
  requests.push({url,method:options.method||'GET'});const u=new URL(url),reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
  if(u.pathname==='/auth/v1/user')return reply({id:U});
  if(u.pathname==='/rest/v1/mixology_recipes')return reply(forbidden?[]:[{id:R,workspace_id:W,cocktail_id:R,revision:4,variant:'alcoholic',document:base}]);
  if(u.pathname==='/rest/v1/mixology_workshops')return reply([{document:{schemaVersion:1,brief:'',input:'',concepts:[],research:null,pending:null,messages:[msg],ignoredTastings:[]}}]);
  if(u.pathname==='/rest/v1/rpc/mixology_claim_bartender'){
   const p=JSON.parse(options.body);if(stale)return reply({message:'draft_conflict'},409);
   if(claims.has(p.p_request))return reply(claims.get(p.p_request));
   const row={id:p.p_request,recipe_id:R,workspace_id:W,created_by:U,lease_token:claimedState==='running'?crypto.randomUUID():p.p_lease,status:claimedState||'running',response:{cached:true}};claims.set(row.id,row);return reply(row);
  }
  if(u.pathname==='/rest/v1/mixology_bartender_requests'&&options.method==='PATCH'){
   if(finishFails)return reply({},503);assert.equal(options.headers.apikey,'private-fixture-key');const id=u.searchParams.get('id').slice(3),row=claims.get(id);Object.assign(row,JSON.parse(options.body));return reply([row]);
  }
  if(['/rest/v1/mixology_versions','/rest/v1/mixology_tastings','/rest/v1/mixology_movie_links'].includes(u.pathname))return reply([]);
  if(u.pathname==='/rest/v1/workspace_members')return reply([{user_id:U}]);
  if(u.pathname==='/rest/v1/profiles')return reply([{id:U,display_name:'Nick'}]);
  if(url==='https://api.openai.com/v1/responses'){
   modelCalls++;const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.max_output_tokens,3000);assert.equal(body.text.format.strict,true);assert.equal(body.tools,undefined);const context=JSON.parse(body.input);assert.equal(context.recipe.name,'Trial');assert.ok(context.new_row_ids.length===12);assert.equal(context.requesting_host_id,U);assert.equal(context.hosts[0].name,'Nick');assert.equal(context.conversation[0].actor_id,U);
   if(providerStatus!==200)return reply({error:{code:'provider_error'}},providerStatus);
   const result=output||{reply:'Try a little less syrup; this is an untested suggestion.',evidence_ids:[],operations:[{kind:'upsert_ingredient',id:base.ingredients[1].id,name:'Cranberry syrup',quantity:'5',unit:'mL',text:null,value:null,position:null}]};
   return reply({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(result)}]}]});
  }
  throw Error('Unexpected request '+url);
 };
 const handler=createHandler({env:name=>envs[name],fetcher});
 return {requests,claims,get modelCalls(){return modelCalls},invoke:(body=input(),auth=true)=>handler(new Request('https://local/bartender',{method:'POST',headers:auth?{Authorization:'Bearer fixture-user'}:{},body:JSON.stringify(body)}))};
}
test('bartender verifies identity and recipe access before touching the provider',async()=>{const noAuth=fixture();assert.equal((await noAuth.invoke(input(),false)).status,401);assert.equal(noAuth.requests.length,0);const outsider=fixture({forbidden:true});assert.equal((await outsider.invoke()).status,403);assert.equal(outsider.modelCalls,0);});
test('provider is disabled by default configuration and status exposes no secrets',async()=>{const f=fixture({enabled:false}),response=await f.invoke({action:'status',workspace_id:W,recipe_id:R});const value=await response.json();assert.equal(value.enabled,false);assert.ok(!JSON.stringify(value).includes('private-'));assert.equal((await f.invoke()).status,503);assert.equal(f.modelCalls,0);});
test('model returns validated proposals only; recipe is never written by the endpoint',async()=>{const f=fixture(),response=await f.invoke(),body=await response.json();assert.equal(response.status,200);assert.equal(body.proposal.document.ingredients[1].quantity,'5');assert.equal(base.ingredients[1].quantity,'');assert.equal(body.tested,false);assert.equal(f.modelCalls,1);assert.ok(!f.requests.some(r=>r.url.includes('mixology_save')));assert.ok([...f.claims.values()].every(r=>r.status==='complete'));});
test('same request replays cached output without a second model call',async()=>{const f=fixture(),body=input();await f.invoke(body);assert.equal((await f.invoke(body)).status,200);assert.equal(f.modelCalls,1);});
test('running request cannot acquire a second lease or be marked failed by another retry',async()=>{const f=fixture({claimedState:'running'}),response=await f.invoke();assert.equal(response.status,409);assert.equal(f.modelCalls,0);assert.equal([...f.claims.values()][0].status,'running');});
test('stale revisions fail before provider spending',async()=>{const f=fixture({stale:true});assert.equal((await f.invoke()).status,409);assert.equal(f.modelCalls,0);});
test('provider failure has one bounded attempt, leaves recipe intact and records failed request',async()=>{const f=fixture({providerStatus:429}),response=await f.invoke();assert.equal(response.status,502);assert.equal(f.modelCalls,1);assert.equal([...f.claims.values()][0].status,'failed');assert.equal(base.ingredients[1].quantity,'');});
test('unsupported recipe operations, invented evidence and tasting claims fail closed',async()=>{for(const output of [{reply:'Publish now',evidence_ids:[],operations:[{kind:'publish'}]},{reply:'Based on your history',evidence_ids:[crypto.randomUUID()],operations:[]},{reply:'I tasted this recipe.',evidence_ids:[],operations:[]}]){const f=fixture({output}),response=await f.invoke();assert.equal(response.status,502);assert.equal([...f.claims.values()][0].status,'failed');}});
test('a failed cache write is not reported as a completed, durable reply',async()=>{const f=fixture({finishFails:true});assert.equal((await f.invoke()).status,503);assert.equal(f.modelCalls,1);});
