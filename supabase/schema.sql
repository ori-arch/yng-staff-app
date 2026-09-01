-- YNG Aesthetics Lounge Staff App — initial database schema
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query > paste > Run)

create extension if not exists "pgcrypto";

-- ========== Core ==========

create table employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin_hash text, -- null until an admin sets a PIN for this employee via the admin panel
  role text not null check (role in ('front_desk', 'aesthetician')),
  is_admin boolean not null default false,
  is_owner boolean not null default false,
  active boolean not null default true,
  time_off_balance_hours numeric not null default 0,
  created_at timestamptz not null default now()
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ========== Daily Task Checklists ==========

create table checklist_templates (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('front_desk', 'aesthetician')),
  segment text not null check (segment in ('open', 'close')),
  item_order int not null,
  item_text text not null,
  requires_photo boolean not null default false,
  first_shift_only boolean not null default false,
  last_shift_only boolean not null default false,
  active boolean not null default true
);

create table checklist_submissions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  role text not null,
  segment text not null,
  submission_date date not null default current_date,
  completed_at timestamptz,
  pin_signature_confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

create table checklist_submission_items (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references checklist_submissions(id) on delete cascade,
  template_id uuid not null references checklist_templates(id),
  completed boolean not null default false,
  photo_url text,
  completed_at timestamptz
);

-- ========== Equipment Log ==========

create table equipment_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  equipment_type text not null,
  client_name text,
  used_at timestamptz not null default now(),
  received_operational boolean,
  cleaned_properly boolean,
  photo_url text,
  remarks text,
  created_at timestamptz not null default now()
);

-- ========== Inventory / Facilities ==========

create table backbar_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text,
  par_level numeric not null default 0,
  current_quantity numeric not null default 0,
  active boolean not null default true
);

create table restock_runner_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  log_date date not null default current_date,
  checklist_json jsonb not null default '{}'::jsonb,
  low_inventory_items text[] default '{}',
  created_at timestamptz not null default now()
);

create table loft_cleaning_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  log_date date not null default current_date,
  checklist_json jsonb not null default '{}'::jsonb,
  low_on_clean_linens boolean,
  last_shift_loft_duty boolean,
  fridge_items_over_week_old boolean,
  fridge_items_unlabeled boolean,
  remarks text,
  created_at timestamptz not null default now()
);

create table room_restocking_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  item_type text,
  specific_item text not null,
  room_ran_out_id uuid references rooms(id),
  room_restocked_id uuid references rooms(id),
  remaining_quantity text,
  sharpie_room_confirmed boolean not null default false,
  sharpie_date_confirmed boolean not null default false,
  sharpie_initials_confirmed boolean not null default false,
  empty_bottle_photo_url text,
  new_item_photo_url text,
  created_at timestamptz not null default now()
);

-- ========== Protocols ==========

create table protocols (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  file_url text,
  body_text text,
  uploaded_by uuid references employees(id),
  version int not null default 1,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- ========== Messaging ==========

create table channels (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('broadcast', 'dm')),
  name text,
  created_at timestamptz not null default now()
);

create table channel_members (
  channel_id uuid not null references channels(id) on delete cascade,
  employee_id uuid not null references employees(id),
  primary key (channel_id, employee_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  sender_id uuid references employees(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  related_table text,
  related_id uuid,
  message text not null,
  created_at timestamptz not null default now()
);

create table alert_acknowledgements (
  alert_id uuid not null references alerts(id) on delete cascade,
  employee_id uuid not null references employees(id),
  acknowledged_at timestamptz not null default now(),
  primary key (alert_id, employee_id)
);

-- ========== Compliance / Warning Notices ==========

create table warning_notices (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  violation_date date not null default current_date,
  violation_description text not null default 'Failure to Complete or Report Daily Responsibilities - Shift Tasks',
  source_table text,
  source_id uuid,
  quarter_label text not null, -- e.g. '2026-Q3', computed at issuance
  status text not null default 'issued' check (status in ('issued', 'acknowledged')),
  employee_comments text,
  acknowledged_at timestamptz,
  issued_by uuid references employees(id),
  created_at timestamptz not null default now()
);

-- ========== Time Off ==========

create table time_off_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  start_date date not null,
  end_date date not null,
  hours_requested numeric not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  approved_by uuid references employees(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table time_off_balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  adjustment_hours numeric not null, -- positive or negative
  note text,
  adjusted_by uuid references employees(id),
  created_at timestamptz not null default now()
);

-- ========== Shift Swaps ==========

create table shift_swap_requests (
  id uuid primary key default gen_random_uuid(),
  requesting_employee_id uuid not null references employees(id),
  target_employee_id uuid not null references employees(id),
  shift_description text not null,
  status text not null default 'pending_coworker' check (
    status in ('pending_coworker', 'pending_owner', 'approved', 'denied')
  ),
  coworker_responded_at timestamptz,
  owner_decided_at timestamptz,
  decided_by uuid references employees(id),
  created_at timestamptz not null default now()
);

-- ========== Push notification subscriptions ==========

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- Note: this app's server-side API routes use the Supabase service_role key exclusively —
-- all authorization (PIN login, admin checks, owner-only actions) is enforced in application
-- code, not via Postgres Row Level Security. Row Level Security is left disabled on these
-- tables since the anon key is never used for direct table access from the browser.
