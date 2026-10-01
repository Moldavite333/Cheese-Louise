const SUPABASE_URL = 'https://wgvsnmukiaobcbyqhkkt.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_3xcqfNu-mJPuDWivmlBXug_3Tw60QoM';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

let session = null;
let workspace = null;
let profile = null;
let members = [];
let profiles = {};
let state = { movies: [], episodes: [], schedule: [], ideas: [], activity: [] };
let currentTab = 'home';
let searchText = '';
let selectedMovie = null;
let channel = null;
let reloadTimer = null;

const esc = (s='') => String(s ?? '').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const fmtDate = (value) => value ? new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : 'TBD';
const fmtDateTime = (value) => value ? new Date(value).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'TBD';
const me = () => session?.user?.id;
const memberName = (id) => profiles[id]?.display_name || (id===me() ? profile?.display_name : 'Partner');
const otherMembers = () => members.filter(m=>m.user_id!==me());

function shell(content){
  document.getElementById('app').innerHTML = content;
}

function message(text, kind='subtle'){
  return `<div class="${kind}" style="margin-top:10px">${esc(text)}</div>`;
}

function authScreen(note=''){
  shell(`<div class="app-shell" style="max-width:520px;margin:0 auto;padding-top:8vh">
    <section class="section">
      <div class="card card-pad">
        <div class="brand-row" style="margin-bottom:18px">
          <div class="brand"><div class="brand-mark">CL</div><div>Cheese Louise HQ</div></div>
        </div>
        <div class="page-title">Sign in</div>
        <div class="subtle">Nick and Jenny each use their own login. Shared stuff stays shared.</div>
        <div style="display:grid;gap:10px;margin-top:18px">
          <input id="displayName" class="search" placeholder="Your name (needed for first signup)" />
          <input id="email" class="search" type="email" placeholder="Email" />
          <input id="password" class="search" type="password" placeholder="Password" />
          <button class="primary" onclick="signIn()">Sign in</button>
          <button class="secondary" onclick="signUp()">Create account</button>
        </div>
        ${note ? message(note) : ''}
      </div>
    </section>
  </div>`);
}

async function signIn(){
  const email=document.getElementById('email').value.trim();
  const password=document.getElementById('password').value;
  if(!email||!password) return authScreen('Enter your email and password.');
  const {error}=await db.auth.signInWithPassword({email,password});
  if(error) return authScreen(error.message);
  await boot();
}

async function signUp(){
  const display_name=document.getElementById('displayName').value.trim() || 'Cheese Louise User';
  const email=document.getElementById('email').value.trim();
  const password=document.getElementById('password').value;
  if(!email||password.length<6) return authScreen('Use a real email and a password at least 6 characters long.');
  const {data,error}=await db.auth.signUp({email,password,options:{data:{display_name}}});
  if(error) return authScreen(error.message);
  if(!data.session) return authScreen('Account created. Check your email for the confirmation link, then come back and sign in.');
  await boot();
}

async function signOut(){
  if(channel) await db.removeChannel(channel);
  await db.auth.signOut();
  session=null; workspace=null; profile=null; members=[]; profiles={};
  authScreen('Signed out.');
}

function onboardingScreen(note=''){
  shell(`<div class="app-shell" style="max-width:620px;margin:0 auto;padding-top:5vh">
    <section class="section">
      <div class="card card-pad">
        <div class="brand"><div class="brand-mark">CL</div><div>Cheese Louise HQ</div></div>
        <div class="page-title" style="margin-top:22px">Set up the shared HQ</div>
        <p class="subtle">One of you creates the workspace. The other joins it with the code.</p>
        <div style="display:grid;gap:12px;margin-top:18px">
          <button class="primary" onclick="createWorkspace()">Create Cheese Louise HQ</button>
          <div class="subtle" style="text-align:center">— or —</div>
          <input id="joinCode" class="search" placeholder="Enter shared join code" maxlength="12" />
          <button class="secondary" onclick="joinWorkspace()">Join workspace</button>
          <button class="secondary" onclick="signOut()">Sign out</button>
        </div>
        ${note ? message(note) : ''}
      </div>
    </section>
  </div>`);
}

