// Browser/server contract. Proposals are data; this module never writes a recipe.
(function(root){
  'use strict';
  const C=root.clMixologyCore,uuid=value=>typeof value==='string'&&/^[0-9a-f-]{36}$/i.test(value);
  const fields={set_name:'name',set_servings:'servings',set_glassware:'glassware',set_garnish:'garnish',set_notes:'notes'};
  const operationKinds=[...Object.keys(fields),'upsert_ingredient','remove_ingredient','move_ingredient','upsert_step','remove_step','move_step'];
  const properties={kind:{type:'string',enum:operationKinds},id:{type:['string','null']},name:{type:['string','null']},quantity:{type:['string','null']},unit:{type:['string','null']},text:{type:['string','null']},value:{type:['string','null']},position:{type:['integer','null']}};
  const responseSchema={type:'object',properties:{reply:{type:'string'},evidence_ids:{type:'array',items:{type:'string'}},operations:{type:'array',items:{type:'object',properties,required:Object.keys(properties),additionalProperties:false}}},required:['reply','evidence_ids','operations'],additionalProperties:false};
  function applyOperations(base,operations,newIds=[]){
    C.validate(base);if(!Array.isArray(operations)||operations.length>12)throw Error('Use at most twelve recipe changes per proposal.');
    const next=C.clone(base),newSet=new Set(newIds);
    for(const op of operations){
      if(!op||!operationKinds.includes(op.kind)||Object.keys(op).some(k=>!Object.hasOwn(properties,k)))throw Error('Unsupported recipe operation.');
      const allowed=new Set(['kind']);
      if(fields[op.kind]){allowed.add('value');if(typeof op.value!=='string')throw Error('Missing recipe value.');next[fields[op.kind]]=op.kind==='set_servings'?Number(op.value):op.value;}
      else{
        allowed.add('id');if(typeof op.id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(op.id))throw Error('Invalid recipe row identity.');
        const ingredient=op.kind.endsWith('ingredient'),key=ingredient?'ingredients':'steps',rows=next[key],i=rows.findIndex(r=>r.id===op.id);
        if(op.kind.startsWith('upsert_')){
          if(i<0&&!newSet.has(op.id))throw Error('New recipe rows must use the supplied new identities.');
          let row;
          if(ingredient){for(const k of ['name','quantity','unit']){allowed.add(k);if(typeof op[k]!=='string')throw Error('Incomplete ingredient change.');}row={id:op.id,name:op.name,quantity:op.quantity,unit:op.unit};}
          else{allowed.add('text');if(typeof op.text!=='string')throw Error('Incomplete preparation change.');row={id:op.id,text:op.text};}
          if(i<0)rows.push(row);else rows[i]=row;
        }else if(op.kind.startsWith('remove_')){if(i<0)throw Error('That recipe row no longer exists.');rows.splice(i,1);}
        else{allowed.add('position');if(i<0||!Number.isInteger(op.position)||op.position<0||op.position>=rows.length)throw Error('Invalid row position.');rows.splice(op.position,0,rows.splice(i,1)[0]);}
      }
      for(const [key,value] of Object.entries(op))if(!allowed.has(key)&&value!==null)throw Error('Unexpected value in recipe operation.');
    }
    return C.validate(next);
  }
  function proposal(base,revision,output,newIds){
    if(!output||typeof output.reply!=='string'||output.reply.length>3000)throw Error('Invalid bartender reply.');
    return {id:C.id(),baseRevision:revision,baseDocument:C.clone(base),reply:output.reply,operations:C.clone(output.operations),newIds:C.clone(newIds),document:applyOperations(base,output.operations,newIds)};
  }
  function applyProposal(current,pending){if(!pending||!C.equal(current,pending.baseDocument))throw Error('The recipe changed after this proposal. Ask for a fresh proposal before applying it.');const next=applyOperations(current,pending.operations,pending.newIds);if(!C.equal(next,pending.document))throw Error('The proposal preview is inconsistent.');return next;}
  function blankWorkshop(){return {schemaVersion:1,brief:'',input:'',concepts:[],research:null,pending:null,messages:[],ignoredTastings:[]};}
  function validateWorkshop(d){
    if(!d||d.schemaVersion!==1||typeof d.brief!=='string'||d.brief.length>2000||typeof d.input!=='string'||d.input.length>2000||!Array.isArray(d.messages)||d.messages.length>40||!Array.isArray(d.concepts)||d.concepts.length>5||!Array.isArray(d.ignoredTastings)||d.ignoredTastings.length>100||d.ignoredTastings.some(x=>!uuid(x))||JSON.stringify(d).length>131072)throw Error('Workshop is too large or has an invalid structure. Export it before clearing older material.');
    for(const m of d.messages)if(!m||!uuid(m.id)||!['user','assistant','note'].includes(m.role)||typeof m.text!=='string'||m.text.length>3000||typeof m.createdAt!=='string')throw Error('Invalid workshop message.');
    for(const c of d.concepts)if(!c||!uuid(c.id)||['name','foundation','family','spirit','ingredients','sourceUrl','retrievedAt','context','effort'].some(k=>typeof c[k]!=='string')||!Array.isArray(c.why)||c.why.some(x=>typeof x!=='string'))throw Error('Invalid source concept.');
    if(d.research){const r=d.research;if(!['complete','partial','unavailable'].includes(r.status)||typeof r.originality!=='string'||!Array.isArray(r.warnings)||r.warnings.some(x=>typeof x!=='string')||!Array.isArray(r.sources)||r.sources.some(x=>!x||typeof x.name!=='string'||typeof x.url!=='string'||typeof x.retrievedAt!=='string'||x.comparison&&(['shared','oursOnly','sourceOnly'].some(k=>!Array.isArray(x.comparison[k])||x.comparison[k].some(v=>typeof v!=='string'))||typeof x.comparison.note!=='string')))throw Error('Invalid research record.');if(r.document)C.validate(r.document);if(r.baseDocument)C.validate(r.baseDocument);}
    if(d.pending)applyProposal(d.pending.baseDocument,d.pending);
    return d;
  }
  // Only explicit confirmed chips participate. Free comments remain original evidence.
  function tasteEvidence(rows,versions,{now=Date.now(),excluded=[]}={}){
    const versionMap=new Map(versions.map(v=>[v.id,v])),groups=new Map(),seen=new Set(),exclude=new Set(excluded);
    const directions={too_sweet:['sweetness','less'],not_sweet_enough:['sweetness','more'],too_tart:['acidity','less'],not_tart_enough:['acidity','more'],too_bitter:['bitterness','less'],too_strong:['strength','less'],too_much_effort:['effort','less']};
    // Corrections supersede the same observation; repeated entries in one recipe/day are one sample.
    const ordered=[...rows].sort((a,b)=>String(b.updated_at||b.created_at).localeCompare(String(a.updated_at||a.created_at)));
    for(const row of ordered){const v=versionMap.get(row.version_id),time=Date.parse(row.created_at);if(!v||exclude.has(row.id)||!Number.isFinite(time)||time>now+86400000||time<now-180*86400000)continue;
      for(const flag of row.flags||[]){const direction=directions[flag];if(!direction)continue;const [dimension,value]=direction,key=row.host_id+':'+dimension,occasion=v.recipe_id+':'+String(row.created_at).slice(0,10),dedupe=key+':'+occasion;
        if(seen.has(dedupe))continue;
        // Contradictory chips on the same observation must not pick a direction by array order.
        const conflicting=(row.flags||[]).some(f=>directions[f]?.[0]===dimension&&directions[f]?.[1]!==value);
        seen.add(dedupe);const g=groups.get(key)||{hostId:row.host_id,dimension,less:[],more:[],conflicts:[]};g[conflicting?'conflicts':value].push({id:row.id,versionId:v.id,recipeId:v.recipe_id,date:row.created_at});groups.set(key,g);
      }
    }
    return [...groups.values()].map(g=>{const direction=g.less.length>=g.more.length?'less':'more',support=g[direction],against=g[direction==='less'?'more':'less'];return {...g,direction,tentative:support.length>=3&&support.length>2*against.length&&g.conflicts.length===0,evidenceIds:support.map(x=>x.id),sampleCount:g.less.length+g.more.length+g.conflicts.length};});
  }
  function possibleSignals(comment){
    if(typeof comment!=='string')return [];
    const phrase=comment.trim().toLowerCase().replace(/[.!]$/,'').replace(/^(?:this (?:one )?is|it is|it's|i find (?:it|this))\s+/,'').replace(/\s+for me$/,'');
    const rules={'too sweet':'too_sweet','not sweet enough':'not_sweet_enough','too tart':'too_tart','too sour':'too_tart','too bitter':'too_bitter','too strong':'too_strong'};return rules[phrase]?[rules[phrase]]:[];
  }
  const api={responseSchema,operationKinds,applyOperations,proposal,applyProposal,blankWorkshop,validateWorkshop,tasteEvidence,possibleSignals};root.clMixologyWorkshop=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
