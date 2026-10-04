// Cheese Louise v1.15 — Podcast 101 launch + growth checklist
// Shared launch roadmap with progress, ownership, due dates, and notes.

state.podcastChecklistProgress = state.podcastChecklistProgress || [];

let pcChecklistView = 'all';
let pcEditingTaskKey = null;

const PC_PHASES = [
  {
    id:'foundation', stage:'launch', icon:'🧀', title:'1. Show foundation',
    description:'Lock the promise, format, and rules before the first real recording.',
    tasks:[
      ['foundation-promise','Lock the one-line show promise','Write the one sentence that tells a new listener exactly what Cheese Louise is and why they should care.',true],
      ['foundation-listener','Define the target listener','Describe the person most likely to love the show: what they watch, what they laugh at, and why they would come back.',true],
      ['foundation-format','Lock the core episode format','Finalize the repeatable rundown: welcome, cocktail, game, guest, recap/discussion, Romantiverse rules, bingo, outro.',true],
      ['foundation-runtime','Choose a target episode length','Pick a realistic range so recording and editing do not balloon unpredictably.'],
      ['foundation-cadence','Lock release cadence and day','Choose the normal publishing rhythm and what happens during holidays, vacations, or missed weeks.',true],
      ['foundation-intro-outro','Finalize standard intro and outro','Have a short repeatable opening, closing CTA, credits, and music cues ready to drop into every episode.',true],
      ['foundation-boundaries','Set editorial boundaries','Decide what the show does and does not cover so it stays evergreen and does not drift away from the Romantiverse.'],
      ['foundation-naming','Choose episode naming convention','Decide how titles will balance movie name, hook, guest, and searchable language.']
    ]
  },
  {
    id:'recording', stage:'launch', icon:'🎙', title:'2. Get record-ready',
    description:'Make the room, gear, and backup plan boringly reliable.',
    tasks:[
      ['recording-gear','Lock the recording gear chain','Choose microphones, headphones, interface/recorder, stands, cables, and any remote-guest setup.',true],
      ['recording-room','Set permanent mic positions and room treatment','Find repeatable positions that minimize echo, HVAC, chair noise, table bumps, and cat cameos.'],
      ['recording-levels','Set gain targets and recording format','Document the normal gain position, sample rate/bit depth, mono/stereo routing, and track layout.'],
      ['recording-template','Build the recording session template','Create a ready-to-go session with Nick, Jenny, guest, music, and backup tracks labeled.'],
      ['recording-backup','Create a backup recording plan','Always have a second recorder/device or local backup so one crash cannot kill an episode.',true],
      ['recording-prerecord','Create the 5-minute pre-record checklist','Water, phones silent, doors closed, levels checked, storage free, backup rolling, outline open.'],
      ['recording-file-system','Create file naming + backup rules','Use predictable episode folders and keep raw audio, project files, exports, artwork, and show notes together.'],
      ['recording-test','Record and review a 10-minute stress test','Talk over each other, laugh loudly, play music cues, leave silence, and confirm the recording survives real behavior.',true]
    ]
  },
  {
    id:'pilot', stage:'launch', icon:'🧪', title:'3. Pilot the whole machine',
    description:'Prove the workflow end-to-end before launch pressure exists.',
    tasks:[
      ['pilot-full','Record a full pilot episode','Treat it like a real episode from cold open through outro, even if it never gets published.',true],
      ['pilot-edit','Edit the pilot all the way to a finished master','Do the complete edit, music, cleanup, loudness pass, export, metadata, and QC.',true],
      ['pilot-listen','Listen on multiple real-world devices','Check headphones, phone speaker, car, TV/soundbar, and anything else your audience will use.'],
      ['pilot-edit-template','Turn the pilot edit into a reusable template','Save the track layout, processing chain, intro/outro placement, markers, and export settings.'],
      ['pilot-outline','Finalize the episode outline template','Make one reusable outline that keeps structure without making Nick and Jenny sound scripted.'],
      ['pilot-shownotes','Create the show-notes template','Include movie info, cocktail, guest links, credits, Romantiverse rules, and the standard listener CTA.'],
      ['pilot-qc','Create a final QC checklist','Listen for edits, wrong names, clipped audio, missing music, broken links, explicit-language flags, and bad metadata.'],
      ['pilot-buffer','Bank at least 2 finished episodes before launch','Give yourselves breathing room so week two does not immediately become an emergency.',true]
    ]
  },
  {
    id:'distribution', stage:'launch', icon:'📡', title:'4. Hosting + distribution',
    description:'Build the plumbing once so every episode can go everywhere cleanly.',
    tasks:[
      ['distribution-host','Choose and configure the podcast host','Set the canonical RSS feed, show owner email, categories, language, explicit setting, author, and copyright.',true],
      ['distribution-description','Finalize short and long show descriptions','Write a one-line hook plus a fuller description that explains the Romantiverse and the show format.',true],
      ['distribution-art','Upload final podcast artwork','Verify the artwork is legible as a tiny thumbnail and meets the current directory/host requirements.',true],
      ['distribution-trailer','Create a short trailer / show introduction','Give new listeners a fast sample of the premise, Nick and Jenny, tone, and what they should do next.'],
      ['distribution-submit','Submit/claim the show on major listening platforms','Cover Apple Podcasts, Spotify, YouTube/YouTube Music, Amazon Music/Audible, and other directories your host supports.',true],
      ['distribution-links','Create one canonical listen/share page','Use one simple destination with all listening links instead of making people hunt.'],
      ['distribution-test','Test the live feed in multiple podcast apps','Confirm artwork, titles, descriptions, timestamps, episode order, and audio all render correctly.'],
      ['distribution-analytics','Record an analytics baseline','Know which numbers the host actually reports so you can compare growth later instead of guessing.']
    ]
  },
  {
    id:'launch-assets', stage:'launch', icon:'🎨', title:'5. Build the launch package',
    description:'Prepare the pieces that make the show look established on day one.',
    tasks:[
      ['assets-handles','Reserve the Cheese Louise social handles','Claim the same or closest possible name everywhere you realistically plan to use.'],
      ['assets-social-kit','Create profile images, headers, and bios','Make every profile obviously the same show and give each bio a clear follow/listen CTA.'],
      ['assets-video-template','Build a vertical clip template','Create one repeatable captioned layout for Shorts/Reels/TikTok so clipping is fast.'],
      ['assets-quote-template','Build a still/quote post template','Make a simple reusable graphic for jokes, rules, polls, guest announcements, and movie picks.'],
      ['assets-photo-bank','Create a small photo/visual bank','Collect clean photos of Nick and Jenny, podcast setup, cocktails, movie-night imagery, and brand art.'],
      ['assets-press-kit','Create a lightweight guest/press kit','Keep the show description, hosts bio, artwork, photos, links, and contact info in one shareable place.'],
      ['assets-contact','Create a public show contact route','Set a show email or contact form for guests, listeners, press, and partnerships.']
    ]
  },
  {
    id:'prelaunch', stage:'launch', icon:'📣', title:'6. Pre-launch marketing',
    description:'Create awareness before asking the first episode to do all the work.',
    tasks:[
      ['prelaunch-content-bank','Bank at least 8–10 social posts','Have enough clips, images, jokes, rules, polls, and behind-the-scenes posts to survive launch week.'],
      ['prelaunch-countdown','Plan a simple launch countdown','Schedule a few clear beats: show reveal, trailer, hosts/premise, first movies, launch date.'],
      ['prelaunch-warm-list','Make the warm-launch share list','List friends, coworkers, comedians, movie fans, and communities who would genuinely enjoy the show.'],
      ['prelaunch-guests','Line up the first guest/collaboration targets','Keep a ranked outreach list with local comedians, movie people, and stretch guests.'],
      ['prelaunch-cta','Choose the launch CTA','Pick the one most important ask: follow/subscribe first; reviews, voting, and sharing can follow naturally.'],
      ['prelaunch-polls','Prepare audience participation hooks','Have movie votes, Romantiverse questions, bingo prompts, and cocktail polls ready before launch.'],
      ['prelaunch-link-test','Test every public link from a phone','Make sure the bio link, show page, RSS destinations, social links, and email contact all work without login hell.']
    ]
  },
  {
    id:'launch-week', stage:'launch', icon:'🚀', title:'7. Launch week',
    description:'Make launch a coordinated week, not one lonely “new podcast” post.',
    tasks:[
      ['launch-publish','Publish the launch episodes and trailer','Confirm the correct episodes are live, ordered correctly, and playable everywhere.',true],
      ['launch-listings','Verify every major directory listing','Check show title, artwork, description, episode text, links, and explicit flags after propagation.'],
      ['launch-announce','Publish the main launch announcement','Post the clearest possible “Cheese Louise is live” message with one obvious listen link.'],
      ['launch-direct-share','Send personal launch messages to the warm list','Use genuine one-to-one outreach to people who are actually a fit instead of blasting strangers.'],
      ['launch-pin','Pin the launch/listen post on active profiles','Make it impossible for a curious visitor to miss where the show lives.'],
      ['launch-engage','Reply to comments, DMs, shares, and early feedback','Treat the first listeners like founding members of the Romantiverse.'],
      ['launch-fix','Fix broken links or listing problems immediately','Keep a quick punch list during launch week and clear friction fast.'],
      ['launch-review','Write a one-week launch debrief','Record what worked, what flopped, where listeners came from, and what to repeat next week.']
    ]
  },
  {
    id:'system', stage:'growth', icon:'⚙️', title:'8. Build the weekly operating system',
    description:'Turn the show into a repeatable habit instead of reinventing production every week.',
    tasks:[
      ['system-deadlines','Set weekly internal deadlines','Choose when movie selection, watching, outline, recording, edit, QC, scheduling, and promo need to happen.'],
      ['system-episode-checklist','Create the recurring episode checklist','Make one short operational list from movie selection through published episode and archived files.'],
      ['system-movie-pipeline','Keep the Movie Radar at least several episodes ahead','Always have enough likely movies that one bad choice does not stall the schedule.'],
      ['system-guest-pipeline','Maintain a guest pipeline','Track invited, interested, booked, recorded, and follow-up status so guest booking stays predictable.'],
      ['system-clip-workflow','Create the post-episode clip workflow','Define who chooses clips, captions them, schedules them, and how long that should take.'],
      ['system-backup','Back up finished episodes and project files','Keep masters and project assets somewhere separate from the recording device.'],
      ['system-feedback','Create one place for listener feedback and ideas','Collect comments, DMs, polls, emails, and guest suggestions instead of letting them disappear.']
    ]
  },
  {
    id:'growth', stage:'growth', icon:'📈', title:'9. Grow the audience',
    description:'Double down on what earns attention and creates returning listeners.',
    tasks:[
      ['growth-metrics','Review core metrics monthly','Track downloads/plays, followers, completion/retention where available, top episodes, and traffic sources.'],
      ['growth-winners','Identify the repeatable winners','Look for movie types, guests, games, clips, titles, and Romantiverse bits that consistently outperform.'],
      ['growth-clips','Publish short-form clips consistently','Use the funniest/clearest moments as discovery content rather than only posting episode announcements.'],
      ['growth-search','Improve searchable episode titles and descriptions','Include the movie, guest, and useful terms without turning titles into keyword soup.'],
      ['growth-youtube','Build a useful YouTube presence','Publish full episodes or strong visual versions plus Shorts so the show can be discovered outside podcast apps.'],
      ['growth-crosspromo','Arrange podcast swaps and cross-promotions','Trade guest spots, promo mentions, or feed swaps with shows that share the right audience.'],
      ['growth-community','Give listeners recurring ways to participate','Use movie voting, Rules disputes, bingo, cocktail picks, and questions that can feed the next episode.'],
      ['growth-email','Start an owned listener list','Give interested listeners an email/newsletter option so the relationship is not dependent on algorithms.'],
      ['growth-local','Use the Denver/Evergreen comedy network','Invite comics, attend shows, trade appearances, and turn local relationships into genuine audience overlap.']
    ]
  },
  {
    id:'community-revenue', stage:'growth', icon:'🫶', title:'10. Community + revenue (after people care)',
    description:'Add paid extras only when they deepen the show instead of creating busywork.',
    tasks:[
      ['revenue-patreon','Set up the Patreon structure','Use clear low-friction tiers such as voting access, watch-alongs, and an all-access level once the workflow is sustainable.'],
      ['revenue-member-calendar','Create a predictable member-content calendar','Do not promise more bonus content than Nick and Jenny can reliably make.'],
      ['revenue-watchalong','Pilot a watch-along format','Test the timing, platform, movie access, and audience instructions before making it a recurring perk.'],
      ['revenue-sponsor-fit','Write sponsor-fit rules','Define which brands/products actually make sense for Cheese Louise so monetization does not wreck the tone.'],
      ['revenue-merch','Wait for real merch demand, then test one item','Start with a strong recurring bit or phrase rather than a giant store nobody asked for.'],
      ['revenue-live','Outline the live-show version','Keep the Romantiverse Ombudsman, audience rulings, games, cocktail elements, and guest structure ready for a future live format.']
    ]
  },
  {
    id:'quarterly', stage:'growth', icon:'🔭', title:'11. Every 8–12 weeks: tune the machine',
    description:'Use real audience behavior to improve the show without chasing every trend.',
    tasks:[
      ['quarterly-retro','Run a show retrospective','What is fun to make, what drags, what listeners mention, and what should be killed or expanded?'],
      ['quarterly-format','Review the episode structure','Check whether segments are earning their time or creating dead weight.'],
      ['quarterly-brand','Review artwork, show description, and landing page','Update only when the show has genuinely evolved or a clearer promise has emerged.'],
      ['quarterly-goals','Set the next 90-day growth goal','Choose one measurable focus such as consistent releases, clips, guests, followers, email list, or members.'],
      ['quarterly-experiments','Choose 1–2 controlled experiments','Try a new segment, clip format, guest strategy, or promotion idea without changing everything at once.'],
      ['quarterly-celebrate','Record the wins','Keep a visible list of milestones, favorite episodes, listener messages, great guests, and growth so progress is not invisible.']
    ]
  }
];

