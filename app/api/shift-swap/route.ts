import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

const SELECT =
  "id, requesting_employee_id, target_employee_id, shift_description, status, coworker_responded_at, owner_decided_at, decided_by, created_at, " +
  "requester:employees!shift_swap_requests_requesting_employee_id_fkey(name), target:employees!shift_swap_requests_target_employee_id_fkey(name)";

const SHIFTS_SELECT =
  "id, swap_request_id, shift_date, start_time, end_time, room_id, accepted, owner_approved, reoffered_swap_request_id, rooms(name)";

function shape(r: any, shiftsByRequest: Record<string, any[]>) {
  const requester = Array.isArray(r.requester) ? r.requester[0] : r.requester;
  const target = Array.isArray(r.target) ? r.target[0] : r.target;
  const shifts = (shiftsByRequest[r.id] ?? []).map((s) => {
    const room = Array.isArray(s.rooms) ? s.rooms[0] : s.rooms;
    return {
      id: s.id,
      shiftDate: s.shift_date,
      startTime: s.start_time,
      endTime: s.end_time,
      roomId: s.room_id,
      roomName: room?.name ?? null,
      accepted: s.accepted,
      ownerApproved: s.owner_approved,
      reofferedSwapRequestId: s.reoffered_swap_request_id,
    };
  });
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
    shifts,
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

  const { data: rawData, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const data = (rawData ?? []) as any[];

  const ids = data.map((r) => r.id);
  const shiftsByRequest: Record<string, any[]> = {};
  if (ids.length) {
    const { data: shiftRows, error: shiftsError } = await supabase
      .from("shift_swap_request_shifts")
      .select(SHIFTS_SELECT)
      .in("swap_request_id", ids)
      .order("shift_date");
    if (shiftsError) return NextResponse.json({ error: shiftsError.message }, { status: 500 });
    for (const s of shiftRows ?? []) {
      (shiftsByRequest[s.swap_request_id] ??= []).push(s);
    }
  }

  return NextResponse.json({ swaps: (data ?? []).map((r) => shape(r, shiftsByRequest)) }, { headers: NO_STORE });
}

/**
 * Any non-manager employee requests to swap one or more of her own shifts
 * with a named coworker. `reofferShiftId` optionally links this new request
 * back to a shift another coworker didn't accept, so the original card can
 * show it was re-offered instead of just going nowhere.
 */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const { targetEmployeeId, shiftDescription, shifts, reofferShiftId } = await req.json();
  if (typeof targetEmployeeId !== "string" || !targetEmployeeId) {
    return NextResponse.json({ error: "Missing targetEmployeeId." }, { status: 400 });
  }
  if (targetEmployeeId === session.employeeId) {
    return NextResponse.json({ error: "Pick a coworker other than yourself." }, { status: 400 });
  }
  if (!Array.isArray(shifts) || shifts.length === 0) {
    return NextResponse.json({ error: "Pick at least one shift you want to swap." }, { status: 400 });
  }
  for (const s of shifts) {
    if (!s || typeof s.date !== "string" || typeof s.startTime !== "string" || typeof s.endTime !== "string") {
      return NextResponse.json({ error: "Each shift needs a date, startTime and endTime." }, { status: 400 });
    }
  }
  const note = typeof shiftDescription === "string" ? shiftDescription.trim() : "";

  const supabase = supabaseAdmin();
  const { data: request, error } = await supabase
    .from("shift_swap_requests")
    .insert({
      requesting_employee_id: session.employeeId,
      target_employee_id: targetEmployeeId,
      shift_description: note || null,
      status: "pending_coworker",
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { error: shiftsError } = await supabase.from("shift_swap_request_shifts").insert(
    shifts.map((s: any) => ({
      swap_request_id: request.id,
      shift_date: s.date,
      start_time: s.startTime,
      end_time: s.endTime,
      room_id: typeof s.roomId === "string" && s.roomId ? s.roomId : null,
    }))
  );
  if (shiftsError) return NextResponse.json({ error: shiftsError.message }, { status: 500 });

  // Link back to the shift this re-offers, if any, so the original request
  // can show "re-offered to <coworker>" instead of a dead end. Only the
  // original requester can do this, and only for her own shift.
  if (typeof reofferShiftId === "string" && reofferShiftId) {
    const { data: original } = await supabase
      .from("shift_swap_request_shifts")
      .select("id, swap_request_id, shift_swap_requests!inner(requesting_employee_id)")
      .eq("id", reofferShiftId)
      .maybeSingle();
    const originalOwnerId = (original as any)?.shift_swap_requests?.requesting_employee_id;
    if (original && originalOwnerId === session.employeeId) {
      await supabase.from("shift_swap_request_shifts").update({ reoffered_swap_request_id: request.id }).eq("id", reofferShiftId);
    }
  }

  return NextResponse.json({ ok: true, id: request.id });
}
