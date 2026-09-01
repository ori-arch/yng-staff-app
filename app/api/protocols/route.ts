import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

/** Lists current (non-archived) protocols, optionally filtered by category or a title search. */
export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const q = searchParams.get("q");

  const supabase = supabaseAdmin();
  let query = supabase
    .from("protocols")
    .select("id, title, category, file_url, body_text, version, created_at, employees(name)")
    .eq("archived", false)
    .order("title");

  if (category) query = query.eq("category", category);
  if (q) query = query.ilike("title", `%${q}%`);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const protocols = (data ?? []).map((p) => {
    const uploader = Array.isArray(p.employees) ? p.employees[0] : p.employees;
    return {
      id: p.id,
      title: p.title,
      category: p.category,
      hasFile: !!p.file_url,
      hasBody: !!p.body_text,
      version: p.version,
      createdAt: p.created_at,
      uploadedByName: uploader?.name ?? null,
    };
  });

  return NextResponse.json({ protocols }, { headers: NO_STORE });
}

/**
 * Creates a new protocol, or a new version of one if the title matches an
 * existing active protocol (the old row is archived, not deleted).
 */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const isManager = session.role === "manager" || session.isAdmin;
  if (!isManager) {
    return NextResponse.json({ error: "Only managers and admins can upload protocols." }, { status: 403 });
  }

  const form = await req.formData();
  const title = form.get("title");
  const category = form.get("category");
  const bodyText = form.get("bodyText");
  const file = form.get("file");

  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }
  const hasBody = typeof bodyText === "string" && bodyText.trim().length > 0;
  const hasFile = file instanceof File && file.size > 0;
  if (!hasBody && !hasFile) {
    return NextResponse.json({ error: "Add either a file or protocol text." }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  let fileUrl: string | null = null;
  if (hasFile) {
    const f = file as File;
    const buffer = Buffer.from(await f.arrayBuffer());
    const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("protocol-files")
      .upload(path, buffer, { contentType: f.type || "application/octet-stream", upsert: true });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }
    const { data: publicUrl } = supabase.storage.from("protocol-files").getPublicUrl(path);
    fileUrl = publicUrl.publicUrl;
  }

  // If a non-archived protocol with this exact title already exists, archive it
  // and bump the version rather than deleting history.
  const { data: existing } = await supabase
    .from("protocols")
    .select("id, version")
    .eq("title", title.trim())
    .eq("archived", false)
    .maybeSingle();

  let nextVersion = 1;
  if (existing) {
    nextVersion = existing.version + 1;
    const { error: archiveError } = await supabase
      .from("protocols")
      .update({ archived: true })
      .eq("id", existing.id);
    if (archiveError) {
      return NextResponse.json({ error: archiveError.message }, { status: 500 });
    }
  }

  const { data: created, error: insertError } = await supabase
    .from("protocols")
    .insert({
      title: title.trim(),
      category: typeof category === "string" && category.trim() ? category.trim() : null,
      file_url: fileUrl,
      body_text: hasBody ? (bodyText as string).trim() : null,
      uploaded_by: session.employeeId,
      version: nextVersion,
      archived: false,
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: created.id });
}
