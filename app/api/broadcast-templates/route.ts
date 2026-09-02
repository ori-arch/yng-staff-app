import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

/**
 * Broadcast templates, manager/admin only. Defaults to active-only (for the
 * Send a Broadcast picker) — pass ?all=1 to include inactive ones too (for
 * Admin Panel -> Broadcast Templates, which needs to show/reactivate them).
 */
export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session || !(session.role === "manager" || session.isAdmin)) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get("all") === "1";

  const supabase = supabaseAdmin();
  let query = supabase.from("broadcast_templates").select("id, title, body, active").order("title");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ templates: data ?? [] }, { headers: NO_STORE });
}

/** Creates a new broadcast template (Admin Panel -> Broadcast Templates). */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session || !(session.role === "manager" || session.isAdmin)) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const { title, body } = await req.json();
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }
  if (typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "Body is required." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("broadcast_templates")
    .insert({ title: title.trim(), body: body.trim(), created_by: session.employeeId })
    .select("id, title, body, active")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ template: data });
}
