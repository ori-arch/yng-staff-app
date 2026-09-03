import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyPin } from "@/lib/pin";
import { windowLabelFor, Track } from "@/lib/warnings";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

function isManager(session: { role: string; isAdmin: boolean } | null): boolean {
  return !!session && (session.role === "manager" || session.isAdmin);
}

/** One warning notice, plus this employee's active count toward the strike limit on its track. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const { data: warningRaw, error } = await supabase
    .from("warning_notices")
    .select(
      "id, employee_id, violation_date, violation_description, status, quarter_label, track, window_label, strike_number, active, edited_at, employee_comments, acknowledged_at, created_at, " +
        "employees!warning_notices_employee_id_fkey(name), " +
        "violation_types(name, level_label, description, recommended_action, strike_limit)"
    )
    .eq("id", params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!warningRaw) return NextResponse.json({ error: "Warning not found." }, { status: 404 });
  const warning = warningRaw as any;

  const mgr = isManager(session);
  if (!mgr && warning.employee_id !== session.employeeId) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const emp = Array.isArray(warning.employees) ? warning.employees[0] : warning.employees;
  const type = Array.isArray(warning.violation_types) ? warning.violation_types[0] : warning.violation_types;

  let trackCount = 0;
  if (warning.track && warning.window_label) {
    const { count } = await supabase
      .from("warning_notices")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", warning.employee_id)
      .eq("track", warning.track)
      .eq("window_label", warning.window_label)
      .eq("active", true);
    trackCount = count ?? 0;
  }

  const { data: allTypes } = await supabase.from("violation_types").select("id, key, name, track").eq("active", true).order("display_order");

  return NextResponse.json(
    {
      warning: {
        id: warning.id,
        employeeId: warning.employee_id,
        employeeName: emp?.name ?? "Unknown",
        violationDate: warning.violation_date,
        violationDescription: warning.violation_description,
        violationTypeName: type?.name ?? null,
        levelLabel: type?.level_label ?? null,
        typeDescription: type?.description ?? null,
        recommendedAction: type?.recommended_action ?? null,
        status: warning.status,
        quarterLabel: warning.quarter_label,
        track: warning.track,
        windowLabel: warning.window_label,
        strikeNumber: warning.strike_number,
        strikeLimit: type?.strike_limit ?? null,
        active: warning.active,
        employeeComments: warning.employee_comments,
        acknowledgedAt: warning.acknowledged_at,
        createdAt: warning.created_at,
      },
      trackCount,
      violationTypes: allTypes ?? [],
      isManager: mgr,
      canAcknowledge: !mgr && warning.employee_id === session.employeeId && warning.status === "issued" && warning.active,
    },
    { headers: NO_STORE }
  );
}

/**
 * Three different actions land here:
 *  - The warned employee acknowledges it (PIN re-entry, same as before).
 *  - A manager edits it (reassign violation type / date / note) -- recomputes
 *    the track/window/strike number, same logic as issuing a new one.
 *  - A manager voids or restores it (a correction, not a real event).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const body = await req.json();
  const supabase = supabaseAdmin();

  if (body.action === "void" || body.action === "restore") {
    if (!isManager(session)) return NextResponse.json({ error: "Managers only." }, { status: 403 });
    const { error } = await supabase
      .from("warning_notices")
      .update({ active: body.action === "restore", edited_by: session.employeeId, edited_at: new Date().toISOString() })
      .eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "edit") {
    if (!isManager(session)) return NextResponse.json({ error: "Managers only." }, { status: 403 });
    const { violationTypeId, violationDate, violationDescription } = body;

    const { data: existing } = await supabase.from("warning_notices").select("employee_id, violation_date").eq("id", params.id).maybeSingle();
    if (!existing) return NextResponse.json({ error: "Warning not found." }, { status: 404 });

    const updates: Record<string, unknown> = { edited_by: session.employeeId, edited_at: new Date().toISOString() };
    if (typeof violationDescription === "string") updates.violation_description = violationDescription.trim() || null;
    const effectiveDate = typeof violationDate === "string" && violationDate ? violationDate : existing.violation_date;
    if (typeof violationDate === "string" && violationDate) updates.violation_date = violationDate;

    if (typeof violationTypeId === "string" && violationTypeId) {
      const { data: type } = await supabase.from("violation_types").select("track").eq("id", violationTypeId).maybeSingle();
      if (!type) return NextResponse.json({ error: "Unknown violation type." }, { status: 400 });
      const track = type.track as Track;
      const windowLabel = windowLabelFor(track, new Date(effectiveDate + "T00:00:00Z"));
      const { count } = await supabase
        .from("warning_notices")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", existing.employee_id)
        .eq("track", track)
        .eq("window_label", windowLabel)
        .eq("active", true)
        .neq("id", params.id);
      updates.violation_type_id = violationTypeId;
      updates.track = track;
      updates.window_label = windowLabel;
      updates.strike_number = (count ?? 0) + 1;
    }

    const { error } = await supabase.from("warning_notices").update(updates).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Default: the warned employee acknowledges it.
  const { comments, pin } = body;
  if (typeof pin !== "string" || !pin) {
    return NextResponse.json({ error: "PIN is required to acknowledge." }, { status: 400 });
  }

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
