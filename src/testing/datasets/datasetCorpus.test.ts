/**
 * THE SHIPPED DATASET RECORDS, READ AS A POPULATION (am-inst-dataset-overlay-ra9r).
 *
 * Every other test in this directory builds its dataset from an inline fixture string. That is
 * the right instrument for a validator's refusals, because a fixture can be made wrong on
 * purpose and a real record cannot. The cost is that NOTHING in the suite reads
 * `content/datasets/`: the two shipped records are loaded only by tests named after them
 * (`src/content/datasets/loader.test.ts` names `fixture-dataset.yaml`,
 * `src/testing/millikan1916.dataset.test.ts` names `millikan-1916-sodium.yaml`). A third record
 * therefore lands covered by nothing unless its author also writes a bespoke test, and the nine
 * dataset beads queued behind this machinery are about to add records.
 *
 * So this walks the directory instead of naming files, and a record added tomorrow is in the
 * population the moment it exists.
 *
 * WHAT IT ASSERTS IS DELIBERATELY NARROW, AND THE FIRST DRAFT GOT THAT WRONG. It had four
 * further checks -- that `primaryPublicationId` resolves to one of the record's own
 * publications, that `allowedInferenceModelIds` is declared, that the shelf verdict agrees with
 * the publication date -- and the positive control at the bottom of this file proved all of
 * them unfirable within a minute of being written. `validateHistoricalDataset` already refuses a
 * dangling primary publication with the code `invalid-primary-publication-id`, and already
 * refuses an absent inference list, so such a record never loads and the check it was meant to
 * fail reads an empty list. (The codes are named and the line numbers are not, deliberately: a
 * parenthesised `file.ts:LINE` in prose is read by the stale-citation ratchet as a refusal-site
 * citation, and this comment earned that failure once already.) The shelf comparison was worse: its
 * "expected" value recomputed `latest ?? earliest <= cutoff`, which is the two lines
 * `isPublicationShelfEligible` is made of, so it asserted that the code does what the code does.
 *
 * The lesson is the gate's real shape. ONE population walk through the real loader inherits
 * every rule the validator owns, and is worth more than a list of restatements of those rules:
 * the thing missing was never the rules, it was that nobody ran them over the shipped files.
 * What is left here is that walk, plus the one record-level requirement the schema leaves
 * optional and therefore cannot enforce.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { reportPopulation } from "../../../scripts/gate-census/population.ts";
import { loadHistoricalDataset } from "../../content/datasets/loader.ts";
import type { HistoricalDataset } from "../../content/schemas/experiment.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const DATASET_DIR = join(ROOT, "content", "datasets");

/**
 * Records known to carry no `observationDate`, each with the reason, as a DECLARED DEBT rather
 * than an exemption that hides the rule.
 *
 * Measured 2026-10-18: 2 of the 2 shipped records have no `series:` block at all, so neither
 * states when its measurements were made. The bead requires three separately typed dates per
 * series -- observation, publication, analysis, none standing in for another -- and names this
 * very dataset as the example ("Millikan's sodium results are 'measured 1915-1916'"). The only
 * `observationDate` in the repository is in the inline fixture of `datasetDates.test.ts`, which
 * models Millikan's dates correctly while the shipped record omits them. A fixture that is right
 * about a record the check never reads is exactly how this survived, and it is why the walk
 * above exists.
 *
 * It is declared and not repaired here on purpose: when a measurement was made is an editorial
 * claim about a source document, and authoring one from a bead's summary rather than from
 * Millikan's paper would be the manufactured provenance the dataset rules exist to prevent.
 * Reported to the bead instead.
 *
 * The assertion below is a SUBSET check keyed by record id, not a count: repairing one of these
 * does not turn the gate red, and a record that is not on this list and lacks the field does.
 */
const NO_OBSERVATION_DATE: ReadonlyMap<string, string> = new Map([
  [
    "millikan-1916-sodium",
    "no series block; the bead states the measurements as 1915-1916, which needs authoring from the paper rather than from the bead",
  ],
  [
    "fixture-dataset",
    "the loader's own fixture record, kept as a shape example rather than as a measurement",
  ],
]);

type LoadedRecord = Readonly<{ file: string; dataset: HistoricalDataset }>;

type CorpusAudit = Readonly<{
  files: readonly string[];
  loaded: readonly LoadedRecord[];
  /** Each entry names the file and the validator's own message, never a count. */
  loadFailures: readonly string[];
  missingObservationDate: readonly string[];
}>;

/**
 * A function over a directory rather than a sweep wired to one path, so the control below can
 * point it at a planted root. A gate over a corpus that is currently clean is indistinguishable
 * from a gate that cannot fail, and this corpus is two records long.
 */
