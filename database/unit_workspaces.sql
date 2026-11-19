begin;

alter table public.portal_hub_departments add column workspace_kind text not null default 'custom'
 check (workspace_kind in ('general','patrol','swat','cid','sheriff','fto','custom'));
create unique index mrpd_default_unit_kind on public.portal_hub_departments(workspace_kind) where workspace_kind<>'custom';
update public.portal_hub_departments set workspace_kind='patrol' where id=(select id from public.portal_hub_departments where lower(name) in ('patrol division','patrol unit') order by name limit 1);
update public.portal_hub_departments set workspace_kind='cid' where id=(select id from public.portal_hub_departments where lower(name) in ('criminal investigation division','cid','detectives') order by name limit 1);
update public.portal_hub_departments set workspace_kind='fto' where id=(select id from public.portal_hub_departments where lower(name) in ('field training office','fto') order by name limit 1);
insert into public.portal_hub_departments(name,description,color,workspace_kind)
select name,description,color,kind from (values
 ('Allgemeiner Dienst','Gemeinsame Informationen und Aufgaben des Departments.','#6c91b3','general'),
 ('Patrol Unit','Streifendienst, Aufträge und Schichtübergaben.','#579bd2','patrol'),
 ('SWAT','Teamorganisation, Training und Qualifikationen.','#78998a','swat'),
 ('Detectives / CID','Fälle, Ermittlungsaufträge und Dokumentation.','#b08dca','cid'),
 ('Sheriff’s Department','Dienstorganisation, Zuständigkeiten und Übergaben.','#c8a35d','sheriff'),
 ('FTO','Ausbildungsorganisation und Zusammenarbeit der Ausbilder.','#5baaa8','fto')
) as defaults(name,description,color,kind)
where not exists(select 1 from public.portal_hub_departments where workspace_kind=kind);

alter table public.portal_hub_memberships add column unit_role text not null default 'member'
 check(unit_role in ('member','instructor','deputy','lead'));
update public.portal_hub_memberships set unit_role=case when lower(position) like '%stellvertret%' then 'deputy' when lower(position) in ('leitung','unit-leitung','leiter') then 'lead' when lower(position) like '%ausbilder%' then 'instructor' else 'member' end;

create function portal_private.unit_access(p_unit uuid) returns boolean language sql stable security definer set search_path='' as $$
 select portal_private.hub_member() and exists(select 1 from public.portal_hub_departments d where d.id=p_unit and (
 portal_private.hub_plus() or exists(select 1 from public.portal_hub_memberships m where m.department_id=d.id and m.user_id=auth.uid())
 or (d.workspace_kind='general' and (portal_private.hub_staff() or portal_private.hub_channel_access('officer')))))
$$;
create function portal_private.unit_manager(p_unit uuid) returns boolean language sql stable security definer set search_path='' as $$
 select portal_private.hub_member() and (portal_private.hub_plus() or exists(select 1 from public.portal_hub_memberships m where m.department_id=p_unit and m.user_id=auth.uid() and m.unit_role in ('lead','deputy')))
$$;
create function portal_private.unit_person(p_unit uuid,p_person uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.portal_hub_departments d on d.id=p_unit
 where p.id=p_person and p.account_enabled and p.archived_at is null and p.status<>'Archiviert' and (
 exists(select 1 from public.portal_hub_memberships m where m.department_id=p_unit and m.user_id=p_person)
 or (d.workspace_kind='general' and (p.role in ('admin','trainer') or portal_private.hub_rank(p.rank)>=1))))
$$;
revoke all on function portal_private.unit_access(uuid),portal_private.unit_manager(uuid),portal_private.unit_person(uuid,uuid) from public,anon;
grant execute on function portal_private.unit_access(uuid),portal_private.unit_manager(uuid),portal_private.unit_person(uuid,uuid) to authenticated;

