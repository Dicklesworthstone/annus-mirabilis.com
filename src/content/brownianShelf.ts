/**
 * The 1904 shelf for the Brownian-motion discovery route, and the later evidence its check
 * against the world is compared with.
 *
 * Outside the page for the reason massEnergyShelf.ts records: a Next page module may export only
 * the route contract. Every card here is unverified and says so on the page ("Awaiting
 * verification"): the dates and locators come from standard bibliographies and period citations,
 * and nobody has checked them against the volumes.
 */
import type { KnowledgeCard } from "../discovery/cards/types.ts";

export const BROWNIAN_SHELF_CARDS: readonly KnowledgeCard[] = [
  {
    id: "brown-1828-microscopical-observations",
    proposition:
      "Fragments from within pollen grains, and inorganic particles suspended in water, move irregularly without dying away.",
    status: "available",
    sources: [
      {
        title: "A brief account of microscopical observations",
        date: "1828",
        locator: "Phil. Mag. 4 (1828) 161",
      },
    ],
    date: {
      earliest: "1828",
      latest: "1828",
      precision: "year",
      latestYear: 1828,
      eventKind: "published",
    },
    priorEvent: {
      eventKind: "performed",
      earliest: "1827",
      latest: "1827",
      precision: "year",
    },
    admittedStages: ["stage-01", "stage-02"],
  },
  {
    id: "stokes-1851-sphere-drag",
    proposition:
      "A sphere of radius a moving slowly at speed v through a liquid of viscosity η is held back by a force F = 6πηav.",
    status: "available",
    sources: [{ title: "Trans. Camb. Phil. Soc. 9", locator: "p. 8", date: "1851" }],
    date: {
      earliest: "1851",
      latest: "1851",
      precision: "year",
      latestYear: 1851,
      eventKind: "published",
    },
    admittedStages: ["stage-03"],
  },
  {
    id: "fick-1855-diffusion-equation",
    proposition:
      "Dissolved matter moves down its concentration gradient at a rate proportional to the gradient; with conservation of matter this gives a diffusion equation for the concentration.",
    status: "available",
    sources: [{ title: "Ann. Phys. (Pogg.) 94", locator: "p. 59", date: "1855" }],
    date: {
      earliest: "1855",
      latest: "1855",
      precision: "year",
      latestYear: 1855,
      eventKind: "published",
    },
    admittedStages: ["stage-03"],
  },
  {
    id: "maxwell-1860-equipartition",
    proposition:
      "In a gas in thermal equilibrium every kind of molecule has the same mean kinetic energy of translation, whatever its mass, and that mean is proportional to the absolute temperature.",
    status: "available",
    sources: [{ title: "Phil. Mag. 19", locator: "p. 19", date: "1860" }],
    date: {
      earliest: "1860",
      latest: "1879",
      precision: "range",
      latestYear: 1879,
      eventKind: "published",
    },
    admittedStages: ["stage-01", "stage-02"],
  },
  {
    id: "gouy-1888-brownian-motion",
    proposition:
      "The motion is intrinsic and persistent; faster for smaller particles and in warmer, less viscous liquids.",
    status: "available",
    sources: [{ title: "J. Phys. Théor. Appl. (2) 7", locator: "p. 561", date: "1888" }],
    date: {
      earliest: "1888",
      latest: "1888",
      precision: "year",
      latestYear: 1888,
      eventKind: "published",
    },
    admittedStages: ["stage-01"],
  },
  {
    id: "exner-1900-particle-speeds",
    proposition:
      "Exner timed the particles over short intervals; their apparent speeds came out far below the speeds kinetic theory gives molecules.",
    status: "available",
    sources: [{ title: "Ann. Phys. (4) 2", locator: "p. 843", date: "1900" }],
    date: {
      earliest: "1900",
      latest: "1900",
      precision: "year",
      latestYear: 1900,
      eventKind: "published",
    },
    admittedStages: ["stage-01"],
  },
  {
    id: "siedentopf-1903-ultramicroscope",
    proposition:
      "Siedentopf and Zsigmondy's ultramicroscope lights colloidal particles from the side, so particles smaller than a micron show as bright points on a dark field.",
    status: "available",
    sources: [{ title: "Ann. Phys. (4) 10", locator: "p. 1", date: "1903" }],
    date: {
      earliest: "1903",
      latest: "1903",
      precision: "year",
      latestYear: 1903,
      eventKind: "published",
    },
    priorEvent: {
      eventKind: "performed",
      earliest: "1902",
      latest: "1902",
      precision: "year",
    },
    admittedStages: ["stage-01"],
  },
  {
    id: "sutherland-1904-dunedin",
    proposition:
      "William Sutherland presents a formula for the diffusion of a sphere through a liquid, with a correction for slip at its surface, at Dunedin in January 1904.",
    status: "available",
    sources: [
      {
        title: "Australasian Association for the Advancement of Science",
        locator: "Dunedin Meeting",
        date: "1904",
      },
    ],
    date: {
      earliest: "1904-01",
      latest: "1904-01",
      precision: "month",
      latestYear: 1904,
      eventKind: "presented",
    },
    relatedCardId: "sutherland-1905-phil-mag",
    admittedStages: ["stage-03"],
  },
  {
    id: "sutherland-1905-phil-mag",
    proposition:
      "Sutherland's diffusion formula, with its slip correction, is published in the Philosophical Magazine.",
    status: "parallel-work",
    parallelWorkBasis:
      "The June 1905 Philosophical Magazine publication falls between Annalen's receipt of Einstein's paper on 11 May 1905 and its publication on 18 July 1905.",
    sources: [{ title: "Phil. Mag. (6) 9", locator: "p. 781", date: "1905" }],
    date: {
      earliest: "1905-06",
      latest: "1905-06",
      precision: "month",
      latestYear: 1905,
      eventKind: "published",
    },
    relatedCardId: "sutherland-1904-dunedin",
    admittedStages: ["stage-03"],
  },
  {
    id: "naegeli-1879-single-impacts",
    proposition:
      "Nägeli estimates the speed a single molecular impact can give a visible particle, finds it far too small to see, and concludes that the agitation of the liquid's molecules cannot be what moves the particles.",
    status: "available",
    sources: [
      {
        title: "Über die Bewegungen kleinster Körperchen",
        locator: "Sitzungsber. math.-phys. Cl. Akad. Wiss. München 1879, p. 389",
        date: "1879",
      },
    ],
    date: {
      earliest: "1879",
      latest: "1879",
      precision: "year",
      latestYear: 1879,
      eventKind: "published",
    },
    limits:
      "The estimate is for one impact at a time. It does not ask what the imbalance of very many impacts in a short interval does, which is where the route turns.",
    admittedStages: ["stage-02"],
  },
  {
    id: "vant-hoff-1887-osmotic-gas-law",
    proposition:
      "A substance dissolved in a dilute solution presses on a membrane that lets only the solvent through, and that osmotic pressure obeys the gas law: p V = R T z for z gram-molecules in the volume V.",
    status: "available",
    sources: [
      {
        title: "Die Rolle des osmotischen Druckes in der Analogie zwischen Lösungen und Gasen",
        locator: "Z. physik. Chem. 1 (1887) 481",
        date: "1887",
      },
    ],
    date: {
      earliest: "1887",
      latest: "1887",
      precision: "year",
      latestYear: 1887,
      eventKind: "published",
    },
    limits:
      "Stated for dilute solutions of dissolved molecules. Whether it holds for particles large enough to see is the question the route asks, not something the law says.",
    admittedStages: ["stage-02", "stage-03"],
  },
];

