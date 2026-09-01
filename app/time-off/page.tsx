import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import TimeOff from "./client";

export default function TimeOffPage() {
  const session = getSession();
  if (!session) redirect("/");
  const isManager = session.role === "manager" || session.isAdmin;
  return <TimeOff isManager={isManager} />;
}
