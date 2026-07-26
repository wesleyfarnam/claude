"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { displaySchema, type Display } from "@drip-tv/shared";
import { requireUser } from "@/lib/auth/rbac";

async function resolveOrgId(): Promise<{ orgId: string; supabase: Awaited<ReturnType<typeof requireUser>>["supabase"]; userId: string } | { error: string }> {
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase
    .from("user_org_roles")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "No organization membership found" };
  return { orgId: data.org_id as string, supabase, userId: user.id };
}

function newUuid(fallback: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : fallback;
}

function blankLayout(): Display {
  return {
    id: "00000000-0000-0000-0000-000000000000", // overwritten with row id after insert
    name: "Untitled",
    aspect_ratio: "16:9",
    pages: [
      {
        id: newUuid("00000000-0000-0000-0000-000000000002"),
        name: "Page 1",
        durationSec: 10,
        background: { color: "#0b0d12" },
        zones: [
          {
            id: newUuid("00000000-0000-0000-0000-000000000001"),
            x: 0,
            y: 0,
            w: 100,
            h: 100,
            z: 0,
            fit: "cover",
            background: "#0b0d12",
            content: {
              kind: "text",
              text: "Drag content here",
              fontSize: 32,
              color: "#ffffff",
              align: "center",
            },
          },
        ],
      },
    ],
    version: 1,
  };
}

export async function createDisplay() {
  const ctx = await resolveOrgId();
  if ("error" in ctx) {
    redirect(`/displays?error=${encodeURIComponent(ctx.error)}`);
  }
  const layout = blankLayout();
  const { data, error } = await ctx.supabase
    .from("displays")
    .insert({
      org_id: ctx.orgId,
      name: layout.name,
      aspect_ratio: layout.aspect_ratio,
      layout_json: layout,
      version: 1,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(`/displays?error=${encodeURIComponent(error?.message ?? "Could not create display")}`);
  }

  // Persist the row id back into the layout so the IDs match.
  const persisted: Display = { ...layout, id: data.id as string };
  await ctx.supabase.from("displays").update({ layout_json: persisted }).eq("id", data.id);

  revalidatePath("/displays");
  redirect(`/displays/${data.id}/edit`);
}

export async function saveDisplay(
  displayId: string,
  layout: Display,
  name: string,
  aspect: Display["aspect_ratio"],
): Promise<{ error?: string }> {
  const ctx = await resolveOrgId();
  if ("error" in ctx) return { error: ctx.error };

  // Bump version, force id alignment, and re-parse with the zod schema.
  const candidate: Display = {
    ...layout,
    id: displayId,
    name,
    aspect_ratio: aspect,
    version: (layout.version ?? 1) + 1,
  };
  const parsed = displaySchema.safeParse(candidate);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid layout" };
  }

  const { error } = await ctx.supabase
    .from("displays")
    .update({
      name: parsed.data.name,
      aspect_ratio: parsed.data.aspect_ratio,
      layout_json: parsed.data,
      version: parsed.data.version,
      updated_at: new Date().toISOString(),
    })
    .eq("id", displayId)
    .eq("org_id", ctx.orgId);

  if (error) return { error: error.message };

  revalidatePath("/displays");
  revalidatePath(`/displays/${displayId}/edit`);
  return {};
}