/**
 * Later evidence: never on the 1904 shelf (cardRules.ts, card-later-on-shelf), shown beside the
 * route's check against the world. The numbers are the edition's summary of the paper, not
 * transcribed table cells: the digitized Perrin 1909 dataset is owned by am-data-perrin-1909-p7ku
 * and is not in this tree.
 */
export const BROWNIAN_LATER_EVIDENCE: readonly KnowledgeCard[] = [
  {
    id: "perrin-1909-molecular-reality",
    proposition:
      "Perrin measures suspensions of gamboge grains of known radius, among them their vertical distribution in sedimentation equilibrium, and infers the number of molecules in a gram-molecule. Across his methods the values lie between roughly 6 and 7.5 × 10^23; the sedimentation-equilibrium value is near 7 × 10^23.",
    status: "later",
    sources: [
      {
        title: "Mouvement brownien et réalité moléculaire",
        locator: "Ann. Chim. Phys. (8) 18 (1909) 1",
        date: "1909",
      },
    ],
    date: {
      earliest: "1909-09",
      latest: "1909-09",
      precision: "month",
      latestYear: 1909,
      eventKind: "published",
    },
    limits:
      "Later evidence, not on the 1904 shelf. The range is this edition's summary of the paper; its tables are not yet transcribed here.",
  },
];
