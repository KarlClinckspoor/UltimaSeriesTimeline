#!/usr/bin/env python3
"""Build the site: validate data/*.toml, then write dist/index.html (+ dist/data.json).

    python build.py            # validate and build
    python build.py --check    # validate only

Needs Python 3.11+ (tomllib). No other dependencies.
"""
import json
import sys
import tomllib
from html import escape
from pathlib import Path

ROOT = Path(__file__).parent
DATA, SRC, DIST = ROOT / "data", ROOT / "src", ROOT / "dist"

errors: list[str] = []


def err(where, msg):
    errors.append(f"{where}: {msg}")


def load(path: Path):
    rel = path.relative_to(ROOT).as_posix()
    try:
        with open(path, "rb") as f:
            return tomllib.load(f)
    except tomllib.TOMLDecodeError as e:
        err(rel, f"not valid TOML: {e}")
    except FileNotFoundError:
        err(rel, "file is missing")
    return {}


def need(obj, keys, where):
    for k in keys:
        if k not in obj:
            err(where, f"missing required field `{k}`")
        elif not isinstance(obj[k], str) or not obj[k].strip():
            err(where, f"`{k}` must be non-empty text")


def check_links(items, where, field):
    if not isinstance(items, list):
        err(where, f'`{field}` must be a list like [{{ name = "…", url = "https://…" }}]')
        return
    for i, link in enumerate(items):
        if not isinstance(link, dict) or "name" not in link:
            err(where, f"`{field}` entry {i + 1} needs a `name`")
            continue
        url = link.get("url")
        if url is None and field == "play":
            continue  # e.g. "Original C64 hardware" has no link
        if not (isinstance(url, str) and url.startswith(("https://", "http://"))):
            err(where, f"`{field}` entry “{link['name']}” needs a `url` starting with http(s)://")


def validate_and_collect():
    site = load(DATA / "site.toml")
    types = load(DATA / "types.toml")
    plats = load(DATA / "platforms.toml")
    games = load(DATA / "games.toml").get("game", [])
    need(site, ["title", "description", "lede", "repo"], "data/site.toml")
    columns = site.get("column", [])
    col_ids = {c.get("id") for c in columns}

    for tid, t in types.items():
        need(t, ["label"], f"data/types.toml [{tid}]")
        if t.get("shape") not in ("dot", "diamond"):
            err(f"data/types.toml [{tid}]", '`shape` must be "dot" or "diamond"')
    for pid, p in plats.items():
        w = f"data/platforms.toml [{pid}]"
        need(p, ["name", "column", "original"], w)
        if p.get("column") not in col_ids:
            err(w, f"`column` “{p.get('column')}” is not a column in data/site.toml")
        check_links(p.get("emulators", []), w, "emulators")

    gids = []
    for i, g in enumerate(games):
        w = f"data/games.toml game #{i + 1} ({g.get('id', '?')})"
        need(g, ["id", "ord", "title", "short", "era", "wiki", "query"], w)
        if g.get("id") in gids:
            err(w, "duplicate game id")
        gids.append(g.get("id"))
        for b in g.get("buy", []):
            if not str(b.get("url", "")).startswith("http"):
                err(w, f"buy link “{b.get('name')}” needs a url")

    releases = []
    for f in sorted((DATA / "releases").glob("*.toml")):
        gid = f.stem
        if gid not in gids:
            err(f"data/releases/{f.name}", f"file name must be a game id from data/games.toml ({', '.join(gids)})")
            continue
        for n, r in enumerate(load(f).get("release", []), 1):
            w = f"data/releases/{f.name} release #{n} ({r.get('label', '?')})"
            need(r, ["type", "label", "note"], w)
            if r.get("type") not in types:
                err(w, f"`type` “{r.get('type')}” is not one of: {', '.join(types)}")
            if "platform" in r and r["platform"] not in plats:
                err(w, f"`platform` “{r['platform']}” is not in data/platforms.toml")
            if "year" in r and not (isinstance(r["year"], int) and 1978 <= r["year"] <= 2100):
                err(w, "`year` must be a whole year such as 1994 (leave it out if unknown)")
            check_links(r.get("links", []), w, "links")
            if "play" in r:
                check_links(r["play"], w, "play")
            if "platform" not in r and r.get("type") in ("engine", "decomp", "fan") and not r.get("links"):
                err(w, "recreations and fan projects need at least one entry in `links`")
            col = plats[r["platform"]]["column"] if r.get("platform") in plats else r.get("type")
            if col not in col_ids and not ("platform" in r and r["platform"] not in plats):
                err(w, f"it would land in table column “{col}”, which doesn't exist in data/site.toml")
            releases.append({
                "game": gid, "year": r.get("year"), "approx": bool(r.get("approx")),
                "platform": r.get("platform"), "type": r.get("type"), "label": r.get("label"),
                "note": r.get("note"), "needs_data": bool(r.get("needs_data")), "column": col,
                "links": r.get("links", []), "play": r.get("play"),
            })
    for gid in gids:
        if not any(r["game"] == gid for r in releases):
            err(f"data/releases/{gid}.toml", "this game has no releases")
    return site, columns, types, plats, games, gids, releases


def main(check_only):
    site, columns, types, plats, games, gids, releases = validate_and_collect()
    if errors:
        print(f"\n{len(errors)} problem(s) in the data:\n", file=sys.stderr)
        for e in errors:
            print(f"  ✗ {e}", file=sys.stderr)
        print("\nSee CONTRIBUTING.md for the format.", file=sys.stderr)
        return 1

    years = [r["year"] for r in releases if r["year"]]
    order = {g: i for i, g in enumerate(gids)}
    releases.sort(key=lambda r: order[r["game"]])  # stable: keeps file order inside a game
    payload = {
        "site": {**{k: site[k] for k in ("title", "description", "lede", "repo", "footer") if k in site},
                 "first_year": min(years), "last_year": max(years), "columns": columns},
        "types": types, "platforms": plats, "games": games, "releases": releases,
    }
    print(f"OK: {len(games)} games, {len(releases)} releases, {len(plats)} platforms, years {min(years)}-{max(years)}")
    if check_only:
        return 0

    blob = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    page = (SRC / "index.html").read_text(encoding="utf8")
    page = page.replace("__TITLE__", escape(site["title"])).replace("__DESCRIPTION__", escape(site["description"], quote=True))
    page = page.replace("/*__STYLE__*/", (SRC / "style.css").read_text(encoding="utf8"))
    page = page.replace("/*__APP__*/", (SRC / "app.js").read_text(encoding="utf8"))
    page = page.replace("/*__DATA__*/null", blob)
    DIST.mkdir(exist_ok=True)
    (DIST / "index.html").write_text(page, encoding="utf8")
    (DIST / "data.json").write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf8")
    (DIST / ".nojekyll").write_text("")
    print(f"Wrote dist/index.html ({len(page) // 1024} KB) and dist/data.json")
    return 0


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8")  # Windows consoles default to a legacy codepage
    sys.exit(main("--check" in sys.argv))
