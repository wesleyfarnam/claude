import { z } from "zod";

export const deviceCommandType = z.enum([
  "reboot",
  "power_on",
  "power_off",
  "factory_reset",
  "screenshot",
  "force_refresh",
  "clear_cache",
  "reload_config",
]);

export const deviceCommandSchema = z.object({
  id: z.string().uuid(),
  device_id: z.string().uuid(),
  type: deviceCommandType,
  payload: z.record(z.unknown()).default({}),
  status: z.enum(["queued", "sent", "ack", "failed"]),
  created_at: z.string(),
  acked_at: z.string().nullable(),
  result: z.record(z.unknown()).nullable(),
});

export type DeviceCommand = z.infer<typeof deviceCommandSchema>;
export type DeviceCommandType = z.infer<typeof deviceCommandType>;

export const heartbeatSchema = z.object({
  device_id: z.string().uuid(),
  ts: z.string(),
  status: z.enum(["playing", "idle", "error", "booting"]),
  playing_playlist_id: z.string().uuid().nullable(),
  playing_item_id: z.string().uuid().nullable(),
  cpu_pct: z.number().min(0).max(100).optional(),
  mem_pct: z.number().min(0).max(100).optional(),
  temp_c: z.number().optional(),
  net_rtt_ms: z.number().int().nonnegative().optional(),
  player_version: z.string().optional(),
  errors: z.array(z.string()).default([]),
});

export type Heartbeat = z.infer<typeof heartbeatSchema>;

export const playbackEventSchema = z.object({
  device_id: z.string().uuid(),
  ts: z.string(),
  playlist_id: z.string().uuid().nullable(),
  playlist_item_id: z.string().uuid().nullable(),
  media_id: z.string().uuid().nullable(),
  display_id: z.string().uuid().nullable(),
  duration_ms: z.number().int().nonnegative(),
  completed: z.boolean(),
  reason: z.string().nullable(),
});

export const playbackEventBatchSchema = z.object({
  events: z.array(playbackEventSchema).max(500),
});

export type PlaybackEvent = z.infer<typeof playbackEventSchema>;
