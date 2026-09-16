import { afterEach, describe, expect, test } from "bun:test";
import { armReaderRoot, ROOT_ARMING_SOURCE } from "./rootArming.inline";

const originals = {
  document: (globalThis as { document?: unknown }).document,
};

type Dataset = Record<string, string | undefined>;

function stub(htmlView: string | undefined): { rootDataset: Dataset } {
  const rootDataset: Dataset = {};
  const root = { dataset: rootDataset };
  const currentScript = { parentElement: root };
  const htmlDataset: Dataset = htmlView === undefined ? {} : { view: htmlView };
  (globalThis as { document: unknown }).document = {
    currentScript,
    documentElement: { dataset: htmlDataset },
  };
  return { rootDataset };
}

afterEach(() => {
  (globalThis as { document: unknown }).document = originals.document;
});

describe("armReaderRoot", () => {
  test("sets data-ready to false on the root", () => {
    const { rootDataset } = stub("german");
    armReaderRoot();
    expect(rootDataset.ready).toBe("false");
  });

  test("copies a valid requested face from <html data-view>", () => {
    const { rootDataset } = stub("facsimile");
    armReaderRoot();
    expect(rootDataset.view).toBe("facsimile");
  });

  test("falls back to reading when <html data-view> is missing", () => {
    const { rootDataset } = stub(undefined);
    armReaderRoot();
    expect(rootDataset.view).toBe("reading");
  });

  test("falls back to reading when <html data-view> is invalid", () => {
    const { rootDataset } = stub("bogus");
    armReaderRoot();
    expect(rootDataset.view).toBe("reading");
  });

  test("does nothing when there is no current script (never throws)", () => {
    (globalThis as { document: unknown }).document = {
      currentScript: null,
      documentElement: { dataset: {} },
    };
    expect(() => armReaderRoot()).not.toThrow();
  });

  test("does nothing when the script has no parent element", () => {
    (globalThis as { document: unknown }).document = {
      currentScript: { parentElement: null },
      documentElement: { dataset: {} },
    };
    expect(() => armReaderRoot()).not.toThrow();
  });

  test("never touches storage", () => {
    const { rootDataset } = stub("split");
    const originalLocalStorage = (globalThis as { localStorage?: unknown }).localStorage;
    (globalThis as { localStorage: unknown }).localStorage = new Proxy(
      {},
      {
        get() {
          throw new Error("localStorage must never be touched by armReaderRoot");
        },
      },
    );
    try {
      armReaderRoot();
      expect(rootDataset.view).toBe("split");
    } finally {
      (globalThis as { localStorage: unknown }).localStorage = originalLocalStorage;
    }
  });

  test("does not throw when document itself is missing entirely", () => {
    (globalThis as { document: unknown }).document = undefined;
    expect(() => armReaderRoot()).not.toThrow();
  });
});

describe("ROOT_ARMING_SOURCE", () => {
  test("is a self-contained, immediately-invoked expression with no imports", () => {
    expect(ROOT_ARMING_SOURCE.startsWith("(function armReaderRoot()")).toBe(true);
    expect(ROOT_ARMING_SOURCE.trimEnd().endsWith(")();")).toBe(true);
    expect(ROOT_ARMING_SOURCE).not.toContain("import ");
    expect(ROOT_ARMING_SOURCE).not.toContain("require(");
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
      expect(ROOT_ARMING_SOURCE).toContain(`"${face}"`);
    }
  });

  test("executing the derived source produces the same result as calling the function directly", () => {
    const { rootDataset } = stub("english");
    // eslint-disable-next-line no-new-func
    new Function(ROOT_ARMING_SOURCE)();
    expect(rootDataset.ready).toBe("false");
    expect(rootDataset.view).toBe("english");
  });
});
