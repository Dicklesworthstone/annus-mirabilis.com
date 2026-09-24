import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BM03_DEFAULTS } from "../experiments/bm03/definition.ts";
import { createBm03Session } from "../experiments/bm03/session.ts";
import { LQ03_DEFAULTS } from "../experiments/lq03/definition.ts";
import { createLq03Session } from "../experiments/lq03/session.ts";
import { LQ04_DEFAULTS } from "../experiments/lq04/definition.ts";
import { createLq04Session } from "../experiments/lq04/session.ts";
import { LQ05_DEFAULTS } from "../experiments/lq05/definition.ts";
import { createLq05Session } from "../experiments/lq05/session.ts";
import { LQ07_DEFAULTS } from "../experiments/lq07/definition.ts";
import { createLq07Session } from "../experiments/lq07/session.ts";
import { SR04_DEFAULTS } from "../experiments/sr04/definition.ts";
import { createSr04Session } from "../experiments/sr04/session.ts";

/**
 * A session's server snapshot is the view the page was built with, and it stays that view.
 *
 * Labs derive their execution label from identity: the shown snapshot is the build's worked
 * example while it is the server snapshot's accepted one, and a host calculation after. BM-03,
 * LQ-03, LQ-04, LQ-05, SR-04 and LQ-07 returned their LIVE view from getServerSnapshot(), so the
 * identity held for every accepted run and the label read "Static worked example" over results
 * computed from a reader's own settings (measured on live 1d12f3d7 for BM-03 and LQ-07; fixed in
 * 6242107a, and LQ-03 and LQ-04, which this census found, in the commit after it). React requires
 * the same of a server snapshot anyway: it must match the HTML the page was built with.
 *
 * The first test changes a parameter in each of the six and checks the change was accepted
 * before checking the server snapshot, so it cannot pass on a session that ignored the change.
 * The second reads every session module and fails where getServerSnapshot returns a binding
 * declared with `let`, the one way this has gone wrong.
 */

interface Session {
  getSnapshot(): { accepted: { revisions: { input: number } } | null };
  getServerSnapshot(): unknown;
  apply(parameters: never): unknown;
}

const CASES: { lab: string; make: () => Session; change: unknown }[] = [
  {
    lab: "BM-03",
    make: () => createBm03Session("frozen") as unknown as Session,
    change: { ...BM03_DEFAULTS, model: "locked-cluster" },
  },
  {
    lab: "LQ-03",
    make: () => createLq03Session("frozen") as unknown as Session,
    change: { ...LQ03_DEFAULTS, T: 6000 },
  },
  {
    lab: "LQ-04",
    make: () => createLq04Session("frozen") as unknown as Session,
    // A setup change: LQ-04 keeps the input revision for a volume ratio change.
    change: { ...LQ04_DEFAULTS, referenceTemperature: 4000 },
  },
  {
    lab: "LQ-05",
    make: () => createLq05Session("frozen") as unknown as Session,
    change: { ...LQ05_DEFAULTS, n: 5 },
  },
  {
    lab: "LQ-07",
    make: () => createLq07Session("frozen") as unknown as Session,
    change: { ...LQ07_DEFAULTS, regime: "deviation-multi-quantum" },
  },
  {
    lab: "SR-04",
    make: () => createSr04Session("frozen") as unknown as Session,
    change: { ...SR04_DEFAULTS, candidateA: 1.25 },
  },
];

const EXPERIMENTS = fileURLToPath(new URL("../experiments/", import.meta.url));

function sessionFiles(dir: string, base = ""): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = `${dir}${name}`;
    const rel = `${base}${name}`;
    if (statSync(full).isDirectory()) return sessionFiles(`${full}/`, `${rel}/`);
    return /session\.ts$/i.test(name) && !name.includes(".test.") ? [rel] : [];
  });
}

/** The identifier getServerSnapshot returns, in either spelling this repository uses. */
export function serverSnapshotBinding(source: string): string | null {
  const method = source.match(
    /getServerSnapshot\s*\([^)]*\)[^{]*\{\s*return\s+([A-Za-z_$][\w$]*)\s*;/,
  );
  const arrow = source.match(/getServerSnapshot\s*:\s*\(\)\s*=>\s*([A-Za-z_$][\w$]*)\b(?!\s*[.(])/);
  return method?.[1] ?? arrow?.[1] ?? null;
}

describe("a session's server snapshot stays the build's view", () => {
  for (const { lab, make, change } of CASES) {
    test(`${lab}: an accepted change leaves the server snapshot where it was`, () => {
      const session = make();
      const built = session.getServerSnapshot();
      const before = session.getSnapshot().accepted;
      session.apply(change as never);
      const after = session.getSnapshot().accepted;
      // Non-vacuity: the change was accepted, so the live view really moved.
      expect(after).not.toBe(before);
      expect(after?.revisions.input ?? 0).toBeGreaterThan(before?.revisions.input ?? 0);
      expect(session.getServerSnapshot()).toBe(built);
    });
  }

  test("the binding reader finds both spellings, and a let is caught", () => {
    expect(serverSnapshotBinding("getServerSnapshot(): View {\n  return serverView;\n}")).toBe(
      "serverView",
    );
    expect(serverSnapshotBinding("getServerSnapshot: () => serverSnapshot,")).toBe(
      "serverSnapshot",
    );
    // A delegated call is not a binding this reads.
    expect(serverSnapshotBinding("getServerSnapshot: () => store.getServerSnapshot(),")).toBe(null);
  });

  test("no session module returns a let binding from getServerSnapshot", () => {
    const files = sessionFiles(EXPERIMENTS);
    const read: string[] = [];
    const mutable: string[] = [];
    for (const file of files) {
      const source = readFileSync(`${EXPERIMENTS}${file}`, "utf8");
      const binding = serverSnapshotBinding(source);
      if (binding === null) continue;
      read.push(file);
      if (new RegExp(`\\blet\\s+${binding}\\b`).test(source)) mutable.push(`${file}: ${binding}`);
    }
    console.log(
      `[server snapshot] ${files.length} session modules, ${read.length} with a returned binding, ${mutable.length} of them a let`,
    );
    expect(read.length).toBeGreaterThan(20);
    expect(mutable).toEqual([]);
  });
});
