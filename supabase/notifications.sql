-- ========== Notifications + Web Push (added 2026-09-02) ==========
--
-- Persisted, per-employee notification feed backing the bell icon in the
-- header: new messages, new broadcasts, and (computed at read-time, not
-- stored here) past-due checklist tasks. Rows are never deleted when read —
-- read_at is just set — so a notification stays visible in history the way
-- Ori asked ("read notifications will remain visible even after opened").
create table notifications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  type text not null check (type in ('message', 'broadcast', 'task_due')),
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_employee_idx on notifications(employee_id, created_at desc);
create index notifications_employee_unread_idx on notifications(employee_id) where read_at is null;

-- push_subscriptions already exists in the base schema (schema.sql) — it was
-- scaffolded ahead of time for this feature and was never populated. No
-- change needed there; lib/push.ts reads/writes it as-is.

-- Same RLS note as the rest of the schema: authorization is enforced in
-- application code via the service_role key, RLS is left disabled.
