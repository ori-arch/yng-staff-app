-- Daily Task Checklist templates — run after schema.sql.
-- NOTE: item wording here was reconstructed from the project spec's summarized
-- task-list bullets, not retyped from Ori's original verbatim document. If exact
-- phrasing matters for the audit trail, replace these with the verbatim text.

-- Front Desk — Open
insert into checklist_templates (role, segment, item_order, item_text, requires_photo, first_shift_only, last_shift_only) values
  ('front_desk', 'open', 1, 'Turn on and set up front desk devices', false, false, false),
  ('front_desk', 'open', 2, 'Clock in via BLVD', false, false, false),
  ('front_desk', 'open', 3, 'Turn on lights, AC, and candles', false, false, false),
  ('front_desk', 'open', 4, 'Sweep and dust the front area', false, false, false),
  ('front_desk', 'open', 5, 'Count the cash drawer', false, false, false),
  ('front_desk', 'open', 6, 'Check and set up signage', false, false, false),
  ('front_desk', 'open', 7, 'Review appointments, voicemails, and DMs', false, false, false);

-- Front Desk — Close
insert into checklist_templates (role, segment, item_order, item_text, requires_photo, first_shift_only, last_shift_only) values
  ('front_desk', 'close', 1, 'Check for any unanswered calls, texts, or DMs', false, false, false),
  ('front_desk', 'close', 2, 'Restock the mini fridge', false, false, false),
  ('front_desk', 'close', 3, 'Clean the front desk area', false, false, false),
  ('front_desk', 'close', 4, 'Restock candy, soap, paper towels, and toilet paper', false, false, false),
  ('front_desk', 'close', 5, 'Turn off music', false, false, false),
  ('front_desk', 'close', 6, 'Turn off signage', false, false, false),
  ('front_desk', 'close', 7, 'Turn off lights and AC', false, false, false),
  ('front_desk', 'close', 8, 'Walk through treatment rooms and note anything that needs attention', true, false, false),
  ('front_desk', 'close', 9, 'Count the cash drawer and lock up', false, false, false),
  ('front_desk', 'close', 10, 'Put devices on the charger and reset the front desk', false, false, false);

-- Aesthetician — Open
insert into checklist_templates (role, segment, item_order, item_text, requires_photo, first_shift_only, last_shift_only) values
  ('aesthetician', 'open', 1, 'Clock in', false, false, false),
  ('aesthetician', 'open', 2, 'Turn on the towel warmer and bed warmer', false, false, false),
  ('aesthetician', 'open', 3, 'Prep towels for the day', false, false, false),
  ('aesthetician', 'open', 4, 'Light candles', false, false, false),
  ('aesthetician', 'open', 5, 'Pick up device from the charging station', false, true, false),
  ('aesthetician', 'open', 6, 'Turn on crystal lights', false, false, false),
  ('aesthetician', 'open', 7, 'Prep devices for the day''s appointments', false, false, false),
  ('aesthetician', 'open', 8, 'Set out a fresh analysis pad', false, false, false),
  ('aesthetician', 'open', 9, 'Set out clean robes', false, false, false);

-- Aesthetician — Close
insert into checklist_templates (role, segment, item_order, item_text, requires_photo, first_shift_only, last_shift_only) values
  ('aesthetician', 'close', 1, 'Start a load of laundry', false, false, false),
  ('aesthetician', 'close', 2, 'Restock towels and headbands', false, false, false),
  ('aesthetician', 'close', 3, 'Clean utensils and load sterilization pouches', false, false, false),
  ('aesthetician', 'close', 4, 'Reset robes', false, false, false),
  ('aesthetician', 'close', 5, 'Flip the room for the next shift', true, false, false),
  ('aesthetician', 'close', 6, 'Put device on the charger', false, false, false),
  ('aesthetician', 'close', 7, 'Run UV sterilization', false, false, true),
  ('aesthetician', 'close', 8, 'Take out the trash', false, false, false),
  ('aesthetician', 'close', 9, 'Restock cabinet: alcohol, distilled water, witch hazel', false, false, false),
  ('aesthetician', 'close', 10, 'Restock cabinet: hyaluronic acid, salicylic acid', false, false, false),
  ('aesthetician', 'close', 11, 'Restock cabinet: 4x4s, 2x2s, cotton balls', false, false, false),
  ('aesthetician', 'close', 12, 'Restock cabinet: dermaplaning blades, lancets', false, false, false),
  ('aesthetician', 'close', 13, 'Restock cabinet: microdermabrasion filters, facial sponges', false, false, false),
  ('aesthetician', 'close', 14, 'Restock cabinet: lip applicators, spoolies', false, false, false);
