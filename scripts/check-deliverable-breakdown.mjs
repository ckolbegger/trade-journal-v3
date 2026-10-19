#!/usr/bin/env node
// Validate the task graph inside a deliverable breakdown under plan/deliverable-breakdowns/.
//
// A breakdown asserts a dependency-ordered task graph in prose ("Blocking edges:") and
// draws it once in a mermaid flowchart. Prose and diagram drift silently, and a cycle in
// the graph is invisible to a reader. This checker parses both representations out of the
// markdown and cross-checks them, so planning-protocol.md's "explicit blocking edges"
// requirement is mechanically verifiable instead of asserted.
//
// Usage: node scripts/check-deliverable-breakdown.mjs <breakdown.md> [...]
//
// Checks:
//   1. every task header declares a type (S = structural, B = behaviour-bearing)
//   2. every task header declares "Blocking edges:"
//   3. every referenced edge endpoint is a declared task
//   4. the prose graph is acyclic (DFS)
//   5. the diagram graph is acyclic (DFS)
//   6. diagram edges and prose edges agree in both directions
//   7. every task appears in the diagram (no orphan task headers)
//   8. every structural task body states an exact verification ("Exact verification")
//   9. warnings: self-edges, mutual blocking pairs, non-root tasks with no edges either way
//
// Exit status is non-zero when any check fails. Warnings do not fail the run.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

/** Read a file, reporting a missing file as a failure rather than a stack trace. */
function readOrExit(path) {
  try {
    return readFileSync(path, "utf8");
  } catch (err) {
    console.error(`error: cannot read ${path}: ${err.message}`);
    process.exit(2);
  }
}

/**
 * Return the body of one section: everything after the opening heading's line, up to the
 * next heading at the same or a higher level (a "## " section is not closed by an "###").
 * The level is taken from the heading text itself, so callers pass the heading verbatim.
 */
