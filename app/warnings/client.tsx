"use client";

import { useEffect, useState } from "react";

type Warning = {
  id: string;
  employeeId: string;
  employeeName: string;
  violationDate: string;
  violationDescription: string;
  status: string;
  quarterLabel: string;
  createdAt: string;
};

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString([], { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default function WarningsList({ isManager }: { isManager: boolean }) {
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/warnings")
      .then((r) => r.json())
      .then((data) => setWarnings(data.warnings ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container">
      <h1 className="page-title">Warning Notices</h1>
      <p style={{ color: "var(--muted)", fontSize: 14 }}>
        {isManager ? "All warning notices issued to staff." : "Warning notices issued to you."}
      </p>

      {loading ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>
      ) : warnings.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>No warning notices{isManager ? "" : " — you're all clear"}.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {warnings.map((w) => (
            <a key={w.id} href={`/warnings/${w.id}`} className="card" style={{ display: "block" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                  {isManager ? w.employeeName : "Warning Notice"}
                </span>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: w.status === "acknowledged" ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {w.status === "acknowledged" ? "Acknowledged" : "Needs acknowledgment"}
                </span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>{w.violationDescription}</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                {fmtDate(w.violationDate)} · {w.quarterLabel}
              </p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
