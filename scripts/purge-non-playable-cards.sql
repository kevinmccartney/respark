-- One-off cleanup of art/theme extras imported before the catalog skip.
-- Matches apps/etl/src/core/typeLine.ts: any `//` face that trims to `Card`.
--
-- Printings listed on a deck stay (app.deck_card is RESTRICT). Faces and
-- identifiers cascade from catalog.printing.
--
-- Preview always. Deletes only when psql is invoked with `-v apply=1`.

\echo
\echo '=== Preview: type lines with a Card face ==='

select c.type_line, count(*) as cards
from catalog.card c
where exists (
  select 1
  from unnest(string_to_array(coalesce(c.type_line, ''), '//')) as face
  where btrim(face) = 'Card'
)
group by 1
order by 2 desc, 1;

\echo
\echo '=== Preview: row counts ==='

select 'catalog.card' as relation, count(*)::bigint as rows
from catalog.card c
where exists (
  select 1
  from unnest(string_to_array(coalesce(c.type_line, ''), '//')) as face
  where btrim(face) = 'Card'
)
union all
select 'catalog.printing (not in a deck)', count(*)
from catalog.printing p
join catalog.card c on c.id = p.card_id
where exists (
  select 1
  from unnest(string_to_array(coalesce(c.type_line, ''), '//')) as face
  where btrim(face) = 'Card'
)
  and not exists (select 1 from app.deck_card dc where dc.printing_id = p.id)
union all
select 'catalog.printing (held by a deck)', count(*)
from catalog.printing p
join catalog.card c on c.id = p.card_id
where exists (
  select 1
  from unnest(string_to_array(coalesce(c.type_line, ''), '//')) as face
  where btrim(face) = 'Card'
)
  and exists (select 1 from app.deck_card dc where dc.printing_id = p.id)
union all
select 'raw.scryfall_card', count(*)
from raw.scryfall_card
where exists (
  select 1
  from unnest(string_to_array(coalesce(payload->>'type_line', ''), '//')) as face
  where btrim(face) = 'Card'
)
union all
select 'raw.mtgjson_card', count(*)
from raw.mtgjson_card
where exists (
  select 1
  from unnest(string_to_array(coalesce(payload->>'type', ''), '//')) as face
  where btrim(face) = 'Card'
);

\if :apply
\echo
\echo '=== Applying deletes ==='

begin;

delete from catalog.printing p
using catalog.card c
where p.card_id = c.id
  and exists (
    select 1
    from unnest(string_to_array(coalesce(c.type_line, ''), '//')) as face
    where btrim(face) = 'Card'
  )
  and not exists (select 1 from app.deck_card dc where dc.printing_id = p.id);

delete from catalog.card c
where exists (
  select 1
  from unnest(string_to_array(coalesce(c.type_line, ''), '//')) as face
  where btrim(face) = 'Card'
)
  and not exists (select 1 from catalog.printing p where p.card_id = c.id);

delete from raw.scryfall_card
where exists (
  select 1
  from unnest(string_to_array(coalesce(payload->>'type_line', ''), '//')) as face
  where btrim(face) = 'Card'
);

delete from raw.mtgjson_card
where exists (
  select 1
  from unnest(string_to_array(coalesce(payload->>'type', ''), '//')) as face
  where btrim(face) = 'Card'
);

commit;

\echo
\echo '=== Leftover oracle cards (printings still on a deck) ==='

select c.name, c.type_line, count(p.id) as printings
from catalog.card c
join catalog.printing p on p.card_id = c.id
where exists (
  select 1
  from unnest(string_to_array(coalesce(c.type_line, ''), '//')) as face
  where btrim(face) = 'Card'
)
group by c.id, c.name, c.type_line
order by c.name;

\else
\echo
\echo 'Dry run. Re-run with `-v apply=1` (task db:purge-non-playable -- apply) to delete.'
\endif
