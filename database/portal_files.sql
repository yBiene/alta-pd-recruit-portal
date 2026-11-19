begin;
create table public.mrpd_portal_files(
 id uuid primary key default gen_random_uuid(),target_type text not null check(target_type in ('entry','message','operation')),
 target_id uuid not null,owner_id uuid not null default auth.uid(),name text not null check(char_length(name) between 1 and 255),
 mime text not null check(mime in ('image/jpeg','image/png','image/webp','application/pdf')),
 bytes bigint not null check(bytes between 1 and 10485760),ready boolean not null default false,created_at timestamptz not null default now()
);
create index mrpd_portal_file_target on public.mrpd_portal_files(target_type,target_id,created_at);
alter table public.mrpd_portal_files enable row level security;
revoke all on public.mrpd_portal_files from anon,authenticated;
grant select on public.mrpd_portal_files to authenticated;
create function portal_private.file_target_access(p_type text,p_id uuid,p_edit boolean default false) returns boolean language plpgsql stable security definer set search_path='' as $$
declare unit uuid; author uuid; kind text; archived boolean;
begin
 if not portal_private.hub_member() then return false;end if;
 if p_type='entry' then
  select e.unit_id,e.author_id,e.kind,e.archived into unit,author,kind,archived from public.mrpd_unit_entries e where e.id=p_id;
  return found and portal_private.unit_access(unit) and (not p_edit or (not archived and (portal_private.unit_manager(unit) or (author=auth.uid() and kind in ('task','case')))));
 elsif p_type='message' then
  select m.unit_id,m.author_id into unit,author from public.mrpd_unit_messages m where m.id=p_id;
  return found and portal_private.unit_access(unit) and (not p_edit or author=auth.uid() or portal_private.unit_manager(unit));
 elsif p_type='operation' then
  return case when p_edit then portal_private.ops_edit(p_id) else portal_private.ops_access(p_id) end;
 end if;
 return false;
end
$$;
revoke all on function portal_private.file_target_access(text,uuid,boolean) from public,anon;
grant execute on function portal_private.file_target_access(text,uuid,boolean) to authenticated;
create policy portal_file_read on public.mrpd_portal_files for select to authenticated using(portal_private.file_target_access(target_type,target_id) and (ready or owner_id=auth.uid()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('mrpd-portal-files','mrpd-portal-files',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']);
create policy portal_files_storage_read on storage.objects for select to authenticated using(bucket_id='mrpd-portal-files' and exists(select 1 from public.mrpd_portal_files f where storage.objects.name=f.id::text and f.ready and portal_private.file_target_access(f.target_type,f.target_id)));
create policy portal_files_storage_insert on storage.objects for insert to authenticated with check(bucket_id='mrpd-portal-files' and exists(select 1 from public.mrpd_portal_files f where storage.objects.name=f.id::text and f.owner_id=auth.uid() and not f.ready and portal_private.file_target_access(f.target_type,f.target_id,true)));
create policy portal_files_storage_delete on storage.objects for delete to authenticated using(bucket_id='mrpd-portal-files' and exists(select 1 from public.mrpd_portal_files f where storage.objects.name=f.id::text and f.owner_id=auth.uid() and not f.ready and portal_private.file_target_access(f.target_type,f.target_id,true)));
create function portal_private.file_command(p_action text,p_id uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.mrpd_portal_files;obj storage.objects;
begin
 if not portal_private.hub_member() then raise exception 'Bitte anmelden' using errcode='42501';end if;
 if p_action='prepare' then
  if not portal_private.file_target_access(p_data->>'target_type',(p_data->>'target_id')::uuid,true) then raise exception 'Keine Upload-Berechtigung' using errcode='42501';end if;
  select * into f from public.mrpd_portal_files where id=p_id;
  if found then
   if f.owner_id<>auth.uid() or f.target_type<>p_data->>'target_type' or f.target_id<>(p_data->>'target_id')::uuid then raise exception 'Datei-ID bereits belegt';end if;
   return to_jsonb(f);
  end if;
  insert into public.mrpd_portal_files(id,target_type,target_id,name,mime,bytes) values(p_id,p_data->>'target_type',(p_data->>'target_id')::uuid,p_data->>'name',p_data->>'mime',(p_data->>'bytes')::bigint) returning * into f;
 elsif p_action='finish' then
  select * into f from public.mrpd_portal_files where id=p_id for update;
  if not found or f.owner_id<>auth.uid() or not portal_private.file_target_access(f.target_type,f.target_id,true) then raise exception 'Keine Upload-Berechtigung' using errcode='42501';end if;
  select * into obj from storage.objects where bucket_id='mrpd-portal-files' and name=f.id::text;
  if not found or (obj.metadata->>'size')::bigint is distinct from f.bytes or obj.metadata->>'mimetype' is distinct from f.mime then raise exception 'Upload noch nicht vollständig oder Dateityp ungültig.';end if;
  update public.mrpd_portal_files set ready=true where id=f.id returning * into f;
 else raise exception 'Unbekannte Dateiaktion';end if;
 return to_jsonb(f);
end
$$;
create function public.mrpd_file_command(p_action text,p_id uuid,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$
 select portal_private.file_command(p_action,p_id,p_data)
$$;
revoke all on function public.mrpd_file_command(text,uuid,jsonb),portal_private.file_command(text,uuid,jsonb) from public,anon;
grant execute on function public.mrpd_file_command(text,uuid,jsonb),portal_private.file_command(text,uuid,jsonb) to authenticated;
commit;
