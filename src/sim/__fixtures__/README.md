# Prototype save fixtures

Real `saveN.json` files written by the GameMaker prototype (`archive/gamemaker/scripts/scr_save_load`), used by the save importer tests.

- `prototype-save-v1-day14.json`: early save (2026-05-08). Trees have no `bend_v`, `soil_tier` or `last_repot_day`, so it exercises every field migration.
- `prototype-save-v1-day730.json`: mature save (2026-07-03). Two trained trees with wires, trunk movement, repots, premium soil and fancy pots.

The files on disk end with a trailing NUL byte, because the prototype wrote them with `buffer_save` of a fixed-size buffer. The NUL is stripped here so the fixtures are valid JSON for tooling; the importer must still tolerate it on real files, and the tests append one to check that. GameMaker also serialises every number as a float (`14.0`), including ids and counts.
