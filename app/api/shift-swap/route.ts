import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

const SELECT =
  "id, requesting_employee_id, target_employee_id, shift_description, status, coworker_responded_at, owner_decided_at, decided_by, created_at, " +
  "shift_date, start_time, end_time, room_id, " +
  "requester:employees!shift_swap_requests_requesting_employee_id_fkey(name), target:employees!shift_swap_requests_target_employee_id_fkey(name), " +
  "rooms(name)";

function shape(r: any) {
  const requester = Array.isArray(r.requester) ? r.requester[0] : r.requester;
  const target = Array.isArray(r.target) ? r.target[0] : r.target;
  const room = Array.isArray(r.rooms) ? r.rooms[0] : r.rooms;
  return {
    id: r.id,
    requestingEmployeeId: r.requesting_employee_id,
    requestingEmployeeName: requester?.name ?? "Unknown",
    targetEmployeeId: r.target_employee_id,
    targetEmployeeName: target?.name ?? "Unknown",
    shiftDescription: r.shift_description,
    status: r.status,
    coworkerRespondedAt: r.coworker_responded_at,
    ownerDecidedAt: r.owner_decided_at,
    createdAt: r.created_at,
    shiftDate: r.shift_date,
    startTime: r.start_time,
    endTime: r.end_time,
    roomId: r.room_id,
    roomName: room?.name ?? null,
  };
}

/** Managers/admins see every swap request; everyone else sees swaps they're part of. */
export async function GET() {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const isManager = session.role === "manager" || session.isAdmin;
  const supabase = supabaseAdmin();

  let query = supabase.from("shift_swap_requests").select(SELECT).order("created_at", { ascending: false });
  if (!isManager) {
    query = query.or(`requesting_employee_id.eq.${session.employeeId},target_employee_id.eq.${session.employeeId}`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ swaps: (data ?? []).map(shape) }, { headers: NO_STORE });
}

/** Any non-manager employee requests to swap a shift with a named coworker. */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const { targetEmployeeId, shiftDescription, shiftDate, startTime, endTime, roomId } = await req.json();
  if (typeof targetEmployeeId !== "string" || !targetEmployeeId) {
    return NextResponse.json({ error: "Missing targetEmployeeId." }, { status: 400 });
  }
  if (targetEmployeeId === session.employeeId) {
    return NextResponse.json({ error: "Pick a coworker other than yourself." }, { status: 400 });
  }
  if (typeof shiftDate !== "string" || !shiftDate) {
    return NextResponse.json({ error: "Pick which shift you want to swap." }, { status: 400 });
  }
  if (typeof startTime !== "string" || typeof endTime !== "string" || !startTime || !endTime) {
    return NextResponse.json({ error: "Missing startTime/endTime for the selected shift." }, { status: 400 });
  }
  const note = typeof shiftDescription === "string" ? shiftDescription.trim() : "";

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("shift_swap_requests")
    .insert({
      requesting_employee_id: session.employeeId,
      target_employee_id: targetEmployeeId,
      shift_description: note || null,
      shift_date: shiftDate,
      start_time: startTime,
      end_time: endTime,
      room_id: typeof roomId === "string" && roomId ? roomId : null,
      status: "pending_coworker",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
