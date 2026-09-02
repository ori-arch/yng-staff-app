-- ========== Broadcast Templates (added 2026-09-02) ==========
--
-- Pre-written announcement templates a manager can tap on the new
-- Send a Broadcast screen (/broadcast) instead of typing from scratch each
-- time — editable in Admin Panel -> Broadcast Templates. Separate from the
-- Messages screen, which is now DMs + read-only All Staff history.
create table broadcast_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  active boolean not null default true,
  created_by uuid references employees(id),
  created_at timestamptz not null default now()
);

create index broadcast_templates_active_idx on broadcast_templates(active);

-- A handful of starter templates — edit/replace/add more anytime in
-- Admin Panel -> Broadcast Templates. These are just a starting point.
insert into broadcast_templates (title, body) values
  ('Staff Meeting Reminder', 'Reminder: we have a staff meeting today. Please make sure you attend — see me if you have a scheduling conflict.'),
  ('Early Closure / Schedule Change', 'Heads up — we''re closing early today. Please plan accordingly and let me know if this affects your shift.'),
  ('Supply / Restock Reminder', 'Please double check your stations and rooms for anything running low and log it in Restock Runner or Room Restocking today.'),
  ('General Announcement', '');

-- Same RLS note as the rest of the schema: authorization is enforced in
-- application code via the service_role key, RLS is left disabled.
