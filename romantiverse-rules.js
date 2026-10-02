// Cheese Louise v1.11 — Rules of the Romantiverse
// Adds a shared, persistent rulebook alongside Show Lab and cleans up the
// short-lived "Cheese Tray-T" joke so the app consistently says Cheese Trait.

state.rules = state.rules || [];

let romantiverseHubView = 'lab';
let romantiverseRuleSearch = '';
let romantiverseRuleStatus = 'all';
let editingRomantiverseRule = null;

// ---------------------------------------------------------------------------
// Language cleanup: keep the joke out of the product UI. The underlying
// inference/scoring behavior is unchanged; this only changes visible wording.
// ---------------------------------------------------------------------------
if(typeof discoveryCard === 'function'){
  const rvRulesOriginalDiscoveryCard = discoveryCard;
  discoveryCard = function(candidate){
    return rvRulesOriginalDiscoveryCard(candidate)
      .replace(/Cheese Tray-Ts/g, 'Cheese Traits')
      .replace(/Cheese Tray-T/g, 'Cheese Trait');
  };
}

// ---------------------------------------------------------------------------
// Load the shared rulebook with the rest of the workspace state. Keeping this
// as a wrapper means the existing app/data loaders remain untouched.
// ---------------------------------------------------------------------------
const rvRulesOriginalLoadAll = loadAll;
loadAll = async function(){
  await rvRulesOriginalLoadAll();
  if(!workspace){
    state.rules = [];
    return;
  }

  const {data,error} = await db
    .from('romantiverse_rules')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('rule_number', {ascending:true});

  if(error){
    console.error('Could not load Rules of the Romantiverse', error);
    state.rules = [];
    return;
  }
  state.rules = data || [];
};

function rvRuleStatusLabel(status){
  if(status === 'proposed') return 'Proposed';
  if(status === 'retired') return 'Retired';
  return 'Canon';
}

function rvRuleStatusIcon(status){
  if(status === 'proposed') return '📝';
  if(status === 'retired') return '🗄';
  return '📜';
}

function rvRuleMatches(rule){
  if(romantiverseRuleStatus !== 'all' && rule.status !== romantiverseRuleStatus) return false;
  const q = romantiverseRuleSearch.trim().toLowerCase();
  if(!q) return true;
  return `${rule.rule_number} ${rule.title||''} ${rule.notes||''} ${rvRuleStatusLabel(rule.status)}`
    .toLowerCase()
    .includes(q);
}

function rvRulesHubNav(){
  return `<section class="section">
    <div class="toolbar" style="margin-bottom:0">
      <button class="filter ${romantiverseHubView==='lab'?'active-filter':''}" onclick="openShowLabView()">💡 Show Lab</button>
      <button class="filter ${romantiverseHubView==='rules'?'active-filter':''}" onclick="openRomantiverseRules()">📜 Rules of the Romantiverse</button>
    </div>
  </section>`;
}

function rvRuleCard(rule){
  const creator = rule.created_by ? memberName(rule.created_by) : 'Cheese Louise';
  return `<article class="card card-pad" style="margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
      <div>
        <div class="kicker">Rule #${Number(rule.rule_number)}</div>
        <h3 style="margin:6px 0 8px">${esc(rule.title)}</h3>
      </div>
      <span class="pill">${rvRuleStatusIcon(rule.status)} ${esc(rvRuleStatusLabel(rule.status))}</span>
    </div>
    ${rule.notes?`<div class="subtle" style="white-space:pre-wrap">${esc(rule.notes)}</div>`:''}
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:14px;flex-wrap:wrap">
      <div class="subtle">Added by ${esc(creator)} · ${esc(fmtDate(rule.created_at))}</div>
      <button class="secondary" onclick="editRomantiverseRule('${rule.id}')">Edit rule</button>
    </div>
  </article>`;
}

