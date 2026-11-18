begin;
-- Editable department hierarchy, preserving all existing assignments.
alter table public.portal_hub_departments add column if not exists parent_id uuid references public.portal_hub_departments(id) on delete restrict;
alter table public.portal_hub_departments add column if not exists color text not null default '#4f87b9' check(color ~ '^#[0-9a-fA-F]{6}$');
create index if not exists hub_department_parent on public.portal_hub_departments(parent_id);
create or replace function portal_private.department_no_cycle()returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(7421881);
 if new.parent_id=new.id or(new.parent_id is not null and exists(with recursive ancestors as(select id,parent_id from public.portal_hub_departments where id=new.parent_id union select d.id,d.parent_id from public.portal_hub_departments d join ancestors a on d.id=a.parent_id)select 1 from ancestors where id=new.id))then raise exception 'Eine Abteilung darf nicht ihr eigener Unterbereich sein.';end if;
 return new;
end$$;
revoke all on function portal_private.department_no_cycle() from public,anon,authenticated;
create trigger hub_department_no_cycle before insert or update of parent_id on public.portal_hub_departments for each row execute function portal_private.department_no_cycle();
-- Division names in channel lists; credentials and private training records stay excluded.
create or replace function portal_private.chat_members(p_action text,p_channel text,p_session uuid,p_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();result jsonb;
begin
 if not portal_private.hub_member() then raise exception 'Bitte mit einem aktiven Portalaccount anmelden' using errcode='42501';end if;
 if p_action='heartbeat' then
  if p_session is null then raise exception 'Sitzung fehlt';end if;
  insert into portal_private.chat_presence_sessions(user_id,session_id,seen_at)values(u,p_session,now())on conflict(user_id,session_id)do update set seen_at=now();
  delete from portal_private.chat_presence_sessions where seen_at<now()-interval '1 day';
  return jsonb_build_object('ok',true);
 elsif p_action='leave' then
  delete from portal_private.chat_presence_sessions where user_id=u and session_id=p_session;
  return jsonb_build_object('ok',true);
 end if;
 if not portal_private.hub_channel_access(p_channel) then raise exception 'Kein Zugriff auf diesen Channel' using errcode='42501';end if;
 if p_action not in ('members','profile') then raise exception 'Unbekannte Aktion';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'rank',p.rank,'role',p.role,'serviceNo',p.service_no,'departments',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'position',m.position,'color',d.color)order by d.name)from public.portal_hub_memberships m join public.portal_hub_departments d on d.id=m.department_id where m.user_id=p.id),'[]'::jsonb),'avatar_path',s.avatar_path,'online',exists(select 1 from portal_private.chat_presence_sessions x where x.user_id=p.id and x.seen_at>now()-interval '120 seconds'),'has_access',case p_channel when 'staff' then portal_private.hub_rank(p.rank)>=4 when 'officer' then portal_private.hub_rank(p.rank)>=1 when 'rookie' then p.role in ('admin','trainer')or(p.role='recruit' and portal_private.hub_rank(p.rank)=0) else false end) order by p.name),'[]'::jsonb)into result
 from public.profiles p left join public.portal_hub_settings s on s.user_id=p.id
 where p.account_enabled and p.archived_at is null and p.status<>'Archiviert'
 and (p_action='members' or p.id=p_user)
 and(case p_channel when 'staff' then portal_private.hub_rank(p.rank)>=4 when 'officer' then portal_private.hub_rank(p.rank)>=1 when 'rookie' then p.role in ('admin','trainer')or(p.role='recruit' and portal_private.hub_rank(p.rank)=0) else false end
 or(p_action='profile' and exists(select 1 from public.portal_hub_staff_messages m where m.channel=p_channel and m.author_id=p.id)));
 return result;
