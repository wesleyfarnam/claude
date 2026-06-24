import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/rbac";
import { PlaylistEditor, type PlaylistEditorItem } from "./PlaylistEditor";

type PlaylistDetail = {
  id: string;
  name: string;
  loop: boolean;
  default_item_duration_sec: number;
};

type RawItem = {
  id: string;
  position: number;
  display_id: string | null;
  media_id: string | null;
  duration_sec: number;
  transition: "cut" | "fade";
};

export default async function PlaylistDetailPage({
  params,
}: {
  params: Promise<{ playlistId: string }>;
}) {
  const { playlistId } = await params;
  await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: pl, error: plErr } = await supabase
    .from("playlists")
    .select("id, name, loop, default_item_duration_sec")
    .eq("id", playlistId)
    .maybeSingle();

  if (plErr || !pl) {
    notFound();
  }

  const playlist = pl as PlaylistDetail;

  const { data: itemsRaw } = await supabase
    .from("playlist_items")
    .select("id, position, display_id, media_id, duration_sec, transition")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: true });

  const rawItems = (itemsRaw ?? []) as RawItem[];

  const displayIds = Array.from(
    new Set(rawItems.map((r) => r.display_id).filter((v): v is string => !!v)),
  );
  const mediaIds = Array.from(
    new Set(rawItems.map((r) => r.media_id).filter((v): v is string => !!v)),
  );

  const [referencedDisplays, referencedMedia, allDisplays, allMedia] = await Promise.all([
    displayIds.length > 0
      ? supabase.from("displays").select("id, name").in("id", displayIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    mediaIds.length > 0
      ? supabase.from("media_assets").select("id, name").in("id", mediaIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabase
      .from("displays")
      .select("id, name")
      .order("updated_at", { ascending: false }),
    supabase
      .from("media_assets")
      .select("id, name, type")
      .eq("status", "ready")
      .order("created_at", { ascending: false }),
  ]);

  const displayMap = new Map(
    (referencedDisplays.data ?? []).map((d) => [d.id, d.name as string]),
  );
  const mediaMap = new Map(
    (referencedMedia.data ?? []).map((m) => [m.id, m.name as string]),
  );

  const items: PlaylistEditorItem[] = rawItems.map((r) => ({
    id: r.id,
    position: r.position,
    duration_sec: r.duration_sec,
    transition: r.transition,
    kind: r.display_id ? "display" : "media",
    refId: (r.display_id ?? r.media_id) as string,
    refName: r.display_id
      ? (displayMap.get(r.display_id) ?? "Unknown display")
      : r.media_id
        ? (mediaMap.get(r.media_id) ?? "Unknown media")
        : "(missing)",
  }));

  const displayOptions = (allDisplays.data ?? []).map((d) => ({
    id: d.id as string,
    name: d.name as string,
  }));
  const mediaOptions = (allMedia.data ?? []).map((m) => ({
    id: m.id as string,
    name: m.name as string,
    type: m.type as string,
  }));

  return (
    <div className="p-8">
      <header className="mb-6">
        <Link
          href="/playlists"
          className="font-heading text-xs uppercase tracking-[1px] text-ink/50 hover:text-paua"
        >
          {"<-"} All playlists
        </Link>
        <p className="mt-3 font-heading text-h5 uppercase tracking-[1px] text-maroon">
          Playlist
        </p>
      </header>

      <PlaylistEditor
        playlist={playlist}
        items={items}
        displayOptions={displayOptions}
        mediaOptions={mediaOptions}
      />
    </div>
  );
}
