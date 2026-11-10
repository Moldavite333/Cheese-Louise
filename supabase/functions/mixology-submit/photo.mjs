// The codec is injected so the same bounds/metadata policy is tested in Node and used by Edge.
export function createPhotoSanitizer(jpeg){return async base64=>{
 if(typeof base64!=='string'||base64.length>699052||!/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(base64))throw Error('invalid_photo');
 const binary=atob(base64),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));if(bytes.length>524288||bytes.length<100)throw Error('invalid_photo');
 let decoded;try{decoded=jpeg.decode(bytes,{useTArray:true,formatAsRGBA:true,tolerantDecoding:false,maxResolutionInMP:2.56,maxMemoryUsageInMB:64});}catch{throw Error('invalid_photo');}
 if(!decoded||decoded.width<320||decoded.height<320||decoded.width>1600||decoded.height>1600||decoded.data.length!==decoded.width*decoded.height*4)throw Error('invalid_photo');
 // Only pixels enter the encoder: do not forward decoded EXIF, comments or metadata.
 const clean=jpeg.encode({width:decoded.width,height:decoded.height,data:decoded.data},80).data;if(clean.length>524288)throw Error('invalid_photo');
 let text='';for(let i=0;i<clean.length;i+=8192)text+=String.fromCharCode(...clean.subarray(i,i+8192));const digest=await crypto.subtle.digest('SHA-256',clean);
 return {base64:btoa(text),width:decoded.width,height:decoded.height,digest:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')};
};}
