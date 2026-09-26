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
      "In thermal equilibrium the average kinetic energy belonging to each variable of a mechanical system is the same for every variable, whatever the system is made of, and two parts at the same temperature have the same average kinetic energy per variable.",
    status: "available",
    limits:
      "Maxwell states it for kinetic energy, and proves it on one assumption he names: that the system, left to itself, passes sooner or later through every state its energy allows. He gives cases where that fails. That a simple vibration also carries, on average, as much potential energy as kinetic, so that its whole energy is fixed by the temperature, is a further step of mechanics this card does not source. Maxwell credits the theorem to Boltzmann (Wiener Berichte 58, 1868). The card is dated by the 1890 reprint read here; the paper was first printed in the Cambridge Philosophical Society's Transactions, vol. XII, which was not read.",
    sources: [
      {
        title:
          "On Boltzmann's Theorem on the average distribution of energy in a system of material points",
        date: "1890",
        locator:
          "J. C. Maxwell, Scientific Papers, vol. II (Cambridge, 1890), p. 713; from Trans. Camb. Phil. Soc. 12",
      },
    ],
    date: {
      earliest: "1890",
      latest: "1890",
      precision: "year",
      latestYear: 1890,
      eventKind: "published",
    },
    admittedStages: ["stage-03"],
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:SapphireCastle",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/scientificpapers02maxwuoft",
        read: "page-image",
        matched:
          'Leaf 739 is p. 713: "[From the Cambridge Philosophical Society\'s Transactions, Vol. XII.] XCIV. On Boltzmann\'s Theorem on the average distribution of energy in a system of material points", naming Boltzmann\'s 1868 Sitzungsberichte paper. p. 714 (leaf 740): the only assumption is that the system passes through every phase consistent with the equation of energy, and "there are cases in which this does not take place". p. 726 (leaf 752): "the average kinetic energy corresponding to any one of the variables is the same for every one of the variables of the system". p. 727 (leaf 753): parts at the same temperature have the same average kinetic energy per variable. The catalog record gives Cambridge University Press, 1890; this scan lacks the title page\'s recto.',
        differs: [
          'The card\'s source was "Maxwell and Boltzmann on the partition of energy" with an empty locator, which names no publication. It now cites the paper read.',
          "The proposition said the average ENERGY of a vibrating degree of freedom is fixed by temperature. Maxwell states it for kinetic energy per variable; the potential-energy step is now named in the limits as unsourced.",
          "The date was 1860 to 1877. The reprint read is 1890; the original in Trans. Camb. Phil. Soc. 12 was not seen, so the card is dated by the reprint. Both are before 1905.",
        ],
      },
    ],
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
      "A law for how black-body radiation distributes its energy over wavelength, in which the energy at wavelength λ and absolute temperature θ goes as λ^-5 e^(-c/λθ), derived from hypotheses about the emitting molecules: Maxwell's law of the distribution of their velocities, after Michelson, together with results Boltzmann and Wien had reached by thermodynamics.",
    status: "available",
    limits:
      "Wien says a law of the distribution cannot be found without hypotheses, and that his leave uncertainty in its theoretical foundation while allowing a wide comparison with experience. Paschen found the same form, with a free exponent, independently from his measurements. That it holds where frequency divided by temperature is large, and fails at long wavelengths, was found only in 1900 and 1901, as the Rubens and Kurlbaum card records.",
    sources: [
      {
        title: "Ueber die Energievertheilung im Emissionsspectrum eines schwarzen Körpers",
        date: "1896",
        locator: "W. Wien, Ann. Phys. (Wied.) 58, 662",
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
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:SapphireCastle",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/sim_annalen-der-physik_1896_58_4",
        read: "page-image",
        matched:
          'Leaf 0, the cover: "Annalen der Physik und Chemie. Neue Folge. Band 58. Heft 4", "1896. No. 8", "Geschlossen am 15. Juli 1896". Leaf 75 is p. 662: "2. Ueber die Energievertheilung im Emissionsspectrum eines schwarzen Körpers; von Willy Wien"; "Es ist daher eine Bestimmung der Energievertheilung ohne Hypothesen nicht möglich". p. 663: Michelson\'s assumptions, beginning with Maxwell\'s velocity distribution for solid bodies; Wien uses Michelson\'s idea and reduces the hypotheses "durch Heranziehung der von Boltzmann und mir auf rein thermodynamischem Wege gewonnenen Ergebnisse"; the remaining hypotheses "lassen immer noch Unsicherheit in der theoretischen Begründung zurück", but let the results be compared "unmittelbar und in sehr ausgedehntem Maasse mit der Erfahrung". p. 668: φ_λ = C e^(-c/λθ)/λ^5. p. 669: Paschen, independently, found φ_λ = C λ^-α e^(-c/λθ) as the form best fitting his observations; "Charlottenburg, Juni 1896". Crossref (10.1002/andp.18962940803) gives pp. 662-669.',
        differs: [
          'The card called it "an empirical law". Wien derives it from hypotheses about the emitting molecules and says so; it was Paschen\'s parallel form that came from measurement. Corrected.',
          'The card said the law is "accurate where frequency divided by temperature is large". That is what measurements of 1900 and 1901 showed, not what the 1896 paper says; it is now in the limits, pointing to the Rubens and Kurlbaum card. The title is printed "Ueber ... Energievertheilung", and the law is written over wavelength.',
        ],
      },
    ],
  },
  {
    id: "planck-1901-energy-elements",
    proposition:
      "A new radiation formula, which Planck writes seems to contradict none of the facts so far established, obtained by setting a system of resonators' entropy proportional to the logarithm of the probability of its energy, and counting that probability by treating the resonators' total energy as a whole number of finite equal parts, energy elements; with numerical values for the constants h and k.",
    status: "available",
    limits:
      "This concerns the energy of MATERIAL RESONATORS, divided into elements so that the ways of distributing it can be counted. It is not the claim that free radiation itself consists of independent quanta, and reading it as though it were is the anachronism this route must avoid. The two are different propositions and the second is what the 1905 paper argues for. Planck adds that setting the entropy by the probability comes down to a definition of that probability.",
    sources: [
      {
        title: "Ueber das Gesetz der Energieverteilung im Normalspectrum",
        date: "1901",
        locator: "M. Planck, Ann. Phys. (4) 4, 553",
      },
    ],
    date: {
      earliest: "1901",
      latest: "1901",
      precision: "year",
      latestYear: 1901,
      eventKind: "published",
    },
    priorEvent: {
      eventKind: "presented",
      earliest: "1900-10-19",
      latest: "1900-12-14",
      precision: "range",
    },
    admittedStages: ["stage-03", "stage-06"],
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:SapphireCastle",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/sim_annalen-der-physik_1901_4_3",
        read: "page-image",
        matched:
          'Leaf 130 is p. 553: "9. Ueber das Gesetz der Energieverteilung im Normalspectrum; von Max Planck. (In anderer Form mitgeteilt in der Deutschen Physikalischen Gesellschaft, Sitzung vom 19. October und vom 14. December 1900 ...)", foot "Annalen der Physik. IV. Folge. 4."; Wien\'s law, derived "aus molecularkinetischen Betrachtungen", has "keine allgemeine Gültigkeit". p. 555: a new expression for the entropy and a new radiation formula "welche mit keiner der bisher festgestellten Thatsachen in Widerspruch zu stehen scheint". p. 556, § 2: S_N = k log W + const (3), which "kommt ... im Grunde auf eine Definition der genannten Wahrscheinlichkeit W hinaus"; § 3: U_N must be taken "als eine discrete, aus einer ganzen Zahl von endlichen gleichen Teilen zusammengesetzte Grösse ... Nennen wir einen solchen Teil ein Energieelement ε", U_N = P.ε (4). p. 563 (leaf 140), § 12: h = 6,55.10^-27 erg.sec (15) and k = 1,346.10^-16 erg/grad (16); "(Eingegangen 7. Januar 1901.)". Crossref (10.1002/andp.19013090310) gives no. 3, pp. 553-563.',
        differs: [
          "The card said the formula was obtained \"by letting the resonators exchange energy in finite elements\". The elements are Planck's way of counting the distributions of the resonators' total energy, not an exchange mechanism; the proposition and limits now say so, with his own hedge on the definition of W.",
          'The card said the formula covers "the whole spectrum"; Planck writes that it seems to contradict none of the facts so far established. The title is printed "Ueber"; the author, the two 1900 presentations and the constants h and k are now on the card.',
        ],
      },
    ],
  },
  {
    id: "stokes-1852-refrangibility",
    proposition:
      "Light given out by a fluorescing substance spreads over various refrangibilities, none higher than that of the light exciting it: when dispersion changes the refrangibility of light, it always lowers it.",
    status: "available",
    limits:
      "Stokes writes of refrangibility, which the wave theory ties to the period of vibration; lower refrangibility means a longer period, so the rule is often restated as a lower frequency. He calls it a law that appears to be universal, having met no exception among a great many media, and offers only conjectures toward a dynamical explanation, not having satisfied himself of one. The word fluorescence is his, proposed in this paper.",
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
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:SapphireCastle",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/philosophicaltra1421roya",
        read: "page-image",
        matched:
          'Leaf 502 is p. 463: "XXX. On the Change of Refrangibility of Light. By G. G. Stokes, M.A., F.R.S.", "Received May 11,-Read May 27, 1852", foot "MDCCCLII". p. 499, Art. 80: a law "which appears to be universal, namely, that when the refrangibility of light is changed by dispersion it is always lowered", with no exception among "a great many media". p. 556, Art. 240 (Conclusion): dispersed light "of various refrangibilities", and the incident refrangibility "a superior limit". p. 465, Art. 4: to the period of vibration "corresponds its refrangibility". p. 550, Art. 229: "I have not hitherto been able altogether to satisfy myself respecting a dynamical explanation of this law", then conjectures. p. 479, footnote: "call the appearance fluorescence". The volume is v. 142 in the catalog; it is not printed on the title page read.',
        differs: [
          'The card said "lower frequency". Stokes writes refrangibility throughout; the frequency reading is now in the limits as a restatement.',
          'The card dropped "appears to be universal" and that the emitted light spreads over various refrangibilities up to a limit. Both are now on the card.',
        ],
      },
    ],
  },
  {
    id: "lenard-1902-photoelectric",
    proposition:
      "The initial speeds of the cathode rays that ultraviolet light drives out of a body do not depend on how intense the light is: varying the intensity of an arc lamp 70 to 1, and on aluminium 1000 to 1, left the retarding potential that stops them unchanged. Lenard takes the amount of electricity driven out as his measure of the light's intensity.",
    status: "available",
    limits:
      "Lenard found the speeds depending on the kind of light instead: the zinc arc gave far fewer high speeds than the carbon arc, though on aluminium the kind of light made almost no difference. He did not establish that the greatest energy rises in proportion to the frequency: that is the 1905 paper's prediction, tested by Millikan in 1916. He calls the carriers quanta of negative electricity.",
    sources: [
      {
        title: "Ueber die lichtelektrische Wirkung",
        date: "1902-04-29",
        locator: "P. Lenard, Ann. Phys. (4) 8, 149",
      },
    ],
    date: {
      earliest: "1902-04-29",
      latest: "1902-04-29",
      precision: "day",
      latestYear: 1902,
      eventKind: "published",
    },
    admittedStages: ["stage-02", "stage-07"],
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:SapphireCastle",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/sim_annalen-der-physik_1902_8_1",
        read: "page-image",
        matched:
          'Leaf 0, the cover: "1902. No. 5 ... Vierte Folge. Band 8. Heft 1", "(Ausgegeben am 29. April 1902.)". Leaf 158 is p. 149: "9. Ueber die lichtelektrische Wirkung; von P. Lenard", on ultraviolet light producing cathode rays from bodies, "negative Elektricitätsquanten". p. 166: "25. Die Anfangsgeschwindigkeiten sind unabhängig von der Lichtintensität", tested by the null point of the retarding potential. p. 167, Table X: the total effect is taken "als Maass für die mittlere Lichtintensität"; the carbon-arc intensity varied about 70:1 changed the null point by less than 1 per cent. p. 168: on aluminium plates the intensity varied about 1000:1 "ohne dass merkliche Aenderung des Nullpunktes eintrat"; "26. Dass verschiedene Lichtarten verschiedene Anfangsgeschwindigkeiten ergeben", the zinc arc giving large initial speeds "in sehr viel geringerem Maasse" than the carbon arc; the footnote: on aluminium the null point moved only about 0.02 volt between the two. p. 171, footnote: the forces are proportional to "der Zahl dieser Quanten, d. i. der Momentanintensität des Lichtes". p. 198: "Kiel, Mitte März 1902", "(Eingegangen 17. März 1902.)".',
        differs: [
          'The card said "electrons" driven out of "a metal", and that the number "grows with the brightness". Lenard speaks of cathode rays and quanta of negative electricity from carbon and aluminium, and takes the amount emitted as his measure of the intensity rather than testing it against one. Corrected, with his two intensity ranges.',
          'The limits\' "kind of light" now carries his exception for aluminium; the title is printed "Ueber", and the issue day replaces the year.',
        ],
      },
    ],
  },
  {
    id: "rayleigh-1900-radiation-law",
    proposition:
      "Giving each mode of vibration of the radiation an equal share of energy, proportional to the temperature, makes the energy between two nearby wavelengths proportional to the temperature and to the inverse fourth power of the wavelength. Rayleigh suggests this may be the proper form when the wavelength times the temperature is great.",
    status: "available",
    limits:
      "A suggestion, not a law for the whole spectrum: Rayleigh writes that the equal-shares doctrine fails in general, for a reason not yet explained, and may apply to the graver modes. For a complete expression he multiplies by the exponential factor of Wien's law, a law he calls little more than a conjecture on the theoretical side, and says he cannot tell whether the result fits observation as well as Wien's. He gives no value for the coefficient. The constant usually quoted with it comes from Jeans in July 1905, after the light-quanta paper was received, and is not on this shelf.",
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
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:SapphireCastle",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/londonedinburgh549190lond",
        read: "page-image",
        matched:
          'Leaves 554-555 are pp. 539-540: "LIII. Remarks upon the Law of Complete Radiation. By Lord Rayleigh, F.R.S.", in the June 1900 number (Number CCCI) of vol. XLIX, fifth series. p. 539 gives Wien\'s law as (2), c1 λ^-5 e^(-c2/λθ) dλ, "little more than a conjecture" from the theoretical side. p. 540: the doctrine "fails in general" but "may apply to the graver modes"; since "the energy in each mode is proportional to θ", the distribution is θk² dk (3) or θλ^-4 dλ (4), "the proper form when λθ is great"; "If we introduce the exponential factor" gives (6), c1 θ λ^-4 e^(-c2/λθ) dλ; "Whether (6) represents the facts of observation as well as (2) I am not in a position to say." The limits\' sentence on Jeans concerns a later source and was not checked here.',
        differs: [
          'The limits said Rayleigh added "a factor of his own to keep it finite at short ones". The factor is Wien\'s exponential, introduced without a stated reason, and nothing on either page speaks of finiteness. Corrected.',
          'The proposition dropped Rayleigh\'s hedges ("suggestion", "may apply to the graver modes", "when λθ is great"). They are now on the card.',
        ],
      },
    ],
  },
  {
    id: "rubens-1901-long-wave-radiation",
    proposition:
      "Measured in the residual rays of fluorspar, rock salt and quartz, at long infra-red wavelengths, black-body radiation departs strongly from Wien's law. Rubens and Kurlbaum conclude that a suitable formula must make it grow in proportion to the temperature at very long wavelengths and very high temperatures, as the formulas of Rayleigh, of Lummer and Jahnke, and of Planck do.",
    status: "available",
    limits:
      "An empirical result, stated as what the observations seem to show. Of the three formulas they judge Rayleigh's unsuitable, since it fails at short wavelengths, and prefer Planck's for its simplicity. Part of the material had already appeared in the Berlin Academy's reports for 1900 (vol. 41, p. 929), before this printed version, and Lummer and Pringsheim had found departures from Wien's formula at large values of wavelength times temperature.",
    sources: [
      {
        title: "Anwendung der Methode der Reststrahlen zur Prüfung des Strahlungsgesetzes",
        date: "1901-04",
        locator: "H. Rubens and F. Kurlbaum, Ann. Phys. (4) 4, 649",
      },
    ],
    date: {
      earliest: "1901-04",
      latest: "1901-04",
      precision: "month",
      latestYear: 1901,
      eventKind: "published",
    },
    admittedStages: ["stage-03", "stage-04"],
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:SapphireCastle",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/sim_annalen-der-physik_1901_4_4",
        read: "page-image",
        matched:
          'Leaf 0, the cover: "Vierte Folge. Band 4. Heft 4", issued in April 1901 (the day is faint, read as the 9th). Leaf 2 is p. 649: "1. Anwendung der Methode der Reststrahlen zur Prüfung des Strahlungsgesetzes; von H. Rubens und F. Kurlbaum", part of the material already in the Berlin Academy\'s reports (Sitzungsber. 41, p. 929-941, 1900); Wien\'s formula, from "thermodynamischer und molecularkinetischer Betrachtungen", is no longer theoretically founded after Lummer, Pringsheim and Jahnke. p. 650: Lummer and Pringsheim find departures from it at large λT. p. 665: the observations on fluorspar and rock salt show no essential departure from Planck\'s formula, the quartz residual rays (8.85 μ) small ones. p. 666: "Jedenfalls scheint uns aus den vorliegenden Beobachtungen hervorzugehen, dass nur solche Formeln geeignet sind, ... bei welchen der Wert von E für sehr grosse Wellenlängen und sehr hohe Temperaturen proportional mit T wächst, wie dies in den Formeln von Lord Rayleigh, Lummer-Jahnke (für μ = 4) und Planck der Fall ist"; Rayleigh\'s fails at short wavelengths; Planck\'s preferred "ihrer grösseren Einfachheit wegen"; "(Eingegangen 10. Februar 1901.)".',
        differs: [
          'The card said the radiation "grows in proportion to the temperature" at long wavelengths, as a finding. Rubens and Kurlbaum state it as what a suitable formula must do at very long wavelengths and very high temperatures, as their observations "seem" to show. Corrected, with the three formulas they name.',
          "The limits dated the Berlin report to October 1900; the paper's own footnote gives Sitzungsberichte 41, p. 929-941, 1900, with no month, so the limits now cite it that way. The authors are added, and the issue month, April 1901, replaces the year.",
        ],
      },
    ],
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
      "When a negatively charged metal plate in a gas at low pressure is lit by ultraviolet light, the negative electricity it loses is carried by particles whose ratio of charge to mass Thomson measures as of the same order as for cathode rays, and states to be the same.",
    status: "available",
    limits:
      'His measured mean is larger than either cathode-ray value he quotes, though of the same order; "the same" is his reading of that agreement. He says his statements about the masses hold only when the gas pressure is very small, and he speaks of the carriers as ions produced by the ultraviolet light. It identifies the carriers, and says nothing about how much energy each carries: the method takes them to start from rest.',
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
    sourceChecks: [
      {
        source: 0,
        checkedBy: "agent:SapphireCastle",
        checkedOn: "2026-09-26",
        url: "https://archive.org/details/londonedinburg5481899lond",
        read: "page-image",
        matched:
          'Leaf 592 is p. 547: "LVIII. On the Masses of the Ions in Gases at Low Pressures. By J. J. Thomson", signature lines "Phil. Mag. S. 5. Vol. 48. No. 295. Dec. 1899"; the paper runs to p. 567. p. 548: negative electricity "carried by charged particles (i.e. when a negatively electrified metal plate in a gas at low pressure is illuminated by ultra-violet light)", and m/e "is the same as for the cathode rays". p. 549: the orbits are solved "if x, y, dx/dt, dy/dt all vanish when t = 0", particles starting from the plate. p. 554: mean e/m 7.3 x 10^6 against his cathode-ray 5 x 10^6 and Lenard\'s 6.4 x 10^6, "of the same order", and about 10^4 for hydrogen ions in electrolysis. p. 564: the statements on the masses "are only true when the pressure of the gas is very small".',
        differs: [
          'The card said "released from a metal" with "the same" ratio. Thomson\'s measured result is "of the same order" and "the same" is his stated conclusion; the setting (a charged plate in gas at low pressure) is now on the card.',
          'The limits said the card "identifies what comes out of the metal". Thomson speaks of "the ions produced by ultra-violet light" (p. 554); the limits now say that, and keep the pressure condition he states.',
        ],
      },
    ],
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