function romantiverseRulesPage(){
  const all = state.rules || [];
  const found = all.filter(rvRuleMatches);
  const canonCount = all.filter(r=>r.status==='canon').length;
  const proposedCount = all.filter(r=>r.status==='proposed').length;

  return `<section class="section">
    <div class="page-title">Rules of the Romantiverse™</div>
    <div class="subtle">The running Cheese Louise canon. Keep every ruling here so Nick and Jenny do not have to remember what they invented six episodes ago.</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
      <button class="primary" onclick="addRomantiverseRule()">+ Add rule</button>
      <span class="pill">📜 ${canonCount} canon</span>
      ${proposedCount?`<span class="pill">📝 ${proposedCount} proposed</span>`:''}
    </div>
  </section>

  <section class="section">
    <div class="card card-pad" style="margin-bottom:14px">
      <input class="search" style="width:100%" placeholder="Search the rules…" value="${esc(romantiverseRuleSearch)}" oninput="setRomantiverseRuleSearch(this.value)">
      <div class="toolbar" style="margin-top:10px">
        <button class="filter ${romantiverseRuleStatus==='all'?'active-filter':''}" onclick="setRomantiverseRuleStatus('all')">All</button>
        <button class="filter ${romantiverseRuleStatus==='canon'?'active-filter':''}" onclick="setRomantiverseRuleStatus('canon')">📜 Canon</button>
        <button class="filter ${romantiverseRuleStatus==='proposed'?'active-filter':''}" onclick="setRomantiverseRuleStatus('proposed')">📝 Proposed</button>
        <button class="filter ${romantiverseRuleStatus==='retired'?'active-filter':''}" onclick="setRomantiverseRuleStatus('retired')">🗄 Retired</button>
      </div>
      <div class="subtle" style="margin-top:8px">Rules stay in the log. If one stops being true, retire it instead of deleting the history.</div>
    </div>

    <div id="romantiverseRuleList">
      ${found.map(rvRuleCard).join('') || '<div class="empty">No rules match this view yet. The Romantiverse remains dangerously unregulated.</div>'}
    </div>
  </section>`;
}

const rvRulesOriginalIdeas = ideas;
ideas = function(){
  return rvRulesHubNav() + (romantiverseHubView === 'rules' ? romantiverseRulesPage() : rvRulesOriginalIdeas());
};

function openShowLabView(){
  romantiverseHubView = 'lab';
  editingRomantiverseRule = null;
  currentTab = 'ideas';
  render();
}

function openRomantiverseRules(){
  romantiverseHubView = 'rules';
  editingRomantiverseRule = null;
  currentTab = 'ideas';
  render();
}

function setRomantiverseRuleSearch(value){
  romantiverseRuleSearch = value || '';
  if(currentTab === 'ideas' && romantiverseHubView === 'rules') render();
}

function setRomantiverseRuleStatus(value){
  romantiverseRuleStatus = ['all','canon','proposed','retired'].includes(value) ? value : 'all';
  render();
}

function addRomantiverseRule(){
  editingRomantiverseRule = 'new';
  selectedMovie = null;
  render();
}

function editRomantiverseRule(id){
  if(!(state.rules||[]).some(r=>r.id===id)) return;
  editingRomantiverseRule = id;
  selectedMovie = null;
  render();
}

function closeRomantiverseRuleEditor(event){
  if(event && event.target !== event.currentTarget) return;
  editingRomantiverseRule = null;
  render();
}