async function createWorkspace(){
  const {data,error}=await db.from('workspaces').insert({name:'Cheese Louise HQ',owner_id:me()}).select().single();
  if(error) return onboardingScreen(error.message);
  workspace=data;
  await loadWorkspace();
  const old=localStorage.getItem('cheeseLouiseV11');
  if(old && confirm('I found your old v1.1 data on this device. Import it into the shared Cheese Louise HQ?')){
    await importV11Data();
    await loadAll();
  }
  render();
}

async function joinWorkspace(){
  const code=document.getElementById('joinCode').value.trim();
  if(!code) return onboardingScreen('Enter the join code from the other person’s phone.');
  const {error}=await db.rpc('join_workspace',{p_code:code});
  if(error) return onboardingScreen(error.message);
  await loadWorkspace();
  render();
}

async function loadWorkspace(){
  const {data:profileData}=await db.from('profiles').select('*').eq('id',me()).maybeSingle();
  profile=profileData || {display_name:session.user.email?.split('@')[0] || 'User'};
  const {data:ids,error}=await db.rpc('my_workspace_ids');
  if(error) throw error;
  if(!ids?.length){ workspace=null; onboardingScreen(); return; }
  const workspaceId=ids[0];
  const {data:w}=await db.from('workspaces').select('*').eq('id',workspaceId).single();
  workspace=w;
  const {data:memberRows}=await db.from('workspace_members').select('*').eq('workspace_id',workspaceId);
  members=memberRows || [];
  const userIds=members.map(m=>m.user_id);
  if(userIds.length){
    const {data:profileRows}=await db.from('profiles').select('*').in('id',userIds);
    profiles=Object.fromEntries((profileRows||[]).map(p=>[p.id,p]));
  }
  await loadAll();
  subscribeRealtime();
}

async function loadAll(){
  if(!workspace) return;
  const wid=workspace.id;
  const [moviesRes,votesRes,bookmarksRes,commentsRes,episodesRes,scheduleRes,ideasRes,activityRes] = await Promise.all([
    db.from('movies').select('*').eq('workspace_id',wid).order('created_at',{ascending:false}),
    db.from('movie_votes').select('*').eq('workspace_id',wid),
    db.from('movie_bookmarks').select('*').eq('workspace_id',wid),
    db.from('movie_comments').select('*').eq('workspace_id',wid).order('created_at'),
    db.from('episodes').select('*').eq('workspace_id',wid).order('created_at',{ascending:false}),
    db.from('schedule_items').select('*').eq('workspace_id',wid).order('starts_at'),
    db.from('show_ideas').select('*').eq('workspace_id',wid).order('created_at',{ascending:false}),
    db.from('activity').select('*').eq('workspace_id',wid).order('created_at',{ascending:false}).limit(30)
  ]);
  const votes=votesRes.data||[], bookmarks=bookmarksRes.data||[], comments=commentsRes.data||[];
  state.movies=(moviesRes.data||[]).map(m=>({
    ...m,
    date:m.premiere_date?fmtDate(m.premiere_date):'TBD',
    score:m.cheese_score??'—',
    votes:Object.fromEntries(votes.filter(v=>v.movie_id===m.id).map(v=>[v.user_id,v.vote])),
    bookmarks:Object.fromEntries(bookmarks.filter(b=>b.movie_id===m.id).map(b=>[b.user_id,true])),
    comments:comments.filter(c=>c.movie_id===m.id)
  }));
  state.episodes=episodesRes.data||[];
  state.schedule=scheduleRes.data||[];
  state.ideas=ideasRes.data||[];
  state.activity=activityRes.data||[];
}

function subscribeRealtime(){
  if(channel) db.removeChannel(channel);
  channel=db.channel(`workspace:${workspace.id}`)
    .on('postgres_changes',{event:'*',schema:'public'},()=>{
      clearTimeout(reloadTimer);
      reloadTimer=setTimeout(async()=>{await loadAll();render();},250);
    })
    .subscribe();
}

