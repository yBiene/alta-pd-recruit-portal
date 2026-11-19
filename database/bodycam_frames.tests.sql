begin;
select set_config('mrpd.bodycam_actor',(select id::text from public.profiles where account_enabled and archived_at is null and account_type in ('owner','management') limit 1),true);
select set_config('mrpd.bodycam_case',gen_random_uuid()::text,true);
select set_config('mrpd.bodycam_image',gen_random_uuid()::text,true);
insert into storage.objects(bucket_id,name,metadata)
values('apd-evidence-files',current_setting('mrpd.bodycam_actor')||'/'||current_setting('mrpd.bodycam_case')||'/'||current_setting('mrpd.bodycam_image')||'.png','{"size":123,"mimetype":"image/png"}');
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('mrpd.bodycam_actor'),true);
do $$
declare case_id uuid:=current_setting('mrpd.bodycam_case')::uuid;image_id uuid:=current_setting('mrpd.bodycam_image')::uuid;saved jsonb;photo jsonb;actual_name text;actual_rank text;actual_number text;
begin
 select name,rank,service_no into actual_name,actual_rank,actual_number from public.profiles where id=auth.uid();
 saved:=public.apd_evidence_save_bodycam(case_id,0,jsonb_build_object('name','Bodycam rollback test','number','BC-TEST-'||case_id,'status','Offen'),jsonb_build_array(jsonb_build_object('id',image_id,'path',auth.uid()||'/'||case_id||'/'||image_id||'.png','title','Beweisbild','original_name','original.png','mime','image/png','bytes',123,'sha256',repeat('a',64),'recorded_at','2026-11-18T21:00:00Z','officer_rank','Falsch','uploaded_by_name','Falsch')));
 photo:=public.apd_evidence_detail(case_id)->'images'->0;
 if photo->>'officer_rank' is distinct from actual_rank or photo->>'officer_service_no' is distinct from actual_number or photo->>'uploaded_by_name' is distinct from actual_name then raise exception 'Uploader snapshot forged or missing';end if;
 if (photo->>'bodycam_recorded_at')::timestamptz<>'2026-11-18T21:00:00Z'::timestamptz or photo->>'created_at' is null then raise exception 'Capture / upload times missing';end if;
 if photo->>'sha256'<>repeat('a',64) or photo->>'path'<>auth.uid()||'/'||case_id||'/'||image_id||'.png' then raise exception 'Original metadata modified';end if;
end $$;
select 'Bodycam upload rank/name/service-number snapshots, separate manual capture time, unchanged original hash/path and detail serialization passed' as result;
rollback;
