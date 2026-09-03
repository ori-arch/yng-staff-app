import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSegmentStatus } from "@/lib/checklists";
import { getActiveCycle, computeStandings, daysRemaining, StandingRow, LeaderboardCycle } from "@/lib/leaderboard";
import { needsPolicyAcknowledgment } from "@/lib/policy";
import { computeConductStatus, ConductStatus } from "@/lib/warnings";

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
  leaderboard: { href: "/leaderboard", label: "Leaderboard", sub: "This cycle's standings" },
  leaderboardManage: { href: "/leaderboard/manage", label: "Leaderboard — Manage", sub: "Cycles, points, entries" },
  roomIssues: { href: "/room-issues", label: "Report a Room Issue", sub: "Room not ready? Photo it" },
  roomIssuesManage: { href: "/room-issues", label: "Room Issue Reports", sub: "Open & resolved reports" },
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

async function getLeaderboardSnapshot(): Promise<{ cycle: LeaderboardCycle; standings: StandingRow[] } | null> {
  const supabase = supabaseAdmin();
  const cycle = await getActiveCycle(supabase);
  if (!cycle || cycle.status !== "open") return null;
  const standings = await computeStandings(supabase, cycle.id);
  return { cycle, standings };
}

/** Display-only standings on the home screen -- no logging here, that stays on /leaderboard.
 * Shown to everyone, but this is the primary reason aestheticians open the app between clients. */
function LeaderboardWidget({ cycle, standings, myEmployeeId }: { cycle: LeaderboardCycle; standings: StandingRow[]; myEmployeeId?: string }) {
  const remaining = daysRemaining(cycle.endDate);
  const top = standings.slice(0, 5);
  return (
    <a href="/leaderboard" className="card gold" style={{ display: "block", padding: 14, textDecoration: "none", color: "inherit" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 700, fontSize: 14.5 }}>🏆 {cycle.name}</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{remaining > 0 ? `${remaining}d left` : "Closing soon"}</span>
      </div>
      {cycle.prizeDescription && (
        <div style={{ fontSize: 12.5, color: "var(--gold-dark)", fontWeight: 600, margin: "2px 0 8px" }}>{cycle.prizeDescription}</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
        {top.length === 0 ? (
          <span style={{ fontSize: 13, color: "var(--muted)" }}>No sales logged yet this cycle.</span>
        ) : (
          top.map((s, i) => (
            <div
              key={s.employeeId}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13.5,
                fontWeight: s.employeeId === myEmployeeId ? 700 : 500,
              }}
            >
              <span>
                #{i + 1} {s.employeeName}
                {s.employeeId === myEmployeeId ? " (you)" : ""}
              </span>
              <span>{s.points} pts</span>
            </div>
          ))
        )}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>Tap to view full standings &amp; log a sale ›</div>
    </a>
  );
}

/** Above-the-fold, but deliberately understated -- a color/emoji summary of where an
 * employee stands, never the loudest thing on the screen. Links to the full picture. */
function ConductStatusWidget({ status }: { status: ConductStatus }) {
  const bg = status.level === "good" ? "var(--surface)" : status.level === "watch" ? "#fbf1dc" : "#fbe9e8";
  const fg = status.level === "good" ? "var(--muted)" : status.level === "watch" ? "#a6790a" : "#b3261e";
  return (
    <a
      href="/warnings"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "9px 12px",
        borderRadius: 10,
        background: bg,
        color: fg,
        fontSize: 13,
        fontWeight: 600,
        textDecoration: "none",
        margin: "10px 0",
      }}
    >
      <span>{status.emoji} {status.message}</span>
      <span style={{ fontSize: 11.5, fontWeight: 500 }}>Details ›</span>
    </a>
  );
}

export default async function DashboardPage() {
  const session = getSession();
  if (!session) redirect("/");

  const supabase = supabaseAdmin();
  if (!session.isOwner) {
    const { needed } = await needsPolicyAcknowledgment(supabase, session.employeeId);
    if (needed) redirect("/policy/sign");
  }

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
  const [segments, leaderboard, conductStatus] = await Promise.all([
    getSegmentStatus(employeeId, role),
    getLeaderboardSnapshot(),
    computeConductStatus(supabaseAdmin(), employeeId),
  ]);
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

      <ConductStatusWidget status={conductStatus} />

      {leaderboard && (
        <>
          <div className="section-label">Leaderboard</div>
          <LeaderboardWidget cycle={leaderboard.cycle} standings={leaderboard.standings} myEmployeeId={employeeId} />
        </>
      )}

      <div className="section-label">Quick log</div>
      <TileGrid tiles={role === "aesthetician" ? [TILES.roomRestocking, TILES.equipment, TILES.roomIssues] : [TILES.equipment, TILES.restockRunner, TILES.roomIssues]} />

      <div className="section-label">Team</div>
      <TileGrid tiles={[TILES.myShifts, TILES.messages, TILES.protocols]} />

      <p style={{ marginTop: 26, fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
        Time off, shift swaps, facility duties and more are in the menu ☰
      </p>
    </>
  );
}

async function ManagerDashboard() {
  const [stats, leaderboard] = await Promise.all([getManagerStats(), getLeaderboardSnapshot()]);

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

      {leaderboard && (
        <>
          <div className="section-label">Leaderboard</div>
          <LeaderboardWidget cycle={leaderboard.cycle} standings={leaderboard.standings} />
        </>
      )}

      <div className="section-label">Today</div>
      <div className="grid">
        <a href="/compliance" className="tile primary-tile">
          Compliance
          <span className="sub">Who completed their checklists today</span>
        </a>
      </div>
      <TileGrid tiles={[TILES.broadcast, TILES.messages]} />

      <div className="section-label">Manage</div>
      <TileGrid tiles={[TILES.schedule, TILES.admin, TILES.leaderboardManage, TILES.roomIssuesManage, TILES.photos, TILES.protocols]} />

      <p style={{ marginTop: 26, fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
        Equipment and inventory logs, time off and more are in the menu ☰
      </p>
    </>
  );
}
