-- Drip TV — Row-Level Security policies.
-- Super-admin sees all. Org admin sees their org. Location manager
-- only sees rows scoped to their assigned locations.

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select is_super_admin from public.users where id = auth.uid()),
    false
  );
$$;

create or replace function public.user_orgs()
returns setof uuid language sql stable security definer set search_path = public as $$
  select org_id from public.user_org_roles where user_id = auth.uid();
$$;

create or replace function public.is_org_admin(_org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_org_roles
    where user_id = auth.uid() and org_id = _org_id and role = 'admin'
  );
$$;

create or replace function public.user_locations()
returns setof uuid language sql stable security definer set search_path = public as $$
  select l.id
  from public.locations l
  where l.org_id in (select public.user_orgs())
    and (
      public.is_org_admin(l.org_id)
      or exists (
        select 1 from public.location_managers lm
        where lm.user_id = auth.uid() and lm.location_id = l.id
      )
    );
$$;

alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.user_org_roles enable row level security;
alter table public.locations enable row level security;
alter table public.location_managers enable row level security;
alter table public.devices enable row level security;
alter table public.media_assets enable row level security;
alter table public.displays enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_items enable row level security;
alter table public.schedules enable row level security;
alter table public.schedule_targets enable row level security;
alter table public.schedule_playlists enable row level security;
alter table public.widgets enable row level security;
alter table public.device_heartbeats enable row level security;
alter table public.device_commands enable row level security;
alter table public.playback_events enable row level security;
alter table public.playback_daily enable row level security;
alter table public.audit_log enable row level security;

create policy "orgs_select_member_or_super" on public.organizations
  for select using (
    public.is_super_admin() or id in (select public.user_orgs())
  );
create policy "orgs_mutate_super_only" on public.organizations
  for all using (public.is_super_admin()) with check (public.is_super_admin());

create policy "users_read_self_or_shared_org" on public.users
  for select using (
    id = auth.uid()
    or public.is_super_admin()
    or exists (
      select 1 from public.user_org_roles a
      join public.user_org_roles b on a.org_id = b.org_id
      where a.user_id = auth.uid() and b.user_id = public.users.id
    )
  );
create policy "users_update_self" on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "uor_select_scoped" on public.user_org_roles
  for select using (
    public.is_super_admin()
    or user_id = auth.uid()
    or public.is_org_admin(org_id)
  );
create policy "uor_mutate_admin" on public.user_org_roles
  for all using (
    public.is_super_admin() or public.is_org_admin(org_id)
  ) with check (
    public.is_super_admin() or public.is_org_admin(org_id)
  );

create policy "locations_select_scoped" on public.locations
  for select using (
    public.is_super_admin()
    or (
      org_id in (select public.user_orgs())
      and (
        public.is_org_admin(org_id)
        or id in (select public.user_locations())
      )
    )
  );
create policy "locations_mutate_admin" on public.locations
  for all using (
    public.is_super_admin() or public.is_org_admin(org_id)
  ) with check (
    public.is_super_admin() or public.is_org_admin(org_id)
  );

create policy "loc_mgrs_select" on public.location_managers
  for select using (
    public.is_super_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.locations l
      where l.id = location_managers.location_id
        and public.is_org_admin(l.org_id)
    )
  );
create policy "loc_mgrs_mutate_admin" on public.location_managers
  for all using (
    public.is_super_admin() or exists (
      select 1 from public.locations l
      where l.id = location_managers.location_id and public.is_org_admin(l.org_id)
    )
  ) with check (
    public.is_super_admin() or exists (
      select 1 from public.locations l
      where l.id = location_managers.location_id and public.is_org_admin(l.org_id)
    )
  );

create policy "devices_select_scoped" on public.devices
  for select using (
    public.is_super_admin()
    or (
      org_id in (select public.user_orgs())
      and (
        public.is_org_admin(org_id)
        or location_id in (select public.user_locations())
      )
    )
  );
create policy "devices_mutate_scoped" on public.devices
  for all using (
    public.is_super_admin()
    or public.is_org_admin(org_id)
    or location_id in (select public.user_locations())
  ) with check (
    public.is_super_admin()
    or public.is_org_admin(org_id)
    or location_id in (select public.user_locations())
  );

create policy "media_select_org" on public.media_assets
  for select using (
    public.is_super_admin() or org_id in (select public.user_orgs())
  );
create policy "media_mutate_org" on public.media_assets
  for all using (
    public.is_super_admin() or org_id in (select public.user_orgs())
  ) with check (
    public.is_super_admin() or org_id in (select public.user_orgs())
  );

