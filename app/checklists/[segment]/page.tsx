"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import CameraCapture from "@/components/CameraCapture";

type Item = {
  submissionItemId: string;
  templateId: string;
  itemText: string;
  requiresPhoto: boolean;
  firstShiftOnly: boolean;
  lastShiftOnly: boolean;
  completed: boolean;
  photoUrl: string | null;
};

const SEGMENT_TITLE: Record<string, string> = { open: "Opening", close: "Closing" };
const SEGMENT_SUB: Record<string, string> = {
  open: "Tap each task as you finish it. Sign at the end.",
  close: "Tap each task as you finish it. Sign at the end.",
};

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function CameraIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

export default function ChecklistSegmentPage() {
  const { segment } = useParams<{ segment: string }>();
  const router = useRouter();
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [alreadyDone, setAlreadyDone] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [pin, setPin] = useState("");
  const [signError, setSignError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [cameraForItem, setCameraForItem] = useState<Item | null>(null);
  const [forDate, setForDate] = useState<string | null>(null);
  const [isLate, setIsLate] = useState(false);

  function load(again = false) {
    setLoading(true);
    fetch(`/api/checklists/${segment}${again ? "?again=1" : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else if (data.alreadyCompleted) setAlreadyDone(data.completedAt);
        else {
          setAlreadyDone(null);
          setSubmissionId(data.submissionId);
          setItems(data.items);
          setForDate(data.forDate ?? null);
          setIsLate(Boolean(data.isLate));
        }
      })
      .catch(() => setError("Could not load this checklist. Check your connection."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment]);

  async function toggleItem(item: Item) {
    if (item.requiresPhoto && !item.completed && !item.photoUrl) {
      setCameraForItem(item);
      return;
    }
    await saveItem(item.submissionItemId, !item.completed);
  }

  async function saveItem(submissionItemId: string, completed: boolean, photo?: File) {
    setBusyItemId(submissionItemId);
    setError(null);
    const form = new FormData();
    form.set("submissionItemId", submissionItemId);
    form.set("completed", String(completed));
    if (photo) form.set("photo", photo);
    try {
      const res = await fetch("/api/checklists/item", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not update that item.");
        return;
      }
      setItems((prev) =>
        prev.map((i) =>
          i.submissionItemId === submissionItemId
            ? { ...i, completed: data.item.completed, photoUrl: data.item.photo_url }
            : i
        )
      );
    } finally {
      setBusyItemId(null);
    }
  }

  const doneCount = items.filter((i) => i.completed).length;
  const remaining = items.length - doneCount;
  const allComplete = items.length > 0 && remaining === 0;

  function pressDigit(d: string) {
    if (pin.length >= 4) return;
    setSignError(null);
    setPin((p) => p + d);
  }

  async function confirmSignature() {
    if (!submissionId) return;
    setSubmitting(true);
    setSignError(null);
    try {
      const res = await fetch("/api/checklists/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSignError(data.error || "Something went wrong.");
        setPin("");
        return;
      }
      setSigning(false);
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  const title = SEGMENT_TITLE[segment] ?? segment;

  if (loading) {
    return (
      <div className="container">
        <p className="empty">Loading…</p>
      </div>
    );
  }

  if (done || alreadyDone) {
    const when = alreadyDone
      ? new Date(alreadyDone).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      : null;
    return (
      <div className="container">
        <div className="done-state">
          <div className="ring">✓</div>
          <h2>{title} signed off</h2>
          <p>{when ? `Submitted today at ${when}.` : "Submitted and signed. Nice work."}</p>
          <button className="btn" onClick={() => router.push("/dashboard")}>
            Back to Home
          </button>
          {alreadyDone && (
            <button className="btn ghost" style={{ marginTop: 6 }} onClick={() => load(true)}>
              Start another {title.toLowerCase()} for a second shift
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1 className="page-title">{title}</h1>
      <p className="page-sub">{SEGMENT_SUB[segment] ?? ""}</p>

      {isLate && forDate && (
        <p
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--danger)",
            background: "var(--danger-soft)",
            borderRadius: 8,
            padding: "6px 10px",
            marginBottom: 4,
          }}
        >
          This is for your {fmtDate(forDate)} shift — it's being submitted late.
        </p>
      )}

      <div className="progress">
        <div className="bar">
          <span style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }} />
        </div>
        <span>
          {doneCount}/{items.length}
        </span>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="stack" style={{ gap: 8 }}>
        {items.map((item) => (
          <button
            key={item.submissionItemId}
            className={`check-row${item.completed ? " done" : ""}${item.requiresPhoto ? " needs-photo" : ""}`}
            onClick={() => toggleItem(item)}
            disabled={busyItemId === item.submissionItemId}
          >
            <span className="check-box">{item.completed ? "✓" : item.requiresPhoto ? <CameraIcon /> : ""}</span>
            <span className="check-text">
              {item.itemText}
              {item.requiresPhoto && !item.completed && <span className="check-meta">Photo required — tap to open camera</span>}
              {!item.requiresPhoto && item.firstShiftOnly && <span className="check-meta">First shift of the day only</span>}
              {!item.requiresPhoto && item.lastShiftOnly && <span className="check-meta">Last shift of the day only</span>}
            </span>
            {item.photoUrl && <img src={item.photoUrl} alt="" className="check-thumb" />}
          </button>
        ))}
      </div>

      <div className="sticky-footer">
        <div className="sticky-footer-inner">
          <button className="btn" disabled={!allComplete} onClick={() => setSigning(true)}>
            {allComplete ? "Sign & Submit" : `${remaining} task${remaining === 1 ? "" : "s"} left`}
          </button>
        </div>
      </div>

      {cameraForItem && (
        <CameraCapture
          title={cameraForItem.itemText}
          onCancel={() => setCameraForItem(null)}
          onCapture={(file) => {
            const itemId = cameraForItem.submissionItemId;
            setCameraForItem(null);
            saveItem(itemId, true, file);
          }}
        />
      )}

      {signing && (
        <div className="sheet-backdrop" onClick={() => { setSigning(false); setPin(""); }}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h2 style={{ fontSize: 20, textAlign: "center" }}>Sign with your PIN</h2>
            <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", margin: "4px 0 0" }}>
              This confirms you completed every task above.
            </p>
            <div className="pin-dots">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={`pin-dot ${i < pin.length ? "filled" : ""}`} />
              ))}
            </div>
            {signError && <p className="error-text">{signError}</p>}
            <div className="keypad">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button key={d} onClick={() => pressDigit(d)} disabled={submitting}>
                  {d}
                </button>
              ))}
              <button className="soft" onClick={() => { setSigning(false); setPin(""); }}>
                Cancel
              </button>
              <button onClick={() => pressDigit("0")} disabled={submitting}>0</button>
              <button className="soft" onClick={() => setPin((p) => p.slice(0, -1))} disabled={submitting}>⌫</button>
            </div>
            <button
              className="btn"
              style={{ marginTop: 14 }}
              disabled={pin.length < 4 || submitting}
              onClick={confirmSignature}
            >
              {submitting ? "Submitting…" : "Confirm & Submit"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
