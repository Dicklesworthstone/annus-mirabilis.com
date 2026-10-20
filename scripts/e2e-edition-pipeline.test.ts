import { describe, expect, test } from "bun:test";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { loadAuthoredEdges } from "../src/content/editions/authoredInputs.ts";
import {
  inspectLedgerPresence,
  PAPERS_WAITING_ON_CLOUD_OCR,
  translationCompleteness,
} from "../src/content/editions/ledgerPresence.ts";
import {
  PIPELINE_STAGES,
  type PipelineStage,
  resolveRequireStageArgument,
  resolveSlugArgument,
  runEditionPipeline,
} from "./e2e-edition-pipeline.ts";

const REPO = process.cwd();
const LEDGER_FIXTURE = join(REPO, "src/testing/fixtures/ledgers/fixture-clean-reviewed.txt");
const RECEIPT_FIXTURE = join(REPO, "src/testing/fixtures/ledgers/fixture-clean.md");
const LEDGER_REL = "public/papers/transcripts/ap-17-549-machine-draft.txt";
const RECEIPT_REL = "docs/provenance/ap-17-549.md";

/**
 * A root where the ledger is PRESENT (am-edn-alignment-tooling-do1).
 *
 * No paper in this repository has a reviewed ledger on disk, so until now every test of
 * this pipeline went down the ledger-absent branch and the ledger-present branch was
 * unreachable, untested, and wrong: it pushed the literal results "Ledger present.",
 * "Segmentation ran." and "Alignment ran." as passes, from lines that ran no ledger
 * validation, no segmentation and no alignment. This root makes that branch reachable.
 *
 * The ledger and the receipt are the clean pair the ledger validator's own CLI test uses,
 * copied rather than invented, so the ledger stage has a real green baseline to be planted
 * against. The content corpus is the repository's own.
 */
function ledgerPresentRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "am-edition-pipeline-"));
  cpSync(join(REPO, "content"), join(root, "content"), { recursive: true });
  for (const [from, rel] of [
    [LEDGER_FIXTURE, LEDGER_REL],
    [RECEIPT_FIXTURE, RECEIPT_REL],
  ] as const) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    cpSync(from, join(root, rel));
  }
  return root;
}

const stageOf = (run: { stages: readonly { stage: string }[] }, stage: string) =>
  run.stages.find((s) => s.stage === stage) as
    | {
        stage: string;
        outcome: string;
        code?: string | undefined;
        message: string;
        pending?: readonly string[] | undefined;
        evidence?: readonly string[] | undefined;
        durationMs: number;
      }
    | undefined;

describe("edition pipeline: no ledger", () => {
  test("every paper on the ledgerless list never reports complete", async () => {
    // The list means NOT COVERED from 2026-09-21, which is absent OR partial: ap-17-132
    // acquired a skeleton while being transcribed and stayed listed, as it must. The
    // INVARIANT holds for every member whatever its coverage; the ledger-absent MECHANISM
    // is asserted only where the ledger really is absent, rather than generalised away.
    for (const slug of PAPERS_WAITING_ON_CLOUD_OCR) {
      const result = await runEditionPipeline({ slug });
      const presence = inspectLedgerPresence(slug).presence;
      expect(result.slug).toBe(slug);
      expect(result.translationCompleteness).not.toBe("complete");
      expect(result.translationCompleteness).toMatch(/^not-applicable-/);
      expect(JSON.stringify(result.stages.map((s) => s.outcome))).not.toMatch(/"complete"/);
      // No stage may claim success for a paper whose ledger does not cover it, whichever
      // way it declines. This is the part that must hold for every member of the list.
      for (const stage of ["reconcile", "align"] as const) {
        expect(stageOf(result, stage)?.outcome, `${slug}: ${stage} must not pass`).not.toBe(
          "passed",
        );
      }
      if (presence === "absent") {
        expect(result.translationCompleteness).toBe("not-applicable-no-ledger");
        expect(stageOf(result, "ledger")?.outcome).toBe("not-available");
        expect(stageOf(result, "ledger")?.code).toBe("ledger-absent");
        expect(stageOf(result, "reconcile")?.outcome).toBe("not-available");
        expect(stageOf(result, "align")?.outcome).toBe("not-available");
      }
    }
  });

  test("all nine specified stages are reported, in order", async () => {
    const result = await runEditionPipeline({ slug: "mass-energy" });
    expect(result.stages.map((s) => s.stage)).toEqual([...PIPELINE_STAGES]);
    expect(PIPELINE_STAGES).toHaveLength(9);
  });

  test("--require-stage ledger exits non-zero for a paper with no ledger", async () => {
    // The specimen must be a paper with NO ledger, which is what this test is about. It was
    // light-quanta until 2026-09-21, when a skeleton put a file on disk; then special-relativity,
    // which acquired its own skeleton in 30ab1df0 the same day and reported
    // not-applicable-PARTIAL-ledger until its ledger covered the paper on 2026-09-25.
    // Re-pointed rather than widened, because the subject is the require-stage behaviour and the
    // paper is only the specimen that exhibits it.
    //
    // THIS IS THE LAST LEDGERLESS PAPER. molecular-dimensions is the only slug left with no
    // transcript at all, so when it gets one there is no specimen in the real corpus and this
    // test must be rewritten against a constructed root - a manifest with no transcripts
    // directory beside it, which is what the sibling test in editionContract.test.ts now does.
    // Do not widen the assertion to accept partial: "no ledger" and "a ledger that does not yet
    // cover the paper" are different states and this test is about the first.
    const result = await runEditionPipeline({
      slug: "molecular-dimensions",
      requireStage: "ledger",
    });
    expect(result.exitCode).toBe(1);
    expect(result.translationCompleteness).toBe("not-applicable-no-ledger");

    // The distinction the paragraph above turns on, asserted rather than described: a paper with
    // a PARTIAL ledger also exits non-zero, and says something different about why.
    //
    // The partial specimen ran out on 2026-09-25, when special-relativity's ledger covered its
    // last page (dispatch 193); no paper in the corpus has a partial ledger now. So it is
    // CONSTRUCTED, the way editionContract's no-ledger pair is: the ledger-present root below,
    // judged once as it is and once with its last page reduced to marker and anchor, the skeleton
    // shape that makes a ledger partial. Only that page differs, so the verdict can only be
    // answering to it. The first run is asserted too: if the full root also said partial, the
    // second verdict would prove nothing.
    const root = ledgerPresentRoot();
    const full = await runEditionPipeline({
      slug: "brownian-motion",
      root,
      requireStage: "ledger",
    });
    expect(full.translationCompleteness).not.toBe("not-applicable-partial-ledger");
    const ledgerPath = join(root, LEDGER_REL);
    const lines = readFileSync(ledgerPath, "utf8").split("\n");
    const anchors = lines.flatMap((line, i) =>
      /^\[\[ANNALEN-PAGE \d+\]\]$/.test(line) ? [i] : [],
    );
    expect(anchors.length, "the constructed root needs two pages to make one bare").toBeGreaterThan(
      1,
    );
    writeFileSync(
      ledgerPath,
      `${lines.slice(0, (anchors.at(-1) as number) + 1).join("\n")}\n`,
      "utf8",
    );
    const partial = await runEditionPipeline({
      slug: "brownian-motion",
      root,
      requireStage: "ledger",
    });
    expect(partial.exitCode).toBe(1);
    expect(partial.translationCompleteness).toBe("not-applicable-partial-ledger");
  });
});

