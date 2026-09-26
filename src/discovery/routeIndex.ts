import type { DiscoveryPaperSlug } from "./journeyRegistry.ts";

/** One route on the /discover/ index. Dates and page numbers come from the receipts, not here. */
export interface RouteIndexEntry {
  readonly slug: DiscoveryPaperSlug;
  /** The name the home page and /papers/ use for the paper. */
  readonly name: string;
  readonly germanTitle: string;
  /** Our summary of the route. Its "N steps" must agree with `steps`. */
  readonly blurb: string;
  readonly steps: readonly string[];
}

/**
 * The four routes in the order Annalen received the papers, each beside the paper it ends in.
 *
 * `steps` are the route's own step labels, in order, exactly as each journey page prints them
 * after its "01 / " number. They are the one thing on this index that says what a reader will
 * DO on a route, so they are copied rather than paraphrased, and routeIndex.test.ts fails when a
 * journey page renames, adds or drops a step without this list following.
 */
export const ROUTE_INDEX: readonly RouteIndexEntry[] = [
  {
    slug: "light-quanta",
    name: "Light quanta",
    germanTitle:
      "Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen Gesichtspunkt",
    blurb:
      "The wave theory was not in trouble in 1904, and this route keeps every one of its successes. Optical experiments measure averages over time; the route looks at what they never reached, the moment light is emitted or absorbed. Nine steps, nine instruments, five pieces to work by hand, and nothing on the shelf from after 1904.",
    steps: [
      "Start with what works",
      "Find the edge of the evidence",
      "Make a prediction",
      "Work where a law is solid",
      "Do the same sum for something you understand",
      "Compare the two, and read the exponent",
      "Demand consequences",
      "Check it against the world",
      "Try it yourself",
    ],
  },
  {
    slug: "brownian-motion",
    name: "Brownian motion",
    germanTitle:
      "Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen",
    blurb:
      "Particles from inside pollen grains, suspended in still water, never come to rest. The route asks whether a particle you can see presses like a dissolved molecule, and what you would measure to decide whether molecules are shoving it. A particle’s apparent speed depends on how often you look, so the route works with how far it gets in a given time. Eight steps, seven instruments, and the 1904 shelf of results you may use.",
    steps: [
      "Choose a quantity",
      "Ask whether it presses",
      "Balance a force against drag",
      "Make a prediction",
      "Ask an interval question",
      "Check it against the world",
      "Turn the question around",
      "Try it yourself",
    ],
  },
  {
    slug: "special-relativity",
    name: "Special relativity",
    germanTitle: "Zur Elektrodynamik bewegter Körper",
    blurb:
      "A magnet, a coil, and a needle that moves. Move the magnet or move the coil and the needle shows the same current, but the electrodynamics of 1904 explains the two cases in two different ways. Following that through means giving up the idea that “at the same time” needs no definition. Nine steps, eight instruments, two forks where the route could have gone another way, four pieces to work by hand, and Lorentz’s theory, which gives the same formulas, on the shelf beside it.",
    steps: [
      "Start where the paper starts",
      "Decide whether that bothers you",
      "Make a prediction",
      "Find the assumption",
      "Build the map",
      "Read off the consequences",
      "Meet the serious rival",
      "Check it against the world",
      "Try it yourself",
    ],
  },
  {
    slug: "mass-energy",
    name: "Mass and energy",
    germanTitle: "Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?",
    blurb:
      "A body at rest sends out two equal flashes of light in opposite directions, so it stays where it is. Energy has left it and nothing you can see about it has changed, so the route asks what did. Seven steps, with a prediction to make before you read the answer, a number to check against the world, and four pieces to work by hand. One result is borrowed from the June relativity paper, how the energy of light depends on the frame, and the route names it where it is used.",
    steps: [
      "Start with a body that does nothing",
      "Make a prediction",
      "Describe the same event twice",
      "Subtract",
      "Read the coefficient",
      "Check it against the world",
      "Try it yourself",
    ],
  },
];
