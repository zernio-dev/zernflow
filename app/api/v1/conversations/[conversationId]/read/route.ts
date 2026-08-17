import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/v1/conversations/[conversationId]/read
 *
 * Marks a conversation as read (sets unread_count to 0).
 * Replaces the old client-side Supabase call that exposed the service
 * role client to the browser.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId } = await params;
  if (!conversationId) {
    return NextResponse.json(
      { error: "conversationId required" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("conversations")
    .update({ unread_count: 0 })
    .eq("id", conversationId);

  if (error) {
    console.error("Failed to mark conversation as read:", error);
    return NextResponse.json(
      { error: "Failed to mark as read" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