function pcAllTasks(){
  return PC_PHASES.flatMap((phase,phaseIndex)=>phase.tasks.map((row,taskIndex)=>({
    phaseId:phase.id,
    phaseTitle:phase.title,
    stage:phase.stage,
    phaseIndex,
    taskIndex,
    key:row[0],
    title:row[1],
    detail:row[2],
    critical:!!row[3]
  })));
}

function pcTaskByKey(key){ return pcAllTasks().find(t=>t.key===key); }
function pcProgressByKey(key){ return (state.podcastChecklistProgress||[]).find(x=>x.task_key===key) || null; }
function pcIsDone(key){ return !!pcProgressByKey(key)?.completed; }
function pcStageTasks(stage){ return pcAllTasks().filter(t=>t.stage===stage); }
function pcDoneCount(tasks){ return tasks.filter(t=>pcIsDone(t.key)).length; }
function pcPct(done,total){ return total ? Math.round((done/total)*100) : 0; }

const pcOriginalLoadAll = loadAll;
loadAll = async function(){
  await pcOriginalLoadAll();
  if(!workspace){ state.podcastChecklistProgress=[]; return; }
  const {data,error}=await db
    .from('podcast_checklist_progress')
    .select('*')
    .eq('workspace_id',workspace.id);
  if(error){
    console.error('Could not load podcast checklist progress',error);
    state.podcastChecklistProgress=[];
    return;
  }
  state.podcastChecklistProgress=data||[];
};

