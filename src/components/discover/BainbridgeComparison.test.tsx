import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { loadBainbridgeRecord } from "../../experiments/me03/bainbridgeRecord.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { BainbridgeComparison } from "./BainbridgeComparison.tsx";

describe("Bainbridge's measured comparison", () => {
  test("both reported cases and their historical qualification are readable without JavaScript", () => {
    const html = renderToStaticMarkup(<BainbridgeComparison record={loadBainbridgeRecord()} />);
    expect(html).toContain('data-comparison-kind="measured-fact"');
    expect(html).toContain('data-bainbridge-reaction="lithium-7-proton"');
    expect(html).toContain('data-bainbridge-reaction="lithium-6-deuteron"');
    expect(html).toContain("0.0181 ± 0.0006");
    expect(html).toContain("0.0238 ± 0.0004");
    expect(html).toContain("0.0255");
    expect(html).toContain("later evidence, published 1933");
    expect(html).toContain("oxygen-16 scale");
    expect(html).toContain("not modern unified atomic mass units");
    expect(html).toContain("no assigned statistical significance");
    expect(html).toContain("one agreement and one");
    expect(html).toContain("unsatisfactory comparison");
    expect(html).toContain("page/n60.jpg");
  });

  test("a withheld record shows its reason and no values or comparison controls", () => {
    const html = renderToStaticMarkup(
      <BainbridgeComparison
        record={{ kind: "withheld", citation: "Bainbridge, p. 123", reason: "Source withdrawn." }}
      />,
    );
    expect(html).toContain("Source withdrawn.");
    expect(html).toContain("Bainbridge, p. 123");
    expect(html).not.toContain("0.0182");
    expect(html).not.toContain("<table");
    expect(html).not.toContain('type="radio"');
    expect(html).not.toContain('data-comparison-kind="measured-fact"');
  });
});

describe("inspecting the two historical reactions", () => {
  beforeEach(async () => installDom());
  afterEach(async () => uninstallDom());

  test("changing reaction reveals the unresolved discrepancy while observations stay fixed", async () => {
    const container = createContainer();
    const root = createRoot(container);
    await act(async () => root.render(<BainbridgeComparison record={loadBainbridgeRecord()} />));
    const observations = container.querySelector("tbody")?.textContent;
    expect(observations).toContain("0.0181 ± 0.0006");
    expect(container.querySelector("[data-bainbridge-discrepancy]")?.textContent).toContain(
      "−0.0001",
    );
    expect(container.querySelector("[data-bainbridge-error-ratio]")?.textContent).toBe("0.167");

    const selectSecond = container.querySelector<HTMLInputElement>(
      'input[value="lithium-6-deuteron"]',
    );
    expect(selectSecond).not.toBeNull();
    await act(async () => selectSecond?.click());
    expect(container.querySelector("[data-bainbridge-discrepancy]")?.textContent).toContain(
      "−0.0017",
    );
    expect(container.querySelector("[data-bainbridge-error-ratio]")?.textContent).toBe("4.25");
    expect(container.querySelector('[data-bainbridge-mass-range="outside"]')).not.toBeNull();
    expect(container.querySelector("[data-bainbridge-inspection]")?.textContent).toContain(
      "alpha-particle ranges",
    );
    expect(
      container.querySelector('[data-bainbridge-statistical-status="underdetermined"]'),
    ).not.toBeNull();
    expect(container.querySelector("tbody")?.textContent).toBe(observations);

    await act(async () => root.unmount());
    removeContainer(container);
  });
});
