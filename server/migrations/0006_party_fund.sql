-- 0006: Party Fund donations ---------------------------------------------------
-- Two channels:
--   * card — sandbox card flow (real gateway later). We store ONLY the masked
--     last4 + brand for the receipt line; the PAN/CVV never reach the server.
--   * slip — donor uploads a bank-deposit slip photo; an admin verifies the
--     bank account and approves, which publishes the donation to the list.
-- Approved donations are public inside the app (donor name + amount).

alter table npm.member add column if not exists is_admin boolean not null default false;

create table if not exists npm.donation (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references npm.member(id) on delete cascade,
  amount_lkr    numeric(12,2) not null check (amount_lkr > 0),
  method        text not null check (method in ('card','slip')),
  -- card receipts (masked only — never the PAN or CVV)
  card_last4    text,
  card_brand    text,          -- visa | mastercard
  -- slip uploads
  slip_path     text,          -- file under server/uploads/donations/
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  note          text,          -- donor message / admin rejection reason
  created_at    timestamptz not null default now(),
  reviewed_by   uuid references npm.member(id),
  reviewed_at   timestamptz
);

create index if not exists donation_status_idx on npm.donation (status, created_at desc);
create index if not exists donation_member_idx on npm.donation (member_id, created_at desc);
