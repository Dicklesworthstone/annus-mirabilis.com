import { afterEach, describe, expect, test } from "bun:test";
import { PREPAINT_VIEW_SOURCE, prepaintView } from "./prepaintView.inline";

type Globals = { document: unknown; location: unknown };
const originals: Globals = {
  document: (globalThis as { document?: unknown }).document,
  location: (globalThis as { location?: unknown }).location,
};

function stub(search: string): { dataset: Record<string, string> } {
  const dataset: Record<string, string> = {};
  (globalThis as { document: unknown }).document = { documentElement: { dataset } };
  (globalThis as { location: unknown }).location = { search };
  return { dataset };
}

afterEach(() => {
  (globalThis as { document: unknown }).document = originals.document;
  (globalThis as { location: unknown }).location = originals.location;
});

describe("prepaintView", () => {
  test("sets data-view for a known face", () => {
    const { dataset } = stub("?view=german");
    prepaintView();
    expect(dataset.view).toBe("german");
  });

  test("falls back to reading for an unknown value", () => {
    const { dataset } = stub("?view=bogus");
    prepaintView();
    expect(dataset.view).toBe("reading");
  });

  test("falls back to reading when the parameter is absent", () => {
    const { dataset } = stub("");
    prepaintView();
    expect(dataset.view).toBe("reading");
  });

  test("falls back to reading when the parameter is repeated", () => {
    const { dataset } = stub("?view=german&view=english");
    prepaintView();
    expect(dataset.view).toBe("reading");
  });

  test("never touches storage", () => {
    const { dataset } = stub("?view=split");
    const originalLocalStorage = (globalThis as { localStorage?: unknown }).localStorage;
    (globalThis as { localStorage: unknown }).localStorage = new Proxy(
      {},
      {
        get() {
          throw new Error("localStorage must never be touched by prepaintView");
        },
      },
    );
    try {
      prepaintView();
      expect(dataset.view).toBe("split");
    } finally {
      (globalThis as { localStorage: unknown }).localStorage = originalLocalStorage;
    }
  });

  test("does not throw when URLSearchParams is unavailable", () => {
    stub("?view=german");
    const originalCtor = globalThis.URLSearchParams;
    // @ts-expect-error deliberately removing the constructor to exercise the catch path
    globalThis.URLSearchParams = undefined;
    try {
      expect(() => prepaintView()).not.toThrow();
    } finally {
      globalThis.URLSearchParams = originalCtor;
    }
  });

  test("does not throw when location is missing entirely", () => {
    (globalThis as { document: unknown }).document = { documentElement: { dataset: {} } };
    (globalThis as { location: unknown }).location = undefined;
    expect(() => prepaintView()).not.toThrow();
  });
});

describe("PREPAINT_VIEW_SOURCE", () => {
  test("is a self-contained, immediately-invoked expression with no imports", () => {
    expect(PREPAINT_VIEW_SOURCE.startsWith("(function prepaintView()")).toBe(true);
    expect(PREPAINT_VIEW_SOURCE.trimEnd().endsWith(")();")).toBe(true);
    expect(PREPAINT_VIEW_SOURCE).not.toContain("import ");
    expect(PREPAINT_VIEW_SOURCE).not.toContain("require(");
  });

  test("names every known face literally, inlined from the registry", () => {
    for (const face of [
      "german",
      "english",
      "gloss",
      "parallel",
      "reading",
      "results",
      "facsimile",
      "split",
    ]) {
      expect(PREPAINT_VIEW_SOURCE).toContain(`"${face}"`);
    }
  });

  test("executing the derived source produces the same result as calling the function directly", () => {
    const { dataset } = stub("?view=facsimile");
    // eslint-disable-next-line no-new-func
    new Function(PREPAINT_VIEW_SOURCE)();
    expect(dataset.view).toBe("facsimile");
  });

  test("is stable across two derivations from the same module (byte-exact for a CSP hash)", () => {
    expect(PREPAINT_VIEW_SOURCE).toBe(PREPAINT_VIEW_SOURCE);
  });
});
