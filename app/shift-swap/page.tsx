import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import ShiftSwap from "./client";

export default function ShiftSwapPage() {
  const session = getSession();
  if (!session) redirect("/");
  const isManager = session.role === "manager" || session.isAdmin;
  return <ShiftSwap isManager={isManager} myEmployeeId={session.employeeId} />;
}
