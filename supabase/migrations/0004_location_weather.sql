-- Weather zones resolve their location from the device's assigned location.
-- Store a postal code (and optional country) per location so the player can
-- fetch weather without any per-zone or per-device configuration.

alter table public.locations
  add column if not exists postal_code text,
  add column if not exists country_code text not null default 'US';

-- Widgets are no longer a standalone entity — weather and sports are now
-- inline zone content types configured directly in the display builder.
-- The `widgets` table is left in place (harmless, unused) so existing rows
-- and RLS policies don't need a destructive migration.
