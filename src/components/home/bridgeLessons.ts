import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * THE NO-ALGEBRA ROUTE, read from the lesson records themselves.
 *
 * The front door linked /foundations/ zero times, and so does the site's chrome, so a reader who
 * needed a bridge had no door to one on the page they arrive at. This counts the bridge lessons
 * and finds the ones that assume nothing, so the sentence that offers them changes when the
 * records do rather than going stale the way the translation clause beside it did.
 *
 * "A bridge lesson" is a record whose id begins `bridge-`, which is the convention the foundations
 * index's own "No algebra needed" group is built from. A lesson "assumes nothing" when its
 * `prerequisites` array is empty: that is the record's own statement, not a judgement made here.
 */
export type BridgeLesson = Readonly<{
  id: string;
  title: string;
  /** No prerequisites recorded, so a reader can open it first. */
  assumesNothing: boolean;
}>;

type FoundationRecord = Readonly<{
  kind?: unknown;
  id?: unknown;
  title?: unknown;
  prerequisites?: unknown;
}>;

export function bridgeLessons(root: string = process.cwd()): readonly BridgeLesson[] {
  const dir = join(root, "content", "foundations");
  return readdirSync(dir)
    .filter((file) => file.startsWith("bridge-") && file.endsWith(".json"))
    .sort()
    .flatMap((file) => {
      const record = JSON.parse(readFileSync(join(dir, file), "utf8")) as FoundationRecord;
      if (
        record.kind !== "foundation" ||
        typeof record.id !== "string" ||
        typeof record.title !== "string" ||
        !record.title.trim()
      )
        return [];
      return [
        {
          id: record.id,
          title: record.title,
          assumesNothing: Array.isArray(record.prerequisites)
            ? record.prerequisites.length === 0
            : false,
        },
      ];
    });
}

const COUNT_WORDS = [
  "no",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
] as const;

/**
 * A count word that opens a sentence needs its capital: countInWords gives "two", and
 * "two assume nothing at all" was rendered mid-paragraph as the start of a sentence.
 */
export function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A small count reads as a word in running prose; a larger one stays a numeral. */
export function countInWords(count: number): string {
  return COUNT_WORDS[count] ?? String(count);
}
