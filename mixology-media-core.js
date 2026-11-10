// Media eligibility is based on host attestation, not an invented AI/photo detector.
(function(root){
  'use strict';
  function blank(){return {schemaVersion:1,altText:'',caption:'',credit:'',permissionNote:'',rightsAttested:false,realPhotoAttested:false,hidden:false};}
  function validate(d){
    const keys=['schemaVersion','altText','caption','credit','permissionNote','rightsAttested','realPhotoAttested','hidden'];
    if(!d||d.schemaVersion!==1||Object.keys(d).length!==keys.length||Object.keys(d).some(k=>!keys.includes(k))||['altText','caption','credit','permissionNote'].some(k=>typeof d[k]!=='string'||d[k].length>2000)||['rightsAttested','realPhotoAttested','hidden'].some(k=>typeof d[k]!=='boolean')||!d.altText.trim()||d.altText.length>500||!d.credit.trim()||d.credit.length>300||!d.permissionNote.trim()||d.permissionNote.length>1000||(!d.hidden&&(!d.rightsAttested||!d.realPhotoAttested)))throw Error('Add alt text, photo credit and a permission note. Active photos require real-photo and rights confirmation.');
    return d;
  }
  function dimensions(width,height){if(!Number.isFinite(width)||!Number.isFinite(height)||width<320||height<320||width>12000||height>12000||width*height>80000000)throw Error('Choose a photograph at least 320 pixels on each side and no more than 80 megapixels.');const scale=Math.min(1,2400/Math.max(width,height));const result={width:Math.round(width*scale),height:Math.round(height*scale)};if(result.width<320||result.height<320)throw Error('Choose a less extreme photo aspect ratio.');return result;}
  function eligible(row){try{validate(row.document);return !row.document.hidden&&row.document.realPhotoAttested&&row.document.rightsAttested;}catch{return false;}}
  function header(buffer,mime){
    const b=new Uint8Array(buffer),s=(i,n)=>String.fromCharCode(...b.slice(i,i+n)),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
    if(mime==='image/jpeg'&&b[0]===255&&b[1]===216&&b[2]===255)return true;
    if(mime==='image/png'&&b.length>=24&&b[0]===137&&s(1,3)==='PNG'&&s(12,4)==='IHDR'){
      dimensions(v.getUint32(16),v.getUint32(20));let offset=8,count=0;
      while(offset+12<=b.length&&count++<1024){const size=v.getUint32(offset),kind=s(offset+4,4);if(offset+12+size>b.length)break;if(kind==='acTL')throw Error('Animated images are not accepted.');if(kind==='IEND')return true;offset+=12+size;}
    }
    if(mime==='image/webp'&&b.length>=20&&s(0,4)==='RIFF'&&s(8,4)==='WEBP'){
      let offset=12,count=0;while(offset+8<=b.length&&count++<1024){const size=v.getUint32(offset+4,true),kind=s(offset,4);if(offset+8+size>b.length)break;if(kind==='ANIM'||kind==='ANMF'||kind==='VP8X'&&(b[offset+8]&2))throw Error('Animated images are not accepted.');offset+=8+size+(size%2);}if(offset===b.length)return true;
    }
    throw Error('The file content does not match a supported still-photo format.');
  }
  const api={blank,validate,dimensions,eligible,header};root.clMixologyMediaCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
