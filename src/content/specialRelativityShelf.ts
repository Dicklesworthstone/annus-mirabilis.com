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
 * NO VERIFICATION RECORDS. Each source has been checked by an agent against page images of a
 * scan with open terms, or a catalog record, and what matched is in the card's `sourceChecks`
 * (dispatch 251). That is evidence in the data, not a verification: publicationGate still waits
 * for a person to verify the cards, and the page shows no verification status (dispatch 243,
 * D-2026-09-25-no-review-status-banners). Where a check found the card saying more than its
 * source, the card now says what the source says, and the check records what changed.
 */

import type { KnowledgeCard } from "../discovery/cards/types.ts";

export const SPECIAL_RELATIVITY_SHELF_CARDS: readonly KnowledgeCard[] = [
  {
    id: "newton-1687-absolute-time",
    proposition:
      "Absolute, true and mathematical time flows equably of itself, without relation to anything external; hours, days, months and years are its relative, apparent measures.",
    status: "available",
    limits:
      "The default assumption rather than a measured result. It is on the shelf because it is what the route asks you to give up, and it had never needed defending. The route reads from it that two events either happen at once or they do not, whoever is asking; the Scholium itself says nothing about simultaneity.",
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
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:GreenBarn",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/philosophiaenat00newt/page/n18",
        read: "page-image",
        matched:
          'Smithsonian Libraries scan of the first edition. Title page (leaf n6): Philosophiae Naturalis Principia Mathematica, autore Js. Newton, imprimatur S. Pepys 5 July 1686, Londini, jussu Societatis Regiae ac typis Josephi Streater, anno MDCLXXXVII. Scholium to the Definitions, p. 5 (leaf n18), I: "Tempus absolutum verum & Mathematicum, in se & natura sua absq; relatione ad externum quodvis, aequabiliter fluit, alioq; nomine dicitur Duratio; relativum apparens & vulgare est sensibilis & externa quaevis Durationis per motum mensura ... ut Hora, Dies, Mensis, Annus."',
        differs: [
          "The card said two events either happen at once or they do not, whoever is asking. The Scholium says nothing about simultaneity; the card now states absolute and relative time as p. 5 does, and the limits say the simultaneity is the route's reading.",
        ],
      },
    ],
    admittedStages: ["stage-03", "stage-04"],
  },
  {
    id: "bradley-1729-stellar-aberration",
    proposition:
      "A star's apparent position shifts through the year by an amount set by the Earth's speed and the speed of light.",
    status: "available",
    sources: [
      {
        title:
          "A Letter from the Reverend Mr. James Bradley Savilian Professor of Astronomy at Oxford, and F.R.S. to Dr. Edmond Halley Astronom. Reg. &c. giving an Account of a new discovered Motion of the Fix'd Stars",
        date: "1728-1729",
        locator: "Phil. Trans. R. Soc. 35, no. 406, 637",
      },
    ],
    date: {
      earliest: "1728",
      latest: "1729",
      precision: "range",
      latestYear: 1729,
      eventKind: "published",
    },
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:GreenBarn",
        checkedOn: "2026-09-26",
        url: "https://api.crossref.org/works/10.1098/rstl.1727.0064",
        read: "catalog-record",
        matched:
          "Philosophical Transactions of the Royal Society of London, volume 35, issue 406, pp. 637-661, author James Bradley; published-print 1728-12-31.",
        differs: [
          "The card dated the letter 1729. The catalog dates number 406 to 1728, a nominal 31 December, and the letter itself carries no date (pp. 637-661 read); the number's own date line was not found. The card now gives the range 1728-1729.",
        ],
      },
      {
        source: 0,
        checkedBy: "agent:GreenBarn",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/philtrans02540261",
        read: "page-image",
        matched:
          'Royal Society scan, Public Domain Mark. p. 637: "IV. A Letter from the Reverend Mr. James Bradley Savilian Professor of Astronomy at Oxford, and F.R.S. to Dr. Edmond Halley Astronom. Reg. &c. giving an Account of a new discovered Motion of the Fix\'d Stars." p. 646: "At last I conjectured, that all the Phaenomena hitherto mentioned, proceeded from the progressive Motion of Light and the Earth\'s annual Motion in its Orbit." p. 648: the sine of the difference between the real and visible place is to the sine of the visible inclination as the velocity of the eye to the velocity of light.',
        differs: [
          "The card shortened the printed title without marking the omission; it now carries the title as p. 637 prints it.",
        ],
      },
    ],
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
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:GreenBarn",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/comptes-rendus-hebdomadaires-academie-des-sciences_1851-09-29_33_13",
        read: "page-image",
        matched:
          "Comptes rendus t. XXXIII, no. 13, séance du lundi 29 septembre 1851. p. 349 (leaf n20): \"Sur les hypothèses relatives à l'éther lumineux, et sur une expérience qui paraît démontrer que le mouvement des corps change la vitesse avec laquelle la lumière se propage dans leur intérieur; par M. H. Fizeau.\" pp. 354-355: moving air gives no sensible displacement of the fringes, moving water a sensible one, near the value of Fresnel's hypothesis; p. 355: \"Le succès de cette expérience me semble devoir entraîner l'adoption de l'hypothèse de Fresnel, ou du moins de la loi qu'il a trouvée pour exprimer le changement de la vitesse de la lumière par l'effet du mouvement des corps\".",
      },
    ],
    admittedStages: ["stage-06", "stage-08"],
  },
  {
    id: "maxwell-1873-field-equations",
    proposition:
      "The equations of the electromagnetic field fix the speed at which an electromagnetic disturbance travels, and Maxwell argues that light is such a disturbance, because that speed and the measured speed of light agree as far as the measurements go.",
    status: "available",
    sources: [
      {
        title: "A Treatise on Electricity and Magnetism",
        date: "1873",
        locator: "Oxford: Clarendon Press, vol. II, ch. XX, §§ 781-787",
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
        url: "https://archive.org/details/electricandmag02maxwrich/page/n418",
        read: "page-image",
        matched:
          'University of California scan. Title page (leaf n8): A Treatise on Electricity and Magnetism by James Clerk Maxwell, M.A., Vol. II, Oxford at the Clarendon Press 1873. Ch. XX, Electromagnetic Theory of Light: § 781, p. 383, "If it should be found that the velocity of propagation of electromagnetic disturbances is the same as the velocity of light ... we shall have strong reasons for believing that light is an electromagnetic phenomenon"; § 786, p. 387, the velocity of propagation of electromagnetic disturbances in a non-conducting medium is 1/sqrt(K mu); § 787, the measured velocities of light and the ratio of the units are "quantities of the same order of magnitude"; p. 388, "our theory, which asserts that these two quantities are equal ... is certainly not contradicted by the comparison".',
        differs: [
          "The card said one set of equations governs electricity, magnetism and light. Maxwell argues for it and says the comparison does not contradict it; the card now keeps that hedge, and the locator names §§ 781-787.",
        ],
      },
    ],
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
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:GreenBarn",
        checkedOn: "2026-09-26",
        url: "https://api.crossref.org/works/10.2475/ajs.s3-34.203.333",
        read: "catalog-record",
        matched:
          "On the relative motion of the Earth and the luminiferous ether, A. A. Michelson and E. W. Morley, American Journal of Science s3-34, pp. 333-345, 1887-11-01.",
      },
      {
        source: 0,
        checkedBy: "agent:GreenBarn",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/sim_american-journal-of-science_1887-11_34_203",
        read: "page-image",
        matched:
          'Cover: No. 203, Vol. XXXIV, November 1887, Third Series. p. 333 (leaf n4): "Art. XXXVI.—On the Relative Motion of the Earth and the Luminiferous Æther; by Albert A. Michelson and Edward W. Morley." p. 341: "the displacement to be expected was 0·4 fringe. The actual displacement was certainly less than the twentieth part of this, and probably less than the fortieth part"; the relative velocity of the earth and the ether is "probably less than one sixth the earth\'s orbital velocity, and certainly less than one-fourth".',
      },
    ],
    admittedStages: ["stage-02", "stage-07"],
  },
  {
    id: "lorentz-1904-corresponding-states",
    proposition:
      "Keep the ether at rest, suppose that moving electrons and bodies contract along their motion, and describe the moving system in a local time: then every state of a system at rest has a counterpart when it moves, which accounts for the negative results of Michelson, of Rayleigh and Brace, and of Trouton and Noble.",
    status: "available",
    limits:
      "This is not a failed theory. Within the scope of these experiments it gives the same formulas and the same predictions as the 1905 kinematics, and the route does not declare it refuted. What separates them is what each takes as given and what each has to add by hand, not a measurement either one fails. Lorentz's local time is a variable of his equations, not what a clock reads, and he puts the theory forward with all due reserve.",
    sources: [
      {
        title:
          "Electromagnetic phenomena in a system moving with any velocity smaller than that of light",
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
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:GreenBarn",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/proceedings-knaw-series-b_1903-1904_6/page/n866",
        read: "page-image",
        matched:
          "Proceedings of the Section of Sciences, Koninklijke Akademie van Wetenschappen te Amsterdam, vol. 6 (1903-1904). p. 809 (leaf n866): \"Physics. — 'Electromagnetic phenomena in a system moving with any velocity smaller than that of light.' By Prof. H. A. Lorentz.\" p. 824: the influence of a translation on the dimensions of the electrons and of a ponderable body \"is confined to those that have the direction of the motion, these becoming k times smaller\", and the moving system's state is the same functions of the local time. p. 825: the theory accounts for Michelson's negative result and for Rayleigh's and Brace's, and Trouton's and Noble's \"becomes at once clear\"; \"the present theory is put forward with all due reserve\".",
        differs: [
          'The title printed "smaller", where the card had "less".',
          "The card said moving clocks keep a local time. Lorentz's local time is a variable of his equations and he speaks of no clocks; the card now says so in its limits.",
          "The card said the equations reproduce the null results exactly. Lorentz says the theory accounts for them and puts it forward with all due reserve; the card now says that.",
        ],
      },
    ],
    admittedStages: ["stage-07"],
  },
  {
    id: "poincare-1904-principle-of-relativity",
    proposition:
      "The laws of physical phenomena must be the same for an observer at rest and for one carried along in uniform translation, so that there is no means of telling whether one is so carried: one of the general principles of mathematical physics, which Poincaré calls results of experiment strongly generalized.",
    status: "available",
    sources: [
      {
        title: "L'état actuel et l'avenir de la physique mathématique",
        date: "1904",
        locator: "Address at St Louis, 24 September 1904; Bull. sci. math. (2) 28, 302",
      },
    ],
    date: {
      earliest: "1904",
      latest: "1904",
      precision: "year",
      latestYear: 1904,
      eventKind: "presented",
    },
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:GreenBarn",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/s2bulletindessci28fran/page/n311",
        read: "page-image",
        matched:
          "Bulletin des sciences mathématiques, 2e série, t. 28, University of Toronto scan. p. 302 (leaf n307): \"L'état actuel et l'avenir de la physique mathématique; par M. Henri Poincaré. Conférence lue le 24 septembre 1904 au Congrès d'Art et de Science de Saint-Louis.\" p. 306 (leaf n311): \"Le principe de la relativité, d'après lequel les lois des phénomènes physiques doivent être les mêmes, soit pour un observateur fixe, soit pour un observateur entraîné dans un mouvement de translation uniforme; de sorte que nous n'avons et ne pouvons avoir aucun moyen de discerner si nous sommes, oui ou non, emportés dans un pareil mouvement.\" The same page calls such principles \"des résultats d'expériences fortement généralisées\".",
        differs: [
          "The locator now names the printing, Bull. sci. math. (2) 28, 302, and the proposition follows his wording.",
        ],
      },
    ],
    admittedStages: ["stage-03"],
  },
];

