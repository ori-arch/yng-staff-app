import { SupabaseClient } from "@supabase/supabase-js";

/** True when this employee has not yet signed the current version of the conduct policy. */
export async function needsPolicyAcknowledgment(
  supabase: SupabaseClient,
  employeeId: string
): Promise<{ needed: boolean; policyId: string | null }> {
  const { data: policy } = await supabase
    .from("policy_documents")
    .select("id, version")
    .eq("key", "conduct_policy")
    .maybeSingle();
  if (!policy) return { needed: false, policyId: null };

  const { data: ack } = await supabase
    .from("policy_acknowledgments")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("policy_document_id", policy.id)
    .eq("version", policy.version)
    .maybeSingle();

  return { needed: !ack, policyId: policy.id };
}
