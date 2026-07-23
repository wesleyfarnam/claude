import { z } from "zod";

export const weatherConfigSchema = z.object({
  kind: z.literal("weather"),
  zip: z.string().optional(),
  country: z.string().length(2).default("US"),
  lat: z.number().optional(),
  lon: z.number().optional(),
  units: z.enum(["imperial", "metric"]).default("imperial"),
  showForecast: z.boolean().default(true),
});

export const newsConfigSchema = z.object({
  kind: z.literal("news"),
  country: z.string().length(2).default("us"),
  category: z
    .enum(["general", "business", "health", "science", "sports", "technology", "entertainment"])
    .default("general"),
  keywords: z.array(z.string()).max(10).default([]),
  max: z.number().int().positive().max(20).default(5),
  rotateSec: z.number().int().positive().default(8),
});

export const sportsConfigSchema = z.object({
  kind: z.literal("sports"),
  league: z.string().min(1),
  team: z.string().optional(),
  units: z.enum(["imperial", "metric"]).default("imperial"),
});

export const widgetConfigSchema = z.discriminatedUnion("kind", [
  weatherConfigSchema,
  newsConfigSchema,
  sportsConfigSchema,
]);

export type WeatherConfig = z.infer<typeof weatherConfigSchema>;
export type NewsConfig = z.infer<typeof newsConfigSchema>;
export type SportsConfig = z.infer<typeof sportsConfigSchema>;
export type WidgetConfig = z.infer<typeof widgetConfigSchema>;

export const weatherPayloadSchema = z.object({
  kind: z.literal("weather"),
  location: z.string(),
  tempF: z.number(),
  tempC: z.number(),
  condition: z.string(),
  icon: z.string(),
  forecast: z
    .array(z.object({ day: z.string(), hi: z.number(), lo: z.number(), icon: z.string() }))
    .default([]),
  fetched_at: z.string(),
  expires_at: z.string(),
});

export const newsPayloadSchema = z.object({
  kind: z.literal("news"),
  headlines: z.array(
    z.object({ title: z.string(), source: z.string(), published_at: z.string() }),
  ),
  fetched_at: z.string(),
  expires_at: z.string(),
});

export const sportsEventSchema = z.object({
  id: z.string(),
  home: z.string(),
  away: z.string(),
  homeScore: z.number().nullable(),
  awayScore: z.number().nullable(),
  date: z.string(),
  status: z.enum(["scheduled", "final"]),
});

export const sportsPayloadSchema = z.object({
  kind: z.literal("sports"),
  league: z.string(),
  team: z.string().nullable(),
  mode: z.enum(["recent", "next"]),
  events: z.array(sportsEventSchema),
  warning: z.string().optional(),
  fetched_at: z.string(),
  expires_at: z.string(),
});

export type WeatherPayload = z.infer<typeof weatherPayloadSchema>;
export type NewsPayload = z.infer<typeof newsPayloadSchema>;
export type SportsEvent = z.infer<typeof sportsEventSchema>;
export type SportsPayload = z.infer<typeof sportsPayloadSchema>;
