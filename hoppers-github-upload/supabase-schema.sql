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

create table if not exists public.password_resets (
  id uuid primary key,
  account_id uuid references public.accounts(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  requested_by text not null default 'account',
  requested_ip text,
  created_at timestamptz not null default now()
);

create index if not exists password_resets_token_hash_idx on public.password_resets (token_hash);
create index if not exists password_resets_account_idx on public.password_resets (account_id);
create index if not exists password_resets_expires_at_idx on public.password_resets (expires_at);

create table if not exists public.admin_actions (
  id uuid primary key,
  action text not null,
  account_id uuid references public.accounts(id) on delete set null,
  target_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_actions_account_idx on public.admin_actions (account_id);
create index if not exists admin_actions_created_at_idx on public.admin_actions (created_at desc);

create table if not exists public.applications (
  id uuid primary key,
  status text not null default 'applied' check (status in ('applied', 'viewed', 'shortlisted', 'contacted', 'interview', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  thread_id text,
  worker_account_id uuid references public.accounts(id) on delete set null,
  worker_email text not null default '',
  worker jsonb not null default '{}'::jsonb,
  hostel_account_id uuid references public.accounts(id) on delete set null,
  hostel_email text not null default '',
  opening jsonb not null default '{}'::jsonb,
  message text not null default '',
  questions text not null default '',
  admin_notes text not null default ''
);

create index if not exists applications_status_idx on public.applications (status);
create index if not exists applications_worker_account_idx on public.applications (worker_account_id);
create index if not exists applications_worker_email_idx on public.applications (worker_email);
create index if not exists applications_hostel_account_idx on public.applications (hostel_account_id);
create index if not exists applications_created_at_idx on public.applications (created_at desc);

alter table public.submissions enable row level security;
alter table public.accounts enable row level security;
alter table public.email_outbox enable row level security;
alter table public.password_resets enable row level security;
alter table public.admin_actions enable row level security;
alter table public.applications enable row level security;

grant select, insert, update, delete on public.submissions to service_role;
grant select, insert, update, delete on public.accounts to service_role;
grant select, insert, update, delete on public.email_outbox to service_role;
grant select, insert, update, delete on public.password_resets to service_role;
grant select, insert, update, delete on public.admin_actions to service_role;
grant select, insert, update, delete on public.applications to service_role;

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

drop policy if exists "service role manages password resets" on public.password_resets;
create policy "service role manages password resets"
on public.password_resets
for all
to service_role
using (true)
with check (true);

drop policy if exists "service role manages admin actions" on public.admin_actions;
create policy "service role manages admin actions"
on public.admin_actions
for all
to service_role
using (true)
with check (true);

drop policy if exists "service role manages applications" on public.applications;
create policy "service role manages applications"
on public.applications
for all
to service_role
using (true)
with check (true);
