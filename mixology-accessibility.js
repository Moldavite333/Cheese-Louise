// Keep keyboard position across Mixology-only rerenders without changing HQ navigation.
(() => {
 'use strict';
 const surface=()=>document.querySelector('.mix-studio,.mix-listeners');
 const visible=el=>el&&el.getClientRects().length&&!el.disabled&&!el.closest('[hidden],[inert]');
 function describe(el,root){
  if(!el||!root?.contains(el))return null;
  if(el.id)return {id:el.id};
  if(el.matches('h1'))return {heading:true};
  const attribute=['onclick','oninput','onchange'].find(name=>el.hasAttribute(name)),label=el.getAttribute('aria-label');
  if(attribute)return {attribute,value:el.getAttribute(attribute)};
  if(label)return {tag:el.tagName,label};
  return null;
 }
 function find(d,root){
  if(!d||!root)return null;
  if(d.id)return root.querySelector('#'+CSS.escape(d.id));
  if(d.heading)return root.querySelector('h1');
  return [...root.querySelectorAll(d.attribute?'['+d.attribute+']':'[aria-label]')].find(el=>d.attribute?el.getAttribute(d.attribute)===d.value:el.tagName===d.tag&&el.getAttribute('aria-label')===d.label);
 }
 // Native focus scrolling does not account for HQ's fixed phone navigation.
 document.addEventListener('focusin',event=>{const target=event.target;if(!surface()?.contains(target))return;requestAnimationFrame(()=>{if(document.activeElement!==target||!target.isConnected)return;const box=target.getBoundingClientRect(),header=document.querySelector('.hq-topbar'),top=header?.getClientRects().length&&['sticky','fixed'].includes(getComputedStyle(header).position)?Math.max(12,header.getBoundingClientRect().bottom+12):12,nav=document.querySelector('.hq-mobile-nav'),bottom=nav?.getClientRects().length?Math.min(innerHeight,nav.getBoundingClientRect().top):innerHeight;if(box.bottom>bottom-12){const delta=box.height>bottom-top-12?box.top-top:box.bottom-bottom+12;window.scrollBy({top:delta,behavior:'instant'});}else if(box.top<top)window.scrollBy({top:box.top-top,behavior:'instant'});});});
 const base=render;
 render=function(...args){
  const before=surface(),focused=document.activeElement,position=describe(focused,before);
  let selection;try{if(position&&typeof focused.selectionStart==='number')selection=[focused.selectionStart,focused.selectionEnd];}catch{}
  const result=base.apply(this,args),after=surface();
  if(after){
   // Keep textarea names stable after their saved text is rendered inside the label.
   for(const label of after.querySelectorAll('label')){const control=label.control;if(control?.tagName==='TEXTAREA'&&!control.hasAttribute('aria-label')&&!control.hasAttribute('aria-labelledby')){const copy=label.cloneNode(true);for(const field of copy.querySelectorAll('input,textarea,select,button'))field.remove();const name=copy.textContent.trim();if(name)control.setAttribute('aria-label',name);}}
   const heading=after.querySelector('h1');if(heading)heading.tabIndex=-1;
   const panel=after.querySelector('.mix-panel');if(panel){panel.id='mix-tool-panel';panel.setAttribute('role','region');const selected=after.querySelector('.mix-tabs [aria-pressed="true"]');panel.setAttribute('aria-label',selected?.textContent||'Recipe tool');}
   for(const button of after.querySelectorAll('.mix-tabs [aria-pressed]'))button.setAttribute('aria-controls','mix-tool-panel');
   if(position){const target=find(position,after);if(visible(target)){target.focus({preventScroll:true});if(selection)try{target.setSelectionRange(...selection)}catch{}}else heading?.focus({preventScroll:true});}
   else if(!before)heading?.focus({preventScroll:true});
  }
  return result;
 };
})();
