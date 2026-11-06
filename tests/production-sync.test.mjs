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

test('existing Watch Along notes from two devices are combined before sharing',async()=>{
  const server=new Map(),phone=device(server),laptop=device(server);
  server.set('w:movie:watch_along',{workspace_id:'w',movie_id:'movie',document_type:'watch_along',revision:1,document:{notes:'Phone observation',outlineItems:[{id:'phone',text:'Phone point'}]}});
  laptop.state.productionDocuments['watch_along:movie']={...server.get('w:movie:watch_along')};
  const merged=laptop.sync.read('watch_along','movie',{notes:'Laptop observation',outlineItems:[{id:'laptop',text:'Laptop point'}]});
  assert.match(merged.notes,/Phone observation/);
  assert.match(merged.notes,/Laptop observation/);
  assert.equal(merged.outlineItems.length,2);
  await laptop.flush();
  phone.state.productionDocuments['watch_along:movie']={...server.get('w:movie:watch_along')};
  assert.equal(phone.sync.read('watch_along','movie',null).notes,merged.notes);
  const reopened=device(server,laptop.storage);
  reopened.state.productionDocuments['watch_along:movie']={...server.get('w:movie:watch_along')};
  assert.equal(reopened.sync.read('watch_along','movie',{notes:'Laptop observation',outlineItems:[{id:'laptop',text:'Laptop point'}]}).notes,merged.notes);
  await reopened.flush();
  assert.equal(server.get('w:movie:watch_along').revision,2);
});

test('a preexisting recording on another device remains available when shared content differs',async()=>{
  const server=new Map(),laptop=device(server);
  server.set('w:movie:recording',{workspace_id:'w',movie_id:'movie',document_type:'recording',revision:1,document:{session:{markers:[{note:'Phone'}]}}});
  laptop.state.productionDocuments['recording:movie']={...server.get('w:movie:recording')};
  const local={session:{markers:[{note:'Laptop'}]}};
  assert.equal(laptop.sync.read('recording','movie',local).session.markers[0].note,'Laptop');
  assert.equal(laptop.sync.status('recording','movie'),'conflict');
  assert.equal(await laptop.sync.save('recording','movie',local),false);
  await laptop.flush();
  assert.equal(server.get('w:movie:recording').document.session.markers[0].note,'Phone');
  const reopened=device(server,laptop.storage);
  reopened.state.productionDocuments['recording:movie']={...server.get('w:movie:recording')};
  assert.equal(reopened.sync.read('recording','movie',null).session.markers[0].note,'Laptop');
  assert.equal(reopened.sync.status('recording','movie'),'conflict');
});

test('a known local snapshot does not become a false conflict after a remote update',()=>{
  const server=new Map(),storage=new Map();
  const old={session:{markers:[{note:'Original'}]}};
  server.set('w:movie:recording',{workspace_id:'w',movie_id:'movie',document_type:'recording',revision:1,document:old});
  const first=device(server,storage);first.state.productionDocuments['recording:movie']={...server.get('w:movie:recording')};
  assert.equal(first.sync.read('recording','movie',old).session.markers[0].note,'Original');
  server.set('w:movie:recording',{...server.get('w:movie:recording'),revision:2,document:{session:{markers:[{note:'New remote'}]}}});
  const second=device(server,storage);second.state.productionDocuments['recording:movie']={...server.get('w:movie:recording')};
  assert.equal(second.sync.read('recording','movie',old).session.markers[0].note,'New remote');
  assert.equal(second.sync.status('recording','movie'),'saved');
  const third=device(server,storage);third.state.productionDocuments['recording:movie']={...server.get('w:movie:recording')};
  assert.equal(third.sync.read('recording','movie',old).session.markers[0].note,'New remote');
  assert.equal(third.sync.status('recording','movie'),'saved');
});
