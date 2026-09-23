/** Bounded, versioned static source-map transport. No Node imports in the client graph. */
import { FacsimileDataError, type FacsimileDocument, type FacsimileUnit } from "./document.ts";

export type FacsimileAvailability =
  | Readonly<{ kind: "available"; document: FacsimileDocument }>
  | Readonly<{ kind: "unavailable"; code: string; message: string }>;
export const FACSIMILE_WIRE_VERSION = 1;
export const FACSIMILE_WIRE_BYTES = 1_048_576;

function requireData(condition: unknown, message: string): asserts condition {
  if (!condition) throw new FacsimileDataError("facsimile-response-invalid", message);
}
function record(value: unknown): Record<string, unknown> {
  requireData(
    value !== null && typeof value === "object" && !Array.isArray(value),
    "Expected a source-map record.",
  );
  return value as Record<string, unknown>;
}
function text(value: unknown, maximum = 160): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum;
}
function identifier(value: unknown): value is string {
  return text(value) && /^[a-z][a-z0-9._:-]*$/.test(value) && !value.startsWith("facsimile-page-");
}
function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function facsimileMapPath(paperId: string): string {
  requireData(/^[a-z]+(?:-[a-z]+)*$/.test(paperId), "Invalid paper identity.");
  return `/papers/${paperId}/facsimile.json`;
}

export function decodeFacsimileAvailability(raw: unknown, paperId: string): FacsimileAvailability {
  facsimileMapPath(paperId);
  const envelope = record(raw);
  requireData(envelope.schemaVersion === FACSIMILE_WIRE_VERSION, "Unsupported source-map version.");
  if (envelope.kind === "unavailable") {
    requireData(
      text(envelope.code) && text(envelope.message, 2000),
      "Missing source-unavailability explanation.",
    );
    return Object.freeze({ kind: "unavailable", code: envelope.code, message: envelope.message });
  }
  requireData(envelope.kind === "available", "Unknown source availability.");
  const source = record(envelope.document);
  requireData(
    source.paperId === paperId && text(source.key) && /^ap-\d+-\d+$/.test(source.key),
    "The source belongs to another paper.",
  );
  requireData(
    source.pdfUrl === `/papers/pdfs/${source.key}.pdf`,
    "Only the canonical local source URL is admitted.",
  );
  requireData(
    typeof source.sha256 === "string" && /^[a-f0-9]{64}$/.test(source.sha256),
    "Invalid source digest.",
  );
  requireData(text(source.originUrl, 4096), "Missing source origin.");
  let origin: URL;
  try {
    origin = new URL(source.originUrl);
  } catch {
    throw new FacsimileDataError("facsimile-response-invalid", "Invalid source origin.");
  }
  requireData(
    origin.protocol === "https:" && !origin.username && !origin.password,
    "Invalid archival origin.",
  );
  requireData(
    text(source.acquisitionDate) && /^\d{4}-\d{2}-\d{2}$/.test(source.acquisitionDate),
    "Invalid acquisition date.",
  );
  requireData(
    text(source.rightsStatus) && (source.inventoryStatus === null || text(source.inventoryStatus)),
    "Invalid source status.",
  );
  requireData(
    Array.isArray(source.pages) && source.pages.length > 0 && source.pages.length <= 256,
    "Invalid source page count.",
  );
  const pages = source.pages.map((rawPage, index) => {
    const page = record(rawPage);
    requireData(
      page.pdfPage === index + 1 && positiveInteger(page.printedPage),
      "Invalid source page map.",
    );
    return Object.freeze({ pdfPage: index + 1, printedPage: page.printedPage });
  });
  const first = pages[0];
  requireData(
    first && pages.every((page, index) => page.printedPage === first.printedPage + index),
    "Non-contiguous source page map.",
  );
  requireData(
    Array.isArray(source.units) && source.units.length <= 10_000,
    "Invalid source-unit list.",
  );
  const seen = new Set<string>();
  const units: FacsimileUnit[] = source.units.map((rawUnit) => {
    const unit = record(rawUnit);
    requireData(
      identifier(unit.id) && !seen.has(unit.id) && text(unit.kind),
      "Invalid or duplicate source unit.",
    );
    seen.add(unit.id);
    requireData(
      unit.section === null || (text(unit.section) && /^s\d+$/.test(unit.section)),
      "Invalid source section.",
    );
    requireData(
      Array.isArray(unit.aliases) && unit.aliases.length <= 32 && unit.aliases.every(identifier),
      "Invalid source aliases.",
    );
    requireData(
      Array.isArray(unit.pdfPages) &&
        unit.pdfPages.length > 0 &&
        unit.pdfPages.length <= pages.length,
      "Missing source locators.",
    );
    const locators: number[] = [];
    for (const page of unit.pdfPages) {
      requireData(
        positiveInteger(page) &&
          page <= pages.length &&
          (locators.length === 0 || page > (locators.at(-1) ?? 0)),
        "Invalid source locator.",
      );
      locators.push(page);
    }
    return Object.freeze({
      id: unit.id,
      kind: unit.kind,
      section: unit.section,
      aliases: Object.freeze([...unit.aliases]),
      pdfPages: Object.freeze(locators),
    });
  });
  return Object.freeze({
    kind: "available",
    document: Object.freeze({
      paperId,
      key: source.key,
      pdfUrl: `/papers/pdfs/${source.key}.pdf`,
      sha256: source.sha256,
      originUrl: origin.href,
      acquisitionDate: source.acquisitionDate,
      rightsStatus: source.rightsStatus,
      // Carried across the wire so the reader is told whose scan it is, not only a rights token.
      // Both are nullable by construction: a receipt that records neither is a gap in the
      // receipt, and the panel simply omits the line rather than inventing an attribution.
      scanInstitution: typeof source.scanInstitution === "string" ? source.scanInstitution : null,
      termsUrl: typeof source.termsUrl === "string" ? source.termsUrl : null,
      inventoryStatus: source.inventoryStatus,
      pages: Object.freeze(pages),
      units: Object.freeze(units),
      // Only the one directory the server loader can name for this key; anything else is dropped
      // and the panel falls back to the PDF frame.
      plateDir:
        source.plateDir === `/figures/plates/pages/${source.key}` ? source.plateDir : undefined,
    }),
  });
}

/** Enforce the actual streamed byte count, not just an optional Content-Length header. */
export async function readFacsimileResponse(
  response: Response,
  paperId: string,
): Promise<FacsimileAvailability> {
  requireData(response.ok && response.body, "The source-map request failed.");
  requireData(
    response.headers.get("content-type")?.split(";")[0]?.trim() === "application/json",
    "Expected a JSON source map, not an HTML fallback.",
  );
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let length = 0;
  let json = "";
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      requireData(length <= FACSIMILE_WIRE_BYTES, "The source map exceeded its byte budget.");
      json += decoder.decode(part.value, { stream: true });
    }
    json += decoder.decode();
    return decodeFacsimileAvailability(JSON.parse(json), paperId);
  } catch (error) {
    try {
      await reader.cancel();
    } catch {
      /* Preserve the original transport/validation failure. */
    }
    throw error;
  } finally {
    reader.releaseLock();
  }
}
