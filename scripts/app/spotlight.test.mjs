import assert from "node:assert/strict";
import test from "node:test";
import { spotlightSnapshot } from "./spotlight.ts";

test("only five public kinds reach Spotlight with the web's exact face and anchor", () => {
  const row = {
    id: "section:brownian:s4", type: "section", paper: "brownian-motion", section: "s4",
    lang: "en", title: "A section", text: "🔬".repeat(250), terms: ["s4"],
    route: "/papers/brownian-motion/", anchor: "s4", face: "reading", scopeLabel: "Reading",
  };
  const kinds = ["paper", "section", "result", "instrument", "foundation", "tour", "sentence-en"];
  const documents = kinds.map((type) => ({
    ...row, type, id: type, anchor: type, paper: type === "foundation" ? "cross-paper" : row.paper,
  }));
  const { buildDigest, entries } = spotlightSnapshot([...documents, documents[1]], "edition");
  assert.equal(buildDigest, "edition");
  assert.equal(entries.length, 5);
  assert.deepEqual(entries[1], {
    identifier: "https://annus-mirabilis.com/papers/brownian-motion/?view=reading#section",
    domain: "brownian-motion", title: "A section", snippet: "🔬".repeat(240), keywords: ["s4"],
  });
  assert.equal(entries[4].domain, "site");
  assert.deepEqual(spotlightSnapshot([], "empty").entries, []);
});
