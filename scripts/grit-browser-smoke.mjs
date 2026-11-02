import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
const root=process.cwd();
const html=String.raw`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>*{box-sizing:border-box}body{margin:12px;background:#111217;color:#eee;font:14px Arial}textarea{max-width:100%}button{white-space:normal}#modal{max-width:850px;margin:auto}</style><div id="modal"></div><script>
let workspace={id:'grit-fixture'},session={user:{id:'fixture'}},selectedMovie='a',clDiscoveryMovieDetailId=7;
const SUPABASE_URL='https://fixture.supabase.co';let fail=false,take=0,captured,connected=true;
const state={movies:[{id:'a',title:'Christmas at the Catnip Cafe',year:2025,tmdb_id:7,summary:'A veterinarian helps a cafe owner find homes for rescue cats at Christmas.',notes:'The adoption paperwork vanishes.',comments:[{body:'Who keeps feeding the kittens?'}],selectedTraits:[{name:'Rescue animals'}]}],discoveryResults:[{tmdb_id:8,title:'Forgotten Holiday',summary:'A woman pretends not to know her husband.'}],traits:[]};
const esc=v=>String(v||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
function clSavedMovieDetailModal(){return '<section><div class="kicker">Full synopsis</div><p>Synopsis</p>\n    </section>'}
function clDiscoveryMovieDetailModal(){return clSavedMovieDetailModal()}
const research={overview:'A cafe and its rescued cats.',web_summary:'The Christmas adoption event is at risk.',sources:[{title:'Official synopsis',url:'https://example.com/movie'},{title:'Bad link',url:'javascript:alert(1)'}],warnings:[]};
const db={functions:{invoke:async(name,{body})=>{captured=body;await new Promise(r=>setTimeout(r,30));if(fail)return {error:{context:{json:async()=>({error:'Provider unavailable; draft retained.'})}}};if(body.action==='research')return {data:{research}};take++;return {data:{song:{title:'A Table for the Strays '+take,angle:'The cats watch the humans',story_details:['rescue cats','cafe','veterinarian','adoption event'],lyrics:'[Verse 1]\nThe kitten stole the adoption forms, take '+take+'\n[Chorus]\nA table for the strays'},research}}}}};
window.fetch=async()=>({ok:true,json:async()=>({ready:connected})});window.copied='';Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copied=text}},configurable:true});
</script><script src="/grit-lyrics.js"></script><script>document.getElementById('modal').innerHTML=clSavedMovieDetailModal()</script>`;
const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://fixture').pathname;if(pathname==='/')return res.writeHead(200,{'Content-Type':'text/html'}).end(html);const path=resolve(root,'.'+pathname);if(!path.startsWith(root+sep))throw Error();res.writeHead(200,{'Content-Type':['.js','.mjs'].includes(extname(path))?'text/javascript':'text/plain'}).end(await readFile(path))}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch();await mkdir('artifacts',{recursive:true});
try{for(const width of [360,768,1440]){
 const page=await browser.newPage({viewport:{width,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(origin);await page.getByRole('button',{name:'Grit Lyrics'}).click();
 await page.waitForFunction(()=>document.querySelector('.cl-grit-lyrics')?.value.includes('take 1'));
 assert.ok(await page.evaluate(()=>captured.movie.notes.includes('feeding the kittens')),'Movie comments feed songwriting');
 await page.getByRole('textbox',{name:'More story details or a new angle'}).fill('The kitten steals a Christmas wreath.');
 await page.getByRole('button',{name:'Copy songwriting brief'}).click();await page.waitForFunction(()=>window.copied.includes('kitten steals'));
 await page.getByRole('textbox',{name:'Editable Grit song lyrics'}).fill('My edited original verse <script>safe text</script>');
 await page.evaluate(()=>{document.getElementById('modal').innerHTML=clSavedMovieDetailModal()});
 assert.equal(await page.getByRole('textbox',{name:'Editable Grit song lyrics'}).inputValue(),'My edited original verse <script>safe text</script>');
 await page.evaluate(()=>{fail=true});await page.getByRole('button',{name:'Write a new take'}).click();await page.getByRole('status').filter({hasText:'Provider unavailable'}).waitFor();
 assert.ok((await page.getByRole('textbox',{name:'Editable Grit song lyrics'}).inputValue()).includes('My edited'));
 await page.evaluate(()=>{fail=false});await page.getByRole('button',{name:'Research movie',exact:true}).click();await page.getByRole('status').filter({hasText:'Research ready'}).waitFor();
 await page.getByText('Movie research and sources',{exact:true}).click();assert.equal(await page.locator('.cl-grit-research a').count(),1);
 await page.getByRole('button',{name:'Write a new take'}).click();await page.waitForFunction(()=>document.querySelector('.cl-grit-lyrics')?.value.includes('take 2'));
 assert.ok(await page.evaluate(()=>captured.history.some(x=>x.lyrics.includes('My edited'))),'Previous edited lyrics are retained for avoidance');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Song panel fits '+width);
 await page.screenshot({path:'artifacts/grit-lyrics-'+width+'.png',fullPage:true});
 await page.reload();await page.getByRole('button',{name:'Grit Lyrics'}).click();assert.ok((await page.getByRole('textbox',{name:'Editable Grit song lyrics'}).inputValue()).includes('take 2'),'Draft survives reload');
 await page.evaluate(async()=>{connected=false;await clOpenGritLyrics('discovery',8)});
 assert.equal(await page.getByRole('textbox',{name:'Editable Grit song lyrics'}).inputValue(),'');
 assert.ok(await page.getByText('Automatic songwriting needs its server connection.',{exact:false}).isVisible(),'Missing API connection explains the working brief handoff');
 await page.getByRole('button',{name:'Copy songwriting brief'}).click();await page.waitForFunction(()=>window.copied.includes('Forgotten Holiday'));
 assert.deepEqual(errors,[]);await page.close();
}console.log('Grit browser fixtures passed: original takes, details, comments, history, error preservation, source links, copy brief and reload at phone/tablet/desktop widths.');}
finally{await browser.close();await new Promise(r=>server.close(r))}

