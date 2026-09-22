/** Source-page navigation is projected from pinned records and the source inventory.
 * It never infers a transcription, translation, or editorial review from a PDF pin.
 */
export type FacsimilePage = Readonly<{ pdfPage: number; printedPage: number }>;
export type FacsimileUnit = Readonly<{
  id: string;
  aliases: readonly string[];
  kind: string;
  section: string | null;
  pdfPages: readonly number[];
}>;
export type FacsimileDocument = Readonly<{
  paperId: string;
  key: string;
  pdfUrl: string;
  sha256: string;
  originUrl: string;
  acquisitionDate: string;
  rightsStatus: string;
  /** The holding institution named on the pinned candidate, or null when none is recorded. */
  scanInstitution: string | null;
  /** The candidate's terms statement, validated as a public HTTPS URL, or null. */
  termsUrl: string | null;
  inventoryStatus: string | null;
  pages: readonly FacsimilePage[];
  units: readonly FacsimileUnit[];
}>;

export class FacsimileDataError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "FacsimileDataError";
    this.code = code;
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new FacsimileDataError("facsimile-data-invalid", `${label} must be a record.`);
  }
  return value as Record<string, unknown>;
}
function requireData(condition: unknown, message: string): asserts condition {
  if (!condition) throw new FacsimileDataError("facsimile-data-invalid", message);
}
function integer(value: unknown, minimum = 1): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;
}
function identifier(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9._:-]{0,159}$/.test(value);
}
function sectionFor(unit: Record<string, unknown>): string | null {
  if (unit.section !== undefined) {
    requireData(
      typeof unit.section === "string" && /^s\d+$/.test(unit.section),
      "Invalid source section.",
    );
    return unit.section;
  }
  // These are the source-id grammar's section tags, not an estimate from paragraph order.
  const match = String(unit.id).match(/(?:^|-)s(\d+)(?:-|$)/);
  return match ? `s${match[1]}` : null;
}

