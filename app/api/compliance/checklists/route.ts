import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

/**
 * Manager-only: for a given date (defaults to today), reports which
 * checklist segments each front_desk/aesthetician employee completed,
 * missed, or still has pending — plus any warning already issued for it.
 *
 * A warning issued from this dashboard is tagged
 * source_table = "checklist:<segment>" and source_id = the submission id
 * (or null if the employee never even opened that segment that day) so it
 * can be matched back to the specific employee/date/segment cell here.
 */
export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const isManager = session.role === "manager" || session.isAdmin;
  if (!isManager) {
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const today = new Date().toISOString().slice(0, 10);
  const date = searchParams.get("date") || today;
  const isPastDate = date < today;

  const supabase = supabaseAdmin();

  const [{ data: employees, error: empError }, { data: templates, error: tplError }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, name, role")
      .eq("active", true)
      .in("role", ["front_desk", "aesthetician"])
      .order("name"),
    supabase.from("checklist_templates").select("role, segment").eq("active", true),
  ]);
  if (empError) return NextResponse.json({ error: empError.message }, { status: 500 });
  if (tplError) return NextResponse.json({ error: tplError.message }, { status: 500 });

  const segmentsByRole: Record<string, string[]> = {};
  for (const t of templates ?? []) {
    if (!segmentsByRole[t.role]) segmentsByRole[t.role] = [];
    if (!segmentsByRole[t.role].includes(t.segment)) segmentsByRole[t.role].push(t.segment);
  }

  const employeeIds = (employees ?? []).map((e) => e.id);
  const { data: submissions, error: subError } = await supabase
    .from("checklist_submissions")
    .select("employee_id, segment, completed_at")
    .eq("submission_date", date)
    .in("employee_id", employeeIds.length ? employeeIds : ["00000000-0000-0000-0000-000000000000"]);
  if (subError) return NextResponse.json({ error: subError.message }, { status: 500 });

  const { data: warnings, error: warnError } = await supabase
    .from("warning_notices")
    .select("id, employee_id, status, source_table")
    .eq("violation_date", date)
    .like("source_table", "checklist:%");
  if (warnError) return NextResponse.json({ error: warnError.message }, { status: 500 });

  const rows = (employees ?? []).map((emp) => {
    const segments = segmentsByRole[emp.role] ?? [];
    const segmentStatuses = segments.map((segment) => {
      const sub = (submissions ?? []).find((s) => s.employee_id === emp.id && s.segment === segment);
      const done = Boolean(sub?.completed_at);
      const status = done ? "done" : isPastDate ? "missed" : "pending";
      const existingWarning = (warnings ?? []).find(
        (w) => w.employee_id === emp.id && w.source_table === `checklist:${segment}`
      );
      return {
        segment,
        status,
        completedAt: sub?.completed_at ?? null,
        warning: existingWarning ? { id: existingWarning.id, status: existingWarning.status } : null,
      };
    });
    return { employeeId: emp.id, name: emp.name, role: emp.role, segments: segmentStatuses };
  });

  return NextResponse.json({ date, isPastDate, rows }, { headers: NO_STORE });
}
