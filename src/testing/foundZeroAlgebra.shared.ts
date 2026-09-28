import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The four zero-assumed-algebra bridges owned by am-found-zero-algebra-rest-oipl. */
export const BRIDGES = [
  "bridge-letter-for-quantity",
  "bridge-equals-sign-relationship",
  "bridge-mathematical-punctuation",
  "bridge-probability-notation",
] as const;

export type BridgeRecord = Readonly<{
  kind: string;
  id: string;
  explanation: readonly Readonly<{ kind: string; text?: string }>[];
  stoppingPoint: string;
}>;

const ROOT = process.cwd();

export function bridge(slug: string): BridgeRecord {
  return JSON.parse(readFileSync(join(ROOT, "content/foundations", `${slug}.json`), "utf8"));
}

/** Every string in a record, joined with spaces. */
export function allText(value: unknown): string {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(value);
  return out.join(" ");
}

/** The paragraphs of a record's explanation, the part the vocabulary rule governs. */
export function explanationText(record: BridgeRecord): string {
  return record.explanation.map((b) => b.text ?? "").join(" ");
}

/** Every argument record under content/arguments, with its path. */
export function argumentRecords(): readonly Readonly<{ path: string; json: unknown }>[] {
  const out: { path: string; json: unknown }[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".json"))
        out.push({ path: full, json: JSON.parse(readFileSync(full, "utf8")) });
    }
  };
  walk(join(ROOT, "content/arguments"));
  return out;
}

// ---- Reading a lesson's prose, for checks that must survive a rewording ------------------------
//
// Added for dispatch 413. Two files ask different questions of the same text and were about to
// grow two copies of this: foundSlice.numbers.test.ts asks whether a lesson's prose states
// arithmetic that is actually correct, and foundBridges.prose.test.ts asks whether it states the
// numbers its FIGURE draws. One matcher, two consumers.

export type LessonBlock = Readonly<{ kind: string; text?: string; items?: readonly string[] }>;
export type LessonRecord = Readonly<{
  question?: string;
  summary?: string;
  explanation?: readonly LessonBlock[];
  exampleTitle?: string;
  example?: readonly LessonBlock[];
  stoppingPoint?: string;
}>;

/**
 * The reader-facing passages of a lesson: question, summary, exampleTitle, stoppingPoint, each
 * explanation and example paragraph, and each step list joined into one passage, because a step
 * list is one argument broken across lines and its numbers belong to each other.
 *
 * It does not read id, kind, review, prerequisites or citations, which carry no prose, and it does
 * not read a formula block's `latex`: mean-variance-rms prints \frac{1}{M}\sum_{i=1}^{M} and
 * bridge-squaring-square-roots \sqrt{4q}=2\sqrt q, where every digit belongs to a command name, an
 * exponent or a subscript rather than to a sentence a reader reads.
 */
export function passagesOf(record: LessonRecord): readonly string[] {
  const out: string[] = [];
  for (const s of [record.question, record.summary, record.exampleTitle, record.stoppingPoint])
    if (typeof s === "string") out.push(s);
  for (const blocks of [record.explanation, record.example])
    for (const b of blocks ?? []) {
      if (b.kind === "formula") continue;
      if (typeof b.text === "string") out.push(b.text);
      if (Array.isArray(b.items)) out.push(b.items.join(" "));
    }
  return out;
}

/** Sentences of a passage. Splitting on a period plus space leaves 0.001 and 1.4 intact. */
export function sentences(text: string): readonly string[] {
  return text
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const escapeForRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Does this unit of text hold the token? A token that begins and ends with a word character is
 * matched on word boundaries, so a required "8" is not satisfied by the 8 inside 18 or 0.8; one
 * that does not, such as a list opening with a minus sign, is matched literally.
 */
export function holds(unit: string, token: string): boolean {
  const bounded = /^\w/.test(token) && /\w$/.test(token);
  return bounded ? new RegExp(`\\b${escapeForRegExp(token)}\\b`).test(unit) : unit.includes(token);
}

/**
 * The first unit in which every token of some form appears, or null. Alternatives exist because
 * records write the same values more than one way. A form is a conjunction: all of its tokens in
 * ONE unit, which is what stops a number matching on a sentence that is not about it.
 */
export function matchIn(
  units: readonly string[],
  forms: readonly (readonly string[])[],
): string | null {
  for (const form of forms)
    for (const unit of units) if (form.every((token) => holds(unit, token))) return unit;
  return null;
}
