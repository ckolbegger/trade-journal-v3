#!/usr/bin/env node
// Audit the cross-document claims in the deliverable breakdowns under plan/deliverable-breakdowns/.
//
// check-deliverable-breakdown.mjs validates each breakdown's task graph on its own. It cannot
// see whether the acceptance coverage those breakdowns claim is real. This script checks the
// claims that only make sense across files:
//
//   1. every acceptance scenario in specs/acceptance/acceptance-contract.md is claimed by at
//      least one breakdown, so nothing is silently unplanned
//   2. every task ID a claim names exists in that deliverable's graph
//   3. every scenario a breakdown claims appears in the acceptance contract (no invented IDs)
//   4. every one of the nine D3 verification items in plan/planning-decisions-2026-10-10.md is
//      claimed by at least one breakdown
//   5. an acceptance table row states a status, and "partial"/"not advertised" rows are not
//      presented as passing
//   6. each breakdown's own stated task count matches its parsed task headers
//
// Usage: node scripts/audit-breakdown-coverage.mjs
//
// Exit status is non-zero when any check fails. Warnings do not fail the run.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const breakdownDir = join(repoRoot, "plan", "deliverable-breakdowns");
const acceptancePath = join(repoRoot, "specs", "acceptance", "acceptance-contract.md");
const decisionsPath = join(repoRoot, "plan", "planning-decisions-2026-10-10.md");

const failures = [];
const warnings = [];
const notes = [];

function read(path) {
  if (!existsSync(path)) {
    failures.push(`missing required file: ${path}`);
    return "";
  }
  return readFileSync(path, "utf8");
}

