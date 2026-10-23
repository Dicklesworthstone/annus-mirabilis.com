import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * ONE SUBSCRIPTION SITE, SO THE NEXT LABORATORY INHERITS THE PAINT MARK (am-snn0).
 *
 * Measured 2026-10-23, before this gate: 46 call sites across 45 modules spelled
 * `useSyncExternalStore(x.subscribe, x.getSnapshot, x.getServerSnapshot)` by hand, and
 * `useExperimentView` -- the hook written for exactly this, with a registry, a provider and a
 * StrictMode argument in its docblock -- had ZERO production callers. Every copy was correct, which
 * is why nobody minded.
 *
 * It stopped being harmless when `markPainted` was wired. A paint mark can only be emitted where
 * the subscription is, so the `instrument-feedback` budget -- "parameter feedback within 100 ms,
 * measured to the accepted VISIBLE snapshot" -- was unmeasurable for want of a caller, not for want
 * of a browser, and `evaluateInstrumentFeedback` would have reported `maxFeedbackMs: 0,
 * overBudget: false` from a real browser run. Forty-six copies is also forty-six places to forget
 * the mark, so the repair is one owner (`useInstrumentView`) rather than one added line per
 * laboratory, and this gate is what keeps it one.
 *
 * IT READS THE AST, NOT THE TEXT, following `noPhysicsInComponents.test.ts` next door and
 * AGENTS.md's "a gate that forbids a construct must read code, not text". A docblock quoting the
 * forbidden call -- this one quotes it twice -- is not the call, and no comment blanker is needed
 * when the matcher is the compiler's own parser.
 *
 * THE EXEMPTIONS ARE NOT A BUDGET. Each was tried: the adoption was applied mechanically to all 46
 * sites and `tsc` refused seven, each for a reason in the store rather than in the call. They are
 * listed by name with that reason, and a file leaving the list may not rejoin it without one.
 */

/**
 * Stores that are not an instrument view, with what each publishes instead. Measured by adopting
 * the hook at each site and reading the type error.
 */
const EXEMPT: ReadonlyMap<string, string> = new Map([
  [
    "src/experiments/store/useExperimentSnapshot.ts",
    "defines useInstrumentView; this is the one subscription the rest of the tree goes through",
  ],
  [
    "src/components/lab/BrownianComparisonLab.tsx",
    "a comparison controller publishes phase/baseline/variant/result, not one accepted snapshot",
  ],
  ["src/components/lab/CameraControlledComparison.tsx", "the same comparison controller shape"],
  [
    "src/components/lab/kitchen/KitchenLab.tsx",
    "its session nests the experiment view inside a wider state ({ view, preparing, ... }), so the snapshot is not itself an ExperimentView",
  ],
  [
    "src/equations/EquationScope.tsx",
    "an equation selection store publishes { nodeId, quantityId, kind }; an equation is not an experiment",
  ],
  ["src/equations/SemanticEquation.tsx", "the same equation selection store"],
  ["src/equations/accessibility/TermExplorer.tsx", "the same equation selection store"],
  [
    "src/reader/weave/ResultWeavePanel.tsx",
    "a weave source publishes an observation keyed by kind, not an accepted snapshot",
  ],
]);

export interface DirectSubscription {
  readonly file: string;
  readonly line: number;
  readonly receiver: string;
}

/**
 * Every `useSyncExternalStore(x.subscribe, x.getSnapshot, x.getServerSnapshot)` in one module,
 * matched on the call's shape. A two-argument call, or one whose three arguments are not the same
 * receiver's three methods, is a different store contract and is not this gate's business.
 */