async function logActivity(action,entity_type=null,entity_id=null){
  if(!workspace) return;
  await db.from('activity').insert({workspace_id:workspace.id,user_id:me(),action,entity_type,entity_id});
}

function consensus(m){
  const votes=Object.values(m.votes||{});
  const yes=votes.filter(v=>v==='yes').length;
  const no=votes.filter(v=>v==='no').length;
  if(members.length>=2 && yes>=2) return '🔥 Both want it';
  if(yes && no) return '⚖️ Split decision';
  if(votes.length===1) return '👀 Needs the other vote';
  return votes.length ? '👀 Still deciding' : '🆕 Unreviewed';
}

function topbar(){
  return `<div class="topbar">
    <div class="brand-row">
      <div class="brand"><div class="brand-mark">CL</div><div>Cheese Louise HQ</div></div>
      <button class="secondary" onclick="signOut()">${esc(profile?.display_name||'Account')} · Sign out</button>
    </div>
    <div class="search-row">
      <input class="search" placeholder="Search movies, notes, ideas…" value="${esc(searchText)}" oninput="setSearch(this.value)" />
      <button class="quick-add" onclick="quickAdd()">+</button>
    </div>
    <div class="subtle" style="margin-top:8px">Shared workspace · ${members.length}/2 members · Join code <strong>${esc(workspace.join_code)}</strong></div>
  </div>`;
}

function tabs(){
  const items=[['home','⌂','Home'],['movies','🎬','Movies'],['episodes','🎙','Episodes'],['schedule','📅','Schedule'],['ideas','💡','Ideas']];
  return `<nav class="tabs">${items.map(i=>`<button class="${currentTab===i[0]?'active':''}" onclick="go('${i[0]}')"><span class="tab-icon">${i[1]}</span>${i[2]}</button>`).join('')}</nav>`;
}

function movieCard(m){
  const v=m.votes?.[me()];
  const b=!!m.bookmarks?.[me()];
  return `<article class="movie-card card">
    <div class="poster" onclick="openMovie('${m.id}')"><div class="poster-title">${esc(m.title)}</div></div>
    <div class="movie-body">
      <div class="score-row"><span class="subtle">${esc(m.network||'Unknown')} • ${esc(m.date)}</span><span class="cheese-score">🧀 ${esc(m.score)}</span></div>
      <div class="pills">${(m.tags||[]).slice(0,3).map(t=>`<span class="pill">${esc(t)}</span>`).join('')}</div>
      <div class="subtle">${consensus(m)}</div>
      <div class="vote-row">
        <button class="vote-btn ${v==='yes'?'active-yes':''}" onclick="vote('${m.id}','yes')">❤️ Yes</button>
        <button class="vote-btn ${v==='maybe'?'active-maybe':''}" onclick="vote('${m.id}','maybe')">🤔 Maybe</button>
        <button class="vote-btn ${v==='no'?'active-no':''}" onclick="vote('${m.id}','no')">❌ No</button>
      </div>
      <div class="actions">
        <button class="${b?'active':''}" onclick="bookmark('${m.id}')">🔖 ${b?'Saved':'Save'}</button>
        <button onclick="openMovie('${m.id}')">💬 ${m.comments.length}</button>
        <button onclick="scheduleMovie('${m.id}')">📅</button>
      </div>
    </div>
  </article>`;
}

function filteredMovies(){
  const q=searchText.trim().toLowerCase();
  if(!q) return state.movies;
  return state.movies.filter(m=>[m.title,m.network,m.summary,m.notes,...(m.tags||[]),...(m.comments||[]).map(c=>c.body)].join(' ').toLowerCase().includes(q));
}

