const seed = {
  currentUser: 'Nick',
  movies: [
    {id:1,title:'Christmas at the Suspiciously Successful Bakery',network:'Hallmark',date:'Dec 5',score:92,tags:['Christmas','Bakery','Big-city return','Old flame'],summary:'A corporate brand strategist returns home to save her family bakery and discovers the contractor renovating the town square is her high-school sweetheart.',votes:{Nick:'yes',Jenny:null},bookmarks:{Nick:true,Jenny:false},comments:[{user:'Nick',text:'This has at least three Romantiverse rules hiding in it.'}]},
    {id:2,title:'A Prince in Pinecone Falls',network:'Reel One',date:'Nov 21',score:96,tags:['Royalty','Fake country','Small town','Secret identity'],summary:'A visiting prince hides his identity while helping a small Colorado town prepare for its winter festival.',votes:{Nick:'yes',Jenny:'yes'},bookmarks:{Nick:true,Jenny:true},comments:[{user:'Jenny',text:'Fake country AND winter festival. Fine.'}]},
    {id:3,title:'Love at the Pickle Festival',network:'Lifetime',date:'Oct 18',score:88,tags:['Festival','Rivals','Food business','Small town'],summary:'Two rival food entrepreneurs are forced to share a booth at a wildly overproduced small-town pickle festival.',votes:{Nick:'maybe',Jenny:null},bookmarks:{Nick:false,Jenny:false},comments:[]},
    {id:4,title:'The Christmas Star Wish',network:'Hallmark',date:'Dec 12',score:90,tags:['Christmas','Magic','Wish','Widower'],summary:'A once-a-year Christmas star grants one wish, but apparently only after everyone has learned a lesson about community.',votes:{Nick:null,Jenny:'maybe'},bookmarks:{Nick:false,Jenny:true},comments:[]},
    {id:5,title:'Murdered by Mistletoe',network:'LMN',date:'Nov 29',score:83,tags:['Thriller','Christmas','Suspicious fiancé'],summary:'A holiday planner starts to suspect her perfect fiancé may be considerably less festive than advertised.',votes:{Nick:'yes',Jenny:'no'},bookmarks:{Nick:true,Jenny:false},comments:[{user:'Jenny',text:'You can watch this disaster without me.'}]}],
  episodes:[
    {id:1,title:'A Prince in Pinecone Falls',status:'Planning',release:'TBD',steps:['Watch','Notes','Record','Edit','Release'],done:['Watch']},
    {id:2,title:'Pilot — Home for the Holidays',status:'Idea',release:'Thanksgiving week',steps:['Watch','Notes','Record','Edit','Release'],done:[]}],
  schedule:[
    {date:'Oct 8',type:'Watch',title:'Watch Night'},
    {date:'Oct 10',type:'Record',title:'Record test episode'},
    {date:'Oct 19',type:'Release',title:'Target episode release'},
    {date:'Nov 26',type:'Special',title:'Thanksgiving launch window'}],
  ideas:[
    {id:1,title:'Romantiverse Ombudsman',status:'working',category:'Live show'},
    {id:2,title:'Cocktail of the Week',status:'working',category:'Format'},
    {id:3,title:'Long plot recap',status:'retired',category:'Format'},
    {id:4,title:'Romantiverse Supreme Court',status:'ideas',category:'Game'},
    {id:5,title:'Recording timer + Clip This',status:'testing',category:'Production'},
    {id:6,title:'Oh Geez Cheeses',status:'ideas',category:'Merch'}],
  activity:[
    {icon:'⭐',text:'Nick marked A Prince in Pinecone Falls as a strong pick.'},
    {icon:'💬',text:'Jenny commented on Murdered by Mistletoe.'},
    {icon:'📅',text:'Watch Night was added to the schedule.'}
  ]
};

let state = JSON.parse(localStorage.getItem('cheeseLouiseV11')) || seed;
let currentTab='home';
let searchText='';
let selectedMovie=null;

function save(){localStorage.setItem('cheeseLouiseV11',JSON.stringify(state));}
function esc(s=''){return s.replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));}
function otherUser(){return state.currentUser==='Nick'?'Jenny':'Nick'}
function consensus(m){
  const n=m.votes.Nick,j=m.votes.Jenny;
  if(n==='yes'&&j==='yes') return '🔥 Both want it';
  if((n==='yes'&&j==='no')||(n==='no'&&j==='yes')) return '⚖️ Split decision';
  if(n||j) return '👀 Needs the other vote';
  return '🆕 Unreviewed';
}
function activity(text,icon='•'){state.activity.unshift({text,icon});state.activity=state.activity.slice(0,20);save();}

