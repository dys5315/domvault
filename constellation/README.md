# Constellation — universe visualization

A self-contained, dependency-free mock of the Constellation map: zoom from the **Universe**
(all galaxies) → a **galaxy** (topic, its brains) → a **solar system** (one brain and its
orbiting published planets).

## Run it
Because it `fetch()`es `mock/data.json`, serve it over HTTP (file:// blocks fetch):
```bash
cd constellation && python3 -m http.server 8080
# open http://localhost:8080
```
Click a galaxy to enter it, click a brain to see its planets, click empty space (or a
breadcrumb) to zoom back out.

## This is a mock
Data is fake (`mock/data.json`). The real version reads the registry's `GET /universe`
crawl (see `../registry/SPEC.md`) and renders live planets. Build order: publish/pull →
this visualization on live data → search → payments.

## Hand this to Claude Code
See `../docs/07-claude-code-prompts.md` for the prompt that turns this mock into a real
app wired to the registry.
