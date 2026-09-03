import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyPin } from "@/lib/pin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/** Signs the current version of the conduct policy with a PIN re-entry, same pattern as
 * every other signed record in the app (Room Restocking Log, warning acknowledgment). */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const { pin } = await req.json();
  if (typeof pin !== "string" || !pin) {
    return NextResponse.json({ error: "PIN is required to sign." }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const { data: employee, error: empError } = await supabase
    .from("employees")
    .select("pin_hash")
    .eq("id", session.employeeId)
    .single();
  if (empError || !employee?.pin_hash || !verifyPin(pin, employee.pin_hash)) {
    return NextResponse.json({ error: "Incorrect PIN." }, { status: 401 });
  }

  const { data: policy, error: policyError } = await supabase
    .from("policy_documents")
    .select("id, version")
    .eq("key", "conduct_policy")
    .maybeSingle();
  if (policyError) return NextResponse.json({ error: policyError.message }, { status: 500 });
  if (!policy) return NextResponse.json({ error: "Policy document not found." }, { status: 404 });

  const { error: insertError } = await supabase.from("policy_acknowledgments").insert({
    employee_id: session.employeeId,
    policy_document_id: policy.id,
    version: policy.version,
  });
  // A unique-constraint conflict just means this version is already signed -- treat as success.
  if (insertError && !insertError.message.includes("duplicate")) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
