/**
 * Brownian-slice editorial inventory.
 *
 * Records what exists, what is authored, and what is claimed. Reviewed is
 * never inferred from authorship. Absent is recorded. Invented source units
 * are refused.
 *
 * Bead: am-edn-inventory-brownian-slg
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { aliasEntryCitesBead, validateAliasRecord } from "../aliases.ts";
import { compileReadingContent } from "../compiler/compile.ts";
import { parseIdSnapshot } from "../frozenIds.ts";
import { validateSourceManifest } from "../manifest/schema.ts";
import { validateManifest } from "../manifest/validator.ts";
import { parseReceipt } from "../provenance/parseReceipt.ts";
import { parseYaml } from "../provenance/yaml.ts";
import {
  type ManifestUnitLike,
  type PageMapEntryLike,
  type PageMapMismatch,
  reconcilePageMapAgainstManifest,
} from "./pageMapReconciliation.ts";

export { type PageMapMismatch, reconcilePageMapAgainstManifest };

export const BROWNIAN_PAPER = "brownian-motion";
export const BROWNIAN_BIB_KEY = "ap-17-549";
export const BROWNIAN_INVENTORY_BEAD = "am-edn-inventory-brownian-slg";

export const DIFFICULTY_FLAG_KEYS = [
  "s5-printed-numbers",
  "s5-printed-units",
  "r-not-printed",
  "intro-uncertainty",
  "velocity-warning",
  "s4-tau-coarse-graining",
  "dates",
] as const;

export const WATCH_LIST_RESULTS = ["pending", "matches", "differs", "not-found"] as const;
export type WatchListResult = (typeof WATCH_LIST_RESULTS)[number];

export const TREATMENT_MAP_ROWS = ["s0", "s1", "s2", "s3", "s4", "s5", "closing"] as const;

export type Existence = "absent" | "authored";
export type ReviewClaim = "not-claimed" | "pending" | "reviewed";

export type LayerInventory = Readonly<{
  layer: string;
  existence: Existence;
  reviewClaim: ReviewClaim;
  ids: readonly string[];
  note: string;
}>;

export type DifficultyFlag = Readonly<{
  key: string;
  result: WatchListResult;
  rest: string;
}>;

export type FacsimilePinFailure =
  | { readonly kind: "receipt-missing"; readonly path: string }
  | { readonly kind: "receipt-invalid"; readonly path: string; readonly error: string }
  | { readonly kind: "pdf-missing"; readonly path: string }
  | { readonly kind: "digest-mismatch"; readonly expected: string; readonly actual: string };

export type FacsimilePinVerification = Readonly<{
  pinned: boolean;
  sha256?: string;
  pdfPath?: string;
  failure?: FacsimilePinFailure;
}>;

export type BrownianInventory = Readonly<{
  paper: typeof BROWNIAN_PAPER;
  bibliographicKey: typeof BROWNIAN_BIB_KEY;
  facsimilePinned: boolean;
  facsimilePinFailure?: FacsimilePinFailure | undefined;
  sourceUnitsFrozen: boolean;
  layers: readonly LayerInventory[];
  difficultyFlags: readonly DifficultyFlag[];
  treatmentMapRows: readonly string[];
  paperStatus: string;
  sourceStatus: string;
}>;

export class InventoryHonestyError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "InventoryHonestyError";
    this.code = code;
  }
}

const FLAG_LINE = /^- `flag:([a-z0-9-]+)`\s+(pending|matches|differs|not-found)\b(.*)$/i;

export function parseDifficultyFlags(markdown: string): DifficultyFlag[] {
  const flags: DifficultyFlag[] = [];
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    const match = FLAG_LINE.exec(line);
    if (!match) continue;
    const key = match[1] ?? "";
    const result = (match[2] ?? "").toLowerCase() as WatchListResult;
    flags.push({ key, result, rest: (match[3] ?? "").trim() });
  }
  return flags;
}

export function reviewedWithoutRecord(claim: ReviewClaim, hasHumanReviewRecord: boolean): boolean {
  return claim === "reviewed" && !hasHumanReviewRecord;
}

function jsonIds(dir: string, kind: string): string[] {
  if (!existsSync(dir)) return [];
  const ids: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith(".json")) continue;
    const raw = JSON.parse(readFileSync(join(dir, name), "utf8")) as Record<string, unknown>;
    if (raw.kind === kind && typeof raw.id === "string") ids.push(raw.id);
  }
  return ids;
}

export function verifyBrownianFacsimilePin(root = process.cwd()): FacsimilePinVerification {
  const receiptPath = join(root, "docs/provenance/ap-17-549.md");
  if (!existsSync(receiptPath)) {
    return { pinned: false, failure: { kind: "receipt-missing", path: receiptPath } };
  }

  let receiptContent: string;
  try {
    receiptContent = readFileSync(receiptPath, "utf8");
  } catch (err) {
    return {
      pinned: false,
      failure: {
        kind: "receipt-invalid",
        path: receiptPath,
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }

  const parsed = parseReceipt(receiptContent, receiptPath);
  const scan = parsed.frontMatter?.scan;
  if (!scan || typeof scan.sha256 !== "string" || !scan.sha256.trim()) {
    return {
      pinned: false,
      failure: {
        kind: "receipt-invalid",
        path: receiptPath,
        error: "Missing scan.sha256 in receipt front matter.",
      },
    };
  }

  const expectedSha256 = scan.sha256.trim().toLowerCase();
  const pdfRelPath = scan.path ?? "public/papers/pdfs/ap-17-549.pdf";
  const pdfPath = join(root, pdfRelPath);

  if (!existsSync(pdfPath)) {
    return {
      pinned: false,
      sha256: expectedSha256,
      pdfPath,
      failure: { kind: "pdf-missing", path: pdfPath },
    };
  }

  let actualSha256: string;
  try {
    const pdfBuf = readFileSync(pdfPath);
    actualSha256 = createHash("sha256").update(pdfBuf).digest("hex").toLowerCase();
  } catch {
    return {
      pinned: false,
      sha256: expectedSha256,
      pdfPath,
      failure: {
        kind: "pdf-missing",
        path: pdfPath,
      },
    };
  }

  if (actualSha256 !== expectedSha256) {
    return {
      pinned: false,
      sha256: expectedSha256,
      pdfPath,
      failure: {
        kind: "digest-mismatch",
        expected: expectedSha256,
        actual: actualSha256,
      },
    };
  }

  return {
    pinned: true,
    sha256: expectedSha256,
    pdfPath,
  };
}

/**
 * Admits alias records only when they are honest.
 *
 * Retiring an id is the sanctioned way to correct a boundary after the ids are frozen
 * (am-cm-id-scheme-8bn): retired ids are never reused and survivors keep their numbers. Before the
 * freeze there is nothing to retire, so a non-empty alias file is still refused, which is the rule
 * the original guard's message stated. A record that does not parse, or that redirects to an id the
 * manifest does not contain, is refused in either case.
 */
