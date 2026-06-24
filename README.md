# Drip TV

Retail digital signage platform for **Amazon Signage Sticks**. Every screen, every store, one dashboard.

## Status

**M1–M7 (dashboard + API side) committed.** Vega RN player app is the remaining piece.

| Milestone | What landed |
|---|---|
| **M1** ✅ | Monorepo, Next.js + Drip TV theme, Supabase schema + RLS, auth + signup-as-admin |
| **M2** ✅ | Media library — Supabase Storage signed uploads, `sharp` thumbs, Mux video transcode, delete |
| **M3** ✅ | Device pairing (6-char code), heartbeat ingestion, live device list, device detail |
| **M4** ✅ | Display builder (`@dnd-kit` canvas, zones, undo via zundo), playlist CRUD + reordering |
| **M5** ✅ | Widgets (weather + news with cache), schedules CRUD + tz-aware resolver |
| **M6** ✅ | Amazon Signage Remote Mgmt client, command queue (reboot/refresh/screenshot/clear), CommandPanel UI |
| **M7** ✅ | Proof-of-play ingestion, RLS-scoped report queries, filters + CSV export |
| **M3 player** ⏳ | Vega OS React Native app — separate project, not in this push |

## Stack
- Next.js 15 (App Router) + Tailwind
- Supabase (Postgres + RLS + Auth + Storage)
- Mux (video transcode)
- @dnd-kit (drag/drop), zustand + zundo (builder state)
- OpenWeatherMap + NewsAPI (proxied + cached server-side)
- jose (device JWTs)
- pnpm + Turborepo

## Local setup
```bash
pnpm install
# fill in apps/web/.env.local — see .env.example
pnpm dev
```
Open http://localhost:3000. Sign up creates your org + admin role.

## Env vars
| Var | Required? | Used by |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | auth, all queries |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | auth |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | signup org bootstrap, device + webhook ingestion |
| `DEVICE_JWT_SECRET` | recommended | device auth (dev fallback present) |
| `MUX_TOKEN_ID` + `MUX_TOKEN_SECRET` | M2 video | Mux transcode; without it videos stay `ready` w/o HLS |
| `MUX_WEBHOOK_SECRET` | M2 video | webhook signature verification |
| `OPENWEATHER_API_KEY` | M5 | weather widget; stub data without it |
| `NEWSAPI_KEY` | M5 | news widget; stub data without it |
| `AMAZON_SIGNAGE_CLIENT_ID` / `_SECRET` / `_API_BASE` | M6 | hardware commands; set `AMAZON_SIGNAGE_API_BASE=mock://` for local demo |

## Routes (dashboard)
- `/` — landing
- `/login`, `/signup` — auth
- `/dashboard` — overview stats
- `/locations` — placeholder (CRUD coming)
- `/devices` — list, `/devices/pair` (claim a 6-char code), `/devices/[id]` (detail + remote control)
- `/media` — uploader + library
- `/displays` — list, `/displays/[id]/edit` (drag-drop builder)
- `/playlists` — list, `/playlists/[id]` (item editor)
- `/widgets` — list, `/widgets/[id]` (config)
- `/schedules` — list + create, `/schedules/[id]` (edit + targets + playlists)
- `/reports/proof-of-play` — filters + CSV export

## API (player-facing)
- `POST /api/devices/pair/start` — request a pairing code
- `POST /api/devices/pair/poll` — poll for claim
- `POST /api/devices/heartbeat` — JWT-auth'd
- `GET  /api/devices/me/schedule` — current playlist + queued commands
- `POST /api/playback-events` — batched proof-of-play
- `GET  /api/widgets/weather?widgetId=` / `/news` — widget data
- `POST /api/devices/[id]/commands/[commandId]/ack` — command acknowledgement

## Branding
Tokens in `packages/shared/src/brand.ts` (Hydrate Medical brand guide).
- Primary: sapphire `#364ca0`, maroon `#dc1b51`, aqua `#4cc3c7`
- Secondary: paua, royal, cornflower, athens
- Fonts: Avenir (body, Lato fallback), Pathway Gothic One (headings), Baron Neue (display)
- Aqua "slash" motif in the Drip TV logo

## What's not built yet
- **Vega RN player app** (the actual on-device software) — separate project; the API contract is locked.
- **Locations CRUD UI** — table + form still to come.
- **Production pairing store** — currently an in-memory `Map`; swap to KV/Redis before multi-instance deploy.
- **Vercel KV for widget cache** — currently in-process `Map`; same upgrade path.
- **Scheduled monthly partitions + nightly rollup job** — using default partition for now.