function pcOwnerLabel(ownerId){
  if(!ownerId) return '';
  return memberName(ownerId);
}

function pcTaskMeta(progress){
  const bits=[];
  if(progress?.owner_id) bits.push(`👤 ${pcOwnerLabel(progress.owner_id)}`);
  if(progress?.due_date) bits.push(`📅 ${fmtDate(progress.due_date+'T12:00:00')}`);
  if(progress?.notes) bits.push('📝 note');
  return bits;
}

function pcTaskRow(task,compact=false){
  const p=pcProgressByKey(task.key);
  const done=!!p?.completed;
  const meta=pcTaskMeta(p);
  return `<article class="pc-task ${done?'pc-task-done':''} ${task.critical?'pc-task-critical':''}" onclick="pcOpenTask('${task.key}')">
    <label class="pc-check-wrap" onclick="event.stopPropagation()">
      <input type="checkbox" ${done?'checked':''} onchange="pcToggleTask('${task.key}',this.checked)">
      <span class="pc-checkmark">${done?'✓':''}</span>
    </label>
    <div class="pc-task-copy">
      <div class="pc-task-title">${esc(task.title)} ${task.critical?'<span class="pill pc-critical-pill">Launch blocker</span>':''}</div>
      ${compact?'':`<div class="subtle pc-task-detail">${esc(task.detail)}</div>`}
      ${meta.length?`<div class="pc-task-meta">${meta.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}
    </div>
    <button class="secondary pc-plan-btn" onclick="event.stopPropagation();pcOpenTask('${task.key}')">Plan</button>
  </article>`;
}

function pcCurrentIncompletePhaseId(){
  const launchPhase=PC_PHASES.find(p=>p.stage==='launch' && p.tasks.some(t=>!pcIsDone(t[0])));
  if(launchPhase) return launchPhase.id;
  const growthPhase=PC_PHASES.find(p=>p.tasks.some(t=>!pcIsDone(t[0])));
  return growthPhase?.id || PC_PHASES[0].id;
}

function pcFilteredTasks(phase){
  const tasks=phase.tasks.map(row=>pcTaskByKey(row[0])).filter(Boolean);
  if(pcChecklistView==='launch' && phase.stage!=='launch') return [];
  if(pcChecklistView==='growth' && phase.stage!=='growth') return [];
  if(pcChecklistView==='open') return tasks.filter(t=>!pcIsDone(t.key));
  if(pcChecklistView==='done') return tasks.filter(t=>pcIsDone(t.key));
  return tasks;
}

function pcProgressBar(done,total,label){
  const pct=pcPct(done,total);
  return `<div class="pc-progress-block"><div class="pc-progress-label"><span>${esc(label)}</span><strong>${done}/${total} · ${pct}%</strong></div><div class="pc-progress-track"><div class="pc-progress-fill" style="width:${pct}%"></div></div></div>`;
}

function pcChecklistPage(){
  const all=pcAllTasks();
  const launch=pcStageTasks('launch');
  const growth=pcStageTasks('growth');
  const allDone=pcDoneCount(all);
  const launchDone=pcDoneCount(launch);
  const growthDone=pcDoneCount(growth);
  const next=all.filter(t=>!pcIsDone(t.key)).slice(0,5);
  const currentPhase=pcCurrentIncompletePhaseId();

  return `<section class="section">
    <div class="page-title">Podcast 101 · Launch & Growth Plan</div>
    <div class="subtle">A shared Cheese Louise roadmap from “can we actually record this?” through launch, marketing, audience growth, community, and eventually money. Check things off together; tap any task to assign it, add a due date, or leave notes.</div>
    <div class="pc-summary-grid">
      <div class="card card-pad pc-summary-card"><div class="kicker">Launch readiness</div>${pcProgressBar(launchDone,launch.length,'Before + through launch')}</div>
      <div class="card card-pad pc-summary-card"><div class="kicker">Whole roadmap</div>${pcProgressBar(allDone,all.length,'Launch + growth')}</div>
    </div>
  </section>

  <section class="section">
    <div class="card card-pad pc-next-card">
      <div class="pc-section-head"><div><div class="kicker">Next up</div><h2 style="margin:5px 0">Do these next</h2></div><span class="pill">${all.length-allDone} remaining</span></div>
      <div class="pc-next-list">${next.map(t=>pcTaskRow(t,true)).join('') || '<div class="empty">Everything on the roadmap is checked off. That is absurdly impressive.</div>'}</div>
    </div>
  </section>

  <section class="section">
    <div class="toolbar pc-filter-row">
      <button class="filter ${pcChecklistView==='all'?'active-filter':''}" onclick="pcSetView('all')">All</button>
      <button class="filter ${pcChecklistView==='launch'?'active-filter':''}" onclick="pcSetView('launch')">🚀 Launch</button>
      <button class="filter ${pcChecklistView==='growth'?'active-filter':''}" onclick="pcSetView('growth')">📈 Growth</button>
      <button class="filter ${pcChecklistView==='open'?'active-filter':''}" onclick="pcSetView('open')">Open</button>
      <button class="filter ${pcChecklistView==='done'?'active-filter':''}" onclick="pcSetView('done')">Done</button>
    </div>

    <div class="pc-phase-list">
      ${PC_PHASES.map(phase=>{
        const tasks=pcFilteredTasks(phase);
        if(!tasks.length) return '';
        const phaseAll=phase.tasks.map(r=>pcTaskByKey(r[0])).filter(Boolean);
        const done=pcDoneCount(phaseAll);
        const open=phase.id===currentPhase || (done>0 && done<phaseAll.length);
        return `<details class="card pc-phase" ${open?'open':''}>
          <summary class="pc-phase-summary">
            <div><div class="pc-phase-title">${phase.icon} ${esc(phase.title)}</div><div class="subtle">${esc(phase.description)}</div></div>
            <div class="pc-phase-count">${done}/${phaseAll.length}</div>
          </summary>
          <div class="pc-phase-progress">${pcProgressBar(done,phaseAll.length,'Phase progress')}</div>
          <div class="pc-task-list">${tasks.map(t=>pcTaskRow(t)).join('')}</div>
        </details>`;
      }).join('')}
    </div>
  </section>

  <section class="section"><div class="card card-pad pc-growth-note"><strong>How to use this</strong><div class="subtle" style="margin-top:6px">Do not try to finish all ${all.length} items before episode one. The launch phases are ordered; the growth phases are a playbook to build after the show has real listeners. “Launch blocker” items are the things most likely to hurt the show if they are skipped.</div></div></section>`;
}

async function pcToggleTask(taskKey,completed){
  if(!workspace || !pcTaskByKey(taskKey)) return;
  const current=pcProgressByKey(taskKey);
  const payload={
    workspace_id:workspace.id,
    task_key:taskKey,
    completed:!!completed,
    completed_by:completed?me():null,
    completed_at:completed?new Date().toISOString():null,
    updated_at:new Date().toISOString()
  };
  const {data,error}=await db
    .from('podcast_checklist_progress')
    .upsert(payload,{onConflict:'workspace_id,task_key'})
    .select()
    .single();
  if(error){ alert(error.message); await loadAll(); render(); return; }
  if(current){
    state.podcastChecklistProgress=state.podcastChecklistProgress.map(x=>x.task_key===taskKey?{...x,...data}:x);
  }else{
    state.podcastChecklistProgress=[...(state.podcastChecklistProgress||[]),data];
  }
  render();
}

function pcOpenTask(taskKey){
  if(!pcTaskByKey(taskKey)) return;
  pcEditingTaskKey=taskKey;
  selectedMovie=null;
  render();
}

function pcCloseTask(event){
  if(event && event.target!==event.currentTarget) return;
  pcEditingTaskKey=null;
  render();
}

function pcOwnerOptions(current){
  return `<option value="">Unassigned</option>${(members||[]).map(m=>`<option value="${m.user_id}" ${m.user_id===current?'selected':''}>${esc(memberName(m.user_id))}</option>`).join('')}`;
}

function pcTaskModal(){
  const task=pcTaskByKey(pcEditingTaskKey);
  if(!task) return '';
  const p=pcProgressByKey(task.key)||{};
  return `<div class="modal-backdrop" onclick="pcCloseTask(event)"><div class="modal pc-task-modal" onclick="event.stopPropagation()">
    <div class="modal-header"><div><div class="kicker">Podcast 101 · ${task.stage==='launch'?'Launch':'Growth'}</div><h2 style="margin:6px 0">${esc(task.title)}</h2></div><button class="close" onclick="pcCloseTask()">×</button></div>
    <div class="pc-task-modal-detail">${esc(task.detail)}</div>
    ${task.critical?'<div class="pill pc-critical-pill" style="margin-top:10px">Launch blocker</div>':''}
    <div class="episode-editor-grid" style="margin-top:18px">
      <label>Owner<select id="pcOwner" class="search">${pcOwnerOptions(p.owner_id||'')}</select></label>
      <label>Due date<input id="pcDue" type="date" class="search" value="${esc(p.due_date||'')}"></label>
      <label class="wide">Notes<textarea id="pcNotes" class="search" rows="6" placeholder="What needs to happen, links, decisions, who is waiting on what…">${esc(p.notes||'')}</textarea></label>
    </div>
    <div class="episode-editor-actions">
      <button class="primary" onclick="pcSaveTaskPlan()">Save plan</button>
      <button class="${p.completed?'secondary':'primary'}" onclick="pcToggleTaskFromModal(${p.completed?'false':'true'})">${p.completed?'Mark incomplete':'✓ Mark complete'}</button>
      <button class="secondary" onclick="pcCloseTask()">Close</button>
    </div>
    ${p.completed_at?`<div class="subtle" style="margin-top:12px">Completed ${esc(fmtDateTime(p.completed_at))}${p.completed_by?` by ${esc(memberName(p.completed_by))}`:''}</div>`:''}
  </div></div>`;
}

async function pcSaveTaskPlan(){
  if(!workspace || !pcEditingTaskKey) return;
  const existing=pcProgressByKey(pcEditingTaskKey)||{};
  const owner=document.getElementById('pcOwner')?.value||null;
  const due=document.getElementById('pcDue')?.value||null;
  const notes=(document.getElementById('pcNotes')?.value||'').trim()||null;
  const payload={
    workspace_id:workspace.id,
    task_key:pcEditingTaskKey,
    completed:!!existing.completed,
    owner_id:owner,
    due_date:due,
    notes,
    completed_by:existing.completed_by||null,
    completed_at:existing.completed_at||null,
    updated_at:new Date().toISOString()
  };
  const {data,error}=await db.from('podcast_checklist_progress').upsert(payload,{onConflict:'workspace_id,task_key'}).select().single();
  if(error) return alert(error.message);
  const found=pcProgressByKey(pcEditingTaskKey);
  state.podcastChecklistProgress=found
    ? state.podcastChecklistProgress.map(x=>x.task_key===pcEditingTaskKey?data:x)
    : [...(state.podcastChecklistProgress||[]),data];
  pcEditingTaskKey=null;
  render();
}

async function pcToggleTaskFromModal(completed){
  const key=pcEditingTaskKey;
  if(!key) return;
  const owner=document.getElementById('pcOwner')?.value||null;
  const due=document.getElementById('pcDue')?.value||null;
  const notes=(document.getElementById('pcNotes')?.value||'').trim()||null;
  const payload={
    workspace_id:workspace.id,
    task_key:key,
    completed:!!completed,
    owner_id:owner,
    due_date:due,
    notes,
    completed_by:completed?me():null,
    completed_at:completed?new Date().toISOString():null,
    updated_at:new Date().toISOString()
  };
  const {data,error}=await db.from('podcast_checklist_progress').upsert(payload,{onConflict:'workspace_id,task_key'}).select().single();
  if(error) return alert(error.message);
  const found=pcProgressByKey(key);
  state.podcastChecklistProgress=found
    ? state.podcastChecklistProgress.map(x=>x.task_key===key?data:x)
    : [...(state.podcastChecklistProgress||[]),data];
  pcEditingTaskKey=null;
  render();
}

function pcSetView(view){
  pcChecklistView=['all','launch','growth','open','done'].includes(view)?view:'all';
  render();
}

function openPodcastLaunchChecklist(){
  romantiverseHubView='checklist';
  currentTab='ideas';
  pcEditingTaskKey=null;
  render();
  window.scrollTo(0,0);
}

// Extend the existing Show Lab / Rules hub without adding a sixth bottom tab.
rvRulesHubNav = function(){
  return `<section class="section"><div class="toolbar" style="margin-bottom:0">
    <button class="filter ${romantiverseHubView==='lab'?'active-filter':''}" onclick="openShowLabView()">💡 Show Lab</button>
    <button class="filter ${romantiverseHubView==='rules'?'active-filter':''}" onclick="openRomantiverseRules()">📜 Rules of the Romantiverse</button>
    <button class="filter ${romantiverseHubView==='checklist'?'active-filter':''}" onclick="openPodcastLaunchChecklist()">🚀 Podcast 101</button>
  </div></section>`;
};

const pcOriginalIdeas=ideas;
ideas=function(){
  if(romantiverseHubView==='checklist') return rvRulesHubNav()+pcChecklistPage();
  return pcOriginalIdeas();
};

const pcOriginalHome=home;
home=function(){
  const all=pcAllTasks();
  const launch=pcStageTasks('launch');
  const done=pcDoneCount(all);
  const launchDone=pcDoneCount(launch);
  const next=all.find(t=>!pcIsDone(t.key));
  return pcOriginalHome()+`<section class="section"><div class="card card-pad pc-home-card"><div class="kicker">Podcast 101</div><div class="pc-home-head"><div><h2 style="margin:5px 0">Launch & Growth Plan</h2><div class="subtle">Launch readiness: <strong>${pcPct(launchDone,launch.length)}%</strong> · Overall: ${done}/${all.length}</div></div><button class="primary" onclick="openPodcastLaunchChecklist()">Open checklist</button></div>${next?`<div class="pc-home-next"><strong>Next:</strong> ${esc(next.title)}</div>`:'<div class="pc-home-next"><strong>Roadmap complete.</strong> The Romantiverse has been professionally organized, somehow.</div>'}</div></section>`;
};

const pcOriginalModal=modal;
modal=function(){
  if(pcEditingTaskKey) return pcTaskModal();
  return pcOriginalModal();
};

const pcOriginalGo=window.go;
window.go=function(tab){
  if(tab!=='ideas') pcEditingTaskKey=null;
  return pcOriginalGo(tab);
};

const pcOriginalTopbar=topbar;
topbar=function(){
  return pcOriginalTopbar()
    .replace('>v1.14<','>v1.15<')
    .replace('>v1.13<','>v1.15<')
    .replace('>v1.12<','>v1.15<');
};

window.openPodcastLaunchChecklist=openPodcastLaunchChecklist;
window.pcSetView=pcSetView;
window.pcToggleTask=pcToggleTask;
window.pcOpenTask=pcOpenTask;
window.pcCloseTask=pcCloseTask;
window.pcSaveTaskPlan=pcSaveTaskPlan;
window.pcToggleTaskFromModal=pcToggleTaskFromModal;
