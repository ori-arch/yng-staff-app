"use client";

import { useEffect, useState } from "react";

type Warning = {
  id: string;
  employeeId: string;
  employeeName: string;
  violationDate: string;
  violationDescription: string | null;
  violationTypeName: string | null;
  levelLabel: string | null;
  status: string;
  quarterLabel: string;
  track: "green" | "yellow" | "red" | null;
  strikeNumber: number | null;
  strikeLimit: number | null;
  active: boolean;
  createdAt: string;
};
type Employee = { id: string; name: string; role: string; active: boolean };
type ViolationType = { id: string; name: string; track: string; levelLabel: string; strikeLimit: number };

const TRACK_META: Record<string, { emoji: string; bg: string; fg: string }> = {
  green: { emoji: "🟢", bg: "#e7f4e8", fg: "#3a7d44" },
  yellow: { emoji: "🟡", bg: "#fbf1dc", fg: "#a6790a" },
  red: { emoji: "🔴", bg: "#fbe9e8", fg: "#b3261e" },
};

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default function WarningsList({ isManager }: { isManager: boolean }) {
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [types, setTypes] = useState<ViolationType[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showVoided, setShowVoided] = useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [violationTypeId, setViolationTypeId] = useState("");
  const [violationDate, setViolationDate] = useState(new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/warnings")
      .then((r) => r.json())
      .then((data) => setWarnings(data.warnings ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    if (isManager) {
      fetch("/api/admin/employees")
        .then((r) => r.json())
        .then((d) => setEmployees((d.employees ?? []).filter((e: Employee) => e.active)));
      fetch("/api/admin/violation-types")
        .then((r) => r.json())
        .then((d) => setTypes(d.violationTypes ?? []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function issue() {
    setError(null);
    if (!employeeId || !violationTypeId) {
      setError("Pick an employee and a violation type.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/warnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, violationTypeId, violationDate, violationDescription: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not issue this warning.");
        return;
      }
      setEmployeeId("");
      setViolationTypeId("");
      setNote("");
      setShowForm(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  const visibleWarnings = warnings.filter((w) => showVoided || w.active);

  return (
    <div className="container">
      <h1 className="page-title">Warning Notices</h1>
      <p style={{ color: "var(--muted)", fontSize: 14 }}>
        {isManager ? "All warning notices issued to staff." : "Warning notices issued to you."}
      </p>

      {isManager && (
        <div style={{ margin: "12px 0" }}>
          {!showForm ? (
            <button className="btn outline sm" onClick={() => setShowForm(true)}>
              Issue a Warning
            </button>
          ) : (
            <div className="card" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                style={{ padding: "11px 12px", borderRadius: 8, border: "1px solid var(--border-strong)", fontSize: 14.5 }}
              >
                <option value="">Employee…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <select
                value={violationTypeId}
                onChange={(e) => setViolationTypeId(e.target.value)}
                style={{ padding: "11px 12px", borderRadius: 8, border: "1px solid var(--border-strong)", fontSize: 14.5 }}
              >
                <option value="">Violation type…</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {TRACK_META[t.track]?.emoji} {t.name} ({t.levelLabel})
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={violationDate}
                onChange={(e) => setViolationDate(e.target.value)}
                style={{ padding: "11px 12px", borderRadius: 8, border: "1px solid var(--border-strong)", fontSize: 14.5 }}
              />
              <p style={{ fontSize: 12, color: "var(--muted)", margin: "-4px 0 0" }}>{fmtDate(violationDate)}</p>
              <input
                placeholder="Additional detail (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ padding: "11px 12px", borderRadius: 8, border: "1px solid var(--border-strong)", fontSize: 14.5 }}
              />
              {error && <p className="error-text">{error}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn gold" disabled={submitting} onClick={issue}>
                  {submitting ? "Issuing…" : "Issue Warning"}
                </button>
                <button className="btn ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isManager && (
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <button className={`btn ${!showVoided ? "outline" : "ghost"} sm`} onClick={() => setShowVoided(false)}>
            Active
          </button>
          <button className={`btn ${showVoided ? "outline" : "ghost"} sm`} onClick={() => setShowVoided(true)}>
            Include voided
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>
      ) : visibleWarnings.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>No warning notices{isManager ? "" : " — you're all clear"}.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {visibleWarnings.map((w) => {
            const track = w.track ? TRACK_META[w.track] : null;
            return (
              <a
                key={w.id}
                href={`/warnings/${w.id}`}
                className="card"
                style={{ display: "block", opacity: w.active ? 1 : 0.55 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{isManager ? w.employeeName : "Warning Notice"}</span>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: !w.active ? "var(--muted)" : w.status === "acknowledged" ? "var(--success, green)" : "var(--danger)",
                    }}
                  >
                    {!w.active ? "Voided" : w.status === "acknowledged" ? "Acknowledged" : "Needs acknowledgment"}
                  </span>
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
                  {w.violationTypeName ?? w.violationDescription ?? "—"}
                  {w.violationTypeName && w.violationDescription ? ` — ${w.violationDescription}` : ""}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{fmtDate(w.violationDate)}</span>
                  {track && (
                    <span style={{ background: track.bg, color: track.fg, borderRadius: 999, padding: "1px 7px", fontWeight: 600 }}>
                      {track.emoji} {w.strikeNumber ?? "?"}/{w.strikeLimit ?? "?"}
                    </span>
                  )}
                  {w.levelLabel && <span>· {w.levelLabel}</span>}
                </p>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
