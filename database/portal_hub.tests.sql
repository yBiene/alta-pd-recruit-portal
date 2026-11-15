-- Run after the schema inside the SAME transaction; always roll back.
insert into auth.users(id,email) values
('00000000-0000-4000-8000-00000000f101','hub-recruit-test@invalid.local'),
('00000000-0000-4000-8000-00000000f102','hub-trainer-test@invalid.local'),
('00000000-0000-4000-8000-00000000f103','hub-plus-test@invalid.local'),
('00000000-0000-4000-8000-00000000f104','hub-sergeant-test@invalid.local');
insert into public.profiles(id,username,name,rank,role,access_level) values
('00000000-0000-4000-8000-00000000f101','hub-test-recruit','TEST Rekrut','Rekrut','recruit','standard'),
('00000000-0000-4000-8000-00000000f102','hub-test-trainer','TEST Ausbilder','Police Officer','trainer','standard'),
('00000000-0000-4000-8000-00000000f103','hub-test-plus','TEST Ausbilder Plus','Sergeant','trainer','extra'),
('00000000-0000-4000-8000-00000000f104','hub-test-sergeant','TEST Sergeant','Sergeant','trainer','standard');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000f104',true);
insert into public.portal_hub_staff_messages(id,author_id,body,created_at) values('00000000-0000-4000-8000-00000000f201',auth.uid(),'Testnachricht',now()-interval '60 days');
do $$begin if not portal_private.hub_chat() then raise exception 'Sergeant chat denied';end if;if exists(select 1 from public.portal_hub_staff_messages where id='00000000-0000-4000-8000-00000000f201' and created_at<now()-interval '1 hour')then raise exception 'Historical message timestamp accepted';end if;end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000f101',true);
do $$begin
 if portal_private.hub_staff() or portal_private.hub_plus() or portal_private.hub_chat()then raise exception 'Recruit rights escalated';end if;
 if exists(select 1 from public.portal_hub_staff_messages)then raise exception 'Staff messages leaked';end if;
 if exists(select 1 from public.portal_hub_pd_events)then raise exception 'PD events leaked';end if;
 begin insert into public.portal_hub_staff_messages(author_id,body)values(auth.uid(),'forbidden');raise exception 'Recruit chat insert accepted';exception when insufficient_privilege then null;end;
 begin insert into public.portal_hub_departments(name)values('forbidden');raise exception 'Recruit department write accepted';exception when insufficient_privilege then null;end;
 begin perform public.portal_hub_rpc('rank','{"user_id":"00000000-0000-4000-8000-00000000f101","rank":"Chief of Police","reason":"forbidden"}');raise exception 'Recruit rank change accepted';exception when insufficient_privilege then null;end;
 perform public.portal_hub_rpc('feedback','{"category":"Feedback","body":"Anonyme Test-Rückmeldung ohne Personendaten"}');
 if exists(select 1 from public.portal_hub_feedback)then raise exception 'Recruit feedback inbox leaked';end if;
 perform public.portal_hub_rpc('touch');perform public.portal_hub_rpc('touch');
 if(select count(*) from public.portal_hub_activity_days where user_id=auth.uid())<>1 then raise exception 'Duplicate daily credit';end if;
 begin insert into public.portal_hub_activity_days(user_id,day)values(auth.uid(),current_date-1);raise exception 'Client backdate accepted';exception when insufficient_privilege then null;end;
 begin insert into public.portal_hub_badge_awards(user_id,code)values(auth.uid(),'days365');raise exception 'Client badge award accepted';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000f102',true);
do $$begin
 if not portal_private.hub_staff() or portal_private.hub_plus() or portal_private.hub_chat()then raise exception 'Standard trainer scope wrong';end if;
 if exists(select 1 from public.portal_hub_staff_messages)then raise exception 'Officer below Sergeant read Staff Channel';end if;
 if not exists(select 1 from public.portal_hub_feedback)then raise exception 'Trainer cannot read anonymous feedback';end if;
 begin perform public.portal_hub_rpc('rank','{"user_id":"00000000-0000-4000-8000-00000000f102","rank":"Sergeant","reason":"forbidden"}');raise exception 'Standard trainer self promotion accepted';exception when insufficient_privilege then null;end;
end$$;
insert into public.portal_hub_pd_events(title,starts_at,author_id) values('TEST interner Termin',now()+interval '1 day',auth.uid());
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000f101',true);
do $$begin if exists(select 1 from public.portal_hub_pd_events where title='TEST interner Termin')then raise exception 'Private calendar leaked';end if;end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000f103',true);
insert into public.portal_hub_departments(name)values('TEST Abteilung');
select public.portal_hub_rpc('rank','{"user_id":"00000000-0000-4000-8000-00000000f103","rank":"Lieutenant","reason":"Test einer eigenen Beförderung"}');
do $$begin
 if not exists(select 1 from public.portal_hub_rank_changes where user_id=auth.uid() and from_rank='Sergeant' and to_rank='Lieutenant' and direction='up' and actor_id=auth.uid())then raise exception 'Rank event missing';end if;
 begin insert into public.portal_hub_staff_receipts(message_id,user_id)values('00000000-0000-4000-8000-00000000f201','00000000-0000-4000-8000-00000000f104');raise exception 'Forged read receipt accepted';exception when insufficient_privilege then null;end;
end$$;
insert into public.portal_hub_staff_receipts(message_id,user_id)values('00000000-0000-4000-8000-00000000f201',auth.uid());
select public.portal_hub_rpc('rank','{"user_id":"00000000-0000-4000-8000-00000000f103","rank":"Police Officer","reason":"Test der sofortigen Rechteprüfung nach Downrank"}');
do $$begin if portal_private.hub_chat() or exists(select 1 from public.portal_hub_staff_messages)then raise exception 'Staff channel still visible after downrank';end if;end$$;
reset role;
do $$begin
 if(select count(*) from public.portal_hub_badge_catalog)<>30 then raise exception 'Badge count wrong';end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='portal_hub_feedback' and column_name in ('user_id','sender_id','author_id','sender_name','account_id'))then raise exception 'Feedback stores identity';end if;
end$$;
set local role anon;
do $$begin begin perform public.portal_hub_rpc('directory');raise exception 'Anonymous RPC accepted';exception when insufficient_privilege then null;end;end$$;
reset role;
rollback;
select 'PASS: recruit/staff/plus/rank gates, anonymous feedback, PD privacy, read receipts, timestamp protection and badge integrity. All test data rolled back.' as verification;
