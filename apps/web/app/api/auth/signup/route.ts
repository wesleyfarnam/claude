import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const name = String(form.get("name") ?? "");
  const orgName = String(form.get("org_name") ?? "");
  const origin = request.nextUrl.origin;

  const errorRedirect = (message: string) => {
    const url = new URL("/signup", origin);
    url.searchParams.set("error", message);
    return NextResponse.redirect(url, { status: 303 });
  };

  const success = NextResponse.redirect(new URL("/dashboard", origin), {
    status: 303,
  });
  const supabase = createSupabaseRouteClient(request, success);

  const { data: authData, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (error || !authData.user) {
    return errorRedirect(error?.message ?? "Signup failed");
  }

  // Bootstrap the org + admin role with the service client (the brand-new user
  // has no role rows yet, so RLS would block these inserts).
  const service = createSupabaseServiceClient();
  const slug = `${slugify(orgName)}-${authData.user.id.slice(0, 6)}`;
  const { data: org, error: orgErr } = await service
    .from("organizations")
    .insert({ name: orgName, slug })
    .select("id")
    .single();

  if (orgErr || !org) {
    return errorRedirect(orgErr?.message ?? "Could not create organization");
  }

  await service.from("user_org_roles").insert({
    user_id: authData.user.id,
    org_id: org.id,
    role: "admin",
  });

  return success;
}
