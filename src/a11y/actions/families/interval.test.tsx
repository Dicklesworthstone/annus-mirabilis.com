import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { getLogger } from "../../../testing/log/logger.ts";
import { buildActionCommand, hashCommand } from "../commandBuilder.ts";
import { fixtureIntervalContract } from "../fixtures.ts";
import { IntervalEquivalent } from "./interval/IntervalEquivalent.tsx";

const logger = getLogger("a11y-actions");

describe("am-a11y-action-contracts-k75g: Interval Equivalent Component", () => {
  test("renders accessible static markup with visible labels contained in accessible names", () => {
    const html = renderToStaticMarkup(
      <IntervalEquivalent
        initialInterval={{ lower: -0.8, upper: 0.8 }}
        minLimit={-5}
        maxLimit={5}
      />,
    );

    // Accessible container
    expect(html).toContain('class="interval-equivalent-panel"');
    expect(html).toContain("<section");
    expect(html).toContain('aria-label="Accessible spatial interval selector"');

    // Fieldset and question
    expect(html).toContain("Interval A (Primary Target)");
    expect(html).toContain("Select spatial interval [a, b]");

    // Inputs with labels
    expect(html).toContain('<label for="interval-lower-input">Lower Limit (µm):</label>');
    expect(html).toContain('id="interval-lower-input"');
    expect(html).toContain('aria-label="Lower Limit (µm)"');

    expect(html).toContain('<label for="interval-upper-input">Upper Limit (µm):</label>');
    expect(html).toContain('id="interval-upper-input"');
    expect(html).toContain('aria-label="Upper Limit (µm)"');

    // Readout
    expect(html).toContain("Probability:");
    expect(html).toContain("Expected Particles:");

    // Commit button
    expect(html).toContain(
      '<button type="button" class="interval-commit-btn" aria-label="Apply and commit interval">',
    );
    expect(html).toContain("Apply Interval");

    logger.log({
      testId: "interval-equivalent-static-markup",
      beadId: "am-a11y-action-contracts-k75g",
      outcome: "passed",
      extra: { markupLength: html.length },
    });
  });

  test("generates canonical action command matching interval contract", () => {
    const bounds = { lower: -1.5, upper: 1.5 };
    const command = buildActionCommand(fixtureIntervalContract, {
      interval_lower: bounds.lower,
      interval_upper: bounds.upper,
      confidence_level: 0.95,
    });

    const cmdHash = hashCommand(command);

    expect(command.actionId).toBe("bm06-select-interval");
    expect(command.commandClass).toBe("measurement-change");
    expect(command.inputs.interval_lower).toBe(-1.5);
    expect(command.inputs.interval_upper).toBe(1.5);
    expect(cmdHash.length).toBe(64);
  });

  test("WCAG 2.5.3 (Label in Name): visible label text is contained within accessible names", () => {
    const html = renderToStaticMarkup(
      <IntervalEquivalent initialInterval={{ lower: -1.0, upper: 1.0 }} />,
    );

    // Visible label: "Lower Limit (µm):", accessible name: "Lower Limit (µm)"
    const lowerLabelMatch = html.match(/<label for="interval-lower-input">([^<]+)<\/label>/);
    const lowerInputMatch = html.match(/id="interval-lower-input"[^>]*aria-label="([^"]+)"/);
    expect(lowerLabelMatch).not.toBeNull();
    expect(lowerInputMatch).not.toBeNull();
    const visibleLower = (lowerLabelMatch?.[1] ?? "").replace(/[:\s]+$/, "").trim();
    const accessibleLower = (lowerInputMatch?.[1] ?? "").trim();
    expect(accessibleLower).toContain(visibleLower);

    // Visible label: "Upper Limit (µm):", accessible name: "Upper Limit (µm)"
    const upperLabelMatch = html.match(/<label for="interval-upper-input">([^<]+)<\/label>/);
    const upperInputMatch = html.match(/id="interval-upper-input"[^>]*aria-label="([^"]+)"/);
    expect(upperLabelMatch).not.toBeNull();
    expect(upperInputMatch).not.toBeNull();
    const visibleUpper = (upperLabelMatch?.[1] ?? "").replace(/[:\s]+$/, "").trim();
    const accessibleUpper = (upperInputMatch?.[1] ?? "").trim();
    expect(accessibleUpper).toContain(visibleUpper);

    // Apply button: visible text "Apply Interval", accessible name "Apply and commit interval"
    const buttonMatch = html.match(
      /class="interval-commit-btn"[^>]*aria-label="([^"]+)"[^>]*>([^<]+)<\/button>/,
    );
    expect(buttonMatch).not.toBeNull();
    const accessibleBtn = (buttonMatch?.[1] ?? "").toLowerCase();
    const visibleBtnWords = (buttonMatch?.[2] ?? "").toLowerCase().split(/\s+/);
    for (const word of visibleBtnWords) {
      expect(accessibleBtn).toContain(word);
    }
  });

  test("renders committed status with role=status and initial bounds", () => {
    const html = renderToStaticMarkup(
      <IntervalEquivalent initialInterval={{ lower: -2.0, upper: 2.5 }} />,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain("Committed: [-2, 2.5] µm");
  });
});
