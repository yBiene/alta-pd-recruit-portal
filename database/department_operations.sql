begin;
create table public.mrpd_ops_records(
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('absence','application','transfer','promotion','promotion_rule','commendation','discipline','ia','vehicle','damage','inspection','uniform','equipment','checkout','replacement','report','person','bolo','impound','request','k9','flight','traffic','shift','renewal','skill')),
 unit_id uuid references public.portal_hub_departments(id) on delete restrict,
 title text not null check(char_length(btrim(title)) between 1 and 180),
 body text not null default '' check(char_length(body)<=100000),
 fields jsonb not null default '{}' check(jsonb_typeof(fields)='object' and octet_length(fields::text)<=100000),
 subject_id uuid,
 status text not null default 'draft' check(status in ('draft','submitted','reviewed','approved','rejected','active','closed')),
 author_id uuid not null default auth.uid(),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 revision integer not null default 0,
 applied_at timestamptz,
 archived boolean not null default false
);
create index mrpd_ops_recent on public.mrpd_ops_records(kind,unit_id,created_at desc,id desc);
create unique index mrpd_ops_checkout_unique on public.mrpd_ops_records((fields->>'asset_id')) where kind='checkout' and status='approved';
create unique index mrpd_ops_callsign_unique on public.mrpd_ops_records(lower(fields->>'callsign')) where kind='skill' and fields->>'category'='callsign' and status='active';
create unique index mrpd_ops_shift_unique on public.mrpd_ops_records(author_id) where kind='shift' and status='active';
create table public.mrpd_ops_events(
 id bigint generated always as identity primary key,
 record_id uuid not null references public.mrpd_ops_records(id) on delete cascade,
 actor_id uuid not null default auth.uid(),created_at timestamptz not null default now(),
 action text not null,body text not null default '' check(char_length(body)<=10000),internal boolean not null default false
);
create index mrpd_ops_events_record on public.mrpd_ops_events(record_id,id desc);
alter table public.mrpd_ops_records enable row level security;
alter table public.mrpd_ops_events enable row level security;
revoke all on public.mrpd_ops_records,public.mrpd_ops_events from anon,authenticated;
grant select on public.mrpd_ops_records,public.mrpd_ops_events to authenticated;
create function portal_private.ops_manager(p_unit uuid) returns boolean language sql stable security definer set search_path='' as $$
 select portal_private.hub_plus() or (p_unit is not null and portal_private.unit_manager(p_unit))