function section(text, heading) {
  const start = text.indexOf(heading);
  if (start === -1) return "";
  const level = (heading.match(/^#+/) ?? ["#"])[0].length;
  const bodyStart = text.indexOf("\n", start + heading.length);
  if (bodyStart === -1) return "";
  const rest = text.slice(bodyStart);
  // rest[0] ends the opening heading's line and rest[1] is the blank line after it. The
  // search must begin at rest[2]: starting it on rest[1] would let a leading newline match
  // the pattern's own leading \n at offset 0 and truncate the section to nothing.
  const closer = new RegExp(`\\n#{1,${level}} `);
  const relative = rest.slice(2).search(closer);
  const bodyEnd = relative === -1 ? rest.length : relative + 1;
  return rest.slice(0, bodyEnd).trim();
}

/** Extract every task header and its declared metadata from the task-detail section. */
function parseTasks(detail) {
  const tasks = [];
  const header = /^#### (T\d+) — `([SB])` (.+)$/gm;
  const found = [...detail.matchAll(header)];

  found.forEach((match, i) => {
    const bodyStart = match.index + match[0].length;
    const bodyEnd = i + 1 < found.length ? found[i + 1].index : detail.length;
    const body = detail.slice(bodyStart, bodyEnd);

    const edgesMatch = body.match(/\*\*Blocking edges:\*\*\s*([^\n]*)/);

    // "none (root)" is the documented no-dependency form. A declaration may mix local
    // tasks ("T37") with cross-deliverable tasks ("D1:T9"), so cross-references are pulled
    // out first and the remainder is read as local edges.
    const edgeText = edgesMatch ? edgesMatch[1] : "";
    const isNone = /^\s*none\b/i.test(edgeText);
    const crossRefs = isNone ? [] : [...edgeText.matchAll(/D(\d+)\s*:\s*T(\d+)/g)]
      .map((m) => ({ deliverable: Number(m[1]), id: `T${m[2]}` }));
    const localText = edgeText.replace(/D\d+\s*:\s*T\d+/g, " ");
    const edges = isNone ? [] : [...localText.matchAll(/T\d+/g)].map((m) => m[0]);

    tasks.push({
      id: match[1],
      type: match[2],
      title: match[3].trim(),
      edges,
      crossRefs,
      hasEdgesDecl: Boolean(edgesMatch),
      hasExactVerification: /Exact verification/.test(body) || match[2] === "B",
      line: detail.slice(0, match.index).split("\n").length,
    });
  });

  return tasks;
}

/**
 * Parse mermaid edge chains: "A --> B --> C" yields the two adjacency steps.
 *
 * Convention: the diagram draws an arrow from a prerequisite to the task it unblocks
 * ("T1 --> T2" means T1 blocks T2), while a task body declares its prerequisites
 * ("Blocking edges: T1" on T2). Diagram edges are kept in that natural direction; the
 * comparison against the prose reverses them where a dependency closure is needed.
 */
function parseDiagram(graph) {
  const edges = new Set();
  const nodes = new Set();

  for (const raw of graph.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("flowchart") || line.startsWith("subgraph")) continue;
    if (line.startsWith("end") || line.startsWith("direction") || line.startsWith("classDef")) continue;
    if (!line.includes("-->")) continue;
    // Drop any "|label|" so it cannot be mistaken for an endpoint.
    const cleaned = line.replace(/\|[^|]*\|/g, " ");
    const chain = cleaned.split("-->").map((part) => part.trim());
    for (let i = 0; i < chain.length - 1; i += 1) {
      const from = chain[i].match(/^T\d+/);
      const to = chain[i + 1].match(/^T\d+/);
      if (!from || !to) continue;
      // Natural direction: "from --> to" means "from blocks to".
      edges.add(`${from[0]}->${to[0]}`);
      nodes.add(from[0]);
      nodes.add(to[0]);
    }
  }

  return { edges, nodes };
}

/** DFS cycle detection returning the first cycle found, if any. */
function findCycle(ids, adjacency) {
  const state = new Map(ids.map((id) => [id, "white"]));
  const stack = [];
  let cycle = null;

  const visit = (id) => {
    if (cycle) return;
    state.set(id, "grey");
    stack.push(id);
    for (const next of adjacency.get(id) ?? []) {
      if (!state.has(next)) continue;
      if (state.get(next) === "grey") {
        cycle = [...stack.slice(stack.indexOf(next)), next];
        return;
      }
      if (state.get(next) === "white") visit(next);
      if (cycle) return;
    }
    stack.pop();
    state.set(id, "black");
  };

  for (const id of ids) {
    if (state.get(id) === "white") visit(id);
    if (cycle) break;
  }

  return cycle;
}

/** Kahn topological sort of the prose graph, returning layer-free order plus any residue. */
function topologicalOrder(ids, adjacency) {
  const indegree = new Map(ids.map((id) => [id, 0]));
  for (const from of ids) {
    for (const to of adjacency.get(from) ?? []) {
      if (indegree.has(to)) indegree.set(to, indegree.get(to) + 1);
    }
  }

  const ready = ids.filter((id) => indegree.get(id) === 0);
  const order = [];
  while (ready.length) {
    // Stable, document-ordered output keeps the report diffable between runs.
    ready.sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
    const id = ready.shift();
    order.push(id);
    for (const to of adjacency.get(id) ?? []) {
      if (!indegree.has(to)) continue;
      indegree.set(to, indegree.get(to) - 1);
      if (indegree.get(to) === 0) ready.push(to);
    }
  }

  return { order, unresolved: ids.filter((id) => !order.includes(id)) };
}

function checkFile(path, knownTaskIds = new Map()) {
  const text = readOrExit(path);
  const failures = [];
  const warnings = [];

  const detail = section(text, "## 3. Task detail");
  const tasks = parseTasks(detail);
  if (!tasks.length) {
    console.error(`FAIL ${path}: no task headers found in "## 3. Task detail"`);
    console.error(`  text length ${text.length}; section length ${detail.length}`);
    console.error(`  section starts ${JSON.stringify(detail.slice(0, 200))}`);
    console.error(`  section ends   ${JSON.stringify(detail.slice(-120))}`);
    console.error(`  header-shaped lines in section: ${(detail.match(/^#### T\d+/gm) ?? []).length}`);
    console.error(`  header-shaped lines in file:    ${(text.match(/^#### T\d+/gm) ?? []).length}`);
    return { failures: 1, warnings: 0, tasks: 0 };
  }

  const ids = tasks.map((t) => t.id);
  const known = new Set(ids);
  // Local edges only. Cross-deliverable edges point outside this graph, so they are validated
  // against the other deliverable's task set rather than against this diagram.
  const crossEdges = new Set();
  // adjacency[prerequisite] = tasks it blocks. A task body declares its prerequisites
  // ("Blocking edges: T1" on T2 means T1 blocks T2), so the edge is stored in the blocking
  // direction: T1 -> T2. Cycle detection and the topological sort both need this direction.
  const adjacency = new Map(ids.map((id) => [id, []]));

  // 1, 2, 3
  for (const task of tasks) {
    if (!task.hasEdgesDecl) failures.push(`${task.id}: missing "Blocking edges:" declaration`);
    if (task.edges.includes(task.id)) warnings.push(`${task.id}: declares itself as a blocking edge`);
    for (const edge of task.edges) {
      if (!known.has(edge)) {
        failures.push(`${task.id}: blocking edge ${edge} is not a declared task (write a cross-deliverable edge as D<n>:T<m>)`);
      } else if (edge !== task.id) {
        adjacency.get(edge).push(task.id);
      }
    }
    for (const ref of task.crossRefs) {
      crossEdges.add(`D${ref.deliverable}:${ref.id}`);
      const declared = knownTaskIds.get(ref.deliverable);
      if (!declared) {
        failures.push(`${task.id}: cross-deliverable edge D${ref.deliverable}:${ref.id} names a deliverable with no breakdown file`);
      } else if (!declared.has(ref.id)) {
        failures.push(`${task.id}: cross-deliverable edge D${ref.deliverable}:${ref.id} is not a task in that deliverable`);
      }
    }
    if (task.type === "S" && !task.hasExactVerification) {
      failures.push(`${task.id}: structural task states no "Exact verification"`);
    }
  }

  /** Dependency-direction adjacency (task -> its prerequisites), for reference and warnings. */
  const dependsOn = new Map(ids.map((id) => [id, []]));
  for (const task of tasks) {
    for (const edge of task.edges) {
      if (known.has(edge) && edge !== task.id) dependsOn.get(task.id).push(edge);
    }
  }

  // 4
  const proseCycle = findCycle(ids, adjacency);
  if (proseCycle) failures.push(`prose graph has a cycle: ${proseCycle.join(" -> ")}`);

  // 5, 6, 7
  const { edges: diagramEdges, nodes: diagramNodes } = parseDiagram(section(text, "```mermaid"));
  const proseEdges = new Set();
  for (const [from, tos] of adjacency) for (const to of tos) proseEdges.add(`${from}->${to}`);

  const diagramCycle = findCycle(
    ids,
    new Map(ids.map((id) => [id, [...diagramEdges].filter((e) => e.startsWith(`${id}->`)).map((e) => e.split("->")[1])])),
  );
  if (diagramCycle) failures.push(`diagram graph has a cycle: ${diagramCycle.join(" -> ")}`);

  if (diagramEdges.size === 0) failures.push("no diagram edges parsed; expected a mermaid flowchart with --> edges");

  // 6 — the prose and the diagram must describe the same dependency order.
  //
  // Comparing raw edge sets is wrong in both directions: a task legitimately declares a
  // direct prerequisite that the diagram already implies through a chain, and a diagram may
  // draw a direct edge for a dependency the prose reaches transitively. What must agree is
  // the *order* the two impose. That order is fully captured by each graph's transitive
  // reduction - the edges that are not implied by any longer path. So reduce both graphs
  // and compare the results; a leftover edge on either side is a real inconsistency.
  const buildGraph = (edges) => {
    const g = new Map(ids.map((id) => [id, []]));
    for (const edge of edges) {
      const [from, to] = edge.split("->");
      if (g.has(from) && g.has(to)) g.get(from).push(to);
    }
    return g;
  };

  /** Transitive reduction: drop every edge that some longer path already implies. */
  const reduce = (graph) => {
    const essential = new Set();
    for (const [from, tos] of graph) {
      for (const to of tos) {
        // Walk from `from` without using the direct edge, to see if `to` is still reachable.
        const seen = new Set([from]);
        const queue = [];
        for (const other of tos) if (other !== to) queue.push(other);
        let implied = false;
        while (queue.length) {
          const next = queue.shift();
          if (next === to) {
            implied = true;
            break;
          }
          if (seen.has(next)) continue;
          seen.add(next);
          for (const further of graph.get(next) ?? []) queue.push(further);
        }
        if (!implied) essential.add(`${from}->${to}`);
      }
    }
    return essential;
  };

  // Both graphs are already in the diagram's "blocks" direction ("A -> B" means A blocks B):
  // proseEdges was derived from the blocking-direction adjacency, and parseDiagram keeps the
  // arrows as drawn. So they are directly comparable without reversing either one.
  const proseGraph = buildGraph(proseEdges);
  const diagramGraph = buildGraph(diagramEdges);

  const proseEssential = reduce(proseGraph);
  const diagramEssential = reduce(diagramGraph);

  if (proseEssential.size === 0 && proseEdges.size > 0) {
    failures.push("prose graph collapsed to no essential edges; check for a cycle");
  }

  for (const edge of diagramEssential) {
    if (!proseEssential.has(edge)) {
      failures.push(`diagram edge ${edge} imposes an order the task bodies do not declare`);
    }
  }
  for (const edge of proseEssential) {
    if (!diagramEssential.has(edge)) {
      failures.push(`prose edge ${edge} is an essential dependency missing from the diagram`);
    }
  }

  for (const id of ids) if (!diagramNodes.has(id)) failures.push(`${id} never appears in the diagram`);
  for (const id of diagramNodes) if (!known.has(id)) failures.push(`diagram references undeclared task ${id}`);

  // 9
  // dependsOn[task] = its prerequisites, so inverting it yields "tasks that depend on X".
  const consumers = new Map(ids.map((id) => [id, []]));
  for (const [task, prereqs] of dependsOn) for (const prereq of prereqs) consumers.get(prereq).push(task);
  for (const task of tasks) {
    if (!task.edges.length && !consumers.get(task.id).length) {
      warnings.push(`${task.id}: no blocking edges and nothing consumes it (isolated)`);
    }
    for (const consumer of consumers.get(task.id)) {
      if (task.edges.includes(consumer)) {
        warnings.push(`${task.id} and ${consumer}: mutually blocking; confirm this is a call cycle and not a modelling error`);
      }
    }
  }

  const { order, unresolved } = topologicalOrder(ids, adjacency);
  const structural = tasks.filter((t) => t.type === "S").length;
  const behavioural = tasks.filter((t) => t.type === "B").length;

  const label = path.split("/").pop();
  console.log(`\n${label}`);
  console.log(`  tasks: ${tasks.length} (${structural} structural, ${behavioural} behaviour-bearing)`);
  console.log(`  edges: ${proseEdges.size} declared, ${diagramEdges.size} drawn` +
    (crossEdges.size ? `, ${crossEdges.size} cross-deliverable` : ``));
  if (crossEdges.size) console.log(`  cross-deliverable: ${[...crossEdges].sort().join(", ")}`);
  if (!proseCycle && !unresolved.length) {
    console.log(`  topological order: ${order.join(" -> ")}`);
  } else if (unresolved.length) {
    console.log(`  unresolved in topological order: ${unresolved.join(", ")}`);
  }


  if (warnings.length) {
    console.log(`  warnings (${warnings.length}):`);
    for (const w of warnings) console.log(`    - ${w}`);
  }
  if (failures.length) {
    console.log(`  FAILURES (${failures.length}):`);
    for (const f of failures) console.log(`    - ${f}`);
  } else {
    console.log("  result: OK");
  }

  return { failures: failures.length, warnings: warnings.length, tasks: tasks.length };
}

const paths = process.argv.slice(2);
if (!paths.length) {
  console.error("usage: node scripts/check-deliverable-breakdown.mjs <breakdown.md> [...]");
  process.exit(2);
}

// A cross-deliverable edge names a task in another deliverable, so the task sets of the
// sibling breakdowns in the same directory are loaded first. This is what lets D2 depend
// on D1's transaction seam and D3 depend on D2's Trade Record without inventing local IDs.
function loadDeliverableRegistry(directory) {
  const registry = new Map();
  let names;
  try {
    names = readdirSync(directory);
  } catch {
    return registry;
  }
  for (const name of names) {
    const match = name.match(/^D(\d+)-.*\.md$/);
    if (!match) continue;
    const tasks = parseTasks(section(readFileSync(join(directory, name), "utf8"), "## 3. Task detail"));
    registry.set(Number(match[1]), new Set(tasks.map((t) => t.id)));
  }
  return registry;
}

const registry = loadDeliverableRegistry(dirname(paths[0]));

let totalFailures = 0;
let totalWarnings = 0;
for (const path of paths) {
  const { failures, warnings } = checkFile(path, registry);
  totalFailures += failures;
  totalWarnings += warnings;
}

console.log(`\n${totalFailures} failure(s), ${totalWarnings} warning(s) across ${paths.length} file(s)`);
process.exit(totalFailures ? 1 : 0);
