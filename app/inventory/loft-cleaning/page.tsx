"use client";

import { useEffect, useState } from "react";

type Log = {
  id: string;
  logDate: string;
  lowOnCleanLinens: boolean | null;
  fridgeItemsOverWeekOld: boolean | null;
  fridgeItemsUnlabeled: boolean | null;
  remarks: string | null;
  employeeName: string | null;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function YesNo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600 }}>{label}</label>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button
          onClick={() => onChange(true)}
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 8,
            border: value === true ? "2px solid #1a1a1a" : "1px solid #ddd",
            background: value === true ? "#1a1a1a" : "transparent",
            color: value === true ? "#fff" : "#1a1a1a",
          }}
        >
          Yes
        </button>
        <button
          onClick={() => onChange(false)}
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 8,
            border: value === false ? "2px solid #1a1a1a" : "1px solid #ddd",
            background: value === false ? "#1a1a1a" : "transparent",
            color: value === false ? "#fff" : "#1a1a1a",
          }}
        >
          No
        </button>
      </div>
    </div>
  );
}

export default function LoftCleaningPage() {
  const [steps, setSteps] = useState<string[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [lowOnCleanLinens, setLowOnCleanLinens] = useState<boolean | null>(null);
  const [lastShiftLoftDuty, setLastShiftLoftDuty] = useState<boolean | null>(null);
  const [fridgeOld, setFridgeOld] = useState<boolean | null>(null);
  const [fridgeUnlabeled, setFridgeUnlabeled] = useState<boolean | null>(null);
  const [remarks, setRemarks] = useState("");
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/inventory/loft-cleaning")
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
    if (lowOnCleanLinens === null || lastShiftLoftDuty === null || fridgeOld === null || fridgeUnlabeled === null) {
      setError("Please answer all four questions below.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory/loft-cleaning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklist: checked,
          lowOnCleanLinens,
          lastShiftLoftDuty,
          fridgeItemsOverWeekOld: fridgeOld,
          fridgeItemsUnlabeled: fridgeUnlabeled,
          remarks,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save this log.");
        return;
      }
      setChecked({});
      setLowOnCleanLinens(null);
      setLastShiftLoftDuty(null);
      setFridgeOld(null);
      setFridgeUnlabeled(null);
      setRemarks("");
      setJustSubmitted(true);
      setTimeout(() => setJustSubmitted(false), 3000);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container">
      <div className="top-bar">
        <a href="/dashboard" className="link-button">← Dashboard</a>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Loft Cleaning Duties</h1>
      <p style={{ color: "#6b6b6b", fontSize: 14 }}>Periodic facilities duty, separate from restocking.</p>

      {loading ? (
        <p style={{ color: "#6b6b6b", fontSize: 14 }}>Loading…</p>
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
                    border: "2px solid #1a1a1a",
                    background: checked[step] ? "#1a1a1a" : "transparent",
                  }}
                />
                <span style={{ fontSize: 14 }}>{step}</span>
              </button>
            ))}
          </div>

          <YesNo label="Are we low on clean linens?" value={lowOnCleanLinens} onChange={setLowOnCleanLinens} />
          <YesNo label="Were you on last-shift loft duty?" value={lastShiftLoftDuty} onChange={setLastShiftLoftDuty} />
          <YesNo label="Anything in the mini fridge over a week old?" value={fridgeOld} onChange={setFridgeOld} />
          <YesNo label="Anything in the mini fridge unlabeled?" value={fridgeUnlabeled} onChange={setFridgeUnlabeled} />

          <div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Remarks (optional)</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid #ddd", fontFamily: "inherit" }}
            />
          </div>

          {error && <p className="error-text">{error}</p>}
          {justSubmitted && <p style={{ color: "#1a7a3a", fontSize: 13.5, margin: 0 }}>Logged ✓</p>}

          <button className="primary" onClick={submit} disabled={submitting || !allChecked}>
            {submitting ? "Saving…" : "Submit"}
          </button>
        </div>
      )}

      <h2 style={{ fontSize: 15, fontWeight: 600, marginTop: 24 }}>Recent duty logs</h2>
      {logs.length === 0 ? (
        <p style={{ color: "#6b6b6b", fontSize: 14 }}>No logs yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {logs.map((l) => (
            <div key={l.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{l.employeeName ?? "Unknown"}</span>
                <span style={{ fontSize: 12, color: "#6b6b6b" }}>{fmtDate(l.logDate)}</span>
              </div>
              <div style={{ fontSize: 12, color: "#b3261e", marginTop: 2 }}>
                {l.lowOnCleanLinens && "Low on linens. "}
                {l.fridgeItemsOverWeekOld && "Old fridge item. "}
                {l.fridgeItemsUnlabeled && "Unlabeled fridge item. "}
              </div>
              {l.remarks && <p style={{ fontSize: 13, margin: "4px 0 0" }}>{l.remarks}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
