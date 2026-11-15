begin;
create schema if not exists portal_private;
revoke all on schema portal_private from public,anon;
grant usage on schema portal_private to authenticated,service_role;
create or replace function portal_private.hub_rank(v text) returns integer language sql immutable set search_path='' as $$
 select case lower(trim(coalesce(v,''))) when 'recruit' then 0 when 'rekrut' then 0 when 'police officer' then 1 when 'police officer 2' then 2 when 'detective' then 3 when 'sergeant' then 4 when 'sergant' then 4 when 'lieutenant' then 5 when 'captain' then 6 when 'captain 1' then 6 when 'captain 2' then 7 when 'commander' then 7 when 'deputy chief' then 8 when 'assistant chief' then 9 when 'chief of police' then 10 else -1 end
$$;
create or replace function portal_private.hub_member() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid() and account_enabled and archived_at is null and status<>'Archiviert')
$$;
create or replace function portal_private.hub_staff() returns boolean language sql stable security definer set search_path='' as $$
 select portal_private.hub_member() and exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','trainer'))
$$;
create or replace function portal_private.hub_plus() returns boolean language sql stable security definer set search_path='' as $$
 select portal_private.hub_staff() and exists(select 1 from public.profiles where id=auth.uid() and (access_level='extra' or(role='admin' and access_level='owner')))
$$;
create or replace function portal_private.hub_chat() returns boolean language sql stable security definer set search_path='' as $$
 select portal_private.hub_member() and exists(select 1 from public.profiles where id=auth.uid() and portal_private.hub_rank(rank)>=4)
$$;
revoke all on function portal_private.hub_rank(text),portal_private.hub_member(),portal_private.hub_staff(),portal_private.hub_plus(),portal_private.hub_chat() from public,anon;
grant execute on function portal_private.hub_rank(text),portal_private.hub_member(),portal_private.hub_staff(),portal_private.hub_plus(),portal_private.hub_chat() to authenticated,service_role;

create table if not exists public.portal_hub_departments(id uuid primary key default gen_random_uuid(),name text not null check(char_length(name) between 2 and 80),description text not null default '' check(char_length(description)<=1000),updated_at timestamptz not null default now());
create table if not exists public.portal_hub_memberships(id uuid primary key default gen_random_uuid(),department_id uuid not null references public.portal_hub_departments on delete cascade,user_id uuid not null references public.profiles on delete cascade,position text not null default 'Mitglied' check(char_length(position) between 2 and 80),unique(department_id,user_id));
create index if not exists hub_memberships_user on public.portal_hub_memberships(user_id);
create table if not exists public.portal_hub_rank_changes(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles,from_rank text not null,to_rank text not null,direction text not null check(direction in ('up','down')),reason text not null check(char_length(reason) between 3 and 500),actor_id uuid not null references public.profiles,created_at timestamptz not null default now());
create index if not exists hub_rank_changes_date on public.portal_hub_rank_changes(created_at desc);
create index if not exists hub_rank_changes_user on public.portal_hub_rank_changes(user_id);
create table if not exists public.portal_hub_staff_messages(id uuid primary key default gen_random_uuid(),author_id uuid not null references public.profiles,body text not null default '' check(char_length(body)<=4000),image_path text check(char_length(image_path)<=300),created_at timestamptz not null default now(),check(char_length(trim(body))>0 or image_path is not null));
create index if not exists hub_chat_date on public.portal_hub_staff_messages(created_at desc,id);
create index if not exists hub_chat_author on public.portal_hub_staff_messages(author_id);
create table if not exists public.portal_hub_staff_receipts(message_id uuid not null references public.portal_hub_staff_messages on delete cascade,user_id uuid not null references public.profiles on delete cascade,read_at timestamptz not null default now(),primary key(message_id,user_id));
create index if not exists hub_receipts_user on public.portal_hub_staff_receipts(user_id);
create table if not exists public.portal_hub_staff_reactions(message_id uuid not null references public.portal_hub_staff_messages on delete cascade,user_id uuid not null references public.profiles on delete cascade,emoji text not null check(emoji in ('👍','❤️','😂','🎉','✅','👀')),primary key(message_id,user_id,emoji));
create index if not exists hub_reactions_user on public.portal_hub_staff_reactions(user_id);
create table if not exists public.portal_hub_feedback(id uuid primary key default gen_random_uuid(),category text not null check(category in ('Wunsch','Feedback','Kritik')),body text not null check(char_length(trim(body)) between 10 and 4000),status text not null default 'Offen' check(status in ('Offen','Gelesen','Erledigt')),created_at timestamptz not null default now());
create table if not exists portal_private.hub_feedback_limits(user_id uuid primary key references public.profiles on delete cascade,last_at timestamptz not null default now());
create table if not exists public.portal_hub_pd_events(id uuid primary key default gen_random_uuid(),title text not null check(char_length(title) between 3 and 120),starts_at timestamptz not null,ends_at timestamptz,location text not null default '' check(char_length(location)<=200),notes text not null default '' check(char_length(notes)<=2000),author_id uuid not null references public.profiles,created_at timestamptz not null default now(),check(ends_at is null or ends_at>=starts_at));
create index if not exists hub_pd_events_date on public.portal_hub_pd_events(starts_at);
create index if not exists hub_pd_events_author on public.portal_hub_pd_events(author_id);
create table if not exists public.portal_hub_settings(user_id uuid primary key references public.profiles on delete cascade,avatar_path text check(char_length(avatar_path)<=300),sound_enabled boolean not null default true);
create table if not exists public.portal_hub_dismissals(user_id uuid not null references public.profiles on delete cascade,item_key text not null check(char_length(item_key) between 3 and 120),created_at timestamptz not null default now(),primary key(user_id,item_key));
create table if not exists public.portal_hub_activity_days(user_id uuid not null references public.profiles on delete cascade,day date not null,night boolean not null default false,early boolean not null default false,weekend boolean not null default false,primary key(user_id,day));
create table if not exists public.portal_hub_badge_catalog(code text primary key,title text not null,description text not null,metric text not null,target integer not null check(target>0),secret boolean not null default false);
create table if not exists public.portal_hub_badge_awards(user_id uuid not null references public.profiles on delete cascade,code text not null references public.portal_hub_badge_catalog,earned_at timestamptz not null default now(),primary key(user_id,code));

