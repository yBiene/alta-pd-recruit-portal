-- ALTA PD Portal V5.4
-- Praxisbewertung, Beobachtungspunkte, FTO-Uebergabe und Academy-Abschluss
-- Sicher erneut ausfuehrbar.

create table if not exists public.academy_practice_evaluations (
 id uuid primary key default gen_random_uuid(),
 recruit_id uuid not null references public.profiles(id) on delete cascade,
 evaluation_date date not null default current_date,
 author_id uuid references public.profiles(id) on delete set null,
 author_name text default '',
 radio smallint not null check (radio between 1 and 5),
 safety smallint not null check (safety between 1 and 5),
 driving smallint not null check (driving between 1 and 5),
 contact smallint not null check (contact between 1 and 5),
 law smallint not null check (law between 1 and 5),
 conduct smallint not null check (conduct between 1 and 5),
 independent smallint not null check (independent between 1 and 5),
 comment text default '',
 created_at timestamptz not null default now()
);
create table if not exists public.academy_observation_points (
 id uuid primary key default gen_random_uuid(),
 recruit_id uuid not null references public.profiles(id) on delete cascade,
 title text not null,
 created_by uuid references public.profiles(id) on delete set null,
 created_by_name text default '',
 resolved boolean not null default false,
 resolved_at timestamptz,
 resolved_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now()
);
create table if not exists public.academy_fto_handovers (
 id uuid primary key default gen_random_uuid(),
 recruit_id uuid not null references public.profiles(id) on delete cascade,
 author_id uuid references public.profiles(id) on delete set null,
 author_name text default '',
 current_status text not null,
 strengths text default '',
 open_points text default '',
 next_step text default '',
 created_at timestamptz not null default now()
);
create table if not exists public.academy_graduations (
 id uuid primary key default gen_random_uuid(),
 recruit_id uuid not null unique references public.profiles(id) on delete cascade,
 status text not null default 'Nicht beantragt' check (status in ('Nicht beantragt','FTO empfohlen','Abgeschlossen')),
 recommended_by uuid references public.profiles(id) on delete set null,
 recommended_by_name text default '',
 recommended_at timestamptz,
 approved_by uuid references public.profiles(id) on delete set null,
 approved_by_name text default '',
 approved_at timestamptz,
 created_at timestamptz not null default now()
);

alter table public.academy_practice_evaluations enable row level security;
alter table public.academy_observation_points enable row level security;
alter table public.academy_fto_handovers enable row level security;
alter table public.academy_graduations enable row level security;
grant select,insert,update,delete on public.academy_practice_evaluations,public.academy_observation_points,public.academy_fto_handovers,public.academy_graduations to authenticated;

do $$ begin
 drop policy if exists "v54 practice read" on public.academy_practice_evaluations;
 drop policy if exists "v54 practice staff" on public.academy_practice_evaluations;
 drop policy if exists "v54 observation read" on public.academy_observation_points;
 drop policy if exists "v54 observation staff" on public.academy_observation_points;
 drop policy if exists "v54 handover read" on public.academy_fto_handovers;
 drop policy if exists "v54 handover staff" on public.academy_fto_handovers;
 drop policy if exists "v54 graduation read" on public.academy_graduations;
 drop policy if exists "v54 graduation staff" on public.academy_graduations;
end $$;
create policy "v54 practice read" on public.academy_practice_evaluations for select to authenticated using(recruit_id=auth.uid() or public.academy_is_staff());
create policy "v54 practice staff" on public.academy_practice_evaluations for all to authenticated using(public.academy_is_staff()) with check(public.academy_is_staff());
create policy "v54 observation read" on public.academy_observation_points for select to authenticated using(recruit_id=auth.uid() or public.academy_is_staff());
create policy "v54 observation staff" on public.academy_observation_points for all to authenticated using(public.academy_is_staff()) with check(public.academy_is_staff());
create policy "v54 handover read" on public.academy_fto_handovers for select to authenticated using(recruit_id=auth.uid() or public.academy_is_staff());
create policy "v54 handover staff" on public.academy_fto_handovers for all to authenticated using(public.academy_is_staff()) with check(public.academy_is_staff());
create policy "v54 graduation read" on public.academy_graduations for select to authenticated using(recruit_id=auth.uid() or public.academy_is_staff());
create policy "v54 graduation staff" on public.academy_graduations for all to authenticated using(public.academy_is_staff()) with check(public.academy_is_staff());
