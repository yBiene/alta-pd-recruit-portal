begin;
select set_config('mrpd.account_test_actors',jsonb_build_object(
 'owner',(select id from public.profiles where account_type='owner' and account_enabled and archived_at is null limit 1),
 'management',(select id from public.profiles where account_type='management' and account_enabled and archived_at is null limit 1),
 'employee',(select id from public.profiles where account_type='employee' and account_enabled and archived_at is null limit 1)
)::text,true);
set local role authenticated;
do $$
declare actors jsonb:=current_setting('mrpd.account_test_actors')::jsonb; main uuid:=(actors->>'owner')::uuid; manager uuid:=(actors->>'management')::uuid; employee uuid:=(actors->>'employee')::uuid; fto uuid; snapshot jsonb; previous_rank text;
begin
 if main is null or manager is null or employee is null then raise exception 'Existing role fixtures required.';end if;
 perform set_config('request.jwt.claim.sub',main::text,true);
 select id into fto from public.portal_hub_departments where workspace_kind='fto';
 select rank into previous_rank from public.profiles where id=employee;
 perform public.mrpd_set_account_type(employee,'management','employee');
 if not exists(select 1 from public.profiles where id=employee and account_type='management' and rank is not distinct from previous_rank) then raise exception 'Account type change altered rank';end if;
 begin
  perform public.mrpd_set_account_type(employee,'employee','employee');raise exception 'Stale change accepted';
 exception when raise_exception then if sqlerrm='Stale change accepted' then raise;end if;end;
 perform public.mrpd_set_account_type(employee,'employee','management');
 begin
  perform public.mrpd_set_account_type(main,'employee','owner');raise exception 'Owner demoted';
 exception when raise_exception then if sqlerrm='Owner demoted' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',manager::text,true);
 begin
  perform public.mrpd_set_account_type(employee,'management','employee');raise exception 'Manager delegated management';
 exception when insufficient_privilege then null;end;
 snapshot:=public.mrpd_unit_command('memberships',jsonb_build_object('user_id',employee));
 perform public.mrpd_unit_command('memberships',jsonb_build_object('user_id',employee,'version',snapshot->>'version','units',jsonb_build_array(jsonb_build_object('id',fto,'role','instructor'))));
 if not exists(select 1 from public.profiles where id=employee and account_type='employee' and role='trainer' and access_level='standard') then raise exception 'FTO access not granted independently';end if;
 snapshot:=public.mrpd_unit_command('memberships',jsonb_build_object('user_id',employee));
 perform public.mrpd_unit_command('memberships',jsonb_build_object('user_id',employee,'version',snapshot->>'version','units',jsonb_build_array(jsonb_build_object('id',fto,'role','member'))));
 if not exists(select 1 from public.profiles where id=employee and account_type='employee' and role='recruit') then raise exception 'FTO access not revoked';end if;
 perform set_config('request.jwt.claim.sub',employee::text,true);
 begin
  perform public.mrpd_set_account_type(employee,'management','employee');raise exception 'Employee escalated privileges';
 exception when insufficient_privilege then null;end;
 begin
  update public.profiles set account_type='management' where id=employee;raise exception 'Generated account type overwritten';
 exception when insufficient_privilege or generated_always then null;end;
end
$$;
select 'Canonical account types, owner protection, delegated grants, FTO access and revocation verified' as result;
rollback;
