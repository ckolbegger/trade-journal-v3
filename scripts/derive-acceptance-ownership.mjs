#!/usr/bin/env node
// Derive the acceptance-to-evidence row data Phase 4 needs, without guessing.
//
// For every scenario in specs/acceptance/acceptance-contract.md this prints:
//   - which D1-D7 breakdowns claim it, and with what status
//   - which deliverable owns it according to the `AC:` line in vertical-deliverables.md
//   - a flag when no deliverable owns it at all
//
// The ownership read expands range notation ("AC-RPT-001…006"), which a naive ID scan
// misses. Usage: node scripts/derive-acceptance-ownership.mjs

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const acceptance = read("specs/acceptance/acceptance-contract.md");
const scenarios = [...acceptance.matchAll(/^### (AC-[A-Z]+-[0-9]+)\s+—\s+(.+)$/gm)].map(
  (m) => ({ id: m[1], title: m[2].trim() }),
);

/** Expand "AC-RPT-001…006" and plain IDs into a list of canonical IDs. */
function expandIds(text) {
  const ids = [];
  const re = /AC-([A-Z]+)-(\d+)\s*(?:…|\.\.\.)\s*(\d+)|AC-([A-Z]+)-(\d+)/g;
  let m;
  while ((m = re.exec(text))) {
    if (m[3]) {
      for (let i = Number(m[2]); i <= Number(m[3]); i += 1) ids.push(`AC-${m[1]}-${String(i).padStart(3, "0")}`);
    } else {
      ids.push(`AC-${m[4]}-${m[5]}`);
    }
  }
  return ids;
}

// Owners: the first `AC:` paragraph of each deliverable section.
const vertical = read("plan/vertical-deliverables.md");
const sections = [...vertical.matchAll(/^## (D[0-9]+) — .+$/gm)];
const owners = new Map();
sections.forEach((m, i) => {
  const body = vertical.slice(m.index, i + 1 < sections.length ? sections[i + 1].index : vertical.length);
  const ac = body.match(/`AC:`([\s\S]*?)(?:\n\n|$)/);
  if (!ac) return;
  for (const id of expandIds(ac[1])) {
    if (!owners.has(id)) owners.set(id, []);
    if (!owners.get(id).includes(m[1])) owners.get(id).push(m[1]);
  }
});

// Claims: every AC row in a D1-D7 breakdown's section 5, with its status cell.
const claims = new Map();
const dir = "plan/deliverable-breakdowns";
for (const name of readdirSync(join(root, dir)).filter((n) => /^D[1-7]-.*\.md$/.test(n))) {
  const deliverable = name.match(/^D[0-9]+/)[0];
  const text = read(join(dir, name));
  const coverage = text.match(/^## 5\. Acceptance coverage[\s\S]*?(?=^## )/m);
  if (!coverage) continue;
  for (const line of coverage[0].split("\n")) {
    if (!/^\|\s*AC-/.test(line)) continue;
    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    const status = cells[1] ?? "";
    for (const id of expandIds(cells[0] ?? "")) {
      if (!claims.has(id)) claims.set(id, []);
      claims.get(id).push({ deliverable, status: /^covered/i.test(status) ? "Covered" : "Partial" });
    }
  }
}

console.log("| Scenario | Title | Claimed by D1–D7 | Owner per vertical-deliverables | Note |");
console.log("|---|---|---|---|---|");
let unowned = 0;
let unclaimed = 0;
for (const s of scenarios) {
  const c = claims.get(s.id) ?? [];
  const o = owners.get(s.id) ?? [];
  if (!c.length) unclaimed += 1;
  if (!o.length) unowned += 1;
  const note = !o.length ? "**no owning deliverable**" : !c.length ? "planned only" : "";
  console.log(
    `| ${s.id} | ${s.title} | ${c.length ? c.map((x) => `${x.deliverable} (${x.status})`).join(", ") : "—"} | ${
      o.length ? o.join(", ") : "—"
    } | ${note} |`,
  );
}
console.log(
  `\n${scenarios.length} scenarios: ${scenarios.length - unclaimed} claimed by D1–D7, ${unclaimed} unclaimed, ${unowned} with no owning deliverable.`,
);
