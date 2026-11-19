-- Integration fixtures are transactional and leave no accounts, records or alerts behind.
begin;
select set_config('mrpd.ops_test_actors',jsonb_build_object(
 'plus',(select id from public.profiles where account_enabled and archived_at is null and account_type in ('management','owner') order by account_type limit 1),
 'members',(select jsonb_agg(id) from (select id from public.profiles where account_enabled and archived_at is null and status<>'Archiviert' and account_type='employee' order by id limit 3) x)
)::text,true);
set local role authenticated;
do $$
declare actors jsonb:=current_setting('mrpd.ops_test_actors')::jsonb; main uuid; a uuid; b uuid; outsider uuid; unit uuid; destination uuid; assignments jsonb; data jsonb; r jsonb; asset uuid:=gen_random_uuid(); first_checkout uuid:=gen_random_uuid(); second_checkout uuid:=gen_random_uuid(); secret uuid:=gen_random_uuid(); absence uuid:=gen_random_uuid(); application uuid:=gen_random_uuid(); skill uuid:=gen_random_uuid(); file_id uuid:=gen_random_uuid(); doc_id uuid; revision int; shift_id uuid; promo uuid:=gen_random_uuid(); source_unit uuid;
begin
 main:=(actors->>'plus')::uuid;a:=(actors->'members'->>0)::uuid;b:=(actors->'members'->>1)::uuid;outsider:=(actors->'members'->>2)::uuid;
 if outsider is null or main is null then raise exception 'Four existing active actors required';end if;
 perform set_config('request.jwt.claim.sub',main::text,true);
 insert into public.portal_hub_departments(name,workspace_kind) values('Operations rollback','custom') returning id into unit;
 insert into public.portal_hub_departments(name,workspace_kind) values('Destination rollback','custom') returning id into destination;
 assignments:=public.mrpd_unit_command('memberships',jsonb_build_object('user_id',a));
 perform public.mrpd_unit_command('memberships',jsonb_build_object('user_id',a,'version',assignments->>'version','units',jsonb_build_array(jsonb_build_object('id',unit,'role','lead'))));
 assignments:=public.mrpd_unit_command('memberships',jsonb_build_object('user_id',b));
 perform public.mrpd_unit_command('memberships',jsonb_build_object('user_id',b,'version',assignments->>'version','units',jsonb_build_array(jsonb_build_object('id',unit,'role','member'))));
 insert into public.mrpd_unit_entries(unit_id,kind,title) values(unit,'document','Private document') returning id into doc_id;
 -- Manager creates one serialised vehicle. Other accounts cannot modify inventory.
 perform set_config('request.jwt.claim.sub',a::text,true);
 r:=public.mrpd_ops_command('save',asset,0,jsonb_build_object('kind','vehicle','unit_id',unit,'title','Rollback vehicle','fields',jsonb_build_object('plate','TEST','availability','available')));
 if r->>'status'<>'active' then raise exception 'Vehicle not active';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 begin
  perform public.mrpd_ops_command('save',gen_random_uuid(),0,jsonb_build_object('kind','equipment','unit_id',unit,'title','Unauthorized'));raise exception 'Member created inventory';
 exception when insufficient_privilege then null;end;
 begin
  update public.mrpd_ops_records set title='Bypass' where id=asset;raise exception 'Direct update bypass';
 exception when insufficient_privilege then null;end;
 -- A protected complaint is visible only to author, subject and portal management.
 perform public.mrpd_ops_command('save',secret,0,jsonb_build_object('kind','ia','unit_id',unit,'title','Protected rollback complaint','subject_id',b));
 perform set_config('request.jwt.claim.sub',a::text,true);
 if exists(select 1 from public.mrpd_ops_records where id=secret) then raise exception 'Unit lead read protected complaint';end if;
 perform set_config('request.jwt.claim.sub',main::text,true);
 perform public.mrpd_ops_command('comment',secret,0,'{"body":"Internal investigation","internal":true}');
 perform set_config('request.jwt.claim.sub',b::text,true);
 if exists(select 1 from public.mrpd_ops_events where record_id=secret and internal) then raise exception 'Internal event leaked to subject';end if;
 perform public.mrpd_ops_command('comment',secret,0,'{"body":"Stellungnahme / Einspruch"}');
 -- Draft leave is private. Rejected leave can be corrected and resubmitted.
 r:=public.mrpd_ops_command('save',absence,0,jsonb_build_object('kind','absence','unit_id',unit,'title','Leave rollback','fields',jsonb_build_object('from',current_date,'to',current_date+2)));
 perform set_config('request.jwt.claim.sub',a::text,true);
 if not exists(select 1 from public.mrpd_ops_records where id=absence) then raise exception 'Unit lead cannot review leave';end if;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 if exists(select 1 from public.mrpd_ops_records where id=asset or id=absence or id=secret) then raise exception 'Outsider read protected unit data';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 r:=public.mrpd_ops_command('transition',absence,0,'{"status":"submitted"}');
 perform set_config('request.jwt.claim.sub',a::text,true);
 r:=public.mrpd_ops_command('transition',absence,1,'{"status":"rejected","body":"Bitte präzisieren"}');
 perform set_config('request.jwt.claim.sub',b::text,true);
 r:=public.mrpd_ops_command('save',absence,2,jsonb_build_object('title','Leave revised','body','Corrected','fields',jsonb_build_object('from',current_date,'to',current_date+1)));
 r:=public.mrpd_ops_command('transition',absence,3,'{"status":"submitted"}');
 perform set_config('request.jwt.claim.sub',a::text,true);
 r:=public.mrpd_ops_command('transition',absence,4,'{"status":"approved"}');
 if r->>'status'<>'approved' then raise exception 'Leave not approved';end if;
 -- Unique asset availability and server-side return, stale updates are rejected.
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform public.mrpd_ops_command('save',first_checkout,0,jsonb_build_object('kind','checkout','unit_id',unit,'title','First checkout','fields',jsonb_build_object('asset_id',asset)));
 perform public.mrpd_ops_command('transition',first_checkout,0,'{"status":"submitted"}');
 perform public.mrpd_ops_command('save',second_checkout,0,jsonb_build_object('kind','checkout','unit_id',unit,'title','Second checkout','fields',jsonb_build_object('asset_id',asset)));
 perform public.mrpd_ops_command('transition',second_checkout,0,'{"status":"submitted"}');
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.mrpd_ops_command('transition',first_checkout,1,'{"status":"approved"}');
 begin
  perform public.mrpd_ops_command('transition',second_checkout,1,'{"status":"approved"}');raise exception 'Double checkout allowed';
 exception when unique_violation then null;end;
 begin
  perform public.mrpd_ops_command('transition',first_checkout,1,'{"status":"closed"}');raise exception 'Stale checkout accepted';
 exception when serialization_failure then null;end;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform public.mrpd_ops_command('transition',first_checkout,2,'{"status":"closed"}');
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.mrpd_ops_command('transition',second_checkout,1,'{"status":"approved"}');
 -- One active clock per account, actual server duration, no forged records.
 perform set_config('request.jwt.claim.sub',b::text,true);
 r:=public.mrpd_ops_command('clock_in',null,0,jsonb_build_object('unit_id',unit));shift_id:=(r->>'id')::uuid;
 begin
  perform public.mrpd_ops_command('clock_in');raise exception 'Second active clock allowed';
 exception when unique_violation then null;end;
 r:=public.mrpd_ops_command('transition',shift_id,0,'{"status":"closed"}');
 if r->>'status'<>'closed' or r->'fields'->>'ended_at' is null or (r->'fields'->>'seconds')::int<0 then raise exception 'Clock end invalid';end if;
 -- Unit leads can recommend, management applies the final membership atomically.
 r:=public.mrpd_ops_command('save',application,0,jsonb_build_object('kind','application','unit_id',unit,'subject_id',outsider,'title','Unit application'));
 if r->>'subject_id'<>b::text then raise exception 'Applicant impersonated another account';end if;
 perform public.mrpd_ops_command('transition',application,0,'{"status":"submitted"}');
 perform set_config('request.jwt.claim.sub',a::text,true);
 r:=public.mrpd_ops_command('transition',application,1,'{"status":"approved"}');
 if r->>'status'<>'reviewed' then raise exception 'Unit lead bypassed final approval';end if;
 begin
  perform public.mrpd_ops_command('apply',application,2);raise exception 'Unit lead applied membership';
 exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',main::text,true);
 r:=public.mrpd_ops_command('transition',application,2,'{"status":"approved"}');
 r:=public.mrpd_ops_command('apply',application,3);
 if r->>'applied_at' is null then raise exception 'Membership not applied';end if;
 r:=public.mrpd_ops_command('apply',application,4);
 if not exists(select 1 from public.portal_hub_memberships where department_id=unit and user_id=b) then raise exception 'Membership missing';end if;
 -- A demotion cannot be disguised as a promotion.
 perform public.mrpd_ops_command('save',promo,0,jsonb_build_object('kind','promotion','title','Invalid promotion','subject_id',b,'fields',jsonb_build_object('rank',(select rank from public.profiles where id=b))));
 perform public.mrpd_ops_command('transition',promo,0,'{"status":"submitted"}');perform public.mrpd_ops_command('transition',promo,1,'{"status":"approved"}');
 begin
  perform public.mrpd_ops_command('apply',promo,2);raise exception 'Same rank promotion applied';
 exception when raise_exception then if sqlerrm='Same rank promotion applied' then raise;end if;end;
 -- Private attachments require target permission and actual object metadata.
 r:=public.mrpd_file_command('prepare',file_id,jsonb_build_object('target_type','entry','target_id',doc_id,'name','Test.pdf','mime','application/pdf','bytes',123));
 begin
  perform public.mrpd_file_command('finish',file_id);raise exception 'Unuploaded attachment finalized';
 exception when raise_exception then if sqlerrm='Unuploaded attachment finalized' then raise;end if;end;
 perform set_config('mrpd.ops_file',file_id::text,true);
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 if exists(select 1 from public.mrpd_portal_files where id=file_id) then raise exception 'Outsider saw private attachment';end if;
 begin
  perform public.mrpd_file_command('prepare',gen_random_uuid(),jsonb_build_object('target_type','entry','target_id',doc_id,'name','Test.pdf','mime','application/pdf','bytes',1));raise exception 'Outsider prepared upload';
 exception when insufficient_privilege then null;end;
end
$$;
reset role;
insert into storage.objects(bucket_id,name,metadata) values('mrpd-portal-files',current_setting('mrpd.ops_file'),'{"size":123,"mimetype":"application/pdf"}');
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('mrpd.ops_test_actors')::jsonb->>'plus',true);
select public.mrpd_file_command('finish',current_setting('mrpd.ops_file')::uuid);
do $$ begin
 if not exists(select 1 from storage.objects where bucket_id='mrpd-portal-files' and name=current_setting('mrpd.ops_file')) then raise exception 'Ready private attachment unavailable to manager';end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('mrpd.ops_test_actors')::jsonb->'members'->>2,true);
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='mrpd-portal-files' and name=current_setting('mrpd.ops_file')) then raise exception 'Private storage object leaked';end if;
end $$;
select 'Operations RLS, private HR, delegation, optimistic locking, unique checkout, return, clocks, application adoption, promotion guard and private attachment policies passed' as result;
rollback;
