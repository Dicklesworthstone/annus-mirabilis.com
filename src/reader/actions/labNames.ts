/**
 * What each instrument is called when a link points at it.
 *
 * WHY THIS FILE EXISTS. The table lived in two places, PassageActionsBar.tsx and
 * PassageActions.tsx, with four identical entries each, and both fell back to the raw
 * instrument id when a name was missing. Measured on build h2Dwz8akGXU682TfDJXOY over every
 * paper page in out/, by accessible name:
 *
 *     registered instruments            34
 *       linked from a paper page        29
 *         with an authored name          4   bm-01, bm-05, bm-06, bm-07
 *         announced only as their id    25   "Try it: lq-01" ... "Try it: sr-13"
 *       not linked from any paper page   5   bm-02, bm-03, bm-04, bm-08, light-thread
 *
 * So a reader on /papers/special-relativity/ met thirteen links that all read "Try it", and a
 * screen-reader user heard thirteen accessible names that were instrument ids. That is a WCAG
 * 2.4.4 link-purpose problem before it is a design one.
 *
 * WHERE THE NAMES COME FROM, because this is the part that could have gone wrong. They are not
 * written for this table. Each one is the instrument's own h1, taken from its built page, so the
 * name a link announces is the heading the reader meets on arrival. That keeps the two from
 * drifting into different descriptions of the same instrument, and it means nothing here was
 * invented by someone who had not seen the instrument.
 *
 * They read as sentences rather than as terse labels, and that is deliberate for an accessible
 * name: "Try it: Simultaneity is relative; moving bodies contract" tells a reader where the link
 * goes, where "Try it: sr-03" tells them nothing. The visible text stays "Try it".
 *
 * MAINTENANCE. A missing entry is not a failure: the callers still fall back to the id, which is
 * ugly but honest. Add an instrument here when it gains a page, and copy its h1 rather than
 * composing a new phrase.
 */
import { SHELF_DEFINITIONS } from "../../experiments/shelfOptics/definition.ts";

export const LAB_NAMES: Readonly<Record<string, string>> = Object.freeze({
  "shelf-michelson-morley": SHELF_DEFINITIONS["shelf-michelson-morley"].title,
  "shelf-fizeau": SHELF_DEFINITIONS["shelf-fizeau"].title,
  "shelf-maxwell-galilean": SHELF_DEFINITIONS["shelf-maxwell-galilean"].title,

  // Brownian motion.
  //
  // THESE FOUR KEEP THE NAMES THEY ALREADY HAD, and that is a correction to my first pass. I
  // replaced them with their page headings like the rest, and linkNames.test.tsx went red:
  // bm-07's name is pinned by an acceptance criterion (am-jmma / am-xbfm) because these four were
  // chosen to resolve ten link-collision classes, where one accessible name reaching two
  // destinations is the defect. They were authored deliberately; the 29 below had no name at all,
  // and that was the gap worth closing. Filling a hole is not a licence to redo the part that was
  // already done.
  "bm-01": "Tracer ensemble",
  "bm-02": "A particle you can see pushes like one you cannot.",
  "bm-03": "Why counting positions gives the pressure law.",
  "bm-04": "Balancing directional drag against random spreading.",
  "bm-05": "Random steps",
  "bm-06": "Spreading probability",
  "bm-07": "Molecular-number inference",
  "bm-08": "The particle. The camera. The estimate.",

  // Light quanta
  "lq-01": "Continuous waves explain purely optical phenomena.",
  "lq-02": "Give every resonator its share, and the total never stops growing.",
  "lq-03": "Where Wien's law holds, and where it stops.",
  "lq-04": "A spectrum has an entropy. Compressing it costs the same way a gas does.",
  "lq-05": "Independent configurations and the gas analogy",
  "lq-06": "The radiation entropy law matches the gas entropy law.",
  "lq-07": "Stokes's rule and the single-quantum energy budget",
  "lq-08": "Energy is discrete. Rates scale with power.",
  "lq-09": "Threshold frequency sets the bound. Absorbed energy counts the ions.",

  // On the electrodynamics of moving bodies
  "sr-01": "How do distant clocks agree on a time?",
  "sr-02": "The same relative motion, two accounts of one current.",
  "sr-03": "Simultaneity is relative; moving bodies contract.",
  "sr-04": "Build the map, don't receive it.",
  "sr-05": "A moving clock loses time.",
  "sr-06": "Speeds do not simply add.",
  "sr-07": "The field equations keep their form.",
  "sr-08": "Fields transform together, not as separate realities.",
  "sr-09": "Frequency and direction transform together.",
  "sr-10": "A packet of light does not transform like a rigid material body.",
  "sr-11": "Moving mirror reflection, Doppler shift, and radiation pressure energy balance.",
  "sr-12": "Charge density is frame-dependent, while total charge is invariant.",
  "sr-13": "Force conventions and dynamics of the slowly accelerated electron.",

  // Does inertia depend on energy content?
  "me-01": "Opposite pulses and two energy ledgers.",
  "me-02": "A smaller energy of motion at the same speed.",
  "me-03": "System boundaries and the energy ledger.",

  // Instruments that serve more than one paper, or none.
  "light-thread": "One pulse, three questions.",
  "avogadro-lab": "Three routes toward a molecular number.",
  "brownian-data": "What does your recording actually identify?",
  "what-can-you-infer": "Keep the data. Change what you know.",
  countermodels: "What would actually distinguish these models?",
});

/** The instrument's name, or its id when no name is recorded. The id is ugly and honest. */
export function labName(instrumentId: string): string {
  return LAB_NAMES[instrumentId] ?? instrumentId;
}
