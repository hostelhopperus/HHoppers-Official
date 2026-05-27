-- Hoppers production tables for Supabase/Postgres.
-- Run this in the Supabase SQL editor.

create table if not exists public.submissions (
  id uuid primary key,
  type text not null check (type in ('worker', 'hostel')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  data jsonb not null default '{}'::jsonb,
  payment jsonb not null default '{}'::jsonb,
  notes text not null default ''
);

create index if not exists submissions_status_idx on public.submissions (status);
create index if not exists submissions_type_status_idx on public.submissions (type, status);
create index if not exists submissions_created_at_idx on public.submissions (created_at desc);

create table if not exists public.accounts (
  id uuid primary key,
  type text not null check (type in ('worker', 'hostel')),
  email text not null unique,
  password_hash text not null,
  password_salt text not null,
  status text not null default 'profile_draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  profile jsonb not null default '{}'::jsonb,
  billing jsonb not null default '{}'::jsonb
);

create index if not exists accounts_email_idx on public.accounts (email);
create index if not exists accounts_type_idx on public.accounts (type);

create table if not exists public.email_outbox (
  id uuid primary key,
  to_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'queued',
  provider_id text,
  created_at timestamptz not null default now()
);

alter table public.submissions enable row level security;
alter table public.accounts enable row level security;
alter table public.email_outbox enable row level security;

grant select, insert, update, delete on public.submissions to service_role;
grant select, insert, update, delete on public.accounts to service_role;
grant select, insert, update, delete on public.email_outbox to service_role;

-- Public browser users should not query these tables directly.
-- The Node server uses the service role after its own authorization checks.

drop policy if exists "service role manages submissions" on public.submissions;
create policy "service role manages submissions"
on public.submissions
for all
to service_role
using (true)
with check (true);

drop policy if exists "service role manages accounts" on public.accounts;
create policy "service role manages accounts"
on public.accounts
for all
to service_role
using (true)
with check (true);

drop policy if exists "service role manages email outbox" on public.email_outbox;
create policy "service role manages email outbox"
on public.email_outbox
for all
to service_role
using (true)
with check (true);
