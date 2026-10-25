// Opt-in export: only original trait labels and editorial classifications.
// Never export synopses, votes, user IDs, private notes, cast, provider metadata or TMDB IDs.
(function(){
 const clean=(v,n=120)=>String(v||'').trim().slice(0,n);
 const slug=v=>clean(v,250).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 const seasonOf=m=>{const s=clean(m.season||'').toLowerCase();return s.includes('christmas')||s.includes('winter')?'Christmas':s.includes('fall')||s.includes('autumn')?'Fall':s.includes('horror')?'Horror':'Christmas'};
 function makePackage(){
  if(typeof workspace==='undefined'||!workspace||typeof state==='undefined')throw Error('Open your Cheese Louise workspace first');
  const traits=(state.traits||[]).filter(t=>t.active!==false&&t.retired!==true).map(t=>({
   id:slug(t.name),label:clean(t.name),category:clean(t.category,60),points:Number(t.points)||0
  })).filter(t=>t.id&&t.label);
  const byOriginalId=new Map((state.traits||[]).map(t=>[t.id,slug(t.name)]));
  const allowed=new Set(traits.map(t=>t.id));
  const movies=(state.movies||[]).filter(m=>m.title).map(m=>{
   const year=Number(String(m.date||m.release_date||'').slice(0,4))||null;
   const id='cheese-'+slug(m.title)+'-'+(year||'unknown');
   const ids=(m.selectedTraitIds||[]).map(x=>byOriginalId.get(x)).filter(x=>allowed.has(x));
   return {id,title:clean(m.title,250),release_year:year,season:seasonOf(m),
    story_facts:{setting:[],relationship:[],conflict:[],event:[]},
    cheese_trait_ids:[...new Set(ids)]};
  });
  return {format:'cheese-louise-bingo-v1',exported_at:new Date().toISOString(),traits,movies};
 }
 window.downloadBingoCheesePackage=function(){
  try{
   const data=JSON.stringify(makePackage(),null,2);
   const blob=new Blob([data],{type:'application/json'});
   const url=URL.createObjectURL(blob);
   const a=document.createElement('a');a.href=url;a.download='cheese-louise-bingo-export.json';a.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){alert(e.message)}
 };
 // Export remains available to authorized HQ users through the browser console,
 // but it must not cover navigation or content on every screen.
 window.cheeseBingoExportPreview=()=>{const p=makePackage();return {movies:p.movies.length,traits:p.traits.length,containsSynopsis:false}};
})();
