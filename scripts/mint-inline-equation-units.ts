#!/usr/bin/env bun
/**
 * Write a paper's `inline-equation` units into its source manifest, in printed order.
 *
 * WHY A SCRIPT AND NOT A HAND EDIT. The units are DERIVED: their ids are positional over every
 * inline math region of the owning sentence, and `src/content/manifest/inlineEquationUnits.test.ts`
 * asserts that a paper's manifest records exactly the derived set. That equality is permanent, so
 * any transcription correction that adds or removes a printed region has to be followed into the
 * manifest, and doing that by hand across 270 units in four papers is how a frozen id comes to name
 * the wrong passage. This makes it one command whose output the test then checks.
 *
 * WHY IT EDITS TEXT RATHER THAN RE-SERIALIZING. The manifests are hand-authored and carry the
 * editorial record in comments -- which ids were retired and why, which plate reading cut a
 * sentence, which bead froze what. Re-emitting the file from a parsed object would delete all of it
 * while reporting success. So this inserts lines and touches nothing else, and `--check` proves it:
 * run without `--write` it reports what it would insert and leaves the file alone.
 *
 * Ids are frozen on publication. Minting is therefore not reversible by editing: a wrong id is
 * retired through `content/aliases/<paper>.yaml` and never reused.
 *
 * Usage:
 *   bun scripts/mint-inline-equation-units.ts <paper>            # report, write nothing
 *   bun scripts/mint-inline-equation-units.ts <paper> --write    # insert the units
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type InlineUnitSource,
  inlineEquationUnits,
  unplacedRegions,
} from "../src/content/manifest/inlineEquationUnits.ts";
import type { ManifestLocator, ManifestUnit } from "../src/content/manifest/types.ts";
import { parseYaml } from "../src/content/provenance/yaml.ts";
import type { Inline } from "../src/content/schemas/inlines.ts";
import { strictParse } from "../src/content/schemas/strictParse.ts";

const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"] as const;

function sourceBlocks(root: string, paper: string): readonly InlineUnitSource[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry.endsWith(".yaml") && entry !== "manifest.yaml") files.push(path);
    }
  };
  walk(join(root, "content", "source-blocks", paper));

  const out: InlineUnitSource[] = [];
  for (const file of files) {
    let record: Record<string, unknown>;
    try {
      record = strictParse(readFileSync(file, "utf8"), "yaml") as Record<string, unknown>;
    } catch {
      continue;
    }
    if (record.kind === "equation") continue;
    const inlines = Array.isArray(record.inlines) ? (record.inlines as Inline[]) : [];
    if (inlines.length === 0) continue;
    const sentenceSpans = (
      Array.isArray(record.sentenceSpans) ? (record.sentenceSpans as Record<string, unknown>[]) : []
    ).map((s) => ({ id: String(s.id), span: s.span as { start: number; end: number } }));
    out.push({
      blockId: String(record.id),
      paper,
      section: typeof record.section === "string" ? record.section : undefined,
      inlines,
      sentenceSpans,
    });
  }
  return out;
}

/** Serialize one unit at the manifest's own indentation, mirroring the owner's locator keys. */
function renderUnit(unit: ManifestUnit): string {
  const lines: string[] = [`  - id: ${unit.id}`, `    kind: ${unit.kind}`];
  if (unit.section !== undefined) lines.push(`    section: ${unit.section}`);
  if (unit.containedIn !== undefined) lines.push(`    containedIn: ${unit.containedIn}`);
  lines.push("    locators:");
  for (const locator of unit.locators) {
    const entries = Object.entries(locator).filter(([, v]) => v !== undefined);
    const [firstKey, firstValue] = entries[0] ?? ["page", 0];
    lines.push(`      - ${firstKey}: ${String(firstValue)}`);
    for (const [key, value] of entries.slice(1)) lines.push(`        ${key}: ${String(value)}`);
  }
  const destination = unit.destination;
  if (destination !== undefined && typeof destination === "object") {
    lines.push("    destination:");
    if (destination.editionBlockId !== undefined) {
      lines.push(`      editionBlockId: ${destination.editionBlockId}`);
    }
    if (destination.translationUnits !== undefined) {
      lines.push("      translationUnits:");
      for (const entry of destination.translationUnits) lines.push(`        - ${entry}`);
    }
    if (destination.argumentObligations !== undefined) {
      lines.push("      argumentObligations:");
      for (const entry of destination.argumentObligations) lines.push(`        - ${entry}`);
    }
  }
  return lines.join("\n");
}

