import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {chromium} from 'playwright';

const root=process.cwd();
const origin='http://hq.fixture';
async function serveFixture(route){
 try{
  const url=new URL(route.request().url());
  if(url.origin!==origin)return route.fulfill({status:200,contentType:'text/javascript',body:''});
  const pathname=url.pathname;
  const path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!path.startsWith(root+sep))throw Error();
  const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[extname(path)];
  await route.fulfill({contentType:type||'application/octet-stream',body:await readFile(path)});
 }catch{await route.fulfill({status:404,body:''});}
}
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.HQ_BROWSER_EXECUTABLE||undefined});
 for(const width of [360,768,1440]){
  const page=await browser.newPage({viewport:{width,height:900},isMobile:width===360,hasTouch:width===360});
  await page.route('**/*',serveFixture);
  await page.addInitScript(()=>{
   window.__movieWrites=0;
   window.__fixtureVotes={};
   const query=new Proxy({then(resolve){return Promise.resolve(resolve({data:[],error:null}));}},{
    get(target,key){
     if(key in target)return target[key];
     if(['insert','update','delete','upsert'].includes(key))return row=>{
      window.__movieWrites++;
      if(key==='upsert'&&row?.movie_id&&row?.vote)window.__fixtureVotes[row.user_id]=row.vote;
      return query;
     };
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
     if(name==='search-romantiverse'&&body.query==='Halloween 1978'&&body.broader_lookup){
      return {data:{results:[
       {title:'Halloween',year:2018,tmdb_type:'movie',tmdb_id:424139,genre_ids:[27],source_type:'tmdb_exact_title',exact_title_match:true},
       {title:'Halloween',year:1978,tmdb_type:'movie',tmdb_id:948,genre_ids:[27],source_type:'tmdb_exact_title',exact_title_match:true}
      ]}};
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
   const romantiverse={status:'eligible',reason:'An hourglass takes the screenwriter into an old movie.',source:'https://www.hallmarkchannel.com/a-biltmore-christmas'};
   state.discoveryResults=[{title:'A Biltmore Christmas',year:2023,tmdb_id:2023,source_type:'bingo_catalog',poster_url:'/icon.svg',source_metadata:{romantiverse}}];
   state.discoveryResults.push({title:'Adventures in Love & Birding',year:2025,tmdb_id:3024,source_type:'bingo_catalog',source_metadata:{romantiverse:{...romantiverse,reason:'A birding competition becomes a fake-dating story.'}}});
   discoveryLoaded=true;clRecLastFetchAt=Date.now();
   hqWorkspace.open('movies');
  });
  const spotlight=page.locator('#radarDiscoveryResults .cl-feed-card--spotlight');
  await spotlight.getByText('Don’t miss',{exact:true}).waitFor();
  const tools=page.getByRole('region',{name:'Movie tools'});
  assert.ok(await tools.evaluate(element=>!!(document.querySelector('#radarBrowseResults').compareDocumentPosition(element)&Node.DOCUMENT_POSITION_FOLLOWING)));
  const filters=tools.locator('#radarFiltersButton');
  await filters.click();
  assert.equal(await filters.getAttribute('aria-expanded'),'true');
  await filters.click();
  assert.match(await spotlight.innerText(),/Both Hosts Voted Yes[\s\S]*A Biltmore Christmas/);
  assert.ok(await spotlight.evaluate(el=>{
   const style=getComputedStyle(el);
   return style.borderTopStyle==='solid'&&Number.parseFloat(style.borderTopWidth)>0&&style.borderTopColor==='rgb(237, 188, 96)';
  }),'The mutual-Yes spotlight has a visible gold border');
  const dimensions=await spotlight.locator('.cl-editorial-poster img').evaluate(async img=>{
   await img.decode();
   const poster=img.getBoundingClientRect(),frame=img.parentElement.getBoundingClientRect();
   return {width:poster.width,height:poster.height,frame:frame.width};
  });
  assert.ok(dimensions.width>=199.5&&dimensions.width>=dimensions.frame-2&&Math.abs(dimensions.height/dimensions.width-1.5)<0.02,
   'Expected full-width portrait art at '+width+'px. Measured '+JSON.stringify(dimensions));
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
  await page.getByRole('region',{name:'Movie search results'}).getByRole('button',{name:'Start Episode Setup',exact:true}).click();
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
  await panel.getByRole('button',{name:'Search more sources'}).click();
  await panel.getByRole('heading',{name:'Falling Together',exact:true}).waitFor();
  assert.match(await panel.innerText(),/TMDB · exact title/);
  await panel.getByRole('button',{name:'Open movie'}).click();
  await page.getByRole('dialog').getByRole('heading',{name:'Falling Together'}).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(await search.inputValue(),'Falling Together');
  await panel.getByRole('button',{name:'Open movie'}).evaluate(button=>{
   if(button!==document.activeElement)throw Error('Movie results did not restore focus');
  });
  await search.fill('Unavailable fixture');
  await panel.getByText('No movies match this search.',{exact:true}).waitFor();
  await panel.getByRole('button',{name:'Search more sources'}).click();
  await panel.getByText('TMDB unavailable. Try again.',{exact:true}).waitFor();
  assert.equal(await panel.getByRole('button',{name:'Open movie'}).count(),0);
  await page.getByRole('button',{name:'Clear',exact:true}).click();
  assert.equal(await search.inputValue(),'');
  await page.locator('#radarBrowseResults').waitFor({state:'visible'});
  assert.equal(await search.evaluate(input=>input===document.activeElement),true);
  assert.equal(await page.evaluate(()=>window.__movieWrites),0);
  await search.fill('Return to Santa');
  await page.waitForFunction(()=>romantiverseSearchLoadedQuery==='Return to Santa'&&romantiverseSearchLoading);
  await search.fill('Halloween 1978');
  await panel.getByRole('button',{name:'Search more sources'}).click();
  await panel.getByRole('heading',{name:'Halloween',exact:true}).first().waitFor();
  assert.match(await panel.locator('article').first().innerText(),/Halloween[\s\S]*1978/);
  assert.equal(await panel.getByRole('heading',{name:'Return to Santa',exact:true}).count(),0);
  await page.getByRole('button',{name:'Clear',exact:true}).click();
  await page.evaluate(()=>{movieFilters.season='';movieFilters.yearMin=null;movieFilters.mode='all';render();});
  const weekly=page.getByRole('region',{name:'Pick of the Week'});
  await weekly.getByRole('heading',{name:'A Biltmore Christmas',exact:true}).waitFor();
  await page.evaluate(()=>{
   state.episodes.push({id:'episode-biltmore',title:'Biltmore draft',movie_id:'biltmore',status:'planning'});
   loadAll=async()=>Object.assign(state.movies.find(movie=>movie.id==='biltmore').votes,window.__fixtureVotes);
   session.user.id='a';
  });
  await weekly.getByRole('button',{name:'Start Episode Setup for A Biltmore Christmas'}).click();
  await wizard.getByText('Step 2 of 5 · Watch Along',{exact:true}).waitFor();
  assert.match(await wizard.innerText(),/A Biltmore Christmas/);
  await wizard.getByRole('button',{name:'Exit setup'}).click();
  await page.evaluate(()=>hqWorkspace.search());
  await weekly.getByRole('button',{name:'Thumbs Down'}).click();
  await page.waitForFunction(()=>state.movies.find(movie=>movie.id==='biltmore').votes.a==='no');
  assert.equal(await weekly.getByRole('heading',{name:'A Biltmore Christmas',exact:true}).count(),1);
  await page.evaluate(()=>{session.user.id='b';});
  await weekly.getByRole('button',{name:'Thumbs Down'}).click();
  await weekly.getByRole('heading',{name:'Adventures in Love & Birding',exact:true}).waitFor();
  assert.equal(await weekly.locator('.cl-editorial-poster img').count(),0);
  assert.equal(await weekly.locator('.cl-editorial-poster').innerText(),'CL');
  assert.equal(await page.locator('#radarDiscoveryResults').getByRole('heading',{name:'A Biltmore Christmas',exact:true}).count(),0);
  await search.fill('A Biltmore Christmas');
  await panel.getByRole('button',{name:'Open movie'}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Resume episode'}).click();
  await page.waitForFunction(()=>currentTab==='episodes'&&selectedEpisode==='episode-biltmore');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.close();
 }
 console.log('Feed recovery, movie search and episode resume passed at 360px touch, 768px and 1440px keyboard widths.');
}finally{
 await browser?.close();
}
