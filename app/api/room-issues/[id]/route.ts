import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function isManager(session: { role: string; isAdmin: boolean } | null): boolean {
  return !!session && (session.role === "manager" || session.isAdmin);
}

/** Manager-only: mark a report resolved (with an optional note), or reopen one. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!isManager(session)) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const { action, note } = await req.json();
  const supabase = supabaseAdmin();

  if (action === "resolve") {
    const { error } = await supabase
      .from("room_issue_reports")
      .update({
        status: "resolved",
        resolved_by: session!.employeeId,
        resolved_at: new Date().toISOString(),
        resolved_note: typeof note === "string" && note.trim() ? note.trim() : null,
      })
      .eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "reopen") {
    const { error } = await supabase
      .from("room_issue_reports")
      .update({ status: "open", resolved_by: null, resolved_at: null, resolved_note: null })
      .eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
