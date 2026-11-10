import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,as,U,J,O,W,B,K} from './fixtures/mixology-db.mjs';
const q=async(db,sql,args=[])=>(await db.query(sql,args)).rows;
test('version approval: either host, immutable attribution, exact version and independent counterparts',async()=>{
 const db=await setup({approval:true});try{
 const r=(await q(db,'select to_jsonb(mixology_start($1,$2,$3,null)) r',[W,K,'alcoholic']))[0].r;
 const v=(await q(db,'select * from mixology_versions where recipe_id=$1',[r.id]))[0];
 const decide=async(id,decision,version=v.id)=>(await q(db,'select to_jsonb(mixology_decide($1,$2,$3)) a',[id,version,decision]))[0].a;
 const id=crypto.randomUUID(),a=await decide(id,'approved');assert.equal(a.host_id,U);assert.equal((await decide(id,'approved')).id,id);
 await assert.rejects(()=>decide(id,'withdrawn'),/retry_mismatch/);
 await as(db,J);const withdrawal=await decide(crypto.randomUUID(),'withdrawn');assert.equal(withdrawal.host_id,J);await decide(crypto.randomUUID(),'approved');
 await assert.rejects(()=>q(db,'update mixology_approvals set decision=$1',['withdrawn']),/permission denied/);
 await assert.rejects(()=>q(db,'delete from mixology_approvals'),/permission denied/);
 await assert.rejects(()=>q(db,'insert into mixology_approvals(id,workspace_id,version_id,decision,host_id) values($1,$2,$3,$4,$5)',[crypto.randomUUID(),W,v.id,'approved',U]),/attribution|row-level/);
 await assert.rejects(()=>q(db,'insert into mixology_approvals(id,workspace_id,version_id,decision) values($1,$2,$3,$4)',[crypto.randomUUID(),B,v.id,'approved']),/version_unavailable|foreign key/);
 await as(db,O);assert.equal((await q(db,'select * from mixology_approvals')).length,0);await assert.rejects(()=>decide(crypto.randomUUID(),'approved'),/version_unavailable/);
 await db.exec('reset role;set role anon');await assert.rejects(()=>q(db,'select * from mixology_approvals'),/permission denied/);
 await as(db,U);const d={...r.document,notes:'Changed after approval'};await q(db,'select mixology_save($1,$2,$3)',[r.id,r.revision,d]);assert.equal((await q(db,'select * from mixology_approvals where version_id=$1',[v.id])).length,3);assert.equal((await q(db,'select * from mixology_tastings')).length,0);
 const af=(await q(db,'select to_jsonb(mixology_start($1,$2,$3,$4)) r',[W,K,'alcohol_free',{...d,ingredients:[],steps:[]}]))[0].r;
 const checkpoint=(await q(db,'select mixology_checkpoint($1,$2,$3) r',[af.id,af.revision,crypto.randomUUID()]))[0].r;
 await assert.rejects(()=>decide(crypto.randomUUID(),'approved',checkpoint.version.id),/complete_recipe/);
 }finally{await db.close();}
});
