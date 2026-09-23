-- One-off cleanup of digital / Alchemy catalog rows imported before skip.
-- Keep criteria in sync with apps/etl/src/core/catalogSkip.ts:
--   catalog.set.digital = true OR set_type = 'alchemy'
--   OR card name starts with 'A-' (Alchemy rebalance in a paper set)
--   OR collector_number ~ '^A-'
--   OR raw.scryfall_card.digital = true (when raw was stored)
--
-- Deletes those printings, then orphan oracle cards with no remaining
-- printings, then empty digital sets. Shared paper printings and their
-- cards stay. Printings listed on a deck or as a commander stay
-- (app.deck_card / decks.commander_printing_id are RESTRICT).
--
-- Run:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v apply=0 -f scripts/purge-digital-sets.sql
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v apply=1 -f scripts/purge-digital-sets.sql
-- Or via Task (tunnel first for develop RDS):
--   task db:purge-digital            # dry-run
--   task db:purge-digital -- apply
--   task db:purge-digital -- local   # Compose Postgres
--
-- Preview always. Deletes only when psql is invoked with `-v apply=1`.

drop table if exists digital_set;
drop table if exists digital_printing;
drop table if exists digital_orphan_card;

create temp table digital_set as
select s.id, s.code, s.name, s.set_type, s.digital
from catalog.set s
where s.digital is true
   or coalesce(s.set_type, '') = 'alchemy';

create temp table digital_printing as
select distinct p.id, p.card_id, p.set_id
from catalog.printing p
join catalog.card c on c.id = p.card_id
where p.set_id in (select id from digital_set)
   or c.name like 'A-%'
   or p.collector_number ~ '^A-'
   or exists (
     select 1
     from raw.scryfall_card r
     where r.scryfall_id = p.scryfall_id
       and coalesce((r.payload->>'digital')::boolean, false) is true
   );

create temp table digital_orphan_card as
select c.id
from catalog.card c
where exists (
    select 1 from digital_printing dp where dp.card_id = c.id
  )
  and not exists (
    select 1
    from catalog.printing p
    where p.card_id = c.id
      and p.id not in (select id from digital_printing)
  );

\echo
\echo '=== Preview: digital sets by type ==='

select coalesce(s.set_type, '(null)') as set_type,
       count(*) as sets,
       count(*) filter (where s.digital is true) as digital_flag
from digital_set s
group by 1
order by 2 desc, 1;

\echo
\echo '=== Preview: digital printings by reason (sample sets) ==='

select coalesce(s.code, '(null)') as set_code,
       count(*) as printings,
       count(*) filter (where c.name like 'A-%') as a_name,
       count(*) filter (where p.collector_number ~ '^A-') as a_collector
from digital_printing e
join catalog.printing p on p.id = e.id
join catalog.card c on c.id = e.card_id
join catalog.set s on s.id = e.set_id
group by 1
order by 2 desc, 1
limit 20;

\echo
\echo '=== Preview: row counts ==='

select 'catalog.set (digital)' as relation, count(*)::bigint as rows
from digital_set
union all
select 'catalog.printing digital (not in a deck)', count(*)
from digital_printing e
where not exists (select 1 from app.deck_card dc where dc.printing_id = e.id)
  and not exists (select 1 from app.decks d where d.commander_printing_id = e.id)
union all
select 'catalog.printing digital (held by a deck)', count(*)
from digital_printing e
where exists (select 1 from app.deck_card dc where dc.printing_id = e.id)
   or exists (select 1 from app.decks d where d.commander_printing_id = e.id)
union all
select 'catalog.card (orphan after digital purge)', count(*)
from digital_orphan_card
union all
select 'raw.scryfall_card (digital / alchemy / A-)', count(*)
from raw.scryfall_card
where coalesce((payload->>'digital')::boolean, false) is true
   or coalesce(payload->>'set_type', '') = 'alchemy'
   or coalesce(payload->>'name', '') like 'A-%'
   or coalesce(payload->>'collector_number', '') ~ '^A-';

\if :apply
\echo
\echo '=== Applying deletes ==='

begin;

delete from catalog.printing p
using digital_printing e
where p.id = e.id
  and not exists (select 1 from app.deck_card dc where dc.printing_id = p.id)
  and not exists (select 1 from app.decks d where d.commander_printing_id = p.id);

delete from catalog.card c
using digital_orphan_card e
where c.id = e.id
  and not exists (select 1 from catalog.printing p where p.card_id = c.id);

delete from catalog.set s
using digital_set e
where s.id = e.id
  and not exists (select 1 from catalog.printing p where p.set_id = s.id);

delete from raw.scryfall_card
where coalesce((payload->>'digital')::boolean, false) is true
   or coalesce(payload->>'set_type', '') = 'alchemy'
   or coalesce(payload->>'name', '') like 'A-%'
   or coalesce(payload->>'collector_number', '') ~ '^A-';

commit;

\echo
\echo '=== Leftover digital printings (still on a deck / commander) ==='

select s.code, c.name, p.collector_number, count(dc.id) as deck_lines
from catalog.printing p
join digital_printing e on e.id = p.id
join catalog.set s on s.id = p.set_id
join catalog.card c on c.id = p.card_id
left join app.deck_card dc on dc.printing_id = p.id
group by s.code, c.name, p.collector_number, p.id
order by s.code, c.name;

\else
\echo
\echo 'Dry run. Re-run with `-v apply=1` (task db:purge-digital -- apply) to delete.'
\endif
