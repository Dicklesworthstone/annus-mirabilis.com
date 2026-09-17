/**
 * Tests for StudioKernelChips telemetry HUD (am-scaf-extract-ui-components-c31).
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import {
  type KernelChip,
  StudioKernelChips,
  useResponsiveStudioHud,
} from "./StudioKernelChips.tsx";

describe("StudioKernelChips Component", () => {
  const sampleChips: KernelChip[] = [
    { label: "Velocity", value: "0.600", unit: "c", tone: "ok" },
    { label: "Lorentz Factor", value: "1.250", unit: "γ", tone: "warn" },
    { label: "Kinetic Energy", value: "2.35", unit: "MeV", tone: "hot" },
  ];

  test("returns null when visible is false or chips array is empty", () => {
    const hiddenHtml = renderToStaticMarkup(
      <StudioKernelChips visible={false} chips={sampleChips} />,
    );
    expect(hiddenHtml).toBe("");

    const emptyHtml = renderToStaticMarkup(<StudioKernelChips visible={true} chips={[]} />);
    expect(emptyHtml).toBe("");
  });

  test("renders telemetry chips with units, tones, and title header", () => {
    const html = renderToStaticMarkup(
      <StudioKernelChips
        visible={true}
        title="Live Telemetry Bus"
        chips={sampleChips}
        side="right"
      />,
    );

    expect(html).toContain("Live Telemetry Bus");
    expect(html).toContain("Velocity");
    expect(html).toContain("0.600");
    expect(html).toContain("c");
    expect(html).toContain("Lorentz Factor");
    expect(html).toContain("1.250");
    expect(html).toContain("Kinetic Energy");
    expect(html).toContain("2.35");
    expect(html).toContain("right-3");
    expect(html).toContain("max-w-[min(calc(100%-25rem),28rem)]");
  });

  test("supports a compact top-right lane when an apparatus occupies the bottom edge", () => {
    const html = renderToStaticMarkup(
      <StudioKernelChips
        visible
        title="Clearance Lane"
        chips={sampleChips}
        side="right"
        placement="top"
        width="compact"
      />,
    );

    expect(html).toContain("top-20");
    expect(html).not.toContain("bottom-3 sm:bottom-4");
    expect(html).toContain("max-w-[17rem]");
  });

  test("automatically redirects side='left' to 'right' when hasPrimaryHud is true", () => {
    const html = renderToStaticMarkup(
      <StudioKernelChips
        visible={true}
        title="Secondary Bus"
        chips={sampleChips}
        side="left"
        hasPrimaryHud={true}
      />,
    );

    expect(html).toContain("right-3");
  });

  test("respects side='left' when hasPrimaryHud is false", () => {
    const html = renderToStaticMarkup(
      <StudioKernelChips
        visible={true}
        title="Stand-alone Bus"
        chips={sampleChips}
        side="left"
        hasPrimaryHud={false}
      />,
    );

    expect(html).toContain("left-3");
  });

  test("renders hot and warn badge tones with proper styling classes", () => {
    const html = renderToStaticMarkup(<StudioKernelChips visible={true} chips={sampleChips} />);

    expect(html).toContain("bg-rose-500/15");
    expect(html).toContain("bg-amber-500/15");
    expect(html).toContain("bg-parchment-100/80");
  });

  test("useResponsiveStudioHud exports a valid hook function", () => {
    expect(typeof useResponsiveStudioHud).toBe("function");
  });

  test("limits chip affordance animation to its changing visual properties", () => {
    const source = readFileSync(
      join(process.cwd(), "src/visuals/three/StudioKernelChips.tsx"),
      "utf8",
    );

    expect(source).not.toContain("transition-all");
    expect(source).toContain("transition-[background-color,transform]");
  });
});