/** Null means no published pin, not permission to expose a local-only source. */
export function projectFacsimileDocument(
  paperId: string,
  key: string,
  rawConfig: unknown,
  rawInventory: unknown = null,
): FacsimileDocument | null {
  requireData(/^[a-z]+(?:-[a-z]+)*$/.test(paperId), "Invalid paper slug.");
  requireData(/^ap-\d+-\d+$/.test(key), "Invalid bibliographic key.");
  const config = record(rawConfig, "Facsimile configuration");
  requireData(
    config.configVersion === 1 && config.key === key,
    "The pin belongs to a different document or schema.",
  );
  const rights = record(config.rights, "Publication decision");
  requireData(
    ["publish", "pin-local-only", "reference-only"].includes(String(rights.publicationDecision)),
    "Unknown publication decision.",
  );
  if (rights.publicationDecision !== "publish" || config.pinned === undefined) return null;
  const pin = record(config.pinned, "Pinned PDF");
  const article = record(config.articlePages, "Printed-page map");
  requireData(
    pin.path === `public/papers/pdfs/${key}.pdf`,
    "Only the canonical same-origin PDF path may be published.",
  );
  requireData(pin.mimeType === "application/pdf", "The source is not declared as a PDF.");
  requireData(
    typeof pin.sha256 === "string" && /^[a-f0-9]{64}$/.test(pin.sha256),
    "The pin needs a SHA-256 digest.",
  );
  requireData(
    integer(pin.pageCount) && pin.pageCount <= 256,
    "Invalid or excessive PDF page count.",
  );
  requireData(
    integer(article.printedFirst) && integer(article.printedLast),
    "Missing printed-page range.",
  );
  requireData(
    article.printedLast - article.printedFirst + 1 === pin.pageCount,
    "Printed and extracted page counts disagree.",
  );
  requireData(typeof pin.originUrl === "string", "Missing source origin.");
  let origin: URL;
  try {
    origin = new URL(pin.originUrl);
  } catch {
    throw new FacsimileDataError("facsimile-data-invalid", "Invalid source origin.");
  }
  requireData(
    origin.protocol === "https:" && !origin.username && !origin.password,
    "Source origins must be public HTTPS URLs.",
  );
  requireData(
    typeof pin.acquisitionDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(pin.acquisitionDate),
    "Missing acquisition date.",
  );
  requireData(
    typeof rights.rightsStatus === "string" && rights.rightsStatus.length > 0,
    "Missing rights status.",
  );

  // A correct page count alone cannot distinguish an extract from the wrong issue window.
  const indices = article.parentPageIndices;
  const anchor = record(
    config.verifiedAnchor ?? article.verifiedAnchor,
    "Verified printed-page anchor",
  );
  requireData(
    integer(anchor.parentPageIndex, 0) &&
      integer(anchor.printedPage) &&
      typeof anchor.verifiedBy === "string" &&
      anchor.verifiedBy.trim().length > 0,
    "Missing verified page anchor.",
  );
  requireData(
    Array.isArray(indices) && indices.length === pin.pageCount,
    "Missing explicit parent-page map.",
  );
  const expectedFirst = anchor.parentPageIndex + article.printedFirst - anchor.printedPage;
  requireData(
    indices.every((index, i) => integer(index, 0) && index === expectedFirst + i),
    "The extract disagrees with its verified printed-page anchor.",
  );
  if (pin.parent !== undefined) {
    const parent = record(pin.parent, "Pinned parent");
    const parentPageCount = parent.pageCount;
    requireData(
      integer(parentPageCount) && indices.every((index) => index < parentPageCount),
      "An extracted page lies outside its parent.",
    );
    requireData(
      Array.isArray(parent.parentPageIndices) &&
        parent.parentPageIndices.length === indices.length &&
        parent.parentPageIndices.every((index, i) => index === indices[i]),
      "The pinned extract and configured parent-page maps disagree.",
    );
  }

  const pages = Object.freeze(
    Array.from({ length: pin.pageCount }, (_, i) =>
      Object.freeze({
        pdfPage: i + 1,
        printedPage: (article.printedFirst as number) + i,
      }),
    ),
  );
  const units: FacsimileUnit[] = [];
  const seen = new Set<string>();
  let inventoryStatus: string | null = null;
  if (rawInventory !== null) {
    const inventory = record(rawInventory, "Source inventory");
    requireData(
      inventory.paper === paperId && inventory.document === key,
      "The source inventory belongs to another document.",
    );
    requireData(
      inventory.pageCount === pages.length &&
        Array.isArray(inventory.pageRange) &&
        inventory.pageRange.length === 2 &&
        inventory.pageRange[0] === article.printedFirst &&
        inventory.pageRange[1] === article.printedLast,
      "The inventory and pinned printed-page ranges disagree.",
    );
    requireData(
      Array.isArray(inventory.units) && inventory.units.length <= 10_000,
      "Invalid source inventory units.",
    );
    inventoryStatus = typeof inventory.status === "string" ? inventory.status : null;
    for (const raw of inventory.units) {
      const unit = record(raw, "Source unit");
      requireData(
        identifier(unit.id) && typeof unit.kind === "string",
        "A source unit needs an id and kind.",
      );
      requireData(
        !unit.id.startsWith("facsimile-page-"),
        "A source id collides with the page-navigation namespace.",
      );
      requireData(
        Array.isArray(unit.locators) && unit.locators.length > 0,
        "A source unit needs an explicit printed-page locator.",
      );
      const pdfPages = [
        ...new Set(
          unit.locators.map((rawLocator) => {
            const locator = record(rawLocator, "Source locator");
            const page = pages.find((candidate) => candidate.printedPage === locator.page);
            requireData(page, "A source locator lies outside the pinned paper.");
            return page.pdfPage;
          }),
        ),
      ].sort((a, b) => a - b);
      const destination =
        unit.destination === undefined ? null : record(unit.destination, "Source destination");
      const alias = destination?.editionBlockId;
      requireData(alias === undefined || identifier(alias), "Invalid edition-block alias.");
      const aliases = alias && alias !== unit.id ? [alias] : [];
      requireData(!seen.has(unit.id), "Duplicate source-page anchor.");
      requireData(
        aliases.every((id) => !id.startsWith("facsimile-page-")),
        "An alias collides with page navigation.",
      );
      seen.add(unit.id);
      units.push(
        Object.freeze({
          id: unit.id,
          kind: unit.kind,
          section: sectionFor(unit),
          aliases: Object.freeze(aliases),
          pdfPages: Object.freeze(pdfPages),
        }),
      );
    }
  }
  /*
    WHOSE SCAN IT IS, in words rather than as a token.

    The panel printed only `rightsStatus`, which is "scan-open-terms" - a machine identifier. A
    reader cannot tell from that whose terms they are, and AGENTS.md is explicit that a particular
    scan can carry the scanning institution's terms and that the URL, retrieval date and stated
    terms must be recorded. They WERE recorded, in the candidate this pin was taken from; they
    simply never reached the projection.

    `pinned.candidateIndex` names that candidate, so this reads the recorded one rather than
    guessing at candidates[0]. Both fields resolve to null when absent or malformed: a missing
    institution is a gap in a receipt, not grounds to refuse a scan that has already verified by
    digest. The terms URL is held to the same public-HTTPS rule as originUrl, because an
    unvalidated URL rendered as a link is the thing that rule exists to prevent.
  */
  const candidates = Array.isArray(config.candidates) ? config.candidates : [];
  const pinnedCandidate =
    typeof pin.candidateIndex === "number" && Number.isSafeInteger(pin.candidateIndex)
      ? candidates[pin.candidateIndex]
      : undefined;
  const candidateRecord =
    pinnedCandidate !== null &&
    typeof pinnedCandidate === "object" &&
    !Array.isArray(pinnedCandidate)
      ? (pinnedCandidate as Record<string, unknown>)
      : undefined;
  const scanInstitution =
    typeof candidateRecord?.institution === "string" &&
    candidateRecord.institution.trim().length > 0
      ? candidateRecord.institution.trim()
      : null;
  let termsUrl: string | null = null;
  const termsList = candidateRecord?.termsStatementUrls;
  if (Array.isArray(termsList) && typeof termsList[0] === "string") {
    try {
      const parsed = new URL(termsList[0]);
      if (parsed.protocol === "https:" && !parsed.username && !parsed.password) {
        termsUrl = parsed.href;
      }
    } catch {
      termsUrl = null;
    }
  }

  return Object.freeze({
    paperId,
    key,
    pdfUrl: `/${pin.path.slice(7)}`,
    sha256: pin.sha256,
    originUrl: origin.href,
    acquisitionDate: pin.acquisitionDate,
    rightsStatus: rights.rightsStatus,
    scanInstitution,
    termsUrl,
    inventoryStatus,
    pages,
    units: Object.freeze(units),
  });
}

