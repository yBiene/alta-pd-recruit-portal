-- ALTA PD Portal V6.4.5
-- Ein bestandener Wissenscheck darf nur das eigene Kapitel abschließen.
-- Kapitel können nicht übersprungen werden.

create or replace function public.complete_own_training_chapter(chapter_no integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  user_role text;
begin
  if uid is null then
    raise exception 'Nicht angemeldet';
  end if;

  select role into user_role from public.profiles where id = uid;
  if user_role is distinct from 'recruit' then
    raise exception 'Nur Recruits können ihren Wissenscheck-Fortschritt speichern';
  end if;

  if chapter_no < 1 or chapter_no > 22 then
    raise exception 'Ungültiges Kapitel';
  end if;

  if chapter_no > 1 and not exists (
    select 1 from public.training_progress
    where recruit_id = uid and chapter = chapter_no - 1 and completed = true
  ) then
    raise exception 'Vorheriges Kapitel ist noch nicht abgeschlossen';
  end if;

  insert into public.training_progress(recruit_id, chapter, completed, completed_by, completed_at)
  values(uid, chapter_no, true, uid, now())
  on conflict (recruit_id, chapter)
  do update set completed = true, completed_by = uid, completed_at = coalesce(public.training_progress.completed_at, now());
end;
$$;

revoke all on function public.complete_own_training_chapter(integer) from public;
grant execute on function public.complete_own_training_chapter(integer) to authenticated;
notify pgrst, 'reload schema';
