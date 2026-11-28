import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {chromium} from 'playwright';

const root=process.cwd();
const server=createServer(async (req,res)=>{
 try{
  const pathname=new URL(req.url,'http://local').pathname;
  const path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!path.startsWith(root+sep))throw Error();
  const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[extname(path)];
  res.writeHead(200,{'Content-Type':type||'application/octet-stream'}).end(await readFile(path));
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch();
 for(const width of [360,1440]){
  const page=await browser.newPage({viewport:{width,height:900},isMobile:width===360,hasTouch:width===360});
  await page.route('**/*',route=>new URL(route.request().url()).origin===origin
   ?route.continue():route.fulfill({status:200,contentType:'text/javascript',body:''}));
  await page.addInitScript(()=>{
   window.__movieWrites=0;
   const query=new Proxy({then(resolve){return Promise.resolve(resolve({data:[],error:null}));}},{
    get(target,key){
     if(key in target)return target[key];
     if(['insert','update','delete','upsert'].includes(key))return ()=>{window.__movieWrites++;return query;};
     return ()=>query;
    }
   });
   window.supabase={createClient:()=>({
    auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    from:()=>query, rpc:async()=>({data:[],error:null}),
    functions:{invoke:async(name,{body}={})=>{
     if(name==='search-romantiverse'&&body.query==='Return to Santa'){
      await new Promise(resolve=>setTimeout(resolve,500));
      return {data:{results:[{title:'Return to Santa',year:2026,tmdb_type:'catalog',tmdb_id:301,source_type:'bingo_catalog',title_search_score:600}]}};
     }
     return {data:{results:[],count:0}};
    }}
   })};
  });
  await page.goto(origin,{waitUntil:'networkidle'});
  await page.evaluate(()=>{
   session={user:{id:'host-a'}};workspace={id:'search-fixture'};profile={display_name:'Host'};
   members=[];profiles={};
   state.movies=[{id:'santa',title:'Return to Santa',premiere_date:'2026-11-27',network:'Hallmark Channel',
    source_metadata:{stars:['Paul Campbell','Rachel Boston']},status:'recorded',votes:{a:'no',b:'no'},
    comments:[],tags:[],bookmarks:{}}];
   state.episodes=[{id:'episode-santa',title:'Return to Santa episode',movie_id:'santa',status:'idea'}];
   discoveryLoaded=true;movieFilters.season='Fall';movieFilters.yearMin=2099;movieFilters.mode='yes';
   hqWorkspace.open('movies');
  });
  const search=page.getByRole('searchbox',{name:'Search Movie Radar'});
  await search.fill('Return to Santa');
  const panel=page.getByRole('region',{name:'Movie search results'});
  const title=panel.getByRole('heading',{name:'Return to Santa',exact:true});
  await title.waitFor();
  assert.equal(await title.count(),1);
  assert.match(await panel.innerText(),/Recorded · Both No/);
  assert.match(await panel.innerText(),/Paul Campbell · Rachel Boston/);
  assert.equal(await page.locator('#radarBrowseResults').isVisible(),false);
  await search.fill('Return to Snta');
  await title.waitFor();
  await page.waitForFunction(()=>!romantiverseSearchLoading&&romantiverseSearchLoadedQuery==='Return to Snta');
  assert.equal(await title.count(),1);
  const open=panel.getByRole('button',{name:'Open movie'});
  if(width===360)await open.tap();else {await open.focus();await page.keyboard.press('Enter');}
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('heading',{name:'Return to Santa'}).waitFor();
  await dialog.getByRole('button',{name:'Resume episode'}).click();
  await page.waitForFunction(()=>currentTab==='episodes'&&selectedEpisode==='episode-santa');
  assert.equal(await page.evaluate(()=>window.__movieWrites),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.close();
 }
 console.log('Movie search and canonical episode resume passed at 360px touch and 1440px keyboard widths.');
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
