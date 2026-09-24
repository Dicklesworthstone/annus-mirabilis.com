import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * One share control per laboratory (am-inst-permalink-tape-s677, dispatch 156). A lab that shares a
 * ?tape= link offers that link only; its older settings link still loads when opened, since its
 * decoder stays, but the lab no longer writes one. LQ-05, LQ-07 and ME-03 drew two link buttons
 * until this.
 *
 * Read from import statements, not text: a component that imports an encode…Settings function is
 * one that can still write the older link.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const labs = resolve(root, "src/components/lab");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return name.endsWith(".tsx") && !name.includes(".test.") ? [path] : [];
  });
}

/** The names each import statement brings in, from the statements alone. */
function importedNames(source: string): string[] {
  return [...source.matchAll(/^import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"[^"]+";/gm)].flatMap(
    ([, names]) =>
      (names ?? "")
        .split(",")
        .map((n) => n.trim().replace(/^type\s+/, ""))
        .filter(Boolean),
  );
}

describe("a lab that shares a tape offers no second link", () => {
  const files = tsxFiles(labs);
  const tapeLabs = files.filter((f) =>
    importedNames(readFileSync(f, "utf8")).some(
      (n) => n === "useLabTapeLink" || n === "useDraftTapeLink",
    ),
  );

  test("the labs that share a tape are found (a floor, not a census)", () => {
    console.log(
      `[one share control] ${tapeLabs.length} labs share a tape, of ${files.length} files`,
    );
    expect(tapeLabs.length).toBeGreaterThan(10);
  });

  test("none of them still imports an encoder for its older settings link", () => {
    const both = tapeLabs
      .map((f) => ({
        file: relative(root, f),
        encoders: importedNames(readFileSync(f, "utf8")).filter((n) =>
          /^encode[A-Z][A-Za-z0-9]*Settings$/.test(n),
        ),
      }))
      .filter((f) => f.encoders.length > 0);
    expect(both).toEqual([]);
  });
});
