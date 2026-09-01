import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import LogoutButton from "./logout-button";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  front_desk: "Front Desk",
  aesthetician: "Aesthetician",
  manager: "Manager",
};

type Tile = { href: string; label: string; sub: string };

const TILES: Record<string, Tile> = {
  checklist: { href: "/checklists", label: "Today's Checklist", sub: "Open / close tasks" },
  equipment: { href: "/equipment-log", label: "Equipment Log", sub: "Device use & cleaning" },
  roomRestocking: { href: "/inventory/room-restocking", label: "Room Restocking", sub: "Log a pulled item" },
  restockRunner: { href: "/inventory/restock-runner", label: "Restock Runner", sub: "Cabinet & loft check" },
  loftCleaning: { href: "/inventory/loft-cleaning", label: "Loft Cleaning", sub: "Periodic duty" },
  protocols: { href: "/protocols", label: "Protocols", sub: "Treatment reference" },
  messages: { href: "/messages", label: "Messages", sub: "Broadcasts & DMs" },
  timeOff: { href: "/time-off", label: "Time Off", sub: "Request & balance" },
  shiftSwap: { href: "/shift-swap", label: "Shift Swap", sub: "Trade a shift" },
  admin: { href: "/admin", label: "Admin Panel", sub: "Manage everything" },
};

function TileGrid({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid">
      {tiles.map((t) => (
        <a key={t.href} href={t.href} className="tile">
          {t.label}
          <span className="sub">{t.sub}</span>
        </a>
      ))}
    </div>
  );
}

async function getManagerStats() {
  const supabase = supabaseAdmin();
  const [{ count: pendingTimeOff }, { count: pendingSwaps }, { count: openWarnings }] =
    await Promise.all([
      supabase
        .from("time_off_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("shift_swap_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending_coworker", "pending_owner"]),
      supabase
        .from("warning_notices")
        .select("id", { count: "exact", head: true })
        .eq("status", "issued"),
    ]);

  return {
    pendingTimeOff: pendingTimeOff ?? 0,
    pendingSwaps: pendingSwaps ?? 0,
    openWarnings: openWarnings ?? 0,
  };
}

export default async function DashboardPage() {
  const session = getSession();
  if (!session) redirect("/");

  const roleLabel = ROLE_LABEL[session.role] ?? session.role;
  const isManager = session.role === "manager" || session.isAdmin;

  return (
    <div className="container">
      <div className="top-bar">
        <div>
          <div style={{ fontWeight: 600 }}>Hi, {session.name}</div>
          <div style={{ fontSize: 12.5, color: "#6b6b6b" }}>
            {roleLabel}
            {session.isAdmin ? " · Admin" : ""}
          </div>
        </div>
        <LogoutButton />
      </div>

      {isManager ? (
        <ManagerDashboard isAdmin={session.isAdmin} />
      ) : session.role === "front_desk" ? (
        <FrontDeskDashboard />
      ) : (
        <AestheticianDashboard />
      )}
    </div>
  );
}

async function ManagerDashboard({ isAdmin }: { isAdmin: boolean }) {
  const stats = await getManagerStats();

  return (
    <>
      <div className="section-label">Needs your attention</div>
      <div className="stat-row">
        <a href="/time-off" className={`stat-card${stats.pendingTimeOff > 0 ? " attention" : ""}`}>
          <span className="num">{stats.pendingTimeOff}</span>
          <span className="label">Time off requests</span>
        </a>
        <a href="/shift-swap" className={`stat-card${stats.pendingSwaps > 0 ? " attention" : ""}`}>
          <span className="num">{stats.pendingSwaps}</span>
          <span className="label">Shift swaps</span>
        </a>
        <a href="/admin" className={`stat-card${stats.openWarnings > 0 ? " attention" : ""}`}>
          <span className="num">{stats.openWarnings}</span>
          <span className="label">Open warnings</span>
        </a>
      </div>

      <div className="section-label">Team</div>
      <div className="grid">
        <a href="/messages" className="tile primary-tile">
          Send a Broadcast
          <span className="sub">Message the whole team</span>
        </a>
      </div>
      <TileGrid tiles={[TILES.protocols, TILES.timeOff, TILES.messages, TILES.admin]} />

      {isAdmin && (
        <>
          <div className="section-label">Owner tools</div>
          <TileGrid tiles={[TILES.admin]} />
        </>
      )}

      <p style={{ marginTop: 24, fontSize: 12.5, color: "#6b6b6b", textAlign: "center" }}>
        More screens are still being built out — this is the foundation.
      </p>
    </>
  );
}

function FrontDeskDashboard() {
  return (
    <>
      <div className="section-label">Your shift</div>
      <div className="grid">
        <a href={TILES.checklist.href} className="tile primary-tile">
          {TILES.checklist.label}
          <span className="sub">{TILES.checklist.sub}</span>
        </a>
      </div>
      <TileGrid tiles={[TILES.restockRunner, TILES.loftCleaning]} />

      <div className="section-label">Also</div>
      <TileGrid tiles={[TILES.equipment, TILES.protocols, TILES.messages, TILES.timeOff, TILES.shiftSwap]} />

      <p style={{ marginTop: 24, fontSize: 12.5, color: "#6b6b6b", textAlign: "center" }}>
        More screens are still being built out — this is the foundation.
      </p>
    </>
  );
}

function AestheticianDashboard() {
  return (
    <>
      <div className="section-label">Your shift</div>
      <div className="grid">
        <a href={TILES.checklist.href} className="tile primary-tile">
          {TILES.checklist.label}
          <span className="sub">{TILES.checklist.sub}</span>
        </a>
      </div>
      <TileGrid tiles={[TILES.roomRestocking, TILES.equipment]} />

      <div className="section-label">Facility duties</div>
      <TileGrid tiles={[TILES.restockRunner, TILES.loftCleaning]} />

      <div className="section-label">Also</div>
      <TileGrid tiles={[TILES.protocols, TILES.messages, TILES.timeOff, TILES.shiftSwap]} />

      <p style={{ marginTop: 24, fontSize: 12.5, color: "#6b6b6b", textAlign: "center" }}>
        More screens are still being built out — this is the foundation.
      </p>
    </>
  );
}
