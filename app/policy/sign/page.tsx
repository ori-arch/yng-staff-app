import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import PolicyView from "../client";

export default function PolicySignPage() {
  const session = getSession();
  if (!session) redirect("/");
  return <PolicyView mode="sign" />;
}