function home(){
  const needsVote=state.movies.filter(m=>!m.votes?.[me()] && Object.keys(m.votes||{}).some(id=>id!==me()));
  const mutual=state.movies.filter(m=>Object.values(m.votes||{}).filter(v=>v==='yes').length>=2);
  const saved=state.movies.filter(m=>m.bookmarks?.[me()]);
  const next=state.episodes[0];
  return `<section class="section"><div class="hero-grid">
    <div class="card card-pad next-episode"><div class="kicker">Next episode</div><div class="big-title">${esc(next?.title||'No episode queued yet')}</div><div class="pills"><span class="pill">${esc(next?.status||'Start one')}</span><span class="pill">Release: ${esc(next?.release_date?fmtDate(next.release_date):'TBD')}</span></div><div style="margin-top:14px"><button class="primary" onclick="go('episodes')">Open episodes</button></div></div>
    <div class="stat-grid"><div class="stat"><div class="num">${needsVote.length}</div><div class="label">Need your vote</div></div><div class="stat"><div class="num">${mutual.length}</div><div class="label">Mutual picks</div></div><div class="stat"><div class="num">${saved.length}</div><div class="label">Your saved movies</div></div><div class="stat"><div class="num">${state.ideas.filter(i=>i.status==='testing').length}</div><div class="label">Tests running</div></div></div>
  </div></section>
  <section class="section"><h2>${needsVote.length?'Your turn to vote':'Movies for us'}</h2><div class="movie-grid">${(needsVote.length?needsVote:state.movies.slice(0,3)).map(movieCard).join('')||'<div class="empty">Add your first movie in the Movies tab.</div>'}</div></section>
  <section class="section"><h2>Recent activity</h2><div class="activity-list">${state.activity.slice(0,6).map(a=>`<div class="activity-item"><div class="activity-icon">•</div><div><strong>${esc(memberName(a.user_id))}</strong> ${esc(a.action)}</div></div>`).join('')||'<div class="subtle">Nothing yet.</div>'}</div></section>`;
}

function movies(){
  return `<section class="section"><div class="page-title">Movies</div><div class="subtle">Find, save, vote, discuss, and schedule.</div><div style="margin-top:12px"><button class="primary" onclick="addMovie()">+ Add movie</button></div></section>
  <section class="section"><div class="toolbar"><button class="filter" onclick="filterPreset('all')">All</button><button class="filter" onclick="filterPreset('mutual')">🔥 Mutual</button><button class="filter" onclick="filterPreset('saved')">🔖 Saved</button><button class="filter" onclick="filterPreset('unreviewed')">🆕 Unreviewed</button></div><div id="movieGrid" class="movie-grid">${filteredMovies().map(movieCard).join('')||'<div class="empty">Nothing found.</div>'}</div></section>`;
}

function episodes(){
  return `<section class="section"><div class="page-title">Episodes</div><div class="subtle">Everything from movie choice to release.</div><div style="margin-top:12px"><button class="primary" onclick="addEpisode()">+ New episode</button></div></section>
  <section class="section"><div class="list">${state.episodes.map(e=>`<div class="card episode-card"><div class="kicker">${esc(e.status)}</div><h2 style="margin:5px 0 4px">${esc(e.title)}</h2><div class="subtle">Release: ${esc(e.release_date?fmtDate(e.release_date):'TBD')}${e.guest?` · Guest: ${esc(e.guest)}`:''}</div>${e.cocktail?`<div class="pill" style="margin-top:8px">🍸 ${esc(e.cocktail)}</div>`:''}${e.notes?`<p>${esc(e.notes)}</p>`:''}</div>`).join('')||'<div class="empty">No episodes yet.</div>'}</div></section>`;
}

function schedule(){
  return `<section class="section"><div class="page-title">Schedule</div><div class="subtle">Watch, record, edit, release, and premiere dates.</div><div style="margin-top:12px"><button class="primary" onclick="addSchedule()">+ Add schedule item</button></div></section>
  <section class="section"><div class="list">${state.schedule.map(e=>`<div class="card card-pad"><div class="kicker">${esc(e.item_type)}</div><h3 style="margin:5px 0">${esc(e.title)}</h3><div class="subtle">${esc(fmtDateTime(e.starts_at))}</div>${e.notes?`<p>${esc(e.notes)}</p>`:''}</div>`).join('')||'<div class="empty">Nothing scheduled yet.</div>'}</div></section>`;
}

