import {mkdir,writeFile} from 'node:fs/promises';

// Provider-authorized bulk endpoint: https://24cocktails.com/developers.html
// Keep recipes linked to their provider; this is a matching index, not a public mirror.
const url='https://24cocktails.com/llms/recipes.jsonl';
const response=await fetch(url,{signal:AbortSignal.timeout(90000)});
if(!response.ok) throw new Error(`Catalog export returned ${response.status}`);
const text=await response.text();
const recipes=[];const seen=new Set();
for(const [index,line] of text.split(/\r?\n/).entries()){
  if(!line.trim()) continue;
  let row;
  try{row=JSON.parse(line);}catch{throw new Error(`Invalid export JSON on line ${index+1}`);}
  if(!row.name || !Array.isArray(row.ingredients) || !row.ingredients.length) continue;
  let link;
  try{link=new URL(row.url);}catch{continue;}
  if(link.origin!=='https://24cocktails.com'||!link.pathname.startsWith('/cocktail/')) continue;
  const key=String(row.name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  if(!key||seen.has(key)) continue;
  seen.add(key);
  recipes.push({name:String(row.name),url:link.href,base:String(row.base||''),abv:Number(row.abv)||0,
    method:String(row.method||''),glass:String(row.glass||''),garnish:String(row.garnish||''),
    ingredients:row.ingredients.filter(x=>typeof x==='string'&&x.trim())});
}
if(recipes.length<1000) throw new Error(`Refusing to replace the broad catalog with only ${recipes.length} recipes`);
recipes.sort((a,b)=>a.name.localeCompare(b.name));
const catalog={schemaVersion:1,source:'24cocktails.com',sourceUrl:'https://24cocktails.com/developers.html',
  fetchedAt:new Date().toISOString(),count:recipes.length,recipes};
await mkdir(new URL('../data/',import.meta.url),{recursive:true});
await writeFile(new URL('../data/cocktail-catalog.json',import.meta.url),JSON.stringify(catalog));
console.log(`Validated ${recipes.length} unique recipes with ingredient lists and source URLs.`);
