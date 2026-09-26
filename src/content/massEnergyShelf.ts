/**
 * The 1904 shelf for the mass-energy discovery route.
 *
 * THIS LIVES OUTSIDE THE PAGE ON PURPOSE. A Next.js page module may only export the route
 * contract - default, metadata, generateStaticParams and friends - and the generated types in
 * .next/types reject anything else with TS2344. Exporting the cards from the page to make them
 * validatable broke `bun run check:types` for every pane; data belongs in a data module.
 *
 * SOURCE CHECKS, NOT VERIFICATIONS. Each source has been checked by an agent against page images
 * of a scan with open terms, or a catalog record, and what matched is in the card's
 * `sourceChecks` (dispatch 251). Where no scan could be read, the check is the catalog record and
 * says the article's text was not read. None of it is a verification: publicationGate still waits
 * for a person, and the page shows no verification status.
 */
import type { KnowledgeCard } from "../discovery/cards/types.ts";

export const MASS_ENERGY_SHELF_CARDS: readonly KnowledgeCard[] = [
  {
    id: "helmholtz-1847-conservation-of-energy",
    proposition:
      "For material points acting on one another by attracting and repelling forces that depend only on their distance, the tensional force lost always equals the living force gained, so their sum stays constant: Helmholtz calls this the principle of the conservation of force, what is now called energy, and carries it to heat, electricity and magnetism.",
    status: "available",
    sources: [
      {
        title: "Über die Erhaltung der Kraft",
        date: "1847",
        locator: "Berlin: G. Reimer, p. 17",
      },
    ],
    date: {
      earliest: "1847",
      latest: "1847",
      precision: "year",
      latestYear: 1847,
      eventKind: "published",
    },
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:GreenBarn",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/berdieerhaltung00berlgoog/page/n28",
        read: "page-image",
        matched:
          'A photographic facsimile of the 1847 edition (impression anastatique, Culture et Civilisation, Bruxelles, 1966). Its title page (leaf n8): Über die Erhaltung der Kraft, eine physikalische Abhandlung, vorgetragen in der Sitzung der physikalischen Gesellschaft zu Berlin am 23sten Juli 1847 von Dr. H. Helmholtz, Berlin, Druck und Verlag von G. Reimer, 1847. p. 17 (leaf n28): "In allen Fällen der Bewegung freier materieller Puncte unter dem Einfluss ihrer anziehenden und abstossenden Kräfte, deren Intensitäten nur von der Entfernung abhängig sind, ist der Verlust an Quantität der Spannkraft stets gleich dem Gewinn an lebendiger Kraft ... Es ist also stets die Summe der vorhandenen lebendigen und Spannkräfte constant. In dieser allgemeinsten Form können wir unser Gesetz als das Princip von der Erhaltung der Kraft bezeichnen." The contents list the Kraftäquivalent of heat (p. 25), of electrical processes (p. 37) and of magnetism and electromagnetism (p. 60).',
        differs: [
          "The card said the total energy of an isolated system is conserved and the books must balance, a later restatement. It now gives Helmholtz's condition, forces depending only on distance, and his terms, and the locator names p. 17.",
        ],
      },
    ],
    admittedStages: ["stage-01", "stage-03"],
  },
  {
    id: "thomson-tait-1867-kinetic-energy",
    proposition:
      "The kinetic energy of a moving body is proportional to its mass and the square of its velocity, and Thomson and Tait define it as half the product of the mass and the square of the velocity.",
    status: "available",
    sources: [
      {
        title: "Treatise on Natural Philosophy",
        date: "1867",
        locator: "Oxford: Clarendon Press, vol. I, § 213, p. 163",
      },
    ],
    date: {
      earliest: "1867",
      latest: "1867",
      precision: "year",
      latestYear: 1867,
      eventKind: "published",
    },
    limits:
      "A definition in Newtonian mechanics, stated with no restriction on the speed. The route uses it for speeds small compared with that of light.",
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:GreenBarn",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/in.ernet.dli.2015.228470/page/n191",
        read: "page-image",
        matched:
          'Digital Library of India scan. Title page (leaf n7): A Treatise on Natural Philosophy by Sir William Thomson and Peter Guthrie Tait, Vol. I, Oxford at the Clarendon Press, MDCCCLXVII. p. 163 (leaf n191), § 213: "The Vis Viva, or Kinetic Energy, of a moving body is proportional to the mass and the square of the velocity, conjointly. If we adopt the same units of mass and velocity as before, there is particular advantage in defining kinetic energy as half the product of the mass and the square of its velocity." § 212 on the same page is the rate of change of momentum.',
        differs: [
          "The locator named §§ 212-213; the kinetic energy is § 213 alone, p. 163.",
          'The card said a body "moving slowly". § 213 is a definition with no restriction on the speed; the card now states it so, and its limits say the route uses it for low speeds.',
        ],
      },
    ],
    admittedStages: ["stage-05"],
  },
  {
    id: "maxwell-1873-radiation-pressure",
    proposition:
      "In a medium through which light waves travel there is a pressure normal to the waves, equal to the energy in unit of volume, so that a body on which light falls is pushed away from the side it falls on.",
    status: "available",
    sources: [
      {
        title: "A Treatise on Electricity and Magnetism",
        date: "1873",
        locator: "Oxford: Clarendon Press, vol. II, §§ 792-793, pp. 391-392",
      },
    ],
    date: {
      earliest: "1873",
      latest: "1873",
      precision: "year",
      latestYear: 1873,
      eventKind: "published",
    },
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:GreenBarn",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/electricandmag02maxwrich/page/n422",
        read: "page-image",
        matched:
          'University of California scan. Title page (leaf n8): A Treatise on Electricity and Magnetism by James Clerk Maxwell, M.A., Vol. II, Oxford at the Clarendon Press 1873. § 792, p. 391 (leaf n422), Energy and Stress of Radiation: "Hence in a medium in which waves are propagated there is a pressure in the direction normal to the waves, and numerically equal to the energy in unit of volume." § 793: a flat body exposed to sunlight "would experience this pressure on its illuminated side only, and would therefore be repelled from the side on which the light falls".',
        differs: [
          "The card said a beam carries momentum as well as energy. §§ 792-793 speak of a pressure and a repelled body, not of momentum; the card now says what they say, and the locator names §§ 792-793, pp. 391-392.",
        ],
      },
    ],
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
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:GreenBarn",
        checkedOn: "2026-09-26",
        url: "https://api.crossref.org/works/10.1098/rstl.1884.0016",
        read: "catalog-record",
        matched:
          "On the transfer of energy in the electromagnetic field, J. H. Poynting, Philosophical Transactions of the Royal Society of London, pp. 343-361, published-print 1884.",
      },
      {
        source: 0,
        checkedBy: "agent:GreenBarn",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/philtrans03617950",
        read: "page-image",
        matched:
          'Royal Society scan of Phil. Trans. 175. p. 343: "XV. On the Transfer of Energy in the Electromagnetic Field. By J. H. Poynting ... Received December 17, 1883,—Read January 10, 1884." p. 344: "The aim of this paper is to prove that there is a general law for the transfer of energy, according to which it moves at any point perpendicularly to the plane containing the lines of electric force and magnetic force, and that the amount crossing unit of area per second of this plane is equal to the product of the intensities of the two forces multiplied by the sine of the angle between them divided by 4π".',
      },
    ],
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
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:GreenBarn",
        checkedOn: "2026-09-26",
        url: "https://api.crossref.org/works/10.1002/andp.19013111102",
        read: "catalog-record",
        matched:
          "Untersuchungen über die Druckkräfte des Lichtes, Peter Lebedew, Annalen der Physik 311 (series 4, volume 6), pp. 433-458, 1901. The article's text was not read: archive.org's scan of the issue (sim_annalen-der-physik_1901_6_2) has a blank leaf for p. 433, its next issue serves no files, HathiTrust's catalog refused the request, and the publisher's page answered with a challenge. The proposition is not yet checked against the text.",
      },
    ],
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
        locator: "Ann. Phys. (4) 17, 891, at 913-914",
      },
    ],
    date: {
      earliest: "1905",
      latest: "1905",
      precision: "year",
      latestYear: 1905,
      eventKind: "published",
    },
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:GreenBarn",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/sim_annalen-der-physik_1905_17_5/page/n136",
        read: "page-image",
        matched:
          'The scan the edition\'s pinned facsimile comes from (docs/provenance/ap-17-891.md). p. 912 (leaf n135) is still § 7. p. 913 (leaf n136): "§ 8. Transformation der Energie der Lichtstrahlen. Theorie des auf vollkommene Spiegel ausgeübten Strahlungsdruckes." with E\'/E = (1 - (v/V) cos φ)/sqrt(1 - (v/V)^2); p. 914 (leaf n137): its form for φ = 0, and "Es ist bemerkenswert, daß die Energie und die Frequenz eines Lichtkomplexes sich nach demselben Gesetze mit dem Bewegungszustande des Beobachters ändern."',
        differs: [
          "The locator said pp. 912-914; § 8 begins on p. 913, and the transformation stands on pp. 913-914.",
        ],
      },
    ],
    admittedStages: ["stage-03"],
  },
  {
    id: "thomson-1881-electromagnetic-mass",
    proposition:
      "J. J. Thomson finds that a charged sphere moving through the ether carries a magnetic field whose energy makes the sphere harder to accelerate: its charge adds to its inertia.",
    status: "available",
    sources: [
      {
        title: "On the Electric and Magnetic Effects produced by the Motion of Electrified Bodies",
        date: "1881",
        locator: "Phil. Mag. (5) 11, 229",
      },
    ],
    date: {
      earliest: "1881",
      latest: "1881",
      precision: "year",
      latestYear: 1881,
      eventKind: "published",
    },
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:GreenBarn",
        checkedOn: "2026-09-26",
        url: "https://api.crossref.org/works/10.1080/14786448108627008",
        read: "catalog-record",
        matched:
          "XXXIII. On the electric and magnetic effects produced by the motion of electrified bodies, J. J. Thomson, The London, Edinburgh, and Dublin Philosophical Magazine and Journal of Science, volume 11, pp. 229-249, April 1881. The article's text was not read: no archive.org scan of the fifth series' volume 11 was found. The proposition is not yet checked against the text.",
      },
    ],
    limits:
      "An electromagnetic addition to the inertia of a charged body. It says nothing about uncharged matter, or about energy leaving a body.",
    admittedStages: ["stage-05"],
  },
  {
    id: "poincare-1900-fictitious-fluid",
    proposition:
      "To keep the centre of mass of a body and its field moving uniformly when the body emits radiation, Poincaré treats electromagnetic energy as a fictitious fluid whose mass is its energy divided by the square of the speed of light.",
    status: "available",
    sources: [
      {
        title: "La théorie de Lorentz et le principe de réaction",
        date: "1900",
        locator: "Arch. néerl. sci. exactes nat. (2) 5, 252",
      },
    ],
    date: {
      earliest: "1900",
      latest: "1900",
      precision: "year",
      latestYear: 1900,
      eventKind: "published",
    },
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:GreenBarn",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/archivesnerlan0205holl/page/n275",
        read: "page-image",
        matched:
          'Archives néerlandaises des sciences exactes et naturelles, série II, tome V (1900). p. 252 (leaf n271): "La théorie de Lorentz et le principe de réaction par H. Poincaré". p. 256 (leaf n275): "Nous pouvons regarder l\'énergie électromagnétique comme un fluide fictif dont la densité est K0 J et qui se déplace dans l\'espace conformément aux lois de Poynting", a fluid that is not indestructible. p. 258: with no creation or destruction of electromagnetic energy, "le centre de gravité du système formé par la matière et par l\'énergie électromagnétique (regardée comme un fluide fictif) a un mouvement rectiligne et uniforme", and "il ne s\'agit que d\'une fiction mathématique". p. 260: an apparatus of 1 kg sending three million joules in one direction recoils at 1 cm per second, which is momentum E/c, that of a fluid of mass E/c² moving at the speed of light.',
      },
    ],
    limits:
      "The fluid is bookkeeping for the field, which Poincaré himself calls fictitious. It is not a claim that emitting light changes the inertia of the body that emits it.",
    admittedStages: ["stage-05"],
  },
  {
    id: "hasenoehrl-1904-cavity-radiation",
    proposition:
      "Hasenöhrl finds that the radiation enclosed in a moving cavity adds to the cavity's apparent mass, by an amount proportional to the radiation's energy divided by the square of the speed of light.",
    status: "available",
    sources: [
      {
        title: "Zur Theorie der Strahlung in bewegten Körpern",
        date: "1904",
        locator: "Ann. Phys. (4) 15, 344",
      },
    ],
    date: {
      earliest: "1904",
      latest: "1904",
      precision: "year",
      latestYear: 1904,
      eventKind: "published",
    },
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:GreenBarn",
        checkedOn: "2026-09-26",
        url: "https://api.crossref.org/works/10.1002/andp.19043201206",
        read: "catalog-record",
        matched:
          "Zur Theorie der Strahlung in bewegten Körpern, Fritz Hasenöhrl, Annalen der Physik 320 (series 4, volume 15), pp. 344-370, 1904. The same catalog lists his Berichtigung, Annalen der Physik 321 (series 4, volume 16), pp. 589-592, 1905 (10.1002/andp.19053210312).",
      },
      {
        source: 0,
        checkedBy: "agent:GreenBarn",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/sim_annalen-der-physik_1904_15_2/page/n142",
        read: "page-image",
        matched:
          'p. 344 (leaf n123): "5. Zur Theorie der Strahlung in bewegten Körpern; von Fritz Hasenöhrl." p. 363 (leaf n142): the work of acceleration makes it "als ob die Masse unseres Systems um den Betrag 2hε0τ/w² vermehrt worden wäre", an apparent increase of mass "unabhängig von der Geschwindigkeit, und zwar gleich: (32) 8/3 · hε0/c²", the ratio of this apparent mass to the energy of the resting cavity being 8/3c². p. 370: "Wien, im Juli 1904. (Eingegangen 28. Juli 1904.)" The Berichtigung (archive.org sim_annalen-der-physik_1905_16_3, leaves n178-n181), received 26 January 1905: the value is 4/3 · hε0/c², "genau die Hälfte des von mir angegebenen Wertes", from a calculation error on p. 362.',
      },
    ],
    limits:
      "Derived for radiation shut in a cavity, not for a body's own energy, and with a numerical factor he corrected in 1905 that differs from the later result.",
    admittedStages: ["stage-05"],
  },
];

