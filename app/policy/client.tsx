"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Policy = { id: string; title: string; body: string; version: number; updatedAt: string };
type Acknowledgment = { version: number; signedAt: string; current: boolean } | null;
type ViolationType = {
  id: string;
  name: string;
  track: "green" | "yellow" | "red";
  levelLabel: string;
  description: string;
  recommendedAction: string | null;
  strikeLimit: number;
  resetPeriod: string;
};

const TRACK_META: Record<string, { label: string; emoji: string; bg: string; fg: string }> = {
  green: { label: "Green", emoji: "🟢", bg: "#e7f4e8", fg: "#3a7d44" },
  yellow: { label: "Yellow", emoji: "🟡", bg: "#fbf1dc", fg: "#a6790a" },
  red: { label: "Red", emoji: "🔴", bg: "#fbe9e8", fg: "#b3261e" },
};

const RESET_LABEL: Record<string, string> = {
  quarterly: "resets quarterly",
  annually: "resets annually",
  never: "never resets",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function PolicyView({ mode }: { mode: "view" | "sign" }) {
  const router = useRouter();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [ack, setAck] = useState<Acknowledgment>(null);
  const [types, setTypes] = useState<ViolationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [signing, setSigning] = useState(false);
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/policy").then((r) => r.json()),
      fetch("/api/admin/violation-types").then((r) => r.json()),
    ])
      .then(([p, t]) => {
        if (p.error) setError(p.error);
        else {
          setPolicy(p.policy);
          setAck(p.myAcknowledgment);
        }
        if (!t.error) setTypes(t.violationTypes ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  function pressDigit(d: string) {
    setError(null);
    setPin((p) => (p + d).slice(0, 6));
  }

  async function submitSign() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/policy/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not sign.");
        setPin("");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="container"><p className="empty">Loading…</p></div>;
  if (!policy) return <div className="container"><p className="error-text">{error ?? "No policy on file."}</p></div>;

  const needsSign = mode === "sign" || !ack?.current;
  const byTrack = { green: types.filter((t) => t.track === "green"), yellow: types.filter((t) => t.track === "yellow"), red: types.filter((t) => t.track === "red") };

  return (
    <div className="container">
      <h1 className="page-title">{policy.title}</h1>
      {mode === "sign" ? (
        <p className="page-sub">Please read this in full, then sign below to continue.</p>
      ) : ack?.current ? (
        <p className="page-sub">You signed this on {fmtDate(ack.signedAt)}.</p>
      ) : (
        <p className="error-text">This policy was updated since you last signed — you'll be asked to re-sign on your next login.</p>
      )}

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ padding: 14, whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.5 }}>{policy.body}</div>

      {(["green", "yellow", "red"] as const).map((track) => (
        <div key={track}>
          <div className="section-label">
            {TRACK_META[track].emoji} {TRACK_META[track].label} track — {byTrack[track][0] ? RESET_LABEL[byTrack[track][0].resetPeriod] : ""}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {byTrack[track].map((t) => (
              <div key={t.id} className="card" style={{ padding: 12, borderLeft: `4px solid ${TRACK_META[track].fg}` }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: TRACK_META[track].fg, background: TRACK_META[track].bg, padding: "2px 8px", borderRadius: 999 }}>
                    {t.strikeLimit} strike{t.strikeLimit === 1 ? "" : "s"}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", margin: "2px 0 6px" }}>{t.levelLabel}</div>
                <div style={{ fontSize: 13, color: "var(--ink)" }}>{t.description}</div>
                {t.recommendedAction && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>Typical response: {t.recommendedAction}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}

      {needsSign && (
        <div className="card gold" style={{ padding: 16, marginTop: 20 }}>
          {!signing ? (
            <>
              <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600 }}>I have read and understand this policy.</p>
              <button className="btn gold" onClick={() => setSigning(true)}>
                Sign with my PIN
              </button>
            </>
          ) : (
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Re-enter your PIN to sign</p>
              <div className="pin-dots">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={`pin-dot ${i < pin.length ? "filled" : ""}`} />
                ))}
              </div>
              <div className="keypad">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                  <button key={d} onClick={() => pressDigit(d)} disabled={submitting}>
                    {d}
                  </button>
                ))}
                <button onClick={() => { setSigning(false); setPin(""); }} style={{ fontSize: 13 }}>
                  Cancel
                </button>
                <button onClick={() => pressDigit("0")} disabled={submitting}>
                  0
                </button>
                <button onClick={() => setPin((p) => p.slice(0, -1))} disabled={submitting}>
                  ⌫
                </button>
              </div>
              <button className="btn gold" style={{ marginTop: 12 }} disabled={pin.length < 4 || submitting} onClick={submitSign}>
                {submitting ? "Signing…" : "Confirm Signature"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
