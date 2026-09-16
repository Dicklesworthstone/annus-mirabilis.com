import { describe, expect, test } from "bun:test";
import {
  DEFAULT_FACE,
  DEFAULT_SPLIT_PANES,
  FACE_IDS,
  FACE_REGISTRY,
  isFaceId,
  isSplittableFaceId,
  SPLITTABLE_FACE_IDS,
} from "./registry";

describe("face registry", () => {
  test("every face id has exactly one registry entry, keyed by its own id", () => {
    for (const id of FACE_IDS) {
      expect(FACE_REGISTRY[id].id).toBe(id);
    }
    expect(Object.keys(FACE_REGISTRY).sort()).toEqual([...FACE_IDS].sort());
  });

  test("split is a face but not itself splittable", () => {
    expect(FACE_IDS).toContain("split");
    expect(SPLITTABLE_FACE_IDS).not.toContain("split");
  });

  test("split pane candidates are a subset of face ids", () => {
    for (const id of SPLITTABLE_FACE_IDS) {
      expect(FACE_IDS).toContain(id);
    }
  });

  test("german and english are the only language faces", () => {
    const languageFaces = FACE_IDS.filter((id) => FACE_REGISTRY[id].isLanguageFace);
    expect(languageFaces.sort()).toEqual(["english", "german"]);
  });

  test("default face is reading", () => {
    expect(DEFAULT_FACE).toBe("reading");
  });

  test("default split pair is parallel and reading, both splittable", () => {
    expect(DEFAULT_SPLIT_PANES).toEqual(["parallel", "reading"]);
    for (const pane of DEFAULT_SPLIT_PANES) {
      expect(isSplittableFaceId(pane)).toBe(true);
    }
  });

  test("isFaceId rejects unknown values without throwing", () => {
    expect(isFaceId("reading")).toBe(true);
    expect(isFaceId("nonsense")).toBe(false);
    expect(isFaceId(undefined)).toBe(false);
    expect(isFaceId(null)).toBe(false);
    expect(isFaceId(42)).toBe(false);
  });

  test("isSplittableFaceId rejects split itself and unknown values", () => {
    expect(isSplittableFaceId("split")).toBe(false);
    expect(isSplittableFaceId("reading")).toBe(true);
    expect(isSplittableFaceId("nonsense")).toBe(false);
  });
});
