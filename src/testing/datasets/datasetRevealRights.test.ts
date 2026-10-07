/**
 * The evidence reveal's crop is governed by the scan asset's recorded PUBLICATION DECISION, not
 * by the dataset's rights STATUS (am-inst-dataset-overlay-ra9r).
 *
 * This file replaces a single assertion that could not fail. It read the component's source and
 * required that the string `facsimile-scan` be absent, which was vacuous three times over: the
 * reveal requests no asset by kind at all, so there was nothing for the pattern to find;
 * `facsimile-scan` is a `receiptKind` of the provenance receipt schema rather than a kind the
 * reveal could ever name; and a denylist of one spelling cannot establish the allowlist claim the
 * bead makes, which is that the reveal serves a crop only under a recorded `publish` decision.
 * A test that forbids an absent string is green on an empty file.
 *
 * So the claim is asserted where it lives, in the rendered output, in BOTH directions, and the
 * case that matters most is the third one: a redistributable status with a decision that is not
 * `publish`. The previous behaviour had no way to express it, because it never read a decision.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { PublicationDecision } from "../../content/provenance/receiptSchema.ts";
import { PUBLICATION_DECISION_VALUES } from "../../content/provenance/receiptSchema.ts";
import {
  type HistoricalDataset,
  validateHistoricalDataset,
} from "../../content/schemas/experiment.ts";
import { loadRightsVocabulary } from "../../content/schemas/rightsVocabulary.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { DatasetEvidenceReveal } from "../../visuals/overlays/DatasetEvidenceReveal.tsx";
import { createContainer, installDom, removeContainer, uninstallDom } from "../reactDom.ts";

beforeEach(async () => {
  await installDom();
});

afterEach(async () => {
  await uninstallDom();
});

const REVEAL_PATH = "src/visuals/overlays/DatasetEvidenceReveal.tsx";

/**
 * A minimal reveal fixture. `rights.status` is `public-domain-text` on purpose: it is the status
 * `millikan-1916-sodium` carries, it is one the vocabulary admits for publication, and it is
 * therefore the status that made the old status-inferring branch serve a crop.
 */
const FIXTURE_YAML = `id: rights-fixture-dataset
title: "Rights fixture"
evidenceStatus: historical-measurement
publications:
  - id: pub-1
    citation: "Fixture (1909) Journal of Fixtures 1, 1-2"
    locator:
      kind: table
      number: 1
    publicationDate:
      type: issue-publication
      text: "1909"
      earliest: "1909-01-01"
      latest: "1909-12-31"
      precision: year
      source: "Journal of Fixtures"
      verifiedAt: "2026-10-07"
primaryPublicationId: pub-1
digitizer:
  name: "Editorial Team"
  method: "Double keying"
  date: "2026-10-07"
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
      - kind: number
        value: 2e-6
uncertainty:
  type: standard-deviation
  description: "Reported sample std dev"
notes: "Rights fixture"
rights:
  status: public-domain-text
  statement: "Text published 1909; the scan carries the host's terms."
  source: "https://archive.org"
  recordedAt: "2026-10-07"
  reuseTerms: named-license
allowedInferenceModelIds: []
`;

function fixture(overrides: (raw: Record<string, unknown>) => void = () => {}): HistoricalDataset {
  const raw = strictParse(FIXTURE_YAML, "yaml") as Record<string, unknown>;
  overrides(raw);
  return validateHistoricalDataset(raw);
}

type CropVerdict = Readonly<{ crop: boolean; notice: string | null }>;

/** Renders step 1 and reports whether a crop was served and what the withholding note said. */
async function renderStepOne(
  dataset: HistoricalDataset,
  publicationDecision: PublicationDecision | undefined,
): Promise<CropVerdict> {
  const container = createContainer();
  const root = createRoot(container);
  try {
    await act(() => {
      root.render(
        createElement(DatasetEvidenceReveal, {
          dataset,
          selectedRowIndex: 0,
          ...(publicationDecision === undefined ? {} : { publicationDecision }),
        }),
      );
    });
    const notice = container.querySelector('[data-testid="locator-only-notice"]');
    return {
      crop: container.querySelector('[data-testid="crop-rendered"]') !== null,
      notice: notice === null ? null : (notice.textContent ?? ""),
    };
  } finally {
    await act(() => {
      root.unmount();
    });
    removeContainer(container);
  }
}

