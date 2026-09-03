import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

function isManager(session: { role: string; isAdmin: boolean } | null): boolean {
  return !!session && (session.role === "manager" || session.isAdmin);
}

/** The current conduct policy text plus this employee's own acknowledgment status. */
export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const supabase = supabaseAdmin();
  const { data: policy, error } = await supabase
    .from("policy_documents")
    .select("id, title, body, version, updated_at")
    .eq("key", "conduct_policy")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!policy) return NextResponse.json({ policy: null });

  const { data: ack } = await supabase
    .from("policy_acknowledgments")
    .select("version, signed_at")
    .eq("employee_id", session.employeeId)
    .eq("policy_document_id", policy.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json(
    {
      policy: { id: policy.id, title: policy.title, body: policy.body, version: policy.version, updatedAt: policy.updated_at },
      myAcknowledgment: ack ? { version: ack.version, signedAt: ack.signed_at, current: ack.version === policy.version } : null,
    },
    { headers: NO_STORE }
  );
}

/** Manager-only: edit the policy text. This bumps its version, which means everyone
 * has to re-sign -- the client warns before calling this. */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!isManager(session)) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const { title, body } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: "Policy text can't be empty." }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data: current } = await supabase.from("policy_documents").select("id, version").eq("key", "conduct_policy").maybeSingle();
  if (!current) return NextResponse.json({ error: "Policy document not found." }, { status: 404 });

  const { error } = await supabase
    .from("policy_documents")
    .update({
      title: typeof title === "string" && title.trim() ? title.trim() : undefined,
      body: body.trim(),
      version: current.version + 1,
      updated_by: session!.employeeId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", current.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, version: current.version + 1 });
}
