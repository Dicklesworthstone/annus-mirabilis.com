import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDisplayTerms } from "./printed/displayTerms.ts";
import {
  assignQuantityColours,
  assignQuantityColoursPreferring,
  type ColourableEquation,
  PREFERRED_VIEW_NODE_BUDGET,
  QUANTITY_PALETTE,
  QuantityColourError,
} from "./quantityColours.ts";

// Frozen pre-optimization implementation. This allocation-heavy oracle deliberately keeps the
// original independent string/Map/Set search, so the indexed implementation must preserve its
// exact assignments, refusals and node counts, including backtracking and admission decisions.
function originalAssignment(
  equations: readonly ColourableEquation[],
  /**
   * Equations shown TOGETHER, as one view: a reading formula that names two records sets them
   * side by side, so their quantities must differ as if they were one equation. Each entry is a
   * list of equation ids.
   */
  shownTogether: readonly (readonly string[])[] = [],
  /**
   * A hard cap on the search's nodes (calls of the backtracking step), and a counter it adds its
   * own nodes to. Without a cap the search is exhaustive: proving that no colouring exists visited
   * 986,410 nodes on mass-energy's records (dispatch 230). With one, running out is a refusal of its
   * own, never a colouring, and a node count is the same on every run, as time is not.
   */
  options: Readonly<{
    nodeBudget?: number | undefined;
    stats?: { nodes: number } | undefined;
  }> = {},
): Readonly<Record<string, number>> {
  const ordered = [...equations].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const order: string[] = [];
  const hard = new Map<string, Set<string>>();
  const soft = new Map<string, Set<string>>();
  const join = (map: Map<string, Set<string>>, ids: readonly string[]) => {
    for (const a of ids) {
      const set = map.get(a) ?? new Set<string>();
      for (const b of ids) if (b !== a) set.add(b);
      map.set(a, set);
    }
  };
  const byArgument = new Map<string, Set<string>>();
  for (const e of ordered) {
    const ids = [...new Set(e.quantityIds)];
    if (ids.length > QUANTITY_PALETTE.length)
      throw new QuantityColourError(
        "equation-exceeds-palette",
        `${e.id} shows ${ids.length} quantities; the palette has ${QUANTITY_PALETTE.length} colours.`,
      );
    for (const id of ids) if (!order.includes(id)) order.push(id);
    join(hard, ids);
    const group = byArgument.get(e.argument) ?? new Set<string>();
    for (const id of ids) group.add(id);
    byArgument.set(e.argument, group);
  }
  for (const group of byArgument.values()) join(soft, [...group]);
  const quantitiesOf = new Map(ordered.map((e) => [e.id, e.quantityIds]));
  for (const ids of shownTogether) {
    const view = [...new Set(ids.flatMap((id) => quantitiesOf.get(id) ?? []))];
    if (view.length > QUANTITY_PALETTE.length)
      throw new QuantityColourError(
        "view-exceeds-palette",
        `${ids.join(" + ")} show ${view.length} quantities together; the palette has ${QUANTITY_PALETTE.length} colours.`,
      );
    join(hard, view);
  }

  const colours = new Map<string, number>();
  const neighbourSlots = (id: string, map: Map<string, Set<string>>) =>
    new Set(
      [...(map.get(id) ?? [])].flatMap((q) => {
        const slot = colours.get(q);
        return slot === undefined ? [] : [slot];
      }),
    );
  /** Lexicographic: is key a ranked above key b? */
  const above = (a: readonly number[], b: readonly number[]) => {
    for (const [i, v] of a.entries()) if (v !== b[i]) return v > (b[i] ?? 0);
    return false;
  };
  const next = (): string | undefined => {
    let best: string | undefined;
    let bestKey: readonly number[] = [];
    for (const [index, id] of order.entries()) {
      if (colours.has(id)) continue;
      const key = [neighbourSlots(id, hard).size, hard.get(id)?.size ?? 0, -index];
      if (best === undefined || above(key, bestKey)) {
        best = id;
        bestKey = key;
      }
    }
    return best;
  };
  let nodes = 0;
  const search = (): boolean => {
    nodes++;
    if (options.nodeBudget !== undefined && nodes > options.nodeBudget)
      throw new QuantityColourError(
        "search-budget-exceeded",
        `The colour search stopped at its budget of ${options.nodeBudget} nodes without an answer.`,
      );
    const id = next();
    if (id === undefined) return true;
    const blocked = neighbourSlots(id, hard);
    // How many of its argument's quantities hold each slot. A count, not a yes or no: relativity's
    // plane waves share their free quantities, every slot was held by one of them, and the flag let
    // three free quantities fall to the same lowest slot, four quantities in one colour where one
    // pair was all ten needed (dispatch 233).
    const crowd = new Map<number, number>();
    for (const q of soft.get(id) ?? []) {
      const slot = colours.get(q);
      if (slot !== undefined) crowd.set(slot, (crowd.get(slot) ?? 0) + 1);
    }
    const inPaper = new Set(colours.values());
    const candidates = QUANTITY_PALETTE.filter((c) => !blocked.has(c.slot)).sort(
      (a, b) =>
        (crowd.get(a.slot) ?? 0) - (crowd.get(b.slot) ?? 0) ||
        Number(inPaper.has(a.slot)) - Number(inPaper.has(b.slot)) ||
        a.slot - b.slot,
    );
    for (const c of candidates) {
      colours.set(id, c.slot);
      if (search()) return true;
      colours.delete(id);
    }
    return false;
  };
  let found: boolean;
  try {
    found = search();
  } finally {
    if (options.stats) options.stats.nodes += nodes;
  }
  if (!found)
    throw new QuantityColourError(
      "paper-not-colourable",
      `These equations cannot be coloured with ${QUANTITY_PALETTE.length} colours so that no equation repeats one.`,
    );
  return Object.freeze(Object.fromEntries(order.map((id) => [id, colours.get(id) as number])));
}

