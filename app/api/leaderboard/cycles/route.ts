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

/** Manager-only: every cycle, newest first (includes closed/archived ones). */
export async function GET() {
  const session = getSession();
  if (!isManager(session)) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("leaderboard_cycles")
    .select("id, name, start_date, end_date, prize_description, status, winner_employee_id, employees!leaderboard_cycles_winner_employee_id_fkey(name), announced_at")
    .order("start_date", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const cycles = (data ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    startDate: c.start_date,
    endDate: c.end_date,
    prizeDescription: c.prize_description,
    status: c.status,
    winnerName: c.employees?.name ?? null,
    announcedAt: c.announced_at,
  }));

  return NextResponse.json({ cycles }, { headers: NO_STORE });
}

/** Manager-only: start a new cycle. Blocked while one is already open (the DB also enforces this). */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!isManager(session)) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const { name, startDate, endDate, prizeDescription } = await req.json();
  if (!name?.trim() || !startDate || !endDate) {
    return NextResponse.json({ error: "Name, start date and end date are required." }, { status: 400 });
  }
  if (endDate < startDate) {
    return NextResponse.json({ error: "End date can't be before the start date." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: existing } = await supabase
    .from("leaderboard_cycles")
    .select("id")
    .in("status", ["open", "pending_confirmation"])
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "There's already an open cycle — close it first." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("leaderboard_cycles")
    .insert({
      name: name.trim(),
      start_date: startDate,
      end_date: endDate,
      prize_description: prizeDescription?.trim() || null,
      created_by: session!.employeeId,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: data.id });
}
