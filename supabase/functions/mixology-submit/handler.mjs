import '../_shared/mixology-submission-contract.js';
const S=globalThis.clMixologySubmissionCore;
const PROOF_URL='https://challenges.cloudflare.com/turnstile/v0/siteverify';
function config(env){
 try{const url=new URL(env('SUPABASE_URL')||''),origin=new URL(env('MIXOLOGY_SUBMISSIONS_ALLOWED_ORIGIN')||''),header=env('MIXOLOGY_SUBMISSIONS_TRUSTED_IP_HEADER');const local=['localhost','127.0.0.1'].includes(origin.hostname);
  if(env('MIXOLOGY_SUBMISSIONS_ENABLED')!=='true'||url.protocol!=='https:'||url.username||url.password||origin.origin!==env('MIXOLOGY_SUBMISSIONS_ALLOWED_ORIGIN')||(!local&&origin.protocol!=='https:')||!['x-forwarded-for','cf-connecting-ip'].includes(header)||!S.uuid(env('MIXOLOGY_SUBMISSIONS_WORKSPACE_ID'))||!(env('MIXOLOGY_SUBMISSIONS_HASH_SECRET')?.length>=32)||!env('MIXOLOGY_SUBMISSIONS_CAPTCHA_SECRET')||!env('SUPABASE_SERVICE_ROLE_KEY'))return null;
  return {url:url.origin,origin:origin.origin,hostname:origin.hostname,workspace:env('MIXOLOGY_SUBMISSIONS_WORKSPACE_ID'),header,hashSecret:env('MIXOLOGY_SUBMISSIONS_HASH_SECRET'),captchaSecret:env('MIXOLOGY_SUBMISSIONS_CAPTCHA_SECRET'),serviceKey:env('SUPABASE_SERVICE_ROLE_KEY')};
 }catch{return null;}
}
async function readBody(request){const reader=request.body?.getReader();if(!reader)throw Error('invalid');const chunks=[];let length=0,timer;
 try{return await Promise.race([(async()=>{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>750000)throw Error('large');chunks.push(value);}const buffer=new Uint8Array(length);let at=0;for(const chunk of chunks){buffer.set(chunk,at);at+=chunk.length;}let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer));}catch{throw Error(length>20000?'large':'invalid');}if(value?.document?.schemaVersion!==3&&length>20000)throw Error('large');return value;})(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),5000);})]);}
 finally{clearTimeout(timer);try{await reader.cancel()}catch{}}
}
async function hmac(secret,value){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const digest=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value));return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');}
export function createHandler({env,fetcher=fetch,now=()=>new Date(),sanitizePhoto}={}){return async request=>{
 const c=config(env),origin=request.headers.get('origin');
 const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...(c&&origin===c.origin?{'Access-Control-Allow-Origin':c.origin,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'content-type','Vary':'Origin'}:{})}});
 if(!c)return reply(503,{error:'intake_disabled'});
 const photosEnabled=env('MIXOLOGY_SUBMISSIONS_PHOTOS_ENABLED')==='true'&&typeof sanitizePhoto==='function';
 if(request.method==='GET')return reply(200,{enabled:true,photosEnabled});
 if(origin!==c.origin)return reply(403,{error:'origin_not_allowed'});
 if(request.method==='OPTIONS')return reply(200,{ok:true});
 if(request.method!=='POST')return reply(405,{error:'method_not_allowed'});
 if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return reply(415,{error:'json_required'});
 if(Number(request.headers.get('content-length'))>750000)return reply(413,{error:'request_too_large'});
 let body;try{body=S.packet(await readBody(request));}catch(error){return reply(error.message==='large'?413:400,{error:error.message==='large'?'request_too_large':'invalid_submission'});}
 if(body.image&&!photosEnabled)return reply(503,{error:'intake_photos_disabled'});
 const address=(request.headers.get(c.header)||'').split(',')[0].trim();if(!address||address.length>64||!/^[0-9a-f:.]+$/i.test(address))return reply(503,{error:'intake_gateway_unverified'});
 const rpc=async(name,args)=>{const response=await fetcher(c.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json',apikey:c.serviceKey,Authorization:'Bearer '+c.serviceKey},body:JSON.stringify(args),signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('database_unavailable');return response.json();};
 const digest=await hmac(c.hashSecret,c.workspace+'|'+JSON.stringify(body.document)+(body.image?'|'+body.image:'')),subject=await hmac(c.hashSecret,now().toISOString().slice(0,10)+'|'+address),lease=crypto.randomUUID();let acquired=false;
 try{const result=await rpc('mixology_submission_reserve',{p_workspace:c.workspace,p_request:body.requestId,p_digest:digest,p_subject:subject,p_lease:lease});
  if(result.status==='received')return reply(200,{received:true});
  if(result.status==='limited')return reply(429,{error:'intake_limited'});
  if(result.status!=='acquired')return reply(409,{error:result.status==='running'?'request_in_progress':result.status==='mismatch'?'request_changed':'previous_attempt_failed'});
  acquired=true;
  const response=await fetcher(PROOF_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:c.captchaSecret,response:body.proof,idempotency_key:lease}),signal:AbortSignal.timeout(8000)});let proof;try{proof=response.ok?await response.json():null}catch{proof=null;}
  const valid=proof?.success===true&&proof.hostname===c.hostname&&proof.action==='mixology_listener';
  let photo;if(valid&&body.image){try{photo=await sanitizePhoto(body.image);}catch{await rpc('mixology_submission_finish',{p_workspace:c.workspace,p_request:body.requestId,p_lease:lease,p_digest:digest,p_document:null,p_valid:false});return reply(422,{error:'invalid_photo'});}}
  await rpc(photo?'mixology_listener_photo_finish':'mixology_submission_finish',{p_workspace:c.workspace,p_request:body.requestId,p_lease:lease,p_digest:digest,p_document:valid?body.document:null,p_valid:valid,...(photo?{p_photo:photo}:{})});
  return valid?reply(200,{received:true}):reply(422,{error:'verification_failed'});
 }catch{if(acquired){try{await rpc('mixology_submission_finish',{p_workspace:c.workspace,p_request:body.requestId,p_lease:lease,p_digest:digest,p_document:null,p_valid:false})}catch{}}
  return reply(503,{error:'intake_unavailable'});
 }
};}
