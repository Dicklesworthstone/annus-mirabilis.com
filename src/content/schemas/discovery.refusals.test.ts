/**
 * Refusal coverage for `discovery-invalid`, the single refusal of the discovery-journey schema
 * (am-muyh, am-16nj).
 *
 * This 18 KB validator had NO test file. Its refusal carries a typed code on the class,
 * `readonly code = "discovery-invalid"`, and the bare-throw scanner cannot see a code declared that
 * way, so the site read as an untyped throw and no coverage was ever asked for. These are its
 * accept and reject halves, written before the scanner is taught to resolve the class, so the site
 * arrives already covered rather than as new debt.
 *
 * `validateDiscoveryJourney` has no production caller today -- only its TYPES are imported, by
 * `src/discovery/links.ts` and `src/discovery/notebook.ts` -- which is the likeliest reason it was
 * never tested. That is recorded rather than acted on: an unreached validator whose rules encode
 * the 1904 boundary is worth keeping correct, and deleting an export is not a refusal-coverage
 * change.
 *
 * The rules asserted below are the epistemic ones AGENTS.md states, not arbitrary shapes: later
 * evidence may not enter the 1904 shelf, exactly one conceptual move is named, a fork is worked,
 * no premise is forward or circular, and a stage with no working instrument may not advertise one.
 */
import { describe, expect, test } from "bun:test";
import { DiscoveryContentError, validateDiscoveryJourney } from "./discovery.ts";

const CITATION = Object.freeze({
  label: "Ann. Phys. 17, 549",
  url: "https://example.invalid/ap-17-549",
  locator: "p. 549",
});

function card(id: string, latestYear = 1888): Record<string, unknown> {
  return {
    id,
    title: `Card ${id}`,
    latestYear,
    availability: "available-by-1904",
    admission: "Published and available to a careful reader before the cutoff.",
    proposition: "The motion of a suspended particle never dies away.",
    limitation: "Observed qualitatively; no quantitative law is claimed here.",
    citation: CITATION,
  };
}

function lab(id: string): Record<string, unknown> {
  return { id, title: `Lab ${id}`, task: "Change one input.", observe: "Read the snapshot." };
}

function alternative(id: string): Record<string, unknown> {
  return {
    id,
    title: `Alternative ${id}`,
    retains: "It keeps the kinetic account of heat.",
    consequence: "It predicts a speed that depends on the observation interval.",
    limitation: "It fails on a stated constraint rather than on preference.",
  };
}

type StageShape = Readonly<{
  id: string;
  role: "question" | "fork" | "move" | "consequence";
  dependsOn?: readonly string[];
  premises?: readonly string[];
  labs?: readonly Record<string, unknown>[];
  unavailable?: string | null;
}>;

function stage(shape: StageShape): Record<string, unknown> {
  const role = shape.role;
  return {
    id: shape.id,
    title: `Stage ${shape.id}`,
    role,
    dependsOn: shape.dependsOn ?? [],
    premises: shape.premises ?? [],
    question: "What would make a reasonable person suspect this?",
    // Each of these is `paragraphs(..., min = 1)`, so none may be empty. The fixture in
    // src/discovery/links.test.ts has all six empty, which is consistent with it never having
    // been passed through this validator: it imports the TYPE only.
    overview: ["What this stage asks, in one breath."],
    qualifications: ["Stated for a dilute suspension of spheres."],
    reasoning: ["The displacement, not the speed, is what an interval can report."],
    alternatives: role === "fork" ? [alternative("alt-a"), alternative("alt-b")] : [],
    labs: shape.labs ?? (shape.unavailable === undefined ? [lab("bm-01")] : []),
    paperLocator: "§4",
    unavailable: shape.unavailable ?? null,
  };
}

