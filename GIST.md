# Gist (canonical — this is enough)

Use **`inheritance-map.cjs`** from the gist. You **do not** need to clone any repository.

| | Link |
|--|--|
| **Gist (view / revisions)** | https://gist.github.com/getulionm/a51b3a8d19e3043a8f0a82fb892d95bb |
| **Raw file (`curl` / Save as)** | https://gist.githubusercontent.com/getulionm/a51b3a8d19e3043a8f0a82fb892d95bb/raw/inheritance-map.cjs |

## Quick start

From the root of the codebase you want to scan:

```bash
curl -sO https://gist.githubusercontent.com/getulionm/a51b3a8d19e3043a8f0a82fb892d95bb/raw/inheritance-map.cjs
node inheritance-map.cjs
```

Writes **`inheritance-map.md`** in the current directory (scans `.`, skips usual dirs like `node_modules`).

```bash
node inheritance-map.cjs --help
node inheritance-map.cjs --root ./packages/foo --out ./docs/map.md
```

## What this repo is for

The gist holds the **single file** everyone copies.

This **[GitHub repo](https://github.com/getulionm/inheritance-map)** only **mirrors** that same script so there can be ordinary git history, tags, or Issues if you want them. **Consuming the tool = gist only.**

The bundled `examples/minimal/` folder exists for maintainers smoke-testing the script after edits.
