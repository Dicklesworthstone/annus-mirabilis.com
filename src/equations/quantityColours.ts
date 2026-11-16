/**
 * ONE COLOUR PER QUANTITY (owner's ruling, 2026-09-22: "Per quantity (Recommended)").
 *
 * A quantity is coloured by its canonical id, never by its glyph: `viscosity` is one colour
 * wherever it appears in a paper, and Einstein's k for viscosity is not Boltzmann's k_B, because
 * they are different ids. The same colour marks the term in the formula, the words of the
 * equation's sentence that name it, and its line in the legend, all looked up from the id.
 *
 * NINE SLOTS, AND WHY NOT MORE. Every colour is text, so every value clears WCAG AA (4.5:1) on
 * both the page and the wash in both themes; that pins lightness into a narrow band, and inside
 * it ten evenly spread hues were measured and ochre, rust and olive, and blue, a light plum and
 * violet, became indistinguishable. These nine keep a pairwise OKLab distance of at least 0.09 for
 * normal colour vision. The ninth exists because eight cannot serve mass-energy: H_0, E_0, H_1,
 * E_1, K_0, K_1, L, gamma and C each appear beside every other in some one view, a clique of nine. They do NOT stay distinct for every colour-vision deficiency (blue and violet converge
 * under deuteranopia), which is why colour is never alone: each slot has its own line pattern,
 * shown in pattern mode, and selecting a term names its quantity in words.
 *
 * EVERY PATTERN IS AN UNDERLINE. The first set used overlines for the last three slots, and in a
 * formula an overline IS mathematics: it turned λ_x into a mean, λ̄_x, and a dotted one set above
 * v read as a second derivative. Five underline styles, and four of them again at 3px, give nine.
 *
 * NEITHER ACCENT IS A QUANTITY. No slot is the edition's red; rust, the slot nearest it, and navy
 * and plum, the slots nearest the ink, are assigned last, so a view uses them only when it needs
 * seven or more colours at once.
 *
 * ASSIGNMENT is per paper. Two quantities in one view (an equation, or a reading formula that sets
 * several side by side) never share a colour: a hard constraint, and the build fails if a view
 * ever needs more than nine. Two quantities in one
 * argument avoid sharing one where the palette allows (mass-energy's constant-premise step shows
 * ten quantities across five equations, so two pairs there must share, never inside an equation).
 */

export type QuantityColourSlot = Readonly<{
  /** Index into the palette, and the n in --q-n. */
  slot: number;
  name: string;
  light: string;
  dark: string;
  /** The non-colour channel: the text-decoration a term of this slot carries in pattern mode. */
  pattern: string;
}>;

/**
 * Measured values. Contrast on paper and wash (light #fbfbfb / #f2f2f2, dark #1c2128 / #21282f):
 * blue 5.40/4.99 and 7.54/6.95; green 5.47/5.05 and 9.13/8.41; magenta 6.39/5.90 and 6.57/6.05;
 * ochre 5.33/4.93 and 10.70/9.85; violet 6.31/5.83 and 7.20/6.63; teal 5.58/5.16 and 9.95/9.16;
 * navy 10.63/9.83 and 12.08/11.12; rust 6.10/5.64 and 6.69/6.16; plum 10.27/9.50 and 10.29/9.47. quantityColours.test.ts holds
 * the threshold over every value, so the comment cannot drift from the numbers without a failure.
 */
export const QUANTITY_PALETTE: readonly QuantityColourSlot[] = Object.freeze(
  [
    { name: "blue", light: "#2a67bd", dark: "#7cb4fc", pattern: "underline solid" },
    { name: "green", light: "#1d7635", dark: "#75d78d", pattern: "underline dashed" },
    { name: "magenta", light: "#a12d79", dark: "#ec84b7", pattern: "underline dotted" },
    { name: "ochre", light: "#7f6601", dark: "#ddd674", pattern: "underline double" },
    { name: "violet", light: "#7a41af", dark: "#c49bf3", pattern: "underline wavy" },
    { name: "teal", light: "#06717a", dark: "#6fdbe1", pattern: "underline solid 3px" },
    { name: "navy", light: "#1e3a71", dark: "#c2e2ff", pattern: "underline dashed 3px" },
    { name: "rust", light: "#9b4805", dark: "#f08c6d", pattern: "underline dotted 3px" },
    { name: "plum", light: "#642560", dark: "#ecc1e7", pattern: "underline wavy 3px" },
  ].map((c, slot) => Object.freeze({ ...c, slot })),
);

