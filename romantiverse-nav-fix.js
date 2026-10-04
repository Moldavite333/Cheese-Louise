// Cheese Louise — Romantiverse navigation compatibility fix
// Ruleify v1.20 replaced the shared nav and accidentally omitted Podcast 101 + Bingo.

rvRulesHubNav = function(){
  return `<section class="section"><div class="toolbar" style="margin-bottom:0">
    <button class="filter ${romantiverseHubView==='lab'?'active-filter':''}" onclick="openShowLabView()">💡 Show Lab</button>
    <button class="filter ${romantiverseHubView==='rules'?'active-filter':''}" onclick="openRomantiverseRules()">📜 Rules of the Romantiverse</button>
    <button class="filter ${romantiverseHubView==='ruleify'?'active-filter':''}" onclick="openRuleify()">⚖️ Ruleify</button>
    <button class="filter ${romantiverseHubView==='checklist'?'active-filter':''}" onclick="openPodcastLaunchChecklist()">🚀 Podcast 101</button>
    <button class="filter ${romantiverseHubView==='bingo'?'active-filter':''}" onclick="openRomantiverseBingo()">🎯 Romantiverse Bingo</button>
  </div></section>`;
};
