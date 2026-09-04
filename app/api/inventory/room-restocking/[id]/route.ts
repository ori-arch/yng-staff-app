import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/** Manager-only: mark a "no replacement on hand" entry as ordered (or reopen it). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const isManager = session.role === "manager" || session.isAdmin;
  if (!isManager) {
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  }

  const { action } = await req.json();
  if (action !== "mark_ordered" && action !== "reopen") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("room_restocking_logs")
    .update(
      action === "mark_ordered"
        ? { ordered: true, ordered_by: session.employeeId, ordered_at: new Date().toISOString() }
        : { ordered: false, ordered_by: null, ordered_at: null }
    )
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
