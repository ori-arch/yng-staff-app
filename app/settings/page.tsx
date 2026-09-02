import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import Settings from "./client";

const ROLE_LABEL: Record<string, string> = {
  front_desk: "Front Desk",
  aesthetician: "Aesthetician",
  manager: "Manager",
};

export default function SettingsPage() {
  const session = getSession();
  if (!session) redirect("/");

  return (
    <Settings
      name={session.name}
      roleLabel={ROLE_LABEL[session.role] ?? session.role}
      isOwner={session.isOwner}
      isAdmin={session.isAdmin}
    />
  );
}
