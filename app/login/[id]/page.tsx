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
    router.refresh();
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
      <div className="container" style={{ paddingTop: 48 }}>
        <img src="/logo-black.png" alt="yng." style={{ width: 96, margin: "0 auto 28px", display: "block" }} />
        <div className="card gold" style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: 20, marginBottom: 6 }}>Welcome</h2>
          <p style={{ margin: "0 0 14px", color: "var(--muted)", fontSize: 14 }}>
            No PIN has been set for this account yet. Choose one to get started.
          </p>
          <button className="btn" onClick={() => router.push(`/setup?employeeId=${id}`)}>
            Set up my PIN
          </button>
          <button className="link-button" style={{ marginTop: 10 }} onClick={() => router.push("/")}>
            Not you? Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 20 }}>
      <button className="back-link" onClick={() => router.push("/")}>
        ‹ Back
      </button>
      <img src="/logo-black.png" alt="yng." style={{ width: 84, margin: "20px auto 24px", display: "block" }} />
      <h1 style={{ textAlign: "center", fontSize: 22 }}>Enter your PIN</h1>

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
        <button className="soft" onClick={() => router.push(`/setup?employeeId=${id}`)}>
          Forgot?
        </button>
        <button onClick={() => press("0")}>0</button>
        <button className="soft" onClick={backspace} style={{ fontSize: 18 }}>⌫</button>
      </div>
    </div>
  );
}
