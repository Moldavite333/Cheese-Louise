// Bounded, read-only production availability check for the hourly review.
const base='https://moldavite333.github.io/Cheese-Louise/';
const failures=[];
async function get(url){const response=await fetch(url,{headers:{'Cache-Control':'no-cache','User-Agent':'CheeseLouise-HQ-Health'},signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(response.status+' '+url);return response;}
try{
 const response=await get(base+'?health='+Date.now()),html=await response.text();
 if(!html.includes('Cheese Louise HQ'))failures.push('HQ page title missing');
 const assets=[...new Set([...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)].map(m=>new URL(m[1],base)).filter(url=>url.origin===new URL(base).origin&&url.pathname.startsWith(new URL(base).pathname)).map(String))];
 if(!assets.some(url=>url.includes('movie-content-policy.js')))failures.push('Permanent content policy missing from deployed page');
 let next=0;await Promise.all(Array.from({length:6},async()=>{while(next<assets.length){const url=assets[next++];try{const asset=await get(url),content=await asset.text();if(/^\s*<!doctype html/i.test(content)||/^\s*<html/i.test(content))throw Error('HTML returned for app asset');const type=asset.headers.get('content-type')||'';if(url.includes('.css')&&!type.includes('text/css'))throw Error('Wrong CSS content type: '+type);if(url.includes('.js')&&!/javascript|ecmascript/.test(type))throw Error('Wrong JavaScript content type: '+type);}catch(error){failures.push(url+': '+error.message);}}}));
 const runs=await (await get('https://api.github.com/repos/Moldavite333/Cheese-Louise/actions/runs?per_page=4')).json();
 const latest=new Map();for(const run of runs.workflow_runs||[])if(!latest.has(run.name))latest.set(run.name,{status:run.status,conclusion:run.conclusion,url:run.html_url,commit:run.head_sha});
 for(const [name,run] of latest)if(run.status==='completed'&&!['success','skipped','neutral'].includes(run.conclusion))failures.push(name+' failed: '+run.url);
 console.log(JSON.stringify({checked_at:new Date().toISOString(),site:base,assets_checked:assets.length,workflows:Object.fromEntries(latest),failures,coverage:'Public page/assets and workflow status only; production write workflows require separate authenticated checks.'},null,2));
 if(failures.length)process.exitCode=1;
}catch(error){console.error(error.message);process.exitCode=1;}
