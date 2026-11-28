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
 for(const width of [360,768,1440]){
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
     if(name==='search-romantiverse'&&body.query==='Falling Together'&&body.broader_lookup){
      return {data:{results:[{title:'Falling Together',year:2024,tmdb_type:'movie',tmdb_id:2024,
       source_type:'tmdb_exact_title',exact_title_match:true,stars:['Ashley Williams','Paul Campbell']}]}};
     }
     if(name==='search-romantiverse'&&body.query==='Unavailable fixture'&&body.broader_lookup){
      return {data:{results:[],exact_lookup_warning:'TMDB unavailable. Try again.'}};
     }
     if(name==='recommend-romantiverse'&&window.__failFeed){
      return {data:{results:[],catalog_stale:true}};
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
    source_metadata:{stars:['Paul Campbell','Rachel Boston']},status:'needs_review',votes:{a:'no',b:'no'},
    comments:[],tags:[],bookmarks:{}}];
   state.episodes=[{id:'episode-santa',title:'Return to Santa episode',movie_id:'santa',status:'recorded'}];
   state.movies.push({id:'biltmore',title:'A Biltmore Christmas',year:2023,network:'Hallmark Channel',
    votes:{a:'yes',b:'yes'},comments:[],tags:[],bookmarks:{}});
   state.discoveryResults=[{title:'A Biltmore Christmas',year:2023,tmdb_id:2023,source_type:'bingo_catalog',poster_url:'/icon.svg'}];
   state.discoveryResults.push({title:'A Grand Biltmore Christmas: A Very Long Alternate Title for Layout Testing',year:2024,tmdb_id:3024,source_type:'bingo_catalog'});
   discoveryLoaded=true;clRecLastFetchAt=Date.now();
   hqWorkspace.open('movies');
  });
  const spotlight=page.locator('#radarDiscoveryResults .cl-feed-card--spotlight');
  await spotlight.getByText('Don’t miss',{exact:true}).waitFor();
  assert.match(await spotlight.innerText(),/Both voted Yes[\s\S]*A Biltmore Christmas/);
  assert.ok(await spotlight.evaluate(el=>getComputedStyle(el).borderTopWidth==='2px'));
  assert.ok(await spotlight.locator('.cl-editorial-poster img').evaluate(async img=>{
   await img.decode();
   const poster=img.getBoundingClientRect(),card=img.closest('article').getBoundingClientRect();
   return poster.width>=200&&poster.width>=card.width-2&&Math.abs(poster.height/poster.width-1.5)<0.02;
  }));
  await page.evaluate(async()=>{window.__failFeed=true;await discoverCheeseMovies(true);});
  await page.getByText('The catalog could not refresh. Showing the previous picks.',{exact:true}).waitFor();
  assert.equal(await spotlight.count(),1);
  await spotlight.getByRole('button',{name:'View A Biltmore Christmas'}).click();
  await page.getByRole('dialog').getByRole('heading',{name:'A Biltmore Christmas'}).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.evaluate(()=>clOpenDiscoveryMovieDetails(2023));
  await page.getByRole('dialog').getByRole('button',{name:'Select movie',exact:true}).click();
  await page.waitForFunction(()=>currentTab==='watchalong'&&localStorage.getItem('cheeseLouise:watchAlong:search-fixture:movie')==='biltmore');
  await page.evaluate(()=>hqWorkspace.open('home'));
  await page.getByRole('button',{name:'Continue this episode',exact:true}).click();
  await page.waitForFunction(()=>currentTab==='episodes'&&selectedEpisode==='episode-santa');
  await page.evaluate(()=>{closeEpisode();hqWorkspace.search();});
  await page.evaluate(()=>hqWorkspace.open('home'));
  await page.getByRole('button',{name:'Episode setup wizard',exact:true}).click();
  const wizard=page.getByRole('region',{name:'Episode setup'});
  await wizard.getByText('Step 1 of 5 · Find a movie',{exact:true}).waitFor();
  await page.getByRole('searchbox',{name:'Search Movie Radar'}).fill('Return to Santa');
  await page.getByRole('region',{name:'Movie search results'}).getByRole('button',{name:'Start setup',exact:true}).click();
  await wizard.getByText('Step 2 of 5 · Watch Along',{exact:true}).waitFor();
  await page.waitForFunction(()=>currentTab==='watchalong'&&localStorage.getItem('cheeseLouise:watchAlong:search-fixture:movie')==='santa');
  await wizard.getByRole('button',{name:'Next step'}).click();
  await wizard.getByRole('button',{name:'Develop cocktail'}).waitFor();
  await wizard.getByRole('button',{name:'Next step'}).click();
  await wizard.getByRole('button',{name:'Open episode',exact:true}).waitFor();
  await wizard.getByRole('button',{name:'Next step'}).click();
  await page.waitForFunction(()=>currentTab==='marketing'&&document.getElementById('marketing-episode')?.value==='episode-santa');
  await wizard.getByRole('button',{name:'Finish setup'}).click();
  await wizard.waitFor({state:'hidden'});
  await page.evaluate(()=>hqWorkspace.search());
  await page.evaluate(()=>{movieFilters.season='Fall';movieFilters.yearMin=2099;movieFilters.mode='yes';});
  const search=page.getByRole('searchbox',{name:'Search Movie Radar'});
  await search.fill('Return to Santa');
  const panel=page.getByRole('region',{name:'Movie search results'});
  const title=panel.getByRole('heading',{name:'Return to Santa',exact:true});
  await title.waitFor();
  assert.equal(await search.evaluate(input=>input===document.activeElement),true);
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
  await page.evaluate(()=>{closeEpisode();hqWorkspace.search();});
  await search.fill('Falling Together');
  await panel.getByRole('button',{name:'Look up on TMDB'}).click();
  await panel.getByRole('heading',{name:'Falling Together',exact:true}).waitFor();
  assert.match(await panel.innerText(),/TMDB · exact title/);
  assert.ok(await panel.getByRole('button',{name:'Add and open'}).isVisible());
  await search.fill('Unavailable fixture');
  await panel.getByText('No movies match this search.',{exact:true}).waitFor();
  await panel.getByRole('button',{name:'Look up on TMDB'}).click();
  await panel.getByText('TMDB unavailable. Try again.',{exact:true}).waitFor();
  assert.equal(await panel.getByRole('button',{name:'Add and open'}).count(),0);
  await page.getByRole('button',{name:'Clear',exact:true}).click();
  assert.equal(await search.inputValue(),'');
  await page.locator('#radarBrowseResults').waitFor({state:'visible'});
  assert.equal(await search.evaluate(input=>input===document.activeElement),true);
  assert.equal(await page.evaluate(()=>window.__movieWrites),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.close();
 }
 console.log('Feed recovery, movie search and episode resume passed at 360px touch, 768px and 1440px keyboard widths.');
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
