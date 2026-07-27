import { z } from "zod";
import { displaySchema } from "./display-schema";

/**
 * The "program" is the fully-resolved thing a player device should loop
 * through, produced server-side by resolving the device's active schedule →
 * playlists → items. Items are already expanded (displays carry their full
 * layout; media carries a ready-to-play URL) so the player needs no further
 * server round-trips to render.
 */

export const programMediaItemSchema = z.object({
  type: z.literal("media"),
  itemId: z.string(),
  playlistId: z.string().nullable(),
  mediaId: z.string(),
  name: z.string(),
  mediaType: z.enum(["image", "video"]),
  url: z.string(),
  mime: z.string().nullable(),
  durationSec: z.number().int().positive(),
});

export const programDisplayItemSchema = z.object({
  type: z.literal("display"),
  itemId: z.string(),
  playlistId: z.string().nullable(),
  displayId: z.string(),
  name: z.string(),
  display: displaySchema,
});

export const programItemSchema = z.discriminatedUnion("type", [
  programDisplayItemSchema,
  programMediaItemSchema,
]);

// mediaId → playable URL, for `media` zones referenced *inside* a display's
// layout (as opposed to top-level media playlist items).
export const resolvedMediaSchema = z.object({
  mediaId: z.string(),
  mediaType: z.enum(["image", "video"]),
  url: z.string(),
  mime: z.string().nullable(),
});

export const programSchema = z.object({
  scheduleId: z.string().nullable(),
  scheduleName: z.string().nullable(),
  items: z.array(programItemSchema),
  media: z.array(resolvedMediaSchema),
  loop: z.boolean().default(true),
  generatedAt: z.string(),
  validUntil: z.string(),
});

export type ProgramMediaItem = z.infer<typeof programMediaItemSchema>;
export type ProgramDisplayItem = z.infer<typeof programDisplayItemSchema>;
export type ProgramItem = z.infer<typeof programItemSchema>;
export type ResolvedMedia = z.infer<typeof resolvedMediaSchema>;
export type Program = z.infer<typeof programSchema>;

/** An empty program — nothing scheduled right now. */
export function emptyProgram(generatedAt: string, validUntil: string): Program {
  return {
    scheduleId: null,
    scheduleName: null,
    items: [],
    media: [],
    loop: true,
    generatedAt,
    validUntil,
  };
}
