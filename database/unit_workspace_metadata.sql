begin;
-- Keep the old handover source readable only through its corresponding unit entry.
drop policy shift_read on public.mrpd_shift_handover;
create policy shift_read on public.mrpd_shift_handover for select to authenticated using(exists(select 1 from public.mrpd_unit_entries e where e.legacy_handover_id=mrpd_shift_handover.id));
create function portal_private.unit_department_stamp() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at:=clock_timestamp();return new;end
$$;
revoke all on function portal_private.unit_department_stamp() from public,anon,authenticated;
create trigger mrpd_unit_department_stamp before update on public.portal_hub_departments for each row execute function portal_private.unit_department_stamp();
commit;
