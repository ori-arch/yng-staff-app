import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Toggles one checklist item's completed state, optionally attaching a photo. */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const form = await req.formData();
  const submissionItemId = form.get("submissionItemId");
  const completed = form.get("completed") === "true";
  const photo = form.get("photo");

  if (typeof submissionItemId !== "string") {
    return NextResponse.json({ error: "Missing submissionItemId." }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // Confirm this item belongs to a submission owned by this employee.
  const { data: item, error: itemError } = await supabase
    .from("checklist_submission_items")
    .select("id, submission_id, checklist_submissions!inner(employee_id, completed_at)")
    .eq("id", submissionItemId)
    .single();

  if (itemError || !item) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }
  const submissionInfo = Array.isArray(item.checklist_submissions)
    ? item.checklist_submissions[0]
    : item.checklist_submissions;
  if (submissionInfo?.employee_id !== session.employeeId) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  if (submissionInfo?.completed_at) {
    return NextResponse.json({ error: "This checklist is already submitted." }, { status: 400 });
  }

  let photoUrl: string | undefined;
  if (photo instanceof File && photo.size > 0) {
    const buffer = Buffer.from(await photo.arrayBuffer());
    const ext = photo.type === "image/png" ? "png" : "jpg";
    const path = `${session.employeeId}/${submissionItemId}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("checklist-photos")
      .upload(path, buffer, { contentType: photo.type || "image/jpeg", upsert: true });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }
    const { data: publicUrl } = supabase.storage.from("checklist-photos").getPublicUrl(path);
    photoUrl = publicUrl.publicUrl;
  }

  const update: Record<string, unknown> = {
    completed,
    completed_at: completed ? new Date().toISOString() : null,
  };
  if (photoUrl) update.photo_url = photoUrl;

  const { data: updated, error: updateError } = await supabase
    .from("checklist_submission_items")
    .update(update)
    .eq("id", submissionItemId)
    .select("id, completed, photo_url")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ item: updated });
}
