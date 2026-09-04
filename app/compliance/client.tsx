"use client";

import { useEffect, useState } from "react";

type SegmentStatus = {
  segment: string;
  status: "done" | "missed" | "pending" | "not_scheduled";
  late: boolean;
  completedAt: string | null;
  warning: { id: string; status: string } | null;
  reminded: boolean;
};

type EmployeeRow = {
  employeeId: string;
  name: string;
  role: string;
  scheduled: boolean;
  segments: SegmentStatus[];
};

type MissedItem = {
  employeeId: string;
  employeeName: string;
  role: string;
  date: string;
  segment: string;
};

// The business's own Eastern calendar day, not the browser's local day or
// raw UTC -- matters for consistency with the server-side "today" used to
// decide what's actually a missed (past) checklist vs. still pending.
function todayStr() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function addDays(dateStr: string, delta: number) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function fmtDateLong(dateStr: string) {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  done: { bg: "var(--success-soft)", fg: "var(--success)", label: "Done" },
  missed: { bg: "var(--danger-soft)", fg: "var(--danger)", label: "Missed" },
  pending: { bg: "var(--surface)", fg: "var(--muted)", label: "Pending" },
  not_scheduled: { bg: "var(--surface)", fg: "var(--muted)", label: "Not scheduled" },
};

