import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
const root=process.cwd();
const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://local').pathname;const path=resolve(root,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));if(!path.startsWith(root+sep))throw Error();const data=await readFile(path);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'}[extname(path)]||'application/octet-stream'}).end(data)}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch();await mkdir('artifacts',{recursive:true});
try{
 for(const width of [360,768,1024,1440]){
 const page=await browser.newPage({viewport:{width,height:960}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===origin)return route.continue();return route.fulfill({status:200,contentType:'text/javascript',body:''})});
 await page.route('**/fixture-poster.svg',route=>route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#416c57"/><text x="20" y="140" fill="white">MOVIE POSTER</text></svg>'}));
 await page.addInitScript(()=>{
  const makeQuery=()=>{const query=new Proxy({then(resolve){return Promise.resolve(resolve({data:[],error:null}))}},{get(target,key){if(key in target)return target[key];if(key==='single'||key==='maybeSingle')return async()=>({data:null,error:null});return ()=>query}});return query};
  window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from:()=>makeQuery(),rpc:async()=>({data:[],error:null}),functions:{invoke:async(name,{body}={})=>name==='movie-research'?{data:{briefs:window.__fixtureResearch||[]}}:name==='search-romantiverse'&&body.lookup_exact&&body.query.toLowerCase()==='falling together'?{data:{results:[{tmdb_id:2024,tmdb_type:'movie',source_type:'tmdb_exact_title',exact_title_match:true,title:'Falling Together',year:2024,summary:'Neighbors find romance.',stars:['Ashley Williams','Paul Campbell'],genres:['Romance','TV Movie']}]}}:name==='recommend-romantiverse'?{data:{results:[{tmdb_id:1000+Number(body.batch),tmdb_type:'movie',source_type:'bingo_catalog',title:'A magical new romance '+body.batch,summary:'An enchanted hourglass sends a woman back in time to find love.',poster_url:'/fixture-poster.svg',premiere_date:'2023-11-01',season:'Fall',genres:['Romance','TV Movie'],recommendation_score:82,why:['Shares time-travel romance themes with A Biltmore Christmas']}],matched_favorites:[{title:'A Biltmore Christmas',year:2023}]}}:{data:{results:[],count:0}}},channel:()=>({on(){return this},subscribe(){return this}}),removeChannel(){}})};
 });
 await page.goto(origin,{waitUntil:'networkidle'});
 await page.evaluate(()=>{
  session={user:{id:'fixture-user'}};workspace={id:'fixture-workspace',join_code:'TEST'};profile={display_name:'Producer'};members=[{user_id:'fixture-user'}];profiles={};
  const movie={id:'fixture-movie',title:'Autumn at the Orchard',network:'Hallmark',summary:'A family orchard needs saving.',season:'Autumn',holiday:null,year:2025,tmdb_id:101,tmdb_type:'hallmark',selectedTraitIds:[],selectedTraits:[],comments:[],votes:{},bookmarks:{},tags:[],source_metadata:{production_companies:['Fixture Studio'],director:'Fixture Director'}};
  state=new Proxy({movies:[movie],episodes:[{id:'done',title:'Released episode',status:'published',release_date:'2026-01-01'},{id:'next',title:'Upcoming episode',status:'planning',release_date:'2026-11-02'}],schedule:[],ideas:[],activity:[],traits:[],filterPresets:[],discoveryResults:[],romantiverseSearchResults:[],cocktails:[]},{get(t,p){return p in t?t[p]:[]}});
  discoveryLoaded=true;discoveryLoading=false;discoveryError='';currentTab='home';render();
  state.traits=Array.from({length:18},(_,i)=>({id:'trait-'+i,name:i%2?'An elaborate town festival with a very long name':'An unexpected magical romantic connection',category:'Romance',points:2,is_active:true}));
  state.movies[0].poster_url='/fixture-poster.svg';
  state.movies[0].selectedTraitIds=['trait-0','trait-1'];
  state.movies[0].selectedTraits=state.traits.slice(0,2);
  state.movies[0].votes={'fixture-partner':'maybe'};members.push({user_id:'fixture-partner'});profiles['fixture-partner']={display_name:'Co-host'};
  localStorage.setItem('cheeseLouise:watchAlong:fixture-workspace:draft:fixture-movie',JSON.stringify({traitIds:['trait-0','trait-1'],outlineItems:[{id:'opening-note',type:'note',text:'Open with the enchanted hourglass joke.'},{id:'first-trait',type:'trait',traitId:'trait-0'}],notes:'The snow only appears when the leads argue.\nThe town festival has no boats, just pastries.\nReturn to the coffee-shop callback before Bingo.'}));
  localStorage.setItem('cheeseLouise:production:v1:fixture-workspace',JSON.stringify({movieId:'fixture-movie',session:{movieId:'fixture-movie',title:'Autumn at the Orchard',snapshot:{notes:'',talkingPoints:[]},segment:0,laps:[],markers:[],elapsedMs:0,runningSince:null,finished:false}}));
  state.activity=[{user_id:'fixture-user',action:'added a movie to the shared Radar.'}];
  state.schedule=[{id:'fixture-event',title:'Record the holiday episode and review the very long production checklist together',item_type:'record',starts_at:new Date().toISOString(),notes:'Fixture calendar item'}];
  render();
 });
 await page.getByRole('heading',{name:'Make the next episode.',exact:true}).waitFor();
 assert.ok(await page.getByRole('heading',{name:'Upcoming episode',exact:true}).isVisible());
 assert.ok(await page.locator('.hq-overview').innerText().then(text=>text.includes('Nov 2, 2026')),'Date-only release keeps its calendar day');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Dashboard fits '+width);
 if(width<=900){
  assert.equal(await page.locator('.hq-mobile-nav button').count(),5);
  await page.getByRole('button',{name:'More',exact:true}).click();
  assert.ok(await page.locator('#hq-more-panel').isVisible());
  assert.equal(await page.locator('#hq-main').evaluate(el=>el.inert),true,'Background is inert while tools menu is open');
  await page.keyboard.press('Shift+Tab');
  assert.ok(await page.locator('#hq-more-panel').evaluate(el=>el.contains(document.activeElement)),'Tools menu contains keyboard focus');
  await page.keyboard.press('Escape');assert.ok(!(await page.locator('#hq-more-panel').isVisible()));
  assert.equal(await page.locator('#hq-main').evaluate(el=>el.inert),false);
  await page.getByRole('button',{name:'More',exact:true}).click();
  await page.setViewportSize({width:1024,height:960});
  await page.waitForFunction(()=>!document.getElementById('hq-main').inert);
  await page.setViewportSize({width,height:960});
  assert.equal(await page.locator('#hq-more-button').getAttribute('aria-expanded'),'false','Desktop resize closes the mobile menu');
 }else assert.ok(await page.locator('.hq-sidebar').isVisible());
 await page.screenshot({path:'artifacts/hq-today-'+width+'.png',fullPage:true});
 for(const route of ['movies','ourmovies','watchalong','recording','episodes','schedule','cocktails','cheesetray','producer','lab','checklist','bingo']){
  await page.evaluate(id=>hqWorkspace.open(id),route);
  assert.ok((await page.locator('#hq-main').innerText()).length>30,'Route renders '+route);
  assert.equal(await page.locator('[onclick*="openRomantiverseRules"],[onclick*="openRuleify"]').count(),0,'Retired show segments are absent from '+route);
  assert.equal(await page.locator('[data-hq-route="rules"],[data-hq-route="ruleify"]').count(),0,'No retired navigation routes');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Route fits '+width+': '+route);
  assert.ok(await page.locator('#hq-main').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Workspace content fits '+width+': '+route);
  if(route==='movies'){
   await page.waitForFunction(()=>document.querySelector('.radar-poster-image')?.naturalWidth>0);
   assert.ok(await page.locator('.radar-poster-image').isVisible(),'Saved movie posters render and load');
   const clipped=await page.locator('#radarModeToolbar').evaluate(el=>el.scrollWidth>el.clientWidth+1);
   assert.equal(clipped,false,'Every Radar view control fits without hidden horizontal scrolling');
  }
  if(route==='ourmovies'){
   assert.ok(await page.getByRole('heading',{name:'Our Movies',exact:true}).isVisible());
   assert.equal(await page.locator('#ourMoviesGrid .movie-card').count(),1,'Partner-only Maybe appears in the shared collection');
   assert.match(await page.locator('.our-movie-choices').innerText(),/Co-host[\s\S]*Maybe/);
   await page.locator('.our-movies-tools').getByRole('button',{name:'Saved',exact:true}).click();
   assert.equal(await page.locator('#ourMoviesGrid .movie-card').count(),0);
   await page.locator('.our-movies-tools').getByRole('button',{name:'All ours',exact:true}).click();
   await page.evaluate(()=>{movieFilters.yearMin=2099;movieFilters.minScore=100;render()});
   assert.equal(await page.locator('#ourMoviesGrid .movie-card').count(),1,'Radar filters do not hide Our Movies');
   await page.evaluate(()=>{movieFilters.yearMin=null;movieFilters.minScore=0});
  }
  if(route==='watchalong'){
   const preview=page.locator('#watchRundownPreview');
   assert.ok(await preview.evaluate(el=>el.clientHeight<=480),'Rundown preview has bounded height');
   assert.equal(await preview.getAttribute('aria-label'),'Editable episode rundown','Rundown is an accessible editable field');
   await preview.fill('Producer-adjusted opening and sign-off.');
   assert.equal(await preview.inputValue(),'Producer-adjusted opening and sign-off.','Producer can edit the recording rundown');
   await page.locator('.watch-trait-tools').scrollIntoViewIfNeeded();
   assert.ok(await page.evaluate(()=>document.querySelector('.watch-trait-tools').getBoundingClientRect().top>=document.querySelector('.hq-topbar').getBoundingClientRect().bottom-1),'Trait tools remain below the header');
   if(width<=1320){
    await page.getByRole('link',{name:'Notes',exact:true}).click();
    assert.ok(await page.locator('#watchNotesPanel').evaluate(el=>el.getBoundingClientRect().top>=document.querySelector('.watch-jump-links').getBoundingClientRect().bottom-1),'Notes jump clears sticky section navigation');
   }
  }
  if(route==='schedule'&&width<=600){
   const agenda=page.locator('.hq-calendar-agenda');
   assert.ok(await agenda.isVisible(),'Phone calendar includes a readable agenda');
   assert.ok((await agenda.innerText()).includes('very long production checklist'),'Agenda preserves complete event names');
  }
  if(route==='recording'){
   await page.evaluate(()=>{
    const source={id:'fixture-source',title:'Fixture official synopsis',url:'https://network.example/movie',text:'The family orchard needs saving before the harvest festival.',provenance:'Synthetic browser fixture'};
    window.__fixtureResearch=[{movie_id:'fixture-movie',workspace_id:workspace.id,status:'ready',report:{schema_version:1,movie_id:'fixture-movie',identity:{title:'Autumn at the Orchard',year:'2025'},generated_at:'2026-11-02T00:00:00.000Z',coverage:'limited',mode:'Source-supported plot outline',premise:'The family orchard needs saving before the harvest festival.',story_beats:[{id:'orchard-stakes',title:'Orchard rescue deadline',summary:'The family orchard needs saving before the harvest festival.',source_ids:['fixture-source'],evidence_anchor:'The family orchard needs saving'}],characters:[{name:'The orchard owner',actor:'',motivation:'Save the family business.',discussion_angle:'What practical options are available?',source_ids:['fixture-source'],evidence_anchor:'The family orchard needs saving'}],discussion:[{title:'The festival economics',observation:'The orchard needs saving.',question:'How much revenue could one festival realistically raise?',basis:'interpretation',source_ids:['fixture-source'],evidence_anchor:'The family orchard needs saving'}],trope_candidates:[],research_gaps:['Check the actual resolution while watching.'],warnings:['Synthetic research draft.'],sources:[source]}}];
   });
   await page.evaluate(()=>clMovieResearch.prepare('fixture-movie'));
   await page.getByText('Movie research & generation',{exact:true}).click();
   assert.ok((await page.locator('.cl-movie-research').innerText()).includes('Partial research brief'),'Shared movie research appears in Recording');
   await page.getByText('Movie research & generation',{exact:true}).click();
   assert.ok((await page.locator('.cl-auto nav').innerText()).includes('Orchard rescue deadline'),'Sourced beats populate the editable timeline automatically');
   await page.locator('.cl-auto nav button').filter({hasText:'Orchard rescue deadline'}).click();
   assert.ok((await page.getByRole('complementary',{name:'Scene discussion prompts'}).innerText()).includes('realistically raise'),'Movie-specific prompts attach to the relevant beat');
   const timeline=page.locator('.cl-auto');
   assert.ok(await timeline.isVisible(),'Evidence-based timeline opens in Recording');
   await timeline.getByRole('button',{name:'Add scene',exact:true}).click();
   await timeline.getByLabel('Scene title',{exact:true}).fill('Fixture scene correction');
   await timeline.getByLabel('Scene title',{exact:true}).blur();
   await timeline.getByLabel('Nick’s notes',{exact:true}).fill('Preserve this manual observation');
   await timeline.getByRole('button',{name:'Pick Up Here',exact:true}).click();
   await timeline.getByText('Timeline tools & exports',{exact:true}).click();
   await timeline.getByText('Import authorized captions',{exact:true}).click();
   await timeline.getByLabel('Caption file',{exact:true}).setInputFiles({name:'authorized.vtt',mimeType:'text/vtt',buffer:Buffer.from('WEBVTT\n\n00:01.000 --> 00:03.000\n<v Jenny>Fixture dialogue</v>')});
   await page.waitForFunction(()=>document.querySelector('.cl-auto nav')?.textContent.includes('Caption excerpt'));
   await timeline.getByRole('button',{name:'Return to bookmark',exact:true}).click();
   assert.equal(await timeline.getByLabel('Nick’s notes',{exact:true}).inputValue(),'Preserve this manual observation');
   assert.equal(await timeline.getByLabel('Scene title',{exact:true}).inputValue(),'Fixture scene correction');
   await timeline.getByRole('button',{name:'Done editing',exact:true}).click();
   await timeline.getByLabel('Jenny’s notes',{exact:true}).fill('Jenny’s separate scene note');
   assert.equal(await timeline.locator('.cl-story-delete').count(),await timeline.locator('.cl-story-card').count(),'Every scene card exposes its own delete control');
   const currentScene=await page.evaluate(()=>clAutomaticTimeline.selected().scene_id);
   await timeline.getByRole('button',{name:'← Previous scene',exact:true}).click();
   await timeline.getByRole('button',{name:'Next scene →',exact:true}).click();
   assert.equal(await page.evaluate(()=>clAutomaticTimeline.selected().scene_id),currentScene,'Next/Previous scene preserve the same stable scene position');
   assert.equal(await timeline.getByLabel('Nick’s notes',{exact:true}).inputValue(),'Preserve this manual observation');
   assert.equal(await timeline.getByLabel('Jenny’s notes',{exact:true}).inputValue(),'Jenny’s separate scene note');
   await timeline.locator('.cl-story-card[aria-current="step"]').press('Home');
   assert.equal(await timeline.locator('.cl-story-card[aria-current="step"] .cl-story-number').innerText(),'01','Keyboard Home selects the first scene');
   await timeline.getByRole('button',{name:'Return to bookmark',exact:true}).click();
   await page.evaluate(()=>clProduction.expand(2));
   assert.equal(await page.evaluate(()=>clAutomaticTimeline.selected().scene_id),currentScene,'Browsing recording segments preserves the selected movie scene');
   await page.evaluate(()=>clProduction.view('edit'));
   await page.evaluate(()=>clProduction.view('record'));
   assert.equal(await page.evaluate(()=>clAutomaticTimeline.selected().scene_id),currentScene,'Returning from the editing section restores the selected scene');
   await page.waitForFunction(()=>{const rail=document.querySelector('.cl-story-track'),card=rail?.querySelector('[aria-current="step"]');if(!card)return false;const a=card.getBoundingClientRect(),b=rail.getBoundingClientRect();return a.left>=b.left-4&&a.right<=b.right+4;});
   const track=await timeline.locator('.cl-story-track').evaluate(el=>({width:el.clientWidth,content:el.scrollWidth}));
   assert.ok(track.content>track.width,'Scene cards scroll inside the storyboard instead of stretching the page');
   assert.ok(await timeline.locator('.cl-story-card').first().evaluate(el=>el.getBoundingClientRect().height>=150),'Scene cards have readable touch targets');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Storyboard fits viewport '+width);
    const sceneDelete=timeline.locator('.cl-story-detail-heading').getByRole('button',{name:'Delete scene',exact:true});
    page.once('dialog',dialog=>dialog.dismiss());await sceneDelete.click();
    assert.equal(await page.evaluate(()=>clAutomaticTimeline.selected().scene_id),currentScene,'Cancel preserves scene');
    page.once('dialog',dialog=>dialog.accept());await sceneDelete.click();
    assert.ok(await timeline.getByRole('button',{name:'Return to bookmark',exact:true}).isDisabled(),'Deletion clears bookmark');
    await timeline.locator('.cl-story-footer > button').click();
    assert.equal(await page.evaluate(()=>clAutomaticTimeline.selected().scene_id),currentScene,'Undo restores scene identity');
    assert.equal(await timeline.getByLabel('Jenny’s notes',{exact:true}).inputValue(),'Jenny’s separate scene note','Undo restores host notes');
    assert.ok(await timeline.getByRole('button',{name:'Return to bookmark',exact:true}).isEnabled(),'Undo restores bookmark');

   assert.ok(await page.getByRole('heading',{name:'Recording notes',exact:true}).isVisible());
   await page.getByRole('heading',{name:'Your Bingo results',exact:true}).waitFor();
   await page.evaluate(()=>{
    const card=Array.from({length:25},(_,i)=>({id:'square-'+i,label:i===0?'A kitten steals the adoption forms':'Observed moment '+i}));
    clRecordingBingo.importSnapshot('fixture-movie',{format:'cheese-louise-bingo-results-v1',id:'host-card',name:'Nick',movie:{title:'Autumn at the Orchard',year:2025},card,marked:[0,1,2,3,4,12],free:true,updatedAt:new Date().toISOString()});
    clProduction.refreshDesk();
   });
   assert.ok((await page.locator('.clp-bingo-counts').innerText()).includes('5 marked squares'));
   assert.ok((await page.locator('.clp-bingo-counts').innerText()).includes('1 completed Bingos'));
   assert.equal(await page.locator('.clp-bingo-board .clp-bingo-cell').count(),25,'The actual website card layout appears in HQ');
   assert.equal(await page.locator('.clp-bingo-cell.is-bingo').count(),5,'Only the five squares forming the completed Bingo get gold borders');
   await page.locator('.clp-bingo-cell').first().click();
   await page.locator('.clp-bingo-squares textarea').first().fill('The paperwork joke belongs before the reveal.');
   await page.locator('.clp-bingo-squares').getByRole('button',{name:'Add to talk order'}).first().click();
   assert.ok((await page.locator('.clp-desk-discussion').innerText()).includes('paperwork joke'));
   await page.locator('.clp-bingo-squares').getByRole('button',{name:'Add to talk order'}).first().click();
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cheeseLouise:watchAlong:fixture-workspace:draft:fixture-movie')).outlineItems.filter(i=>i.id==='bingo-host-card-0').length),1);
   await page.evaluate(()=>{
    const row=JSON.parse(localStorage.getItem('cheeseLouise:recordingBingo:v1:fixture-workspace'))['fixture-movie'].cards[0];
    clRecordingBingo.importSnapshot('fixture-movie',{...row.result,marked:[0,1,2,3,12]});
    clProduction.refreshDesk();
   });
   assert.ok((await page.locator('.clp-bingo-counts').innerText()).includes('0 completed Bingos'));
   assert.equal(await page.locator('.clp-bingo-cell.is-bingo').count(),0,'Undo removes the winning-square highlight');
   assert.equal(await page.locator('.clp-bingo-squares textarea').first().inputValue(),'The paperwork joke belongs before the reveal.');
   if(width>=1280){
    const positions=await page.locator('.clp-desk-columns>section').evaluateAll(els=>els.map(el=>({x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y})));
    assert.ok(positions[1].y>positions[0].y,'Legacy talk order sits below the primary storyboard');
    assert.ok(await page.locator('.clp-desk-story').evaluate(el=>el.getBoundingClientRect().width>=el.parentElement.getBoundingClientRect().width-2),'Storyboard spans the laptop workspace');
    assert.ok(await page.locator('.cl-story-hosts').evaluate(el=>el.getBoundingClientRect().y<document.querySelector('.cl-story-summary').getBoundingClientRect().bottom),'Both hosts’ notes sit beside the scene summary beneath the cards');
    assert.ok(positions[2].y>positions[1].y&&Math.abs(positions[2].x-positions[0].x)<2,'Bingo results sit below the discussion workspace');
   }
   assert.ok(await page.locator('.clp-cue-trait').first().evaluate(el=>el.getBoundingClientRect().height<45),'Traits use compact text rows');

   assert.ok(await page.locator('.clp-compact-timer').evaluate(el=>el.getBoundingClientRect().height<90),'Timing stays compact');
   assert.ok(await page.locator('#clp-total').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)<=18),'Timer digits are secondary');
   assert.equal(await page.locator('.clp-cue-observation').count(),3,'Observations render as separate cards');
   await page.getByRole('link',{name:'Jump to Watch Along notes ↓',exact:true}).click();
   assert.ok(await page.locator('#clp-watch-observations').evaluate(el=>el.getBoundingClientRect().top>=document.querySelector('.hq-topbar').getBoundingClientRect().bottom),'Watch notes shortcut clears the header');
   assert.ok((await page.locator('.clp-cue-note p').first().innerText()).includes('enchanted hourglass'),'Custom talk order survives recording handoff');
   assert.ok(await page.locator('.hq-topbar').evaluate(el=>el.getBoundingClientRect().height<100),'Recording gets a compact header');
   await page.locator('.clp-sticky-actions').scrollIntoViewIfNeeded();
   if(width<=900)assert.ok(await page.evaluate(()=>document.querySelector('.clp-sticky-actions').getBoundingClientRect().bottom<=document.querySelector('.hq-mobile-nav').getBoundingClientRect().top+1),'Recording actions clear mobile navigation');
  }
  await page.evaluate(()=>window.scrollTo(0,0));
  if(['movies','ourmovies','watchalong','recording','schedule'].includes(route))await page.screenshot({path:'artifacts/hq-layout-'+route+'-'+width+'.png',fullPage:true});
 }
 await page.evaluate(()=>hqWorkspace.open('movies'));
 const search=page.getByRole('searchbox',{name:'Search Movie Radar',exact:true});
 await search.fill('orchard');assert.equal(await search.inputValue(),'orchard');await page.waitForFunction(()=>document.activeElement?.id==='globalSearch');
 await page.evaluate(()=>render());assert.ok(await search.evaluate(el=>el===document.activeElement),'A full redraw preserves movie search focus');
 await search.fill('');
 await page.locator('#hq-season').selectOption('Fall');
 await page.waitForFunction(()=>document.querySelector('#movieGrid')?.textContent.includes('Autumn at the Orchard'));
 await page.getByRole('button',{name:'Find movies for us',exact:true}).click();
 await page.waitForFunction(()=>!discoveryLoading&&discoveryLoaded);
 assert.ok(await page.getByText('Your shared taste',{exact:true}).isVisible());
 await page.waitForFunction(()=>document.querySelector('.new-find-poster img')?.naturalWidth>0);
 assert.ok(await page.getByText('A magical new romance 0',{exact:true}).isVisible(),'Movie-based recommendations render');
 await page.getByRole('button',{name:'Refresh picks',exact:true}).click();
 await page.waitForFunction(()=>!discoveryLoading&&state.discoveryResults[0]?.tmdb_id===1000);
 assert.ok(await page.getByText('A magical new romance 0',{exact:true}).isVisible(),'Refreshing preserves eligible recommendations instead of exhausting them');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Taste finder fits '+width);
 await search.fill('Falling Together');
 await page.waitForFunction(()=>state.romantiverseSearchResults.some(m=>m.title==='Falling Together'));
 assert.ok(await page.locator('#romantiverseSearchHost').getByRole('heading',{name:'Falling Together',exact:true}).isVisible(),'Exact title outside catalog is visible');
 await page.evaluate(()=>{movieFilters.holiday='Christmas';movieFilters.yearMin=2026;movieFilters.mode='mutual';refreshRomantiverseSearchPanel()});
 assert.ok(await page.locator('#romantiverseSearchHost').getByRole('heading',{name:'Falling Together',exact:true}).isVisible(),'Exact title survives conflicting filters');
 await page.screenshot({path:'artifacts/hq-taste-'+width+'.png',fullPage:true});
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
 console.log('HQ real-browser fixtures passed at phone, tablet, small laptop, and desktop widths. No live user data was accessed.');
}finally{await browser.close();await new Promise(r=>server.close(r))}


