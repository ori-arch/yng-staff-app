import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getActiveCycle, getCategories, computeStandings, daysRemaining } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };
const UNDO_WINDOW_MINUTES = 10;

/**
 * Everyone's view of the board: the open cycle (if any), full standings
 * (flat visibility -- a small team can infer the ranking anyway), the
 * current point values, and the signed-in employee's own recent entries
 * (with whether each is still inside the undo window).
 */
export async function GET() {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const cycle = await getActiveCycle(supabase);
  const categories = await getCategories(supabase);

  if (!cycle) {
    return NextResponse.json({ cycle: null, categories, standings: [], myEntries: [] }, { headers: NO_STORE });
  }

  const standings = await computeStandings(supabase, cycle.id);

  const { data: myEntries } = await supabase
    .from("leaderboard_entries")
    .select("id, category_id, points_awarded, logged_at, created_by")
    .eq("cycle_id", cycle.id)
    .eq("employee_id", session.employeeId)
    .eq("active", true)
    .order("logged_at", { ascending: false })
    .limit(25);

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const now = Date.now();
  const shapedEntries = (myEntries ?? []).map((e) => {
    const ageMinutes = (now - new Date(e.logged_at).getTime()) / 60000;
    return {
      id: e.id,
      categoryKey: categoryById.get(e.category_id)?.key ?? "unknown",
      categoryLabel: categoryById.get(e.category_id)?.label ?? "Unknown",
      points: e.points_awarded,
      loggedAt: e.logged_at,
      canUndo: e.created_by === null && ageMinutes <= UNDO_WINDOW_MINUTES,
    };
  });

  return NextResponse.json(
    {
      cycle: { ...cycle, daysRemaining: daysRemaining(cycle.endDate) },
      categories,
      standings: standings.map((s) => ({
        employeeId: s.employeeId,
        employeeName: s.employeeName,
        points: s.points,
        byCategory: s.byCategory,
        isMe: s.employeeId === session.employeeId,
      })),
      myEntries: shapedEntries,
    },
    { headers: NO_STORE }
  );
}
