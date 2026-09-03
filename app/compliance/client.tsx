"use client";

import { useEffect, useState } from "react";

type SegmentStatus = {
  segment: string;
  status: "done" | "missed" | "pending" | "not_scheduled";
  completedAt: string | null;
  warning: { id: string; status: string } | null;
};

type EmployeeRow = {
  employeeId: string;
  name: string;
  role: string;
  scheduled: boolean;
  segments: SegmentStatus[];
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

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
      } else {
        setError(data.error || "Could not generate warning.");
      }
    } finally {
      setIssuing(null);
    }
  }

  return (
    <div className="container">
      <h1 className="page-title">Compliance</h1>
      <p className="page-sub">Checklist completion by employee and day.</p>

      <div style={{ margin: "12px 0" }}>
        <input
          type="date"
          value={date}
          max={todayStr()}
          onChange={(e) => setDate(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: "1px solid var(--border-strong)" }}
        />
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>No checklist-eligible employees found.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map((row) => (
            <div key={row.employeeId} className="card">
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
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: style.fg }}>{style.label}</span>
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
          ))}
        </div>
      )}
    </div>
  );
}
