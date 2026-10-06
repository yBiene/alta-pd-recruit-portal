-- ALTA PD V6.1.6 – manuelle Ausbildungsphasen-Freigabe
alter table public.profiles
  add column if not exists unlocked_phase integer not null default 1
  check (unlocked_phase between 1 and 4);

create or replace function public.staff_set_recruit_phase(target_id uuid, new_phase integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  caller_access text;
begin
  select role, access_level into caller_role, caller_access
  from public.profiles where id = auth.uid();

  if caller_role not in ('admin','trainer') then
    raise exception 'Keine Berechtigung';
  end if;

  if new_phase < 1 or new_phase > 4 then
    raise exception 'Ungültige Phase';
  end if;

  update public.profiles
  set unlocked_phase = greatest(coalesce(unlocked_phase,1), new_phase)
  where id = target_id and role = 'recruit';

  if not found then raise exception 'Recruit nicht gefunden'; end if;
end;
$$;

revoke all on function public.staff_set_recruit_phase(uuid,integer) from public;
grant execute on function public.staff_set_recruit_phase(uuid,integer) to authenticated;
