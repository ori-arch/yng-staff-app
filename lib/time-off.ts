import { SupabaseClient } from "@supabase/supabase-js";

/**
 * An employee's time-off balance is the running sum of her
 * `time_off_balance_adjustments` rows (in hours). Manual grants/corrections
 * from a manager are positive adjustments; an approved time-off request
 * writes its own negative adjustment at approval time (see
 * app/api/time-off/[id]/route.ts) — the ledger is the single source of
 * truth, there's no separate "balance" column to keep in sync.
 */
export async function computeBalance(supabase: SupabaseClient, employeeId: string): Promise<number> {
  const { data, error } = await supabase
    .from("time_off_balance_adjustments")
    .select("adjustment_hours")
    .eq("employee_id", employeeId);
  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + Number(row.adjustment_hours), 0);
}
