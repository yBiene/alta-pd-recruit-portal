begin;
do $$declare src text;begin
 select pg_get_functiondef('public.apd_evidence_save(uuid,integer,jsonb,jsonb)'::regprocedure)into src;
 src:=replace(src,'from public.apd_evidence_images where case_id=p_id;','from public.apd_evidence_images where case_id=p_id and deleted_at is null;');execute src;
 select pg_get_functiondef('portal_private.evidence_image_state(uuid,integer,boolean)'::regprocedure)into src;
 src:=replace(src,'if(p_restore and i.deleted_at is null)', 'if p_restore and(select count(*)from public.apd_evidence_images where case_id=c.id and deleted_at is null)>=20 then raise exception ''Maximal 20 Bilder je Akte. Bitte zuerst ein anderes Bild entfernen.'';end if; if(p_restore and i.deleted_at is null)');execute src;
end$$;
commit;
