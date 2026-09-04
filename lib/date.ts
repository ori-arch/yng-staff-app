/**
 * "Today" (and related day math) as YYYY-MM-DD in the business's own local
 * day -- Eastern time, since that's where YNG operates -- not raw UTC.
 *
 * `new Date().toISOString().slice(0, 10)` looks like it gives "today", but
 * `toISOString()` is always UTC. Eastern is UTC-4/UTC-5, so any time after
 * 8pm (EDT) or 7pm (EST) local, the UTC calendar date has already rolled
 * over to tomorrow -- every "today" computed that way silently jumps a day
 * early in the evening. That's what made a real missed checklist vanish
 * from the compliance dashboard: the server's idea of "today" could be a
 * day ahead of Ori's actual today, throwing date-range math off by one.
 *
 * Use todayET()/addDaysET() anywhere "what calendar day is it" matters for
 * business logic (compliance, checklists, warnings, cron jobs). Pure UTC
 * date arithmetic on an already-known YYYY-MM-DD string (e.g. stepping
 * through a fixed range) is unaffected and doesn't need this.
 */
export function todayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function addDaysET(dateStr: string, delta: number): string {
  // Anchored at noon UTC (always mid-morning/midday in Eastern, either
  // DST offset) so adding whole days never crosses into the wrong ET
  // calendar date.
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
