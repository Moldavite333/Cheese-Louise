import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
export const U='11111111-1111-4111-8111-111111111111',J='22222222-2222-4222-8222-222222222222',O='33333333-3333-4333-8333-333333333333',W='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',K='cccccccc-cccc-4ccc-8ccc-cccccccccccc',M='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const root=new URL('../../',import.meta.url);
export async function setup({stage2=false,approval=false,production=false,media=false,publication=false,submissions=false,listenerTypes=true,listenerPhotos=true}={}){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema private;
 create table auth.users(id uuid primary key);insert into auth.users values('${U}'),('${J}'),('${O}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,private to authenticated;grant execute on function auth.uid() to authenticated;
 create table public.workspaces(id uuid primary key);insert into public.workspaces values('${W}'),('${B}');
 create table public.workspace_members(workspace_id uuid,user_id uuid);insert into public.workspace_members values('${W}','${U}'),('${W}','${J}'),('${B}','${U}'),('${B}','${O}');
 grant select on public.workspace_members to authenticated;
 create function private.is_workspace_member(w uuid) returns boolean language sql stable as $$select exists(select 1 from public.workspace_members where workspace_id=w and user_id=auth.uid())$$;
 create table public.episodes(id uuid primary key,workspace_id uuid);create table public.movies(id uuid primary key,workspace_id uuid);insert into public.movies values('${M}','${B}');`);
 await db.exec(await readFile(new URL('supabase/migrations/20261003_cocktail_bar_v112.sql',root),'utf8'));
 await db.exec(await readFile(new URL('supabase/migrations/20261003_cocktail_intelligence_v113.sql',root),'utf8'));
 await db.exec(`grant select,insert,update on public.cocktails to authenticated;
 insert into public.cocktails(id,workspace_id,name,cocktail_type,ingredients,method,tested,rating) values('${K}','${W}','Cranberry Trial','cheese_louise','45 ml Brandy\n10 ml Cranberry syrup','Build over ice.',true,5);`);
 const migration=(await readdir(new URL('supabase/migrations/',root))).find(x=>x.endsWith('_mixology_stage1.sql'));
 await db.exec(await readFile(new URL('supabase/migrations/'+migration,root),'utf8'));
 if(stage2){const second=(await readdir(new URL('supabase/migrations/',root))).find(x=>x.endsWith('_mixology_stage2.sql'));await db.exec(await readFile(new URL('supabase/migrations/'+second,root),'utf8'));}
 if(approval||production||publication){const file=(await readdir(new URL('supabase/migrations/',root))).find(x=>x.endsWith('_mixology_approval.sql'));await db.exec(await readFile(new URL('supabase/migrations/'+file,root),'utf8'));}
 if(production||publication){const file=(await readdir(new URL('supabase/migrations/',root))).find(x=>x.endsWith('_mixology_production.sql'));await db.exec(await readFile(new URL('supabase/migrations/'+file,root),'utf8'));}
 if(media||publication){await db.exec(`create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb,unique(bucket_id,name));alter table storage.objects enable row level security;grant usage on schema storage to authenticated,anon;grant select,insert,update,delete on storage.objects to authenticated;grant select on storage.objects to anon;grant select on storage.buckets to authenticated;`);const file=(await readdir(new URL('supabase/migrations/',root))).find(x=>x.endsWith('_mixology_media.sql'));await db.exec(await readFile(new URL('supabase/migrations/'+file,root),'utf8'));}
 if(publication){const file=(await readdir(new URL('supabase/migrations/',root))).find(x=>x.endsWith('_mixology_publication.sql'));await db.exec(await readFile(new URL('supabase/migrations/'+file,root),'utf8'));}
 if(submissions){const file=(await readdir(new URL('supabase/migrations/',root))).find(x=>x.endsWith('_mixology_submissions.sql'));await db.exec(await readFile(new URL('supabase/migrations/'+file,root),'utf8'));}
 if(submissions&&listenerTypes){const file=(await readdir(new URL('supabase/migrations/',root))).find(x=>x.endsWith('_mixology_listener_feedback_variations.sql'));await db.exec(await readFile(new URL('supabase/migrations/'+file,root),'utf8'));}
 if(submissions&&listenerTypes&&listenerPhotos){const file=(await readdir(new URL('supabase/migrations/',root))).find(x=>x.endsWith('_mixology_listener_photos.sql'));await db.exec(await readFile(new URL('supabase/migrations/'+file,root),'utf8'));}
 if(publication&&submissions&&listenerTypes&&listenerPhotos){const file=(await readdir(new URL('supabase/migrations/',root))).find(x=>x.endsWith('_mixology_listener_photo_handoff.sql'));await db.exec(await readFile(new URL('supabase/migrations/'+file,root),'utf8'));}
 const trends=(await readdir(new URL('supabase/migrations/',root))).find(x=>x.endsWith('_mixology_trend_review.sql'));await db.exec(await readFile(new URL('supabase/migrations/'+trends,root),'utf8'));
 await as(db,U);return db;
}
export async function as(db,user){await db.exec(`reset role;select set_config('request.jwt.claim.sub','${user}',false);set role authenticated;`);}
