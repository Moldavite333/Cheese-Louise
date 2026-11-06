import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import fallback from '../_shared/romantiverse-catalog.json' with {type:'json'};
import {createCatalogHandler} from '../_shared/romantiverse-catalog.mjs';
Deno.serve(createCatalogHandler({fallback,env:name=>Deno.env.get(name)}));
