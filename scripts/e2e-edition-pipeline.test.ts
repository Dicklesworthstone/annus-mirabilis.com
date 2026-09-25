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
import {
  inspectLedgerPresence,
  PAPERS_WAITING_ON_CLOUD_OCR,
} from "../src/content/editions/ledgerPresence.ts";
import { PIPELINE_STAGES, runEditionPipeline } from "./e2e-edition-pipeline.ts";

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
    expect(reconcile?.outcome).toBe("failed");
    expect(reconcile?.code).toBe("reconciliation-differences");
    expect(reconcile?.message).toMatch(/\d+ unresolved difference\(s\)/);
    expect(reconcile?.message).not.toBe("Segmentation ran.");
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

  test("the align stage reports the issues it found, not that alignment ran", async () => {
    const root = ledgerPresentRoot();
    const run = await runEditionPipeline({ slug: "brownian-motion", root });
    const align = stageOf(run, "align");
    expect(align?.outcome).toBe("failed");
    expect(align?.message).toMatch(/issue\(s\)/);
    expect(align?.message).not.toBe("Alignment ran.");
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

  test("the static-html stage scans emitted HTML and fails on ledger furniture in it", async () => {
    const root = ledgerPresentRoot();
    const page = join(root, "out/papers/brownian-motion/index.html");
    mkdirSync(dirname(page), { recursive: true });

    writeFileSync(
      page,
      '<html lang="de"><body><p>Die Bewegung ist unregelmäßig.</p></body></html>',
      "utf8",
    );
    const green = stageOf(
      await runEditionPipeline({ slug: "brownian-motion", root }),
      "static-html",
    );
    expect(green?.outcome).toBe("passed");
    // The pass says what it scanned and does not claim the build is current.
    expect(green?.message).toContain("index.html");
    expect(green?.pending?.join(" ")).toContain("stale");

    writeFileSync(
      page,
      '<html lang="de"><body><p>--- REVIEWED TRANSCRIPTION PAGE 1 OF 2 --- Die Bewegung</p></body></html>',
      "utf8",
    );
    const red = stageOf(await runEditionPipeline({ slug: "brownian-motion", root }), "static-html");
    expect(red?.outcome).toBe("failed");
    expect(red?.code).toBe("static-html-furniture");
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
 * WHAT THE EARLIER REMOVAL WAS FOR, kept because the reasoning still governs. It cited
 * e2e-edition-pipeline.ts:295, and the stale-citation ratchet refused it as code-mismatched. The
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
  test("the abort records its own code and spares the compiler (e2e-edition-pipeline.ts:295)", async () => {
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

  test("a present but empty corpus aborts on its own site (e2e-edition-pipeline.ts:305)", async () => {
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
