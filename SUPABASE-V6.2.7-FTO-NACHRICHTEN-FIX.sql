-- ALTA PD V6.2.7 – FTO Nachrichten FIX
alter table public.profiles add column if not exists leader_fto_id uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists secondary_fto_id uuid references public.profiles(id) on delete set null;

update public.profiles r set leader_fto_id=f.id from public.profiles f
where r.role='recruit' and r.leader_fto_id is null and f.role in ('admin','trainer')
and lower(trim(coalesce(r.fto,''))) in (lower(trim(coalesce(f.name,''))),lower(trim(coalesce(f.username,''))),lower(trim(coalesce(f.rank,'')||' '||coalesce(f.name,''))));

update public.profiles r set secondary_fto_id=f.id from public.profiles f
where r.role='recruit' and r.secondary_fto_id is null and f.role in ('admin','trainer')
and lower(trim(coalesce(r.secondary_fto,''))) in (lower(trim(coalesce(f.name,''))),lower(trim(coalesce(f.username,''))),lower(trim(coalesce(f.rank,'')||' '||coalesce(f.name,''))));

drop function if exists public.staff_update_fto_assignments(uuid,uuid,uuid);
create or replace function public.staff_update_fto_assignments(target_id uuid,new_leader_fto_id uuid,new_secondary_fto_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare caller_role text; caller_access text;
begin
 select role,access_level into caller_role,caller_access from public.profiles where id=auth.uid();
 if not (caller_role='admin' or (caller_role='trainer' and caller_access='extra')) then raise exception 'Keine Berechtigung'; end if;
 if new_leader_fto_id is not null and not exists(select 1 from public.profiles where id=new_leader_fto_id and role in ('admin','trainer')) then raise exception 'Leiter FTO ungültig'; end if;
 if new_secondary_fto_id is not null and not exists(select 1 from public.profiles where id=new_secondary_fto_id and role in ('admin','trainer')) then raise exception 'Weiterer FTO ungültig'; end if;
 if new_leader_fto_id is not null and new_leader_fto_id=new_secondary_fto_id then raise exception 'FTOs dürfen nicht identisch sein'; end if;
 update public.profiles set leader_fto_id=new_leader_fto_id,secondary_fto_id=new_secondary_fto_id where id=target_id and role='recruit';
 if not found then raise exception 'Recruit nicht gefunden'; end if;
end $$;
revoke all on function public.staff_update_fto_assignments(uuid,uuid,uuid) from public;
grant execute on function public.staff_update_fto_assignments(uuid,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
select name,fto,secondary_fto,leader_fto_id,secondary_fto_id from public.profiles where role='recruit' order by name;
