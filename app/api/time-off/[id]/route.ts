import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/** Manager/admin approves or denies a pending time-off request. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const isManager = session.role === "manager" || session.isAdmin;
  if (!isManager) {
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  }

  const { action } = await req.json();
  if (action !== "approve" && action !== "deny") {
    return NextResponse.json({ error: "action must be 'approve' or 'deny'." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: reqRow, error: fetchError } = await supabase
    .from("time_off_requests")
    .select("id, employee_id, start_date, end_date, hours_requested, status")
    .eq("id", params.id)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!reqRow) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  if (reqRow.status !== "pending") {
    return NextResponse.json({ error: "This request has already been decided." }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("time_off_requests")
    .update({
      status: action === "approve" ? "approved" : "denied",
      approved_by: session.employeeId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", params.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (action === "approve") {
    const { error: adjError } = await supabase.from("time_off_balance_adjustments").insert({
      employee_id: reqRow.employee_id,
      adjustment_hours: -Number(reqRow.hours_requested),
      note: `Time off approved: ${reqRow.start_date} to ${reqRow.end_date}`,
      adjusted_by: session.employeeId,
    });
    if (adjError) return NextResponse.json({ error: adjError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
