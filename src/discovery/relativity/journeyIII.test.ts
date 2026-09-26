/**
 * Journey III's forks (dispatch 260): the alternatives on the 1904 table, each worked far enough to
 * show where it leads. Two properties are held here, apart from the page:
 *   - each branch that is not the paper's names what decides it: the shelf measurement it fails
 *     against, the observations within which it agrees, or why the shelf cannot decide it and what
 *     later did;
 *   - no fork rests on a card later than 1904 unless that card is marked later evidence, and a
 *     branch fails only against the shelf: a later card may say what decided a question, never
 *     what refuted a branch on the 1904 table.
 * The framework's own fork rules (journeyChecks.ts: one papers-route per fork, a scope note that
 * names observables, an undecided branch pointing past 1904, the voice lint) run over the real
 * forks too, so the page's forks are held to the same gate as the fixture's.
 */
import { describe, expect, test } from "bun:test";
import type { Fork } from "../../content/schemas/journey.ts";
import {
  SPECIAL_RELATIVITY_LATER_EVIDENCE as LATER,
  SPECIAL_RELATIVITY_SHELF_CARDS as SHELF,
} from "../../content/specialRelativityShelf.ts";
import { type CardLookupContext, checkJourney } from "../checks/journeyChecks.ts";
import { FIXTURE_JOURNEY_BROWNIAN } from "../testing/fixtureJourney.ts";
import { FORK_SOURCE_SPEED, FORK_UNDETECTED_ETHER } from "./journeyIII.ts";

const FORKS = [FORK_UNDETECTED_ETHER, FORK_SOURCE_SPEED];
const CARDS = [...SHELF, ...LATER];
const byId = new Map(CARDS.map((c) => [c.id, c]));
const onShelf = new Set(SHELF.map((c) => c.id));

/** What a branch that is not the paper's route must name, by its outcome. */
function unnamed(fork: Fork): string[] {
  const out: string[] = [];
  for (const b of fork.branches) {
    const o = b.outcome;
    const named =
      (o.type === "dead-end-on-constraint" && !!o.constraintRef) ||
      (o.type === "empirically-equivalent-not-refuted" && !!o.scopeNote?.trim()) ||
      (o.type === "undecided-on-available-evidence" &&
        !!o.insufficiency?.trim() &&
        !!o.whatWouldDecide) ||
      o.type === "papers-route";
    if (!named) out.push(`${fork.id}/${b.id}: ${o.type} names no constraint or equivalence`);
  }
  return out;
}

/**
 * Every card a fork cites, checked against the 1904 line. A proponent's card and a constraint are
 * what the 1904 table held, so they must be on the shelf; the record that later decided an open
 * question must be later evidence. Any cited card past 1904 must be marked later or parallel work.
 */
function citationProblems(fork: Fork): string[] {
  const out: string[] = [];
  const cite = (id: string | undefined, role: string, needShelf: boolean) => {
    if (id === undefined) return;
    const card = byId.get(id);
    if (!card) return void out.push(`${fork.id}: ${role} ${id} is no card on the page`);
    if (card.date.latestYear > 1904 && card.status !== "later" && card.status !== "parallel-work")
      out.push(`${fork.id}: ${role} ${id} is from ${card.date.latestYear} and not marked later`);
    if (needShelf && !onShelf.has(id)) out.push(`${fork.id}: ${role} ${id} is not on the shelf`);
    if (!needShelf && (onShelf.has(id) || card.date.latestYear <= 1904))
      out.push(`${fork.id}: ${role} ${id} was on the 1904 table, so it cannot be what decided it`);
  };
  for (const b of fork.branches) {
    cite(b.proponent?.cardId, "proponent", true);
    cite(b.outcome.constraintRef, "constraint", true);
    cite(b.outcome.whatWouldDecide?.recordId, "later record", false);
  }
  return out;
}

