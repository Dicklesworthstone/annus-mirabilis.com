/**
 * Server-side loader for bilingual editions (German source blocks,
 * English translation units, alignment, editorial notes, and review records).
 *
 * Spec: AGENTS.md and am-read-bilingual-faces-pao
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseReceipt } from "../../content/provenance/parseReceipt.ts";
import type { PaperIdentity } from "../../content/provenance/receiptSchema.ts";
import { parseYaml } from "../../content/provenance/yaml.ts";
import type { PaperDate } from "../../content/schemas/dates.ts";
import type { ReviewRecord } from "../../content/schemas/review.ts";
import type {
  Alignment,
  EditorialNote,
  GlossUnit,
  Paper,
  SourceBlock,
  TranslationUnit,
} from "../../content/schemas/source.ts";
import { loadPaper } from "../../content/server.ts";

export interface BilingualEdition {
  readonly paper: Paper;
  readonly blocks: readonly SourceBlock[];
  readonly units: readonly TranslationUnit[];
  readonly glossUnits?: readonly GlossUnit[] | undefined;
  readonly alignment?: Alignment | undefined;
  readonly editorialNotes?: readonly EditorialNote[] | undefined;
  readonly reviewRecords?: readonly ReviewRecord[] | undefined;
}

type TestOverrideFn = (paperId: string) => BilingualEdition | null | undefined;
let testOverride: TestOverrideFn | null = null;

/**
 * Sets a test override for bilingual edition loading. Pass `null` to reset.
 */
export function setBilingualEditionTestOverride(fn: TestOverrideFn | null): void {
  testOverride = fn;
}

/**
 * Checks whether reviewed source blocks, translation units, or gloss units are available
 * for a given paper.
 *
 * Returns the loaded edition if content is present, or null if the paper's
 * source layers are in-preparation/empty.
 */
/**
 * A file sitting in `content/source-blocks/<paper>/` is not automatically a source block.
 *
 * The directory scan below admits every .json/.yaml/.yml file whose name does not begin
 * with "manifest", and then accepted anything for which `typeof data === "object"`. In
 * JavaScript an ARRAY satisfies that, so a YAML sequence in the same directory was pushed
 * into `blocks` whole and the loader began returning a bilingual edition built from it.
 *
 * That is not hypothetical. `validateLedger` REQUIRES its warning allowlist at exactly
 * `content/source-blocks/<slug>/ledger-allowlist.yaml`, so the moment ap-17-549 acquired
 * one, the reader's bilingual face for brownian-motion was served a list of validator
 * acknowledgements as though it were authored German source. Two components disagreed
 * about what that directory means, and the disagreement reached a reader face.
 *
 * The test is a positive one on purpose. Adding "ledger-allowlist" to the name denylist
 * beside "manifest" would fix this file and none of the next ones; a source block must
 * look like a source block - a plain object carrying a string id - and anything else in
 * the directory is somebody else's record.
 */
/** Applied to source blocks, translation units and gloss units: all three scanned the
 * same way and accepted an array the same way. */
function isSourceBlockShaped(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    !Array.isArray(data) &&
    typeof (data as { id?: unknown }).id === "string" &&
    (data as { id: string }).id.length > 0
  );
}

