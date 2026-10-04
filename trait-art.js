// Cheese Louise v1.17 — Romantiverse Trait Art
// Visual Cheese Traits + automatic art for new traits + Bingo image integration.

const TRAIT_ART_STYLE_VERSION='romantiverse-v1';
const TRAIT_ART_COLORS={cream:'#f4ead1',paper:'#fffaf0',green:'#173f36',red:'#c43e46',pink:'#e96b78',gold:'#d4a52e',ink:'#1d2924'};
let traitArtBackfillStarted=false;
let traitArtBoardMode=localStorage.getItem('clBingoBoardArtMode')||'text';
let traitArtExportMode=localStorage.getItem('clBingoExportArtMode')||'illustrated';

function traitArtHash(text){
  let h=2166136261;
  for(const ch of String(text||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
  return h>>>0;
}
function traitArtSeed(name,category,extra=''){return traitArtHash(`${name}|${category}|${extra}`).toString(36).toUpperCase().slice(0,8)}
function traitArtPrompt(name,category){
  return `Cheese Louise Romantiverse trait icon: ${name}. Category: ${category||'Other'}. Vintage mid-century cheese-wrapper illustration inspired by the Romantiverse Cheese Traits reference: cream background, deep forest-green outlines, warm red/pink accents, gold highlights, simple centered symbolic icon, lightly distressed print texture, clean bold shapes, no text.`;
}

function traitArtMotif(name,category){
  const s=`${name||''} ${category||''}`.toLowerCase();
  const tests=[
    ['city',/big.city|corporate|another city|famous/],['homecoming',/return|hometown|comes home|homecoming/],['festival',/festival|pageant/],['holiday',/holiday|christmas wish|christmas star/],['snow',/snowed|snow.machine|storm|road closure|blizzard/],['business',/family business|save the family business|business at risk/],['inn',/inn|b&b|lodge/],['farm',/farm|ranch|vineyard|winery|tree farm/],['renovation',/renovat|carpenter|developer/],['bakery',/bakery|bake|cookie|cooking|restaurant/],['coffee',/coffee|cocoa|warm drink/],['book',/bookstore|newspaper/],['flower',/flower/],['career',/career|promotion|boss|work assignment|event planner/],['parent',/single parent|widow|parent|grandparent|family tragedy/],['pet',/animal|sidekick/],['local',/gruff|local/],['matchmaker',/matchmak/],['meddling',/meddling|aunt/],['elder',/elder|mentor/],['child',/child|kid/],['ex',/ex appears|old flame|dead spouse|breakup/],['enemies',/rivals|enemies/],['fake',/fake dating|fake relationship|fake engagement/],['friends',/friends to lovers/],['secondchance',/second chance|old flame/],['workplace',/workplace|work assignment/],['childhood',/childhood/],['admirer',/secret admirer/],['triangle',/triangle/],['bed',/one bed|roommate/],['kiss',/kiss/],['deadline',/deadline|last.minute/],['gears',/working together|labor montage/],['mistaken',/mistaken identity|royal mistaken/],['misunderstanding',/misunderstanding|miscommunication|one sentence/],['change',/plans change|ultimatum/],['competition',/contest|competition|competing/],['team',/team up|together/],['simple',/simpler life|small.town|quaint mountain|seaside/],['loveovercareer',/love over career|career.or.love|promotion vs hometown/],['touch',/touch/],['gesture',/grand romantic gesture|fundraiser/],['gift',/gift|inheritance/],['montage',/montage/],['dance',/dance/],['decorate',/decorat|tree.light/],['confession',/confession/],['travel',/airport|train|destination wedding/],['snowglobe',/snow globe/],['makeover',/makeover/],['singing',/carol|singing/],['snowplay',/snowball/],['magic',/magic|santa/],['everafter',/ever after/],['royal',/royal|prince|princess|castle|commoner/],['amnesia',/amnesia/],['villain',/villain|developer/],['town',/town|main street/]
  ];
  return (tests.find(([,re])=>re.test(s))||['cheese'])[0];
}

function traitArtSparkles(seed){
  const h=traitArtHash(seed);const pts=[[18+(h%11),19+((h>>3)%10)],[104-((h>>5)%13),22+((h>>9)%11)],[20+((h>>13)%9),103-((h>>17)%11)],[104-((h>>20)%12),104-((h>>24)%10)]];
  return pts.map(([x,y],i)=>i%2?`<circle cx="${x}" cy="${y}" r="2.2" fill="${TRAIT_ART_COLORS.gold}" opacity=".75"/>`:`<path d="M${x} ${y-4}v8M${x-4} ${y}h8" stroke="${TRAIT_ART_COLORS.gold}" stroke-width="2" stroke-linecap="round" opacity=".75"/>`).join('');
}
function traitArtHeart(x=64,y=62,s=1,color=TRAIT_ART_COLORS.red){return `<path d="M${x} ${y+12*s}C${x-22*s} ${y-2*s},${x-18*s} ${y-20*s},${x} ${y-10*s}C${x+18*s} ${y-20*s},${x+22*s} ${y-2*s},${x} ${y+12*s}Z" fill="${color}"/>`}
function traitArtTree(x=30,y=78,s=1){return `<path d="M${x} ${y-38*s}l${-17*s} ${26*s}h${10*s}l${-14*s} ${22*s}h${42*s}l${-14*s} ${-22*s}h${10*s}Z" fill="${TRAIT_ART_COLORS.green}"/><rect x="${x-3*s}" y="${y+7*s}" width="${6*s}" height="${12*s}" rx="1" fill="${TRAIT_ART_COLORS.gold}"/>`}
function traitArtIcon(key){
  const g=TRAIT_ART_COLORS.green,r=TRAIT_ART_COLORS.red,p=TRAIT_ART_COLORS.pink,y=TRAIT_ART_COLORS.gold,c=TRAIT_ART_COLORS.cream;
  switch(key){
    case 'town': return `<g stroke="${g}" stroke-width="4" stroke-linejoin="round"><path d="M20 88V53l22-16 20 16v35H20Z" fill="${r}"/><path d="M57 88V42l23-18 27 22v42H57Z" fill="${c}"/><path d="M74 88V67h14v21" fill="${y}"/></g>${traitArtTree(20,82,.55)}`;
    case 'city': return `<g fill="${g}"><rect x="19" y="46" width="22" height="46"/><rect x="45" y="27" width="28" height="65"/><rect x="77" y="38" width="31" height="54"/></g><g fill="${y}">${[26,34,52,62,82,92].map((x,i)=>`<rect x="${x}" y="${55+(i%2)*12}" width="6" height="7" rx="1"/>`).join('')}</g>`;
    case 'homecoming': return `<rect x="28" y="36" width="72" height="52" rx="10" fill="${r}" stroke="${g}" stroke-width="5"/><path d="M47 36v-8h34v8" fill="none" stroke="${g}" stroke-width="5"/>${traitArtHeart(64,58,.62,c)}`;
    case 'festival': return `<path d="M20 87V49l44-23 44 23v38" fill="${c}" stroke="${g}" stroke-width="5"/><path d="M20 49h88M38 39v48M64 26v61M90 39v48" stroke="${r}" stroke-width="7"/><path d="M64 26V13l18 7-18 7" fill="${y}" stroke="${g}" stroke-width="3"/>`;
    case 'holiday': return `<circle cx="64" cy="63" r="33" fill="none" stroke="${g}" stroke-width="13" stroke-dasharray="7 5"/>${traitArtHeart(64,64,.55,r)}<path d="M52 31l12-12 12 12" fill="none" stroke="${y}" stroke-width="7" stroke-linecap="round"/>`;
    case 'snow': return `<g stroke="${g}" stroke-width="5" stroke-linecap="round"><path d="M64 22v84M28 43l72 42M28 85l72-42"/><path d="M64 22l-8 9m8-9 8 9M64 106l-8-9m8 9 8-9"/></g>`;
    case 'business': return `<rect x="22" y="45" width="84" height="48" rx="5" fill="${c}" stroke="${g}" stroke-width="5"/><path d="M19 45l10-20h70l10 20" fill="${r}" stroke="${g}" stroke-width="5"/><path d="M30 25v20m16-20v20m18-20v20m18-20v20m17-20v20" stroke="${c}" stroke-width="5"/><rect x="53" y="61" width="22" height="32" fill="${y}" stroke="${g}" stroke-width="4"/>`;
    case 'inn': return `<path d="M20 91V50l44-27 44 27v41H20Z" fill="${y}" stroke="${g}" stroke-width="5"/><rect x="51" y="62" width="26" height="29" fill="${r}" stroke="${g}" stroke-width="4"/>${traitArtTree(26,89,.55)}${traitArtTree(102,90,.5)}`;
    case 'farm': return `<path d="M24 91V47l40-23 40 23v44" fill="${r}" stroke="${g}" stroke-width="5"/><rect x="50" y="60" width="28" height="31" fill="${c}" stroke="${g}" stroke-width="4"/><path d="M14 100c25-20 75-19 102 0" fill="none" stroke="${g}" stroke-width="5"/>`;
    case 'renovation': return `<path d="M33 94l47-55" stroke="${g}" stroke-width="12" stroke-linecap="round"/><path d="M68 30l13-13 28 27-13 13Z" fill="${r}" stroke="${g}" stroke-width="5"/><path d="M21 106l17-17" stroke="${y}" stroke-width="5"/>`;
    case 'bakery': return `<path d="M35 65h58l-8 35H43Z" fill="${r}" stroke="${g}" stroke-width="5"/><path d="M39 64c-6-19 12-25 22-14 6-20 28-13 26 3 17-1 20 17 6 21H39Z" fill="${c}" stroke="${g}" stroke-width="5"/><circle cx="64" cy="49" r="5" fill="${y}"/>`;
    case 'coffee': return `<path d="M31 50h58v37c0 12-10 20-22 20H53c-12 0-22-8-22-20V50Z" fill="${r}" stroke="${g}" stroke-width="5"/><path d="M89 58h10c16 0 16 25 0 25H89" fill="none" stroke="${g}" stroke-width="5"/><path d="M47 40c-8-11 8-14 0-25M66 40c-8-11 8-14 0-25" stroke="${g}" stroke-width="4" fill="none" stroke-linecap="round"/>${traitArtHeart(61,71,.42,c)}`;
    case 'book': return `<path d="M22 35c15-8 29-6 42 4v59c-13-10-27-12-42-4V35Zm84 0c-15-8-29-6-42 4v59c13-10 27-12 42-4V35Z" fill="${c}" stroke="${g}" stroke-width="5"/>${traitArtHeart(64,68,.38,r)}`;
    case 'flower': return `<g fill="${r}" stroke="${g}" stroke-width="3"><circle cx="64" cy="45" r="10"/><circle cx="47" cy="55" r="10"/><circle cx="81" cy="55" r="10"/><circle cx="53" cy="38" r="10"/><circle cx="75" cy="38" r="10"/></g><circle cx="64" cy="48" r="8" fill="${y}"/><path d="M64 57v43m0-20-18-12m18 18 20-14" stroke="${g}" stroke-width="5"/>`;
    case 'career': return `<rect x="26" y="42" width="76" height="54" rx="7" fill="${g}"/><path d="M47 42V31h34v11" fill="none" stroke="${g}" stroke-width="7"/><rect x="31" y="53" width="66" height="13" fill="${y}"/>${traitArtHeart(64,76,.36,r)}`;
    case 'parent': return `<circle cx="47" cy="46" r="16" fill="${p}" stroke="${g}" stroke-width="4"/><circle cx="80" cy="59" r="12" fill="${y}" stroke="${g}" stroke-width="4"/><path d="M26 101c4-26 36-32 48-11 6-15 29-15 36 11" fill="${c}" stroke="${g}" stroke-width="5"/>${traitArtHeart(67,72,.35,r)}`;
    case 'pet': return `<circle cx="64" cy="65" r="30" fill="${y}" stroke="${g}" stroke-width="5"/><path d="M39 47 26 30l3 32M89 47l13-17-3 32" fill="${y}" stroke="${g}" stroke-width="5"/><circle cx="53" cy="62" r="4" fill="${g}"/><circle cx="76" cy="62" r="4" fill="${g}"/><path d="M58 76q6 7 12 0" stroke="${g}" stroke-width="4" fill="none"/>${traitArtHeart(64,101,.28,r)}`;
    case 'matchmaker': return `<path d="M23 54h36v42H34c-7 0-11-6-11-13V54Zm82 0H69v42h25c7 0 11-6 11-13V54Z" fill="${r}" stroke="${g}" stroke-width="5"/>${traitArtHeart(64,43,.5,r)}`;
    case 'meddling': return `<circle cx="44" cy="60" r="20" fill="none" stroke="${g}" stroke-width="6"/><circle cx="84" cy="60" r="20" fill="none" stroke="${g}" stroke-width="6"/><path d="M64 60h1M24 55 13 48m91 7 11-7" stroke="${g}" stroke-width="6" stroke-linecap="round"/><path d="M42 87c11 9 34 9 45 0" stroke="${r}" stroke-width="5" fill="none"/>`;
    case 'elder': return `<path d="M45 35v48c0 20 9 28 29 28 16 0 27-9 27-22 0-10-8-18-19-18H49" fill="none" stroke="${g}" stroke-width="7" stroke-linecap="round"/><path d="M34 111h77" stroke="${y}" stroke-width="6" stroke-linecap="round"/>`;
    case 'child': return `<circle cx="64" cy="61" r="31" fill="${p}" stroke="${g}" stroke-width="5"/><path d="M37 43q27-34 54 0" fill="${g}"/><circle cx="53" cy="61" r="3" fill="${g}"/><circle cx="75" cy="61" r="3" fill="${g}"/><path d="M54 76q10 8 20 0" stroke="${r}" stroke-width="4" fill="none"/>${traitArtHeart(64,101,.25,r)}`;
    case 'ex': return `<path d="M64 103C24 75 29 35 53 35c8 0 12 5 17 12 5-7 9-12 17-12 24 0 27 39-23 68Z" fill="${r}"/><path d="M69 48 55 65l13 8-14 19" fill="none" stroke="${c}" stroke-width="6"/>`;
    case 'enemies': return `<path d="M26 95 88 34M102 95 40 34" stroke="${g}" stroke-width="7" stroke-linecap="round"/>${traitArtHeart(64,56,.42,r)}`;
    case 'fake': return `<path d="M21 42q22-19 43 1v42q-25 20-43-1V42Zm86 0Q85 23 64 43v42q25 20 43-1V42Z" fill="${p}" stroke="${g}" stroke-width="4"/><path d="M31 61q10 9 20 0m26 10q10-9 20 0" fill="none" stroke="${c}" stroke-width="4"/>`;
    case 'friends': return `<circle cx="45" cy="62" r="24" fill="${r}" stroke="${g}" stroke-width="5"/><circle cx="83" cy="62" r="24" fill="${g}" stroke="${g}" stroke-width="5"/>${traitArtHeart(64,62,.35,c)}`;
    case 'secondchance': return `<path d="M92 49A35 35 0 1 0 96 84" fill="none" stroke="${r}" stroke-width="9" stroke-linecap="round"/><path d="M93 35 96 55 78 51" fill="${r}"/>${traitArtHeart(62,67,.42,r)}`;
    case 'workplace': return `<rect x="24" y="34" width="80" height="58" rx="5" fill="${g}"/><rect x="32" y="42" width="64" height="42" fill="${c}"/>${traitArtHeart(64,62,.38,r)}<path d="M47 101h34" stroke="${g}" stroke-width="7"/>`;
    case 'childhood': return `<circle cx="45" cy="76" r="19" fill="none" stroke="${g}" stroke-width="5"/><circle cx="92" cy="76" r="19" fill="none" stroke="${g}" stroke-width="5"/><path d="M45 76 61 48h22l9 28M61 48l15 28M52 61h35" fill="none" stroke="${r}" stroke-width="5"/>${traitArtHeart(80,35,.28,p)}`;
    case 'admirer': return `<rect x="23" y="40" width="82" height="55" rx="4" fill="${c}" stroke="${p}" stroke-width="5"/><path d="M25 44 64 72l39-28" fill="none" stroke="${p}" stroke-width="5"/>${traitArtHeart(64,61,.36,r)}`;
    case 'triangle': return `${traitArtHeart(64,34,.38,r)}${traitArtHeart(41,78,.38,p)}${traitArtHeart(87,78,.38,g)}`;
    case 'bed': return `<rect x="23" y="55" width="82" height="36" rx="5" fill="${r}" stroke="${g}" stroke-width="5"/><rect x="28" y="43" width="30" height="20" rx="8" fill="${c}" stroke="${g}" stroke-width="4"/><path d="M23 91v15m82-15v15" stroke="${g}" stroke-width="6"/>${traitArtHeart(83,45,.25,r)}`;
    case 'kiss': return `<path d="M21 68c16-27 31-29 43-8 13-21 28-19 43 8-25 37-61 37-86 0Z" fill="${r}"/><path d="M31 68h66" stroke="${c}" stroke-width="4" opacity=".8"/>`;
    case 'deadline': return `<rect x="25" y="34" width="78" height="70" rx="5" fill="${c}" stroke="${r}" stroke-width="6"/><path d="M25 52h78M42 24v21M86 24v21" stroke="${g}" stroke-width="6"/>${traitArtHeart(64,76,.34,r)}`;
    case 'gears': return `<g fill="${g}"><circle cx="49" cy="58" r="22"/><circle cx="83" cy="79" r="18"/></g><g fill="${c}"><circle cx="49" cy="58" r="9"/><circle cx="83" cy="79" r="7"/></g>${traitArtHeart(83,41,.24,r)}`;
    case 'mistaken': return `<path d="M24 42q20-17 40 2v43q-23 18-40-2V42Zm80 0Q84 25 64 44v43q23 18 40-2V42Z" fill="${r}" stroke="${g}" stroke-width="4"/><path d="M35 62h12m34 0h12" stroke="${c}" stroke-width="5"/>`;
    case 'misunderstanding': return `<path d="M18 35h55v39H42L30 87v-13H18Z" fill="${p}"/><path d="M61 60h49v35H88l-10 12V95H61Z" fill="${g}"/>${traitArtHeart(64,65,.28,r)}`;
    case 'change': return `<path d="M64 24v84" stroke="${g}" stroke-width="7"/><path d="M61 39h40l-11 12 11 12H61M67 72H27l11 12-11 12h40" fill="${r}" stroke="${g}" stroke-width="4"/>`;
    case 'competition': return `<path d="M41 31h46v33c0 21-12 32-23 32S41 85 41 64V31Z" fill="${y}" stroke="${g}" stroke-width="5"/><path d="M41 42H25c0 20 7 29 22 31M87 42h16c0 20-7 29-22 31" fill="none" stroke="${g}" stroke-width="5"/><path d="M64 96v12M46 110h36" stroke="${g}" stroke-width="6"/>`;
    case 'team': return `<path d="M21 64 45 43l20 17 18-15 24 20-31 29-14-12-14 11Z" fill="${p}" stroke="${g}" stroke-width="5"/>${traitArtHeart(64,41,.25,r)}`;
    case 'simple': return `${traitArtTree(38,92,.72)}${traitArtTree(86,96,.55)}<path d="M18 93 48 55l16 18 17-27 29 47Z" fill="${c}" stroke="${g}" stroke-width="5"/>`;
    case 'loveovercareer': return `<rect x="22" y="48" width="84" height="52" rx="7" fill="${g}"/><path d="M45 48V35h38v13" fill="none" stroke="${g}" stroke-width="7"/>${traitArtHeart(64,72,.52,r)}`;
    case 'touch': return `<path d="M17 72c19-20 27-20 42-8l8 8 8-8c15-12 23-12 42 8" fill="none" stroke="${g}" stroke-width="10" stroke-linecap="round"/>${traitArtHeart(67,50,.28,r)}`;
    case 'gesture': return `${traitArtHeart(64,66,.5,r)}<g stroke="${r}" stroke-width="4" stroke-linecap="round"><path d="M64 17v15M23 34l12 10M105 34 93 44M17 74h16M111 74H95"/></g>`;
    case 'gift': return `<rect x="24" y="51" width="80" height="52" rx="4" fill="${r}" stroke="${g}" stroke-width="5"/><path d="M64 51v52M19 51h90V36H19Z" fill="${y}" stroke="${g}" stroke-width="5"/><path d="M64 36c-21 1-24-18-11-19 8-1 11 7 11 19Zm0 0c21 1 24-18 11-19-8-1-11 7-11 19Z" fill="${p}" stroke="${g}" stroke-width="3"/>`;
    case 'montage': return `<path d="M24 38h80v62H24Z" fill="${g}"/><path d="M24 38h80l-8-18H16Z" fill="${c}" stroke="${g}" stroke-width="5"/><path d="M31 23l10 15m15-15 10 15m15-15 10 15" stroke="${r}" stroke-width="5"/>${traitArtHeart(64,70,.35,r)}`;
    case 'dance': return `<circle cx="64" cy="59" r="35" fill="none" stroke="${g}" stroke-width="5"/><path d="M64 24v70M29 59h70M38 38c15 13 37 13 52 0M38 80c15-13 37-13 52 0" stroke="${g}" stroke-width="3"/>${traitArtHeart(64,103,.25,r)}`;
    case 'decorate': return `<path d="M17 44c28 21 66 21 94 0" fill="none" stroke="${g}" stroke-width="4"/>${[27,45,64,83,101].map((x,i)=>`<path d="M${x} ${50+i%2*5}v14" stroke="${g}" stroke-width="3"/><circle cx="${x}" cy="${68+i%2*5}" r="7" fill="${i%2?r:y}"/>`).join('')}`;
    case 'confession': return `<path d="M19 34h90v58H62l-20 18V92H19Z" fill="${p}" stroke="${g}" stroke-width="5"/>${traitArtHeart(64,62,.38,r)}`;
    case 'travel': return `<path d="M17 73 111 44 76 74v28l-15-20-25 11 3-19Z" fill="${g}"/>${traitArtHeart(92,34,.24,r)}`;
    case 'snowglobe': return `<circle cx="64" cy="58" r="36" fill="${c}" stroke="${g}" stroke-width="5"/>${traitArtTree(64,70,.55)}<path d="M38 100h52l8 13H30Z" fill="${r}" stroke="${g}" stroke-width="4"/><g fill="${p}"><circle cx="42" cy="49" r="3"/><circle cx="76" cy="39" r="3"/><circle cx="87" cy="64" r="3"/></g>`;
    case 'makeover': return `<ellipse cx="64" cy="59" rx="31" ry="39" fill="${c}" stroke="${y}" stroke-width="7"/><ellipse cx="64" cy="59" rx="19" ry="27" fill="none" stroke="${g}" stroke-width="4"/>${traitArtHeart(64,59,.25,r)}`;
    case 'singing': return `<path d="M49 28v55c-9-7-25-3-25 9 0 15 25 15 25-4V46l39-9v37c-9-7-25-3-25 9 0 15 25 15 25-4V20Z" fill="${g}"/>${traitArtHeart(101,95,.22,r)}`;
    case 'snowplay': return `<circle cx="64" cy="78" r="26" fill="${c}" stroke="${g}" stroke-width="4"/><circle cx="64" cy="43" r="19" fill="${c}" stroke="${g}" stroke-width="4"/><circle cx="58" cy="40" r="3" fill="${g}"/><circle cx="70" cy="40" r="3" fill="${g}"/><path d="M31 71 12 58M97 71l19-13" stroke="${g}" stroke-width="5"/><path d="M50 25h28l-5-12H55Z" fill="${r}"/>`;
    case 'magic': return `<path d="M29 101 93 31" stroke="${g}" stroke-width="9" stroke-linecap="round"/><path d="m97 18 5 13 14 1-11 9 3 14-11-8-12 8 4-14-11-9 14-1Z" fill="${y}" stroke="${g}" stroke-width="3"/>${traitArtSparkles('magic')}`;
    case 'everafter': return `${traitArtHeart(51,61,.58,r)}${traitArtHeart(77,61,.58,p)}`;
    case 'royal': return `<path d="M27 82 20 38l25 22 19-35 19 35 25-22-7 44Z" fill="${y}" stroke="${g}" stroke-width="5"/><rect x="28" y="82" width="72" height="16" rx="4" fill="${r}" stroke="${g}" stroke-width="4"/>${traitArtHeart(64,68,.25,r)}`;
    case 'amnesia': return `<circle cx="64" cy="59" r="36" fill="${c}" stroke="${g}" stroke-width="5"/><text x="64" y="72" text-anchor="middle" font-family="Georgia,serif" font-size="56" font-weight="900" fill="${r}">?</text>`;
    case 'villain': return `<path d="M18 86h87l-11 18H29Z" fill="${g}"/><rect x="32" y="48" width="44" height="37" fill="${r}" stroke="${g}" stroke-width="5"/><circle cx="42" cy="106" r="8" fill="${y}"/><circle cx="88" cy="106" r="8" fill="${y}"/><path d="M77 49h24l14 37h-39Z" fill="${y}" stroke="${g}" stroke-width="5"/>`;
    default: return `<path d="M26 36 94 47v43l-68 4Z" fill="${y}" stroke="${g}" stroke-width="5"/><circle cx="47" cy="58" r="6" fill="${c}"/><circle cx="74" cy="72" r="7" fill="${c}"/>${traitArtHeart(93,91,.28,r)}`;
  }
}

function traitArtSvg(name,category,seed=''){
  const motif=traitArtMotif(name,category);const s=seed||traitArtSeed(name,category);
  const C=TRAIT_ART_COLORS;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="${String(name||'Cheese Trait').replace(/[&<>\"]/g,'')}"><rect width="128" height="128" rx="18" fill="${C.cream}"/><rect x="4" y="4" width="120" height="120" rx="15" fill="none" stroke="${C.green}" stroke-width="4" opacity=".9"/>${traitArtSparkles(s)}<g transform="translate(0 0)">${traitArtIcon(motif)}</g><path d="M12 113c28 6 76 6 104 0" fill="none" stroke="${C.red}" stroke-width="3" opacity=".28"/></svg>`;
}
function traitArtDataUri(name,category,seed=''){return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(traitArtSvg(name,category,seed))}`}
function traitArtUrl(trait){
  if(!trait) return traitArtDataUri('Cheese Trait','Romantiverse','missing');
  return trait.thumbnail_url||trait.image_url||traitArtDataUri(trait.name,trait.category,trait.image_seed||traitArtSeed(trait.name,trait.category));
}
function traitArtImg(trait,cls='trait-art-image',alt=null){
  return `<img class="${cls}" src="${traitArtUrl(trait)}" alt="${esc(alt||trait?.name||'Cheese Trait')}" loading="lazy" decoding="async">`;
}
function traitArtFields(name,category,seed=''){
  const s=seed||traitArtSeed(name,category,Date.now());const url=traitArtDataUri(name,category,s);const now=new Date().toISOString();
  return {image_url:url,thumbnail_url:url,image_prompt:traitArtPrompt(name,category),image_status:'ready',image_style_version:TRAIT_ART_STYLE_VERSION,image_source:'generated',image_seed:s,image_updated_at:now};
}

async function traitArtBackfillMissing(){
  if(traitArtBackfillStarted||!workspace) return;
  traitArtBackfillStarted=true;
  const missing=(state.traits||[]).filter(t=>!t.image_url);
  if(!missing.length) return;
  const rows=missing.map(t=>({...t,...traitArtFields(t.name,t.category,t.image_seed||traitArtSeed(t.name,t.category,'backfill'))}));
  const {data,error}=await db.from('cheese_traits').upsert(rows,{onConflict:'id'}).select();
  if(error){console.warn('Trait art backfill deferred:',error.message);traitArtBackfillStarted=false;return;}
  const byId=new Map((data||[]).map(t=>[t.id,t]));
  state.traits=(state.traits||[]).map(t=>byId.get(t.id)||t);
}

const traitArtOriginalLoadAll=loadAll;
loadAll=async function(){
  await traitArtOriginalLoadAll();
  if(workspace) setTimeout(()=>traitArtBackfillMissing(),20);
};

// --- Cheese Trait library ---------------------------------------------------
const traitArtOriginalAddTrait=addTrait;
addTrait=async function(){
  const name=prompt('New Cheese Trait:'); if(!name) return;
  const category=prompt('Category:','Romantiverse Rules')||'Other';
  const raw=prompt('Point value (0–50):','5');
  const points=Math.max(0,Math.min(50,Number(raw)||0));
  const cleanName=name.trim();const cleanCategory=category.trim()||'Other';
  const maxSort=Math.max(0,...state.traits.map(t=>Number(t.sort_order)||0));
  const art=traitArtFields(cleanName,cleanCategory);
  const {data,error}=await db.from('cheese_traits').insert({workspace_id:workspace.id,name:cleanName,category:cleanCategory,points,sort_order:maxSort+10,created_by:me(),...art}).select().single();
  if(error) return alert(error.message);
  await logActivity(`added Cheese Trait “${cleanName}” (+${points}) with Romantiverse art.`,'trait',data.id);
  await loadAll(); render();
};

const traitArtOriginalEditTrait=editTrait;
editTrait=async function(id){
  const t=(state.traits||[]).find(x=>x.id===id); if(!t) return;
  const name=prompt('Trait name:',t.name); if(name===null) return;
  const category=prompt('Category:',t.category); if(category===null) return;
  const raw=prompt('Point value:',String(t.points)); if(raw===null) return;
  const cleanName=name.trim()||t.name;const cleanCategory=category.trim()||'Other';
  const points=Math.max(0,Math.min(50,Number(raw)||0));
  const changed=cleanName!==t.name||cleanCategory!==t.category;
  const regen=changed&&confirm('The trait name/category changed. Regenerate its Romantiverse art to match?\n\nOK = regenerate\nCancel = keep current art');
  const payload={name:cleanName,category:cleanCategory,points,updated_at:new Date().toISOString(),image_prompt:traitArtPrompt(cleanName,cleanCategory)};
  if(regen) Object.assign(payload,traitArtFields(cleanName,cleanCategory,traitArtSeed(cleanName,cleanCategory,Date.now())));
  const {error}=await db.from('cheese_traits').update(payload).eq('id',id);
  if(error) return alert(error.message);
  await logActivity(`updated Cheese Trait “${cleanName}” to +${points}.`,'trait',id);
  await loadAll(); render();
};

async function traitArtRegenerate(id){
  const t=(state.traits||[]).find(x=>x.id===id);if(!t)return;
  const fields=traitArtFields(t.name,t.category,traitArtSeed(t.name,t.category,Date.now()+Math.random()));
  const {error}=await db.from('cheese_traits').update(fields).eq('id',id);
  if(error)return alert(error.message);
  await loadAll();render();
}
async function traitArtRemove(id){
  const t=(state.traits||[]).find(x=>x.id===id);if(!t)return;
  if(!confirm(`Remove the custom/stored art for “${t.name}”? A generated placeholder will still appear.`))return;
  const {error}=await db.from('cheese_traits').update({image_url:null,thumbnail_url:null,image_status:'missing',image_source:'generated',image_updated_at:new Date().toISOString()}).eq('id',id);
  if(error)return alert(error.message);
  traitArtBackfillStarted=false;await loadAll();render();
}
function traitArtUpload(id){
  const t=(state.traits||[]).find(x=>x.id===id);if(!t||!workspace)return;
  const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp,image/svg+xml';
  input.onchange=async()=>{
    const file=input.files?.[0];if(!file)return;
    if(file.size>5*1024*1024)return alert('Please use an image under 5 MB.');
    const safe=(file.name||'trait-art').replace(/[^a-z0-9._-]+/gi,'-').toLowerCase();
    const path=`${workspace.id}/${id}/${Date.now()}-${safe}`;
    const {error}=await db.storage.from('trait-art').upload(path,file,{upsert:false,contentType:file.type||undefined,cacheControl:'31536000'});
    if(error)return alert(error.message);
    const {data}=db.storage.from('trait-art').getPublicUrl(path);
    const url=data?.publicUrl;if(!url)return alert('Upload succeeded but no public URL was returned.');
    const upd=await db.from('cheese_traits').update({image_url:url,thumbnail_url:url,image_status:'custom',image_source:'custom',image_updated_at:new Date().toISOString()}).eq('id',id);
    if(upd.error)return alert(upd.error.message);
    await loadAll();render();
  };
  input.click();
}

traitPickerHtml=function(m){
  const q=traitSearch.trim().toLowerCase();
  const selected=new Set(m.selectedTraitIds||[]);
  const available=state.traits.filter(t=>(t.is_active||selected.has(t.id))&&(!traitSelectedOnly||selected.has(t.id))&&(!q||`${t.name} ${t.category}`.toLowerCase().includes(q)));
  const grouped=available.reduce((acc,t)=>((acc[t.category]??=[]).push(t),acc),{});
  if(!available.length)return '<div class="empty">No Cheese Traits match this view.</div>';
  return Object.entries(grouped).map(([category,traits])=>`<div class="trait-category"><div class="trait-category-title"><span>${esc(category)}</span><span class="subtle">${traits.filter(t=>selected.has(t.id)).length} selected</span></div><div class="trait-toggle-list">${traits.map(t=>`<button class="trait-toggle trait-art-toggle ${selected.has(t.id)?'selected':''} ${!t.is_active?'retired':''}" onclick="toggleMovieTrait('${m.id}','${t.id}')">${traitArtImg(t,'trait-art-picker-thumb')}<span class="trait-check">${selected.has(t.id)?'✓':'○'}</span><span class="trait-name">${esc(t.name)}${!t.is_active?' <em>(retired)</em>':''}<small>${esc(t.category||'Other')}</small></span><span class="trait-points">+${t.points}</span></button>`).join('')}</div></div>`).join('');
};

cheeseTraitManagerModal=function(){
  const categories=[...new Set(state.traits.map(t=>t.category))].sort();
  return `<div class="modal-backdrop" onclick="closeTraitManager(event)"><div class="modal trait-manager trait-art-manager" onclick="event.stopPropagation()">
    <div class="modal-header"><div><div class="kicker">Cheese Louise visual dictionary</div><h2 style="margin:6px 0">Cheese Trait Library</h2><div class="subtle">Every trait carries Romantiverse art. New traits receive art automatically; regenerate or upload a replacement any time.</div></div><button class="close" onclick="closeTraitManager()">×</button></div>
    <div class="trait-manager-actions"><button class="primary" onclick="addTrait()">+ Add Cheese Trait</button><button class="secondary" onclick="traitArtBackfillNow()">🎨 Refresh missing art</button><span class="pill">${state.traits.filter(t=>t.is_active).length} active</span></div>
    ${categories.map(category=>{const traits=state.traits.filter(t=>t.category===category).sort((a,b)=>a.sort_order-b.sort_order||a.name.localeCompare(b.name));return `<div class="manager-category"><div class="trait-category-title"><strong>${esc(category)}</strong><span class="subtle">${traits.length}</span></div>${traits.map(t=>`<div class="manager-trait trait-art-manager-row ${!t.is_active?'retired-row':''}">${traitArtImg(t,'trait-art-manager-thumb')}<div class="trait-art-manager-main"><strong>${esc(t.name)}</strong><div class="subtle">${t.is_active?'Active':'Retired'} · ${t.image_status==='custom'?'Custom art':'Romantiverse art'}</div></div><div class="manager-points">+${t.points}</div><div class="trait-art-manager-actions"><button class="secondary" onclick="traitArtRegenerate('${t.id}')">🎲 Art</button><button class="secondary" onclick="traitArtUpload('${t.id}')">⬆ Upload</button><button class="secondary" onclick="editTrait('${t.id}')">Edit</button><button class="secondary" onclick="setTraitActive('${t.id}',${t.is_active?'false':'true'})">${t.is_active?'Retire':'Restore'}</button></div></div>`).join('')}</div>`}).join('')}
  </div></div>`;
};
async function traitArtBackfillNow(){traitArtBackfillStarted=false;await traitArtBackfillMissing();await loadAll();render()}

// --- Bingo visuals ----------------------------------------------------------
function traitArtSetBingoMode(mode){traitArtBoardMode=mode==='illustrated'?'illustrated':'text';localStorage.setItem('clBingoBoardArtMode',traitArtBoardMode);render()}
function traitArtSetExportMode(mode){traitArtExportMode=mode==='classic'?'classic':'illustrated';localStorage.setItem('clBingoExportArtMode',traitArtExportMode);render()}

const traitArtOriginalBingoEditorControls=rvBingoEditorControls;
rvBingoEditorControls=function(){
  const base=traitArtOriginalBingoEditorControls();
  const controls=`<div class="trait-art-bingo-options"><div><div class="kicker">Board style</div><div class="trait-art-segment"><button class="filter ${traitArtBoardMode==='text'?'active-filter':''}" onclick="traitArtSetBingoMode('text')">Text first</button><button class="filter ${traitArtBoardMode==='illustrated'?'active-filter':''}" onclick="traitArtSetBingoMode('illustrated')">Illustrated</button></div></div><div><div class="kicker">Share / export</div><div class="trait-art-segment"><button class="filter ${traitArtExportMode==='classic'?'active-filter':''}" onclick="traitArtSetExportMode('classic')">Classic</button><button class="filter ${traitArtExportMode==='illustrated'?'active-filter':''}" onclick="traitArtSetExportMode('illustrated')">Illustrated</button></div></div></div>`;
  return base.replace('<div class="rv-bingo-export-row">',`${controls}<div class="rv-bingo-export-row">`);
};

rvBingoSquareHtml=function(index){
  const free=index===RV_BINGO_FREE_INDEX;
  const id=rvBingoDraft?.squares?.[index]||null;
  const trait=id?rvBingoTraitById(id):null;
  const marked=free||(rvBingoDraft?.marked_indices||[]).includes(index);
  const locked=(rvBingoDraft?.locked_indices||[]).includes(index);
  const winning=rvBingoWinningIndexes().has(index);
  if(free){
    const freeTrait={name:'FREE SPACE',category:'Romantiverse',image_url:traitArtDataUri('Cheese Louise','Romantiverse','FREE-CHEESE')};
    return `<button class="rv-bingo-square rv-bingo-free trait-art-bingo-square ${marked?'is-marked':''} ${winning?'is-winning':''}" type="button" aria-label="Free space">${traitArtImg(freeTrait,'rv-bingo-trait-art rv-bingo-free-art','Free space')}<span class="rv-bingo-square-text">FREE SPACE</span></button>`;
  }
  const title=trait?.name||'Tap to choose';
  const cat=trait?.category||'';
  return `<div class="rv-bingo-square-wrap"><button class="rv-bingo-square trait-art-bingo-square ${traitArtBoardMode==='illustrated'?'is-illustrated':'is-text-first'} ${marked?'is-marked':''} ${winning?'is-winning':''} ${!id?'is-empty':''}" type="button" onclick="${rvBingoPlayMode?`rvBingoToggleMark(${index})`:`rvBingoOpenPicker(${index})`}" aria-label="${esc(title)}">${trait?traitArtImg(trait,'rv-bingo-trait-art'):''}<span class="rv-bingo-square-text">${esc(title)}</span>${!rvBingoPlayMode&&cat?`<span class="rv-bingo-square-category">${esc(cat)}</span>`:''}${rvBingoPlayMode&&marked?'<span class="rv-bingo-hit">✓</span>':''}</button>${!rvBingoPlayMode?`<button class="rv-bingo-lock ${locked?'is-locked':''}" type="button" onclick="rvBingoToggleLock(${index},event)" aria-label="${locked?'Unlock':'Lock'} square">${locked?'🔒':'🔓'}</button>`:''}</div>`;
};

rvBingoPickerModal=function(){
  if(!rvBingoPicker||!rvBingoDraft)return '';
  const squareMode=rvBingoPicker.mode==='square';const current=squareMode?rvBingoDraft.squares[rvBingoPicker.index]:null;const used=rvBingoUsedTraitIds(squareMode?rvBingoPicker.index:null);const q=(rvBingoPicker.search||'').trim().toLowerCase();const category=rvBingoPicker.category||'all';
  const traits=(state.traits||[]).filter(t=>{if(t.is_active===false&&!current)return false;const cat=t.category||'Wildcard';if(category!=='all'&&cat!==category)return false;if(q&&!`${t.name} ${cat}`.toLowerCase().includes(q))return false;return true}).sort((a,b)=>(a.category||'').localeCompare(b.category||'')||a.name.localeCompare(b.name));
  return `<div class="modal-backdrop" onclick="rvBingoClosePicker(event)"><div class="modal rv-bingo-picker-modal" onclick="event.stopPropagation()"><div class="modal-header"><div><div class="kicker">${squareMode?`Square ${rvBingoPicker.index+1}`:'Generation filters'}</div><h2>${squareMode?'Choose a Cheese Trait':'Exclude Cheese Traits'}</h2></div><button class="close" onclick="rvBingoClosePicker()">×</button></div>${squareMode?`<div class="rv-bingo-picker-actions"><button class="primary" onclick="rvBingoRandomizeSquare()">🎲 Randomize only this square</button><button class="secondary" onclick="rvBingoToggleLock(${rvBingoPicker.index});rvBingoClosePicker()">${(rvBingoDraft.locked_indices||[]).includes(rvBingoPicker.index)?'Unlock square':'Lock square'}</button></div>`:''}<div class="rv-bingo-picker-filters"><input class="search" placeholder="Search Cheese Traits…" value="${esc(rvBingoPicker.search||'')}" oninput="rvBingoPickerSearch(this.value)"><select class="search" onchange="rvBingoPickerCategory(this.value)"><option value="all">All categories</option>${rvBingoCategories().map(cat=>`<option value="${esc(cat)}" ${cat===category?'selected':''}>${esc(cat)}</option>`).join('')}</select></div><div class="rv-bingo-trait-picker-list">${traits.map(t=>{const already=used.has(String(t.id));const selected=String(current||'')===String(t.id);const excluded=(rvBingoDraft.excluded_trait_ids||[]).includes(t.id);if(squareMode)return `<button class="rv-bingo-trait-option trait-art-bingo-option ${already?'is-used':''} ${selected?'is-selected':''}" ${already?'disabled':''} onclick="rvBingoChooseTrait('${t.id}')">${traitArtImg(t,'trait-art-bingo-picker-thumb')}<span class="trait-art-option-copy"><strong>${esc(t.name)}</strong><small>${esc(t.category||'Wildcard')}</small></span><span>${selected?'✓':already?'Used':''}</span></button>`;return `<button class="rv-bingo-trait-option trait-art-bingo-option ${excluded?'is-excluded':''}" onclick="rvBingoToggleExcludedTrait('${t.id}')">${traitArtImg(t,'trait-art-bingo-picker-thumb')}<span class="trait-art-option-copy"><strong>${esc(t.name)}</strong><small>${esc(t.category||'Wildcard')}</small></span><span>${excluded?'Excluded':'Include'}</span></button>`}).join('')||'<div class="empty">No traits match this search.</div>'}</div><div class="episode-editor-actions"><button class="secondary" onclick="rvBingoClosePicker()">Done</button></div></div></div>`;
};

function traitArtMiniBoard(card){
  const sq=Array.isArray(card.squares)?card.squares:[];
  return `<div class="trait-art-mini-board">${Array.from({length:25},(_,i)=>{if(i===12)return `<div class="trait-art-mini-cell free">🧀</div>`;const t=rvBingoTraitById(sq[i]);return `<div class="trait-art-mini-cell">${t?traitArtImg(t,'trait-art-mini-img'):''}</div>`}).join('')}</div>`;
}
rvBingoSavedCardsHtml=function(){
  const cards=state.bingoCards||[];
  return `<section class="section"><div class="rv-bingo-section-head"><div><h2 style="margin:0">Saved Cards</h2><div class="subtle">Reopen, duplicate, rename, delete, or hand different boards to watch-along players.</div></div><span class="pill">${cards.length} saved</span></div><div class="rv-bingo-saved-grid">${cards.map(card=>`<article class="card card-pad rv-bingo-saved-card trait-art-saved-card">${traitArtMiniBoard(card)}<div><div class="kicker">Card #${card.card_number} · ${esc(fmtDate(card.created_at))}</div><h3>${esc(card.name)}</h3><div class="subtle">Share ID ${esc(String(card.id).slice(0,8).toUpperCase())}</div></div><div class="rv-bingo-saved-actions"><button class="primary" onclick="rvBingoOpenSaved('${card.id}')">Open</button><button class="secondary" onclick="rvBingoDuplicateSaved('${card.id}')">Duplicate</button><button class="secondary" onclick="rvBingoRenameSaved('${card.id}')">Rename</button><button class="secondary rv-bingo-danger" onclick="rvBingoDeleteSaved('${card.id}')">Delete</button></div></article>`).join('')||'<div class="empty">No saved Bingo cards yet. Generate one and save it when you like the board.</div>'}</div></section>`;
};

function traitArtLoadImage(src){return new Promise(resolve=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=src})}
function traitArtWrapCanvasText(ctx,text,x,y,maxWidth,maxLines,fontSize){
  const words=String(text||'').split(/\s+/);const lines=[];let line='';
  for(const w of words){const test=line?`${line} ${w}`:w;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=w}else line=test}
  if(line)lines.push(line);while(lines.length>maxLines){const tail=lines.pop();lines[lines.length-1]+=` ${tail}`}
  const lh=fontSize*1.05;const start=y-(lines.length-1)*lh/2;lines.forEach((l,i)=>ctx.fillText(l,x,start+i*lh));
}
async function traitArtIllustratedCanvas(){
  if(!rvBingoDraft)return null;
  const canvas=document.createElement('canvas');canvas.width=1400;canvas.height=1600;const ctx=canvas.getContext('2d');const C=TRAIT_ART_COLORS;
  ctx.fillStyle=C.cream;ctx.fillRect(0,0,1400,1600);ctx.fillStyle=C.green;ctx.fillRect(0,0,1400,210);ctx.textAlign='center';ctx.fillStyle=C.gold;ctx.font='700 30px Georgia';ctx.fillText('CHEESE LOUISE',700,48);ctx.fillStyle=C.cream;ctx.font='900 68px Arial';ctx.fillText('ROMANTIVERSE BINGO',700,118);ctx.font='28px Georgia';ctx.fillText('Unlocking the Rules of the Romantiverse',700,165);ctx.fillStyle=C.red;ctx.fillRect(80,230,1240,8);
  const x0=80,y0=270,size=248;
  for(let i=0;i<25;i++){
    const col=i%5,row=Math.floor(i/5),x=x0+col*size,y=y0+row*size,free=i===12;ctx.fillStyle=free?C.gold:'#fffaf0';ctx.fillRect(x,y,size,size);ctx.strokeStyle=C.green;ctx.lineWidth=5;ctx.strokeRect(x,y,size,size);
    if(free){ctx.fillStyle=C.green;ctx.font='900 34px Arial';ctx.fillText('🧀',x+size/2,y+86);ctx.fillText('FREE SPACE',x+size/2,y+150);continue}
    const trait=rvBingoTraitById(rvBingoDraft.squares[i]);
    if(trait){const art=await traitArtLoadImage(traitArtUrl(trait));if(art){ctx.save();ctx.beginPath();ctx.roundRect(x+54,y+20,140,140,20);ctx.clip();ctx.drawImage(art,x+54,y+20,140,140);ctx.restore()}}
    ctx.fillStyle=C.ink;ctx.font='700 27px Arial';ctx.textBaseline='middle';traitArtWrapCanvasText(ctx,trait?.name||'Trait',x+size/2,y+199,size-28,3,27);ctx.textBaseline='alphabetic';
  }
  ctx.fillStyle=C.green;ctx.font='24px Arial';ctx.fillText(rvBingoDraft.name||`Romantiverse Bingo${rvBingoDraft.card_number?` #${rvBingoDraft.card_number}`:''}`,700,1540);return canvas;
}
const traitArtOriginalBingoCanvas=rvBingoCanvas;
const traitArtOriginalPrintView=rvBingoPrintView;
async function traitArtBingoExportPng(){
  if(traitArtExportMode==='classic')return rvBingoDownloadCanvas(traitArtOriginalBingoCanvas());
  const canvas=await traitArtIllustratedCanvas();return rvBingoDownloadCanvas(canvas);
}
function rvBingoDownloadCanvas(canvas){if(!canvas)return;const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download=`${(rvBingoDraft?.name||'romantiverse-bingo').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'romantiverse-bingo'}.png`;document.body.appendChild(a);a.click();a.remove()}
async function traitArtBingoShareCard(){
  const canvas=traitArtExportMode==='classic'?traitArtOriginalBingoCanvas():await traitArtIllustratedCanvas();if(!canvas)return;const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)return rvBingoDownloadCanvas(canvas);const file=new File([blob],'romantiverse-bingo.png',{type:'image/png'});if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){try{await navigator.share({title:rvBingoDraft?.name||'Romantiverse Bingo',text:'Cheese Louise · Romantiverse Bingo',files:[file]});return}catch(err){if(err?.name==='AbortError')return}}rvBingoDownloadCanvas(canvas);
}
function traitArtBingoPrintView(){
  if(traitArtExportMode==='classic')return traitArtOriginalPrintView();if(!rvBingoDraft)return;const win=window.open('','_blank');if(!win)return alert('Allow pop-ups to open the print view.');const cells=Array.from({length:25},(_,i)=>{if(i===12)return `<div class="cell free"><div class="icon">🧀</div><strong>FREE SPACE</strong></div>`;const t=rvBingoTraitById(rvBingoDraft.squares[i]);return `<div class="cell">${t?`<img src="${traitArtUrl(t)}" alt="">`:''}<strong>${esc(t?.name||'')}</strong></div>`}).join('');win.document.write(`<!doctype html><html><head><title>${esc(rvBingoDraft.name||'Romantiverse Bingo')}</title><style>body{font-family:Arial,sans-serif;background:#fffdf4;color:#173f36;padding:24px}.wrap{max-width:850px;margin:auto}.brand{text-align:center}.brand small{font-weight:700;letter-spacing:.18em}.brand h1{margin:8px 0 4px}.board{display:grid;grid-template-columns:repeat(5,1fr);border:2px solid #173f36;margin-top:18px}.cell{aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:7px;border:1px solid #173f36;font-size:13px;gap:5px}.cell img{width:58%;height:58%;object-fit:contain;border-radius:8px}.free{background:#eee5c8}.icon{font-size:28px}@media print{body{padding:0}.board{break-inside:avoid}}</style></head><body><div class="wrap"><div class="brand"><small>CHEESE LOUISE</small><h1>ROMANTIVERSE BINGO</h1><div>${esc(rvBingoDraft.name||'')}</div></div><div class="board">${cells}</div></div><script>window.onload=()=>window.print()<\/script></body></html>`);win.document.close();
}

const traitArtOriginalTopbar=topbar;
topbar=function(){return traitArtOriginalTopbar().replace('>v1.16<','>v1.17<').replace('>v1.15<','>v1.17<')};

window.addTrait=addTrait;window.editTrait=editTrait;
window.traitArtRegenerate=traitArtRegenerate;window.traitArtRemove=traitArtRemove;window.traitArtUpload=traitArtUpload;window.traitArtBackfillNow=traitArtBackfillNow;
window.traitArtSetBingoMode=traitArtSetBingoMode;window.traitArtSetExportMode=traitArtSetExportMode;
window.rvBingoExportPng=traitArtBingoExportPng;window.rvBingoShareCard=traitArtBingoShareCard;window.rvBingoPrintView=traitArtBingoPrintView;