describe("the reveal's crop follows the recorded publication decision (am-inst-dataset-overlay-ra9r)", () => {
  test("the three decisions are the vocabulary's own, so this file tests the whole domain", () => {
    // The denominator for the sweep below. If the vocabulary gains a fourth decision this fails
    // here rather than silently leaving the new value untested.
    expect([...PUBLICATION_DECISION_VALUES]).toEqual([
      "publish",
      "pin-local-only",
      "reference-only",
    ]);
    const vocabulary = loadRightsVocabulary();
    expect(vocabulary.publicationDecision.map((entry) => entry.value)).toEqual([
      ...PUBLICATION_DECISION_VALUES,
    ]);
  });

  test("publish serves the crop; every other decision, and an absent one, withholds it", async () => {
    const dataset = fixture();
    const served: string[] = [];
    const withheld: string[] = [];
    for (const decision of [...PUBLICATION_DECISION_VALUES, undefined] as const) {
      const verdict = await renderStepOne(dataset, decision);
      (verdict.crop ? served : withheld).push(String(decision));
      if (!verdict.crop) {
        expect(verdict.notice).not.toBeNull();
        // The note names the reason it withheld rather than asserting a determination nobody made.
        expect(verdict.notice).toContain(
          decision === undefined ? "no publication decision is recorded" : String(decision),
        );
        expect(verdict.notice).toContain("Journal of Fixtures");
      }
    }
    // Both halves are named, so a run that served everything or nothing cannot read as a pass.
    expect(served).toEqual(["publish"]);
    expect(withheld).toEqual(["pin-local-only", "reference-only", "undefined"]);
  });

  test("a redistributable status does not serve a crop on its own, which is the case the old gate could not express", async () => {
    const vocabulary = loadRightsVocabulary();
    // The vocabulary's own constraint runs one way: publish REQUIRES a redistributable status.
    // Read the statuses out of that constraint rather than hand-listing them here.
    const constraint = vocabulary.constraints.find(
      (entry) => entry.id === "publish-requires-redistributable-status",
    );
    expect(constraint).toBeDefined();
    const redistributable = [...(constraint?.thenClause.match(/'([a-z-]+)'/g) ?? [])].map((token) =>
      token.replaceAll("'", ""),
    );
    expect(redistributable.length).toBeGreaterThan(1);
    expect(redistributable).toContain("public-domain-text");
    // Two of these the old branch did not list at all, so it withheld a crop the vocabulary
    // permits; the rest it served without any decision having been recorded.
    expect(redistributable).toContain("scan-open-terms");

    for (const status of redistributable) {
      const dataset = fixture((raw) => {
        (raw.rights as Record<string, unknown>).status = status;
      });
      const verdict = await renderStepOne(dataset, "reference-only");
      expect(verdict.crop).toBe(false);
      expect(verdict.notice).toContain("reference-only");
    }
    // The positive control: the same statuses do serve once the decision is recorded, so the
    // sweep above is not passing because the fixture cannot render a crop at all.
    for (const status of redistributable) {
      const dataset = fixture((raw) => {
        (raw.rights as Record<string, unknown>).status = status;
      });
      expect((await renderStepOne(dataset, "publish")).crop).toBe(true);
    }
  });

  test("the component keeps no second copy of the rights-status vocabulary", () => {
    // The status list belongs to docs/rights-vocabulary.yaml, which rightsVocabulary.ts loads and
    // "redefines nothing" from. A component that re-lists statuses in order to decide a rights
    // question is the defect this replaces, so assert the absence against CODE: the docblock
    // above the gate quotes two status names while explaining why it does not read them, and an
    // unstripped scan would fail on its own explanation.
    const source = readFileSync(REVEAL_PATH, "utf8");
    const code = stripComments(source);
    const vocabulary = loadRightsVocabulary();
    const statuses = vocabulary.rightsStatus.map((entry) => entry.value);
    expect(statuses.length).toBeGreaterThan(5);
    const mentioned = statuses.filter((status) => code.includes(`"${status}"`));
    expect(mentioned).toEqual([]);
    // The stripper is proved in both directions here, because one that blanked everything would
    // report a clean surface forever.
    expect(code).toContain('publicationDecision === "publish"');
    expect(source).toContain("public-domain-text");
    expect(stripComments('const a = 1; // "public-domain-text"')).not.toContain(
      "public-domain-text",
    );
    expect(stripComments('const s = "public-domain-text";')).toContain("public-domain-text");
    expect(stripComments("const a = 1; // c\nconst b = 2;")).toContain("const b = 2;");
    expect(stripComments("/* c */ const b = 2;")).toContain("const b = 2;");
  });
});

/** Blanks comment bodies and leaves string literals alone. */
function stripComments(source: string): string {
  return source.replace(
    /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g,
    (match) => (match.startsWith("/*") || match.startsWith("//") ? " " : match),
  );
}
