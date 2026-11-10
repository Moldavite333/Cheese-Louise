import jpeg from 'npm:jpeg-js@0.4.4';
import {createPhotoSanitizer} from './photo.mjs';
import {createHandler} from './handler.mjs';
Deno.serve(createHandler({env:name=>Deno.env.get(name),sanitizePhoto:createPhotoSanitizer(jpeg)}));
