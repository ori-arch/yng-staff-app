import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/** Edit or deactivate/reactivate a recurring shift pattern. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !(session.isAdmin || session.role === "manager")) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const { weekday, startTime, endTime, note, active } = await req.json();
  const updates: Record<string, unknown> = {};
  if (weekday !== undefined) {
    const wd = Number(weekday);
    if (!Number.isInteger(wd) || wd < 0 || wd > 6) {
      return NextResponse.json({ error: "weekday must be 0 (Sun) to 6 (Sat)." }, { status: 400 });
    }
    updates.weekday = wd;
  }
  if (startTime !== undefined) updates.start_time = startTime;
  if (endTime !== undefined) updates.end_time = endTime;
  if (note !== undefined) updates.note = typeof note === "string" ? note.trim() || null : null;
  if (active !== undefined) updates.active = !!active;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("shift_patterns")
    .update(updates)
    .eq("id", params.id)
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
