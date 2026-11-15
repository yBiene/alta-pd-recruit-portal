-- Append inside a transaction after the migration; all fixtures roll back.
insert into auth.users(id,email) values('00000000-0000-4000-8000-00000000f201','visibility-new@invalid.local'),('00000000-0000-4000-8000-00000000f202','visibility-old@invalid.local');
insert into public.profiles(id,username,name,rank,role,access_level,created_at) values
('00000000-0000-4000-8000-00000000f201','visibility-test-new','TEST New','Sergeant','trainer','standard',now()-interval '1 hour'),
('00000000-0000-4000-8000-00000000f202','visibility-test-old','TEST Old','Rekrut','recruit','standard',now()-interval '10 days');
insert into public.announcements(title,body,author_id,author_name,created_at) values
('JOIN_QA_OLD','TEST','00000000-0000-4000-8000-00000000f202','TEST',now()-interval '2 hours'),
('JOIN_QA_NEW','TEST','00000000-0000-4000-8000-00000000f202','TEST',now()-interval '30 minutes');
select set_config('qa.old_announcement',(select id::text from public.announcements where title='JOIN_QA_OLD'),true);
insert into public.training_events(title,starts_at,created_by) values('JOIN_QA_OLD',now()-interval '2 hours','00000000-0000-4000-8000-00000000f201'),('JOIN_QA_NEW',now()+interval '1 day','00000000-0000-4000-8000-00000000f201');
insert into public.academy_appointments(recruit_id,title,starts_at) values('00000000-0000-4000-8000-00000000f202','JOIN_QA_OLD',now()-interval '2 hours'),('00000000-0000-4000-8000-00000000f202','JOIN_QA_NEW',now()+interval '1 day');
insert into public.portal_hub_pd_events(title,starts_at,author_id) values('JOIN_QA_OLD',now()-interval '2 hours','00000000-0000-4000-8000-00000000f201'),('JOIN_QA_NEW',now()+interval '1 day','00000000-0000-4000-8000-00000000f201');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000f201',true);
do $$ begin
 if (select count(*) from public.announcements where title like 'JOIN_QA_%')<>1 then raise exception 'New account saw old announcements';end if;
 if (select count(*) from public.training_events where title like 'JOIN_QA_%')<>1 then raise exception 'New account saw old training events';end if;
 if (select count(*) from public.academy_appointments where title like 'JOIN_QA_%')<>1 then raise exception 'New account saw old appointments';end if;
 if (select count(*) from public.portal_hub_pd_events where title like 'JOIN_QA_%')<>1 then raise exception 'New account saw old PD events';end if;
 begin perform public.portal_hub_rpc('announcement_read',jsonb_build_object('id',current_setting('qa.old_announcement')));raise exception 'Guard failure';exception when others then if sqlerrm='Guard failure' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000f202',true);
do $$ begin
 if (select count(*) from public.announcements where title like 'JOIN_QA_%')<>2 then raise exception 'Existing member lost announcement history';end if;
 if (select count(*) from public.training_events where title like 'JOIN_QA_%')<>2 then raise exception 'Existing member lost event history';end if;
 if exists(select 1 from public.portal_hub_pd_events where title like 'JOIN_QA_%') then raise exception 'Recruit received PD calendar';end if;
end $$;
reset role;
select 'PASS: account creation cutoff, future appointments, existing history and private calendar; all fixtures rolled back.' as verification;
rollback;
