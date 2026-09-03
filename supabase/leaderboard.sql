-- ========== Sales Leaderboard module ==========
--
-- See the "YNG Staff App — Sales Leaderboard module (spec)" project doc for
-- the full design. Standings are always computed from these rows (sum of
-- active leaderboard_entries.points_awarded + leaderboard_adjustments.points
-- for an employee/cycle) -- never stored as a running total, same principle
-- as the time-off balance ledger.

create table leaderboard_cycles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  prize_description text,
  status text not null default 'open' check (status in ('open', 'pending_confirmation', 'closed')),
  winner_employee_id uuid references employees(id),
  winner_override_reason text,
  confirmed_by uuid references employees(id),
  confirmed_at timestamptz,
  announced_at timestamptz,
  created_by uuid references employees(id),
  created_at timestamptz not null default now()
);

-- Only one open (or pending_confirmation) cycle at a time -- enforced here,
-- not just in the app, so a race between two managers can't create two.
create unique index leaderboard_one_active_cycle
  on leaderboard_cycles ((true))
  where status in ('open', 'pending_confirmation');

create table leaderboard_categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  points integer not null,
  display_order integer not null default 0,
  active boolean not null default true
);

insert into leaderboard_categories (key, label, points, display_order) values
  ('package', 'Package Sold', 50, 1),
  ('addon', 'Add-On Attached', 40, 2),
  ('new_client', 'New Client Brought In', 30, 3),
  ('membership', 'New Membership Sold', 20, 4),
  ('google_review', 'Google Review Received', 5, 5);

create table leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  category_id uuid not null references leaderboard_categories(id),
  points_awarded integer not null, -- snapshotted at log time, not re-derived from the category
  cycle_id uuid not null references leaderboard_cycles(id),
  logged_at timestamptz not null default now(),
  active boolean not null default true,
  created_by uuid references employees(id), -- null when self-logged; set when a manager logs it on someone's behalf
  edited_by uuid references employees(id),
  edited_at timestamptz,
  note text
);

create index leaderboard_entries_cycle_idx on leaderboard_entries (cycle_id, employee_id);

create table leaderboard_adjustments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  cycle_id uuid not null references leaderboard_cycles(id),
  points integer not null, -- positive or negative
  note text not null,
  adjusted_by uuid references employees(id),
  created_at timestamptz not null default now()
);

create index leaderboard_adjustments_cycle_idx on leaderboard_adjustments (cycle_id, employee_id);

-- The T-minus-1-day manager reminder and the winner-confirmation flow are
-- "something needs your attention" alerts, same bucket as a pending time
-- off request or shift swap -- reuse that type rather than adding a new one.