export function admitAliasRecords(
  aliasList: readonly unknown[],
  context: { readonly idsFrozenAt?: string | undefined; readonly liveIds: readonly string[] },
): void {
  if (aliasList.length === 0) return;
  if (!context.idsFrozenAt) {
    throw new InventoryHonestyError(
      "aliases-before-freeze",
      "The Brownian alias file must stay empty until ids freeze.",
    );
  }
  const live = new Set(context.liveIds);
  for (const record of aliasList) {
    const parsed = validateAliasRecord(record);
    if (!parsed.ok) {
      throw new InventoryHonestyError(
        "alias-record-invalid",
        `Invalid alias record: ${parsed.error}`,
      );
    }
    // Owner ruling am-xz2d, verbatim "Reword to require provenance": an entry in a committed
    // alias file cites the bead that retired the id. `replacementIds` below is the other half.
    if (!aliasEntryCitesBead(parsed.value)) {
      throw new InventoryHonestyError(
        "alias-editor-bead-citation",
        `Alias for '${parsed.value.retiredId}' has editor '${parsed.value.editor}', which cites no bead; every entry names the bead that retired the id.`,
      );
    }
    if (live.has(parsed.value.retiredId)) {
      throw new InventoryHonestyError(
        "alias-retired-id-still-live",
        `Retired id '${parsed.value.retiredId}' is still present in the manifest; retired ids are never reused.`,
      );
    }
    for (const replacement of parsed.value.replacementIds) {
      // A reference occurrence resolves to another occurrence id, not to a unit id.
      if (replacement.includes("-r") && /-r\d+$/.test(replacement)) continue;
      if (!live.has(replacement)) {
        throw new InventoryHonestyError(
          "alias-replacement-missing",
          `Alias for '${parsed.value.retiredId}' points at '${replacement}', which is not a live manifest id.`,
        );
      }
    }
  }
}

