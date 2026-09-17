import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type DigitizationPipelineInput,
  executeDigitizationPipeline,
} from "../../../src/content/datasets/pipeline/digitize.ts";
import type { DataCell } from "../../../src/content/schemas/experiment.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function runTemplateDigitization() {
  const rawCsvPath = join(__dirname, "raw.csv");
  const rawCsvContent = readFileSync(rawCsvPath, "utf8").trim();

  const lines = rawCsvContent.split("\n").slice(1);
  const rawRows: DataCell[][] = lines.map((line) => {
    const parts = line.split(",");
    return parts.map((part) => {
      const p = part.trim();
      if (p.startsWith("missing:")) {
        return { kind: "missing", reason: p.slice(8) };
      }
      if (p.startsWith("upper:")) {
        return { kind: "bound", direction: "upper", value: Number(p.slice(6)) };
      }
      if (p.startsWith("lower:")) {
        return { kind: "bound", direction: "lower", value: Number(p.slice(6)) };
      }
      return { kind: "number", value: Number(p), originalToken: p };
    });
  });

  const input: DigitizationPipelineInput = {
    id: "template-dataset",
    title: "Template Historical Dataset",
    primaryPublicationId: "pub-1",
    publications: [
      {
        id: "pub-1",
        citation: "Author (1900). Journal 1: 100-110.",
        locator: { kind: "table", number: 1 },
        publicationDate: {
          type: "issue-publication",
          text: "1900",
          earliest: "1900-01-01",
          latest: "1900-12-31",
          precision: "year",
          source: "Journal 1",
          verifiedAt: "2026-09-17",
        },
      },
    ],
    digitizer: {
      name: "Template Digitizer",
      method: "Double keying",
      date: "2026-09-17",
      sourcePageImage: "template-scan.png",
      digitizationRevision: 1,
    },
    columns: [
      {
        name: "Radius",
        quantityId: "particleRadius",
        unit: "m",
        role: "controlled",
      },
      {
        name: "Displacement",
        quantityId: "rmsDisplacement1d",
        unit: "m",
        role: "observed",
      },
    ],
    rawRows,
    uncertainty: {
      type: "sample-std-dev",
      description: "Sample standard deviation",
    },
    notes: "Template digitization notes",
    rights: {
      status: "public-domain-image",
      statement: "Public domain",
      source: "https://archive.org",
      recordedAt: "2026-09-17",
      reuseTerms: "named-license",
    },
    allowedInferenceModelIds: [],
  };

  return executeDigitizationPipeline(input);
}

if (typeof process !== "undefined" && process.argv[1]?.includes("digitize.ts")) {
  const res = runTemplateDigitization();
  console.log(`Template digitization successful. Digest: ${res.csvDigest}`);
}
