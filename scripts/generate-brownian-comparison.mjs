import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BM01_DEFAULTS } from "../src/experiments/bm01/definition.ts";
import { encodeResult } from "../src/experiments/results/codec.ts";
import { createBm01Recording, measureBm01 } from "../src/workers/operations/bm01.ts";

/** Build-time examples use the same owner and transport as the live tracer laboratory. */
export async function generateBrownianComparison(root = resolve(dirname(fileURLToPath(import.meta.url)), "..")) {
  const original = JSON.parse(await readFile(resolve(root, "src/generated/bm01-example.json"), "utf8"));
  if (!/^source:sha256:[a-f0-9]{64}$/u.test(original.sourceDigest)) throw new Error("Generate the tracer example first.");
  // Authored Einstein-style physical settings, evaluated with explicitly modern SI constants.
  const baselineParameters = { ...BM01_DEFAULTS, T: 290.15, eta: 1.35e-3, a: .5e-6 };
  async function evaluate(parameters) {
    const recording = await createBm01Recording(parameters, { yieldControl: async () => {} });
    if (recording.kind !== "accepted") throw new Error("Comparison recording failed.");
    const result = measureBm01(recording.data, parameters, false);
    if (result.kind !== "accepted") throw new Error("Comparison measurement failed.");
    return { example: { sourceDigest: original.sourceDigest, parameters, results: result.data.outputs.map(encodeResult),
      stepIndex: result.data.stepIndex, simulationTime: result.data.simulationTime },
      streamVersion: recording.data.normalVersion, allocationId: recording.data.allocationId };
  }
  const baseline = await evaluate(baselineParameters);
  const variant = await evaluate({ ...baselineParameters, a: baselineParameters.a * 2 });
  if (baseline.streamVersion !== variant.streamVersion || baseline.allocationId !== variant.allocationId)
    throw new Error("Comparison recordings use different random streams.");
  const output = { schemaVersion: 1, baseline: baseline.example, doubledRadius: variant.example,
    streamVersion: baseline.streamVersion, allocationId: baseline.allocationId };
  await mkdir(resolve(root, "src/generated"), { recursive: true });
  await writeFile(resolve(root, "src/generated/bm01-comparison.json"), `${JSON.stringify(output)}\n`);
  return output;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await generateBrownianComparison();
  console.log(JSON.stringify({ event: "brownian-comparison-generated", streamVersion: result.streamVersion, sourceDigest: result.baseline.sourceDigest }));
}
