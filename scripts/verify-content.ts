import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileContent } from "../src/content/compiler/compile.ts";
import { verifySliceKernels } from "../src/content/kernel/verify.ts";
import { loadReadingFiles } from "./build-content.ts";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const issues: string[] = [];

if (existsSync(resolve(root, "src/pages"))) {
  issues.push("src/pages exists; App Router architecture forbids a Pages Router root.");
}

const files = await loadReadingFiles(root);
const compiled = await compileContent(files);
if (!compiled.ok) {
  for (const d of compiled.diagnostics.filter((x) => x.severity === "error")) {
    issues.push(`${d.code}: ${d.path}: ${d.message}`);
  }
}

const pinsPath = resolve(root, "src/content/kernel/pins.json");
const kernels = verifySliceKernels({
  root,
  revision: process.env.KERNEL_REVISION ?? "workspace",
  pinsPath: existsSync(pinsPath) ? pinsPath : undefined,
  writeManifestPath: resolve(root, "generated/kernel-sources.json"),
});
if (!kernels.ok) {
  for (const issue of kernels.issues) issues.push(`${issue.code}: ${issue.message}`);
}

if (issues.length > 0) {
  for (const issue of issues) console.error(issue);
  process.exit(1);
}

console.log(
  JSON.stringify({
    ok: true,
    papers: compiled.papers.length,
    kernelFunctions: kernels.records.length,
  }),
);
