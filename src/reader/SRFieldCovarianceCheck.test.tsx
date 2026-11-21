import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { verifySRFieldCovariance } from "../equations/derivations/srFieldCovariance.ts";
import { srFieldComponentRows } from "../equations/derivations/srFieldTransforms.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "../testing/reactDom.ts";
import { PaperPage } from "./PaperPage.tsx";
import { SRFieldCovarianceCheck } from "./SRFieldCovarianceCheck.tsx";

const report = verifySRFieldCovariance();

test("the actual section route supplies the checked report and all component targets before hydration", async () => {
  const html = await exportMarkup(
    await PaperPage({ paperId: "special-relativity", section: "s6" }),
  );
  const panel = /<section id="sr-field-covariance-check"[\s\S]*?<\/section>/
    .exec(html)?.[0]
    ?.replaceAll("<!-- -->", "")
    .replace(/\s+/g, " ");
  expect(panel).toContain('data-field-covariance="checked"');
  expect(panel).toContain("6 of 6 transformed equations follow");
  expect(panel).toContain("each of its first derivatives");
  expect(panel).toContain("physical identification");
  expect(panel).toContain('<fieldset disabled="">');
  expect(panel).toContain("requires JavaScript");
  for (const component of ["x", "y", "z", "l", "m", "n"]) {
    expect(html).toContain(`id="sr-field-component-${component}"`);
    expect(html).toContain(`href="#sr-field-component-${component}"`);
  }
  expect(html).toContain('data-review="draft"');
});

test("a failed exact check offers the authored derivation without a checked claim or premise controls", () => {
  const html = renderToStaticMarkup(
    <SRFieldCovarianceCheck report={{ ...report, passed: false }} />,
  );
  expect(html).toContain('data-field-covariance="unavailable"');
  expect(html).toContain("does not claim a checked covariance result");
  expect(html).not.toContain('type="checkbox"');
  expect(html).not.toContain("Established");
});

test("an incomplete real check exposes its reason without inventing failed component or inverse checks", () => {
  const incomplete = verifySRFieldCovariance(srFieldComponentRows.slice(1));
  expect(incomplete.passed).toBe(false);
  expect(incomplete.inverseTransform).toBe(false);
  expect(incomplete.rows).toHaveLength(0);
  expect(incomplete.reason).toBe(
    "Every electric and magnetic component is required exactly once in source order.",
  );
  const html = renderToStaticMarkup(<SRFieldCovarianceCheck report={incomplete} />);
  expect(html).toContain("Why the exact check is unavailable");
  expect(html).toContain(incomplete.reason ?? "missing reason");
  expect(html).not.toContain("data-field-check-failure");
  expect(html).not.toContain("inverse");
  expect(html).not.toContain('type="checkbox"');
});

test("a real wrong-sign field row names the failed component and retains no checked controls", () => {
  const wrongSign = verifySRFieldCovariance(
    srFieldComponentRows.map((row) =>
      row.component === "Y"
        ? {
            ...row,
            grouped: {
              ...row.grouped,
              left: { kind: "negate" as const, argument: row.grouped.left },
            },
          }
        : row,
    ),
  );
  expect(wrongSign.passed).toBe(false);
  expect(wrongSign.reason).toBeUndefined();
  expect(wrongSign.rows.filter((row) => !row.residualIdentity).map((row) => row.component)).toEqual(
    ["Y"],
  );
  const html = renderToStaticMarkup(<SRFieldCovarianceCheck report={wrongSign} />);
  expect(html).toContain('data-field-covariance="unavailable"');
  expect(html).toContain('data-field-check-failure="Y"');
  expect(html).toContain('href="#sr-field-component-y"');
  expect(html).toContain("residual identity check failed");
  expect(html).not.toContain("coordinate change check failed");
  expect((html.match(/data-field-check-failure=/g) ?? []).length).toBe(1);
  expect(html).not.toContain('type="checkbox"');
  expect(html).not.toContain("Established");
});

describe("the reader can test the logical role of the vacuum premises", () => {
  let container: HTMLElement;
  let root: Root;
  beforeEach(async () => {
    await installDom();
    container = createContainer();
    container.innerHTML = renderToString(<SRFieldCovarianceCheck report={report} />);
    expect(container.querySelector("fieldset")?.disabled).toBe(true);
    await act(async () => {
      root = hydrateRoot(container, <SRFieldCovarianceCheck report={report} />);
    });
    expect(container.querySelector("fieldset")?.disabled).toBe(false);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    removeContainer(container);
    await uninstallDom();
  });
  const established = () =>
    [...container.querySelectorAll<HTMLElement>('[data-established="true"]')].map(
      (row) => row.dataset.covarianceComponent,
    );
  async function toggle(id: string) {
    const input = container.querySelector<HTMLInputElement>(`#${id}`);
    expect(input).not.toBeNull();
    await act(async () => input?.click());
  }

  test("withdrawing electric divergence affects X alone and restoring it restores all six", async () => {
    expect(established()).toEqual(["X", "Y", "Z", "L", "M", "N"]);
    await toggle("sr-field-electric-premise");
    expect(established()).toEqual(["Y", "Z", "L", "M", "N"]);
    expect(container.querySelector('[data-covariance-component="X"]')?.textContent).toContain(
      "Requires zero electric divergence",
    );
    expect(container.querySelector('[role="status"]')?.textContent).toContain("5 of 6");
    await toggle("sr-field-electric-premise");
    expect(established()).toHaveLength(6);
  });

  test("both divergence premises can be withdrawn without losing the four transverse consequences", async () => {
    await toggle("sr-field-electric-premise");
    await toggle("sr-field-magnetic-premise");
    expect(established()).toEqual(["Y", "Z", "M", "N"]);
    expect(container.querySelector('[data-covariance-component="L"]')?.textContent).toContain(
      "Requires zero magnetic divergence",
    );
    expect(
      container.querySelector("[data-field-covariance]")?.getAttribute("data-field-covariance"),
    ).toBe("checked");
    expect(container.textContent).toContain(
      "identities remain checked when a premise is deselected",
    );
  });

  test("without the original curl equations no general vacuum consequence is claimed", async () => {
    await toggle("sr-field-curl-premise");
    expect(established()).toEqual([]);
    expect(container.querySelector('[role="status"]')?.textContent).toContain("0 of 6");
    expect(container.querySelectorAll("tbody td").length).toBe(6);
    for (const cell of container.querySelectorAll("tbody td"))
      expect(cell.textContent).toBe("Requires the original curl equation");
    await toggle("sr-field-curl-premise");
    expect(established()).toHaveLength(6);
  });
});
