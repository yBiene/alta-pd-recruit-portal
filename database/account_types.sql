begin;
-- The existing authorization fields remain compatible with Academy functions.
-- Account types are derived on the server and cannot be written by a client.
alter table public.profiles add column account_type text generated always as (
 case when role='admin' and access_level='owner' then 'owner'
      when role='trainer' and access_level='extra' then 'management'
      else 'employee' end
) stored;

insert into public.portal_hub_memberships(department_id,user_id,unit_role,position)
select d.id,p.id,'instructor','Ausbilder' from public.profiles p cross join public.portal_hub_departments d
where d.workspace_kind='fto' and p.role='trainer' and p.access_level='standard'
on conflict(department_id,user_id) do update set unit_role=case when portal_hub_memberships.unit_role in ('lead','deputy') then portal_hub_memberships.unit_role else 'instructor' end;

create function portal_private.fto_instructor(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.portal_hub_memberships m join public.portal_hub_departments d on d.id=m.department_id
 where d.workspace_kind='fto' and m.user_id=p_user and m.unit_role in ('instructor','deputy','lead'))
$$;
revoke all on function portal_private.fto_instructor(uuid) from public,anon,authenticated;

create function portal_private.sync_fto_access(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare target_role text;
begin
 target_role:=case when portal_private.fto_instructor(p_user) then 'trainer' else 'recruit' end;
 update public.profiles set role=target_role where id=p_user and account_type='employee' and role is distinct from target_role;
end
$$;
revoke all on function portal_private.sync_fto_access(uuid) from public,anon,authenticated;
create function portal_private.account_unit_sync() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op<>'INSERT' and exists(select 1 from public.portal_hub_departments where id=old.department_id and workspace_kind='fto') then perform portal_private.sync_fto_access(old.user_id);end if;
 if tg_op<>'DELETE' and exists(select 1 from public.portal_hub_departments where id=new.department_id and workspace_kind='fto') then perform portal_private.sync_fto_access(new.user_id);end if;
 return null;
end
$$;
revoke all on function portal_private.account_unit_sync() from public,anon,authenticated;
create trigger mrpd_account_unit_sync after insert or update or delete on public.portal_hub_memberships for each row execute function portal_private.account_unit_sync();

create function portal_private.set_account_type(p_user uuid,p_type text,p_expected text) returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.profiles;
begin
 if not portal_private.hub_member() or not exists(select 1 from public.profiles where id=auth.uid() and account_type='owner') then
  raise exception 'Nur der Hauptadministrator darf Verwaltungsrechte vergeben oder entziehen.' using errcode='42501';
 end if;
 if p_type is null or p_type not in ('employee','management') then raise exception 'Accounttyp ungültig.';end if;
 select * into target from public.profiles where id=p_user for update;
 if not found then raise exception 'Account nicht gefunden.';end if;
 if target.account_type='owner' then raise exception 'Der Hauptadministrator-Account ist geschützt.';end if;
 if target.account_type is distinct from p_expected then raise exception 'Der Accounttyp wurde inzwischen geändert. Bitte neu öffnen.';end if;
 update public.profiles set
 role=case when p_type='management' or portal_private.fto_instructor(p_user) then 'trainer' else 'recruit' end,
 access_level=case when p_type='management' then 'extra' else 'standard' end,
 status=case when status in ('Ausbilder +','Ausbilder','Ausbilder · Extra-Zugriff') then 'Aktiv' else status end
 where id=p_user;
 return jsonb_build_object('id',p_user,'account_type',p_type);
end
$$;
create function public.mrpd_set_account_type(p_user uuid,p_type text,p_expected text) returns jsonb language sql security invoker set search_path='' as $$
 select portal_private.set_account_type(p_user,p_type,p_expected)
$$;
revoke all on function public.mrpd_set_account_type(uuid,text,text),portal_private.set_account_type(uuid,text,text) from public,anon;
grant execute on function public.mrpd_set_account_type(uuid,text,text),portal_private.set_account_type(uuid,text,text) to authenticated;

select portal_private.sync_fto_access(id) from public.profiles where account_type='employee';

update public.profiles set status='Aktiv' where role in ('admin','trainer') and status in ('Ausbilder +','Ausbilder','Ausbilder · Extra-Zugriff');
drop trigger mrpd_log_accounts on public.profiles;
create trigger mrpd_log_accounts after insert or update or delete on public.profiles for each row execute function portal_private.mrpd_track_change('Account','id','username,name,service_no,rank,account_type,status,fto,secondary_fto,leader_fto_id,secondary_fto_id,training_start,account_enabled,archived_at');
commit;
