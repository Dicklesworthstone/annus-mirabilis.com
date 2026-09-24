import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadReadingFiles } from "../../../scripts/build-content.ts";
import { compileReadingContent } from "../compiler/compile.ts";
import { compileContent } from "../compiler/compiler.ts";
import { ContentError } from "../compiler/json.ts";
import { foundationExtensionIssues, validateFoundationExtension } from "./reading.ts";

/**
 * Extension sections (am-found-statistics-inference-pzqv, option B as ruled by the orchestrator):
 * a record under content/foundations/extensions/ is checked like a lesson's own blocks, and both
 * content compilers refuse one that is malformed, misnamed, or extends a lesson that does not
 * exist. Until this check, both compilers skipped these records entirely.
 */

const section = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  kind: "foundation-extension",
  id: "fixture-extension",
  targetFoundation: "foundation:gaussian-distributions",
  ownerBead: "am-found-statistics-inference-pzqv",
  title: "A fixture extension",
  body: [
    { kind: "paragraph", text: "A paragraph with inline mathematics, \\(x^2\\)." },
    { kind: "formula", latex: "\\frac{1}{2}", spoken: "one half" },
  ],
  citations: [],
  ...overrides,
});

const refusal = (input: unknown): string | null => {
  try {
    validateFoundationExtension(input, "fixture");
    return null;
  } catch (e) {
    if (e instanceof ContentError) return e.message;
    throw e;
  }
};

describe("the record", () => {
  test("a section with a body of lesson blocks is accepted, and returned to render", () => {
    const result = validateFoundationExtension(section(), "fixture");
    expect(result.targetFoundation).toBe("foundation:gaussian-distributions");
    expect(result.section?.body.length).toBe(2);
  });

  test("the Taylor extension, drawn by its own component, needs only its header", () => {
    const path = join(
      process.cwd(),
      "content/foundations/extensions/taylor-expansion-binomial.json",
    );
    const result = validateFoundationExtension(JSON.parse(readFileSync(path, "utf8")), path);
    expect(result).toMatchObject({ id: "taylor-expansion-binomial", section: null });
  });

  test("what a section may not be", () => {
    expect(refusal(section({ extra: 1 }))).toBe("Unknown field.");
    const { body: _body, ...noBody } = section();
    expect(refusal(noBody)).toBe("Missing field.");
    expect(refusal(section({ body: [] }))).toBe("Expected a bounded list.");
    expect(refusal(section({ targetFoundation: "gaussian-distributions" }))).toBe(
      "Name the lesson as foundation:<its id>.",
    );
    expect(refusal(section({ kind: "foundation" }))).toBe("Unsupported value.");
    expect(
      refusal(section({ body: [{ kind: "formula", latex: "\\theta", spoken: "theta" }] })),
    ).toBe("Unsupported math command: theta.");
    expect(refusal(section({ body: [{ kind: "paragraph", text: "<b>bold</b>" }] }))).toBe(
      "Expected bounded plain text, not HTML or executable markup.",
    );
  });
});

describe("the checks across records", () => {
  const extension = validateFoundationExtension(section(), "a");

  test("an extension of a lesson that exists passes", () => {
    expect(
      foundationExtensionIssues([{ path: "a", extension }], new Set(["gaussian-distributions"])),
    ).toEqual([]);
  });

  test("a missing lesson and a repeated id are both refused", () => {
    const codes = foundationExtensionIssues(
      [
        { path: "a", extension },
        { path: "b", extension },
      ],
      new Set(["distributions"]),
    ).map((i) => i.code);
    expect(codes).toEqual(["extension-target-missing", "duplicate-id", "extension-target-missing"]);
  });
});

describe("both compilers, over the real corpus", () => {
  const withFixture = async (record: Record<string, unknown>, name = "fixture-extension") => [
    ...(await loadReadingFiles()),
    { path: `foundations/extensions/${name}.json`, text: JSON.stringify(record) },
  ];
  const extensionCodes = (
    diagnostics: readonly { code: string; path: string; severity: string }[],
  ) =>
    diagnostics
      .filter((d) => d.severity === "error" && d.path.includes("foundations/extensions/"))
      .map((d) => d.code);

  const cases: readonly [string, Record<string, unknown>, string, readonly string[]][] = [
    ["a valid section", section(), "fixture-extension", []],
    [
      "a missing lesson",
      section({ targetFoundation: "foundation:no-such-lesson" }),
      "fixture-extension",
      ["extension-target-missing"],
    ],
    ["an id that is not its file name", section(), "another-name", ["path-identity"]],
    // The schema throws json.ts's ContentError and the compilers test instanceof against
    // loaders.ts's, so a schema refusal arrives as invalid-content, as a lesson's does.
    ["a malformed body", section({ body: "text" }), "fixture-extension", ["invalid-content"]],
  ];

  for (const [name, record, file, expected] of cases) {
    test(`sync: ${name}`, async () => {
      const result = compileReadingContent(await withFixture(record, file));
      expect(extensionCodes(result.diagnostics)).toEqual([...expected]);
    });
    test(`async: ${name}`, async () => {
      const result = await compileContent(await withFixture(record, file));
      expect(extensionCodes(result.diagnostics)).toEqual([...expected]);
    });
  }

  test("the corpus as it stands has no extension errors, and the check reached its records", async () => {
    const files = await loadReadingFiles();
    const extensionFiles = files.filter((f) => f.path.includes("foundations/extensions/"));
    expect(extensionFiles.length).toBeGreaterThan(0);
    expect(extensionCodes(compileReadingContent(files).diagnostics)).toEqual([]);
    expect(extensionCodes((await compileContent(files)).diagnostics)).toEqual([]);
  });
});
