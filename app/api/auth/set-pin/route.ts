import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { hashPin, verifyPin } from "@/lib/pin";
import { getSession } from "@/lib/session";

/**
 * Sets or changes an employee's PIN. Three allowed cases:
 *  1. Bootstrap: the employee has no PIN yet (pin_hash is null) — anyone can set it once.
 *     This is how Ori sets her own PIN on first run, and how newly-added employees get one.
 *  2. Self-service change: logged in as that employee, must supply the correct currentPin.
 *  3. Admin/manager reset: logged in as an admin or manager, can set any employee's
 *     PIN without currentPin (this is the Admin Panel's "Reset PIN" action).
 */
export async function POST(req: NextRequest) {
  const { employeeId, newPin, currentPin } = await req.json();

  if (!employeeId || !newPin || String(newPin).length < 4) {
    return NextResponse.json(
      { error: "Missing employeeId or newPin (min 4 digits)." },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();
  const { data: employee, error } = await supabase
    .from("employees")
    .select("id, pin_hash")
    .eq("id", employeeId)
    .single();

  if (error || !employee) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  const session = getSession();

  if (!employee.pin_hash) {
    // Case 1: bootstrap, no auth required.
  } else if (session?.employeeId === employeeId) {
    // Case 2: self-service change.
    if (!verifyPin(currentPin, employee.pin_hash)) {
      return NextResponse.json({ error: "Current PIN is incorrect." }, { status: 401 });
    }
  } else if (session?.isAdmin || session?.role === "manager") {
    // Case 3: admin/manager reset (Admin Panel "Reset PIN" action).
  } else {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { error: updateError } = await supabase
    .from("employees")
    .update({ pin_hash: hashPin(String(newPin)) })
    .eq("id", employeeId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
