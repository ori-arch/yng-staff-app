import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSegmentStatus } from "@/lib/checklists";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type Tile = { href: string; label: string; sub: string; gold?: boolean };

const TILES: Record<string, Tile> = {
  equipment: { href: "/equipment-log", label: "Equipment Log", sub: "Log a device use" },
  roomRestocking: { href: "/inventory/room-restocking", label: "Room Restocking", sub: "Log a pulled item" },
  restockRunner: { href: "/inventory/restock-runner", label: "Restock Runner", sub: "Cabinet & loft check" },
  loftCleaning: { href: "/inventory/loft-cleaning", label: "Loft Cleaning", sub: "Periodic duty" },
  protocols: { href: "/protocols", label: "Protocols", sub: "Treatment reference" },
  messages: { href: "/messages", label: "Messages", sub: "Team & alerts" },
  admin: { href: "/admin", label: "Admin Panel", sub: "Team, rooms, checklists" },
  compliance: { href: "/compliance", label: "Compliance", sub: "Who did what today" },
  photos: { href: "/photos", label: "Photos", sub: "Everything staff have captured" },
  schedule: { href: "/schedule", label: "Schedule", sub: "Build the team's shifts" },
  myShifts: { href: "/my-shifts", label: "My Shifts", sub: "Your upcoming schedule" },
  broadcast: { href: "/broadcast", label: "Send a Broadcast", sub: "Message the whole team", gold: true },
};

function TileGrid({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid">
      {tiles.map((t) => (
        <a key={t.href + t.label} href={t.href} className={`tile${t.gold ? " gold-tile" : ""}`}>
          {t.label}
          <span className="sub">{t.sub}</span>
        </a>
      ))}
    </div>
  );
}

function greetingWord() {
  const h = new Date().getUTCHours() - 4; // Eastern-ish; only used for the greeting word
  const hour = (h + 24) % 24;
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function todayLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });
}

async function getManagerStats() {
  const supabase = supabaseAdmin();
  const [{ count: pendingTimeOff }, { count: pendingSwaps }, { count: openWarnings }] = await Promise.all([
    supabase.from("time_off_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("shift_swap_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending_coworker", "pending_owner"]),
    supabase.from("warning_notices").select("id", { count: "exact", head: true }).eq("status", "issued"),
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

  const isManager = session.role === "manager" || session.isAdmin;
  const firstName = session.name.split(" ")[0];

  return (
    <div className="container">
      <div className="greeting">
        <div className="eyebrow">{todayLabel()}</div>
        <h1>
          {greetingWord()}, {firstName}.
        </h1>
      </div>

      {isManager ? (
        <ManagerDashboard />
      ) : (
        <StaffDashboard employeeId={session.employeeId} role={session.role} />
      )}
    </div>
  );
}

const SEGMENT_META: Record<string, { title: string; sub: string }> = {
  open: { title: "Opening", sub: "Start-of-shift tasks" },
  close: { title: "Closing", sub: "End-of-shift tasks" },
};

async function StaffDashboard({ employeeId, role }: { employeeId: string; role: string }) {
  const segments = await getSegmentStatus(employeeId, role);
  const allDone = segments.length > 0 && segments.every((s) => s.completedToday);

  return (
    <>
      <div className="hero">
        <div className="hero-label">Today&apos;s checklist</div>
        <h2>{allDone ? "All done for today." : "Your open / close tasks"}</h2>
        {segments.length === 0 ? (
          <p style={{ color: "#b8b0a5", fontSize: 14, margin: 0 }}>No checklist is assigned to your role yet.</p>
        ) : (
          segments.map((s) => {
            const meta = SEGMENT_META[s.segment] ?? { title: s.segment, sub: "" };
            return (
              <a
                key={s.segment}
                href={`/checklists/${s.segment}`}
                className={`segment-row${s.completedToday ? " done" : ""}`}
              >
                <span>
                  <div className="seg-title">{meta.title}</div>
                  <div className="seg-sub">
                    {s.completedToday ? "Signed & submitted" : s.startedToday ? "In progress — pick up where you left off" : meta.sub}
                  </div>
                </span>
                <span className="seg-cta">{s.completedToday ? "Done ✓" : s.startedToday ? "Continue" : "Start"}</span>
              </a>
            );
          })
        )}
      </div>

      <div className="section-label">Quick log</div>
      <TileGrid tiles={role === "aesthetician" ? [TILES.roomRestocking, TILES.equipment] : [TILES.equipment, TILES.restockRunner]} />

      <div className="section-label">Team</div>
      <TileGrid tiles={[TILES.myShifts, TILES.messages, TILES.protocols]} />

      <p style={{ marginTop: 26, fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
        Time off, shift swaps, facility duties and more are in the menu ☰
      </p>
    </>
  );
}

async function ManagerDashboard() {
  const stats = await getManagerStats();

  return (
    <>
      <div className="section-label">Needs your attention</div>
      <div className="stat-row">
        <a href="/time-off" className={`stat-card${stats.pendingTimeOff > 0 ? " attention" : ""}`}>
          <span className="num">{stats.pendingTimeOff}</span>
          <span className="label">Time off</span>
        </a>
        <a href="/shift-swap" className={`stat-card${stats.pendingSwaps > 0 ? " attention" : ""}`}>
          <span className="num">{stats.pendingSwaps}</span>
          <span className="label">Shift swaps</span>
        </a>
        <a href="/warnings" className={`stat-card${stats.openWarnings > 0 ? " attention" : ""}`}>
          <span className="num">{stats.openWarnings}</span>
          <span className="label">Open warnings</span>
        </a>
      </div>

      <div className="section-label">Today</div>
      <div className="grid">
        <a href="/compliance" className="tile primary-tile">
          Compliance
          <span className="sub">Who completed their checklists today</span>
        </a>
      </div>
      <TileGrid tiles={[TILES.broadcast, TILES.messages]} />

      <div className="section-label">Manage</div>
      <TileGrid tiles={[TILES.schedule, TILES.admin, TILES.photos, TILES.protocols]} />

      <p style={{ marginTop: 26, fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
        Equipment and inventory logs, time off and more are in the menu ☰
      </p>
    </>
  );
}
