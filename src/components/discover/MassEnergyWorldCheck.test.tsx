import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MASS_ENERGY_LATER_EVIDENCE } from "../../content/massEnergyShelf.ts";
import { WORLD_CHECK } from "../../discovery/massEnergy/journeyIV.ts";
import { ME03_DEFAULTS, type Me03Parameters } from "../../experiments/me03/definition.ts";
import { createMe03Session, DEFAULT_PREPARED_EXAMPLE } from "../../experiments/me03/session.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { MassEnergyWorldCheck } from "./MassEnergyWorldCheck.tsx";

type Session = ReturnType<typeof createMe03Session>;
const check = (session?: Session) => (
  <MassEnergyWorldCheck
    example={DEFAULT_PREPARED_EXAMPLE}
    check={WORLD_CHECK}
    laterEvidence={MASS_ENERGY_LATER_EVIDENCE}
    session={session}
  />
);
const at = (overrides: Partial<Me03Parameters>) =>
  renderToStaticMarkup(
    check(createMe03Session("world-check-test", { ...ME03_DEFAULTS, ...overrides })),
  );
const quantity = (html: string, id: string) =>
  new RegExp(`data-world-check-quantity="${id}">([^<]*)<`).exec(html)?.[1];

/**
 * Journey IV's check against the world (dispatch 139). A reader without JavaScript receives the
 * ledger's worked example: one joule leaves a body with the boundary drawn around the body alone,
 * and the accepted snapshot holds energyChange = -1 J and massChange = -1/c² = -1.11e-17 kg.
 */
describe("the check against the world reads the boundary ledger's accepted snapshot", () => {
  test("the readout shows the snapshot's energy and mass, in SI and in the paper's units", () => {
    const html = renderToStaticMarkup(check());
    expect(quantity(html, "energyChange")).toBe("−1 J, or −1 × 10⁷ erg");
    expect(quantity(html, "massChange")).toBe("−1.11 × 10⁻¹⁷ kg, or −1.11 × 10⁻¹⁴ g");
    expect(html).toContain("With the boundary drawn around the body alone:");
  });

  test("9·10²⁰ erg leaving reads as a gram, the paper's own rule", () => {
    expect(quantity(at({ emittedEnergy: 9e13 }), "massChange")).toBe("−0.001 kg, or −1 g");
  });

  test("it reads the snapshot rather than dividing the energy itself", () => {
    // The same parameters with a different accepted massChange: a readout that computed -L/c²
    // from emittedEnergy would still say -1.11e-17 kg.
    const real = createMe03Session("world-check-altered");
    const served = real.getServerSnapshot();
    const accepted = served.accepted;
    if (!accepted) throw new Error("the prepared session published nothing");
    const altered = {
      ...served,
      accepted: {
        ...accepted,
        outputs: accepted.outputs.map((o) =>
          o.quantityId === "massChange" && o.status === "value" ? { ...o, value: -2.5e-17 } : o,
        ),
      },
    };
    const session: Session = {
      ...real,
      getSnapshot: () => altered,
      getServerSnapshot: () => altered,
    };
    expect(quantity(renderToStaticMarkup(check(session)), "massChange")).toBe(
      "−2.5 × 10⁻¹⁷ kg, or −2.5 × 10⁻¹⁴ g",
    );
  });

  test("the boundary decides what is read: nothing is lost from body and light together", () => {
    const both = at({ boundary: "combined-isolated-system" });
    expect(quantity(both, "energyChange")).toBe("0 J, or 0 erg");
    expect(quantity(both, "massChange")).toBe("0 kg, or 0 g");
  });

  test("around the light alone the ledger's own reason is shown, not a zero", () => {
    const light = at({ boundary: "radiation" });
    expect(quantity(light, "massChange")).toBe(
      "Free radiation is not assigned an inertial rest mass in 1905 kinematics.",
    );
    expect(quantity(light, "energyChange")).toBe("1 J, or 1 × 10⁷ erg");
  });

  test("in the 1906 box mode the readout says what to switch, and reads no mass", () => {
    const box = at({ mode: "box-1906" });
    expect(box).toContain("Switch it back to the 1905 ledger");
    expect(box).not.toContain('data-world-check-quantity="massChange"');
  });

  test("Einstein's printed rule stands beside it, and the later evidence is labelled later", () => {
    const html = renderToStaticMarkup(check());
    expect(html).toContain("Check it against the world");
    expect(html).toContain("What Einstein printed on the paper&#x27;s last page");
    expect(html).toContain("L/9·10²⁰, with the energy in erg and the mass in grams");
    expect(html).toContain('data-card-id="cockcroft-walton-1932-lithium"');
    expect(html).toContain("Later evidence, not on the 1904 shelf");
    // The card carries no verification status (dispatch 243, D-2026-09-25-no-review-status-banners).
    expect(html).not.toContain("Awaiting verification");
  });

  test("the embedded ledger is the real instrument, and no build-side id reaches the reader", () => {
    const html = renderToStaticMarkup(check());
    expect(html).toContain("The boundary ledger, for the check");
    const text = html.replace(/<[^>]+>/g, " ");
    expect(text).not.toContain("World check · #");
    expect(text).not.toContain("constants: einstein-1905-mass-energy-printed");
  });
});

describe("the readout follows what the reader applies", () => {
  beforeEach(async () => {
    await installDom();
  });
  afterEach(async () => {
    await uninstallDom();
  });

  test("applying a new energy through the shared session changes the mass read", async () => {
    const session = createMe03Session("world-check-live");
    const container = createContainer();
    const root = createRoot(container);
    const read = () =>
      container.querySelector('[data-world-check-quantity="massChange"]')?.textContent;
    // The embedded ledger, found by its title: it must redraw from the same session the readout
    // reads, or the reader would change one number and watch a different one.
    const ledger = () =>
      container.querySelector('[aria-label="The boundary ledger, for the check"]')?.innerHTML;
    await act(async () => root.render(check(session)));
    expect(read()).toBe("−1.11 × 10⁻¹⁷ kg, or −1.11 × 10⁻¹⁴ g");
    const before = ledger();
    expect(before).toBeDefined();
    await act(async () => {
      const outcome = session.apply({ ...ME03_DEFAULTS, emittedEnergy: 9e13 });
      expect(outcome.kind).toBe("accepted");
    });
    expect(read()).toBe("−0.001 kg, or −1 g");
    expect(ledger()).not.toBe(before);
    await act(async () => root.unmount());
    removeContainer(container);
  });
});

describe("with no accepted snapshot the check refuses", () => {
  test("world-check-snapshot-missing: it throws its code rather than show a mass the ledger never produced", () => {
    // A real session whose snapshot reports nothing accepted, the state a store is in before its
    // first result is published. createMe03Session itself refuses an example it cannot publish, so
    // an embedder's session is the only route into this site.
    const real = createMe03Session("world-check-refusal");
    const empty = { ...real.getServerSnapshot(), accepted: null };
    const session: Session = { ...real, getSnapshot: () => empty, getServerSnapshot: () => empty };
    expect(() => renderToStaticMarkup(check(session))).toThrow("world-check-snapshot-missing");
    // Positive control: the same real session, snapshot intact, renders the readout.
    expect(renderToStaticMarkup(check(real))).toContain('data-world-check-quantity="massChange"');
  });
});
