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
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { load as loadYaml } from "js-yaml";
import { validateJourney } from "../../content/schemas/journey.ts";
import { checkJourney } from "../checks/journeyChecks.ts";
import { REAL_JOURNEYS } from "./realJourneys.ts";
import { SHELF_CARD_CONTEXT } from "./shelves.ts";

/**
 * EMPTY, AND IT IS A FLOOR OF ZERO NOW RATHER THAN AN EXEMPTION.
 *
 * It held `brownian-motion/missing-constraint-ref`, with the note that "if this one is repaired the
 * final test below fails until the line is removed, so the ceiling comes down with the work". It was
 * repaired, so the line came out. The four real journeys now produce no error of any rule.
 *
 * Keeping the constant rather than deleting it is deliberate: the two tests below read it, and an
 * empty list makes them assert zero errors instead of a named exception. A new error therefore fails
 * on arrival with nothing to add it to.
 */
const DECLARED_ERRORS: readonly string[] = Object.freeze([]);

/**
 * Informational voice warnings, counted. A ceiling, so a new violation is caught.
 *
 * SEVEN UNTIL 2026-10-07, AND THE FOUR ADDED ARE NOT NEW DEBT -- they were masked. `checkJourney`
 * returns after its first schema error, and brownian-motion had one, so that journey reported a
 * single finding and its remaining branches were never reached. Repairing the Exner outcome let the
 * run see them: brownian-motion went from 1 finding to 4, all of them pre-existing matches on the
 * word "independent" in prose written long before. The count rose because the instrument started
 * working, which is the one reason a ceiling may rise, and the per-paper breakdown asserted below is
 * what makes a future masking visible instead of inferable.
 */
const VOICE_WARNING_CEILING = 11;

const ROOT = process.cwd();

/**
 * The card catalogue, passed on every call. WITHOUT IT THE 1904 SHELF RULE IS SILENT.
 *
 * `checkJourney(journey)` used to be called with no options at all here, and the shelf-date rule only
 * fires on a card it can look up, so the rule that AGENTS.md calls a build gate examined zero cards on
 * the very population this file exists to examine. Planting `plant-jeans-1905` -- status available,
 * latestYear 1905, no flag -- on light-quanta's shelf produced 0 shelf-date violations before the
 * context was passed and 1 after. The plant is kept below so that silence cannot return.
 */
const CARDS = { cards: SHELF_CARD_CONTEXT } as const;