function main(): number {
  const args = process.argv.slice(2);
  const paper = args.find((a) => !a.startsWith("--"));
  const write = args.includes("--write");
  if (paper === undefined || !(PAPERS as readonly string[]).includes(paper)) {
    process.stderr.write(`usage: mint-inline-equation-units.ts <${PAPERS.join("|")}> [--write]\n`);
    return 2;
  }

  const root = process.cwd();
  const manifestPath = join(root, "content", "source-blocks", paper, "manifest.yaml");
  const original = readFileSync(manifestPath, "utf8");
  const parsed = parseYaml(original) as { units?: ManifestUnit[] };
  const units = parsed.units ?? [];

  const blocks = sourceBlocks(root, paper);

  // Refuse before writing if any region cannot be placed in a sentence span: an index assigned
  // under the wrong owner is a frozen id naming the wrong passage.
  const unplaced = blocks.flatMap((b) =>
    unplacedRegions(b.inlines, b.sentenceSpans, b.blockId).map((r) => `${r.blockId}: ${r.latex}`),
  );
  if (unplaced.length > 0) {
    process.stderr.write(
      `refusing: ${unplaced.length} inline region(s) fall outside their block's sentence spans:\n  ${unplaced.join("\n  ")}\n`,
    );
    return 1;
  }

  const containers = new Map(
    units.map((u) => [
      u.id,
      {
        locators: u.locators as readonly ManifestLocator[],
        section: u.section,
        argumentObligations:
          typeof u.destination === "object" && u.destination !== null
            ? u.destination.argumentObligations
            : undefined,
      },
    ]),
  );
  const derived = inlineEquationUnits(blocks, containers);
  const existing = new Set(units.filter((u) => u.kind === "inline-equation").map((u) => u.id));
  const toInsert = derived.filter((u) => !existing.has(u.id));

  process.stdout.write(
    `${paper}: ${units.length} units on disk, ${derived.length} inline-equation units derived, ${existing.size} already recorded, ${toInsert.length} to insert\n`,
  );
  if (toInsert.length === 0) {
    process.stdout.write("nothing to do\n");
    return 0;
  }

  // Group by owner, and find each owner's block in the text so insertion keeps printed order.
  const byOwner = new Map<string, ManifestUnit[]>();
  for (const unit of toInsert) {
    const owner = unit.containedIn ?? "";
    byOwner.set(owner, [...(byOwner.get(owner) ?? []), unit]);
  }

  const lines = original.split("\n");
  const unitStart = new Map<string, number>();
  const unitLineIndices: number[] = [];
  let inUnits = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^units:\s*$/.test(line)) {
      inUnits = true;
      continue;
    }
    if (!inUnits) continue;
    if (/^[A-Za-z_]/.test(line)) break; // a later top-level key ends the units list
    const match = /^ {2}- id:\s*"?([^"\s]+)"?\s*$/.exec(line);
    if (match?.[1]) {
      unitStart.set(match[1], i);
      unitLineIndices.push(i);
    }
  }

  const missing = [...byOwner.keys()].filter((owner) => !unitStart.has(owner));
  if (missing.length > 0) {
    process.stderr.write(
      `refusing: owner unit(s) not found in the manifest text: ${missing.join(", ")}\n`,
    );
    return 1;
  }

  // Insert after the owner's block: at the next unit's start line, or at the end of the list.
  const endOfUnits = (() => {
    let last = unitLineIndices[unitLineIndices.length - 1] ?? 0;
    while (last + 1 < lines.length && !/^[A-Za-z_]/.test(lines[last + 1] ?? "")) last++;
    return last + 1;
  })();

  const insertions = new Map<number, string[]>();
  for (const [owner, ownerUnits] of byOwner) {
    const start = unitStart.get(owner) as number;
    const next = unitLineIndices.find((i) => i > start);
    const at = next ?? endOfUnits;
    const rendered = ownerUnits.map(renderUnit);
    insertions.set(at, [...(insertions.get(at) ?? []), ...rendered]);
  }

  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const pending = insertions.get(i);
    if (pending !== undefined) {
      for (const block of pending) {
        out.push(block);
        out.push("");
      }
    }
    out.push(lines[i] ?? "");
  }
  const trailing = insertions.get(lines.length);
  if (trailing !== undefined) for (const block of trailing) out.push(block, "");

  const next = out.join("\n");
  if (!write) {
    process.stdout.write(
      `--write not given; would add ${next.split("\n").length - lines.length} lines. First unit:\n${renderUnit(toInsert[0] as ManifestUnit)}\n`,
    );
    return 0;
  }
  writeFileSync(manifestPath, next, "utf8");
  process.stdout.write(
    `wrote ${manifestPath} (+${next.split("\n").length - lines.length} lines)\n`,
  );
  return 0;
}

process.exit(main());
