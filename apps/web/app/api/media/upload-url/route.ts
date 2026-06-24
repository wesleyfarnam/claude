import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/rbac";
import { isAllowedMime, prepareUpload, ALLOWED_MIMES } from "@/lib/media/upload";

interface UploadUrlBody {
  filename?: unknown;
  mime?: unknown;
  bytes?: unknown;
}

export async function POST(request: Request) {
  const { user, supabase } = await requireUser();

  let raw: UploadUrlBody;
  try {
    raw = (await request.json()) as UploadUrlBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const filename = typeof raw.filename === "string" ? raw.filename.trim() : "";
  const mime = typeof raw.mime === "string" ? raw.mime : "";
  const bytes = typeof raw.bytes === "number" ? raw.bytes : Number(raw.bytes);

  if (!filename) {
    return NextResponse.json({ error: "filename is required" }, { status: 400 });
  }
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return NextResponse.json({ error: "bytes must be a positive number" }, { status: 400 });
  }
  if (!isAllowedMime(mime)) {
    return NextResponse.json(
      { error: `mime not allowed; expected one of ${ALLOWED_MIMES.join(", ")}` },
      { status: 415 },
    );
  }

  // Find caller's first org via user_org_roles.
  const { data: roleRow, error: roleErr } = await supabase
    .from("user_org_roles")
    .select("org_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (roleErr) {
    return NextResponse.json({ error: roleErr.message }, { status: 500 });
  }
  if (!roleRow?.org_id) {
    return NextResponse.json({ error: "User has no organization" }, { status: 403 });
  }

  try {
    const result = await prepareUpload({
      orgId: roleRow.org_id,
      filename,
      mime,
      bytes,
      userId: user.id,
    });
    return NextResponse.json({
      assetId: result.assetId,
      signedUploadUrl: result.signedUploadUrl,
      storagePath: result.storagePath,
      token: result.token,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