/**
 * The stages measure. Each case changes the DATA a stage reads and asserts the stage's
 * verdict follows. A stage that pushed a literal result would report the same thing on
 * every one of these roots.
 */
describe("PLANT: the ledger-present branch measures instead of announcing", () => {
  test("a clean ledger passes the ledger stage, and one changed character fails it", async () => {
    const root = ledgerPresentRoot();
    const green = await runEditionPipeline({ slug: "brownian-motion", root });
    const ledgerGreen = stageOf(green, "ledger");
    expect(ledgerGreen?.outcome).toBe("passed");
    expect(ledgerGreen?.message).toContain(LEDGER_REL);
    // The old code's literal. It must not come back.
    expect(ledgerGreen?.message).not.toBe("Ledger present.");

    const text = readFileSync(join(root, LEDGER_REL), "utf8");
    writeFileSync(
      join(root, LEDGER_REL),
      text.replace(
        "--- REVIEWED TRANSCRIPTION PAGE 1 OF 2 ---",
        "--- REVIEWED TRANSCRIPTION PAGE 1 OF 3 ---",
      ),
      "utf8",
    );
    const red = await runEditionPipeline({ slug: "brownian-motion", root });
    const ledgerRed = stageOf(red, "ledger");
    expect(ledgerRed?.outcome).toBe("failed");
    expect(ledgerRed?.code).toBe("ledger-not-clean");
    expect(red.exitCode).toBe(1);
  });

  test("the reconcile stage reports the differences it found, not that segmentation ran", async () => {
    const root = ledgerPresentRoot();
    const run = await runEditionPipeline({ slug: "brownian-motion", root });
    const reconcile = stageOf(run, "reconcile");
    // The fixture ledger is a two-page skeleton and the manifest is the real twelve-page
    // Brownian inventory, so disagreement is the correct answer here. What matters is that
    // the answer is counted and named rather than announced.
    //
    // TWO CODES NOW REACH THAT ANSWER, and this pinned the only one the old code could produce.
    // The stage pairs the proposal's ids with the frozen ones before comparing them, because the
    // two are deliberately different namespaces; on this fixture that pairing REFUSES, which is
    // correct and more precise than a list of name differences -- a two-page skeleton cannot be
    // paired with a twelve-page inventory. Both codes are measurements, which is the property the
    // plant is about, and the test below exercises the other one on a real paper.
    expect(reconcile?.outcome).toBe("failed");
    expect(["reconciliation-differences", "manifest-pairing-refused"]).toContain(reconcile?.code);
    expect(reconcile?.message).toMatch(/\d+ unresolved difference\(s\)|could not be paired/);
    expect(reconcile?.message).not.toBe("Segmentation ran.");
    expect((reconcile?.evidence ?? []).length).toBeGreaterThan(0);
  });

  test("the reconcile stage still reaches a counted difference list, on a paper whose proposal pairs", async () => {
    // Without this the test above could pass on a stage that only ever refuses to pair. mass-energy
    // pairs, so its differences are counted: 11 of them, all sentence-level, which is the ruling
    // am-xz2d owns. Before the pairing landed it reported 29, 18 of which were one unit under two
    // names.
    const run = await runEditionPipeline({ slug: "mass-energy" });
    const reconcile = stageOf(run, "reconcile");
    expect(reconcile?.code).toBe("reconciliation-differences");
    expect(reconcile?.message).toMatch(/\d+ unresolved difference\(s\)/);
    // The namespace class is gone: no difference names a display equation under either spelling.
    const evidence = (reconcile?.evidence ?? []).join(" ");
    expect(evidence).not.toMatch(/s\d+-eq\d+/);
    expect(evidence).not.toMatch(/"eq-s\d+-d\d+"/);
  });

  test("the reconcile stage names the sentence-unit ruling it stops at, whatever its verdict", async () => {
    const root = ledgerPresentRoot();
    const run = await runEditionPipeline({ slug: "brownian-motion", root });
    const reconcile = stageOf(run, "reconcile");
    expect(reconcile?.pending?.join(" ")).toContain("am-xz2d");
    expect(reconcile?.pending?.join(" ")).toContain("sentence");
    // Also on the absent path: a stage that skipped the work still says which work.
    const absent = await runEditionPipeline({ slug: "mass-energy" });
    expect(stageOf(absent, "reconcile")?.pending?.join(" ")).toContain("am-xz2d");
  });

  test("the align stage reports what it measured, not that alignment ran", async () => {
    // THIS ASSERTED `failed` AND NOW ASSERTS THE MEASUREMENT, because the subject changed under it.
    // The stage used to validate an empty edge set -- nothing passed it the authored edges -- so
    // every paper reported `empty-alignment` and "failed" was simply what that produced. Now the
    // edges are loaded from content/alignments/, and brownian-motion's 162 of them are complete and
    // valid, so the correct verdict here is a pass. The plant's point was never the verdict: it was
    // that the stage announces a literal. So it asserts the message carries a COUNT either way, and
    // the case below shows the stage still reaches "failed" when there is something to fail on.
    const root = ledgerPresentRoot();
    const run = await runEditionPipeline({ slug: "brownian-motion", root });
    const align = stageOf(run, "align");
    expect(align?.outcome).not.toBe("not-available");
    expect(align?.message).toMatch(/\d+/);
    expect(align?.message).not.toBe("Alignment ran.");
    expect(align?.message).not.toBe("Segmentation ran.");
  });

  test("the align stage still reaches a failure, on the one record whose id the grammar refuses", async () => {
    // Without this the test above could pass on a stage that can only ever report a pass. The
    // failure is real and singular: special-relativity's `eq-A` is Einstein's printed equation (A)
    // on page 918, and the anchor grammar admits a numeric printed label and not a letter, so that
    // one edge reports `missing-source-id` and its English unit reports `unaligned-target`.
    const run = await runEditionPipeline({ slug: "special-relativity" });
    const align = stageOf(run, "align");
    expect(align?.outcome).toBe("failed");
    expect(align?.message).toMatch(/issue\(s\)/);
    expect(align?.evidence?.join(" ")).toContain("eq-A");
  });

  test("the coverage stage counts the translation units on disk, where it used to pass a literal zero", async () => {
    // The defect: `translationUnitCount: 0` was hardcoded, and translationCompleteness returns
    // "incomplete" for any count below the German alignable count, so every paper's coverage report
    // said its translation was incomplete whatever was authored. 821 unit records were on disk.
    const run = await runEditionPipeline({ slug: "mass-energy" });
    const coverage = stageOf(run, "coverage");
    expect(coverage?.outcome).toBe("passed");
    expect(coverage?.message).toContain("translation complete");

    // THE NEGATIVE, so this cannot pass on a verdict that is always "complete": the same rule with no
    // units returns incomplete, and with fewer units than German alignables it still does.
    expect(
      translationCompleteness({
        ledger: "complete",
        translationUnitCount: 0,
        germanAlignableCount: 33,
      }),
    ).toBe("incomplete");
    expect(
      translationCompleteness({
        ledger: "complete",
        translationUnitCount: 32,
        germanAlignableCount: 33,
      }),
    ).toBe("incomplete");
    expect(
      translationCompleteness({
        ledger: "complete",
        translationUnitCount: 43,
        germanAlignableCount: 33,
      }),
    ).toBe("complete");
  });

  test("the contract stage names the checks that reached no verdict, not only how many", async () => {
    // A stage that passes while two thirds of its checks examined nothing is the citation AGENTS.md
    // warns about. The count was already honest; the names were not reported anywhere.
    const run = await runEditionPipeline({ slug: "mass-energy" });
    const contract = stageOf(run, "contract");
    const unrun = (contract?.evidence ?? []).filter((e) => e.startsWith("not-available #"));
    // Non-vacuity: this paper really does have checks that cannot run yet, so a non-empty list is a
    // result rather than an artefact of the filter.
    expect(unrun.length).toBeGreaterThan(0);
    expect(contract?.message).toMatch(/\d+ passed and \d+ not-available/);
    // Each named entry carries its reason, so the list is actionable rather than a tally.
    for (const line of unrun) expect(line.length).toBeGreaterThan("not-available #99 x: ".length);
  });

  test("the compile stage fails on a corrupted record and is never a pass over an empty corpus", async () => {
    const root = ledgerPresentRoot();
    expect(
      stageOf(await runEditionPipeline({ slug: "brownian-motion", root }), "compile")?.outcome,
    ).toBe("passed");

    const paperPath = join(root, "content/papers/brownian-motion.json");
    writeFileSync(paperPath, "{ not json", "utf8");
    const red = await runEditionPipeline({ slug: "brownian-motion", root });
    const compileRed = stageOf(red, "compile");
    expect(compileRed?.outcome).toBe("failed");
    // The refusal code matters, not just the failure. This stage has two failure
    // paths - the compiler REPORTING errors (compile-errors) and the compiler or the
    // loader THROWING (compile-threw) - and asserting only "failed" would accept
    // either, so a corrupted record that crashed the loader instead of producing
    // diagnostics would still read as proof that diagnostics are surfaced.
    expect(compileRed?.code).toBe("compile-errors");
    expect(compileRed?.message).toMatch(/Content compiler reported \d+ error\(s\)/);
    // The findings are kept, not just counted, so the failure can be diagnosed later.
    expect((compileRed?.evidence ?? []).length).toBeGreaterThan(0);

    // An empty corpus compiles trivially. Reporting that as a pass would say the paper's
    // records are sound when none were read.
    const bare = mkdtempSync(join(tmpdir(), "am-edition-pipeline-bare-"));
    const empty = await runEditionPipeline({ slug: "brownian-motion", root: bare });
    expect(stageOf(empty, "compile")?.outcome).toBe("not-available");
    expect(stageOf(empty, "compile")?.code).toBe("content-corpus-absent");
  });

  test("the coverage stage writes the report it claims and refuses an aggregate figure", async () => {
    const root = ledgerPresentRoot();
    const run = await runEditionPipeline({ slug: "brownian-motion", root });
    const coverage = stageOf(run, "coverage");
    expect(coverage?.outcome).toBe("passed");
    const dir = join(root, "artifacts/edition-coverage/brownian-motion");
    expect(existsSync(dir)).toBe(true);
    const written = readdirSync(dir);
    expect(written.some((f) => f.endsWith(".json"))).toBe(true);
    expect(written.some((f) => f.endsWith(".md"))).toBe(true);
    for (const file of written) {
      expect(readFileSync(join(dir, file), "utf8")).not.toMatch(/\d+(\.\d+)?\s*%/);
    }
  });

  /**
   * THE STAGE READS THE FACE ROUTES, and asserting on the plant the corpus can actually produce.
   *
   * This test used to write `out/papers/<slug>/index.html` -- the reading route, not a face -- and
   * plant `--- REVIEWED TRANSCRIPTION PAGE 1 OF 2 ---` in it. Both were wrong in the same
   * direction as the stage they tested. The stage's regex was keyed on the word REVIEWED, so the
   * plant was chosen to match the detector rather than to match the corpus: all four shipping
   * ledgers are machine drafts and open `--- MACHINE DRAFT TRANSCRIPTION PAGE n OF m ---`, a form
   * the detector could not see. The plant below is the machine-draft form, which is the one a leak
   * could consist of.
   */
  test("the static-html stage scans the face route and catches a machine-draft page marker", async () => {
    const root = ledgerPresentRoot();
    const page = join(root, "out/papers/brownian-motion/view/german/index.html");
    mkdirSync(dirname(page), { recursive: true });

    // Brownian's section 0 holds six anchor-bearing units, so `--sections s0` gives this fixture
    // a real anchor denominator of six rather than the paper's 178.
    const s0 = ["s0-p1", "s0-p1-s1", "s0-p1-s2", "s0-p2", "s0-p2-s1", "s0-p2-s2"];
    const facePage = (ids: readonly string[]) =>
      `<html lang="en"><body>${ids
        .map((id) =>
          id.includes("-s")
            ? `<span id="${id}">Satz</span>`
            : `<p id="${id}" data-block-id="${id}" data-kind="paragraph" lang="de">Die Bewegung ist unregelmäßig.</p>`,
        )
        .join("")}</body></html>`;

    writeFileSync(page, facePage(s0), "utf8");
    const green = stageOf(
      await runEditionPipeline({ slug: "brownian-motion", root, sections: ["s0"] }),
      "static-html",
    );
    expect(green?.outcome).toBe("passed");
    // The pass states its census, so a scan of nothing cannot read as a clean scan.
    expect(green?.message).toContain("german");
    expect(green?.message).toContain("6 of 6 anchors");
    expect(green?.message).toContain("2 German element(s)");
    expect(green?.pending?.join(" ")).toContain("stale");

    // One anchor withheld: the scan names it rather than only counting it.
    writeFileSync(page, facePage(s0.slice(1)), "utf8");
    const short = stageOf(
      await runEditionPipeline({ slug: "brownian-motion", root, sections: ["s0"] }),
      "static-html",
    );
    expect(short?.outcome).toBe("failed");
    expect(short?.evidence?.join(" ")).toContain("static-html-anchor-missing");
    expect(short?.evidence?.join(" ")).toContain("s0-p1");

    writeFileSync(
      page,
      '<html lang="en"><body><p>--- MACHINE DRAFT TRANSCRIPTION PAGE 1 OF 2 --- Die Bewegung</p></body></html>',
      "utf8",
    );
    const red = stageOf(
      await runEditionPipeline({ slug: "brownian-motion", root, sections: ["s0"] }),
      "static-html",
    );
    expect(red?.outcome).toBe("failed");
    expect(red?.code).toBe("static-html-findings");
    expect(red?.evidence?.join(" ")).toContain("static-html-ledger-page-marker");
  });

  test("a face named by --layers but not built is not-available, naming the route", async () => {
    const root = ledgerPresentRoot();
    const german = join(root, "out/papers/brownian-motion/view/german/index.html");
    mkdirSync(dirname(german), { recursive: true });
    writeFileSync(german, '<html lang="en"><body><p>text</p></body></html>', "utf8");
    // German is there; the English face is not, and asking for the translation layer must say so
    // rather than pass on the one face that happens to exist.
    const stage = stageOf(
      await runEditionPipeline({
        slug: "brownian-motion",
        root,
        layers: ["german", "translation"],
      }),
      "static-html",
    );
    expect(stage?.outcome).toBe("not-available");
    expect(stage?.code).toBe("static-html-not-available");
    expect(stage?.message).toContain("view/english/index.html");
  });

  test("a layer that is published as no face says so, rather than passing on nothing", async () => {
    const root = ledgerPresentRoot();
    const stage = stageOf(
      await runEditionPipeline({ slug: "brownian-motion", root, layers: ["notation"] }),
      "static-html",
    );
    expect(stage?.outcome).toBe("not-available");
    expect(stage?.code).toBe("static-html-no-face");
  });

  /**
   * THE CORPUS HALF OF THE SCAN'S PROOF.
   *
   * `staticHtmlScan.test.ts` proves each of the five scans against fixtures, in a lane that needs
   * no build. That is the half that keeps working when the build is broken, and it is not enough
   * on its own: a fixture cannot show that the scans reach a real face, that their populations are
   * not empty there, or that the anchor denominator is a real number. This half does, when `out/`
   * is present, and says which branch it took when it is not -- rather than skipping, because a
   * skipped test and a passing one are the same green.
   */
  test("over the repository's own build, the five scans reach a real population", async () => {
    const built = join(REPO, "out/papers/brownian-motion/view/german/index.html");
    const stage = stageOf(
      await runEditionPipeline({ slug: "brownian-motion", root: REPO }),
      "static-html",
    );
    if (!existsSync(built)) {
      expect(stage?.outcome).toBe("not-available");
      expect(stage?.code).toBe("static-html-not-available");
      return;
    }
    expect(stage?.outcome).toBe("passed");
    const message = stage?.message ?? "";
    // The census, named: anchors asserted and resolved, and German elements examined. Every one of
    // these was zero before this stage was wired, because three of the five scans did not exist.
    const anchors = /(\d+) of (\d+) anchors/.exec(message);
    expect(anchors, `no anchor census in: ${message}`).not.toBeNull();
    expect(Number(anchors?.[2] ?? 0)).toBeGreaterThan(100);
    expect(anchors?.[1]).toBe(anchors?.[2]);
    const germanElements = /(\d+) German element/.exec(message);
    expect(Number(germanElements?.[1] ?? 0)).toBeGreaterThan(10);
    // And the reader reads a fraction of the bytes, which is the whole reason the LaTeX scan works.
    const sizes = /german (\d+)K \((\d+)K read by a reader\)/.exec(message);
    expect(sizes, `no size census in: ${message}`).not.toBeNull();
    expect(Number(sizes?.[2] ?? 0)).toBeLessThan(Number(sizes?.[1] ?? 0));
  });

  /**
   * THE THREE STATES OF THE PAIRING, and the stage used to have two branches for them.
   *
   * `loadGermanSourceFace(...)?.anchors.anchorOf` yields undefined when the loader returns null,
   * which the optional chain made indistinguishable from "no pairing was asked for". The stage
   * guarded the THROW and not the NULL, so a run with no pairing compared two namespaces with
   * nothing joining them and reported the result as content differences -- the thing the comment
   * at that call says in its own words would read as a content problem.
   *
   * Measured 2026-10-20: the loader returns null for special-relativity, deliberately (its receipt
   * holds ledgerStatus not-started, because publishing the face makes manifestAnchors throw, 106
   * paragraphs against 94), and a real pairing for the other three.
   */
  test("an absent pairing is not-available with its differences retained, not a content failure", async () => {
    const run = await runEditionPipeline({ slug: "special-relativity", root: REPO });
    const stage = stageOf(run, "reconcile");
    expect(stage?.outcome).toBe("not-available");
    expect(stage?.code).toBe("manifest-pairing-unavailable");
    // Nothing is thrown away: the name differences computed without a pairing are evidence.
    expect((stage?.evidence ?? []).length).toBeGreaterThan(100);
    expect(stage?.message).toContain("cannot be compared");
    // And the pending list says who owns publishing the face, so the state is not a dead end.
    expect(stage?.pending?.join(" ")).toContain("am-german-face-anchors-not-frozen-ids-jtv6");
  });

  test("--require-stage reconcile turns that not-available back into a failure", async () => {
    // The flag is what keeps the not-available above from being a way to pass. Without this pair,
    // reporting an unavailable pairing would be indistinguishable from relaxing the gate.
    const required = await runEditionPipeline({
      slug: "special-relativity",
      root: REPO,
      requireStage: "reconcile",
    });
    expect(required.exitCode).toBe(1);
    expect(stageOf(required, "reconcile")?.outcome).toBe("not-available");
  });

  test("a paper whose face pairs still reports its real differences", async () => {
    // The control. If the branch above fired for every paper the stage would have stopped
    // reconciling anything, and this is what says it did not.
    const run = await runEditionPipeline({ slug: "brownian-motion", root: REPO });
    const stage = stageOf(run, "reconcile");
    expect(stage?.outcome).toBe("failed");
    expect(stage?.code).toBe("reconciliation-differences");
    // Reported rather than frozen: the count moves when the segmentation rules or the manifest
    // change. What is asserted is that it is a real population and not the whole manifest.
    const count = Number(/^(\d+) unresolved/.exec(stage?.message ?? "")?.[1] ?? 0);
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(120);
  });

  /**
   * THE SENTENCE-DIVISION SCREEN REACHES A READER, which for a month it did not.
   *
   * am-span-recording-decision-ero2's owner decision of 2026-09-21 was "Option 3 now, Option 1
   * later", and Option 3 -- a per-page comparison of the manifest's sentence division with the
   * one a segmentation run proposes -- was built as `sentenceDivisionComparison.ts` and had ZERO
   * non-test callers when measured on 2026-10-20. The reconcile stage already held all three of
   * its inputs.
   */
  test("the reconcile stage reports the division screen with its page denominator", async () => {
    const stage = stageOf(
      await runEditionPipeline({ slug: "brownian-motion", root: REPO }),
      "reconcile",
    );
    const screen = (stage?.pending ?? []).find((p) => p.startsWith("sentence-division screen"));
    expect(screen, `pending was: ${JSON.stringify(stage?.pending)}`).toBeDefined();
    expect(screen).toContain("am-span-recording-decision-ero2");
    expect(screen).toContain("ledger pages");
    expect(screen).toContain("comparable");
  });

  test("the screen is comparing something: pages comparable, and no manifest unit unplaceable", async () => {
    // THE NON-VACUITY, and it is not hypothetical. The first wiring passed the manifest units
    // through a loader that returned only id and kind, so every unit lost its page locator and
    // the screen reported "0 comparable + 12 not-available (unplaceable: 91 manifest units)".
    // That is the harness correctly refusing to compare, against a shape the caller had
    // flattened, and a summary line alone would have read as a result.
    const stage = stageOf(
      await runEditionPipeline({ slug: "brownian-motion", root: REPO }),
      "reconcile",
    );
    const screen =
      (stage?.pending ?? []).find((p) => p.startsWith("sentence-division screen")) ?? "";
    const comparable = Number(/= (\d+) comparable/.exec(screen)?.[1] ?? 0);
    expect(comparable, screen).toBeGreaterThan(0);
    // An unplaceable manifest unit means a locator the caller did not pass through.
    expect(screen).not.toContain("manifest unit(s) with no page locator");
  });

  test("when pages differ, the screen names them rather than only counting them", async () => {
    const stage = stageOf(
      await runEditionPipeline({ slug: "brownian-motion", root: REPO }),
      "reconcile",
    );
    const screen =
      (stage?.pending ?? []).find((p) => p.startsWith("sentence-division screen")) ?? "";
    const differing = Number(/and (\d+) differ/.exec(screen)?.[1] ?? 0);
    const named = (stage?.pending ?? []).find((p) => p.startsWith("pages where the two divisions"));
    if (differing > 0) {
      expect(
        named,
        "a differing count with no page list is a number nobody can act on",
      ).toBeDefined();
      // Each entry is `p<page> <manifest>/<proposed>`, so the reader gets the page and both counts.
      expect(named).toMatch(/p\d+ \d+\/\d+/);
      expect((named ?? "").split(",").length).toBe(differing);
    } else {
      expect(named).toBeUndefined();
    }
  });

  /**
   * THE COVERAGE REPORT SAID THREE AUTHORED LAYERS WERE ABSENT.
   *
   * `coverageReport` reads `germanEditionPresent`, `alignmentEdgeCount` and `glossUnitCount` as
   * optional and treats undefined as absent. The stage passed none of them, so the report
   * brownian-motion's own run wrote said "german-edition absent 107", "alignment absent 0" and
   * "gloss absent 0" -- while the align stage of the SAME RUN had validated 162 edges for that
   * paper. The first of those rows is self-contradictory on its face: absent, with 107 units.
   */
  test("no layer is reported absent while carrying units", async () => {
    // The invariant, and the one the old report broke in writing.
    for (const slug of ["mass-energy", "brownian-motion", "light-quanta"] as const) {
      const stage = stageOf(await runEditionPipeline({ slug, root: REPO }), "coverage");
      expect(stage?.outcome, slug).toBe("passed");
      const layers = /Layers: (.*)\.$/.exec(stage?.message ?? "")?.[1] ?? "";
      expect(layers, `no layer list in: ${stage?.message}`).not.toBe("");
      for (const entry of layers.split(", ")) {
        const [, presence, count] = /^(\S+) (\S+) (\d+)$/.exec(entry) ?? [];
        if (presence === "absent") {
          expect(Number(count), `${slug}: ${entry}`).toBe(0);
        }
      }
    }
  });

  test("alignment and gloss carry the counts the loaders report, not zero", async () => {
    // The non-vacuity. Asserting only the invariant above would pass against a report that said
    // every layer was absent with zero units, which is what it did for two of the five.
    const stage = stageOf(
      await runEditionPipeline({ slug: "brownian-motion", root: REPO }),
      "coverage",
    );
    const message = stage?.message ?? "";
    expect(message).toContain("alignment authored");
    expect(message).toContain("gloss authored");
    expect(message).toContain("german-edition authored");
    const alignment = Number(/alignment authored (\d+)/.exec(message)?.[1] ?? 0);
    const gloss = Number(/gloss authored (\d+)/.exec(message)?.[1] ?? 0);
    expect(alignment).toBeGreaterThan(100);
    expect(gloss).toBeGreaterThan(50);
    // The alignment row must agree with what the align stage of the same run validated, so the
    // two cannot drift: both read the same loader.
    expect(alignment).toBe(loadAuthoredEdges("brownian-motion", REPO).edges.length);
  });

  /**
   * "VALIDATED CLEAN" IS A STRUCTURAL VERDICT, and sixteen warnings were being dropped.
   *
   * The validator runs in STRUCTURAL mode unless the ledger's status is corrected,
   * corrected-second-read or reviewed. All four papers are in-progress or not-started, so
   * completeness mode -- page coverage and the closing blocks -- has never run on any of them,
   * and the pass said nothing about that. It also reported only `errors`: measured 2026-10-20,
   * 0, 3, 5 and 8 warnings across the four papers, every one of them `short-line`, which is a
   * leftover AGENTS.md forbids by name.
   */
  test("the ledger pass names its mode and the status that chose it", async () => {
    const stage = stageOf(await runEditionPipeline({ slug: "light-quanta", root: REPO }), "ledger");
    expect(stage?.outcome).toBe("passed");
    expect(stage?.message).toContain("structural mode");
    expect(stage?.message).toContain("status in-progress");
    expect(stage?.pending?.join(" ")).toContain("completeness mode has not run");
  });

  test("the ledger pass keeps its warnings instead of dropping them", async () => {
    const stage = stageOf(await runEditionPipeline({ slug: "light-quanta", root: REPO }), "ledger");
    const count = Number(/with (\d+) warning/.exec(stage?.message ?? "")?.[1] ?? -1);
    expect(count, stage?.message).toBeGreaterThan(0);
    // Every warning the message counts is in the pending list: a count with nothing behind it is
    // the shape this replaced. The list also carries the completeness-mode note, so the
    // arithmetic is stated rather than assumed -- and the warnings are NOT all one code, which is
    // what a `short-line` filter got wrong here: light quanta's five are four short-line and one
    // short-paragraph, so filtering by code under-counted and read as a drop.
    const modeNote = (stage?.pending ?? []).filter((line) =>
      line.startsWith("completeness mode has not run"),
    );
    expect(modeNote).toHaveLength(1);
    expect((stage?.pending ?? []).length).toBe(count + 1);
    // And each one is a coded finding rather than prose, so a reader can act on it.
    for (const line of (stage?.pending ?? []).filter((l) => !l.startsWith("completeness mode"))) {
      expect(line, line).toMatch(/^[a-z][a-z0-9-]*: /);
    }
  });

  test("a paper with no warnings says zero rather than omitting the clause", async () => {
    // The control. mass-energy's ledger has none, so the clause must still be there and read 0 --
    // otherwise "with N warning(s)" would only ever appear when it was non-zero, and its absence
    // would be ambiguous between none and not-measured.
    const stage = stageOf(await runEditionPipeline({ slug: "mass-energy", root: REPO }), "ledger");
    expect(stage?.message).toContain("0 warning(s)");
    // Only the completeness-mode note, and no warning line behind a zero count.
    expect((stage?.pending ?? []).filter((l) => !l.startsWith("completeness mode"))).toEqual([]);
  });

  /**
   * THREE CONTRACT CHECKS WERE NOT-AVAILABLE FOR WANT OF AN ARGUMENT.
   *
   * Measured 2026-10-20 the contract stage reported "9 passed and 10 not-available" on every
   * paper. Three of the ten said in their own words that nothing had been supplied -- #10 "no
   * alignment components were supplied", #11 "no term occurrences were supplied", #13 "no gloss
   * input was supplied" -- while all three loaders exist in authoredInputs.ts and
   * scripts/align-editions.ts already called them. Supplying them takes the stage to 12 passed
   * and 7 not-available.
   */
  test("the components, terms and gloss checks reach a verdict", async () => {
    const stage = stageOf(
      await runEditionPipeline({ slug: "light-quanta", root: REPO }),
      "contract",
    );
    expect(stage?.outcome).toBe("passed");
    const unavailable = (stage?.evidence ?? []).filter((line) => line.startsWith("not-available"));
    for (const check of ["#10", "#11", "#13"]) {
      expect(
        unavailable.some((line) => line.startsWith(`not-available ${check} `)),
        `${check} should no longer be not-available; unavailable: ${unavailable.join(" | ")}`,
      ).toBe(false);
    }
  });

  test("the count moved, and the seven that remain are still named", async () => {
    // The arithmetic, so a future regression that quietly re-drops an argument is visible, and
    // the naming rule the stage already had: a count of seven says nothing about which seven.
    const stage = stageOf(
      await runEditionPipeline({ slug: "light-quanta", root: REPO }),
      "contract",
    );
    const passed = Number(/reported (\d+) passed/.exec(stage?.message ?? "")?.[1] ?? 0);
    const unavailableCount = Number(
      /and (\d+) not-available/.exec(stage?.message ?? "")?.[1] ?? -1,
    );
    expect(passed).toBeGreaterThanOrEqual(12);
    expect(unavailableCount).toBeLessThanOrEqual(7);
    const named = (stage?.evidence ?? []).filter((line) => line.startsWith("not-available"));
    expect(named.length).toBe(unavailableCount);
    // Each names its number and its reason, not just its name.
    for (const line of named) expect(line).toMatch(/^not-available #(\d+|undefined) \S+: .+/);
  });

  test("the seven that remain are the ones with no input to give them", async () => {
    // Recorded as an identity rather than a count, because these are permanent until someone
    // writes an edition.yaml, assembles an edition text, or builds a span loader. If one of them
    // starts passing, this test should be the thing that asks why.
    const stage = stageOf(
      await runEditionPipeline({ slug: "light-quanta", root: REPO }),
      "contract",
    );
    const numbers = (stage?.evidence ?? [])
      .filter((line) => line.startsWith("not-available"))
      .map((line) => /not-available #(\S+)/.exec(line)?.[1])
      .sort();
    expect(numbers).toEqual(["1", "12", "14", "15", "3", "7", "9"].sort());
  });

  /**
   * THE ALIGN PASS CARRIES THE CENSUS runAlignEditions ALREADY COMPUTES.
   *
   * `AlignEditionsExamined` exists because of the defect align-editions.ts records in its own
   * docblock: `"issues": []` while five of the eight rules had examined nothing. The census is
   * returned on every run -- edges, German ids, English ids, components, terms, gloss units,
   * review units -- and this stage reported one of the seven numbers, the German unit count.
   */
  test("the align pass states every population the run examined", async () => {
    const stage = stageOf(
      await runEditionPipeline({ slug: "brownian-motion", root: REPO }),
      "align",
    );
    expect(stage?.outcome).toBe("passed");
    for (const noun of [
      "edge(s)",
      "English id(s)",
      "component(s)",
      "term(s)",
      "gloss unit(s)",
      "review unit(s)",
    ]) {
      expect(stage?.message, `the census omits ${noun}`).toContain(noun);
    }
    // Real populations, not a template over zeros.
    expect(Number(/(\d+) edge\(s\)/.exec(stage?.message ?? "")?.[1] ?? 0)).toBeGreaterThan(100);
    expect(Number(/(\d+) component\(s\)/.exec(stage?.message ?? "")?.[1] ?? 0)).toBeGreaterThan(50);
  });

  test("the census follows the layers, which is what makes it a measurement", async () => {
    // The pair that proves the numbers are read from the run and not printed as a constant: the
    // gloss population loads only when the gloss layer is asked for, so a german-only run must
    // report 0 and a three-layer run must report the corpus count.
    const germanOnly = stageOf(
      await runEditionPipeline({ slug: "brownian-motion", root: REPO }),
      "align",
    );
    expect(germanOnly?.message).toContain("0 gloss unit(s)");
    const allLayers = stageOf(
      await runEditionPipeline({
        slug: "brownian-motion",
        root: REPO,
        layers: ["german", "translation", "gloss"],
      }),
      "align",
    );
    const gloss = Number(/(\d+) gloss unit\(s\)/.exec(allLayers?.message ?? "")?.[1] ?? 0);
    expect(gloss).toBeGreaterThan(50);
  });

  test("rule C.7's empty population is declared, not left as a zero in a list", async () => {
    // 0 review units is not a clean result: the check asks the German-ledger question of a
    // translation-layer corpus, and the reason is a decision disagreement rather than a missing
    // loader. A zero in a census with no note beside it reads as nothing to check.
    const stage = stageOf(
      await runEditionPipeline({ slug: "brownian-motion", root: REPO }),
      "align",
    );
    expect(stage?.message).toContain("0 review unit(s)");
    expect(stage?.pending?.join(" ")).toContain("am-edit-review-records-hofz");
  });

  test("every stage carries a duration and the run names its JSONL log", async () => {
    const run = await runEditionPipeline({ slug: "mass-energy" });
    for (const stage of run.stages) {
      expect(typeof stage.durationMs).toBe("number");
    }
    expect(run.logPath).toMatch(/edition-pipeline\/.*\.jsonl$/);
    expect(existsSync(run.logPath as string)).toBe(true);
  });
});

/**
 * The corpus-empty refusal, driven by name (am-p465, am-kd9h).
 *
 * The owner ruled "Positional code argument" on am-p465, so this site gained a code:
 * `throw new EmptyCorpusError("corpus-empty")` where it previously threw with no arguments at all.
 * Coding it moved the site out of the bare-throw population and into the untested-coded one
 * against a RECORDED baseline of 0, so it is a regression against a measured count rather than new
 * debt, and it is paid here rather than recorded.
 *
 * THE CITATION IS BACK, AND NOW IT IS BACKED. The catch at the end of the compile stage used to
 * discard the abort's code entirely - it discriminated by class and never read `err.code` - so no
 * test could assert it and the citation below was a claim about a code nothing observed. The
 * orchestrator approved recording it on the defect's own merits (a catch that keeps less than it
 * caught), and the assertion on `aborted-by: corpus-empty` is what makes the citation checkable.
 * Renaming that site's code now turns this test red, which it did not before.
 *
 * WHAT THE EARLIER REMOVAL WAS FOR, kept because the reasoning still governs. It cited the
 * absent-directory abort's line, and the stale-citation ratchet refused it as code-mismatched. The
 * gate's rule is to plant before repointing, so I renamed that site's code to
 * "corpus-empty-planted" and ran this suite: 12 pass, 0 fail. The citation was a claim I had not
 * verified and could not.
 *
 * WHY IT CANNOT BE VERIFIED, which is a finding about the site rather than about this test. The
 * catch at the end of the compile stage reads `if (!(err instanceof EmptyCorpusError))` - it
 * discriminates the deliberate abort BY CLASS and never reads `err.code`. The code string is
 * therefore inert at this site: nothing observes it, so no test can assert it. What this test does
 * verify, and what the plant above confirmed, is the throw's EFFECT.
 *
 * The refusal is not observable as a thrown error: the pipeline catches EmptyCorpusError and
 * surfaces it as a stage result, which is the point of the class. What a caller sees is the
 * compile stage reporting `not-available` with `content-corpus-absent` instead of blaming the
 * compiler for a corpus that was never there. Deleting the throw does not leave that result
 * standing - execution falls through to loadReadingFiles, which throws ENOENT and fails the stage.
 */
describe("edition pipeline: an absent corpus is not a compiler failure", () => {
  test("the abort records its own code and spares the compiler (e2e-edition-pipeline.ts:684)", async () => {
    const emptyRoot = mkdtempSync(join(tmpdir(), "am-edition-no-corpus-"));
    const run = await runEditionPipeline({ slug: "brownian-motion", root: emptyRoot });

    const compileStages = run.stages.filter((stage) => stage.stage === "compile");
    expect(compileStages).toHaveLength(1);
    expect(compileStages[0]?.outcome).toBe("not-available");
    expect(compileStages[0]?.code).toBe("content-corpus-absent");

    // The abort's OWN code, which the catch used to discard. This is what backs the citation
    // above: rename the code at that site and this assertion is the one that goes red.
    expect(compileStages[0]?.evidence ?? []).toContain("aborted-by: corpus-empty");

    // THIS IS THE ASSERTION THE REFUSAL OWNS, and the reason the three above are not enough: the
    // push() that records content-corpus-absent runs BEFORE the throw, so it stands whether or
    // not the refusal is there. What the throw does is ABORT, so the compiler is never asked to
    // read a corpus that is absent and never blamed for it. Delete it and execution falls through
    // to loadReadingFiles, which adds a SECOND compile entry with outcome "failed" and turns the
    // run red. Measured both ways.
    expect(
      run.stages.some((stage) => stage.stage === "compile" && stage.outcome === "failed"),
    ).toBe(false);
    expect(run.exitCode).toBe(0);
  });

  test("a present but empty corpus aborts on its own site (e2e-edition-pipeline.ts:694)", async () => {
    // THE SECOND corpus-empty SITE, and it was invisible until the scanner stopped misreading it.
    // :295 refuses a MISSING content directory; :305 refuses one that is PRESENT and holds no
    // records. The two share the code, so the scanner counted corpus-empty as 1 untested of 1 and
    // the test above looked like full coverage of it. 26b0d70e corrected the attribution - :305
    // had been reported as `compile-errors`, a neighbour's code from four lines below - and the
    // census went to 1 untested of 2. This pays that site rather than recording it.
    const emptyCorpusRoot = mkdtempSync(join(tmpdir(), "am-edition-empty-corpus-"));
    mkdirSync(join(emptyCorpusRoot, "content"), { recursive: true });

    const run = await runEditionPipeline({ slug: "brownian-motion", root: emptyCorpusRoot });

    const compileStages = run.stages.filter((stage) => stage.stage === "compile");
    expect(compileStages).toHaveLength(1);
    expect(compileStages[0]?.outcome).toBe("not-available");
    expect(compileStages[0]?.code).toBe("content-corpus-absent");

    // THE MESSAGE IS WHAT NAMES THE SITE. Both sites push content-corpus-absent and both abort
    // with the same code, so neither the code nor the outcome can tell them apart, and a citation
    // resting on those alone would pass just as well against :295. The wording differs - :295
    // says "No content directory at", :305 says "No content records found under" - and that is
    // the only observable that distinguishes which of the two ran.
    expect(compileStages[0]?.message).toContain("No content records found under");
    expect(compileStages[0]?.message).not.toContain("No content directory at");

    // The abort's own code, which the catch records rather than discards.
    expect(compileStages[0]?.evidence ?? []).toContain("aborted-by: corpus-empty");

    // And what the refusal itself owns: the push above runs BEFORE the throw and stands without
    // it, so the assertions so far do not test the abort. Deleting the throw here lets execution
    // reach compileReadingContent with zero files, which compiles trivially and reports a PASS -
    // the site's own comment calls that out as the defect it exists to prevent. So the proof that
    // the refusal ran is that no compile stage passed and the run did not claim success.
    expect(
      run.stages.some((stage) => stage.stage === "compile" && stage.outcome === "passed"),
    ).toBe(false);
    expect(run.exitCode).toBe(0);
  });
});

/**
 * WHICH PAPER THE RUN IS ABOUT (2026-10-14).
 *
 * The CLI read only `--paper` and `--slug` and fell back to `"brownian-motion"`. A POSITIONAL
 * argument was ignored in silence, so `bun scripts/e2e-edition-pipeline.ts mass-energy` ran all
 * nine stages against brownian-motion. Measured before the change: three different slugs passed
 * positionally all produced `result slug: brownian-motion`, with `reconcile` failing on brownian's
 * own block ids while the operator believed they had asked about a paper with no sections at all.
 * With the flag the papers differ -- special-relativity also fails `align` and `contract` -- so
 * three of the four papers had never been examined by a positional run.
 *
 * These drive the parser on values. The population matters more than the parse: a tool that
 * reports on the wrong paper is the exact failure AGENTS.md opens with.
 */
describe("the pipeline knows which paper it was asked about", () => {
  const argv = (...rest: string[]) => ["bun", "scripts/e2e-edition-pipeline.ts", ...rest];

  test("a positional slug is accepted, which it was not before", () => {
    const r = resolveSlugArgument(argv("mass-energy"));
    expect(r.ok).toBe(true);
    expect(r.ok && r.slug).toBe("mass-energy");
  });

  test("both flag spellings still work, and take precedence over nothing else", () => {
    expect(resolveSlugArgument(argv("--paper", "light-quanta"))).toEqual({
      ok: true,
      slug: "light-quanta",
    });
    expect(resolveSlugArgument(argv("--slug", "special-relativity"))).toEqual({
      ok: true,
      slug: "special-relativity",
    });
  });

  test("a bare invocation REFUSES rather than choosing a paper for you", () => {
    const r = resolveSlugArgument(argv());
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toContain("Name the paper");
    // The reason is part of the refusal: a silent default is what made this invisible.
    expect(r.ok === false && r.error).toContain("reads exactly like a run of the paper you asked");
  });

  test("two different papers in one invocation refuse, naming both", () => {
    const r = resolveSlugArgument(argv("--paper", "mass-energy", "light-quanta"));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toContain("mass-energy");
    expect(r.ok === false && r.error).toContain("light-quanta");
  });

  test("the same paper named twice is not a conflict", () => {
    expect(resolveSlugArgument(argv("--paper", "mass-energy", "mass-energy"))).toEqual({
      ok: true,
      slug: "mass-energy",
    });
  });

  test("an unknown slug refuses and lists the real ones", () => {
    const r = resolveSlugArgument(argv("not-a-paper"));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toContain("light-quanta");
  });

  test("other flags and their values are not mistaken for the paper", () => {
    expect(
      resolveSlugArgument(
        argv(
          "--require-stage",
          "contract",
          "--layers",
          "german",
          "--require-reviewed",
          "mass-energy",
        ),
      ),
    ).toEqual({ ok: true, slug: "mass-energy" });
  });
});

/**
 * THE CONTRACT-OWNED STAGES RELAY A CHECK, AND THE RELAY HAD NO PLANT.
 *
 * `ids` and `digests` do not judge anything themselves: they push the outcome, message and code of
 * contract checks 6 and 1. Both checks are planted in src/testing/editions/editionContract.test.ts,
 * which proves the CHECKS can fail; nothing proved the PIPELINE reports it. A relay that swallowed a
 * failure, or that transposed the two check numbers, would have been invisible -- and the two stages
 * were the only ones of the nine that this file never named.
 *
 * Check 6 reads the frozen snapshot from the root, so the failure is seeded in DATA rather than
 * through an option. That matters here: the contract's own plant for check 6 passes
 * `idSnapshotClean: false`, a flag no production caller sets, and the check's docblock records that
 * it once decided on that flag alone and so reported every paper clean "without opening
 * manifest.ids.snapshot.txt". A plant through the same flag would not have caught that, and would
 * not catch a relay either.
 */
describe("PLANT: the contract-owned stages relay the check they name", () => {
  test("a broken id snapshot fails the ids stage, and changes no other stage's verdict", async () => {
    const root = ledgerPresentRoot();
    const before = await runEditionPipeline({ slug: "brownian-motion", root });
    // The green baseline this is planted against: without it a red `ids` proves nothing.
    expect(stageOf(before, "ids")?.outcome).toBe("passed");

    /*
     * A frozen id the live manifest no longer carries and no alias resolves, which is what
     * `validateFrozenIds` fails on. Appended rather than removed, so the manifest and the alias
     * records are untouched and the only changed input is the snapshot.
     */
    const snapshot = join(root, "content/source-blocks/brownian-motion/manifest.ids.snapshot.txt");
    const seeded = `${readFileSync(snapshot, "utf8").trimEnd()}\ns99-p99\n`;
    writeFileSync(snapshot, seeded, "utf8");
    // Print what landed before reading the verdict: a plant that did not take is a green that
    // means nothing.
    expect(seeded).toContain("s99-p99");

    const after = await runEditionPipeline({ slug: "brownian-motion", root });
    const ids = stageOf(after, "ids");
    expect(ids?.outcome).toBe("failed");
    expect(ids?.code).toBe("id-snapshot-uncovered");

    /*
     * "Fails EXACTLY the seeded stage", in the bead's words. Compared as a whole map rather than
     * stage by stage, so a stage that changed and was not listed still shows up.
     */
    const outcomes = (run: Awaited<ReturnType<typeof runEditionPipeline>>) =>
      Object.fromEntries(
        run.stages.filter((s) => s.stage !== "ids").map((s) => [s.stage, s.outcome]),
      );
    expect(outcomes(after)).toEqual(outcomes(before));
  });
});

/**
 * THE NINE-STAGE MATRIX, which `--require-stage` had one case of.
 *
 * am-edn-alignment-tooling-do1 G specifies nine stages and a `--require-stage` that turns a
 * `not-available` into a failure. One case was covered -- `ledger` on a paper with no ledger --
 * and the other eight were never exercised, so the flag's behaviour was known for one ninth of
 * its domain.
 *
 * The specimen is molecular-dimensions because its nine outcomes are a SPREAD rather than a
 * uniform result: measured 2026-10-19, compile and coverage pass and the other seven are
 * not-available. A specimen where every stage agreed could not tell a flag that reads the named
 * stage from one that reads the run's overall verdict.
 */
describe("--require-stage over all nine stages", () => {
  test("each stage is required independently, and the verdict follows THAT stage", async () => {
    const baseline = await runEditionPipeline({ slug: "molecular-dimensions" });
    // The spread this test depends on, asserted rather than assumed: if the specimen ever becomes
    // uniform the matrix below stops distinguishing anything and this says so first.
    const passed = baseline.stages.filter((s) => s.outcome === "passed").map((s) => s.stage);
    const notPassed = baseline.stages.filter((s) => s.outcome !== "passed").map((s) => s.stage);
    expect(baseline.stages).toHaveLength(9);
    expect(passed.length).toBeGreaterThan(0);
    expect(notPassed.length).toBeGreaterThan(0);

    const disagreements: string[] = [];
    for (const stage of PIPELINE_STAGES) {
      const run = await runEditionPipeline({ slug: "molecular-dimensions", requireStage: stage });
      const outcome = run.stages.find((s) => s.stage === stage)?.outcome;
      const expected = outcome === "passed" ? 0 : 1;
      if (run.exitCode !== expected) {
        disagreements.push(
          `--require-stage ${stage}: outcome ${outcome}, expected exit ${expected}, got ${run.exitCode}`,
        );
      }
      // A required stage never silently changes what the pipeline reports about the others.
      expect(run.stages, `${stage}: stage list changed`).toHaveLength(9);
    }
    expect(disagreements).toEqual([]);
  });

  test("the baseline exit code is NOT what --require-stage returns, which is the point", () => {
    // A `not-available` stage does not fail the run on its own: the bead says --require-stage is
    // what turns one into a failure, and a flag that merely echoed the overall verdict would
    // exit 0 for every stage here.
    return runEditionPipeline({ slug: "molecular-dimensions" }).then(async (baseline) => {
      expect(baseline.exitCode).toBe(0);
      const required = await runEditionPipeline({
        slug: "molecular-dimensions",
        requireStage: "ledger",
      });
      expect(required.exitCode).toBe(1);
    });
  });
});

/**
 * AN UNKNOWN STAGE NAME IS A REFUSAL, NOT A FAILED STAGE.
 *
 * `--require-stage` was read as `requireRaw as PipelineStage` and never checked. Measured before
 * the repair: `--require-stage ledgre` on molecular-dimensions exited 1 with nine stages
 * recorded, no stage by that name, and nothing in the result saying the name was wrong -- the
 * same exit code and the same fields as a genuinely failed required stage.
 *
 * The dangerous direction is the definition-of-done audits, which run
 * `--require-stage static-html`. Spelled `static_html` that goes red for ever and reads as a
 * content problem, and the obvious repair -- dropping the flag -- turns the gate green over
 * nothing.
 */
describe("--require-stage refuses a name that is not a stage", () => {
  test("the resolver takes all nine and refuses anything else", () => {
    for (const stage of PIPELINE_STAGES) {
      const parsed = resolveRequireStageArgument(stage);
      expect(parsed.ok, `${stage} should resolve`).toBe(true);
      if (parsed.ok) expect(parsed.stage).toBe(stage);
    }
    // Absent is not invalid: no flag means no requirement.
    const absent = resolveRequireStageArgument(undefined);
    expect(absent.ok).toBe(true);
    if (absent.ok) expect(absent.stage).toBeUndefined();

    for (const bad of ["ledgre", "static_html", "statichtml", "", "LEDGER", "all"]) {
      const parsed = resolveRequireStageArgument(bad);
      expect(parsed.ok, `${JSON.stringify(bad)} should be refused`).toBe(false);
      if (!parsed.ok) {
        // The refusal names the nine, because a reader who misspelled one needs the list.
        expect(parsed.error).toContain("static-html");
        expect(parsed.error).toContain("ledger");
      }
    }
  });

  test("the pipeline itself refuses, so a programmatic caller cannot bypass the CLI check", async () => {
    const run = await runEditionPipeline({
      slug: "molecular-dimensions",
      requireStage: "ledgre" as PipelineStage,
    });
    expect(run.exitCode).toBe(2);
    expect(run.refusal?.code).toBe("unknown-require-stage");
    expect(run.refusal?.message).toContain("ledgre");
    // Nothing ran: a refusal is not a run with findings, and 0 stages is what says so.
    expect(run.stages).toEqual([]);
  });

  test("exit 2 separates a refusal from exit 1, which is a judged failure", async () => {
    // The distinction the repair exists for, asserted as a pair rather than described.
    const refused = await runEditionPipeline({
      slug: "molecular-dimensions",
      requireStage: "ledgre" as PipelineStage,
    });
    const failed = await runEditionPipeline({
      slug: "molecular-dimensions",
      requireStage: "ledger",
    });
    expect(refused.exitCode).toBe(2);
    expect(failed.exitCode).toBe(1);
    expect(refused.refusal).toBeDefined();
    expect(failed.refusal).toBeUndefined();
    expect(failed.stages).toHaveLength(9);
  });
});
