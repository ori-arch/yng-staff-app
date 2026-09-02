import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

/** Every recurring weekly shift pattern (incl. inactive), manager/admin only. */
export async function GET() {
  const session = getSession();
  if (!session || !(session.isAdmin || session.role === "manager")) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("shift_patterns")
    .select("id, employee_id, weekday, start_time, end_time, note, active, created_at, room_id, employees!shift_patterns_employee_id_fkey(name), rooms(name)")
    .order("weekday")
    .order("start_time");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const patterns = (data ?? []).map((p) => {
    const emp = Array.isArray(p.employees) ? p.employees[0] : p.employees;
    const room = Array.isArray(p.rooms) ? p.rooms[0] : p.rooms;
    return {
      id: p.id,
      employeeId: p.employee_id,
      employeeName: (emp as { name?: string } | null)?.name ?? "Unknown",
      weekday: p.weekday,
      startTime: p.start_time,
      endTime: p.end_time,
      note: p.note,
      active: p.active,
      roomId: p.room_id,
      roomName: (room as { name?: string } | null)?.name ?? null,
    };
  });

  return NextResponse.json({ patterns }, { headers: NO_STORE });
}

/** Add a new recurring weekly shift for an employee. */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session || !(session.isAdmin || session.role === "manager")) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const { employeeId, weekday, startTime, endTime, note, roomId } = await req.json();
  if (typeof employeeId !== "string" || !employeeId) {
    return NextResponse.json({ error: "Missing employeeId." }, { status: 400 });
  }
  const wd = Number(weekday);
  if (!Number.isInteger(wd) || wd < 0 || wd > 6) {
    return NextResponse.json({ error: "weekday must be 0 (Sun) to 6 (Sat)." }, { status: 400 });
  }
  if (typeof startTime !== "string" || typeof endTime !== "string" || !startTime || !endTime) {
    return NextResponse.json({ error: "Missing startTime/endTime." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("shift_patterns")
    .insert({
      employee_id: employeeId,
      weekday: wd,
      start_time: startTime,
      end_time: endTime,
      note: typeof note === "string" ? note.trim() || null : null,
      room_id: typeof roomId === "string" && roomId ? roomId : null,
      created_by: session.employeeId,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
