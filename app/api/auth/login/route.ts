import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyPin } from "@/lib/pin";
import { setSessionCookie } from "@/lib/session";

export async function POST(req: NextRequest) {
  const { employeeId, pin } = await req.json();

  if (!employeeId || !pin) {
    return NextResponse.json({ error: "Missing employeeId or pin." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: employee, error } = await supabase
    .from("employees")
    .select("id, name, role, is_admin, is_owner, pin_hash, active")
    .eq("id", employeeId)
    .single();

  if (error || !employee || !employee.active) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  if (!employee.pin_hash) {
    return NextResponse.json(
      { error: "No PIN has been set for this account yet. Ask an admin to set one." },
      { status: 403 }
    );
  }

  const ok = verifyPin(pin, employee.pin_hash);
  if (!ok) {
    return NextResponse.json({ error: "Incorrect PIN." }, { status: 401 });
  }

  setSessionCookie({
    employeeId: employee.id,
    name: employee.name,
    role: employee.role,
    isAdmin: employee.is_admin,
    isOwner: employee.is_owner,
    issuedAt: Date.now(),
  });

  return NextResponse.json({ ok: true });
}
