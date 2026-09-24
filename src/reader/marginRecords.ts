/**
 * A PAPER'S MISCONCEPTIONS AND MARGIN NOTES, read from content for its explanation page
 * (dispatch 163, am-me-misconceptions-tr18, am-me-margin-entries-kfg5). Server-only: it reads
 * `content/misconceptions/<paper>/` and `content/editorial-notes/<paper>/` from disk at build time.
 *
 * Everything the page will show is checked here, so a bad record fails the build rather than
 * reaching a reader: the record's schema, the shape of its "what is true" readings, every inline
 * formula against the formula allowlist, every instrument id against the registry, and every
 * source a note cites against content/bibliography. The files are JSON because the content
 * compiler reads JSON only; a YAML file in these directories would be skipped by it silently, so it
 * is refused here instead.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { splitInlineMath } from "../content/inlineMath.ts";
import { type Misconception, validateMisconception } from "../content/schemas/argument.ts";
import { validateMath, validateReadingRecord } from "../content/schemas/reading.ts";
import { type EditorialNote, validateEditorialNote } from "../content/schemas/source.ts";
import { REGISTERED_IDS } from "../experiments/catalogue.ts";
import { parseWhatIsTrue } from "./misconceptions/types.ts";

/** A refusal from this loader, with a code a test can name (src/testing/refusals). */
export class MarginRecordError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "MarginRecordError";
    this.code = code;
  }
}

export type MarginCitation = Readonly<{ id: string; title: string; locator: string; url: string }>;

export type PaperMargins = Readonly<{
  misconceptions: readonly Misconception[];
  notes: readonly EditorialNote[];
  citations: ReadonlyMap<string, MarginCitation>;
}>;

function jsonRecords(dir: string): { path: string; value: unknown }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => !name.startsWith("."))
    .sort()
    .map((name) => {
      const path = join(dir, name);
      if (!name.endsWith(".json"))
        throw new MarginRecordError(
          "margin-record-not-json",
          `${path}: margin records are JSON; the content compiler skips other files.`,
        );
      return { path, value: JSON.parse(readFileSync(path, "utf8")) as unknown };
    });
}

function checkInlineMath(text: string, where: string): void {
  for (const segment of splitInlineMath(text))
    if (segment.kind === "math") validateMath(segment.value, `${where} inline math`);
}

export function loadPaperMargins(paper: string, root: string = process.cwd()): PaperMargins {
  const registered = new Set<string>(REGISTERED_IDS);

  const misconceptions = jsonRecords(join(root, "content", "misconceptions", paper)).map(
    ({ path, value }) => {
      const record = validateMisconception(value, path);
      if (record.paper !== paper)
        throw new MarginRecordError(
          "margin-record-paper-mismatch",
          `${path}: filed under ${paper}, names ${record.paper}.`,
        );
      const readings = parseWhatIsTrue(record.whatIsTrue, record.id);
      const texts = [
        ...record.temptingClaims,
        record.whyTempting,
        record.whereItIsTrue,
        readings.r0,
        readings.r1,
        readings.r2,
        ...(readings.r3 ? [readings.r3] : []),
        ...(record.staticTreatment ? [record.staticTreatment.reason] : []),
      ];
      for (const text of texts) checkInlineMath(text, path);
      for (const id of record.instrumentIds ?? [])
        if (!registered.has(id))
          throw new MarginRecordError(
            "margin-instrument-unregistered",
            `${path}: instrument "${id}" is not registered.`,
          );
      return record;
    },
  );

  const citations = new Map<string, MarginCitation>();
  const cite = (id: string, from: string): void => {
    if (citations.has(id)) return;
    const path = join(root, "content", "bibliography", `${id}.json`);
    if (!existsSync(path))
      throw new MarginRecordError(
        "margin-citation-missing",
        `${from}: cites "${id}", which has no bibliography record.`,
      );
    const record = validateReadingRecord(JSON.parse(readFileSync(path, "utf8")), path);
    if (record.kind !== "citation")
      throw new MarginRecordError("margin-citation-wrong-kind", `${path}: is not a citation.`);
    citations.set(id, { id, title: record.title, locator: record.locator, url: record.url });
  };

  const notes = jsonRecords(join(root, "content", "editorial-notes", paper)).map(
    ({ path, value }) => {
      const record = validateEditorialNote(value, path);
      checkInlineMath(record.claim, path);
      if (record.sourceSupport.length === 0)
        throw new MarginRecordError(
          "margin-note-uncited",
          `${path}: a margin note cites no source.`,
        );
      for (const source of record.sourceSupport) cite(source.citationId, path);
      return record;
    },
  );

  const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return {
    misconceptions: [...misconceptions].sort(byId),
    notes: [...notes].sort(byId),
    citations,
  };
}
