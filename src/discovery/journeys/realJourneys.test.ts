/**
 * THE EPISTEMIC GATES, RUN OVER THE FOUR REAL JOURNEYS (am-4k0m).
 *
 * am-4k0m: `checkJourney` had 38 call sites and every one passed a FIXTURE, so the post-1904 shelf
 * refusal, the fork contract, the mockery guard and the move-summary guard ran over an empty
 * population while four hand-authored journeys served readers. Its words: "The gates would pass on
 * this population. That is the point: nobody knows that, because they never ran on it."
 *
 * Now they have. Measured 2026-10-05 over the four composed from their own modules: 4 journeys
 * examined, 8 findings, of which ONE is an error and seven are informational voice warnings.
 *
 * The bead's prediction was nearly right, and the one error is the fork contract catching exactly what
 * AGENTS.md asks it to: "A failed alternative must fail on a stated constraint or observation."
 *
 *   brownian-motion  arg-fork-exner / arg-branch-apparent-speed
 *                    a dead-end-on-constraint outcome with no constraintRef
 *
 * That branch's dead end is conceptual -- for a randomly kicked particle an apparent speed is set by
 * the observation interval as much as by the particle -- so unlike its sibling it names no observation
 * card. The two precedents in this corpus both reference an OBSERVATION (light-quanta's references
 * lenard-1902-photoelectric, relativity's michelson-morley-1887-no-drift), and no card on the Brownian
 * shelf states the constraint this branch fails on. Supplying one means authoring a historical
 * knowledge card with a source, a date and provenance, which is not an agent's call, and changing the
 * outcome TYPE instead is a judgement about what the argument concludes. So it is declared below, with
 * its reason, and every other error must stay at zero.
 *
 * A SIBLING OF IT WAS FIXED, because its prose already named the card: arg-fork-naegeli's first branch
 * said "contradicts Fick's law ... and Gouy's observation that the motion never dies away" and carried
 * no constraintRef, and gouy-1888-brownian-motion is on this paper's shelf. That one is a structured
 * field filled from prose, not a new claim.
 */
import { describe, expect, it } from "bun:test";
import { checkJourney } from "../checks/journeyChecks.ts";
import { REAL_JOURNEYS } from "./realJourneys.ts";

/**
 * The one error that stands, named by paper and rule.
 *
 * A record of a debt, not a budget: any other error fails, and if this one is repaired the final test
 * below fails until the line is removed, so the ceiling comes down with the work.
 */
const DECLARED_ERRORS: readonly string[] = Object.freeze([
  "brownian-motion/missing-constraint-ref",
]);

/** Informational voice warnings, counted. A ceiling, so a new violation is caught. */
const VOICE_WARNING_CEILING = 7;

const findingsByPaper = REAL_JOURNEYS.map((journey) => ({
  paper: journey.paper,
  journey,
  findings: checkJourney(journey),
}));