function ideas(){
  const cols=[['ideas','Ideas'],['testing','Testing'],['working','Working'],['retired','Retired']];
  return `<section class="section"><div class="page-title">Show Lab</div><div class="subtle">Things to try, what works, and what should never darken the doorway again.</div></section><section class="section"><div class="idea-columns">${cols.map(([k,label])=>`<div class="idea-col"><h3>${label}</h3>${state.ideas.filter(i=>i.status===k).map(i=>`<div class="idea-card"><strong>${esc(i.title)}</strong><div class="subtle">${esc(i.category||'Idea')}</div>${i.notes?`<div style="margin-top:6px">${esc(i.notes)}</div>`:''}<div style="margin-top:8px"><button class="secondary" onclick="advanceIdea('${i.id}')">Move →</button></div></div>`).join('')||'<div class="subtle" style="margin-top:8px">Nothing here.</div>'}</div>`).join('')}</div></section>`;
}

function modal(){
  if(!selectedMovie) return '';
  const m=state.movies.find(x=>x.id===selectedMovie);
  if(!m) return '';
  const v=m.votes?.[me()];
  return `<div class="modal-backdrop" onclick="closeMovie(event)"><div class="modal" onclick="event.stopPropagation()"><div class="modal-header"><div><div class="kicker">${esc(m.network||'Unknown')} • ${esc(m.date)}</div><h2 style="margin:6px 0">${esc(m.title)}</h2><div class="cheese-score">🧀 Cheese potential ${esc(m.score)}</div></div><button class="close" onclick="selectedMovie=null;render()">×</button></div><p>${esc(m.summary||'No summary yet.')}</p><div class="pills">${(m.tags||[]).map(t=>`<span class="pill">${esc(t)}</span>`).join('')}</div><div style="margin-top:16px"><strong>${consensus(m)}</strong></div><div class="vote-row" style="margin-top:10px"><button class="vote-btn ${v==='yes'?'active-yes':''}" onclick="vote('${m.id}','yes')">❤️ Yes</button><button class="vote-btn ${v==='maybe'?'active-maybe':''}" onclick="vote('${m.id}','maybe')">🤔 Maybe</button><button class="vote-btn ${v==='no'?'active-no':''}" onclick="vote('${m.id}','no')">❌ No</button></div><h3 style="margin-top:22px">Comments</h3>${m.comments.map(c=>`<div class="comment"><strong>${esc(memberName(c.user_id))}</strong><div>${esc(c.body)}</div></div>`).join('')||'<div class="subtle" style="margin-top:8px">No comments yet.</div>'}<div class="comment-box"><input id="commentInput" placeholder="Add a note…"><button class="primary" onclick="comment('${m.id}')">Send</button></div></div></div>`;
}

function render(){
  if(!session) return authScreen();
  if(!workspace) return onboardingScreen();
  const page={home,movies,episodes,schedule,ideas}[currentTab]();
  shell(`<div class="app-shell">${topbar()}${page}</div>${tabs()}${modal()}`);
}

async function vote(id,v){
  await db.from('movie_votes').upsert({workspace_id:workspace.id,movie_id:id,user_id:me(),vote:v},{onConflict:'movie_id,user_id'});
  const movie=state.movies.find(m=>m.id===id);
  await logActivity(`voted ${v.toUpperCase()} on ${movie?.title||'a movie'}.`,'movie',id);
  await loadAll(); render();
}

async function bookmark(id){
  const saved=state.movies.find(m=>m.id===id)?.bookmarks?.[me()];
  if(saved) await db.from('movie_bookmarks').delete().eq('movie_id',id).eq('user_id',me());
  else await db.from('movie_bookmarks').insert({workspace_id:workspace.id,movie_id:id,user_id:me()});
  await logActivity(`${saved?'unsaved':'saved'} ${state.movies.find(m=>m.id===id)?.title||'a movie'}.`,'movie',id);
  await loadAll(); render();
}

