import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getManagerRecipientIds, notifyEmployees } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

function isManager(session: { role: string; isAdmin: boolean } | null): boolean {
  return !!session && (session.role === "manager" || session.isAdmin);
}

/** Managers see every report (newest first); everyone else sees only their own. */
export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const supabase = supabaseAdmin();
  let query = supabase
    .from("room_issue_reports")
    .select(
      "id, comment, photo_url, status, created_at, resolved_at, resolved_note, " +
        "room:rooms(name), " +
        "employee:employees!room_issue_reports_employee_id_fkey(name), " +
        "resolver:employees!room_issue_reports_resolved_by_fkey(name)"
    )
    .order("created_at", { ascending: false })
    .limit(60);

  if (!isManager(session)) {
    query = query.eq("employee_id", session.employeeId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const reports = (data ?? []).map((r: any) => ({
    id: r.id,
    roomName: r.room?.name ?? "No room selected",
    employeeName: r.employee?.name ?? "Unknown",
    comment: r.comment,
    photoUrl: r.photo_url,
    status: r.status,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    resolvedNote: r.resolved_note,
    resolverName: r.resolver?.name ?? null,
  }));

  return NextResponse.json({ reports, isManager: isManager(session) }, { headers: NO_STORE });
}

/** Anyone logged in can file a report -- no PIN, this isn't a compliance signature, it's a heads-up. */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const form = await req.formData();
  const roomId = form.get("roomId");
  const comment = form.get("comment");
  const photo = form.get("photo");

  if (typeof comment !== "string" || !comment.trim()) {
    return NextResponse.json({ error: "Describe what's wrong." }, { status: 400 });
  }
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ error: "A photo is required." }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  let photoUrl: string;
  try {
    const buffer = Buffer.from(await photo.arrayBuffer());
    const ext = photo.type === "image/png" ? "png" : "jpg";
    const path = `${session.employeeId}/room-issue-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("checklist-photos")
      .upload(path, buffer, { contentType: photo.type || "image/jpeg", upsert: true });
    if (uploadError) throw new Error(uploadError.message);
    photoUrl = supabase.storage.from("checklist-photos").getPublicUrl(path).data.publicUrl;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Photo upload failed." }, { status: 500 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("room_issue_reports")
    .insert({
      employee_id: session.employeeId,
      room_id: typeof roomId === "string" && roomId ? roomId : null,
      comment: comment.trim(),
      photo_url: photoUrl,
    })
    .select("id, rooms(name)")
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  try {
    const roomName = (inserted as any)?.rooms?.name ?? "a room";
    const managerIds = await getManagerRecipientIds(supabase);
    await notifyEmployees(supabase, managerIds, {
      type: "task_due",
      title: `Room issue reported — ${roomName}`,
      body: `${session.name}: ${comment.trim()}`,
      link: "/room-issues",
    });
  } catch {
    // best-effort — don't fail the report over a notification hiccup
  }

  return NextResponse.json({ id: inserted?.id ?? null });
}
