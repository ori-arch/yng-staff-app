import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getActiveCycle, getCategories } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * The one-tap log. Deliberately captures nothing beyond who/what/when --
 * see the spec's rationale: Zenoti already has the transaction detail, this
 * is a pointer, not a second ledger.
 */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const { categoryKey } = await req.json();
  if (typeof categoryKey !== "string" || !categoryKey) {
    return NextResponse.json({ error: "categoryKey is required." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const cycle = await getActiveCycle(supabase);
  if (!cycle || cycle.status !== "open") {
    return NextResponse.json({ error: "There's no open leaderboard cycle right now." }, { status: 400 });
  }

  const categories = await getCategories(supabase);
  const category = categories.find((c) => c.key === categoryKey);
  if (!category) {
    return NextResponse.json({ error: "Unknown category." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("leaderboard_entries")
    .insert({
      employee_id: session.employeeId,
      category_id: category.id,
      points_awarded: category.points,
      cycle_id: cycle.id,
    })
    .select("id, logged_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    id: data.id,
    loggedAt: data.logged_at,
    category: category.label,
    points: category.points,
  });
}
