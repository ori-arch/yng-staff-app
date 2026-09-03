import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getCategories } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const UNDO_WINDOW_MINUTES = 10;

function isManager(session: { role: string; isAdmin: boolean } | null): boolean {
  return !!session && (session.role === "manager" || session.isAdmin);
}

/**
 * Two very different callers hit this:
 *  - A manager, who can edit or void any entry, any time (action: "update" | "void").
 *  - The employee who logged it herself, tapping "That was a mistake" within
 *    the 10-minute undo window (action: "undo") -- only for her own,
 *    self-logged, still-active entry.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const body = await req.json();
  const action = body.action;
  const supabase = supabaseAdmin();

  const { data: entry } = await supabase
    .from("leaderboard_entries")
    .select("id, employee_id, created_by, active, logged_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!entry) return NextResponse.json({ error: "Entry not found." }, { status: 404 });

  if (action === "undo") {
    if (entry.employee_id !== session.employeeId || entry.created_by !== null) {
      return NextResponse.json({ error: "You can only undo your own self-logged entries." }, { status: 403 });
    }
    if (!entry.active) return NextResponse.json({ error: "Already undone." }, { status: 400 });
    const ageMinutes = (Date.now() - new Date(entry.logged_at).getTime()) / 60000;
    if (ageMinutes > UNDO_WINDOW_MINUTES) {
      return NextResponse.json({ error: "That entry is more than 10 minutes old — ask a manager to remove it." }, { status: 400 });
    }
    const { error } = await supabase.from("leaderboard_entries").update({ active: false }).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (!isManager(session)) {
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  }

  if (action === "void") {
    const { error } = await supabase
      .from("leaderboard_entries")
      .update({ active: false, edited_by: session.employeeId, edited_at: new Date().toISOString() })
      .eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "restore") {
    const { error } = await supabase
      .from("leaderboard_entries")
      .update({ active: true, edited_by: session.employeeId, edited_at: new Date().toISOString() })
      .eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "update") {
    const { employeeId, categoryKey, points, note } = body;
    const updates: Record<string, unknown> = { edited_by: session.employeeId, edited_at: new Date().toISOString() };
    if (typeof employeeId === "string") updates.employee_id = employeeId;
    if (typeof categoryKey === "string") {
      const categories = await getCategories(supabase, false);
      const category = categories.find((c) => c.key === categoryKey);
      if (!category) return NextResponse.json({ error: "Unknown category." }, { status: 400 });
      updates.category_id = category.id;
      if (points === undefined) updates.points_awarded = category.points;
    }
    if (typeof points === "number") updates.points_awarded = points;
    if (typeof note === "string") updates.note = note.trim() || null;

    const { error } = await supabase.from("leaderboard_entries").update(updates).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
