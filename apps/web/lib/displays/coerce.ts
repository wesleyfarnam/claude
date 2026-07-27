import { displaySchema, type Display, type Page } from "@drip-tv/shared";

type LegacyDisplay = Partial<Display> & {
  zones?: unknown;
  background?: { color?: string };
};

function freshPageId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "00000000-0000-0000-0000-000000000010";
}

/**
 * Coerce a stored `displays` row into the current multi-page {@link Display}
 * shape. Handles the legacy layout (a flat `zones[]` array + top-level
 * `background`) by wrapping it in a single page, and validates the result with
 * the zod schema. Returns null if it can't be made valid.
 */
export function coerceLayoutToDisplay(
  id: string,
  name: string,
  aspectRatio: string | null | undefined,
  layoutJson: unknown,
  version?: number | null,
): Display | null {
  const raw = (layoutJson ?? null) as LegacyDisplay | null;
  const pageId = freshPageId();

  const pages: Page[] = Array.isArray(raw?.pages)
    ? (raw.pages as Page[])
    : [
        {
          id: pageId,
          name: "Page 1",
          durationSec: 10,
          background: { color: raw?.background?.color ?? "#0b0d12" },
          zones: Array.isArray(raw?.zones) ? (raw.zones as Page["zones"]) : [],
        },
      ];

  const candidate: Display = {
    id,
    name: name || "Untitled",
    aspect_ratio: aspectRatio === "9:16" ? "9:16" : "16:9",
    pages,
    version: version ?? raw?.version ?? 1,
  };

  const parsed = displaySchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}