/** Sorts blocks in place: manifest position first, then the block's `order`, then its id. */
export function sortBlocksByManifest(
  blocks: SourceBlock[],
  manifestOrder: readonly string[],
): void {
  const rank = new Map(manifestOrder.map((id, i) => [id, i]));
  const at = (b: SourceBlock) => rank.get(b.id) ?? Number.POSITIVE_INFINITY;
  const order = (b: SourceBlock) =>
    typeof b.order === "number" ? b.order : Number.POSITIVE_INFINITY;
  blocks.sort(
    (a, b) => at(a) - at(b) || order(a) - order(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

export class BilingualPaperRecordError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "BilingualPaperRecordError";
  }
}

/** The paper identity (titles, dates, journal) a provenance receipt records for a key. */
export function receiptPaperIdentity(rootDir: string, bibKey: string | undefined): PaperIdentity {
  if (!bibKey) {
    throw new BilingualPaperRecordError(
      "paper-citation-missing",
      "The compiled paper names no citation key, so its journal record cannot be found.",
    );
  }
  const path = join(rootDir, "docs", "provenance", `${bibKey}.md`);
  if (!existsSync(path)) {
    throw new BilingualPaperRecordError(
      "receipt-missing",
      `No provenance receipt at ${path} for ${bibKey}; its journal record is unknown.`,
    );
  }
  const identity = parseReceipt(readFileSync(path, "utf8"), path).frontMatter?.paper;
  if (!identity?.journal || !Array.isArray(identity.dates)) {
    throw new BilingualPaperRecordError(
      "receipt-paper-missing",
      `The receipt for ${bibKey} carries no paper journal record.`,
    );
  }
  return identity;
}

/** A receipt date (one ISO string at day, month or year precision) as the interval Paper uses. */
export function paperDateFromReceipt(d: PaperIdentity["dates"][number]): PaperDate {
  const iso = String(d.iso);
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(iso);
  if (!m) {
    throw new BilingualPaperRecordError(
      "receipt-date-invalid",
      `Receipt date "${iso}" is not ISO.`,
    );
  }
  const [, y, mo, day] = m;
  const lastDay = mo ? new Date(Date.UTC(Number(y), Number(mo), 0)).getUTCDate() : 31;
  return {
    type: d.type,
    ...(d.text !== undefined ? { text: d.text } : {}),
    earliest: day ? iso : mo ? `${y}-${mo}-01` : `${y}-01-01`,
    latest: day ? iso : mo ? `${y}-${mo}-${String(lastDay).padStart(2, "0")}` : `${y}-12-31`,
    precision: d.precision,
    source: d.source,
    verifiedAt: d.verifiedAt,
    ...(d.confirmedFromScan !== undefined ? { confirmedFromScan: d.confirmedFromScan } : {}),
  };
}

export async function loadBilingualEdition(
  paperId: string,
  rootDir: string = process.cwd(),
): Promise<BilingualEdition | null> {
  if (testOverride) {
    const overridden = testOverride(paperId);
    if (overridden !== undefined) {
      return overridden;
    }
  }

  // 1. Check generated/content/index.json for compiled bilingual payload if present
  try {
    const indexPath = join(rootDir, "generated/content/index.json");
    if (existsSync(indexPath)) {
      const index = JSON.parse(readFileSync(indexPath, "utf8")) as {
        payloads?: Array<{ kind: string; id: string; file: string }>;
      };
      const entry = index.payloads?.find(
        (e) => (e.kind === "bilingual-edition" || e.kind === "edition") && e.id === paperId,
      );
      if (entry) {
        const fullPath = join(rootDir, "generated/content", entry.file);
        if (existsSync(fullPath)) {
          const compiled = JSON.parse(readFileSync(fullPath, "utf8")) as BilingualEdition;
          if (
            (compiled.blocks && compiled.blocks.length > 0) ||
            (compiled.units && compiled.units.length > 0) ||
            (compiled.glossUnits && compiled.glossUnits.length > 0)
          ) {
            return compiled;
          }
        }
      }
    }
  } catch {
    // Proceed to filesystem checks
  }

  // 2. Load source blocks from content/source-blocks/${paperId}
  const blocks: SourceBlock[] = [];
  const manifestYamlPath = join(rootDir, `content/source-blocks/${paperId}/manifest.yaml`);
  const manifestJsonPath = join(rootDir, `content/source-blocks/${paperId}/manifest.json`);

  let manifestHasUnits = false;
  // The frozen manifest's unit ids in printed order: the order the German column renders in.
  let manifestOrder: readonly string[] = [];
  const unitIds = (units: unknown[]): string[] =>
    units.flatMap((u) => {
      const id = (u as { id?: unknown } | null)?.id;
      return typeof id === "string" ? [id] : [];
    });
  if (existsSync(manifestYamlPath)) {
    try {
      const content = readFileSync(manifestYamlPath, "utf8");
      const parsed = parseYaml(content) as { units?: unknown[] } | null;
      if (parsed && Array.isArray(parsed.units) && parsed.units.length > 0) {
        manifestHasUnits = true;
        manifestOrder = unitIds(parsed.units);
      }
    } catch {
      // ignore
    }
  } else if (existsSync(manifestJsonPath)) {
    try {
      const content = readFileSync(manifestJsonPath, "utf8");
      const parsed = JSON.parse(content) as { units?: unknown[] } | null;
      if (parsed && Array.isArray(parsed.units) && parsed.units.length > 0) {
        manifestHasUnits = true;
        manifestOrder = unitIds(parsed.units);
      }
    } catch {
      // ignore
    }
  }

  if (manifestHasUnits) {
    const sourceBlocksDir = join(rootDir, `content/source-blocks/${paperId}`);
    if (existsSync(sourceBlocksDir)) {
      const blockFiles = readdirSync(sourceBlocksDir)
        .filter(
          (f) =>
            (f.endsWith(".json") || f.endsWith(".yaml") || f.endsWith(".yml")) &&
            !f.startsWith("manifest"),
        )
        .sort();
      for (const file of blockFiles) {
        const filePath = join(sourceBlocksDir, file);
        const raw = readFileSync(filePath, "utf8");
        const data = file.endsWith(".json")
          ? JSON.parse(raw)
          : (parseYaml(raw) as Record<string, unknown>);
        if (isSourceBlockShaped(data)) {
          blocks.push(data as SourceBlock);
        }
      }
    }
    // PRINTED ORDER, NOT FILENAME ORDER. The files are named <id>.yaml, so readdir().sort() put
    // closing-dateline first and eq-s0-d1..d7 before the masthead, and every face renders blocks
    // in array order. The frozen manifest lists its units in the order they were printed; a block
    // it does not name follows, by its own `order` field and then its id.
    sortBlocksByManifest(blocks, manifestOrder);
  }

  // 3. Load translation units from content/translation-units/${paperId}
  const units: TranslationUnit[] = [];
  const translationDir = join(rootDir, `content/translation-units/${paperId}`);
  if (existsSync(translationDir)) {
    const translationFiles = readdirSync(translationDir)
      .filter((f) => f.endsWith(".json") || f.endsWith(".yaml") || f.endsWith(".yml"))
      .sort();
    for (const file of translationFiles) {
      const filePath = join(translationDir, file);
      const raw = readFileSync(filePath, "utf8");
      const data = file.endsWith(".json")
        ? JSON.parse(raw)
        : (parseYaml(raw) as Record<string, unknown>);
      if (isSourceBlockShaped(data)) {
        units.push(data as TranslationUnit);
      }
    }
  }

  // 4. Load gloss units from content/gloss-units/${paperId}
  const glossUnits: GlossUnit[] = [];
  const glossDir = join(rootDir, `content/gloss-units/${paperId}`);
  if (existsSync(glossDir)) {
    const glossFiles = readdirSync(glossDir)
      .filter((f) => f.endsWith(".json") || f.endsWith(".yaml") || f.endsWith(".yml"))
      .sort();
    for (const file of glossFiles) {
      const filePath = join(glossDir, file);
      const raw = readFileSync(filePath, "utf8");
      const data = file.endsWith(".json")
        ? JSON.parse(raw)
        : (parseYaml(raw) as Record<string, unknown>);
      if (isSourceBlockShaped(data)) {
        glossUnits.push(data as GlossUnit);
      }
    }
  }

  // If no blocks, units, or gloss units are available, return null
  if (blocks.length === 0 && units.length === 0 && glossUnits.length === 0) {
    return null;
  }

  // 5. If any layer exists, load paper payload to get canonical paper object
  try {
    const payload = await loadPaper(paperId);
    // THE BIBLIOGRAPHIC RECORD IS THE PAPER'S OWN, never a literal. This object used to carry
    // Annalen (4) 17, 1-1, DOI 10.1002/andp.1905 and a 1905 year-range for every paper, so the
    // German face printed "Annalen der Physik (4) 17, 1–1 (1905)" over mass-energy, which is
    // (4) 18, 639–641. The compiled paper names its citation key (content/papers/<slug>.json);
    // the key's provenance receipt holds the verified journal record and dated events, as the
    // home page's first pages already read them (firstPages.ts).
    const bibKey = payload.paper.citation;
    const identity = receiptPaperIdentity(rootDir, bibKey);
    const paper: Paper = {
      slug: (payload.paper.id ?? paperId) as Paper["slug"],
      bibKey,
      titleGerman: payload.paper.germanTitle ?? payload.paper.title,
      titleEnglishWorking: payload.paper.title,
      editorialAdditions: [],
      authorLine: "A. Einstein",
      dates: identity.dates.map(paperDateFromReceipt),
      journal: {
        name: identity.journal.name,
        series: identity.journal.series,
        volume: identity.journal.volume,
        wholeSeriesVolume: identity.journal.wholeSeriesVolume,
        issue: Number(identity.journal.issue),
        issueSource: identity.journal.issueSource,
        pages: { first: identity.journal.pages.first, last: identity.journal.pages.last },
        doi: identity.journal.doi,
        doiVerifiedAt: identity.journal.doiVerifiedAt,
      },
      collectedPapers: {
        volume: identity.collectedPapers.volume,
        document: identity.collectedPapers.document,
      },
      orderedBlockIds: [],
      companion: false,
      status: payload.paper.status ?? "published",
      sourceStatus: payload.paper.sourceStatus ?? "reviewed",
      sourceNotice: payload.paper.sourceNotice ?? "",
      sections: payload.paper.sections.map((s) => ({
        id: s.id,
        title: s.title,
        arguments: s.arguments ?? [],
      })),
    };

    // Optionally load alignment: content/alignments/${paperId}.yaml / .json
    let alignment: Alignment | undefined;
    const alignYamlPath = join(rootDir, `content/alignments/${paperId}.yaml`);
    const alignJsonPath = join(rootDir, `content/alignments/${paperId}.json`);
    if (existsSync(alignYamlPath)) {
      try {
        alignment = parseYaml(readFileSync(alignYamlPath, "utf8")) as Alignment;
      } catch {
        // Alignment remains undefined
      }
    } else if (existsSync(alignJsonPath)) {
      try {
        alignment = JSON.parse(readFileSync(alignJsonPath, "utf8")) as Alignment;
      } catch {
        // Alignment remains undefined
      }
    }

    return {
      paper,
      blocks,
      units,
      ...(glossUnits.length > 0 ? { glossUnits } : {}),
      ...(alignment ? { alignment } : {}),
    };
  } catch {
    return null;
  }
}
