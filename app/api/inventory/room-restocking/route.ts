import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyPin } from "@/lib/pin";
import { postBroadcastAlert } from "@/lib/alerts";
import { getManagerRecipientIds, notifyEmployees } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

/** Lists recent Room Restocking Log entries. */
export async function GET() {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("room_restocking_logs")
    .select(
      "id, item_type, specific_item, remaining_quantity, empty_bottle_photo_url, new_item_photo_url, no_replacement, created_at, employees(name), room_ran_out:room_ran_out_id(name), room_restocked:room_restocked_id(name)"
    )
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const logs = (data ?? []).map((l) => {
    const emp = Array.isArray(l.employees) ? l.employees[0] : l.employees;
    const ranOut = Array.isArray(l.room_ran_out) ? l.room_ran_out[0] : l.room_ran_out;
    const restocked = Array.isArray(l.room_restocked) ? l.room_restocked[0] : l.room_restocked;
    return {
      id: l.id,
      itemType: l.item_type,
      specificItem: l.specific_item,
      remainingQuantity: l.remaining_quantity,
      emptyBottlePhotoUrl: l.empty_bottle_photo_url,
      newItemPhotoUrl: l.new_item_photo_url,
      noReplacement: l.no_replacement ?? false,
      createdAt: l.created_at,
      employeeName: emp?.name ?? null,
      roomRanOut: ranOut?.name ?? null,
      roomRestocked: restocked?.name ?? null,
    };
  });

  return NextResponse.json({ logs }, { headers: NO_STORE });
}

/** Records one Room Restocking Log entry, signed with a PIN re-entry. */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const form = await req.formData();
  const itemType = form.get("itemType");
  const specificItem = form.get("specificItem");
  const roomRanOutId = form.get("roomRanOutId");
  const roomRestockedId = form.get("roomRestockedId");
  const remainingQuantity = form.get("remainingQuantity");
  const sharpieRoom = form.get("sharpieRoom") === "true";
  const sharpieDate = form.get("sharpieDate") === "true";
  const sharpieInitials = form.get("sharpieInitials") === "true";
  const noReplacement = form.get("noReplacement") === "true";
  const pin = form.get("pin");
  const emptyBottlePhoto = form.get("emptyBottlePhoto");
  const newItemPhoto = form.get("newItemPhoto");

  if (typeof specificItem !== "string" || !specificItem.trim()) {
    return NextResponse.json({ error: "Enter which item was restocked." }, { status: 400 });
  }
  if (!sharpieRoom || !sharpieDate || !sharpieInitials) {
    return NextResponse.json({ error: "All three sharpie-label confirmations are required." }, { status: 400 });
  }
  if (!(emptyBottlePhoto instanceof File) || emptyBottlePhoto.size === 0) {
    return NextResponse.json({ error: "A photo of the empty bottle is required." }, { status: 400 });
  }
  // If there's no replacement on hand, there's nothing to photograph -- this
  // becomes an order request instead of a normal restock entry.
  if (!noReplacement && (!(newItemPhoto instanceof File) || newItemPhoto.size === 0)) {
    return NextResponse.json({ error: "A photo of the replacement item is required." }, { status: 400 });
  }
  if (typeof pin !== "string" || !pin) {
    return NextResponse.json({ error: "PIN signature is required." }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const { data: employee, error: empError } = await supabase
    .from("employees")
    .select("pin_hash")
    .eq("id", session.employeeId)
    .single();
  if (empError || !employee || !verifyPin(pin, employee.pin_hash)) {
    return NextResponse.json({ error: "Incorrect PIN." }, { status: 401 });
  }

  async function uploadPhoto(file: File, tag: string) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type === "image/png" ? "png" : "jpg";
    const path = `${session!.employeeId}/${tag}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("checklist-photos")
      .upload(path, buffer, { contentType: file.type || "image/jpeg", upsert: true });
    if (uploadError) throw new Error(uploadError.message);
    const { data: publicUrl } = supabase.storage.from("checklist-photos").getPublicUrl(path);
    return publicUrl.publicUrl;
  }

  let emptyBottleUrl: string;
  let newItemUrl: string | null = null;
  try {
    emptyBottleUrl = await uploadPhoto(emptyBottlePhoto, "empty");
    if (!noReplacement && newItemPhoto instanceof File) {
      newItemUrl = await uploadPhoto(newItemPhoto, "new");
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Photo upload failed." }, { status: 500 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("room_restocking_logs")
    .insert({
      employee_id: session.employeeId,
      item_type: typeof itemType === "string" && itemType.trim() ? itemType.trim() : null,
      specific_item: specificItem.trim(),
      room_ran_out_id: typeof roomRanOutId === "string" && roomRanOutId ? roomRanOutId : null,
      room_restocked_id: typeof roomRestockedId === "string" && roomRestockedId ? roomRestockedId : null,
      remaining_quantity: typeof remainingQuantity === "string" ? remainingQuantity.trim() : null,
      sharpie_room_confirmed: true,
      sharpie_date_confirmed: true,
      sharpie_initials_confirmed: true,
      empty_bottle_photo_url: emptyBottleUrl,
      new_item_photo_url: newItemUrl,
      no_replacement: noReplacement,
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // No replacement on hand -- this is an order request, not just a log entry.
  // Alert managers directly (not a broadcast to the whole team) so it lands
  // as something that needs a purchasing decision.
  if (noReplacement) {
    try {
      const managerIds = (await getManagerRecipientIds(supabase)).filter((id) => id !== session.employeeId);
      await notifyEmployees(supabase, managerIds, {
        type: "approval_needed",
        title: "📦 Item needs to be ordered",
        body: `${session.name} — out of ${specificItem.trim()}, no replacement on hand.`,
        link: "/inventory/room-restocking",
      });
    } catch {
      // Best-effort -- don't fail the submission over a notification.
    }
  }

  // If the restocked item matches a tracked backbar item and the reported
  // remaining quantity is at/below its par level, flag it for the team —
  // this is what "someone should reorder this soon" looks like without a
  // dedicated low-stock UI.
  try {
    const qty = typeof remainingQuantity === "string" ? parseFloat(remainingQuantity) : NaN;
    if (!Number.isNaN(qty)) {
      const { data: matchedItem } = await supabase
        .from("backbar_items")
        .select("name, par_level")
        .eq("active", true)
        .ilike("name", specificItem.trim())
        .maybeSingle();
      if (matchedItem && qty <= Number(matchedItem.par_level)) {
        await postBroadcastAlert(
          supabase,
          `⚠️ Room Restocking (${session.name}): ${matchedItem.name} is down to ${qty}, at or below its par level of ${matchedItem.par_level}.`
        );
      }
    }
  } catch {
    // Best-effort — don't fail the submission over an alert post.
  }

  return NextResponse.json({ ok: true });
}
