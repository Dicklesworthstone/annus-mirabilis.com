import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  fixtureHalvingDiffusivity,
  fixtureLengthContraction,
  fixtureStaticTreatmentOnly,
} from "../reader/misconceptions/fixtures.ts";
import { MisconceptionCallout } from "../reader/misconceptions/MisconceptionCallout.tsx";
import { withinTolerance } from "../units/tolerance.ts";

/**
 * am-read-misconception-callouts-a3o: "a callout that states the wrong turn without saying what
 * makes it wrong teaches the misconception. Each one needs the correction bound to it." Every
 * test here checks that the correction, not just the tempting claim, is actually present in the
 * rendered markup -- a callout that renders only the summary line would pass a shallower test.
 */
describe("MisconceptionCallout: the correction is bound to the wrong turn", () => {
  test("fixture's own printed ratio digits match the real computed 1/sqrt(2), not a rounded guess", () => {
    // The bead's own worked example: halving D scales lambda_x by 1/sqrt(2), not by 1/2. The
    // digits are pulled out of the fixture's own r1 text rather than duplicated as a literal, so
    // a future edit to that text is checked against the real value automatically.
    const r1 = (fixtureHalvingDiffusivity.whatIsTrue as { r1: string }).r1;
    const printed = Number(r1.match(/~ (0\.\d+)/)?.[1]);
    expect(Number.isFinite(printed)).toBe(true);
    const verdict = withinTolerance(printed, Math.SQRT1_2, { absolute: 1e-5 });
    expect(verdict.ok).toBe(true);
  });

  test("renders the tempting claim, the correction, and the numeric content together", () => {
    const markup = renderToStaticMarkup(
      <MisconceptionCallout
        misconception={fixtureHalvingDiffusivity}
        detail={1}
        modernLens={false}
        interventionStatus={{ state: "reviewed" }}
        instrumentHref="/instruments/bm-06"
      />,
    );
    expect(markup).toContain("Halving the diffusivity D halves the mean displacement.");
    expect(markup).toContain("1/sqrt(2)");
    expect(markup).not.toContain("data-misconception-not-loaded");
  });

  test("a summary stating only the wrong turn, with no correction present, would fail this suite", () => {
    const markup = renderToStaticMarkup(
      <MisconceptionCallout
        misconception={fixtureHalvingDiffusivity}
        detail={0}
        modernLens={false}
        interventionStatus={{ state: "reviewed" }}
      />,
    );
    // Regression guard for the bead's own stated failure mode: the tempting claim must never
    // appear without whatIsTrue's text also present in the same render.
    const [firstClaim] = fixtureHalvingDiffusivity.temptingClaims;
    expect(firstClaim).toBeDefined();
    expect(markup).toContain(firstClaim as string);
    expect(markup).toContain("0.71");
  });

  test("both opposites of a two-opposites entry render with equal structural weight", () => {
    const markup = renderToStaticMarkup(
      <MisconceptionCallout
        misconception={fixtureLengthContraction}
        detail={1}
        modernLens={false}
        interventionStatus={{ state: "reviewed" }}
      />,
    );
    for (const claim of fixtureLengthContraction.temptingClaims) {
      expect(markup).toContain(claim);
    }
    // Both wrapped in <li> siblings of the same list -- neither is the page's opening sentence.
    const claimsListMatch = markup.match(
      /<ul class="misconception-tempting-claims"[^>]*>(.*?)<\/ul>/s,
    );
    expect(claimsListMatch).not.toBeNull();
    const claimsList = claimsListMatch?.[1] ?? "";
    expect((claimsList.match(/<li>/g) ?? []).length).toBe(2);
  });

  test("whereItIsTrue: 'none' renders an explicit statement, not a blank section", () => {
    const markup = renderToStaticMarkup(
      <MisconceptionCallout
        misconception={fixtureStaticTreatmentOnly}
        detail={1}
        modernLens={false}
        interventionStatus={{ state: "reviewed" }}
      />,
    );
    expect(markup).toContain("no reading under which this is a correct thing to say");
  });

  test("the two-opposites fixture names a real condition under which each opposite is reasonable", () => {
    const markup = renderToStaticMarkup(
      <MisconceptionCallout
        misconception={fixtureLengthContraction}
        detail={1}
        modernLens={false}
        interventionStatus={{ state: "reviewed" }}
      />,
    );
    // Acceptance criterion: "names a condition under which each opposite is a reasonable thing to
    // say" -- not the literal "none" this fixture used before this fix.
    expect(markup).not.toContain("no reading under which this is a correct thing to say");
    expect(markup).toContain("rest-frame proper length never changes");
    expect(markup).toContain("spaceship problem"); // Bell's -- apostrophe is HTML-escaped in markup
  });

  test("whereItIsTrue with real text renders that text, positioned after whyTempting", () => {
    const markup = renderToStaticMarkup(
      <MisconceptionCallout
        misconception={fixtureHalvingDiffusivity}
        detail={1}
        modernLens={false}
        interventionStatus={{ state: "reviewed" }}
      />,
    );
    const whyIdx = markup.indexOf("misconception-why-tempting");
    const whereIdx = markup.indexOf("misconception-where-true");
    const whatIdx = markup.indexOf("misconception-what-is-true");
    expect(whyIdx).toBeGreaterThan(-1);
    expect(whereIdx).toBeGreaterThan(whyIdx);
    expect(whatIdx).toBeGreaterThan(whereIdx);
    expect(markup).toContain("Halving D does halve the mean squared displacement");
  });

  test("Detail 0/1/2 select the r0/r1/r2 text distinctly", () => {
    const at = (detail: 0 | 1 | 2) =>
      renderToStaticMarkup(
        <MisconceptionCallout
          misconception={fixtureHalvingDiffusivity}
          detail={detail}
          modernLens={false}
          interventionStatus={{ state: "reviewed" }}
        />,
      );
    const r0 = at(0);
    const r1 = at(1);
    const r2 = at(2);
    expect(r0).not.toBe(r1);
    expect(r1).not.toBe(r2);
    expect(r0).toContain("does not halve the displacement itself");
    expect(r2).toContain("lambda_x(D/2, t) / lambda_x(D, t)");
  });

  test("the R3 margin appears only under the modern lens", () => {
    const printed = renderToStaticMarkup(
      <MisconceptionCallout
        misconception={fixtureHalvingDiffusivity}
        detail={1}
        modernLens={false}
        interventionStatus={{ state: "reviewed" }}
      />,
    );
    const modern = renderToStaticMarkup(
      <MisconceptionCallout
        misconception={fixtureHalvingDiffusivity}
        detail={1}
        modernLens={true}
        interventionStatus={{ state: "reviewed" }}
      />,
    );
    expect(printed).not.toContain('data-margin="r3"');
    expect(modern).toContain('data-margin="r3"');
    expect(modern).toContain("The squared displacement lambda_x^2 = 2 D t is linear in D");
  });

  // The verdict is carried as data and shows no words (D-2026-09-25-no-review-status-banners).
  test("a not-yet-reviewed intervention marks the instrument link as data, with no visible notice", () => {
    const markup = renderToStaticMarkup(
      <MisconceptionCallout
        misconception={fixtureHalvingDiffusivity}
        detail={1}
        modernLens={false}
        interventionStatus={{ state: "not-yet-reviewed" }}
        instrumentHref="/instruments/bm-06"
      />,
    );
    expect(markup).toContain('data-intervention-status="not-yet-reviewed"');
    expect(markup).toContain("See it in the instrument");
    expect(markup).not.toContain("not yet reviewed");
  });

  test("a reviewed intervention renders no notice", () => {
    const markup = renderToStaticMarkup(
      <MisconceptionCallout
        misconception={fixtureHalvingDiffusivity}
        detail={1}
        modernLens={false}
        interventionStatus={{ state: "reviewed" }}
        instrumentHref="/instruments/bm-06"
      />,
    );
    expect(markup).not.toContain("data-intervention-status");
  });

  test("without an instrumentHref, no instrument link renders even when instrumentIds is present", () => {
    const markup = renderToStaticMarkup(
      <MisconceptionCallout
        misconception={fixtureHalvingDiffusivity}
        detail={1}
        modernLens={false}
        interventionStatus={{ state: "reviewed" }}
      />,
    );
    expect(markup).not.toContain("misconception-instrument-link");
  });

  test("a staticTreatment-only entry renders its reason and no instrument link", () => {
    const markup = renderToStaticMarkup(
      <MisconceptionCallout
        misconception={fixtureStaticTreatmentOnly}
        detail={1}
        modernLens={false}
        interventionStatus={{ state: "not-yet-reviewed" }}
      />,
    );
    expect(markup).toContain("misconception-static-treatment");
    expect(markup).toContain("running text next to the derivation");
    expect(markup).not.toContain("misconception-instrument-link");
  });

  test("collapsed by default unless expanded is set", () => {
    const collapsed = renderToStaticMarkup(
      <MisconceptionCallout
        misconception={fixtureHalvingDiffusivity}
        detail={1}
        modernLens={false}
        interventionStatus={{ state: "reviewed" }}
      />,
    );
    const expanded = renderToStaticMarkup(
      <MisconceptionCallout
        misconception={fixtureHalvingDiffusivity}
        detail={1}
        modernLens={false}
        expanded
        interventionStatus={{ state: "reviewed" }}
      />,
    );
    expect(collapsed).not.toContain("<details open=");
    expect(expanded).toContain("<details open=");
  });

  test("works without JavaScript: static markup alone carries the summary and body, native <details>", () => {
    const markup = renderToStaticMarkup(
      <MisconceptionCallout
        misconception={fixtureHalvingDiffusivity}
        detail={1}
        modernLens={false}
        expanded
        interventionStatus={{ state: "reviewed" }}
      />,
    );
    expect(markup).toContain("<details");
    expect(markup).toContain("<summary>");
    expect(markup).toContain("A common wrong turn:");
  });
});
