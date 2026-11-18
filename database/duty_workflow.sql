begin;

create table public.mrpd_next_steps (
 recruit_id uuid primary key references public.profiles(id) on delete cascade,
 task text not null check (char_length(btrim(task)) between 1 and 1500),
 fto_id uuid not null references public.profiles(id) on delete cascade,
 due_on date
);
alter table public.mrpd_next_steps enable row level security;
revoke all on public.mrpd_next_steps from anon, authenticated;
grant select, insert, update, delete on public.mrpd_next_steps to authenticated;
create policy steps_read on public.mrpd_next_steps for select to authenticated using (
 (select portal_private.hub_staff()) or ((select portal_private.hub_member()) and recruit_id=(select auth.uid()))
);
create policy steps_write on public.mrpd_next_steps for all to authenticated
 using ((select portal_private.hub_staff()))
 with check ((select portal_private.hub_staff())
 and exists(select 1 from public.profiles r where r.id=recruit_id and r.role='recruit')
 and exists(select 1 from public.profiles f where f.id=fto_id and f.role in ('trainer','admin') and f.account_enabled and f.archived_at is null and f.status<>'Archiviert'));

create table public.mrpd_shift_handover (
 id uuid primary key default gen_random_uuid(),
 title text not null check(char_length(btrim(title)) between 1 and 160),
 unit text not null check(char_length(btrim(unit)) between 1 and 100),
 next_action text not null check(char_length(btrim(next_action)) between 1 and 1600),
 resolved boolean not null default false,
 author_id uuid default auth.uid() references public.profiles(id) on delete set null,
 created_at timestamptz not null default now()
);
alter table public.mrpd_shift_handover enable row level security;
revoke all on public.mrpd_shift_handover from anon, authenticated;
grant select on public.mrpd_shift_handover to authenticated;
grant insert(title,unit,next_action) on public.mrpd_shift_handover to authenticated;
grant update(title,unit,next_action,resolved) on public.mrpd_shift_handover to authenticated;
create policy shift_read on public.mrpd_shift_handover for select to authenticated
 using ((select portal_private.hub_channel_access('officer')));
create policy shift_add on public.mrpd_shift_handover for insert to authenticated
 with check ((select portal_private.hub_channel_access('officer')) and author_id=(select auth.uid()));
create policy shift_edit on public.mrpd_shift_handover for update to authenticated
 using ((select portal_private.hub_channel_access('officer')))
 with check ((select portal_private.hub_channel_access('officer')));

create table public.mrpd_marked_messages (
 user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 source text not null check(source in ('chat','mail')),
 message_id uuid not null,
 saved boolean not null default false,
 task boolean not null default false,
 primary key(user_id,source,message_id),
 check(saved or task)
);
alter table public.mrpd_marked_messages enable row level security;
revoke all on public.mrpd_marked_messages from anon, authenticated;
grant select,insert,update,delete on public.mrpd_marked_messages to authenticated;
create policy marked_messages_own on public.mrpd_marked_messages for all to authenticated
 using ((select portal_private.hub_member()) and user_id=(select auth.uid()))
 with check ((select portal_private.hub_member()) and user_id=(select auth.uid()) and (
  (source='mail' and exists(select 1 from public.academy_messages m where m.id=message_id and auth.uid() in (m.sender_id,m.recipient_id)))
  or (source='chat' and exists(select 1 from public.portal_hub_staff_messages m where m.id=message_id))
 ));

