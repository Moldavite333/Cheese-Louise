// Pure ranking logic, shared by the Edge Function and offline regression tests.
export const favorites=[
 {title:'Coupled Up for Christmas',year:2023}, {title:'A Christmas Movie Christmas',year:2019},
 {title:'Everything Christmas',year:2023}, {title:'A Biltmore Christmas',year:2023},
 {title:'A Very Nutty Christmas',year:2018}, {title:'Pumpkin Regatta Romance',year:2026},
 {title:'The Spirit of Christmas',year:2015}, {title:"Something's Brewing",year:2023}
];
export const norm=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/^(a|an|the) /,'');
export const themes=[
 {name:'time-travel romance',rx:/\b(time travel|time loop|back in time|travels? (?:back|through time|from \d{4} to \d{4})|transported (?:back|to (?:the past|\d{4}|present day))|new reality|alternate reality|parallel reality|wakes? up \d+ years earlier|re-live|relive|hourglass)\b/i,weight:18},
 {name:'magical romance',rx:/\b(magic|magical|magically|enchanted|nutcracker|spell|supernatural|body.switching|body.swap|wish (?:comes true|is granted)|wishes come true|grants? (?:her|his|a) wish)\b/i,weight:15},
 {name:'romantic ghost story',rx:/\b(ghost|ghosts|ghostly|haunted|afterlife|angel|spirit (?:of a|of her|of his|returns|haunts))\b/i,weight:16},
 {name:'playful movie-within-a-movie premise',rx:/\b(movie within|movie world|parody|satire|inside a movie|holiday themed world|movie comes to life|trapped in a (?:christmas |holiday )?movie)\b/i,weight:16},
 {name:'pretend-couple romance',rx:/\b(fake dating|pretend|fake relationship|pretending|posing as|pretend couple)\b/i,weight:11},
 {name:'fantastical romance',rx:/(?!)/,weight:14},
 {name:'autumn town festivities',rx:/\b(autumn|pumpkin|regatta|harvest|fall festival)\b/i,weight:8},
 {name:'cozy café romance',rx:/\b(coffee|cafe|barista|bakery|brewing)\b/i,weight:5},
 {name:'Christmas setting',rx:/\b(christmas|mistletoe|yuletide)\b/i,weight:3}
];
const trusted=/hallmark|crown media|marvista|reel one|cartel pictures|johnson production|front street|muse entertainment|brain power|nicely entertainment|champlain media|synthetic cinema|incendo/i;
const excludedGenres=new Set([27,99,16,28,80,53,10752]);
export const names=rows=>(Array.isArray(rows)?rows:[]).map(x=>typeof x==='string'?x:x?.name).filter(Boolean);
export const ids=movie=>new Set((movie.genres||movie.genre_ids||[]).map(x=>typeof x==='number'?x:x.id));
export const text=movie=>[movie.title,movie.overview||movie.summary,movie.tagline,...names(movie.keywords?.keywords||movie.keywords)].filter(Boolean).join(' ');
export const featureNames=movie=>{
 const body=text(movie).replace(/\bmagic of (?:christmas|the holidays|the season|love)\b/gi,'').replace(/\bchristmas spirit\b/gi,'');
 const features=themes.filter(t=>t.rx.test(body)).map(t=>t.name);
 if(ids(movie).has(14))features.push('fantastical romance');
 return features;
};
export function eligible(movie){
 const g=ids(movie),body=text(movie);
 if(movie.adult||[...g].some(id=>excludedGenres.has(id)))return false;
 if(movie.runtime&&(movie.runtime<65||movie.runtime>135))return false;
 const quirky=featureNames(movie).some(x=>themes.slice(0,6).some(t=>t.name===x));
 const romance=g.has(10749)||/\b(romance|romantic|falls? in love|falling in love|finds? love|love interest|romantic connection)\b/i.test(body)||
  (g.has(10770)&&quirky&&/\b(husband|wife|ex-wife|ex-husband|boyfriend|girlfriend|fiance|marriage|dating)\b/i.test(body));
 if(!romance)return false;
 return g.has(10770)||trusted.test(names(movie.production_companies).join(' '))||
  (g.has(10749)&&g.has(35)&&quirky);
}
function overlap(a,b){const set=new Set(a);return [...new Set(b)].filter(x=>set.has(x));}
function keywords(movie){return names(movie.keywords?.keywords||movie.keywords).map(norm).filter(x=>!['christmas','holiday','romance','tv movie','romantic comedy','woman director','based on novel or book'].includes(x));}
export function scoreMovie(movie,seeds,negative=[]){
 if(!eligible(movie))return null;
 const features=featureNames(movie),g=ids(movie),reasons=[];
 let score=20+(g.has(10770)?12:0);
 if(trusted.test(names(movie.production_companies).join(' ')))score+=8;
 let strongest=null;
 for(const seed of seeds){
  const shared=overlap(features,featureNames(seed));
  const specific=shared.filter(x=>x!=='Christmas setting');
  const kw=overlap(keywords(movie),keywords(seed));
  const cast=overlap((movie.credits?.cast||[]).slice(0,4).map(x=>x.id),(seed.credits?.cast||[]).slice(0,4).map(x=>x.id));
  const directors=overlap((movie.credits?.crew||[]).filter(x=>x.job==='Director').map(x=>x.id),(seed.credits?.crew||[]).filter(x=>x.job==='Director').map(x=>x.id));
  const recommended=(movie.seed_ids||[]).includes(seed.id);
  const related=specific.reduce((n,x)=>n+(themes.find(t=>t.name===x)?.weight||0),0)+Math.min(12,kw.length*4)+Math.min(6,cast.length*3)+(directors.length?4:0)+(recommended?12:0);
  const weight=Number(seed.preference_weight||1);
  if(!strongest||related*weight>strongest.score)strongest={score:related*weight,seed,specific,cast,recommended};
 }
 if(strongest){
  score+=Math.min(55,strongest.score);
  const s=strongest;
  if(s.specific.length)reasons.push('Shares '+s.specific.slice(0,2).join(' and ')+' themes with '+s.seed.title);
  if(s.recommended)reasons.push('TMDB recommends this from '+s.seed.title);
  if(s.cast.length)reasons.push('Shares a lead cast member with '+s.seed.title);
 }
 // Reward the requested quirky/magical tone; a seasonal word alone is weak evidence.
 const quirky=features.filter(x=>themes.slice(0,6).some(t=>t.name===x));
 if(quirky.length){score+=12;reasons.push('Quirky or magical romantic premise in the synopsis');}
 if(!reasons.length)return null;
 for(const no of negative){
  const shared=overlap(features,featureNames(no)).filter(x=>x!=='Christmas setting');
  score-=Math.min(15,shared.length*5)*Number(no.preference_weight||1);
 }
 if(score<32)return null;
 return {score:Math.round(Math.min(99,score)),reasons:[...new Set(reasons)].slice(0,4),lane:features.includes('autumn town festivities')?'autumn':quirky.length?'quirky':features.includes('Christmas setting')?'christmas':'cozy',anchor:strongest?.seed?.id||0};
}
export function diversify(rows,limit){
 const remaining=rows.slice().sort((a,b)=>b.fit.score-a.fit.score),chosen=[],anchors=new Map(),lanes=new Map();
 while(remaining.length&&chosen.length<limit){
  let best=0,value=-Infinity;
  for(let i=0;i<remaining.length;i++){
   const row=remaining[i],adjusted=row.fit.score-(anchors.get(row.fit.anchor)||0)*3-(lanes.get(row.fit.lane)||0);
   if(adjusted>value){best=i;value=adjusted;}
  }
  const [row]=remaining.splice(best,1);chosen.push(row);
  anchors.set(row.fit.anchor,(anchors.get(row.fit.anchor)||0)+1);lanes.set(row.fit.lane,(lanes.get(row.fit.lane)||0)+1);
 }
 return chosen;
}
