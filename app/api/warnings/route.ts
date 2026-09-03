import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { quarterLabel, windowLabelFor, Track } from "@/lib/warnings";
import { getManagerRecipientIds, notifyEmployees } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

/** Managers/admins see every warning; everyone else sees only their own. Voided ones are
 * included (marked inactive) so the audit trail stays visible to managers. */
export async function GET() {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const isManager = session.role === "manager" || session.isAdmin;

  const supabase = supabaseAdmin();
  let query = supabase
    .from("warning_notices")
    .select(
      "id, employee_id, violation_date, violation_description, status, quarter_label, track, window_label, strike_number, active, edited_at, created_at, " +
        "employees!warning_notices_employee_id_fkey(name), " +
        "violation_types(name, level_label, strike_limit)"
    )
    .order("created_at", { ascending: false });

  if (!isManager) {
    query = query.eq("employee_id", session.employeeId).eq("active", true);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const warnings = (data ?? []).map((w: any) => {
    const emp = Array.isArray(w.employees) ? w.employees[0] : w.employees;
    const type = Array.isArray(w.violation_types) ? w.violation_types[0] : w.violation_types;
    return {
      id: w.id,
      employeeId: w.employee_id,
      employeeName: emp?.name ?? "Unknown",
      violationDate: w.violation_date,
      violationDescription: w.violation_description,
      violationTypeName: type?.name ?? null,
      levelLabel: type?.level_label ?? null,
      status: w.status,
      quarterLabel: w.quarter_label,
      track: w.track,
      windowLabel: w.window_label,
      strikeNumber: w.strike_number,
      strikeLimit: type?.strike_limit ?? null,
      active: w.active,
      createdAt: w.created_at,
    };
  });

  return NextResponse.json({ warnings }, { headers: NO_STORE });
}

/**
 * Manager/admin only: issue a new warning notice. Picking a violation type
 * snapshots its track/description onto the warning (so a later edit to the
 * catalog doesn't rewrite history) and computes which strike number this is
 * within the type's current reset window -- surfaced to managers, never
 * enforced automatically.
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

  const { employeeId, violationDate, violationDescription, violationTypeId, sourceTable, sourceId } = await req.json();
  if (typeof employeeId !== "string" || !employeeId) {
    return NextResponse.json({ error: "Missing employeeId." }, { status: 400 });
  }
  if (typeof violationDate !== "string" || !violationDate) {
    return NextResponse.json({ error: "Missing violationDate." }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // The missed-checklist digest doesn't pick a type explicitly -- map it onto
  // the matching catalog entry so it still counts toward the Yellow track.
  let resolvedTypeId: string | null = typeof violationTypeId === "string" && violationTypeId ? violationTypeId : null;
  if (!resolvedTypeId && typeof sourceTable === "string" && sourceTable.startsWith("checklist:")) {
    const { data: fallbackType } = await supabase
      .from("violation_types")
      .select("id")
      .eq("key", "failure_to_complete_daily_tasks")
      .maybeSingle();
    resolvedTypeId = fallbackType?.id ?? null;
  }

  if (!resolvedTypeId && (typeof violationDescription !== "string" || !violationDescription.trim())) {
    return NextResponse.json({ error: "Pick a violation type, or provide a description." }, { status: 400 });
  }

  let track: Track | null = null;
  let windowLabel: string | null = null;
  let typeName: string | null = null;
  let typeDescription: string | null = null;
  let strikeLimit: number | null = null;

  if (resolvedTypeId) {
    const { data: type } = await supabase
      .from("violation_types")
      .select("track, name, description, strike_limit")
      .eq("id", resolvedTypeId)
      .maybeSingle();
    if (!type) return NextResponse.json({ error: "Unknown violation type." }, { status: 400 });
    track = type.track as Track;
    windowLabel = windowLabelFor(track, new Date(violationDate + "T00:00:00Z"));
    typeName = type.name;
    typeDescription = type.description;
    strikeLimit = type.strike_limit;
  }

  let strikeNumber: number | null = null;
  if (track && windowLabel) {
    const { count } = await supabase
      .from("warning_notices")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", employeeId)
      .eq("track", track)
      .eq("window_label", windowLabel)
      .eq("active", true);
    strikeNumber = (count ?? 0) + 1;
  }

  const { data, error } = await supabase
    .from("warning_notices")
    .insert({
      employee_id: employeeId,
      violation_date: violationDate,
      violation_description: typeof violationDescription === "string" && violationDescription.trim() ? violationDescription.trim() : null,
      violation_type_id: resolvedTypeId,
      track,
      window_label: windowLabel,
      strike_number: strikeNumber,
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

  const managerIds = (await getManagerRecipientIds(supabase)).filter((id) => id !== session.employeeId);
  const { data: warnedEmployee } = await supabase.from("employees").select("name").eq("id", employeeId).maybeSingle();
  const label = typeName ?? violationDescription?.trim() ?? "a policy violation";
  await notifyEmployees(supabase, managerIds, {
    type: "approval_needed",
    title: "Warning issued",
    body: `${warnedEmployee?.name ?? "An employee"} — ${label}`,
    link: `/warnings/${data.id}`,
  });

  if (strikeNumber && strikeLimit && strikeNumber >= strikeLimit) {
    await notifyEmployees(supabase, managerIds, {
      type: "approval_needed",
      title: `⚠️ ${warnedEmployee?.name ?? "An employee"} hit the strike limit`,
      body: `Strike ${strikeNumber} of ${strikeLimit} on the ${track} track (${typeName}) — review needed.`,
      link: `/warnings/${data.id}`,
    });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
