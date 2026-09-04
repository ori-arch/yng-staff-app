import { supabaseAdmin } from "@/lib/supabase/server";
import { todayET } from "@/lib/date";

export type SegmentStatus = { segment: string; completedToday: boolean; startedToday: boolean };

/** Which open/close segments apply to this employee's role, and their state for today. */
export async function getSegmentStatus(employeeId: string, role: string): Promise<SegmentStatus[]> {
  if (role !== "front_desk" && role !== "aesthetician") return [];
  const supabase = supabaseAdmin();
  const today = todayET();

  const [{ data: templates }, { data: submissions }] = await Promise.all([
    supabase.from("checklist_templates").select("segment").eq("role", role).eq("active", true),
    supabase
      .from("checklist_submissions")
      .select("segment, completed_at")
      .eq("employee_id", employeeId)
      .eq("role", role)
      .eq("submission_date", today),
  ]);

  const order = ["open", "close"];
  const segments = Array.from(new Set((templates ?? []).map((t) => t.segment))).sort(
    (a, b) => order.indexOf(a) - order.indexOf(b)
  );

  return segments.map((segment) => {
    const subs = (submissions ?? []).filter((s) => s.segment === segment);
    return {
      segment,
      completedToday: subs.some((s) => s.completed_at),
      startedToday: subs.length > 0,
    };
  });
}
