-- ========== Performance & Conduct Accountability System ==========
--
-- One framework, not two: every violation type belongs to a color "track"
-- (green/yellow/red), which is what actually drives the mechanics --
-- strikes-before-termination-eligible and how often the count resets.
-- "Level 1/2/3" from Ori's original draft becomes level_label, a plain-
-- English tag shown next to the color, not a second thing to track.
--
-- Green  = Level 1 (Coaching & Minor Infractions)   -- 3 strikes, resets quarterly
-- Yellow = Level 2 (Serious Policy Violations)       -- 3 strikes, resets annually
-- Red    = Level 3 (Immediate Termination Eligible)  -- 1 strike, never resets

create table violation_types (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  track text not null check (track in ('green', 'yellow', 'red')),
  level_label text not null,
  description text not null,
  recommended_action text,
  strike_limit integer not null,
  reset_period text not null check (reset_period in ('quarterly', 'annually', 'never')),
  display_order integer not null default 0,
  active boolean not null default true
);

insert into violation_types (key, name, track, level_label, description, recommended_action, strike_limit, reset_period, display_order) values
(
  'general_misconduct', 'General Misconduct', 'green', 'Level 1 — Coaching & Minor Infractions',
  'An intentional or frivolous disregard for company rules and expectations -- for example a dress code violation, failing to clean up after yourself, an inaccurately reported job application detail discovered after hiring, or an off-color or unkind remark to a co-worker.',
  'Verbal coaching; written coaching note if repeated; performance improvement plan if it continues.', 3, 'quarterly', 1
),
(
  'tardiness', 'Tardiness', 'green', 'Level 1 — Coaching & Minor Infractions',
  'Employees must arrive and be prepared to commence work at their scheduled start time (at least 15 minutes before a first appointment). Unscheduled tardiness, early departures, or failure to give appropriate notice may result in corrective action. A warning can be waived only with documentation of extenuating circumstances (e.g. a car accident, a doctor''s note).',
  'Verbal coaching; written coaching note if repeated; performance improvement plan if it continues.', 3, 'quarterly', 2
),
(
  'carelessness', 'Carelessness', 'green', 'Level 1 — Coaching & Minor Infractions',
  'Failure to pay enough attention to what one is doing -- sloppiness, lack of accuracy or thoroughness, or a lack of regard for the quality of one''s work. Mistakes happen, but a consistent pattern of them is carelessness.',
  'Verbal coaching; written coaching note if repeated; performance improvement plan if it continues.', 3, 'quarterly', 3
),
(
  'unauthorized_absence', 'Unauthorized Absence', 'yellow', 'Level 2 — Serious Policy Violations',
  'Failing to report for a scheduled shift. An excused absence requires at least a week''s notice and advance approval (or a secured replacement); anything less is unexcused. For illness or an emergency, the employee (or someone on her behalf) must notify her supervisor no later than the scheduled start time. A warning can be waived only with documentation of extenuating circumstances.',
  'Formal written warning; suspension/probation if repeated; final warning.', 3, 'annually', 4
),
(
  'insubordination', 'Insubordination and Insolence', 'yellow', 'Level 2 — Serious Policy Violations',
  'Insubordination is a direct or indirect refusal to perform a legal, ethical and reasonable directive from a manager once it has been clearly understood or acknowledged. Insolence is mocking, insulting, disrespecting, or otherwise showing inappropriate disrespect toward a manager or supervisor.',
  'Formal written warning; suspension/probation if repeated; final warning.', 3, 'annually', 5
),
(
  'failure_to_complete_daily_tasks', 'Failure to Complete or Report Daily Responsibilities', 'yellow', 'Level 2 — Serious Policy Violations',
  'All employees are expected to complete their daily tasks and submit their opening/closing checklists in full, with intention, one checkbox at a time, signed and dated.',
  'Formal written warning; suspension/probation if repeated; final warning.', 3, 'annually', 6
),
(
  'endangerment', 'Endangerment to Others/Safety', 'red', 'Level 3 — Immediate Termination Eligible',
  'All employees, especially as licensed specialists, are expected to be informed on best safety practices and committed to keeping clients out of harm''s way. If there is ever a question about whether something could harm a client, ask before performing the treatment -- otherwise the employee will be held responsible.',
  'Immediate termination possible.', 1, 'never', 7
),
(
  'gross_misconduct_harassment', 'Gross Misconduct / Harassment', 'red', 'Level 3 — Immediate Termination Eligible',
  'Behavior that is criminal, harassing, or unethical -- including theft of property or finances (from the company, co-workers, customers or vendors, or by fraudulent transactions), property damage or negligence caused carelessly or intentionally, failure to follow safety protocols that put anyone at risk, vile or abusive language, or serious insubordination.',
  'Immediate termination possible.', 1, 'never', 8
),
(
  'falsification', 'Falsification of Documentation', 'red', 'Level 3 — Immediate Termination Eligible',
  'All documentation must be timely, accurate and truthful. This includes untrue or incomplete statements, redrafting, reformatting, deleting, fabricating, or altering the actual time of any record.',
  'Immediate termination possible.', 1, 'never', 9
);

create table policy_documents (
  id uuid primary key default gen_random_uuid(),
  key text not null unique default 'conduct_policy',
  title text not null default 'Performance & Conduct Accountability Policy',
  body text not null,
  version integer not null default 1,
  updated_by uuid references employees(id),
  updated_at timestamptz not null default now()
);

insert into policy_documents (key, title, body, version) values (
  'conduct_policy',
  'Performance & Conduct Accountability Policy',
  E'Professional Code of Conduct\n\n' ||
  E'Be patient and courteous.\n\n' ||
  E'Be inclusive. We welcome and support people of all backgrounds and identities -- including but not limited to sexual orientation, gender identity and expression, race, ethnicity, culture, national origin, social and economic class, educational level, color, immigration status, sex, age, size, family status, political belief, religion, and mental and physical ability.\n\n' ||
  E'Be considerate. We all depend on each other to produce the best work we can. Your decisions affect clients and colleagues, so take those consequences into account.\n\n' ||
  E'Be respectful. We won''t all agree all the time, but disagreement is no excuse for disrespectful behavior. Frustration is normal, but it cannot become personal attacks.\n\n' ||
  E'Choose your words carefully. Conduct yourself professionally and be kind. Harassment and exclusionary behavior aren''t acceptable -- including threats of violence, discriminatory jokes or language, sharing sexually explicit or violent material, personal insults (especially racist or sexist ones), unwelcome sexual attention, or encouraging any of the above.\n\n' ||
  E'Do not harass others. If someone asks you to stop something, stop. Resolve disagreements constructively.\n\n' ||
  E'Our differences can be our strengths. Being unable to understand why someone holds a viewpoint doesn''t mean they''re wrong. Focus on resolving issues and learning from mistakes.\n\n' ||
  E'How this policy works\n\n' ||
  E'Every violation is assigned a track based on its severity: Green (Level 1 -- coaching & minor infractions), Yellow (Level 2 -- serious policy violations), or Red (Level 3 -- immediate termination eligible). Green violations reset each quarter; Yellow resets each year; Red never resets. Three strikes on the Green or Yellow track, or a single Red-track violation, can lead to termination -- see the full list of violation types and what they mean below.',
  1
);
