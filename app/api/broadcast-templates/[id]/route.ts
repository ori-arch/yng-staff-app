import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Edits a broadcast template's title/body, or activates/deactivates it. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !(session.role === "manager" || session.isAdmin)) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const { title, body, active } = await req.json();
  const updates: Record<string, unknown> = {};
  if (title !== undefined) {
    if (!title.trim()) return NextResponse.json({ error: "Title can't be empty." }, { status: 400 });
    updates.title = title.trim();
  }
  if (body !== undefined) {
    if (!body.trim()) return NextResponse.json({ error: "Body can't be empty." }, { status: 400 });
    updates.body = body.trim();
  }
  if (active !== undefined) updates.active = !!active;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("broadcast_templates")
    .update(updates)
    .eq("id", params.id)
    .select("id, title, body, active")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ template: data });
}
