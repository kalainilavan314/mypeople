-- Northern Province People's Movement — initial schema
-- Postgres 16. uuid PKs, timestamptz everywhere, soft delete via deleted_at.
-- Source of truth: PROJECT.md §Backend plan. Bilingual columns are *_ta / *_en.

begin;

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- identity ------------------------------------------------------------
create table electorates (
  id        uuid primary key default gen_random_uuid(),
  name_ta   text not null,
  name_en   text not null,
  district  text not null
);

create table wards (
  id            uuid primary key default gen_random_uuid(),
  electorate_id uuid not null references electorates(id),
  name_ta       text not null,
  name_en       text not null
);

create table members (
  id              uuid primary key default gen_random_uuid(),
  member_code     text unique not null,            -- NPM-JAF-004821
  full_name       text not null,
  phone           text unique not null,            -- +94xxxxxxxxx
  nic_hash        text,                            -- encrypted at rest, never exposed
  nic_status      text not null default 'pending', -- pending|verified|rejected
  electorate_id   uuid references electorates(id),
  ward_id         uuid references wards(id),
  tier            text not null default 'sprout',  -- sprout|root|palmyra (derived, cached)
  points          integer not null default 0,
  language        text not null default 'ta',      -- ta|en|si
  referred_by     uuid references members(id),
  referral_code   text unique not null,            -- KARU-4821
  joined_at       timestamptz not null default now(),
  deleted_at      timestamptz
);
create index members_ward_idx on members(ward_id);
create index members_electorate_idx on members(electorate_id);

-- content -------------------------------------------------------------
create table announcements (
  id           uuid primary key default gen_random_uuid(),
  title_ta     text, title_en text,
  body_ta      text, body_en text,
  photo_url    text,
  pinned       boolean not null default false,
  scope        text,                                -- district|electorate|ward
  scope_id     uuid,
  published_at timestamptz,
  author_id    uuid references members(id)
);

create table events (
  id            uuid primary key default gen_random_uuid(),
  title_ta      text, title_en text,
  venue         text,
  lat           numeric(9,6), lng numeric(9,6),
  starts_at     timestamptz, ends_at timestamptz,
  electorate_id uuid references electorates(id),
  agenda        jsonb,
  rsvp_count    integer not null default 0
);

create table event_rsvps (
  event_id   uuid not null references events(id),
  member_id  uuid not null references members(id),
  status     text not null,                          -- going|maybe|declined
  created_at timestamptz not null default now(),
  primary key (event_id, member_id)
);

create table event_checkins (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references events(id),
  member_id      uuid not null references members(id),
  checked_in_at  timestamptz not null default now(),
  qr_nonce       text unique not null,               -- single-use per event
  points_awarded integer not null default 50
);

-- surveys -------------------------------------------------------------
create table surveys (
  id        uuid primary key default gen_random_uuid(),
  title_ta  text, title_en text,
  closes_at timestamptz,
  points    integer not null default 20
);

create table survey_questions (
  id        uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys(id),
  position  int not null,
  prompt_ta text, prompt_en text,
  kind      text not null default 'single'           -- single|multi
);

create table survey_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references survey_questions(id),
  position    int not null,
  label_ta    text, label_en text
);

create table survey_responses (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references survey_questions(id),
  option_id   uuid not null references survey_options(id),
  member_id   uuid not null references members(id),
  created_at  timestamptz not null default now(),
  unique (question_id, member_id)                     -- aggregate by ward; never expose per-member rows
);

-- field reports -------------------------------------------------------
create table reports (
  id           uuid primary key default gen_random_uuid(),
  code         text unique,                           -- RPT-2214
  member_id    uuid not null references members(id),
  category     text not null,                         -- canvassing|water|roads|land|electricity
  title_ta     text, body_ta text, transcript_ta text,
  audio_url    text,
  lat          numeric(9,6), lng numeric(9,6),
  status       text not null default 'submitted',     -- submitted|under_review|actioned
  assigned_to  uuid references members(id),
  client_uuid  text unique,                           -- offline queue idempotency key
  created_at   timestamptz not null default now(),
  synced_at    timestamptz
);
create index reports_member_idx on reports(member_id);
create index reports_status_idx on reports(status);

create table report_photos (
  id        uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id),
  url       text not null,
  position  int not null default 0
);

create table report_events (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid not null references reports(id),
  status     text not null,
  note       text,
  actor_id   uuid references members(id),
  created_at timestamptz not null default now()
);

-- engagement ----------------------------------------------------------
create table ideas (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references members(id),
  body_ta    text,
  status     text not null default 'submitted',       -- submitted|reviewing|adopted
  backings   int not null default 0,
  created_at timestamptz not null default now()
);

create table idea_backings (
  idea_id   uuid not null references ideas(id),
  member_id uuid not null references members(id),
  primary key (idea_id, member_id)
);

create table badges (
  id      uuid primary key default gen_random_uuid(),
  key     text unique not null,
  name_ta text, name_en text,
  icon    text
);

create table member_badges (
  member_id  uuid not null references members(id),
  badge_id   uuid not null references badges(id),
  awarded_at timestamptz not null default now(),
  awarded_by uuid references members(id),
  primary key (member_id, badge_id)
);

create table point_ledger (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references members(id),
  delta      int not null,
  reason     text not null,
  ref_table  text,
  ref_id     uuid,
  created_at timestamptz not null default now()
);
create index point_ledger_member_idx on point_ledger(member_id);

create table skills (
  id      uuid primary key default gen_random_uuid(),
  key     text unique not null,
  name_ta text, name_en text
);

create table member_skills (
  member_id          uuid not null references members(id),
  skill_id           uuid not null references skills(id),
  available_weekends boolean not null default false,
  has_vehicle        boolean not null default false,
  emergency_ok       boolean not null default false,
  primary key (member_id, skill_id)
);

create table courses (
  id       uuid primary key default gen_random_uuid(),
  title_ta text, title_en text,
  minutes  int,
  badge_id uuid references badges(id)
);

create table course_progress (
  member_id     uuid not null references members(id),
  course_id     uuid not null references courses(id),
  lessons_done  int not null default 0,
  lessons_total int not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (member_id, course_id)
);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references members(id),
  kind       text not null,
  title_ta   text, body_ta text,
  deep_link  text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_member_idx on notifications(member_id, created_at desc);

create table consents (
  member_id  uuid not null references members(id),
  kind       text not null,                           -- data|whatsapp|research
  granted    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (member_id, kind)
);

commit;
