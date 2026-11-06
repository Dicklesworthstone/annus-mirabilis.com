import { describe, expect, test } from "bun:test";
import { DESK_OBJECT_IDS } from "../discovery/desk/model.ts";
import { loadDesk } from "../discovery/desk/records.ts";
import { searchResultHref } from "./core.ts";
import { deskDocuments } from "./deskDocuments.ts";
import type { SearchProfile } from "./documents.ts";

const desk = loadDesk();
const documents = deskDocuments(desk.objects, "scaffold");

describe("the 1904 desk's objects are searchable", () => {
  test("every real object gets exactly one result at its published anchor", () => {
    expect(documents).toHaveLength(5);
    expect(documents.map((document) => document.anchor).sort()).toEqual(
      [...DESK_OBJECT_IDS].sort(),
    );
    expect(new Set(documents.map((document) => document.id)).size).toBe(5);
    for (const object of desk.objects) {
      const document = documents.find((candidate) => candidate.id === `desk:${object.id}`);
      expect(document).toBeDefined();
      if (!document) throw new Error(`Missing desk search document for ${object.id}`);
      expect(document.type).toBe("discovery");
      expect(document.paper).toBe(object.journey);
      expect(document.title).toContain(object.title);
      expect(searchResultHref(document)).toBe(`/1904/#${object.id}`);
      expect(document.scopeLabel).toContain("reconstruction for learning");
    }
  });

  test("open questions, limits and the three responses come from the desk's own loader", () => {
    for (const object of desk.objects) {
      const document = documents.find((candidate) => candidate.anchor === object.id);
      for (const passage of [
        object.question,
        object.description,
        object.unresolved,
        ...object.responses,
      ])
        expect(document?.text).toContain(passage);
    }
  });

  test("object ordering cannot change the index", () => {
    expect(deskDocuments([...desk.objects].reverse(), "scaffold")).toEqual(documents);
  });

  test("the desk inherits the source material's stricter-profile exclusion", () => {
    expect(deskDocuments(desk.objects, "preview")).toEqual([]);
    expect(deskDocuments(desk.objects, "launch")).toEqual([]);
    expect(() => deskDocuments(desk.objects, "other" as SearchProfile)).toThrow(
      "Unknown AM_RELEASE_PROFILE",
    );
  });
});
