import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { computeStandings } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

function isManager(session: { role: string; isAdmin: boolean } | null): boolean {
  return !!session && (session.role === "manager" || session.isAdmin);
}

/** Manager-only: one cycle's details plus its standings, regardless of status -- used by the review/confirm screen. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!isManager(session)) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const supabase = supabaseAdmin();
  const { data: cycle, error } = await supabase
    .from("leaderboard_cycles")
    .select("id, name, start_date, end_date, prize_description, status, winner_employee_id, winner_override_reason, confirmed_at, announced_at")
    .eq("id", params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!cycle) return NextResponse.json({ error: "Cycle not found." }, { status: 404 });

  const standings = await computeStandings(supabase, params.id);

  return NextResponse.json(
    {
      cycle: {
        id: cycle.id,
        name: cycle.name,
        startDate: cycle.start_date,
        endDate: cycle.end_date,
        prizeDescription: cycle.prize_description,
        status: cycle.status,
        winnerEmployeeId: cycle.winner_employee_id,
        winnerOverrideReason: cycle.winner_override_reason,
        confirmedAt: cycle.confirmed_at,
        announcedAt: cycle.announced_at,
      },
      standings: standings.map((s) => ({
        employeeId: s.employeeId,
        employeeName: s.employeeName,
        points: s.points,
        byCategory: s.byCategory,
      })),
    },
    { headers: NO_STORE }
  );
}

/**
 * Manager-only: edit an open cycle's details, or move it straight to
 * "pending_confirmation" early (action: "close_early") if it needs to wrap
 * up before its scheduled end date. Confirming the winner and closing it
 * for good happens at /api/leaderboard/confirm.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!isManager(session)) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const body = await req.json();
  const supabase = supabaseAdmin();

  if (body.action === "close_early") {
    const { error } = await supabase
      .from("leaderboard_cycles")
      .update({ status: "pending_confirmation" })
      .eq("id", params.id)
      .eq("status", "open");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { name, startDate, endDate, prizeDescription } = body;
  const updates: Record<string, unknown> = {};
  if (typeof name === "string" && name.trim()) updates.name = name.trim();
  if (typeof startDate === "string") updates.start_date = startDate;
  if (typeof endDate === "string") updates.end_date = endDate;
  if (prizeDescription !== undefined) updates.prize_description = prizeDescription?.trim() || null;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { error } = await supabase.from("leaderboard_cycles").update(updates).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
