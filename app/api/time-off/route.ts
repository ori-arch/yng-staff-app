import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { computeBalance } from "@/lib/time-off";
import { getManagerRecipientIds, notifyEmployees } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

/**
 * Employees see their own balance + request history.
 * Managers/admins additionally see every pending/decided request and a
 * per-active-employee balance roster (there's no admin panel yet, so this
 * is also where a manager adjusts anyone's balance — see
 * /api/time-off/balance-adjustments).
 */
export async function GET() {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const isManager = session.role === "manager" || session.isAdmin;
  const supabase = supabaseAdmin();

  const myBalance = await computeBalance(supabase, session.employeeId);

  const { data: myRequests, error: myReqError } = await supabase
    .from("time_off_requests")
    .select("id, start_date, end_date, hours_requested, reason, status, decided_at, created_at")
    .eq("employee_id", session.employeeId)
    .order("created_at", { ascending: false });
  if (myReqError) return NextResponse.json({ error: myReqError.message }, { status: 500 });

  const myRequestsOut = (myRequests ?? []).map((r) => ({
    id: r.id,
    startDate: r.start_date,
    endDate: r.end_date,
    hoursRequested: r.hours_requested,
    reason: r.reason,
    status: r.status,
    decidedAt: r.decided_at,
    createdAt: r.created_at,
  }));

  if (!isManager) {
    return NextResponse.json({ balance: myBalance, requests: myRequestsOut }, { headers: NO_STORE });
  }

  const { data: allRequests, error: allReqError } = await supabase
    .from("time_off_requests")
    .select("id, employee_id, start_date, end_date, hours_requested, reason, status, decided_at, created_at, employees!time_off_requests_employee_id_fkey(name)")
    .order("created_at", { ascending: false });
  if (allReqError) return NextResponse.json({ error: allReqError.message }, { status: 500 });

  const { data: roster, error: rosterError } = await supabase
    .from("employees")
    .select("id, name, role")
    .eq("active", true)
    .order("name");
  if (rosterError) return NextResponse.json({ error: rosterError.message }, { status: 500 });

  const balances = await Promise.all(
    (roster ?? []).map(async (e) => ({
      employeeId: e.id,
      name: e.name,
      role: e.role,
      balance: await computeBalance(supabase, e.id),
    }))
  );

  const allRequestsOut = (allRequests ?? []).map((r) => {
    const emp = Array.isArray(r.employees) ? r.employees[0] : r.employees;
    return {
      id: r.id,
      employeeId: r.employee_id,
      employeeName: emp?.name ?? "Unknown",
      startDate: r.start_date,
      endDate: r.end_date,
      hoursRequested: r.hours_requested,
      reason: r.reason,
      status: r.status,
      decidedAt: r.decided_at,
      createdAt: r.created_at,
    };
  });

  return NextResponse.json(
    { balance: myBalance, requests: myRequestsOut, allRequests: allRequestsOut, balances },
    { headers: NO_STORE }
  );
}

/** Any employee submits her own time-off request. */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const { startDate, endDate, hoursRequested, reason } = await req.json();
  if (typeof startDate !== "string" || !startDate) {
    return NextResponse.json({ error: "Missing startDate." }, { status: 400 });
  }
  if (typeof endDate !== "string" || !endDate) {
    return NextResponse.json({ error: "Missing endDate." }, { status: 400 });
  }
  if (endDate < startDate) {
    return NextResponse.json({ error: "End date can't be before start date." }, { status: 400 });
  }
  const hours = Number(hoursRequested);
  if (!Number.isFinite(hours) || hours <= 0) {
    return NextResponse.json({ error: "Missing or invalid hoursRequested." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("time_off_requests")
    .insert({
      employee_id: session.employeeId,
      start_date: startDate,
      end_date: endDate,
      hours_requested: hours,
      reason: typeof reason === "string" ? reason.trim() || null : null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const managerIds = await getManagerRecipientIds(supabase);
  await notifyEmployees(supabase, managerIds, {
    type: "approval_needed",
    title: "New time off request",
    body: `${session.name} requested ${hours}h off, ${startDate} to ${endDate}.`,
    link: "/time-off",
  });

  return NextResponse.json({ ok: true, id: data.id });
}
