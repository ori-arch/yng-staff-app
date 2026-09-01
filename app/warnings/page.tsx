import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import WarningsList from "./client";

export default function WarningsPage() {
  const session = getSession();
  if (!session) redirect("/");

  const isManager = session.role === "manager" || session.isAdmin;
  return <WarningsList isManager={isManager} />;
}
