import { describe, expect, test } from "bun:test";
import {
  BIN,
  binDensityPerMicrometre,
  crossings,
  exactSquare,
  FAST_READING,
  FLUX_SECONDS,
  fastBy,
  flatDensity,
  INSTANT_SPEED,
  JARS,
  linearEstimate,
  MINUTE_DISPLACEMENT_MICROMETRES,
  MINUTE_DISPLACEMENT_SQUARED_MANTISSA,
  netChange,
  PARTICLE_ENDS,
  PRINTED_CORNERS,
  PRINTED_POSITIONS,
  PRINTED_SPEEDS,
  RAMP,
  reflectionTime,
  SPREAD,
  SQUARE_SIDE,
  SQUARE_STEPS,
  STRIP_COUNTS,
  SYNC,
  signalSpeed,
  spreadAfter,
  stripSum,
  typicalDistance,
  WALK,
  walkSpeeds,
  withinWidths,
} from "../foundations/bridgeFigures.ts";
import { bridge } from "./foundZeroAlgebra.shared.ts";

/**
 * THE BRIDGE FIGURES AGREE WITH THE PARAGRAPHS ABOVE THEM (dispatch 412).
 *
 * foundBridges.figures.test.ts recomputes each figure's derived values from the raw ones, which
 * guards a figure against itself. Nothing guarded it against the PROSE, and the gap is not a
 * hypothesis: planting JARS = [4, 0, 0, 4] kept the total at 8, the count at 4 and the average at
 * 2, so every arithmetic property still held and 22 tests across 5 files stayed GREEN, while the
 * drawing would have shown two full jars and two empty under a paragraph reading "Four jars hold
 * 3, 1, 1 and 3 marbles". A figure and a sentence in two different files, with no check between
 * them, is the two-renderers shape one level down.
 *
 * WHAT IT READS, AND WHAT IT DOES NOT. The records on disk, through bridge() in
 * foundZeroAlgebra.shared.ts, never generated/content. A check on inputs reads the inputs: the
 * compiled payload is a layer that can drop a case, and reading it would also have made this check
 * silently stale, which cost a run in this same unit when four record edits were invisible to 52
 * green tests until build-content ran. Of each record it reads question, summary, explanation,
 * exampleTitle, example and stoppingPoint, which is everything that makes a claim to a reader. It
 * deliberately does not read id, kind, review, prerequisites or citations, which carry no prose,
 * and it deliberately does not read a formula block's `latex`: mean-variance-rms prints
 * \frac{1}{M}\sum_{i=1}^{M} and bridge-squaring-square-roots \sqrt{4q}=2\sqrt q, where every digit
 * belongs to a command name, an exponent or a subscript rather than to a sentence.
 *
 * HOW IT ANCHORS. A bare 3 appears in prose for a hundred reasons, so nothing here keys on a bare
 * number. Each claim gives alternative FORMS, and a form matches only when every one of its tokens
 * sits in ONE sentence: the rendered list of the figure's own values together with the noun that
 * makes them those values. That noun is what closes the obvious hole, since "2, 2, 2, 2" is also
 * printed in bridge-sum-average as a contrasting list, so a JARS of [2, 2, 2, 2] would find its
 * own rendering in the record and pass on a sentence that is not about the jars at all.
 *
 * The forms are BUILT FROM THE ARRAYS, never written out, which is the whole mechanism: change the
 * data and the pattern changes with it, so the records stop matching and this goes red.
 *
 * WHICH HALF WATCHES WHICH. This check lives in the lane it controls, so its proof cannot rest on
 * that lane alone. Three things carry it instead: the denominator is printed and asserted beside
 * the verdict, so a run that examined nothing cannot read as a clean one; a positive control runs
 * every time against synthetic records, in both directions, so a matcher that had stopped matching
 * would be caught without anyone re-planting; and the out-of-lane half is the hand plant recorded
 * in this commit's message, which is a manual operation and is named as one rather than implied.
 */

/** U+2212, the minus sign the records print, rather than a hyphen. */
const signed = (v: number): string => (v < 0 ? `−${Math.abs(v)}` : `+${v}`);
const plainList = (values: readonly (number | string)[]): string => values.join(", ");
const andList = (values: readonly (number | string)[]): string =>
  `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`;

const ends = PARTICLE_ENDS.map(signed);
const jars = JARS.map(String);
const first = WALK[1] as (typeof WALK)[number];
const last = WALK[WALK.length - 1] as (typeof WALK)[number];
const speed = walkSpeeds()[0] as number;

