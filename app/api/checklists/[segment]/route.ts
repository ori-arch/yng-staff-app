import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSchedule } from "@/lib/schedule";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const LOOKBACK_DAYS = 3;

/**
 * Which calendar date this checklist submission is actually FOR -- not just
 * "whatever today's wall-clock date happens to be". If the employee has a
 * scheduled shift in the last few days that still needs this segment done,
 * file the submission under that shift's date instead of today, so a
 * checklist finished a day late shows up as "late" against the right day on
 * Compliance rather than as an on-time submission for a day she may not even
 * have been scheduled to work.
 */
async function resolveTargetDate(
  supabase: ReturnType<typeof supabaseAdmin>,
  employeeId: string,
  role: string,
  segment: string,
  today: string
): Promise<string> {
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - LOOKBACK_DAYS);
  const startDate = start.toISOString().slice(0, 10);

  const [{ shifts }, { data: doneRows }] = await Promise.all([
    getSchedule(supabase, { startDate, endDate: today, employeeId }),
    supabase
      .from("checklist_submissions")
      .select("submission_date")
      .eq("employee_id", employeeId)
      .eq("role", role)
      .eq("segment", segment)
      .gte("submission_date", startDate)
      .not("completed_at", "is", null),
  ]);

  const doneDates = new Set((doneRows ?? []).map((r) => r.submission_date as string));
  const scheduledDates = Array.from(new Set(shifts.map((s) => s.date))).sort();

  for (const d of scheduledDates) {
    if (d <= today && !doneDates.has(d)) return d;
  }
  return today;
}

/**
 * Loads (or creates) the current checklist submission for the logged-in
 * employee's role + the requested segment ('open' | 'close'), along with
 * per-item state.
 */
export async function GET(req: NextRequest, { params }: { params: { segment: string } }) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  if (session.role !== "front_desk" && session.role !== "aesthetician") {
    return NextResponse.json({ error: "No checklist is assigned to your role." }, { status: 403 });
  }

  const segment = params.segment;
  if (segment !== "open" && segment !== "close") {
    return NextResponse.json({ error: "Unknown segment." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const { data: templates, error: templatesError } = await supabase
    .from("checklist_templates")
    .select("id, item_order, item_text, requires_photo, first_shift_only, last_shift_only")
    .eq("role", session.role)
    .eq("segment", segment)
    .eq("active", true)
    .order("item_order");

  if (templatesError) {
    return NextResponse.json({ error: templatesError.message }, { status: 500 });
  }
  if (!templates || templates.length === 0) {
    return NextResponse.json({ error: "No checklist items configured for this segment yet." }, { status: 404 });
  }

  const again = req.nextUrl.searchParams.get("again") === "1";
  const targetDate = again ? today : await resolveTargetDate(supabase, session.employeeId, session.role, segment, today);

  // Find an existing, not-yet-completed submission for the target date, or create one.
  let { data: submission } = await supabase
    .from("checklist_submissions")
    .select("id, completed_at, submission_date")
    .eq("employee_id", session.employeeId)
    .eq("role", session.role)
    .eq("segment", segment)
    .eq("submission_date", targetDate)
    .is("completed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // If this segment was already signed off for that date and the caller hasn't
  // explicitly asked to start another, report that instead of silently opening a new one.
  if (!submission && !again) {
    const { data: completedAlready } = await supabase
      .from("checklist_submissions")
      .select("id, completed_at")
      .eq("employee_id", session.employeeId)
      .eq("role", session.role)
      .eq("segment", segment)
      .eq("submission_date", targetDate)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (completedAlready) {
      return NextResponse.json(
        { alreadyCompleted: true, completedAt: completedAlready.completed_at, segment },
        { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
      );
    }
  }

  if (!submission) {
    const { data: created, error: createError } = await supabase
      .from("checklist_submissions")
      .insert({ employee_id: session.employeeId, role: session.role, segment, submission_date: targetDate })
      .select("id, completed_at, submission_date")
      .single();
    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }
    submission = created;
  }

  const { data: existingItems } = await supabase
    .from("checklist_submission_items")
    .select("id, template_id, completed, photo_url")
    .eq("submission_id", submission.id);

  const items = [];
  for (const t of templates) {
    let item = existingItems?.find((i) => i.template_id === t.id);
    if (!item) {
      const { data: createdItem, error: itemErr } = await supabase
        .from("checklist_submission_items")
        .insert({ submission_id: submission.id, template_id: t.id })
        .select("id, template_id, completed, photo_url")
        .single();
      if (itemErr) {
        return NextResponse.json({ error: itemErr.message }, { status: 500 });
      }
      item = createdItem;
    }
    items.push({
      submissionItemId: item.id,
      templateId: t.id,
      itemText: t.item_text,
      requiresPhoto: t.requires_photo,
      firstShiftOnly: t.first_shift_only,
      lastShiftOnly: t.last_shift_only,
      completed: item.completed,
      photoUrl: item.photo_url,
    });
  }

  return NextResponse.json(
    { submissionId: submission.id, segment, items, forDate: submission.submission_date, isLate: submission.submission_date < today },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
  );
}
