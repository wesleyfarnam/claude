import { z } from "zod";

export const aspectRatioSchema = z.enum(["16:9", "9:16"]);

// Sports leagues supported by the sports zone. When a sports zone is toggled
// on with no specific leagues selected, ALL of these are shown by default.
export const SPORTS_LEAGUES = [
  "NFL",
  "NBA",
  "MLB",
  "NHL",
  "PGA",
  "NASCAR",
] as const;
export const sportsLeagueSchema = z.enum(SPORTS_LEAGUES);
export type SportsLeague = (typeof SPORTS_LEAGUES)[number];

export const zoneContentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("media"),
    mediaId: z.string().uuid(),
    loop: z.boolean().default(true),
    muted: z.boolean().default(true),
  }),
  z.object({ kind: z.literal("playlist"), playlistId: z.string().uuid() }),
  // Weather resolves its location from the device's assigned location at
  // render time — no zip is stored on the zone itself.
  z.object({
    kind: z.literal("weather"),
    units: z.enum(["imperial", "metric"]).default("imperial"),
    showForecast: z.boolean().default(true),
  }),
  // Sports is a simple on toggle. Empty `leagues` means "all default leagues".
  // Advanced users can narrow to specific leagues and/or teams.
  z.object({
    kind: z.literal("sports"),
    leagues: z.array(sportsLeagueSchema).default([]),
    teams: z.array(z.string()).default([]),
  }),
  z.object({
    kind: z.literal("text"),
    text: z.string(),
    fontSize: z.number().positive().default(24),
    color: z.string().default("#ffffff"),
    align: z.enum(["left", "center", "right"]).default("center"),
  }),
  z.object({
    kind: z.literal("clock"),
    format: z.string().default("h:mm A"),
    tz: z.string().default("America/New_York"),
  }),
]);

export const zoneSchema = z.object({
  id: z.string().uuid(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  w: z.number().min(0).max(100),
  h: z.number().min(0).max(100),
  z: z.number().int().default(0),
  fit: z.enum(["contain", "cover", "stretch"]).default("cover"),
  background: z.string().optional(),
  content: zoneContentSchema,
});

// How long a page stays on screen before the display advances to the next one.
export const PAGE_MIN_DURATION_SEC = 1;
export const PAGE_MAX_DURATION_SEC = 3600;
export const PAGE_DEFAULT_DURATION_SEC = 10;

// A display is an ordered deck of pages ("slides"). Each page is its own
// full canvas of zones with its own background, and stays on screen for
// `durationSec` before the player advances to the next page (looping).
export const pageSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120).default("Page"),
  durationSec: z
    .number()
    .int()
    .min(PAGE_MIN_DURATION_SEC)
    .max(PAGE_MAX_DURATION_SEC)
    .default(PAGE_DEFAULT_DURATION_SEC),
  background: z.object({ color: z.string().default("#0b0d12") }).default({ color: "#0b0d12" }),
  zones: z.array(zoneSchema).max(24),
});

export const displaySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  aspect_ratio: aspectRatioSchema,
  pages: z.array(pageSchema).min(1).max(50),
  version: z.number().int().default(1),
});

export type ZoneContent = z.infer<typeof zoneContentSchema>;
export type Zone = z.infer<typeof zoneSchema>;
export type Page = z.infer<typeof pageSchema>;
export type Display = z.infer<typeof displaySchema>;