end$$;
create or replace function portal_private.member_statuses()returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not portal_private.hub_member()then raise exception 'Nicht angemeldet'using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'online',exists(select 1 from portal_private.chat_presence_sessions s where s.user_id=p.id and s.seen_at>now()-interval '120 seconds')))from public.profiles p where p.account_enabled and p.archived_at is null and p.status<>'Archiviert'),'[]'::jsonb);
end$$;
revoke all on function portal_private.member_statuses()from public,anon;
grant execute on function portal_private.member_statuses()to authenticated,service_role;
create or replace function public.portal_member_statuses()returns jsonb language sql stable security invoker set search_path='' as $$select portal_private.member_statuses()$$;
revoke all on function public.portal_member_statuses()from public,anon;
grant execute on function public.portal_member_statuses()to authenticated,service_role;
-- Reversible image removal with concurrency protection and audit history.
alter table public.apd_evidence_images add column if not exists deleted_at timestamptz;
alter table public.apd_evidence_images add column if not exists deleted_by uuid references public.profiles;
create policy apd_evidence_active_images on public.apd_evidence_images as restrictive for select to authenticated using(deleted_at is null);
create or replace function portal_private.evidence_image_state(p_image uuid,p_version int,p_restore boolean)returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.apd_evidence_images;c public.apd_evidence_cases;actor text;
begin
 if not public.apd_evidence_member()then raise exception 'Kein Zugriff'using errcode='42501';end if;
 select * into i from public.apd_evidence_images where id=p_image;if not found then raise exception 'Bild nicht gefunden';end if;
 select * into c from public.apd_evidence_cases where id=i.case_id for update;
 if c.version<>p_version then raise exception 'Die Akte wurde inzwischen geändert. Bitte neu laden.'using errcode='40001';end if;
 if(p_restore and i.deleted_at is null)or(not p_restore and i.deleted_at is not null)then raise exception 'Bildstatus bereits geändert';end if;
 select name into actor from public.profiles where id=auth.uid();
 update public.apd_evidence_images set deleted_at=case when p_restore then null else now()end,deleted_by=case when p_restore then null else auth.uid()end where id=p_image;
 update public.apd_evidence_cases set version=version+1,updated_at=now()where id=c.id;
 insert into public.apd_evidence_history(case_id,actor_id,actor,action,changes)values(c.id,auth.uid(),actor,case when p_restore then 'Beweisbild wiederhergestellt'else 'Beweisbild gelöscht'end,jsonb_build_object('image_id',i.id,'title',i.title));
 return jsonb_build_object('ok',true,'case_id',c.id);
end$$;
revoke all on function portal_private.evidence_image_state(uuid,int,boolean)from public,anon;
grant execute on function portal_private.evidence_image_state(uuid,int,boolean)to authenticated,service_role;
create or replace function public.apd_evidence_image_state(p_image uuid,p_version int,p_restore boolean default false)returns jsonb language sql security invoker set search_path='' as $$select portal_private.evidence_image_state(p_image,p_version,p_restore)$$;
revoke all on function public.apd_evidence_image_state(uuid,int,boolean)from public,anon;
grant execute on function public.apd_evidence_image_state(uuid,int,boolean)to authenticated,service_role;
-- Update existing read functions in place, without changing their signatures or other logic.
do $$declare src text;begin
 select pg_get_functiondef('public.apd_evidence_detail(uuid)'::regprocedure)into src;
 src:=replace(src,'i.case_id=p_id','i.case_id=p_id and i.deleted_at is null');execute src;
 select pg_get_functiondef('public.apd_evidence_list(text,text,integer)'::regprocedure)into src;
 src:=replace(src,'i.case_id=c.id','i.case_id=c.id and i.deleted_at is null');
 src:=replace(src,'select count(*) from public.apd_evidence_images)','select count(*) from public.apd_evidence_images where deleted_at is null)');execute src;
end$$;
-- Persistent calendar reminder inbox. Scheduler writes; users only read/acknowledge their own reminders.
create table public.portal_event_reminders(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,event_id uuid not null references public.portal_hub_pd_events on delete cascade,event_starts_at timestamptz not null,lead_minutes int not null check(lead_minutes in(60,30)),created_at timestamptz not null default now(),read_at timestamptz,unique(user_id,event_id,event_starts_at,lead_minutes));
create index event_reminders_user on public.portal_event_reminders(user_id,created_at desc);
alter table public.portal_event_reminders enable row level security;
grant select on public.portal_event_reminders to authenticated;
grant update(read_at)on public.portal_event_reminders to authenticated;
grant all on public.portal_event_reminders to service_role;
create policy event_reminders_own on public.portal_event_reminders for select to authenticated using(user_id=(select auth.uid())and(select portal_private.hub_staff())and exists(select 1 from public.portal_hub_pd_events e where e.id=event_id and e.starts_at=event_starts_at));
create policy event_reminders_read on public.portal_event_reminders for update to authenticated using(user_id=(select auth.uid())and(select portal_private.hub_staff()))with check(user_id=(select auth.uid())and(select portal_private.hub_staff()));
create or replace function portal_private.queue_calendar_reminders()returns int language plpgsql security definer set search_path='' as $$
declare n int;
begin
 insert into public.portal_event_reminders(user_id,event_id,event_starts_at,lead_minutes)
 select p.id,e.id,e.starts_at,lead.minutes from public.portal_hub_pd_events e cross join(values(60),(30))lead(minutes)join public.profiles p on p.role in('admin','trainer')and p.account_enabled and p.archived_at is null and p.status<>'Archiviert'and p.created_at<=e.starts_at
 where now()>=e.starts_at-make_interval(mins=>lead.minutes)and now()<e.starts_at-make_interval(mins=>lead.minutes)+interval '2 minutes' and e.starts_at>now()
 on conflict do nothing;
 get diagnostics n=row_count;
 return n;
end$$;
revoke all on function portal_private.queue_calendar_reminders()from public,anon,authenticated;
grant execute on function portal_private.queue_calendar_reminders()to service_role;
create extension if not exists pg_cron;
select cron.schedule('mrpd-pd-calendar-reminders','* * * * *','select portal_private.queue_calendar_reminders();');
commit;
