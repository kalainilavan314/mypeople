-- 0007: Editable profile ---------------------------------------------------
-- Members can now upload a profile photo and edit their own details.
-- avatar_path = filename under server/uploads/avatars/ (uuid per upload, so
-- the URL changes on every replacement and browser caches never go stale).

alter table npm.member add column if not exists avatar_path text;
