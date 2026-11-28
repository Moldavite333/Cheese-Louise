import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup,as,U,J,O,W,K} from './fixtures/mixology-db.mjs';

test('only workspace members can delete unused drafts; versions and episode links are protected',async()=>{
 const db=await setup({stage2:true});
 try{
  await db.exec('reset role');
  await db.exec(await readFile(new URL('../supabase/migrations/20261128090000_mixology_discard_draft.sql',import.meta.url),'utf8'));
  await as(db,U);
  const id=crypto.randomUUID();
  const document={schemaVersion:1,name:'Untitled cocktail',servings:1,ingredients:[],steps:[],glassware:'',garnish:'',notes:''};
  const start=(id)=>db.query('select mixology_start($1,$2,$3,$4)',[W,id,'alcoholic',document]);
  const discard=(id)=>db.query('select mixology_discard_draft($1,$2) as deleted',[W,id]);
  await start(id);
  await as(db,O);
  await assert.rejects(discard(id),/workspace_forbidden/);
  await as(db,J);
  await db.exec('reset role');
  const episode=crypto.randomUUID();
  await db.query('insert into episodes(id,workspace_id,cocktail_id) values($1,$2,$3)',[episode,W,id]);
  await as(db,J);
  await assert.rejects(discard(id),/linked or has a saved version/);
  await db.exec('reset role');
  await db.query('delete from episodes where id=$1',[episode]);
  await as(db,J);
  assert.equal((await discard(id)).rows[0].deleted,true);
  assert.equal((await discard(id)).rows[0].deleted,false);
  assert.equal((await db.query('select id from mixology_recipes where cocktail_id=$1',[id])).rows.length,0);
  await start(K);
  await assert.rejects(discard(K),/linked or has a saved version/);
 }finally{await db.close();}
});