async function comment(id){
  const el=document.getElementById('commentInput');
  const text=el?.value.trim(); if(!text) return;
  await db.from('movie_comments').insert({workspace_id:workspace.id,movie_id:id,user_id:me(),body:text});
  await logActivity(`commented on ${state.movies.find(m=>m.id===id)?.title||'a movie'}.`,'movie',id);
  await loadAll(); render();
}

async function addMovie(){
  const title=prompt('Movie title:'); if(!title) return;
  const network=prompt('Network / studio:','Hallmark')||'';
  const scoreRaw=prompt('Cheese potential 0–100:','85');
  const cheese_score=Math.max(0,Math.min(100,Number(scoreRaw)||0));
  const tags=(prompt('Tags, separated by commas:','Small town, Christmas')||'').split(',').map(x=>x.trim()).filter(Boolean);
  const summary=prompt('Short premise / why it looks promising:','')||'';
  const {data,error}=await db.from('movies').insert({workspace_id:workspace.id,title,network,cheese_score,tags,summary,created_by:me()}).select().single();
  if(error) return alert(error.message);
  await logActivity(`added ${title} to the Movie Radar.`,'movie',data.id);
  await loadAll(); render();
}

async function scheduleMovie(id){
  const m=state.movies.find(x=>x.id===id); if(!m) return;
  const when=prompt('Watch date/time (example: 2026-10-08 19:00):','2026-10-08 19:00'); if(!when) return;
  const starts_at=new Date(when).toISOString();
  await db.from('schedule_items').insert({workspace_id:workspace.id,title:m.title,item_type:'watch',starts_at,created_by:me()});
  await logActivity(`scheduled ${m.title}.`,'movie',id);
  await loadAll(); render();
}

async function addSchedule(){
  const title=prompt('What are we scheduling?'); if(!title) return;
  const when=prompt('Date/time (example: 2026-10-12 19:00):','2026-10-12 19:00'); if(!when) return;
  const item_type=(prompt('Type: watch, record, edit, release, premiere, guest, other','record')||'other').toLowerCase();
  await db.from('schedule_items').insert({workspace_id:workspace.id,title,item_type,starts_at:new Date(when).toISOString(),created_by:me()});
  await logActivity(`added ${title} to the schedule.`,'schedule');
  await loadAll(); render();
}

async function addEpisode(){
  const title=prompt('Episode title / movie:'); if(!title) return;
  const guest=prompt('Guest (optional):','')||'';
  const cocktail=prompt('Cocktail (optional):','')||'';
  const notes=prompt('Episode notes / angle:','')||'';
  const {data,error}=await db.from('episodes').insert({workspace_id:workspace.id,title,status:'idea',guest,cocktail,notes,created_by:me()}).select().single();
  if(error) return alert(error.message);
  await logActivity(`created episode ${title}.`,'episode',data.id);
  await loadAll(); render();
}

async function quickAdd(){
  const text=prompt('Quick idea / note:'); if(!text) return;
  const {data,error}=await db.from('show_ideas').insert({workspace_id:workspace.id,title:text,status:'ideas',category:'Quick add',created_by:me()}).select().single();
  if(error) return alert(error.message);
  await logActivity(`added a new idea: ${text}`,'idea',data.id);
  currentTab='ideas'; await loadAll(); render();
}

async function advanceIdea(id){
  const order=['ideas','testing','working','retired'];
  const i=state.ideas.find(x=>x.id===id); if(!i) return;
  const status=order[(order.indexOf(i.status)+1)%order.length];
  await db.from('show_ideas').update({status}).eq('id',id);
  await logActivity(`moved “${i.title}” to ${status}.`,'idea',id);
  await loadAll(); render();
}

