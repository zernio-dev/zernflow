import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createZernioClient } from "@/lib/zernio-client";
import { checkAttachment } from "@/lib/inbox-upload";
import { uploadToZernio } from "@/lib/zernio-media";

/**
 * POST /api/v1/media  (multipart: file, platform?)
 *
 * Uploads a file to Zernio media storage for use in a flow message (for example the reward a
 * comment automation sends) and returns { url, type, name }.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!membership) return NextResponse.json({ error: "No workspace" }, { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }
  const platform = form.get("platform")?.toString() || "instagram";
  const check = checkAttachment(file.type, file.size, platform);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("late_api_key_encrypted")
    .eq("id", membership.workspace_id)
    .single();
  if (!workspace?.late_api_key_encrypted) {
    return NextResponse.json({ error: "Add your Zernio API key in Settings first." }, { status: 400 });
  }

  try {
    const url = await uploadToZernio(createZernioClient(workspace.late_api_key_encrypted), file);
    return NextResponse.json({ url, type: check.kind, name: file.name }, { status: 201 });
  } catch (error) {
    console.error("Media upload failed:", error);
    return NextResponse.json({ error: "Upload failed. Try again." }, { status: 502 });
  }
}