/**
 * Later evidence: never on the 1904 shelf (cardRules.ts, card-later-on-shelf), shown beside the
 * route's check against the world (dispatch 260). De Sitter's card is what decided the question the
 * source-speed fork leaves open on the shelf's evidence; Ives and Stilwell's is the measurement the
 * check against the world names. Both are cited, not plotted: the edition holds no table of either.
 * Each was read on the page, in scans that answered without a login, and in a catalog record.
 */
export const SPECIAL_RELATIVITY_LATER_EVIDENCE: readonly KnowledgeCard[] = [
  {
    id: "de-sitter-1913-double-stars",
    proposition:
      "De Sitter argues from spectroscopic double stars that if light from a source moving at speed u travelled at c + u, as in Ritz's theory, their observed motions would follow not Newton's law but a law depending on their distance from the Earth. Their observed velocities are represented by Keplerian orbits, in many cases confirmed by visual or eclipse observations, and he concludes that the velocity of light is independent of the motion of the source.",
    status: "later",
    sources: [
      {
        title: "A proof of the constancy of the velocity of light",
        date: "1913",
        locator: "Proc. R. Acad. Amsterdam 15, 1297",
      },
    ],
    date: {
      earliest: "1913",
      latest: "1913",
      precision: "year",
      latestYear: 1913,
      eventKind: "published",
    },
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:NavyKite",
        checkedOn: "2026-09-26",
        url: "https://dwc.knaw.nl/toegangen/digital-library-knaw/?pagetype=publDetail&pId=PU00013063",
        read: "catalog-record",
        matched:
          "KNAW Digital Library, publication PU00013063: A proof of the constancy of the velocity of light, Sitter, Willem de, Proceedings, volume 15 (1913), pp. 1297-1298.",
      },
      {
        source: 0,
        checkedBy: "agent:NavyKite",
        checkedOn: "2026-09-26",
        url: "https://dwc.knaw.nl/DL/publications/PU00013063.pdf",
        read: "page-image",
        matched:
          'p. 1297: "Astronomy. — "A proof of the constancy of the velocity of light". By Prof. W. de Sitter. (Communicated in the meeting of February 22, 1913)"; "In the theory of Ritz light emitted by a source moving with velocity u is propagated through space in the direction of the motion of the source with the velocity c + u, c being the velocity of light emitted by a motionless source. In other theories (Lorentz, Einstein) the velocity of light is always c, independent of the motion of the source." p. 1298: "the observed velocities of spectroscopic doubles, i. e. the equation (2), are as a matter of fact satisfactorily represented by a Keplerian motion. Moreover in many cases the orbit derived from the radial velocities is confirmed by visual observations (as for δ Equulei, ζ Herculis, etc.) or by eclipse-observations (as in Algol-variables). We can thus not avoid the conclusion α = 0, i. e. the velocity of light is independent of the motion of the source. Ritz\'s theory would force us to assume that the motion of the double stars is governed not by Newton\'s law, but by a much more complicated law, depending on the star\'s distance from the earth".',
      },
    ],
    limits:
      "Later evidence, not on the 1904 shelf, eight years after the paper. It is an argument from observed orbits rather than a new measurement, and it answers Ritz's emission theory, which it names and which is itself later than the shelf. The edition has not transcribed its figures.",
  },
  {
    id: "ives-stilwell-1938-moving-atomic-clock",
    proposition:
      "Ives and Stilwell study the light given off by moving hydrogen canal rays, and report that the experiment establishes the rate of a moving clock: its frequency in motion is its frequency at rest multiplied by √(1 − v²/c²), v being its speed. They present the result as evidence for the theory of Larmor and Lorentz, in which this change of rate is an essential element.",
    status: "later",
    sources: [
      {
        title: "An Experimental Study of the Rate of a Moving Atomic Clock",
        date: "1938-07",
        locator: "J. Opt. Soc. Am. 28, 215",
      },
    ],
    date: {
      earliest: "1938-07",
      latest: "1938-07",
      precision: "month",
      latestYear: 1938,
      eventKind: "published",
    },
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:NavyKite",
        checkedOn: "2026-09-26",
        url: "https://api.crossref.org/works/10.1364/JOSA.28.000215",
        read: "catalog-record",
        matched:
          "An Experimental Study of the Rate of a Moving Atomic Clock, Ives and Stilwell, Journal of the Optical Society of America, volume 28, issue 7, first page 215, 1 July 1938. The publisher's record (opg.optica.org, josa-28-7-215) gives pp. 215-226 and no abstract.",
      },
      {
        source: 0,
        checkedBy: "agent:NavyKite",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/sim_optical-society-of-america-journal_1938-07_28_7",
        read: "page-image",
        matched:
          'Journal of the Optical Society of America, Volume 28, July 1938, Number 7. p. 215: "An Experimental Study of the Rate of a Moving Atomic Clock. Herbert E. Ives and G. R. Stilwell, Bell Telephone Laboratories (Received April 12, 1938)"; "various consequences of the alteration of the rate of a clock in motion, which is an essential element in the theory of Larmor and Lorentz, have been discussed. In these papers, this change in clock rate has of necessity been treated as an assumption, since, up to the present time it has not been the subject of independent experimental verification"; "For hydrogen canal rays". p. 226, Significance of results: "The present experiment establishes this rate as according to the relation ν = ν₀(1 − V²/c²)^½, where ν₀ the frequency of the clock when stationary in the ether, ν its frequency when in motion"; "The present experiment, giving a positive instead of a null result may hence be claimed to give more decisive evidence for the Larmor-Lorentz theory than is given by the experiments which have yielded null results."',
        differs: [
          "The paper writes V for the speed of the moving clock and c for the speed of light; the card writes v, so that its V is not read as the 1905 paper's letter for the speed of light.",
        ],
      },
    ],
    limits:
      "Later evidence, not on the 1904 shelf, thirty-three years after the paper. The authors read it within the theory of Larmor and Lorentz, which predicts the same rate as the 1905 kinematics, so it cannot separate the two accounts: it shows a moving clock's rate falling as both predict. The edition has not transcribed their measurements, and none is plotted here.",
  },
];
