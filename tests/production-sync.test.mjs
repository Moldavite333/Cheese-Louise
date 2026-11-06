import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../production-sync.js',import.meta.url),'utf8');

function device(server,storage=new Map()){
  const timers=[];
  const state={productionDocuments:{}};
  function query(action,payload){
    const filters={};
    const chain={eq(k,v){filters[k]=v;return chain},select(){return chain},
      async single(){return execute()},async maybeSingle(){return execute()}};
    function execute(){
      const key=`${filters.workspace_id||payload.workspace_id}:${filters.movie_id||payload.movie_id}:${filters.document_type||payload.document_type}`;
      const old=server.get(key);
      if(action==='insert'){
        if(old)return {data:null,error:{code:'23505',message:'duplicate'}};
        const row={...payload};server.set(key,row);return {data:row,error:null};
      }
      if(!old||old.revision!==filters.revision)return {data:null,error:null};
      const row={...old,...payload};server.set(key,row);return {data:row,error:null};
    }
    return chain;
  }
  const context=vm.createContext({state,workspace:{id:'w'},me:()=> 'user',db:{from:table=>{
    assert.equal(table,'production_documents');return {insert:payload=>query('insert',payload),update:payload=>query('update',payload)};
  }},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout:()=>{},console,window:{}});
  vm.runInContext(source,context);
  return {sync:context.window.clProductionSync,state,storage,async flush(){const next=timers.splice(0);for(const fn of next)fn();await new Promise(resolve=>setImmediate(resolve))}};
}

test('a saved Watch Along note is visible on a second device',async()=>{
  const server=new Map(),a=device(server),b=device(server);
  a.sync.save('watch_along','movie',{notes:'Forgotten Holiday observation'});
  await a.flush();
  b.state.productionDocuments['watch_along:movie']={...server.get('w:movie:watch_along')};
  assert.equal(b.sync.read('watch_along','movie',null).notes,'Forgotten Holiday observation');
});

test('a stale device keeps its unsynced edit and cannot replace the newer shared note',async()=>{
  const server=new Map(),a=device(server),b=device(server);
  a.sync.save('watch_along','movie',{notes:'First'});await a.flush();
  const first={...server.get('w:movie:watch_along')};
  a.state.productionDocuments['watch_along:movie']={document:first.document,revision:1};
  b.state.productionDocuments['watch_along:movie']={document:first.document,revision:1};
  b.sync.save('watch_along','movie',{notes:'Phone edit'});
  a.sync.save('watch_along','movie',{notes:'Laptop edit'});await a.flush();await b.flush();
  assert.equal(server.get('w:movie:watch_along').document.notes,'Laptop edit');
  assert.equal(b.sync.status('watch_along','movie'),'conflict');
  assert.equal(b.sync.read('watch_along','movie',null).notes,'Phone edit');
});
