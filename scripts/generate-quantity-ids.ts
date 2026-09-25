#!/usr/bin/env node --experimental-strip-types
/**
 * Generates docs/QUANTITY_IDS.md from content/quantities/*.yaml and, with --check, validates
 * every record and confirms the committed doc is fresh without writing. This is the
 * registry's quality-gate step (am-not-quantity-registry-2f7): a stale list here means some
 * other bead is citing an id or legacy spelling that no longer matches the source of truth.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dimension, dimensionText } from "../src/content/dimensions/rational.ts";
import {
  loadQuantityRegistry,
  QUANTITIES_DIR,
  type QuantityRegistry,
  RESERVED_SPELLINGS,
} from "../src/content/quantities/registry.ts";
import {
  getLegacySpellingsFrom,
  LEGACY_SPELLINGS_PATH,
  type LegacySpellingEntry,
} from "../src/content/quantities/resolveQuantityId.ts";
import type { Quantity } from "../src/content/schemas/argument.ts";
import { getLogger, newRunIdentity } from "../src/testing/log/logger.ts";

function parseArgs(argv: readonly string[]): {
  check: boolean;
  dir: string;
  legacy: string;
  doc: string;
} {
  const flag = (name: string, fallback: string): string => {
    const idx = argv.indexOf(name);
    const next = idx >= 0 ? argv[idx + 1] : undefined;
    return next !== undefined ? next : fallback;
  };
  return {
    check: argv.includes("--check"),
    dir: flag("--dir", QUANTITIES_DIR),
    legacy: flag("--legacy", LEGACY_SPELLINGS_PATH),
    doc: flag("--doc", fileURLToPath(new URL("../docs/QUANTITY_IDS.md", import.meta.url))),
  };
}

export function formatDimension(q: Quantity): string {
  if (q.dimensionStatus === "state-dependent") return "symbolic";
  // Named by the source, never defined there (dispatch 236): no dimension to print, and the row
  // says why rather than showing the same dash as a record that merely lacks one.
  if (q.dimensionStatus === "undefined-in-source") return "undefined in source";
  if (!q.dimension) return "—";
  return dimensionText(dimension(q.dimension.map((slot) => `${slot.num}/${slot.den}`)));
}

export function generateMarkdown(
  registry: QuantityRegistry,
  legacySpellings: ReadonlyMap<string, LegacySpellingEntry>,
): string {
  const legacyByCanonical = new Map<string, string[]>();
  for (const entry of legacySpellings.values()) {
    for (const id of entry.canonicalIds) {
      if (!legacyByCanonical.has(id)) legacyByCanonical.set(id, []);
      legacyByCanonical.get(id)?.push(entry.spelling);
    }
  }

  const lines: string[] = [];
  lines.push("# Quantity IDs");
  lines.push("");
  lines.push(
    "Generated from `content/quantities/*.yaml` by `scripts/generate-quantity-ids.ts`. Do not hand-edit; run `bun scripts/generate-quantity-ids.ts` to regenerate, and `--check` in CI to confirm this file is fresh.",
  );
  lines.push("");
  lines.push(
    `Total: ${registry.ids.length} quantities, ${legacySpellings.size} rejected spellings, ${Object.keys(RESERVED_SPELLINGS).length} reserved spellings.`,
  );
  lines.push("");
  lines.push("## Registered quantities");
  lines.push("");
  lines.push("| id | name | dimension | frame | mathematicalKind | legacy spellings |");
  lines.push("|---|---|---|---|---|---|");
  for (const id of registry.ids) {
    const q = registry.quantities.get(id);
    if (!q) continue; // unreachable: id comes from this same registry's own key set.
    const spellings = (legacyByCanonical.get(id) ?? []).slice().sort().join(", ") || "—";
    lines.push(
      `| ${q.id} | ${q.name} | ${formatDimension(q)} | ${q.frame ?? "—"} | ${q.mathematicalKind} | ${spellings} |`,
    );
  }
  lines.push("");
  lines.push("## Reserved spellings");
  lines.push("");
  lines.push(
    "Reserved for a not-yet-authored record; `resolveQuantityId` reports these `unregistered`, never a plausible-looking binding.",
  );
  lines.push("");
  const reservedEntries = Object.entries(RESERVED_SPELLINGS).sort(([a], [b]) => a.localeCompare(b));
  if (reservedEntries.length === 0) lines.push("_None._");
  for (const [spelling, note] of reservedEntries) lines.push(`- \`${spelling}\`: ${note}`);
  lines.push("");
  lines.push("## Representation fields");
  lines.push("");
  lines.push(
    "Declared data fields on a quantity's authored record, exempt from the legacy-spelling check because they name a representation of that same quantity, never a different one.",
  );
  lines.push("");
  const representationLines: string[] = [];
  for (const id of registry.ids) {
    const q = registry.quantities.get(id);
    if (!q) continue; // unreachable: id comes from this same registry's own key set.
    for (const rep of q.representationFields ?? [])
      representationLines.push(`- \`${rep}\` on \`${id}\``);
  }
  if (representationLines.length === 0) lines.push("_None._");
  else lines.push(...representationLines);
  lines.push("");
  return lines.join("\n");
}

function assertLegacySpellingsResolve(
  registry: QuantityRegistry,
  legacySpellings: ReadonlyMap<string, LegacySpellingEntry>,
): void {
  for (const entry of legacySpellings.values()) {
    if (registry.quantities.has(entry.spelling)) {
      throw new Error(`legacy spelling "${entry.spelling}" is also a registered quantity id.`);
    }
    for (const canonicalId of entry.canonicalIds) {
      if (!registry.quantities.has(canonicalId)) {
        throw new Error(
          `legacy spelling "${entry.spelling}" names unregistered canonical id "${canonicalId}".`,
        );
      }
    }
  }
}

export function run(argv: readonly string[] = process.argv.slice(2)): number {
  const { check, dir, legacy, doc } = parseArgs(argv);
  const logRunId = newRunIdentity();
  const logger = getLogger("generate-quantity-ids", logRunId);
  try {
    const registry = loadQuantityRegistry(dir);
    const legacySpellings = getLegacySpellingsFrom(legacy);
    assertLegacySpellingsResolve(registry, legacySpellings);

    for (const id of registry.ids) {
      logger.log({
        testId: `record:${id}`,
        outcome: "passed",
        extra: { quantityId: id, check: "record-valid" },
      });
    }
    for (const entry of legacySpellings.values()) {
      logger.log({
        testId: `legacy-spelling:${entry.spelling}`,
        outcome: "passed",
        extra: {
          legacySpelling: entry.spelling,
          canonicalIds: entry.canonicalIds,
          check: "legacy-spelling-resolves",
        },
      });
    }

    const generated = generateMarkdown(registry, legacySpellings);

    if (check) {
      const existing = existsSync(doc) ? readFileSync(doc, "utf8") : "";
      const fresh = existing === generated;
      logger.log({
        testId: "doc-freshness",
        outcome: fresh ? "passed" : "failed",
        extra: { check: "doc-freshness" },
        ...(fresh ? {} : { message: `${doc} is stale relative to the source records.` }),
      });
      logger.flushSync();
      if (!fresh) {
        console.error(
          `STALE: ${doc} does not match the regenerated content. Run \`bun scripts/generate-quantity-ids.ts\` (without --check) to update it.`,
        );
        return 1;
      }
      console.log(`OK: ${registry.ids.length} quantities validated; ${doc} is fresh.`);
      return 0;
    }

    writeFileSync(doc, generated, "utf8");
    logger.log({
      testId: "doc-generate",
      outcome: "passed",
      extra: { check: "doc-generate", quantityCount: registry.ids.length },
    });
    logger.flushSync();
    console.log(`Wrote ${doc} with ${registry.ids.length} quantities.`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.log({ testId: "generate-quantity-ids", outcome: "failed", message });
    logger.flushSync();
    console.error(message);
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = run();
}
