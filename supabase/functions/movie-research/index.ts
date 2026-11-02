import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createHandler} from './handler.mjs';
Deno.serve(createHandler({env:name=>Deno.env.get(name),background:task=>EdgeRuntime.waitUntil(task)}));
