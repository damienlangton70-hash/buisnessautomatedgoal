create extension if not exists pgcrypto;

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  niche text not null,
  source text,
  evidence jsonb not null default '{}'::jsonb,
  score integer not null check (score between 0 and 100),
  status text not null default 'candidate' check (status in ('candidate','build','discarded','validated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references opportunities(id) on delete set null,
  name text not null,
  product_type text not null,
  price_gbp numeric(10,2) check (price_gbp >= 0),
  status text not null default 'draft' check (status in ('draft','qa','published','killed','winner')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists experiments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  impressions integer not null default 0 check (impressions >= 0),
  clicks integer not null default 0 check (clicks >= 0),
  conversion_rate numeric(8,4) not null default 0 check (conversion_rate >= 0),
  revenue_gbp numeric(12,2) not null default 0 check (revenue_gbp >= 0),
  days_running integer not null default 0 check (days_running >= 0),
  decision text not null default 'continue' check (decision in ('continue','winner','kill')),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete set null,
  external_id text,
  gross_gbp numeric(12,2) not null default 0 check (gross_gbp >= 0),
  fees_gbp numeric(12,2) not null default 0 check (fees_gbp >= 0),
  net_gbp numeric(12,2) generated always as (gross_gbp - fees_gbp) stored,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null,
  status text not null default 'running' check (status in ('running','completed','failed')),
  summary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists opportunities_status_score_idx on opportunities(status, score desc);
create index if not exists products_status_idx on products(status);
create index if not exists experiments_decision_idx on experiments(decision);
create index if not exists transactions_occurred_idx on transactions(occurred_at desc);

alter table opportunities enable row level security;
alter table products enable row level security;
alter table experiments enable row level security;
alter table transactions enable row level security;
alter table agent_runs enable row level security;

-- No public policies: the autonomous worker will use server-side credentials;
-- the phone dashboard will use authenticated, least-privilege policies later.
