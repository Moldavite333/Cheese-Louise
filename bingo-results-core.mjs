export const FORMAT='cheese-louise-bingo-results-v1';
export const LINES=[...Array.from({length:5},(_,r)=>Array.from({length:5},(_,c)=>r*5+c)),...Array.from({length:5},(_,c)=>Array.from({length:5},(_,r)=>r*5+c)),[0,6,12,18,24],[4,8,12,16,20]];
const clean=(v,n=160)=>String(v??'').slice(0,n).trim();
export const norm=v=>clean(v,250).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,' ').trim();
export function validateResults(value){
 if(value?.format!==FORMAT||!value.movie?.title||!Array.isArray(value.card)||value.card.length!==25||!Array.isArray(value.marked)||typeof value.id!=='string'||!value.id||value.id.length>160)throw Error('Choose a Bingo results file containing a complete 25-square card.');
 const card=value.card.map(t=>{if(!t||typeof t.label!=='string'||!t.label.trim()||typeof t.id!=='string')throw Error('The Bingo card has an invalid square.');return {id:clean(t.id),label:clean(t.label)}});
 if(value.marked.some(i=>!Number.isInteger(i)||i<0||i>24))throw Error('The Bingo card has invalid marks.');
 const free=value.free!==false,marked=[...new Set([...(free?[12]:[]),...value.marked])].sort((a,b)=>a-b);
 return {format:FORMAT,id:clean(value.id),name:clean(value.name)||'My Bingo card',movie:{title:clean(value.movie.title,250),year:Number.isInteger(value.movie.year)?value.movie.year:null},card,marked,free,mode:clean(value.mode,30),complete:!!value.complete,revision:Number.isInteger(value.revision)?value.revision:null,updatedAt:clean(value.updatedAt,40)};
}
export function summarizeResults(value){const card=validateResults(value),marked=new Set(card.marked),lines=LINES.map((indices,i)=>({indices,name:i<5?'Row '+(i+1):i<10?'Column '+'BINGO'[i-5]:i===10?'Diagonal ?':'Diagonal ?'})).filter(line=>line.indices.every(i=>marked.has(i)));return {...card,markedCount:card.marked.filter(i=>!card.free||i!==12).length,lines};}
export function sameMovie(a,b){return norm(a?.title)===norm(b?.title)&&(!a?.year||!b?.year||Number(a.year)===Number(b.year));}
function hash(text){let h=2166136261;for(const ch of text){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0).toString(36);}
export function snapshots(storage){
 const read=key=>{try{return JSON.parse(storage.getItem(key)||'null')}catch{return null}};const out=[];
 const solo=read('romantiverse-v2');
 if(solo?.card?.length===25)try{out.push(validateResults({format:FORMAT,id:'solo-'+hash(String(solo.startedAt)+JSON.stringify(solo.card.map(t=>t.id))),name:'My individual card',movie:{title:solo.movie?.title,year:solo.movie?.release_year||solo.movie?.year||null},card:solo.card,marked:solo.marked,free:solo.free,mode:solo.mode,complete:solo.completed,updatedAt:new Date().toISOString()}))}catch{}
 const rooms=read('romantiverse-room-history-v1');for(const row of Array.isArray(rooms)?rooms:[])try{
  const name=row.room?.players?.find(p=>p.id===row.player_id)?.name;
  out.push(validateResults({format:FORMAT,id:'room-'+hash(String(row.code)+row.player_id+JSON.stringify(row.card.map(t=>t.id))),name:(name||'My shared card')+' � shared game',movie:{title:row.room?.movie_title,year:row.room?.release_year||null},card:row.card,marked:row.marked,free:true,mode:row.room?.mode,complete:row.room?.status==='finished',revision:row.revision,updatedAt:row.savedAt}));
 }catch{}
 return out.slice(0,6);
}
export function allowedHqOrigin(origin){return ['https://moldavite333.github.io','https://hq.cheeselouisepod.com','https://cheeselouisepod.com','https://www.cheeselouisepod.com'].includes(origin);}
