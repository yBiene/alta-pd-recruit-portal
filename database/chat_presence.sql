begin;
create table if not exists portal_private.chat_presence_sessions(user_id uuid not null references public.profiles on delete cascade,session_id uuid not null,seen_at timestamptz not null default now(),primary key(user_id,session_id));
create index if not exists chat_presence_seen on portal_private.chat_presence_sessions(seen_at);
alter table portal_private.chat_presence_sessions enable row level security;
revoke all on portal_private.chat_presence_sessions from public,anon,authenticated;
-- Only active members of the requested channel may see its member list and public profiles.
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
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'rank',p.rank,'role',p.role,'serviceNo',p.service_no,'avatar_path',s.avatar_path,'online',exists(select 1 from portal_private.chat_presence_sessions x where x.user_id=p.id and x.seen_at>now()-interval '120 seconds'),'has_access',case p_channel when 'staff' then portal_private.hub_rank(p.rank)>=4 when 'officer' then portal_private.hub_rank(p.rank)>=1 when 'rookie' then p.role in ('admin','trainer')or(p.role='recruit' and portal_private.hub_rank(p.rank)=0) else false end) order by p.name),'[]'::jsonb)into result
 from public.profiles p left join public.portal_hub_settings s on s.user_id=p.id
 where p.account_enabled and p.archived_at is null and p.status<>'Archiviert'
 and (p_action='members' or p.id=p_user)
 and(case p_channel when 'staff' then portal_private.hub_rank(p.rank)>=4 when 'officer' then portal_private.hub_rank(p.rank)>=1 when 'rookie' then p.role in ('admin','trainer')or(p.role='recruit' and portal_private.hub_rank(p.rank)=0) else false end
 or(p_action='profile' and exists(select 1 from public.portal_hub_staff_messages m where m.channel=p_channel and m.author_id=p.id)));
 return result;
end$$;
revoke all on function portal_private.chat_members(text,text,uuid,uuid) from public,anon;
grant execute on function portal_private.chat_members(text,text,uuid,uuid) to authenticated,service_role;
create or replace function public.portal_chat_members(p_action text,p_channel text default 'staff',p_session uuid default null,p_user uuid default null)returns jsonb language sql security invoker set search_path='' as $$select portal_private.chat_members(p_action,p_channel,p_session,p_user)$$;
revoke all on function public.portal_chat_members(text,text,uuid,uuid) from public,anon;
grant execute on function public.portal_chat_members(text,text,uuid,uuid) to authenticated,service_role;
commit;
