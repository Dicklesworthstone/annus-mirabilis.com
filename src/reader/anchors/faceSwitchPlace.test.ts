import { describe, expect, test } from "bun:test";
import {
  anchorFromFaceHash,
  faceSwitchPlaceForHash,
  parseFaceSwitchTransfer,
} from "./faceSwitchPlace.ts";

const SENTENCE = "s4-p3-s1";
const PATH = "/papers/special-relativity/view/english/";
const snapshot = { anchorId: SENTENCE, relativeOffset: 0.1 };
const transfer = { ...snapshot, path: PATH };
const exact = (id: string) => (id === SENTENCE || id === "s7" ? id : null);

describe("a remembered place belongs to the current fragment", () => {
  test("the same address retains its place after scrolling up to the face chooser", () => {
    expect(faceSwitchPlaceForHash(snapshot, `#${SENTENCE}`)).toBe(snapshot);
    expect(faceSwitchPlaceForHash(snapshot, "#s4%2Dp3%2Ds1")).toBe(snapshot);
    expect(faceSwitchPlaceForHash({ ...snapshot, relativeOffset: -0.1 }, `#${SENTENCE}`)).toEqual({
      anchorId: SENTENCE,
      relativeOffset: -0.1,
    });
  });

  test("a section, another sentence, or a removed fragment cannot reuse the old place", () => {
    for (const hash of ["#s7", "#s7-p1-s1", "", "#", "#%E0%A4%A"]) {
      expect(faceSwitchPlaceForHash(snapshot, hash)).toBeUndefined();
    }
    expect(faceSwitchPlaceForHash(undefined, `#${SENTENCE}`)).toBeUndefined();
  });

  test("nonfinite positions are never carried", () => {
    for (const relativeOffset of [Number.NaN, Infinity, -Infinity]) {
      expect(
        faceSwitchPlaceForHash({ ...snapshot, relativeOffset }, `#${SENTENCE}`),
      ).toBeUndefined();
    }
  });

  test("fragment decoding is explicit and a malformed escape has no address", () => {
    expect(anchorFromFaceHash("#s4%2Dp3%2Ds1")).toBe(SENTENCE);
    expect(anchorFromFaceHash(SENTENCE)).toBe(SENTENCE);
    expect(anchorFromFaceHash("#")).toBeNull();
    expect(anchorFromFaceHash("#%E0%A4%A")).toBeNull();
  });
});

describe("a stored face transfer belongs to its destination and passage", () => {
  test("the matching destination receives the finite viewport fraction", () => {
    expect(parseFaceSwitchTransfer(transfer, PATH, `#${SENTENCE}`, exact)).toEqual(snapshot);
    expect(
      parseFaceSwitchTransfer({ ...transfer, relativeOffset: -0.1 }, PATH, `#${SENTENCE}`, exact),
    ).toEqual({ ...snapshot, relativeOffset: -0.1 });
  });

  test("a later section choice is not overridden by an earlier sentence", () => {
    expect(parseFaceSwitchTransfer(transfer, PATH, "#s7", exact)).toBeNull();
  });

  test("the same sentence id on another paper, face, or query is a different destination", () => {
    for (const path of [
      "/papers/mass-energy/view/english/",
      "/papers/special-relativity/view/german/",
      `${PATH}?detail=2`,
    ]) {
      expect(parseFaceSwitchTransfer(transfer, path, `#${SENTENCE}`, exact)).toBeNull();
    }
  });

  test("a split English sentence resolves to the same German sentence", () => {
    const germanPath = "/papers/special-relativity/view/german/";
    const base = "s1-p10-s1";
    const resolve = (id: string) => (id === base || id === `${base}a` ? base : null);
    expect(
      parseFaceSwitchTransfer(
        { path: germanPath, anchorId: `${base}a`, relativeOffset: 0.2 },
        germanPath,
        `#${base}`,
        resolve,
      ),
    ).toEqual({ anchorId: base, relativeOffset: 0.2 });
  });

  test("an absent destination anchor never authorizes a restore", () => {
    expect(parseFaceSwitchTransfer(transfer, PATH, `#${SENTENCE}`, () => null)).toBeNull();
    expect(parseFaceSwitchTransfer(transfer, PATH, "#s9-p1-s1", exact)).toBeNull();
  });

  test("malformed or unbound records are consumed without becoming a place", () => {
    for (const value of [
      null,
      [],
      "position",
      snapshot,
      { ...transfer, anchorId: "" },
      { ...transfer, anchorId: 3 },
      { ...transfer, relativeOffset: "0.1" },
      { ...transfer, relativeOffset: Number.NaN },
      { ...transfer, relativeOffset: Infinity },
    ]) {
      expect(parseFaceSwitchTransfer(value, PATH, `#${SENTENCE}`, exact)).toBeNull();
    }
    expect(parseFaceSwitchTransfer(transfer, PATH, "#%E0%A4%A", exact)).toBeNull();
  });
});
