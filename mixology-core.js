// Pure recipe operations shared by the editor and fixture tests. No network or storage.
(function(root){
  'use strict';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
  const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  const id=()=>globalThis.crypto.randomUUID();
  function validate(doc){
    if(!doc||doc.schemaVersion!==1||typeof doc.name!=='string'||!doc.name.trim()||doc.name.length>160)throw Error('Give the recipe a name (up to 160 characters).');
    if(!Number.isFinite(doc.servings)||doc.servings<=0||doc.servings>1000)throw Error('Servings must be between 0 and 1,000.');
    for(const [key,fields] of [['ingredients',['id','name','quantity','unit']],['steps',['id','text']]]){
      if(!Array.isArray(doc[key])||doc[key].length>100)throw Error('Use at most 100 '+key+'.');
      const seen=new Set();
      for(const row of doc[key]){
        if(!row||fields.some(field=>typeof row[field]!=='string')||!/^[A-Za-z0-9_-]{1,80}$/.test(row.id)||seen.has(row.id))throw Error('Each recipe row needs a unique identity.');
        seen.add(row.id);
        if(key==='ingredients'&&(!row.name.trim()||row.name.length>1000||row.quantity.length>32||row.unit.length>40))throw Error('Name each ingredient; keep amounts and units short.');
        if(key==='ingredients'&&row.quantity&&!/^(?:\d+(?:\.\d+)?|\d+\/\d+|\d+ \d+\/\d+)$/.test(row.quantity))throw Error('Use a number or fraction for the quantity, or leave it blank and describe it in the ingredient.');
        if(key==='ingredients'&&row.quantity.includes('/')&&Number(row.quantity.split('/').pop())===0)throw Error('A fraction cannot have a zero denominator.');
        if(key==='steps'&&(!row.text.trim()||row.text.length>4000))throw Error('Write each preparation step (up to 4,000 characters).');
      }
    }
    for(const key of ['glassware','garnish'])if(typeof doc[key]!=='string'||doc[key].length>1000)throw Error('Keep glassware and garnish under 1,000 characters.');
    if(typeof doc.notes!=='string'||doc.notes.length>10000)throw Error('Keep recipe notes under 10,000 characters.');
    return doc;
  }
  function fromLegacy(c={},uuid=id){
    return {schemaVersion:1,name:c.name||'Untitled cocktail',servings:1,
      // Preserve ambiguous legacy amounts verbatim. Never guess units or ingredient identity.
      ingredients:String(c.ingredients||'').split(/\r?\n/).filter(x=>x.trim()).map(name=>({id:uuid(),name,quantity:'',unit:''})),
      steps:String(c.method||'').split(/\r?\n/).filter(x=>x.trim()).map(text=>({id:uuid(),text})),
      glassware:c.glassware||'',garnish:c.garnish||'',notes:c.notes||''};
  }
  function differences(a,b){
    const changes=[];
    for(const key of ['name','servings','glassware','garnish','notes'])if(!equal(a[key],b[key]))changes.push({kind:'changed',label:key,before:String(a[key]),after:String(b[key])});
    for(const [key,label] of [['ingredients','Ingredient'],['steps','Step']]){
      const old=new Map(a[key].map((r,i)=>[r.id,{r,i}])),next=new Map(b[key].map((r,i)=>[r.id,{r,i}]));
      const describe=r=>key==='ingredients'?[r.quantity,r.unit,r.name].filter(Boolean).join(' '):r.text;
      for(const [rid,{r,i}] of old){const n=next.get(rid);if(!n)changes.push({kind:'removed',label,before:describe(r),after:''});else{
        if(!equal(r,n.r))changes.push({kind:'changed',label,before:describe(r),after:describe(n.r)});
        if(i!==n.i)changes.push({kind:'moved',label,before:describe(r)+' (position '+(i+1)+')',after:'Position '+(n.i+1)});
      }}
      for(const [rid,{r}] of next)if(!old.has(rid))changes.push({kind:'added',label,before:'',after:describe(r)});
    }
    return changes;
  }
  function exportRecipe(doc){return [doc.name,'Serves '+doc.servings,'',...doc.ingredients.map(r=>[r.quantity,r.unit,r.name].filter(Boolean).join(' ')),'',...doc.steps.map((r,i)=>(i+1)+'. '+r.text),'',doc.glassware&&'Glass: '+doc.glassware,doc.garnish&&'Garnish: '+doc.garnish,doc.notes].filter(x=>x!==false&&x!==null).join('\n');}
  const api={clone,equal,id,validate,fromLegacy,differences,exportRecipe};
  root.clMixologyCore=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
