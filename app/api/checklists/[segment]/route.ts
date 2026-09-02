import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * Loads (or creates) today's checklist submission for the logged-in employee's
 * role + the requested segment ('open' | 'close'), along with per-item state.
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

  // Find an existing, not-yet-completed submission for today, or create one.
  let { data: submission } = await supabase
    .from("checklist_submissions")
    .select("id, completed_at")
    .eq("employee_id", session.employeeId)
    .eq("role", session.role)
    .eq("segment", segment)
    .eq("submission_date", today)
    .is("completed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // If this segment was already signed off today and the caller hasn't explicitly
  // asked to start another, report that instead of silently opening a new one.
  if (!submission && req.nextUrl.searchParams.get("again") !== "1") {
    const { data: completedToday } = await supabase
      .from("checklist_submissions")
      .select("id, completed_at")
      .eq("employee_id", session.employeeId)
      .eq("role", session.role)
      .eq("segment", segment)
      .eq("submission_date", today)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (completedToday) {
      return NextResponse.json(
        { alreadyCompleted: true, completedAt: completedToday.completed_at, segment },
        { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
      );
    }
  }

  if (!submission) {
    const { data: created, error: createError } = await supabase
      .from("checklist_submissions")
      .insert({ employee_id: session.employeeId, role: session.role, segment, submission_date: today })
      .select("id, completed_at")
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
    { submissionId: submission.id, segment, items },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
  );
}
