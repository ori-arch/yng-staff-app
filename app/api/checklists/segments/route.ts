import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/** For the logged-in employee's role: which segments (open/close) exist, and are they done today? */
export async function GET() {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  if (session.role !== "front_desk" && session.role !== "aesthetician") {
    return NextResponse.json({ supported: false, segments: [] });
  }

  const supabase = supabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: templates }, { data: submissions }] = await Promise.all([
    supabase
      .from("checklist_templates")
      .select("segment")
      .eq("role", session.role)
      .eq("active", true),
    supabase
      .from("checklist_submissions")
      .select("segment, completed_at")
      .eq("employee_id", session.employeeId)
      .eq("role", session.role)
      .eq("submission_date", today),
  ]);

  const segmentsWithTemplates = Array.from(new Set((templates ?? []).map((t) => t.segment)));
  const segments = segmentsWithTemplates.map((segment) => {
    const sub = (submissions ?? []).find((s) => s.segment === segment && s.completed_at);
    return { segment, completedToday: Boolean(sub) };
  });

  return NextResponse.json(
    { supported: true, segments },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
  );
}
