-- Events + RSVPs. FK to real geo.district / geo.gn_division. Idempotent.
create table if not exists npm.event (
  id            uuid primary key default gen_random_uuid(),
  title_en      text not null,
  title_ta      text,
  venue         text,
  lat           numeric(9,6),
  lng           numeric(9,6),
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  district_code text references geo.district(district_code),
  gs_code       text references geo.gn_division(gn_code),
  agenda        jsonb not null default '[]',
  category      text,
  banner        int not null default 0,   -- which gradient banner to show
  created_at    timestamptz not null default now()
);

create table if not exists npm.event_rsvp (
  event_id   uuid references npm.event(id) on delete cascade,
  member_id  uuid references npm.member(id) on delete cascade,
  status     text not null,               -- going|maybe|declined
  created_at timestamptz not null default now(),
  primary key (event_id, member_id)
);
create index if not exists event_rsvp_event_idx on npm.event_rsvp(event_id);

-- Seed a handful of Northern-Province community events (only if empty).
do $$
-- day0 = midnight *Colombo* today, as a timestamptz. The hour offsets below are
-- therefore real clock times (+ 9 hours = 09:00 local) and match each event's own
-- agenda. Using bare now() + interval '9 hours' would instead mean "nine hours from
-- whenever this migration happened to run", which is how the first seed ended up
-- with a 09:00-agenda convention starting at 23:55.
declare jaffna text; jgs text; day0 timestamptz;
begin
  if (select count(*) from npm.event) = 0 then
    day0 := date_trunc('day', now() at time zone 'Asia/Colombo') at time zone 'Asia/Colombo';

    -- Was "and geom is not null", which distinguished the real district row from
    -- an orphan duplicate of the same name in the GIS database. 0000_geo_reference
    -- no longer imports those orphans and carries no geometry, so the name alone
    -- is now unambiguous — and the lookup works on a plain, PostGIS-free Postgres.
    select district_code into jaffna from geo.district
      where name_en = 'Jaffna' order by district_code limit 1;
    -- order by, so a re-seed on another machine picks the same GS division
    select g.gn_code into jgs
      from geo.gn_division g join geo.ds_division ds on ds.ds_code = g.ds_code
      where ds.district_code = jaffna order by g.gn_code limit 1;

    insert into npm.event (title_en, title_ta, venue, lat, lng, starts_at, ends_at, district_code, gs_code, agenda, category, banner) values
    ('District members'' convention', 'யாழ். மாவட்ட உறுப்பினர் மாநாடு', 'Jaffna Town Hall', 9.6615, 80.0255,
      day0 + interval '7 days' + interval '9 hours', day0 + interval '7 days' + interval '13 hours', jaffna, jgs,
      '[{"time":"09:00","title":"Registration"},{"time":"10:00","title":"Keynote"},{"time":"12:00","title":"Ward breakout groups"}]', 'Convention', 0),
    ('Nallur water scheme — volunteer mapping', 'நல்லூர் நீர் திட்டம் — தொண்டர் வரைபடம்', 'Kandaswamy Kovil, Nallur', 9.6710, 80.0300,
      day0 + interval '2 days' + interval '8 hours', day0 + interval '2 days' + interval '11 hours', jaffna, jgs,
      '[{"time":"08:00","title":"Briefing"},{"time":"09:00","title":"Lane mapping"}]', 'Volunteering', 2),
    ('Youth leadership workshop', 'இளைஞர் தலைமைப் பயிற்சி', 'Jaffna Public Library', 9.6620, 80.0175,
      day0 + interval '10 days' + interval '9 hours 30 minutes', day0 + interval '10 days' + interval '13 hours', jaffna, jgs,
      '[{"time":"09:30","title":"Session 1"},{"time":"11:00","title":"Group work"}]', 'Education', 1),
    ('Palmyra restoration — tree planting', 'பனை மீட்பு — மரம் நடுதல்', 'Chunnakam', 9.7450, 80.0180,
      day0 + interval '14 days' + interval '7 hours', day0 + interval '14 days' + interval '10 hours', jaffna, jgs,
      '[{"time":"07:00","title":"Meet & tools"},{"time":"08:00","title":"Planting"}]', 'Environment', 2);
  end if;
end $$;
