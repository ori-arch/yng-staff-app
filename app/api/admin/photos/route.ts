import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

type Photo = {
  id: string;
  url: string;
  category: "checklist" | "equipment" | "room_restocking";
  categoryLabel: string;
  context: string;
  employeeName: string | null;
  takenAt: string;
};

/**
 * Manager/admin-only feed of every photo staff have taken across the app —
 * checklist photo steps, equipment log handpiece photos, and both Room
 * Restocking Log photos — newest first, so a manager can review compliance
 * without hunting through each individual log screen.
 */
export async function GET() {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const isManager = session.role === "manager" || session.isAdmin;
  if (!isManager) {
    return NextResponse.json({ error: "Managers and admins only." }, { status: 403 });
  }

  const supabase = supabaseAdmin();

  const [checklistRes, equipmentRes, roomRes] = await Promise.all([
    supabase
      .from("checklist_submission_items")
      .select(
        "id, photo_url, completed_at, checklist_templates(item_text), checklist_submissions!inner(segment, submission_date, employees(name))"
      )
      .not("photo_url", "is", null)
      .order("completed_at", { ascending: false })
      .limit(40),
    supabase
      .from("equipment_logs")
      .select("id, equipment_type, used_at, photo_url, employees(name)")
      .not("photo_url", "is", null)
      .order("used_at", { ascending: false })
      .limit(40),
    supabase
      .from("room_restocking_logs")
      .select("id, specific_item, created_at, empty_bottle_photo_url, new_item_photo_url, employees(name)")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  if (checklistRes.error) return NextResponse.json({ error: checklistRes.error.message }, { status: 500 });
  if (equipmentRes.error) return NextResponse.json({ error: equipmentRes.error.message }, { status: 500 });
  if (roomRes.error) return NextResponse.json({ error: roomRes.error.message }, { status: 500 });

  const photos: Photo[] = [];

  for (const row of checklistRes.data ?? []) {
    const submission = Array.isArray(row.checklist_submissions) ? row.checklist_submissions[0] : row.checklist_submissions;
    const template = Array.isArray(row.checklist_templates) ? row.checklist_templates[0] : row.checklist_templates;
    const emp = submission ? (Array.isArray(submission.employees) ? submission.employees[0] : submission.employees) : null;
    if (!row.photo_url) continue;
    photos.push({
      id: `checklist:${row.id}`,
      url: row.photo_url,
      category: "checklist",
      categoryLabel: "Checklist",
      context: template?.item_text ?? `${submission?.segment ?? ""} checklist`,
      employeeName: emp?.name ?? null,
      takenAt: row.completed_at ?? submission?.submission_date ?? "",
    });
  }

  for (const row of equipmentRes.data ?? []) {
    const emp = Array.isArray(row.employees) ? row.employees[0] : row.employees;
    if (!row.photo_url) continue;
    photos.push({
      id: `equipment:${row.id}`,
      url: row.photo_url,
      category: "equipment",
      categoryLabel: "Equipment",
      context: row.equipment_type,
      employeeName: emp?.name ?? null,
      takenAt: row.used_at,
    });
  }

  for (const row of roomRes.data ?? []) {
    const emp = Array.isArray(row.employees) ? row.employees[0] : row.employees;
    if (row.empty_bottle_photo_url) {
      photos.push({
        id: `room:${row.id}:empty`,
        url: row.empty_bottle_photo_url,
        category: "room_restocking",
        categoryLabel: "Room Restocking",
        context: `${row.specific_item} — empty bottle`,
        employeeName: emp?.name ?? null,
        takenAt: row.created_at,
      });
    }
    if (row.new_item_photo_url) {
      photos.push({
        id: `room:${row.id}:new`,
        url: row.new_item_photo_url,
        category: "room_restocking",
        categoryLabel: "Room Restocking",
        context: `${row.specific_item} — replacement`,
        employeeName: emp?.name ?? null,
        takenAt: row.created_at,
      });
    }
  }

  photos.sort((a, b) => (b.takenAt || "").localeCompare(a.takenAt || ""));

  return NextResponse.json({ photos: photos.slice(0, 90) }, { headers: NO_STORE });
}
