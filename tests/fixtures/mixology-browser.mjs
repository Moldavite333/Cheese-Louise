// Runs the actual HQ assembly against an isolated in-memory PostgreSQL database.
// Every external browser request is blocked. No production credentials or writes.
import assert from 'node:assert/strict';
import jpeg from 'jpeg-js';
import {createPhotoSanitizer} from '../../supabase/functions/mixology-submit/photo.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
import {setup,U,J,W,K} from './mixology-db.mjs';
import {createHandler} from '../../supabase/functions/mixology-bartender/handler.mjs';
import {createHandler as createIntakeHandler} from '../../supabase/functions/mixology-submit/handler.mjs';

export async function createBrowserFixture({stage2=false,media=false,publication=false,submissions=false,listenerPhotos=false}={}){
const db=await setup({stage2,production:true,media:media||publication,publication,submissions}),root=process.cwd();let queue=Promise.resolve();const storageBytes=new Map(),signedPhotos=new Map();
await db.exec("reset role;insert into episodes(id,workspace_id) values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','"+W+"');grant select on episodes to authenticated;");
const rpc={mixology_trend_start:['p_id','p_workspace','p_movie','p_document'],mixology_trend_save:['p_id','p_revision','p_document'],mixology_trend_review:['p_id','p_revision','p_reviewed'],mixology_trend_list:['p_workspace','p_movie','p_archived','p_before_time','p_before_id'],mixology_listener_photo_link:['p_id','p_submission','p_revision','p_alt','p_caption','p_confirmed'],mixology_listener_media_bytes:['p_media'],mixology_listener_photo_read:['p_submission'],mixology_submission_review:['p_operation','p_submission','p_revision','p_decision','p_reason','p_variant','p_recipe','p_target_version'],mixology_submission_moderate:['p_operation','p_submission','p_revision','p_decision','p_reason','p_variant','p_recipe'],mixology_publication_open:['p_version'],mixology_publication_save:['p_version','p_revision','p_document'],mixology_publication_review:['p_version','p_revision','p_photo_revision','p_reviewed'],mixology_publication_snapshot:['p_id','p_version','p_revision'],mixology_publication_export:['p_id'],mixology_media_register:['p_id','p_version','p_digest','p_width','p_height','p_document'],mixology_media_save:['p_id','p_revision','p_document'],mixology_preparation_open:['p_version','p_episode'],mixology_preparation_save:['p_plan','p_revision','p_document'],mixology_packet_create:['p_id','p_plan','p_revision'],mixology_decide:['p_id','p_version','p_decision'],mixology_start:['p_workspace','p_cocktail','p_variant','p_document'],mixology_save:['p_recipe','p_revision','p_document'],mixology_checkpoint:['p_recipe','p_revision','p_version'],mixology_feedback:['p_id','p_version','p_revision','p_again','p_flags','p_comment'],mixology_workshop_open:['p_recipe'],mixology_workshop_save:['p_recipe','p_revision','p_document'],mixology_claim_bartender:['p_recipe','p_request','p_revision','p_lease']};
async function api(body,host){
 if(![U,J].includes(host))throw Error('Unknown fixture actor');
 await db.exec('reset role;begin;');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[host]);await db.exec('set local role authenticated;');
 try{
  let data;
  if(body.storage){
   if(body.bucket!=='mixology-photos')throw Error('Unexpected fixture bucket');
   if(body.storage==='upload'){const bytes=Buffer.from(body.base64,'base64');await db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4)',[body.bucket,body.path,host,{mimetype:body.contentType,size:bytes.length}]);storageBytes.set(body.path,bytes);data={path:body.path};}
   else{const rows=(await db.query('select * from storage.objects where bucket_id=$1 and name=$2',[body.bucket,body.path])).rows;if(!rows.length)throw Error('Private object unavailable');if(body.storage==='sign'){const token=crypto.randomUUID();signedPhotos.set(token,{path:body.path,host,expires:Date.now()+300000});data={signedUrl:origin+'/storage/v1/object/sign/mixology-photos/'+body.path+'?token='+token};}else data={path:body.path};}
  }
  else if(body.rpc){const keys=rpc[body.rpc];if(!keys)throw Error('Unknown fixture function');const result=await db.query('select to_jsonb(public.'+body.rpc+'('+keys.map((_,i)=>'$'+(i+1)).join(',')+')) as value',keys.map(k=>body.args[k]));data=body.rpc==='mixology_trend_list'?result.rows.map(r=>r.value):result.rows[0]?.value;}
  else if(!/^mixology_(trend_notes|trend_history|submissions|submission_decisions|publication_drafts|publication_snapshots|media|preparations|recording_packets|approvals|recipes|versions|tastings|movie_links|workshops|conversation_log|research_log|bartender_requests)$/.test(body.table)){data=[];}
  else if(body.operation==='upsert'){
   assert.equal(body.table,'mixology_movie_links');await db.query('insert into mixology_movie_links(workspace_id,cocktail_id,movie_id) values($1,$2,$3) on conflict do nothing',[body.payload.workspace_id,body.payload.cocktail_id,body.payload.movie_id]);data=[];
  }else{
   const params=[],clauses=body.filters.map(f=>{if(!['workspace_id','id','recipe_id','version_id','movie_id','cocktail_id','recorded_at','preparation_id','note_id','submission_id','listener_submission_id','status'].includes(f.key))throw Error('Invalid fixture filter');params.push(f.value);return f.key+(f.op==='in'?'=any($'+params.length+'::uuid[])':f.op==='lt'?'<$'+params.length:'=$'+params.length);});
   let sql='select * from public.'+body.table+(clauses.length?' where '+clauses.join(' and '):'');
   if(body.order){assert.ok(['version_number','created_at','recorded_at','received_at','revision'].includes(body.order.key));sql+=' order by '+body.order.key+(body.order.ascending?' asc':' desc');}
   if(body.limit)sql+=' limit '+Math.min(500,Number(body.limit));
   const rows=(await db.query(sql,params)).rows;data=body.single?rows[0]||null:rows;
  }
  await db.exec('commit;');return {data,error:null};
 }catch(error){await db.exec('rollback;');return {data:null,error:{message:error.message,code:error.code}};}
}
const enqueue=job=>{const task=queue.then(job);queue=task.catch(()=>{});return task};
const mockEnv={SUPABASE_URL:'https://fixture.supabase.test',SUPABASE_ANON_KEY:'fixture-public',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',OPENAI_API_KEY:'fixture-provider',MIXOLOGY_AI_ENABLED:stage2?'true':'false',MIXOLOGY_AI_MODEL:'fixture-model'};
let modelCalls=0;
function functionHandler(host){return createHandler({env:name=>mockEnv[name],fetcher:async(url,options={})=>{
 const u=new URL(url),respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 if(u.pathname==='/auth/v1/user')return respond({id:host});
 if(u.pathname==='/rest/v1/workspace_members')return respond([{user_id:U},{user_id:J}]);
 if(u.pathname==='/rest/v1/profiles')return respond([{id:U,display_name:'Nick'},{id:J,display_name:'Jenny'}]);
 if(url==='https://api.openai.com/v1/responses'){
  modelCalls++;const context=JSON.parse(JSON.parse(options.body).input),row=context.recipe.ingredients.find(r=>/syrup/i.test(r.name))||context.recipe.ingredients[0];
  const operation={kind:'upsert_ingredient',id:row.id,name:'Cranberry syrup',quantity:'5',unit:'mL',text:null,value:null,position:null};
  return respond({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({reply:'Try 5 mL cranberry syrup for a less sweet trial. This is untested; taste before deciding.',evidence_ids:[],operations:[operation]})}]}]});
 }
 if(u.pathname==='/rest/v1/mixology_bartender_requests'&&options.method==='PATCH'){
  const task=await enqueue(async()=>{await db.exec('reset role;begin;set local role service_role');try{const payload=JSON.parse(options.body),rows=(await db.query("update mixology_bartender_requests set status=$1,response=$2 where id=$3 and workspace_id=$4 and created_by=$5 and lease_token=$6 and status='running' returning *",[payload.status,payload.response,u.searchParams.get('id').slice(3),u.searchParams.get('workspace_id').slice(3),u.searchParams.get('created_by').slice(3),u.searchParams.get('lease_token').slice(3)])).rows;await db.exec('commit');return rows;}catch(error){await db.exec('rollback');throw error;}});return respond(task);
 }
 if(u.pathname.startsWith('/rest/v1/rpc/')){const result=await enqueue(()=>api({rpc:u.pathname.split('/').at(-1),args:JSON.parse(options.body)},host));return respond(result.error||result.data,result.error?409:200);}
 if(u.pathname.startsWith('/rest/v1/')){
  const table=u.pathname.split('/').at(-1),filters=[];for(const [key,value] of u.searchParams)if(value.startsWith('eq.'))filters.push({key,value:value.slice(3),op:'eq'});
  const spec={table,filters};if(u.searchParams.has('order')){const [key,order]=u.searchParams.get('order').split('.');spec.order={key,ascending:order!=='desc'};}
  const result=await enqueue(()=>api(spec,host));return respond(result.error||result.data,result.error?503:200);
 }
 throw Error('Fixture blocked unexpected function fetch '+url);
}});}
const server=createServer(async(req,res)=>{try{
 const requestUrl=new URL(req.url,'http://local'),pathname=requestUrl.pathname;
 if(pathname==='/__fixture/submit'){let raw='';for await(const chunk of req)raw+=chunk;const response=await intakeHandler(new Request(origin+'/__fixture/submit',{method:req.method,headers:{Origin:req.headers.origin||origin,'Content-Type':'application/json','x-forwarded-for':intakeAddress},...(req.method==='POST'?{body:raw}:{})}));res.writeHead(response.status,Object.fromEntries(response.headers)).end(await response.text());return;}
 if(pathname.startsWith('/storage/v1/object/sign/mixology-photos/')){const token=signedPhotos.get(requestUrl.searchParams.get('token'));if(!token||token.expires<Date.now())throw Error('Expired private fixture token');const task=queue.then(()=>api({storage:'read',bucket:'mixology-photos',path:token.path},token.host));queue=task.catch(()=>{});const result=await task;if(result.error)throw Error('Private object unavailable');res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'no-store'}).end(storageBytes.get(token.path));return;}
 if(pathname==='/__fixture/bartender'){let raw='';for await(const chunk of req)raw+=chunk;const response=await functionHandler(req.headers['x-fixture-host'])(new Request('https://local/bartender',{method:'POST',headers:{Authorization:'Bearer fixture-user'},body:raw}));res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({data:await response.json(),error:null}));return;}
 if(pathname==='/__fixture/api'){let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);const task=queue.then(()=>api(body,req.headers['x-fixture-host']));queue=task.catch(()=>{});res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(await task));return;}
 if(pathname==='/__fixture/state'){const task=queue.then(async()=>{await db.exec('reset role;');return (await db.query('select * from public.cocktails where workspace_id=$1',[W])).rows});queue=task.catch(()=>{});res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(await task));return;}
 const file=resolve(root,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));if(!file.startsWith(root+sep))throw Error('Path outside fixture');
 if(submissions&&pathname==='/mixology-submit.html'){const html=(await readFile(file,'utf8')).replace('name="mixology-submit-endpoint" content=""','name="mixology-submit-endpoint" content="'+origin+'/__fixture/submit"').replace('name="mixology-turnstile-site-key" content=""','name="mixology-turnstile-site-key" content="fixture-site-key"');res.writeHead(200,{'Content-Type':'text/html'}).end(html);return;}
 res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[extname(file)]||'application/octet-stream'}).end(await readFile(file));
}catch(error){res.writeHead(500).end(error.message)}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
let intakeAddress='198.51.100.40';const intakeEnv={SUPABASE_URL:'https://fixture.supabase.test',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',MIXOLOGY_SUBMISSIONS_ENABLED:submissions?'true':'false',MIXOLOGY_SUBMISSIONS_PHOTOS_ENABLED:listenerPhotos?'true':'false',MIXOLOGY_SUBMISSIONS_ALLOWED_ORIGIN:origin,MIXOLOGY_SUBMISSIONS_WORKSPACE_ID:W,MIXOLOGY_SUBMISSIONS_HASH_SECRET:'fixture-hash-secret-with-at-least-32-characters',MIXOLOGY_SUBMISSIONS_CAPTCHA_SECRET:'fixture-proof-secret',MIXOLOGY_SUBMISSIONS_TRUSTED_IP_HEADER:'x-forwarded-for'};
const intakeHandler=createIntakeHandler({env:name=>intakeEnv[name],sanitizePhoto:createPhotoSanitizer(jpeg),fetcher:async(url,options)=>{
 if(url==='https://challenges.cloudflare.com/turnstile/v0/siteverify')return new Response(JSON.stringify({success:JSON.parse(options.body).response==='fixture-proof',hostname:new URL(origin).hostname,action:'mixology_listener'}));
 const fn=url.split('/').at(-1),keys={mixology_listener_photo_finish:['p_workspace','p_request','p_lease','p_digest','p_document','p_valid','p_photo'],mixology_submission_reserve:['p_workspace','p_request','p_digest','p_subject','p_lease'],mixology_submission_finish:['p_workspace','p_request','p_lease','p_digest','p_document','p_valid']}[fn];if(!keys)throw Error('Unexpected fixture intake fetch');
 const result=await enqueue(async()=>{await db.exec('reset role;begin;set local role service_role');try{const body=JSON.parse(options.body),row=(await db.query('select '+fn+'('+keys.map((_,i)=>'$'+(i+1)).join(',')+') r',keys.map(k=>body[k]))).rows[0].r;await db.exec('commit');return row;}catch(error){await db.exec('rollback');throw error;}});return new Response(JSON.stringify(result));
}});
const browser=await chromium.launch();await mkdir('artifacts',{recursive:true});
async function init(context,host){
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.fulfill({status:200,contentType:'text/javascript',body:''}));
 await context.addInitScript(({host})=>{
  const send=body=>fetch('/__fixture/api',{method:'POST',headers:{'Content-Type':'application/json','x-fixture-host':host},body:JSON.stringify(body)}).then(r=>r.json());
  const from=table=>{
   const spec={table,filters:[]};const q={select(){return q},limit(value){spec.limit=value;return q},eq(key,value){spec.filters.push({key,value,op:'eq'});return q},lt(key,value){spec.filters.push({key,value,op:'lt'});return q},in(key,value){spec.filters.push({key,value,op:'in'});return q},order(key,{ascending=true}={}){spec.order={key,ascending};return q},upsert(payload){spec.operation='upsert';spec.payload=payload;return q},single(){spec.single=true;return send(spec)},maybeSingle(){return q.single()},then(resolve,reject){return send(spec).then(resolve,reject)}};return q;
  };
  window.__fixtureHost=host; let proofCallback;window.turnstile={render:(selector,options)=>{proofCallback=options.callback;queueMicrotask(()=>proofCallback('fixture-proof'));return 1},reset:()=>queueMicrotask(()=>proofCallback?.('fixture-proof'))};
  window.supabase={createClient:()=>({storage:{from:bucket=>({upload:async(path,blob,options)=>{const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob)});const result=await send({storage:'upload',bucket,path,base64,contentType:options.contentType});if(result.error?.code==='23505')result.error={statusCode:'409',error:'Duplicate',message:'Fixture duplicate'};return result;},createSignedUrl:path=>send({storage:'sign',bucket,path}),download:async path=>{const result=await send({storage:'sign',bucket,path});if(result.error)return result;const response=await fetch(result.data.signedUrl);return {data:await response.blob(),error:null}}})},auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from,rpc:(name,args)=>send({rpc:name,args}),channel:()=>({on(){return this},subscribe(){return this}}),removeChannel(){},functions:{invoke:async(name,{body}={})=>name==='mixology-bartender'?fetch('/__fixture/bartender',{method:'POST',headers:{'Content-Type':'application/json','x-fixture-host':host},body:JSON.stringify(body)}).then(r=>r.json()):({data:{results:[]}})}})};
 },{host});
}
async function boot(page){await page.goto(origin,{waitUntil:'networkidle'});await page.evaluate(async({W,U,J,K})=>{
 session={user:{id:window.__fixtureHost}};workspace={id:W};profile={display_name:window.__fixtureHost===U?'Nick':'Jenny'};members=[{user_id:U},{user_id:J}];profiles={[U]:{display_name:'Nick'},[J]:{display_name:'Jenny'}};
 state={movies:[],cocktails:await fetch('/__fixture/state').then(r=>r.json()),episodes:[{id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',title:'Recording prep',status:'planning',cocktail_id:K,outline:'Original outline',notes:'Original notes'}],schedule:[],ideas:[],activity:[],traits:[],filterPresets:[],onlineCocktails:[],productionDocuments:{}};
 clOnlineCatalogStatus={loaded:true,loading:false,error:'',updatedAt:null};openCocktailBar();
 },{W,U,J,K});}

return {browser,init,boot,db,origin,setIntakeAddress:value=>{intakeAddress=value},photoBytes:path=>storageBytes.get(path),modelCalls:()=>modelCalls,close:async()=>{await browser.close();await new Promise(r=>server.close(r));await db.close();}};
}
