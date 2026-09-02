import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyPin } from "@/lib/pin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

/** One warning notice, plus this employee's count toward the 3-per-quarter threshold. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const { data: warning, error } = await supabase
    .from("warning_notices")
    .select("id, employee_id, violation_date, violation_description, status, quarter_label, employee_comments, acknowledged_at, created_at, employees!warning_notices_employee_id_fkey(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!warning) return NextResponse.json({ error: "Warning not found." }, { status: 404 });

  const isManager = session.role === "manager" || session.isAdmin;
  if (!isManager && warning.employee_id !== session.employeeId) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { count: quarterCount } = await supabase
    .from("warning_notices")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", warning.employee_id)
    .eq("quarter_label", warning.quarter_label);

  const emp = Array.isArray(warning.employees) ? warning.employees[0] : warning.employees;

  return NextResponse.json(
    {
      warning: {
        id: warning.id,
        employeeId: warning.employee_id,
        employeeName: emp?.name ?? "Unknown",
        violationDate: warning.violation_date,
        violationDescription: warning.violation_description,
        status: warning.status,
        quarterLabel: warning.quarter_label,
        employeeComments: warning.employee_comments,
        acknowledgedAt: warning.acknowledged_at,
        createdAt: warning.created_at,
      },
      quarterCount: quarterCount ?? 0,
      canAcknowledge: !isManager && warning.employee_id === session.employeeId && warning.status === "issued",
    },
    { headers: NO_STORE }
  );
}

/** The warned employee acknowledges the notice, re-entering her PIN as a signature. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const { comments, pin } = await req.json();
  if (typeof pin !== "string" || !pin) {
    return NextResponse.json({ error: "PIN is required to acknowledge." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: warning, error: fetchError } = await supabase
    .from("warning_notices")
    .select("id, employee_id, status")
    .eq("id", params.id)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!warning) return NextResponse.json({ error: "Warning not found." }, { status: 404 });
  if (warning.employee_id !== session.employeeId) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  if (warning.status !== "issued") {
    return NextResponse.json({ error: "This warning has already been acknowledged." }, { status: 400 });
  }

  const { data: employee, error: empError } = await supabase
    .from("employees")
    .select("pin_hash")
    .eq("id", session.employeeId)
    .single();
  if (empError || !employee?.pin_hash) {
    return NextResponse.json({ error: "Could not verify PIN." }, { status: 500 });
  }
  const validPin = verifyPin(pin, employee.pin_hash);
  if (!validPin) {
    return NextResponse.json({ error: "Incorrect PIN." }, { status: 401 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("warning_notices")
    .update({
      status: "acknowledged",
      employee_comments: typeof comments === "string" ? comments.trim() : null,
      acknowledged_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .eq("status", "issued")
    .select("id");
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "This warning has already been acknowledged." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
