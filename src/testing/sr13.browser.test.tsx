import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import ElectronDynamicsPage from "../app/lab/sr-13/page.tsx";
import { ElectronDynamicsLab } from "../components/lab/sr13/ElectronDynamicsLab.tsx";
import { createSr13Session, type PreparedSr13Example } from "../experiments/sr13/session.ts";
import rawExample from "../generated/sr13-example.json";

const example = rawExample as unknown as PreparedSr13Example;

describe("SR-13 Electron Dynamics Lab View & Route (am-sr-13-electron-dynamics-b6v7)", () => {
  test("server component page renders without JavaScript and includes worked case", () => {
    const html = renderToStaticMarkup(<ElectronDynamicsPage />);
    expect(html).toContain("Force conventions and dynamics");
    expect(html).toContain("Special relativity · Electrodynamics §10");
    expect(html).toContain("Worked case (readable without JavaScript)");
    expect(html).toContain("1.953125");
    expect(html).toContain("1.5625");
    expect(html).toContain("1.25");
  });

  test("ElectronDynamicsLab component renders trajectory canvas and controls", () => {
    const html = renderToStaticMarkup(<ElectronDynamicsLab example={example} />);
    expect(html).toContain('data-instrument-id="sr-13"');
    expect(html).toContain("Initial speed β = v/c");
    expect(html).toContain("Electric field Ey");
    expect(html).toContain("Magnetic field Bz");
    expect(html).toContain("Force convention");
    expect(html).toContain("Mass language");
  });

  test("session initializes and computes relativistic electron dynamics", () => {
    const session = createSr13Session("test-sr13", example);
    const snap = session.getSnapshot().accepted;
    expect(snap).toBeDefined();
    expect(snap?.experimentId).toBe("sr-13");

    const longMOut = snap?.outputs.find((o) => o.quantityId === "longitudinalMass");
    expect(longMOut?.status).toBe("value");

    const transMOut = snap?.outputs.find((o) => o.quantityId === "transverseMassComoving");
    expect(transMOut?.status).toBe("value");

    const keOut = snap?.outputs.find((o) => o.quantityId === "kineticEnergy");
    expect(keOut?.status).toBe("value");
  });
});
