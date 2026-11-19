begin;
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where account_type in ('owner','management') and account_enabled and archived_at is null limit 1),true);
do $$
declare person_id uuid;unit_id uuid;rule_id uuid;entry_id uuid;checks jsonb;title text:='Rollback qualification '||gen_random_uuid();rank_name text:='Police Officer 2';proposal uuid:=gen_random_uuid();
begin
 select id into person_id from public.profiles where account_type='employee' and account_enabled and archived_at is null limit 1;
 insert into public.portal_hub_departments(name,workspace_kind) values('Qualification rollback','custom') returning id into unit_id;
 insert into public.mrpd_ops_records(kind,unit_id,title,status,fields) values('promotion_rule',unit_id,'Unit rule rollback','active',jsonb_build_object('rank',rank_name,'qualifications',title)) returning id into rule_id;
 perform public.mrpd_ops_command('save',proposal,0,jsonb_build_object('kind','promotion','title','Qualification test','subject_id',person_id,'fields',jsonb_build_object('rank',rank_name)));
 checks:=public.mrpd_ops_command('checks',proposal,0);
 if exists(select 1 from jsonb_array_elements(checks) c where c->>'title'=title) then raise exception 'Unit rule applied outside membership';end if;
 insert into public.portal_hub_memberships(department_id,user_id,unit_role) values(unit_id,person_id,'member');
 checks:=public.mrpd_ops_command('checks',proposal,0);
 if not exists(select 1 from jsonb_array_elements(checks) c where c->>'title'=title and (c->>'passed')::boolean=false) then raise exception 'Missing qualification not detected';end if;
 insert into public.mrpd_unit_entries(unit_id,kind,title,assigned_to,due_on) values(unit_id,'qualification',title,person_id,current_date-1) returning id into entry_id;
 checks:=public.mrpd_ops_command('checks',proposal,0);
 if not exists(select 1 from jsonb_array_elements(checks) c where c->>'title'=title and (c->>'passed')::boolean=false) then raise exception 'Expired qualification accepted';end if;
 update public.mrpd_unit_entries set due_on=current_date+7,revision=revision+1 where id=entry_id;
 checks:=public.mrpd_ops_command('checks',proposal,0);
 if not exists(select 1 from jsonb_array_elements(checks) c where c->>'title'=title and (c->>'passed')::boolean=true) then raise exception 'Valid qualification rejected';end if;
 perform portal_private.ops_reminders();perform portal_private.ops_reminders();
 if (select count(*) from public.mrpd_ops_alerts where user_id=person_id and key like 'qualification:'||entry_id||':%')<>1 then raise exception 'Qualification reminder not idempotent';end if;
end $$;
select 'Unit-scoped prerequisites, missing/expired/valid qualifications and idempotent expiry reminders passed' as result;
rollback;
