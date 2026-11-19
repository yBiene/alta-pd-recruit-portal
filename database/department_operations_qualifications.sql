begin;
-- Unit-specific promotion rules apply to their own members.
create or replace function portal_private.ops_prerequisites(p_user uuid,p_rank text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb:='[]';rule public.mrpd_ops_records; code text; passed boolean; since_at timestamptz; days_required integer;
begin
 if not portal_private.hub_member() then raise exception 'Bitte anmelden' using errcode='42501';end if;
 for rule in select * from public.mrpd_ops_records where kind='promotion_rule' and status='active' and not archived and fields->>'rank'=p_rank and (unit_id is null or exists(select 1 from public.portal_hub_memberships m where m.department_id=mrpd_ops_records.unit_id and m.user_id=p_user)) loop
  days_required:=coalesce(nullif(rule.fields->>'days','')::integer,0);
  select coalesce((select max(created_at) from public.portal_hub_rank_changes where user_id=p_user),created_at) into since_at from public.profiles where id=p_user;
  if days_required>0 then result:=result||jsonb_build_array(jsonb_build_object('title',days_required||' Tage im aktuellen Dienstgrad','passed',now()-since_at>=make_interval(days=>days_required)));end if;
  for code in select btrim(value) from regexp_split_to_table(coalesce(rule.fields->>'qualifications',''),E'[,\n]') value where btrim(value)<>'' loop
   select exists(select 1 from public.mrpd_unit_entries where kind='qualification' and assigned_to=p_user and not archived and lower(title)=lower(code) and (due_on is null or due_on>=(now() at time zone 'Europe/Berlin')::date)) into passed;
   result:=result||jsonb_build_array(jsonb_build_object('title',code,'passed',passed));
  end loop;
 end loop;
 return result;
end
$$;

create or replace function portal_private.ops_reminders() returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.mrpd_ops_alerts(user_id,key,title,body)
 select e.assigned_to,'qualification:'||e.id||':'||e.due_on||':'||case when e.due_on<(now() at time zone 'Europe/Berlin')::date then 'expired' else 'soon' end,
 case when e.due_on<(now() at time zone 'Europe/Berlin')::date then 'Qualifikation abgelaufen' else 'Qualifikation verlängern' end,e.title||' · gültig bis '||to_char(e.due_on,'DD.MM.YYYY')
 from public.mrpd_unit_entries e join public.profiles p on p.id=e.assigned_to
 where e.kind='qualification' and not e.archived and e.due_on<=(now() at time zone 'Europe/Berlin')::date+14 and p.account_enabled and p.archived_at is null and p.created_at<=e.created_at
 on conflict(user_id,key) do nothing;
end
$$;

commit;
