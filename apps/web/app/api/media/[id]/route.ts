import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/auth/rbac";
import { MEDIA_BUCKET } from "@/lib/media/storage";
import { getMux } from "@/lib/mux";

interface DeleteRow {
  id: string;
  org_id: string;
  storage_path: string;
  thumb_path: string | null;
  mux_asset_id: string | null;
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await context.params;

  // RLS-scoped read+delete so we only act on assets the caller owns.
  const supabase = await createSupabaseServerClient();
  const { data: asset, error: lookupErr } = await supabase
    .from("media_assets")
    .select("id, org_id, storage_path, thumb_path, mux_asset_id")
    .eq("id", id)
    .maybeSingle<DeleteRow>();

  if (lookupErr) {
    return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  }
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  // Storage cleanup uses the service client (no RLS on Storage objects table).
  const svc = createSupabaseServiceClient();
  const paths = [asset.storage_path, asset.thumb_path].filter(
    (p): p is string => typeof p === "string" && p.length > 0,
  );
  if (paths.length > 0) {
    const { error: rmErr } = await svc.storage.from(MEDIA_BUCKET).remove(paths);
    if (rmErr) {
      console.warn(`media delete: storage remove failed: ${rmErr.message}`);
    }
  }

  if (asset.mux_asset_id) {
    const mux = getMux();
    if (mux) {
      try {
        await mux.video.assets.delete(asset.mux_asset_id);
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown";
        console.warn(`media delete: mux delete failed: ${message}`);
      }
    }
  }

  const { error: delErr } = await supabase.from("media_assets").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
