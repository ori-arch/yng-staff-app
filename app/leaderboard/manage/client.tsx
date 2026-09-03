"use client";

import { useEffect, useState } from "react";

type Employee = { id: string; name: string; role: string; active: boolean };
type Category = { id: string; key: string; label: string; description: string | null; points: number; displayOrder: number; active: boolean };
type Cycle = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  prizeDescription: string | null;
  status: "open" | "pending_confirmation" | "closed";
  winnerName: string | null;
  announcedAt: string | null;
};
type Entry = {
  id: string;
  employeeId: string;
  employeeName: string;
  categoryId: string;
  categoryLabel: string;
  points: number;
  loggedAt: string;
  active: boolean;
  note: string | null;
  loggedByManager: boolean;
  creatorName: string | null;
  editedByName: string | null;
};
type Adjustment = { id: string; employeeId: string; employeeName: string; points: number; note: string; createdAt: string };

const TABS = [
  { key: "cycles", label: "Cycles" },
  { key: "categories", label: "Categories" },
  { key: "entries", label: "Entries" },
  { key: "adjustments", label: "Adjustments" },
  { key: "export", label: "Export" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function inputStyle(extra?: object) {
  return { padding: "11px 12px", borderRadius: 8, border: "1px solid var(--border-strong)", fontSize: 14.5, ...extra };
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function LeaderboardManage() {
  const [tab, setTab] = useState<TabKey>("cycles");
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  function loadCycles() {
    fetch("/api/leaderboard/cycles")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setCycles(d.cycles ?? [])));
  }
  function loadCategories() {
    fetch("/api/leaderboard/categories")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setCategories(d.categories ?? [])));
  }

  useEffect(() => {
    fetch("/api/admin/employees")
      .then((r) => r.json())
      .then((d) => setEmployees((d.employees ?? []).filter((e: Employee) => e.active && (e.role === "front_desk" || e.role === "aesthetician"))));
    loadCycles();
    loadCategories();
  }, []);

  const activeCycle = cycles.find((c) => c.status === "open" || c.status === "pending_confirmation") ?? null;

  return (
    <div className="container">
      <h1 className="page-title">Leaderboard — Manage</h1>
      <p className="page-sub">Cycles, point values, individual entries, and manual adjustments.</p>

      {error && <p className="error-text">{error}</p>}

      <div className="tabs" style={{ marginBottom: 14 }}>
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "cycles" && <CyclesTab cycles={cycles} activeCycle={activeCycle} reload={loadCycles} setError={setError} />}
      {tab === "categories" && <CategoriesTab categories={categories} reload={loadCategories} setError={setError} />}
      {tab === "entries" && <EntriesTab cycles={cycles} activeCycle={activeCycle} employees={employees} categories={categories} setError={setError} />}
      {tab === "adjustments" && <AdjustmentsTab cycles={cycles} activeCycle={activeCycle} employees={employees} setError={setError} />}
      {tab === "export" && <ExportTab cycles={cycles} />}
    </div>
  );
}

