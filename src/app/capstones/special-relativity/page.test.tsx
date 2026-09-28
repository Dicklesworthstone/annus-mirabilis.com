/**
 * /capstones/special-relativity/ (am-disc-capstone-relativity-t8hg, dispatch 363).
 *
 * The usual page assertions, plus the ones this paper needs and the other three did not. Its bead
 * fixes the record exactly: nine claims, twelve edges, 105 arrangements, six named violations in the
 * start order, four presets whose values the real owners reproduce. Each of those is asserted here
 * against the record and the render rather than trusted to the author, because a capstone that
 * validates is not a capstone that says what its bead specified.
 *
 * THE THREE WAYS A CAPSTONE OF THIS PAPER GOES WRONG, each asserted as a property:
 *   - it stops after the kinematical part, leaving sections six to ten behind the famous half;
 *   - it lets a later aid in as a premise, the invariant interval or a spacetime diagram, or makes
 *     the train picture of 1917 or the ether-drift experiments the argument of 1905;
 *   - it reads the paper's two CHOICES as results: the synchronization stipulation and the
 *     definition of force behind the electron's masses.
 *
 * WHY THIS FILE IS NOT AT THE PATH THE BEAD NAMES. The bead's test plan names
 * `content/arguments/capstones/specialRelativity.test.ts`. Measured today: `bun run test` is
 * `bun test --isolate --timeout 60000 src scripts`, tsconfig includes only `src/**` and `scripts/**`,
 * and `git ls-files '*.test.ts' '*.test.tsx' | grep -vE '^(src|scripts)/'` returns nothing, so no
 * test in this repository lives outside those two trees. A file at that path would be neither run
 * nor typechecked: a gate that cannot fail, which is the exact shape AGENTS.md devotes two sections
 * to. It is therefore here, beside the page, which is also where the other three capstones keep
 * their record checks. The deviation is reported on the bead rather than taken silently.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { validateCapstone } from "../../../discovery/capstone/capstoneSchema.ts";
import { loadCapstone } from "../../../discovery/capstone/loadCapstone.ts";
import {
  consistentOrderCount,
  dependencyFeedback,
} from "../../../discovery/shared/dependencyFeedback.ts";
import { measureRodLength } from "../../../physics/reference/events.ts";
import { fieldInvariants } from "../../../physics/reference/fields.ts";
import { DEFAULT_FACE, FACE_REGISTRY } from "../../../reader/faces/registry.ts";
import { tapePath } from "../../../reader/sitePaths.ts";
import { loadScenarioFile } from "../../../testing/scenario-registry/load.ts";
import { getOwner } from "../../../testing/scenario-registry/owners.ts";
import { compareBitwise, withinTolerance } from "../../../units/tolerance.ts";
import CapstonePage from "./page";

const PAPER = "special-relativity";
const html = renderToStaticMarkup(<CapstonePage />);
const { capstone, equations } = loadCapstone(PAPER);

const flatten = (value: string) => value.replace(/&#x27;|&rsquo;|’/g, "'").replace(/\s+/g, " ");
const text = flatten(html.replace(/<[^>]+>/g, " ")).trim();
const edges = capstone.claims.flatMap((claim) =>
  claim.buildsOn.map((from) => ({ from, to: claim.id })),
);
const claimIds = capstone.claims.map((claim) => claim.id);
const claimById = new Map(capstone.claims.map((claim) => [claim.id, claim]));

/** A scenario's inputs as an owner wants them, and its recorded expectations by output id. */
function scenario(id: string) {
  const { scenario: record } = loadScenarioFile(
    join(process.cwd(), `content/scenarios/${id}.yaml`),
  );
  const inputs = Object.fromEntries(
    Object.entries(record.inputs).map(([key, entry]) => [key, Number(entry.value)]),
  );
  const expected = new Map((record.expected.outputs ?? []).map((out) => [out.outputId, out]));
  return { record, inputs, expected };
}

/**
 * One output of one scenario, computed by the real owner and compared with the scenario's own
 * recorded value under the scenario's own comparison kind and tolerance. Nothing here invents a
 * tolerance: an expectation with neither a tolerance nor a bitwise kind is a failure, not a pass,
 * because a comparison with no criterion would accept anything.
 */