function originalPreferred(
  equations: readonly ColourableEquation[],
  preferred: readonly ColourableEquation[],
  shownTogether: readonly (readonly string[])[] = [],
  nodeBudget: number = PREFERRED_VIEW_NODE_BUDGET,
): Readonly<{
  slots: Readonly<Record<string, number>>;
  shared: readonly string[];
  /** Nodes visited by every search, admissions and final colouring together. */
  nodes: number;
}> {
  const stats = { nodes: 0 };
  const options = { nodeBudget, stats };
  // The records alone must colour; if they cannot, nothing printed is at fault.
  originalAssignment(equations, shownTogether, options);
  const order = [...preferred].sort(
    (a, b) => new Set(a.quantityIds).size - new Set(b.quantityIds).size || (a.id < b.id ? -1 : 1),
  );
  const admitted: ColourableEquation[] = [];
  const shared: string[] = [];
  for (const view of order) {
    try {
      originalAssignment([...equations, ...admitted, view], shownTogether, options);
      admitted.push(view);
    } catch (error) {
      if (!(error instanceof QuantityColourError) || error.code === "view-exceeds-palette")
        throw error;
      // Not colourable with this view, out of budget before an answer, or over the palette alone.
      shared.push(view.id);
    }
  }
  // A shared view's quantities are still coloured, each on its own, near its view's others.
  const loose = order
    .filter((view) => shared.includes(view.id))
    .flatMap((view) =>
      [...new Set(view.quantityIds)].map((id) => ({
        id: `${view.id}#${id}`,
        argument: view.argument,
        quantityIds: [id],
      })),
    );
  return {
    slots: originalAssignment([...equations, ...admitted, ...loose], shownTogether, options),
    shared: shared.sort(),
    nodes: stats.nodes,
  };
}

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

function outcome(
  assign: typeof assignQuantityColours,
  equations: readonly ColourableEquation[],
  together: readonly (readonly string[])[] = [],
  nodeBudget?: number,
) {
  // A caller may accumulate several searches. The budget is relative to this search, not stats.
  const stats = { nodes: 17 };
  try {
    const slots = assign(equations, together, { nodeBudget, stats });
    return {
      slots,
      keys: Object.keys(slots),
      frozen: Object.isFrozen(slots),
      nodes: stats.nodes - 17,
    };
  } catch (error) {
    if (!(error instanceof QuantityColourError)) throw error;
    return { code: error.code, message: error.message, nodes: stats.nodes - 17 };
  }
}

