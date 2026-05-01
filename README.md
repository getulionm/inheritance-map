# inheritance-map

Single-file scanner over `.ts` / `.tsx` / `.js` / `.jsx`: **folder layout**, **composition** via resolved `./` / `../` imports, and **inheritance** from `class Child extends Parent` (simple identifier after `extends` only — not `extends Foo.Bar`, not generics). Path aliases are **not** expanded. Does **not** run TypeScript.

## Use it like a gist

**Gist:** https://gist.github.com/getulionm/a51b3a8d19e3043a8f0a82fb892d95bb  

**1.** In the **root of the project** you want to analyze, download the script:

```bash
curl -sO https://gist.githubusercontent.com/getulionm/a51b3a8d19e3043a8f0a82fb892d95bb/raw/inheritance-map.cjs
```

**2.** Run:

```bash
node inheritance-map.cjs
```

That scans **`.`** (skipping folders like `node_modules`) and writes **`inheritance-map.md`** in the current directory.

---

Same file lives in this repo as **`inheritance-map.cjs`** if you prefer **copy–paste** from GitHub instead of `curl`.

Optional flags:

```bash
node inheritance-map.cjs --root ./packages/foo --out ./docs/inheritance-map.md
node inheritance-map.cjs --help
```

If **Files scanned** looks too low, your sources are probably outside `--root` / the folder you ran from.