describe("checkJourney over the real journeys, not the fixture", () => {
  it("four journeys are examined, and a count of zero fails", () => {
    // The bead's second acceptance item: the count examined is printed beside the verdict, and 0 fails.
    console.log(
      `[journey gates] ${REAL_JOURNEYS.length} real journeys examined: ${findingsByPaper
        .map((r) => `${r.paper} ${r.findings.length} finding(s)`)
        .join(" | ")}`,
    );
    expect(REAL_JOURNEYS.length).toBe(4);
    expect(REAL_JOURNEYS.length).toBeGreaterThan(0);
    // And each is the real thing rather than the fixture: the fixture's id is not a paper slug.
    expect(REAL_JOURNEYS.map((j) => j.paper).sort()).toEqual([
      "brownian-motion",
      "light-quanta",
      "mass-energy",
      "special-relativity",
    ]);
  });

  it("every journey carries its skeleton, through references rather than retyped prose", () => {
    for (const { journey } of findingsByPaper) {
      expect(journey.naggingFact.length).toBeGreaterThan(40);
      expect(journey.firstHonestQuestion.length).toBeGreaterThan(20);
      expect(journey.shelf.length).toBeGreaterThan(5);
      expect(journey.forks.length).toBeGreaterThanOrEqual(2);
      expect(journey.sourceJumps.length).toBeGreaterThan(0);
      expect(journey.worldChecks.length).toBeGreaterThan(0);
      expect(journey.move.label.length).toBeGreaterThan(5);
      expect(journey.doors.frontDoor).toBeDefined();
    }
  });

  it("a partial journey declares what it is missing, in the gate's own element names", () => {
    // The declaration only counts if it is spelled as the gate spells it. Declared as "exercises"
    // first, which the gate does not recognise, so three journeys reported an undeclared missing
    // element while the pending list sat right there. A declaration spelled differently from the thing
    // it declares is no declaration.
    for (const { journey } of findingsByPaper) {
      expect(journey.completeness).toBe("partial");
      const declared = (journey.pendingElements ?? []).map((p) => p.element);
      expect(declared).toContain("stages");
      expect(declared).toContain("exercises.instrumented");
      for (const pending of journey.pendingElements ?? []) {
        expect(pending.reason.length).toBeGreaterThan(40);
        expect(pending.ownerBead).toBe("am-4k0m");
      }
    }
  });

  it("no error beyond the one declared", () => {
    const errors = findingsByPaper.flatMap((r) =>
      r.findings.filter((f) => f.severity === "error").map((f) => `${r.paper}/${f.rule}`),
    );
    const undeclared = errors.filter((e) => !DECLARED_ERRORS.includes(e));
    expect(undeclared).toEqual([]);
  });

  it("the voice warnings do not grow", () => {
    const warnings = findingsByPaper.flatMap((r) =>
      r.findings.filter((f) => f.severity === "warning"),
    );
    console.log(
      `[journey gates] ${warnings.length} informational warning(s), ceiling ${VOICE_WARNING_CEILING}: ${[
        ...new Set(warnings.map((w) => w.rule)),
      ].join(", ")}`,
    );
    expect(warnings.length).toBeLessThanOrEqual(VOICE_WARNING_CEILING);
    // Non-vacuity: there really are warnings, so the ceiling is measuring something.
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("the declared error is still real, so the exception cannot outlive its reason", () => {
    // The tightening half. If the Exner branch gains a constraintRef, this fails and the line comes
    // out of DECLARED_ERRORS -- a baseline that only ever protects is a budget.
    const errors = findingsByPaper.flatMap((r) =>
      r.findings.filter((f) => f.severity === "error").map((f) => `${r.paper}/${f.rule}`),
    );
    for (const declared of DECLARED_ERRORS) expect(errors).toContain(declared);
  });

  it("every dead end that names a constraint names one on its own shelf", () => {
    // The fork contract, checked directly rather than through the schema, because the schema stops at
    // the FIRST error and so never reaches a branch after it -- which is why the Naegeli repair was
    // invisible to the run above and had to be verified on its own.
    const shelves = new Map(REAL_JOURNEYS.map((j) => [j.paper, new Set(j.shelf)]));
    const deadEnds: string[] = [];
    const unreferenced: string[] = [];
    const offShelf: string[] = [];
    for (const journey of REAL_JOURNEYS)
      for (const fork of journey.forks)
        for (const branch of fork.branches) {
          if (branch.outcome.type !== "dead-end-on-constraint") continue;
          deadEnds.push(`${journey.paper}/${branch.id}`);
          const ref = branch.outcome.constraintRef;
          if (ref === undefined || ref.trim() === "") {
            unreferenced.push(`${journey.paper}/${branch.id}`);
            continue;
          }
          if (!shelves.get(journey.paper)?.has(ref))
            offShelf.push(`${journey.paper}/${branch.id} -> ${ref}`);
        }
    console.log(
      `[journey forks] ${deadEnds.length} dead-end branch(es); ${unreferenced.length} name no constraint; ${offShelf.length} name one off their own shelf`,
    );
    // Non-vacuity: there really are dead ends, so "none is off-shelf" is a result.
    expect(deadEnds.length).toBeGreaterThan(2);
    // A reference that points off the shelf is worse than none: it reads as checked and is not.
    expect(offShelf).toEqual([]);
    // Exactly the one declared debt names no constraint.
    expect(unreferenced).toEqual(["brownian-motion/arg-branch-apparent-speed"]);
  });

  it("the fixture keeps working, because this bead adds a population and removes none", () => {
    // am-4k0m's last acceptance line. The fixture's own tests are elsewhere; this asserts only that
    // the real journeys are a SECOND population rather than a replacement.
    expect(REAL_JOURNEYS.every((j) => j.id !== "fixture-journey")).toBe(true);
  });
});
