"use client";

import { useEffect, useState } from "react";

type SegmentStatus = { segment: string; completedToday: boolean };

const SEGMENT_LABEL: Record<string, { label: string; sub: string }> = {
  open: { label: "Opening", sub: "Start-of-shift tasks" },
  close: { label: "Closing", sub: "End-of-shift tasks" },
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
      <h1 className="page-title">Today&apos;s Checklist</h1>
      <p className="page-sub">Pick the part of your shift you&apos;re on.</p>

      {error && <p className="error-text">{error}</p>}

      {supported === false && (
        <div className="card tinted">
          <p style={{ margin: 0, fontSize: 14 }}>There&apos;s no daily checklist assigned to your role.</p>
        </div>
      )}

      <div className="stack">
        {segments.map((s) => {
          const meta = SEGMENT_LABEL[s.segment] ?? { label: s.segment, sub: "" };
          return (
            <a key={s.segment} href={`/checklists/${s.segment}`} className="list-row">
              <span>
                <div className="title">{meta.label}</div>
                <div className="sub">{meta.sub}</div>
              </span>
              <span className={`badge${s.completedToday ? " success" : " gold"}`}>
                {s.completedToday ? "Done today" : "Start"}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