function owned(scenarioId: string, outputId: string): { actual: number; reference: number } {
  const { record, inputs, expected } = scenario(scenarioId);
  const result = getOwner(record.owner ?? "").fn({
    inputs,
    constantSetId: record.constantSetId ?? "modern-si-2019",
  });
  expect([scenarioId, "refused", "refused" in result]).toEqual([scenarioId, "refused", false]);
  const values = result as Record<string, number>;
  const expectation = expected.get(outputId);
  expect([scenarioId, outputId, expectation !== undefined]).toEqual([scenarioId, outputId, true]);
  const reference = Number(expectation?.value);
  const actual = values[outputId];
  expect([scenarioId, outputId, typeof actual]).toEqual([scenarioId, outputId, "number"]);
  if (expectation?.comparisonKind === "bitwise") {
    expect([scenarioId, outputId, compareBitwise(actual, reference).ok]).toEqual([
      scenarioId,
      outputId,
      true,
    ]);
  } else {
    const spec = expectation?.tolerance;
    expect([scenarioId, outputId, spec !== undefined]).toEqual([scenarioId, outputId, true]);
    // Rebuilt with only the keys the scenario actually set, because the scenario schema's spec
    // carries `| undefined` members and this repository runs exactOptionalPropertyTypes.
    const clean: Parameters<typeof withinTolerance>[2] = {
      ...(spec?.absolute !== undefined ? { absolute: spec.absolute } : {}),
      ...(spec?.relative !== undefined ? { relative: spec.relative } : {}),
      ...(spec?.relativeTo !== undefined ? { relativeTo: spec.relativeTo } : {}),
    };
    // A spec with neither bound would accept anything, so it fails here rather than passing.
    expect([
      scenarioId,
      outputId,
      clean.absolute !== undefined || clean.relative !== undefined,
    ]).toEqual([scenarioId, outputId, true]);
    const verdict = withinTolerance(actual as number, reference, clean);
    expect([scenarioId, outputId, verdict.ok, verdict.kind]).toEqual([
      scenarioId,
      outputId,
      true,
      "within",
    ]);
  }
  return { actual: actual as number, reference };
}

