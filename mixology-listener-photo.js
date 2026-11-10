// Local-only camera-file preparation. Original bytes/filename never enter intake.
(() => {
 'use strict';
 function bounds(w,h){if(w<320||h<320||w>12000||h>12000||w*h>24000000)throw Error('Choose a photo at least 320 pixels per side and at most 24 megapixels.');}
 function dimensions(bytes,mime){const b=new Uint8Array(bytes),v=new DataView(bytes);if(mime==='image/png'&&b.length>=24&&b[0]===137&&String.fromCharCode(...b.slice(1,4))==='PNG'){bounds(v.getUint32(16),v.getUint32(20));return;}
  if(mime==='image/jpeg'&&b[0]===255&&b[1]===216){let i=2;while(i+4<b.length){if(b[i++]!==255)break;let marker=b[i++];while(marker===255)marker=b[i++];if(marker===217||marker===218)break;const n=v.getUint16(i);if(n<2||i+n>b.length)break;if([192,193,194].includes(marker)){bounds(v.getUint16(i+5),v.getUint16(i+3));return;}i+=n;}}
  throw Error('Choose a valid JPEG or PNG photograph.');
 }
 async function prepare(file){if(!file||!['image/jpeg','image/png'].includes(file.type)||file.size>8388608||file.size<100)throw Error('Choose a JPEG or PNG photo up to 8 MB.');const bytes=await file.arrayBuffer();dimensions(bytes,file.type);clMixologyMediaCore.header(bytes,file.type);let bitmap;
  try{bitmap=await createImageBitmap(file);bounds(bitmap.width,bitmap.height);const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),c=document.createElement('canvas');c.width=Math.round(bitmap.width*scale);c.height=Math.round(bitmap.height*scale);if(c.width<320||c.height<320)throw Error('Choose a less extreme photo aspect ratio.');const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(bitmap,0,0,c.width,c.height);const blob=await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('Photo preparation failed.')),'image/jpeg',.8));if(blob.size>524288)throw Error('The prepared photo is over 512 KB. Choose a smaller or simpler photo.');const image=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(blob)});return {image,blob,width:c.width,height:c.height};}finally{bitmap?.close();}
 }
 window.clMixologyListenerPhoto={prepare};
})();