function CyclesTab({
  cycles,
  activeCycle,
  reload,
  setError,
}: {
  cycles: Cycle[];
  activeCycle: Cycle | null;
  reload: () => void;
  setError: (e: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [prize, setPrize] = useState("");
  const [saving, setSaving] = useState(false);

  const [editPrize, setEditPrize] = useState("");
  useEffect(() => {
    setEditPrize(activeCycle?.prizeDescription ?? "");
  }, [activeCycle?.id]);

  async function createCycle() {
    if (!name.trim() || !startDate || !endDate) {
      setError("Name, start date and end date are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/leaderboard/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), startDate, endDate, prizeDescription: prize.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setName("");
      setStartDate("");
      setEndDate("");
      setPrize("");
      reload();
    } finally {
      setSaving(false);
    }
  }

  async function savePrize() {
    if (!activeCycle) return;
    const res = await fetch(`/api/leaderboard/cycles/${activeCycle.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prizeDescription: editPrize.trim() || null }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else reload();
  }

  async function closeEarly() {
    if (!activeCycle || activeCycle.status !== "open") return;
    if (!confirm(`Move "${activeCycle.name}" to review now, before its scheduled end date?`)) return;
    const res = await fetch(`/api/leaderboard/cycles/${activeCycle.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close_early" }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else reload();
  }

  return (
    <div>
      {activeCycle ? (
        <div className="card gold" style={{ padding: 14, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{activeCycle.name}</div>
          <div style={{ fontSize: 13, color: "var(--muted)", margin: "2px 0 10px" }}>
            {activeCycle.startDate} – {activeCycle.endDate} ·{" "}
            {activeCycle.status === "open" ? "Open" : "Pending confirmation"}
          </div>
          <label style={{ fontSize: 12.5, color: "var(--muted)" }}>Prize</label>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <input style={{ ...inputStyle(), flex: 1 }} value={editPrize} onChange={(e) => setEditPrize(e.target.value)} />
            <button className="btn outline sm" onClick={savePrize}>
              Save
            </button>
          </div>
          {activeCycle.status === "open" && (
            <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={closeEarly}>
              Close early &amp; move to review
            </button>
          )}
          {activeCycle.status === "pending_confirmation" && (
            <a className="btn gold sm" style={{ marginTop: 10, display: "inline-block" }} href={`/leaderboard/review/${activeCycle.id}`}>
              Review &amp; confirm winner
            </a>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 14, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 10 }}>Start a new cycle</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input style={inputStyle()} placeholder="Cycle name (e.g. Q4 2026)" value={name} onChange={(e) => setName(e.target.value)} />
            <div style={{ display: "flex", gap: 8 }}>
              <input type="date" style={{ ...inputStyle(), flex: 1 }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <input type="date" style={{ ...inputStyle(), flex: 1 }} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <input style={inputStyle()} placeholder="Prize (e.g. Free HydraFacial)" value={prize} onChange={(e) => setPrize(e.target.value)} />
            <button className="btn gold" disabled={saving} onClick={createCycle}>
              {saving ? "Creating…" : "Start Cycle"}
            </button>
          </div>
        </div>
      )}

      <div className="section-label">History</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {cycles
          .filter((c) => c.status === "closed")
          .map((c) => (
            <div key={c.id} className="card" style={{ padding: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {c.startDate} – {c.endDate} · Winner: {c.winnerName ?? "—"}
              </div>
            </div>
          ))}
        {cycles.filter((c) => c.status === "closed").length === 0 && <p className="empty">No closed cycles yet.</p>}
      </div>
    </div>
  );
}

function CategoriesTab({
  categories,
  reload,
  setError,
}: {
  categories: Category[];
  reload: () => void;
  setError: (e: string | null) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPoints, setEditPoints] = useState("");

  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPoints, setNewPoints] = useState("");

  function startEdit(c: Category) {
    setEditingId(c.id);
    setEditLabel(c.label);
    setEditDescription(c.description ?? "");
    setEditPoints(String(c.points));
  }

  async function saveEdit(id: string) {
    const points = Number(editPoints);
    if (!editLabel.trim() || !Number.isFinite(points)) {
      setError("Label and a numeric point value are required.");
      return;
    }
    const res = await fetch(`/api/leaderboard/categories/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: editLabel.trim(), description: editDescription.trim(), points }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else {
      setEditingId(null);
      reload();
    }
  }

  async function toggleActive(c: Category) {
    const res = await fetch(`/api/leaderboard/categories/${c.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else reload();
  }

  async function addCategory() {
    const points = Number(newPoints);
    if (!newKey.trim() || !newLabel.trim() || !Number.isFinite(points)) {
      setError("Key, label and a numeric point value are required.");
      return;
    }
    const res = await fetch("/api/leaderboard/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: newKey.trim(),
        label: newLabel.trim(),
        description: newDescription.trim(),
        points,
        displayOrder: categories.length + 1,
      }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else {
      setNewKey("");
      setNewLabel("");
      setNewDescription("");
      setNewPoints("");
      reload();
    }
  }

  return (
    <div>
      <p className="page-sub" style={{ marginTop: 0 }}>
        Point values apply going forward only — entries already logged keep the value they were logged at.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {categories.map((c) => (
          <div key={c.id} className="card" style={{ padding: 10, opacity: c.active ? 1 : 0.55 }}>
            {editingId === c.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input style={{ ...inputStyle(), flex: 1 }} value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                  <input
                    style={{ ...inputStyle(), width: 70 }}
                    type="number"
                    value={editPoints}
                    onChange={(e) => setEditPoints(e.target.value)}
                  />
                </div>
                <input
                  style={inputStyle()}
                  placeholder="What qualifies for this (shown to staff)"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn outline sm" onClick={() => saveEdit(c.id)}>
                    Save
                  </button>
                  <button className="btn ghost sm" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13.5 }}>
                    {c.label} <span style={{ color: "var(--muted)" }}>({c.key})</span>
                  </div>
                  {c.description && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{c.description}</div>}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{c.points} pts</span>
                  <button className="btn ghost sm" onClick={() => startEdit(c)}>
                    Edit
                  </button>
                  <button className="btn ghost sm" onClick={() => toggleActive(c)}>
                    {c.active ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="section-label">Add a category</div>
      <div className="card" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <input style={inputStyle()} placeholder="Key (e.g. retail_sale)" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
        <input style={inputStyle()} placeholder="Label shown to staff" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
        <input
          style={inputStyle()}
          placeholder="What qualifies for this (shown to staff)"
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
        />
        <input style={inputStyle()} type="number" placeholder="Points" value={newPoints} onChange={(e) => setNewPoints(e.target.value)} />
        <button className="btn outline" onClick={addCategory}>
          Add Category
        </button>
      </div>
    </div>
  );
}

function CycleSelect({
  cycles,
  activeCycle,
  value,
  onChange,
}: {
  cycles: Cycle[];
  activeCycle: Cycle | null;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <select style={inputStyle({ marginBottom: 12, width: "100%" })} value={value} onChange={(e) => onChange(e.target.value)}>
      {activeCycle && <option value={activeCycle.id}>{activeCycle.name} (current)</option>}
      {cycles
        .filter((c) => c.status === "closed")
        .map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
    </select>
  );
}

function EntriesTab({
  cycles,
  activeCycle,
  employees,
  categories,
  setError,
}: {
  cycles: Cycle[];
  activeCycle: Cycle | null;
  employees: Employee[];
  categories: Category[];
  setError: (e: string | null) => void;
}) {
  const [cycleId, setCycleId] = useState(activeCycle?.id ?? cycles[0]?.id ?? "");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategoryKey, setEditCategoryKey] = useState("");
  const [editPoints, setEditPoints] = useState("");

  const [newEmployeeId, setNewEmployeeId] = useState("");
  const [newCategoryKey, setNewCategoryKey] = useState("");
  const [newNote, setNewNote] = useState("");

  useEffect(() => {
    if (activeCycle) setCycleId(activeCycle.id);
    else if (cycles.length > 0) setCycleId(cycles[0].id);
  }, [activeCycle?.id, cycles.length]);

  function load() {
    if (!cycleId) return;
    fetch(`/api/leaderboard/entries?cycleId=${cycleId}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setEntries(d.entries ?? [])));
  }

  useEffect(load, [cycleId]);

  async function toggleVoid(e: Entry) {
    const res = await fetch(`/api/leaderboard/entries/${e.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: e.active ? "void" : "restore" }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else load();
  }

  function startEdit(e: Entry) {
    setEditingId(e.id);
    setEditCategoryKey(categories.find((c) => c.label === e.categoryLabel)?.key ?? "");
    setEditPoints(String(e.points));
  }

  async function saveEdit(id: string) {
    const points = Number(editPoints);
    const res = await fetch(`/api/leaderboard/entries/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", categoryKey: editCategoryKey || undefined, points: Number.isFinite(points) ? points : undefined }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else {
      setEditingId(null);
      load();
    }
  }

  async function addOnBehalf() {
    if (!newEmployeeId || !newCategoryKey || !cycleId) {
      setError("Pick an employee and a category.");
      return;
    }
    const res = await fetch("/api/leaderboard/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: newEmployeeId, categoryKey: newCategoryKey, cycleId, note: newNote.trim() || null }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else {
      setNewNote("");
      load();
    }
  }

  return (
    <div>
      <CycleSelect cycles={cycles} activeCycle={activeCycle} value={cycleId} onChange={setCycleId} />

      <div className="card" style={{ padding: 12, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8 }}>Log an entry on someone's behalf</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <select style={inputStyle()} value={newEmployeeId} onChange={(e) => setNewEmployeeId(e.target.value)}>
            <option value="">Employee…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <select style={inputStyle()} value={newCategoryKey} onChange={(e) => setNewCategoryKey(e.target.value)}>
            <option value="">Category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.key}>
                {c.label} (+{c.points})
              </option>
            ))}
          </select>
          <input style={inputStyle()} placeholder="Note (optional)" value={newNote} onChange={(e) => setNewNote(e.target.value)} />
          <button className="btn outline" onClick={addOnBehalf}>
            Add Entry
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {entries.map((e) => (
          <div key={e.id} className="card" style={{ padding: 10, opacity: e.active ? 1 : 0.5 }}>
            {editingId === e.id ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <select style={inputStyle()} value={editCategoryKey} onChange={(ev) => setEditCategoryKey(ev.target.value)}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input style={{ ...inputStyle(), width: 70 }} type="number" value={editPoints} onChange={(ev) => setEditPoints(ev.target.value)} />
                <button className="btn outline sm" onClick={() => saveEdit(e.id)}>
                  Save
                </button>
                <button className="btn ghost sm" onClick={() => setEditingId(null)}>
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                    {e.employeeName} — {e.categoryLabel} <span style={{ color: "var(--muted)", fontWeight: 400 }}>+{e.points}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                    {fmt(e.loggedAt)}
                    {e.loggedByManager && e.creatorName ? ` · logged by ${e.creatorName}` : ""}
                    {!e.active ? " · voided" : ""}
                    {e.editedByName ? ` · edited by ${e.editedByName}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn ghost sm" onClick={() => startEdit(e)}>
                    Edit
                  </button>
                  <button className="btn ghost sm" onClick={() => toggleVoid(e)}>
                    {e.active ? "Void" : "Restore"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {entries.length === 0 && <p className="empty">No entries for this cycle yet.</p>}
      </div>
    </div>
  );
}

function AdjustmentsTab({
  cycles,
  activeCycle,
  employees,
  setError,
}: {
  cycles: Cycle[];
  activeCycle: Cycle | null;
  employees: Employee[];
  setError: (e: string | null) => void;
}) {
  const [cycleId, setCycleId] = useState(activeCycle?.id ?? cycles[0]?.id ?? "");
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (activeCycle) setCycleId(activeCycle.id);
    else if (cycles.length > 0) setCycleId(cycles[0].id);
  }, [activeCycle?.id, cycles.length]);

  function load() {
    if (!cycleId) return;
    fetch(`/api/leaderboard/adjustments?cycleId=${cycleId}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setAdjustments(d.adjustments ?? [])));
  }
  useEffect(load, [cycleId]);

  async function add() {
    const pointsNum = Number(points);
    if (!employeeId || !Number.isFinite(pointsNum) || !note.trim()) {
      setError("Employee, a numeric point value, and a note are all required.");
      return;
    }
    const res = await fetch("/api/leaderboard/adjustments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, cycleId, points: pointsNum, note: note.trim() }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else {
      setPoints("");
      setNote("");
      load();
    }
  }

  return (
    <div>
      <CycleSelect cycles={cycles} activeCycle={activeCycle} value={cycleId} onChange={setCycleId} />

      <div className="card" style={{ padding: 12, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8 }}>Add a manual adjustment</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <select style={inputStyle()} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Employee…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <input style={inputStyle()} type="number" placeholder="Points (+ or -)" value={points} onChange={(e) => setPoints(e.target.value)} />
          <input style={inputStyle()} placeholder="Reason (required)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn outline" onClick={add}>
            Add Adjustment
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {adjustments.map((a) => (
          <div key={a.id} className="card" style={{ padding: 10 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>
              {a.employeeName} <span style={{ color: a.points >= 0 ? "var(--success, green)" : "var(--danger)" }}>{a.points >= 0 ? "+" : ""}{a.points}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {a.note} · {fmt(a.createdAt)}
            </div>
          </div>
        ))}
        {adjustments.length === 0 && <p className="empty">No adjustments for this cycle.</p>}
      </div>
    </div>
  );
}

function ExportTab({ cycles }: { cycles: Cycle[] }) {
  const [cycleId, setCycleId] = useState(cycles[0]?.id ?? "");

  useEffect(() => {
    if (!cycleId && cycles.length > 0) setCycleId(cycles[0].id);
  }, [cycles.length]);

  return (
    <div>
      <p className="page-sub" style={{ marginTop: 0 }}>
        For matching logged entries against Zenoti — same key on both sides: employee, date, category.
      </p>
      <select style={inputStyle({ marginBottom: 12, width: "100%" })} value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
        {cycles.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} {c.status !== "closed" ? "(current)" : ""}
          </option>
        ))}
      </select>
      {cycleId && (
        <div style={{ display: "flex", gap: 8 }}>
          <a className="btn outline" href={`/api/leaderboard/export?cycleId=${cycleId}&format=detail`}>
            Download detail CSV
          </a>
          <a className="btn outline" href={`/api/leaderboard/export?cycleId=${cycleId}&format=summary`}>
            Download summary CSV
          </a>
        </div>
      )}
    </div>
  );
}
