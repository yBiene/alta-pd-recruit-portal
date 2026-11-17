-- Applied 2026-11-17: identify new accounts whose initial password is 123456.
-- Existing credentials remain unchanged.
alter table public.profiles add column if not exists initial_password_is_default boolean not null default false;
comment on column public.profiles.initial_password_is_default is 'Initial password was set to the portal default; only useful while must_change_password is true.';
