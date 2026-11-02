import assert from 'node:assert/strict';
const url='https://wgvsnmukiaobcbyqhkkt.supabase.co/functions/v1/grit-lyrics';
const r=await fetch(url,{signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);
const health=await r.json();assert.equal(health.version,2);
console.log('Grit live readiness:',JSON.stringify(health));
const blocked=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'generate'}),signal:AbortSignal.timeout(20000)});
assert.equal(blocked.status,401);console.log('Grit live function rejects unsigned songwriting requests.');
