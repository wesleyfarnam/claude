"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/rbac";

type OrgContext = {
  orgId: string;
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"];
  userId: string;
};

async function resolveOrgId(): Promise<OrgContext | { error: string }> {
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase
    .from("user_org_roles")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    return { error: error?.message ?? "No organization membership found" };
  }
  return { orgId: data.org_id as string, supabase, userId: user.id };
}

export async function createPlaylist(formData: FormData) {
  const rawName = String(formData.get("name") ?? "").trim();
  const name = rawName.length > 0 ? rawName : "Untitled playlist";
  const ctx = await resolveOrgId();
  if ("error" in ctx) {
    redirect(`/playlists?error=${encodeURIComponent(ctx.error)}`);
  }
  const { data, error } = await ctx.supabase
    .from("playlists")
    .insert({
      org_id: ctx.orgId,
      name,
      loop: true,
      default_item_duration_sec: 10,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    redirect(`/playlists?error=${encodeURIComponent(error?.message ?? "Could not create playlist")}`);
  }
  revalidatePath("/playlists");
  redirect(`/playlists/${data.id}`);
}

export async function updatePlaylist(
  playlistId: string,
  patch: { name?: string; loop?: boolean; default_item_duration_sec?: number },
): Promise<{ error?: string }> {
  const ctx = await resolveOrgId();
  if ("error" in ctx) return { error: ctx.error };

  const update: Record<string, unknown> = {};
  if (typeof patch.name === "string") {
    const trimmed = patch.name.trim();
    if (trimmed.length === 0) return { error: "Name is required" };
    if (trimmed.length > 120) return { error: "Name too long" };
    update.name = trimmed;
  }
  if (typeof patch.loop === "boolean") update.loop = patch.loop;
  if (typeof patch.default_item_duration_sec === "number") {
    if (
      !Number.isInteger(patch.default_item_duration_sec) ||
      patch.default_item_duration_sec <= 0
    ) {
      return { error: "Duration must be a positive integer" };
    }
    update.default_item_duration_sec = patch.default_item_duration_sec;
  }
  update.updated_at = new Date().toISOString();

  const { error } = await ctx.supabase
    .from("playlists")
    .update(update)
    .eq("id", playlistId)
    .eq("org_id", ctx.orgId);
  if (error) return { error: error.message };
  revalidatePath(`/playlists/${playlistId}`);
  revalidatePath("/playlists");
  return {};
}

export async function addItem(
  playlistId: string,
  item: { display_id?: string | null; media_id?: string | null; duration_sec?: number },
): Promise<{ error?: string }> {
  const ctx = await resolveOrgId();
  if ("error" in ctx) return { error: ctx.error };

  const display_id = item.display_id ?? null;
  const media_id = item.media_id ?? null;
  if ((display_id === null) === (media_id === null)) {
    return { error: "Pick exactly one of display or media" };
  }
  const duration = item.duration_sec && item.duration_sec > 0 ? Math.floor(item.duration_sec) : 10;

  // Ownership check: load the playlist to confirm it belongs to this org.
  const { data: playlist, error: plErr } = await ctx.supabase
    .from("playlists")
    .select("id")
    .eq("id", playlistId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (plErr || !playlist) return { error: plErr?.message ?? "Playlist not found" };

  // Determine next position.
  const { data: lastRow } = await ctx.supabase
    .from("playlist_items")
    .select("position")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = lastRow ? ((lastRow.position as number) ?? -1) + 1 : 0;

  const { error } = await ctx.supabase.from("playlist_items").insert({
    playlist_id: playlistId,
    position: nextPosition,
    display_id,
    media_id,
    duration_sec: duration,
    transition: "cut",
  });
  if (error) return { error: error.message };
  revalidatePath(`/playlists/${playlistId}`);
  return {};
}

export async function removeItem(itemId: string): Promise<{ error?: string }> {
  const ctx = await resolveOrgId();
  if ("error" in ctx) return { error: ctx.error };

  // Look up parent playlist so we can revalidate and re-pack positions.
  const { data: item, error: itemErr } = await ctx.supabase
    .from("playlist_items")
    .select("playlist_id, position, playlist:playlists!inner(org_id)")
    .eq("id", itemId)
    .maybeSingle();
  if (itemErr || !item) return { error: itemErr?.message ?? "Item not found" };
  const playlistRel = item.playlist as { org_id: string } | { org_id: string }[] | null;
  const playlistOrg = Array.isArray(playlistRel) ? playlistRel[0]?.org_id : playlistRel?.org_id;
  if (playlistOrg !== ctx.orgId) return { error: "Not allowed" };

  const playlistId = item.playlist_id as string;
  const { error } = await ctx.supabase.from("playlist_items").delete().eq("id", itemId);
  if (error) return { error: error.message };

  // Re-pack positions.
  const { data: remaining } = await ctx.supabase
    .from("playlist_items")
    .select("id, position")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: true });
  if (remaining) {
    for (let i = 0; i < remaining.length; i++) {
      const row = remaining[i];
      if (!row) continue;
      if (row.position !== i) {
        await ctx.supabase
          .from("playlist_items")
          .update({ position: i })
          .eq("id", row.id);
      }
    }
  }

  revalidatePath(`/playlists/${playlistId}`);
  return {};
}

export async function moveItem(
  itemId: string,
  direction: "up" | "down",
): Promise<{ error?: string }> {
  const ctx = await resolveOrgId();
  if ("error" in ctx) return { error: ctx.error };

  const { data: item, error: itemErr } = await ctx.supabase
    .from("playlist_items")
    .select("id, playlist_id, position, playlist:playlists!inner(org_id)")
    .eq("id", itemId)
    .maybeSingle();
  if (itemErr || !item) return { error: itemErr?.message ?? "Item not found" };
  const playlistRel = item.playlist as { org_id: string } | { org_id: string }[] | null;
  const playlistOrg = Array.isArray(playlistRel) ? playlistRel[0]?.org_id : playlistRel?.org_id;
  if (playlistOrg !== ctx.orgId) return { error: "Not allowed" };

  const playlistId = item.playlist_id as string;
  const currentPos = item.position as number;
  const targetPos = direction === "up" ? currentPos - 1 : currentPos + 1;

  if (targetPos < 0) return {};

  const { data: neighbor } = await ctx.supabase
    .from("playlist_items")
    .select("id, position")
    .eq("playlist_id", playlistId)
    .eq("position", targetPos)
    .maybeSingle();

  if (!neighbor) return {}; // already at edge

  // Two-step swap with a temporary out-of-range position to dodge any uniqueness.
  await ctx.supabase
    .from("playlist_items")
    .update({ position: -1 })
    .eq("id", itemId);
  await ctx.supabase
    .from("playlist_items")
    .update({ position: currentPos })
    .eq("id", neighbor.id);
  await ctx.supabase
    .from("playlist_items")
    .update({ position: targetPos })
    .eq("id", itemId);

  revalidatePath(`/playlists/${playlistId}`);
  return {};
}
