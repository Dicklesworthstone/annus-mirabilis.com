/**
 * The 1904 shelf for the Brownian-motion discovery route, and the later evidence its check
 * against the world is compared with.
 *
 * Outside the page for the reason massEnergyShelf.ts records: a Next page module may export only
 * the route contract. No card carries a verification record, which is a reviewer's to make, and the
 * page shows no verification status (D-2026-09-25-no-review-status-banners). What was checked is
 * in each card's `sourceChecks` (dispatch 252): the scan or catalog record read, the day, and what
 * matched or differed. Nothing renders it.
 */
import type { KnowledgeCard } from "../discovery/cards/types.ts";

export const BROWNIAN_SHELF_CARDS: readonly KnowledgeCard[] = [
  {
    id: "brown-1828-microscopical-observations",
    proposition:
      "Particles contained in the pollen of plants, and still smaller particles from every mineral Brown could powder finely enough to stay suspended in water, are seen in motion in the water; he found the motion in plants dried for a century as well as in living ones.",
    status: "available",
    limits:
      "Brown ruled out currents in the fluid and its evaporation, said the motion belonged to the particle itself, and declined to hazard any conjecture about the molecules. What he reports persisting is the motion in dead and century-old material; he does not say how long one particle keeps moving, and does not call the motion irregular.",
    sources: [
      {
        title:
          "A brief Account of Microscopical Observations made in the Months of June, July, and August, 1827, on the Particles contained in the Pollen of Plants; and on the general Existence of active Molecules in Organic and Inorganic Bodies",
        date: "1828-09",
        locator: "Phil. Mag. (new series) 4 (1828) 161",
      },
    ],
    date: {
      earliest: "1828-09",
      latest: "1828-09",
      precision: "month",
      latestYear: 1828,
      eventKind: "published",
    },
    priorEvent: {
      eventKind: "performed",
      earliest: "1827-06",
      latest: "1827-08",
      precision: "range",
    },
    admittedStages: ["stage-01", "stage-02"],
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:SapphireCastle",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/philosophicalmax04lond",
        read: "page-image",
        matched:
          'Leaf 180 is p. 161, headed "SEPTEMBER 1828": "XXVII. A brief Account of Microscopical Observations made in the Months of June, July, and August, 1827, ... By Robert Brown", foot "New Series. Vol. 4. No. 21. Sept. 1828."; an editor\'s note says the paper "has just been printed for private distribution". p. 163: the motions "arose neither from currents in the fluid, nor from its gradual evaporation, but belonged to the particle itself". p. 165: the motion "still observable" in Mosses and Equiseta "dried upwards of one hundred years". p. 167: "in every mineral which I could reduce to a powder, sufficiently fine to be temporarily suspended in water, I found these molecules". p. 169: "nor shall I hazard any conjectures whatever respecting these molecules".',
        differs: [
          'The card said the particles "move irregularly without dying away". Brown never calls the motion irregular, and the persistence he reports is across dead and century-old material, not the duration of one particle\'s motion. Corrected, with his exclusion of currents and evaporation in the limits.',
          'The locator lacked "new series", the title was abbreviated, and the date was a year where the number gives September 1828. The June to August 1827 observations are now the prior event\'s range.',
        ],
      },
    ],
  },
  {
    id: "stokes-1851-sphere-drag",
    proposition:
      "A sphere of radius a moving slowly and uniformly at speed v through a fluid of viscosity η is held back by a force F = 6πηav.",
    status: "available",
    limits:
      "The letters are later ones: Stokes prints the resistance as 6πμ′ρaV, where μ′, his index of friction, is the viscosity divided by the density ρ. He gives it only for motion so slow that the square of the velocity can be neglected, for a fluid that does not slide past the surface of the solid, and says the fluid may be liquid or gas.",
    sources: [
      {
        title: "On the Effect of the Internal Friction of Fluids on the Motion of Pendulums",
        date: "1851",
        locator: "Trans. Camb. Phil. Soc. 9, part II, p. [8]; the sphere, eq. (126), p. [51]",
      },
    ],
    date: {
      earliest: "1851",
      latest: "1851",
      precision: "year",
      latestYear: 1851,
      eventKind: "published",
    },
    priorEvent: {
      eventKind: "presented",
      earliest: "1850-12-09",
      latest: "1850-12-09",
      precision: "day",
    },
    admittedStages: ["stage-03"],
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:SapphireCastle",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/transactionsofca09camb",
        read: "page-image",
        matched:
          'Leaf 206 is the title page of "Volume IX. Part II", Cambridge, "M.DCCC.LI." (1851); the whole volume\'s title page is dated 1856. Leaf 215 is p. [8]: "X. On the Effect of the Internal Friction of Fluids on the Motion of Pendulums. By G. G. Stokes", "[Read December 9, 1850.]". p. [17]: the tangential pressure "μ dv/dz"; "Let μ = μ′ρ. The constant μ′ may conveniently be called the index of friction of the fluid, whether liquid or gas"; and Art. 3 argues that fluid in contact with a solid does not flow past it with a finite velocity. p. [51], Art. 42: "−F = 6πμ′ρaV, (126) and −F is the resistance required", for motion "so slow that the square of the velocity may be neglected".',
        differs: [
          'The locator gave only "p. 8", the first page; the result is eq. (126) on p. [51] of Part II, whose pages are bracketed. The title was missing.',
          'The card said "liquid"; Stokes says fluid, liquid or gas. It wrote F = 6πηav as though printed; the limits now give his notation and his condition on the velocity.',
        ],
      },
    ],
  },
  {
    id: "fick-1855-diffusion-equation",
    proposition:
      "Dissolved matter moves down its concentration gradient at a rate proportional to the gradient; with conservation of matter this gives a diffusion equation for the concentration.",
    status: "available",
    limits:
      "Fick could not derive the law from the general laws of motion. He proposes it by analogy with Fourier's law for the flow of heat, as a conjecture he says his experiments put beyond doubt, and writes it for a salt solution in a vessel, with a constant that depends on the substances.",
    sources: [
      { title: "Ueber Diffusion", locator: "A. Fick, Ann. Phys. (Pogg.) 94, 59", date: "1855" },
    ],
    date: {
      earliest: "1855",
      latest: "1855",
      precision: "year",
      latestYear: 1855,
      eventKind: "published",
    },
    admittedStages: ["stage-03"],
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:SapphireCastle",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/bub_gb_wR4AAAAAMAAJ",
        read: "page-image",
        matched:
          'Leaf 7 is the title page: "Annalen der Physik und Chemie. Vierte Reihe ... von J. C. Poggendorff. Vierter Band", "Leipzig, 1855"; leaf 5 reads "Band XCIV". Leaf 83 is p. 59: "IV. Ueber Diffusion; von Dr. Adolf Fick, Prosector in Zürich." p. 65 (leaf 89): efforts to derive the law from the general laws of motion "haben indessen keinen Erfolg gehabt"; instead a "Vermuthung", that diffusion goes by the law Fourier set up for heat, which "experimentell ausser allen Zweifel zu stellen gelungen ist". p. 66 (leaf 90): the salt crossing a layer is -Q.k.(dy/dx).dt, k "eine von der Natur der Substanzen abhängige Constante", and "Genau nach dem Muster der Fourier\'schen Entwickelung" the differential equations (1) and (2), printed as ∂y/∂t = -k ∂²y/∂x² for a vessel of constant section. Crossref (10.1002/andp.18551700105) gives pp. 59-86.',
        differs: [
          "The source named only the journal volume; the article's title and author are now on it.",
          "The card gave no hedge. Fick offers the law as a conjecture by analogy with Fourier's, not a derivation; the limits now say so.",
        ],
      },
    ],
  },
  {
    id: "maxwell-1860-equipartition",
    proposition:
      "For a model gas of perfectly elastic spheres, particles of different masses moving in one vessel come after many impacts to the same mean vis viva, mass times mean square velocity. Explaining the pressure of a gas by assuming the square of the velocity proportional to the absolute temperature, Maxwell concludes that equal volumes of gases at one pressure and temperature hold equal numbers of particles.",
    status: "available",
    limits:
      "Shown for hard, perfectly elastic spheres, which Maxwell offers as a physical analogy to be tested against real gases. The link to the absolute temperature is an assumption that accounts for the pressure, not something the paper derives.",
    sources: [
      {
        title:
          "Illustrations of the Dynamical Theory of Gases. Part I. On the Motions and Collisions of Perfectly Elastic Spheres",
        date: "1860-01",
        locator: "Phil. Mag. (4) 19, 19",
      },
    ],
    date: {
      earliest: "1860-01",
      latest: "1860-01",
      precision: "month",
      latestYear: 1860,
      eventKind: "published",
    },
    priorEvent: {
      eventKind: "presented",
      earliest: "1859-09-21",
      latest: "1859-09-21",
      precision: "day",
    },
    admittedStages: ["stage-01", "stage-02"],
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:SapphireCastle",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/londonedinburghp19maga",
        read: "page-image",
        matched:
          'Leaf 14 is p. 1, headed "[FOURTH SERIES.] JANUARY 1860", foot "Phil. Mag. S. 4. Vol. 19. No. 124. Jan. 1860.". Leaf 32 is p. 19: "V. Illustrations of the Dynamical Theory of Gases.-Part I. On the Motions and Collisions of Perfectly Elastic Spheres. By J. C. Maxwell", footnote "read at the Meeting of the British Association at Aberdeen, September 21, 1859". p. 20: "small, hard, and perfectly elastic spheres"; if their properties "are found to correspond to those of gases, an important physical analogy will be established". p. 25, Prop. VI: "after many impacts Pp² = Qq² = Rr², &c." for particles of masses P, Q, R. p. 30: the pressure "can be explained by the assumption that the square of the velocity is proportional directly to the absolute temperature", and N, the number of particles in unit volume, "is the same for all gases at the same pressure and temperature".',
        differs: [
          "The card stated both results as facts about a gas in thermal equilibrium. Maxwell proves the first for a model of elastic spheres and takes the second as an assumption; the card now says so.",
          "The date ran from 1860 to 1879 with latestYear 1879; the one source is the January 1860 number, read at Aberdeen on 21 September 1859. Nothing in it supports 1879.",
        ],
      },
    ],
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
      "Exner traced the paths of gamboge particles in water for half a minute to a minute and measured their apparent speeds: lower for larger particles, higher at higher temperature. Giving the particles the same kinetic energy as the liquid's molecules, those speeds imply a molecular speed of about 30 cm a second at 20 °C, nowhere near the 270 metres a second that G. Jäger had calculated for 0 °C.",
    status: "available",
    limits:
      "He says the values are not very accurate and probably too small, because the smallest excursions could not be traced, and that the simple assumption of particles behaving like the liquid's molecules does not suffice. He still leaves open that these visible motions may one day give measures of the liquid's inner motion.",
    sources: [
      {
        title: "Notiz zu Brown's Molecularbewegung",
        date: "1900-08-09",
        locator: "F. M. Exner, Ann. Phys. (4) 2, 843",
      },
    ],
    date: {
      earliest: "1900-08-09",
      latest: "1900-08-09",
      precision: "day",
      latestYear: 1900,
      eventKind: "published",
    },
    admittedStages: ["stage-01"],
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:SapphireCastle",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/sim_annalen-der-physik_1900_2_4",
        read: "page-image",
        matched:
          'Leaf 0 is the Heft cover: "1900. No. 8 ... Vierte Folge. Band 2. Heft 4", "(Ausgegeben am 9. August 1900.)". Leaf 202 is p. 843: "10. Notiz zu Brown\'s Molecularbewegung; von Felix M. Exner. (Aus dem physiologischen Institut der Wiener Universität.)". p. 844: gamboge in water, paths traced with an Abbe drawing apparatus and measured. p. 845: "Natürlich sind die Werte nicht sehr genau", the measurements "im allgemeinen zu klein"; speeds fall with particle size (0.0038, 0.0033, 0.0027 mm/s at 23 °C for s = 0.0004, 0.0009, 0.0013 mm); each value the mean of about 10 measurements lasting "1/2-1 Min.". p. 846: speeds from 0.0032 mm/s at 20 °C to 0.0051 at 71 °C; the square of the speed against temperature cuts the axis near -20 °C, not at absolute zero; with equal kinetic energies the liquid molecules\' speed at 20 °C comes out "circa 30 cm". p. 847: this does not agree "auch nicht annähernd" with G. Jäger\'s calculation (270 m at 0 °C); the assumption fits only material points; "(Eingegangen 25. Juni 1900.)".',
        differs: [
          'The card said Exner "timed the particles over short intervals". Each of his values is a mean over tracings of half a minute to a minute (p. 845).',
          "The card compared the particles' speeds directly with molecular speeds. Exner's comparison runs through equal kinetic energies: the particles' speeds imply a molecular speed of about 30 cm/s, against the 270 m/s Jäger calculated. The card now says that, with his own hedges.",
        ],
      },
    ],
  },
  {
    id: "siedentopf-1903-ultramicroscope",
    proposition:
      "Siedentopf and Zsigmondy light small particles with a beam at right angles to the microscope's line of sight, so that no illuminating ray enters the objective; particles far smaller than half a wavelength of light, below what a microscope can resolve, then show one by one as bright diffraction discs on a dark field.",
    status: "available",
    limits:
      "Their subject is gold particles in ruby glass; they report having begun on colloidal solutions and turbid media. A particle is seen, not imaged: its size is estimated separately, not read off the picture.",
    sources: [
      {
        title:
          "Über Sichtbarmachung und Größenbestimmung ultramikroskopischer Teilchen, mit besonderer Anwendung auf Goldrubingläser",
        date: "1902-12-30",
        locator: "H. Siedentopf and R. Zsigmondy, Ann. Phys. (4) 10, 1",
      },
    ],
    date: {
      earliest: "1902-12-30",
      latest: "1902-12-30",
      precision: "day",
      latestYear: 1902,
      eventKind: "published",
    },
    admittedStages: ["stage-01"],
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:SapphireCastle",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/sim_annalen-der-physik_1903_10_1",
        read: "page-image",
        matched:
          'Leaf 0, the Heft cover: "1903. No. 1 ... Vierte Folge. Band 10. Heft 1", "(Ausgegeben am 30. December 1902.)"; the volume\'s contents (leaf 8) list "1. H. Siedentopf und R. Zsigmondy ... 1" under the Erstes Heft, "Ausgegeben am 30. Dezember 1902". Leaf 12 is p. 1: "Über Sichtbarmachung und Größenbestimmung ultramikroskopischer Teilchen, mit besonderer Anwendung auf Goldrubingläser; von H. Siedentopf und R. Zsigmondy", after "1 1/2 jährigen Verbesserungen". p. 2: single gold particles made visible, the method extended "auf das Studium kolloidaler Lösungen und trüber Medien". p. 3: diffraction discs of particles "weit kleiner ... als etwa eine halbe Wellenlänge sichtbaren Lichtes", visibility "unter Verzichtleistung auf ähnliche Abbildung"; arc or sunlight. p. 4: the axis of the illuminating cone "senkrecht" to that of the observed cone, so no illuminating ray reaches the objective, "eine Weiterbildung der sogenannten Dunkelfeldbeleuchtung".',
        differs: [
          "The card dated the paper 1903 with latestYear 1903. Band 10 Heft 1 was issued on 30 December 1902, which is why Crossref (10.1002/andp.19023150102) gives 1902; the card is now dated to the issue day.",
          'The card said "colloidal particles ... smaller than a micron". The paper\'s subject is gold in ruby glass, with colloidal solutions begun, and its measure is half a wavelength of light. Its prior event, "performed 1902", had no date in the paper and is removed.',
        ],
      },
    ],
  },
  {
    id: "sutherland-1904-dunedin",
    proposition:
      "William Sutherland's paper on the measurement of large molecular masses, communicated at the Dunedin meeting of the Australasian Association for the Advancement of Science in January 1904, uses Stokes's formula for the resistance on a sphere to make a dissolved molecule's coefficient of diffusion inversely proportional to its radius and to the viscosity of the liquid.",
    status: "available",
    limits:
      "No correction for slip: that first appears in his June 1905 paper in the Philosophical Magazine. The paper itself finds the diffusion data better represented by the inverse square root of the molecular volume than by the cube root its formula gives. Its text is known from the Association's Report, printed in Wellington in 1905; the sources say the paper was communicated, not who read it.",
    sources: [
      {
        title: "The Measurement of Large Molecular Masses",
        date: "1905",
        locator:
          "Report of the Tenth Meeting of the Australasian Association for the Advancement of Science, Dunedin, 1904 (Wellington, 1905), p. 117",
      },
    ],
    date: {
      earliest: "1904-01-12",
      latest: "1904-01-12",
      precision: "day",
      latestYear: 1904,
      eventKind: "presented",
    },
    relatedCardId: "sutherland-1905-phil-mag",
    admittedStages: ["stage-03"],
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:SapphireCastle",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/ReportTenthMeet00Thom",
        read: "page-image",
        matched:
          'Leaf 4, title page: "Report of the Tenth Meeting of the Australasian Association for the Advancement of Science, held at Dunedin, 1904. Edited by Geo. M. Thomson"; leaf 5, its verso: "John Mackay, Government Printer, Wellington. 1905." Contents p. iv (leaf 7), Section A, under "Tuesday, 12th January, 1904": "16. The Measurement of Large Molecular Masses. By William Sutherland, M.A. ... 117", with no asterisk, so printed in full. p. 119: "F = 6πVηa (4)", "RT dc/dx = 6πVηaN (5)", "D = RT/6πηa (6)", the coefficient of diffusion "inversely proportional to the molecular radius, and also inversely proportional to the viscosity of the medium". No slip term on pp. 117-121. p. 121: the data "could be better represented if the diffusion coefficient were taken to vary inversely as the square root of the molecular volume, rather than as the theoretical cube root".',
        differs: [
          "The card said the Dunedin formula carried a correction for slip at the surface. The paper printed from that meeting has none; the 1905 Phil. Mag. paper introduces it (p. 781 there says the Dunedin formula made diffusion vary inversely as the radius and the viscosity).",
          'The source named only the Association and "Dunedin Meeting". It now names the paper and the Report, printed in 1905, and the card is dated to the session it is listed under, 12 January 1904.',
        ],
      },
    ],
  },
  {
    id: "sutherland-1905-phil-mag",
    proposition:
      "Sutherland publishes in the Philosophical Magazine a formula for the coefficient of diffusion of a molecule treated as a sphere, now corrected for slip at its surface through a coefficient of sliding friction; with no slip it reduces to the gas constant times the temperature divided by six pi times the viscosity, the radius and the number of molecules in a gram-molecule.",
    status: "parallel-work",
    parallelWorkBasis:
      "The June 1905 Philosophical Magazine publication falls between Annalen's receipt of Einstein's paper on 11 May 1905 and its publication on 18 July 1905.",
    limits:
      "The slip correction is new here: the paper opens by recalling that the Dunedin formula of 1904 made diffusion vary inversely as the radius and the viscosity, and adds the correction after looking more closely at the dynamics.",
    sources: [
      {
        title:
          "A Dynamical Theory of Diffusion for Non-Electrolytes and the Molecular Mass of Albumin",
        date: "1905-06",
        locator: "Phil. Mag. (6) 9, 781; the formula, eq. (3), p. 782",
      },
    ],
    date: {
      earliest: "1905-06",
      latest: "1905-06",
      precision: "month",
      latestYear: 1905,
      eventKind: "published",
    },
    relatedCardId: "sutherland-1904-dunedin",
    admittedStages: ["stage-03"],
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:SapphireCastle",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/londonedinburgh691905lond",
        read: "page-image",
        matched:
          'Leaf 828 is p. 781: "LXXV. A Dynamical Theory of Diffusion for Non-Electrolytes and the Molecular Mass of Albumin. By William Sutherland", which opens "IN a paper communicated to the Australian Association for the Advancement of Science at Dunedin, 1904, on the Measurement of Large Molecular Masses", whose formula "made the velocity of diffusion of a substance through a liquid vary inversely as the radius a of its molecule and inversely as the viscosity of the liquid", then "After looking a little more closely into the dynamical conditions of the problem"; foot "Phil. Mag. S. 6. Vol. 9. No. 54. June 1905.". p. 782 (leaf 829): RT dc/dx = 6πVηaN (1 + 2η/βa)/(1 + 3η/βa), and with C the number of molecules in a gramme-molecule D = RT/(6πηaC) x (1 + 3η/βa)/(1 + 2η/βa), β the coefficient of sliding friction; "If β = ∞, that is, if there is no slipping", aD is the same for all molecules. Crossref (10.1080/14786440509463331) gives June 1905, pp. 781-785.',
        differs: [
          'The card spoke of "Sutherland\'s diffusion formula, with its slip correction" as though it existed before; the slip correction is introduced in this paper. The proposition now says what is published here. The printed name is "Australian", not "Australasian", Association.',
        ],
      },
    ],
  },
  {
    id: "naegeli-1879-single-impacts",
    proposition:
      "Nägeli estimates the speed one molecular impact can give a starch grain 3 micrometres across, finds it far too small to see even under the microscope, reckons that about a million molecules would have to strike at once in one direction to make a single visible jerk, and concludes that the motions of the liquid's molecules cannot be what makes the particles dance.",
    status: "available",
    sources: [
      {
        title: "Ueber die Bewegungen kleinster Körperchen",
        locator: "C. v. Nägeli, Sitzungsber. math.-phys. Cl. Akad. Wiss. München 9 (1879), p. 389",
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
    priorEvent: {
      eventKind: "presented",
      earliest: "1879-06-07",
      latest: "1879-06-07",
      precision: "day",
    },
    limits:
      "He could not calculate the effect of a water molecule, whose speed was unknown, so he used a water-vapour molecule in air as an upper bound. He did consider the very many impacts, more than a trillion a second, and held that, coming from every side, they cancel completely; he does not estimate how large their chance imbalance over a short interval would be, which is where the route turns. For the cause he points instead to attracting and repelling forces between molecules, perhaps electric, and calls that only a possibility.",
    admittedStages: ["stage-02"],
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:SapphireCastle",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/sitzungsbericht153klasgoog",
        read: "page-image",
        matched:
          'Leaf 400 is p. 389: "Sitzung vom 7. Juni 1879 (Nachtrag). Herr Professor v. Nägeli legt eine Abhandlung vor: \'Ueber die Bewegungen kleinster Körperchen.\'"; page feet read "[1879. 3. Math.-phys. Cl.]"; the catalog record calls the volume 9. p. 414, "II. Bewegungen im Wasser": the dance of the smallest bodies, "Brown\'sche \'Molecularbewegung\'". p. 416: an exact calculation of the speed water molecules give a small body "ist zwar nicht ausführbar", their speed being unknown. p. 417: a water-gas molecule in air would give a starch grain of 0.003 mm a speed of 0.000002 mm a second, 0.001 mm even magnified 500 times; "eine Million von Wassermolecülen" would have to strike it "im nämlichen Moment in der gleichen Richtung" for one jerk. p. 418: more than a trillion impacts a second, "aber sie kommen von allen möglichen Seiten und heben sich ... in ihrer Wirkung vollständig auf"; so "andere moleculare Ursachen" must be sought, attracting and repelling forces, electric attraction "weiter nichts als eine Möglichkeit". Exner 1900, p. 844, cites it as "Münchener Ber. p. 389-453. 1879".',
        differs: [
          'The limits said the estimate "is for one impact at a time" and "does not ask what the imbalance of very many impacts ... does". Nägeli does take up the many impacts (p. 418) and holds that they cancel completely; what he does not estimate is the size of their chance imbalance. Corrected.',
          'The title is printed "Ueber"; the author, volume and the session of 7 June 1879 are now on the card, and its method (a water-vapour molecule in air as an upper bound) and its alternative cause are in the limits.',
        ],
      },
    ],
  },
  {
    id: "vant-hoff-1887-osmotic-gas-law",
    proposition:
      "A substance dissolved in a solution presses on a wall that lets only the solvent through, and that osmotic pressure obeys the gas laws of Boyle, Gay-Lussac and Avogadro: van 't Hoff writes PV = RT, with one value of R for every gas and every dissolved substance when each is counted in molecular weights.",
    status: "available",
    sources: [
      {
        title: "Die Rolle des osmotischen Druckes in der Analogie zwischen Lösungen und Gasen",
        locator: "J. H. van 't Hoff, Z. physik. Chem. 1 (1887) 481",
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
      "Only when the solution is dilute enough that the dissolved particles' interaction and volume can be neglected, the restriction that holds for gases too. In water most salts and the strong acids and bases give a larger pressure, i times the expected value, which he ascribes, on Arrhenius's suggestion, to splitting into ions. Whether the law holds for particles large enough to see is the question the route asks, not something the law says.",
    admittedStages: ["stage-02", "stage-03"],
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:SapphireCastle",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/sim_zeitschrift_physikalische_chemie_1887_1",
        read: "page-image",
        matched:
          'Leaf 486 is p. 481: "Die Rolle des osmotischen Druckes in der Analogie zwischen Lösungen und Gasen. Von J. H. van\'t Hoff in Amsterdam", foot "Zeitschrift f. physik. Chemie. I.", with a wall permeable to water but not to the dissolved sugar. p. 491 (leaf 496), section V: PV = RT "auch für Lösungen gültig" for the osmotic pressure, "mit derselben Beschränkung, die auch bei Gasen zu berücksichtigen ist, dass nämlich die Verdünnung genügend gross sei"; with kilogram-molecules R is the same for all gases, PV = 845 T, and this holds "auf sämtliche Lösungen" with P the osmotic pressure. p. 492: AR = 2, so APV = 2T in calories; section VI takes Pfeffer\'s sugar measurements as the first direct confirmation. p. 501 (leaf 506): most salts and strong acids and bases in water deviate, following Arrhenius\'s suggestion of "eine Spaltung in Jonen"; the general form becomes APV = 2iT.',
        differs: [
          "The card wrote the law as \"p V = R T z for z gram-molecules\", which is Einstein's notation in 1905. Van 't Hoff prints PV = RT, per kilogram-molecule in his units, and APV = 2T; the card now gives his form and says the gas constant is the same for dissolved substances and gases.",
          "The card's limits named dilution but not the exception he states for electrolytes, the factor i; it is now there.",
        ],
      },
    ],
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
      "Perrin measures suspensions of gamboge grains of known radius, among them their vertical distribution in sedimentation equilibrium, and infers the number of molecules in a gram-molecule. Across his methods the values lie between roughly 6 and 7.5 × 10²³; the sedimentation-equilibrium value is near 7 × 10²³.",
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
