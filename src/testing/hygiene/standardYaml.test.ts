/**
 * Every content record and every receipt's frontmatter is standard YAML
 * (am-rc1001-bridge-plan-pcjk.37).
 *
 * The site reads YAML with its own parsers (src/content/schemas/strictParse.ts and
 * src/content/provenance/yaml.ts), which accept escapes the YAML specification does not: `\;` and
 * `\'` inside a double-quoted scalar. Two files carried them on 2026-10-01, and any other tool that
 * reads this corpus (an export consumer, a reviewer's script, PyYAML) refused both. This reads the
 * FILES with Bun's spec parser, not the site loader's output, which is the parser that hid them.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const yaml = (Bun as unknown as { YAML: { parse(text: string): unknown } }).YAML;

/** A receipt's frontmatter, or undefined when it has none. */
export function frontmatter(text: string): string | undefined {
  return /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1];
}

/** The parse errors of the given texts, as "<name>: <message>". */
export function standardYamlErrors(texts: readonly { name: string; text: string }[]): string[] {
  const errors: string[] = [];
  for (const { name, text } of texts) {
    try {
      yaml.parse(text);
    } catch (error) {
      errors.push(`${name}: ${String(error).slice(0, 160)}`);
    }
  }
  return errors;
}

describe("the standard parser refuses what the site's parsers let through", () => {
  test("the two escapes found on 2026-10-01 are refused, and their repairs accepted", () => {
    expect(standardYamlErrors([{ name: "semicolon", text: 'a: "x \\; t"' }])).toHaveLength(1);
    expect(standardYamlErrors([{ name: "quote", text: "a: \"(X\\', Y\\')\"" }])).toHaveLength(1);
    expect(standardYamlErrors([{ name: "semicolon", text: 'a: "x \\\\; t"' }])).toEqual([]);
    expect(standardYamlErrors([{ name: "quote", text: "a: \"(X', Y')\"" }])).toEqual([]);
  });
});

describe("content/**/*.yaml and the receipts' frontmatter parse as standard YAML", () => {
  const content = (readdirSync(join(ROOT, "content"), { recursive: true }) as string[])
    .filter((path) => path.endsWith(".yaml"))
    .map((path) => ({
      name: `content/${path}`,
      text: readFileSync(join(ROOT, "content", path), "utf8"),
    }));
  const receipts = readdirSync(join(ROOT, "docs", "provenance"))
    .filter((name) => name.endsWith(".md"))
    .flatMap((name) => {
      const text = frontmatter(readFileSync(join(ROOT, "docs", "provenance", name), "utf8"));
      return text === undefined ? [] : [{ name: `docs/provenance/${name}`, text }];
    });

  test("every file parses", () => {
    const errors = standardYamlErrors([...content, ...receipts]);
    console.log(
      `standard YAML: parsed ${content.length + receipts.length} files (${content.length} content, ${receipts.length} receipts), ${errors.length} errors`,
    );
    // Measured 2026-10-02: 2,267 content files and 6 receipts. Floors, not a census.
    expect(content.length).toBeGreaterThan(2000);
    expect(receipts.length).toBeGreaterThanOrEqual(6);
    expect(errors).toEqual([]);
  });
});
