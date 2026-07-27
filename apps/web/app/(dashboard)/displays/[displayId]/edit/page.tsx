import { notFound } from "next/navigation";
import type { Display } from "@drip-tv/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/rbac";
import { coerceLayoutToDisplay } from "@/lib/displays/coerce";
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

  // Coerce stored layout_json to the current multi-page Display shape (older
  // rows stored a flat `zones` array + top-level `background`). Falls back to a
  // fresh single empty page if the stored layout can't be made valid.
  const initialDisplay: Display =
    coerceLayoutToDisplay(
      row.id as string,
      row.name as string,
      row.aspect_ratio as string,
      row.layout_json,
      row.version as number,
    ) ??
    ({
      id: row.id as string,
      name: (row.name as string) || "Untitled",
      aspect_ratio: (row.aspect_ratio as Display["aspect_ratio"]) ?? "16:9",
      pages: [
        {
          id: "00000000-0000-0000-0000-000000000010",
          name: "Page 1",
          durationSec: 10,
          background: { color: "#0b0d12" },
          zones: [],
        },
      ],
      version: 1,
    } satisfies Display);

  const mediaResult = await supabase
    .from("media_assets")
    .select("id, name, type, thumb_path")
    .eq("status", "ready")
    .order("created_at", { ascending: false });

  const media: MediaPickerItem[] = (mediaResult.data ?? []) as MediaPickerItem[];

  return <BuilderShell initialDisplay={initialDisplay} media={media} />;
}
