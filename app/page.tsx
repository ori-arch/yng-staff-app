"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Employee = { id: string; name: string; role: string };

const ROLE_LABEL: Record<string, string> = {
  front_desk: "Front Desk",
  aesthetician: "Aesthetician",
  manager: "Manager",
};

export default function HomePage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/employees/roster")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setErrorMsg(data.error);
        else setEmployees(data.employees);
      })
      .catch(() => setErrorMsg("Could not load staff list. Check your connection."));
  }, []);

  return (
    <div className="container" style={{ paddingTop: 48 }}>
      <img src="/logo-black.png" alt="yng." style={{ width: 96, margin: "0 auto 28px", display: "block" }} />
      <h1 style={{ textAlign: "center", fontSize: 24 }}>Who&apos;s clocking in?</h1>
      <p className="page-sub" style={{ textAlign: "center", marginTop: 4 }}>
        Tap your name to continue
      </p>

      {errorMsg && <p className="error-text">{errorMsg}</p>}

      <div className="grid">
        {employees?.map((e) => (
          <button key={e.id} className="tile" onClick={() => router.push(`/login/${e.id}`)}>
            {e.name}
            <span className="sub">{ROLE_LABEL[e.role] ?? e.role}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
