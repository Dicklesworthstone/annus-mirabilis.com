import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashKernelSource, hashModuleClosure } from "../src/content/kernel/sourceDigest.ts";
import { evidenceFromPrepared } from "../src/reasoning/infer/evidence.ts";
import { RADIUS_EXAMPLE } from "../src/reasoning/infer/model.ts";
import {
  createCameraInferenceSession,
  createRadiusSession,
} from "../src/reasoning/infer/session.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CODE_FILES = [
  "src/physics/reference/inference/identifiability.ts",
  "src/reasoning/infer/model.ts",
];
export async function generateInferenceWorkbench(
  root = ROOT,
  profile = process.env.AM_RELEASE_PROFILE ?? "scaffold",
  outputDirectory = resolve(root, "src/generated"),
) {
  if (!["scaffold", "preview", "launch"].includes(profile))
    throw new TypeError("Unknown inference publication profile.");
  const sourceDigest = hashModuleClosure(root, [
    "src/reasoning/infer/session.ts",
    "scripts/generate-inference-workbench.mjs",
  ]);
  const examples = [];
  if (profile === "scaffold") {
    const records = await Promise.all(
      ["bm07", "bm08"].map(async (id) => {
        const source = JSON.parse(
          await readFile(resolve(root, `src/generated/${id}-example.json`), "utf8"),
        );
        // The digest covers exactly the admitted immutable observation projection, not private state.
        const provisional = evidenceFromPrepared(
          id === "bm07" ? "ideal" : "camera",
          source,
          "0".repeat(64),
        );
        const observationDigest = createHash("sha256")
          .update(
            JSON.stringify({
              kind: provisional.kind,
              dt: provisional.dt,
              d: provisional.d,
              exposure: provisional.exposure,
              knownDrift: provisional.knownDrift,
              increments: provisional.increments,
            }),
          )
          .digest("hex");
        return { ...provisional, observationDigest };
      }),
    );
    const [ideal, camera] = records;
    if (!ideal || !camera) throw new Error("Both built-in observation sets are required.");
    // Exercise the actual publication path before exposing the route, including its static worked variants.
    createRadiusSession("build-radius", ideal);
    createRadiusSession("build-radius-conditional", ideal, RADIUS_EXAMPLE);
    createCameraInferenceSession("build-camera", camera);
    createCameraInferenceSession("build-camera-covariance", camera, { information: "covariance" });
    createCameraInferenceSession("build-camera-second", camera, { information: "second-interval" });
    examples.push({ ideal, camera });
  }
  const sourceCode = await Promise.all(
    CODE_FILES.map(async (path) => {
      const text = await readFile(resolve(root, path), "utf8");
      return { path, text, hash: hashKernelSource(text) };
    }),
  );
  const output = { schemaVersion: 1, profile, sourceDigest, sourceCode, examples };
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    resolve(outputDirectory, "inference-workbench.json"),
    `${JSON.stringify(output)}\n`,
  );
  return output;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await generateInferenceWorkbench();
  console.log(
    JSON.stringify({
      event: "inference-workbench-generated",
      profile: result.profile,
      examples: result.examples.length,
      sourceDigest: result.sourceDigest,
    }),
  );
}
