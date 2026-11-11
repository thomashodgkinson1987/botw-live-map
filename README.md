# Zelda Dungeon Interactive Maps

Interactive maps for Zelda games, hosted on https://www.zeldadungeon.net

Published maps:

- https://www.zeldadungeon.net/breath-of-the-wild-interactive-map
- https://www.zeldadungeon.net/links-awakening-interactive-map
- https://www.zeldadungeon.net/tears-of-the-kingdom-interactive-map

## Contributing

- `npm install` to install dependencies
- `npm run prepare` to set up git commit hooks
- `npm run dev` to launch the dev server for local testing
- `npm run format` to format code (enforced on commit) (or install Prettier VS Code extension and enable format-on-save)
- `npm run lint` to lint code (enforced on commit) (or install ESLint VS Code extension)

For now, certain ZD staff have push permission for the develop branch, and pushing to develop will trigger deployment to the staging environment `https://www.zeldadungeon.net/maps-beta`. To publish to prod `https://www.zeldadungeon.net/maps`, coordinate with Locke.

For non-staff, feel free to create PRs or Issues, and join our [discord](https://www.discord.io/zelda) to discuss ideas (use the #wiki channel).

## Syncing your BotW save (local dev only)

While playing Breath of the Wild (Switch, or a recompilation that keeps the same
raw `game_data.sav` format) you can keep the BotW map open in a browser tab and
have it reflect your save exactly. Set `BOTW_SAVE_DIR` to the directory that
holds your numbered save slots (they each contain `game_data.sav`) — for the
SavageWind recompilation that's typically `~/.local/state/savagewind/save/save_0`:

```bash
BOTW_SAVE_DIR=~/.local/state/savagewind/save/save_0 npm run dev
```

(or put `BOTW_SAVE_DIR=/absolute/path` in a gitignored `.env.local`)

The newest slot (by mtime) is read fresh from disk on every page refresh and
whenever the tab regains visibility/focus. Korok seeds, shrines (incl. DLC),
Hinoxes, Taluses, Moldugas and all one-time overworld treasure chests are marked
complete exactly as the save reports them; the save is the single source of
truth, so manual ticks in those categories are overwritten. Nothing is ever
written to the save file. The map is unaffected when `BOTW_SAVE_DIR` is unset or
the save can't be read. See `tools/save-sync.md` for how the flag table was derived.

## Live mode

Savage Wind exposes a read-only control socket when started with:

```sh
SAVAGEWIND_CONTROL=7777 ./savagewind
```