/** Section pages come from recorded source units; no proportional page estimates. */
export function facsimileSectionPages(
  document: FacsimileDocument,
  section?: string,
): readonly FacsimilePage[] {
  if (!section) return document.pages;
  const selected = new Set(
    document.units.filter((unit) => unit.section === section).flatMap((unit) => [...unit.pdfPages]),
  );
  return document.pages.filter((page) => selected.has(page.pdfPage));
}
export function facsimilePageAnchor(page: FacsimilePage): string {
  return `facsimile-page-${page.printedPage}`;
}
export function facsimilePdfHref(document: FacsimileDocument, pdfPage: number): string {
  if (!document.pages.some((page) => page.pdfPage === pdfPage)) {
    throw new FacsimileDataError(
      "facsimile-page-out-of-range",
      "Choose a page in this pinned paper.",
    );
  }
  return `${document.pdfUrl}#page=${pdfPage}`;
}

/** URL fragments are untrusted, including malformed percent escapes and stale source ids. */
export function resolveFacsimileTarget(
  document: FacsimileDocument,
  fragment: string,
): number | null {
  if (!fragment || fragment.length > 512) return null;
  let id: string;
  try {
    id = decodeURIComponent(fragment.startsWith("#") ? fragment.slice(1) : fragment);
  } catch {
    return null;
  }
  const page = document.pages.find((candidate) => facsimilePageAnchor(candidate) === id);
  if (page) return page.pdfPage;
  const unit = document.units.find((candidate) => candidate.id === id);
  if (unit) return unit.pdfPages[0] ?? null;
  // Several inventoried units may feed one edition block. Preserve that many-to-one
  // mapping, while a canonical source id always keeps its own recorded meaning.
  const aliasPages = document.units
    .filter((candidate) => candidate.aliases.includes(id))
    .flatMap((candidate) => [...candidate.pdfPages]);
  if (aliasPages.length > 0) return Math.min(...aliasPages);
  // A section may have no heading unit (the unnumbered mass-energy paper has s0).
  if (/^s\d+$/.test(id)) return facsimileSectionPages(document, id)[0]?.pdfPage ?? null;
  return null;
}
