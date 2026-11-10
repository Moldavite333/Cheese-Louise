// Pure production plan validation and private recording text. No network or recipe mutation.
(function(root){
  'use strict';
  const stages={shopping:'Shopping',make_ahead:'Make ahead',waiting:'Waiting',assembly:'Recording day'};
  const clone=value=>JSON.parse(JSON.stringify(value));
  function blank(servings=1){return {schemaVersion:1,servings,tasks:[],sources:[],connection:'',history:'',talkingPoints:'',reviewed:false};}
  function sourceUrl(value){try{const u=new URL(value);return /^https:\/\/[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]+)?([/?#][^\s]*)?$/.test(value)&&u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
  const text=(v,max)=>typeof v==='string'&&v.length<=max;
  const exact=(r,keys)=>r&&typeof r==='object'&&!Array.isArray(r)&&Object.keys(r).length===keys.length&&Object.keys(r).every(k=>keys.includes(k));
  function validate(d){
    if(!exact(d,['schemaVersion','servings','tasks','sources','connection','history','talkingPoints','reviewed'])||d.schemaVersion!==1||!Number.isFinite(d.servings)||d.servings<=0||d.servings>1000||typeof d.reviewed!=='boolean'||!['connection','history','talkingPoints'].every(k=>text(d[k],4000))||!Array.isArray(d.tasks)||d.tasks.length>50||!Array.isArray(d.sources)||d.sources.length>20||JSON.stringify(d).length>65536)throw Error('Preparation plan is invalid or too large. Keep up to 50 tasks and 20 sources.');
    for(const [kind,rows] of [['task',d.tasks],['source',d.sources]]){
      const ids=new Set();for(const r of rows){
        if(!r||!text(r.id,80)||!/^[A-Za-z0-9_-]{1,80}$/.test(r.id)||ids.has(r.id))throw Error('Each '+kind+' needs a unique identity.');ids.add(r.id);
        if(kind==='task'){
          if(!exact(r,['id','text','stage','storage','done','activeMinutes','passiveMinutes'])||!text(r.text,2000)||!r.text.trim()||!Object.hasOwn(stages,r.stage)||!text(r.storage,2000)||typeof r.done!=='boolean'||['activeMinutes','passiveMinutes'].some(k=>r[k]!==null&&(!Number.isFinite(r[k])||r[k]<0||r[k]>10080)))throw Error('Name each task and use nonnegative minutes, or leave timing unknown.');
        }else if(!exact(r,['id','title','url','retrievedOn'])||!text(r.title,200)||!r.title.trim()||!text(r.url,2000)||!sourceUrl(r.url)||!/^\d{4}-\d{2}-\d{2}$/.test(r.retrievedOn)||!Number.isFinite(Date.parse(r.retrievedOn))||new Date(r.retrievedOn).toISOString().slice(0,10)!==r.retrievedOn)throw Error('Each source needs a title, HTTPS link and valid retrieval date.');
      }
    }return d;
  }
  function timeline(d){validate(d);return Object.entries(stages).map(([id,label])=>{const tasks=d.tasks.filter(t=>t.stage===id);return {id,label,tasks:clone(tasks),done:tasks.filter(t=>t.done).length,total:tasks.length,active:tasks.reduce((n,t)=>n+(t.activeMinutes??0),0),passive:tasks.reduce((n,t)=>n+(t.passiveMinutes??0),0),unknown:tasks.filter(t=>t.activeMinutes===null||t.passiveMinutes===null).length};});}
  function packetText(packet,name=id=>'Host'){
    const d=packet.document,p=validate(d.preparation),r=d.recipe;
    const scaled=root.clMixologyPrep?.plan(r,p.servings);
    const observations=d.observations.map(t=>name(t.hostId)+': '+[t.makeAgain?'make again '+t.makeAgain:'',t.flags.map(f=>f.replace(/_/g,' ')).join(', '),t.comment].filter(Boolean).join(' · '));
    return ['Cheesy Concoction · PRIVATE RECORDING PREP',r.name+' · v'+d.versionNumber,'Saved recipe version: '+d.versionId,'Episode: '+(d.episodeId||'Standalone rehearsal'),'Approval at packet creation: '+packet.approval_id,'Approval can change later; check HQ before recording.','',p.connection&&'Movie connection (host reviewed): '+p.connection,p.history&&'History / preparation context (host entered): '+p.history,p.talkingPoints&&'Optional discussion points: '+p.talkingPoints,'','Recipe · serves '+r.servings,...r.ingredients.map(i=>[i.quantity,i.unit,i.name].filter(Boolean).join(' ')),...r.steps.map((s,i)=>(i+1)+'. '+s.text),'Glass: '+(r.glassware||'Not specified'),'Garnish: '+(r.garnish||'Not specified'),'','Preparation target: '+p.servings+' servings.',...(scaled?scaled.ingredients.flatMap(i=>[(root.clMixologyPrep.amount(i.quantity)===null?'Unscaled original description: ':'')+[i.scaledQuantity,i.unit,i.name].filter(Boolean).join(' '),...i.notes]):['Scaled amounts unavailable; check the plan in HQ.']),...timeline(p).flatMap(s=>s.tasks.length?[s.label,...s.tasks.map(t=>(t.done?'[x] ':'[ ] ')+t.text+' · active '+(t.activeMinutes??'unknown')+' min · waiting '+(t.passiveMinutes??'unknown')+' min'+(t.storage?' · Storage: '+t.storage:''))]:[]),'','Actual tasting observations (host entered; review before reading aloud):',...(observations.length?observations:['No tasting recorded. Approval does not establish tasting.']),'','Sources (host entered; no automatic verification):',...p.sources.map(s=>s.title+' · '+s.url+' · retrieved '+s.retrievedOn),'','This is an immutable private snapshot. Later recipe, plan, tasting or approval changes do not rewrite it.'].filter(v=>v!==false).join('\n');
  }
  const api={blank,validate,sourceUrl,timeline,packetText,stages};root.clMixologyProductionCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
