import test from 'node:test';
import assert from 'node:assert/strict';
import '../supabase/functions/_shared/our-movie-taste.js';
import {selectCatalog,createCatalogHandler} from '../supabase/functions/_shared/romantiverse-catalog.mjs';
const E=globalThis.clOurMovieTasteEngine;
const pretend={title:'Our pretend-couple pick',summary:'They are pretending to be a couple to win back their exes.',votes:{a:'yes',b:'yes'}};
const inherited={title:'Our inherited-inn pick',summary:'She inherited half of the inn and returns home to save the business.',votes:{a:'yes',b:'yes'}};
test('Our Movies weights both Yes above one Yes, Saved and Maybe; rejection is not a positive',()=>{
 const values=[E.signals(pretend).weight,E.signals({votes:{a:'yes'}}).weight,E.signals({bookmarks:{a:true}}).weight,E.signals({votes:{a:'maybe'}}).weight];
 assert.ok(values.every((v,i)=>i===0||v<values[i-1]));
 const p=E.preferences([pretend,inherited,{title:'Saved',bookmarks:{a:true}},{title:'Tentative',votes:{a:'maybe'}},{title:'Rejected',votes:{a:'no'},bookmarks:{a:true}}]);
 assert.equal(p.likes.length,4);assert.equal(p.dislikes.length,1);assert.ok(!p.likes.some(m=>m.title==='Rejected'));assert.equal(E.profile(p).both,2);
});
test('generic Christmas is not a close match, but a specific shared story premise points to the actual choice',()=>{
 const p=E.profile(E.preferences([pretend,inherited]));
 const special=E.match({title:'New romance',summary:'A fake relationship becomes real.'},p),generic=E.match({title:'Christmas Together',summary:'Two strangers fall in love at Christmas.'},p);
 assert.equal(special.tier,'close');assert.equal(generic.tier,'unknown');assert.ok(special.score>generic.score);assert.match(special.reasons[0],/Our pretend-couple pick/);
});
test('Maybe alone stays tentative and Cheese Grating cannot change preference',()=>{
 assert.notEqual(E.match(pretend,E.profile(E.preferences([{...pretend,votes:{a:'maybe'}}]))).tier,'close');
 const p=E.profile(E.preferences([inherited]));assert.equal(E.match({...inherited,cheese_score:0},p).score,E.match({...inherited,cheese_score:1000},p).score);
});
test('No votes lower similar story scores rather than banning a shared holiday',()=>{
 const before=E.profile(E.preferences([pretend,inherited])),after=E.profile(E.preferences([pretend,inherited,{...pretend,title:'Rejected pretend premise',votes:{a:'no',b:'no'}}]));
 assert.ok(E.match(pretend,after).score<E.match(pretend,before).score);assert.ok(E.match(inherited,after).score>=E.match(pretend,after).score);
});
test('rank before limiting, never rotate a weak batch ahead of a close fit, and widen only on request',()=>{
 const body={version:1,movies:[{id:'flat',title:'A Generic Christmas',season:'Christmas',release_year:2025,synopsis:'Two strangers meet.'},{id:'fit',title:'Z Inn for Two',season:'Christmas',release_year:2025,synopsis:inherited.summary}]};
 const p=E.preferences([inherited]);const r=selectCatalog(body,{...p,max_results:1,batch:99},true);assert.equal(r.results[0].title,'Z Inn for Two');assert.equal(r.broader_count,1);
 assert.equal(selectCatalog(body,{...p,max_results:24},true).results.length,1);assert.equal(selectCatalog(body,{...p,include_broader:true},true).results.length,2);
});
test('enrich story metadata before final ranking; public metadata cache cannot reuse another private taste profile',async()=>{
 const body={version:1,movies:[{id:'a',title:'A Plain Title',season:'Christmas',release_year:2025},{id:'z',title:'Z Secret Title',season:'Christmas',release_year:2025}]};let calls=0;
 const handler=createCatalogHandler({fallback:body,recommend:true,env:()=> 'fixture-token',fetcher:async url=>{
  if(url.includes('/catalog/'))return new Response(JSON.stringify(body));calls++;const u=new URL(url);
  if(u.pathname.endsWith('/search/movie')){const title=u.searchParams.get('query');return new Response(JSON.stringify({results:[{id:title.startsWith('Z')?2:1,title,release_date:'2025-11-01',genre_ids:[10749,10770]}]}))}
  const special=u.pathname.endsWith('/2');return new Response(JSON.stringify({id:special?2:1,title:special?'Z Secret Title':'A Plain Title',release_date:'2025-11-01',overview:special?'A fake relationship becomes real.':'Two people meet at Christmas.',genres:[{id:10749,name:'Romance'},{id:10770,name:'TV Movie'}]}));
 }});
 const request=p=>handler(new Request('https://fixture/recommend',{method:'POST',body:JSON.stringify(p)}));
 const first=await request(E.preferences([pretend]));assert.equal(first.status,200);assert.equal((await first.json()).results[0].title,'Z Secret Title');
 const count=calls,second=await request({...E.preferences([{...pretend,title:'Private second preference'}]),include_broader:true}),data=await second.json();assert.equal(calls,count);assert.ok(!JSON.stringify(data).includes('Our pretend-couple pick'));assert.match(data.results[0].why[0],/Private second preference/);
});
