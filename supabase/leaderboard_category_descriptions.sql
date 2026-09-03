-- ========== Leaderboard category descriptions (2026-09-03) ==========
--
-- Adds a short staff-facing description per category, so the "Rules" panel
-- on /leaderboard can explain what qualifies, not just how many points it's
-- worth. Editable later from Leaderboard -> Manage -> Categories.

alter table leaderboard_categories add column description text;

update leaderboard_categories set description =
  'Any package sold to a client -- locks in a series of future visits.'
  where key = 'package';
update leaderboard_categories set description =
  'An add-on service attached to an existing treatment (e.g. a peel or IPL add-on).'
  where key = 'addon';
update leaderboard_categories set description =
  'A brand-new client, tagged to you in Zenoti -- not an existing client''s visit.'
  where key = 'new_client';
update leaderboard_categories set description =
  'A new membership sold to a client (not a redemption by an existing member).'
  where key = 'membership';
update leaderboard_categories set description =
  'A Google review received from a client you served.'
  where key = 'google_review';
