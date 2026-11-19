begin;
create or replace function portal_private.ops_guard_edit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.kind<>'shift' and old.status not in ('draft','active','rejected') and
 (new.fields is distinct from old.fields or new.title is distinct from old.title or new.body is distinct from old.body or new.subject_id is distinct from old.subject_id)
 then raise exception 'Eingereichte oder freigegebene Angaben sind gesperrt. Bitte zuerst zur Nacharbeit zurückgeben.';end if;
 if old.applied_at is not null and (new.fields is distinct from old.fields or new.title is distinct from old.title or new.body is distinct from old.body or new.subject_id is distinct from old.subject_id) then raise exception 'Die Entscheidung wurde bereits übernommen.';end if;
 return new;
end
$$;
commit;
