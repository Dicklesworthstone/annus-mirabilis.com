/**
 * Reconciliation between proposed ledger blocks and the frozen manifest,
 * alias confirmation with attribution guards, and block writer guards.
 *
 * Specification: am-edn-alignment-tooling-do1 and am-cm-id-scheme-8bn.
 * Rules:
 *   - Writes alias records only through --confirm with editor and reason.
 *   - Never overwrites without --update.
 *   - A frozen id is never renumbered, and a retired id is never reused.
 *   - --write-blocks refuses while differences remain unresolved.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import yaml from "js-yaml";
import { type AliasKind, type AliasRecord, validateAliasRecord } from "../aliases.ts";
import type { ProposedBlock, ReconciliationDifference } from "./segmentLedger.ts";
import { unifiedDiff } from "./unifiedDiff.ts";

/** A reference occurrence, as a bare id or as the manifest schema's own record. */
export type ManifestUnitReferenceLike =
  | string
  | Readonly<{ id?: string | undefined; occurrenceId?: string | undefined }>;

export type ManifestUnit = Readonly<{
  id: string;
  kind?: string | undefined;
  text?: string | undefined;
  references?: readonly ManifestUnitReferenceLike[] | undefined;
}>;

/** The id of a reference occurrence in either shape, or undefined when it names none. */
export function referenceIdOf(reference: ManifestUnitReferenceLike): string | undefined {
  if (typeof reference === "string") return reference.length > 0 ? reference : undefined;
  const id = reference.id ?? reference.occurrenceId;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

/**
 * THE FROZEN NAME OF A PROPOSAL ID, FOLLOWING ITS STRUCTURE.
 *
 * `anchorOf` pairs BLOCKS and displays, because that is what `manifestAnchors` computes: a
 * paragraph the segmenter met fourth is published under the number the frozen manifest kept for
 * it. A sentence and an inline-math region are named FROM their block, so their frozen names
 * follow from the block's -- `s1-p4-s2` under `s1-p4 -> s1-p3` is `s1-p3-s2` -- and nothing
 * computed that. Reading the whole id in the map found nothing and kept the proposal's name, so
 * every sentence beneath a renamed block was reported as missing from the ledger.
 *
 * Measured 2026-10-20 over the three papers whose face pairs: 88 sentence units reported missing,
 * of which 34 resolve under this rule. The 55 that remain are real segmentation disagreements and
 * are what this stage exists to surface.
 *
 * The map still wins where it speaks: an explicit entry for a sentence or an inline id overrides
 * the structural rule, so a future pairing that enumerates them is not fought by this.
 */
export function frozenIdUnder(id: string, anchorOf: Readonly<Record<string, string>>): string {
  const direct = anchorOf[id];
  if (direct !== undefined) return direct;
  // `<sentence>-m<i>`: pair the sentence, keep the region index.
  const inline = /^(.*)(-m\d+)$/.exec(id);
  if (inline?.[1] !== undefined && inline[2] !== undefined) {
    const sentence = frozenIdUnder(inline[1], anchorOf);
    return `${sentence}${inline[2]}`;
  }
  // `<block>-s<k>` or `<block>-s<k><letter>`: pair the block, keep the sentence suffix. The prefix
  // must end in a paragraph or footnote part, so a bare section id such as `s3` is left alone.
  const sentence = /^(.*-(?:p\d+|fn\d+))(-s\d+[a-z]?)$/.exec(id);
  if (sentence?.[1] !== undefined && sentence[2] !== undefined) {
    const block = anchorOf[sentence[1]];
    if (block !== undefined) return `${block}${sentence[2]}`;
  }
  return id;
}

export type ReconcileInput = Readonly<{
  blocks: readonly ProposedBlock[];
  manifestUnits?: readonly (string | ManifestUnit)[] | undefined;
  frozenIds?: readonly string[] | undefined;
  /**
   * THE PROPOSAL AND THE MANIFEST ARE TWO NAMESPACES, and without this map they were compared by id
   * equality, so every unit differed in spelling alone.
   *
   * `manifestAnchors.ts` says it plainly: the segmenter names blocks as it meets them, paragraphs
   * `s0-p1`, `s0-p2` by count and displays `s0-eq1` by count, and "those are good ids for the
   * pipeline and wrong ones to publish", while the frozen manifest never renumbers. So the proposal
   * calls a thing `s0-eq1` that the manifest froze as `eq-s0-d1`, and calls `s0-p9` what the manifest
   * froze as `s0-p11`. Compared directly, each such unit is reported TWICE -- extra in the ledger and
   * missing from it -- for no reason but its name.
   *
   * Measured on mass-energy 2026-10-05: 29 unresolved differences, 14 of them exactly its seven
   * displays double-counted, the other 15 the same thing one level up over its paragraphs.
   *
   * `anchorOf` maps a proposal id to the frozen id it is published under. It is produced by
   * `manifestAnchors`, which pairs paragraphs and footnotes in PRINT order -- the manifest's numbers
   * are not in print order, so pairing by number would be wrong -- and displays by the rule
   * `blockPages.pairDisplays` already uses. Passing it here reuses that one rule instead of adding a
   * third. Omitted, every comparison below is by id as before, so a caller that has no manifest face
   * to pair against is unchanged.
   */
  anchorOf?: Readonly<Record<string, string>> | undefined;
}>;

/**
 * Reconcile proposed ledger blocks against frozen manifest units.
 * Identifies boundary differences, extra units in ledger, and units missing in ledger.
 */
export function reconcileManifest(input: ReconcileInput): readonly ReconciliationDifference[] {
  const differences: ReconciliationDifference[] = [];
  const rawUnits = input.manifestUnits ?? input.frozenIds ?? [];
  const manifestUnits: ManifestUnit[] = rawUnits.map((u) =>
    typeof u === "string" ? { id: u } : u,
  );

  if (manifestUnits.length === 0) {
    return Object.freeze(differences);
  }

  const manifestSet = new Set(manifestUnits.map((u) => u.id));
  // A proposal id reads as the frozen id it is published under, where the pairing says so. An id the
  // map does not mention keeps its own name, so an unpaired unit is still reported.
  const anchorOf = input.anchorOf ?? {};
  const frozen = (id: string): string => frozenIdUnder(id, anchorOf);
  const proposedBlockIds = new Set(input.blocks.map((b) => frozen(b.id)));
  const proposedSentenceIds = new Set<string>();
  // THE PROPOSAL ALREADY CARRIES ITS INLINE-MATH IDS AND THIS FUNCTION DID NOT READ THEM.
  // `ProposedSentence.inlineMathIds` is populated by the segmenter -- measured 2026-10-20: 42, 134
  // and 124 ids on mass-energy, brownian-motion and light quanta, on 15, 54 and 54 sentences. Every
  // `inline-equation` unit of the manifest was therefore reported as having no proposed ledger unit:
  // 24, 59 and 71 of them, 154 in all, of which only 40 are genuinely absent once the field is read
  // and the pairing below is applied. The other 114 were an artifact of not looking.
  const proposedInlineMathIds = new Set<string>();
  for (const b of input.blocks) {
    for (const s of b.sentences) {
      proposedSentenceIds.add(frozen(s.id));
      for (const inlineId of s.inlineMathIds ?? []) {
        proposedInlineMathIds.add(frozen(inlineId));
      }
    }
  }

  // 1. Extra blocks in ledger (proposed block not in manifest, and none of its sentences are in manifest)
  for (const block of input.blocks) {
    const hasBlock = manifestSet.has(frozen(block.id));
    const hasSentence = block.sentences.some((s) => manifestSet.has(frozen(s.id)));
    if (!hasBlock && !hasSentence) {
      // THE MESSAGE SAYS WHICH NAME WAS LOOKED UP when the pairing renamed the block, because
      // "s1-p5 is not in the frozen manifest" sends a reader to look for s1-p5 in a file that
      // never had it, and the thing to check is the pairing. Ported from the copy of this rule
      // that used to live in segmentLedger.ts, which had the better wording and less of the rule.
      const under = frozen(block.id);
      differences.push({
        differenceId: `unit-extra-in-ledger:${block.id}`,
        kind: "unit-extra-in-ledger",
        unitId: block.id,
        message:
          under === block.id
            ? `Proposed block "${block.id}" is not in the frozen manifest.`
            : `Proposed block "${block.id}" is published as "${under}", which is not in the frozen manifest.`,
      });
    }
  }

  // 2. Missing units (frozen manifest id has no proposed block, sentence or inline-math region)
  for (const mUnit of manifestUnits) {
    const id = mUnit.id;
    const found =
      proposedBlockIds.has(id) || proposedSentenceIds.has(id) || proposedInlineMathIds.has(id);
    if (!found) {
      // Check if this is part of a boundary split/merge
      const isBoundary =
        mUnit.text?.includes("vgl.") ||
        mUnit.id.includes("vgl") ||
        manifestUnits.some(
          (other) =>
            other.id !== id &&
            mUnit.text &&
            other.text &&
            input.blocks.some((b) =>
              b.sentences.some((s) => s.text.includes(mUnit.text!) && s.text.includes(other.text!)),
            ),
        );

      if (isBoundary) {
        differences.push({
          differenceId: `boundary-differs:${id}`,
          kind: "boundary-differs",
          unitId: id,
          message: `Sentence boundary differs for "${id}". Proposed sentences merge or split manifest units.`,
          proposedRepair: {
            kind: "merged",
            retiredId: id,
            replacementIds: [id.replace(/-s\d+$/, "-s1")],
          },
        });
      } else {
        differences.push({
          differenceId: `unit-missing-in-ledger:${id}`,
          kind: "unit-missing-in-ledger",
          unitId: id,
          message: `Frozen id "${id}" has no proposed ledger unit.`,
        });
      }
    }
  }

  // 3. Manifest references without authored inline in ledger (Scope B.2)
  //
  // A REFERENCE IS AN OBJECT IN THE REAL MANIFEST AND THIS READ IT AS A STRING. The schema's
  // `ManifestUnitReference` carries `{id, occurrenceId, printedText, kind, target}`, so `${refId}`
  // on the element produced the five characters of "[object Object]" as both the id and the
  // message's quoted name. Measured 2026-10-20: 3, 7, 26 and 18 units across the four papers carry
  // a non-empty references array, so this would have fired 54 times with an unusable id in each.
  //
  // It did not fire at all, which is the other half of the same defect and the reason nobody saw
  // the first: the pipeline passes `frozenIds`, a list of strings, so every unit here was
  // `{ id }` with no `references` and no `text`. `referenceIdOf` below accepts either shape.
  //
  // AND IT HAS NO MEMBERSHIP TEST, which is the defect that outlives the one above. As written it
  // pushed a difference for EVERY reference occurrence unconditionally: there is no comparison
  // against the proposal, so nothing a ledger could contain would ever clear one. A check that
  // cannot pass is not a check, and wiring it as it stood would have added 54 permanent
  // differences the moment a caller passed real units.
  //
  // THE PROPOSAL HAS NO CHANNEL FOR A REFERENCE INLINE. `ProposedSentence` carries `id`, `text`
  // and `inlineMathIds`, and nothing else; the segmenter emits no reference occurrences, so the
  // comparison this check wants cannot be made from what it is given. The repository's own rule
  // for that case is in the check registry: "Absent means a check that needs them must DECLINE
  // and say so, never condemn every id as missing (am-as1w)."
  //
  // So it declines, once, naming the population it did not judge, rather than reporting each of
  // them as missing. When the segmenter gains a reference channel this becomes a real comparison
  // and the decline goes with it.
  const referenceOccurrences = manifestUnits.flatMap((unit) =>
    (unit.references ?? []).map(referenceIdOf).filter((id): id is string => id !== undefined),
  );
  if (referenceOccurrences.length > 0) {
    differences.push({
      differenceId: "reference-inlines-not-comparable",
      kind: "reference-inlines-not-comparable",
      unitId: referenceOccurrences[0] ?? "",
      message:
        `${referenceOccurrences.length} manifest reference occurrence(s) were not judged: a ` +
        "proposed sentence carries no reference inlines, only inline math ids, so there is " +
        "nothing to compare them against. Declining rather than reporting each as missing. " +
        // NAMED, not merely counted: the bead's test plan asks that "a manifest references[]
        // entry with no authored inline is reported", and every entry is named here. What
        // changed is the SHAPE -- one decline carrying all of them rather than one
        // unit-missing-in-ledger each -- because the proposal cannot carry a reference inline at
        // all, so per-entry findings would be 54 permanent differences against a stage section G
        // requires to reach zero.
        `Occurrences: ${referenceOccurrences.join(", ")}.`,
    });
  }

  return Object.freeze(differences);
}

export type ConfirmAliasOptions = Readonly<{
  slug: string;
  differenceId?: string | undefined;
  repair: Readonly<{
    kind: AliasKind;
    retiredId: string;
    replacementIds: readonly string[];
  }>;
  editor?: string | undefined;
  reason?: string | undefined;
  confirm?: boolean | undefined;
  update?: boolean | undefined;
  date?: string | undefined;
  root?: string | undefined;
  aliasFilePath?: string | undefined;
}>;

export type ConfirmAliasResult =
  | Readonly<{
      ok: true;
      record: AliasRecord;
      action: "created" | "updated";
      message: string;
      filePath: string;
    }>
  | Readonly<{
      ok: false;
      code:
        | "confirm-required"
        | "missing-editor"
        | "missing-reason"
        | "update-required"
        | "retired-id-reused"
        | "invalid-alias-record";
      message: string;
      proposedRecord?: AliasRecord | undefined;
    }>;

/**
 * Confirm and write an alias record to content/aliases/<slug>.yaml.
 * Refuses without explicit --confirm, --editor, and --reason.
 * Refuses overwrite without explicit --update.
 * Refuses reuse of any retired ID.
 */
export function confirmAlias(options: ConfirmAliasOptions): ConfirmAliasResult {
  const retiredId = options.repair.retiredId.trim();
  const kind = options.repair.kind;
  const replacementIds = options.repair.replacementIds.map((r) => r.trim());
  const date = options.date ?? new Date().toISOString().slice(0, 10);
  const editor = options.editor?.trim() ?? "";
  const reason = options.reason?.trim() ?? "";

  // 1. Guard: Write without --confirm
  if (!options.confirm) {
    const proposed: AliasRecord = {
      retiredId,
      kind,
      replacementIds,
      reason: reason || "(no reason provided)",
      date,
      editor: editor || "(no editor provided)",
    };
    return {
      ok: false,
      code: "confirm-required",
      message: `Writing alias record for "${retiredId}" (${kind} → [${replacementIds.join(", ")}]) requires explicit --confirm flag with --editor and --reason. Unconfirmed write refused.`,
      proposedRecord: proposed,
    };
  }

  // 2. Guard: Attribution guards
  if (!editor) {
    return {
      ok: false,
      code: "missing-editor",
      message: `Confirmation refused: an alias record is an editorial decision and requires an explicit --editor naming who made it.`,
    };
  }

  if (!reason) {
    return {
      ok: false,
      code: "missing-reason",
      message: `Confirmation refused: an alias record is an editorial decision and requires an explicit --reason explaining why.`,
    };
  }

  // 3. Validate structural schema
  const recordCandidate: AliasRecord = {
    retiredId,
    kind,
    replacementIds,
    reason,
    date,
    editor,
  };
  const val = validateAliasRecord(recordCandidate);
  if (!val.ok) {
    return {
      ok: false,
      code: "invalid-alias-record",
      message: `Invalid alias record: ${val.error}`,
    };
  }

  // 4. Determine file location
  const root = options.root ?? process.cwd();
  const filePath =
    options.aliasFilePath ?? join(root, "content", "aliases", `${options.slug}.yaml`);

  // 5. Read existing aliases
  let existingAliases: AliasRecord[] = [];
  if (existsSync(filePath)) {
    try {
      const raw = yaml.load(readFileSync(filePath, "utf8")) as Record<string, unknown> | null;
      if (raw && Array.isArray(raw.aliases)) {
        existingAliases = (raw.aliases as unknown[])
          .map((a) => {
            const v = validateAliasRecord(a);
            return v.ok ? v.value : null;
          })
          .filter((a): a is AliasRecord => a !== null);
      }
    } catch {
      existingAliases = [];
    }
  }

  // 6. Guard: Check retired ID reuse in replacementIds
  for (const rep of replacementIds) {
    if (existingAliases.some((a) => a.retiredId === rep)) {
      return {
        ok: false,
        code: "retired-id-reused",
        message: `Cannot replace with retired id "${rep}": reusing a retired id is forbidden.`,
      };
    }
  }

  // 7. Check if retiredId already has an alias record
  const existingIndex = existingAliases.findIndex((a) => a.retiredId === retiredId);
  let action: "created" | "updated" = "created";

  if (existingIndex >= 0) {
    if (!options.update) {
      return {
        ok: false,
        code: "update-required",
        message: `Alias for "${retiredId}" already exists in ${options.slug}.yaml. Overwrite refused without explicit --update flag.`,
      };
    }
    existingAliases[existingIndex] = val.value;
    action = "updated";
  } else {
    existingAliases.push(val.value);
  }

  // 8. Write file deterministically
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const payload = {
    paper: options.slug,
    aliases: existingAliases,
  };
  const outYaml = yaml.dump(payload, { indent: 2, lineWidth: -1, sortKeys: false });
  writeFileSync(filePath, outYaml, "utf8");

  return {
    ok: true,
    record: val.value,
    action,
    message: `Alias record ${action} for "${retiredId}" in ${filePath}.`,
    filePath,
  };
}

export type WriteBlocksOptions = Readonly<{
  slug: string;
  blocks: readonly ProposedBlock[];
  differences: readonly ReconciliationDifference[];
  writeBlocks?: boolean | undefined;
  update?: boolean | undefined;
  root?: string | undefined;
  destinationDir?: string | undefined;
  /**
   * Where the unified diff of each replaced file is recorded, which scope B.6 requires `--update` to
   * write "to the run directory first". The caller names it, because the run directory is the
   * script's policy (`artifacts/segmentation/<slug>/<tool-run-id>/`) and a library that invented one
   * would write into the repository from a test.
   *
   * Required only when this call would actually replace a file. A first write creates files and
   * destroys nothing, so it needs no record.
   */
  runDir?: string | undefined;
}>;

export type WriteBlocksResult =
  | Readonly<{
      ok: true;
      writtenFiles: readonly string[];
      /** The diff written for each replaced file whose bytes changed, in `writtenFiles` order. */
      diffFiles: readonly string[];
      /**
       * Files that already held exactly these bytes. They have no diff because there was nothing to
       * record, which is reported rather than left as an empty `diffFiles` a reader cannot
       * distinguish from a diff step that never ran.
       */
      unchangedFiles: readonly string[];
      message: string;
    }>
  | Readonly<{
      ok: false;
      code:
        | "no-write-flag"
        | "write-blocks-refused-differences"
        | "update-required"
        | "diff-destination-required";
      message: string;
      existingFiles?: readonly string[] | undefined;
    }>;

/**
 * Write proposed blocks to content/source-blocks/<slug>/blocks/.
 * Refuses if differences are unresolved.
 * Refuses overwrite without --update. Never deletes files.
 *
 * AN OVERWRITE LEAVES A RECORD OR IT DOES NOT HAPPEN. Scope B.6 asks `--update` to write "a unified
 * diff to the run directory first", and until 2026-10-19 nothing here wrote one: the word "diff"
 * appeared nowhere in this file, and the test that covered the criterion asserted only that the
 * second write succeeded and that its files still existed. So the one guard standing between a
 * reviewed block file and its replacement produced no evidence of what it replaced.
 *
 * The diffs are written BEFORE any block file is touched, and the previous bytes are all read
 * first, so a failure while recording cannot leave a file replaced with no record of its contents.
 * Hence also `diff-destination-required`: an overwrite with nowhere to put the record is refused
 * rather than performed silently. A first write, which creates files and destroys nothing, needs no
 * run directory.
 */
export function writeProposedBlocks(options: WriteBlocksOptions): WriteBlocksResult {
  if (!options.writeBlocks) {
    return {
      ok: false,
      code: "no-write-flag",
      message: "Writing blocks requires explicit --write-blocks flag.",
    };
  }

  if (options.differences.length > 0) {
    return {
      ok: false,
      code: "write-blocks-refused-differences",
      message: `--write-blocks refused while ${options.differences.length} differences remain unresolved.`,
    };
  }

  const root = options.root ?? process.cwd();
  const destDir =
    options.destinationDir ?? join(root, "content", "source-blocks", options.slug, "blocks");

  // Determine section files
  const sectionMap = new Map<string, ProposedBlock[]>();
  for (const block of options.blocks) {
    let sec = "s0";
    if (block.id.startsWith("masthead")) {
      sec = "masthead";
    } else if (block.id.startsWith("closing")) {
      sec = "closing";
    } else {
      const match = block.id.match(/^(s\d+|part-[12])/);
      if (match?.[1]) sec = match[1];
    }
    let list = sectionMap.get(sec);
    if (!list) {
      list = [];
      sectionMap.set(sec, list);
    }
    list.push(block);
  }

  const filePaths = Array.from(sectionMap.keys()).map((sec) => join(destDir, `${sec}.yaml`));
  const existingFiles = filePaths.filter((p) => existsSync(p));

  if (existingFiles.length > 0 && !options.update) {
    return {
      ok: false,
      code: "update-required",
      message: `Existing block files found (${existingFiles.length}). Overwrite refused without explicit --update flag.`,
      existingFiles: Object.freeze(existingFiles),
    };
  }

  // Serialize everything before anything is written, so the diffs below describe exactly the bytes
  // that will land and a serialization failure replaces no file.
  const planned = Array.from(sectionMap.entries()).map(([sec, blocks]) => ({
    section: sec,
    path: join(destDir, `${sec}.yaml`),
    content: yaml.dump({ section: sec, blocks }, { indent: 2, lineWidth: -1, sortKeys: false }),
  }));

  const replacing = planned.filter((entry) => existsSync(entry.path));
  if (replacing.length > 0 && options.runDir === undefined) {
    return {
      ok: false,
      code: "diff-destination-required",
      message:
        `Replacing ${replacing.length} existing block file(s) requires a run directory for the ` +
        "unified diff of each. Pass runDir; an overwrite that records nothing is refused.",
      existingFiles: Object.freeze(replacing.map((entry) => entry.path)),
    };
  }

  const diffFiles: string[] = [];
  const unchangedFiles: string[] = [];
  const runDir = options.runDir;
  if (replacing.length > 0 && runDir !== undefined) {
    // Read every previous file first: a diff of bytes already replaced would record the wrong thing.
    const records = replacing.map((entry) => ({
      entry,
      previous: readFileSync(entry.path, "utf8"),
    }));
    if (!existsSync(runDir)) mkdirSync(runDir, { recursive: true });
    for (const { entry, previous } of records) {
      const diff = unifiedDiff(previous, entry.content, {
        oldLabel: `a/${entry.section}.yaml`,
        newLabel: `b/${entry.section}.yaml`,
      });
      if (diff === "") {
        unchangedFiles.push(entry.path);
        continue;
      }
      const diffPath = join(runDir, `${entry.section}.yaml.diff`);
      writeFileSync(diffPath, diff, "utf8");
      diffFiles.push(diffPath);
    }
  }

  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  const writtenFiles: string[] = [];
  for (const entry of planned) {
    writeFileSync(entry.path, entry.content, "utf8");
    writtenFiles.push(entry.path);
  }

  const recorded =
    diffFiles.length === 0
      ? ""
      : ` Recorded ${diffFiles.length} unified diff(s) in ${runDir ?? "(none)"} before replacing.`;
  return {
    ok: true,
    writtenFiles: Object.freeze(writtenFiles),
    diffFiles: Object.freeze(diffFiles),
    unchangedFiles: Object.freeze(unchangedFiles),
    message: `Wrote ${writtenFiles.length} block files to ${destDir}.${recorded}`,
  };
}
