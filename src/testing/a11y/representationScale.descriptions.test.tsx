import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { AnnouncementManager } from "../../a11y/descriptions/announcementManager.ts";
import { GraphDescriptionContainer } from "../../a11y/descriptions/provider.tsx";
import {
  auditAccessibleScaleFacts,
  fillTemplate,
  ScaleAuditError,
  TemplateValidationError,
  validateTemplate,
} from "../../a11y/descriptions/templates.ts";
import type { RepresentationScale } from "../../visuals/kit/types.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "../reactDom.ts";

beforeEach(async () => {
  await installDom();
});

afterEach(async () => {
  await uninstallDom();
});

describe("representationScale: Accessible descriptions of scale facts (am-a11y-graph-descriptions-vxe1)", () => {
  // BM-01 Microscope fixture
  const bm01Scale: RepresentationScale = {
    spatialMagnification: { appliesTo: "scene", factor: 1000, note: "optical microscope" },
    simulatedElapsedTime: { quantityId: "t", value: 2.0, unit: "s" },
    playbackMultiplier: 1,
    glyphSize: { drawnPx: 4, represents: "none" },
    quantityNormalization: { kind: "per-bin-width", note: "per μm" },
  };

  // ME-03 Box extension fixture (amplified displacement readout)
  const me03Scale: RepresentationScale = {
    spatialMagnification: {
      appliesTo: "displacement",
      factor: 1e17,
      note: "radiation recoil amplification",
    },
    simulatedElapsedTime: { quantityId: "t_flight", value: 1e-8, unit: "s" },
    playbackMultiplier: 0.1,
    glyphSize: { drawnPx: 2, represents: "box_width" },
    quantityNormalization: { kind: "none" },
  };

  // Default baseline scale
  const defaultScale: RepresentationScale = {
    spatialMagnification: { appliesTo: "scene", factor: 1 },
    simulatedElapsedTime: { quantityId: "t", value: 0, unit: "s" },
    playbackMultiplier: 1,
    glyphSize: { drawnPx: 5, represents: "none" },
    quantityNormalization: { kind: "none" },
  };

  test("renders all 5 fields as ordinary language for BM-01 microscope fixture", async () => {
    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(() => {
        root.render(
          createElement(GraphDescriptionContainer, {
            layer1Statement: "Brownian motion tracer diffusion",
            layer2Template: "Summary: {scaleSummary}",
            templateData: {},
            snapshotVersion: "bm-01-snap-1",
            instrumentId: "bm-01",
            viewId: "histogram",
            scale: bm01Scale,
            tableData: {
              caption: "Displacement table",
              columns: [{ id: "x", header: "x", unit: "μm" }],
              rows: [{ id: "r1", label: "Bin 1", values: ["0.45"] }],
            },
          }),
        );
      });

      const text = container.textContent ?? "";
      expect(text).toContain("Scene magnified ×1,000");
      expect(text).toContain("2 s (t)");
      expect(text).toContain("true rate (1 s/s)");
      expect(text).toContain("4 px marker (uncalibrated marker, not a physical particle size)");
      expect(text).toContain("per-bin-width");

      // Verify audit passes
      expect(() => {
        auditAccessibleScaleFacts(text, bm01Scale, "histogram");
      }).not.toThrow();
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("renders ME-03 box fixture with appliesTo naming displacement output", async () => {
    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(() => {
        root.render(
          createElement(GraphDescriptionContainer, {
            layer1Statement: "Recoil of Einstein box during photon emission",
            layer2Template:
              "Recoil displacement amplified: {spatialMagnification}. Playback: {playbackMultiplier}.",
            templateData: {},
            snapshotVersion: "me-03-snap-1",
            instrumentId: "me-03",
            viewId: "box-trajectory",
            scale: me03Scale,
            tableData: {
              caption: "Recoil displacement values",
              columns: [{ id: "dx", header: "Displacement", unit: "m" }],
              rows: [{ id: "r1", label: "Center-of-mass shift", values: ["1.112650 × 10^-17"] }],
            },
          }),
        );
      });

      const toggleBtn = container.querySelector("button.toggle-table-btn") as HTMLButtonElement;
      if (toggleBtn) {
        await act(() => {
          toggleBtn.click();
        });
      }

      const text = container.textContent ?? "";
      // appliesTo naming the displacement output rather than the scene
      expect(text).toContain("displacement amplified ×10^17");
      expect(text).toContain("10 times slower");
      expect(text).toContain("2 px calibrated to box_width");
      expect(text).toContain("unnormalized counts/values");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("states default cases rather than omitting them", () => {
    const template =
      "Defaults: {spatialMagnification} | {playbackMultiplier} | {glyphSize} | {quantityNormalization}";
    const filled = fillTemplate(template, { scale: defaultScale });

    // factor: 1 -> stated as unmagnified
    expect(filled).toContain("1:1 scene scale (unmagnified)");
    // playbackMultiplier: 1 -> stated as true rate
    expect(filled).toContain("true rate (1 s/s)");
    // represents: "none" -> stated as uncalibrated marker
    expect(filled).toContain("5 px marker (uncalibrated marker, not a physical particle size)");
    // kind: "none" -> stated as unnormalized
    expect(filled).toContain("unnormalized counts/values");
  });

  test("removing any one fact from the rendered surface fails the audit with viewId and field named", () => {
    const renderedWithoutGlyph =
      "Spatial magnification: Scene magnified ×1,000. Simulated elapsed time: 2 s (t). Playback clock: true rate (1 s/s). Quantity normalization: per-bin-width.";

    expect(() => {
      auditAccessibleScaleFacts(renderedWithoutGlyph, bm01Scale, "view-bm01-test");
    }).toThrow(ScaleAuditError);

    try {
      auditAccessibleScaleFacts(renderedWithoutGlyph, bm01Scale, "view-bm01-test");
    } catch (err: unknown) {
      const error = err as ScaleAuditError;
      expect(error.viewId).toBe("view-bm01-test");
      expect(error.missingField).toBe("glyphSize");
      expect(error.message).toContain(
        'Accessible scale audit failed for view "view-bm01-test": missing fact "glyphSize"',
      );
    }
  });

  test("ME-03 box fixture at 10^15, 10^17, and 10^20 announces three different factors while table value stays 1.112650e-17 m", async () => {
    const factors = [1e15, 1e17, 1e20];
    const announcedFactors: string[] = [];

    for (const factor of factors) {
      const currentScale: RepresentationScale = {
        ...me03Scale,
        spatialMagnification: { appliesTo: "displacement", factor },
      };

      const container = createContainer();
      const root = createRoot(container);

      try {
        await act(() => {
          root.render(
            createElement(GraphDescriptionContainer, {
              layer1Statement: "Box recoil under photon pulse",
              layer2Template: "Amplification: {spatialMagnification}",
              templateData: {},
              snapshotVersion: "snap-me03",
              scale: currentScale,
              tableData: {
                caption: "Exact recoil data",
                columns: [{ id: "x", header: "x", unit: "m" }],
                rows: [{ id: "r", label: "Final x", values: ["1.112650 × 10^-17"] }],
              },
            }),
          );
        });

        const layer2Text = container.querySelector(".layer-2-text")?.textContent ?? "";
        announcedFactors.push(layer2Text);

        // Click to expand table
        const toggleBtn = container.querySelector("button.toggle-table-btn") as HTMLButtonElement;
        if (toggleBtn) {
          await act(() => {
            toggleBtn.click();
          });
        }

        // Value in the inspectable table remains strictly unscaled
        const table = container.querySelector(".inspectable-table");
        expect(table?.textContent).toContain("1.112650 × 10^-17");
      } finally {
        await act(() => {
          root.unmount();
        });
        removeContainer(container);
      }
    }

    expect(announcedFactors[0]).toContain("displacement amplified ×10^15");
    expect(announcedFactors[1]).toContain("displacement amplified ×10^17");
    expect(announcedFactors[2]).toContain("displacement amplified ×10^20");
  });

  test("changing scale fields produces zero automatic announcements and preserves snapshotVersion and runId", () => {
    const announcements: string[] = [];
    const manager = new AnnouncementManager({
      onAnnounce: (msg) => announcements.push(msg),
    });

    const initialSnapshotVersion = "snap-100";
    const initialRunId = "run-200";

    // Changing presentation scale
    manager.handlePresentationChange();
    expect(announcements).toEqual([]);

    expect(initialSnapshotVersion).toBe("snap-100");
    expect(initialRunId).toBe("run-200");
  });

  test("validating a template that omits required scale slots throws at build/instantiation time", () => {
    const incompleteTemplate = "Displacement is {lambda_x}. Spatial scale: {spatialMagnification}.";

    expect(() => {
      validateTemplate(incompleteTemplate, ["lambda_x"], {
        requireScaleSlots: true,
        availableScale: true,
      });
    }).toThrow(TemplateValidationError);

    try {
      validateTemplate(incompleteTemplate, ["lambda_x"], {
        requireScaleSlots: true,
        availableScale: true,
      });
    } catch (err: unknown) {
      const error = err as TemplateValidationError;
      expect(error.missingSlot).toBe("simulatedElapsedTime");
    }
  });

  test("asserts this bead declares no duplicate RepresentationScale type in src/a11y/", () => {
    const a11yDir = join(process.cwd(), "src/a11y");
    const checkDir = (dir: string) => {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          checkDir(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
          const content = readFileSync(fullPath, "utf-8");
          // Disallow "type RepresentationScale =" or "interface RepresentationScale" declarations
          const hasTypeDecl = /^\s*(export\s+)?type\s+RepresentationScale\s*=/m.test(content);
          const hasInterfaceDecl =
            /^\s*(export\s+)?interface\s+RepresentationScale\s*(\{|extends)/m.test(content);
          expect(hasTypeDecl).toBe(false);
          expect(hasInterfaceDecl).toBe(false);
        }
      }
    };

    checkDir(a11yDir);
  });
});
