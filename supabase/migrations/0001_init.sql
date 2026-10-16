create table if not exists workspace (
  id int primary key check (id = 1),
  data jsonb not null,
  version int not null default 1,
  updated_at timestamptz not null default now()
);
create table if not exists snapshots (
  id bigserial primary key,
  name text,
  label text not null,
  kind text not null check (kind in ('auto','manual')),
  data jsonb not null,
  version int not null,
  created_at timestamptz not null default now()
);
create index if not exists snapshots_created_at_idx on snapshots (created_at desc);
alter table workspace enable row level security;
alter table snapshots enable row level security;
