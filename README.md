# Ultima, Version by Version

A timeline of every release of the single-player Ultima games (Akalabeth to Ultima IX, plus the Underworld, Worlds of Ultima, Escape from Mt. Drash and Runes of Virtue spin-offs): original releases, ports, Japanese and console versions, engine recreations, decompilation ports and fan remakes.

**Live site:** https://karlclinckspoor.github.io/UltimaSeriesTimeline/

## Contribute

All content is plain-text [TOML](https://toml.io) in [`data/`](data), one file of releases per game. Add or fix an entry with a few lines and a pull request, or [open an issue](../../issues/new/choose) and we will do it. Details and field reference: [CONTRIBUTING.md](CONTRIBUTING.md).

```toml
[[release]]
year = 2026
type = "engine"
label = "U8 Ether Gate"
note = "Clean-room C++ engine for Linux and the web that runs the original data files."
links = [ { name = "GitHub", url = "https://github.com/LostMystic/u8-ether-gate" } ]
```

## Build

Python 3.11+, no dependencies.

```bash
python build.py --check   # validate the data
python build.py           # build dist/index.html and dist/data.json
```

Pushes to `main` are validated, built and published to GitHub Pages by [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

## Layout

```
data/            games, platforms, types, site text, releases/<game>.toml
src/             index.html template, style.css (themes), app.js
build.py         validate + build
.github/         Pages workflow, issue forms, PR template
```

The **Export PNG** button saves whichever view is on screen (with your filters and theme) as an image; the PNG library loads from cdnjs only when you click it.

The project links to stores, emulators and fan projects only. No game files are hosted or linked.
