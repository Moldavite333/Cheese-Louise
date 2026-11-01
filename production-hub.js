// Shared navigation for the active production resources.
let romantiverseHubView='lab';
function productionHubNav(){
  return '<section class="section"><div class="toolbar" style="margin-bottom:0">'+
    [['lab','Show Lab','openShowLabView'],['checklist','Podcast 101','openPodcastLaunchChecklist'],['bingo','Romantiverse Bingo','openRomantiverseBingo']].map(([view,label,action])=>
      '<button class="filter '+(romantiverseHubView===view?'active-filter':'')+'" onclick="'+action+'()">'+label+'</button>').join('')+'</div></section>';
}
const productionHubOriginalIdeas=ideas;
ideas=function(){return productionHubNav()+productionHubOriginalIdeas();};
window.openShowLabView=function(){romantiverseHubView='lab';currentTab='ideas';render();};
