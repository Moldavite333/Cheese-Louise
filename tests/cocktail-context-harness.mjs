import vm from 'node:vm';
import {readFileSync} from 'node:fs';
export function cocktailHarness({fetcher=async()=>({ok:true,json:async()=>({drinks:[]})}),storage=new Map(),sourceReader=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8')}={}){
 const context={AbortSignal,URL,state:{cocktails:[],onlineCocktails:[],episodes:[],movies:[],traits:[]},session:null,workspace:null,selectedEpisode:null,loadAll:async()=>{},episodes:()=>'',home:()=>'',modal:()=>'',topbar:()=>'',go:()=>{},render:()=>{},esc:s=>String(s??''),
 document:{head:{appendChild(){}},createElement:()=>({}),getElementById:()=>null,addEventListener(){},querySelectorAll:()=>[]},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},setTimeout:()=>0,clearTimeout(){},console,fetch:fetcher};
 context.window=context;vm.createContext(context);
 for(const file of ['cocktail-bar.js','cocktail-intelligence.js','cocktail-intelligence-source-fix.js','cocktail-catalog.js','cocktail-title-match.js','cocktail-season-tuning.js'])vm.runInContext(sourceReader(file),context,{filename:file});
 return {context,storage,run:code=>vm.runInContext(code,context)};
}
export const recipe=(name,ingredients,base_spirit='',extra={})=>({id:name,name,cocktail_type:'original',ingredients,base_spirit,style:'',flavor_tags:[],...extra});