/**
 * A form matches when every token is in one sentence. Alternatives exist because the records write
 * the same four values two ways, as a plain comma list and with a final "and".
 */
type Claim = Readonly<{
  key: string;
  slug: string;
  why: string;
  forms: readonly (readonly string[])[];
}>;

const [flux1, flux2] = FLUX_SECONDS as unknown as readonly [
  (typeof FLUX_SECONDS)[number],
  (typeof FLUX_SECONDS)[number],
];

const CLAIMS: readonly Claim[] = [
  {
    key: "SYNC",
    slug: "frames-events",
    why: "the flash leaves A at the top of both drawings",
    forms: [[`reads ${SYNC.leaves} s`, "flash leaves"]],
  },
  {
    key: "SYNC",
    slug: "frames-events",
    why: "and returns at the bottom of both",
    forms: [[`reads ${SYNC.returns} s`]],
  },
  {
    key: "SYNC",
    slug: "frames-events",
    why: "the half-way mark, which is the rule the figure draws",
    forms: [[`at ${reflectionTime()} s`, "reflection"]],
  },
  {
    key: "FAST_READING",
    slug: "frames-events",
    why: "the second panel's clock, and the correction it needs",
    forms: [[`read ${FAST_READING} s`, `${fastBy()} s fast`]],
  },
  {
    key: "SIGNAL_SPEED",
    slug: "frames-events",
    why: "the speed the same round trip gives, stated in the words equivalent",
    forms: [[`${signalSpeed() / 1e8} × 10⁸ metres per second`]],
  },
  {
    key: "BALL",
    slug: "derivatives",
    why: "the chord the first panel draws over a whole second",
    forms: [[`${PRINTED_SPEEDS[0]} m/s`, "average"]],
  },
  {
    key: "BALL",
    slug: "derivatives",
    why: "where that chord's shorter cousin meets the curve",
    forms: [[`reaches ${PRINTED_POSITIONS[1]} m`]],
  },
  {
    key: "BALL",
    slug: "derivatives",
    why: "the third point of the second panel, already on the line",
    forms: [[`${PRINTED_SPEEDS[2]} m/s`]],
  },
  {
    key: "BALL",
    slug: "derivatives",
    why: "the tangent's slope, which the second panel draws as the line they settle onto",
    forms: [[`close in on ${INSTANT_SPEED} m/s`]],
  },
  // Every figure number added after dispatch 419, keyed on the constants its drawing reads and
  // matched against the sentence in the record that states it. All six lessons print these in
  // prose, so a change to any constant moves the figure away from a paragraph as well as from a
  // picture, which is the drift this file exists to catch.
  {
    key: "SPREAD",
    slug: "diffusion-equation",
    why: "the second panel is drawn for this typical distance",
    forms: [[`${SPREAD.millimetres} mm`, "typical distance"]],
  },
  {
    key: "SPREAD",
    slug: "diffusion-equation",
    why: "the wider bell is the same dye after four times as long",
    forms: [[`${spreadAfter(1, 4)} mm`, "doubles"]],
  },
  {
    key: "SPREAD",
    slug: "diffusion-equation",
    why: "the square root of two, which the caption states and the figure does not draw",
    forms: [[`about ${spreadAfter(2, 1).toFixed(1)} mm`]],
  },
  {
    key: "TYPICAL_DISTANCE",
    slug: "random-walks",
    why: "the curve's second panel passes through this point",
    forms: [[`${typicalDistance(100)} m after a hundred`]],
  },
  {
    key: "TYPICAL_DISTANCE",
    slug: "random-walks",
    why: "the two-step walk, whose four ends the first panel draws",
    forms: [[`about ${typicalDistance(2).toFixed(1)} m after two`]],
  },
  {
    key: "TYPICAL_DISTANCE",
    slug: "random-walks",
    why: "four times the steps for twice the distance, the claim the curve makes",
    forms: [[`${typicalDistance(400)} m`, "Four hundred steps"]],
  },
  {
    key: "WITHIN_WIDTHS",
    slug: "gaussian-distributions",
    why: "the inner band of the bell",
    forms: [[`about ${Number(withinWidths(1).toPrecision(2))} per cent`, "one width"]],
  },
  {
    key: "WITHIN_WIDTHS",
    slug: "gaussian-distributions",
    why: "the middle band, which contains the inner one",
    forms: [[`about ${Number(withinWidths(2).toPrecision(2))} per cent`, "two widths"]],
  },
  {
    key: "WITHIN_WIDTHS",
    slug: "gaussian-distributions",
    why: "the outer band",
    forms: [[`about ${Number(withinWidths(3).toPrecision(3))} per cent`]],
  },
  {
    key: "BIN",
    slug: "distributions",
    why: "the first panel's bar, and the height it is labelled with",
    forms: [[`${BIN.inBin} land in one bin`, `${binDensityPerMicrometre()} per micrometre`]],
  },
  {
    key: "FLAT_DENSITY",
    slug: "distributions",
    why: "the wider rectangle of the second panel",
    forms: [[`${flatDensity(4)} per micrometre`]],
  },
  {
    key: "FLAT_DENSITY",
    slug: "distributions",
    why: "the narrower, taller rectangle, which encloses the same area",
    forms: [[`${flatDensity(2)} per micrometre`, "Squeeze"]],
  },
  {
    key: "SQUARE",
    slug: "taylor-expansion",
    why: "the two strips and the corner the first panel draws to scale",
    forms: [
      [`which add ${2 * SQUARE_SIDE * (SQUARE_STEPS[0] as number)}`, `adds ${PRINTED_CORNERS[0]}`],
    ],
  },
  {
    key: "SQUARE",
    slug: "taylor-expansion",
    why: "the whole grown square",
    forms: [[`${exactSquare(SQUARE_STEPS[0] as number)}`, "squared is"]],
  },
  {
    key: "SQUARE",
    slug: "taylor-expansion",
    why: "the middle of the three squares in the second panel",
    forms: [
      [
        `${linearEstimate(SQUARE_STEPS[1] as number)} instead of ${exactSquare(SQUARE_STEPS[1] as number)}`,
      ],
    ],
  },
  {
    key: "SQUARE",
    slug: "taylor-expansion",
    why: "the largest, where the dropped corner is a quarter of the square",
    forms: [
      [
        `${linearEstimate(SQUARE_STEPS[2] as number)} instead of ${exactSquare(SQUARE_STEPS[2] as number)}`,
      ],
    ],
  },
  {
    key: "RAMP",
    slug: "integration",
    why: "the height the ramp reaches at the right of both drawings",
    forms: [[`${RAMP.topDensity} per micrometre at the right`]],
  },
  {
    key: "RAMP",
    slug: "integration",
    why: "the first cut, whose bars the figure draws",
    forms: [[`= ${stripSum(STRIP_COUNTS[0] as number)}`, "Four strips"]],
  },
  {
    key: "RAMP",
    slug: "integration",
    why: "the second cut, closer to the triangle",
    forms: [[`that is ${stripSum(STRIP_COUNTS[1] as number)}`, "Eight strips"]],
  },
  // FLUX_SECONDS: the first key here for a lesson that is not a bridge, added with the figure of
  // dispatch 418. The check already read one non-bridge record (mean-variance-rms), so nothing
  // about the mechanism changed; only the claims did.
  {
    key: "FLUX_SECONDS",
    slug: "flux-continuity",
    why: "the first panel draws this many crossing in and this many crossing out",
    forms: [[`${flux1.entered} particles`, `${flux1.left} cross out`]],
  },
  {
    key: "FLUX_SECONDS.net",
    slug: "flux-continuity",
    why: "the accumulation the first panel prints, derived from those two counts",
    forms: [[`rises by ${netChange(flux1)}`]],
  },
  {
    key: "FLUX_SECONDS",
    slug: "flux-continuity",
    why: "the second panel draws as many leaving as arriving",
    forms: [[`${flux2.entered} cross in`, `${flux2.left} cross out`]],
  },
  {
    key: "FLUX_SECONDS.crossings",
    slug: "flux-continuity",
    why: "the count that crossed while nothing accumulated, which is the lesson's whole point",
    forms: [[`${crossings(flux2)} particles crossed`]],
  },
  // PARTICLE_ENDS: three records across two panes' lessons, the widest coupling of the four.
  {
    key: "PARTICLE_ENDS",
    slug: "bridge-a-graph",
    why: "the second figure draws a bar above each of these positions",
    forms: [
      [andList(ends), "particles"],
      [plainList(ends), "particles"],
    ],
  },
  // HAZARD, and it needs sequencing rather than a fix here. %2's dispatch 409 is adding
  // DISPLACEMENTS to bridgeFigures.ts for this lesson, identical to PARTICLE_ENDS today and, by
  // its own comment, "deliberately a separate constant" so that either lesson may change its
  // example without the other following. Once that lands, this claim should key on DISPLACEMENTS,
  // because a prose check must read the constant the lesson's own figure draws. It is not re-keyed
  // in this commit: that symbol exists only in an uncommitted working copy, and importing it here
  // would put a gate on HEAD that does not compile. Until then the two arrays are equal, so this
  // claim is true and catches the drift it was written for; when they diverge it will name this
  // file rather than the one at fault.
  {
    key: "PARTICLE_ENDS",
    slug: "bridge-squaring-square-roots",
    why: "a lesson another pane owns squares the same four displacements",
    forms: [
      [plainList(ends), "displacements"],
      [andList(ends), "displacements"],
    ],
  },
  {
    key: "PARTICLE_ENDS",
    slug: "mean-variance-rms",
    why: "a lesson outside the bridges entirely takes three averages of the same four",
    forms: [
      [andList(ends), "particles"],
      [plainList(ends), "signed sum"],
    ],
  },
  // JARS: the key the green plant landed on, and the one whose second reader is a lesson nobody
  // editing bridge-sum-average would think to open.
  {
    key: "JARS",
    slug: "bridge-sum-average",
    why: "the figure draws these four jars, then the same marbles levelled",
    forms: [
      [andList(jars), "jars"],
      [plainList(jars), "jars"],
    ],
  },
  {
    key: "JARS",
    slug: "mean-variance-rms",
    why: "it prints the same four as the distances of the particle ends, ignoring sign",
    forms: [
      [plainList(jars), "distances"],
      [andList(jars), "distances"],
    ],
  },
  // WALK: two records, and the second coupling was created in this unit, so it is fresh debt.
  {
    key: "WALK.step",
    slug: "bridge-a-graph",
    why: "the step drawn on the line reads this rise against this run",
    forms: [[`${first.metres} metres`, `${first.seconds} seconds`]],
  },
  {
    key: "WALK.speed",
    slug: "bridge-a-graph",
    why: "the figure's caption states the rate the step reads off",
    forms: [[`${speed} metres per second`]],
  },
  {
    key: "WALK.step",
    slug: "bridge-fractions-ratios",
    why: "its worked example divides this distance by this time",
    forms: [[`${first.metres} metres`, `${first.seconds} seconds`]],
  },
  {
    key: "WALK.speed",
    slug: "bridge-fractions-ratios",
    why: "the same rate, reached by division rather than by reading the line",
    forms: [[`${speed} metres per second`]],
  },
  {
    key: "WALK.last",
    slug: "bridge-fractions-ratios",
    why: "the last point of the walk, used to show the ratio survives a longer watch",
    forms: [[`${last.metres} metres`, `${last.seconds} seconds`]],
  },
  // MINUTE_DISPLACEMENT: one record here, but it couples outward to the Brownian paper's own §5
  // number, so a drift moves a figure away from a printed historical value and not only from prose.
  {
    key: "MINUTE_DISPLACEMENT",
    slug: "bridge-scientific-notation-units",
    why: "the lower ruler is drawn for this displacement",
    forms: [[`${MINUTE_DISPLACEMENT_MICROMETRES} μm`]],
  },
  {
    key: "MINUTE_DISPLACEMENT.squared",
    slug: "bridge-scientific-notation-units",
    why: "the squaring the figure draws as twice as far along the ruler",
    forms: [[`${MINUTE_DISPLACEMENT_SQUARED_MANTISSA} × 10⁻¹¹ m²`]],
  },
];

