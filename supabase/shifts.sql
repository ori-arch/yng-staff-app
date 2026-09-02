-- ========== Shift Scheduling (added 2026-09-02) ==========
--
-- Ori's shifts are mostly recurring (e.g. "Bree works Tue/Thu/Sat, 9am-5pm").
-- shift_patterns holds the recurring weekly rule; shift_exceptions holds
-- one-off changes layered on top for a specific date (an extra shift, a
-- skipped/cancelled occurrence, or a modified start/end time) — e.g. a
-- holiday closure, someone covering an extra day, or an accepted Shift Swap
-- being reflected on the schedule. See lib/schedule.ts for how the two are
-- combined into the actual calendar of who's working when.
--
-- This is independent of Zenoti's own scheduling (no API integration, to
-- avoid API costs) — it's a second, in-app record Ori is choosing to keep
-- because most shifts are recurring and this way the schedule can show up
-- alongside the app's other data (time off, warnings, etc.) for both
-- employees and managers.

create table shift_patterns (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday .. 6 = Saturday
  start_time time not null,
  end_time time not null,
  note text,
  active boolean not null default true,
  created_by uuid references employees(id),
  created_at timestamptz not null default now()
);

create table shift_exceptions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  date date not null,
  action text not null check (action in ('add', 'skip', 'modify')),
  start_time time, -- required for add/modify
  end_time time,   -- required for add/modify
  note text,
  active boolean not null default true,
  created_by uuid references employees(id),
  created_at timestamptz not null default now()
);

create index shift_patterns_employee_idx on shift_patterns(employee_id);
create index shift_exceptions_employee_date_idx on shift_exceptions(employee_id, date);

-- Same RLS note as the rest of the schema: authorization is enforced in
-- application code via the service_role key, RLS is left disabled.
