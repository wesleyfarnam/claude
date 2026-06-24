"use server";

import { requireUser } from "@/lib/auth/rbac";
import { weatherConfigSchema, newsConfigSchema, widgetConfigSchema } from "@drip-tv/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function currentOrgId(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("user_org_roles")
    .select("org_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No organization for current user");
  return data.org_id as string;
}

export async function createWeatherWidget(name: string, config: unknown): Promise<void> {
  const parsed = weatherConfigSchema.parse(config);
  const { user, supabase } = await requireUser();
  const orgId = await currentOrgId(supabase, user.id);
  const { data, error } = await supabase
    .from("widgets")
    .insert({
      org_id: orgId,
      name: name.trim() || "Weather",
      type: "weather",
      config: parsed,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/widgets");
  redirect(`/widgets/${data.id}`);
}

export async function createNewsWidget(name: string, config: unknown): Promise<void> {
  const parsed = newsConfigSchema.parse(config);
  const { user, supabase } = await requireUser();
  const orgId = await currentOrgId(supabase, user.id);
  const { data, error } = await supabase
    .from("widgets")
    .insert({
      org_id: orgId,
      name: name.trim() || "News",
      type: "news",
      config: parsed,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/widgets");
  redirect(`/widgets/${data.id}`);
}

export async function updateWidget(
  id: string,
  input: { name?: string; config?: unknown },
): Promise<void> {
  const { supabase } = await requireUser();
  const update: { name?: string; config?: unknown; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (typeof input.name === "string") update.name = input.name.trim() || "Untitled widget";
  if (input.config !== undefined) {
    update.config = widgetConfigSchema.parse(input.config);
  }
  const { error } = await supabase.from("widgets").update(update).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/widgets");
  revalidatePath(`/widgets/${id}`);
}

export async function deleteWidget(id: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("widgets").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/widgets");
  redirect("/widgets");
}

/** Form-friendly wrappers used by `<form action={...}>` in the widgets pages. */

export async function createWeatherWidgetForm(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "Weather");
  const zip = String(formData.get("zip") ?? "").trim();
  const country = String(formData.get("country") ?? "US").trim() || "US";
  const units = String(formData.get("units") ?? "imperial") === "metric" ? "metric" : "imperial";
  const showForecast = formData.get("showForecast") === "on";
  await createWeatherWidget(name, {
    kind: "weather",
    zip: zip || undefined,
    country,
    units,
    showForecast,
  });
}

export async function createNewsWidgetForm(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "News");
  const country = (String(formData.get("country") ?? "us").trim() || "us").toLowerCase();
  const category = String(formData.get("category") ?? "general");
  const keywordsRaw = String(formData.get("keywords") ?? "").trim();
  const keywords = keywordsRaw
    ? keywordsRaw.split(",").map((k) => k.trim()).filter(Boolean).slice(0, 10)
    : [];
  const max = Math.min(20, Math.max(1, Number(formData.get("max") ?? 5)));
  const rotateSec = Math.max(1, Number(formData.get("rotateSec") ?? 8));
  await createNewsWidget(name, {
    kind: "news",
    country,
    category,
    keywords,
    max,
    rotateSec,
  });
}

export async function updateWidgetForm(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("id is required");
  const kind = String(formData.get("kind") ?? "");
  const name = String(formData.get("name") ?? "");

  if (kind === "weather") {
    const config = {
      kind: "weather" as const,
      zip: String(formData.get("zip") ?? "").trim() || undefined,
      country: String(formData.get("country") ?? "US").trim() || "US",
      units: String(formData.get("units") ?? "imperial") === "metric" ? "metric" : "imperial",
      showForecast: formData.get("showForecast") === "on",
    };
    await updateWidget(id, { name, config });
    return;
  }

  if (kind === "news") {
    const keywordsRaw = String(formData.get("keywords") ?? "").trim();
    const keywords = keywordsRaw
      ? keywordsRaw.split(",").map((k) => k.trim()).filter(Boolean).slice(0, 10)
      : [];
    const config = {
      kind: "news" as const,
      country: (String(formData.get("country") ?? "us").trim() || "us").toLowerCase(),
      category: String(formData.get("category") ?? "general"),
      keywords,
      max: Math.min(20, Math.max(1, Number(formData.get("max") ?? 5))),
      rotateSec: Math.max(1, Number(formData.get("rotateSec") ?? 8)),
    };
    await updateWidget(id, { name, config });
    return;
  }

  throw new Error(`Unknown widget kind: ${kind}`);
}

export async function deleteWidgetForm(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("id is required");
  await deleteWidget(id);
}
