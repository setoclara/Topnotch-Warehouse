-- ============================================================
-- Tournament Inventory — database schema
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run
-- ============================================================

-- ---------- Tables ----------

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  storage_bin text,
  total_quantity int not null default 0 check (total_quantity >= 0),
  photo_url text,
  created_at timestamptz not null default now()
);

-- Where an item's units are stored, broken down by bin with a count each.
-- An item can span several bins (e.g. 8 in A, 4 in B).
create table if not exists item_bins (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  bin text not null,
  quantity int not null default 0 check (quantity >= 0),
  created_at timestamptz not null default now(),
  unique (item_id, bin)
);

create index if not exists item_bins_item_idx on item_bins(item_id);
create index if not exists item_bins_bin_idx on item_bins(bin);

-- One-time migration: seed item_bins from the old single storage_bin field,
-- putting the whole quantity in that bin. Safe to re-run.
insert into item_bins (item_id, bin, quantity)
select id, trim(storage_bin), total_quantity
from items
where storage_bin is not null and trim(storage_bin) <> ''
on conflict (item_id, bin) do nothing;

create table if not exists tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

-- Trucks gear is loaded onto for transport between stops.
create table if not exists trucks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Every time gear leaves the warehouse it gets a checkout row.
-- checked_in_at stays NULL until it is returned.
-- status walks the movement lifecycle: packed → loaded → arrived (→ returned).
create table if not exists checkouts (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  tournament_id uuid references tournaments(id) on delete set null,
  quantity int not null default 1 check (quantity > 0),
  person_responsible text,               -- who is holding the item on-site
  checked_out_at timestamptz not null default now(),
  checked_in_at timestamptz,             -- NULL = still out
  status text not null default 'packed', -- packed | loaded | arrived
  truck_id uuid references trucks(id) on delete set null,
  arrived_location text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists checkouts_item_idx on checkouts(item_id);
create index if not exists checkouts_tournament_idx on checkouts(tournament_id);
create index if not exists checkouts_open_idx on checkouts(item_id) where checked_in_at is null;

-- ---------- View: live availability per item ----------
-- available = total_quantity - (quantity currently checked out)
create or replace view item_availability as
select
  i.*,
  coalesce((
    select sum(c.quantity)
    from checkouts c
    where c.item_id = i.id and c.checked_in_at is null
  ), 0) as quantity_out,
  i.total_quantity - coalesce((
    select sum(c.quantity)
    from checkouts c
    where c.item_id = i.id and c.checked_in_at is null
  ), 0) as quantity_available,
  coalesce((
    select json_agg(json_build_object('bin', b.bin, 'quantity', b.quantity)
                    order by b.bin)
    from item_bins b
    where b.item_id = i.id
  ), '[]'::json) as bins
from items i;

-- ============================================================
-- Row Level Security
-- Public (anonymous) users: read-only.
-- Authenticated staff: full read/write.
-- ============================================================

alter table items enable row level security;
alter table item_bins enable row level security;
alter table tournaments enable row level security;
alter table checkouts enable row level security;
alter table trucks enable row level security;

-- Public read access
create policy "public read items"       on items       for select using (true);
create policy "public read item_bins"   on item_bins   for select using (true);
create policy "public read tournaments" on tournaments for select using (true);
create policy "public read checkouts"   on checkouts   for select using (true);
create policy "public read trucks"      on trucks      for select using (true);

-- Staff (logged-in) write access
create policy "staff write items"       on items       for all to authenticated using (true) with check (true);
create policy "staff write item_bins"   on item_bins   for all to authenticated using (true) with check (true);
create policy "staff write tournaments" on tournaments for all to authenticated using (true) with check (true);
create policy "staff write checkouts"   on checkouts   for all to authenticated using (true) with check (true);
create policy "staff write trucks"      on trucks      for all to authenticated using (true) with check (true);

-- ============================================================
-- Storage: bucket for item photos (public read, staff upload)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', true)
on conflict (id) do nothing;

create policy "public read item photos"
  on storage.objects for select
  using (bucket_id = 'item-photos');

create policy "staff upload item photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'item-photos');

create policy "staff update item photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'item-photos');

create policy "staff delete item photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'item-photos');

-- ============================================================
-- Labels: pre-printable QR tags that can be assigned to an item later.
-- item_id is NULL until a staff member scans the code and assigns it.
-- ============================================================
create table if not exists labels (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references items(id) on delete set null,
  bin text,                              -- a tag can instead point at a bin (box)
  created_at timestamptz not null default now()
);

-- For labels created before bins existed.
alter table labels add column if not exists bin text;

alter table labels enable row level security;

create policy "public read labels" on labels for select using (true);
create policy "staff write labels" on labels for all to authenticated using (true) with check (true);

-- ============================================================
-- Packing lists (staff planning tool): a named checklist of items to bring
-- ============================================================
create table if not exists packing_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tournament_id uuid references tournaments(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists packing_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references packing_lists(id) on delete cascade,
  item_id uuid references items(id) on delete set null,
  quantity int not null default 1 check (quantity > 0),
  packed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table packing_lists enable row level security;
alter table packing_list_items enable row level security;

create policy "staff read packing_lists"  on packing_lists      for select to authenticated using (true);
create policy "staff write packing_lists" on packing_lists      for all    to authenticated using (true) with check (true);
create policy "staff read packing_items"  on packing_list_items for select to authenticated using (true);
create policy "staff write packing_items" on packing_list_items for all    to authenticated using (true) with check (true);