describe("the special-relativity capstone page", () => {
  test("every claim, assumption and annotated equation reaches the reader", () => {
    expect(capstone.claims).toHaveLength(9);
    expect(capstone.assumptions).toHaveLength(10);
    expect(equations).toHaveLength(4);
    expect(capstone.presets).toHaveLength(4);
    for (const claim of capstone.claims)
      expect([claim.id, text.includes(flatten(claim.text))]).toEqual([claim.id, true]);
    for (const assumption of capstone.assumptions)
      expect([assumption.id, text.includes(flatten(assumption.statement))]).toEqual([
        assumption.id,
        true,
      ]);
    for (const equation of equations) {
      expect(text).toContain(flatten(equation.purpose));
      expect(text).toContain(flatten(equation.spoken));
    }
    for (const preset of capstone.presets) expect(text).toContain(flatten(preset.purpose));
    for (const [id, note] of Object.entries(capstone.selfCheckNotes))
      expect([id, text.includes(flatten(note))]).toEqual([id, true]);
    expect(text).toContain(flatten(capstone.limits));
    expect(text).toContain(flatten(capstone.explanationPrompt));
  });

  test("the claims print in the paper's order, which is not the worksheet's start order", () => {
    expect([...capstone.paperOrder]).toEqual([
      "c1",
      "c2",
      "c3",
      "c4",
      "c5",
      "c6",
      "c7",
      "c8",
      "c9",
    ]);
    expect([...capstone.startOrder]).toEqual([
      "c5",
      "c1",
      "c7",
      "c3",
      "c9",
      "c2",
      "c6",
      "c4",
      "c8",
    ]);
    const positions = capstone.paperOrder.map((id) => html.indexOf(`id="${id}"`));
    expect(positions.every((at) => at >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    // The rendered page is the paper's order, so the start order's first claim is NOT first here.
    expect(positions[0]).toBeLessThan(html.indexOf(`id="${capstone.startOrder[0]}"`));
  });

  test("each claim and assumption links to the passage it is read from, on a face that has it", () => {
    // MEASURED FOR THIS PAPER against the built HTML of all seven faces, not inherited. The
    // denominator is 20 distinct anchors, read off the built page's own links: counting them by hand
    // first gave 19, because it dropped the field display, which is why the number below comes from
    // the render. Of those 20 the paper's default route carries 0, the English face carries 7 (the
    // six displays and the section-one footnote, none of the paragraphs), and german, parallel and
    // facsimile each carry 20 of 20.
    expect(FACE_REGISTRY.parallel.id).toBe("parallel");
    expect(DEFAULT_FACE).not.toBe("parallel");
    for (const claim of capstone.claims)
      expect(html).not.toContain(`href="/papers/${PAPER}/#${claim.anchor}"`);

    for (const claim of capstone.claims)
      expect([
        claim.id,
        html.includes(`href="/papers/${PAPER}/view/parallel/#${claim.anchor}"`),
      ]).toEqual([claim.id, true]);
    for (const assumption of capstone.assumptions)
      if (assumption.anchor !== undefined)
        expect([
          assumption.id,
          html.includes(`href="/papers/${PAPER}/view/parallel/#${assumption.anchor}"`),
        ]).toEqual([assumption.id, true]);
    for (const equation of equations)
      expect(html).toContain(`href="/papers/${PAPER}/view/parallel/#${equation.displayUnit}"`);
    for (const preset of capstone.presets) {
      expect(html).toContain(`href="/lab/${preset.instrumentId}/"`);
      // ASSERTED THROUGH THE HELPER, not against a hand-built string, because the string is not
      // what the helper returns: this tape's id ends in "0.6c", `lastSegmentLooksLikeAFile` sees the
      // dot, and `staticHostPath` therefore emits /tapes/the-boost-to-0.6c with NO trailing slash.
      // The sibling capstone tests assert the slashed form and pass because none of their presets
      // names a tape, so this is the first capstone to exercise that branch at all.
      if (preset.tapeId !== undefined) {
        expect(tapePath(preset.tapeId)).toBe("/tapes/the-boost-to-0.6c");
        expect(html).toContain(`href="${tapePath(preset.tapeId)}"`);
      }
    }
  });

  test("the graph is the one the bead specifies, orders and violations both", () => {
    expect(edges).toHaveLength(12);
    // 105 is computed from the record. The default limit of eight returns undefined for nine
    // claims, which is why the page passes nine; that the default refuses is asserted too, so a
    // later change to the helper's cap cannot pass silently here.
    expect(consistentOrderCount(claimIds, edges)).toBeUndefined();
    expect(consistentOrderCount(claimIds, edges, 9)).toBe(105);
    expect(dependencyFeedback(claimIds, edges, [...capstone.paperOrder]).violated).toEqual([]);
    const violated = dependencyFeedback(claimIds, edges, [...capstone.startOrder])
      .violated.map((edge) => `${edge.from}->${edge.to}`)
      .sort();
    expect(violated).toEqual(["c2->c3", "c4->c5", "c4->c6", "c6->c7", "c6->c9", "c8->c9"]);
  });

  test("the number of arrangements is the record's chain, not a number in the prose", () => {
    const count = consistentOrderCount(claimIds, edges, 9);
    expect(count).toBe(105);
    expect(text).toContain(`${count} arrangements satisfy it`);
    expect(text).not.toContain("1 arrangement satisfies it");
    // A second, independent count: linear extensions by subset dynamic programming, which
    // enumerates no permutation. Agreement is evidence; one method twice would only be a habit.
    const index = new Map(claimIds.map((id, i) => [id, i]));
    const need = claimIds.map(() => 0);
    for (const edge of edges) {
      const to = index.get(edge.to);
      const from = index.get(edge.from);
      if (to !== undefined && from !== undefined) need[to] = (need[to] ?? 0) | (1 << from);
    }
    const dp = new Array(1 << claimIds.length).fill(0);
    dp[0] = 1;
    for (let mask = 0; mask < dp.length; mask++) {
      if (dp[mask] === 0) continue;
      for (let i = 0; i < claimIds.length; i++) {
        if (mask & (1 << i)) continue;
        if (((need[i] ?? 0) & mask) !== (need[i] ?? 0)) continue;
        dp[mask | (1 << i)] += dp[mask];
      }
    }
    expect(dp[dp.length - 1]).toBe(105);
  });

  test("the closing sections are in the rebuild, not left behind the famous part", () => {
    // AGENTS.md: the difficult closing sections of this paper "never disappear behind the familiar
    // headlines". Asserted by section, from the anchors, so a record that summarised the kinematics
    // and stopped would fail rather than read as complete.
    const sectionOf = (anchor: string) => /^(?:eq-)?(s\d+)/.exec(anchor)?.[1];
    const cited = new Set(capstone.claims.map((claim) => sectionOf(claim.anchor)));
    for (const section of ["s6", "s8", "s9", "s10"])
      expect([section, cited.has(section)]).toEqual([section, true]);
    const electrodynamical = capstone.claims.filter((claim) => {
      const section = sectionOf(claim.anchor);
      return section !== undefined && Number(section.slice(1)) >= 6;
    });
    expect(electrodynamical.map((claim) => claim.id)).toEqual(["c6", "c7", "c8", "c9"]);
    // And they reach the reader, not merely the record.
    for (const claim of electrodynamical) expect(text).toContain(flatten(claim.text));
  });

  test("the two things the paper chooses are assumptions, not steps", () => {
    const synchronization = capstone.assumptions.find((a) => a.id === "a4");
    const force = capstone.assumptions.find((a) => a.id === "a9");
    expect(synchronization?.kind).toBe("stipulation");
    expect(force?.kind).toBe("convention");
    expect(synchronization?.anchor).toBe("s1-p7");
    expect(force?.anchor).toBe("s10-p8");
    // c2 is the synchronization and it is a DEFINITION that derives nothing.
    const c2 = claimById.get("c2");
    expect(c2?.logicalRole).toBe("definition");
    expect([...(c2?.assumptionIds ?? [])].sort()).toEqual(["a4", "a7"]);
    // c9 is the electron's masses and it names the force convention.
    expect(claimById.get("c9")?.assumptionIds).toContain("a9");
    expect(capstone.selfCheckNotes.c2).toBeDefined();
    expect(capstone.selfCheckNotes.c9).toBeDefined();
    // Both are visible as choices on the page, in words a reader meets before the claims.
    expect(text).toContain("the paper's own choices");
  });

  test("no later aid is a premise, and a fixture that makes one fails", () => {
    const forbidden = [
      /invarian\w* (?:of the )?interval/i,
      /interval\w* invarian/i,
      /spacetime diagram/i,
      /minkowski/i,
      /world ?line/i,
      /four-vector/i,
    ];
    for (const claim of capstone.claims)
      for (const pattern of forbidden)
        expect([claim.id, pattern.source, pattern.test(claim.text)]).toEqual([
          claim.id,
          pattern.source,
          false,
        ]);
    for (const assumption of capstone.assumptions)
      for (const pattern of forbidden)
        expect([assumption.id, pattern.source, pattern.test(assumption.statement)]).toEqual([
          assumption.id,
          pattern.source,
          false,
        ]);
    // The limits section is the one place these words belong, and it says they are later aids.
    expect(capstone.limits).toMatch(/Minkowski/);
    expect(capstone.limits).toMatch(/later aids/);

    // THE PLANT, so this check is known to be able to fail: a fixture claim that leans on the
    // interval as a premise is refused by the same predicate above. The predicate is run against
    // the fixture here rather than described, because a guard nobody has seen go red is a guard
    // nobody has tested.
    const planted = {
      ...capstone,
      claims: capstone.claims.map((claim) =>
        claim.id === "c4"
          ? {
              ...claim,
              text: "Require the invariance of the interval between two events and the transformation follows.",
            }
          : claim,
      ),
    };
    const caught = planted.claims.filter((claim) =>
      forbidden.some((pattern) => pattern.test(claim.text)),
    );
    expect(caught.map((claim) => claim.id)).toEqual(["c4"]);
    // And the planted text is still a valid capstone by the schema, which is the point: the schema
    // cannot see this, so the check has to exist.
    expect(() => validateCapstone(planted, "planted")).not.toThrow();
  });

  test("the train picture and the ether-drift experiments are not made the 1905 argument", () => {
    for (const claim of capstone.claims) {
      expect(claim.text).not.toMatch(/train|embankment|lightning/i);
      expect(claim.text).not.toMatch(/michelson|morley/i);
    }
    // Where the limits mention them, each is dated and denied the role.
    expect(capstone.limits).toMatch(/1917/);
    expect(capstone.limits).toMatch(/not the argument of 1905/);
    expect(capstone.limits).toMatch(/a reconstruction is not a cause/);
    expect(text).not.toMatch(/Michelson/i);
  });

  test("the notation traps are stated in words, never respelled", () => {
    // AGENTS.md marks two collisions in this paper. The record may not perform a respelling, and it
    // may not carry raw mathematics either, because claim text renders as text.
    const prose = [
      ...capstone.claims.map((claim) => claim.text),
      ...capstone.assumptions.map((a) => a.statement),
      capstone.limits,
      capstone.explanationPrompt,
    ];
    for (const value of prose) {
      expect(value).not.toMatch(/\$/);
      expect(value).not.toMatch(/\\(?:beta|gamma|tau|varphi|mu|rho)\b/);
    }
    // The identification is made, in words, where it matters.
    expect(claimById.get("c4")?.text).toMatch(/beta, which is the modern gamma/);
    // Section three's auxiliary coordinate is denied the moving system's role.
    expect(claimById.get("c4")?.text).toMatch(/is not the moving system's own coordinate/);
    // And the proper-time confusion is not introduced: the record never calls anything proper time.
    for (const value of prose) expect(value).not.toMatch(/proper time/i);
  });

  test("SR-01 assigns the midpoint under the agreement, for both registered flashes", () => {
    // The scenario carries the first exchange. The second flash is a REGISTERED PRESET with no
    // scenario file of its own, so its value is computed by the same owner from the preset's own
    // parameter values, which is the real evaluator rather than a number typed here.
    const first = owned("events-synchronization-midpoint", "assignedRemoteTime");
    expect(first.reference).toBe(5);
    expect(compareBitwise(first.actual, 5).ok).toBe(true);
    owned("events-synchronization-midpoint", "roundTripSpeedLsPerS");

    const manifest = readFileSync(join(process.cwd(), "content/experiments/sr-01.yaml"), "utf8");
    expect(manifest).toContain("sr-01-second-flash-20-30");
    const second = getOwner("events").fn({
      inputs: { emissionTimeA: 20, receptionTimeA: 30, separationLs: 5 },
      constantSetId: "modern-si-2019",
    }) as Record<string, number>;
    expect(compareBitwise(second.assignedRemoteTime, 25).ok).toBe(true);
    expect(withinTolerance(second.roundTripSpeedLsPerS ?? 0, 1, { absolute: 1e-12 }).ok).toBe(true);
  });

  test("SR-03 refuses the separation that is not a length and credits the one that is", () => {
    const dt = owned("kinematics-boost-0.6c", "deltaTPrimeS");
    expect(dt.reference).toBe(-7.5);
    const dx = owned("kinematics-boost-0.6c", "deltaXPrimeLs");
    expect(dx.reference).toBe(12.5);
    const contracted = owned("kinematics-boost-0.6c", "contractedLengthLs");
    expect(contracted.reference).toBe(8);

    // The refusal itself, from the owner that issues it. The pair simultaneous in the stationary
    // system is not simultaneous in the moving one, so its separation is not a length.
    const refused = measureRodLength(
      { t: 0, x: 0, y: 0, z: 0 },
      { t: dt.actual, x: dx.actual, y: 0, z: 0 },
      "k",
      "K",
      0.6,
      10,
      1,
    );
    expect(refused.status).toBe("not-applicable");
    expect(refused.condition).toBe("non-simultaneous-endpoints");
    expect(refused.measuredLength).toBeUndefined();
    // Positive control: a pair simultaneous in the measuring frame IS a length, and it is the
    // contracted one. Without this the refusal above could come from a broken call.
    const credited = measureRodLength(
      { t: 0, x: 0, y: 0, z: 0 },
      { t: 0, x: contracted.actual, y: 0, z: 0 },
      "k",
      "K",
      0.6,
      10,
      1,
    );
    expect(credited.status).toBe("value");
    expect(withinTolerance(credited.measuredLength ?? 0, 8, { absolute: 1e-12 }).ok).toBe(true);
  });

  test("SR-08 grows the electric component and makes a magnetic one appear", () => {
    const ey = owned("fields-sr08-frame-change", "EprimeY");
    expect(ey.reference).toBe(1.25);
    const bz = owned("fields-sr08-frame-change", "BprimeZ");
    expect(bz.reference).toBeLessThan(0);
    expect(withinTolerance(bz.actual, -2.50173072552e-9, { relative: 1e-6 }).ok).toBe(true);

    // The invariant the bead names is an output of the fields owner rather than of any scenario
    // file, so it is computed here in both frames from the same evaluator.
    const rest = fieldInvariants({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
    const moving = fieldInvariants({ x: 0, y: ey.actual, z: 0 }, { x: 0, y: 0, z: bz.actual });
    expect(withinTolerance(rest.e2MinusC2B2, 1, { absolute: 1e-12 }).ok).toBe(true);
    expect(withinTolerance(moving.e2MinusC2B2, 1, { absolute: 1e-12 }).ok).toBe(true);
    // Positive control: the combination is not trivially one for any pair of fields, so the two
    // agreements above are the invariance rather than a constant the function returns.
    expect(
      withinTolerance(fieldInvariants({ x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: 0 }).e2MinusC2B2, 1, {
        absolute: 1e-12,
      }).ok,
    ).toBe(false);
  });

  test("SR-13 moves the transverse coefficient with the convention and leaves the prediction alone", () => {
    const comoving = owned("electron-conventions", "transverseMassComoving");
    const laboratory = owned("electron-conventions", "transverseMassLaboratory");
    const longitudinal = owned("electron-conventions", "longitudinalMass");
    expect(compareBitwise(comoving.actual, 1.5625).ok).toBe(true);
    expect(compareBitwise(laboratory.actual, 1.25).ok).toBe(true);
    expect(compareBitwise(longitudinal.actual, 1.953125).ok).toBe(true);
    // The two conventions disagree about the transverse coefficient. That is the reader's point.
    expect(comoving.actual).not.toBe(laboratory.actual);

    const exact = owned("electron-energy-fixtures", "acceleratingPotentialExact");
    const newtonian = owned("electron-energy-fixtures", "acceleratingPotentialNewtonian");
    expect(withinTolerance(exact.actual, 127749.7, { relative: 1e-4 }).ok).toBe(true);
    expect(withinTolerance(newtonian.actual, 91979.8, { relative: 1e-4 }).ok).toBe(true);
    expect(exact.actual).toBeGreaterThan(newtonian.actual);

    // The radius does not answer to the convention: it is the same number whichever coefficient the
    // reader has chosen, which is why the record calls it a prediction rather than a convention.
    const radius = owned("electron-energy-fixtures", "radiusCurvatureMagneticExact");
    const relations = owned("electron-relations", "magneticRadius");
    expect(withinTolerance(radius.actual, relations.actual, { relative: 1e-12 }).ok).toBe(true);
  });

  test("nothing on this page needs JavaScript", () => {
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("data-reactroot");
    expect(html.match(/<a /g)?.length ?? 0).toBeGreaterThan(20);
  });

  test("this route does not reach the content compiler, which no test lane would notice", () => {
    const reached = new Set<string>();
    const queue = ["src/app/capstones/special-relativity/page.tsx"];
    while (queue.length > 0) {
      const file = queue.pop();
      if (file === undefined || reached.has(file) || !existsSync(join(process.cwd(), file)))
        continue;
      reached.add(file);
      const source = readFileSync(join(process.cwd(), file), "utf8");
      for (const match of source.matchAll(/from "(\.[^"]+)"/g)) {
        const target = join(file, "..", match[1] ?? "");
        for (const candidate of [target, `${target}.ts`, `${target}.tsx`]) {
          if (/\.tsx?$/.test(candidate) && existsSync(join(process.cwd(), candidate))) {
            queue.push(candidate);
            break;
          }
        }
      }
    }
    // Non-vacuity first: a walker that found nothing would satisfy every exclusion below.
    expect(reached.has("src/discovery/capstone/capstoneSchema.ts")).toBe(true);
    expect(reached.size).toBeGreaterThan(5);
    for (const heavy of [
      "src/content/server.ts",
      "src/content/compiler/compile.ts",
      "src/experiments/catalogue.ts",
      "src/reader/paperRoutes.ts",
    ])
      expect([heavy, reached.has(heavy)]).toEqual([heavy, false]);
    expect(reached.size).toBeLessThan(30);
  });

  test("the record is in the sitemap, so a reader who never passes the discovery route can find it", () => {
    const sitemap = readFileSync(join(process.cwd(), "src/app/sitemap.ts"), "utf8");
    expect(sitemap).toContain('"/capstones/special-relativity/"');
  });
});
