import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import Admin from "./client";

export default function Page() {
  const session = getSession();
  if (!session) redirect("/");
  const isManager = session.role === "manager" || session.isAdmin;
  if (!isManager) redirect("/dashboard");
  return <Admin isOwner={session.isOwner} myEmployeeId={session.employeeId} />;
}
