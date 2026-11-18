begin;
create or replace function portal_private.mrpd_track_change() returns trigger language plpgsql security definer set search_path='' as $$
declare
 before_row jsonb := case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
 after_row jsonb := case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
 fields text[];
 actor uuid := auth.uid();
 verified_header text;
begin
 select array_agg(key order by key) into fields from unnest(string_to_array(tg_argv[2],',')) as allowed(key)
 where before_row->key is distinct from after_row->key;
 if fields is null then return null; end if;
 if actor is null and auth.jwt()->>'role'='service_role' then
  verified_header := nullif(current_setting('request.headers',true),'')::jsonb->>'x-mrpd-audit-actor';
  if verified_header ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
   actor := verified_header::uuid;
  end if;
 end if;
 if tg_argv[0]='Dienstgrad' then actor:=coalesce((after_row->>'actor_id')::uuid,actor); end if;
 insert into public.mrpd_change_history(area,target,actor_id,fields,action)
 values(tg_argv[0],coalesce(after_row->>tg_argv[1],before_row->>tg_argv[1]),actor,fields,tg_op);
 return null;
end
$$;
commit;
