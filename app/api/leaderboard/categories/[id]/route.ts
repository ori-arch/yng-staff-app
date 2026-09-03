import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function isManager(session: { role: string; isAdmin: boolean } | null): boolean {
  return !!session && (session.role === "manager" || session.isAdmin);
}

/** Manager-only: edit a category's label/points, reorder it, or deactivate/reactivate it. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!isManager(session)) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const { label, description, points, displayOrder, active } = await req.json();
  const updates: Record<string, unknown> = {};
  if (typeof label === "string" && label.trim()) updates.label = label.trim();
  if (typeof description === "string") updates.description = description.trim() || null;
  if (typeof points === "number") updates.points = points;
  if (typeof displayOrder === "number") updates.display_order = displayOrder;
  if (typeof active === "boolean") updates.active = active;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("leaderboard_categories").update(updates).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
