// Read-only podcast shout-outs from the public Cheese Tray leaderboard.
(function(){
 if(typeof producerPage!=='function')return;
 const original=producerPage;
 producerPage=function(){
  return original()+`<section class="section"><div class="card card-pad"><div class="kicker">Community · Weekly top five</div><h2>🏆 Cheese Tray Podcast Shout-Outs</h2><p class="subtle">Players opted in to public recognition. Rankings reset Monday UTC. Read these names and scores on the show.</p><div id="cheese-tray-shoutouts" role="status">Loading this week's leaders…</div><button class="secondary" onclick="clRefreshShoutouts()">Refresh shout-outs</button></div></section>`;
 };
 window.clRefreshShoutouts=async function(){
  const root=document.getElementById('cheese-tray-shoutouts');if(!root)return;
  root.textContent='Loading this week’s leaders…';
  try{
   const response=await fetch('https://yxpamyibhclilgdhgsjd.supabase.co/rest/v1/rpc/cheese_tray_top',{method:'POST',headers:{apikey:'sb_publishable_VuLwAjFpSDCXpz7IfZtJjA_o5_-NzOa','Content-Type':'application/json'},body:JSON.stringify({p_period:'week',p_limit:5})});
   if(!response.ok)throw Error('Leaderboard unavailable');
   const data=await response.json();root.replaceChildren();
   if(!data.length){root.textContent='No qualifying players yet this week.';return}
   const ol=document.createElement('ol');
   for(const item of data){const li=document.createElement('li');li.textContent=item.nickname+' — '+item.points+' points ('+item.lines+' lines)';ol.append(li)}
   root.append(ol);
  }catch(e){root.textContent=e.message}
 };
 const originalRender=render;
 render=function(){const result=originalRender.apply(this,arguments);if(currentTab==='producer')setTimeout(window.clRefreshShoutouts,0);return result};
})();