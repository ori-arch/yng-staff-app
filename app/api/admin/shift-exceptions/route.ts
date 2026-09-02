import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

/** One-off schedule changes (add/skip/modify) for a date range, manager/admin only. */
export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session || !(session.isAdmin || session.role === "manager")) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ error: "Missing start/end." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("shift_exceptions")
    .select("id, employee_id, date, action, start_time, end_time, note, active, employees(name)")
    .eq("active", true)
    .gte("date", start)
    .lte("date", end)
    .order("date");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const exceptions = (data ?? []).map((ex) => {
    const emp = Array.isArray(ex.employees) ? ex.employees[0] : ex.employees;
    return {
      id: ex.id,
      employeeId: ex.employee_id,
      employeeName: (emp as { name?: string } | null)?.name ?? "Unknown",
      date: ex.date,
      action: ex.action,
      startTime: ex.start_time,
      endTime: ex.end_time,
      note: ex.note,
    };
  });

  return NextResponse.json({ exceptions }, { headers: NO_STORE });
}

/** Add a one-off change for a specific employee/date: add an extra shift, skip a scheduled one, or modify its times. */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session || !(session.isAdmin || session.role === "manager")) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const { employeeId, date, action, startTime, endTime, note } = await req.json();
  if (typeof employeeId !== "string" || !employeeId) {
    return NextResponse.json({ error: "Missing employeeId." }, { status: 400 });
  }
  if (typeof date !== "string" || !date) {
    return NextResponse.json({ error: "Missing date." }, { status: 400 });
  }
  if (!["add", "skip", "modify"].includes(action)) {
    return NextResponse.json({ error: "action must be add, skip, or modify." }, { status: 400 });
  }
  if (action !== "skip" && (typeof startTime !== "string" || typeof endTime !== "string" || !startTime || !endTime)) {
    return NextResponse.json({ error: "startTime/endTime are required for add/modify." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("shift_exceptions")
    .insert({
      employee_id: employeeId,
      date,
      action,
      start_time: action === "skip" ? null : startTime,
      end_time: action === "skip" ? null : endTime,
      note: typeof note === "string" ? note.trim() || null : null,
      created_by: session.employeeId,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
