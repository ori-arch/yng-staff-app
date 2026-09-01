import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default function Page() {
  const session = getSession();
  if (!session) redirect("/");

  return (
    <div className="container">
      <div className="top-bar">
        <a href="/dashboard" className="link-button">← Dashboard</a>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Today's Checklist</h1>
      <p style={{ color: "#6b6b6b", fontSize: 14 }}>Front desk / aesthetician open and close tasks.</p>
      <div className="card" style={{ marginTop: 16 }}>
        <p style={{ margin: 0, fontSize: 14 }}>This screen is scaffolded but not built yet — next up in the build order.</p>
      </div>
    </div>
  );
}
