import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import ComplianceDashboard from "./client";

export default function CompliancePage() {
  const session = getSession();
  if (!session) redirect("/");

  const isManager = session.role === "manager" || session.isAdmin;
  if (!isManager) redirect("/dashboard");

  return <ComplianceDashboard />;
}
