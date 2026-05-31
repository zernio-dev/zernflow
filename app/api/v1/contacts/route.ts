import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) return NextResponse.json({ error: "Aucun espace de travail" }, { status: 404 });

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search");
  const tag = searchParams.get("tag");
  const subscribed = searchParams.get("subscribed");
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  let query = supabase
    .from("contacts")
    .select("*, contact_tags(tag_id, tags(id, name, color)), contact_channels(platform_sender_id, channel_id, channels(platform))", { count: "exact" })
    .eq("workspace_id", membership.workspace_id)
    .order("last_interaction_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`display_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  if (subscribed === "true") {
    query = query.eq("is_subscribed", true);
  } else if (subscribed === "false") {
    query = query.eq("is_subscribed", false);
  }

  const { data: contacts, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filter by tag in-memory (Supabase doesn't easily filter through join)
  let filtered = contacts || [];
  if (tag) {
    filtered = filtered.filter((c) =>
      (c.contact_tags as Array<{ tags: { name: string } | null }>)?.some(
        (ct) => ct.tags?.name === tag
      )
    );
  }

  return NextResponse.json({ contacts: filtered, total: count });
}
