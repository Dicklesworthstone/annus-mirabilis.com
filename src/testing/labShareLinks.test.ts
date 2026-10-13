/**
 * EVERY LABORATORY A READER CAN SET UP OFFERS A WAY TO KEEP THE ARRANGEMENT
 * (am-inst-permalink-tape-s677).
 *
 * Measured 2026-10-12: BM-02 and LQ-02 rendered no `<LabTapeLink>` and used no tape-link hook, so a
 * reader could arrange BM-02's twenty controls or LQ-02's eighteen, reach something worth showing
 * someone, and have no way to keep it, share it or come back to it. 27 lab components offered one.
 * Nothing reported the two, because nothing asked this question.
 *
 * THERE ARE TWO HONEST MECHANISMS, and a gate that knows only one would accuse three correct labs.
 * `src/experiments/sr05/tape.ts` records the distinction: "SR-01 and BM-06 ... already read their own
 * query format on mount, so their links are minted in that format instead". So:
 *
 *   - the generic tape: the component renders `<LabTapeLink>`, fed by `useLabTapeLink` for a
 *     session laboratory or `useDraftTapeLink` for one that holds form state;
 *   - the laboratory's own settings codec: it calls `encode<Lab>Settings` and mints `?a=1&b=2`.
 *
 * BM-03, ME-01 and SR-01 use the second and are correct; counting only the first would have made
 * them failures. The per-lab `permalink.ts` codec count is not this question either: SR-04, SR-05,
 * LQ-03, LQ-04 and LQ-08 have no codec and offer a reader a link through the tape. Reading that
 * count as the answer is how this nearly became seven unnecessary modules.
 *
 * WHY THE PREDICT GATE IS THE POPULATION. `usePredictGate` marks a component as one of the
 * instrument catalogue's reader-facing laboratories, which is the set that has settings worth
 * sharing. It is read from the source tree rather than from the built pages on purpose: the share
 * control is drawn only after hydration (`LabTapeLink`'s own docblock says so, and measured on the
 * build, 0 of 41 built lab pages carry `data-share-form`), so static HTML cannot answer this and a
 * browser lane would answer it one lab at a time.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const LAB_DIR = join(ROOT, "src/components/lab");

/** The hook that defines the gate is not a laboratory, and is the one file excluded by name. */
const DEFINES_THE_GATE = "src/components/lab/PredictGate.tsx";

const ENCODES_OWN_SETTINGS = /\bencode[A-Z][A-Za-z0-9]*Settings\b/;

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (entry.endsWith(".tsx") && !entry.includes(".test.")) out.push(full);
  }
  return out;
}

/** Each reader-facing laboratory component, with how it offers a shareable arrangement. */
export function shareLinkCensus(root: string): {
  readonly labs: readonly string[];
  readonly byTape: readonly string[];
  readonly byOwnCodec: readonly string[];
  readonly offeringNothing: readonly string[];
} {
  const labs: string[] = [];
  const byTape: string[] = [];
  const byOwnCodec: string[] = [];
  const offeringNothing: string[] = [];
  for (const file of tsxFiles(join(root, "src/components/lab"))) {
    const rel = relative(root, file);
    if (rel === DEFINES_THE_GATE) continue;
    const source = readFileSync(file, "utf8");
    if (!source.includes("usePredictGate(")) continue;
    labs.push(rel);
    const tape = source.includes("<LabTapeLink");
    const own = ENCODES_OWN_SETTINGS.test(source);
    if (tape) byTape.push(rel);
    if (own) byOwnCodec.push(rel);
    if (!tape && !own) offeringNothing.push(rel);
  }
  return { labs, byTape, byOwnCodec, offeringNothing };
}

describe("every settable laboratory offers a shareable arrangement (am-inst-permalink-tape-s677)", () => {
  const census = shareLinkCensus(ROOT);

  test("the population is not empty, so the verdict below is a measurement", () => {
    // A floor rather than an equality: laboratories are added, and this check holds at any count.
    // Without it a walker that found no files would report no violations and read as clean.
    expect(census.labs.length).toBeGreaterThanOrEqual(25);
    expect(LAB_DIR.endsWith("src/components/lab")).toBe(true);
    console.log(
      `[census] lab-share-links examined ${census.labs.length} reader-facing laboratories ` +
        `(minimum 25): ${census.byTape.length} by the generic tape, ${census.byOwnCodec.length} ` +
        "by their own settings codec",
    );
  });

  test("none offers no way at all to keep an arrangement", () => {
    // Named, not counted: a count does not say which laboratory to open.
    expect(census.offeringNothing).toEqual([]);
  });

  test("both mechanisms are in use, so neither branch of the rule is dead", () => {
    // If either reached zero, this check would be asserting a rule with one live arm and the other
    // arm would stop being exercised without anyone noticing.
    expect(census.byTape.length).toBeGreaterThan(0);
    expect(census.byOwnCodec.length).toBeGreaterThan(0);
  });

  test("the detector fires on a laboratory that offers neither (planted negative)", () => {
    // The historical defect, as source rather than as a file: a gated component with a form and no
    // share control of either kind. BM-02 and LQ-02 looked exactly like this until 2026-10-12.
    const planted =
      'const gate = usePredictGate("xx-99", PROMPTS);\nreturn <form><input /></form>;';
    expect(planted.includes("usePredictGate(")).toBe(true);
    expect(planted.includes("<LabTapeLink")).toBe(false);
    expect(ENCODES_OWN_SETTINGS.test(planted)).toBe(false);
  });

  test("the detector accepts either mechanism (positive controls)", () => {
    const byTape = 'usePredictGate("x", P);\n<LabTapeLink link={withPredictions(t, gate)} />';
    const byCodec = 'usePredictGate("x", P);\nurl.search = encodeSr01Settings(p);';
    expect(byTape.includes("<LabTapeLink")).toBe(true);
    expect(ENCODES_OWN_SETTINGS.test(byCodec)).toBe(true);
    // And a near miss that must NOT count: naming the codec in prose is not calling it.
    expect(ENCODES_OWN_SETTINGS.test("// see encode-sr01-settings for the format")).toBe(false);
  });
});
