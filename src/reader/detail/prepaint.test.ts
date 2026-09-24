import { afterEach, describe, expect, test } from "bun:test";
import { SEED_ENTRIES, type SettingRegistration } from "../../platform/storage/keys.ts";
import {
  DETAIL_STORAGE_KEY,
  FACES,
  NOTATION_STORAGE_KEY,
  parseDetail,
  parseNotation,
} from "../navigation/state.ts";
import { applyReaderPrepaint, READER_PREPAINT } from "./prepaint.ts";

const originals = {
  document: (globalThis as { document?: unknown }).document,
  location: (globalThis as { location?: unknown }).location,
  localStorage: (globalThis as { localStorage?: unknown }).localStorage,
};

type Dataset = Record<string, string | undefined>;

function stub(
  options: { search?: string; stored?: string | null; storedNotation?: string | null } = {},
): { dataset: Dataset } {
  const dataset: Dataset = {};
  (globalThis as { document: unknown }).document = { documentElement: { dataset } };
  (globalThis as { location: unknown }).location = { search: options.search ?? "" };
  const stored = options.stored ?? null;
  const storedNotation = options.storedNotation ?? null;
  (globalThis as { localStorage: unknown }).localStorage = {
    getItem: (key: string) =>
      key === DETAIL_STORAGE_KEY ? stored : key === NOTATION_STORAGE_KEY ? storedNotation : null,
  };
  return { dataset };
}

afterEach(() => {
  (globalThis as { document: unknown }).document = originals.document;
  (globalThis as { location: unknown }).location = originals.location;
  (globalThis as { localStorage: unknown }).localStorage = originals.localStorage;
});

const arm = () =>
  applyReaderPrepaint(DETAIL_STORAGE_KEY, parseDetail, FACES, NOTATION_STORAGE_KEY, parseNotation);

describe("notation before first paint (am-read-perspective-toggle-abd)", () => {
  test("printed letters by default, with no query and nothing stored", () => {
    const { dataset } = stub();
    arm();
    expect(dataset.notation).toBe("printed");
  });

  test("?notation=modern applies, and wins over a stored printed", () => {
    const { dataset } = stub({ search: "?notation=modern", storedNotation: "printed" });
    arm();
    expect(dataset.notation).toBe("modern");
  });

  test("a stored modern applies when the query names none", () => {
    const { dataset } = stub({ storedNotation: "modern" });
    arm();
    expect(dataset.notation).toBe("modern");
  });

  test("invalid or repeated values are ignored, never written raw", () => {
    for (const [search, storedNotation] of [
      ["?notation=Modern", null],
      ["?notation=modern&notation=printed", null],
      ["", "gamma"],
    ] as const) {
      const { dataset } = stub({ search, storedNotation });
      arm();
      expect(dataset.notation).toBe("printed");
    }
  });

  test("blocked storage still arms the query value and the defaults", () => {
    const { dataset } = stub({ search: "?notation=modern" });
    (globalThis as { localStorage: unknown }).localStorage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
    };
    arm();
    expect(dataset.notation).toBe("modern");
    expect(dataset.detail).toBe("1");
  });

  test("notation and the lens are separate settings: each can be modern without the other", () => {
    const a = stub({ search: "?notation=modern" });
    arm();
    expect([a.dataset.notation, a.dataset.lens]).toEqual(["modern", "paper"]);
    const b = stub({ search: "?lens=modern" });
    arm();
    expect([b.dataset.notation, b.dataset.lens]).toEqual(["printed", "modern"]);
  });

  test("the key and its values are the storage registry's own", () => {
    const entry = SEED_ENTRIES.find(
      (e) => e.kind === "setting" && e.key === NOTATION_STORAGE_KEY,
    ) as SettingRegistration | undefined;
    expect(entry?.ownerBeadId).toBe("am-read-perspective-toggle-abd");
    expect(entry?.prePaint).toBe(true);
    expect(entry?.defaultValue).toBe("printed");
    for (const value of entry?.allowedValues ?? []) expect(parseNotation(value)).toBe(value);
    expect(entry?.allowedValues.length).toBe(2);
  });

  test("the injected script carries the registered key and the real parser", () => {
    expect(READER_PREPAINT).toContain(JSON.stringify(NOTATION_STORAGE_KEY));
    expect(READER_PREPAINT).toContain("function parseNotation");
    const { dataset } = stub({ search: "?notation=modern" });
    // eslint-disable-next-line no-new-func
    new Function(READER_PREPAINT)();
    expect(dataset.notation).toBe("modern");
  });
});

