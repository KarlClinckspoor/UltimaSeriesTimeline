# Contributing

The site is generated from plain-text [TOML](https://toml.io) files in `data/`. You never need to touch HTML or JavaScript to add, fix or remove an entry. Edit a file (GitHub's pencil button works), open a pull request, and CI checks it and tells you what to fix.

No time for that? [Open an issue](../../issues/new/choose) instead: "Add a release or project", "Correct an entry" or "Something else".

## Where things live

| File | What it holds |
|---|---|
| `data/releases/<game>.toml` | **Every release of one game.** This is the file you will edit most. |
| `data/games.toml` | The games, in canon order, with where to buy them today. |
| `data/platforms.toml` | Hardware platforms: emulators, original hardware, table column. |
| `data/types.toml` | The release types (original, port, engine recreation, …). |
| `data/site.toml` | Title, intro line, footer text, table columns. |
| `src/` | Page template, styles (`style.css`, with the colour themes) and script. |

## Add a release

Open `data/releases/<game id>.toml` (ids: `akal u1 u2 u3 u4 u5 u6 se md uw1 u7 uw2 si u8 u9 drash rov1 rov2`) and add a block at the end:

```toml
[[release]]
year = 2026
type = "engine"
label = "Example Engine"
note = "What it is, who made it and what state it is in, in one to three sentences."
needs_data = true
links = [ { name = "GitHub", url = "https://github.com/example/engine" }, { name = "Releases", url = "https://github.com/example/engine/releases" } ]
```

An official version for a specific machine looks like this instead:

```toml
[[release]]
year = 1988
platform = "amiga"
type = "port"
label = "Amiga"
note = "Amiga port."
```

### Fields

| Field | Required | Meaning |
|---|---|---|
| `type` | yes | `orig`, `port`, `remake`, `console`, `jp`, `engine`, `decomp` or `fan` (see `data/types.toml`). |
| `label` | yes | Name shown on the card. For ports, usually the platform and publisher. |
| `note` | yes | Short plain-text description. |
| `year` | no | Whole year. **Leave it out if unknown**; the entry then shows only in the canon table. |
| `approx` | no | `true` if the year is approximate (shown as "c. 2015"). |
| `platform` | no | A platform id from `data/platforms.toml`. Leave out for engines and fan projects that run on modern systems. |
| `links` | for `engine`, `decomp`, `fan` without a `platform` | `[ { name = "…", url = "https://…" }, … ]`. The first link is where the card's title goes. |
| `play` | no | Same shape as `links`, for "Get it" (a `url` may be left out for something like original hardware). |
| `needs_data` | no | `true` for fan projects that need game files from a copy the player owns. (Engines and decompilation ports always say so.) |

Which table column an entry lands in follows from `platform`; without a platform, from `type`. Releases appear in file order within a year, so keep each game's file roughly chronological.

### Rules of the house

- **No game files.** Link to projects, stores and emulators, never to disk images, ROMs or "abandonware" downloads.
- Plain text in `note`. A `“c.”` date or an honest "year undocumented" beats a guess.
- Say what state a project is in (released, in development, abandoned, taken down). Statuses go stale, so put a month in when it matters.
- Prefer the project's own page or repository over a news article.

## Add a game, platform or type

Same idea: append a `[[game]]` block to `data/games.toml` (its position is its canon order) and create `data/releases/<id>.toml`; add a `[<id>]` table to `data/platforms.toml`; add one to `data/types.toml` and give it a `--t-<id>` colour in each theme in `src/style.css`.

## Check your change locally

You need Python 3.11 or newer; there is nothing to install.

```bash
python build.py --check   # validate only
python build.py           # validate and build into dist/
python -m http.server -d dist 8000   # then open http://localhost:8000
```

Errors name the file and the entry, for example `data/releases/u4.toml release #7 (Amiga): \`platform\` “amigo” is not in data/platforms.toml`.

## Build order

1. **Validate**: `python build.py --check` reads every TOML file and checks required fields, ids, years and links.
2. **Build**: `python build.py` also refreshes the canon table in `README.md` (between the `TABLE:START` / `TABLE:END` markers; never edit it by hand, CI commits it after a merge to `main`), and writes `dist/index.html` (data, CSS and script inlined; one file) and `dist/data.json` (the same data, for anyone who wants to reuse it).
3. **Deploy**: pushes to `main` publish `dist/` to GitHub Pages via `.github/workflows/pages.yml`. Pull requests run steps 1 and 2 only.

## Colours

The page ships three themes (Twilight, Moongate, Dawn), all variables at the top of `src/style.css`. To tweak or add one, copy a `:root[data-theme="…"]` block and add the name to `THEMES` in `src/app.js`.
