/**
 * Edition contract harness every paper's tests call (am-edn-alignment-tooling-do1).
 *
 * Faithfulness to the ledger and translation completeness are only defined
 * when a ledger is present. "No ledger present" is never "complete".
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseRouteSlug, type RouteSlug } from "../ids.ts";
import type { Alignment } from "../schemas/source.ts";
import { type ExplicitEdge, edgesFromAlignment, validateManyToManyAlignment } from "./alignment.ts";
import {
  inspectLedgerPresence,
  type LedgerPresence,
  type TranslationCompleteness,
  translationCompleteness,
} from "./ledgerPresence.ts";
import { germanAlignableIds, segmentLedger } from "./segmentLedger.ts";

export type ContractCheckName =
  | "ledger-presence"
  | "reconstruction"
  | "digest-chain"
  | "id-stability"
  | "alignment-edges"
  | "translation-completeness";

export type ContractCheckResult = Readonly<{
  check: ContractCheckName;
  outcome: "passed" | "failed" | "not-available";
  code?: string | undefined;
  message: string;
}>;

export type EditionContractResult = Readonly<{
  slug: RouteSlug;
  ledger: LedgerPresence;
  translationCompleteness: TranslationCompleteness;
  outcome: "passed" | "failed" | "not-available";
  checks: readonly ContractCheckResult[];
}>;

export type EditionContractOptions = Readonly<{
  root?: string | undefined;
  ledgerText?: string | null | undefined;
  editionText?: string | undefined;
  alignment?: Alignment | undefined;
  edges?: readonly ExplicitEdge[] | undefined;
  germanIds?: readonly string[] | undefined;
  englishIds?: readonly string[] | undefined;
  facsimileBytes?: Uint8Array | undefined;
  declaredFacsimileDigest?: string | undefined;
  declaredLedgerDigest?: string | undefined;
}>;

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function reconstructionHolds(ledgerText: string, editionText: string): boolean {
  const stripped = ledgerText
    .replace(/---\s*REVIEWED\s+TRANSCRIPTION\s+PAGE\s+\d+\s+OF\s+\d+\s*---/g, " ")
    .replace(/\[\[[^\]]+\]\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const edition = editionText.replace(/\s+/g, " ").trim();
  return edition === stripped;
}

export function assertEditionContract(
  slugRaw: string,
  options: EditionContractOptions = {},
): EditionContractResult {
  const parsed = parseRouteSlug(slugRaw);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  const slug = parsed.value;
  const root = options.root ?? process.cwd();
  const presence = inspectLedgerPresence(slug, root);
  const checks: ContractCheckResult[] = [];

  const ledgerText =
    options.ledgerText !== undefined
      ? options.ledgerText
      : presence.presence === "present"
        ? readFileSync(join(root, presence.path), "utf8")
        : null;

  if (
    presence.presence === "absent" &&
    (ledgerText === null || ledgerText === undefined || ledgerText === "")
  ) {
    checks.push({
      check: "ledger-presence",
      outcome: "not-available",
      code: "ledger-absent",
      message: `No ledger present for ${slug} at ${presence.path}. Absence is not completeness.`,
    });
    const completeness = translationCompleteness({
      ledger: "absent",
      translationUnitCount: options.englishIds?.length ?? 0,
      germanAlignableCount: options.germanIds?.length ?? 0,
    });
    return {
      slug,
      ledger: "absent",
      translationCompleteness: completeness,
      outcome: "not-available",
      checks: Object.freeze(checks),
    };
  }

  checks.push({
    check: "ledger-presence",
    outcome: "passed",
    message: `Ledger present for ${slug}.`,
  });

  const text = ledgerText ?? "";
  if (options.editionText !== undefined) {
    const ok = reconstructionHolds(text, options.editionText);
    checks.push({
      check: "reconstruction",
      outcome: ok ? "passed" : "failed",
      code: ok ? undefined : "reconstruction-mismatch",
      message: ok
        ? "Edition text reconstructs from the ledger."
        : "Edition text is not a reconstruction of the ledger (truncation at a sentence end still fails).",
    });
  }

  if (options.declaredLedgerDigest) {
    const actual = sha256(text);
    const ok = actual === options.declaredLedgerDigest;
    checks.push({
      check: "digest-chain",
      outcome: ok ? "passed" : "failed",
      code: ok ? undefined : "digest-mismatch",
      message: ok
        ? "Ledger digest matches edition.yaml."
        : "Ledger digest does not match edition.yaml.",
    });
  }
  if (options.declaredFacsimileDigest && options.facsimileBytes) {
    const actual = createHash("sha256").update(options.facsimileBytes).digest("hex");
    const ok = actual === options.declaredFacsimileDigest;
    checks.push({
      check: "digest-chain",
      outcome: ok ? "passed" : "failed",
      code: ok ? undefined : "digest-mismatch",
      message: ok ? "Facsimile digest matches." : "Facsimile digest does not match.",
    });
  } else if (options.declaredFacsimileDigest && !existsSync(join(root, "public/papers/pdfs"))) {
    checks.push({
      check: "digest-chain",
      outcome: "not-available",
      code: "facsimile-not-available",
      message: "Facsimile bytes are not in this checkout. Logged as not-available, not a pass.",
    });
  }

  const segmented = segmentLedger({ ledgerText: text, frozenIds: options.germanIds });
  const germanIds =
    options.germanIds ??
    (segmented.status === "proposed" ? germanAlignableIds(segmented.blocks) : []);
  checks.push({
    check: "id-stability",
    outcome: germanIds.every((id) => id.length > 0) ? "passed" : "failed",
    message: "Every German sentence and block-level unit has a permanent id.",
  });

  const edges = options.edges ?? (options.alignment ? edgesFromAlignment(options.alignment) : []);
  const englishIds = options.englishIds ?? edges.map((e) => e.targetId);
  if (edges.length > 0 || (options.englishIds && options.englishIds.length > 0)) {
    const issues = validateManyToManyAlignment({ edges, germanIds, englishIds });
    checks.push({
      check: "alignment-edges",
      outcome: issues.length === 0 ? "passed" : "failed",
      code: issues[0]?.code,
      message:
        issues.length === 0
          ? "Alignment edges name permanent ids."
          : issues.map((i) => i.message).join(" "),
    });
  }

  const completeness = translationCompleteness({
    ledger: "present",
    translationUnitCount: englishIds.length,
    germanAlignableCount: germanIds.length,
  });
  checks.push({
    check: "translation-completeness",
    outcome:
      completeness === "complete"
        ? "passed"
        : completeness === "incomplete"
          ? "failed"
          : "not-available",
    code: completeness === "complete" ? undefined : "translation-incomplete",
    message:
      completeness === "complete"
        ? "Every German alignable has an English unit."
        : "Translation is incomplete relative to the ledger.",
  });

  const failed = checks.some((c) => c.outcome === "failed");
  const unavailable = checks.every(
    (c) => c.outcome === "not-available" || c.check === "ledger-presence",
  );
  return {
    slug,
    ledger: "present",
    translationCompleteness: completeness,
    outcome: failed ? "failed" : unavailable ? "not-available" : "passed",
    checks: Object.freeze(checks),
  };
}
