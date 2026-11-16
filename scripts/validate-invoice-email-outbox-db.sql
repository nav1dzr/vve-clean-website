\set ON_ERROR_STOP on
\pset pager off
\pset tuples_only on
-- Throwaway local database only. Made-up rows.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
create table public.admin_users(id uuid primary key);
create table public.invoices(id uuid primary key);
grant usage on schema public to anon, authenticated, service_role;
\i :migration
\i :migration
select 'PASS migration applies twice';

insert into public.admin_users values ('11111111-1111-4111-8111-111111111111');
insert into public.invoices values ('22222222-2222-4222-8222-222222222222'), ('33333333-3333-4333-8333-333333333333');
insert into public.invoice_email_outbox(id, invoice_id, recipient, expected_document_version, expected_amount_due, scheduled_for, next_attempt_at, created_by)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'customer@example.invalid', 1, 255, now(), now(), '11111111-1111-4111-8111-111111111111');

-- A repeated request id is rejected (the app treats it as the same email).
do $$ begin
  insert into public.invoice_email_outbox(id, invoice_id, recipient, expected_document_version, expected_amount_due, scheduled_for, next_attempt_at)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'customer@example.invalid', 1, 255, now(), now());
  raise exception 'duplicate id was accepted';
exception when unique_violation then null; end $$;
select 'PASS repeated request id cannot create a second row';

-- One open email per invoice, for every open status.
do $$ declare s text; begin
  foreach s in array array['scheduled', 'sending', 'held', 'uncertain'] loop
    update public.invoice_email_outbox set status = s where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    begin
      insert into public.invoice_email_outbox(id, invoice_id, recipient, expected_document_version, expected_amount_due, scheduled_for, next_attempt_at)
      values (gen_random_uuid(), '22222222-2222-4222-8222-222222222222', 'customer@example.invalid', 1, 255, now(), now());
      raise exception 'second open email accepted while first is %', s;
    exception when unique_violation then null; end;
  end loop;
end $$;
select 'PASS only one open email per invoice';

-- A closed email does not block a new one; another invoice is independent.
update public.invoice_email_outbox set status = 'sent' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
insert into public.invoice_email_outbox(id, invoice_id, recipient, expected_document_version, expected_amount_due, scheduled_for, next_attempt_at)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'customer@example.invalid', 1, 255, now(), now()),
       ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '33333333-3333-4333-8333-333333333333', 'customer@example.invalid', 1, 100, now(), now());
select 'PASS sent email does not block a new one';

-- The conditional claim used by the app: only one of two claims wins.
with first as (
  update public.invoice_email_outbox set status = 'sending', attempts = attempts + 1
   where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and status = 'scheduled' and attempts = 0 returning id
), second as (
  update public.invoice_email_outbox set status = 'sending', attempts = attempts + 1
   where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and status = 'scheduled' and attempts = 0
     and not exists (select 1 from first) returning id
)
select case when (select count(*) from first) + (select count(*) from second) = 1 then 'PASS claim succeeds once' else 'FAIL claim' end;
do $$ begin
  update public.invoice_email_outbox set status = 'sending' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and status = 'scheduled';
  if found then raise exception 'second claim succeeded'; end if;
end $$;
select 'PASS a claimed email cannot be claimed again';

-- Invalid values are refused by the table itself.
do $$ begin
  begin insert into public.invoice_email_outbox(id, invoice_id, recipient, expected_document_version, expected_amount_due, scheduled_for, next_attempt_at, status)
    values (gen_random_uuid(), '33333333-3333-4333-8333-333333333333', 'customer@example.invalid', 1, 100, now(), now(), 'banana');
    raise exception 'bad status accepted'; exception when check_violation then null; end;
  begin insert into public.invoice_email_outbox(id, invoice_id, recipient, expected_document_version, expected_amount_due, scheduled_for, next_attempt_at, status)
    values (gen_random_uuid(), '33333333-3333-4333-8333-333333333333', 'customer@example.invalid', 1, 0, now(), now(), 'cancelled');
    raise exception 'zero amount accepted'; exception when check_violation then null; end;
end $$;
select 'PASS invalid status and zero balance are refused';

-- Browser roles have no access at all; the server role cannot delete history.
select case when not has_table_privilege('anon', 'public.invoice_email_outbox', 'select')
             and not has_table_privilege('authenticated', 'public.invoice_email_outbox', 'select')
             and not has_table_privilege('authenticated', 'public.invoice_email_outbox', 'insert')
             and has_table_privilege('service_role', 'public.invoice_email_outbox', 'select')
             and has_table_privilege('service_role', 'public.invoice_email_outbox', 'update')
             and not has_table_privilege('service_role', 'public.invoice_email_outbox', 'delete')
             and (select relrowsecurity from pg_class where oid = 'public.invoice_email_outbox'::regclass)
       then 'PASS browser roles have no access; row-level security is on' else 'FAIL privileges' end;

-- Removing an invoice removes its queued emails (drafts only can be deleted).
delete from public.invoices where id = '33333333-3333-4333-8333-333333333333';
select case when not exists (select 1 from public.invoice_email_outbox where invoice_id = '33333333-3333-4333-8333-333333333333')
       then 'PASS queued emails are removed with their invoice' else 'FAIL cascade' end;

-- Documented rollback works.
drop table public.invoice_email_outbox;
select 'PASS rollback (drop table) succeeds';
