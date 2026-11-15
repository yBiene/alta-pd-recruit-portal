begin;
-- Account creation is the visibility boundary, never the first login.
create or replace function portal_private.hub_joined_at() returns timestamptz language sql stable security definer set search_path='' as $$
 select p.created_at from public.profiles p where p.id=(select auth.uid()) and p.account_enabled is not false and p.archived_at is null and p.status<>'Archiviert'
$$;
revoke all on function portal_private.hub_joined_at() from public,anon;
grant execute on function portal_private.hub_joined_at() to authenticated;
create policy hub_join_announcements on public.announcements as restrictive for select to authenticated using(created_at >= (select portal_private.hub_joined_at()));
create policy hub_join_training_events on public.training_events as restrictive for select to authenticated using(starts_at >= (select portal_private.hub_joined_at()));
create policy hub_join_academy_appointments on public.academy_appointments as restrictive for select to authenticated using(starts_at >= (select portal_private.hub_joined_at()));
create policy hub_join_pd_events on public.portal_hub_pd_events as restrictive for select to authenticated using(starts_at >= (select portal_private.hub_joined_at()));
-- The read-confirmation RPC must respect the same boundary despite its internal definer helper.
do $$ declare original text; updated text; begin
 original:=pg_get_functiondef('portal_private.hub_rpc(text,jsonb)'::regprocedure);
 updated:=replace(original,'where id=(p_args->>''id'')::bigint) then raise exception ''Mitteilung nicht gefunden''','where id=(p_args->>''id'')::bigint and created_at >= portal_private.hub_joined_at()) then raise exception ''Mitteilung nicht gefunden''');
 if updated=original then raise exception 'Expected announcement visibility guard not found';end if;
 execute updated;
end $$;
commit;