function preferredOutcome(
  assign: typeof assignQuantityColoursPreferring,
  equations: readonly ColourableEquation[],
  preferred: readonly ColourableEquation[],
  together: readonly (readonly string[])[],
  nodeBudget: number,
) {
  try {
    return assign(equations, preferred, together, nodeBudget);
  } catch (error) {
    if (!(error instanceof QuantityColourError)) throw error;
    return { code: error.code, message: error.message };
  }
}

/** Universal clique vertices reserve six slots; the remaining graph exercises three-colouring. */
function seededGraph(seed: number) {
  let state = seed;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
  const size = 11 + (next() % 5);
  const equations: ColourableEquation[] = [];
  for (let a = 0; a < size; a++) {
    equations.push({ id: `vertex-${a}`, argument: `arg-${next() % 4}`, quantityIds: [`q${a}`] });
    for (let b = a + 1; b < size; b++) {
      if (a >= 6 && next() % 100 >= 40) continue;
      equations.push({
        id: `edge-${a}-${b}`,
        argument: `arg-${next() % 4}`,
        // Duplicate occurrences must still count one neighbour, and one use of its slot.
        quantityIds: next() % 2 ? [`q${a}`, `q${b}`, `q${a}`] : [`q${a}`, `q${b}`],
      });
    }
  }
  const together = [[`vertex-${size - 1}`, `vertex-${size - 2}`, "unknown-equation"]];
  return { equations: seed % 2 ? equations.reverse() : equations, together };
}

function symbols(node: unknown): string[] {
  if (!node || typeof node !== "object") return [];
  const object = node as Record<string, unknown>;
  const own =
    object.kind === "symbol" && typeof object.quantityId === "string" ? [object.quantityId] : [];
  return [
    ...own,
    ...Object.values(object).flatMap((value) =>
      (Array.isArray(value) ? value : [value]).flatMap(symbols),
    ),
  ];
}

function records(paper: string): ColourableEquation[] {
  const directory = join(ROOT, "content/equations", paper);
  return readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(readFileSync(join(directory, file), "utf8")))
    .map((record) => ({
      id: record.id,
      argument: record.argument,
      quantityIds: symbols(record.tree),
    }));
}

function togetherIn(node: unknown): string[][] {
  if (!node || typeof node !== "object") return [];
  const object = node as Record<string, unknown>;
  if (object.kind === "formula" && Array.isArray(object.equations) && object.equations.length > 1) {
    return [object.equations as string[]];
  }
  return Object.values(object).flatMap((value) =>
    (Array.isArray(value) ? value : [value]).flatMap(togetherIn),
  );
}

function shownTogether(paper: string): string[][] {
  const directory = join(ROOT, "content/arguments", paper);
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .flatMap((file) => togetherIn(JSON.parse(readFileSync(join(directory, file), "utf8"))));
}