describe("Journey III's forks", () => {
  test("each fork offers real alternatives, and each branch names its constraint or its equivalence", () => {
    for (const fork of FORKS) {
      // Two or more branches, of which exactly one is the paper's: the rest are the alternatives.
      expect(fork.branches.length).toBeGreaterThanOrEqual(2);
      expect(fork.branches.filter((b) => b.outcome.type === "papers-route").length).toBe(1);
      expect(unnamed(fork)).toEqual([]);
    }
    // The three alternatives the dispatch names, each decided the way its evidence allows.
    const outcome = (f: Fork, id: string) => f.branches.find((b) => b.id === id)?.outcome;
    expect(outcome(FORK_UNDETECTED_ETHER, "arg-branch-sr-ether-at-rest")).toMatchObject({
      type: "dead-end-on-constraint",
      constraintRef: "michelson-morley-1887-no-drift",
    });
    expect(outcome(FORK_UNDETECTED_ETHER, "arg-branch-sr-lorentz-ether")?.type).toBe(
      "empirically-equivalent-not-refuted",
    );
    // The emission view is not refuted on the shelf's evidence: it stays open until 1913.
    expect(outcome(FORK_SOURCE_SPEED, "arg-branch-sr-emission")).toMatchObject({
      type: "undecided-on-available-evidence",
      whatWouldDecide: { recordId: "de-sitter-1913-double-stars", year: 1913, status: "later" },
    });
  });

  test("the framework's fork rules hold for the page's forks, with the page's cards", () => {
    const cards: CardLookupContext = Object.fromEntries(
      CARDS.map((c) => [c.id, { id: c.id, date: c.date, status: c.status }]),
    );
    const findings = checkJourney({ ...FIXTURE_JOURNEY_BROWNIAN, forks: FORKS }, { cards }).filter(
      (f) => f.path.startsWith("journey.forks"),
    );
    // Errors fail, as in journeyForkContract.test.ts. The voice lint's informational matches (the
    // paper's own "independent of the state of motion") are warnings and stay visible to it.
    expect(
      findings.filter((f) => f.severity === "error").map((f) => `${f.rule}: ${f.message}`),
    ).toEqual([]);
    // Not vacuous: the forks reached the checker, which read their branches.
    expect(findings.some((f) => f.path.startsWith("journey.forks[1]"))).toBe(true);
  });

  test("no fork rests on a card past 1904 unless it is marked later evidence", () => {
    expect(FORKS.flatMap(citationProblems)).toEqual([]);
    // The later cards are later: past 1904, marked so, and never on the shelf.
    expect(LATER.length).toBeGreaterThan(0);
    for (const card of LATER) {
      expect(card.status).toBe("later");
      expect(card.date.latestYear).toBeGreaterThan(1904);
      expect(onShelf.has(card.id)).toBe(false);
    }
  });

  test("the plant: a branch that fails against the 1913 double stars is caught", () => {
    const [ether, lorentz, paper] = FORK_UNDETECTED_ETHER.branches;
    if (!ether || !lorentz || !paper) throw new Error("fork A has three branches");
    const planted: Fork = {
      ...FORK_UNDETECTED_ETHER,
      branches: [
        {
          ...ether,
          outcome: { ...ether.outcome, constraintRef: "de-sitter-1913-double-stars" },
        },
        lorentz,
        paper,
      ],
    };
    expect(citationProblems(planted)).toEqual([
      "arg-fork-sr-undetected-ether: constraint de-sitter-1913-double-stars is not on the shelf",
    ]);
    // And a later record that the 1904 table already held is no later record.
    const [emission, fixed] = FORK_SOURCE_SPEED.branches;
    if (!emission || !fixed) throw new Error("fork B has two branches");
    const early: Fork = {
      ...FORK_SOURCE_SPEED,
      branches: [
        {
          ...emission,
          outcome: {
            ...emission.outcome,
            whatWouldDecide: {
              name: "Michelson and Morley",
              recordId: "michelson-morley-1887-no-drift",
            },
          },
        },
        fixed,
      ],
    };
    expect(citationProblems(early)).toEqual([
      "arg-fork-sr-source-speed: later record michelson-morley-1887-no-drift was on the 1904 table, so it cannot be what decided it",
    ]);
  });

  test("the plant: a branch with nothing named is caught", () => {
    const [ether, lorentz, paper] = FORK_UNDETECTED_ETHER.branches;
    if (!ether || !lorentz || !paper) throw new Error("fork A has three branches");
    const bare: Fork = {
      ...FORK_UNDETECTED_ETHER,
      branches: [ether, { ...lorentz, outcome: { ...lorentz.outcome, scopeNote: " " } }, paper],
    };
    expect(unnamed(bare)).toEqual([
      "arg-fork-sr-undetected-ether/arg-branch-sr-lorentz-ether: empirically-equivalent-not-refuted names no constraint or equivalence",
    ]);
  });
});