alter table public.portal_hub_pd_events add column capacity integer check(capacity between 1 and 500);
create table portal_private.mrpd_event_rsvp (
 event_id uuid not null references public.portal_hub_pd_events(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 accepted boolean not null,
 primary key(event_id,user_id)
);
alter table portal_private.mrpd_event_rsvp enable row level security;
create function portal_private.mrpd_guard_capacity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.capacity is not null and new.capacity < (select count(*) from portal_private.mrpd_event_rsvp where event_id=new.id and accepted) then
  raise exception 'Die Platzanzahl darf nicht unter der Zahl der Zusagen liegen.';
 end if;
 return new;
end
$$;
create trigger mrpd_guard_capacity before update of capacity on public.portal_hub_pd_events for each row execute function portal_private.mrpd_guard_capacity();
create function portal_private.mrpd_rsvp(p_event uuid,p_answer boolean default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 evt public.portal_hub_pd_events;
 actor uuid:=auth.uid();
 yes_count integer;
 reply boolean;
 attendees jsonb;
begin
 if not portal_private.hub_staff() then raise exception 'Kein Kalenderzugriff' using errcode='42501'; end if;
 if p_answer is null then
  select * into evt from public.portal_hub_pd_events where id=p_event;
 else
  select * into evt from public.portal_hub_pd_events where id=p_event for update;
 end if;
 if not found then raise exception 'Termin nicht gefunden'; end if;
 select accepted into reply from portal_private.mrpd_event_rsvp where event_id=p_event and user_id=actor;
 select count(*) into yes_count from portal_private.mrpd_event_rsvp where event_id=p_event and accepted;
 if p_answer is not null then
  if coalesce(evt.ends_at,evt.starts_at)<=now() then raise exception 'Der Termin ist bereits vorbei.'; end if;
  if p_answer and reply is distinct from true and evt.capacity is not null and yes_count>=evt.capacity then
   raise exception 'Alle Plätze sind bereits belegt.';
  end if;
  insert into portal_private.mrpd_event_rsvp values(p_event,actor,p_answer)
  on conflict(event_id,user_id) do update set accepted=excluded.accepted;
  if p_answer and reply is distinct from true then yes_count:=yes_count+1;
  elsif not p_answer and reply is true then yes_count:=yes_count-1; end if;
  reply:=p_answer;
 end if;
 if evt.author_id=actor or portal_private.hub_plus() then
  select coalesce(jsonb_agg(jsonb_build_object('name',p.name,'accepted',r.accepted) order by p.name),'[]') into attendees
  from portal_private.mrpd_event_rsvp r join public.profiles p on p.id=r.user_id where r.event_id=p_event;
 end if;
 return jsonb_build_object('accepted',reply,'count',yes_count,'capacity',evt.capacity,'attendees',attendees);
end
$$;
create function public.mrpd_rsvp(p_event uuid,p_answer boolean default null) returns jsonb language sql security invoker set search_path='' as $$
 select portal_private.mrpd_rsvp(p_event,p_answer)
$$;
revoke all on function public.mrpd_rsvp(uuid,boolean),portal_private.mrpd_rsvp(uuid,boolean) from public,anon;
grant execute on function public.mrpd_rsvp(uuid,boolean),portal_private.mrpd_rsvp(uuid,boolean) to authenticated;

create table public.mrpd_change_history (
 id bigint generated always as identity primary key,
 area text not null,
 target text not null,
 actor_id uuid,
 changed_at timestamptz not null default now(),
 fields text[] not null,
 action text not null
);
alter table public.mrpd_change_history enable row level security;
revoke all on public.mrpd_change_history from anon,authenticated;
grant select on public.mrpd_change_history to authenticated;
create policy change_history_read on public.mrpd_change_history for select to authenticated using ((select portal_private.hub_plus()));
create function portal_private.mrpd_track_change() returns trigger language plpgsql security definer set search_path='' as $$
declare
 before_row jsonb := case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
 after_row jsonb := case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
 fields text[];
 actor uuid := auth.uid();
begin
 select array_agg(key order by key) into fields from unnest(string_to_array(tg_argv[2],',')) as allowed(key)
 where before_row->key is distinct from after_row->key;
 if fields is null then return null; end if;
 if tg_argv[0]='Dienstgrad' then actor:=coalesce((after_row->>'actor_id')::uuid,actor); end if;
 insert into public.mrpd_change_history(area,target,actor_id,fields,action)
 values(tg_argv[0],coalesce(after_row->>tg_argv[1],before_row->>tg_argv[1]),actor,fields,tg_op);
 return null;
end
$$;
create trigger mrpd_log_accounts after insert or update or delete on public.profiles
 for each row execute function portal_private.mrpd_track_change('Account','id','username,name,service_no,rank,role,access_level,status,fto,secondary_fto,leader_fto_id,secondary_fto_id,training_start,account_enabled,archived_at');
create trigger mrpd_log_ranks after insert on public.portal_hub_rank_changes
 for each row execute function portal_private.mrpd_track_change('Dienstgrad','user_id','from_rank,to_rank');
create trigger mrpd_log_chapters after insert or update on public.mrpd_chapter_content
 for each row execute function portal_private.mrpd_track_change('Kapitel','chapter','body');
create trigger mrpd_log_org after insert or update on public.mrpd_org_chart
 for each row execute function portal_private.mrpd_track_change('Abteilungen','id','tree');
commit;
