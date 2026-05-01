#!/usr/bin/env node
/**
 * Text scan for class inheritance: finds `class Child extends Parent` (single identifiers only).
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

  Defaults (when flags omitted):
    --root   current working directory
    --out    inheritance-map.md in the current working directory

  Copy this file into the root of the project you want to analyze, then run:
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

function relative(file) {
  return path.relative(process.cwd(), file);
}

function lineNumber(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
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

const output = [];

output.push("# Class inheritance map");
output.push("");
output.push(`Root: ${relative(root)}`);
output.push(`Files scanned: ${files.length}`);
output.push("");

output.push("## Superclasses (have subclasses in this scan)");
output.push("");

if (basesOrdered.length === 0) {
  output.push("(none — no `extends` edges found)");
  output.push("");
} else {
  for (const parentName of basesOrdered) {
    const def = classDefinitions.get(parentName);
    const definedLine = def ? `${relative(def.file)}` : "(not declared under this scan)";

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
output.push(
  "Leaves with one `extends` hop and superclass declared under this scan — heuristic only, not a correctness or safety claim."
);
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
console.error(`Written ${relative(outPath)}`);
