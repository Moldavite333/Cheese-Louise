// Revision-aware draft buffer. Storage and remote persistence are injected for testing.
(function(root){
  'use strict';
  const C=root.clMixologyCore;
  class DraftStore {
    constructor({key,storage,remote,token=C.id,validate=C.validate,onStatus=()=>{}}){Object.assign(this,{key,storage,remote,token,validate,onStatus});this.status='loading';this.generation=0;this.running=null;this.diskToken=null;this.conflict=false;this.undoStack=[];}
    report(status,message=''){this.status=status;this.message=message;this.onStatus(this);}
    readDisk(){const raw=this.storage.getItem(this.key);return raw?JSON.parse(raw):null;}
    open(row){
      this.row=C.clone(row);this.document=C.clone(row.document);this.base=row.revision;this.dirty=false;
      try{
        const pending=this.readDisk();this.diskToken=pending?.token||null;
        if(pending&&pending.document){this.document=C.clone(pending.document);this.dirty=!C.equal(this.document,row.document);this.base=this.dirty?pending.base:row.revision;this.conflict=this.dirty&&this.base!==row.revision;}
        this.report(this.conflict?'conflict':this.dirty?'pending':'saved');
      }catch{this.storageFailed=true;this.report('storage','Browser recovery storage is unavailable. Keep this page open or export your draft.');}
      return this;
    }
    persist(){
      if(this.localConflict)return false;
      try{
        const disk=this.readDisk();
        if((disk?.token||null)!==this.diskToken){this.localConflict=true;this.conflict=true;this.report('conflict','Another tab changed this draft. Your text is kept here; export it before loading the shared draft.');return false;}
        const token=this.token();this.storage.setItem(this.key,JSON.stringify({token,base:this.base,document:this.document,row:this.row}));this.diskToken=token;this.storageFailed=false;return true;
      }catch{this.storageFailed=true;this.report('storage','Browser recovery could not save. Keep this page open or export your draft.');return false;}
    }
    change(mutator){
      this.undoStack.push(C.clone(this.document));if(this.undoStack.length>40)this.undoStack.shift();
      mutator(this.document);this.generation++;this.dirty=true;this.persist();
      if(!this.storageFailed&&!this.conflict)this.report('pending');
    }
    undo(){const doc=this.undoStack.pop();if(!doc)return;this.document=doc;this.generation++;this.dirty=true;this.persist();if(!this.storageFailed&&!this.conflict)this.report('pending');}
    async flush(){
      if(this.running){await this.running;if(this.dirty&&!this.conflict&&this.status!=='error'&&this.status!=='invalid')return this.flush();return !this.dirty;}
      if(!this.dirty)return true;
      if(this.conflict){this.report('conflict',this.message);return false;}
      try{this.validate(this.document);}catch(error){this.report('invalid',error.message);return false;}
      // Detect a newer same-account tab even when this tab has not typed since opening.
      if(!this.persist()&&this.conflict)return false;
      const generation=this.generation,document=C.clone(this.document),revision=this.base;
      this.report('saving');
      this.running=(async()=>{
        try{
          const row=await this.remote(document,revision);this.row=C.clone(row);this.base=row.revision;
          this.dirty=this.generation!==generation;
          // Keep the latest draft as the next base. Never replace edits made during the request.
          this.persist();
          if(this.conflict)return false;
          if(this.dirty){if(!this.storageFailed)this.report('pending');}
          else this.report(this.storageFailed?'storage':'saved',this.storageFailed?'Shared draft saved; browser recovery is unavailable.':'');
          return !this.dirty;
        }catch(error){
          this.conflict=error.code==='40001'||/draft_conflict/.test(error.message||'');
          this.report(this.conflict?'conflict':'error',this.conflict?'A newer shared draft exists. Your edits are kept for comparison or export.':'Shared save failed. Your draft is kept here; retry when connected.');return false;
        }
      })();
      try{await this.running;}finally{this.running=null;}
      if(this.dirty&&!this.conflict&&this.status==='pending')return this.flush();
      return !this.dirty&&!this.conflict;
    }
    // Only explicit conflict resolution may replace the current document/base.
    resolve(row,keepMine){
      const mine=C.clone(this.document);this.conflict=false;this.localConflict=false;
      try{this.diskToken=this.readDisk()?.token||null;}catch{this.diskToken=null;}
      this.row=C.clone(row);this.base=row.revision;this.document=keepMine?mine:C.clone(row.document);this.dirty=keepMine&&!C.equal(mine,row.document);this.generation++;
      this.persist();if(!this.storageFailed&&!this.conflict)this.report(this.dirty?'pending':'saved');
    }
  }
  root.clMixologyDraftStore=DraftStore;
  if(typeof module!=='undefined'&&module.exports)module.exports=DraftStore;
})(typeof window==='undefined'?globalThis:window);
