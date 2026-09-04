import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/** Owner-only: mark a bug report fixed, or reopen it. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !session.isOwner) {
    return NextResponse.json({ error: "Only the owner can update bug reports." }, { status: 403 });
  }

  const { action, note } = await req.json();
  if (action !== "fix" && action !== "reopen") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("bug_reports")
    .update(
      action === "fix"
        ? { status: "fixed", fixed_by: session.employeeId, fixed_at: new Date().toISOString(), fixed_note: note ?? null }
        : { status: "open", fixed_by: null, fixed_at: null, fixed_note: null }
    )
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
