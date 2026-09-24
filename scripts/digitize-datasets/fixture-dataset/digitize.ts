import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import {
  type DigitizationPipelineInput,
  executeDigitizationPipeline,
} from "../../../src/content/datasets/pipeline/digitize.ts";
import { validateHistoricalDataset } from "../../../src/content/schemas/experiment.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function runFixtureDigitization(options?: { targetDir?: string }) {
  const rawCsvPath = join(__dirname, "raw.csv");
  const rawCsvContent = readFileSync(rawCsvPath, "utf8").trim();

  const lines = rawCsvContent.split("\n").slice(1);
  const rawRows = lines.map((line) => {
    const parts = line.split(",");
    return parts.map((part) => {
      const p = part.trim();
      if (p.startsWith("missing:")) {
        return { kind: "missing" as const, reason: p.slice(8) };
      }
      if (p.startsWith("upper:")) {
        return { kind: "bound" as const, direction: "upper" as const, value: Number(p.slice(6)) };
      }
      if (p.startsWith("lower:")) {
        return { kind: "bound" as const, direction: "lower" as const, value: Number(p.slice(6)) };
      }
      return { kind: "number" as const, value: Number(p), originalToken: p };
    });
  });

  const input: DigitizationPipelineInput = {
    id: "fixture-dataset",
    title: "Fixture Historical Dataset",
    evidenceStatus: "withdrawn",
    withdrawal: {
      date: "2026-09-24",
      reason:
        "A pipeline fixture, not a measurement. Its rows were constructed to exercise the digitizer, and the paper it cites, Lummer and Pringsheim's 1900 report on black-body radiation, gives no particle radii or displacements.",
    },
    primaryPublicationId: "pub-1900",
    publications: [
      {
        id: "pub-1900",
        citation: "Lummer, O. & Pringsheim, E. (1900). Verh. Dtsch. Phys. Ges. 2: 163-180.",
        locator: { kind: "table", number: 1 },
        publicationDate: {
          type: "issue-publication",
          text: "1900",
          earliest: "1900-01-01",
          latest: "1900-12-31",
          precision: "year",
          source: "Verh. Dtsch. Phys. Ges.",
          verifiedAt: "2026-09-17",
        },
      },
    ],
    digitizer: {
      name: "Fixture Pipeline",
      method: "Automated test keying",
      date: "2026-09-17",
      sourcePageImage: "fixture-p1.png",
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
      type: "none",
      description: "Fixture test uncertainty",
    },
    notes: "Pipeline fixture dataset exercising end-to-end extraction",
    rights: {
      status: "public-domain-image",
      statement: "Public domain",
      source: "https://archive.org",
      recordedAt: "2026-09-17",
      reuseTerms: "named-license",
    },
    allowedInferenceModelIds: ["evaluateStokesEinstein"],
  };

  const result = executeDigitizationPipeline(input);

  // Target directory for canonical YAML file (content/datasets/)
  const contentDir = options?.targetDir ?? join(process.cwd(), "content", "datasets");

  // Write CSV into the pipeline directory (not content/datasets/)
  const csvPath = join(__dirname, "fixture-dataset.csv");
  writeFileSync(csvPath, result.canonicalCsv, "utf8");

  // Write canonical YAML with computed digest and csvDigest property
  const yamlObj = {
    ...result.dataset,
    csvDigest: result.csvDigest,
  };
  // No folding: the edition's strict YAML parser reads plain and quoted scalars, not ">-" blocks.
  const yamlText = yaml.dump(yamlObj, { indent: 2, lineWidth: -1 });
  const yamlPath = join(contentDir, "fixture-dataset.yaml");
  writeFileSync(yamlPath, yamlText, "utf8");

  // Validate the written YAML
  validateHistoricalDataset(yamlObj);

  return {
    ...result,
    csvPath,
    yamlPath,
    yamlText,
    canonicalCsv: result.canonicalCsv,
  };
}

if (typeof process !== "undefined" && process.argv[1]?.includes("digitize.ts")) {
  const out = runFixtureDigitization();
  console.log(`Fixture dataset digitized. YAML: ${out.yamlPath}, Digest: ${out.csvDigest}`);
}
