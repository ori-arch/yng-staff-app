import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getOutstandingMissedChecklists } from "@/lib/compliance";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };
const LOOKBACK_DAYS = 30;

/**
 * Manager-only: every missed checklist segment from the last LOOKBACK_DAYS
 * days that still has no warning issued for it -- independent of whatever
 * single day the Compliance page happens to be showing, so a miss from a
 * week ago doesn't quietly disappear just because "today" looks clear.
 */
export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  const isManager = session.role === "manager" || session.isAdmin;
  if (!isManager) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const supabase = supabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const untilDate = yesterday.toISOString().slice(0, 10);
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - LOOKBACK_DAYS);
  const sinceDate = since.toISOString().slice(0, 10);

  try {
    const items = await getOutstandingMissedChecklists(supabase, sinceDate, untilDate);
    return NextResponse.json({ items, today }, { headers: NO_STORE });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not load missed checklists." }, { status: 500 });
  }
}
