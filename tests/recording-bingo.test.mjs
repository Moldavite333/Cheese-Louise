import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshots,summarizeResults,validateResults,sameMovie,allowedHqOrigin,FORMAT} from '../bingo-results-core.mjs';
const card=Array.from({length:25},(_,i)=>({id:'t'+i,label:'Square '+i,private_field:'do not export'}));
const game={movie:{title:'Movie A',release_year:2025},card,marked:[0,1,2,3,4,12],free:true,mode:'classic',startedAt:'2026-11-01',secret:'do not export'};
test('Bingo results distinguish marked observations from completed lines, including the free center',()=>{
 const value=validateResults({format:FORMAT,id:'card-a',movie:{title:'Movie A',year:2025},card,marked:[0,1,2,3,4,12]});const s=summarizeResults(value);
 assert.equal(s.markedCount,5);assert.equal(s.lines.length,1);assert.equal(s.lines[0].name,'Row 1');
 assert.equal(summarizeResults({...value,marked:[0,1,2,3,12]}).lines.length,0);
 const two=summarizeResults({...value,marked:[0,1,2,3,4,5,10,15,20]});assert.equal(two.markedCount,9);assert.equal(two.lines.length,2);
 const diagonal=summarizeResults({...value,marked:[0,6,18,24]});assert.equal(diagonal.markedCount,4);assert.equal(diagonal.lines[0].name,'Diagonal ?');
});
test('exports never contain room credentials, user IDs, private metadata or calculated scores',()=>{
 const room={code:'ABCD234',token:'SUPER_SECRET',player_id:'private-player',room:{code:'ABCD234',movie_title:'Movie A',release_year:2025,players:[{id:'private-player',name:'Jenny'}]},card,marked:[0,12],revision:3};
 const storage={getItem:key=>JSON.stringify(key==='romantiverse-v2'?game:key==='romantiverse-room-history-v1'?[room]:null)};
 const values=snapshots(storage),text=JSON.stringify(values);assert.equal(values.length,2);assert.match(values[1].name,/Jenny/);
 for(const sensitive of ['SUPER_SECRET','private-player','private_field','do not export','token','player_id'])assert.ok(!text.includes(sensitive));
 assert.equal(values[1].revision,3);assert.equal(summarizeResults(values[1]).markedCount,1);
});
test('movie identity and import validation prevent attaching another film or invalid marks',()=>{
 assert.equal(sameMovie({title:'Movie A',year:2025},{title:'Movie A',year:2024}),false);assert.equal(sameMovie({title:'Movie A'},{title:'Movie B'}),false);
 assert.throws(()=>validateResults({format:FORMAT,id:'x',movie:{title:'A'},card,marked:[25]}),/invalid marks/);
 assert.throws(()=>validateResults({format:FORMAT,id:'x',movie:{title:'A'},card:card.slice(0,24),marked:[]}),/25-square/);
 assert.equal(allowedHqOrigin('https://evil.example'),false);assert.equal(allowedHqOrigin('https://hq.cheeselouisepod.com.evil.example'),false);assert.equal(allowedHqOrigin('https://moldavite333.github.io'),true);
});
