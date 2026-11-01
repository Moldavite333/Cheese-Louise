// Read the public compatibility key through hidden stdin; never log credentials.
import {mkdir,writeFile} from 'node:fs/promises';
import '../supabase/functions/_shared/movie-content-policy.js';
process.stdin.setEncoding('utf8');
if(process.stdin.isTTY)process.stdin.setRawMode(true);
console.log('Ready for recommendation check JSON on stdin (input is hidden).');
const input=await new Promise(resolve=>{let raw='';process.stdin.on('data',chunk=>{raw+=chunk;try{const parsed=JSON.parse(raw.trim());process.stdin.pause();resolve(parsed);}catch{}})});
if(process.stdin.isTTY)process.stdin.setRawMode(false);
const start=Date.now();
console.log('Checking live movie data…');
const response=await fetch('https://wgvsnmukiaobcbyqhkkt.supabase.co/functions/v1/'+(input.function||'recommend-romantiverse'),{method:'POST',headers:{Authorization:'Bearer '+input.key,apikey:input.key,'Content-Type':'application/json'},body:JSON.stringify(input.body||{}),signal:AbortSignal.timeout(90000)});
const data=await response.json();await mkdir('artifacts',{recursive:true});await writeFile('artifacts/recommendations-live.json',JSON.stringify(data,null,2));
const horrorCount=(data.results||[]).filter(clMovieIsHorror).length;
const posterChecks=await Promise.all((data.results||[]).slice(0,3).map(async movie=>{try{const r=await fetch(movie.poster_url,{method:'HEAD',signal:AbortSignal.timeout(10000)});return {title:movie.title,status:r.status,type:r.headers.get('content-type')};}catch{return {title:movie.title,status:'failed'}}}));
console.log(JSON.stringify({status:response.status,seconds:(Date.now()-start)/1000,error:data.error,count:data.count,horrorCount,matched:data.matched_favorites,unmatched:data.unmatched_favorites,scanned:data.scanned,eligible:data.eligible_count,posterChecks,diagnostics:data.diagnostics,
 results:(data.results||[]).slice(0,24).map(m=>({title:m.title,poster:Boolean(m.poster_url),score:m.recommendation_score,why:m.why,verified:m.verified,reason:m.reason,tmdb_id:m.tmdb_id}))}));
if(!response.ok||horrorCount)process.exitCode=1;
