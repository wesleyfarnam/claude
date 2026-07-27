import { NextResponse } from "next/server";
import { requireDeviceFromRequest, DeviceAuthError } from "@/lib/device-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { fetchWeather } from "@/lib/widgets/weather";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/devices/me/weather
 *
 * Device-authed. Resolves the device's assigned location (postal code +
 * country) and returns a live weather payload for it. Weather zones carry no
 * location of their own — it always comes from the device's location. Falls
 * back to a stub payload (handled inside fetchWeather) when the location or
 * API key is missing, so the player always gets a well-formed response.
 */
export async function GET(req: Request) {
  let auth;
  try {
    auth = await requireDeviceFromRequest(req);
  } catch (err) {
    const status = err instanceof DeviceAuthError ? err.status : 401;
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status });
  }

  let zip: string | undefined;
  let country = "US";
  if (auth.device.location_id) {
    const svc = createSupabaseServiceClient();
    const { data: loc } = await svc
      .from("locations")
      .select("postal_code, country_code")
      .eq("id", auth.device.location_id)
      .maybeSingle();
    if (loc?.postal_code) zip = loc.postal_code as string;
    if (loc?.country_code) country = loc.country_code as string;
  }

  const payload = await fetchWeather({
    kind: "weather",
    zip,
    country,
    units: "imperial", // payload carries both tempF and tempC; the zone picks
    showForecast: true,
  });

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