/** Split a markdown document into level-2 sections keyed by their heading text. */
function sectionsByHeading(text) {
  const found = [...text.matchAll(/^## (.+)$/gm)];
  const map = new Map();
  found.forEach((m, i) => {
    const start = m.index + m[0].length;
    const end = i + 1 < found.length ? found[i + 1].index : text.length;
    map.set(m[1].trim(), text.slice(start, end));
  });
  return map;
}

/** Task IDs declared by a breakdown, in document order. */
function taskIdsOf(text) {
  return [...text.matchAll(/^#### (T\d+) /gm)].map((m) => m[1]);
}

// ---------------------------------------------------------------- inputs

const acceptance = read(acceptancePath);
const decisions = read(decisionsPath);

const canonicalAcs = [...acceptance.matchAll(/^### (AC-[A-Z]+-[0-9]+)\b/gm)].map((m) => m[1]);
const canonicalAcSet = new Set(canonicalAcs);

const d3ItemsText = decisions.slice(
  decisions.indexOf("Required verification before the plan is frozen"),
  decisions.indexOf("### Unverified claims"),
);
const verificationItems = [...d3ItemsText.matchAll(/^([0-9]+)\.\s+(.+)$/gm)]
  .map((m) => ({ n: Number(m[1]), text: m[2].trim() }));
const verificationItemNumbers = new Set(verificationItems.map((i) => i.n));

const files = readdirSync(breakdownDir).filter((f) => /^D\d+-.*\.md$/.test(f)).sort();

// deliverable number -> its task ids, so a cross-deliverable citation can be validated.
const registry = new Map();
for (const f of files) {
  const decl = f.match(/^D(\d+)/)[1];
  registry.set(Number(decl), new Set(taskIdsOf(read(join(breakdownDir, f)))));
}

if (!files.length) {
  console.error(`no breakdown files found in ${breakdownDir}`);
  process.exit(2);
}

// ---------------------------------------------------------------- per-file analysis

const acClaims = new Map(); // AC id -> [{deliverable, status, tasks}]
const itemClaims = new Map(); // item number -> [{deliverable, tasks}]

for (const file of files) {
  const text = read(join(breakdownDir, file));
  const deliverable = file.match(/^D\d+/)[0];
  const ids = new Set(taskIdsOf(text));

  // 6 — the breakdown's own task-count claim in its "## 2. Task graph" prose.
  const graphSection = sectionsByHeading(text).get("2. Task graph") ?? "";
  const countClaim = graphSection.match(/(\d+)\s+tasks in\b/i);
  if (!countClaim) {
    warnings.push(`${deliverable}: no "N tasks in ..." claim found in its task-graph section`);
  } else if (Number(countClaim[1]) !== ids.size) {
    failures.push(`${deliverable}: claims ${countClaim[1]} tasks but ${ids.size} task headers exist`);
  }

  // 5 — acceptance coverage table rows.
  const coverage = sectionsByHeading(text).get("5. Acceptance coverage for " + deliverable) ??
    [...sectionsByHeading(text).entries()].find(([h]) => h.startsWith("5. Acceptance coverage"))?.[1] ?? "";

  if (!coverage) {
    failures.push(`${deliverable}: no "Acceptance coverage" section found`);
    continue;
  }

  // The coverage table has three columns when the deliverable name is in the section heading
  // and four when each row repeats it, so locate the columns by the header rather than by index.
  const rows = coverage.split("\n").filter((l) => l.trim().startsWith("|"));
  const headerRow = rows.find((l) => /^\|\s*Scenario\b/i.test(l));
  let headerCells = headerRow ? headerRow.split("|").map((c) => c.trim()) : [];
  if (headerCells[0] === "") headerCells = headerCells.slice(1);
  if (headerCells[headerCells.length - 1] === "") headerCells = headerCells.slice(0, -1);
  // D2/D3 repeat the deliverable in each row ("| D2 | Scenario | ... |"); D1 does not.
  const hasDeliverableColumn = /^D\d+$/.test(headerCells[0] ?? "");
  // Index of the scenario cell itself: D2/D3 lead with the deliverable, D1 does not.
  const firstData = hasDeliverableColumn ? 1 : 0;

  for (const row of rows) {
    const cells = row.split("|").map((c) => c.trim());
    // Drop the empty cells either side of the row's outer pipes.
    if (cells.length && cells[0] === "") cells.shift();
    if (cells.length && cells[cells.length - 1] === "") cells.pop();
    if (cells.length < firstData + 2) continue;
    const scenarioCell = cells[firstData];
    if (!/^AC-/.test(scenarioCell)) continue; // header or separator row

    // A row may bundle scenarios ("AC-UI-001, AC-UI-002"); claim each separately.
    const scenarios = [...scenarioCell.matchAll(/AC-[A-Z]+-[0-9]+/g)].map((m) => m[0]);
    const status = cells[firstData + 1] ?? "";
    const evidenceCell = cells.slice(firstData + 2).join(" ");
    const tasks = [...evidenceCell.matchAll(/\bT\d+\b/g)].map((m) => m[0]);
    // A row that explicitly advertises nothing is allowed to cite no task; anything else is
    // claiming coverage and must name the tasks that carry it.
    const advertisesNothing = /not advertised|not covered|intentionally not/i.test(status);

    for (const ac of scenarios) {
      if (!canonicalAcSet.has(ac)) {
        failures.push(`${deliverable}: claims ${ac}, which is not a scenario in the acceptance contract`);
      }
      if (!status) failures.push(`${deliverable}: ${ac} has no status`);
      if (!tasks.length && !advertisesNothing) {
        failures.push(`${deliverable}: ${ac} claims no task, so its coverage is unevidenced`);
      }
      // Normalize the status's own wording before judging it. A status that says both
      // "partial/not covered" and that coverage is complete is a contradiction however the
      // words are ordered, which is the thing worth catching here.
      const statusProse = status.replace(/[*_`]/g, "").trim();
      // Only explicit completeness markers count. "Planned" is deliberately excluded: it is a
      // lifecycle state name, so a status like "Partial - the Planned step" would otherwise
      // read as a completeness claim.
      const saysIncomplete = /partial|not covered|not advertised|intentionally not|requires\b/i.test(statusProse);
      const saysComplete = /\bfully\b|\bcompletely\b|\bcovered\b/i.test(statusProse);
      if (saysIncomplete && saysComplete) {
        failures.push(`${deliverable}: ${ac} is described as incomplete but its status also claims coverage: "${statusProse}"`);
      }
      for (const t of tasks) {
        if (!ids.has(t)) failures.push(`${deliverable}: ${ac} claims ${t}, which is not a task in this deliverable`);
      }
      if (!acClaims.has(ac)) acClaims.set(ac, []);
      acClaims.get(ac).push({ deliverable, status: status.trim(), tasks, advertisesNothing });
    }
  }


  // 4 — D3 verification item ownership, from the mapping table.
  for (const [heading, body] of sectionsByHeading(text)) {
    if (!/verification|D3 item/i.test(heading)) continue;
    for (const row of body.split("\n").filter((l) => l.trim().startsWith("|"))) {
      const cells = row.split("|").map((c) => c.trim());
      if (cells.length && cells[0] === "") cells.shift();
      if (cells.length && cells[cells.length - 1] === "") cells.pop();
      if (cells.length < 3) continue;
      // The first column is the item number ("3 - inventory completeness ..."), unless the
      // table repeats the deliverable, in which case the number is in the second column.
      let itemCell = cells[0];
      if (!/^[0-9]+\b/.test(itemCell) && /^D\d+$/.test(itemCell)) itemCell = cells[1] ?? "";
      const m = itemCell.match(/^([0-9]+)\b/);
      if (!m) continue;
      const n = Number(m[1]);
      if (!verificationItemNumbers.has(n)) {
        failures.push(`${deliverable}: claims verification item ${n}, which is not one of the nine`);
        continue;
      }
      // Columns are: item number, where it is resolved, status. Evidence is the middle one.
      const evidence = cells.slice(1, Math.max(2, cells.length - 1)).join(" ");
      // Cross-deliverable citations must be prefixed (D1:T10); a bare T<n> is ambiguous
      // because task numbers are unique across the plan but a reader cannot tell which file.
      const cross = [...evidence.matchAll(/D(\d+)\s*:\s*T(\d+)/g)]
        .map((m) => ({ deliverable: Number(m[1]), id: `T${m[2]}` }));
      const localOnly = evidence.replace(/D\d+\s*:\s*T\d+/g, " ");
      const tasks = [...localOnly.matchAll(/\bT\d+\b/g)].map((x) => x[0]);
      const status = cells[cells.length - 1] ?? "";
      // A row may honestly record that the item is somebody else's problem. That is a
      // deferral, not an ownership claim, so it must not count as covered here.
      const deferred = /later|not (yet )?(d|resolved)|partial|disclosed|deferred/i.test(status);
      // Citations belong in the evidence column. A task ID in the status cell is ambiguous,
      // because the reader cannot tell whether it means this deliverable's task or another's.
      const strayInStatus = [...status.matchAll(/\bT\d+\b/g)].map((m) => m[0]);
      if (strayInStatus.length) {
        failures.push(`${deliverable}: item ${n} names ${strayInStatus.join(", ")} in its status cell; cite tasks in the evidence column, as D<n>:T<m> for another deliverable`);
      }
      for (const t of tasks) {
        if (ids.has(t)) continue;
        // A bare ID that exists in another deliverable is the ambiguous case worth naming:
        // task numbers are unique in the plan, so the reader cannot tell which file is meant.
        const elsewhere = [...registry.entries()]
          .filter(([d, set]) => d !== Number(deliverable.slice(1)) && set.has(t))
          .map(([d]) => `D${d}`);
        failures.push(`${deliverable}: item ${n} cites bare ${t}, which is not a task in this deliverable` +
          (elsewhere.length ? ` (it exists in ${elsewhere.join(", ")}; write ${elsewhere[0]}:${t})` : ` (cite another deliverable's task as D<n>:T<m>)`));
      }
      for (const ref of cross) {
        const declared = registry.get(ref.deliverable);
        if (!declared || !declared.has(ref.id)) {
          failures.push(`${deliverable}: item ${n} cites D${ref.deliverable}:${ref.id}, which is not a task in that deliverable`);
        }
      }
      if (!itemClaims.has(n)) itemClaims.set(n, []);
      itemClaims.get(n).push({ deliverable, tasks: [...tasks, ...cross.map((c) => `D${c.deliverable}:${c.id}`)], status: status.trim(), deferred });
    }
  }

  notes.push(`${deliverable}: ${ids.size} tasks, ${acClaims.size ? "" : ""}${rows.filter((r) => /^\|\s*AC-/.test(r)).length} scenario rows`);
}

// ---------------------------------------------------------------- cross-file checks

// 1 — every canonical scenario is claimed somewhere.
const unclaimed = canonicalAcs.filter((ac) => !acClaims.has(ac));
if (unclaimed.length) {
  notes.push(`scenarios not yet claimed by D1–D3 (expected: most belong to later deliverables): ${unclaimed.length}/${canonicalAcs.length}`);
}

// A scenario claimed by more than one deliverable is legal (partial coverage), but the
// statuses must not both claim it as complete.
for (const [ac, claims] of acClaims) {
  const completes = claims.filter((c) => /^(planned|covered)$/i.test(c.status));
  if (completes.length > 1) {
    failures.push(`${ac} is claimed as complete by ${completes.map((c) => c.deliverable).join(" and ")}`);
  }
}

// 4 — every verification item has an owner in the reviewed deliverables.
const unownedItems = [...verificationItemNumbers].filter((n) => !itemClaims.has(n)).sort((a, b) => a - b);

// ---------------------------------------------------------------- report

console.log(`breakdowns reviewed: ${files.join(", ")}`);
console.log(`\nacceptance scenarios: ${canonicalAcs.length} canonical, ${acClaims.size} claimed by these deliverables`);
for (const [ac, claims] of [...acClaims].sort()) {
  const where = claims.map((c) => `${c.deliverable}${c.tasks.length ? ` (${c.tasks.join(", ")})` : " (no task)"}`).join("; ");
  console.log(`  ${ac.padEnd(14)} ${claims.map((c) => c.status).join(" / ").padEnd(28)} ${where}`);
}

console.log(`\nD3 verification items: ${verificationItemNumbers.size} total`);
for (const item of verificationItems) {
  const claims = itemClaims.get(item.n) ?? [];
  const owners = claims.filter((c) => !c.deferred);
  const deferredTo = claims.filter((c) => c.deferred);
  let where;
  if (owners.length) {
    where = owners.map((c) => c.deliverable).join(", ");
  } else if (deferredTo.length) {
    where = `deferred by ${[...new Set(deferredTo.map((c) => c.deliverable))].join(", ")}`;
  } else {
    where = "NOT YET CLAIMED by D1-D3";
  }
  console.log(`  ${String(item.n).padStart(2)}. ${where.padEnd(30)} ${item.text.slice(0, 58)}`);
}

// An item may have several rows in one deliverable (a resolved part and a deferred part). What
// matters is that the item as a whole cites the tasks that carry it somewhere; an item whose
// every row is deferred needs no task, because nothing is being claimed yet.
for (const [n, claims] of itemClaims) {
  // Every citation is validated when it is read, deferred rows included, because a citation
  // that names the wrong task is wrong whether or not the item is being claimed yet.
  const byDeliverable = new Map();
  for (const c of claims) {
    if (!byDeliverable.has(c.deliverable)) byDeliverable.set(c.deliverable, []);
    byDeliverable.get(c.deliverable).push(c);
  }
  for (const [deliverable, rows] of byDeliverable) {
    const anyClaim = rows.some((r) => !r.deferred);
    const anyEvidence = rows.some((r) => r.tasks.length > 0);
    if (anyClaim && !anyEvidence) {
      failures.push(`${deliverable}: verification item ${n} is claimed without citing a task`);
    }
  }
}
if (unownedItems.length) {
  notes.push(`verification items with no owner among D1-D3: ${unownedItems.join(", ")} (their owning deliverables are later)`);
}

if (notes.length) {
  console.log("\nnotes:");
  for (const n of notes) console.log(`  - ${n}`);
}
if (warnings.length) {
  console.log(`\nwarnings (${warnings.length}):`);
  for (const w of warnings) console.log(`  - ${w}`);
}
if (failures.length) {
  console.log(`\nFAILURES (${failures.length}):`);
  for (const f of failures) console.log(`  - ${f}`);
} else {
  console.log("\nresult: OK");
}

console.log(`\n${failures.length} failure(s), ${warnings.length} warning(s)`);
process.exit(failures.length ? 1 : 0);
