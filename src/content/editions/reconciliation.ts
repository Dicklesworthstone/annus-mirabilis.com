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

export type ManifestUnit = Readonly<{
  id: string;
  kind?: string | undefined;
  text?: string | undefined;
  references?: readonly string[] | undefined;
}>;

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
  const frozen = (id: string): string => anchorOf[id] ?? id;
  const proposedBlockIds = new Set(input.blocks.map((b) => frozen(b.id)));
  const proposedSentenceIds = new Set<string>();
  for (const b of input.blocks) {
    for (const s of b.sentences) {
      proposedSentenceIds.add(frozen(s.id));
    }
  }

  // 1. Extra blocks in ledger (proposed block not in manifest, and none of its sentences are in manifest)
  for (const block of input.blocks) {
    const hasBlock = manifestSet.has(frozen(block.id));
    const hasSentence = block.sentences.some((s) => manifestSet.has(frozen(s.id)));
    if (!hasBlock && !hasSentence) {
      differences.push({
        differenceId: `unit-extra-in-ledger:${block.id}`,
        kind: "unit-extra-in-ledger",
        unitId: block.id,
        message: `Proposed block "${block.id}" is not in the frozen manifest.`,
      });
    }
  }

  // 2. Missing units (frozen manifest id has no proposed block or sentence)
  for (const mUnit of manifestUnits) {
    const id = mUnit.id;
    const found = proposedBlockIds.has(id) || proposedSentenceIds.has(id);
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
  for (const mUnit of manifestUnits) {
    if (mUnit.references && mUnit.references.length > 0) {
      for (const refId of mUnit.references) {
        differences.push({
          differenceId: `unit-missing-in-ledger:${refId}`,
          kind: "unit-missing-in-ledger",
          unitId: refId,
          message: `Frozen reference "${refId}" has no authored inline in ledger.`,
        });
      }
    }
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
}>;

export type WriteBlocksResult =
  | Readonly<{
      ok: true;
      writtenFiles: readonly string[];
      message: string;
    }>
  | Readonly<{
      ok: false;
      code: "no-write-flag" | "write-blocks-refused-differences" | "update-required";
      message: string;
      existingFiles?: readonly string[] | undefined;
    }>;

/**
 * Write proposed blocks to content/source-blocks/<slug>/blocks/.
 * Refuses if differences are unresolved.
 * Refuses overwrite without --update. Never deletes files.
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

  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  const writtenFiles: string[] = [];
  for (const [sec, blocks] of sectionMap.entries()) {
    const p = join(destDir, `${sec}.yaml`);
    const content = yaml.dump(
      { section: sec, blocks },
      { indent: 2, lineWidth: -1, sortKeys: false },
    );
    writeFileSync(p, content, "utf8");
    writtenFiles.push(p);
  }

  return {
    ok: true,
    writtenFiles: Object.freeze(writtenFiles),
    message: `Wrote ${writtenFiles.length} block files to ${destDir}.`,
  };
}
