import {checkIdentity,clean,identity,metadata,norm,researchPrompt,responseText,reportSchema,synthesisPrompt,validateReport,webEvidence} from './engine.mjs';
import '../_shared/movie-content-policy.js';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
class Problem extends Error{constructor(code,status=400){super(code);this.status=status;}}
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const publicRow=row=>row?{movie_id:row.movie_id,workspace_id:row.workspace_id,status:row.status,report:row.report,updated_at:row.updated_at,retry_after:row.retry_after,error_code:row.error_code}:null;
export function createHandler({env,fetcher=fetch,background,now=()=>Date.now()}){
 const base=()=>env('SUPABASE_URL');
 const admin=()=>({Authorization:'Bearer '+env('SUPABASE_SERVICE_ROLE_KEY'),apikey:env('SUPABASE_SERVICE_ROLE_KEY'),'Content-Type':'application/json'});
 async function request(url,options={},timeout=18000){return fetcher(url,{...options,signal:AbortSignal.timeout(timeout)});}
 async function rest(path,options={},headers=admin()){
  const r=await request(base()+'/rest/v1/'+path,{...options,headers:{...headers,...options.headers}});
  if(!r.ok)throw new Problem('research_storage_unavailable',503);
  if(r.status===204)return null;
  const text=await r.text();return text?JSON.parse(text):null;
 }
 async function rpc(name,body){return rest('rpc/'+name,{method:'POST',body:JSON.stringify(body)});}
 async function ai(payload,timeout){
  const r=await request('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+env('OPENAI_API_KEY'),'Content-Type':'application/json'},body:JSON.stringify({model:env('MOVIE_RESEARCH_MODEL')||env('GRIT_LYRICS_MODEL')||'gpt-4.1',store:false,...payload})},timeout);
  if(!r.ok){let error;try{error=(await r.json()).error;}catch{}
   const code=['insufficient_quota','credit_balance_exhausted','billing_hard_limit_reached'].includes(error?.code)||error?.type==='insufficient_quota'?'api_credit_required':r.status===401?'provider_key_rejected':r.status===403?'provider_access_denied':r.status===429?'provider_rate_limited':'provider_unavailable';
   throw new Problem(code,502);
  }
  const data=await r.json();if(data.status!=='completed')throw new Problem('provider_incomplete',502);return data;
 }
 async function fingerprint(movie){const data=JSON.stringify({version:1,...identity(movie),summary:clean(movie.summary)}),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data));return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');}
 async function research(movie,tropes){
  const sources=[],warnings=[],id=identity(movie);let cast=[];
  if(movie.summary)sources.push({id:'saved-synopsis',kind:'saved_synopsis',title:'Saved HQ movie synopsis',url:'',text:clean(movie.summary),provenance:'Saved movie material; not independently verified'});
  if(id.tmdb_id&&env('TMDB_READ_ACCESS_TOKEN')){
   try{
    const r=await request('https://api.themoviedb.org/3/'+id.type+'/'+id.tmdb_id+'?append_to_response=credits,alternative_titles&language=en-US',{headers:{Authorization:'Bearer '+env('TMDB_READ_ACCESS_TOKEN'),accept:'application/json'}},12000);
    if(!r.ok)throw Error('metadata_unavailable');const details=await r.json();if(!checkIdentity(movie,details))throw new Problem('identity_mismatch',422);
    cast=(details.credits?.cast||[]).slice(0,12).map(c=>({name:clean(c.character,100),actor:clean(c.name,100)}));
    const credits=(details.credits?.crew||[]).filter(c=>['Director','Writer','Screenplay'].includes(c.job)).map(c=>({job:c.job,name:clean(c.name,100)}));
    sources.push({id:'tmdb',kind:'metadata',title:'TMDB synopsis and credits',url:'https://www.themoviedb.org/'+id.type+'/'+id.tmdb_id,text:JSON.stringify({title:details.title||details.name,year:id.year,synopsis:clean(details.overview),cast,credits,runtime:details.runtime??null,production_companies:(details.production_companies||[]).map(c=>c.name)}),provenance:'Retrieved metadata for matching movie ID/title/year'});
   }catch(e){if(e.message==='identity_mismatch')throw e;warnings.push('Additional movie metadata was unavailable.');}
  }
  if(!id.tmdb_id&&!/^\d{4}$/.test(id.year))throw new Problem('needs_release_year_or_movie_id',422);
  try{
   const result=await ai({...researchPrompt(movie,cast),tools:[{type:'web_search'}],include:['web_search_call.action.sources'],max_tool_calls:4,max_output_tokens:4400},55000);
   sources.push(...webEvidence(result));
  }catch(e){if(['api_credit_required','provider_key_rejected','provider_access_denied','provider_rate_limited'].includes(e.message))throw e;warnings.push('Extended web research was unavailable; this brief uses the available movie material.');}
  if(!sources.length)throw new Problem('insufficient_sources',422);
  const response=await ai({instructions:synthesisPrompt(movie,sources,tropes),input:'Prepare this movie’s source-attributed production brief now.',max_output_tokens:7200,text:{format:{type:'json_schema',name:'movie_production_brief',strict:true,schema:reportSchema}}},50000);
  let output;try{output=JSON.parse(responseText(response));}catch{throw new Problem('invalid_research_output',502);}
  const report=validateReport(output,movie,sources,tropes);report.warnings.push(...warnings);return report;
 }
 async function drain(workspaceId,movieId){
  const claims=await rpc('claim_requested_movie_research',{p_workspace_id:workspaceId,p_movie_id:movieId}),claim=claims?.[0];if(!claim)return;
  const query=new URLSearchParams({movie_id:'eq.'+claim.movie_id,workspace_id:'eq.'+workspaceId,lease_token:'eq.'+claim.lease_token,status:'eq.generating'});
  try{
   const movies=await rest('movies?'+new URLSearchParams({select:'id,workspace_id,title,summary,tmdb_id,tmdb_type,premiere_date,network,source_metadata,status',id:'eq.'+claim.movie_id,workspace_id:'eq.'+workspaceId,limit:'1'}));
   const movie=movies?.[0];if(!movie||movie.status==='passed'||globalThis.clMovieIsHorror?.(movie))throw new Problem('movie_unavailable',422);
   if(await fingerprint(movie)!==claim.input_hash)throw new Problem('movie_changed_retry',409);
   const tropes=(await rest('cheese_traits?'+new URLSearchParams({select:'id,name,category,recognition',workspace_id:'eq.'+workspaceId,is_active:'eq.true',limit:'200'}))).map(t=>({id:t.id,name:clean(t.name,120),description:clean(JSON.stringify({category:t.category,recognition:t.recognition}),600)}));
   const report=await research(movie,tropes);
   const latest=await rest('movies?'+new URLSearchParams({select:'id,title,summary,tmdb_id,tmdb_type,premiere_date,network,source_metadata,status',id:'eq.'+movie.id,workspace_id:'eq.'+workspaceId,limit:'1'}));
   if(!latest?.[0]||latest[0].status==='passed'||await fingerprint(latest[0])!==claim.input_hash)throw new Problem('movie_changed_retry',409);
   const stamp=new Date(now()).toISOString();
   const updated=await rest('movie_research_briefs?'+query,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:report.coverage==='detailed'?'ready':'limited',report,completed_at:stamp,updated_at:stamp,retry_after:null,error_code:null,lease_token:null})});
   if(updated?.length)await rest('movie_research_versions',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({movie_id:movie.id,workspace_id:workspaceId,report})});
  }catch(error){
   const code=error instanceof Problem?error.message:['identity_mismatch'].includes(error.message)?error.message:'research_failed';
   await rest('movie_research_briefs?'+query,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'error',error_code:code,lease_token:null,updated_at:new Date(now()).toISOString(),retry_after:new Date(now()+30*60000).toISOString()})}).catch(()=>{});
  }
 }
 function start(workspaceId,movieId){const promise=drain(workspaceId,movieId).catch(()=>{});if(background)background(promise);return promise;}
 return async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method==='GET')return json({version:1,ready:!!env('OPENAI_API_KEY')&&!!env('SUPABASE_SERVICE_ROLE_KEY'),ai_ready:!!env('OPENAI_API_KEY'),storage_ready:!!env('SUPABASE_SERVICE_ROLE_KEY'),metadata_ready:!!env('TMDB_READ_ACCESS_TOKEN')});
  if(req.method!=='POST')return json({error:'post_required'},405);
  try{
   const auth=req.headers.get('Authorization')||'';if(!/^Bearer\s+\S+$/i.test(auth))throw new Problem('sign_in_required',401);
   // Only the server's own service credential can run queue continuations.
   const internal=!!env('SUPABASE_SERVICE_ROLE_KEY')&&auth==='Bearer '+env('SUPABASE_SERVICE_ROLE_KEY');
   let headers,user;
   if(!internal){headers={Authorization:auth,apikey:env('SUPABASE_ANON_KEY')||'','Content-Type':'application/json'};const r=await request(base()+'/auth/v1/user',{headers});if(!r.ok)throw new Problem('sign_in_required',401);user=await r.json();if(!user.id)throw new Problem('sign_in_required',401);}
   const raw=await req.text();if(raw.length>4096)throw new Problem('request_too_large',413);let input;try{input=JSON.parse(raw);}catch{throw new Problem('invalid_request');}
   if(!uuid(input.workspace_id))throw new Problem('invalid_workspace');
   if(internal)throw new Problem('internal_actions_disabled',403);
   if(input.action==='prepare_library')throw new Problem('on_demand_only',400);
   if(!['prepare','status','library_status'].includes(input.action))throw new Problem('unknown_action');
   const members=await rest('workspace_members?'+new URLSearchParams({select:'workspace_id',workspace_id:'eq.'+input.workspace_id,user_id:'eq.'+user.id,limit:'1'}),{},headers);if(!members?.length)throw new Problem('workspace_forbidden',403);
   const library=input.action==='library_status';
   if(!library&&!uuid(input.movie_id))throw new Problem('invalid_movie');
   const q=new URLSearchParams({select:'id,workspace_id,title,summary,tmdb_id,tmdb_type,premiere_date,network,source_metadata,status',workspace_id:'eq.'+input.workspace_id,limit:library?'100':'1'});if(!library)q.set('id','eq.'+input.movie_id);else q.set('order','created_at.desc');
   const movies=await rest('movies?'+q,{},headers);if(!library&&!movies?.length)throw new Problem('movie_not_found',404);
   if(input.action==='prepare'){
    if(!env('OPENAI_API_KEY')||!env('SUPABASE_SERVICE_ROLE_KEY'))throw new Problem('research_not_configured',503);
    for(const m of movies)if(m.status!=='passed'&&!globalThis.clMovieIsHorror?.(m))await rpc('request_movie_research',{p_movie_id:m.id,p_workspace_id:input.workspace_id,p_input_hash:await fingerprint(m),p_force:input.action==='prepare'&&input.force===true});
    start(input.workspace_id,input.movie_id);
   }
   const filter=new URLSearchParams({select:'movie_id,workspace_id,status,report,updated_at,retry_after,error_code',workspace_id:'eq.'+input.workspace_id});if(!library)filter.set('movie_id','eq.'+input.movie_id);
   const rows=await rest('movie_research_briefs?'+filter,{},headers);
   return json({briefs:(rows||[]).map(publicRow)},input.action.startsWith('prepare')?202:200);
  }catch(error){return json({error:error instanceof Problem?error.message:'research_unavailable'},error instanceof Problem?error.status:500);}
 };
}
