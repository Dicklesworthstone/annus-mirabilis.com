import { describe, expect, test } from "bun:test";
import { LINKED_OBSERVER_LESSON } from "../experiments/groups/linkedObserverLesson.ts";
import { createSearchEngine, searchResultHref } from "./core.ts";
import { linkedGroupDocuments } from "./linkedGroupDocuments.ts";

describe("finding the linked observer workbench", () => {
  test("frequency, energy and Doppler queries reach the operable comparison", () => {
    const engine = createSearchEngine(linkedGroupDocuments("scaffold"));
    for (const query of ["frequency energy", "Doppler", "one observer"]) {
      const hit = engine.search(query, { type: "instrument" })[0];
      expect(hit?.document.title).toBe(LINKED_OBSERVER_LESSON.title);
      if (!hit) throw new Error("linked-observer-search-missing");
      expect(searchResultHref(hit.document)).toBe(LINKED_OBSERVER_LESSON.href);
      expect(hit.document.paper).toBe("special-relativity");
    }
    expect(engine.search("Doppler", { paper: "brownian-motion" })).toEqual([]);
  });

  test("the new lesson does not imply a publication review", () => {
    expect(linkedGroupDocuments("preview")).toEqual([]);
    expect(linkedGroupDocuments("launch")).toEqual([]);
  });
});
