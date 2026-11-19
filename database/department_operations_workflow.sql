begin;
create or replace function portal_private.ops_edit(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select portal_private.hub_member() and exists(select 1 from public.mrpd_ops_records r where r.id=p_id and portal_private.ops_access(r.id) and (
 portal_private.hub_plus() or (r.kind not in ('ia','discipline') and portal_private.ops_manager(r.unit_id))
 or (r.author_id=auth.uid() and r.status in ('draft','active','rejected') and r.kind not in ('shift','vehicle','equipment','uniform','promotion_rule','skill','discipline'))))
$$;
create function portal_private.ops_guard_edit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.fields is distinct from old.fields and old.kind<>'shift' and old.status not in ('draft','active','rejected') then raise exception 'Eingereichte oder freigegebene Angaben sind gesperrt. Bitte zuerst zur Nacharbeit zurückgeben.';end if;
 if old.applied_at is not null and (new.title is distinct from old.title or new.body is distinct from old.body or new.subject_id is distinct from old.subject_id) then raise exception 'Die Entscheidung wurde bereits übernommen.';end if;
 return new;
end
$$;
revoke all on function portal_private.ops_guard_edit() from public,anon,authenticated;
create trigger ops_guard_edit before update on public.mrpd_ops_records for each row execute function portal_private.ops_guard_edit();
create function portal_private.ops_alert_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status is not distinct from old.status then return new;end if;
 if new.status='submitted' then
  insert into public.mrpd_ops_alerts(user_id,key,title,body)
  select p.id,'review:'||new.id||':'||new.revision,'Vorgang zur Freigabe',new.title
  from public.profiles p where p.account_enabled and p.archived_at is null and p.id<>auth.uid() and
  (p.account_type in ('management','owner') or (new.kind not in ('ia','discipline') and exists(select 1 from public.portal_hub_memberships m where m.user_id=p.id and m.department_id=new.unit_id and m.unit_role in ('lead','deputy'))))
  on conflict(user_id,key) do nothing;
 elsif new.status in ('approved','reviewed','rejected','closed') and new.kind<>'shift' then
  insert into public.mrpd_ops_alerts(user_id,key,title,body)
  select p.id,'decision:'||new.id||':'||new.revision,
  case new.status when 'approved' then 'Vorgang freigegeben' when 'reviewed' then 'Unit-Freigabe erteilt' when 'rejected' then 'Rückmeldung zum Vorgang' else 'Vorgang abgeschlossen' end,new.title
  from public.profiles p where p.account_enabled and p.archived_at is null and p.id in (new.author_id,new.subject_id) and p.id<>auth.uid()
  on conflict(user_id,key) do nothing;
 end if;
 return new;
end
$$;
revoke all on function portal_private.ops_alert_change() from public,anon,authenticated;
create trigger ops_alert_status after update of status on public.mrpd_ops_records for each row execute function portal_private.ops_alert_change();
commit;
