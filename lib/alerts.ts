import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Posts a system-authored message (sender_id null) into the "All Staff"
 * broadcast channel. Used for task-linked alerts — a flagged low-inventory
 * item, a facilities issue, a restocked item that's at/below its par level —
 * so the whole team sees it without anyone having to remember to mention it.
 * Best-effort: callers should not fail their own request if this fails.
 */
export async function postBroadcastAlert(supabase: SupabaseClient, body: string): Promise<void> {
  const { data: channel } = await supabase
    .from("channels")
    .select("id")
    .eq("type", "broadcast")
    .limit(1)
    .maybeSingle();
  if (!channel) return; // no broadcast channel exists yet — nothing to post into

  await supabase.from("messages").insert({ channel_id: channel.id, sender_id: null, body });
}
