-- Lightweight server-side error log, so unexpected 5xx failures (especially
-- ones that only reproduce on the serverless deployment) can be diagnosed
-- without leaking error internals to HTTP responses.
create table if not exists public.error_log (
  id      bigserial   primary key,
  at      timestamptz not null default now(),
  path    text,
  method  text,
  status  integer,
  message text,
  code    text,
  stack   text
);
create index if not exists error_log_at_idx on public.error_log (at desc);