describe("applyReaderPrepaint", () => {
  test("defaults to detail 1, lens paper, view reading with no query and no stored value", () => {
    const { dataset } = stub();
    arm();
    expect(dataset.detail).toBe("1");
    expect(dataset.lens).toBe("paper");
    expect(dataset.view).toBe("reading");
  });

  test("a ?detail= query value wins over a stored value", () => {
    const { dataset } = stub({ search: "?detail=2", stored: "0" });
    arm();
    expect(dataset.detail).toBe("2");
  });

  test("a stored value applies when the query has none", () => {
    const { dataset } = stub({ stored: "0" });
    arm();
    expect(dataset.detail).toBe("0");
  });

  test("detail 0 (falsy) is not dropped in favor of the default", () => {
    const { dataset } = stub({ search: "?detail=0" });
    arm();
    expect(dataset.detail).toBe("0");
  });

  test("word aliases (overview, full, steps) resolve to the same canonical digits as parseDetail", () => {
    const { dataset } = stub({ search: "?detail=overview" });
    arm();
    expect(dataset.detail).toBe("0");
  });

  test("an invalid detail value falls back to the default rather than being written raw", () => {
    const { dataset } = stub({ search: "?detail=bogus" });
    arm();
    expect(dataset.detail).toBe("1");
  });

  test("a repeated detail query parameter is ambiguous and is ignored, same as a missing one", () => {
    const { dataset } = stub({ search: "?detail=0&detail=2" });
    arm();
    expect(dataset.detail).toBe("1");
  });

  test("?lens=modern sets the modern lens", () => {
    const { dataset } = stub({ search: "?lens=modern" });
    arm();
    expect(dataset.lens).toBe("modern");
  });

  test("lens is paper by default and for any non-modern value", () => {
    const { dataset } = stub({ search: "?lens=bogus" });
    arm();
    expect(dataset.lens).toBe("paper");
  });

  test("a known ?view= value is copied through", () => {
    const { dataset } = stub({ search: "?view=german" });
    arm();
    expect(dataset.view).toBe("german");
  });

  test("an unknown ?view= value falls back to reading", () => {
    const { dataset } = stub({ search: "?view=bogus" });
    arm();
    expect(dataset.view).toBe("reading");
  });

  test("an oversized query string is ignored rather than parsed", () => {
    const { dataset } = stub({ search: `?detail=2&pad=${"x".repeat(5000)}` });
    arm();
    expect(dataset.detail).toBe("1");
  });

  test("never throws when document is missing entirely", () => {
    (globalThis as { document: unknown }).document = undefined;
    (globalThis as { location: unknown }).location = { search: "" };
    (globalThis as { localStorage: unknown }).localStorage = { getItem: () => null };
    expect(() => arm()).not.toThrow();
  });

  test("never throws when localStorage access throws", () => {
    const dataset: Dataset = {};
    (globalThis as { document: unknown }).document = { documentElement: { dataset } };
    (globalThis as { location: unknown }).location = { search: "" };
    (globalThis as { localStorage: unknown }).localStorage = new Proxy(
      {},
      {
        get() {
          throw new Error("storage blocked");
        },
      },
    );
    expect(() => arm()).not.toThrow();
    expect(dataset.detail).toBe("1");
  });
});

describe("READER_PREPAINT", () => {
  test("is a self-contained, immediately-invoked expression with no imports", () => {
    expect(READER_PREPAINT.startsWith("(function applyReaderPrepaint(")).toBe(true);
    expect(READER_PREPAINT.trimEnd().endsWith(");")).toBe(true);
    expect(READER_PREPAINT).not.toContain("import ");
    expect(READER_PREPAINT).not.toContain("require(");
  });

  test("passes its values as arguments rather than splicing them in by name", () => {
    // The values used to be spliced into the body by identifier name. A production
    // build renames module constants, so .toString() returned a body referencing
    // the renamed names, the replacements matched nothing, and the emitted IIFE
    // referenced free variables that its own catch then swallowed. Arguments are
    // positional and survive minification; these names must never return.
    for (const spliced of ["STORAGE_KEY", "PARSE_DETAIL", "VIEW_IDS"]) {
      expect(READER_PREPAINT).not.toContain(spliced);
    }
    // Every value the function needs arrives after the closing parenthesis of the
    // function expression, so the body reads only its own parameters.
    const call = READER_PREPAINT.slice(READER_PREPAINT.lastIndexOf(")(") + 1);
    expect(call).toContain(JSON.stringify(DETAIL_STORAGE_KEY));
    expect(call).toContain("function parseDetail");
    expect(call).toContain(JSON.stringify(FACES[0]));
  });

  test("embeds the real DETAIL_STORAGE_KEY, not a hand-copied literal", () => {
    expect(READER_PREPAINT).toContain(JSON.stringify(DETAIL_STORAGE_KEY));
  });

  test("splices in parseDetail's real source rather than a second dictionary", () => {
    expect(READER_PREPAINT).toContain("overview");
    expect(READER_PREPAINT).toContain("steps");
  });

  test("executing the derived source produces the same result as calling the function directly", () => {
    const { dataset } = stub({ search: "?detail=2" });
    // eslint-disable-next-line no-new-func
    new Function(READER_PREPAINT)();
    expect(dataset.detail).toBe("2");
    expect(dataset.lens).toBe("paper");
    expect(dataset.view).toBe("reading");
  });
});
