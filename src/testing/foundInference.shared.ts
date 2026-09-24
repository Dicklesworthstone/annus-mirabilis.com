import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

export function lesson(slug: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(ROOT, "content/foundations", `${slug}.json`), "utf8"));
}

/** Every string of a record, joined with spaces, with inline-math delimiters removed. */
export function lessonText(slug: string): string {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) for (const x of v) walk(x);
    else if (v && typeof v === "object") for (const x of Object.values(v)) walk(x);
  };
  walk(lesson(slug));
  return out.join(" ").replace(/\\[()]/g, "");
}

/** Sentences, split at a full stop followed by a space. */
export const sentences = (text: string): readonly string[] => text.split(/(?<=[.?!])\s+/);

/** Whether a prerequisite id names a lesson record that exists, so its link resolves. */
export const lessonExists = (id: string): boolean =>
  existsSync(join(ROOT, "content/foundations", `${id.replace(/^foundation:/, "")}.json`));

/** Every foundation link in the argument readings: the calling file, the lesson named, the caption. */
export function foundationLinks(): readonly Readonly<{
  path: string;
  id: string;
  caption: unknown;
}>[] {
  const links: { path: string; id: string; caption: unknown }[] = [];
  const walk = (path: string, value: unknown): void => {
    if (Array.isArray(value)) {
      for (const v of value) walk(path, v);
    } else if (value && typeof value === "object") {
      const o = value as Record<string, unknown>;
      if (o.kind === "foundation" && typeof o.id === "string")
        links.push({ path, id: o.id.replace(/^foundation:/, ""), caption: o.returnCaption });
      for (const v of Object.values(o)) walk(path, v);
    }
  };
  const visit = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) visit(full);
      else if (e.name.endsWith(".json")) walk(full, JSON.parse(readFileSync(full, "utf8")));
    }
  };
  visit(join(ROOT, "content/arguments"));
  return links;
}
