import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

/** Lists recent equipment logs — managers/admins see everyone's, staff see their own. */
export async function GET() {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const isManager = session.role === "manager" || session.isAdmin;

  let query = supabase
    .from("equipment_logs")
    .select("id, equipment_type, client_name, used_at, received_operational, cleaned_properly, photo_url, remarks, employees(name)")
    .order("used_at", { ascending: false })
    .limit(50);

  if (!isManager) {
    query = query.eq("employee_id", session.employeeId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const logs = (data ?? []).map((l) => {
    const emp = Array.isArray(l.employees) ? l.employees[0] : l.employees;
    return {
      id: l.id,
      equipmentType: l.equipment_type,
      clientName: l.client_name,
      usedAt: l.used_at,
      receivedOperational: l.received_operational,
      cleanedProperly: l.cleaned_properly,
      photoUrl: l.photo_url,
      remarks: l.remarks,
      employeeName: emp?.name ?? null,
    };
  });

  return NextResponse.json({ logs }, { headers: NO_STORE });
}

/** Creates one equipment-use log entry, with a required photo of the cleaned handpiece. */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const form = await req.formData();
  const equipmentType = form.get("equipmentType");
  const clientName = form.get("clientName");
  const receivedOperational = form.get("receivedOperational");
  const cleanedProperly = form.get("cleanedProperly");
  const remarks = form.get("remarks");
  const photo = form.get("photo");

  if (typeof equipmentType !== "string" || !equipmentType.trim()) {
    return NextResponse.json({ error: "Equipment type is required." }, { status: 400 });
  }
  if (receivedOperational !== "true" && receivedOperational !== "false") {
    return NextResponse.json({ error: "Please confirm whether the device was received in operational condition." }, { status: 400 });
  }
  if (cleanedProperly !== "true" && cleanedProperly !== "false") {
    return NextResponse.json({ error: "Please confirm whether the tip/handpiece was cleaned and dried." }, { status: 400 });
  }
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ error: "A photo of the cleaned handpiece is required." }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const buffer = Buffer.from(await photo.arrayBuffer());
  const ext = photo.type === "image/png" ? "png" : "jpg";
  const path = `${session.employeeId}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("equipment-photos")
    .upload(path, buffer, { contentType: photo.type || "image/jpeg", upsert: true });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }
  const { data: publicUrl } = supabase.storage.from("equipment-photos").getPublicUrl(path);

  const { error: insertError } = await supabase.from("equipment_logs").insert({
    employee_id: session.employeeId,
    equipment_type: equipmentType.trim(),
    client_name: typeof clientName === "string" && clientName.trim() ? clientName.trim() : null,
    received_operational: receivedOperational === "true",
    cleaned_properly: cleanedProperly === "true",
    photo_url: publicUrl.publicUrl,
    remarks: typeof remarks === "string" && remarks.trim() ? remarks.trim() : null,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
