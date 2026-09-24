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
