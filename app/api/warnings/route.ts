import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { quarterLabel } from "@/lib/warnings";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

/** Managers/admins see every warning; everyone else sees only their own. */
export async function GET() {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const isManager = session.role === "manager" || session.isAdmin;

  const supabase = supabaseAdmin();
  let query = supabase
    .from("warning_notices")
    .select("id, employee_id, violation_date, violation_description, status, quarter_label, created_at, employees!warning_notices_employee_id_fkey(name)")
    .order("created_at", { ascending: false });

  if (!isManager) {
    query = query.eq("employee_id", session.employeeId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const warnings = (data ?? []).map((w) => {
    const emp = Array.isArray(w.employees) ? w.employees[0] : w.employees;
    return {
      id: w.id,
      employeeId: w.employee_id,
      employeeName: emp?.name ?? "Unknown",
      violationDate: w.violation_date,
      violationDescription: w.violation_description,
      status: w.status,
      quarterLabel: w.quarter_label,
      createdAt: w.created_at,
    };
  });

  return NextResponse.json({ warnings }, { headers: NO_STORE });
}

/** Manager/admin only: issue a new warning notice. */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const isManager = session.role === "manager" || session.isAdmin;
  if (!isManager) {
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  }

  const { employeeId, violationDate, violationDescription, sourceTable, sourceId } = await req.json();
  if (typeof employeeId !== "string" || !employeeId) {
    return NextResponse.json({ error: "Missing employeeId." }, { status: 400 });
  }
  if (typeof violationDate !== "string" || !violationDate) {
    return NextResponse.json({ error: "Missing violationDate." }, { status: 400 });
  }
  if (typeof violationDescription !== "string" || !violationDescription.trim()) {
    return NextResponse.json({ error: "Missing violationDescription." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("warning_notices")
    .insert({
      employee_id: employeeId,
      violation_date: violationDate,
      violation_description: violationDescription.trim(),
      source_table: typeof sourceTable === "string" ? sourceTable : null,
      source_id: typeof sourceId === "string" ? sourceId : null,
      quarter_label: quarterLabel(new Date(violationDate + "T00:00:00Z")),
      status: "issued",
      issued_by: session.employeeId,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
