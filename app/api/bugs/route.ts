import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { notifyEmployees } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

/** The owner sees every bug report; everyone else sees only their own. */
export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const supabase = supabaseAdmin();
  let query = supabase
    .from("bug_reports")
    .select(
      "id, description, page_path, photo_url, status, created_at, fixed_at, fixed_note, " +
        "reporter:employees!bug_reports_reported_by_fkey(name), " +
        "fixer:employees!bug_reports_fixed_by_fkey(name)"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (!session.isOwner) {
    query = query.eq("reported_by", session.employeeId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const reports = (data ?? []).map((r: any) => ({
    id: r.id,
    description: r.description,
    pagePath: r.page_path,
    photoUrl: r.photo_url,
    status: r.status,
    createdAt: r.created_at,
    fixedAt: r.fixed_at,
    fixedNote: r.fixed_note,
    reporterName: r.reporter?.name ?? "Unknown",
    fixerName: r.fixer?.name ?? null,
  }));

  return NextResponse.json({ reports, isOwner: session.isOwner }, { headers: NO_STORE });
}

/** Anyone logged in can file a bug report -- no PIN, just a heads-up to the owner. */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const form = await req.formData();
  const description = form.get("description");
  const pagePath = form.get("pagePath");
  const photo = form.get("photo");

  if (typeof description !== "string" || !description.trim()) {
    return NextResponse.json({ error: "Describe what's broken." }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  let photoUrl: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    try {
      const buffer = Buffer.from(await photo.arrayBuffer());
      const ext = photo.type === "image/png" ? "png" : "jpg";
      const path = `${session.employeeId}/bug-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("checklist-photos")
        .upload(path, buffer, { contentType: photo.type || "image/jpeg", upsert: true });
      if (uploadError) throw new Error(uploadError.message);
      photoUrl = supabase.storage.from("checklist-photos").getPublicUrl(path).data.publicUrl;
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Photo upload failed." }, { status: 500 });
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("bug_reports")
    .insert({
      reported_by: session.employeeId,
      description: description.trim(),
      page_path: typeof pagePath === "string" && pagePath ? pagePath : null,
      photo_url: photoUrl,
    })
    .select("id")
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  try {
    const { data: owners } = await supabase.from("employees").select("id").eq("is_owner", true).eq("active", true);
    const ownerIds = (owners ?? []).map((o: any) => o.id as string);
    await notifyEmployees(supabase, ownerIds, {
      type: "task_due",
      title: "🐞 New bug report",
      body: `${session.name}: ${description.trim()}`,
      link: "/bugs",
    });
  } catch {
    // best-effort — don't fail the report over a notification hiccup
  }

  return NextResponse.json({ id: inserted?.id ?? null });
}
