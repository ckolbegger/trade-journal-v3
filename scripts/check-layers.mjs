#!/usr/bin/env node
// Repo-local dependency-direction check. It reads the rule data in `layers.config.mjs` and fails
// on any import that crosses a forbidden layer edge, on a module that declares no layer, and on
// a protected global used outside its one permitted directory.
//
// Static imports and re-exports only, which is the recorded tradeoff of D1 decision 7: a dynamic
// import is a deliberate escape hatch that this check cannot see.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import {
  forbiddenSymbols,
  hostIdentifiers,
  layerEdges,
  moduleEdges,
  modules,
  protectedDirectories,
  valuePackage,
} from "./layers.config.mjs";

const root = process.cwd();
const extensions = [".ts", ".tsx"];

function toPosix(path) {
  return path.split("\\").join("/");
}

function walk(directory, found = []) {
  for (const entry of readdirSync(join(root, directory))) {
    const relativePath = `${directory}/${entry}`;
    const absolutePath = join(root, relativePath);
    if (statSync(absolutePath).isDirectory()) {
      if (relativePath === "tests/lint-fixtures") continue;
      walk(relativePath, found);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      found.push(relativePath);
    }
  }
  return found;
}

function moduleOf(relativePath) {
  let best = null;
  for (const candidate of modules) {
    const owns =
      candidate.direct === true
        ? dirname(relativePath) === candidate.dir
        : relativePath === candidate.dir || relativePath.startsWith(`${candidate.dir}/`);
    if (owns && (best === null || candidate.dir.length > best.dir.length)) best = candidate;
  }
  return best;
}

function withoutExtension(relativePath) {
  for (const extension of extensions) {
    if (relativePath.endsWith(extension)) return relativePath.slice(0, -extension.length);
  }
  if (relativePath.endsWith("/index")) return relativePath.slice(0, -"/index".length);
  if (relativePath.endsWith(".css")) return relativePath.slice(0, -4);
  return relativePath;
}

/** Remove comments, keeping strings intact, so identifier rules do not match prose. */
function stripComments(text) {
  let result = "";
  let index = 0;
  let quote = null;
  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];
    if (quote !== null) {
      result += char;
      if (char === "\\") {
        result += text[index + 1] ?? "";
        index += 2;
        continue;
      }
      if (char === quote) quote = null;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      result += char;
      index += 1;
      continue;
    }
    if (char === "/" && next === "/") {
      while (index < text.length && text[index] !== "\n") index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      index += 2;
      while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) index += 1;
      index += 2;
      continue;
    }
    result += char;
    index += 1;
  }
  return result;
}

