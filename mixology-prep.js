// Derived preparation view. Never mutates recipes or invents storage times.
(function(root){
  'use strict';
  function amount(text){
    if(!/^(?:\d+(?:\.\d+)?|\d+\/\d+|\d+ \d+\/\d+)$/.test(text))return null;
    const parts=text.split(' '),fraction=parts.pop().split('/');
    const n=fraction.length===2?Number(fraction[0])/Number(fraction[1]):Number(fraction[0]);
    const result=n+(parts.length?Number(parts[0]):0);
    return Number.isFinite(result)?result:null;
  }
  function plan(document,servings){
    if(!Number.isFinite(servings)||servings<=0||servings>1000)throw Error('Choose between 0 and 1,000 servings.');
    if(!Number.isFinite(document.servings)||document.servings<=0)throw Error('Set the recipe serving count first.');
    const factor=servings/document.servings;
    return {servings,factor,ingredients:document.ingredients.map(row=>{
      const n=amount(row.quantity),notes=[];
      if(n===null)notes.push('Amount unspecified: keep the original description and measure before batching.');
      if(/\b(soda|sprite|tonic|sparkling|prosecco|champagne|beer|seltzer)\b/i.test(row.name))notes.push('Add carbonation at service; do not shake or store in a sealed batch.');
      if(/\b(lemon|lime|grapefruit|orange|citrus)\b/i.test(row.name))notes.push('If using fresh juice, check balance near service. No shelf life has been inferred.');
      if(/\b(bitters|absinthe)\b/i.test(row.name)||/^(dash|dashes|drop|drops)$/i.test(row.unit))notes.push('Arithmetic starting amount only: test a small batch before committing seasoning.');
      if(/\b(ice|water)\b/i.test(row.name))notes.push('Dilution depends on technique; confirm by testing rather than adding all automatically.');
      if(/\b(garnish|peel|wheel|sprig)\b/i.test(row.name))notes.push('Count and prepare garnishes for the actual number of glasses.');
      return {...row,scaledQuantity:n===null?row.quantity:String(Number((n*factor).toFixed(4))),notes};
    }),steps:document.steps.map(row=>({...row})),garnish:document.garnish};
  }
  const api={amount,plan};root.clMixologyPrep=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