type Block = Readonly<{ kind: string; text?: string; items?: readonly string[] }>;
type LessonRecord = Readonly<{
  question?: string;
  summary?: string;
  explanation: readonly Block[];
  exampleTitle?: string;
  example: readonly Block[];
  stoppingPoint?: string;
}>;

/** The sentences a reader reads. A formula block contributes nothing: see the docblock. */
export function sentencesOf(record: LessonRecord): readonly string[] {
  const chunks: string[] = [];
  const addBlocks = (blocks: readonly Block[]): void => {
    for (const b of blocks) {
      if (b.kind === "formula") continue;
      if (typeof b.text === "string") chunks.push(b.text);
      if (Array.isArray(b.items)) chunks.push(...b.items);
    }
  };
  for (const s of [record.question, record.summary, record.exampleTitle, record.stoppingPoint])
    if (typeof s === "string") chunks.push(s);
  addBlocks(record.explanation);
  addBlocks(record.example);
  // Split on a period followed by space, which leaves 0.001 and 1.4 intact, and keeps a clause
  // after a semicolon with the clause before it, where mean-variance-rms puts its noun.
  return chunks.flatMap((c) => c.split(/(?<=\.)\s+/)).map((s) => s.trim());
}

/** The first sentence in which every token of some form appears, or null. */
export function matchIn(sentences: readonly string[], forms: Claim["forms"]): string | null {
  for (const form of forms)
    for (const sentence of sentences)
      if (form.every((token) => sentence.includes(token))) return sentence;
  return null;
}

