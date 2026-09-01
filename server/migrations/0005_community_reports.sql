-- 0005: Community Reporting (NorthUnity) --------------------------------------
-- Citizen-submitted local issues: category + title + description + district +
-- priority, reviewed by local authorities through a 4-stage status pipeline.

create table if not exists npm.community_report (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references npm.member(id) on delete cascade,
  category      text not null check (category in
                  ('road','water','waste','electricity','agriculture','environment','public_facility','other')),
  title         text not null,
  description   text not null,
  district_code text references geo.district(district_code),
  priority      text not null default 'medium' check (priority in ('low','medium','high')),
  status        text not null default 'submitted' check (status in
                  ('submitted','under_review','in_progress','resolved')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists community_report_member_idx
  on npm.community_report (member_id, created_at desc);
create index if not exists community_report_status_idx
  on npm.community_report (status);
