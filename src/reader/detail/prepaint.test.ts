import { afterEach, describe, expect, test } from "bun:test";
import { DETAIL_STORAGE_KEY } from "../navigation/state.ts";
import { applyReaderPrepaint, READER_PREPAINT } from "./prepaint.ts";

const originals = {
  document: (globalThis as { document?: unknown }).document,
  location: (globalThis as { location?: unknown }).location,
  localStorage: (globalThis as { localStorage?: unknown }).localStorage,
};

type Dataset = Record<string, string | undefined>;

function stub(options: { search?: string; stored?: string | null } = {}): { dataset: Dataset } {
  const dataset: Dataset = {};
  (globalThis as { document: unknown }).document = { documentElement: { dataset } };
  (globalThis as { location: unknown }).location = { search: options.search ?? "" };
  const stored = options.stored ?? null;
  (globalThis as { localStorage: unknown }).localStorage = {
    getItem: (key: string) => (key === DETAIL_STORAGE_KEY ? stored : null),
  };
  return { dataset };
}

afterEach(() => {
  (globalThis as { document: unknown }).document = originals.document;
  (globalThis as { location: unknown }).location = originals.location;
  (globalThis as { localStorage: unknown }).localStorage = originals.localStorage;
});

describe("applyReaderPrepaint", () => {
  test("defaults to detail 1, lens paper, view reading with no query and no stored value", () => {
    const { dataset } = stub();
    applyReaderPrepaint();
    expect(dataset.detail).toBe("1");
    expect(dataset.lens).toBe("paper");
    expect(dataset.view).toBe("reading");
  });

  test("a ?detail= query value wins over a stored value", () => {
    const { dataset } = stub({ search: "?detail=2", stored: "0" });
    applyReaderPrepaint();
    expect(dataset.detail).toBe("2");
  });

  test("a stored value applies when the query has none", () => {
    const { dataset } = stub({ stored: "0" });
    applyReaderPrepaint();
    expect(dataset.detail).toBe("0");
  });

  test("detail 0 (falsy) is not dropped in favor of the default", () => {
    const { dataset } = stub({ search: "?detail=0" });
    applyReaderPrepaint();
    expect(dataset.detail).toBe("0");
  });

  test("word aliases (overview, full, steps) resolve to the same canonical digits as parseDetail", () => {
    const { dataset } = stub({ search: "?detail=overview" });
    applyReaderPrepaint();
    expect(dataset.detail).toBe("0");
  });

  test("an invalid detail value falls back to the default rather than being written raw", () => {
    const { dataset } = stub({ search: "?detail=bogus" });
    applyReaderPrepaint();
    expect(dataset.detail).toBe("1");
  });

  test("a repeated detail query parameter is ambiguous and is ignored, same as a missing one", () => {
    const { dataset } = stub({ search: "?detail=0&detail=2" });
    applyReaderPrepaint();
    expect(dataset.detail).toBe("1");
  });

  test("?lens=modern sets the modern lens", () => {
    const { dataset } = stub({ search: "?lens=modern" });
    applyReaderPrepaint();
    expect(dataset.lens).toBe("modern");
  });

  test("lens is paper by default and for any non-modern value", () => {
    const { dataset } = stub({ search: "?lens=bogus" });
    applyReaderPrepaint();
    expect(dataset.lens).toBe("paper");
  });

  test("a known ?view= value is copied through", () => {
    const { dataset } = stub({ search: "?view=german" });
    applyReaderPrepaint();
    expect(dataset.view).toBe("german");
  });

  test("an unknown ?view= value falls back to reading", () => {
    const { dataset } = stub({ search: "?view=bogus" });
    applyReaderPrepaint();
    expect(dataset.view).toBe("reading");
  });

  test("an oversized query string is ignored rather than parsed", () => {
    const { dataset } = stub({ search: `?detail=2&pad=${"x".repeat(5000)}` });
    applyReaderPrepaint();
    expect(dataset.detail).toBe("1");
  });

  test("never throws when document is missing entirely", () => {
    (globalThis as { document: unknown }).document = undefined;
    (globalThis as { location: unknown }).location = { search: "" };
    (globalThis as { localStorage: unknown }).localStorage = { getItem: () => null };
    expect(() => applyReaderPrepaint()).not.toThrow();
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
    expect(() => applyReaderPrepaint()).not.toThrow();
    expect(dataset.detail).toBe("1");
  });
});

describe("READER_PREPAINT", () => {
  test("is a self-contained, immediately-invoked expression with no imports", () => {
    expect(READER_PREPAINT.startsWith("(function applyReaderPrepaint()")).toBe(true);
    expect(READER_PREPAINT.trimEnd().endsWith(")();")).toBe(true);
    expect(READER_PREPAINT).not.toContain("import ");
    expect(READER_PREPAINT).not.toContain("require(");
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
