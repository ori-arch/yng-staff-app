import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import PolicyView from "./client";

/** Read-only reference to the conduct policy + violation catalog -- anyone can revisit this anytime.
 * The mandatory first-sign flow is the separate /policy/sign page. */
export default function PolicyPage() {
  const session = getSession();
  if (!session) redirect("/");
  return <PolicyView mode="view" />;
}
