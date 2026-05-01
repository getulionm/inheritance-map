#!/usr/bin/env node
/**
 * Folder layout + composition (relative imports) + class inheritance (simple extends).
 */
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);

function getArg(name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage: node inheritance-map.cjs [--root <folder>] [--out <file.md>]

  Defaults:
    --root   current working directory
    --out    inheritance-map.md in the current working directory

  Sections:
    Folder tree (source files only), composition via ./ ../ imports,
    superclasses / leaves / shallow leaf list from class extends.

  Copy this file into the project root you want to analyze, then run:
    node inheritance-map.cjs`);
  process.exit(0);
}

const rootArg = getArg("--root");
const outArg = getArg("--out");

const root = path.resolve(rootArg ?? ".");
const defaultOut = path.resolve(process.cwd(), "inheritance-map.md");
const outPath = outArg ? path.resolve(outArg) : defaultOut;

if (!fs.existsSync(root)) {
  console.error(`Folder not found: ${root}`);
  process.exit(1);
}

const extensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const ignoredDirs = new Set(["node_modules", ".git", "dist", "build", "coverage", "test-results"]);

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir)) {
    if (ignoredDirs.has(entry)) continue;

    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      walk(fullPath, files);
    } else if (
      stat.isFile() &&
      extensions.has(path.extname(fullPath)) &&
      !fullPath.endsWith(".d.ts")
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function relativeToCwd(file) {
  return path.relative(process.cwd(), file);
}

function lineNumber(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function buildFolderTreeMarkdown(filesAbs, scanRoot) {
  const tree = {};
  for (const abs of filesAbs) {
    const rel = path.relative(scanRoot, abs);
    const parts = rel.split(path.sep).filter(Boolean);
    let cursor = tree;
    for (let i = 0; i < parts.length; i++) {
      const segment = parts[i];
      const isLast = i === parts.length - 1;
      if (isLast) {
        if (!cursor.__files__) cursor.__files__ = [];
        cursor.__files__.push(segment);
      } else {
        if (!cursor[segment]) cursor[segment] = {};
        cursor = cursor[segment];
      }
    }
  }

  function render(node, indent = 0) {
    const pad = "  ".repeat(indent);
    const out = [];
    const dirs = Object.keys(node).filter(k => k !== "__files__").sort();
    const fileList = node.__files__ ? [...node.__files__].sort() : [];
    for (const d of dirs) {
      out.push(`${pad}- ${d}/`);
      out.push(...render(node[d], indent + 1));
    }
    for (const f of fileList) {
      out.push(`${pad}- ${f}`);
    }
    return out;
  }

  const lines = render(tree);
  return lines.length ? lines.join("\n") : "(no source files under root)";
}

function extractRelativeImportSpecifiers(source) {
  const specs = new Set();
  const patterns = [
    /\bfrom\s+['"](\.[^'"]+)['"]/g,
    /\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g,
    /\bexport\s+[^;'"]+\s+from\s+['"](\.[^'"]+)['"]/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(source))) specs.add(m[1]);
  }
  return [...specs];
}

function tryFile(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile() ? p : null;
  } catch {
    return null;
  }
}

function resolveRelativeModule(fromAbsFile, specifier) {
  if (!specifier.startsWith(".")) return null;

  const base = path.normalize(path.join(path.dirname(fromAbsFile), specifier));

  const direct = tryFile(base);
  if (direct) return direct;

  for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
    const hit = tryFile(base + ext);
    if (hit) return hit;
  }

  try {
    if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
      for (const idx of ["index.ts", "index.tsx", "index.js", "index.jsx"]) {
        const hit = tryFile(path.join(base, idx));
        if (hit) return hit;
      }
    }
  } catch {
    /* ignore */
  }

  return null;
}

function isUnderScan(absResolved, scanRoot) {
  const rel = path.relative(scanRoot, absResolved);
  return rel !== "" && !rel.startsWith(".." + path.sep) && rel !== "..";
}

function compositionSection(filesAbs, scanRoot) {
  const bySource = new Map();

  for (const abs of filesAbs) {
    const source = fs.readFileSync(abs, "utf8");
    const specs = extractRelativeImportSpecifiers(source);
    const targets = new Set();
    for (const spec of specs) {
      const resolved = resolveRelativeModule(abs, spec);
      if (!resolved) continue;
      if (!isUnderScan(path.normalize(resolved), path.normalize(scanRoot))) continue;
      if (!extensions.has(path.extname(resolved))) continue;
      targets.add(path.relative(scanRoot, resolved));
    }
    if (targets.size === 0) continue;
    bySource.set(path.relative(scanRoot, abs), targets);
  }

  return [...bySource.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([src, set]) => ({ src, tgts: [...set].sort() }));
}

const files = walk(root);
const inheritance = [];
const classDefinitions = new Map();

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");

  const classRegex = /class\s+([A-Za-z_$][\w$]*)/g;
  let classMatch;
  while ((classMatch = classRegex.exec(source))) {
    const className = classMatch[1];
    if (!classDefinitions.has(className)) {
      classDefinitions.set(className, {
        file,
        line: lineNumber(source, classMatch.index),
      });
    }
  }

  const extendsRegex = /class\s+([A-Za-z_$][\w$]*)\s+extends\s+([A-Za-z_$][\w$]*)/g;
  let extendsMatch;
  while ((extendsMatch = extendsRegex.exec(source))) {
    inheritance.push({
      child: extendsMatch[1],
      parent: extendsMatch[2],
      file,
      line: lineNumber(source, extendsMatch.index),
    });
  }
}

const childrenByParent = new Map();
for (const item of inheritance) {
  if (!childrenByParent.has(item.parent)) {
    childrenByParent.set(item.parent, []);
  }
  childrenByParent.get(item.parent).push(item);
}

const inheritedByOtherClasses = new Set(inheritance.map(item => item.parent));
const leafEdges = inheritance.filter(item => !inheritedByOtherClasses.has(item.child));

const parentByChild = new Map();
for (const item of inheritance) {
  parentByChild.set(item.child, item.parent);
}

function chainFromLeaf(leafName) {
  const segments = [];
  const seen = new Set();
  let current = leafName;

  while (parentByChild.has(current)) {
    if (seen.has(current)) {
      return { segments, cyclic: true };
    }
    seen.add(current);
    const parent = parentByChild.get(current);
    segments.push({ child: current, parent });
    current = parent;
  }

  return { segments, cyclic: false };
}

function depthOfLeaf(leafName) {
  const { segments, cyclic } = chainFromLeaf(leafName);
  if (cyclic) return { depth: segments.length, cyclic: true };
  return { depth: segments.length, cyclic: false };
}

function simpleInspectCandidates(edges) {
  return edges.filter(edge => {
    const { depth, cyclic } = depthOfLeaf(edge.child);
    return !cyclic && depth === 1 && classDefinitions.has(edge.parent);
  });
}

const basesOrdered = [...childrenByParent.keys()].sort();
const simpleCandidates = simpleInspectCandidates(leafEdges);
const compositionRows = compositionSection(files, root);

const rootLabel = relativeToCwd(root) || ".";

const output = [];

output.push("# Structure & inheritance map");
output.push("");
output.push(`Root: ${rootLabel}`);
output.push(`Files scanned: ${files.length}`);
output.push("");

output.push("## Folder structure (source files)");
output.push("");
output.push(buildFolderTreeMarkdown(files, root));
output.push("");

output.push("## Composition (resolved relative imports)");
output.push("");
output.push("Relative `./` and `../` specifiers only; path aliases (`@/…`) are not expanded.");
output.push("");

if (compositionRows.length === 0) {
  output.push("(none)");
} else {
  for (const row of compositionRows) {
    output.push(`- \`${row.src}\` → ${row.tgts.map(t => `\`${t}\``).join(", ")}`);
  }
}
output.push("");

output.push("## Superclasses (have subclasses in this scan)");
output.push("");

if (basesOrdered.length === 0) {
  output.push("(none — no `extends` edges found)");
  output.push("");
} else {
  for (const parentName of basesOrdered) {
    const def = classDefinitions.get(parentName);
    const definedLine = def ? `${relativeToCwd(def.file)}` : "(not declared under this scan)";

    output.push(`### ${parentName}`);
    output.push("");
    output.push(`Defined: ${definedLine}`);
    output.push("");
    output.push("Children:");

    const children = childrenByParent.get(parentName) ?? [];
    const names = [...new Set(children.map(c => c.child))].sort();
    if (names.length === 0) {
      output.push("-");
    } else {
      for (const name of names) {
        output.push(`- ${name}`);
      }
    }
    output.push("");
  }
}

output.push("## Leaf classes (not extended by others in this scan)");
output.push("");

if (leafEdges.length === 0) {
  output.push("(none)");
} else {
  const sorted = [...leafEdges].sort((a, b) => a.child.localeCompare(b.child));
  const seenLine = new Set();
  for (const item of sorted) {
    const line = `- ${item.child} extends ${item.parent}`;
    if (seenLine.has(line)) continue;
    seenLine.add(line);
    output.push(line);
  }
}
output.push("");

output.push("## Simple leaf candidates (inspect manually)");
output.push("");

if (simpleCandidates.length === 0) {
  output.push("(none)");
} else {
  const sorted = [...simpleCandidates].sort((a, b) => a.child.localeCompare(b.child));
  const seenLine = new Set();
  for (const item of sorted) {
    const line = `- ${item.child} extends ${item.parent}`;
    if (seenLine.has(line)) continue;
    seenLine.add(line);
    output.push(line);
  }
}

output.push("");

const finalOutput = output.join("\n");

fs.writeFileSync(outPath, finalOutput);

console.log(finalOutput);
console.error(`Written ${relativeToCwd(outPath)}`);
