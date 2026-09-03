import { SupabaseClient } from "@supabase/supabase-js";

/** Shared helpers for the compliance dashboard and warning notices. */

export function quarterLabel(date: Date): string {
  const q = Math.floor(date.getUTCMonth() / 3) + 1;
  return `Q${q} ${date.getUTCFullYear()}`;
}

export const MISSED_CHECKLIST_DESCRIPTION =
  "Failure to Complete or Report Daily Responsibilities — Shift Tasks";

export type Track = "green" | "yellow" | "red";
export type ResetPeriod = "quarterly" | "annually" | "never";

/** The reset-window bucket a violation on this track falls into, given the date it happened. */
export function windowLabelFor(track: Track, date: Date): string {
  if (track === "red") return "ALL-TIME";
  if (track === "yellow") return String(date.getUTCFullYear());
  return quarterLabel(date);
}

export const TRACK_META: Record<Track, { label: string; emoji: string; color: string; soft: string }> = {
  green: { label: "Green", emoji: "🟢", color: "#3a7d44", soft: "#e7f4e8" },
  yellow: { label: "Yellow", emoji: "🟡", color: "#a6790a", soft: "#fbf1dc" },
  red: { label: "Red", emoji: "🔴", color: "#b3261e", soft: "#fbe9e8" },
};

export type ConductStatus = {
  level: "good" | "watch" | "critical";
  emoji: string;
  message: string;
  counts: Record<Track, { count: number; limit: number }>;
};

/**
 * A one-line, above-the-fold read on where an employee stands: how many
 * active (non-voided) warnings she has in the current window for each
 * track, and the single most urgent thing to say about it. Never blocks
 * anything -- surfacing only, per Ori's call: termination stays a human
 * decision, not something the software enforces.
 */
export async function computeConductStatus(supabase: SupabaseClient, employeeId: string): Promise<ConductStatus> {
  const now = new Date();
  const windows: Record<Track, string> = {
    green: windowLabelFor("green", now),
    yellow: windowLabelFor("yellow", now),
    red: windowLabelFor("red", now),
  };

  const { data: types } = await supabase.from("violation_types").select("track, strike_limit");
  const limitByTrack: Record<Track, number> = { green: 3, yellow: 3, red: 1 };
  for (const t of types ?? []) {
    // Use the highest configured strike_limit per track (tracks share one counter across types).
    const track = t.track as Track;
    limitByTrack[track] = Math.max(limitByTrack[track] ?? 0, t.strike_limit);
  }

  const { data: warnings } = await supabase
    .from("warning_notices")
    .select("track, window_label")
    .eq("employee_id", employeeId)
    .eq("active", true)
    .not("track", "is", null);

  const counts: Record<Track, { count: number; limit: number }> = {
    green: { count: 0, limit: limitByTrack.green },
    yellow: { count: 0, limit: limitByTrack.yellow },
    red: { count: 0, limit: limitByTrack.red },
  };
  for (const w of warnings ?? []) {
    const track = w.track as Track | null;
    if (!track) continue;
    if (w.window_label !== windows[track]) continue; // outside the current reset window
    counts[track].count += 1;
  }

  if (counts.red.count > 0) {
    return { level: "critical", emoji: "🔴", message: "Active Red-track violation on file", counts };
  }
  if (counts.yellow.count >= counts.yellow.limit || counts.green.count >= counts.green.limit) {
    return { level: "critical", emoji: "⚠️", message: "At the strike limit on a track this period", counts };
  }
  if (counts.yellow.count > 0 || counts.green.count > 0) {
    const total = counts.yellow.count + counts.green.count;
    return { level: "watch", emoji: "🟡", message: `${total} active warning${total === 1 ? "" : "s"} this period`, counts };
  }
  return { level: "good", emoji: "✅", message: "Good standing — no active warnings", counts };
}