export function directSubscriptions(
  repoRelativePath: string,
  content: string,
): readonly DirectSubscription[] {
  const sourceFile = ts.createSourceFile(
    repoRelativePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    repoRelativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: DirectSubscription[] = [];
  const receiverOf = (arg: ts.Expression, method: string): string | null => {
    if (!ts.isPropertyAccessExpression(arg)) return null;
    if (arg.name.text !== method) return null;
    return ts.isIdentifier(arg.expression) ? arg.expression.text : null;
  };
  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "useSyncExternalStore" &&
      node.arguments.length === 3
    ) {
      const [a, b, c] = node.arguments;
      const subscribe = a ? receiverOf(a, "subscribe") : null;
      const snapshot = b ? receiverOf(b, "getSnapshot") : null;
      const server = c ? receiverOf(c, "getServerSnapshot") : null;
      if (subscribe !== null && subscribe === snapshot && subscribe === server) {
        found.push({
          file: repoRelativePath,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
          receiver: subscribe,
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(sourceFile, visit);
  return found;
}

function sourceFiles(dir: string, into: string[]): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      sourceFiles(full, into);
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    if (/\.test\.tsx?$/.test(entry.name)) continue;
    into.push(path.relative(REPO_ROOT, full));
  }
  return into;
}

describe("instrument views subscribe through one hook", () => {
  test("no module outside the named exemptions spells the three-function subscription by hand", () => {
    const files = sourceFiles(path.join(REPO_ROOT, "src"), []);
    // The denominator, printed because a scan of zero files reads exactly like a clean one.
    expect(files.length).toBeGreaterThan(1000);
    const all = files.flatMap((file) =>
      directSubscriptions(file, fs.readFileSync(path.join(REPO_ROOT, file), "utf8")),
    );
    const violations = all.filter((v) => !EXEMPT.has(v.file));
    console.log(
      `[direct subscription census] ${files.length} source modules under src/: ${all.length} hand-spelled subscriptions, ${EXEMPT.size} exempt files, ${violations.length} violations`,
    );
    expect(violations.map((v) => `${v.file}:${v.line} (${v.receiver})`)).toEqual([]);
  });

  test("every exemption is still a file that still subscribes by hand", () => {
    // A stale exemption is a gate that has quietly narrowed. If a file on the list stopped
    // spelling the call -- because it adopted the hook, or was deleted -- the list says the gate
    // covers less than it does, and the next reader cannot tell which.
    const stale: string[] = [];
    for (const [file, reason] of EXEMPT) {
      const abs = path.join(REPO_ROOT, file);
      if (!fs.existsSync(abs)) {
        stale.push(`${file}: no longer exists (${reason})`);
        continue;
      }
      if (directSubscriptions(file, fs.readFileSync(abs, "utf8")).length === 0) {
        stale.push(`${file}: no hand-spelled subscription left, so the exemption is spent`);
      }
    }
    expect(stale).toEqual([]);
  });

  test("the matcher finds the construct in code and ignores prose about it", () => {
    // Both directions, because a matcher that found nothing would report a clean tree forever and
    // one that matched comments would redden on this file's own docblock.
    const code = `
      import { useSyncExternalStore } from "react";
      export function useThing(session: S) {
        return useSyncExternalStore(session.subscribe, session.getSnapshot, session.getServerSnapshot);
      }
    `;
    expect(directSubscriptions("probe.ts", code)).toHaveLength(1);
    expect(directSubscriptions("probe.ts", code)[0]?.receiver).toBe("session");

    const prose = `
      /**
       * Never call useSyncExternalStore(session.subscribe, session.getSnapshot,
       * session.getServerSnapshot) directly; use useInstrumentView.
       */
      // useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
      export const NOTE = "useSyncExternalStore(x.subscribe, x.getSnapshot, x.getServerSnapshot)";
    `;
    expect(directSubscriptions("probe.ts", prose)).toEqual([]);

    // A different store contract is not this gate's business, in either arity or shape.
    const twoArg = `const h = useSyncExternalStore(subscribe, () => true);`;
    expect(directSubscriptions("probe.ts", twoArg)).toEqual([]);
    const mixed = `const v = useSyncExternalStore(a.subscribe, b.getSnapshot, a.getServerSnapshot);`;
    expect(directSubscriptions("probe.ts", mixed)).toEqual([]);
  });
});
