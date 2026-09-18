/**
 * Bun.build entry used by the fixture bundler so the browser-target resolver
 * plugin is applied whether the caller is bun or a node-spawned bun process.
 */

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

declare global {
  interface ImportMeta {
    readonly main?: boolean;
  }
  const Bun: {
    build: (options: {
      entrypoints: readonly string[];
      outdir: string;
      naming?: string | { entry?: string; chunk?: string; asset?: string };
      sourcemap?: string;
      target?: string;
      format?: string;
      plugins?: readonly unknown[];
    }) => Promise<{
      success: boolean;
      logs: readonly unknown[];
    }>;
  };
}

export function relativeTsResolverPlugin(): {
  name: string;
  setup: (build: {
    onResolve: (
      options: { filter: RegExp },
      callback: (args: { path: string; importer?: string }) => { path: string } | undefined,
    ) => void;
  }) => void;
} {
  return {
    name: "relative-ts-resolver",
    setup(build) {
      build.onResolve({ filter: /^\.\.?\// }, (args) => {
        if (!args.importer) return undefined;
        const direct = resolve(dirname(args.importer), args.path);
        if (existsSync(direct)) return { path: direct };
        for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
          if (existsSync(direct + ext)) return { path: direct + ext };
        }
        return undefined;
      });
    },
  };
}

export async function buildFixtureBundle(entryFile: string, outDir: string): Promise<void> {
  const buildResult = await Bun.build({
    entrypoints: [entryFile],
    outdir: outDir,
    naming: { entry: "bundle.[ext]" },
    sourcemap: "external",
    target: "browser",
    format: "esm",
    plugins: [relativeTsResolverPlugin()],
  });
  if (!buildResult.success) {
    throw new Error(`Failed to bundle fixture: ${buildResult.logs.map(String).join("\n")}`);
  }
}

const entryFlag = process.argv.indexOf("--entry");
const outFlag = process.argv.indexOf("--outdir");
if (import.meta.main && entryFlag >= 0 && outFlag >= 0) {
  const entryFile = process.argv[entryFlag + 1];
  const outDir = process.argv[outFlag + 1];
  if (!entryFile || !outDir) {
    throw new Error("runFixtureBuild requires --entry <file> --outdir <dir>");
  }
  await buildFixtureBundle(entryFile, outDir);
}