export function loadBrownianInventory(root = process.cwd()): BrownianInventory {
  const paperPath = join(root, "content/papers/brownian-motion.json");
  const paper = JSON.parse(readFileSync(paperPath, "utf8")) as Record<string, unknown>;
  const paperStatus = typeof paper.status === "string" ? paper.status : "";
  const sourceStatus = typeof paper.sourceStatus === "string" ? paper.sourceStatus : "";

  const argumentIds = jsonIds(join(root, "content/arguments/brownian-motion"), "argument");
  const equationIds = jsonIds(join(root, "content/equations/brownian-motion"), "equation");

  const labDir = join(root, "src/app/lab");
  const instrumentIds = existsSync(labDir)
    ? readdirSync(labDir)
        .filter((name) => /^bm-0[1-8]$/.test(name))
        .sort()
    : [];

  const pinVerification = verifyBrownianFacsimilePin(root);
  const facsimilePinned = pinVerification.pinned;
  const manifestPath = join(root, "content/source-blocks/brownian-motion/manifest.yaml");
  const snapshotPath = join(
    root,
    "content/source-blocks/brownian-motion/manifest.ids.snapshot.txt",
  );
  const aliasPath = join(root, "content/aliases/brownian-motion.yaml");
  const difficultiesPath = join(root, "docs/editorial/brownian-motion-difficulties.md");

  const manifestRaw = parseYaml(readFileSync(manifestPath, "utf8"));
  const manifest = validateSourceManifest(manifestRaw, manifestPath);
  const snapshotIds = parseIdSnapshot(readFileSync(snapshotPath, "utf8"));
  const aliasRaw = parseYaml(readFileSync(aliasPath, "utf8"));
  const aliasList = Array.isArray((aliasRaw as { aliases?: unknown }).aliases)
    ? ((aliasRaw as { aliases: unknown[] }).aliases ?? [])
    : [];
  const difficultyFlags = parseDifficultyFlags(readFileSync(difficultiesPath, "utf8"));

  if (manifest.status === "complete") {
    throw new InventoryHonestyError(
      "source-claimed-complete",
      "The Brownian source inventory is marked complete without a pinned facsimile.",
    );
  }
  if (manifest.units.length > 0 && !facsimilePinned) {
    throw new InventoryHonestyError(
      "invented-source-units",
      "Source units are present but the pinned facsimile receipt is absent. Invented units are not admitted.",
    );
  }
  if ((manifest.idsFrozenAt || snapshotIds.length > 0) && !facsimilePinned) {
    throw new InventoryHonestyError(
      "ids-frozen-without-facsimile",
      "Source ids cannot freeze until the facsimile is pinned and units are inventoried.",
    );
  }
  if (manifest.idsFrozenAt && manifest.units.length === 0) {
    throw new InventoryHonestyError(
      "ids-frozen-without-units",
      "Source ids cannot freeze until units are inventoried.",
    );
  }
  admitAliasRecords(aliasList, {
    idsFrozenAt: manifest.idsFrozenAt,
    liveIds: manifest.units.map((u) => u.id),
  });
  if (paperStatus !== "explanation-preview" || sourceStatus !== "in-preparation") {
    throw new InventoryHonestyError(
      "paper-overclaimed",
      `Paper status is ${paperStatus}/${sourceStatus}; the edition is an explanation preview with source in preparation.`,
    );
  }

  const isFrozen = Boolean(manifest.idsFrozenAt && snapshotIds.length > 0);

  const layers: LayerInventory[] = [
    {
      layer: "source-units",
      existence: manifest.units.length === 0 ? "absent" : "authored",
      reviewClaim: "not-claimed",
      ids: manifest.units.map((u) => u.id),
      note:
        manifest.units.length === 0
          ? "Pinned facsimile absent. Units stay empty."
          : "Source units inventoried from authentic page scans.",
    },
    {
      layer: "translation",
      existence: "absent",
      reviewClaim: "not-claimed",
      ids: [],
      note: "No translation units are in the corpus.",
    },
    {
      layer: "arguments",
      existence: argumentIds.length > 0 ? "authored" : "absent",
      reviewClaim: "pending",
      ids: argumentIds,
      note: "Authored explanation; no human review is claimed.",
    },
    {
      layer: "equations",
      existence: equationIds.length > 0 ? "authored" : "absent",
      reviewClaim: "pending",
      ids: equationIds,
      note: "Modern teaching equation; historical notation and editorial review are not claimed.",
    },
    {
      layer: "instruments",
      existence: instrumentIds.length > 0 ? "authored" : "absent",
      reviewClaim: "not-claimed",
      ids: instrumentIds,
      note: "Laboratory routes exist. They are not a source edition.",
    },
  ];

  for (const layer of layers) {
    if (reviewedWithoutRecord(layer.reviewClaim, false)) {
      throw new InventoryHonestyError(
        "reviewed-without-record",
        `Layer ${layer.layer} claims reviewed without a human review record.`,
      );
    }
  }

  return {
    paper: BROWNIAN_PAPER,
    bibliographicKey: BROWNIAN_BIB_KEY,
    facsimilePinned,
    facsimilePinFailure: pinVerification.failure,
    sourceUnitsFrozen: isFrozen,
    layers,
    difficultyFlags,
    treatmentMapRows: TREATMENT_MAP_ROWS,
    paperStatus,
    sourceStatus,
  };
}

