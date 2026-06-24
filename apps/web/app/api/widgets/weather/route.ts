import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { weatherConfigSchema } from "@drip-tv/shared";
import { fetchWeather } from "@/lib/widgets/weather";

export const runtime = "nodejs";

async function handle(widgetId: string | null): Promise<Response> {
  if (!widgetId) {
    return NextResponse.json({ error: "widgetId required" }, { status: 400 });
  }

  const service = createSupabaseServiceClient();
  const { data, error } = await service
    .from("widgets")
    .select("id, type, config")
    .eq("id", widgetId)
    .eq("type", "weather")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Widget not found" }, { status: 404 });
  }

  const parsed = weatherConfigSchema.safeParse(data.config);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid widget config", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const payload = await fetchWeather(parsed.data);
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
  });
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  return handle(url.searchParams.get("widgetId"));
}

export async function POST(req: Request): Promise<Response> {
  let widgetId: string | null = null;
  try {
    const body = (await req.json()) as { widgetId?: string };
    widgetId = body.widgetId ?? null;
  } catch {
    widgetId = null;
  }
  if (!widgetId) {
    const url = new URL(req.url);
    widgetId = url.searchParams.get("widgetId");
  }
  return handle(widgetId);
}
