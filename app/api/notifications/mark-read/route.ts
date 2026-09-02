import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Marks every unread notification as read for the current employee. Called
 * when the bell panel is opened — this clears the red dot, but the rows
 * themselves are never deleted, so they stay visible in the list/history
 * exactly as before, just no longer counted as unread.
 */
export async function POST() {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("employee_id", session.employeeId)
    .is("read_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