function importsOf(text) {
  const imports = new Map();
  const record = (specifier, symbols) => {
    const existing = imports.get(specifier) ?? new Set();
    for (const symbol of symbols) existing.add(symbol);
    imports.set(specifier, existing);
  };

  for (const match of text.matchAll(/\bimport\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
    const symbols = (match[1] ?? "")
      .split(",")
      .map((part) => part.trim().split(/\s+as\s+/)[0]?.trim() ?? "")
      .filter(Boolean);
    record(match[2], symbols);
  }
  for (const match of text.matchAll(/\bfrom\s*["']([^"']+)["']/g)) record(match[1], []);
  for (const match of text.matchAll(/\bimport\s*["']([^"']+)["']/g)) record(match[1], []);
  return imports;
}

function edgeRule(source, target) {
  if (source.layer === "fact" && target.layer === "coordinator") return "fact-imports-coordinator";
  if (source.layer === "analysis") {
    if (target.layer === "persistence") return "analysis-imports-storage";
    if (target.name === "clock") return "analysis-imports-clock";
    if (target.layer === "domain-pure") return "analysis-imports-calendar";
    return "analysis-imports-module";
  }
  if (source.layer === "presentation" && target.layer === "persistence") {
    return "presentation-imports-persistence";
  }
  return "layer-edge";
}

/**
 * Analyze one file as if it lived at `virtualPath` (project-root-relative). Fixtures use this to
 * stand in for a module without being compiled or placed in the real tree.
 */
export function analyze(text, virtualPath) {
  const violations = [];
  const source = moduleOf(virtualPath);
  if (source === undefined || source === null) {
    return [
      {
        rule: "undeclared-module",
        file: virtualPath,
        detail: "no declared module owns this path; declare its layer and permitted edges",
      },
    ];
  }

  const code = stripComments(text);
  const virtualDirectory = dirname(virtualPath);

  for (const [specifier, symbols] of importsOf(code)) {
    if (!specifier.startsWith(".")) {
      if (specifier === valuePackage && source.layer !== "value" && virtualPath.startsWith("src/")) {
        violations.push({
          rule: "decimal-outside-values",
          file: virtualPath,
          detail: `${valuePackage} is imported by ${source.name} (${source.layer})`,
        });
      }
      continue;
    }

    const targetPath = withoutExtension(
      toPosix(relative(root, resolve(join(root, virtualDirectory), specifier))),
    );
    const target = moduleOf(targetPath);
    if (target === undefined || target === null) {
      violations.push({
        rule: "undeclared-module",
        file: virtualPath,
        detail: `import ${specifier} resolves to ${targetPath}, which no declared module owns`,
      });
      continue;
    }

    const forbidden = (forbiddenSymbols[source.name] ?? []).find(
      (entry) => entry.fromLayer === target.layer && symbols.has(entry.symbol),
    );
    if (forbidden !== undefined) {
      violations.push({
        rule: `analysis-imports-${forbidden.symbol.toLowerCase()}`,
        file: virtualPath,
        detail: `${source.name} imports raw ${forbidden.symbol} from ${target.name}`,
      });
      continue;
    }

    const permitted = moduleEdges[source.name] ?? layerEdges[source.layer] ?? [];
    const allowed =
      target.name === source.name || permitted.includes("*") || permitted.includes(target.layer);
    if (!allowed) {
      violations.push({
        rule: edgeRule(source, target),
        file: virtualPath,
        detail: `${source.name} (${source.layer}) imports ${target.name} (${target.layer})`,
      });
    }
  }

  if (virtualPath.startsWith("src/")) {
    if (
      /\bindexedDB\b/.test(code) &&
      !virtualPath.startsWith(protectedDirectories.indexedDB)
    ) {
      violations.push({
        rule: "indexeddb-outside-persistence",
        file: virtualPath,
        detail: `indexedDB is used outside ${protectedDirectories.indexedDB}`,
      });
    }

    if (!virtualPath.startsWith(protectedDirectories.hostIdentifiers)) {
      for (const identifier of hostIdentifiers) {
        if (identifier.pattern.test(code)) {
          violations.push({
            rule: "host-api-outside-host-port",
            file: virtualPath,
            detail: `${identifier.name} is used outside ${protectedDirectories.hostIdentifiers}`,
          });
          break;
        }
      }
    }
  }

  return violations;
}

function report(violation) {
  return `${violation.file}: ${violation.rule} — ${violation.detail}`;
}

function runTree() {
  const files = [...walk("src"), ...walk("tests")];
  const violations = files.flatMap((file) => analyze(readFileSync(join(root, file), "utf8"), file));
  for (const violation of violations) console.error(report(violation));
  console.log(`${files.length} files, ${violations.length} violations`);
  process.exit(violations.length === 0 ? 0 : 1);
}

function runFixtures(directory) {
  const expected = JSON.parse(readFileSync(join(root, directory, "expected.json"), "utf8"));
  const missed = [];
  let reported = 0;

  for (const fixture of expected) {
    const text = readFileSync(join(root, directory, fixture.file), "utf8");
    const violations = analyze(text, fixture.virtualPath);
    const match = violations.find((violation) => violation.rule === fixture.rule);
    if (match === undefined) {
      missed.push(fixture);
      console.error(`${fixture.file}: expected ${fixture.rule} — not reported`);
      continue;
    }
    reported += 1;
    console.log(`${fixture.file}: ${match.rule} — ${match.detail}`);
    for (const extra of violations) {
      if (extra.rule !== fixture.rule) {
        console.error(`${fixture.file}: unexpected extra violation ${extra.rule} — ${extra.detail}`);
        missed.push(fixture);
      }
    }
  }

  console.log(`${expected.length} fixtures, ${reported} violations, ${missed.length} missed`);
  process.exit(missed.length === 0 && reported === expected.length ? 0 : 1);
}

const fixturesAt = process.argv.indexOf("--fixtures");
if (fixturesAt >= 0) {
  const directory = process.argv[fixturesAt + 1];
  if (directory === undefined) {
    console.error("--fixtures needs a directory");
    process.exit(2);
  }
  runFixtures(directory);
} else {
  runTree();
}
