import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

function isManager(session: { role: string; isAdmin: boolean } | null): boolean {
  return !!session && (session.role === "manager" || session.isAdmin);
}

/** Manager-only: manual total corrections, as ledger rows -- same pattern as time-off balance adjustments. */
export async function GET(req: NextRequest) {
  const session = getSession();
  if (!isManager(session)) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const cycleId = new URL(req.url).searchParams.get("cycleId");
  if (!cycleId) return NextResponse.json({ error: "cycleId is required." }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("leaderboard_adjustments")
    .select("id, employee_id, points, note, created_at, employees!leaderboard_adjustments_employee_id_fkey(name)")
    .eq("cycle_id", cycleId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const adjustments = (data ?? []).map((a: any) => ({
    id: a.id,
    employeeId: a.employee_id,
    employeeName: a.employees?.name ?? "Unknown",
    points: a.points,
    note: a.note,
    createdAt: a.created_at,
  }));

  return NextResponse.json({ adjustments }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!isManager(session)) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const { employeeId, cycleId, points, note } = await req.json();
  if (!employeeId || !cycleId || typeof points !== "number" || !note?.trim()) {
    return NextResponse.json({ error: "employeeId, cycleId, points and a note are all required." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("leaderboard_adjustments")
    .insert({ employee_id: employeeId, cycle_id: cycleId, points, note: note.trim(), adjusted_by: session!.employeeId })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
