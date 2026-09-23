import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import ElectronDynamicsPage from "../app/lab/sr-13/page.tsx";
import { ElectronDynamicsLab } from "../components/lab/sr13/ElectronDynamicsLab.tsx";
import {
  ElectronDynamicsPlot,
  type ElectronDynamicsPlotProps,
} from "../components/lab/sr13/ElectronDynamicsPlot.tsx";
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

  test("a dataset overlay draws no marks until a cited dataset record exists, and says so", () => {
    // Kaufmann and Bucherer have no HistoricalDataset record yet (am-data-kaufmann-1902-1906-52ya,
    // am-data-bucherer-1908-w3mf). The drawing once placed five hand-picked pixel positions per
    // overlay and captioned them as measurements, so the property asserted is that choosing an
    // overlay leaves the drawing exactly as the model alone draws it.
    const base: ElectronDynamicsPlotProps = {
      initialSpeed: 0.6,
      initialDirectionDeg: 0,
      electricFieldX: 0,
      electricFieldY: 1e5,
      electricFieldZ: 0,
      magneticFieldX: 0,
      magneticFieldY: 0,
      magneticFieldZ: 0.01,
      forceConvention: "source",
      massLanguage: "1905",
      particle: "electron",
      longitudinalMassKg: 1.953125 * 9.1093837e-31,
      transverseMassComovingKg: 1.5625 * 9.1093837e-31,
      transverseMassLaboratoryKg: 1.25 * 9.1093837e-31,
      kineticEnergyJ: 2.05e-14,
      kineticEnergyNewtonianJ: 1.64e-14,
      acceleratingPotentialV: 1.28e5,
      acceleratingPotentialNewtonianV: 1.02e5,
      radiusCurvatureMagneticM: 0.128,
      radiusCurvatureElectricM: 1.2,
      lorentzFactor: 1.25,
      datasetOverlay: "none",
    };
    const drawing = (html: string) => {
      const svg = html.match(/<svg class="sr13-chamber"[\s\S]*?<\/svg>/u)?.[0];
      if (!svg) throw new Error("expected the chamber drawing");
      return svg;
    };
    const none = renderToStaticMarkup(<ElectronDynamicsPlot {...base} />);
    expect(none).not.toContain("data-overlay-status");

    for (const [overlay, name] of [
      ["kaufmann-1902-1906", "Kaufmann"],
      ["bucherer-1908", "Bucherer"],
    ] as const) {
      const html = renderToStaticMarkup(
        <ElectronDynamicsPlot {...base} datasetOverlay={overlay} />,
      );
      expect(drawing(html)).toBe(drawing(none));
      const note = html.match(
        /<p[^>]*data-overlay-status="not-digitized"[^>]*>([\s\S]*?)<\/p>/u,
      )?.[1];
      expect(note).toBeDefined();
      expect(note).toContain(name);
      expect(note).toContain("not drawn");
      expect(note).toContain("not yet been digitized");
    }
  });

  test("the chamber draws the session's computed path, bending toward +y where the magnetic push wins", () => {
    // The crossed-field preset: at 0.6c and 0.01 T the magnetic push on an electron, along +y,
    // outweighs the electric one, along -y, eighteen to one. The chamber used to draw a curve of
    // its own making that bent the electron down. It now projects trajectoryPositions.
    const session = createSr13Session("test-sr13-chamber", example);
    session.apply({ ...session.acceptedParameters(), electricFieldY: 1e5, magneticFieldZ: 0.01 });
    const snap = session.getSnapshot().accepted;
    if (!snap) throw new Error("expected an accepted snapshot");
    const published = snap.outputs.find((o) => o.quantityId === "trajectoryPositions");
    if (published?.status !== "value" || typeof published.value === "number") {
      throw new Error("expected a published path");
    }
    const html = renderToStaticMarkup(
      <ElectronDynamicsPlot
        initialSpeed={0.6}
        initialDirectionDeg={0}
        electricFieldX={0}
        electricFieldY={1e5}
        electricFieldZ={0}
        magneticFieldX={0}
        magneticFieldY={0}
        magneticFieldZ={0.01}
        forceConvention="source"
        massLanguage="1905"
        particle="electron"
        longitudinalMassKg={1}
        transverseMassComovingKg={1}
        transverseMassLaboratoryKg={1}
        kineticEnergyJ={1}
        kineticEnergyNewtonianJ={1}
        acceleratingPotentialV={1}
        acceleratingPotentialNewtonianV={1}
        radiusCurvatureMagneticM={1}
        radiusCurvatureElectricM={1}
        lorentzFactor={1.25}
        datasetOverlay="none"
        trajectory={published.value}
        integrationIntervalS={2e-9}
      />,
    );
    const d = html.match(
      /<path d="(M [^"]+)" fill="none" stroke="var\(--plot\)" stroke-width="3"/u,
    )?.[1];
    if (!d) throw new Error("expected the drawn path");
    const points = [...d.matchAll(/[ML] (-?[\d.]+) (-?[\d.]+)/gu)].map((m) => ({
      x: Number(m[1]),
      y: Number(m[2]),
    }));
    // One drawn point per published position: the drawing adds none and drops none.
    expect(points.length).toBe(published.value.length / 2);
    const first = points[0];
    const last = points.at(-1);
    if (!first || !last) throw new Error("expected points");
    // SVG y points down, so bending toward +y means the last point sits above the first.
    expect(last.y).toBeLessThan(first.y);
    expect(last.x).toBeGreaterThan(first.x);
    // +E_y is drawn pointing up, the way the path's y points.
    expect(html).toContain('y1="40" x2="0" y2="0" stroke="var(--accent)"');
    expect(html).toContain("drawn to scale");
  });
});
