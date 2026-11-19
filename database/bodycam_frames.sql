begin;
alter table public.apd_evidence_images add column officer_rank text;
alter table public.apd_evidence_images add column officer_service_no text;
alter table public.apd_evidence_images add column bodycam_recorded_at timestamptz;
create function portal_private.bodycam_stamp() returns trigger language plpgsql security definer set search_path='' as $$
begin
 select rank,service_no into new.officer_rank,new.officer_service_no from public.profiles where id=auth.uid();
 return new;
end
$$;
revoke all on function portal_private.bodycam_stamp() from public,anon,authenticated;
create trigger mrpd_bodycam_stamp before insert on public.apd_evidence_images for each row execute function portal_private.bodycam_stamp();
create function public.apd_evidence_save_bodycam(p_id uuid,p_version integer,p_fields jsonb,p_images jsonb default '[]') returns jsonb language plpgsql security definer set search_path='' as $$
declare saved jsonb; img jsonb;
begin
 if not public.apd_evidence_member() then raise exception 'Kein Zugriff auf den Zellenbereich.' using errcode='42501';end if;
 saved:=public.apd_evidence_save(p_id,p_version,p_fields,p_images);
 for img in select * from jsonb_array_elements(p_images) loop
  update public.apd_evidence_images set bodycam_recorded_at=nullif(img->>'recorded_at','')::timestamptz
  where id=(img->>'id')::uuid and case_id=p_id and uploaded_by=auth.uid();
 end loop;
 return saved;
end
$$;
revoke all on function public.apd_evidence_save_bodycam(uuid,integer,jsonb,jsonb) from public,anon;
grant execute on function public.apd_evidence_save_bodycam(uuid,integer,jsonb,jsonb) to authenticated;
commit;