export default function ComplianceDashboard() {
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issuing, setIssuing] = useState<string | null>(null);
  const [reminding, setReminding] = useState<string | null>(null);
  const [missedRecent, setMissedRecent] = useState<MissedItem[]>([]);
  const [loadingMissed, setLoadingMissed] = useState(true);
  const [showAllMissed, setShowAllMissed] = useState(false);

  function load() {
    setLoading(true);
    fetch(`/api/compliance/checklists?date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setError(null);
          setRows(data.rows ?? []);
        }
      })
      .finally(() => setLoading(false));
  }

  function loadMissedRecent() {
    setLoadingMissed(true);
    fetch("/api/compliance/missed-summary")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setMissedRecent(data.items ?? []);
      })
      .finally(() => setLoadingMissed(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    loadMissedRecent();
  }, []);

  async function generateWarning(employeeId: string, employeeName: string, segment: string) {
    const key = `${employeeId}:${segment}`;
    setIssuing(key);
    try {
      const res = await fetch("/api/warnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          violationDate: date,
          violationDescription: `Failure to Complete or Report Daily Responsibilities — Shift Tasks (${segment} checklist, ${date})`,
          sourceTable: `checklist:${segment}`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        load();
        loadMissedRecent();
      } else {
        setError(data.error || "Could not generate warning.");
      }
    } finally {
      setIssuing(null);
    }
  }

  async function sendReminder(employeeId: string, segment: string) {
    const key = `${employeeId}:${segment}`;
    setReminding(key);
    try {
      const res = await fetch("/api/compliance/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, date, segment }),
      });
      const data = await res.json();
      if (res.ok) {
        load();
      } else {
        setError(data.error || "Could not send reminder.");
      }
    } finally {
      setReminding(null);
    }
  }

  const isToday = date === todayStr();

  // Missed-something rows first, so the people who need attention aren't buried.
  const sortedRows = [...rows].sort((a, b) => {
    const aMissed = a.segments.some((s) => s.status === "missed") ? 0 : 1;
    const bMissed = b.segments.some((s) => s.status === "missed") ? 0 : 1;
    if (aMissed !== bMissed) return aMissed - bMissed;
    return a.name.localeCompare(b.name);
  });
  const missedCount = rows.filter((r) => r.segments.some((s) => s.status === "missed")).length;

  return (
    <div className="container">
      <h1 className="page-title">Compliance</h1>
      <p className="page-sub">Checklist completion by employee and day.</p>

      {!loadingMissed && missedRecent.length > 0 && (
        <div className="card" style={{ marginTop: 12, borderLeft: "4px solid var(--danger)" }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--danger)" }}>
            {missedRecent.length} missed checklist{missedRecent.length === 1 ? "" : "s"} from the last 30 days still
            need attention
          </p>
          <p style={{ margin: "4px 0 8px", fontSize: 12, color: "var(--muted)" }}>
            This stays visible no matter which day you're viewing — it only clears once a warning is issued.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {(showAllMissed ? missedRecent : missedRecent.slice(0, 5)).map((m) => (
              <button
                key={`${m.employeeId}:${m.date}:${m.segment}`}
                onClick={() => setDate(m.date)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12.5,
                  padding: "4px 6px",
                  borderRadius: 6,
                  background: "var(--danger-soft)",
                  textAlign: "left",
                }}
              >
                <span>
                  {m.employeeName} · {m.segment}
                </span>
                <span style={{ color: "var(--muted)" }}>{fmtDateLong(m.date)}</span>
              </button>
            ))}
          </div>
          {missedRecent.length > 5 && (
            <button
              onClick={() => setShowAllMissed((v) => !v)}
              style={{ fontSize: 12, color: "var(--muted)", textDecoration: "underline", padding: 0, marginTop: 6 }}
            >
              {showAllMissed ? "Show less" : `Show all ${missedRecent.length}`}
            </button>
          )}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0" }}>
        <button
          className="btn ghost sm"
          onClick={() => setDate((d) => addDays(d, -1))}
          aria-label="Previous day"
          style={{ padding: "8px 12px" }}
        >
          ‹
        </button>
        <input
          type="date"
          value={date}
          max={todayStr()}
          onChange={(e) => setDate(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: "1px solid var(--border-strong)" }}
        />
        <button
          className="btn ghost sm"
          onClick={() => setDate((d) => addDays(d, 1))}
          disabled={isToday}
          aria-label="Next day"
          style={{ padding: "8px 12px" }}
        >
          ›
        </button>
        {!isToday && (
          <button className="btn ghost sm" onClick={() => setDate(todayStr())}>
            Today
          </button>
        )}
      </div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginTop: -6 }}>{fmtDateLong(date)}</p>

      {error && <p className="error-text">{error}</p>}

      {!loading && rows.length > 0 && (
        <p
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: missedCount > 0 ? "var(--danger)" : "var(--success)",
            background: missedCount > 0 ? "var(--danger-soft)" : "var(--success-soft)",
            borderRadius: 8,
            padding: "6px 10px",
            display: "inline-block",
          }}
        >
          {missedCount > 0 ? `${missedCount} of ${rows.length} missed something` : `All ${rows.length} clear`}
        </p>
      )}

      {loading ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>No checklist-eligible employees found.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
          {sortedRows.map((row) => {
            const rowHasMissed = row.segments.some((s) => s.status === "missed");
            return (
              <div key={row.employeeId} className="card" style={rowHasMissed ? { borderLeft: "4px solid var(--danger)" } : undefined}>
                <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 8 }}>
                  {row.name} <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12.5 }}>({row.role.replace("_", " ")})</span>
                  {!row.scheduled && (
                    <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12.5 }}> · not on the schedule that day</span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {row.segments.map((seg) => {
                    const style = STATUS_STYLE[seg.status];
                    const key = `${row.employeeId}:${seg.segment}`;
                    return (
                      <div
                        key={seg.segment}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "6px 10px",
                          borderRadius: 8,
                          background: style.bg,
                        }}
                      >
                        <span style={{ fontSize: 13.5, textTransform: "capitalize" }}>{seg.segment}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: style.fg }}>
                            {style.label}
                            {seg.late && " (late)"}
                          </span>
                          {seg.status === "missed" && !seg.warning && (
                            seg.reminded ? (
                              <span style={{ fontSize: 11, color: "var(--muted)" }}>Reminder sent</span>
                            ) : (
                              <button
                                onClick={() => sendReminder(row.employeeId, seg.segment)}
                                disabled={reminding === key}
                                style={{
                                  fontSize: 11.5,
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  border: "1px solid var(--border-strong)",
                                  color: "var(--ink)",
                                  background: "white",
                                }}
                              >
                                {reminding === key ? "Sending…" : "Send Reminder"}
                              </button>
                            )
                          )}
                          {seg.status === "missed" && !seg.warning && (
                            <button
                              onClick={() => generateWarning(row.employeeId, row.name, seg.segment)}
                              disabled={issuing === key}
                              style={{
                                fontSize: 11.5,
                                padding: "4px 8px",
                                borderRadius: 6,
                                border: "1px solid var(--danger)",
                                color: "var(--danger)",
                                background: "white",
                              }}
                            >
                              {issuing === key ? "Generating…" : "Generate Warning"}
                            </button>
                          )}
                          {seg.warning && (
                            <a
                              href={`/warnings/${seg.warning.id}`}
                              style={{ fontSize: 11.5, color: "var(--muted)", textDecoration: "underline" }}
                            >
                              {seg.warning.status === "acknowledged" ? "Warning acknowledged" : "Warning issued"}
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
