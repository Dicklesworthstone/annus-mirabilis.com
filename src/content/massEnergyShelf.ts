/**
 * The 1904 shelf for the mass-energy discovery route.
 *
 * THIS LIVES OUTSIDE THE PAGE ON PURPOSE. A Next.js page module may only export the route
 * contract - default, metadata, generateStaticParams and friends - and the generated types in
 * .next/types reject anything else with TS2344. Exporting the cards from the page to make them
 * validatable broke `bun run check:types` for every pane; data belongs in a data module.
 */
import type { KnowledgeCard } from "../discovery/cards/types.ts";

export const MASS_ENERGY_SHELF_CARDS: readonly KnowledgeCard[] = [
  {
    id: "helmholtz-1847-conservation-of-energy",
    proposition:
      "The total energy of an isolated system is conserved: it can change form but the books must balance.",
    status: "available",
    sources: [
      {
        title: "Über die Erhaltung der Kraft",
        date: "1847",
        locator: "Berlin: G. Reimer",
      },
    ],
    date: {
      earliest: "1847",
      latest: "1847",
      precision: "year",
      latestYear: 1847,
      eventKind: "published",
    },
    admittedStages: ["stage-01", "stage-03"],
  },
  {
    id: "thomson-tait-1867-kinetic-energy",
    proposition:
      "A body of mass m moving slowly at speed v carries energy of motion equal to one half m v squared.",
    status: "available",
    sources: [
      {
        title: "Treatise on Natural Philosophy",
        date: "1867",
        locator: "Oxford: Clarendon Press, §§ 212-213",
      },
    ],
    date: {
      earliest: "1867",
      latest: "1867",
      precision: "year",
      latestYear: 1867,
      eventKind: "published",
    },
    admittedStages: ["stage-05"],
  },
  {
    id: "maxwell-1873-radiation-pressure",
    proposition:
      "Light falling on a surface presses on it, so a beam carries momentum as well as energy.",
    status: "available",
    sources: [
      {
        title: "A Treatise on Electricity and Magnetism",
        date: "1873",
        locator: "Oxford: Clarendon Press, § 792",
      },
    ],
    date: {
      earliest: "1873",
      latest: "1873",
      precision: "year",
      latestYear: 1873,
      eventKind: "published",
    },
    admittedStages: ["stage-02"],
  },
  {
    id: "poynting-1884-energy-flux",
    proposition:
      "Energy in the electromagnetic field flows, and the rate of flow through a surface can be written down.",
    status: "available",
    sources: [
      {
        title: "On the Transfer of Energy in the Electromagnetic Field",
        date: "1884",
        locator: "Phil. Trans. R. Soc. 175, 343",
      },
    ],
    date: {
      earliest: "1884",
      latest: "1884",
      precision: "year",
      latestYear: 1884,
      eventKind: "published",
    },
    admittedStages: ["stage-01"],
  },
  {
    id: "lebedev-1901-radiation-pressure-measured",
    proposition:
      "The pressure of light on a solid body was measured in the laboratory and agreed with the predicted magnitude.",
    status: "available",
    sources: [
      {
        title: "Untersuchungen über die Druckkräfte des Lichtes",
        date: "1901",
        locator: "Ann. Phys. (4) 6, 433",
      },
    ],
    date: {
      earliest: "1901",
      latest: "1901",
      precision: "year",
      latestYear: 1901,
      eventKind: "published",
    },
    admittedStages: ["stage-02"],
  },
  {
    id: "einstein-1905-light-complex-transformation",
    proposition:
      "The energy a given bundle of light is measured to carry depends on the frame it is measured in, by a factor fixed by the frame's speed and the direction of the light.",
    status: "available",
    limits:
      "This is a 1905 result, not a 1904 one. It is imported into this route on purpose and is the only step here that is not available to a reader standing at the end of 1904.",
    admittedImport: {
      declaringJourney: "mass-energy",
      sourceKey: "ap-17-891",
      anchor: "/papers/special-relativity/s8/",
      provenance:
        "Section 8 of Zur Elektrodynamik bewegter Körper, received 30 June 1905, published 26 September 1905. The mass-energy paper was received 27 September 1905 and rests on it.",
    },
    paperCitesOrAsserts: [
      {
        paper: "mass-energy",
        note: "Its opening paragraphs state this result, cite it to § 8 of the June paper with a footnote to Ann. d. Phys. 17, p. 891, and say that it will be used.",
      },
    ],
    sources: [
      {
        title: "Zur Elektrodynamik bewegter Körper, § 8",
        date: "1905",
        locator: "Ann. Phys. (4) 17, 891, at 912-914",
      },
    ],
    date: {
      earliest: "1905",
      latest: "1905",
      precision: "year",
      latestYear: 1905,
      eventKind: "published",
    },
    admittedStages: ["stage-03"],
  },
];
