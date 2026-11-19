-- Transactional integration checks use existing active accounts and roll back fixtures.
begin;
select set_config('mrpd.unit_test_actors',jsonb_build_object(
 'plus',(select id from public.profiles where account_enabled and archived_at is null and (role='trainer' and access_level='extra' or role='admin' and access_level='owner') limit 1),
 'members',(select jsonb_agg(id) from (select id from public.profiles where account_enabled and archived_at is null and status<>'Archiviert' and not (role='trainer' and access_level='extra' or role='admin' and access_level='owner') order by id limit 2) x)
)::text,true);
set local role authenticated;
do $$
declare actors jsonb:=current_setting('mrpd.unit_test_actors')::jsonb; lead uuid; a uuid; b uuid; unit uuid; assignment jsonb; original_version text; task_id uuid; training_id uuid; doc_id uuid; affected int;
begin
 lead:=(actors->>'plus')::uuid;a:=(actors->'members'->>0)::uuid;b:=(actors->'members'->>1)::uuid;
 if lead is null or a is null or b is null then raise exception 'Three existing test accounts required.';end if;
 perform set_config('request.jwt.claim.sub',lead::text,true);
 insert into public.portal_hub_departments(name,description) values('Unit integration rollback','Temporary fixture') returning id into unit;
 assignment:=public.mrpd_unit_command('memberships',jsonb_build_object('user_id',a));original_version:=assignment->>'version';
 assignment:=public.mrpd_unit_command('memberships',jsonb_build_object('user_id',a,'version',original_version,'units',jsonb_build_array(jsonb_build_object('id',unit,'role','member'))));
 begin
  perform public.mrpd_unit_command('memberships',jsonb_build_object('user_id',a,'version',original_version,'units','[]'::jsonb));
  raise exception 'Stale membership replacement succeeded';
 exception when raise_exception then if sqlerrm='Stale membership replacement succeeded' then raise;end if;end;
 insert into public.mrpd_unit_entries(unit_id,kind,title,body,assigned_to) values(unit,'task','Test task','Test body',a) returning id into task_id;
 insert into public.mrpd_unit_entries(unit_id,kind,title,body) values(unit,'document','Test document','Unit-only body') returning id into doc_id;
 insert into public.mrpd_unit_entries(unit_id,kind,title,starts_at,capacity) values(unit,'training','Test training',now()+interval '1 day',1) returning id into training_id;
 perform set_config('request.jwt.claim.sub',b::text,true);
 if exists(select 1 from public.mrpd_unit_entries where unit_id=unit) then raise exception 'Nonmember can read unit entries';end if;
 begin
  perform public.mrpd_unit_command('attendance',jsonb_build_object('entry_id',training_id,'accepted',true));raise exception 'Nonmember can join training';
 exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',a::text,true);
 if (select count(*) from public.mrpd_unit_entries where unit_id=unit)<>3 then raise exception 'Member cannot read workspace';end if;
 begin
  insert into public.mrpd_unit_entries(unit_id,kind,title) values(unit,'document','Unauthorized');raise exception 'Member can create documents';
 exception when insufficient_privilege then null;end;
 update public.mrpd_unit_entries set title='Unauthorized',revision=1 where id=doc_id;
 get diagnostics affected=row_count;if affected<>0 then raise exception 'Member can modify leadership document';end if;
 insert into public.mrpd_unit_entries(unit_id,kind,title) values(unit,'task','Member-created task');
 insert into public.mrpd_unit_comments(entry_id,body) values(task_id,'Test feedback');
 insert into public.mrpd_unit_messages(unit_id,body) values(unit,'Test unit chat');
 perform public.mrpd_unit_command('status',jsonb_build_object('entry_id',task_id,'status','progress','revision',0));
 if (select status from public.mrpd_unit_entries where id=task_id)<>'progress' then raise exception 'Assignee cannot update status';end if;
 begin
  perform public.mrpd_unit_command('status',jsonb_build_object('entry_id',task_id,'status','done','revision',0));raise exception 'Stale status update accepted';
 exception when raise_exception then if sqlerrm='Stale status update accepted' then raise;end if;end;
 begin
  perform public.mrpd_unit_command('memberships',jsonb_build_object('user_id',a,'version',assignment->>'version','units','[]'::jsonb));raise exception 'Member can change memberships';
 exception when insufficient_privilege then null;end;
 perform public.mrpd_unit_command('attendance',jsonb_build_object('entry_id',training_id,'accepted',true));
 perform set_config('request.jwt.claim.sub',lead::text,true);
 assignment:=public.mrpd_unit_command('memberships',jsonb_build_object('user_id',b));
 perform public.mrpd_unit_command('memberships',jsonb_build_object('user_id',b,'version',assignment->>'version','units',jsonb_build_array(jsonb_build_object('id',unit,'role','deputy'))));
 perform set_config('request.jwt.claim.sub',b::text,true);
 update public.mrpd_unit_entries set title='Deputy may edit',revision=revision+1 where id=doc_id;
 get diagnostics affected=row_count;if affected<>1 then raise exception 'Deputy cannot manage unit documents';end if;
 begin
  perform public.mrpd_unit_command('attendance',jsonb_build_object('entry_id',training_id,'accepted',true));raise exception 'Capacity exceeded';
 exception when raise_exception then if sqlerrm='Capacity exceeded' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.mrpd_unit_command('attendance',jsonb_build_object('entry_id',training_id,'accepted',false));
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform public.mrpd_unit_command('attendance',jsonb_build_object('entry_id',training_id,'accepted',true));
 perform set_config('request.jwt.claim.sub',lead::text,true);
 assignment:=public.mrpd_unit_command('memberships',jsonb_build_object('user_id',a));
 perform public.mrpd_unit_command('memberships',jsonb_build_object('user_id',a,'version',assignment->>'version','units','[]'::jsonb));
 perform set_config('request.jwt.claim.sub',a::text,true);
 if exists(select 1 from public.mrpd_unit_entries where unit_id=unit) or exists(select 1 from public.mrpd_unit_messages where unit_id=unit) then raise exception 'Removed member retains access';end if;
end
$$;
select 'Unit RLS, delegation, assignments, conflicts, task status, chat and training capacity passed' as result;
rollback;
