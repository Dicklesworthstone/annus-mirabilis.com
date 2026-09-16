import { describe, expect, test } from "bun:test";
import { parseInstrumentAddress } from "../../scripts/e2e/domContract.ts";
import {
  CATALOGUE_IDS,
  CATALOGUE_STATUS,
  type CatalogueId,
  catalogueLabel,
  catalogueStatus,
  DECLARED_MODES,
  isCatalogueId,
  parseCatalogueAddress,
  REGISTERED_IDS,
  resolveCatalogueAddress,
} from "../experiments/catalogue.ts";

describe("catalogue: the 33 core ids and the 5 declared non-core ids", () => {
  test("has exactly 38 ids", () => {
    expect(CATALOGUE_IDS.length).toBe(38);
  });

  test("contains the full lq/bm/sr/me core ranges", () => {
    for (let n = 1; n <= 9; n++) expect(CATALOGUE_IDS).toContain(`lq-0${n}` as CatalogueId);
    for (let n = 1; n <= 8; n++) expect(CATALOGUE_IDS).toContain(`bm-0${n}` as CatalogueId);
    for (let n = 1; n <= 9; n++) expect(CATALOGUE_IDS).toContain(`sr-0${n}` as CatalogueId);
    expect(CATALOGUE_IDS).toContain("sr-10");
    expect(CATALOGUE_IDS).toContain("sr-11");
    expect(CATALOGUE_IDS).toContain("sr-12");
    expect(CATALOGUE_IDS).toContain("sr-13");
    for (let n = 1; n <= 3; n++) expect(CATALOGUE_IDS).toContain(`me-0${n}` as CatalogueId);
  });

  test("contains the five declared non-core ids", () => {
    for (const id of [
      "shelf-michelson-morley",
      "shelf-fizeau",
      "shelf-maxwell-galilean",
      "avogadro-lab",
      "light-thread",
    ]) {
      expect(CATALOGUE_IDS).toContain(id as CatalogueId);
    }
  });

  test("every id has an explicit status, and catalogueStatus agrees with the table", () => {
    for (const id of CATALOGUE_IDS) {
      expect(["registered", "in-preparation"]).toContain(CATALOGUE_STATUS[id]);
      expect(catalogueStatus(id)).toBe(CATALOGUE_STATUS[id]);
    }
  });

  test("registered instruments currently include the Brownian slice, lq-08, and me-02", () => {
    expect([...REGISTERED_IDS].sort()).toEqual([
      "bm-01",
      "bm-03",
      "bm-04",
      "bm-05",
      "bm-06",
      "bm-07",
      "bm-08",
      "lq-08",
      "me-02",
    ]);
  });

  test("catalogueLabel is defined for every id (the switch+never exhaustiveness form)", () => {
    for (const id of CATALOGUE_IDS) {
      expect(typeof catalogueLabel(id)).toBe("string");
      expect(catalogueLabel(id).length).toBeGreaterThan(0);
    }
  });
});

describe("isCatalogueId: the runtime guard for ids read from a URL or permalink", () => {
  test("accepts every real catalogue id", () => {
    for (const id of CATALOGUE_IDS) expect(isCatalogueId(id)).toBe(true);
  });

  test("rejects ids outside the catalogue, including near misses", () => {
    for (const value of ["bm-09", "lq-10", "me-04", "sr-14", "bm-1", "BM-01", "wright-flyer", ""]) {
      expect(isCatalogueId(value)).toBe(false);
    }
  });
});

describe("mode-address grammar, cross-checked against the harness's independent parser", () => {
  test("a bare catalogue id parses with a null mode", () => {
    const parsed = parseCatalogueAddress("bm-01");
    expect(parsed).toEqual({ raw: "bm-01", instrumentId: "bm-01", mode: null });
  });

  test("an instrumentId:mode address parses both sides", () => {
    const parsed = parseCatalogueAddress("me-03:box-1906");
    expect(parsed).toEqual({ raw: "me-03:box-1906", instrumentId: "me-03", mode: "box-1906" });
  });

  test("a preset id's glued unit letter ('0.6c') is unparseable, so a preset can never be mistaken for an instrument address", () => {
    expect(() => parseCatalogueAddress("sr-03-boost-0.6c")).toThrow(
      /not a well-formed catalogue id/,
    );
  });

  test("more than one colon is rejected", () => {
    expect(() => parseCatalogueAddress("bm-01:a:b")).toThrow(/more than one colon/);
  });

  test("agrees with scripts/e2e/domContract.ts's parseInstrumentAddress on well-formed addresses", () => {
    for (const value of ["bm-01", "me-03:box-1906", "sr-02:apparatus", "lq-02:1904"]) {
      const mine = parseCatalogueAddress(value);
      const harness = parseInstrumentAddress(value);
      expect(mine.instrumentId).toBe(harness.instrumentId);
      expect(mine.mode).toBe(harness.mode);
    }
  });
});

describe("resolveCatalogueAddress: grammar plus membership, owned here", () => {
  test("resolves a registered bare id", () => {
    expect(resolveCatalogueAddress("bm-01")).toEqual({ id: "bm-01", mode: null });
  });

  test("resolves an in-preparation bare id (membership does not imply registration)", () => {
    expect(resolveCatalogueAddress("lq-01")).toEqual({ id: "lq-01", mode: null });
  });

  test("an id outside the catalogue is an explicit error naming the unknown id", () => {
    const result = resolveCatalogueAddress("wright-flyer");
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toContain("wright-flyer");
  });

  test("a mode address for an id that declares no such mode is rejected, naming the declared modes", () => {
    expect(DECLARED_MODES["bm-01"]).toEqual([]);
    const result = resolveCatalogueAddress("bm-01:kicks-off");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("kicks-off");
      expect(result.error).toContain("<none>");
    }
  });

  test("a preset id offered as a mode is rejected the same way", () => {
    const result = resolveCatalogueAddress("sr-03:boost-0.6c");
    expect("error" in result).toBe(true);
  });
});