export type ColourableEquation = Readonly<{
  id: string;
  argument: string;
  /** The canonical quantity ids of the equation's terms, in the order they appear. */
  quantityIds: readonly string[];
}>;

export type QuantityColourRefusal =
  | "equation-exceeds-palette"
  | "view-exceeds-palette"
  | "paper-not-colourable"
  | "search-budget-exceeded";
export class QuantityColourError extends Error {
  readonly code: QuantityColourRefusal;
  constructor(code: QuantityColourRefusal, message: string) {
    super(message);
    this.name = "QuantityColourError";
    this.code = code;
  }
}

/**
 * Deterministic colouring by exact search. A quantity has ONE colour in a paper, so "no two
 * quantities in an equation share a colour" is graph colouring: quantities are vertices, and two
 * are joined when any equation shows both. A fixed-order greedy pass failed on the real
 * mass-energy records (the additive constant C shares equations with eight others), although an
 * eight-colouring exists, because E_0 and K_1, for one, never meet. So the search takes the most
 * constrained quantity next (DSATUR: most distinct neighbour colours, then most neighbours, then
 * first appearance) and backtracks when a choice leaves someone without a colour. Within a
 * choice it prefers the slot the fewest quantities in the same argument hold (so a printed view that
 * must repeat a colour repeats it as little as it can, dispatch 233), then one no quantity in the
 * paper holds yet, then the lowest slot, so the slots nearest an accent are used last. Same
 * records, same colours.
 */
export function assignQuantityColours(
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
  const indices = new Map<string, number>();
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
    for (const id of ids) {
      if (indices.has(id)) continue;
      indices.set(id, order.length);
      order.push(id);
    }
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

  // Index once, rather than rebuilding sets of string neighbours at every search node. The
  // indices retain first appearance, so equal saturation and degree still choose the same id.
  const indexed = (map: Map<string, Set<string>>) =>
    order.map((id) => Int32Array.from(map.get(id) ?? [], (q) => indices.get(q) as number));
  const hardNeighbours = indexed(hard);
  const softNeighbours = indexed(soft);
  const slotCount = QUANTITY_PALETTE.length;
  const colours = new Int32Array(order.length).fill(-1);
  const hardCounts = new Uint32Array(order.length * slotCount);
  const softCounts = new Uint32Array(order.length * slotCount);
  const saturation = new Uint8Array(order.length);
  const blocked = new Uint16Array(order.length);
  const inPaper = new Uint32Array(slotCount);
  // Each recursive depth owns nine candidate cells. A child's sort cannot alter its parent's
  // remaining choices, and backtracking allocates no temporary maps, sets or candidate arrays.
  const candidates = new Uint8Array(order.length * slotCount);
  const setColour = (id: number, slot: number, change: 1 | -1) => {
    colours[id] = change === 1 ? slot : -1;
    inPaper[slot] = (inPaper[slot] as number) + change;
    const bit = 1 << slot;
    for (const neighbour of hardNeighbours[id] as Int32Array) {
      const offset = neighbour * slotCount + slot;
      const previous = hardCounts[offset] as number;
      const count = previous + change;
      hardCounts[offset] = count;
      if (previous === 0) {
        saturation[neighbour] = (saturation[neighbour] as number) + 1;
        blocked[neighbour] = (blocked[neighbour] as number) | bit;
      } else if (count === 0) {
        saturation[neighbour] = (saturation[neighbour] as number) - 1;
        blocked[neighbour] = (blocked[neighbour] as number) & ~bit;
      }
    }
    for (const neighbour of softNeighbours[id] as Int32Array) {
      const offset = neighbour * slotCount + slot;
      softCounts[offset] = (softCounts[offset] as number) + change;
    }
  };
  let nodes = 0;
  const search = (depth: number): boolean => {
    nodes++;
    if (options.nodeBudget !== undefined && nodes > options.nodeBudget)
      throw new QuantityColourError(
        "search-budget-exceeded",
        `The colour search stopped at its budget of ${options.nodeBudget} nodes without an answer.`,
      );
    // Keep the budget check before the completed-colouring case: that final call is a node too.
    if (depth === order.length) return true;
    let id = -1;
    let bestSaturation = -1;
    let bestDegree = -1;
    for (let index = 0; index < order.length; index++) {
      if (colours[index] !== -1) continue;
      const distinct = saturation[index] as number;
      const degree = (hardNeighbours[index] as Int32Array).length;
      if (distinct > bestSaturation || (distinct === bestSaturation && degree > bestDegree)) {
        id = index;
        bestSaturation = distinct;
        bestDegree = degree;
      }
    }
    // How many of its argument's quantities hold each slot. A count, not a yes or no: relativity's
    // plane waves share their free quantities, every slot was held by one of them, and the flag let
    // three free quantities fall to the same lowest slot, four quantities in one colour where one
    // pair was all ten needed (dispatch 233).
    const crowdOffset = id * slotCount;
    const candidateOffset = depth * slotCount;
    const mask = blocked[id] as number;
    let candidateCount = 0;
    for (let slot = 0; slot < slotCount; slot++) {
      if (mask & (1 << slot)) continue;
      let at = candidateCount;
      while (at > 0) {
        const other = candidates[candidateOffset + at - 1] as number;
        const rank =
          (softCounts[crowdOffset + slot] as number) -
            (softCounts[crowdOffset + other] as number) ||
          Number((inPaper[slot] as number) > 0) - Number((inPaper[other] as number) > 0) ||
          slot - other;
        if (rank >= 0) break;
        candidates[candidateOffset + at] = other;
        at--;
      }
      candidates[candidateOffset + at] = slot;
      candidateCount++;
    }
    for (let at = 0; at < candidateCount; at++) {
      const slot = candidates[candidateOffset + at] as number;
      setColour(id, slot, 1);
      if (search(depth + 1)) return true;
      setColour(id, slot, -1);
    }
    return false;
  };
  let found: boolean;
  try {
    found = search(0);
  } finally {
    if (options.stats) options.stats.nodes += nodes;
  }
  if (!found)
    throw new QuantityColourError(
      "paper-not-colourable",
      `These equations cannot be coloured with ${QUANTITY_PALETTE.length} colours so that no equation repeats one.`,
    );
  return Object.freeze(
    Object.fromEntries(order.map((id, index) => [id, colours[index] as number])),
  );
}

