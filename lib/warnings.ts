/** Shared helpers for the compliance dashboard and warning notices. */

export function quarterLabel(date: Date): string {
  const q = Math.floor(date.getUTCMonth() / 3) + 1;
  return `Q${q} ${date.getUTCFullYear()}`;
}

export const MISSED_CHECKLIST_DESCRIPTION =
  "Failure to Complete or Report Daily Responsibilities — Shift Tasks";