async function importV11Data(){
  const raw=localStorage.getItem('cheeseLouiseV11'); if(!raw) return;
  const old=JSON.parse(raw);
  const {count}=await db.from('movies').select('*',{count:'exact',head:true}).eq('workspace_id',workspace.id);
  if(count>0) return;

  const movieMap={};
  for(const m of old.movies||[]){
    const {data}=await db.from('movies').insert({workspace_id:workspace.id,title:m.title,network:m.network,cheese_score:Number(m.score)||null,tags:m.tags||[],summary:m.summary||'',created_by:me()}).select().single();
    if(!data) continue;
    movieMap[m.id]=data.id;
    const oldUser=old.currentUser||profile.display_name;
    const vote=m.votes?.[oldUser];
    if(vote) await db.from('movie_votes').insert({workspace_id:workspace.id,movie_id:data.id,user_id:me(),vote});
    if(m.bookmarks?.[oldUser]) await db.from('movie_bookmarks').insert({workspace_id:workspace.id,movie_id:data.id,user_id:me()});
    for(const c of (m.comments||[]).filter(c=>c.user===oldUser)) await db.from('movie_comments').insert({workspace_id:workspace.id,movie_id:data.id,user_id:me(),body:c.text});
  }
  for(const e of old.episodes||[]) await db.from('episodes').insert({workspace_id:workspace.id,title:e.title,status:String(e.status||'idea').toLowerCase()==='planning'?'planning':'idea',notes:`Imported from v1.1. Release: ${e.release||'TBD'}`,created_by:me()});
  for(const s of old.schedule||[]){
    const year=new Date().getFullYear();
    const parsed=new Date(`${s.date}, ${year} 19:00`);
    if(!isNaN(parsed)) await db.from('schedule_items').insert({workspace_id:workspace.id,title:s.title,item_type:String(s.type||'other').toLowerCase()==='special'?'other':String(s.type||'other').toLowerCase(),starts_at:parsed.toISOString(),created_by:me()});
  }
  for(const i of old.ideas||[]) await db.from('show_ideas').insert({workspace_id:workspace.id,title:i.title,status:i.status||'ideas',category:i.category||'Imported',created_by:me()});
  await logActivity('imported the old v1.1 workspace into shared sync.','import');
}

window.go=(t)=>{currentTab=t;render();window.scrollTo(0,0)};
window.setSearch=(v)=>{searchText=v;if(currentTab!=='movies'&&v.trim())currentTab='movies';render()};
window.openMovie=(id)=>{selectedMovie=id;render()};
window.closeMovie=()=>{selectedMovie=null;render()};
window.filterPreset=(type)=>{
  let arr=state.movies;
  if(type==='mutual') arr=arr.filter(m=>Object.values(m.votes||{}).filter(v=>v==='yes').length>=2);
  if(type==='saved') arr=arr.filter(m=>m.bookmarks?.[me()]);
  if(type==='unreviewed') arr=arr.filter(m=>!m.votes?.[me()]);
  const grid=document.getElementById('movieGrid'); if(grid) grid.innerHTML=arr.map(movieCard).join('')||'<div class="empty">Nothing in this view yet.</div>';
};
window.signIn=signIn; window.signUp=signUp; window.signOut=signOut; window.createWorkspace=createWorkspace; window.joinWorkspace=joinWorkspace;
window.vote=vote; window.bookmark=bookmark; window.comment=comment; window.addMovie=addMovie; window.scheduleMovie=scheduleMovie; window.addSchedule=addSchedule; window.addEpisode=addEpisode; window.quickAdd=quickAdd; window.advanceIdea=advanceIdea;

async function boot(){
  const {data:{session:s}}=await db.auth.getSession();
  session=s;
  if(!session) return authScreen();
  try{
    await loadWorkspace();
    if(workspace) render();
  }catch(err){
    console.error(err);
    shell(`<div class="app-shell"><section class="section"><div class="card card-pad"><h2>Couldn’t load Cheese Louise HQ</h2><p class="subtle">${esc(err.message||String(err))}</p><button class="secondary" onclick="signOut()">Sign out</button></div></section></div>`);
  }
}

db.auth.onAuthStateChange((_event,newSession)=>{session=newSession;});
boot();
