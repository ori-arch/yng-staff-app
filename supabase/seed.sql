-- Seed data — run this after schema.sql
-- Employees are created with no PIN set yet (pin_hash is null). Ori signs in once as
-- owner via the one-time setup flow (see README "First-time setup"), which sets her own
-- PIN and unlocks the admin panel to set PINs for everyone else.

insert into rooms (name) values ('Room 1'), ('Room 2');

insert into employees (name, role, is_admin, is_owner) values
  ('Ori', 'manager', true, true),
  ('Amy', 'manager', false, false),
  ('Bree', 'aesthetician', false, false),
  ('Lexi', 'aesthetician', false, false),
  ('Megan', 'aesthetician', false, false),
  ('Nielie', 'aesthetician', false, false);
-- No front_desk employees yet as of 2026-09-01 — role stays supported for when one is hired.
