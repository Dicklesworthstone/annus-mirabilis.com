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
  | "paper-not-colourable";
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
 * choice it prefers a slot no quantity in the same argument holds, then one no quantity in the
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
  const search = (): boolean => {
    const id = next();
    if (id === undefined) return true;
    const blocked = neighbourSlots(id, hard);
    const crowded = neighbourSlots(id, soft);
    const inPaper = new Set(colours.values());
    const candidates = QUANTITY_PALETTE.filter((c) => !blocked.has(c.slot)).sort(
      (a, b) =>
        Number(crowded.has(a.slot)) - Number(crowded.has(b.slot)) ||
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
  if (!search())
    throw new QuantityColourError(
      "paper-not-colourable",
      `These equations cannot be coloured with ${QUANTITY_PALETTE.length} colours so that no equation repeats one.`,
    );
  return Object.freeze(Object.fromEntries(order.map((id) => [id, colours.get(id) as number])));
}

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
 */
export function assignQuantityColoursPreferring(
  equations: readonly ColourableEquation[],
  preferred: readonly ColourableEquation[],
  shownTogether: readonly (readonly string[])[] = [],
): Readonly<{ slots: Readonly<Record<string, number>>; shared: readonly string[] }> {
  const order = [...preferred].sort(
    (a, b) => new Set(a.quantityIds).size - new Set(b.quantityIds).size || (a.id < b.id ? -1 : 1),
  );
  const admitted: ColourableEquation[] = [];
  const shared: string[] = [];
  for (const view of order) {
    try {
      assignQuantityColours([...equations, ...admitted, view], shownTogether);
      admitted.push(view);
    } catch (error) {
      if (!(error instanceof QuantityColourError) || error.code === "equation-exceeds-palette")
        throw error;
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
    slots: assignQuantityColours([...equations, ...admitted, ...loose], shownTogether),
    shared: shared.sort(),
  };
}
