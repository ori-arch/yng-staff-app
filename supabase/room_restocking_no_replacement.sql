-- ========== Room Restocking: "no replacement on hand" (2026-09-04) ==========
--
-- When an aesthetician pulls the last of an item and there's nothing to
-- replace it with, this flags the entry as an order request instead of a
-- normal restock log -- the replacement-item photo becomes optional and
-- managers get notified directly to reorder it.

alter table room_restocking_logs add column no_replacement boolean not null default false;
