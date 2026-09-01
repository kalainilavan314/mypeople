-- NPM membership schema, hosted inside the existing `northern_province` DB so
-- members FK directly to the real geo.gn_division (920 GS divisions) and
-- geo.district. Idempotent: safe to re-run.

create schema if not exists npm;

-- Members --------------------------------------------------------------------
create table if not exists npm.member (
  id             uuid primary key default gen_random_uuid(),
  member_code    text unique not null,               -- WTL-YY-NNNNNNN
  full_name      text not null,
  phone          text unique not null,               -- +94xxxxxxxxx
  nic_hash       text,                                -- hashed; never exposed
  nic_status     text not null default 'pending',     -- pending|verified|rejected
  password_hash  text not null,
  dob            date,
  gender         text,                                -- male|female|other
  gs_code        text references geo.gn_division(gn_code),
  district_code  text references geo.district(district_code),
  tier           text not null default 'volunteer',   -- volunteer|diamond|gold|platinum
  referral_code  text unique not null,                -- the member's own invite id
  referred_by    uuid references npm.member(id),
  recruit_count  integer not null default 0,          -- how many joined via this member
  language       text not null default 'en',
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index if not exists member_referred_by_idx on npm.member(referred_by);
create index if not exists member_gs_idx on npm.member(gs_code);

-- One-time passwords ---------------------------------------------------------
create table if not exists npm.otp (
  id          bigserial primary key,
  phone       text not null,
  code        text not null,
  purpose     text not null default 'signup',         -- signup|login|reset
  expires_at  timestamptz not null,
  consumed    boolean not null default false,
  attempts    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists otp_phone_idx on npm.otp(phone, created_at desc);

-- Onboarding survey answers --------------------------------------------------
create table if not exists npm.onboarding_answer (
  member_id    uuid references npm.member(id) on delete cascade,
  question_id  text not null,
  answer       text not null,
  primary key (member_id, question_id)
);

-- Referral ledger (unique on referred so a recruit is counted once) ----------
create table if not exists npm.referral_event (
  id           bigserial primary key,
  referrer_id  uuid not null references npm.member(id),
  referred_id  uuid not null unique references npm.member(id),
  created_at   timestamptz not null default now()
);
create index if not exists referral_referrer_idx on npm.referral_event(referrer_id);
