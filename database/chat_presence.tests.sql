begin;
insert into auth.users(id,email)values('00000000-0000-4000-8000-00000000d101','presence-rookie@invalid.local'),('00000000-0000-4000-8000-00000000d102','presence-officer@invalid.local'),('00000000-0000-4000-8000-00000000d103','presence-fto@invalid.local'),('00000000-0000-4000-8000-00000000d104','presence-sergeant@invalid.local');
insert into public.profiles(id,username,name,rank,role,access_level,account_enabled,status)values
('00000000-0000-4000-8000-00000000d101','presence-test-rookie','TEST Rookie','Rekrut','recruit','standard',true,'In Ausbildung'),
('00000000-0000-4000-8000-00000000d102','presence-test-officer','TEST Officer','Police Officer','recruit','standard',true,'Officer'),
('00000000-0000-4000-8000-00000000d103','presence-test-fto','TEST FTO','Police Officer','trainer','standard',true,'Ausbilder'),
('00000000-0000-4000-8000-00000000d104','presence-test-sergeant','TEST Sergeant','Sergeant','recruit','standard',true,'Officer');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000d101',true);
select public.portal_chat_members('heartbeat',p_session=>'00000000-0000-4000-8000-00000000d301',p_user=>'00000000-0000-4000-8000-00000000d104');
select public.portal_chat_members('heartbeat',p_session=>'00000000-0000-4000-8000-00000000d302');
select public.portal_chat_members('leave',p_session=>'00000000-0000-4000-8000-00000000d301');
do $$declare m jsonb;begin
 m:=public.portal_chat_members('members','rookie');
 if not exists(select 1 from jsonb_array_elements(m)x where x->>'id'='00000000-0000-4000-8000-00000000d101' and(x->>'online')::boolean)then raise exception 'Multi-tab leave removed online user';end if;
 if not exists(select 1 from jsonb_array_elements(m)x where x->>'id'='00000000-0000-4000-8000-00000000d103')or exists(select 1 from jsonb_array_elements(m)x where x->>'id' in('00000000-0000-4000-8000-00000000d102','00000000-0000-4000-8000-00000000d104'))then raise exception 'Rookie membership list wrong';end if;
 if exists(select 1 from jsonb_array_elements(m)x where x ? 'username' or x ? 'password' or x ? 'last_login')then raise exception 'Private account data exposed';end if;
 if public.portal_chat_members('profile','rookie',p_user=>'00000000-0000-4000-8000-00000000d103')->0->>'name'<>'TEST FTO'then raise exception 'Clickable profile unavailable';end if;
 begin perform public.portal_chat_members('members','staff');raise exception 'Rookie listed Staff members';exception when insufficient_privilege then null;end;
 begin perform public.portal_chat_members('profile','staff',p_user=>'00000000-0000-4000-8000-00000000d104');raise exception 'Rookie queried Staff profile';exception when insufficient_privilege then null;end;
 begin perform 1 from portal_private.chat_presence_sessions;raise exception 'Raw sessions exposed';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000d104',true);
insert into public.portal_hub_staff_messages(author_id,body,channel)values(auth.uid(),'TEST former Staff author','staff');
do $$declare m jsonb;begin m:=public.portal_chat_members('members','officer');if not exists(select 1 from jsonb_array_elements(m)x where x->>'id'='00000000-0000-4000-8000-00000000d102' and not(x->>'online')::boolean)then raise exception 'Offline member missing or forged online';end if;end$$;
reset role;
do $$begin if exists(select 1 from portal_private.chat_presence_sessions where user_id='00000000-0000-4000-8000-00000000d104')then raise exception 'Heartbeat impersonated another user';end if;end$$;
update portal_private.chat_presence_sessions set seen_at=now()-interval '121 seconds' where user_id='00000000-0000-4000-8000-00000000d101';
update public.profiles set rank='Police Officer'where id='00000000-0000-4000-8000-00000000d104';
update public.profiles set rank='Sergeant'where id='00000000-0000-4000-8000-00000000d103';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000d103',true);
do $$declare m jsonb;begin
 m:=public.portal_chat_members('members','rookie');if exists(select 1 from jsonb_array_elements(m)x where x->>'id'='00000000-0000-4000-8000-00000000d101' and(x->>'online')::boolean)then raise exception 'Presence expiration failed';end if;
 m:=public.portal_chat_members('members','staff');if exists(select 1 from jsonb_array_elements(m)x where x->>'id'='00000000-0000-4000-8000-00000000d104')then raise exception 'Downranked user still in Staff roster';end if;
 m:=public.portal_chat_members('profile','staff',p_user=>'00000000-0000-4000-8000-00000000d104');if jsonb_array_length(m)<>1 or (m->0->>'has_access')::boolean then raise exception 'Former author profile handling failed';end if;
end$$;
reset role;
update public.profiles set account_enabled=false where id='00000000-0000-4000-8000-00000000d101';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000d101',true);
do $$begin begin perform public.portal_chat_members('heartbeat',p_session=>'00000000-0000-4000-8000-00000000d301');raise exception 'Disabled account heartbeat accepted';exception when insufficient_privilege then null;end;end$$;
reset role;
set local role anon;
do $$begin begin perform public.portal_chat_members('members','rookie');raise exception 'Anonymous roster accepted';exception when insufficient_privilege then null;end;end$$;
reset role;
rollback;
select 'PASS: channel membership, restricted profiles, safe profile fields, multi-tab presence, spoof prevention, server expiry, downrank, disabled/anonymous users. All fixtures rolled back.' as verification;
