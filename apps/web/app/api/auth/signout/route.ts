import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

export async function POST(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const response = NextResponse.redirect(new URL("/login", origin), {
    status: 303,
  });
  const supabase = createSupabaseRouteClient(request, response);
  await supabase.auth.signOut();
  return response;
}