create table public.mrpd_unit_entries (
 id uuid primary key default gen_random_uuid(),
 unit_id uuid not null references public.portal_hub_departments(id) on delete cascade,
 kind text not null check(kind in ('task','case','document','training','qualification','notice')),
 title text not null check(char_length(btrim(title)) between 1 and 160),
 body text not null default '' check(char_length(body)<=100000),
 status text not null default 'open' check(status in ('open','progress','done')),
 assigned_to uuid,
 due_on date,
 starts_at timestamptz,
 location text not null default '' check(char_length(location)<=200),
 capacity integer check(capacity between 1 and 500),
 archived boolean not null default false,
 author_id uuid default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 revision integer not null default 0,
 legacy_handover_id uuid unique references public.mrpd_shift_handover(id) on delete set null,
 check(kind<>'training' or starts_at is not null),
 check(kind<>'qualification' or assigned_to is not null)
);
create index mrpd_unit_entries_recent on public.mrpd_unit_entries(unit_id,kind,created_at desc,id desc);
create table public.mrpd_unit_comments (
 id uuid primary key default gen_random_uuid(),
 entry_id uuid not null references public.mrpd_unit_entries(id) on delete cascade,
 body text not null check(char_length(btrim(body)) between 1 and 8000),
 author_id uuid not null default auth.uid(),
 created_at timestamptz not null default now()
);
create index mrpd_unit_comments_entry on public.mrpd_unit_comments(entry_id,created_at,id);
create table public.mrpd_unit_messages (
 id uuid primary key default gen_random_uuid(),
 unit_id uuid not null references public.portal_hub_departments(id) on delete cascade,
 body text not null check(char_length(btrim(body)) between 1 and 8000),
 author_id uuid not null default auth.uid(),
 created_at timestamptz not null default now()
);
create index mrpd_unit_messages_recent on public.mrpd_unit_messages(unit_id,created_at desc,id desc);
create table public.mrpd_unit_attendance (
 entry_id uuid not null references public.mrpd_unit_entries(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 accepted boolean not null,
 primary key(entry_id,user_id)
);
alter table public.mrpd_unit_entries enable row level security;
alter table public.mrpd_unit_comments enable row level security;
alter table public.mrpd_unit_messages enable row level security;
alter table public.mrpd_unit_attendance enable row level security;
revoke all on public.mrpd_unit_entries,public.mrpd_unit_comments,public.mrpd_unit_messages,public.mrpd_unit_attendance from anon,authenticated;
grant select on public.mrpd_unit_entries,public.mrpd_unit_comments,public.mrpd_unit_messages,public.mrpd_unit_attendance to authenticated;
grant insert(unit_id,kind,title,body,status,assigned_to,due_on,starts_at,location,capacity) on public.mrpd_unit_entries to authenticated;
grant update(title,body,status,assigned_to,due_on,starts_at,location,capacity,archived,revision) on public.mrpd_unit_entries to authenticated;
grant insert(entry_id,body) on public.mrpd_unit_comments to authenticated;
grant insert(unit_id,body) on public.mrpd_unit_messages to authenticated;
grant delete on public.mrpd_unit_messages to authenticated;
create policy unit_entries_read on public.mrpd_unit_entries for select to authenticated using(portal_private.unit_access(unit_id));
create policy unit_entries_insert on public.mrpd_unit_entries for insert to authenticated with check (
 portal_private.unit_access(unit_id) and author_id=auth.uid() and (portal_private.unit_manager(unit_id) or kind in ('task','case'))
 and (assigned_to is null or portal_private.unit_person(unit_id,assigned_to)));
create policy unit_entries_update on public.mrpd_unit_entries for update to authenticated
 using(portal_private.unit_access(unit_id) and (portal_private.unit_manager(unit_id) or (author_id=auth.uid() and kind in ('task','case'))))
 with check(portal_private.unit_access(unit_id) and (portal_private.unit_manager(unit_id) or (author_id=auth.uid() and kind in ('task','case')))
 and (assigned_to is null or portal_private.unit_person(unit_id,assigned_to)));
create policy unit_comments_read on public.mrpd_unit_comments for select to authenticated using(exists(select 1 from public.mrpd_unit_entries e where e.id=entry_id));
create policy unit_comments_add on public.mrpd_unit_comments for insert to authenticated with check(author_id=auth.uid() and exists(select 1 from public.mrpd_unit_entries e where e.id=entry_id and not e.archived));
create policy unit_messages_read on public.mrpd_unit_messages for select to authenticated using(portal_private.unit_access(unit_id));
create policy unit_messages_add on public.mrpd_unit_messages for insert to authenticated with check(portal_private.unit_access(unit_id) and author_id=auth.uid());
create policy unit_messages_remove on public.mrpd_unit_messages for delete to authenticated using(portal_private.unit_access(unit_id) and (author_id=auth.uid() or portal_private.unit_manager(unit_id)));
create policy unit_attendance_read on public.mrpd_unit_attendance for select to authenticated using(exists(select 1 from public.mrpd_unit_entries e where e.id=entry_id));

-- Previous handovers keep their identity and content in the new workspace.
insert into public.mrpd_unit_entries(id,unit_id,kind,title,body,status,author_id,created_at,legacy_handover_id)
select s.id,d.id,'task',s.title,'Zuständige Unit: '||s.unit||E'\n\n'||s.next_action,case when s.resolved then 'done' else 'open' end,s.author_id,s.created_at,s.id
from public.mrpd_shift_handover s cross join public.portal_hub_departments d where d.workspace_kind='patrol';
revoke insert,update,delete on public.mrpd_shift_handover from authenticated;
revoke insert(title,unit,next_action),update(title,unit,next_action,resolved) on public.mrpd_shift_handover from authenticated;
drop policy shift_read on public.mrpd_shift_handover;
create policy shift_read on public.mrpd_shift_handover for select to authenticated using(exists(select 1 from public.mrpd_unit_entries e where e.legacy_handover_id=mrpd_shift_handover.id));

create function portal_private.unit_entry_stamp() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then new.author_id:=auth.uid();new.created_at:=now();new.revision:=0;
 else
  if new.unit_id<>old.unit_id or new.kind<>old.kind or new.author_id is distinct from old.author_id then raise exception 'Unit und Eintragstyp sind fest.'; end if;
  if new.revision<>old.revision+1 then raise exception 'Inzwischen geändert. Bitte den Eintrag neu öffnen.'; end if;
 end if;
 if new.kind='training' and new.capacity is not null and new.capacity<(select count(*) from public.mrpd_unit_attendance a where a.entry_id=new.id and a.accepted) then raise exception 'Die Platzanzahl liegt unter der Zahl der Zusagen.';end if;
 new.updated_at:=now();return new;
end
$$;
create trigger mrpd_unit_entry_stamp before insert or update on public.mrpd_unit_entries for each row execute function portal_private.unit_entry_stamp();
create function portal_private.unit_message_stamp() returns trigger language plpgsql set search_path='' as $$
begin new.author_id:=auth.uid();new.created_at:=now();return new;end
$$;
create trigger mrpd_unit_chat_stamp before insert on public.mrpd_unit_messages for each row execute function portal_private.unit_message_stamp();
create trigger mrpd_unit_comment_stamp before insert on public.mrpd_unit_comments for each row execute function portal_private.unit_message_stamp();

create function portal_private.unit_membership_hash(p_user uuid) returns text language sql stable security definer set search_path='' as $$
 select md5(coalesce(string_agg(department_id::text||':'||unit_role||':'||position,',' order by department_id),'')) from public.portal_hub_memberships where user_id=p_user
$$;
revoke all on function portal_private.unit_membership_hash(uuid) from public,anon,authenticated;

create function portal_private.unit_command(p_action text,p_args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target uuid; unit uuid; entry public.mrpd_unit_entries; member jsonb; selected uuid[]:='{}'; role_name text; answer boolean; count_yes integer; previous boolean; next_state text;
begin
 if not portal_private.hub_member() then raise exception 'Bitte erneut anmelden.' using errcode='42501';end if;
 if p_action='memberships' then
  target:=(p_args->>'user_id')::uuid;
  if target<>actor and not portal_private.hub_plus() then raise exception 'Nur Ausbilder + können Zuordnungen bearbeiten.' using errcode='42501';end if;
  if p_args ? 'units' then
   if not portal_private.hub_plus() then raise exception 'Nur Ausbilder + können Units zuweisen.' using errcode='42501';end if;
   perform 1 from public.profiles where id=target and account_enabled and archived_at is null and status<>'Archiviert' for update;
   if not found then raise exception 'Aktiven Account auswählen.';end if;
   if portal_private.unit_membership_hash(target) is distinct from p_args->>'version' then raise exception 'Zuordnungen wurden inzwischen geändert. Bitte erneut öffnen.';end if;
   if jsonb_typeof(p_args->'units')<>'array' or jsonb_array_length(p_args->'units')>50 then raise exception 'Ungültige Unit-Auswahl.';end if;
   for member in select * from jsonb_array_elements(p_args->'units') loop
    unit:=(member->>'id')::uuid;role_name:=member->>'role';
    if role_name not in ('member','instructor','deputy','lead') or role_name is null or unit=any(selected) or not exists(select 1 from public.portal_hub_departments where id=unit and workspace_kind<>'general') then raise exception 'Unit oder Funktion ungültig.';end if;
    selected:=array_append(selected,unit);
    insert into public.portal_hub_memberships(department_id,user_id,unit_role,position)
    values(unit,target,role_name,case role_name when 'lead' then 'Leitung' when 'deputy' then 'Stellvertretende Leitung' when 'instructor' then 'Ausbilder' else 'Mitglied' end)
    on conflict(department_id,user_id) do update set unit_role=excluded.unit_role,position=excluded.position;
   end loop;
   delete from public.portal_hub_memberships where user_id=target and not(department_id=any(selected));
  end if;
  return jsonb_build_object('version',portal_private.unit_membership_hash(target),'units',coalesce((select jsonb_agg(jsonb_build_object('id',department_id,'role',unit_role)) from public.portal_hub_memberships where user_id=target),'[]'::jsonb));
 elsif p_action='attendance' then
  select * into entry from public.mrpd_unit_entries where id=(p_args->>'entry_id')::uuid for update;
  if not found or entry.kind<>'training' or entry.archived or not portal_private.unit_access(entry.unit_id) then raise exception 'Training nicht verfügbar.' using errcode='42501';end if;
  if p_args ? 'accepted' then
   if entry.starts_at<=now() then raise exception 'Das Training hat bereits begonnen.';end if;
   answer:=(p_args->>'accepted')::boolean;
   if answer is null then raise exception 'Bitte zu- oder absagen.';end if;
   select accepted into previous from public.mrpd_unit_attendance where entry_id=entry.id and user_id=actor;
   select count(*) into count_yes from public.mrpd_unit_attendance where entry_id=entry.id and accepted;
   if answer and previous is distinct from true and entry.capacity is not null and count_yes>=entry.capacity then raise exception 'Alle Plätze sind belegt.';end if;
   insert into public.mrpd_unit_attendance values(entry.id,actor,answer) on conflict(entry_id,user_id) do update set accepted=excluded.accepted;
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id',user_id,'accepted',accepted)) from public.mrpd_unit_attendance where entry_id=entry.id),'[]'::jsonb);
 elsif p_action='status' then
  select * into entry from public.mrpd_unit_entries where id=(p_args->>'entry_id')::uuid for update;
  if not found or entry.archived or entry.kind not in ('task','case') or not portal_private.unit_access(entry.unit_id) or not(portal_private.unit_manager(entry.unit_id) or entry.author_id=actor or entry.assigned_to=actor) then raise exception 'Keine Bearbeitungsberechtigung.' using errcode='42501';end if;
  if entry.revision is distinct from (p_args->>'revision')::integer then raise exception 'Inzwischen geändert. Bitte neu öffnen.';end if;
  next_state:=p_args->>'status';
  if next_state is null or next_state not in ('open','progress','done') then raise exception 'Status ungültig.';end if;
  update public.mrpd_unit_entries set status=next_state,revision=revision+1 where id=entry.id returning * into entry;
  return to_jsonb(entry);
 else raise exception 'Unbekannte Unit-Aktion.';end if;
end
$$;
create function public.mrpd_unit_command(p_action text,p_args jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$
 select portal_private.unit_command(p_action,p_args)
$$;
revoke all on function public.mrpd_unit_command(text,jsonb),portal_private.unit_command(text,jsonb) from public,anon;
grant execute on function public.mrpd_unit_command(text,jsonb),portal_private.unit_command(text,jsonb) to authenticated;
revoke all on function portal_private.unit_entry_stamp(),portal_private.unit_message_stamp() from public,anon,authenticated;

create trigger mrpd_log_unit_assignments after insert or update or delete on public.portal_hub_memberships
 for each row execute function portal_private.mrpd_track_change('Unit-Zuordnung','user_id','department_id,unit_role,position');
create trigger mrpd_log_unit_settings after insert or update or delete on public.portal_hub_departments
 for each row execute function portal_private.mrpd_track_change('Units','id','name,description,color');
commit;
