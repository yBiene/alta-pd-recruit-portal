begin;
create or replace function portal_private.ops_command(p_action text,p_id uuid,p_revision integer,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
 if p_action<>'save' and r.id is null then raise exception 'Vorgang fehlt';end if;
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
  if k in ('application','transfer') and u is null then raise exception 'Ziel-Unit wählen.';end if;
  if nullif(f->>'unit_case','') is not null and not exists(select 1 from public.mrpd_unit_entries e where e.id=(f->>'unit_case')::uuid and e.kind='case' and portal_private.unit_access(e.unit_id)) then raise exception 'Unit-Akte nicht verfügbar.';end if;
  if nullif(f->>'evidence_id','') is not null and (not public.apd_evidence_member() or not exists(select 1 from public.apd_evidence_cases e where e.id=(f->>'evidence_id')::uuid)) then raise exception 'Zellenakte nicht verfügbar.';end if;
  if nullif(f->>'asset_id','') is not null and not portal_private.ops_access((f->>'asset_id')::uuid) then raise exception 'Verknüpfter Gegenstand nicht verfügbar.';end if;
  if k in ('damage','inspection') and (nullif(f->>'asset_id','') is null or not exists(select 1 from public.mrpd_ops_records a where a.id=(f->>'asset_id')::uuid and a.kind='vehicle')) then raise exception 'Fahrzeug auswählen.';end if;
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
    if not found or not portal_private.ops_manager(asset.unit_id) then raise exception 'Die zuständige Material- oder Fahrzeugleitung muss die Ausgabe freigeben.' using errcode='42501';end if;
    if not portal_private.ops_access(asset.id) or asset.archived or asset.status<>'active' or coalesce(asset.fields->>'availability','available')<>'available' then raise exception 'Dieses Fahrzeug oder Material ist nicht verfügbar.';end if;
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
   if portal_private.hub_rank(r.fields->>'rank')<=(select portal_private.hub_rank(rank) from public.profiles where id=target) then raise exception 'Der Zieldienstgrad muss über dem aktuellen Dienstgrad liegen.';end if;
   checks:=portal_private.ops_prerequisites(target,r.fields->>'rank');
   if exists(select 1 from jsonb_array_elements(checks) c where (c->>'passed')::boolean is not true) then raise exception 'Beförderungsvoraussetzungen sind noch offen.';end if;
   perform public.portal_hub_rpc('rank',jsonb_build_object('user_id',target,'rank',r.fields->>'rank','reason',left(r.title||E'\n'||r.body,500)));
  else
   if r.unit_id is null then raise exception 'Ziel-Unit fehlt';end if;
   memberships:=public.mrpd_unit_command('memberships',jsonb_build_object('user_id',target));
   select coalesce(jsonb_agg(value),'[]') into changed from jsonb_array_elements(memberships->'units') where value->>'id'<>r.unit_id::text and (r.kind<>'transfer' or value->>'id'<>coalesce(r.fields->>'from_unit',''));
   changed:=changed||coalesce((select jsonb_agg(value) from jsonb_array_elements(memberships->'units') where value->>'id'=r.unit_id::text),jsonb_build_array(jsonb_build_object('id',r.unit_id,'role','member')));
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

-- Private personnel requests stay with their author, subject and decision makers.
create or replace function portal_private.ops_access(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select portal_private.hub_member() and exists(select 1 from public.mrpd_ops_records r where r.id=p_id and (
 portal_private.hub_plus() or r.author_id=auth.uid() or r.subject_id=auth.uid() or
 (r.kind not in ('ia','discipline') and (
  (r.unit_id is not null and (portal_private.ops_manager(r.unit_id) or (portal_private.unit_access(r.unit_id) and (r.kind not in ('application','transfer','promotion','absence','renewal','replacement','request') or (r.kind='absence' and r.status='approved')))))
  or (r.unit_id is null and r.kind in ('person','vehicle','uniform','equipment','bolo','impound','report','traffic','promotion_rule','skill') and (portal_private.hub_staff() or portal_private.hub_channel_access('officer')))
 ))))
$$;

insert into public.portal_hub_departments(name,description,color,workspace_kind) select 'K9 Unit','Diensthunde, Trainingsstand und Einsatzdokumentation.','#b99b69','custom' where not exists(select 1 from public.portal_hub_departments where name ilike '%k9%');
insert into public.portal_hub_departments(name,description,color,workspace_kind) select 'Air Support Unit','Flugprotokolle, Besatzungen und technische Meldungen.','#75b7ce','custom' where not exists(select 1 from public.portal_hub_departments where name ilike '%air%' or name ilike '%luft%');
commit;
