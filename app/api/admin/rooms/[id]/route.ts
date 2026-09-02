import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !(session.isAdmin || session.role === "manager")) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const { name, active } = await req.json();
  const updates: Record<string, unknown> = {};
  if (name !== undefined) {
    if (!name.trim()) return NextResponse.json({ error: "Room name can't be empty." }, { status: 400 });
    updates.name = name.trim();
  }
  if (active !== undefined) updates.active = !!active;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("rooms")
    .update(updates)
    .eq("id", params.id)
    .select("id, name, active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ room: data });
}