/**
 * The most nodes one search in assignQuantityColoursPreferring may visit. Measured at 9754ba91 on
 * 2026-09-25 (dispatch 230), every search that found a colouring took at most 73 nodes, across all
 * five payloads, and each proof that none existed took 986,410 (7 to 20 s). The cap is over a
 * hundred times the largest success and stops a proof at a fraction of a second.
 */
export const PREFERRED_VIEW_NODE_BUDGET = 10_000;

/**
 * PRINTED DISPLAYS JOIN THE MAP (dispatch 224). Einstein's own formulas on the reading faces take
 * the paper's one colour per quantity, so each is a view whose quantities should differ. They
 * cannot always all differ: mass-energy's explanation already holds a clique of nine (H_0, E_0,
 * H_1, E_1, K_0, K_1, L, gamma and C), every slot, and the printed displays set v and V beside all
 * seven energies, which leaves them gamma's slot and C's; both meet gamma in the Lorentz-factor
 * record, so one of them has no slot. Some view must then repeat a colour.
 *
 * The records' views stay hard, as assignQuantityColours has them. Each preferred view is then
 * admitted as hard in turn, smallest first, if the paper is still colourable with it; one that is
 * not is returned in `shared`, by id, and its quantities are coloured without that constraint (the
 * pattern channel and the chips' names still tell them apart). Same views, same colours.
 *
 * BOUNDED (dispatch 230). Every search here runs under a node budget. A view is also shared when
 * its search runs out of budget before an answer, or when it alone holds more quantities than the
 * palette has colours (relativity § 7's plane wave shows ten). A budget that runs out on the
 * records alone, or on the final colouring, is refused rather than guessed at: both are searches
 * the admissions have already shown to succeed, so it means the budget is wrong, not the records.
 */
export function assignQuantityColoursPreferring(
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
  assignQuantityColours(equations, shownTogether, options);
  const order = [...preferred].sort(
    (a, b) => new Set(a.quantityIds).size - new Set(b.quantityIds).size || (a.id < b.id ? -1 : 1),
  );
  const admitted: ColourableEquation[] = [];
  const shared: string[] = [];
  for (const view of order) {
    try {
      assignQuantityColours([...equations, ...admitted, view], shownTogether, options);
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
    slots: assignQuantityColours([...equations, ...admitted, ...loose], shownTogether, options),
    shared: shared.sort(),
    nodes: stats.nodes,
  };
}
