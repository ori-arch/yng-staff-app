"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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

const SEGMENT_TITLE: Record<string, string> = { open: "Opening Checklist", close: "Closing Checklist" };

export default function ChecklistSegmentPage() {
  const { segment } = useParams<{ segment: string }>();
  const router = useRouter();
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [pin, setPin] = useState("");
  const [signError, setSignError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingPhotoItemId = useRef<string | null>(null);

  useEffect(() => {
    fetch(`/api/checklists/${segment}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setSubmissionId(data.submissionId);
          setItems(data.items);
        }
      })
      .catch(() => setError("Could not load this checklist. Check your connection."))
      .finally(() => setLoading(false));
  }, [segment]);

  async function toggleItem(item: Item) {
    if (item.requiresPhoto && !item.completed && !item.photoUrl) {
      // Needs a photo before it can be checked off — open the camera instead.
      pendingPhotoItemId.current = item.submissionItemId;
      fileInputRef.current?.click();
      return;
    }
    await saveItem(item.submissionItemId, !item.completed);
  }

  async function saveItem(submissionItemId: string, completed: boolean, photo?: File) {
    setBusyItemId(submissionItemId);
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

  function onPhotoChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const itemId = pendingPhotoItemId.current;
    e.target.value = "";
    if (file && itemId) saveItem(itemId, true, file);
  }

  const allComplete = items.length > 0 && items.every((i) => i.completed);

  function pressDigit(d: string) {
    setSignError(null);
    setPin((p) => (p + d).slice(0, 6));
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
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="container"><p style={{ textAlign: "center", marginTop: 60 }}>Loading…</p></div>;
  }

  if (done) {
    return (
      <div className="container">
        <div className="card" style={{ marginTop: 60, textAlign: "center" }}>
          <p>Checklist submitted and signed. Nice work!</p>
          <button className="primary" style={{ marginTop: 12 }} onClick={() => router.push("/dashboard")}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="top-bar">
        <a href="/checklists" className="link-button">← Checklists</a>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>{SEGMENT_TITLE[segment] ?? segment}</h1>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={onPhotoChosen}
      />

      {error && <p className="error-text">{error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {items.map((item) => (
          <button
            key={item.submissionItemId}
            className="card"
            onClick={() => toggleItem(item)}
            disabled={busyItemId === item.submissionItemId}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              textAlign: "left",
              cursor: "pointer",
              opacity: busyItemId === item.submissionItemId ? 0.6 : 1,
            }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                minWidth: 20,
                borderRadius: 6,
                border: "2px solid #1a1a1a",
                background: item.completed ? "#1a1a1a" : "transparent",
                marginTop: 2,
              }}
            />
            <span style={{ flex: 1 }}>
              <span style={{ fontSize: 14.5 }}>{item.itemText}</span>
              <br />
              <span style={{ fontSize: 12, color: "#6b6b6b" }}>
                {item.requiresPhoto && (item.photoUrl ? "Photo attached ✓" : "Photo required — tap to take one")}
                {item.firstShiftOnly && !item.requiresPhoto && "First shift only"}
                {item.lastShiftOnly && !item.requiresPhoto && "Last shift only"}
              </span>
            </span>
          </button>
        ))}
      </div>

      {allComplete && !signing && (
        <button className="primary" style={{ marginTop: 20 }} onClick={() => setSigning(true)}>
          Submit &amp; Sign
        </button>
      )}

      {signing && (
        <div className="card" style={{ marginTop: 20, textAlign: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Re-enter your PIN to sign</p>
          <p style={{ fontSize: 12.5, color: "#6b6b6b", marginTop: 0 }}>
            This confirms you completed every step above.
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
            <button onClick={() => { setSigning(false); setPin(""); }} style={{ fontSize: 13 }}>
              Cancel
            </button>
            <button onClick={() => pressDigit("0")} disabled={submitting}>0</button>
            <button onClick={() => setPin((p) => p.slice(0, -1))} disabled={submitting}>⌫</button>
          </div>
          <button
            className="primary"
            style={{ marginTop: 12 }}
            disabled={pin.length < 4 || submitting}
            onClick={confirmSignature}
          >
            {submitting ? "Submitting…" : "Confirm"}
          </button>
        </div>
      )}
    </div>
  );
}
