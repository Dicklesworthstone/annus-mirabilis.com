/**
 * The 1904 shelf for the special-relativity discovery route.
 *
 * OUTSIDE THE PAGE, for the reason massEnergyShelf.ts records: a Next page module may export
 * only the route contract.
 *
 * EVERY CARD IS PRE-1905 and no import is admitted, as with light-quanta. The whole argument is
 * reachable from 1904, which matters here more than anywhere: the story is usually told as
 * though the answer required something nobody had.
 *
 * THE LORENTZ CARD IS THE POINT OF THIS SHELF. AGENTS.md requires that a reasonable alternative
 * fail on a stated constraint and never be declared refuted merely because the site prefers a
 * more economical account, and it names Lorentz's ether with local time as producing the same
 * formulas. That card therefore carries a `limits` field saying so rather than being quietly
 * omitted, and the route gives it a step of its own instead of a sentence.
 *
 * THE MICHELSON-MORLEY CARD CARRIES A LIMIT TOO, for the opposite reason. AGENTS.md lists
 * "make Michelson-Morley the sole documented cause of the relativity paper" among the
 * anachronisms to refuse: the paper refers to failed attempts to detect motion relative to the
 * light medium, in general, and says nothing about which experiment moved its author.
 *
 * NO VERIFICATION RECORDS, on the same grounds as the other two shelves: these dates are from
 * standard bibliography and not from anyone here opening the volumes, so publicationGate refuses
 * them in production until a human verifies them. The cards show no verification status
 * (dispatch 243, D-2026-09-25-no-review-status-banners).
 */

import type { KnowledgeCard } from "../discovery/cards/types.ts";

export const SPECIAL_RELATIVITY_SHELF_CARDS: readonly KnowledgeCard[] = [
  {
    id: "newton-1687-absolute-time",
    proposition:
      "Time passes at the same rate everywhere and two events either happen at once or they do not, whoever is asking.",
    status: "available",
    limits:
      "The default assumption rather than a measured result. It is on the shelf because it is what the route asks you to give up, and it had never needed defending.",
    sources: [
      {
        title: "Philosophiae Naturalis Principia Mathematica",
        date: "1687",
        locator: "Scholium to the Definitions",
      },
    ],
    date: {
      earliest: "1687",
      latest: "1687",
      precision: "year",
      latestYear: 1687,
      eventKind: "published",
    },
    admittedStages: ["stage-03", "stage-04"],
  },
  {
    id: "bradley-1729-stellar-aberration",
    proposition:
      "A star's apparent position shifts through the year by an amount set by the Earth's speed and the speed of light.",
    status: "available",
    sources: [
      {
        title: "A Letter giving an Account of a new discovered Motion of the Fix'd Stars",
        date: "1729",
        locator: "Phil. Trans. R. Soc. 35, 637",
      },
    ],
    date: {
      earliest: "1729",
      latest: "1729",
      precision: "year",
      latestYear: 1729,
      eventKind: "published",
    },
    admittedStages: ["stage-08"],
  },
  {
    id: "fizeau-1851-light-in-moving-water",
    proposition:
      "Light travelling through moving water is carried along by it, but only partly, by a measured fraction rather than fully.",
    status: "available",
    sources: [
      {
        title: "Sur les hypothèses relatives à l'éther lumineux",
        date: "1851",
        locator: "Comptes Rendus 33, 349",
      },
    ],
    date: {
      earliest: "1851",
      latest: "1851",
      precision: "year",
      latestYear: 1851,
      eventKind: "published",
    },
    admittedStages: ["stage-06", "stage-08"],
  },
  {
    id: "maxwell-1873-field-equations",
    proposition:
      "One set of equations governs electricity, magnetism and light, and fixes the speed at which an electromagnetic wave travels.",
    status: "available",
    sources: [
      {
        title: "A Treatise on Electricity and Magnetism",
        date: "1873",
        locator: "Oxford: Clarendon Press",
      },
    ],
    date: {
      earliest: "1873",
      latest: "1873",
      precision: "year",
      latestYear: 1873,
      eventKind: "published",
    },
    admittedStages: ["stage-01", "stage-03"],
  },
  {
    id: "michelson-morley-1887-no-drift",
    proposition:
      "A careful attempt to detect the Earth's motion through the light medium found no effect of the size expected.",
    status: "available",
    limits:
      "One of several such attempts, and the route treats it as one. The 1905 paper refers to failed attempts to detect motion relative to the light medium in general; it does not name this experiment, and nothing here claims it is what moved its author.",
    sources: [
      {
        title: "On the Relative Motion of the Earth and the Luminiferous Ether",
        date: "1887",
        locator: "Am. J. Sci. (3) 34, 333",
      },
    ],
    date: {
      earliest: "1887",
      latest: "1887",
      precision: "year",
      latestYear: 1887,
      eventKind: "published",
    },
    admittedStages: ["stage-02", "stage-07"],
  },
  {
    id: "lorentz-1904-corresponding-states",
    proposition:
      "Keep the ether, let moving bodies contract and let moving clocks keep a local time, and the equations reproduce the null results exactly.",
    status: "available",
    limits:
      "This is not a failed theory. Within the scope of these experiments it gives the same formulas and the same predictions as the 1905 kinematics, and the route does not declare it refuted. What separates them is what each takes as given and what each has to add by hand, not a measurement either one fails.",
    sources: [
      {
        title:
          "Electromagnetic phenomena in a system moving with any velocity less than that of light",
        date: "1904",
        locator: "Proc. R. Acad. Amsterdam 6, 809",
      },
    ],
    date: {
      earliest: "1904",
      latest: "1904",
      precision: "year",
      latestYear: 1904,
      eventKind: "published",
    },
    admittedStages: ["stage-07"],
  },
  {
    id: "poincare-1904-principle-of-relativity",
    proposition:
      "The laws of physics should be the same for an observer at rest and one in uniform motion, stated as a general principle to be met rather than a result to be derived.",
    status: "available",
    sources: [
      {
        title: "L'état actuel et l'avenir de la physique mathématique",
        date: "1904",
        locator: "Address at St Louis, 24 September 1904",
      },
    ],
    date: {
      earliest: "1904",
      latest: "1904",
      precision: "year",
      latestYear: 1904,
      eventKind: "presented",
    },
    admittedStages: ["stage-03"],
  },
];