function rvRuleEditorModal(){
  if(!editingRomantiverseRule) return '';
  const isNew = editingRomantiverseRule === 'new';
  const rule = isNew ? {title:'',notes:'',status:'canon'} : (state.rules||[]).find(r=>r.id===editingRomantiverseRule);
  if(!rule) return '';

  return `<div class="modal-backdrop" onclick="closeRomantiverseRuleEditor(event)">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div>
          <div class="kicker">Rules of the Romantiverse</div>
          <h2 style="margin:6px 0">${isNew?'Add a rule':`Edit Rule #${Number(rule.rule_number)}`}</h2>
        </div>
        <button class="close" onclick="editingRomantiverseRule=null;render()">×</button>
      </div>

      <label style="display:block;margin-top:14px">
        <strong>Rule wording</strong>
        <textarea id="rvRuleTitle" class="search" rows="4" style="width:100%;margin-top:6px" placeholder="Example: No one recognizes royalty if they are wearing a normal coat.">${esc(rule.title||'')}</textarea>
      </label>

      <label style="display:block;margin-top:14px">
        <strong>Notes / examples</strong>
        <textarea id="rvRuleNotes" class="search" rows="5" style="width:100%;margin-top:6px" placeholder="Movie examples, exceptions, arguments, or whatever made this become a rule.">${esc(rule.notes||'')}</textarea>
      </label>

      <label style="display:block;margin-top:14px">
        <strong>Status</strong>
        <select id="rvRuleStatus" class="search" style="width:100%;margin-top:6px">
          <option value="canon" ${rule.status==='canon'?'selected':''}>📜 Canon</option>
          <option value="proposed" ${rule.status==='proposed'?'selected':''}>📝 Proposed</option>
          <option value="retired" ${rule.status==='retired'?'selected':''}>🗄 Retired</option>
        </select>
      </label>

      <div class="subtle" style="margin-top:12px">${isNew?'The next rule number will be assigned automatically.':'The rule number stays fixed so the historical log does not shift around.'}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px">
        <button class="primary" onclick="saveRomantiverseRule()">${isNew?'Add rule':'Save rule'}</button>
        <button class="secondary" onclick="editingRomantiverseRule=null;render()">Cancel</button>
      </div>
    </div>
  </div>`;
}

async function rvNextRuleNumber(){
  const {data,error} = await db
    .from('romantiverse_rules')
    .select('rule_number')
    .eq('workspace_id', workspace.id)
    .order('rule_number', {ascending:false})
    .limit(1);
  if(error) throw error;
  return Number(data?.[0]?.rule_number || 0) + 1;
}

async function saveRomantiverseRule(){
  if(!workspace || !editingRomantiverseRule) return;
  const title = (document.getElementById('rvRuleTitle')?.value || '').trim();
  const notes = (document.getElementById('rvRuleNotes')?.value || '').trim();
  const status = document.getElementById('rvRuleStatus')?.value || 'canon';
  if(!title) return alert('Give the rule some wording first.');
  if(!['canon','proposed','retired'].includes(status)) return alert('That rule status is not valid.');

  const isNew = editingRomantiverseRule === 'new';
  if(isNew){
    let ruleNumber;
    try{
      ruleNumber = await rvNextRuleNumber();
    }catch(error){
      return alert(error.message || String(error));
    }

    let result = await db.from('romantiverse_rules').insert({
      workspace_id: workspace.id,
      rule_number: ruleNumber,
      title,
      notes: notes || null,
      status,
      created_by: me()
    }).select().single();

    // Nick and Jenny adding at exactly the same moment is unlikely, but the
    // database has a unique workspace/rule number constraint. Retry once if
    // both devices happened to claim the same next number.
    if(result.error?.code === '23505'){
      try{
        ruleNumber = await rvNextRuleNumber();
        result = await db.from('romantiverse_rules').insert({
          workspace_id: workspace.id,
          rule_number: ruleNumber,
          title,
          notes: notes || null,
          status,
          created_by: me()
        }).select().single();
      }catch(error){
        return alert(error.message || String(error));
      }
    }

    if(result.error) return alert(result.error.message);
    await logActivity(`added Romantiverse Rule #${ruleNumber}: ${title}`,'rule',result.data.id);
  }else{
    const id = editingRomantiverseRule;
    const {error} = await db.from('romantiverse_rules').update({
      title,
      notes: notes || null,
      status,
      updated_at: new Date().toISOString()
    }).eq('id', id);
    if(error) return alert(error.message);
    const existing = (state.rules||[]).find(r=>r.id===id);
    await logActivity(`updated Romantiverse Rule #${existing?.rule_number||'?'}: ${title}`,'rule',id);
  }

  editingRomantiverseRule = null;
  await loadAll();
  render();
}

// Make rule editor coexist with the movie, episode, and Cheese Trait modals.
const rvRulesOriginalModal = modal;
modal = function(){
  if(editingRomantiverseRule) return rvRuleEditorModal();
  return rvRulesOriginalModal();
};

// Keep the Rules subview from accidentally carrying into unrelated tabs.
const rvRulesOriginalGo = window.go;
window.go = function(tab){
  if(tab !== 'ideas'){
    editingRomantiverseRule = null;
  }
  return rvRulesOriginalGo(tab);
};

// Update the visible build marker without changing global search behavior.
const rvRulesOriginalTopbar = topbar;
topbar = function(){
  return rvRulesOriginalTopbar()
    .replace('>v1.10<','>v1.11<')
    .replace('>v1.9<','>v1.11<')
    .replace('>v1.8<','>v1.11<');
};

window.openShowLabView = openShowLabView;
window.openRomantiverseRules = openRomantiverseRules;
window.setRomantiverseRuleSearch = setRomantiverseRuleSearch;
window.setRomantiverseRuleStatus = setRomantiverseRuleStatus;
window.addRomantiverseRule = addRomantiverseRule;
window.editRomantiverseRule = editRomantiverseRule;
window.closeRomantiverseRuleEditor = closeRomantiverseRuleEditor;
window.saveRomantiverseRule = saveRomantiverseRule;