create policy "displays_select_org" on public.displays
  for select using (
    public.is_super_admin() or org_id in (select public.user_orgs())
  );
create policy "displays_mutate_org" on public.displays
  for all using (
    public.is_super_admin() or org_id in (select public.user_orgs())
  ) with check (
    public.is_super_admin() or org_id in (select public.user_orgs())
  );

create policy "playlists_select_org" on public.playlists
  for select using (
    public.is_super_admin() or org_id in (select public.user_orgs())
  );
create policy "playlists_mutate_org" on public.playlists
  for all using (
    public.is_super_admin() or org_id in (select public.user_orgs())
  ) with check (
    public.is_super_admin() or org_id in (select public.user_orgs())
  );

create policy "playlist_items_via_playlist" on public.playlist_items
  for all using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_items.playlist_id
        and (public.is_super_admin() or p.org_id in (select public.user_orgs()))
    )
  ) with check (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_items.playlist_id
        and (public.is_super_admin() or p.org_id in (select public.user_orgs()))
    )
  );

create policy "widgets_select_org" on public.widgets
  for select using (
    public.is_super_admin() or org_id in (select public.user_orgs())
  );
create policy "widgets_mutate_org" on public.widgets
  for all using (
    public.is_super_admin() or org_id in (select public.user_orgs())
  ) with check (
    public.is_super_admin() or org_id in (select public.user_orgs())
  );

create policy "schedules_select_org" on public.schedules
  for select using (
    public.is_super_admin() or org_id in (select public.user_orgs())
  );
create policy "schedules_mutate_admin" on public.schedules
  for all using (
    public.is_super_admin() or public.is_org_admin(org_id)
  ) with check (
    public.is_super_admin() or public.is_org_admin(org_id)
  );

create policy "schedule_targets_via_schedule" on public.schedule_targets
  for all using (
    exists (
      select 1 from public.schedules s
      where s.id = schedule_targets.schedule_id
        and (public.is_super_admin() or s.org_id in (select public.user_orgs()))
    )
  ) with check (
    exists (
      select 1 from public.schedules s
      where s.id = schedule_targets.schedule_id
        and (public.is_super_admin() or s.org_id in (select public.user_orgs()))
    )
  );

create policy "schedule_playlists_via_schedule" on public.schedule_playlists
  for all using (
    exists (
      select 1 from public.schedules s
      where s.id = schedule_playlists.schedule_id
        and (public.is_super_admin() or s.org_id in (select public.user_orgs()))
    )
  ) with check (
    exists (
      select 1 from public.schedules s
      where s.id = schedule_playlists.schedule_id
        and (public.is_super_admin() or s.org_id in (select public.user_orgs()))
    )
  );

create policy "heartbeats_select_via_device" on public.device_heartbeats
  for select using (
    exists (
      select 1 from public.devices d
      where d.id = device_heartbeats.device_id
        and (
          public.is_super_admin()
          or public.is_org_admin(d.org_id)
          or d.location_id in (select public.user_locations())
        )
    )
  );

create policy "commands_select_via_device" on public.device_commands
  for select using (
    exists (
      select 1 from public.devices d
      where d.id = device_commands.device_id
        and (
          public.is_super_admin()
          or public.is_org_admin(d.org_id)
          or d.location_id in (select public.user_locations())
        )
    )
  );
create policy "commands_insert_via_device" on public.device_commands
  for insert with check (
    exists (
      select 1 from public.devices d
      where d.id = device_commands.device_id
        and (
          public.is_super_admin()
          or public.is_org_admin(d.org_id)
          or d.location_id in (select public.user_locations())
        )
    )
  );

create policy "playback_select_via_device" on public.playback_events
  for select using (
    exists (
      select 1 from public.devices d
      where d.id = playback_events.device_id
        and (
          public.is_super_admin()
          or public.is_org_admin(d.org_id)
          or d.location_id in (select public.user_locations())
        )
    )
  );

create policy "playback_daily_select_via_device" on public.playback_daily
  for select using (
    exists (
      select 1 from public.devices d
      where d.id = playback_daily.device_id
        and (
          public.is_super_admin()
          or public.is_org_admin(d.org_id)
          or d.location_id in (select public.user_locations())
        )
    )
  );

create policy "audit_select_org" on public.audit_log
  for select using (
    public.is_super_admin() or org_id in (select public.user_orgs())
  );
