"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Standing = {
  employeeId: string;
  employeeName: string;
  points: number;
  byCategory: Record<string, { count: number; points: number }>;
};
type Cycle = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  prizeDescription: string | null;
  status: string;
  winnerEmployeeId: string | null;
  announcedAt: string | null;
};

function defaultAnnouncement(cycle: Cycle, winnerName: string): string {
  const prize = cycle.prizeDescription ? ` and takes home: ${cycle.prizeDescription}` : "";
  return `🏆 ${cycle.name} leaderboard winner: ${winnerName}${prize}! Thank you to everyone who logged sales this cycle — great work, team.`;
}

export default function ReviewCycle({ cycleId, managerName }: { cycleId: string; managerName: string }) {
  const router = useRouter();
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [winnerId, setWinnerId] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/leaderboard/cycles/${cycleId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setCycle(data.cycle);
        setStandings(data.standings ?? []);
        const leader = data.standings?.[0];
        const initialWinner = data.cycle.winnerEmployeeId ?? leader?.employeeId ?? "";
        setWinnerId(initialWinner);
        if (leader) setAnnouncement(defaultAnnouncement(data.cycle, leader.employeeName));
      })
      .finally(() => setLoading(false));
  }, [cycleId]);

  const leader = standings[0] ?? null;
  const winner = standings.find((s) => s.employeeId === winnerId) ?? null;
  const isOverride = leader && winnerId && winnerId !== leader.employeeId;

  function pickWinner(employeeId: string) {
    setWinnerId(employeeId);
    const name = standings.find((s) => s.employeeId === employeeId)?.employeeName;
    if (name && cycle) setAnnouncement(defaultAnnouncement(cycle, name));
  }

  async function confirm() {
    if (!winnerId) {
      setError("Pick a winner first.");
      return;
    }
    if (isOverride && !overrideReason.trim()) {
      setError(`${leader?.employeeName} is the point leader — overriding requires a reason.`);
      return;
    }
    if (!announcement.trim()) {
      setError("Write the announcement that goes out to the team.");
      return;
    }
    if (!confirm_dialog()) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch("/api/leaderboard/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId, winnerEmployeeId: winnerId, overrideReason: overrideReason.trim() || undefined, announcementText: announcement.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      router.push("/leaderboard/manage");
    } finally {
      setConfirming(false);
    }
  }

  function confirm_dialog(): boolean {
    return window.confirm("This announces the winner to the whole team and closes the cycle for good. Continue?");
  }

  if (loading) return <div className="container"><p className="empty">Loading…</p></div>;
  if (!cycle) return <div className="container"><p className="error-text">{error ?? "Cycle not found."}</p></div>;

  if (cycle.status === "closed") {
    return (
      <div className="container">
        <h1 className="page-title">{cycle.name}</h1>
        <p className="page-sub">Already confirmed and closed.</p>
      </div>
    );
  }

  return (
    <div className="container">
      <h1 className="page-title">Confirm cycle winner</h1>
      <p className="page-sub">
        {cycle.name} · {cycle.startDate} – {cycle.endDate}
      </p>

      {error && <p className="error-text">{error}</p>}

      <div className="section-label">Final standings</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {standings.map((s, i) => (
          <div key={s.employeeId} className={`card${s.employeeId === winnerId ? " gold" : ""}`} style={{ padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                onClick={() => setExpanded(expanded === s.employeeId ? null : s.employeeId)}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", flex: 1 }}
              >
                <span style={{ fontSize: 14, fontWeight: i === 0 ? 700 : 500 }}>
                  #{i + 1} {s.employeeName} {i === 0 ? "· point leader" : ""}
                </span>
              </button>
              <span style={{ fontWeight: 700, marginRight: 10 }}>{s.points} pts</span>
              <button className={`btn ${s.employeeId === winnerId ? "gold" : "outline"} sm`} onClick={() => pickWinner(s.employeeId)}>
                {s.employeeId === winnerId ? "Selected" : "Pick as winner"}
              </button>
            </div>
            {expanded === s.employeeId && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)", fontSize: 12.5, color: "var(--muted)" }}>
                {Object.entries(s.byCategory).map(([key, v]) => (
                  <div key={key} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{key.replace(/_/g, " ")}</span>
                    <span>
                      {v.count} · {v.points} pts
                    </span>
                  </div>
                ))}
                {Object.keys(s.byCategory).length === 0 && <span>No entries logged.</span>}
              </div>
            )}
          </div>
        ))}
        {standings.length === 0 && <p className="empty">No one logged anything this cycle.</p>}
      </div>

      {isOverride && (
        <>
          <div className="section-label">Why override the point leader?</div>
          <textarea
            style={{ width: "100%", minHeight: 70, padding: 12, borderRadius: 8, border: "1px solid var(--border-strong)", fontSize: 14 }}
            placeholder="Required when picking someone other than the point leader — e.g. logs didn't reconcile against Zenoti."
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
          />
        </>
      )}

      <div className="section-label">Announcement (goes to All Staff)</div>
      <textarea
        style={{ width: "100%", minHeight: 90, padding: 12, borderRadius: 8, border: "1px solid var(--border-strong)", fontSize: 14 }}
        value={announcement}
        onChange={(e) => setAnnouncement(e.target.value)}
      />

      <button className="btn gold" style={{ marginTop: 16 }} disabled={confirming || !winner} onClick={confirm}>
        {confirming ? "Confirming…" : `Confirm ${winner?.employeeName ?? "winner"} & Announce`}
      </button>
    </div>
  );
}
