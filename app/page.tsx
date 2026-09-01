"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

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
    <div className="container">
      <img src="/icons/icon-192.png" alt="YNG" className="logo" />
      <h1 style={{ textAlign: "center", fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
        Who's clocking in?
      </h1>
      <p style={{ textAlign: "center", color: "#6b6b6b", fontSize: 13.5, marginTop: 0 }}>
        Tap your name to continue
      </p>

      {errorMsg && <p className="error-text">{errorMsg}</p>}

      <div className="grid">
        {employees?.map((e) => (
          <button
            key={e.id}
            className="tile"
            onClick={() => router.push(`/login/${e.id}`)}
          >
            {e.name}
            <span className="sub">{ROLE_LABEL[e.role] ?? e.role}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
