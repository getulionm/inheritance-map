# inheritance-map

Single-file scanner for **`class Child extends Parent`** in `.ts` / `.tsx` / `.js` / `.jsx` (simple names after `extends` only — not `extends Foo.Bar`, not generics). Does **not** run TypeScript.

## Use it on any repo

**1.** Copy **`inheritance-map.cjs`** into the **root of the project** you want to analyze.

**2.** From that project root:

```bash
node inheritance-map.cjs
```

This scans **`.`** (the whole tree except folders like `node_modules`) and writes **`inheritance-map.md`** next to where you ran the command.

Optional:

```bash
node inheritance-map.cjs --root ./packages/foo --out ./docs/inheritance-map.md
node inheritance-map.cjs --help
```

If **Files scanned** looks too low, check that `--root` is the folder that actually contains your sources.
