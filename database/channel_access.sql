begin;
alter table public.portal_hub_staff_messages add column if not exists channel text not null default 'staff' check(channel in ('staff','officer','rookie'));
create index if not exists hub_chat_channel_date on public.portal_hub_staff_messages(channel,created_at desc,id);
create or replace function portal_private.hub_channel_access(p_channel text) returns boolean language sql stable security definer set search_path='' as $$
 select portal_private.hub_member() and exists(select 1 from public.profiles p where p.id=auth.uid() and case p_channel
 when 'staff' then portal_private.hub_rank(p.rank)>=4
 when 'officer' then portal_private.hub_rank(p.rank)>=1
 when 'rookie' then p.role in ('admin','trainer') or (p.role='recruit' and portal_private.hub_rank(p.rank)=0)
 else false end)
$$;
revoke all on function portal_private.hub_channel_access(text) from public,anon;
grant execute on function portal_private.hub_channel_access(text) to authenticated,service_role;
-- Existing objects have user/file paths and belong to Staff. New objects use user/channel/file.
create or replace function portal_private.hub_image_channel(p_path text) returns text language sql immutable set search_path='' as $$
 select case when split_part(p_path,'/',3)='' then 'staff' else split_part(p_path,'/',2) end
$$;
revoke all on function portal_private.hub_image_channel(text) from public,anon;
grant execute on function portal_private.hub_image_channel(text) to authenticated,service_role;
drop policy hub_chat_read on public.portal_hub_staff_messages;
create policy hub_chat_read on public.portal_hub_staff_messages for select to authenticated using(portal_private.hub_channel_access(channel));
drop policy hub_chat_insert on public.portal_hub_staff_messages;
create policy hub_chat_insert on public.portal_hub_staff_messages for insert to authenticated with check(portal_private.hub_channel_access(channel) and author_id=(select auth.uid()) and(image_path is null or(split_part(image_path,'/',1)=(select auth.uid())::text and portal_private.hub_image_channel(image_path)=channel)));
drop policy hub_receipts_read on public.portal_hub_staff_receipts;
create policy hub_receipts_read on public.portal_hub_staff_receipts for select to authenticated using(exists(select 1 from public.portal_hub_staff_messages m where m.id=message_id));
drop policy hub_receipts_insert on public.portal_hub_staff_receipts;
create policy hub_receipts_insert on public.portal_hub_staff_receipts for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.portal_hub_staff_messages m where m.id=message_id));
drop policy hub_receipts_update on public.portal_hub_staff_receipts;
create policy hub_receipts_update on public.portal_hub_staff_receipts for update to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.portal_hub_staff_messages m where m.id=message_id)) with check(user_id=(select auth.uid()) and exists(select 1 from public.portal_hub_staff_messages m where m.id=message_id));
drop policy hub_reactions_read on public.portal_hub_staff_reactions;
create policy hub_reactions_read on public.portal_hub_staff_reactions for select to authenticated using(exists(select 1 from public.portal_hub_staff_messages m where m.id=message_id));
drop policy hub_reactions_write on public.portal_hub_staff_reactions;
create policy hub_reactions_write on public.portal_hub_staff_reactions for all to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.portal_hub_staff_messages m where m.id=message_id)) with check(user_id=(select auth.uid()) and exists(select 1 from public.portal_hub_staff_messages m where m.id=message_id));
drop policy hub_staff_image_read on storage.objects;
create policy hub_staff_image_read on storage.objects for select to authenticated using(bucket_id='portal-staff-images' and portal_private.hub_channel_access(portal_private.hub_image_channel(name)));
drop policy hub_staff_image_insert on storage.objects;
create policy hub_staff_image_insert on storage.objects for insert to authenticated with check(bucket_id='portal-staff-images' and portal_private.hub_channel_access(portal_private.hub_image_channel(name)) and(storage.foldername(name))[1]=(select auth.uid())::text);
commit;
