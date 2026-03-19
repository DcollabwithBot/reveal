-- Sprint 6 foundation migration

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  icon text default '📋',
  color text default '#4488dd',
  status text not null default 'active' check (status in ('active','on_hold','completed')),
  external_id text,
  external_source text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists sprints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  goal text,
  status text not null default 'upcoming' check (status in ('upcoming','active','completed','archived')),
  start_date date,
  end_date date,
  external_id text,
  external_source text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table sessions
  add column if not exists organization_id uuid references organizations(id) on delete set null,
  add column if not exists project_id uuid references projects(id) on delete set null,
  add column if not exists sprint_id uuid references sprints(id) on delete set null,
  add column if not exists share_token uuid;

update sessions set share_token = gen_random_uuid() where share_token is null;
create unique index if not exists idx_sessions_share_token on sessions(share_token);

alter table session_items
  add column if not exists sprint_id uuid references sprints(id) on delete set null,
  add column if not exists description text,
  add column if not exists priority text default 'medium',
  add column if not exists assigned_to uuid references profiles(id) on delete set null,
  add column if not exists estimated_hours numeric(6,1),
  add column if not exists actual_hours numeric(6,1),
  add column if not exists progress int default 0 check (progress between 0 and 100),
  add column if not exists item_status text default 'backlog' check (item_status in ('backlog','in_progress','done','blocked')),
  add column if not exists external_id text,
  add column if not exists external_source text;

create table if not exists session_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  created_by uuid references profiles(id),
  name text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists node_completions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  node_id text not null,
  completed_by uuid references profiles(id),
  completed_at timestamptz default now(),
  unique(session_id, node_id)
);

create index if not exists idx_sessions_org_status on sessions(organization_id, status, created_at desc);
create index if not exists idx_projects_org_status on projects(organization_id, status, updated_at desc);
create index if not exists idx_sprints_project on sprints(project_id, status);
create index if not exists idx_items_sprint on session_items(sprint_id, item_status);
