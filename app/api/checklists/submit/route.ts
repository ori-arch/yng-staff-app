import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyPin } from "@/lib/pin";

export const dynamic = "force-dynamic";

/** Finalizes a checklist submission once every item is done, re-confirming identity via PIN. */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const { submissionId, pin } = await req.json();
  if (!submissionId || !pin) {
    return NextResponse.json({ error: "Missing submissionId or pin." }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const { data: submission, error: subError } = await supabase
    .from("checklist_submissions")
    .select("id, employee_id, completed_at")
    .eq("id", submissionId)
    .single();

  if (subError || !submission) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }
  if (submission.employee_id !== session.employeeId) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  if (submission.completed_at) {
    return NextResponse.json({ error: "Already submitted." }, { status: 400 });
  }

  const { data: employee, error: empError } = await supabase
    .from("employees")
    .select("pin_hash")
    .eq("id", session.employeeId)
    .single();
  if (empError || !employee || !verifyPin(pin, employee.pin_hash)) {
    return NextResponse.json({ error: "Incorrect PIN." }, { status: 401 });
  }

  const { data: items, error: itemsError } = await supabase
    .from("checklist_submission_items")
    .select("id, completed, photo_url, checklist_templates!inner(requires_photo)")
    .eq("submission_id", submissionId);

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  const incomplete = (items ?? []).filter((i) => !i.completed);
  if (incomplete.length > 0) {
    return NextResponse.json(
      { error: `${incomplete.length} item(s) still need to be checked off.` },
      { status: 400 }
    );
  }
  const missingPhoto = (items ?? []).filter((i) => {
    const tpl = Array.isArray(i.checklist_templates) ? i.checklist_templates[0] : i.checklist_templates;
    return tpl?.requires_photo && !i.photo_url;
  });
  if (missingPhoto.length > 0) {
    return NextResponse.json(
      { error: "One or more items still need a photo before you can submit." },
      { status: 400 }
    );
  }

  const { data: finalized, error: finalizeError } = await supabase
    .from("checklist_submissions")
    .update({ completed_at: new Date().toISOString(), pin_signature_confirmed: true })
    .eq("id", submissionId)
    .is("completed_at", null)
    .select("id");

  if (finalizeError) {
    return NextResponse.json({ error: finalizeError.message }, { status: 500 });
  }
  if (!finalized || finalized.length === 0) {
    return NextResponse.json({ error: "Already submitted." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
