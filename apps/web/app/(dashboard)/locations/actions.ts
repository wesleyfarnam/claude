"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/rbac";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const DEFAULT_TZ = "America/New_York";
const NAME_MAX = 120;

type OrgCtx = {
  orgId: string;
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"];
  userId: string;
};

async function resolveOrgId(): Promise<OrgCtx | { error: string }> {
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

function readLocationInput(formData: FormData): {
  name: string;
  address: string | null;
  timezone: string;
} {
  const name = String(formData.get("name") ?? "").trim();
  const rawAddress = String(formData.get("address") ?? "").trim();
  const rawTz = String(formData.get("timezone") ?? "").trim();
  return {
    name,
    address: rawAddress.length > 0 ? rawAddress : null,
    timezone: rawTz.length > 0 ? rawTz : DEFAULT_TZ,
  };
}

export async function createLocation(formData: FormData): Promise<void> {
  const ctx = await resolveOrgId();
  if ("error" in ctx) {
    redirect(`/locations?error=${encodeURIComponent(ctx.error)}`);
  }
  const input = readLocationInput(formData);
  if (input.name.length === 0) {
    redirect(
      `/locations/new?error=${encodeURIComponent("Name is required")}`,
    );
  }
  if (input.name.length > NAME_MAX) {
    redirect(
      `/locations/new?error=${encodeURIComponent("Name must be 120 characters or fewer")}`,
    );
  }
  const { data, error } = await ctx.supabase
    .from("locations")
    .insert({
      org_id: ctx.orgId,
      name: input.name,
      address: input.address,
      timezone: input.timezone,
    })
    .select("id")
    .single();
  if (error || !data) {
    redirect(
      `/locations/new?error=${encodeURIComponent(error?.message ?? "Could not create location")}`,
    );
  }
  revalidatePath("/locations");
  redirect(`/locations/${data.id}`);
}

export async function updateLocation(
  id: string,
  formData: FormData,
): Promise<void> {
  const ctx = await resolveOrgId();
  if ("error" in ctx) {
    redirect(`/locations/${id}?error=${encodeURIComponent(ctx.error)}`);
  }
  const input = readLocationInput(formData);
  if (input.name.length === 0) {
    redirect(
      `/locations/${id}?error=${encodeURIComponent("Name is required")}`,
    );
  }
  if (input.name.length > NAME_MAX) {
    redirect(
      `/locations/${id}?error=${encodeURIComponent("Name must be 120 characters or fewer")}`,
    );
  }
  const { error } = await ctx.supabase
    .from("locations")
    .update({
      name: input.name,
      address: input.address,
      timezone: input.timezone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", ctx.orgId);
  if (error) {
    redirect(`/locations/${id}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/locations");
  revalidatePath(`/locations/${id}`);
  redirect(`/locations/${id}?updated=1`);
}

export async function deleteLocation(id: string): Promise<void> {
  const ctx = await resolveOrgId();
  if ("error" in ctx) {
    redirect(`/locations?error=${encodeURIComponent(ctx.error)}`);
  }
  const { error } = await ctx.supabase
    .from("locations")
    .delete()
    .eq("id", id)
    .eq("org_id", ctx.orgId);
  if (error) {
    redirect(`/locations/${id}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/locations");
  redirect("/locations");
}

export async function addManager(
  locationId: string,
  email: string,
): Promise<{ error?: string; ok?: true }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { error: "Provide a valid email address" };
  }

  const ctx = await resolveOrgId();
  if ("error" in ctx) return { error: ctx.error };

  // Verify the location is inside caller's org (RLS-scoped read).
  const { data: loc, error: locErr } = await ctx.supabase
    .from("locations")
    .select("id, org_id")
    .eq("id", locationId)
    .maybeSingle();
  if (locErr) return { error: locErr.message };
  if (!loc) return { error: "Location not found" };
  if (loc.org_id !== ctx.orgId) return { error: "Not allowed" };

  // Look up user by email via the service client (bypasses RLS so we can find
  // users who aren't yet in this org).
  const service = createSupabaseServiceClient();
  const { data: userRow, error: userErr } = await service
    .from("users")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (userErr) return { error: userErr.message };
  if (!userRow) {
    return { error: "User not found. They must sign up first." };
  }

  const targetUserId = userRow.id as string;

  // If they aren't in this org yet, add them as a location_manager role.
  const { data: existingRole, error: roleErr } = await service
    .from("user_org_roles")
    .select("id")
    .eq("user_id", targetUserId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (roleErr) return { error: roleErr.message };
  if (!existingRole) {
    const { error: insRoleErr } = await service
      .from("user_org_roles")
      .insert({
        user_id: targetUserId,
        org_id: ctx.orgId,
        role: "location_manager",
      });
    if (insRoleErr) return { error: insRoleErr.message };
  }

  // Attach to the location (RLS-scoped — org admin required by policy).
  const { error: lmErr } = await ctx.supabase.from("location_managers").insert({
    user_id: targetUserId,
    location_id: locationId,
    granted_by: ctx.userId,
  });
  if (lmErr) {
    // A duplicate PK just means they're already a manager here.
    const msg = lmErr.message.toLowerCase();
    if (!msg.includes("duplicate") && !msg.includes("unique")) {
      return { error: lmErr.message };
    }
  }

  revalidatePath(`/locations/${locationId}`);
  return { ok: true };
}

export async function removeManager(
  locationId: string,
  userId: string,
): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("location_managers")
    .delete()
    .eq("location_id", locationId)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath(`/locations/${locationId}`);
  return {};
}

/* ── Form-action wrappers ─────────────────────────────────────────── */

export async function updateLocationForm(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("id is required");
  await updateLocation(id, formData);
}

export async function deleteLocationForm(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("id is required");
  await deleteLocation(id);
}

export async function addManagerForm(formData: FormData): Promise<void> {
  const locationId = String(formData.get("location_id") ?? "");
  const email = String(formData.get("email") ?? "");
  if (!locationId) throw new Error("location_id is required");
  const result = await addManager(locationId, email);
  if (result.error) {
    redirect(
      `/locations/${locationId}?error=${encodeURIComponent(result.error)}`,
    );
  }
  redirect(`/locations/${locationId}?added=1`);
}

export async function removeManagerForm(formData: FormData): Promise<void> {
  const locationId = String(formData.get("location_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  if (!locationId || !userId) {
    throw new Error("location_id and user_id are required");
  }
  const result = await removeManager(locationId, userId);
  if (result.error) {
    redirect(
      `/locations/${locationId}?error=${encodeURIComponent(result.error)}`,
    );
  }
}