describe("a bridge figure's numbers and its lesson's prose", () => {
  test("the matcher finds an agreement and reports a disagreement, on records it makes itself", () => {
    // In-lane positive control. A matcher that had stopped matching would leave every claim below
    // unexamined and the suite green, which is the failure this exists to make impossible.
    //
    // It is deliberately built on values that appear in NO record and in no figure. An earlier
    // draft ran it against the live JARS, which made it fail whenever the data changed, for a
    // reason that had nothing to do with the matcher: a control that moves with the thing it is
    // controlling for is not a control.
    const fixed = [["7, 5 and 2", "barrels"]] as const;
    const record = (text: string, kind = "paragraph"): LessonRecord => ({
      explanation: [{ kind, text }],
      example: [],
    });

    expect(
      matchIn(sentencesOf(record("Three barrels hold 7, 5 and 2 litres. Pour them.")), fixed),
    ).toBe("Three barrels hold 7, 5 and 2 litres.");
    // The values changed, so the form no longer matches: this is the planted defect in miniature.
    expect(matchIn(sentencesOf(record("Three barrels hold 6, 6, and 2 litres.")), fixed)).toBe(
      null,
    );
    // The noun must be in the SAME sentence, which is what stops a contrasting list matching.
    expect(
      matchIn(sentencesOf(record("Consider barrels. A list 7, 5 and 2 is written.")), fixed),
    ).toBe(null);
    // A formula block's latex is not prose and is not read.
    expect(matchIn(sentencesOf(record("barrels 7, 5 and 2", "formula")), fixed)).toBe(null);
    // And the renderers themselves, since every form above is built by them.
    expect(andList([7, 5, 2])).toBe("7, 5 and 2");
    expect(plainList([7, 5, 2])).toBe("7, 5, 2");
    expect(signed(-3)).toBe("\u22123");
    expect(signed(3)).toBe("+3");
  });

  test("every declared claim holds in the corpus, and the denominator is printed", () => {
    const problems: string[] = [];
    for (const claim of CLAIMS) {
      const record = bridge(claim.slug) as unknown as LessonRecord;
      const hit = matchIn(sentencesOf(record), claim.forms);
      if (hit === null)
        problems.push(
          `${claim.slug}: no sentence states ${claim.key} as the figure draws it ` +
            `(${claim.why}); wanted one of ${claim.forms.map((f) => f.join(" + ")).join(" | ")}`,
        );
    }
    const records = new Set(CLAIMS.map((c) => c.slug));
    const keys = new Set(CLAIMS.map((c) => c.key.split(".")[0] as string));
    console.log(
      `[bridge prose] ${CLAIMS.length} claims over ${records.size} records and ${keys.size} figure numbers: ${CLAIMS.length - problems.length} agree, ${problems.length} do not`,
    );
    // A run that examined nothing reads exactly like a clean one, so the population is asserted.
    expect(CLAIMS.length).toBeGreaterThan(0);
    expect(records.size).toBeGreaterThan(1);
    expect(keys.size).toBe(16);
    expect(problems).toEqual([]);
  });

  test("the jars are the particle ends without their signs, which nothing else declares", () => {
    // Two figures share four numbers BY DERIVATION and no file says so: bridge-sum-average draws
    // the jars, bridge-a-graph draws the ends, and mean-variance-rms prints both and calls the
    // first "the distances, ignoring sign". Asserting the relation rather than the values is what
    // keeps that link true when either array is edited.
    expect([...JARS]).toEqual(PARTICLE_ENDS.map(Math.abs));
    // Not vacuous in either direction: the ends carry signs that the jars do not.
    expect(PARTICLE_ENDS.some((v) => v < 0)).toBe(true);
    expect(JARS.some((v) => v < 0)).toBe(false);
  });
});
