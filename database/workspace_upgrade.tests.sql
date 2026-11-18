begin;
insert into auth.users(id,email)values('00000000-0000-4000-8000-00000000c101','workspace-rookie@invalid.local'),('00000000-0000-4000-8000-00000000c102','workspace-trainer@invalid.local'),('00000000-0000-4000-8000-00000000c103','workspace-plus@invalid.local');
insert into public.profiles(id,username,name,rank,role,access_level,status,account_enabled)values
('00000000-0000-4000-8000-00000000c101','workspace-rookie','TEST Rookie','Rekrut','recruit','standard','In Ausbildung',true),
('00000000-0000-4000-8000-00000000c102','workspace-trainer','TEST Trainer','Police Officer','trainer','standard','Ausbilder',true),
('00000000-0000-4000-8000-00000000c103','workspace-plus','TEST Plus','Sergeant','trainer','extra','Ausbilder +',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000c102',true);
do $$begin begin insert into public.portal_hub_departments(name)values('Forbidden');raise exception 'Standard trainer edited departments';exception when insufficient_privilege then null;end;end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000c103',true);
insert into public.portal_hub_departments(id,name,color)values('00000000-0000-4000-8000-00000000c201','TEST Leitung','#e6b65c');
insert into public.portal_hub_departments(id,name,parent_id,color)values('00000000-0000-4000-8000-00000000c202','TEST Patrol','00000000-0000-4000-8000-00000000c201','#398fc2');
insert into public.portal_hub_memberships(department_id,user_id,position)values('00000000-0000-4000-8000-00000000c202','00000000-0000-4000-8000-00000000c102','Leitung');
do $$declare blocked boolean:=false;m jsonb;begin
 begin update public.portal_hub_departments set parent_id='00000000-0000-4000-8000-00000000c202'where id='00000000-0000-4000-8000-00000000c201';exception when raise_exception then blocked:=true;end;if not blocked then raise exception 'Department cycle accepted';end if;
 m:=public.portal_chat_members('members','rookie');if not exists(select 1 from jsonb_array_elements(m)x where x->>'id'='00000000-0000-4000-8000-00000000c102'and x->'departments'->0->>'name'='TEST Patrol')then raise exception 'Member department missing';end if;
end$$;
reset role;
insert into public.apd_evidence_cases(id,name,number,creator_id,creator)values('00000000-0000-4000-8000-00000000c301','TEST Bildlöschung','WORKSPACE-TEST-C301','00000000-0000-4000-8000-00000000c103','TEST Plus');
insert into public.apd_evidence_images(id,case_id,path,title,original_name,mime,bytes,sha256,uploaded_by,uploaded_by_name)values('00000000-0000-4000-8000-00000000c302','00000000-0000-4000-8000-00000000c301','00000000-0000-4000-8000-00000000c103/00000000-0000-4000-8000-00000000c301/00000000-0000-4000-8000-00000000c302.png','TEST Bild','test.png','image/png',1000,repeat('a',64),'00000000-0000-4000-8000-00000000c103','TEST Plus');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000c103',true);
select public.apd_evidence_image_state('00000000-0000-4000-8000-00000000c302',1,false);
do $$declare d jsonb;begin d:=public.apd_evidence_detail('00000000-0000-4000-8000-00000000c301');if jsonb_array_length(d->'images')<>0 then raise exception 'Deleted image still in detail';end if;if(d->'record'->>'version')::int<>2 then raise exception 'Image deletion version missing';end if;if not exists(select 1 from jsonb_array_elements(d->'history')h where h->>'action'='Beweisbild gelöscht')then raise exception 'Image removal not audited';end if;
 begin perform public.apd_evidence_image_state('00000000-0000-4000-8000-00000000c302',1,true);raise exception 'Stale evidence version accepted';exception when serialization_failure then null;end;
end$$;
select public.apd_evidence_image_state('00000000-0000-4000-8000-00000000c302',2,true);
do $$begin if jsonb_array_length(public.apd_evidence_detail('00000000-0000-4000-8000-00000000c301')->'images')<>1 then raise exception 'Image restore failed';end if;end$$;
insert into public.portal_hub_pd_events(id,title,starts_at,author_id)values
('00000000-0000-4000-8000-00000000c401','TEST 60 minute reminder',now()+interval '59 minutes 30 seconds',auth.uid()),
('00000000-0000-4000-8000-00000000c402','TEST 30 minute reminder',now()+interval '29 minutes 30 seconds',auth.uid());
reset role;
select portal_private.queue_calendar_reminders();select portal_private.queue_calendar_reminders();
do $$begin
 if(select count(*)from public.portal_event_reminders where user_id='00000000-0000-4000-8000-00000000c102'and event_id in('00000000-0000-4000-8000-00000000c401','00000000-0000-4000-8000-00000000c402'))<>2 then raise exception 'Reminder thresholds or deduplication wrong';end if;
 if exists(select 1 from public.portal_event_reminders where user_id='00000000-0000-4000-8000-00000000c101'and event_id in('00000000-0000-4000-8000-00000000c401','00000000-0000-4000-8000-00000000c402'))then raise exception 'PD reminders leaked to Rookie';end if;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000c102',true);
do $$begin if exists(select 1 from public.portal_event_reminders where user_id<>'00000000-0000-4000-8000-00000000c102')then raise exception 'Cross-user reminder leak';end if;end$$;
update public.portal_event_reminders set read_at=now()where event_id='00000000-0000-4000-8000-00000000c401';
reset role;
update public.portal_hub_pd_events set starts_at=now()+interval '90 minutes'where id='00000000-0000-4000-8000-00000000c401';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000c102',true);
do $$begin if exists(select 1 from public.portal_event_reminders where event_id='00000000-0000-4000-8000-00000000c401')then raise exception 'Obsolete reminder still visible after reschedule';end if;end$$;
reset role;
set local role anon;
do $$begin begin perform public.portal_member_statuses();raise exception 'Anonymous presence accepted';exception when insufficient_privilege then null;end;end$$;
reset role;
rollback;
select 'PASS: editable hierarchy, cycle prevention, member division labels, reversible evidence removal with audit/concurrency, 60/30 reminders, deduplication, rescheduling and per-user access. All fixtures rolled back.'as verification;
