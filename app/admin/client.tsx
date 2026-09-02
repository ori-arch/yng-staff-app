"use client";

import { useEffect, useState } from "react";

type Employee = {
  id: string;
  name: string;
  role: "front_desk" | "aesthetician" | "manager";
  is_admin: boolean;
  is_owner: boolean;
  active: boolean;
};

type Room = { id: string; name: string; active: boolean };

type Template = {
  id: string;
  role: "front_desk" | "aesthetician";
  segment: "open" | "close";
  item_order: number;
  item_text: string;
  requires_photo: boolean;
  first_shift_only: boolean;
  last_shift_only: boolean;
  active: boolean;
};

type BackbarItem = {
  id: string;
  name: string;
  unit: string | null;
  par_level: number;
  current_quantity: number;
  active: boolean;
};

const ROLE_LABEL: Record<string, string> = {
  front_desk: "Front Desk",
  aesthetician: "Aesthetician",
  manager: "Manager",
};

const TABS = [
  { key: "employees", label: "Employees" },
  { key: "rooms", label: "Rooms" },
  { key: "checklists", label: "Checklists" },
  { key: "parLevels", label: "Par Levels" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function inputStyle(extra?: object) {
  return { padding: 8, borderRadius: 8, border: "1px solid #ddd", fontSize: 13, ...extra };
}

export default function Admin({ isOwner, myEmployeeId }: { isOwner: boolean; myEmployeeId: string }) {
  const [tab, setTab] = useState<TabKey>("employees");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="container">
      <div className="top-bar">
        <a href="/dashboard" className="link-button">← Dashboard</a>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Admin Panel</h1>
      <p style={{ color: "#6b6b6b", fontSize: 14 }}>Manage employees, rooms, checklists, and par levels.</p>

      {error && <p className="error-text">{error}</p>}

      <div style={{ display: "flex", gap: 6, marginTop: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "6px 12px",
              borderRadius: 20,
              border: "1px solid " + (tab === t.key ? "#111" : "#ddd"),
              background: tab === t.key ? "#111" : "white",
              color: tab === t.key ? "white" : "#111",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "employees" && <EmployeesTab isOwner={isOwner} myEmployeeId={myEmployeeId} setError={setError} />}
      {tab === "rooms" && <RoomsTab setError={setError} />}
      {tab === "checklists" && <ChecklistsTab setError={setError} />}
      {tab === "parLevels" && <ParLevelsTab setError={setError} />}
    </div>
  );
}

/* ---------------- Employees ---------------- */

function EmployeesTab({
  isOwner,
  myEmployeeId,
  setError,
}: {
  isOwner: boolean;
  myEmployeeId: string;
  setError: (e: string | null) => void;
}) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("aesthetician");
  const [adding, setAdding] = useState(false);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPin, setResetPin] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/employees")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setEmployees(data.employees ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addEmployee() {
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), role: newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewName("");
        load();
      } else setError(data.error || "Could not add employee.");
    } finally {
      setAdding(false);
    }
  }

  async function update(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/employees/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) load();
      else setError(data.error || "Could not update employee.");
    } finally {
      setBusyId(null);
    }
  }

  async function submitReset(id: string) {
    if (!resetPin || resetPin.length < 4) {
      setError("New PIN must be at least 4 digits.");
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/auth/set-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: id, newPin: resetPin }),
      });
      const data = await res.json();
      if (res.ok) {
        setResetFor(null);
        setResetPin("");
      } else setError(data.error || "Could not reset PIN.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p style={{ color: "#6b6b6b", fontSize: 14 }}>Loading…</p>;

  return (
    <>
      <div className="card">
        <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>Add employee</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ ...inputStyle(), flex: 2, minWidth: 120 }}
          />
          <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={{ ...inputStyle(), flex: 1 }}>
            <option value="front_desk">Front Desk</option>
            <option value="aesthetician">Aesthetician</option>
            <option value="manager">Manager</option>
          </select>
          <button className="primary" disabled={!newName.trim() || adding} onClick={addEmployee}>
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
        <p style={{ fontSize: 11.5, color: "#6b6b6b", margin: "8px 0 0" }}>
          New employees start with no PIN — they'll set one themselves the first time they tap their name and hit
          "Forgot?".
        </p>
      </div>

      <div className="section-label">Employees</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {employees.map((e) => (
          <div key={e.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                {e.name}
                {e.is_owner && <span style={{ fontSize: 11, color: "#6b6b6b", fontWeight: 400 }}> · Owner</span>}
                {e.is_admin && !e.is_owner && <span style={{ fontSize: 11, color: "#6b6b6b", fontWeight: 400 }}> · Admin</span>}
                {!e.active && <span style={{ fontSize: 11, color: "#b3261e", fontWeight: 400 }}> · Inactive</span>}
              </span>
              <select
                value={e.role}
                disabled={busyId === e.id || e.is_owner}
                onChange={(ev) => update(e.id, { role: ev.target.value })}
                style={inputStyle({ padding: "4px 6px" })}
              >
                <option value="front_desk">Front Desk</option>
                <option value="aesthetician">Aesthetician</option>
                <option value="manager">Manager</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
              {!e.is_owner && (
                <button
                  disabled={busyId === e.id}
                  onClick={() => update(e.id, { active: !e.active })}
                  style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #ddd", background: "white" }}
                >
                  {e.active ? "Deactivate" : "Reactivate"}
                </button>
              )}
              {isOwner && !e.is_owner && (
                <button
                  disabled={busyId === e.id}
                  onClick={() => update(e.id, { isAdmin: !e.is_admin })}
                  style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #ddd", background: "white" }}
                >
                  {e.is_admin ? "Revoke Admin" : "Make Admin"}
                </button>
              )}
              {e.id !== myEmployeeId && (
                <button
                  onClick={() => {
                    setResetFor(resetFor === e.id ? null : e.id);
                    setResetPin("");
                  }}
                  style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #ddd", background: "white" }}
                >
                  Reset PIN
                </button>
              )}
            </div>

            {resetFor === e.id && (
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="New PIN (4-6 digits)"
                  value={resetPin}
                  onChange={(ev) => setResetPin(ev.target.value.replace(/\D/g, ""))}
                  style={{ ...inputStyle(), flex: 1 }}
                />
                <button className="primary" style={{ padding: "6px 10px" }} disabled={busyId === e.id} onClick={() => submitReset(e.id)}>
                  Save
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------------- Rooms ---------------- */

function RoomsTab({ setError }: { setError: (e: string | null) => void }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/rooms")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setRooms(data.rooms ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addRoom() {
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewName("");
        load();
      } else setError(data.error || "Could not add room.");
    } finally {
      setAdding(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/rooms/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      const data = await res.json();
      if (res.ok) load();
      else setError(data.error || "Could not update room.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p style={{ color: "#6b6b6b", fontSize: 14 }}>Loading…</p>;

  return (
    <>
      <div className="card">
        <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>Add room</p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="Room name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ ...inputStyle(), flex: 1 }}
          />
          <button className="primary" disabled={!newName.trim() || adding} onClick={addRoom}>
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      </div>

      <div className="section-label">Rooms</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rooms.map((r) => (
          <div key={r.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14 }}>
              {r.name}
              {!r.active && <span style={{ fontSize: 11, color: "#b3261e" }}> · Inactive</span>}
            </span>
            <button
              disabled={busyId === r.id}
              onClick={() => toggleActive(r.id, r.active)}
              style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #ddd", background: "white" }}
            >
              {r.active ? "Deactivate" : "Reactivate"}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------------- Checklists ---------------- */

const GROUPS: { role: "front_desk" | "aesthetician"; segment: "open" | "close"; label: string }[] = [
  { role: "front_desk", segment: "open", label: "Front Desk — Open" },
  { role: "front_desk", segment: "close", label: "Front Desk — Close" },
  { role: "aesthetician", segment: "open", label: "Aesthetician — Open" },
  { role: "aesthetician", segment: "close", label: "Aesthetician — Close" },
];

function ChecklistsTab({ setError }: { setError: (e: string | null) => void }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newText, setNewText] = useState<Record<string, string>>({});
  const [newPhoto, setNewPhoto] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/checklist-templates")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setTemplates(data.templates ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(id: string, field: string, value: boolean) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/checklist-templates/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json();
      if (res.ok) load();
      else setError(data.error || "Could not update item.");
    } finally {
      setBusyId(null);
    }
  }

  async function addItem(role: string, segment: string) {
    const key = `${role}:${segment}`;
    const text = newText[key];
    if (!text || !text.trim()) return;
    setAdding(key);
    setError(null);
    try {
      const res = await fetch("/api/admin/checklist-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, segment, itemText: text.trim(), requiresPhoto: !!newPhoto[key] }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewText((s) => ({ ...s, [key]: "" }));
        setNewPhoto((s) => ({ ...s, [key]: false }));
        load();
      } else setError(data.error || "Could not add item.");
    } finally {
      setAdding(null);
    }
  }

  if (loading) return <p style={{ color: "#6b6b6b", fontSize: 14 }}>Loading…</p>;

  return (
    <>
      {GROUPS.map((g) => {
        const key = `${g.role}:${g.segment}`;
        const items = templates.filter((t) => t.role === g.role && t.segment === g.segment);
        return (
          <div key={key} style={{ marginBottom: 16 }}>
            <div className="section-label">{g.label}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map((t) => (
                <div key={t.id} className="card" style={{ opacity: t.active ? 1 : 0.55 }}>
                  <p style={{ margin: 0, fontSize: 13.5 }}>{t.item_text}</p>
                  <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap", fontSize: 11.5, color: "#6b6b6b" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="checkbox"
                        checked={t.requires_photo}
                        disabled={busyId === t.id}
                        onChange={(e) => toggle(t.id, "requiresPhoto", e.target.checked)}
                      />
                      Requires photo
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="checkbox"
                        checked={t.first_shift_only}
                        disabled={busyId === t.id}
                        onChange={(e) => toggle(t.id, "firstShiftOnly", e.target.checked)}
                      />
                      First shift only
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="checkbox"
                        checked={t.last_shift_only}
                        disabled={busyId === t.id}
                        onChange={(e) => toggle(t.id, "lastShiftOnly", e.target.checked)}
                      />
                      Last shift only
                    </label>
                    <button
                      disabled={busyId === t.id}
                      onClick={() => toggle(t.id, "active", !t.active)}
                      style={{ fontSize: 11.5, padding: "2px 6px", borderRadius: 6, border: "1px solid #ddd", background: "white" }}
                    >
                      {t.active ? "Deactivate" : "Reactivate"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <input
                type="text"
                placeholder="New item text"
                value={newText[key] || ""}
                onChange={(e) => setNewText((s) => ({ ...s, [key]: e.target.value }))}
                style={{ ...inputStyle(), flex: 1 }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={!!newPhoto[key]}
                  onChange={(e) => setNewPhoto((s) => ({ ...s, [key]: e.target.checked }))}
                />
                Photo
              </label>
              <button
                className="primary"
                style={{ padding: "6px 10px" }}
                disabled={!newText[key]?.trim() || adding === key}
                onClick={() => addItem(g.role, g.segment)}
              >
                Add
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ---------------- Par Levels ---------------- */

function ParLevelsTab({ setError }: { setError: (e: string | null) => void }) {
  const [items, setItems] = useState<BackbarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { par: string; qty: string }>>({});

  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newPar, setNewPar] = useState("");
  const [newQty, setNewQty] = useState("");
  const [adding, setAdding] = useState(false);

  function load() {
    fetch("/api/admin/backbar-items")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setItems(data.items ?? []);
          const e: Record<string, { par: string; qty: string }> = {};
          (data.items ?? []).forEach((it: BackbarItem) => {
            e[it.id] = { par: String(it.par_level), qty: String(it.current_quantity) };
          });
          setEdits(e);
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addItem() {
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/backbar-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), unit: newUnit, parLevel: newPar, currentQuantity: newQty }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewName("");
        setNewUnit("");
        setNewPar("");
        setNewQty("");
        load();
      } else setError(data.error || "Could not add item.");
    } finally {
      setAdding(false);
    }
  }

  async function save(id: string) {
    const e = edits[id];
    if (!e) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/backbar-items/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parLevel: e.par, currentQuantity: e.qty }),
      });
      const data = await res.json();
      if (res.ok) load();
      else setError(data.error || "Could not save.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/backbar-items/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      const data = await res.json();
      if (res.ok) load();
      else setError(data.error || "Could not update item.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p style={{ color: "#6b6b6b", fontSize: 14 }}>Loading…</p>;

  return (
    <>
      <div className="card">
        <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>Add backbar item</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="text" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ ...inputStyle(), flex: 2, minWidth: 100 }} />
          <input type="text" placeholder="Unit (e.g. bottle)" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} style={{ ...inputStyle(), flex: 1, minWidth: 90 }} />
          <input type="number" placeholder="Par level" value={newPar} onChange={(e) => setNewPar(e.target.value)} style={{ ...inputStyle(), width: 90 }} />
          <input type="number" placeholder="Current qty" value={newQty} onChange={(e) => setNewQty(e.target.value)} style={{ ...inputStyle(), width: 90 }} />
          <button className="primary" disabled={!newName.trim() || adding} onClick={addItem}>
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      </div>

      <div className="section-label">Backbar items &amp; par levels</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((it) => (
          <div key={it.id} className="card" style={{ opacity: it.active ? 1 : 0.55 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                {it.name}
                {it.unit ? ` (${it.unit})` : ""}
                {!it.active && <span style={{ fontSize: 11, color: "#b3261e", fontWeight: 400 }}> · Inactive</span>}
              </span>
              <button
                disabled={busyId === it.id}
                onClick={() => toggleActive(it.id, it.active)}
                style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #ddd", background: "white" }}
              >
                {it.active ? "Deactivate" : "Reactivate"}
              </button>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
              <label style={{ fontSize: 12, color: "#6b6b6b" }}>Par</label>
              <input
                type="number"
                value={edits[it.id]?.par ?? ""}
                onChange={(e) => setEdits((s) => ({ ...s, [it.id]: { ...s[it.id], par: e.target.value } }))}
                style={{ ...inputStyle(), width: 70 }}
              />
              <label style={{ fontSize: 12, color: "#6b6b6b" }}>Current</label>
              <input
                type="number"
                value={edits[it.id]?.qty ?? ""}
                onChange={(e) => setEdits((s) => ({ ...s, [it.id]: { ...s[it.id], qty: e.target.value } }))}
                style={{ ...inputStyle(), width: 70 }}
              />
              <button className="primary" style={{ padding: "6px 10px" }} disabled={busyId === it.id} onClick={() => save(it.id)}>
                Save
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
