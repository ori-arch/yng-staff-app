"use client";

import { useEffect, useState } from "react";

type Category = { id: string; key: string; label: string; description: string | null; points: number; displayOrder: number; active: boolean };
type Standing = {
  employeeId: string;
  employeeName: string;
  points: number;
  byCategory: Record<string, { count: number; points: number }>;
  isMe: boolean;
};
type MyEntry = { id: string; categoryKey: string; categoryLabel: string; points: number; loggedAt: string; canUndo: boolean };
type Cycle = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  prizeDescription: string | null;
  status: string;
  daysRemaining: number;
};

function fmtDate(d: string) {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export default function Leaderboard({ isManager, canLog }: { isManager: boolean; canLog: boolean }) {
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [myEntries, setMyEntries] = useState<MyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [logging, setLogging] = useState<string | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  function load() {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setCycle(data.cycle);
        setCategories(data.categories ?? []);
        setStandings(data.standings ?? []);
        setMyEntries(data.myEntries ?? []);
      })
      .catch(() => setError("Could not load the leaderboard."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function logCategory(key: string, label: string) {
    setLogging(key);
    setToast(null);
    try {
      const res = await fetch("/api/leaderboard/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryKey: key }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error || "Could not log that.");
        return;
      }
      setToast(`Logged — ${label} (+${data.points} points)`);
      load();
    } finally {
      setLogging(null);
    }
  }

  async function undo(entryId: string) {
    const res = await fetch(`/api/leaderboard/entries/${entryId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "undo" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setToast(data.error || "Could not undo that.");
      return;
    }
    setToast("Undone.");
    load();
  }

  if (loading) return <div className="container"><p className="empty">Loading…</p></div>;

  return (
    <div className="container">
      <h1 className="page-title">Leaderboard</h1>
      {error && <p className="error-text">{error}</p>}

      {isManager && (
        <div style={{ margin: "8px 0 16px" }}>
          <a href="/leaderboard/manage" className="btn outline sm">
            Manage cycles &amp; entries
          </a>
        </div>
      )}

      {!cycle ? (
        <p className="empty">No leaderboard cycle is open right now.</p>
      ) : (
        <>
          <div className="hero">
            <div className="hero-label">{cycle.name}</div>
            <h2>{cycle.daysRemaining > 0 ? `${cycle.daysRemaining} day${cycle.daysRemaining === 1 ? "" : "s"} left` : "Closing soon"}</h2>
            <p style={{ margin: "0 0 4px", fontSize: 13.5, color: "#d8d2c8" }}>
              {fmtDate(cycle.startDate)} – {fmtDate(cycle.endDate)}
            </p>
            {cycle.prizeDescription && (
              <p style={{ margin: 0, fontSize: 14.5, color: "#fff", fontWeight: 600 }}>🏆 {cycle.prizeDescription}</p>
            )}
          </div>

          <div style={{ margin: "10px 0" }}>
            <button className="btn outline sm" onClick={() => setShowHowItWorks(!showHowItWorks)}>
              {showHowItWorks ? "Hide rules" : "📋 Rules — how points work"}
            </button>
            {showHowItWorks && (
              <div className="card" style={{ padding: 12, marginTop: 8 }}>
                {categories.map((c) => (
                  <div key={c.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, fontWeight: 600 }}>
                      <span>{c.label}</span>
                      <span>{c.points} pts</span>
                    </div>
                    {c.description && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{c.description}</div>}
                  </div>
                ))}
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                  <span>• Points are flat per sale — a bigger ticket doesn't score higher.</span>
                  <span>• You can undo a self-logged entry within 10 minutes; after that, ask a manager.</span>
                  <span>• Standings reset at the start of each new cycle.</span>
                  <span>• Everyone on the board can see everyone else's total.</span>
                  <span>• Logs are self-reported and get checked against Zenoti before a winner is confirmed.</span>
                </div>
              </div>
            )}
          </div>

          {toast && (
            <div className="card gold" style={{ padding: 10, marginTop: 12 }}>
              <p style={{ margin: 0, fontSize: 13.5 }}>{toast}</p>
            </div>
          )}

          {canLog && (
            <>
              <div className="section-label">Log a sale</div>
              <div className="grid">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    className="tile gold-tile"
                    disabled={logging !== null}
                    onClick={() => logCategory(c.key, c.label)}
                  >
                    {c.label}
                    <span className="sub">+{c.points} points</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {myEntries.length > 0 && (
            <>
              <div className="section-label">Your recent entries</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {myEntries.slice(0, 8).map((e) => (
                  <div
                    key={e.id}
                    className="card"
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 10 }}
                  >
                    <span style={{ fontSize: 13.5 }}>
                      {e.categoryLabel} <span style={{ color: "var(--muted)" }}>+{e.points}</span>
                    </span>
                    {e.canUndo && (
                      <button className="btn ghost sm" onClick={() => undo(e.id)}>
                        Undo
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="section-label">Standings</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {standings.map((s, i) => (
              <div key={s.employeeId} className={`card${s.isMe ? " gold" : ""}`} style={{ padding: 10 }}>
                <button
                  onClick={() => setExpandedEmployee(expandedEmployee === s.employeeId ? null : s.employeeId)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: s.isMe ? 700 : 500 }}>
                    #{i + 1} {s.employeeName}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{s.points} pts</span>
                </button>
                {expandedEmployee === s.employeeId && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)", fontSize: 12.5, color: "var(--muted)" }}>
                    {Object.keys(s.byCategory).length === 0 ? (
                      <span>No entries yet this cycle.</span>
                    ) : (
                      categories
                        .filter((c) => s.byCategory[c.key])
                        .map((c) => (
                          <div key={c.key} style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>{c.label}</span>
                            <span>
                              {s.byCategory[c.key].count} · {s.byCategory[c.key].points} pts
                            </span>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

        </>
      )}
    </div>
  );
}
