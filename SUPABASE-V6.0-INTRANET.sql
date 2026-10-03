-- ALTA PD Intranet V6.0
create extension if not exists pgcrypto;

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('officer','recruit','fto','supervisor','command','admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Bestehende Accounts automatisch spiegeln
insert into public.user_roles(user_id,role)
select id, case when role='trainer' then 'fto' when role='admin' then 'admin' else 'recruit' end
from public.profiles on conflict do nothing;
insert into public.user_roles(user_id,role)
select id,'officer' from public.profiles where role in ('trainer','admin') on conflict do nothing;

create or replace function public.has_portal_role(wanted text, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.user_roles r where r.user_id=uid and r.role=wanted)
      or exists(select 1 from public.profiles p where p.id=uid and p.role='admin' and p.access_level='owner');
$$;
create or replace function public.is_portal_command(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select public.has_portal_role('command',uid) or public.has_portal_role('admin',uid);
$$;

create table if not exists public.duty_sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'Im Dienst', started_at timestamptz not null default now(), ended_at timestamptz,
 note text default '', created_at timestamptz not null default now()
);
create table if not exists public.pd_announcements (
 id uuid primary key default gen_random_uuid(), title text not null, body text not null, audience text not null default 'officer',
 important boolean not null default false, author_id uuid references public.profiles(id), author_name text, created_at timestamptz not null default now()
);
create table if not exists public.pd_announcement_reads (
 announcement_id uuid references public.pd_announcements(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade,
 read_at timestamptz not null default now(), primary key(announcement_id,user_id)
);
create table if not exists public.pd_tasks (
 id uuid primary key default gen_random_uuid(), assignee_id uuid references public.profiles(id) on delete cascade,
 title text not null, details text default '', status text not null default 'Offen', due_date date,
 created_by uuid references public.profiles(id), created_by_name text, created_at timestamptz not null default now()
);
create table if not exists public.pd_events (
 id uuid primary key default gen_random_uuid(), title text not null, details text default '', starts_at timestamptz not null,
 audience text not null default 'officer', created_by uuid references public.profiles(id), created_at timestamptz not null default now()
);
create table if not exists public.pd_units (
 id uuid primary key default gen_random_uuid(), callsign text not null, unit_type text not null default 'Streife',
 status text not null default 'Verfügbar', members text default '', vehicle text default '', updated_by uuid references public.profiles(id), updated_at timestamptz not null default now()
);
create table if not exists public.pd_vehicles (
 id uuid primary key default gen_random_uuid(), callsign text not null, model text default '', plate text default '',
 status text not null default 'Verfügbar', assigned_to text default '', damage_note text default '', updated_at timestamptz not null default now()
);
create table if not exists public.pd_reports (
 id uuid primary key default gen_random_uuid(), report_no bigint generated always as identity, report_type text not null,
 title text not null, body text not null, status text not null default 'Entwurf', author_id uuid not null references public.profiles(id),
 author_name text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.pd_cases (
 id uuid primary key default gen_random_uuid(), case_no bigint generated always as identity, subject text not null,
 suspect_name text default '', cell_no text default '', arrest_at timestamptz, intake_at timestamptz, release_at timestamptz,
 incident_lead_id uuid references public.profiles(id), incident_lead_name text, allegations text default '', narrative text default '',
 status text not null default 'In Bearbeitung', created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.pd_case_participants (
 case_id uuid references public.pd_cases(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade,
 name text not null, added_at timestamptz not null default now(), primary key(case_id,user_id)
);
create table if not exists public.pd_case_evidence (
 id uuid primary key default gen_random_uuid(), case_id uuid not null references public.pd_cases(id) on delete cascade,
 evidence_type text not null default 'Foto', description text default '', file_path text default '', external_url text default '',
 uploaded_by uuid not null references public.profiles(id), uploaded_by_name text, created_at timestamptz not null default now()
);
create table if not exists public.pd_case_timeline (
 id bigint generated always as identity primary key, case_id uuid not null references public.pd_cases(id) on delete cascade,
 actor_id uuid references public.profiles(id), actor_name text, action text not null, created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;
alter table public.duty_sessions enable row level security;
alter table public.pd_announcements enable row level security;
alter table public.pd_announcement_reads enable row level security;
alter table public.pd_tasks enable row level security;
alter table public.pd_events enable row level security;
alter table public.pd_units enable row level security;
alter table public.pd_vehicles enable row level security;
alter table public.pd_reports enable row level security;
alter table public.pd_cases enable row level security;
alter table public.pd_case_participants enable row level security;
alter table public.pd_case_evidence enable row level security;
alter table public.pd_case_timeline enable row level security;

do $$ declare t text; begin
 foreach t in array array['user_roles','duty_sessions','pd_announcements','pd_announcement_reads','pd_tasks','pd_events','pd_units','pd_vehicles','pd_reports','pd_cases','pd_case_participants','pd_case_evidence','pd_case_timeline'] loop
  execute format('drop policy if exists v6_select on public.%I',t);
  execute format('create policy v6_select on public.%I for select to authenticated using (public.has_portal_role(''officer'') or public.has_portal_role(''recruit'') or public.has_portal_role(''fto'') or public.is_portal_command())',t);
 end loop;
end $$;


-- Officer dürfen das interne Mitarbeiterverzeichnis lesen.
drop policy if exists v6_officer_profiles_select on public.profiles;
create policy v6_officer_profiles_select on public.profiles for select to authenticated using (public.has_portal_role('officer') or public.is_portal_command() or id=auth.uid());

-- Rollen: jeder sieht, Command verwaltet.
drop policy if exists v6_roles_manage on public.user_roles;
create policy v6_roles_manage on public.user_roles for all to authenticated using (public.is_portal_command()) with check (public.is_portal_command());

-- Eigene Dienstzeit; Command darf alles verwalten.
drop policy if exists v6_duty_write on public.duty_sessions;
create policy v6_duty_write on public.duty_sessions for all to authenticated using (user_id=auth.uid() or public.is_portal_command()) with check (user_id=auth.uid() or public.is_portal_command());

-- Ankündigungen / Termine: Command schreibt.
drop policy if exists v6_ann_write on public.pd_announcements;
create policy v6_ann_write on public.pd_announcements for all to authenticated using (public.is_portal_command()) with check (public.is_portal_command());
drop policy if exists v6_reads_write on public.pd_announcement_reads;
create policy v6_reads_write on public.pd_announcement_reads for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists v6_events_write on public.pd_events;
create policy v6_events_write on public.pd_events for all to authenticated using (public.is_portal_command()) with check (public.is_portal_command());

-- Aufgaben: eigene bearbeiten, Command erstellt/verwaltet.
drop policy if exists v6_tasks_write on public.pd_tasks;
create policy v6_tasks_write on public.pd_tasks for all to authenticated using (assignee_id=auth.uid() or public.is_portal_command()) with check (assignee_id=auth.uid() or public.is_portal_command());

-- Dienstmodule: Officer+.
do $$ declare t text; begin
 foreach t in array array['pd_units','pd_vehicles','pd_reports','pd_cases','pd_case_participants','pd_case_evidence','pd_case_timeline'] loop
  execute format('drop policy if exists v6_officer_write on public.%I',t);
  execute format('create policy v6_officer_write on public.%I for all to authenticated using (public.has_portal_role(''officer'') or public.is_portal_command()) with check (public.has_portal_role(''officer'') or public.is_portal_command())',t);
 end loop;
end $$;

-- Beweisfoto-Bucket
insert into storage.buckets(id,name,public) values('case-evidence','case-evidence',false) on conflict(id) do nothing;
drop policy if exists v6_evidence_select on storage.objects;
create policy v6_evidence_select on storage.objects for select to authenticated using (bucket_id='case-evidence' and (public.has_portal_role('officer') or public.is_portal_command()));
drop policy if exists v6_evidence_insert on storage.objects;
create policy v6_evidence_insert on storage.objects for insert to authenticated with check (bucket_id='case-evidence' and (public.has_portal_role('officer') or public.is_portal_command()));

-- Owner kann Rollen bequem setzen.
create or replace function public.owner_set_user_roles(target_id uuid, new_roles text[])
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_portal_command(auth.uid()) then raise exception 'Keine Berechtigung'; end if;
 delete from public.user_roles where user_id=target_id;
 insert into public.user_roles(user_id,role)
 select target_id,x from unnest(new_roles) x where x in ('officer','recruit','fto','supervisor','command','admin') on conflict do nothing;
end $$;
grant execute on function public.owner_set_user_roles(uuid,text[]) to authenticated;