export function brownianCompilerFlags(root = process.cwd()): {
  editorial: readonly string[];
  equation: readonly string[];
} {
  const files: { path: string; text: string }[] = [];
  const addJsonDir = (rel: string) => {
    const dir = join(root, rel);
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir).sort()) {
      if (!name.endsWith(".json")) continue;
      files.push({
        path: `${rel.replace(/^content\//, "")}/${name}`,
        text: readFileSync(join(dir, name), "utf8"),
      });
    }
  };
  addJsonDir("content/papers");
  addJsonDir("content/arguments/brownian-motion");
  addJsonDir("content/equations/brownian-motion");
  addJsonDir("content/foundations");
  addJsonDir("content/bibliography");
  const compiled = compileReadingContent(files);
  const editorial = compiled.diagnostics
    .filter((d) => d.code === "editorial-review-pending")
    .map((d) => d.path);
  const equation = compiled.diagnostics
    .filter((d) => d.code === "equation-review-pending")
    .map((d) => d.path);
  return { editorial, equation };
}

export function brownianSourceManifestDiagnostics(root = process.cwd()) {
  const manifestPath = join(root, "content/source-blocks/brownian-motion/manifest.yaml");
  const manifest = validateSourceManifest(
    parseYaml(readFileSync(manifestPath, "utf8")),
    manifestPath,
  );
  // The paper's id sequence has deliberate gaps: the 2026-09-19 boundary audit retired five
  // paragraph units that were flush resumptions rather than printed breaks. Retired ids are never
  // reused and survivors keep their numbers, so the validator needs the alias records to tell an
  // explained gap from an unexplained one. Passing them explains the gaps; it does not waive them.
  const aliasPath = join(root, "content/aliases/brownian-motion.yaml");
  const aliasRaw = parseYaml(readFileSync(aliasPath, "utf8")) as { aliases?: unknown[] };
  const aliases = (aliasRaw.aliases ?? []).map((record) => {
    const parsed = validateAliasRecord(record);
    if (!parsed.ok) {
      throw new Error(`Invalid alias record in ${aliasPath}: ${parsed.error}`);
    }
    return parsed.value;
  });
  return validateManifest(manifest, { manifests: new Map([[manifest.paper, manifest]]), aliases });
}

/**
 * Reads the pinned receipt and the manifest from disk and reconciles them.
 */
export function brownianPageMapMismatches(root = process.cwd()): PageMapMismatch[] {
  const manifestPath = join(root, "content/source-blocks/brownian-motion/manifest.yaml");
  const manifest = validateSourceManifest(
    parseYaml(readFileSync(manifestPath, "utf8")),
    manifestPath,
  );
  const receiptPath = join(root, `docs/provenance/${BROWNIAN_BIB_KEY}.md`);
  const parsed = parseReceipt(readFileSync(receiptPath, "utf8"), receiptPath);
  const pageMap = parsed.frontMatter?.pageMap;
  if (!Array.isArray(pageMap) || pageMap.length === 0) {
    throw new InventoryHonestyError(
      "receipt-pagemap-absent",
      `${receiptPath} has no pageMap to reconcile against the manifest.`,
    );
  }
  return reconcilePageMapAgainstManifest(
    manifest.units as readonly ManifestUnitLike[],
    pageMap as readonly PageMapEntryLike[],
    BROWNIAN_INVENTORY_BEAD,
  );
}
