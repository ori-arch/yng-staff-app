"use client";

import { useEffect, useState } from "react";

type Log = {
  id: string;
  logDate: string;
  createdAt: string;
  lowInventoryItems: string[];
  employeeName: string | null;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function RestockRunnerPage() {
  const [steps, setSteps] = useState<string[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [lowItemsText, setLowItemsText] = useState("");
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/inventory/restock-runner")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setSteps(data.steps ?? []);
          setLogs(data.logs ?? []);
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const allChecked = steps.length > 0 && steps.every((s) => checked[s]);

  async function submit() {
    setError(null);
    if (!allChecked) {
      setError("Check off every step first.");
      return;
    }
    setSubmitting(true);
    try {
      const lowInventoryItems = lowItemsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/inventory/restock-runner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: checked, lowInventoryItems }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save this log.");
        return;
      }
      setChecked({});
      setLowItemsText("");
      setJustSubmitted(true);
      setTimeout(() => setJustSubmitted(false), 3000);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container">
      <h1 className="page-title">Restock Runner Duties</h1>
      <p className="page-sub">Bathroom cabinet + loft stock check.</p>

      {loading ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>
      ) : (
        <div className="card" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {steps.map((step) => (
              <button
                key={step}
                onClick={() => setChecked((c) => ({ ...c, [step]: !c[step] }))}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  textAlign: "left",
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid #eee",
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    minWidth: 18,
                    borderRadius: 5,
                    border: "2px solid var(--ink)",
                    background: checked[step] ? "var(--ink)" : "transparent",
                  }}
                />
                <span style={{ fontSize: 14 }}>{step}</span>
              </button>
            ))}
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Flag low-inventory items (optional, one per line)</label>
            <textarea
              value={lowItemsText}
              onChange={(e) => setLowItemsText(e.target.value)}
              rows={3}
              placeholder={"e.g.\nWitch hazel\nCotton balls"}
              style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid var(--border-strong)", fontFamily: "inherit" }}
            />
          </div>

          {error && <p className="error-text">{error}</p>}
          {justSubmitted && <p style={{ color: "var(--success)", fontSize: 13.5, margin: 0 }}>Logged ✓</p>}

          <button className="btn" onClick={submit} disabled={submitting || !allChecked}>
            {submitting ? "Saving…" : "Submit"}
          </button>
        </div>
      )}

      <div className="section-label">Recent duty logs</div>
      {logs.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>No logs yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {logs.map((l) => (
            <div key={l.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{l.employeeName ?? "Unknown"}</span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{fmtDate(l.logDate)}</span>
              </div>
              {l.lowInventoryItems.length > 0 && (
                <p style={{ fontSize: 12.5, color: "var(--danger)", margin: "4px 0 0" }}>
                  Low: {l.lowInventoryItems.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
