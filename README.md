# Drip TV

Retail digital signage platform for **Amazon Signage Sticks**. Every screen, every store, one dashboard.

## Status
**M1 — foundation** committed. Branch: `claude/retail-tv-display-system-WSVSL`.

## Stack
- Next.js 15 (App Router) + Tailwind + shadcn/ui
- Supabase (Postgres + RLS + Auth + Storage)
- Vercel hosting
- pnpm + Turborepo monorepo
- Player (M3): Vega RN app via Amazon Vega Developer Tools

## Local setup
```bash
pnpm install
# fill in apps/web/.env.local with your Supabase URL + keys
pnpm dev
```
Open http://localhost:3000. Sign up creates your org + admin role.

## Branding
Tokens in `packages/shared/src/brand.ts` (Hydrate Medical brand guide).
- Primary: sapphire `#364ca0`, maroon `#dc1b51`, aqua `#4cc3c7`
- Secondary: paua, royal, cornflower, athens
- Fonts: Avenir (body, Lato fallback), Pathway Gothic One (headings), Baron Neue (display)
- Aqua "slash" motif in the Drip TV logo
