"use client";

import { useEffect, useState } from "react";

type SegmentStatus = { segment: string; completedToday: boolean };

const SEGMENT_LABEL: Record<string, { label: string; sub: string }> = {
  open: { label: "Opening Checklist", sub: "Start-of-shift tasks" },
  close: { label: "Closing Checklist", sub: "End-of-shift tasks" },
};

export default function ChecklistsHome() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [segments, setSegments] = useState<SegmentStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/checklists/segments")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setSupported(data.supported);
          setSegments(data.segments ?? []);
        }
      })
      .catch(() => setError("Could not load checklists. Check your connection."));
  }, []);

  return (
    <div className="container">
      <div className="top-bar">
        <a href="/dashboard" className="link-button">← Dashboard</a>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Today's Checklist</h1>
      <p style={{ color: "#6b6b6b", fontSize: 14 }}>Front desk / aesthetician open and close tasks.</p>

      {error && <p className="error-text">{error}</p>}

      {supported === false && (
        <div className="card" style={{ marginTop: 16 }}>
          <p style={{ margin: 0, fontSize: 14 }}>
            There's no daily checklist assigned to your role yet.
          </p>
        </div>
      )}

      {segments.length > 0 && (
        <div className="grid">
          {segments.map((s) => {
            const meta = SEGMENT_LABEL[s.segment] ?? { label: s.segment, sub: "" };
            return (
              <a key={s.segment} href={`/checklists/${s.segment}`} className="tile">
                {meta.label}
                <span className="sub">{s.completedToday ? "Done today ✓" : meta.sub}</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
