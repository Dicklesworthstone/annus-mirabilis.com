/**
 * The 1904 shelf for the light-quanta discovery route.
 *
 * OUTSIDE THE PAGE, for the reason massEnergyShelf.ts records: a Next page module may export
 * only the route contract, and exporting data from one broke the production build.
 *
 * EVERY CARD HERE IS PRE-1905. Unlike the mass-energy route this one needs no admitted import:
 * the whole argument can be reached from what a careful reader had at the end of 1904, which is
 * part of what makes it worth walking.
 *
 * THE PLANCK CARD CARRIES A LIMIT, and it is the most important line in this file. AGENTS.md
 * lists "Say Planck had already proposed Einstein's light quanta" among the anachronisms this
 * edition must refuse, and requires that oscillator-energy elements be distinguished from
 * radiation behaving as independent quanta. That distinction lives on the card rather than only
 * in the prose, so a reader who opens the shelf without reading the step meets it too.
 *
 * NO VERIFICATION RECORDS, on the same grounds as the mass-energy shelf: VerificationMethod is
 * "library scan" | "bound volume" | "publisher facsimile" | "comparison edition" and I performed
 * none of them. These dates are from standard bibliography. The cards therefore render with
 * CardDetail's "Awaiting verification" marker and publicationGate refuses them in production
 * until a human verifies them, which is the correct refusal.
 */

import type { KnowledgeCard } from "../discovery/cards/types.ts";

export const LIGHT_QUANTA_SHELF_CARDS: readonly KnowledgeCard[] = [
  {
    id: "fresnel-1826-diffraction",
    proposition:
      "Treating light as a wave predicts where diffraction and interference fringes fall, and the predictions match measurement.",
    status: "available",
    sources: [
      {
        title: "Mémoire sur la diffraction de la lumière",
        date: "1826",
        locator: "Mém. Acad. Sci. 5, 339",
      },
    ],
    date: {
      earliest: "1826",
      latest: "1826",
      precision: "year",
      latestYear: 1826,
      eventKind: "published",
    },
    admittedStages: ["stage-01"],
  },
  {
    id: "maxwell-1873-electromagnetic-light",
    proposition:
      "Light is an electromagnetic wave, and the optical behaviour of light follows from the field equations.",
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
    admittedStages: ["stage-01"],
  },
  {
    id: "equipartition-mean-resonator-energy",
    proposition:
      "In thermal equilibrium the average energy of a vibrating degree of freedom is fixed by the temperature alone, independent of what is vibrating.",
    status: "available",
    limits:
      "A result of kinetic theory, developed over two decades rather than announced on one date. Dated here to the later of its two principal statements.",
    sources: [
      { title: "Maxwell and Boltzmann on the partition of energy", date: "1860-1877", locator: "" },
    ],
    date: {
      earliest: "1860",
      latest: "1877",
      precision: "range",
      latestYear: 1877,
      eventKind: "published",
    },
    admittedStages: ["stage-03"],
  },
  {
    id: "boltzmann-1877-entropy-probability",
    proposition:
      "The entropy of a state is proportional to the logarithm of the number of ways that state can be realised.",
    status: "available",
    sources: [
      {
        title:
          "Über die Beziehung zwischen dem zweiten Hauptsatze der mechanischen Wärmetheorie und der Wahrscheinlichkeitsrechnung",
        date: "1877",
        locator: "Wiener Berichte 76, 373",
      },
    ],
    date: {
      earliest: "1877",
      latest: "1877",
      precision: "year",
      latestYear: 1877,
      eventKind: "published",
    },
    admittedStages: ["stage-05", "stage-06"],
  },
  {
    id: "wien-1896-radiation-law",
    proposition:
      "An empirical law for how black-body radiation distributes its energy across frequency, accurate where frequency divided by temperature is large.",
    status: "available",
    sources: [
      {
        title: "Über die Energieverteilung im Emissionsspectrum eines schwarzen Körpers",
        date: "1896",
        locator: "Ann. Phys. 58, 662",
      },
    ],
    date: {
      earliest: "1896",
      latest: "1896",
      precision: "year",
      latestYear: 1896,
      eventKind: "published",
    },
    admittedStages: ["stage-04"],
  },
  {
    id: "planck-1901-energy-elements",
    proposition:
      "A radiation formula covering the whole spectrum, obtained by letting the resonators exchange energy in finite elements, together with numerical values for the constants.",
    status: "available",
    limits:
      "This concerns the energy of MATERIAL RESONATORS exchanging with the field. It is not the claim that free radiation itself consists of independent quanta, and reading it as though it were is the anachronism this route must avoid. The two are different propositions and the second is what the 1905 paper argues for.",
    sources: [
      {
        title: "Über das Gesetz der Energieverteilung im Normalspectrum",
        date: "1901",
        locator: "Ann. Phys. (4) 4, 553",
      },
    ],
    date: {
      earliest: "1901",
      latest: "1901",
      precision: "year",
      latestYear: 1901,
      eventKind: "published",
    },
    admittedStages: ["stage-03", "stage-06"],
  },
  {
    id: "stokes-1852-refrangibility",
    proposition:
      "Light re-emitted by a fluorescing substance is of lower frequency than the light that excited it.",
    status: "available",
    sources: [
      {
        title: "On the Change of Refrangibility of Light",
        date: "1852",
        locator: "Phil. Trans. R. Soc. 142, 463",
      },
    ],
    date: {
      earliest: "1852",
      latest: "1852",
      precision: "year",
      latestYear: 1852,
      eventKind: "published",
    },
    admittedStages: ["stage-07"],
  },
  {
    id: "lenard-1902-photoelectric",
    proposition:
      "The energy of the electrons that ultraviolet light drives out of a metal does not depend on how bright the light is.",
    status: "available",
    sources: [
      {
        title: "Über die lichtelektrische Wirkung",
        date: "1902",
        locator: "Ann. Phys. (4) 8, 149",
      },
    ],
    date: {
      earliest: "1902",
      latest: "1902",
      precision: "year",
      latestYear: 1902,
      eventKind: "published",
    },
    admittedStages: ["stage-02", "stage-07"],
  },
];
