/**
 * The four shelves, re-exported in one place so `realJourneys.ts` names each paper's cards once.
 *
 * A journey's `shelf` is a list of card ids, and the ids live with the cards. Re-exporting rather than
 * copying them keeps one source: a card renamed in its own file reaches the journey record without
 * anyone remembering this file exists.
 */
export { BROWNIAN_SHELF_CARDS } from "../../content/brownianShelf.ts";
export { LIGHT_QUANTA_SHELF_CARDS } from "../../content/lightQuantaShelf.ts";
export { MASS_ENERGY_SHELF_CARDS } from "../../content/massEnergyShelf.ts";
export { SPECIAL_RELATIVITY_SHELF_CARDS } from "../../content/specialRelativityShelf.ts";