/** A journey the validator accepts. Every refusal below is this with one field changed. */
function valid(): Record<string, unknown> {
  return {
    kind: "discovery-journey",
    schemaVersion: 1,
    id: "journey-brownian-motion",
    paper: "brownian-motion",
    // An id, not a number: the pattern is /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, so "1" is refused.
    revision: "rev-1",
    reviewState: "machine-draft",
    title: "A route you could take",
    question: "Why does a suspended particle never settle?",
    introduction: ["A route you could take through the 1905 Brownian paper."],
    scope: ["This route stops where the paper's own argument stops."],
    source: CITATION,
    shelf: [card("gouy-1888"), card("fick-1855", 1855)],
    stages: [
      stage({ id: "observable", role: "question", premises: ["gouy-1888"] }),
      stage({ id: "the-fork", role: "fork", dependsOn: ["observable"] }),
      stage({ id: "the-move", role: "move", dependsOn: ["the-fork"] }),
      stage({ id: "consequence", role: "consequence", dependsOn: ["the-move"] }),
    ],
    evidence: [],
    conclusion: ["The spreading law follows from independence and nothing later."],
  };
}

/** Changes one field of a valid journey, so each refusal differs from the accept by one thing. */
function withChange(change: (j: Record<string, unknown>) => void): Record<string, unknown> {
  const j = valid();
  change(j);
  return j;
}

function refusalOf(input: unknown): DiscoveryContentError {
  try {
    validateDiscoveryJourney(input);
  } catch (error) {
    if (error instanceof DiscoveryContentError) return error;
    throw error;
  }
  // Not `expect.unreachable`: it exists in bun at runtime but not in this repository's ambient
  // types, so it passes `bun test` and fails `bun run check:types`.
  throw new Error("expected validateDiscoveryJourney to refuse, and it returned a journey");
}

describe("the accept half, which is what makes every refusal below mean something", () => {
  test("a well-formed journey validates and is returned frozen", () => {
    const journey = validateDiscoveryJourney(valid());
    expect(journey.id).toBe("journey-brownian-motion");
    expect(journey.paper).toBe("brownian-motion");
    expect(journey.shelf.length).toBe(2);
    expect(journey.stages.length).toBe(4);
    expect(Object.isFrozen(journey)).toBe(true);
    // Without this, a validator that refused EVERYTHING would pass every test in this file.
    expect(journey.stages.filter((s) => s.role === "move").length).toBe(1);
  });
});

