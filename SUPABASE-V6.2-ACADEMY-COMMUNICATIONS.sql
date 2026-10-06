-- ALTA PD V6.2 – Academy Communications
alter table public.training_goals add column if not exists author_rank text;
alter table public.field_reports add column if not exists author_rank text;

create table if not exists public.academy_messages (
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references public.profiles(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 recruit_id uuid references public.profiles(id) on delete cascade,
 subject text not null default '(ohne Betreff)',
 body text not null,
 kind text not null default 'mail',
 thread_id uuid not null default gen_random_uuid(),
 parent_id uuid references public.academy_messages(id) on delete set null,
 source_type text,
 source_id uuid,
 read_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists academy_messages_recipient_idx on public.academy_messages(recipient_id,created_at desc);
create index if not exists academy_messages_sender_idx on public.academy_messages(sender_id,created_at desc);
create index if not exists academy_messages_recruit_idx on public.academy_messages(recruit_id,created_at desc);

alter table public.academy_messages enable row level security;
drop policy if exists "academy_messages_select_own" on public.academy_messages;
create policy "academy_messages_select_own" on public.academy_messages for select to authenticated
using (sender_id=auth.uid() or recipient_id=auth.uid());
drop policy if exists "academy_messages_insert_own" on public.academy_messages;
create policy "academy_messages_insert_own" on public.academy_messages for insert to authenticated
with check (sender_id=auth.uid() and recipient_id<>auth.uid());
drop policy if exists "academy_messages_update_recipient" on public.academy_messages;
create policy "academy_messages_update_recipient" on public.academy_messages for update to authenticated
using (recipient_id=auth.uid()) with check (recipient_id=auth.uid());

grant select,insert,update on public.academy_messages to authenticated;