insert into public.portal_hub_badge_catalog values
('days7','Angekommen','An 7 verschiedenen Tagen im Portal aktiv.','days',7,false),('days30','Verlässlich','30 aktive Tage.','days',30,false),('days90','Fester Bestandteil','90 aktive Tage.','days',90,false),('days180','Halbes Dienstjahr','180 aktive Tage.','days',180,false),('days365','Department-Legende','365 aktive Tage.','days',365,false),
('streak3','Im Rhythmus','3 aufeinanderfolgende aktive Tage.','streak',3,false),('streak7','Wochenserie','7 Tage ohne Unterbrechung.','streak',7,false),('streak14','Drangeblieben','14 Tage ohne Unterbrechung.','streak',14,false),('streak30','Eiserne Routine','30 Tage ohne Unterbrechung.','streak',30,false),('streak60','Unerschütterlich','60 Tage ohne Unterbrechung.','streak',60,false),
('cases1','Erste Spur','Eine eigene Vorgangsakte erstellt.','cases',1,false),('cases10','Aktenkundig','10 eigene Vorgangsakten.','cases',10,false),('cases50','Spurensicher','50 eigene Vorgangsakten.','cases',50,false),('cases100','Ermittlungserfahren','100 eigene Vorgangsakten.','cases',100,false),('cases250','Archivprofi','250 eigene Vorgangsakten.','cases',250,false),
('reports1','Wissen weitergeben','Einen FTO-Praxisbericht verfasst.','reports',1,false),('reports10','Begleiter','10 FTO-Praxisberichte.','reports',10,false),('reports50','Mentor','50 FTO-Praxisberichte.','reports',50,false),('reports100','Generationenbegleiter','100 FTO-Praxisberichte.','reports',100,false),
('reads5','Auf dem Laufenden','5 Mitteilungen gelesen.','reads',5,false),('reads25','Gut informiert','25 Mitteilungen gelesen.','reads',25,false),('reads100','Department-Gedächtnis','100 Mitteilungen gelesen.','reads',100,false),
('academy22','Academy-Absolvent','22 Ausbildungskapitel abgeschlossen.','chapters',22,false),('tests5','Theoriesicher','5 unterschiedliche Prüfungen bestanden.','tests',5,false),('notes25','Aufmerksamer Ausbilder','25 Ausbildungsnotizen verfasst.','notes',25,false),('chat30','Teamverbindung','An 30 unterschiedlichen Tagen im Staff Channel geschrieben.','chat_days',30,false),
('night20','Nachtwache','An 20 Tagen zwischen 22 und 5 Uhr aktiv.','night_days',20,true),('early20','Vor Sonnenaufgang','An 20 Tagen zwischen 5 und 8 Uhr aktiv.','early_days',20,true),('weekend30','Wochenendwache','An 30 verschiedenen Wochenendtagen aktiv.','weekend_days',30,true),('veteran365','Ein Jahr Los Santos','Seit mindestens 365 Tagen im Department.','tenure',365,true)
on conflict(code) do update set title=excluded.title,description=excluded.description,metric=excluded.metric,target=excluded.target,secret=excluded.secret;
insert into public.portal_hub_departments(name,description) select name,description from (values ('Field Training Office','Ausbildung und Betreuung der Rekruten'),('Patrol Division','Streifendienst und Einsatzbearbeitung'),('Criminal Investigation Division','Ermittlungen'),('Traffic Division','Verkehrsdienst'),('Dispatch','Leitstelle und Kommunikation'),('Command Staff','Führung und Organisation')) as x(name,description) where not exists(select 1 from public.portal_hub_departments);

