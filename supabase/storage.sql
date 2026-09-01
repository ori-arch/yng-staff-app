-- Storage buckets — run after schema.sql. Both are public (photo URLs are
-- shared inline in checklist/equipment log views); nothing sensitive is stored
-- in them, just operational photos.

insert into storage.buckets (id, name, public)
values ('checklist-photos', 'checklist-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('equipment-photos', 'equipment-photos', true)
on conflict (id) do nothing;
