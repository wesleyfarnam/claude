"use server";

import { requireUser } from "@/lib/auth/rbac";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type ScheduleInput = {
  name: string;
  priority?: number;
  start_date?: string | null;
  end_date?: string | null;
  days_of_week?: number[] | null;
  start_time?: string | null;
  end_time?: string | null;
  timezone?: string;
};

async function currentOrgId(): Promise<{
  orgId: string;
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"];
}> {
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase
    .from("user_org_roles")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No organization for current user");
  return { orgId: data.org_id as string, supabase };
}

function normalizeInput(input: ScheduleInput): Record<string, unknown> {
  return {
    name: input.name.trim() || "Untitled schedule",
    priority: typeof input.priority === "number" ? input.priority : 0,
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    days_of_week:
      input.days_of_week && input.days_of_week.length > 0
        ? input.days_of_week
        : null,
    start_time: input.start_time || null,
    end_time: input.end_time || null,
    timezone: input.timezone || "America/New_York",
  };
}

export async function createSchedule(input: ScheduleInput): Promise<string> {
  const { orgId, supabase } = await currentOrgId();
  const { data, error } = await supabase
    .from("schedules")
    .insert({ org_id: orgId, ...normalizeInput(input) })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/schedules");
  return data.id as string;
}

export async function updateSchedule(id: string, input: ScheduleInput): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("schedules")
    .update(normalizeInput(input))
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/schedules");
  revalidatePath(`/schedules/${id}`);
}

export async function addTarget(
  scheduleId: string,
  target: { device_id?: string | null; location_id?: string | null },
): Promise<void> {
  if (!target.device_id && !target.location_id) {
    throw new Error("Provide device_id or location_id");
  }
  const { supabase } = await requireUser();
  const { error } = await supabase.from("schedule_targets").insert({
    schedule_id: scheduleId,
    device_id: target.device_id ?? null,
    location_id: target.location_id ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/schedules/${scheduleId}`);
}

export async function removeTarget(targetId: string): Promise<void> {
  const { supabase } = await requireUser();
  // Read scheduleId first so we can revalidate.
  const { data } = await supabase
    .from("schedule_targets")
    .select("schedule_id")
    .eq("id", targetId)
    .maybeSingle();
  const { error } = await supabase.from("schedule_targets").delete().eq("id", targetId);
  if (error) throw new Error(error.message);
  if (data?.schedule_id) revalidatePath(`/schedules/${data.schedule_id}`);
}

export async function addPlaylist(scheduleId: string, playlistId: string): Promise<void> {
  const { supabase } = await requireUser();
  // Compute next position.
  const { data: existing } = await supabase
    .from("schedule_playlists")
    .select("position")
    .eq("schedule_id", scheduleId)
    .order("position", { ascending: false })
    .limit(1);
  const last = ((existing ?? []) as Array<{ position: number }>)[0];
  const nextPos = last ? last.position + 1 : 0;
  const { error } = await supabase.from("schedule_playlists").insert({
    schedule_id: scheduleId,
    playlist_id: playlistId,
    position: nextPos,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/schedules/${scheduleId}`);
}

export async function removePlaylist(scheduleId: string, playlistId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("schedule_playlists")
    .delete()
    .eq("schedule_id", scheduleId)
    .eq("playlist_id", playlistId);
  if (error) throw new Error(error.message);
  revalidatePath(`/schedules/${scheduleId}`);
}

export async function deleteSchedule(id: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("schedules").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/schedules");
  redirect("/schedules");
}

/** ── Form-action wrappers ────────────────────────────────────────────── */

function readDaysOfWeek(formData: FormData): number[] {
  const out: number[] = [];
  for (let i = 0; i < 7; i++) {
    if (formData.get(`dow_${i}`) === "on") out.push(i);
  }
  return out;
}

function readScheduleInput(formData: FormData): ScheduleInput {
  return {
    name: String(formData.get("name") ?? ""),
    priority: Number(formData.get("priority") ?? 0),
    start_date: (String(formData.get("start_date") ?? "") || null) as string | null,
    end_date: (String(formData.get("end_date") ?? "") || null) as string | null,
    days_of_week: readDaysOfWeek(formData),
    start_time: (String(formData.get("start_time") ?? "") || null) as string | null,
    end_time: (String(formData.get("end_time") ?? "") || null) as string | null,
    timezone: String(formData.get("timezone") ?? "America/New_York"),
  };
}

export async function createScheduleForm(formData: FormData): Promise<void> {
  const input = readScheduleInput(formData);
  const id = await createSchedule(input);
  redirect(`/schedules/${id}`);
}

export async function updateScheduleForm(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("id is required");
  await updateSchedule(id, readScheduleInput(formData));
}

export async function addTargetForm(formData: FormData): Promise<void> {
  const scheduleId = String(formData.get("schedule_id") ?? "");
  if (!scheduleId) throw new Error("schedule_id is required");
  const kind = String(formData.get("target_kind") ?? "");
  const value = String(formData.get("target_value") ?? "");
  if (!value) return;
  if (kind === "device") {
    await addTarget(scheduleId, { device_id: value });
  } else if (kind === "location") {
    await addTarget(scheduleId, { location_id: value });
  } else {
    throw new Error("Unknown target kind");
  }
}

export async function removeTargetForm(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("id is required");
  await removeTarget(id);
}

export async function addPlaylistForm(formData: FormData): Promise<void> {
  const scheduleId = String(formData.get("schedule_id") ?? "");
  const playlistId = String(formData.get("playlist_id") ?? "");
  if (!scheduleId || !playlistId) return;
  await addPlaylist(scheduleId, playlistId);
}

export async function removePlaylistForm(formData: FormData): Promise<void> {
  const scheduleId = String(formData.get("schedule_id") ?? "");
  const playlistId = String(formData.get("playlist_id") ?? "");
  if (!scheduleId || !playlistId) return;
  await removePlaylist(scheduleId, playlistId);
}

export async function deleteScheduleForm(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("id is required");
  await deleteSchedule(id);
}
