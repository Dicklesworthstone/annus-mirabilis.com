import assert from "node:assert/strict";
import test from "node:test";
import { BROWNIAN_STAGES } from "../discovery/brownian/stages.ts";
import { LIGHT_QUANTA_STAGES } from "../discovery/lightQuanta/stages.ts";
import { MASS_ENERGY_STAGES } from "../discovery/massEnergy/stages.ts";
import { ROUTE_INDEX } from "../discovery/routeIndex.ts";
import { createSearchEngine, searchResultHref, validateSearchDocument } from "./core.ts";
import { JourneyStageSearchError, journeyStageDocuments } from "./journeyStageDocuments.ts";

// These are the same authored stage records rendered by the discovery pages.
// Empty paper fixtures verify that unrecorded stages do not invent search results.
const JOURNEYS = [
  { paper: "light-quanta", stages: LIGHT_QUANTA_STAGES },
  { paper: "brownian-motion", stages: BROWNIAN_STAGES },
  { paper: "special-relativity", stages: [] },
  { paper: "mass-energy", stages: MASS_ENERGY_STAGES },
];
const documents = journeyStageDocuments(JOURNEYS, ROUTE_INDEX, "scaffold");
const stages = JOURNEYS.flatMap((journey) =>
  journey.stages.map((stage) => ({ paper: journey.paper, stage })),
);
const documentId = (paper, stage) => `discovery-stage:${paper}:${stage.id}`;

test("every real authored stage has its own question and exact published fragment", () => {
  assert.ok(stages.length > 0, "The real journey population must contain authored stages.");
  console.log(
    `[discovery-stage search] ${stages.length} authored stages in ${JOURNEYS.length} journeys; ${documents.length} documents`,
  );
  assert.deepEqual(
    documents.map((document) => document.id).sort(),
    stages.map(({ paper, stage }) => documentId(paper, stage)).sort(),
  );
  assert.equal(new Set(documents.map((document) => document.id)).size, documents.length);
  for (const { paper, stage } of stages) {
    const document = documents.find((entry) => entry.id === documentId(paper, stage));
    assert.ok(document);
    assert.equal(document.title, stage.question);
    assert.equal(document.type, "discovery");
    assert.equal(document.paper, paper);
    assert.equal(document.anchor, stage.id);
    assert.equal(document.face, "");
    assert.equal(searchResultHref(document), `/discover/${paper}/#${stage.id}`);
    assert.ok(document.scopeLabel.includes(stage.title));
    assert.ok(document.scopeLabel.includes(ROUTE_INDEX.find((route) => route.slug === paper).name));
    assert.deepEqual(document.terms, []);
    assert.doesNotThrow(() => validateSearchDocument(document));
  }
});

test("questions reach their own stages through the real search engine and paper filter", () => {
  const engine = createSearchEngine(documents);
  for (const { paper, stage } of stages) {
    const hits = engine.search(`"${stage.question}"`, { paper, type: "discovery" });
    assert.equal(hits[0]?.document.id, documentId(paper, stage), stage.question);
    assert.equal(searchResultHref(hits[0].document), `/discover/${paper}/#${stage.id}`);
  }
  assert.deepEqual(engine.search('"Averages can hide motion."', { paper: "mass-energy" }), []);
  assert.deepEqual(engine.search('"Averages can hide motion."', { type: "equation" }), []);
});

test("worked explanations and transfer questions are searchable beyond generic step titles", () => {
  const engine = createSearchEngine(documents);
  for (const [query, paper, anchor] of [
    ["A zero signed mean can coexist with a nonzero spread.", "brownian-motion", "step-01"],
    ["What if the particles lock into permanent pairs?", "brownian-motion", "step-02"],
    ["What if the second step always follows the first?", "brownian-motion", "step-04"],
    ["Why the import is declared rather than absorbed", "mass-energy", "step-03"],
    ["What if one elementary event can absorb two quanta at once?", "light-quanta", "step-07"],
    ["The unbounded classical allocation has no finite total energy.", "light-quanta", "step-03"],
    ["The premise hiding in “whatever fixed offset”", "mass-energy", "step-04"],
  ]) {
    const hits = engine.search(query, { paper, type: "discovery" });
    assert.ok(hits.some((hit) => hit.document.anchor === anchor), query);
  }
});

