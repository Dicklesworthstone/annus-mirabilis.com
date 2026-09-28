/**
 * WHAT THE MANIFESTS DECLARE, AGAINST WHAT IS PINNED (am-f3e4).
 *
 * The show-the-code catalogue is a hand-written subset of what the manifests declare: an instrument
 * may name six kernel functions in its `owner.kernelFunctions` and the catalogue may pin three of
 * them. Nothing compared the two populations until this module, so "33 of 33 instruments show a
 * listing" and "every declared kernel function is pinned" were being read as one statement. They are
 * not: measured on 2026-09-28, 33 of 33 instruments show a listing while 15 of 108 declared
 * functions have no pin.
 *
 * THE KEY MUST BE RESOLVED, or the count is wrong in the flattering direction's opposite. pins.json
 * is keyed `exportName@module` by the module the function is WRITTEN in, while a manifest may
 * declare it through a barrel: lq-01 names src/physics/reference/radiation.ts where the code is in
 * radiation/waves.ts. Comparing raw declared keys reports 29 unpinned, of which 14 are pinned
 * functions under a different spelling of the same file. Resolving the export first gives 15, and
 * that is the number this module reports.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYaml } from "../provenance/yaml.ts";
import { pinKey } from "./catalog.ts";
import { extractTypeScriptExport } from "./extractTypeScript.ts";

export type DeclaredKernel = Readonly<{
  instrumentId: string;
  /** The module the manifest names, which may be a barrel. */
  declaredModule: string;
  exportName: string;
  /** The module the export is really written in, which is what pins.json is keyed by. */
  filePath: string;
}>;

/** Every kernel function the manifests declare, each resolved to the file it is written in. */
export function readDeclaredKernels(root: string): DeclaredKernel[] {
  const dir = join(root, "content", "experiments");
  const out: DeclaredKernel[] = [];
  for (const name of readdirSync(dir)
    .filter((n) => n.endsWith(".yaml"))
    .sort()) {
    const doc = parseYaml(readFileSync(join(dir, name), "utf8")) as {
      owner?: { kernelFunctions?: readonly { module?: string; exportName?: string }[] };
    };
    for (const fn of doc.owner?.kernelFunctions ?? []) {
      if (typeof fn?.module !== "string" || typeof fn?.exportName !== "string") continue;
      const extracted = extractTypeScriptExport({
        root,
        modulePath: fn.module,
        exportName: fn.exportName,
        revision: "declared-pins",
      });
      out.push({
        instrumentId: name.slice(0, -".yaml".length),
        declaredModule: fn.module,
        exportName: fn.exportName,
        filePath: extracted.filePath,
      });
    }
  }
  return out;
}

export type DeclaredPinReport = Readonly<{
  declarations: number;
  distinctDeclared: number;
  pins: number;
  /** Sorted `exportName@filePath` keys a manifest declares and pins.json does not carry. */
  missing: readonly string[];
  /** Instrument ids against each missing key, for a message a reader can act on. */
  missingByInstrument: ReadonlyMap<string, string>;
}>;

/** Both counts, always, so a run over an empty population reports itself instead of reading clean. */
export function reportDeclaredPins(
  declared: readonly DeclaredKernel[],
  pinnedKeys: ReadonlySet<string>,
): DeclaredPinReport {
  const byKey = new Map<string, string>();
  for (const d of declared) byKey.set(pinKey(d.filePath, d.exportName), d.instrumentId);
  const missing = [...byKey.keys()].filter((k) => !pinnedKeys.has(k)).sort();
  return {
    declarations: declared.length,
    distinctDeclared: byKey.size,
    pins: pinnedKeys.size,
    missing,
    missingByInstrument: new Map(missing.map((k) => [k, byKey.get(k) ?? "?"])),
  };
}

/** One line carrying both counts, for the test log and for a reader of a failing run. */
export function summarizeDeclaredPins(report: DeclaredPinReport): string {
  return (
    `${report.declarations} declarations, ${report.distinctDeclared} distinct declared functions, ` +
    `${report.pins} pins, ${report.missing.length} declared with no pin`
  );
}