/**
 * Later evidence: never on the 1904 shelf (cardRules.ts, card-later-on-shelf), shown beside the
 * route's check against the world. Plan §9.5 names the first quantitative nuclear check as a
 * timeline card; it is described here without figures, which this edition has not transcribed.
 */
export const MASS_ENERGY_LATER_EVIDENCE: readonly KnowledgeCard[] = [
  {
    id: "cockcroft-walton-1932-lithium",
    proposition:
      "Cockcroft and Walton break lithium nuclei apart with fast protons, producing pairs of alpha particles, and compare the energy the alpha particles carry with the loss of mass computed from the atomic masses. The two agree within the uncertainty of the masses then known.",
    status: "later",
    sources: [
      {
        title:
          "Experiments with high velocity positive ions. II. The disintegration of elements by high velocity protons",
        date: "1932",
        locator: "Proc. R. Soc. A 137, 229",
      },
    ],
    date: {
      earliest: "1932-07",
      latest: "1932-07",
      precision: "month",
      latestYear: 1932,
      eventKind: "published",
    },
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:GreenBarn",
        checkedOn: "2026-09-26",
        url: "https://api.crossref.org/works/10.1098/rspa.1932.0133",
        read: "catalog-record",
        matched:
          "Experiments with high velocity positive ions. II. The disintegration of elements by high velocity protons, John Douglas Cockcroft and E. T. S. Walton, Proceedings of the Royal Society of London A, volume 137, pp. 229-242, 1 July 1932. The article's text was not read: no scan with open terms was found, and the publisher's copy was not reachable. The proposition is not yet checked against the text.",
      },
    ],
    limits:
      "Later evidence, not on the 1904 shelf, and twenty-seven years after the paper. The edition has not transcribed its figures.",
  },
  {
    id: "bainbridge-1933-mass-spectrograph",
    proposition:
      "Bainbridge measures the masses of the nuclei in the lithium disintegration with a mass spectrograph, and sets the mass that disappears beside the energy the alpha particles carry away.",
    status: "later",
    sources: [
      {
        title: "The Equivalence of Mass and Energy",
        date: "1933",
        locator: "Phys. Rev. 44, 123",
      },
    ],
    date: {
      earliest: "1933",
      latest: "1933",
      precision: "year",
      latestYear: 1933,
      eventKind: "published",
    },
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:GreenBarn",
        checkedOn: "2026-09-26",
        url: "https://api.crossref.org/works/10.1103/physrev.44.123.2",
        read: "catalog-record",
        matched:
          "The Equivalence of Mass and Energy, Kenneth T. Bainbridge, Physical Review volume 44, p. 123, 15 July 1933. The article's text was not read: no scan with open terms was found. The proposition is not yet checked against the text.",
      },
    ],
    limits:
      "Later evidence, not on the 1904 shelf, and a check on the masses Cockcroft and Walton used rather than a new reaction. The edition has not transcribed its figures.",
  },
];
