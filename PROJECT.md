# Northern Province People's Movement — Membership App

வடமாகாண மக்கள் இயக்கம் · Jaffna, Sri Lanka
Tamil-first membership platform for budget Android phones.

## Files

| File | What it is |
|---|---|
| `NPM App Prototype.dc.html` | **The app.** One phone, working bottom nav, 16 screens, real state. |
| `NPM Movement App.dc.html` | Design reference — the 5 core screens side by side on a canvas. |
| `PROJECT.md` | This file: feature scope + Postgres data model for the build phase. |
| `android-frame.jsx` | Device bezel used by both files. |

## Design foundations

- Primary **deep maroon `#7B1E2B`** (pressed `#5C1520`, tint `#F6E4E0`), warm cream page `#FBF6EE`, cards `#FFFFFF` / `#F5EDDF`, hairline `#E7DBC6`, ink `#1A1A18` / `#5C5A52` / `#8F8B7E`.
- Tier accents: முளை Sprout moss `#4A6B3A`, வேர் Root amber `#D08A2B`, பனை Palmyra locked grey.
- Semantic: success `#4A6B3A`, warning `#8A5A12` on `#F6E6C6`, error `#B03A3A`.
- Type: **Noto Sans Tamil** for Tamil (600 for labels), **Inter** for English/UI, **JetBrains Mono** for IDs and coordinates. Tamil label first, English sub-label under it at 9.5–12px.
- Palmyra frond mark: emblem in the header, membership card, referral card and profile — low-opacity gold `#F5D9A8` on maroon, maroon at 9% on cream.
- Touch targets 44–62px, pill buttons, 12/14/16/20/24px radii, soft warm shadows, 160/260/480ms `cubic-bezier(.22,.61,.36,1)`.

## Screens in the prototype (16)

**Tabs** — முகப்பு Home · நிகழ்வுகள் Events · **அட்டை Card** (raised centre) · அறிக்கை Reports · சுயவிவரம் Profile

1. **Home** — greeting, tier badge, points, pinned leadership banner, 2×2 quick actions, community feed (announcement + inline survey vote with live result bars).
2. **Digital membership card** — emblem, name, member ID, electorate, tier, member since, QR; Add to Wallet / Share code / Milestones; badge strip; tier progress.
3. **Events** — List/Map segmented view, filter chips, event cards with date block, RSVP · Directions · Remind me.
4. **Field report** — category chips, hold-to-record Tamil voice button, photo + GPS attachments, offline "சேமிக்கப்பட்டது — will sync" pill, my reports with 3-step status timeline.
5. **Profile** — avatar, tier, stats (points / referred / check-ins), menu, language switch, logout.
6. **Announcement detail** — photo, body in Tamil + English, key details, confirm attendance.
7. **Survey** — progress 2/5, single-choice question, privacy note, Next / Skip.
8. **Event detail** — map strip, agenda, check-in QR → checked-in success state (+50 pts), RSVP row.
9. **Report detail** — voice-note player, photos, GPS chip, vertical status timeline, coordinator reply.
10. **Referral** — code card `KARU-4821`, copy / WhatsApp / SMS, referred list with verification status, how it works.
11. **Milestones** — tier ladder Sprout → Root → Palmyra, badge grid (2 earned, 4 locked).
12. **Notifications** — Today / Earlier, unread dots, each row deep-links.
13. **My courses** — in-progress with bars, available catalogue.
14. **My ideas** — composer (text + voice) with submitted state, ideas with backing counts.
15. **Skills registry** — skill chips, availability toggles, save.
16. **Privacy & consent** — consent toggles, download data, policy, delete membership.

Live interactions: tab + stack navigation with back, survey voting, RSVP, check-in, filter/category/skill chips, List↔Map, hold-to-record (idle → recording → recorded), Add to Wallet, copy referral code, idea submit, consent toggles, language switch.

Tweaks (host panel): `offlineBanner`, `eventsView`, `surveyVoted`.

## Not built yet — needs product decisions

Join / NIC verification flow (OTP + NIC upload + review states), ward-coordinator side, push permission prompt, empty/error/loading states, full Sinhala/English string set, accessibility pass at 200% font scale.

---

# Backend plan — PostgreSQL (later)

Not implemented yet; recorded here so the app maps cleanly onto it. Postgres 16, `uuid` PKs, `timestamptz` everywhere, soft delete via `deleted_at`.