const findingsByPaper = REAL_JOURNEYS.map((journey) => ({
  paper: journey.paper,
  journey,
  findings: checkJourney(journey, CARDS),
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
    // THE PER-PAPER BREAKDOWN, because a total cannot show masking. brownian-motion reported one
    // finding for as long as its schema error stood, and a falling total would have read as an
    // improvement. Pinned per paper, a journey that goes quiet is visible on the line that names it.
    // These are counts of informational matches on existing prose, so they are reported rather than
    // asserted as a property; the equality is here because its failure is the signal.
    const perPaper = Object.fromEntries(
      findingsByPaper.map((r) => [
        r.paper,
        r.findings.filter((f) => f.severity === "warning").length,
      ]),
    );
    expect(perPaper).toEqual({
      "light-quanta": 5,
      "brownian-motion": 4,
      "special-relativity": 2,
      "mass-energy": 0,
    });
    // And every paper was actually run, so a missing key cannot pass as a zero.
    expect(Object.keys(perPaper).sort()).toEqual(REAL_JOURNEYS.map((j) => j.paper).sort());
  });

  it("the declared error is still real, so the exception cannot outlive its reason", () => {
    // The tightening half, and with DECLARED_ERRORS empty it has to say so directly: a
    // `for (const d of [])` loop asserts nothing, so the paid-off version of this test would have
    // been vacuous and green. Assert the zero instead.
    const errors = findingsByPaper.flatMap((r) =>
      r.findings.filter((f) => f.severity === "error").map((f) => `${r.paper}/${f.rule}`),
    );
    for (const declared of DECLARED_ERRORS) expect(errors).toContain(declared);
    expect(errors).toEqual([]);
    // Non-vacuity: the run produced findings, so "no errors" is a verdict about a population that
    // was examined rather than about one nothing looked at.
    expect(findingsByPaper.flatMap((r) => r.findings).length).toBeGreaterThan(0);
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
    // Every dead end now names its constraint. The Exner branch used to be the exception and is no
    // longer a dead end at all: it is `correct-but-weaker`, because nothing refuted the measurement.
    expect(unreferenced).toEqual([]);
  });

  it("THE RECORD IS FAITHFUL: each content/journeys YAML parses back to the composed journey", () => {
    // am-4k0m's first acceptance item asks that the prose be MOVED, not rewritten, and that a diff show
    // no reader-facing text lost. This is that clause as a machine-checked property: the records were
    // emitted by serialising these very objects (scripts/emit-journey-records.ts), so nobody retyped a
    // sentence, and the parse below proves the file on disk still holds exactly what the page renders.
    //
    // While the page renders from the module, this equality is the whole safety of the next step. The
    // moment it is pointed at the record instead, this test is what says the reader sees the same words.
    const missing: string[] = [];
    const differing: string[] = [];
    const carriedLineage: string[] = [];
    let compared = 0;
    for (const journey of REAL_JOURNEYS) {
      const path = resolve(ROOT, `content/journeys/${journey.paper}.yaml`);
      if (!existsSync(path)) {
        missing.push(journey.paper);
        continue;
      }
      compared += 1;
      const parsed = loadYaml(readFileSync(path, "utf8")) as Record<string, unknown>;
      // `lineage` is EXCLUDED, and only `lineage`. It is revision metadata the emitter adds -- a fact
      // about how the file reached its revision, not part of what the journey claims -- which is the
      // separation AGENTS.md asks for and the same exclusion `computeCanonicalRecordHash` already
      // makes. Excluding it does not loosen "no reader-facing text lost": a lineage entry is not
      // reader-facing text, and the arm below checks that nothing ELSE was excluded by mistake.
      const { lineage, ...content } = parsed;
      if (lineage !== undefined) carriedLineage.push(journey.paper);
      // Through JSON on both sides: the record holds data, and this compares values rather than the
      // frozen-ness or the prototype of the composed object.
      if (JSON.stringify(content) !== JSON.stringify(JSON.parse(JSON.stringify(journey))))
        differing.push(journey.paper);
    }
    console.log(
      `[journey records] ${compared} record(s) compared against the composed journeys; ` +
        `${carriedLineage.length} carry a lineage (${carriedLineage.join(", ") || "none"})`,
    );
    // Non-vacuity: all four must be on disk, or this passes by comparing nothing.
    expect(missing).toEqual([]);
    expect(compared).toBe(REAL_JOURNEYS.length);
    expect(differing).toEqual([]);
    // And the exclusion is not a hole anybody can widen: exactly the records past revision 1 carry a
    // lineage, so a lineage on a revision-1 record, or a missing one past it, fails here.
    const pastFirst = REAL_JOURNEYS.filter((j) => Number(j.revision) > 1).map((j) => j.paper);
    expect(carriedLineage.sort()).toEqual(pastFirst.sort());
    expect(pastFirst.length).toBeGreaterThan(0);
  });

  it("the emitted record validates against the journey schema", () => {
    // A record the compiler can read has to satisfy the schema, not merely round-trip. validateJourney
    // throws on the first violation, so this is the same contract checkJourney applies.
    for (const journey of REAL_JOURNEYS) {
      const path = resolve(ROOT, `content/journeys/${journey.paper}.yaml`);
      const parsed = loadYaml(readFileSync(path, "utf8"));
      // All four validate since the Exner outcome was repaired. brownian-motion was asserted to
      // THROW missing-constraint-ref here, which is what a declared debt looks like in a test and is
      // the assertion that had to be inverted when the debt was paid.
      expect(() => validateJourney(parsed)).not.toThrow();
    }
  });

  it("the fixture keeps working, because this bead adds a population and removes none", () => {
    // am-4k0m's last acceptance line. The fixture's own tests are elsewhere; this asserts only that
    // the real journeys are a SECOND population rather than a replacement.
    expect(REAL_JOURNEYS.every((j) => j.id !== "fixture-journey")).toBe(true);
  });
});

/**
 * THE PLANTED NEGATIVES, AGAINST A REAL JOURNEY (am-4k0m, fourth acceptance item).
 *
 * The bead names three by hand -- "a post-1904 card without a flag must go red; a fork whose branch has
 * no worksWhen must go red; a journey with no MOVE must go red" -- and asks for the plant to print what
 * landed before the verdict is read. Each case below does exactly that, and the planting found more than
 * it was sent for:
 *
 *   - The post-1904 plant STAYED GREEN. The shelf-date rule ran only over `stage.premiseRefs`, and the
 *     four real journeys declare no stages, so the rule examined nothing on the population a reader
 *     reaches. journeyChecks section 1b now checks the journey's own shelf with the same
 *     `evaluateShelfDate`, and this plant turns it red.
 *   - A fourth plant, not asked for, CRASHED the gate: a stage carrying only the four fields the schema
 *     REQUIRES threw a TypeError at `for (const pRef of stage.premiseRefs)`, because `checkJourney`
 *     discarded the normalised record `validateJourney` returns and read the raw object instead, so
 *     every default the schema promises was missing. A crash is not a refusal.
 *
 * Both repairs are in journeyChecks.ts, and both were measured before and after on the real journeys:
 * the four papers' findings are 5, 1, 2 and 0 either way, so neither repair changed a verdict about the
 * content. What changed is which plants can be caught.
 */