describe("discovery-invalid: every refusal carries the code and the path that failed", () => {
  test("the code is on the class, which is why the scanner could not see it", () => {
    const error = refusalOf({});
    expect(error.code).toBe("discovery-invalid");
    expect(error.name).toBe("DiscoveryContentError");
    // The path names the FIELD, not just the record: an empty object fails on the first required
    // key rather than reporting "journey" and leaving the author to find it.
    expect(error.path).toBe("journey.kind");
    // The message leads with that path, so a reader is told WHERE rather than only that something
    // is wrong. Asserted on the field as well, since a message is a presentation surface.
    expect(error.message.startsWith("journey.kind:")).toBe(true);
    // And a deeper failure carries a deeper path, so the field above is not a constant.
    expect(
      refusalOf(
        withChange((j) => {
          j.reviewState = "reviewed";
        }),
      ).path,
    ).toBe("journey.reviewState");
  });

  test("the 1904 boundary: later evidence cannot enter the shelf", () => {
    const error = refusalOf(
      withChange((j) => {
        j.shelf = [card("millikan-1916", 1916), card("fick-1855", 1855)];
      }),
    );
    expect(error.code).toBe("discovery-invalid");
    expect(error.message).toContain("Later evidence cannot enter the 1904 shelf");
    expect(error.path).toBe("journey.shelf[0]");
  });

  test("the sole admitted 1905 import is named, and only for mass-energy", () => {
    const error = refusalOf(
      withChange((j) => {
        j.shelf = [{ ...card("not-the-light-energy", 1905), availability: "admitted-1905" }];
      }),
    );
    expect(error.message).toContain("The sole 1905 shelf import");
  });

  test("exactly one conceptual move, so a route cannot name two or none", () => {
    for (const roles of [
      ["question", "fork", "consequence"],
      ["question", "fork", "move", "move"],
    ] as const) {
      const error = refusalOf(
        withChange((j) => {
          j.stages = roles.map((role, index) =>
            stage({
              id: `s${index}`,
              role,
              ...(index > 0 ? { dependsOn: [`s${index - 1}`] } : {}),
            }),
          );
        }),
      );
      expect(error.message).toContain("Name exactly one conceptual move");
    }
  });

  test("a journey needs a worked fork", () => {
    const error = refusalOf(
      withChange((j) => {
        j.stages = (["question", "move", "consequence"] as const).map((role, index) =>
          stage({
            id: `s${index}`,
            role,
            ...(index > 0 ? { dependsOn: [`s${index - 1}`] } : {}),
          }),
        );
      }),
    );
    expect(error.message).toContain("A journey needs a worked fork");
  });

  test("no forward or circular premise: a stage cannot depend on a later one", () => {
    const error = refusalOf(
      withChange((j) => {
        j.stages = [
          stage({ id: "observable", role: "question", dependsOn: ["the-move"] }),
          stage({ id: "the-fork", role: "fork", dependsOn: ["observable"] }),
          stage({ id: "the-move", role: "move", dependsOn: ["the-fork"] }),
        ];
      }),
    );
    expect(error.message).toContain("has not been established");
    expect(error.message).toContain("no forward or circular premises");
  });

  test("a premise must be a card on this journey's own shelf", () => {
    const error = refusalOf(
      withChange((j) => {
        j.stages = [
          stage({
            id: "observable",
            role: "question",
            premises: ["card-that-is-not-on-the-shelf"],
          }),
          stage({ id: "the-fork", role: "fork", dependsOn: ["observable"] }),
          stage({ id: "the-move", role: "move", dependsOn: ["the-fork"] }),
        ];
      }),
    );
    expect(error.message).toContain("Unknown shelf premise");
  });

  test("a stage with no working instrument must not advertise one", () => {
    const error = refusalOf(
      withChange((j) => {
        j.stages = [
          stage({ id: "observable", role: "question" }),
          stage({ id: "the-fork", role: "fork", dependsOn: ["observable"] }),
          stage({
            id: "the-move",
            role: "move",
            dependsOn: ["the-fork"],
            unavailable: "This instrument needs WebGL, which this device does not offer.",
            labs: [lab("bm-05")],
          }),
        ];
      }),
    );
    expect(error.message).toContain("must not advertise a working laboratory");
  });

  test("review state is not an author-editable approval switch", () => {
    const error = refusalOf(
      withChange((j) => {
        j.reviewState = "reviewed";
      }),
    );
    expect(error.message).toContain("admits machine drafts only");
    expect(error.path).toBe("journey.reviewState");
  });

  test("the identity must match the paper, so two papers cannot share a record", () => {
    const error = refusalOf(
      withChange((j) => {
        j.id = "journey-light-quanta";
      }),
    );
    expect(error.message).toContain("Identity must match the paper");
  });

  test("pre-1905 material belongs on the shelf with its limits, not in the evidence list", () => {
    const error = refusalOf(
      withChange((j) => {
        j.evidence = [
          {
            id: "lenard-1902",
            year: 1902,
            title: "Lenard's photoelectric observations",
            supports: "It is pre-1905, so it is shelf material.",
            limitation: "Stated here only to be refused.",
            citation: CITATION,
          },
        ];
      }),
    );
    expect(error.message).toContain("Pre-1905 material belongs on the shelf");
  });

  test("an unsupported kind or schema version is refused before anything else is read", () => {
    for (const change of [
      (j: Record<string, unknown>) => {
        j.kind = "journey";
      },
      (j: Record<string, unknown>) => {
        j.schemaVersion = 2;
      },
    ]) {
      const error = refusalOf(withChange(change));
      expect(error.message).toContain("Unsupported discovery record kind or schema version");
    }
  });
});
