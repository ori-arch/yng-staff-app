import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import LogoutButton from "./logout-button";

export default function DashboardPage() {
  const session = getSession();
  if (!session) redirect("/");

  const tiles = [
    { href: "/checklists", label: "Today's Checklist", sub: "Open / close tasks" },
    { href: "/equipment-log", label: "Equipment Log", sub: "Device use & cleaning" },
    { href: "/inventory/restock-runner", label: "Restock Runner", sub: "Cabinet & loft check" },
    { href: "/inventory/room-restocking", label: "Room Restocking", sub: "Log a pulled item" },
    { href: "/inventory/loft-cleaning", label: "Loft Cleaning", sub: "Periodic duty" },
    { href: "/protocols", label: "Protocols", sub: "Treatment reference" },
    { href: "/messages", label: "Messages", sub: "Broadcasts & DMs" },
    { href: "/time-off", label: "Time Off", sub: "Request & balance" },
    { href: "/shift-swap", label: "Shift Swap", sub: "Trade a shift" },
  ];

  if (session.isAdmin) {
    tiles.push({ href: "/admin", label: "Admin Panel", sub: "Manage everything" });
  }

  return (
    <div className="container">
      <div className="top-bar">
        <div>
          <div style={{ fontWeight: 600 }}>Hi, {session.name}</div>
          <div style={{ fontSize: 12.5, color: "#6b6b6b" }}>
            {session.role === "front_desk" ? "Front Desk" : "Aesthetician"}
            {session.isAdmin ? " · Admin" : ""}
          </div>
        </div>
        <LogoutButton />
      </div>

      <div className="grid">
        {tiles.map((t) => (
          <a key={t.href} href={t.href} className="tile">
            {t.label}
            <span className="sub">{t.sub}</span>
          </a>
        ))}
      </div>

      <p style={{ marginTop: 24, fontSize: 12.5, color: "#6b6b6b", textAlign: "center" }}>
        More screens are still being built out — this is the foundation.
      </p>
    </div>
  );
}
