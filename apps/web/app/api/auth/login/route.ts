import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/dashboard");
  const origin = request.nextUrl.origin;

  // Build the success redirect up front so Supabase writes the session cookie
  // onto it. 303 forces the follow-up to be a GET.
  const success = NextResponse.redirect(new URL(next, origin), { status: 303 });
  const supabase = createSupabaseRouteClient(request, success);

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const url = new URL("/login", origin);
    url.searchParams.set("error", error.message);
    url.searchParams.set("next", next);
    return NextResponse.redirect(url, { status: 303 });
  }

  return success;
}
