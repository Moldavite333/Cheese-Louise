import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
const root=process.cwd();
const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://local').pathname;const path=resolve(root,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));if(!path.startsWith(root+sep))throw Error();const data=await readFile(path);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'}[extname(path)]||'application/octet-stream'}).end(data)}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch();await mkdir('artifacts',{recursive:true});
try{
 for(const width of [360,768,1440]){
 const page=await browser.newPage({viewport:{width,height:960}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===origin)return route.continue();return route.fulfill({status:200,contentType:'text/javascript',body:''})});
 await page.addInitScript(()=>{
  const makeQuery=()=>{const query=new Proxy({then(resolve){return Promise.resolve(resolve({data:[],error:null}))}},{get(target,key){if(key in target)return target[key];if(key==='single'||key==='maybeSingle')return async()=>({data:null,error:null});return ()=>query}});return query};
  window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from:()=>makeQuery(),rpc:async()=>({data:[],error:null}),functions:{invoke:async()=>({data:{results:[],count:0}})},channel:()=>({on(){return this},subscribe(){return this}}),removeChannel(){}})};
 });
 await page.goto(origin,{waitUntil:'networkidle'});
 await page.evaluate(()=>{
  session={user:{id:'fixture-user'}};workspace={id:'fixture-workspace',join_code:'TEST'};profile={display_name:'Producer'};members=[{user_id:'fixture-user'}];profiles={};
  const movie={id:'fixture-movie',title:'Autumn at the Orchard',network:'Hallmark',summary:'A family orchard needs saving.',season:'Autumn',holiday:null,year:2025,tmdb_id:101,tmdb_type:'hallmark',selectedTraitIds:[],selectedTraits:[],comments:[],votes:{},bookmarks:{},tags:[],source_metadata:{production_companies:['Fixture Studio'],director:'Fixture Director'}};
  state=new Proxy({movies:[movie],episodes:[{id:'done',title:'Released episode',status:'published',release_date:'2026-01-01'},{id:'next',title:'Upcoming episode',status:'planning',release_date:'2026-11-02'}],schedule:[],ideas:[],activity:[],traits:[],filterPresets:[],discoveryResults:[],romantiverseSearchResults:[],cocktails:[]},{get(t,p){return p in t?t[p]:[]}});
  discoveryLoaded=true;discoveryLoading=false;discoveryError='';currentTab='home';render();
 });
 await page.getByRole('heading',{name:'Make the next episode.',exact:true}).waitFor();
 assert.ok(await page.getByRole('heading',{name:'Upcoming episode',exact:true}).isVisible());
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Dashboard fits '+width);
 if(width<=900){
  assert.equal(await page.locator('.hq-mobile-nav button').count(),5);
  await page.getByRole('button',{name:'More',exact:true}).click();
  assert.ok(await page.locator('#hq-more-panel').isVisible());
  await page.keyboard.press('Escape');assert.ok(!(await page.locator('#hq-more-panel').isVisible()));
 }else assert.ok(await page.locator('.hq-sidebar').isVisible());
 await page.screenshot({path:'artifacts/hq-today-'+width+'.png',fullPage:true});
 for(const route of ['movies','watchalong','recording','episodes','schedule','cocktails','cheesetray','producer','lab','checklist']){
  await page.evaluate(id=>hqWorkspace.open(id),route);
  assert.ok((await page.locator('#hq-main').innerText()).length>30,'Route renders '+route);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Route fits '+width+': '+route);
 }
 await page.evaluate(()=>hqWorkspace.open('movies'));
 const search=page.getByRole('searchbox',{name:'Search Movie Radar',exact:true});
 await search.fill('orchard');assert.equal(await search.inputValue(),'orchard');await page.waitForFunction(()=>document.activeElement?.id==='globalSearch');
 await page.evaluate(()=>render());assert.ok(await search.evaluate(el=>el===document.activeElement),'A full redraw preserves movie search focus');
 await search.fill('');
 await page.locator('#hq-season').selectOption('Fall');
 await page.waitForFunction(()=>document.querySelector('#movieGrid')?.textContent.includes('Autumn at the Orchard'));
 await page.evaluate(()=>{clearMovieFilters();hqWorkspace.open('home');openMovie('fixture-movie')});
 const dialog=page.getByRole('dialog');await dialog.waitFor();
 const production=dialog.locator('input[name="production"]');await production.fill('Unsaved studio draft');
 const defer=await page.evaluate(()=>hqWorkspace.shouldDeferRefresh());assert.equal(defer,true);assert.equal(await production.inputValue(),'Unsaved studio draft');assert.ok(await page.locator('#hq-refresh').isVisible());
 page.once('dialog',d=>d.dismiss());await page.keyboard.press('Escape');assert.ok(await dialog.isVisible(),'Cancel keeps editor open');
 let prompts=0;page.on('dialog',async d=>{prompts++;await d.accept()});await page.keyboard.press('Escape');assert.equal(prompts,1,'Accepting Escape prompts once');assert.equal(await page.getByRole('dialog').count(),0);
 await page.screenshot({path:'artifacts/hq-editor-'+width+'.png',fullPage:true});
 assert.deepEqual(errors,[],'No JavaScript errors at '+width);
 await page.close();
 }
 console.log('HQ real-browser fixtures passed at phone, tablet, and desktop widths. No live user data was accessed.');
}finally{await browser.close();await new Promise(r=>server.close(r))}