describe("the plants: each epistemic gate, broken on purpose, on a real journey", () => {
  /** A real journey by paper, as the lane sees it. */
  const real = (paper: string) => {
    const journey = REAL_JOURNEYS.find((j) => j.paper === paper);
    if (!journey) throw new Error(`no real journey for ${paper}; the plant cannot be placed.`);
    return journey;
  };
  const errorsOf = (journey: unknown, cards: typeof SHELF_CARD_CONTEXT = SHELF_CARD_CONTEXT) =>
    checkJourney(journey as never, { cards }).filter((f) => f.severity === "error");

  it("the catalogue covers every shelf id, so the rule has something to look up", () => {
    // The non-vacuity arm for the whole describe below. A card the context does not know is skipped by
    // design, so an incomplete catalogue would make the shelf rule silent while every plant still
    // passed -- the silence would move rather than be caught.
    const refs = REAL_JOURNEYS.flatMap((j) => j.shelf.map((id) => `${j.paper}/${id}`));
    const missing = refs.filter(
      (ref) => !SHELF_CARD_CONTEXT[String(ref.split("/").slice(1).join("/"))],
    );
    console.log(
      `[shelf rule] ${refs.length} shelf reference(s) across ${REAL_JOURNEYS.length} journeys; ` +
        `catalogue holds ${Object.keys(SHELF_CARD_CONTEXT).length} card(s); ${missing.length} unknown`,
    );
    expect(refs.length).toBeGreaterThan(30);
    expect(missing).toEqual([]);
  });

  it("A POST-1904 CARD WITH NO FLAG ON A REAL SHELF GOES RED (journeyChecks.ts:225)", () => {
    const journey = real("light-quanta");
    const planted = { ...journey, shelf: [...journey.shelf, "plant-jeans-1905-correction"] };
    const cards = {
      ...SHELF_CARD_CONTEXT,
      "plant-jeans-1905-correction": {
        id: "plant-jeans-1905-correction",
        date: { latestYear: 1905 },
        status: "available",
      },
    };
    // What landed, before the verdict is read.
    console.log(
      `[plant] light-quanta shelf ${journey.shelf.length} -> ${planted.shelf.length} ids, last = ` +
        `${planted.shelf.at(-1)}, status available, latestYear 1905, no flag`,
    );
    const errors = errorsOf(planted, cards);
    expect(errors.map((e) => e.rule)).toContain("shelf-date-violation");
    const violation = errors.find((e) => e.rule === "shelf-date-violation");
    // Named, and the reader is told what to do about it.
    expect(violation?.message).toContain("plant-jeans-1905-correction");
    expect(violation?.path).toBe(`journey.shelf[${planted.shelf.length - 1}]`);
    expect(violation?.repair ?? "").not.toBe("");
  });

  it("a LATER card on a real shelf goes red too, because later evidence is not a premise", () => {
    // The second half of the shelf rule, and a different reason code, so the two cases cannot be
    // satisfied by one branch: a 1916 confirmation belongs in a world check.
    const journey = real("light-quanta");
    const planted = { ...journey, shelf: [...journey.shelf, "plant-millikan-1916"] };
    const cards = {
      ...SHELF_CARD_CONTEXT,
      "plant-millikan-1916": {
        id: "plant-millikan-1916",
        date: { latestYear: 1916 },
        status: "later",
      },
    };
    console.log(`[plant] added plant-millikan-1916, status later, latestYear 1916`);
    const violation = errorsOf(planted, cards).find((e) => e.rule === "shelf-date-violation");
    expect(violation).toBeDefined();
    expect(violation?.message).toContain("later-card");
  });

  it("a FORK BRANCH WITH NO worksWhen GOES RED", () => {
    const journey = real("brownian-motion");
    const fork = journey.forks[0];
    const branch = fork?.branches[0];
    expect(branch?.worksWhen ?? "").not.toBe("");
    const { worksWhen: _removed, ...stripped } = branch as Record<string, unknown>;
    const planted = {
      ...journey,
      forks: [{ ...fork, branches: [stripped, ...(fork?.branches ?? []).slice(1)] }],
    };
    console.log(
      `[plant] ${fork?.id} / ${(branch as { id?: string })?.id}: worksWhen removed ` +
        `(was ${String((branch as { worksWhen?: string })?.worksWhen).length} characters)`,
    );
    expect(errorsOf(planted).map((e) => e.rule)).toContain("missing-branch-works-when");
  });

  it("a JOURNEY WITH NO MOVE GOES RED", () => {
    const journey = real("light-quanta");
    expect(journey.move.label.length).toBeGreaterThan(5);
    const { move: _removed, ...stripped } = journey as unknown as Record<string, unknown>;
    console.log(`[plant] light-quanta move removed (was "${journey.move.label}")`);
    expect(errorsOf(stripped).map((e) => e.rule)).toContain("missing-move");
  });

  it("a STAGE citing a post-1904 card is refused too (journeyChecks.ts:649)", () => {
    // THE OTHER shelf-date SITE, and the one that was unreachable on this population: the rule inside the
    // stage loop. No real journey declares stages -- the staged chain is the discover page's JSX -- so
    // that site had nothing to judge, which is exactly why the shelf-level rule above was added rather
    // than this one being trusted. It is still the rule a journey WILL hit once its stages become data,
    // so it is planted here, with a stage carrying every field the schema requires.
    const journey = real("light-quanta");
    const planted = {
      ...journey,
      stages: [
        {
          id: "plant-stage",
          title: "A planted stage",
          question: "Does a stage citing a 1905 card get refused?",
          computeFromShelf: "Nothing; this stage exists to reach one rule.",
          premiseRefs: [{ cardId: "plant-jeans-1905-in-a-stage" }],
        },
      ],
    };
    const cards = {
      ...SHELF_CARD_CONTEXT,
      "plant-jeans-1905-in-a-stage": {
        id: "plant-jeans-1905-in-a-stage",
        date: { latestYear: 1905 },
        status: "available",
      },
    };
    console.log(
      `[plant] light-quanta given 1 stage citing plant-jeans-1905-in-a-stage ` +
        `(status available, latestYear 1905, no flag)`,
    );
    const violation = errorsOf(planted, cards).find((e) => e.rule === "shelf-date-violation");
    expect(violation).toBeDefined();
    // The stage path's own message names the stage, where the shelf path's names the shelf index. The
    // two sites are told apart by that, which is what makes citing them separately meaningful.
    expect(violation?.message).toContain("plant-stage");
    expect(violation?.path).toContain("premiseRefs");
  });

  it("a stage with only its required fields does NOT crash the gate", () => {
    // The plant that was not asked for. Before the normalisation repair this threw a TypeError, so the
    // gate produced a stack trace rather than a finding on input the schema calls valid.
    const journey = real("light-quanta");
    const planted = {
      ...journey,
      stages: [
        {
          id: "plant-stage",
          title: "A planted stage",
          question: "Does the gate survive a stage with no optional fields?",
          computeFromShelf: "Nothing; this stage exists to reach one code path.",
        },
      ],
    };
    console.log(
      `[plant] light-quanta stages 0 -> 1, keys = ${Object.keys(planted.stages[0] ?? {}).join(",")}`,
    );
    // A verdict, not a throw. Which findings it reports is a separate question; that it REACHES a
    // verdict is this plant's whole point.
    expect(() => checkJourney(planted as never, CARDS)).not.toThrow();
    // And the stage really was examined rather than skipped: declaring `stages` pending while carrying
    // one is itself an error, which is the gate reading the stage it was handed.
    expect(errorsOf(planted).map((e) => e.rule)).toContain(
      "journey-pending-element-already-present",
    );
  });

  it("and the unmodified journeys stay green, so no plant above is a function that always refuses", () => {
    // The positive control. Measured both before and after the two repairs in journeyChecks.ts:
    // 5, 1, 2 and 0 findings, with the one declared error in brownian-motion.
    for (const journey of REAL_JOURNEYS) {
      const errors = errorsOf(journey).map((e) => `${journey.paper}/${e.rule}`);
      expect(errors.filter((e) => !DECLARED_ERRORS.includes(e))).toEqual([]);
    }
  });

  it("mass-energy declares the one 1905 import its own card admits, and the others declare none", () => {
    // The shelf rule's first real finding: the card carried the admitted-import block and the journey
    // declared nothing, so the mass-energy shelf refused with admitted-import-undeclared. The
    // declaration is derived from the card, which is why it is one line of data and not a new claim.
    const byPaper = new Map(REAL_JOURNEYS.map((j) => [j.paper, j.admittedImports ?? []]));
    expect((byPaper.get("mass-energy") ?? []).map((i) => i.importId)).toEqual([
      "einstein-1905-light-complex-transformation",
    ]);
    for (const paper of ["light-quanta", "brownian-motion", "special-relativity"]) {
      expect(byPaper.get(paper)).toEqual([]);
    }
    // Derived, not retyped: both strings come from the card.
    const declared = (byPaper.get("mass-energy") ?? [])[0];
    expect(declared?.provenance ?? "").toContain("Zur Elektrodynamik bewegter");
    expect(declared?.sourceAnchor).toBe("/papers/special-relativity/s8/");
  });
});