function auditCorpus(dir: string): CorpusAudit {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".yaml"))
    .sort();

  const loaded: LoadedRecord[] = [];
  const loadFailures: string[] = [];
  for (const file of files) {
    try {
      loaded.push({ file, dataset: loadHistoricalDataset(join(dir, file)) });
    } catch (err) {
      loadFailures.push(`${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const missingObservationDate: string[] = [];
  for (const { dataset } of loaded) {
    const series = dataset.series ?? [];
    const stated = series.length > 0 && series.every((s) => s.observationDate !== undefined);
    if (!stated) missingObservationDate.push(dataset.id);
  }

  return { files, loaded, loadFailures, missingObservationDate };
}

const audit = auditCorpus(DATASET_DIR);

describe("the shipped dataset corpus (am-inst-dataset-overlay-ra9r)", () => {
  test("every record in content/datasets loads through the real loader and validator", () => {
    /*
     * The floor is 2 because that is the whole corpus today and records are never deleted here
     * (RULE 1), so a walk that reaches fewer has broken rather than found less. It stays 2 as
     * the nine queued datasets land: its job is to refuse an empty sweep, not to track growth.
     */
    const vacuous = reportPopulation({
      gate: "dataset-corpus",
      examined: audit.files.length,
      noun: "shipped dataset records",
      minimum: 2,
    });
    expect(vacuous).toBe(false);
    // Named, not counted, so a failure says which file and what the validator said about it.
    expect(audit.loadFailures).toEqual([]);
    expect(audit.loaded.length).toBe(audit.files.length);
  });

  test("a record carrying no observationDate is one of the declared ones", () => {
    const undeclared = audit.missingObservationDate.filter((id) => !NO_OBSERVATION_DATE.has(id));
    expect(undeclared).toEqual([]);
    /*
     * The debt is printed rather than merely tolerated, because a declared absence nobody reads
     * is an exemption. Measured 2 of 2 on 2026-10-18.
     */
    console.log(
      `[dataset corpus] ${audit.missingObservationDate.length} of ${audit.loaded.length} shipped records state no observationDate: ${audit.missingObservationDate.join(", ") || "none"}`,
    );
    for (const [, reason] of NO_OBSERVATION_DATE) {
      expect(reason.trim().length).toBeGreaterThan(20);
    }
  });

  /**
   * THE POSITIVE CONTROL, which runs every time rather than once when this was written.
   *
   * Both shipped records are clean, so the walk above passes on an empty finding list, which is
   * also what a walk that read nothing returns. The plants are built from the real
   * `fixture-dataset.yaml`, so they go through the same loader, and each must be REPORTED BY
   * FILE NAME rather than merely counted. The clean copy must NOT be reported, because an audit
   * that fails everything handed to it is as useless as one that fails nothing.
   */
  test("the audit reports planted bad records by name and leaves a clean copy alone", () => {
    const planted = mkdtempSync(join(tmpdir(), "am-dataset-corpus-plant-"));
    const base = readFileSync(join(DATASET_DIR, "fixture-dataset.yaml"), "utf8");

    expect(base).toContain("primaryPublicationId:");
    const dangling = base.replace(
      /^primaryPublicationId:.*$/m,
      "primaryPublicationId: pub-that-does-not-exist",
    );
    // The replacement must have landed, or a green control would mean nothing.
    expect(dangling).toContain("pub-that-does-not-exist");
    expect(dangling).not.toBe(base);

    writeFileSync(join(planted, "planted-dangling.yaml"), dangling, "utf8");
    writeFileSync(join(planted, "planted-malformed.yaml"), "id: 42\nnot-a-dataset: true\n", "utf8");
    writeFileSync(join(planted, "planted-clean.yaml"), base, "utf8");

    const plantedAudit = auditCorpus(planted);

    expect(plantedAudit.files.length).toBe(3);
    /*
     * Two refusals, and which rule caught which is the point. The dangling publication id is
     * refused by the VALIDATOR, not by anything in this file, which is why this file no longer
     * carries its own check for it. The walk's whole contribution is that the refusal now
     * happens over the shipped records at all.
     */
    expect(plantedAudit.loadFailures.length).toBe(2);
    const joined = plantedAudit.loadFailures.join("\n");
    expect(joined).toContain("planted-dangling.yaml");
    expect(joined).toContain("invalid-primary-publication-id");
    expect(joined).toContain("planted-malformed.yaml");
    expect(joined).toContain("missing-id");
    // The clean copy of the same record loads, so the audit discriminates.
    expect(plantedAudit.loaded.map((r) => r.file)).toEqual(["planted-clean.yaml"]);
    expect(joined).not.toContain("planted-clean.yaml");

    console.log(
      `[dataset corpus control] planted 3 records: ${plantedAudit.loadFailures.length} refused and named, ${plantedAudit.loaded.length} loaded clean`,
    );
  });
});
