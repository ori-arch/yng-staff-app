import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import Bugs from "./client";

export default function BugsPage() {
  const session = getSession();
  if (!session) redirect("/");
  return <Bugs isOwner={session.isOwner} />;
}
