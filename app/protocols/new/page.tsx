import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import NewProtocolForm from "./client";

export default function NewProtocolPage() {
  const session = getSession();
  if (!session) redirect("/");

  const isManager = session.role === "manager" || session.isAdmin;
  if (!isManager) redirect("/protocols");

  return <NewProtocolForm />;
}