const PAPERS = readdirSync(join(ROOT, "content/equations"), { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() &&
      readdirSync(join(ROOT, "content/equations", entry.name)).some((file) =>
        file.endsWith(".json"),
      ),
  )
  .map((entry) => entry.name)
  .sort();

describe("indexed quantity-colour search preserves the original deterministic search", () => {
  test("seeded graphs preserve assignments and every success/budget boundary", () => {
    let successes = 0;
    let budgetRefusals = 0;
    for (let seed = 1; seed <= 64; seed++) {
      const { equations, together } = seededGraph(seed);
      const expected = outcome(originalAssignment, equations, together, 512);
      expect(outcome(assignQuantityColours, equations, together, 512), `seed ${seed}`).toEqual(
        expected,
      );
      if ("slots" in expected) {
        successes++;
        for (const boundary of [expected.nodes - 1, expected.nodes]) {
          expect(
            outcome(assignQuantityColours, equations, together, boundary),
            `seed ${seed}, budget ${boundary}`,
          ).toEqual(outcome(originalAssignment, equations, together, boundary));
        }
      } else if (expected.code === "search-budget-exceeded") {
        budgetRefusals++;
      }
    }
    expect(successes).toBeGreaterThan(0);
    expect(budgetRefusals).toBeGreaterThan(0);
  });

  test("empty input, repeated quantities, soft crowds and unusual ids retain exact results", () => {
    const crowds = Array.from({ length: 22 }, (_, index) => ({
      id: `unary-${String(index).padStart(2, "0")}`,
      argument: "one-argument",
      quantityIds: [index === 0 ? "__proto__" : index === 1 ? "constructor" : `q${index}`],
    }));
    const repeated = [{ id: "repeat", argument: "a", quantityIds: ["x", "x", "y", "x"] }];
    for (const equations of [[], crowds, repeated]) {
      for (const budget of [undefined, -1, 0, 1, 4.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(outcome(assignQuantityColours, equations, [], budget)).toEqual(
          outcome(originalAssignment, equations, [], budget),
        );
      }
    }
  });

  test("palette refusals happen before any search nodes are added", () => {
    const nine = Array.from({ length: QUANTITY_PALETTE.length }, (_, index) => `q${index}`);
    const oversized = [{ id: "ten", argument: "a", quantityIds: [...nine, "extra"] }];
    const view = [
      { id: "nine", argument: "a", quantityIds: nine },
      { id: "one", argument: "b", quantityIds: ["extra"] },
    ];
    for (const [equations, together] of [
      [oversized, []],
      [view, [["nine", "one"]]],
    ] as const) {
      const expected = outcome(originalAssignment, equations, together);
      expect(expected.nodes).toBe(0);
      expect(outcome(assignQuantityColours, equations, together)).toEqual(expected);
    }
  });

  test("an exhaustive impossible clique retains the complete original search-node count", () => {
    const equations = clique(QUANTITY_PALETTE.length + 1);
    let permutations = 1;
    let expectedNodes = 1;
    for (let available = QUANTITY_PALETTE.length; available > 0; available--) {
      permutations *= available;
      expectedNodes += permutations;
    }
    const result = outcome(assignQuantityColours, equations);
    expect(result).toMatchObject({ code: "paper-not-colourable", nodes: expectedNodes });
    expect(expectedNodes).toBe(986_410);
  });

  test("reports a bounded comparison without imposing a machine-dependent timing gate", () => {
    const equations = clique(QUANTITY_PALETTE.length + 1);
    const start = performance.now();
    const expected = outcome(originalAssignment, equations, [], PREFERRED_VIEW_NODE_BUDGET);
    const originalMs = performance.now() - start;
    const optimizedStart = performance.now();
    const actual = outcome(assignQuantityColours, equations, [], PREFERRED_VIEW_NODE_BUDGET);
    const optimizedMs = performance.now() - optimizedStart;
    expect(actual).toEqual(expected);
    expect(actual.nodes).toBe(PREFERRED_VIEW_NODE_BUDGET + 1);
    console.log(
      JSON.stringify({
        event: "quantity-colour-search-comparison",
        nodes: actual.nodes,
        originalMs,
        optimizedMs,
      }),
    );
  });

  for (const paper of PAPERS) {
    test(`${paper}: current records, reading views and printed admissions match the original`, () => {
      const equations = records(paper);
      const together = shownTogether(paper);
      expect(equations.length).toBeGreaterThan(0);
      expect(
        outcome(assignQuantityColours, equations, together, PREFERRED_VIEW_NODE_BUDGET),
      ).toEqual(outcome(originalAssignment, equations, together, PREFERRED_VIEW_NODE_BUDGET));

      const preferred = (loadDisplayTerms(ROOT, paper)?.displays ?? []).map((display) => ({
        id: `printed:${display.display}`,
        argument: `printed:${display.display}`,
        quantityIds: display.terms.map((term) => term.quantityId),
      }));
      // Exercise every current printed view, including shared/oversized admissions. The smaller
      // test budget bounds the old oracle's allocation cost; the production budget stays 10,000.
      expect(
        preferredOutcome(assignQuantityColoursPreferring, equations, preferred, together, 256),
      ).toEqual(preferredOutcome(originalPreferred, equations, preferred, together, 256));
    });
  }
});

function clique(size: number): ColourableEquation[] {
  return Array.from({ length: size }, (_, index) => `q${index}`).flatMap((a, index, ids) =>
    ids
      .slice(index + 1)
      .map((b) => ({ id: `edge-${a}-${b}`, argument: "clique", quantityIds: [a, b] })),
  );
}
