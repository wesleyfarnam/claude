import { z } from "zod";

export const aspectRatioSchema = z.enum(["16:9", "9:16"]);

export const zoneContentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("media"),
    mediaId: z.string().uuid(),
    loop: z.boolean().default(true),
    muted: z.boolean().default(true),
  }),
  z.object({ kind: z.literal("playlist"), playlistId: z.string().uuid() }),
  z.object({ kind: z.literal("widget"), widgetId: z.string().uuid() }),
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

export const displaySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  aspect_ratio: aspectRatioSchema,
  background: z.object({ color: z.string().default("#0b0d12") }).default({ color: "#0b0d12" }),
  zones: z.array(zoneSchema).max(24),
  version: z.number().int().default(1),
});

export type ZoneContent = z.infer<typeof zoneContentSchema>;
export type Zone = z.infer<typeof zoneSchema>;
export type Display = z.infer<typeof displaySchema>;
