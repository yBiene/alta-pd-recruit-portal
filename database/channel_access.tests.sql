begin;
insert into auth.users(id,email) values
('00000000-0000-4000-8000-00000000e101','channel-rookie@invalid.local'),('00000000-0000-4000-8000-00000000e102','channel-officer@invalid.local'),('00000000-0000-4000-8000-00000000e103','channel-fto@invalid.local'),('00000000-0000-4000-8000-00000000e104','channel-sergeant@invalid.local');
insert into public.profiles(id,username,name,rank,role,access_level,account_enabled,status) values
('00000000-0000-4000-8000-00000000e101','channel-test-rookie','TEST Rookie','Rekrut','recruit','standard',true,'In Ausbildung'),
('00000000-0000-4000-8000-00000000e102','channel-test-officer','TEST Officer','Police Officer','recruit','standard',true,'Officer'),
('00000000-0000-4000-8000-00000000e103','channel-test-fto','TEST FTO','Police Officer','trainer','standard',true,'Ausbilder'),
('00000000-0000-4000-8000-00000000e104','channel-test-sergeant','TEST Sergeant','Sergeant','recruit','standard',true,'Officer');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000e104',true);
insert into public.portal_hub_staff_messages(id,author_id,body,channel) values('00000000-0000-4000-8000-00000000e201',auth.uid(),'TEST staff','staff'),('00000000-0000-4000-8000-00000000e202',auth.uid(),'TEST officer','officer');
insert into public.portal_hub_staff_receipts(message_id,user_id) values('00000000-0000-4000-8000-00000000e201',auth.uid());
insert into public.portal_hub_staff_reactions(message_id,user_id,emoji)values('00000000-0000-4000-8000-00000000e201',auth.uid(),'👍');
insert into storage.objects(bucket_id,name)values('portal-staff-images',auth.uid()||'/staff/channel-test.webp'),('portal-staff-images',auth.uid()||'/officer/channel-test.webp');
do $$begin if portal_private.hub_channel_access('rookie') then raise exception 'Non-FTO Sergeant entered Rookie';end if;end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000e101',true);
insert into public.portal_hub_staff_messages(id,author_id,body,channel)values('00000000-0000-4000-8000-00000000e203',auth.uid(),'TEST rookie','rookie');
insert into storage.objects(bucket_id,name)values('portal-staff-images',auth.uid()||'/rookie/channel-test.webp');
do $$begin
 if not portal_private.hub_channel_access('rookie') or portal_private.hub_channel_access('officer') or portal_private.hub_channel_access('staff')then raise exception 'Rookie access wrong';end if;
 if exists(select 1 from public.portal_hub_staff_messages where id in ('00000000-0000-4000-8000-00000000e201','00000000-0000-4000-8000-00000000e202'))then raise exception 'Rookie read restricted message';end if;
 if exists(select 1 from public.portal_hub_staff_receipts where message_id='00000000-0000-4000-8000-00000000e201') or exists(select 1 from public.portal_hub_staff_reactions where message_id='00000000-0000-4000-8000-00000000e201')then raise exception 'Restricted reactions or readers leaked';end if;
 if exists(select 1 from storage.objects where name like '%/staff/channel-test.webp' or name like '%/officer/channel-test.webp')then raise exception 'Restricted images leaked';end if;
 begin insert into public.portal_hub_staff_messages(author_id,body,channel)values(auth.uid(),'forbidden','staff');raise exception 'Rookie posted to Staff';exception when insufficient_privilege then null;end;
 begin insert into public.portal_hub_staff_receipts(message_id,user_id)values('00000000-0000-4000-8000-00000000e201',auth.uid());raise exception 'Rookie marked Staff read';exception when insufficient_privilege then null;end;
 begin insert into public.portal_hub_staff_reactions(message_id,user_id,emoji)values('00000000-0000-4000-8000-00000000e201',auth.uid(),'👍');raise exception 'Rookie reacted to Staff';exception when insufficient_privilege then null;end;
 begin insert into storage.objects(bucket_id,name)values('portal-staff-images',auth.uid()||'/staff/forbidden.webp');raise exception 'Rookie uploaded Staff image';exception when insufficient_privilege then null;end;
 begin insert into public.portal_hub_staff_messages(author_id,body,channel,image_path)values(auth.uid(),'wrong channel','rookie',auth.uid()||'/staff/channel-test.webp');raise exception 'Cross-channel image accepted';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000e102',true);
do $$begin
 if not portal_private.hub_channel_access('officer') or portal_private.hub_channel_access('rookie') or portal_private.hub_channel_access('staff')then raise exception 'Officer access wrong';end if;
 if not exists(select 1 from public.portal_hub_staff_messages where id='00000000-0000-4000-8000-00000000e202') or exists(select 1 from public.portal_hub_staff_messages where id in ('00000000-0000-4000-8000-00000000e201','00000000-0000-4000-8000-00000000e203'))then raise exception 'Officer message isolation wrong';end if;
end$$;
insert into public.portal_hub_staff_messages(author_id,body,channel)values(auth.uid(),'TEST Officer can write','officer');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000e103',true);
do $$begin
 if not portal_private.hub_channel_access('rookie') or not portal_private.hub_channel_access('officer') or portal_private.hub_channel_access('staff')then raise exception 'FTO access wrong';end if;
 if not exists(select 1 from public.portal_hub_staff_messages where id='00000000-0000-4000-8000-00000000e203')then raise exception 'FTO cannot read Rookie';end if;
end$$;
insert into public.portal_hub_staff_messages(author_id,body,channel)values(auth.uid(),'TEST FTO can write','rookie');
reset role;
update public.profiles set rank='Police Officer' where id='00000000-0000-4000-8000-00000000e104';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000e104',true);
do $$begin if exists(select 1 from public.portal_hub_staff_messages where id='00000000-0000-4000-8000-00000000e201')then raise exception 'Downrank left Staff access';end if;end$$;
reset role;
update public.profiles set account_enabled=false where id='00000000-0000-4000-8000-00000000e101';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000e101',true);
do $$begin if portal_private.hub_channel_access('rookie') or exists(select 1 from public.portal_hub_staff_messages where id='00000000-0000-4000-8000-00000000e203')then raise exception 'Disabled account retained chat';end if;end$$;
reset role;
rollback;
select 'PASS: Rookie, Officer, FTO, Sergeant, messages, writes, reactions, read receipts, private images, downrank and disabled account isolation. Test data rolled back.' as verification;
