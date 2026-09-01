"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

const PIN_LENGTH = 4;

export default function PinLoginPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  async function submit(fullPin: string) {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: id, pin: fullPin }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      if (res.status === 403) {
        setNeedsSetup(true);
      } else {
        setError(data.error || "Something went wrong.");
        setPin("");
      }
      return;
    }
    router.push("/dashboard");
  }

  function press(digit: string) {
    if (submitting) return;
    const next = (pin + digit).slice(0, PIN_LENGTH);
    setPin(next);
    if (next.length === PIN_LENGTH) submit(next);
  }

  function backspace() {
    setPin((p) => p.slice(0, -1));
  }

  if (needsSetup) {
    return (
      <div className="container">
        <div className="card" style={{ marginTop: 60, textAlign: "center" }}>
          <p>No PIN has been set for this account yet.</p>
          <button className="primary" style={{ marginTop: 12 }} onClick={() => router.push(`/setup?employeeId=${id}`)}>
            Set up my PIN
          </button>
          <button className="link-button" style={{ marginTop: 12 }} onClick={() => router.push("/")}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="top-bar">
        <button className="link-button" onClick={() => router.push("/")}>
          ← Back
        </button>
      </div>
      <h1 style={{ textAlign: "center", fontSize: 18, fontWeight: 600, marginTop: 40 }}>
        Enter your PIN
      </h1>

      <div className="pin-dots">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div key={i} className={`pin-dot ${i < pin.length ? "filled" : ""}`} />
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="keypad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <button onClick={() => router.push(`/setup?employeeId=${id}`)} style={{ fontSize: 13 }}>
          Forgot?
        </button>
        <button onClick={() => press("0")}>0</button>
        <button onClick={backspace}>⌫</button>
      </div>
    </div>
  );
}
