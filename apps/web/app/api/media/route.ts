import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/rbac";
import { publicThumbUrl } from "@/lib/media/storage";

/**
 * GET /api/media
 *
 * Returns the caller's media library as JSON — RLS scopes rows to the caller's
 * org via the SSR Supabase client. Thumbnails are exchanged for long-lived
 * signed URLs so the client can display them directly.
 *
 * Used by MediaPickerModal to poll for freshly-uploaded assets while the
 * builder modal is open, so an in-flight upload becomes selectable as soon as
 * it finalizes (status → 'ready').
 */

interface MediaRow {
  id: string;
  name: string;
  type: "image" | "video";
  status: "uploading" | "processing" | "ready" | "error";
  thumb_path: string | null;
}

export interface MediaListItem {
  id: string;
  name: string;
  type: "image" | "video";
  status: "uploading" | "processing" | "ready" | "error";
  thumb_path: string | null;
}

export async function GET() {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("media_assets")
    .select("id, name, type, status, thumb_path")
    .order("created_at", { ascending: false })
    .returns<MediaRow[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const media: MediaListItem[] = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      thumb_path: row.thumb_path ? await publicThumbUrl(row.thumb_path) : null,
    })),
  );

  // no-store: this is called by a modal polling every 3s, and stale data would
  // defeat the whole point of polling.
  return NextResponse.json(
    { media },
    { headers: { "cache-control": "no-store" } },
  );
}
