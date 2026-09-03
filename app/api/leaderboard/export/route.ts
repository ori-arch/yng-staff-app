import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getCategories } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function isManager(session: { role: string; isAdmin: boolean } | null): boolean {
  return !!session && (session.role === "manager" || session.isAdmin);
}

function csvCell(value: string | number | null): string {
  const s = value === null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function fmtEastern(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York" });
}

/**
 * Manager-only CSV export for reconciling against Zenoti (spec §6).
 * ?cycleId=... (required) and ?format=detail|summary (default detail).
 */
export async function GET(req: NextRequest) {
  const session = getSession();
  if (!isManager(session)) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const cycleId = searchParams.get("cycleId");
  const format = searchParams.get("format") === "summary" ? "summary" : "detail";
  if (!cycleId) return NextResponse.json({ error: "cycleId is required." }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data: cycle } = await supabase.from("leaderboard_cycles").select("name").eq("id", cycleId).maybeSingle();
  const categories = await getCategories(supabase, false);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const { data: entriesRaw, error } = await supabase
    .from("leaderboard_entries")
    .select(
      "employee_id, category_id, points_awarded, logged_at, active, note, edited_by, edited_at, " +
        "employee:employees!leaderboard_entries_employee_id_fkey(name), " +
        "editor:employees!leaderboard_entries_edited_by_fkey(name)"
    )
    .eq("cycle_id", cycleId)
    .order("logged_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const entries = (entriesRaw ?? []) as any[];

  let csv: string;
  const filenameBase = `leaderboard-${(cycle?.name ?? cycleId).toString().replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;

  if (format === "summary") {
    const summary = new Map<string, Map<string, { count: number; points: number }>>();
    for (const e of entries ?? []) {
      if (!e.active) continue;
      const empName = (e as any).employee?.name ?? "Unknown";
      const catLabel = categoryById.get(e.category_id)?.label ?? "Unknown";
      if (!summary.has(empName)) summary.set(empName, new Map());
      const byCategory = summary.get(empName)!;
      if (!byCategory.has(catLabel)) byCategory.set(catLabel, { count: 0, points: 0 });
      const cell = byCategory.get(catLabel)!;
      cell.count += 1;
      cell.points += e.points_awarded;
    }
    const rows = ["employee_name,category,count,points_total"];
    for (const [empName, byCategory] of summary) {
      for (const [catLabel, cell] of byCategory) {
        rows.push([csvCell(empName), csvCell(catLabel), csvCell(cell.count), csvCell(cell.points)].join(","));
      }
    }
    csv = rows.join("\n");
  } else {
    const rows = ["employee_name,category,points_awarded,logged_at,cycle_name,status,edited_by,edited_at,note"];
    for (const e of entries ?? []) {
      rows.push(
        [
          csvCell((e as any).employee?.name ?? "Unknown"),
          csvCell(categoryById.get(e.category_id)?.label ?? "Unknown"),
          csvCell(e.points_awarded),
          csvCell(fmtEastern(e.logged_at)),
          csvCell(cycle?.name ?? ""),
          csvCell(e.active ? "active" : "voided"),
          csvCell((e as any).editor?.name ?? ""),
          csvCell(e.edited_at ? fmtEastern(e.edited_at) : ""),
          csvCell(e.note ?? ""),
        ].join(",")
      );
    }
    csv = rows.join("\n");
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filenameBase}-${format}.csv"`,
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}
