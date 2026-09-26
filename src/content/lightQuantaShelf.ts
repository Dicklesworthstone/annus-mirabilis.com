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
 * none of them. publicationGate therefore refuses them in production until a human verifies
 * them, which is the correct refusal. The cards show no verification status (dispatch 243,
 * D-2026-09-25-no-review-status-banners); the missing record is the audit trail's.
 *
 * WHAT WAS CHECKED, AND AGAINST WHAT (GreenBarn, 2026-09-24, dispatch 142). Each journal locator
 * below was compared with the publisher's metadata in Crossref: volume, first page and year agree
 * for Rayleigh (Phil. Mag. (5) 49, 539; June 1900; doi:10.1080/14786440009463878), Planck
 * (Ann. Phys. (4) 4, 553; 10.1002/andp.19013090310), Lenard ((4) 8, 149; 10.1002/andp.19023130510),
 * Wien ((Wied.) 58, 662; 10.1002/andp.18962940803), Stokes (Phil. Trans. 142, 463;
 * 10.1098/rstl.1852.0022), Rubens and Kurlbaum ((4) 4, 649; 10.1002/andp.19013090402), Hertz
 * ((Wied.) 31, 983; 10.1002/andp.18872670827) and Thomson (Phil. Mag. (5) 48, 547;
 * 10.1080/14786449908621447). Crossref numbers the Annalen by whole series, so (4) 4 appears
 * there as volume 309. Boltzmann's Gastheorie (Leipzig: Barth, 1896) was found on archive.org
 * (vorlesungenber01bolt). Fresnel's memoir and Boltzmann's 1877 paper are not in Crossref and
 * were not checked. A metadata match is not a verification: nobody here has read the pages.
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
      "The energy of the electrons that ultraviolet light drives out of a metal does not depend on how bright the light is, while the number driven out grows with the brightness.",
    status: "available",
    limits:
      "Lenard found the greatest energy depending on the kind of light, not on its intensity. He did not establish that it rises in proportion to the frequency: that is the 1905 paper's prediction, tested by Millikan in 1916.",
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
  {
    id: "rayleigh-1900-radiation-law",
    proposition:
      "Giving each mode of vibration of the radiation its equal share of energy predicts, at long wavelengths, an intensity proportional to the temperature and to the inverse fourth power of the wavelength.",
    status: "available",
    limits:
      "Rayleigh offered it for long waves only, with a factor of his own to keep it finite at short ones; that printed form is not yet transcribed here. The constant usually quoted with it comes from Jeans in July 1905, after the light-quanta paper was received, and is not on this shelf.",
    sources: [
      {
        title: "Remarks upon the Law of Complete Radiation",
        date: "1900-06",
        locator: "Phil. Mag. (5) 49, 539",
      },
    ],
    date: {
      earliest: "1900-06",
      latest: "1900-06",
      precision: "month",
      latestYear: 1900,
      eventKind: "published",
    },
    admittedStages: ["stage-03"],
  },
  {
    id: "rubens-1901-long-wave-radiation",
    proposition:
      "Measured at long wavelengths, black-body radiation departs from Wien's law and grows in proportion to the temperature.",
    status: "available",
    limits:
      "An empirical result at wavelengths of tens of micrometres. Rubens and Kurlbaum reported it to the Berlin Academy in October 1900, before this printed version, and Lummer and Pringsheim found departures from Wien's law the same year.",
    sources: [
      {
        title: "Anwendung der Methode der Reststrahlen zur Prüfung des Strahlungsgesetzes",
        date: "1901",
        locator: "Ann. Phys. (4) 4, 649",
      },
    ],
    date: {
      earliest: "1901",
      latest: "1901",
      precision: "year",
      latestYear: 1901,
      eventKind: "published",
    },
    admittedStages: ["stage-03", "stage-04"],
  },
  {
    id: "boltzmann-1896-gas-volume-entropy",
    proposition:
      "At a fixed temperature the entropy of an ideal gas changes with its volume as the logarithm of the volume, multiplied by the number of molecules and a constant: R log(V/V₀) per gram-molecule.",
    status: "available",
    limits:
      "For an ideal gas of independent molecules at low density. The molecular form needs N, the number of molecules in a gram-molecule, whose value was uncertain in 1904. The page of this edition where the form is stated is not yet recorded.",
    sources: [
      {
        title: "Vorlesungen über Gastheorie, I. Theil",
        date: "1896",
        locator: "Leipzig: J. A. Barth",
      },
    ],
    date: {
      earliest: "1896",
      latest: "1896",
      precision: "year",
      latestYear: 1896,
      eventKind: "published",
    },
    admittedStages: ["stage-05", "stage-06"],
  },
  {
    id: "hertz-1887-ultraviolet-spark",
    proposition: "Ultraviolet light falling on a spark gap makes the spark pass more easily.",
    status: "available",
    limits: "A phenomenon, reported without a mechanism.",
    sources: [
      {
        title: "Ueber einen Einfluss des ultravioletten Lichtes auf die electrische Entladung",
        date: "1887",
        locator: "Ann. Phys. (Wied.) 31, 983",
      },
    ],
    date: {
      earliest: "1887",
      latest: "1887",
      precision: "year",
      latestYear: 1887,
      eventKind: "published",
    },
    admittedStages: ["stage-02"],
  },
  {
    id: "thomson-1899-photoelectric-carrier",
    proposition:
      "The negative charges released from a metal by ultraviolet light have the same ratio of charge to mass as the particles of cathode rays.",
    status: "available",
    limits:
      "Identifies what comes out of the metal. It says nothing about how much energy each carries.",
    sources: [
      {
        title: "On the Masses of the Ions in Gases at Low Pressures",
        date: "1899-12",
        locator: "Phil. Mag. (5) 48, 547",
      },
    ],
    date: {
      earliest: "1899-12",
      latest: "1899-12",
      precision: "month",
      latestYear: 1899,
      eventKind: "published",
    },
    admittedStages: ["stage-02", "stage-07"],
  },
];

/**
 * Later evidence: never on the 1904 shelf (cardRules.ts, card-later-on-shelf), shown beside the
 * route's check against the world. Cited, not plotted: the edition's digitised table of Millikan's
 * points is withdrawn (141c8c0b), so no point of his is drawn anywhere on the route. The locator
 * was compared with Crossref (doi:10.1103/PhysRev.7.355).
 */
export const LIGHT_QUANTA_LATER_EVIDENCE: readonly KnowledgeCard[] = [
  {
    id: "millikan-1916-photoelectric-h",
    proposition:
      "Millikan measures the stopping potential of electrons driven out of sodium by light of several frequencies, and finds it rising in a straight line with the frequency, with the slope the 1905 relation predicts.",
    status: "later",
    sources: [
      {
        title: "A Direct Photoelectric Determination of Planck's “h”",
        date: "1916-03",
        locator: "Phys. Rev. 7, 355",
      },
    ],
    date: {
      earliest: "1916-03",
      latest: "1916-03",
      precision: "month",
      latestYear: 1916,
      eventKind: "published",
    },
    limits:
      "Later evidence, not on the 1904 shelf, eleven years after the paper. In the same paper Millikan still judged the hypothesis that produced the equation untenable: a relation can be confirmed without confirming the reason given for it. The edition's digitised table of his points is withdrawn, so none is plotted here.",
  },
];
