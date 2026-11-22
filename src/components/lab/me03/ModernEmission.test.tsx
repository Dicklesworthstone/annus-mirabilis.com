import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ME03_DEFAULTS, type Me03Parameters } from "../../../experiments/me03/definition.ts";
import { createMe03Session, evaluateMe03 } from "../../../experiments/me03/session.ts";
import { BoundaryLedgerLab } from "./BoundaryLedgerLab.tsx";
import { BoundaryLedgerPlot } from "./BoundaryLedgerPlot.tsx";

const parameters: Me03Parameters = {
  ...ME03_DEFAULTS,
  mode: "four-momentum",
  pulseSystem: "single-pulse",
  emittedEnergy: 1e16,
};

test("the no-script modern lab exposes initial mass, recoil and its separate assumption", () => {
  const session = createMe03Session("modern-emission-static", parameters);
  const html = renderToStaticMarkup(
    <BoundaryLedgerLab session={session} restoreFromLocation={false} showComparison={false} />,
  );
  expect(html).toContain('name="initialEmitterMass"');
  expect(html).toContain("Calculate emission and recoil");
  expect(html).toContain("Body x velocity");
  expect(html).toContain("Radiation invariant mass");
  expect(html).toContain("an added input, not a result of the 1905 derivation");
  expect(html).toContain('href="/papers/mass-energy/s0/"');
  expect(html).not.toContain('name="inputEnergy"');
});

test("a refused emitter budget stays visible beside the independent radiation result", () => {
  const p = { ...parameters, emittedEnergy: 8e16 };
  const html = renderToStaticMarkup(
    <BoundaryLedgerPlot parameters={p} evaluation={evaluateMe03(p)} clipId="modern-refused" />,
  );
  expect(html).toContain('data-modern-emission-status="outside-domain"');
  expect(html).toContain("spacelike body four-momentum");
  expect(html).toContain("does not establish");
  expect(html).not.toContain("not assigned in the 1905 reading");
});

test("modern radiation boundary has a numeric system mass even for opposite pulses", () => {
  const p: Me03Parameters = { ...parameters, pulseSystem: "two-opposite", boundary: "radiation" };
  const html = renderToStaticMarkup(
    <BoundaryLedgerPlot parameters={p} evaluation={evaluateMe03(p)} clipId="modern-radiation" />,
  );
  expect(html).toContain('data-modern-emission-status="value"');
  expect(html).toContain("Invariant-mass change");
  expect(html).not.toContain("not assigned an inertial rest mass");
});
