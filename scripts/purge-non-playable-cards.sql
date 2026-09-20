-- One-off cleanup of extras imported before catalogSkip.
-- Keep lists in sync with apps/etl/src/core/catalogSkip.ts:
--   layouts: art_series, token, double_faced_token, emblem, front_card, planar, scheme, vanguard
--   set types: token, memorabilia, minigame
--   plus any `//` face that trims to `Card`
--
-- Printings listed on a deck stay (app.deck_card is RESTRICT). Faces and
-- identifiers cascade from catalog.printing. Memorabilia printings of a
-- real card are removed; the oracle row stays if other printings remain.
--
-- Preview always. Deletes only when psql is invoked with `-v apply=1`.

drop table if exists extra_oracle;
drop table if exists extra_printing;

create temp table extra_oracle as
select c.id
from catalog.card c
where coalesce(c.layout, '') in (
    'art_series',
    'token',
    'double_faced_token',
    'emblem',
    'front_card',
    'planar',
    'scheme',
    'vanguard'
  )
  or exists (
    select 1
    from unnest(string_to_array(coalesce(c.type_line, ''), '//')) as face
    where btrim(face) = 'Card'
  );

create temp table extra_printing as
select p.id
from catalog.printing p
join catalog.set s on s.id = p.set_id
where p.card_id in (select id from extra_oracle)
   or coalesce(s.set_type, '') in ('token', 'memorabilia', 'minigame');

\echo
\echo '=== Preview: extra oracle cards by layout ==='

select coalesce(c.layout, '(null)') as layout, count(*) as cards
from catalog.card c
join extra_oracle e on e.id = c.id
group by 1
order by 2 desc, 1;

\echo
\echo '=== Preview: extra printings by set type ==='

select coalesce(s.set_type, '(null)') as set_type, count(*) as printings
from catalog.printing p
join extra_printing e on e.id = p.id
join catalog.set s on s.id = p.set_id
group by 1
order by 2 desc, 1;

\echo
\echo '=== Preview: row counts ==='

select 'catalog.card (extra oracle)' as relation, count(*)::bigint as rows
from extra_oracle
union all
select 'catalog.printing extra (not in a deck)', count(*)
from extra_printing e
where not exists (select 1 from app.deck_card dc where dc.printing_id = e.id)
union all
select 'catalog.printing extra (held by a deck)', count(*)
from extra_printing e
where exists (select 1 from app.deck_card dc where dc.printing_id = e.id)
union all
select 'raw.scryfall_card', count(*)
from raw.scryfall_card
where coalesce(payload->>'layout', '') in (
    'art_series',
    'token',
    'double_faced_token',
    'emblem',
    'front_card',
    'planar',
    'scheme',
    'vanguard'
  )
   or coalesce(payload->>'set_type', '') in ('token', 'memorabilia', 'minigame')
   or exists (
     select 1
     from unnest(string_to_array(coalesce(payload->>'type_line', ''), '//')) as face
     where btrim(face) = 'Card'
   )
union all
select 'raw.mtgjson_card', count(*)
from raw.mtgjson_card
where coalesce(payload->>'layout', '') in (
    'art_series',
    'token',
    'double_faced_token',
    'emblem',
    'front_card',
    'planar',
    'scheme',
    'vanguard'
  )
   or exists (
     select 1
     from unnest(string_to_array(coalesce(payload->>'type', ''), '//')) as face
     where btrim(face) = 'Card'
   );

\if :apply
\echo
\echo '=== Applying deletes ==='

begin;

delete from catalog.printing p
using extra_printing e
where p.id = e.id
  and not exists (select 1 from app.deck_card dc where dc.printing_id = p.id);

delete from catalog.card c
using extra_oracle e
where c.id = e.id
  and not exists (select 1 from catalog.printing p where p.card_id = c.id);

delete from raw.scryfall_card
where coalesce(payload->>'layout', '') in (
    'art_series',
    'token',
    'double_faced_token',
    'emblem',
    'front_card',
    'planar',
    'scheme',
    'vanguard'
  )
   or coalesce(payload->>'set_type', '') in ('token', 'memorabilia', 'minigame')
   or exists (
     select 1
     from unnest(string_to_array(coalesce(payload->>'type_line', ''), '//')) as face
     where btrim(face) = 'Card'
   );

delete from raw.mtgjson_card
where coalesce(payload->>'layout', '') in (
    'art_series',
    'token',
    'double_faced_token',
    'emblem',
    'front_card',
    'planar',
    'scheme',
    'vanguard'
  )
   or exists (
     select 1
     from unnest(string_to_array(coalesce(payload->>'type', ''), '//')) as face
     where btrim(face) = 'Card'
   );

commit;

\echo
\echo '=== Leftover extra oracles (printings still on a deck) ==='

select c.name, c.layout, c.type_line, count(p.id) as printings
from catalog.card c
join extra_oracle e on e.id = c.id
join catalog.printing p on p.card_id = c.id
group by c.id, c.name, c.layout, c.type_line
order by c.name;

\else
\echo
\echo 'Dry run. Re-run with `-v apply=1` (task db:purge-non-playable -- apply) to delete.'
\endif
