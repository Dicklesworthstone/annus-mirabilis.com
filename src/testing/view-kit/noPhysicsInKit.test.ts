import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  auditViewComponentSource,
  auditViewKitDirectory,
} from "../../visuals/kit/viewGuard.ts";
import { findPhysicsImportViolations } from "../noPhysicsInComponents.test.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "../reactDom.ts";
import { PlantedLorentzView } from "./fixtures/PlantedLorentzView.fixture.tsx";
import { PlantedRecomputingView } from "./fixtures/PlantedRecomputingView.fixture.tsx";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const KIT_DIR = path.join(REPO_ROOT, "src/visuals/kit");
const FIXTURES_DIR = path.join(REPO_ROOT, "src/testing/view-kit/fixtures");

beforeEach(async () => {
  await installDom();
});

afterEach(async () => {
  await uninstallDom();
});

describe("no physics in view kit (am-inst-2d-view-kit-u75r)", () => {
  test("src/visuals/kit contains zero forbidden physics imports", () => {
    const files: { path: string; content: string }[] = [];
    for (const name of fs.readdirSync(KIT_DIR)) {
      if (!/\.(ts|tsx)$/.test(name)) continue;
      const full = path.join(KIT_DIR, name);
      const repoRelative = path.relative(REPO_ROOT, full).split(path.sep).join("/");
      files.push({
        path: repoRelative,
        content: fs.readFileSync(full, "utf8"),
      });
    }

    expect(files.length).toBeGreaterThan(5);
    const violations = findPhysicsImportViolations(files);
    expect(violations).toEqual([]);
  });

  test("view guard detects planted component recomputing diffusion and holding private parameter state", () => {
    const fixturePath = path.join(FIXTURES_DIR, "PlantedRecomputingView.fixture.tsx");
    const content = fs.readFileSync(fixturePath, "utf8");

    const violations = auditViewComponentSource(
      "src/testing/view-kit/fixtures/PlantedRecomputingView.fixture.tsx",
      content,
    );

    expect(violations.length).toBeGreaterThanOrEqual(2);

    const privateStateViolation = violations.find((v) => v.rule === "private-physics-state");
    expect(privateStateViolation).toBeDefined();
    expect(privateStateViolation?.message).toContain("private useState");

    const diffusionViolation = violations.find((v) => v.rule === "recompute-diffusion");
    expect(diffusionViolation).toBeDefined();
    expect(diffusionViolation?.message).toContain("recomputes diffusion");
  });

  test("view guard detects planted component recomputing Lorentz transformed coordinates", () => {
    const fixturePath = path.join(FIXTURES_DIR, "PlantedLorentzView.fixture.tsx");
    const content = fs.readFileSync(fixturePath, "utf8");

    const violations = auditViewComponentSource(
      "src/testing/view-kit/fixtures/PlantedLorentzView.fixture.tsx",
      content,
    );

    expect(violations.length).toBeGreaterThanOrEqual(2);

    const privateStateViolation = violations.find((v) => v.rule === "private-physics-state");
    expect(privateStateViolation).toBeDefined();

    const lorentzViolation = violations.find((v) => v.rule === "recompute-transformed-coordinates");
    expect(lorentzViolation).toBeDefined();
    expect(lorentzViolation?.message).toContain("transformed coordinates");
  });

  test("the real src/visuals/kit contains zero recomputation or private physics state violations", () => {
    const violations = auditViewKitDirectory(KIT_DIR);
    expect(violations).toEqual([]);
  });

  test("runtime negative: proves local recomputation causes views to diverge from accepted snapshot", async () => {
    const container = createContainer();
    const root = createRoot(container);

    // Suppose simulation kernel ran a bounded/empirical diffusion run where
    // boundary collisions caused the true ensemble MSD to be 4.8 μm²
    // (the accepted snapshot value), whereas idealized closed-form 2*D*t = 6.0 μm².
    const acceptedSnapshotMSD = 4.8;
    const D = 1.0;
    const t = 3.0;

    try {
      await act(() => {
        root.render(
          createElement(PlantedRecomputingView, {
            D,
            t,
            acceptedMeanSquareDisplacement: acceptedSnapshotMSD,
          }),
        );
      });

      const element = container.querySelector(".planted-recomputing-view");
      const recomputedValue = Number(element?.getAttribute("data-recomputed-msd"));
      const acceptedValue = Number(element?.getAttribute("data-accepted-msd"));

      // The defective component displayed 6.0 instead of the accepted snapshot 4.8!
      expect(recomputedValue).toBe(6.0);
      expect(acceptedValue).toBe(4.8);
      expect(recomputedValue).not.toBe(acceptedValue);

      // This demonstrates why local recomputation is strictly forbidden by AGENTS.md:
      // it corrupts scientific agreement with the simulation kernel's accepted world.
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});
