import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSchedule } from "@/lib/schedule";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

/**
 * Computed shifts (+ approved time off) for a date range. Staff always get
 * their own schedule regardless of any employeeId param; managers/admins
 * can pass ?employeeId=... to scope to one person, or omit it for the
 * whole team.
 */
export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const isManager = session.role === "manager" || session.isAdmin;

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ error: "Missing start/end." }, { status: 400 });
  }

  const requestedEmployeeId = searchParams.get("employeeId") || undefined;
  const employeeId = isManager ? requestedEmployeeId : session.employeeId;

  const supabase = supabaseAdmin();
  try {
    const { shifts, timeOff } = await getSchedule(supabase, { startDate: start, endDate: end, employeeId });
    return NextResponse.json({ shifts, timeOff }, { headers: NO_STORE });
  } catch (err) {
    const message = err instanceof Error ? err.message : (err as { message?: string })?.message || "Failed to load schedule.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
