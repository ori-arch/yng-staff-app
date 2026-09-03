import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getCategories } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

function isManager(session: { role: string; isAdmin: boolean } | null): boolean {
  return !!session && (session.role === "manager" || session.isAdmin);
}

/** Manager-only: every log entry (active and voided) for a cycle, newest first. */
export async function GET(req: NextRequest) {
  const session = getSession();
  if (!isManager(session)) {
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  }

  const cycleId = new URL(req.url).searchParams.get("cycleId");
  if (!cycleId) return NextResponse.json({ error: "cycleId is required." }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("leaderboard_entries")
    .select(
      "id, employee_id, category_id, points_awarded, logged_at, active, note, edited_at, " +
        "employee:employees!leaderboard_entries_employee_id_fkey(name), " +
        "creator:employees!leaderboard_entries_created_by_fkey(name), " +
        "editor:employees!leaderboard_entries_edited_by_fkey(name)"
    )
    .eq("cycle_id", cycleId)
    .order("logged_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const categories = await getCategories(supabase, false);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const entries = (data ?? []).map((e: any) => ({
    id: e.id,
    employeeId: e.employee_id,
    employeeName: e.employee?.name ?? "Unknown",
    categoryId: e.category_id,
    categoryLabel: categoryById.get(e.category_id)?.label ?? "Unknown",
    points: e.points_awarded,
    loggedAt: e.logged_at,
    active: e.active,
    note: e.note,
    loggedByManager: !!e.creator?.name,
    creatorName: e.creator?.name ?? null,
    editedByName: e.editor?.name ?? null,
    editedAt: e.edited_at,
  }));

  return NextResponse.json({ entries }, { headers: NO_STORE });
}

/** Manager-only: log an entry on someone else's behalf (a review or new-client tag she never tapped in herself). */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!isManager(session)) {
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  }

  const { employeeId, categoryKey, cycleId, note } = await req.json();
  if (!employeeId || !categoryKey || !cycleId) {
    return NextResponse.json({ error: "employeeId, categoryKey and cycleId are required." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const categories = await getCategories(supabase, false);
  const category = categories.find((c) => c.key === categoryKey);
  if (!category) return NextResponse.json({ error: "Unknown category." }, { status: 400 });

  const { data, error } = await supabase
    .from("leaderboard_entries")
    .insert({
      employee_id: employeeId,
      category_id: category.id,
      points_awarded: category.points,
      cycle_id: cycleId,
      created_by: session!.employeeId,
      note: typeof note === "string" && note.trim() ? note.trim() : null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: data.id });
}
