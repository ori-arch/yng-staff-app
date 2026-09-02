import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Registers (or re-registers) this device's push subscription for the logged-in employee. */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const { endpoint, keys } = await req.json();
  if (typeof endpoint !== "string" || !endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Malformed subscription." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  // A device re-subscribing (browser data cleared, etc.) reuses the same
  // endpoint URL, so upsert on it rather than growing duplicate rows.
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      employee_id: session.employeeId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    { onConflict: "endpoint" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/** Removes a device's push subscription (e.g. on logout or when notifications are turned off). */
export async function DELETE(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const { endpoint } = await req.json();
  if (typeof endpoint !== "string" || !endpoint) {
    return NextResponse.json({ error: "Missing endpoint." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("employee_id", session.employeeId);

  return NextResponse.json({ ok: true });
}