do $$ declare t text; begin
 foreach t in array array['portal_hub_departments','portal_hub_memberships','portal_hub_rank_changes','portal_hub_staff_messages','portal_hub_staff_receipts','portal_hub_staff_reactions','portal_hub_feedback','portal_hub_pd_events','portal_hub_settings','portal_hub_dismissals','portal_hub_activity_days','portal_hub_badge_catalog','portal_hub_badge_awards'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 end loop;
end $$;
alter table portal_private.hub_feedback_limits enable row level security;
revoke all on portal_private.hub_feedback_limits from public,anon,authenticated;
grant select,insert,update,delete on public.portal_hub_departments,public.portal_hub_memberships,public.portal_hub_pd_events,public.portal_hub_settings,public.portal_hub_dismissals,public.portal_hub_staff_reactions to authenticated;
grant select,insert on public.portal_hub_staff_messages to authenticated;
grant select,insert,update on public.portal_hub_staff_receipts to authenticated;
grant select,update on public.portal_hub_feedback to authenticated;
grant select on public.portal_hub_rank_changes,public.portal_hub_badge_catalog,public.portal_hub_badge_awards,public.portal_hub_activity_days to authenticated;
grant all on public.portal_hub_departments,public.portal_hub_memberships,public.portal_hub_rank_changes,public.portal_hub_staff_messages,public.portal_hub_staff_receipts,public.portal_hub_staff_reactions,public.portal_hub_feedback,public.portal_hub_pd_events,public.portal_hub_settings,public.portal_hub_dismissals,public.portal_hub_activity_days,public.portal_hub_badge_catalog,public.portal_hub_badge_awards to service_role;

create policy hub_departments_read on public.portal_hub_departments for select to authenticated using ((select portal_private.hub_member()));
create policy hub_departments_write on public.portal_hub_departments for all to authenticated using ((select portal_private.hub_plus())) with check((select portal_private.hub_plus()));
create policy hub_memberships_read on public.portal_hub_memberships for select to authenticated using ((select portal_private.hub_member()));
create policy hub_memberships_write on public.portal_hub_memberships for all to authenticated using ((select portal_private.hub_plus())) with check((select portal_private.hub_plus()));
create policy hub_rank_read on public.portal_hub_rank_changes for select to authenticated using ((select portal_private.hub_member()));
create policy hub_chat_read on public.portal_hub_staff_messages for select to authenticated using ((select portal_private.hub_chat()));
create policy hub_chat_insert on public.portal_hub_staff_messages for insert to authenticated with check((select portal_private.hub_chat()) and author_id=(select auth.uid()) and (image_path is null or split_part(image_path,'/',1)=(select auth.uid())::text));
create policy hub_receipts_read on public.portal_hub_staff_receipts for select to authenticated using ((select portal_private.hub_chat()));
create policy hub_receipts_insert on public.portal_hub_staff_receipts for insert to authenticated with check((select portal_private.hub_chat()) and user_id=(select auth.uid()));
create policy hub_receipts_update on public.portal_hub_staff_receipts for update to authenticated using ((select portal_private.hub_chat()) and user_id=(select auth.uid())) with check((select portal_private.hub_chat()) and user_id=(select auth.uid()));
create policy hub_reactions_read on public.portal_hub_staff_reactions for select to authenticated using ((select portal_private.hub_chat()));
create policy hub_reactions_write on public.portal_hub_staff_reactions for all to authenticated using ((select portal_private.hub_chat()) and user_id=(select auth.uid())) with check((select portal_private.hub_chat()) and user_id=(select auth.uid()));
create policy hub_feedback_read on public.portal_hub_feedback for select to authenticated using ((select portal_private.hub_staff()));
create policy hub_feedback_update on public.portal_hub_feedback for update to authenticated using ((select portal_private.hub_staff())) with check((select portal_private.hub_staff()));
revoke update on public.portal_hub_feedback from authenticated;
grant update(status) on public.portal_hub_feedback to authenticated;
create policy hub_calendar_read on public.portal_hub_pd_events for select to authenticated using ((select portal_private.hub_staff()));
create policy hub_calendar_insert on public.portal_hub_pd_events for insert to authenticated with check((select portal_private.hub_staff()) and author_id=(select auth.uid()));
create policy hub_calendar_update on public.portal_hub_pd_events for update to authenticated using ((select portal_private.hub_staff()) and(author_id=(select auth.uid()) or (select portal_private.hub_plus()))) with check((select portal_private.hub_staff()) and(author_id=(select auth.uid()) or (select portal_private.hub_plus())));
create policy hub_calendar_delete on public.portal_hub_pd_events for delete to authenticated using ((select portal_private.hub_staff()) and(author_id=(select auth.uid()) or (select portal_private.hub_plus())));
create policy hub_settings_own on public.portal_hub_settings for all to authenticated using ((select portal_private.hub_member()) and user_id=(select auth.uid())) with check((select portal_private.hub_member()) and user_id=(select auth.uid()) and (avatar_path is null or split_part(avatar_path,'/',1)=(select auth.uid())::text));
create policy hub_dismissals_own on public.portal_hub_dismissals for all to authenticated using ((select portal_private.hub_member()) and user_id=(select auth.uid())) with check((select portal_private.hub_member()) and user_id=(select auth.uid()));
create policy hub_days_own on public.portal_hub_activity_days for select to authenticated using ((select portal_private.hub_member()) and user_id=(select auth.uid()));
create policy hub_badges_read on public.portal_hub_badge_catalog for select to authenticated using ((select portal_private.hub_member()));
create policy hub_awards_own on public.portal_hub_badge_awards for select to authenticated using ((select portal_private.hub_member()) and user_id=(select auth.uid()));

alter table public.announcement_reads add column if not exists dismissed_at timestamptz;
revoke truncate,references,trigger on public.announcement_reads from anon,authenticated;
grant select,insert,update on public.announcement_reads to authenticated;
grant select,insert,update,delete on public.announcements to authenticated;
drop policy if exists announcements_owner_write on public.announcements;
create policy announcements_staff_insert on public.announcements for insert to authenticated with check((select portal_private.hub_staff()) and author_id=(select auth.uid()));
create policy announcements_staff_update on public.announcements for update to authenticated using ((select portal_private.hub_staff()) and (author_id=(select auth.uid()) or(select portal_private.hub_plus()))) with check((select portal_private.hub_staff()) and (author_id=(select auth.uid()) or(select portal_private.hub_plus())));
create policy announcements_staff_delete on public.announcements for delete to authenticated using ((select portal_private.hub_staff()) and (author_id=(select auth.uid()) or(select portal_private.hub_plus())));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('portal-avatars','portal-avatars',false,3145728,array['image/jpeg','image/png','image/webp']),('portal-staff-images','portal-staff-images',false,8388608,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy hub_avatar_read on storage.objects for select to authenticated using(bucket_id='portal-avatars' and(select portal_private.hub_member()));
create policy hub_avatar_insert on storage.objects for insert to authenticated with check(bucket_id='portal-avatars' and(select portal_private.hub_member()) and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy hub_staff_image_read on storage.objects for select to authenticated using(bucket_id='portal-staff-images' and(select portal_private.hub_chat()));
create policy hub_staff_image_insert on storage.objects for insert to authenticated with check(bucket_id='portal-staff-images' and(select portal_private.hub_chat()) and (storage.foldername(name))[1]=(select auth.uid())::text);

create or replace function portal_private.hub_rpc(p_action text,p_args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();r public.profiles;oldrank text;newrank text;stats jsonb;longest integer;current_streak integer;lastday date;today date:=(now() at time zone 'Europe/Berlin')::date;hr integer:=extract(hour from now() at time zone 'Europe/Berlin');limited uuid;result jsonb;rec uuid;
begin
 if not portal_private.hub_member() then raise exception 'Bitte mit einem aktiven Portalaccount anmelden' using errcode='42501';end if;
 if p_action='directory' then
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'rank',p.rank,'role',p.role,'access',p.access_level,'serviceNo',p.service_no,'avatar_path',s.avatar_path) order by p.name) from public.profiles p left join public.portal_hub_settings s on s.user_id=p.id where p.account_enabled and p.archived_at is null and p.status<>'Archiviert'),'[]'::jsonb);
 elsif p_action='feedback' then
 if coalesce(p_args->>'category','') not in ('Wunsch','Feedback','Kritik') or char_length(trim(coalesce(p_args->>'body','')))<10 or char_length(p_args->>'body')>4000 then raise exception 'Bitte Kategorie und einen Text mit 10 bis 4000 Zeichen angeben';end if;
 insert into portal_private.hub_feedback_limits(user_id,last_at) values(u,now()) on conflict(user_id) do update set last_at=excluded.last_at where portal_private.hub_feedback_limits.last_at<now()-interval '5 minutes' returning user_id into limited;
 if limited is null then raise exception 'Bitte vor der nächsten Rückmeldung 5 Minuten warten';end if;
 insert into public.portal_hub_feedback(category,body) values(p_args->>'category',trim(p_args->>'body')) returning id into rec;return jsonb_build_object('ok',true,'id',rec);
 elsif p_action='rank' then
 if not portal_private.hub_plus() then raise exception 'Nur Ausbilder + dürfen Dienstgrade anpassen' using errcode='42501';end if;
 newrank:=p_args->>'rank';if newrank not in ('Rekrut','Police Officer','Police Officer 2','Detective','Sergeant','Lieutenant','Captain 1','Captain 2','Deputy Chief','Assistant Chief','Chief of Police') then raise exception 'Ungültiger Dienstgrad';end if;
 if char_length(trim(coalesce(p_args->>'reason','')))<3 or char_length(p_args->>'reason')>500 then raise exception 'Bitte eine kurze Begründung angeben';end if;
 select * into r from public.profiles where id=(p_args->>'user_id')::uuid and archived_at is null and status<>'Archiviert' for update;if not found then raise exception 'Aktiver Account nicht gefunden';end if;
 oldrank:=r.rank;if portal_private.hub_rank(oldrank)=portal_private.hub_rank(newrank) then raise exception 'Der Dienstgrad ist bereits vergeben';end if;
 update public.profiles set rank=newrank where id=r.id;
 insert into public.portal_hub_rank_changes(user_id,from_rank,to_rank,direction,reason,actor_id) values(r.id,oldrank,newrank,case when portal_private.hub_rank(newrank)>portal_private.hub_rank(oldrank) then 'up' else 'down' end,trim(p_args->>'reason'),u);
 return jsonb_build_object('ok',true);
 elsif p_action='announcement_read' then
 if not exists(select 1 from public.announcements where id=(p_args->>'id')::bigint) then raise exception 'Mitteilung nicht gefunden';end if;
 insert into public.announcement_reads(announcement_id,user_id,read_at,dismissed_at) values((p_args->>'id')::bigint,u,now(),case when coalesce((p_args->>'dismiss')::boolean,false) then now() end) on conflict(announcement_id,user_id) do update set read_at=excluded.read_at,dismissed_at=coalesce(excluded.dismissed_at,announcement_reads.dismissed_at);
 return jsonb_build_object('ok',true);
 elsif p_action in ('touch','badges') then
 if p_action='touch' then insert into public.portal_hub_activity_days(user_id,day,night,early,weekend) values(u,today,hr>=22 or hr<5,hr>=5 and hr<8,extract(isodow from today)>=6) on conflict(user_id,day) do update set night=portal_hub_activity_days.night or excluded.night,early=portal_hub_activity_days.early or excluded.early;end if;
 select max(day) into lastday from public.portal_hub_activity_days where user_id=u;
 with runs as(select day,day-row_number()over(order by day)::integer g from public.portal_hub_activity_days where user_id=u),counts as(select g,count(*) n,max(day) last from runs group by g) select coalesce(max(n),0),coalesce(max(n) filter(where last=lastday and lastday>=today-1),0) into longest,current_streak from counts;
 stats:=jsonb_build_object('days',(select count(*) from public.portal_hub_activity_days where user_id=u),'streak',longest,'current_streak',current_streak,'cases',(select count(*) from public.apd_evidence_cases where creator_id=u),'reports',(select count(*) from public.field_reports where author_id=u),'reads',(select count(*) from public.announcement_reads where user_id=u),'chapters',(select count(distinct chapter) from public.training_progress where recruit_id=u and completed),'tests',(select count(distinct test_id) from public.test_results where recruit_id=u and passed),'notes',(select count(*) from public.recruit_notes where author_id=u),'chat_days',(select count(distinct(created_at at time zone 'Europe/Berlin')::date) from public.portal_hub_staff_messages where author_id=u),'night_days',(select count(*) from public.portal_hub_activity_days where user_id=u and night),'early_days',(select count(*) from public.portal_hub_activity_days where user_id=u and early),'weekend_days',(select count(*) from public.portal_hub_activity_days where user_id=u and weekend),'tenure',(select greatest(0,today-created_at::date) from public.profiles where id=u));
 insert into public.portal_hub_badge_awards(user_id,code) select u,code from public.portal_hub_badge_catalog where coalesce((stats->>metric)::numeric,0)>=target on conflict do nothing;
 return jsonb_build_object('stats',stats,'awards',coalesce((select jsonb_agg(jsonb_build_object('code',code,'earned_at',earned_at)) from public.portal_hub_badge_awards where user_id=u),'[]'::jsonb));
 else raise exception 'Unbekannte Aktion';end if;