test("stage guidance excludes record and notebook metadata", () => {
  const source = JOURNEYS.find((journey) => journey.paper === "brownian-motion");
  assert.ok(source?.stages[0]);
  const original = source.stages[0];
  const changed = {
    ...source,
    privateNotes: "privateNotebookSentinel",
    stages: [
      {
        ...original,
        premiseRefs: [{ cardId: "unpublished-card-metadata-sentinel" }],
        meanings: { privateNote: "privateNotebookSentinel" },
        support: {
          ...original.support,
          partialComparison: {
            ...original.support.partialComparison,
            explanation: "An authored comparison changed in this fixture.",
          },
        },
      },
    ],
  };
  const [document] = journeyStageDocuments([changed], ROUTE_INDEX, "scaffold");
  assert.ok(document);
  assert.ok(document.text.includes(changed.stages[0].support.partialComparison.explanation));
  assert.ok(!document.text.includes(original.support.partialComparison.explanation));
  assert.ok(document.text.includes(original.support.workedExample.prompt));
  assert.ok(document.text.includes(original.support.workedExample.result));
  for (const step of original.support.workedExample.steps) assert.ok(document.text.includes(step));
  assert.ok(document.text.includes(original.support.prediction.prompt));
  for (const choice of original.support.prediction.choices)
    assert.ok(document.text.includes(choice));
  assert.ok(document.text.includes(original.support.prediction.explanation));
  assert.ok(document.text.includes(original.support.transferCase.whatChanges));
  assert.ok(document.text.includes(original.support.transferCase.whatStaysValid));
  assert.ok(!JSON.stringify(document).includes("privateNotebookSentinel"));
  assert.ok(!JSON.stringify(document).includes("unpublished-card-metadata-sentinel"));
});

test("optional prediction and transfer guidance does not fabricate text when absent", () => {
  const source = JOURNEYS.find((journey) => journey.stages.length > 0);
  assert.ok(source);
  const stage = source.stages[0];
  const documents = journeyStageDocuments(
    [
      {
        ...source,
        stages: [
          {
            ...stage,
            reasoning: [{ foundationId: "not-a-visible-label" }],
            support: { ...stage.support, prediction: undefined, transferCase: undefined },
          },
        ],
      },
    ],
    ROUTE_INDEX,
    "scaffold",
  );
  assert.equal(documents.length, 1);
  assert.ok(!documents[0].text.includes("undefined"));
  assert.ok(!documents[0].text.includes("not-a-visible-label"));
  assert.ok(documents[0].text.includes(stage.support.explanation));
});

test("partial journeys keep their available stages without inventing unrecorded stages", () => {
  const source = JOURNEYS.find((journey) => journey.paper === "mass-energy");
  assert.ok(source?.stages.length);
  const partial = {
    ...source,
    completeness: "partial",
    pendingElements: [
      {
        element: "move.derivationChain",
        reason: "Not yet recorded",
        ownerBead: "am-4k0m",
      },
    ],
  };
  assert.equal(
    journeyStageDocuments([partial], ROUTE_INDEX, "scaffold").length,
    source.stages.length,
  );
  assert.deepEqual(
    journeyStageDocuments(
      JOURNEYS.map((journey) => ({ ...journey, stages: [] })),
      ROUTE_INDEX,
      "scaffold",
    ),
    [],
  );
  for (const journey of JOURNEYS.filter((entry) => entry.stages.length === 0))
    assert.ok(!documents.some((document) => document.paper === journey.paper));
});

test("stage documents follow historical source publication profiles", () => {
  assert.deepEqual(journeyStageDocuments(JOURNEYS, ROUTE_INDEX, "preview"), []);
  assert.deepEqual(journeyStageDocuments(JOURNEYS, ROUTE_INDEX, "launch"), []);
  assert.throws(
    () => journeyStageDocuments(JOURNEYS, ROUTE_INDEX, "unknown"),
    /Unknown AM_RELEASE_PROFILE/,
  );
});

test("search-stage-route-missing refuses orphaned stages instead of emitting a dead result", () => {
  const source = JOURNEYS.find((journey) => journey.stages.length > 0);
  assert.ok(source);
  assert.throws(
    () => journeyStageDocuments([source], [], "scaffold"),
    (error) => {
      assert.ok(error instanceof JourneyStageSearchError);
      assert.equal(error.code, "search-stage-route-missing");
      assert.ok(error.message.includes(source.paper));
      return true;
    },
  );
});

test("source ordering cannot change documents or mutate the authored journeys", () => {
  const before = JSON.stringify(JOURNEYS);
  const reversed = [...JOURNEYS].reverse().map((journey) => ({
    ...journey,
    stages: [...journey.stages].reverse(),
  }));
  assert.deepEqual(
    journeyStageDocuments(reversed, [...ROUTE_INDEX].reverse(), "scaffold"),
    documents,
  );
  assert.equal(JSON.stringify(JOURNEYS), before);
});
