"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

export async function signupAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "");
  const orgName = String(formData.get("org_name") ?? "");

  const supabase = await createSupabaseServerClient();
  const { data: authData, error } = await supabase.auth.signUp({
    email, password, options: { data: { name } },
  });

  if (error || !authData.user) {
    const params = new URLSearchParams({ error: error?.message ?? "Signup failed" });
    redirect(`/signup?${params.toString()}`);
  }

  const service = createSupabaseServiceClient();
  const slug = `${slugify(orgName)}-${authData.user.id.slice(0, 6)}`;
  const { data: org, error: orgErr } = await service
    .from("organizations")
    .insert({ name: orgName, slug })
    .select("id")
    .single();

  if (orgErr || !org) {
    const params = new URLSearchParams({ error: orgErr?.message ?? "Could not create organization" });
    redirect(`/signup?${params.toString()}`);
  }

  await service.from("user_org_roles").insert({
    user_id: authData.user.id,
    org_id: org.id,
    role: "admin",
  });

  redirect("/dashboard");
}
