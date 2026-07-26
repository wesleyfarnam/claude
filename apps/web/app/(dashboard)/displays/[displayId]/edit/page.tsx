import { notFound } from "next/navigation";
import { displaySchema, type Display, type Page } from "@drip-tv/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/rbac";
import { BuilderShell } from "@/components/builder/BuilderShell";
import type { MediaPickerItem } from "@/components/builder/MediaPickerModal";

export default async function DisplayEditPage({
  params,
}: {
  params: Promise<{ displayId: string }>;
}) {
  const { displayId } = await params;
  await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: row, error } = await supabase
    .from("displays")
    .select("id, name, aspect_ratio, layout_json, version")
    .eq("id", displayId)
    .maybeSingle();

  if (error || !row) {
    notFound();
  }

  // Coerce stored layout_json to the current multi-page Display shape. Older
  // rows stored a flat `zones` array + top-level `background`; migrate those
  // into a single page so legacy displays keep working.
  type LegacyDisplay = Partial<Display> & {
    zones?: unknown;
    background?: { color?: string };
  };
  const raw = row.layout_json as LegacyDisplay | null;

  const pageId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : "00000000-0000-0000-0000-000000000010";

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
    id: row.id as string,
    name: row.name as string,
    aspect_ratio: row.aspect_ratio as Display["aspect_ratio"],
    pages,
    version: (row.version as number) ?? raw?.version ?? 1,
  };
  const parsed = displaySchema.safeParse(candidate);
  const initialDisplay: Display = parsed.success
    ? parsed.data
    : {
        id: row.id as string,
        name: (row.name as string) || "Untitled",
        aspect_ratio: (row.aspect_ratio as Display["aspect_ratio"]) ?? "16:9",
        pages: [
          {
            id: pageId,
            name: "Page 1",
            durationSec: 10,
            background: { color: "#0b0d12" },
            zones: [],
          },
        ],
        version: 1,
      };

  const mediaResult = await supabase
    .from("media_assets")
    .select("id, name, type, thumb_path")
    .eq("status", "ready")
    .order("created_at", { ascending: false });

  const media: MediaPickerItem[] = (mediaResult.data ?? []) as MediaPickerItem[];

  return <BuilderShell initialDisplay={initialDisplay} media={media} />;
}
