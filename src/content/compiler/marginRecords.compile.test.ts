/**
 * Misconceptions reach both compilers and are checked there (src/content/compiler/marginRecords.ts).
 * Before 2026-09-24 the reading compiler refused a schema-valid misconception as "Unsupported
 * value" and the production compiler admitted a malformed one unchecked, so the two disagreed and
 * neither checked anything. Editorial notes are admitted by both as found, for the reason given in
 * marginRecords.ts; the first case holds that the reading compiler no longer refuses one. Each case
 * runs through both compilers, on the real corpus plus fixture files.
 */
import { describe, expect, test } from "bun:test";
import { loadReadingFiles } from "../../../scripts/build-content.ts";
import { compileContent, compileReadingContent } from "./compile.ts";
import { ContentError } from "./loaders.ts";
import { checkMisconceptionRecord } from "./marginRecords.ts";

const corpus = await loadReadingFiles();

const misconception = (id: string, change: Record<string, unknown> = {}) => ({
  kind: "misconception",
  id,
  paper: "mass-energy",
  temptingClaims: ["A fixture claim."],
  whyTempting: "A fixture reason.",
  whereItIsTrue: "none",
  whatIsTrue: { r0: "Zero.", r1: "One.", r2: "Two." },
  instrumentIds: ["me-02"],
  anchors: ["s0-p4"],
  resultIds: [],
  sources: ["ap-18-639"],
  intervention: {
    instrumentId: "me-02",
    defaultsReviewed: { model: "m", labels: "l", defaultControls: "d", feedback: "f" },
    reviewRecordId: "fixture-pending",
  },
  authorship: { draftedBy: [{ id: "agent:fixture", kind: "model", modelId: "fixture-model" }] },
  reviewState: "draft",
  ...change,
});

const note = (id: string, change: Record<string, unknown> = {}) => ({
  id,
  kind: "historian-margin",
  author: { id: "agent:fixture", kind: "model", modelId: "fixture-model" },
  claim: "A fixture claim about the record.",
  sourceSupport: [{ citationId: "ap-18-639", role: "primary" }],
  affectedIds: ["s0-p4"],
  reviewState: "draft",
  ...change,
});

const file = (path: string, record: unknown) => ({ path, text: JSON.stringify(record) });
const miscPath = (id: string) => `misconceptions/mass-energy/${id}.json`;
const notePath = (id: string) => `editorial-notes/mass-energy/${id}.json`;

const compilers = [
  ["reading", compileReadingContent],
  ["production", compileContent],
] as const;

async function errorsAt(
  compile: (typeof compilers)[number][1],
  extra: readonly { path: string; text: string }[],
) {
  const result = await compile([...corpus, ...extra]);
  const paths = new Set(extra.map((f) => f.path));
  return result.diagnostics.filter((d) => d.severity === "error" && paths.has(d.path));
}

const five = ["a", "b", "c", "d", "e"].map((s) => `misc-me-fixture-${s}`);

for (const [name, compile] of compilers)
  describe(`${name} compiler: misconceptions, and editorial notes admitted`, () => {
    test("schema-valid records are admitted", async () => {
      const extra = [
        ...five.map((id) => file(miscPath(id), misconception(id))),
        file(notePath("note-me-fixture"), note("note-me-fixture")),
      ];
      expect(await errorsAt(compile, extra)).toEqual([]);
    });

    test("a malformed misconception is refused at its own path", async () => {
      const bad = misconception("misc-me-fixture-bad", { whyTempting: "" });
      const errors = await errorsAt(compile, [file(miscPath("misc-me-fixture-bad"), bad)]);
      expect(errors.map((e) => e.message).join(" ")).toContain("whyTempting");
    });

    test("a misconception with no instrument and no static treatment is refused", async () => {
      const bad = misconception("misc-me-fixture-bare", { instrumentIds: [] });
      const errors = await errorsAt(compile, [file(miscPath("misc-me-fixture-bare"), bad)]);
      expect(errors.length).toBeGreaterThan(0);
    });

    test("a misconception filed under another paper, or another id, is refused", async () => {
      const wrongPaper = misconception("misc-me-fixture-x", { paper: "light-quanta" });
      const wrongId = misconception("misc-me-fixture-y");
      const errors = await errorsAt(compile, [
        file(miscPath("misc-me-fixture-x"), wrongPaper),
        file(miscPath("misc-me-fixture-z"), wrongId),
      ]);
      expect(errors.map((e) => e.path).sort()).toEqual(
        [miscPath("misc-me-fixture-x"), miscPath("misc-me-fixture-z")].sort(),
      );
    });
  });

test("checkMisconceptionRecord refuses a record whose id or paper disagrees with its path: path-identity", () => {
  const refused = (record: unknown, params: { id?: string; paper?: string }) => {
    try {
      checkMisconceptionRecord(record, miscPath("misc-me-fixture-x"), params);
    } catch (error) {
      if (error instanceof ContentError) return error.code;
      throw error;
    }
    return "admitted";
  };
  // The control: id and paper both agree with the path, so it is admitted.
  expect(
    refused(misconception("misc-me-fixture-x"), { id: "misc-me-fixture-x", paper: "mass-energy" }),
  ).toBe("admitted");
  expect(
    refused(misconception("misc-me-fixture-x"), { id: "misc-me-fixture-z", paper: "mass-energy" }),
  ).toBe("path-identity");
  expect(
    refused(misconception("misc-me-fixture-x", { paper: "light-quanta" }), {
      id: "misc-me-fixture-x",
      paper: "mass-energy",
    }),
  ).toBe("path-identity");
});

test("production: the five-entry minimum counts a paper's misconceptions", async () => {
  // The production compiler already handed kind-tagged misconceptions to this check; what kept it
  // idle was that the reading compiler refused every one, so none was ever authored. It passes on
  // the pre-change compilers too, and is here to hold now that records exist: one entry is a
  // declared ledger short of five, and five are not.
  const one = await compileContent([
    ...corpus,
    file(miscPath("misc-me-fixture-a"), misconception("misc-me-fixture-a")),
  ]);
  const short = (r: typeof one) =>
    r.diagnostics.filter((d) => d.severity === "error" && d.rule === "misconception-minimum");
  expect(short(one).length).toBeGreaterThan(0);
  const all = await compileContent([
    ...corpus,
    ...five.map((id) => file(miscPath(id), misconception(id))),
  ]);
  expect(short(all)).toEqual([]);
});
