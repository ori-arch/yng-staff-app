import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import MessagesList from "./client";

export default function MessagesPage() {
  const session = getSession();
  if (!session) redirect("/");

  return <MessagesList myEmployeeId={session.employeeId} />;
}
