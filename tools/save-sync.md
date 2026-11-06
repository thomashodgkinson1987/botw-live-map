# BotW save-sync — how `tools/savesync-data.json` was derived

`tools/savesync-data.json` maps **save-flag hashes** to **Zeldadungeon map marker ids**.
It is used by the `/save-state` dev-server endpoint (see `vite.config.ts`) to mirror a
BotW save file onto the interactive map. It is a **derived artifact**; it can be
regenerated from the sources listed below. It contains no copyrighted asset data by
itself — only 2432 hash→id pairs.

## Save format

From `0x0C`, `game_data.sav` is a sequence of 8-byte records
`[u32 flagHash][u32 value]` (little-endian). `value != 0` means the flag is set.
E.g. a korok is collected, a shrine is cleared, chest is opened.

## Flag hash sources

| Table            | Source |
|------------------|--------|
| Korok hashes/pos | `lud99/botw-unexplored` `source/Data.cpp` (`Data::Korok(hash, internalName, x, y, zeldaDungeonId)`), documented as based on `d4mation/botw-unexplored-viewer`. The hash is `CRC32(internalName)` (verified). |
| Korok positions  | same, `(x, y)` world coordinates |
| Shrine hashes    | `Data::Shrine(hash, displayName, x, y)` — `displayName` is exactly the Zelda Dungeon marker id (e.g. `Misae Suma Shrine`). 120/120 located in a Switch save. |
| DLC Shrine hashes| `Data::DLCShrine(hash, x, y)` — no names; matched to the 16 remaining shrine markers by coordinates |
| Hinox/Talus/Molduga hashes + positions | `Data::Hinox` / `Data::Talus` / `Data::Molduga` |
| Chest flags      | `marcrobledo/savegame-editors` `zelda-botw/zelda-botw.hashes.csv` — chest flags exist under `MainField_TBox_Field_<base>_<hash_id>` **and** for the 55 variant chests (`NoReaction`/`Aoc`/`Aoc_long`/`Collabo`/`GodTree`) under their full variant suffix, e.g. `MainField_TBox_Field_Iron_NoReaction_Aoc_<hash_id>`. `<hash_id>` is identical to the chest object's placement `hash_id` (verified on samples), and `CRC32(flagName) == stored save hash` (verified on samples, and every mapped entry passes that check when the table is generated). The 3 `TBox_Field_Gamble` chests have no flags anywhere. |
| Chest placements | 1315 `TBox_Field_*` static chest objects from `radar.zeldamods.org` (`GET /objs/MainField/?q=actor:^"TBox_"`) at build time — this required one-time access to that public zeldamods API; the resulting table is committed, so no runtime access is needed. |

## Coordinate mapping game → map

Zelda Dungeon's map uses `mapX = -2 * gameY`, `mapY = 2 * gameX` (a 90° rotation
scaled by 2). Markers are not a byte-perfect projection — they carry positional
noise of up to ~±6 units (shrines) and ~±33 units (koroks). For each game object we
therefore assigned the nearest Zelda Dungeon marker **greedily and bijectively
(1:1)**, which is unambiguous: every assignment is ≤ ~33 units and conflicts are
resolved globally (this also handles the 3 duplicated `zeldaDungeonId` values in the
upstream table, 78/357/788).

- Seeds: 900/900 assigned (equals the upstream `zeldaDungeonId → Seed%03d` mapping
  for 897/900; the other 3 are the duplicated upstream ids resolved by coordinates).
- DLC shrines: 16/16, max distance 2.6 units.
- Hinoxes/Taluses: max distance 0.7 units; Moldugas ≤ 0.4 units.
- Chests ↔ treasure markers: 1315/1315 assigned, max distance 0.77 units
  (greedy 1:1 == nearest-neighbour assignment).

## Verified against a real save

Parsing a Switch `game_data.sav` (Cemu/Switch, same raw format):

- 900/900 korok records located (22 flagged collected on a fresh witness save)
- 120/120 shrines located (8 flagged cleared)
- 16/16 DLC shrines, 40/40 hinox, 40/40 talus, 4/4 molduga records located
- 1312/1312 chest flags located (44 flagged opened); all 2432 known flag records are present in the tested save file

## Regeneration

Regenerate by: (1) downloading the sources listed above, (2) extracting the flag
tables, (3) assigning markers 1:1 by the coordinate transform, (4) writing the JSON.
Access to `radar.zeldamods.org` is only needed for chest placement ids and was a
one-time operation.