$$;
create function portal_private.ops_access(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select portal_private.hub_member() and exists(select 1 from public.mrpd_ops_records r where r.id=p_id and (
 portal_private.hub_plus() or r.author_id=auth.uid() or r.subject_id=auth.uid() or
 (r.kind not in ('ia','discipline') and (
  (r.unit_id is not null and (portal_private.unit_access(r.unit_id) or (r.kind in ('application','transfer') and portal_private.unit_manager(r.unit_id))))
  or (r.unit_id is null and r.kind in ('person','vehicle','uniform','equipment','bolo','impound','report','traffic','promotion_rule','skill') and (portal_private.hub_staff() or portal_private.hub_channel_access('officer')))
 ))))
$$;
create function portal_private.ops_edit(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select portal_private.hub_member() and exists(select 1 from public.mrpd_ops_records r where r.id=p_id and portal_private.ops_access(r.id) and (
 portal_private.hub_plus() or (r.kind not in ('ia','discipline') and portal_private.ops_manager(r.unit_id))
 or (r.author_id=auth.uid() and r.status in ('draft','active') and r.kind not in ('shift','vehicle','equipment','uniform','promotion_rule','skill','discipline'))))
$$;
revoke all on function portal_private.ops_access(uuid),portal_private.ops_manager(uuid),portal_private.ops_edit(uuid) from public,anon;
grant execute on function portal_private.ops_access(uuid),portal_private.ops_manager(uuid),portal_private.ops_edit(uuid) to authenticated;
create policy ops_read on public.mrpd_ops_records for select to authenticated using(portal_private.ops_access(id));
create policy ops_events_read on public.mrpd_ops_events for select to authenticated using(portal_private.ops_access(record_id) and (not internal or portal_private.hub_plus() or exists(select 1 from public.mrpd_ops_records r where r.id=record_id and r.kind not in ('ia','discipline') and portal_private.ops_manager(r.unit_id))));

create function portal_private.ops_prerequisites(p_user uuid,p_rank text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb:='[]';rule public.mrpd_ops_records; code text; passed boolean; since_at timestamptz; days_required integer;
begin
 if not portal_private.hub_member() then raise exception 'Bitte anmelden' using errcode='42501';end if;
 for rule in select * from public.mrpd_ops_records where kind='promotion_rule' and status='active' and not archived and fields->>'rank'=p_rank loop
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
revoke all on function portal_private.ops_prerequisites(uuid,text) from public,anon,authenticated;
create function portal_private.ops_command(p_action text,p_id uuid,p_revision integer,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.mrpd_ops_records; asset public.mrpd_ops_records; actor uuid:=auth.uid(); k text; u uuid; target uuid; f jsonb; title_value text; state_value text; manager boolean; changed jsonb; checks jsonb; memberships jsonb; actor_label text; qualifiers text;
begin
 if not portal_private.hub_member() then raise exception 'Bitte mit einem aktiven Account anmelden.' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Ungültige Eingaben';end if;
 if p_action='clock_in' then
  u:=nullif(p_data->>'unit_id','')::uuid;
  if u is not null and not portal_private.unit_access(u) then raise exception 'Kein Unit-Zugriff' using errcode='42501';end if;
  insert into public.mrpd_ops_records(kind,unit_id,title,status,fields) values('shift',u,'Dienstzeit','active',jsonb_build_object('started_at',now())) returning * into r;
  insert into public.mrpd_ops_events(record_id,action) values(r.id,'Dienst begonnen');return to_jsonb(r);
 end if;
 if p_id is not null then
  select * into r from public.mrpd_ops_records where id=p_id for update;
  if found then
   if not portal_private.ops_access(r.id) then raise exception 'Kein Zugriff auf diesen Vorgang.' using errcode='42501';end if;
   if p_revision is distinct from r.revision then raise exception 'Inzwischen geändert. Bitte den Vorgang erneut öffnen.' using errcode='40001';end if;
  elsif p_action<>'save' then raise exception 'Vorgang nicht gefunden.';end if;
 end if;
 if p_action='save' then
  if r.id is null and (p_revision is distinct from 0 or p_id is null) then raise exception 'Ungültiger neuer Vorgang.';end if;
  k:=coalesce(r.kind,p_data->>'kind');u:=case when r.id is not null then r.unit_id else nullif(p_data->>'unit_id','')::uuid end;
  if r.id is not null and not portal_private.ops_edit(r.id) then raise exception 'Dieser Vorgang ist zur Bearbeitung gesperrt.' using errcode='42501';end if;
  manager:=portal_private.ops_manager(u);
  if k in ('vehicle','uniform','equipment','promotion_rule','skill','discipline') and not manager then raise exception 'Dafür ist die Unit-Leitung oder Portalverwaltung zuständig.' using errcode='42501';end if;
  if k='discipline' and not portal_private.hub_plus() then raise exception 'Disziplinarvorgänge verwaltet die Portalverwaltung.' using errcode='42501';end if;
  if k='shift' then raise exception 'Dienstzeiten werden über Dienstbeginn und Dienstende erfasst.';end if;
  if u is not null and not portal_private.unit_access(u) and k not in ('application','transfer','ia') then raise exception 'Kein Unit-Zugriff' using errcode='42501';end if;
  f:=coalesce(p_data->'fields','{}');target:=nullif(p_data->>'subject_id','')::uuid;
  if target is not null and not exists(select 1 from public.profiles where id=target and account_enabled and archived_at is null) then raise exception 'Person nicht verfügbar';end if;
  title_value:=btrim(p_data->>'title');
  if k in ('absence','application','transfer') and not manager then target:=actor;end if;
  if k='absence' and (nullif(f->>'from','')::date is null or nullif(f->>'to','')::date is null or (f->>'to')::date<(f->>'from')::date) then raise exception 'Bitte einen gültigen Abwesenheitszeitraum wählen.';end if;
  if k='promotion_rule' and (nullif(f->>'days','')::integer<0 or portal_private.hub_rank(f->>'rank')<0) then raise exception 'Ungültige Beförderungsvoraussetzung';end if;
  if k='promotion' and (target is null or portal_private.hub_rank(f->>'rank')<0) then raise exception 'Person und Zieldienstgrad angeben.';end if;
  if k='checkout' then
   select * into asset from public.mrpd_ops_records where id=nullif(f->>'asset_id','')::uuid;
   if not found or asset.kind not in ('vehicle','equipment') or not portal_private.ops_access(asset.id) then raise exception 'Fahrzeug oder Ausrüstung auswählen.';end if;
  end if;
  if k='skill' and f->>'category'='callsign' and (btrim(coalesce(f->>'callsign',''))='' or target is null) then raise exception 'Rufname und Person erforderlich';end if;
  if f ? 'links' then
   if jsonb_typeof(f->'links')<>'array' or jsonb_array_length(f->'links')>30 then raise exception 'Ungültige Verknüpfungen';end if;
   if exists(select 1 from jsonb_array_elements_text(f->'links') v where not portal_private.ops_access(v::uuid)) then raise exception 'Eine Verknüpfung ist nicht zugänglich';end if;
  end if;
  if r.id is null then
   state_value:=case when k in ('vehicle','uniform','equipment','promotion_rule','skill','person','k9','flight','traffic','inspection','damage','bolo','impound') then 'active' else 'draft' end;
   insert into public.mrpd_ops_records(id,kind,unit_id,title,body,fields,subject_id,status) values(p_id,k,u,title_value,coalesce(p_data->>'body',''),f,target,state_value) returning * into r;
   insert into public.mrpd_ops_events(record_id,action) values(r.id,'Vorgang erstellt');
  else
   if r.applied_at is not null then raise exception 'Bereits übernommene Entscheidungen sind abgeschlossen.';end if;
   update public.mrpd_ops_records set title=title_value,body=coalesce(p_data->>'body',''),fields=f,subject_id=target,revision=revision+1,updated_at=now() where id=r.id returning * into r;
   insert into public.mrpd_ops_events(record_id,action) values(r.id,'Vorgang bearbeitet');
  end if;
 elsif p_action='comment' then
  if r.id is null then raise exception 'Vorgang fehlt';end if;
  if nullif(btrim(p_data->>'body'),'') is null then raise exception 'Bitte Text eingeben.';end if;
  if coalesce((p_data->>'internal')::boolean,false) and not (portal_private.hub_plus() or (r.kind not in ('ia','discipline') and portal_private.ops_manager(r.unit_id))) then raise exception 'Keine Berechtigung für interne Vermerke.' using errcode='42501';end if;
  insert into public.mrpd_ops_events(record_id,action,body,internal) values(r.id,'Rückmeldung',p_data->>'body',coalesce((p_data->>'internal')::boolean,false));
 elsif p_action='transition' then
  manager:=portal_private.ops_manager(r.unit_id) and (r.kind not in ('ia','discipline') or portal_private.hub_plus());
  state_value:=p_data->>'status';
  if r.applied_at is not null then raise exception 'Die Entscheidung wurde bereits übernommen.';end if;
  if state_value='submitted' then
   if r.status not in ('draft','rejected') or not(r.author_id=actor or manager) then raise exception 'Vorgang kann nicht eingereicht werden.';end if;
  elsif state_value in ('approved','rejected','reviewed') then
   if not manager then raise exception 'Keine Freigabeberechtigung' using errcode='42501';end if;
   if r.status not in ('submitted','reviewed') then raise exception 'Bitte zuerst einreichen.';end if;
   if state_value='approved' and r.kind in ('promotion','application','transfer','discipline','ia') and not portal_private.hub_plus() then state_value:='reviewed';end if;
   if state_value='approved' and r.kind='checkout' then
    select * into asset from public.mrpd_ops_records where id=(r.fields->>'asset_id')::uuid for update;
    if not found or not portal_private.ops_access(asset.id) or asset.archived or asset.status<>'active' or coalesce(asset.fields->>'availability','available')<>'available' then raise exception 'Dieses Fahrzeug oder Material ist nicht verfügbar.';end if;
   end if;
  elsif state_value='closed' then
   if r.kind='shift' then
    if r.author_id<>actor and not manager then raise exception 'Keine Berechtigung' using errcode='42501';end if;
    if r.status<>'active' then raise exception 'Dienstzeit bereits beendet';end if;
    update public.mrpd_ops_records set fields=fields||jsonb_build_object('ended_at',now(),'seconds',greatest(0,extract(epoch from now()-(fields->>'started_at')::timestamptz)::integer)) where id=r.id;
   elsif not(manager or (r.author_id=actor and r.kind in ('checkout','absence') and r.status in ('approved','submitted','active'))) then raise exception 'Keine Abschlussberechtigung' using errcode='42501';end if;
  else raise exception 'Statuswechsel ungültig';end if;
  update public.mrpd_ops_records set status=state_value,revision=revision+1,updated_at=now() where id=r.id returning * into r;
  insert into public.mrpd_ops_events(record_id,action,body) values(r.id,'Status · '||state_value,coalesce(p_data->>'body',''));
 elsif p_action='checks' then
  if r.kind<>'promotion' then raise exception 'Kein Beförderungsvorschlag';end if;
  return portal_private.ops_prerequisites(r.subject_id,r.fields->>'rank');
 elsif p_action='apply' then
  if not portal_private.hub_plus() then raise exception 'Die Portalverwaltung übernimmt Entscheidungen.' using errcode='42501';end if;
  if r.applied_at is not null then return to_jsonb(r);end if;
  if r.status<>'approved' or r.kind not in ('promotion','application','transfer') then raise exception 'Freigegebenen Vorgang auswählen.';end if;
  target:=coalesce(r.subject_id,r.author_id);
  if r.kind='promotion' then
   checks:=portal_private.ops_prerequisites(target,r.fields->>'rank');
   if exists(select 1 from jsonb_array_elements(checks) c where (c->>'passed')::boolean is not true) then raise exception 'Beförderungsvoraussetzungen sind noch offen.';end if;
   perform public.portal_hub_rpc('rank',jsonb_build_object('user_id',target,'rank',r.fields->>'rank','reason',r.title||E'\n'||r.body));
  else
   if r.unit_id is null then raise exception 'Ziel-Unit fehlt';end if;
   memberships:=public.mrpd_unit_command('memberships',jsonb_build_object('user_id',target));
   select coalesce(jsonb_agg(value),'[]') into changed from jsonb_array_elements(memberships->'units') where value->>'id'<>r.unit_id::text and (r.kind<>'transfer' or value->>'id'<>coalesce(r.fields->>'from_unit',''));
   changed:=changed||jsonb_build_array(jsonb_build_object('id',r.unit_id,'role','member'));
   perform public.mrpd_unit_command('memberships',jsonb_build_object('user_id',target,'version',memberships->>'version','units',changed));
  end if;
  update public.mrpd_ops_records set applied_at=now(),revision=revision+1,updated_at=now() where id=r.id returning * into r;
  insert into public.mrpd_ops_events(record_id,action) values(r.id,'Entscheidung übernommen');
 elsif p_action='archive' then
  if not portal_private.ops_edit(r.id) then raise exception 'Keine Bearbeitungsberechtigung' using errcode='42501';end if;
  if r.kind='checkout' and r.status='approved' or r.kind='shift' and r.status='active' then raise exception 'Bitte zuerst abschließen.';end if;
  update public.mrpd_ops_records set archived=not archived,revision=revision+1,updated_at=now() where id=r.id returning * into r;
  insert into public.mrpd_ops_events(record_id,action) values(r.id,case when r.archived then 'Archiviert' else 'Wiederhergestellt' end);
 else raise exception 'Unbekannte Aktion';end if;
 return to_jsonb(r);
exception when unique_violation then raise exception 'Dieser Rufname, die Ausgabe oder die aktive Dienstzeit ist bereits belegt.' using errcode='23505';
end
$$;
create function public.mrpd_ops_command(p_action text,p_id uuid default null,p_revision integer default 0,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$
 select portal_private.ops_command(p_action,p_id,p_revision,p_data)
$$;
revoke all on function public.mrpd_ops_command(text,uuid,integer,jsonb),portal_private.ops_command(text,uuid,integer,jsonb) from public,anon;
grant execute on function public.mrpd_ops_command(text,uuid,integer,jsonb),portal_private.ops_command(text,uuid,integer,jsonb) to authenticated;

create table public.mrpd_ops_alerts(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,key text not null,title text not null,body text not null,created_at timestamptz not null default now(),read_at timestamptz,unique(user_id,key));
alter table public.mrpd_ops_alerts enable row level security;
revoke all on public.mrpd_ops_alerts from anon,authenticated;
grant select on public.mrpd_ops_alerts to authenticated;
grant update(read_at) on public.mrpd_ops_alerts to authenticated;
create policy ops_alerts_own on public.mrpd_ops_alerts for select to authenticated using(user_id=auth.uid() and portal_private.hub_member());
create policy ops_alerts_read on public.mrpd_ops_alerts for update to authenticated using(user_id=auth.uid() and portal_private.hub_member()) with check(user_id=auth.uid() and portal_private.hub_member());
create function portal_private.ops_reminders() returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.mrpd_ops_alerts(user_id,key,title,body)
 select e.assigned_to,'qualification:'||e.id||':'||e.due_on||':'||case when e.due_on<current_date then 'expired' else 'soon' end,
 case when e.due_on<current_date then 'Qualifikation abgelaufen' else 'Qualifikation verlängern' end,e.title||' · gültig bis '||to_char(e.due_on,'DD.MM.YYYY')
 from public.mrpd_unit_entries e join public.profiles p on p.id=e.assigned_to
 where e.kind='qualification' and not e.archived and e.due_on<=current_date+14 and p.account_enabled and p.archived_at is null and p.created_at<=e.created_at
 on conflict(user_id,key) do nothing;
end
$$;
revoke all on function portal_private.ops_reminders() from public,anon,authenticated;
select cron.schedule('mrpd-ops-reminders','0 * * * *','select portal_private.ops_reminders()');
commit;
