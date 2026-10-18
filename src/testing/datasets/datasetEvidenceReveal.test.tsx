import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { validateHistoricalDataset } from "../../content/schemas/experiment.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { DatasetEvidenceReveal } from "../../visuals/overlays/DatasetEvidenceReveal.tsx";
import { createContainer, installDom, removeContainer, uninstallDom } from "../reactDom.ts";

beforeEach(async () => {
  await installDom();
});

afterEach(async () => {
  await uninstallDom();
});

const REVEAL_FIXTURE_YAML = `id: reveal-fixture-dataset
title: "Perrin (1909) Granule Displacements"
evidenceStatus: historical-measurement
publications:
  - id: pub-1
    citation: "Perrin (1909) Ann. Chim. Phys."
    locator:
      kind: table
      number: 1
    publicationDate:
      type: issue-publication
      text: "1909"
      earliest: "1909-01-01"
      latest: "1909-12-31"
      precision: year
      source: "Ann. Chim. Phys."
      verifiedAt: "2026-09-16"
primaryPublicationId: pub-1
digitizer:
  name: "Editorial Team"
  method: "Double keying"
  date: "2026-09-16"
  sourcePageImage: "crop-table-1.png"
  digitizationRevision: 2
columns:
  - name: "Radius"
    quantityId: "length"
    unit: "m"
    role: "controlled"
  - name: "Displacement"
    quantityId: "rmsDisplacement1d"
    unit: "m"
    role: "observed"
rows:
  - cells:
      - kind: number
        value: 1e-6
        originalToken: "0,001"
      - kind: number
        value: 2e-6
        originalToken: "0,002"
uncertainty:
  type: standard-deviation
  description: "Reported sample std dev"
notes: "Historical test dataset"
rights:
  status: public-domain-image
  statement: "Public domain verified scan."
  source: "https://archive.org"
  recordedAt: "2026-09-16"
  reuseTerms: named-license
allowedInferenceModelIds: []
`;

describe("DatasetEvidenceReveal (am-inst-dataset-overlay-ra9r)", () => {
  test("renders 4 steps in order, navigates by tab clicks, and preserves original tokens", async () => {
    const raw = strictParse(REVEAL_FIXTURE_YAML, "yaml");
    const ds = validateHistoricalDataset(raw);

    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(() => {
        root.render(
          createElement(DatasetEvidenceReveal, {
            dataset: ds,
            selectedRowIndex: 0,
            // The crop follows the scan asset's recorded decision, not the dataset's rights
            // status, so this fixture states the determination (am-inst-dataset-overlay-ra9r).
            publicationDecision: "publish",
          }),
        );
      });

      // Check Step 1 (Source Region) is active by default
      const reveal = container.querySelector('[data-testid="dataset-evidence-reveal"]');
      expect(reveal?.getAttribute("data-active-step")).toBe("1");
      expect(container.textContent).toContain("TABLE 1");
      expect(container.querySelector('[data-testid="crop-rendered"]')).not.toBeNull();

      // Check Step 2 (Printed Tokens)
      const step2Btn = container.querySelector('[data-step-btn="2"]') as HTMLButtonElement;
      await act(() => {
        step2Btn.click();
      });

      expect(reveal?.getAttribute("data-active-step")).toBe("2");
      expect(container.textContent).toContain("0,001");
      expect(container.textContent).toContain("0,002");

      // Check Step 3 (Transformations)
      const step3Btn = container.querySelector('[data-step-btn="3"]') as HTMLButtonElement;
      await act(() => {
        step3Btn.click();
      });

      expect(reveal?.getAttribute("data-active-step")).toBe("3");
      expect(container.textContent).toContain("Units conversion");

      // Check Step 4 (Attribution)
      const step4Btn = container.querySelector('[data-step-btn="4"]') as HTMLButtonElement;
      await act(() => {
        step4Btn.click();
      });

      expect(reveal?.getAttribute("data-active-step")).toBe("4");
      expect(container.textContent).toContain("Revision 2");
      expect(container.textContent).toContain("Double keying");

      // Check static <details> element exists for no-JS environments
      const staticDetails = container.querySelector('[data-testid="static-details-fallback"]');
      expect(staticDetails).not.toBeNull();
      expect(staticDetails?.textContent).toContain("Perrin (1909) Ann. Chim. Phys.");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("rights decision: a reference-only publication decision suppresses the scan image and shows the locator-only notice", async () => {
    const raw = strictParse(REVEAL_FIXTURE_YAML, "yaml") as Record<string, unknown>;
    const rights = raw.rights as Record<string, unknown>;
    // The vocabulary's in-copyright-witness-reference-only constraint ties this status to the
    // reference-only decision; pass the coherent pair so the withholding has its real cause.
    rights.status = "in-copyright-witness-only";
    const ds = validateHistoricalDataset(raw);

    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(() => {
        root.render(
          createElement(DatasetEvidenceReveal, {
            dataset: ds,
            selectedRowIndex: 0,
            publicationDecision: "reference-only",
          }),
        );
      });

      expect(container.querySelector('[data-testid="crop-rendered"]')).toBeNull();
      const notice = container.querySelector('[data-testid="locator-only-notice"]');
      expect(notice).not.toBeNull();
      expect(notice?.textContent).toContain("Scan image withheld");
      // The note names the decision that withheld it, not a determination nobody recorded.
      expect(notice?.textContent).toContain("reference-only");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  /**
   * THE NO-SCRIPT SURFACE, read as served bytes rather than through a hydrated tree.
   *
   * The test above drives the four steps by CLICKING the tab buttons. That is the scripted path
   * and it says nothing about a reader with no JavaScript, because the buttons call
   * `setActiveStep`: without React, one step is on screen and the other three do not exist.
   * Until this test the `<details>` carried the citation, the digitizer and the rights line
   * alone, so the printed tokens and the transformation list -- the two steps that make a
   * plotted point auditable -- were unreachable without script, which is the reveal's whole
   * purpose. `renderToStaticMarkup` is the instrument because it produces exactly what such a
   * reader is served: no effects, no state, no clicks.
   */
  test("without JavaScript all four steps are in the served markup, each with one unique anchor", () => {
    const ds = validateHistoricalDataset(strictParse(REVEAL_FIXTURE_YAML, "yaml"));
    const html = renderToStaticMarkup(
      createElement(DatasetEvidenceReveal, { dataset: ds, selectedRowIndex: 0 }),
    );

    /*
     * Step 2's printed tokens, step 3's transformation list and uncertainty model, and step 4's
     * digitization method. Step 1 is the initial tab, so it is served either way and would
     * prove nothing: asserting it is how this test could pass while still failing its purpose.
     */
    for (const substance of [
      "0,001",
      "0,002",
      "Units conversion",
      "Reported sample std dev",
      "Double keying",
    ]) {
      expect(html).toContain(substance);
    }

    // `#dataset-<id>-<series>-step<n>`, each present EXACTLY once and labelling its section. A
    // duplicate id is not cosmetic: `aria-labelledby` resolves it to whichever came first, so a
    // step would be announced under another step's heading.
    for (const step of [1, 2, 3, 4]) {
      const anchor = `dataset-reveal-fixture-dataset-default-step${step}`;
      expect(html.split(`id="${anchor}"`).length - 1).toBe(1);
      expect(html).toContain(`aria-labelledby="${anchor}"`);
    }

    // The retired spelling, kept as an explicit negative so it cannot return under a green
    // suite: `step-1-title` was page-global, so two reveals on one page meant four duplicates.
    expect(html).not.toContain('id="step-1-title"');
  });
});
