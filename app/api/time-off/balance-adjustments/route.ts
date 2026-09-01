import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * Manager/admin manually grants or corrects an employee's time-off balance.
 * Stands in for the admin panel's future "set/adjust balance" control —
 * there is no admin panel yet, so this is exposed directly from /time-off.
 */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const isManager = session.role === "manager" || session.isAdmin;
  if (!isManager) {
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  }

  const { employeeId, hours, note } = await req.json();
  if (typeof employeeId !== "string" || !employeeId) {
    return NextResponse.json({ error: "Missing employeeId." }, { status: 400 });
  }
  const hoursNum = Number(hours);
  if (!Number.isFinite(hoursNum) || hoursNum === 0) {
    return NextResponse.json({ error: "Missing or invalid hours (must be a non-zero number)." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("time_off_balance_adjustments").insert({
    employee_id: employeeId,
    adjustment_hours: hoursNum,
    note: typeof note === "string" ? note.trim() || null : null,
    adjusted_by: session.employeeId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
