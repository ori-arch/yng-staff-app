import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSchedule, totalScheduledHours } from "@/lib/schedule";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * How many hours the current employee is actually scheduled to work within a
 * date range -- used on the time-off request form so she can see the real
 * impact of the days she's asking for instead of guessing a number by hand.
 */
export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Missing startDate/endDate." }, { status: 400 });
  }
  if (endDate < startDate) {
    return NextResponse.json({ error: "End date can't be before start date." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { shifts } = await getSchedule(supabase, { startDate, endDate, employeeId: session.employeeId });
  const hours = totalScheduledHours(shifts, session.employeeId);

  return NextResponse.json(
    { hours, shiftCount: shifts.length },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
  );
}
