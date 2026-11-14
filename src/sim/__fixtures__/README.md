# Save fixtures

Real `saveN.json` files written by the GameMaker prototype (`archive/gamemaker/scripts/scr_save_load`), used by the save importer tests.

- `prototype-save-v1-day14.json`: early save (2026-05-08). Trees have no `bend_v`, `soil_tier` or `last_repot_day`, so it exercises every field migration.
- `prototype-save-v1-day730.json`: mature save (2026-07-03). Two trained trees with wires, trunk movement, repots, premium soil and fancy pots.

The prototype files on disk end with a trailing NUL byte, because the prototype wrote them with `buffer_save` of a fixed-size buffer. The NUL is stripped here so the fixtures are valid JSON for tooling; the importer must still tolerate it on real files, and the tests append one to check that. GameMaker also serialises every number as a float (`14.0`), including ids and counts.

One save of this port's own shape, built by hand, tests the version 6 migration:

- `save-v5-greenhouse-22x10.json`: a version-5 save laid out on the old 22x10-tile greenhouse. Four placed items: a pedestal (id 0) at (192, 96) and a floor shelf (id 3) at (224, 128), both wholly on the 10x7 floor (x 160..320, y 80..192); a floor shelf (id 1) at (304, 160) straddling its right edge; a pedestal (id 2) at (400, 96) wholly off it. Trees: Granny's juniper on the shed floor, one displayed on the inside pedestal (`placed_0`), one on the straddling shelf's second spot (`placed_1_2`) and one on the outside pedestal (`placed_2`). No pedestal and one floor shelf in stock; `nextPlacedId` is 5 (item 4 was picked up before the save).
