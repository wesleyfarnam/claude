import { notFound } from "next/navigation";
import { displaySchema, type Display } from "@drip-tv/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/rbac";
import { BuilderShell } from "@/components/builder/BuilderShell";
import type {
  MediaPickerItem,
  WidgetPickerItem,
} from "@/components/builder/MediaPickerModal";

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

  // Coerce stored layout_json to the Display shape, with safe fallbacks if it
  // pre-dates the current schema.
  const raw = row.layout_json as Partial<Display> | null;
  const candidate: Display = {
    id: row.id as string,
    name: row.name as string,
    aspect_ratio: row.aspect_ratio as Display["aspect_ratio"],
    background: raw?.background ?? { color: "#0b0d12" },
    zones: Array.isArray(raw?.zones) ? raw.zones : [],
    version: (row.version as number) ?? raw?.version ?? 1,
  };
  const parsed = displaySchema.safeParse(candidate);
  const initialDisplay: Display = parsed.success
    ? parsed.data
    : {
        ...candidate,
        zones: [],
      };

  const [mediaResult, widgetsResult] = await Promise.all([
    supabase
      .from("media_assets")
      .select("id, name, type, thumb_path")
      .eq("status", "ready")
      .order("created_at", { ascending: false }),
    supabase.from("widgets").select("id, name, type").order("name"),
  ]);

  const media: MediaPickerItem[] = (mediaResult.data ?? []) as MediaPickerItem[];
  const widgets: WidgetPickerItem[] = (widgetsResult.data ?? []) as WidgetPickerItem[];

  return <BuilderShell initialDisplay={initialDisplay} media={media} widgets={widgets} />;
}
