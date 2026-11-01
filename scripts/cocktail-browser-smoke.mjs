// Assemble the real HQ scripts with fixture-only authentication and recipes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
const root=process.cwd(),server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+(new URL(req.url,'http://local').pathname==='/'?'/index.html':new URL(req.url,'http://local').pathname));if(!file.startsWith(root+sep))throw Error();res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[extname(file)]||'application/octet-stream'}).end(await readFile(file))}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch();await mkdir('artifacts',{recursive:true});
try{for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.fulfill({status:200,contentType:'text/javascript',body:''}));
 await page.addInitScript(()=>{
  const query=()=>new Proxy({then:resolve=>Promise.resolve(resolve({data:[],error:null}))},{get:(target,key)=>key in target?target[key]:key==='single'||key==='maybeSingle'?async()=>({data:null,error:null}):()=>query()});
  window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from:()=>query(),rpc:async()=>({data:[],error:null}),functions:{invoke:async()=>({data:{results:[]}})},channel:()=>({on(){return this},subscribe(){return this}}),removeChannel(){}})};
 });
 await page.goto(origin,{waitUntil:'networkidle'});
 await page.evaluate(()=>{
  session={user:{id:'fixture-user'}};workspace={id:'fixture-workspace',join_code:'TEST'};profile={display_name:'Producer'};members=[{user_id:'fixture-user'}];profiles={};
  const recipes=[['Tropical Sour','pineapple juice\nwhite rum\nlime juice\nsimple syrup','Rum'],['Tropical Fizz','pineapple juice\ngin\nlime juice\nsoda water','Gin'],['Tropical Spritz','pineapple juice\nsparkling wine\nAperol','Sparkling Wine'],['Orchard Sip','apple cider\nmaple syrup\nBrandy','Brandy'],['Tropical Cooler','pineapple juice\nwhite rum\nlime juice','Rum'],['Cocoa Comfort','cocoa\nbrandy\ncream','Brandy'],['Garden Fizz','gin\nelderflower liqueur\nlemon juice','Gin'],['Ginger Buck','vodka\nginger beer\nlime juice','Vodka'],['Rose Celebration','rose syrup\nChampagne\nstrawberries','Sparkling Wine']].map(([name,ingredients,base_spirit],i)=>({id:'recipe-'+i,name,ingredients,base_spirit,cocktail_type:'original',style:'',flavor_tags:[]}));
  const movies=[{id:'fall',title:'Orchard Promise',summary:'Apple cider and maple at a harvest festival.',season:'Autumn'},{id:'summer',title:'Tropical Promise',summary:'A beach resort celebration in the Caribbean.',season:'Summer'},{id:'winter',title:'Snowy Promise',summary:'A baker shares chocolate by a fireplace in a blizzard.',season:'Winter',holiday:'Christmas'}].map(m=>({...m,selectedTraits:[],selectedTraitIds:[],tags:[],comments:[],votes:{},bookmarks:{}}));
  state=new Proxy({movies,cocktails:recipes,onlineCocktails:[],episodes:[],traits:[],schedule:[],ideas:[],activity:[],filterPresets:[]},{get:(target,key)=>key in target?target[key]:[]});
  clOnlineCatalogStatus={loaded:true,loading:false,error:'',updatedAt:null};openCocktailBar();
 });
 const select=page.locator('.cl-match-panel select');await select.waitFor();await select.selectOption('fall');
 const first=await page.locator('.cl-smart-match-card .cl-match-score strong').first().innerText();
 await select.selectOption('summer');const second=await page.locator('.cl-smart-match-card .cl-match-score strong').first().innerText();assert.notEqual(first,second,'Changing movie/season must rerank actual cocktails');
 await page.locator('.cl-smart-match-card .cl-match-score strong').first().click();await page.locator('.cl-cocktail-detail-modal').waitFor();assert.ok((await page.locator('.cl-cocktail-detail-modal').innerText()).includes(second.replace(/^#\d+ /,'')),'Details must match the displayed ranking');await page.locator('.cl-cocktail-detail-modal .close').click();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Cocktail matcher fits '+width);
 await page.screenshot({fullPage:true,path:'artifacts/cocktail-matching-'+width+'.png',animations:'disabled'});
 await page.locator('.cl-smart-match-card').first().getByRole('button',{name:'Make Cheese Louise version',exact:true}).click();await page.locator('#clName').waitFor();assert.ok((await page.locator('#clName').inputValue()).length>0);page.once('dialog',dialog=>dialog.accept());await page.locator('.modal .close').click();
 await page.getByRole('button',{name:/Cheese Louise Versions/}).click();await page.waitForFunction(()=>document.querySelectorAll('.cl-generated-card').length===3);
 const bases=await page.locator('.cl-generated-card .subtle strong').allTextContents();assert.equal(new Set(bases).size,3,'Familiar/Craft/Wildcard must use distinct bases');
 await page.evaluate(()=>{state.movies.find(m=>m.id==='summer').season='Fall';render()});await page.getByRole('status').filter({hasText:'Movie details or the cocktail library changed'}).waitFor();assert.equal(await page.locator('.cl-generated-card').count(),0,'Edited metadata must not display stale versions');
 await page.getByRole('button',{name:/Generate 3 new versions/}).click();await page.waitForFunction(()=>document.querySelectorAll('.cl-generated-card').length===3);assert.equal(await page.evaluate(()=>state.cocktails.length),9,'Generating suggestions must not save or overwrite recipes');
 assert.deepEqual(errors,[]);console.log('Cocktail ranking, details, distinct versions and metadata invalidation pass at '+width+'px.');await page.close();
}}finally{await browser.close();await new Promise(r=>server.close(r))}