function topbar(){return `
<div class="topbar">
  <div class="brand-row">
    <div class="brand"><div class="brand-mark">CL</div><div>Cheese Louise HQ</div></div>
    <div class="profile-switch">
      <button class="${state.currentUser==='Nick'?'active':''}" onclick="switchUser('Nick')">Nick</button>
      <button class="${state.currentUser==='Jenny'?'active':''}" onclick="switchUser('Jenny')">Jenny</button>
    </div>
  </div>
  <div class="search-row">
    <input class="search" placeholder="Search movies, notes, ideas…" value="${esc(searchText)}" oninput="setSearch(this.value)" />
    <button class="quick-add" onclick="quickAdd()">+</button>
  </div>
</div>`}
function tabs(){
 const items=[['home','⌂','Home'],['movies','🎬','Movies'],['episodes','🎙','Episodes'],['schedule','📅','Schedule'],['ideas','💡','Ideas']];
 return `<nav class="tabs">${items.map(i=>`<button class="${currentTab===i[0]?'active':''}" onclick="go('${i[0]}')"><span class="tab-icon">${i[1]}</span>${i[2]}</button>`).join('')}</nav>`
}
function movieCard(m){
 const v=m.votes[state.currentUser];
 const b=m.bookmarks[state.currentUser];
 return `<article class="movie-card card">
   <div class="poster" onclick="openMovie(${m.id})"><div class="poster-title">${esc(m.title)}</div></div>
   <div class="movie-body">
      <div class="score-row"><span class="subtle">${esc(m.network)} • ${esc(m.date)}</span><span class="cheese-score">🧀 ${m.score}</span></div>
      <div class="pills">${m.tags.slice(0,3).map(t=>`<span class="pill">${esc(t)}</span>`).join('')}</div>
      <div class="subtle">${consensus(m)}</div>
      <div class="vote-row">
        <button class="vote-btn ${v==='yes'?'active-yes':''}" onclick="vote(${m.id},'yes')">❤️ Yes</button>
        <button class="vote-btn ${v==='maybe'?'active-maybe':''}" onclick="vote(${m.id},'maybe')">🤔 Maybe</button>
        <button class="vote-btn ${v==='no'?'active-no':''}" onclick="vote(${m.id},'no')">❌ No</button>
      </div>
      <div class="actions">
        <button class="${b?'active':''}" onclick="bookmark(${m.id})">🔖 ${b?'Saved':'Save'}</button>
        <button onclick="openMovie(${m.id})">💬 ${m.comments.length}</button>
        <button onclick="scheduleMovie(${m.id})">📅</button>
      </div>
   </div>
 </article>`
}
function filteredMovies(){
 const q=searchText.trim().toLowerCase();
 if(!q)return state.movies;
 return state.movies.filter(m=>[m.title,m.network,m.summary,...m.tags,...m.comments.map(c=>c.text)].join(' ').toLowerCase().includes(q));
}
function home(){
 const needsVote=state.movies.filter(m=>!m.votes[state.currentUser]&&m.votes[otherUser()]);
 const mutual=state.movies.filter(m=>m.votes.Nick==='yes'&&m.votes.Jenny==='yes');
 const saved=state.movies.filter(m=>m.bookmarks[state.currentUser]);
 const next=state.episodes[0];
 return `<section class="section">
   <div class="hero-grid">
    <div class="card card-pad next-episode"><div class="kicker">Next episode</div><div class="big-title">${esc(next.title)}</div><div class="pills"><span class="pill">${esc(next.status)}</span><span class="pill">Release: ${esc(next.release)}</span></div><div style="margin-top:14px"><button class="primary" onclick="go('episodes')">Open episode</button></div></div>
    <div class="stat-grid"><div class="stat"><div class="num">${needsVote.length}</div><div class="label">Need your vote</div></div><div class="stat"><div class="num">${mutual.length}</div><div class="label">Mutual picks</div></div><div class="stat"><div class="num">${saved.length}</div><div class="label">Your saved movies</div></div><div class="stat"><div class="num">${state.ideas.filter(i=>i.status==='testing').length}</div><div class="label">Tests running</div></div></div>
   </div>
 </section>
 <section class="section"><h2>${needsVote.length?'Jenny/Nick picked these — your turn':'Movies for us'}</h2><div class="movie-grid">${(needsVote.length?needsVote:state.movies.slice(0,3)).map(movieCard).join('')}</div></section>
 <section class="section"><h2>Recent activity</h2><div class="activity-list">${state.activity.slice(0,5).map(a=>`<div class="activity-item"><div class="activity-icon">${a.icon}</div><div>${esc(a.text)}</div></div>`).join('')}</div></section>`
}
function movies(){return `<section class="section"><div class="page-title">Movies</div><div class="subtle">Find, save, vote, discuss, and schedule.</div></section><section class="section"><div class="toolbar"><button class="filter" onclick="filterPreset('all')">All</button><button class="filter" onclick="filterPreset('mutual')">🔥 Mutual</button><button class="filter" onclick="filterPreset('saved')">🔖 Saved</button><button class="filter" onclick="filterPreset('unreviewed')">🆕 Unreviewed</button></div><div id="movieGrid" class="movie-grid">${filteredMovies().map(movieCard).join('')||'<div class="empty">Nothing found.</div>'}</div></section>`}
function episodes(){return `<section class="section"><div class="page-title">Episodes</div><div class="subtle">Everything from movie choice to release.</div></section><section class="section"><div class="list">${state.episodes.map(e=>`<div class="card episode-card"><div class="kicker">${esc(e.status)}</div><h2 style="margin:5px 0 4px">${esc(e.title)}</h2><div class="subtle">Release: ${esc(e.release)}</div><div class="progress">${e.steps.map(s=>`<span class="step ${e.done.includes(s)?'done':''}">${e.done.includes(s)?'✓ ':''}${s}</span>`).join('')}</div><div style="margin-top:12px"><button class="secondary" onclick="alert('Episode outline workspace is scaffolded for v1.2. v1.1 proves the navigation and shared workflow first.')">Open workspace</button></div></div>`).join('')}</div></section>`}
function schedule(){
 const days=['Oct 5','Oct 6','Oct 7','Oct 8','Oct 9','Oct 10','Oct 11','Oct 12','Oct 13','Oct 14','Oct 15','Oct 16','Oct 17','Oct 18'];
 return `<section class="section"><div class="page-title">Schedule</div><div class="subtle">Watch, record, edit, release, and premiere dates.</div></section><section class="section"><div class="calendar">${days.map(d=>`<div class="day"><div class="date">${d}</div>${state.schedule.filter(e=>e.date===d).map(e=>`<div class="event">${esc(e.type)} • ${esc(e.title)}</div>`).join('')}</div>`).join('')}</div></section><section class="section"><button class="primary" onclick="addSchedule()">+ Add schedule item</button></section>`
}
function ideas(){
 const cols=[['ideas','Ideas'],['testing','Testing'],['working','Working'],['retired','Retired']];
 return `<section class="section"><div class="page-title">Show Lab</div><div class="subtle">Things to try, what works, and what should never darken the doorway again.</div></section><section class="section"><div class="idea-columns">${cols.map(([k,label])=>`<div class="idea-col"><h3>${label}</h3>${state.ideas.filter(i=>i.status===k).map(i=>`<div class="idea-card"><strong>${esc(i.title)}</strong><div class="subtle">${esc(i.category)}</div><div style="margin-top:8px"><button class="secondary" onclick="advanceIdea(${i.id})">Move →</button></div></div>`).join('')||'<div class="subtle" style="margin-top:8px">Nothing here.</div>'}</div>`).join('')}</div></section>`
}
function modal(){
 if(!selectedMovie)return '';
 const m=state.movies.find(x=>x.id===selectedMovie);
 if(!m)return '';
 return `<div class="modal-backdrop" onclick="closeMovie(event)"><div class="modal" onclick="event.stopPropagation()"><div class="modal-header"><div><div class="kicker">${esc(m.network)} • ${esc(m.date)}</div><h2 style="margin:6px 0">${esc(m.title)}</h2><div class="cheese-score">🧀 Cheese potential ${m.score}</div></div><button class="close" onclick="selectedMovie=null;render()">×</button></div><p>${esc(m.summary)}</p><div class="pills">${m.tags.map(t=>`<span class="pill">${esc(t)}</span>`).join('')}</div><div style="margin-top:16px"><strong>${consensus(m)}</strong></div><div class="vote-row" style="margin-top:10px"><button class="vote-btn ${m.votes[state.currentUser]==='yes'?'active-yes':''}" onclick="vote(${m.id},'yes')">❤️ Yes</button><button class="vote-btn ${m.votes[state.currentUser]==='maybe'?'active-maybe':''}" onclick="vote(${m.id},'maybe')">🤔 Maybe</button><button class="vote-btn ${m.votes[state.currentUser]==='no'?'active-no':''}" onclick="vote(${m.id},'no')">❌ No</button></div><h3 style="margin-top:22px">Comments</h3>${m.comments.map(c=>`<div class="comment"><strong>${esc(c.user)}</strong><div>${esc(c.text)}</div></div>`).join('')||'<div class="subtle" style="margin-top:8px">No comments yet.</div>'}<div class="comment-box"><input id="commentInput" placeholder="Add a note…"><button class="primary" onclick="comment(${m.id})">Send</button></div></div></div>`
}
function render(){
 const page={home, movies, episodes, schedule, ideas}[currentTab]();
 document.getElementById('app').innerHTML=`<div class="app-shell">${topbar()}${page}</div>${tabs()}${modal()}`;
}
window.go=(t)=>{currentTab=t;render();window.scrollTo(0,0)}
window.switchUser=(u)=>{state.currentUser=u;save();activity(`${u} opened Cheese Louise HQ.`,'👤');render()}
window.setSearch=(v)=>{searchText=v;if(currentTab!=='movies'&&v.trim())currentTab='movies';render()}
window.vote=(id,v)=>{const m=state.movies.find(x=>x.id===id);m.votes[state.currentUser]=v;activity(`${state.currentUser} voted ${v.toUpperCase()} on ${m.title}.`,'🗳');save();render()}
window.bookmark=(id)=>{const m=state.movies.find(x=>x.id===id);m.bookmarks[state.currentUser]=!m.bookmarks[state.currentUser];activity(`${state.currentUser} ${m.bookmarks[state.currentUser]?'saved':'unsaved'} ${m.title}.`,'🔖');save();render()}
window.openMovie=(id)=>{selectedMovie=id;render()}
window.closeMovie=()=>{selectedMovie=null;render()}
window.comment=(id)=>{const el=document.getElementById('commentInput');const text=el.value.trim();if(!text)return;const m=state.movies.find(x=>x.id===id);m.comments.push({user:state.currentUser,text});activity(`${state.currentUser} commented on ${m.title}.`,'💬');save();render()}
window.scheduleMovie=(id)=>{const m=state.movies.find(x=>x.id===id);const date=prompt('Schedule date (example: Oct 8):','Oct 8');if(!date)return;state.schedule.push({date,type:'Watch',title:m.title});activity(`${state.currentUser} scheduled ${m.title} for ${date}.`,'📅');save();render()}
window.addSchedule=()=>{const title=prompt('What are we scheduling?');if(!title)return;const date=prompt('Date (example: Oct 12):','Oct 12');if(!date)return;const type=prompt('Type: Watch, Record, Edit, Release','Record')||'Event';state.schedule.push({date,type,title});activity(`${state.currentUser} added ${title} to the schedule.`,'📅');save();render()}
window.quickAdd=()=>{const text=prompt('Quick idea / note:');if(!text)return;state.ideas.unshift({id:Date.now(),title:text,status:'ideas',category:'Quick add'});activity(`${state.currentUser} added a new idea: ${text}`,'💡');save();currentTab='ideas';render()}
window.advanceIdea=(id)=>{const order=['ideas','testing','working','retired'];const i=state.ideas.find(x=>x.id===id);i.status=order[(order.indexOf(i.status)+1)%order.length];activity(`${state.currentUser} moved “${i.title}” to ${i.status}.`,'🧪');save();render()}
window.filterPreset=(type)=>{let arr=state.movies;if(type==='mutual')arr=arr.filter(m=>m.votes.Nick==='yes'&&m.votes.Jenny==='yes');if(type==='saved')arr=arr.filter(m=>m.bookmarks[state.currentUser]);if(type==='unreviewed')arr=arr.filter(m=>!m.votes[state.currentUser]);document.getElementById('movieGrid').innerHTML=arr.map(movieCard).join('')||'<div class="empty">Nothing in this view yet.</div>'}
render();