end $$;
revoke all on function portal_private.hub_rpc(text,jsonb) from public,anon;
grant execute on function portal_private.hub_rpc(text,jsonb) to authenticated,service_role;
create or replace function public.portal_hub_rpc(p_action text,p_args jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$ select portal_private.hub_rpc(p_action,p_args) $$;
revoke all on function public.portal_hub_rpc(text,jsonb) from public,anon;
grant execute on function public.portal_hub_rpc(text,jsonb) to authenticated,service_role;

-- The legacy recruit editor must use the same rank authorization and audit path.
create or replace function public.staff_update_recruit(target_id uuid,new_fto text,new_status text,new_rank text) returns void language plpgsql security definer set search_path='' as $$
declare oldrank text;
begin
 if not portal_private.hub_staff() then raise exception 'Keine Berechtigung' using errcode='42501';end if;
 select rank into oldrank from public.profiles where id=target_id and role='recruit';if not found then raise exception 'Rekrut nicht gefunden';end if;
 if coalesce(new_rank,oldrank)<>oldrank then perform portal_private.hub_rpc('rank',jsonb_build_object('user_id',target_id,'rank',new_rank,'reason','Änderung über die Ausbildungsakte'));end if;
 update public.profiles set fto=trim(coalesce(new_fto,'')),status=trim(coalesce(new_status,'In Ausbildung')) where id=target_id and role='recruit';
end $$;
revoke all on function public.staff_update_recruit(uuid,text,text,text) from public,anon;
grant execute on function public.staff_update_recruit(uuid,text,text,text) to authenticated;

do $$ declare t text; begin
 foreach t in array array['portal_hub_staff_messages','portal_hub_staff_receipts','portal_hub_staff_reactions','portal_hub_rank_changes','announcements','academy_messages'] loop
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t);end if;
 end loop;
end $$;
create or replace function public.portal_visible_training_progress() returns table(id bigint,recruit_id uuid,chapter integer,completed boolean,completed_by uuid,completed_at timestamptz) language plpgsql security definer set search_path='' as $$
begin if not portal_private.hub_staff() then raise exception 'Keine Berechtigung' using errcode='42501';end if;
return query select tp.id,tp.recruit_id,tp.chapter,tp.completed,tp.completed_by,tp.completed_at from public.training_progress tp join public.profiles p on p.id=tp.recruit_id where p.role='recruit' order by tp.recruit_id,tp.chapter;end $$;
revoke all on function public.portal_visible_training_progress() from public,anon;
grant execute on function public.portal_visible_training_progress() to authenticated;
create or replace function portal_private.hub_message_stamp() returns trigger language plpgsql set search_path='' as $$ begin new.created_at:=now();return new;end $$;
revoke all on function portal_private.hub_message_stamp() from public,anon,authenticated;
create trigger hub_stamp_chat before insert on public.portal_hub_staff_messages for each row execute function portal_private.hub_message_stamp();
commit;
