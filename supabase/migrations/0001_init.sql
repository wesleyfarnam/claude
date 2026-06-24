-- Drip TV — initial schema (M1).
-- Orgs, users, roles, locations, devices, media, displays, playlists,
-- schedules, widgets, heartbeats, commands, playback events.
-- RLS policies are in 0002_rls_policies.sql.

create extension if not exists "pgcrypto";

-- ── Organizations ─────────────────────────────────────────────────
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  amazon_partner_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Users (mirror of auth.users) ──────────────────────────────────
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Roles + location assignments ──────────────────────────────────
create table public.user_org_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('admin', 'location_manager')),
  created_at timestamptz not null default now(),
  unique (user_id, org_id)
);
create index on public.user_org_roles (org_id);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  address text,
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.locations (org_id);

create table public.location_managers (
  user_id uuid not null references public.users(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  granted_by uuid references public.users(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, location_id)
);

-- ── Devices ────────────────────────────────────────────────────────
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  name text not null,
  amazon_device_id text unique,
  pairing_code text,
  pairing_expires_at timestamptz,
  registered_at timestamptz,
  status text not null default 'unpaired'
    check (status in ('unpaired', 'active', 'offline', 'error', 'disabled')),
  last_seen_at timestamptz,
  last_ip inet,
  firmware_version text,
  player_version text,
  device_token_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.devices (org_id, location_id);
create unique index devices_pairing_code_idx
  on public.devices (pairing_code) where pairing_code is not null;

-- ── Media ──────────────────────────────────────────────────────────
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  type text not null check (type in ('image', 'video')),
  storage_path text not null,
  mime text,
  width int,
  height int,
  duration_sec numeric,
  thumb_path text,
  hls_url text,
  mux_asset_id text,
  mux_playback_id text,
  status text not null default 'uploading'
    check (status in ('uploading', 'processing', 'ready', 'error')),
  checksum text,
  bytes bigint,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.media_assets (org_id, status);

-- ── Displays ───────────────────────────────────────────────────────
create table public.displays (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  aspect_ratio text not null default '16:9' check (aspect_ratio in ('16:9', '9:16')),
  layout_json jsonb not null,
  version int not null default 1,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.displays (org_id);
create index on public.displays using gin (layout_json);

-- ── Playlists ──────────────────────────────────────────────────────
create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  loop boolean not null default true,
  default_item_duration_sec int not null default 10,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  position int not null,
  display_id uuid references public.displays(id) on delete cascade,
  media_id uuid references public.media_assets(id) on delete cascade,
  duration_sec int not null default 10,
  transition text not null default 'cut' check (transition in ('cut', 'fade')),
  check ((display_id is not null)::int + (media_id is not null)::int = 1)
);
create index on public.playlist_items (playlist_id, position);

-- ── Schedules ──────────────────────────────────────────────────────
create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  priority int not null default 0,
  start_date date,
  end_date date,
  days_of_week smallint[],
  start_time time,
  end_time time,
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now()
);

create table public.schedule_targets (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  device_id uuid references public.devices(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  check (device_id is not null or location_id is not null)
);
create unique index schedule_targets_unique_idx
  on public.schedule_targets (
    schedule_id,
    coalesce(device_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create table public.schedule_playlists (
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  position int not null default 0,
  primary key (schedule_id, playlist_id)
);

-- ── Widgets ────────────────────────────────────────────────────────
create table public.widgets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  type text not null check (type in ('weather', 'news')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.widgets (org_id, type);

-- ── Heartbeats (partitioned by month) ─────────────────────────────
create table public.device_heartbeats (
  device_id uuid not null references public.devices(id) on delete cascade,
  ts timestamptz not null default now(),
  status text not null,
  playing_playlist_id uuid,
  playing_item_id uuid,
  cpu_pct numeric,
  mem_pct numeric,
  temp_c numeric,
  net_rtt_ms int,
  errors jsonb default '[]'::jsonb
) partition by range (ts);

create index on public.device_heartbeats (device_id, ts desc);

create table public.device_heartbeats_default
  partition of public.device_heartbeats default;

-- ── Commands ───────────────────────────────────────────────────────
create table public.device_commands (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  type text not null check (type in (
    'reboot', 'power_on', 'power_off', 'factory_reset', 'screenshot',
    'force_refresh', 'clear_cache', 'reload_config'
  )),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'ack', 'failed')),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  acked_at timestamptz,
  result jsonb
);
create index on public.device_commands (device_id, status);
create index on public.device_commands (device_id, created_at desc);

-- ── Playback events (partitioned) ─────────────────────────────────
create table public.playback_events (
  id bigserial,
  device_id uuid not null references public.devices(id) on delete cascade,
  ts timestamptz not null default now(),
  playlist_id uuid,
  playlist_item_id uuid,
  media_id uuid,
  display_id uuid,
  duration_ms int not null,
  completed boolean not null default true,
  reason text,
  primary key (id, ts)
) partition by range (ts);

create index on public.playback_events (device_id, ts desc);
create index on public.playback_events (media_id, ts);

create table public.playback_events_default
  partition of public.playback_events default;

create table public.playback_daily (
  date date not null,
  device_id uuid not null references public.devices(id) on delete cascade,
  media_id uuid,
  plays int not null default 0,
  total_duration_ms bigint not null default 0
);
create unique index playback_daily_unique_idx
  on public.playback_daily (
    date,
    device_id,
    coalesce(media_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- ── Audit log ──────────────────────────────────────────────────────
create table public.audit_log (
  id bigserial primary key,
  actor_user_id uuid references public.users(id),
  org_id uuid references public.organizations(id) on delete cascade,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb default '{}'::jsonb,
  ts timestamptz not null default now()
);
create index on public.audit_log (org_id, ts desc);