```sql
-- identity ------------------------------------------------------------
create table members (
  id              uuid primary key default gen_random_uuid(),
  member_code     text unique not null,           -- NPM-JAF-004821
  full_name       text not null,
  phone           text unique not null,           -- +94xxxxxxxxx
  nic_hash        text,                           -- encrypted at rest, never exposed
  nic_status      text not null default 'pending', -- pending|verified|rejected
  electorate_id   uuid references electorates(id),
  ward_id         uuid references wards(id),
  tier            text not null default 'sprout',  -- sprout|root|palmyra
  points          integer not null default 0,
  language        text not null default 'ta',      -- ta|en
  referred_by     uuid references members(id),
  referral_code   text unique not null,            -- KARU-4821
  joined_at       timestamptz not null default now(),
  deleted_at      timestamptz
);
create table electorates (id uuid primary key, name_ta text, name_en text, district text);
create table wards (id uuid primary key, electorate_id uuid references electorates(id), name_ta text, name_en text);

-- content -------------------------------------------------------------
create table announcements (
  id uuid primary key, title_ta text, title_en text, body_ta text, body_en text,
  photo_url text, pinned boolean default false, scope text, scope_id uuid,
  published_at timestamptz, author_id uuid references members(id)
);
create table events (
  id uuid primary key, title_ta text, title_en text, venue text,
  lat numeric(9,6), lng numeric(9,6), starts_at timestamptz, ends_at timestamptz,
  electorate_id uuid references electorates(id), agenda jsonb, rsvp_count integer default 0
);
create table event_rsvps (event_id uuid, member_id uuid, status text, created_at timestamptz, primary key (event_id, member_id));
create table event_checkins (id uuid primary key, event_id uuid, member_id uuid, checked_in_at timestamptz, qr_nonce text unique, points_awarded integer);

-- surveys -------------------------------------------------------------
create table surveys (id uuid primary key, title_ta text, title_en text, closes_at timestamptz, points integer default 20);
create table survey_questions (id uuid primary key, survey_id uuid, position int, prompt_ta text, prompt_en text, kind text);
create table survey_options (id uuid primary key, question_id uuid, position int, label_ta text, label_en text);
create table survey_responses (id uuid primary key, question_id uuid, option_id uuid, member_id uuid, created_at timestamptz,
  unique (question_id, member_id));   -- aggregate by ward; never expose per-member rows

-- field reports -------------------------------------------------------
create table reports (
  id uuid primary key, code text unique,            -- RPT-2214
  member_id uuid references members(id), category text,  -- canvassing|water|roads|land|electricity
  title_ta text, body_ta text, transcript_ta text,
  audio_url text, lat numeric(9,6), lng numeric(9,6),
  status text not null default 'submitted',          -- submitted|under_review|actioned
  assigned_to uuid references members(id),
  client_uuid text unique,                           -- offline queue idempotency key
  created_at timestamptz, synced_at timestamptz
);
create table report_photos (id uuid primary key, report_id uuid, url text, position int);
create table report_events (id uuid primary key, report_id uuid, status text, note text, actor_id uuid, created_at timestamptz);

-- engagement ----------------------------------------------------------
create table ideas (id uuid primary key, member_id uuid, body_ta text, status text, backings int default 0, created_at timestamptz);
create table idea_backings (idea_id uuid, member_id uuid, primary key (idea_id, member_id));
create table badges (id uuid primary key, key text unique, name_ta text, name_en text, icon text);
create table member_badges (member_id uuid, badge_id uuid, awarded_at timestamptz, awarded_by uuid, primary key (member_id, badge_id));
create table point_ledger (id uuid primary key, member_id uuid, delta int, reason text, ref_table text, ref_id uuid, created_at timestamptz);
create table skills (id uuid primary key, key text unique, name_ta text, name_en text);
create table member_skills (member_id uuid, skill_id uuid, available_weekends boolean, has_vehicle boolean, emergency_ok boolean, primary key (member_id, skill_id));
create table courses (id uuid primary key, title_ta text, title_en text, minutes int, badge_id uuid);
create table course_progress (member_id uuid, course_id uuid, lessons_done int, lessons_total int, updated_at timestamptz, primary key (member_id, course_id));
create table notifications (id uuid primary key, member_id uuid, kind text, title_ta text, body_ta text, deep_link text, read_at timestamptz, created_at timestamptz);
create table consents (member_id uuid, kind text, granted boolean, updated_at timestamptz, primary key (member_id, kind));
```

Notes for implementation
- **Tier = derived**, not authored: recompute from `point_ledger` + `event_checkins` on write; store the cached value on `members.tier`.
- **Offline first**: reports post with a client-generated `client_uuid`; server upserts on it so a replayed queue can't duplicate. Same for RSVPs and survey responses.
- **Check-in QR** encodes `member_code` + rotating `qr_nonce`; nonce is single-use per event.
- **Privacy**: `survey_responses` and `reports` are readable only by the owner and the assigned ward coordinator (row-level security by `ward_id`); `nic_hash` never leaves the server.
- Bilingual columns are `*_ta` / `*_en`; the client picks by `members.language` and falls back to Tamil.
