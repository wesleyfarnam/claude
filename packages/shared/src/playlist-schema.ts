import { z } from "zod";

export const playlistItemSchema = z
  .object({
    id: z.string().uuid(),
    position: z.number().int().nonnegative(),
    display_id: z.string().uuid().nullable(),
    media_id: z.string().uuid().nullable(),
    duration_sec: z.number().int().positive().max(60 * 60),
    transition: z.enum(["cut", "fade"]).default("cut"),
  })
  .refine((v) => !!v.display_id !== !!v.media_id, {
    message: "Exactly one of display_id or media_id must be set",
  });

export const playlistSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  loop: z.boolean().default(true),
  default_item_duration_sec: z.number().int().positive().default(10),
  items: z.array(playlistItemSchema),
});

export type PlaylistItem = z.infer<typeof playlistItemSchema>;
export type Playlist = z.infer<typeof playlistSchema>;
