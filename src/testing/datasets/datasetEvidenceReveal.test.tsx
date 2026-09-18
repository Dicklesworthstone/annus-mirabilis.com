import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
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

  test("rights decision: reference-only rights status suppresses scan image and shows locator-only notice", async () => {
    const raw = strictParse(REVEAL_FIXTURE_YAML, "yaml") as Record<string, unknown>;
    const rights = raw.rights as Record<string, unknown>;
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
          }),
        );
      });

      expect(container.querySelector('[data-testid="crop-rendered"]')).toBeNull();
      const notice = container.querySelector('[data-testid="locator-only-notice"]');
      expect(notice).not.toBeNull();
      expect(notice?.textContent).toContain("Scan image withheld per rights terms");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});
