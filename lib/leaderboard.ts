import { SupabaseClient } from "@supabase/supabase-js";
import { todayET } from "@/lib/date";

export type LeaderboardCycle = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  prizeDescription: string | null;
  status: "open" | "pending_confirmation" | "closed";
  winnerEmployeeId: string | null;
  winnerOverrideReason: string | null;
  confirmedAt: string | null;
  announcedAt: string | null;
};

export type LeaderboardCategory = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  points: number;
  displayOrder: number;
  active: boolean;
};

export type StandingRow = {
  employeeId: string;
  employeeName: string;
  points: number;
  byCategory: Record<string, { count: number; points: number }>;
  packageCount: number; // used as the tie-break signal below
  lastLoggedAt: string | null;
};

function shapeCycle(c: any): LeaderboardCycle {
  return {
    id: c.id,
    name: c.name,
    startDate: c.start_date,
    endDate: c.end_date,
    prizeDescription: c.prize_description,
    status: c.status,
    winnerEmployeeId: c.winner_employee_id,
    winnerOverrideReason: c.winner_override_reason,
    confirmedAt: c.confirmed_at,
    announcedAt: c.announced_at,
  };
}

/** The single open (or pending-confirmation) cycle, if any -- there's never more than one. */
export async function getActiveCycle(supabase: SupabaseClient): Promise<LeaderboardCycle | null> {
  const { data } = await supabase
    .from("leaderboard_cycles")
    .select("*")
    .in("status", ["open", "pending_confirmation"])
    .maybeSingle();
  return data ? shapeCycle(data) : null;
}

export async function getCategories(supabase: SupabaseClient, activeOnly = true): Promise<LeaderboardCategory[]> {
  let query = supabase.from("leaderboard_categories").select("*").order("display_order");
  if (activeOnly) query = query.eq("active", true);
  const { data } = await query;
  return (data ?? []).map((c: any) => ({
    id: c.id,
    key: c.key,
    label: c.label,
    description: c.description ?? null,
    points: c.points,
    displayOrder: c.display_order,
    active: c.active,
  }));
}

/**
 * Standings for a cycle: every active employee (front_desk + aesthetician --
 * the selling roles) with their point total, a per-category breakdown, and
 * enough to break ties. Never a stored number -- always summed live from
 * entries + adjustments so it can't drift.
 *
 * Tie-break (only used for display ordering / the confirm screen's
 * suggested winner -- a manager can always override): most points, then
 * most "package" category entries, then whoever logged their most recent
 * entry earliest (rewards consistency over a late sprint).
 */
export async function computeStandings(supabase: SupabaseClient, cycleId: string): Promise<StandingRow[]> {
  const [{ data: employees }, categories, { data: entries }, { data: adjustments }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, name")
      .eq("active", true)
      .in("role", ["front_desk", "aesthetician"])
      .order("name"),
    getCategories(supabase, false),
    supabase
      .from("leaderboard_entries")
      .select("employee_id, category_id, points_awarded, logged_at")
      .eq("cycle_id", cycleId)
      .eq("active", true),
    supabase.from("leaderboard_adjustments").select("employee_id, points").eq("cycle_id", cycleId),
  ]);

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const packageCategoryId = categories.find((c) => c.key === "package")?.id;

  const rows = new Map<string, StandingRow>();
  for (const e of employees ?? []) {
    rows.set(e.id, {
      employeeId: e.id,
      employeeName: e.name,
      points: 0,
      byCategory: {},
      packageCount: 0,
      lastLoggedAt: null,
    });
  }

  for (const entry of entries ?? []) {
    const row = rows.get(entry.employee_id);
    if (!row) continue; // entry belongs to someone no longer active/eligible
    row.points += entry.points_awarded;
    const cat = categoryById.get(entry.category_id);
    const key = cat?.key ?? "unknown";
    if (!row.byCategory[key]) row.byCategory[key] = { count: 0, points: 0 };
    row.byCategory[key].count += 1;
    row.byCategory[key].points += entry.points_awarded;
    if (entry.category_id === packageCategoryId) row.packageCount += 1;
    if (!row.lastLoggedAt || entry.logged_at < row.lastLoggedAt) row.lastLoggedAt = entry.logged_at;
  }

  for (const adj of adjustments ?? []) {
    const row = rows.get(adj.employee_id);
    if (row) row.points += adj.points;
  }

  return Array.from(rows.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.packageCount !== a.packageCount) return b.packageCount - a.packageCount;
    if (a.lastLoggedAt && b.lastLoggedAt) return a.lastLoggedAt < b.lastLoggedAt ? -1 : 1;
    return a.employeeName.localeCompare(b.employeeName);
  });
}

export function daysRemaining(endDate: string): number {
  const today = todayET();
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = (new Date(`${endDate}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / msPerDay;
  return Math.ceil(diff);
}
