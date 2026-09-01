"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SetupPinPage() {
  return (
    <Suspense fallback={null}>
      <SetupPinForm />
    </Suspense>
  );
}

function SetupPinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const employeeId = params.get("employeeId");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPin.length < 4) {
      setError("PIN must be at least 4 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      setError("PINs don't match.");
      return;
    }
    const res = await fetch("/api/auth/set-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, newPin }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(
        data.error === "Not authorized."
          ? "This account already has a PIN set. Ask an admin to reset it for you."
          : data.error || "Something went wrong."
      );
      return;
    }
    setDone(true);
  }

  if (!employeeId) {
    return (
      <div className="container">
        <p className="error-text">Missing employee. Go back and pick your name first.</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="container">
        <div className="card" style={{ marginTop: 60, textAlign: "center" }}>
          <p>PIN set! You can log in now.</p>
          <button className="primary" style={{ marginTop: 12 }} onClick={() => router.push(`/login/${employeeId}`)}>
            Continue to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1 style={{ fontSize: 18, fontWeight: 600, marginTop: 40 }}>Set your PIN</h1>
      <p style={{ color: "#6b6b6b", fontSize: 13.5 }}>
        Choose a 4–6 digit PIN you'll use to log in on the shift phone.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
        <input
          type="password"
          inputMode="numeric"
          placeholder="New PIN"
          value={newPin}
          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="card"
          style={{ fontSize: 18, padding: 14, textAlign: "center" }}
        />
        <input
          type="password"
          inputMode="numeric"
          placeholder="Confirm PIN"
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="card"
          style={{ fontSize: 18, padding: 14, textAlign: "center" }}
        />
        {error && <p className="error-text">{error}</p>}
        <button className="primary" type="submit">
          Save PIN
        </button>
      </form>
    </div>
  );
}
