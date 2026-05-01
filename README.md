# inheritance-map

Small CLI that scans a folder of `.ts` / `.tsx` / `.js` / `.jsx` sources and summarizes **`class Child extends Parent`** relationships (simple identifiers only — not `extends Foo.Bar`, not generics).

## Usage

```bash
node tools/inheritance-map.cjs --root path/to/sources [--out path/to/output.md]
```

If `--out` is omitted, writes `<basename-of-root>-inheritance-map.md` in the current working directory.

Example using the bundled fixture:

```bash
npm run scan:example
```

## Output

Markdown sections:

- **Superclasses** — classes that appear as a superclass in the scan, where each is defined (if seen under `--root`), and immediate subclasses.
- **Leaf classes** — classes that extend something but are not extended by another scanned class.
- **Simple leaf candidates** — shallow leaves whose superclass is declared under the same scan; **manual inspection only**.

This does **not** run TypeScript — it matches source text only.

## Limits

Unexpectedly low **Files scanned** usually means `--root` is wrong or sources live outside the scanned tree.
