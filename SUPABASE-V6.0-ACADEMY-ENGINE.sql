-- ALTA PD Academy Engine V6.0 – optionale persistente Lernstatus-Basis
-- Im Supabase SQL Editor einmal ausführen. Bestehende Ausbildungsdaten werden nicht gelöscht.
create table if not exists public.academy_learning_progress (
  recruit_id uuid not null references public.profiles(id) on delete cascade,
  chapter int not null check (chapter between 1 and 22),
  read_seconds int not null default 0 check (read_seconds >= 0),
  knowledge_passed boolean not null default false,
  knowledge_passed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (recruit_id, chapter)
);
alter table public.academy_learning_progress enable row level security;
drop policy if exists "learning_read_own_or_staff" on public.academy_learning_progress;
create policy "learning_read_own_or_staff" on public.academy_learning_progress for select to authenticated
using (recruit_id = auth.uid() or public.my_role() in ('admin','trainer'));
drop policy if exists "learning_write_own" on public.academy_learning_progress;
create policy "learning_write_own" on public.academy_learning_progress for insert to authenticated
with check (recruit_id = auth.uid());
drop policy if exists "learning_update_own" on public.academy_learning_progress;
create policy "learning_update_own" on public.academy_learning_progress for update to authenticated
using (recruit_id = auth.uid()) with check (recruit_id = auth.uid());
