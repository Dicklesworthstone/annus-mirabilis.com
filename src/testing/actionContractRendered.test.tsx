import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { strictParse } from "../content/schemas/strictParse.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

/**
 * AN ACTION'S PROMISE, CHECKED AGAINST THE RENDERED PAGE (am-jioj).
 *
 * `src/a11y/actions/contractAudit.ts` audits an instrument's accessible equivalents by matching the
 * `equivalentAffordance` PROSE against a regex looking for words like "type", "table" and "select",
 * and `src/testing/actionContracts.test.ts` imports only `fs`, `path` and the schema validators. So
 * the audit reads the promise and never the page: an action may say "read the moving ledger values
 * in the table" while the instrument renders no table, and nothing notices.
 *
 * WHAT THIS CHECKS, AND WHICH HALF OF THE QUESTION IT ANSWERS, because it is not both. For each
 * action contract it reads the promise exactly as the existing audit does -- the prose is how a
 * human stated what a reader may do -- and then requires the instrument's own subtree to contain an
 * element of the promised KIND. It does NOT establish that a particular table serves a particular
 * action; that needs the action driven, which is the browser lane's job. A missing kind is a
 * definite defect; a present kind is necessary and not sufficient, and the census says so.
 *
 * MEASURED BEFORE IT WAS WRITTEN, which ruled out the obvious design. A manifest `views[].id` is NOT
 * a DOM contract here: only 3 of 33 built lab pages carry any `data-view` attribute, and three of
 * bm-01's four declared view ids appear nowhere in src. So this keys on `data-instrument-id`, which
 * every one of the 33 carries, and asks for the kind rather than resolving a view.
 *
 * The 33 manifests declare 67 action contracts, whose equivalents mention a table 31 times, typed
 * entry 33 and selection 21, with 3 mentioning none of the three. Those 3 are reported as
 * unclassified rather than passed, because an action whose promise this cannot read is not an action
 * this has checked.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const APP = join(ROOT, "src/app/lab");
const MANIFESTS = join(ROOT, "content/experiments");
const pause = () => new Promise((r) => setTimeout(r, 5));

/** The same three words the prose audit reads, so this cannot disagree with it about the promise. */
const PROMISE_PATTERNS = {
  table: /\btable\b|\bcolumn\b|\brow\b/i,
  typed: /\btype\b|\btyped\b|\benter\b|\binput\b|\bdirect entry\b|\bstepper\b/i,
  select: /\bselect\b|\bchoose\b|\btoggle\b|\bradio\b|\bcheckbox\b|\bswitch\b/i,
} as const;
type Promised = keyof typeof PROMISE_PATTERNS;

/**
 * What satisfies each promise in the DOM.
 *
 * `typed` excludes the share form and the experiment recorder for the reason labFormSweep gives:
 * those are a reader's prose annotations, not settings, so a lab offering only those would not be
 * offering typed entry to its experiment.
 */
const SATISFIED_BY: Readonly<Record<Promised, string>> = {
  table: 'table, [role="table"], dl',
  // `input:not([type])` is not optional. An <input> with no type attribute IS a text input, and an
  // ATTRIBUTE selector cannot see a defaulted attribute: lq-02's three typed settings carry no
  // `type`, so the first version of this reported "promises typed, and the instrument renders none"
  // for two of its actions while the lab offers three typed fields. labFormSweep avoids it by
  // reading `(i.getAttribute("type") ?? "text")` rather than by selecting on the attribute.
  typed: 'input[type="text"], input[type="number"], input:not([type]), textarea',
  select:
    'input[type="radio"], input[type="checkbox"], select, button[aria-pressed], [role="radiogroup"]',
};

/**
 * How many elements satisfy `kind` inside `root`.
 *
 * The share form and the experiment recorder are excluded HERE rather than in the selector, because
 * a reader's prose annotations are not settings -- labFormSweep gives the same reason -- and
 * `:not([data-share-form] *)` is a Selectors Level 4 form it would be unwise to rely on across
 * engines when `closest` answers the same question plainly.
 */
function satisfying(root: Element, kind: Promised): number {
  const all = [...root.querySelectorAll(SATISFIED_BY[kind])];
  if (kind !== "typed") return all.length;
  return all.filter(
    (e) =>
      e.closest("[data-share-form]") === null && e.closest("[data-experiment-recorder]") === null,
  ).length;
}

type Contract = Readonly<{ actionId?: unknown; equivalentAffordance?: unknown }>;

function contractsOf(labId: string): readonly Contract[] {
  const manifest = strictParse(readFileSync(join(MANIFESTS, `${labId}.yaml`), "utf8"), "yaml") as {
    actionContracts?: unknown;
    accessibleEquivalents?: unknown;
    actions?: unknown;
  } | null;
  const raw = manifest?.actionContracts ?? manifest?.accessibleEquivalents ?? manifest?.actions;
  return Array.isArray(raw) ? (raw as readonly Contract[]) : [];
}

async function mount(route: string) {
  const mod = await import(join(APP, route, "page.tsx"));
  const out = mod.default({ params: Promise.resolve({}), searchParams: Promise.resolve({}) });
  const jsx = (out instanceof Promise ? await out : out) as ReactElement;
  const container = createContainer();
  const reactRoot = createRoot(container);
  await act(async () => {
    reactRoot.render(jsx);
  });
  for (let i = 0; i < 40; i++)
    await act(async () => {
      await pause();
    });
  // A control inside a closed disclosure is still offered to a reader who opens it, and several
  // labs keep their settings in an "Experiment settings" drawer by design (AGENTS.md).
  for (const d of container.querySelectorAll("details")) (d as HTMLDetailsElement).open = true;
  await act(async () => {
    await pause();
  });
  return { container, reactRoot };
}

const routes = readdirSync(APP)
  .filter((d) => /^(bm|lq|me|sr)-\d\d$/.test(d))
  .sort();

describe("every action's promised affordance exists in the instrument's own render", () => {
  beforeAll(async () => {
    await installDom();
  });
  afterAll(async () => {
    await uninstallDom();
  });

  const findings: string[] = [];
  const unclassified: string[] = [];
  let labsExamined = 0;
  let actionsExamined = 0;
  let promisesChecked = 0;
  const kindCounts: Record<string, number> = { table: 0, typed: 0, select: 0 };

  for (const route of routes) {
    test(`${route}: each action's promised table, typed entry or selection is rendered`, async () => {
      const contracts = contractsOf(route);
      const page = await mount(route);
      const root =
        page.container.querySelector(`[data-instrument-id^="${route}"]`) ??
        page.container.querySelector("[data-instrument-id]");
      const found: string[] = [];
      if (root === null) {
        found.push(`${route}: no [data-instrument-id] in the render, so nothing could be checked`);
      } else {
        labsExamined += 1;
        for (const c of contracts) {
          actionsExamined += 1;
          const id = typeof c.actionId === "string" ? c.actionId : "(unnamed)";
          const eq = typeof c.equivalentAffordance === "string" ? c.equivalentAffordance : "";
          const kinds = (Object.keys(PROMISE_PATTERNS) as Promised[]).filter((k) =>
            PROMISE_PATTERNS[k].test(eq),
          );
          if (kinds.length === 0) {
            unclassified.push(`${route}/${id}`);
            continue;
          }
          for (const kind of kinds) {
            promisesChecked += 1;
            kindCounts[kind] = (kindCounts[kind] ?? 0) + 1;
            if (satisfying(root, kind) === 0)
              found.push(`${route}/${id}: promises ${kind}, and the instrument renders none`);
          }
        }
      }
      await act(async () => {
        page.reactRoot.unmount();
      });
      removeContainer(page.container);
      for (const f of found) findings.push(f);
      expect(found).toEqual([]);
    }, 120_000);
  }

  test("the audit read real pages and real promises, and says which half it answered", () => {
    console.log(
      `[action contracts rendered] ${labsExamined} of ${routes.length} laboratories mounted; ` +
        `${actionsExamined} action contract(s) read; ${promisesChecked} promise(s) checked ` +
        `(table ${kindCounts.table}, typed ${kindCounts.typed}, select ${kindCounts.select}); ` +
        `${unclassified.length} unclassified: ${unclassified.join(", ") || "none"}; ` +
        `${findings.length} promise(s) with no element of that kind` +
        (findings.length ? `: ${findings.join("; ")}` : ""),
    );
    console.log(
      "[action contracts rendered] HALF ANSWERED: an element of the promised KIND exists in the " +
        "instrument's subtree. NOT answered: that THAT element serves THAT action, which needs the " +
        "action driven (the browser lane).",
    );
    // The denominators first. A sweep that mounted nothing, or read no contracts, would report zero
    // findings and read exactly like a clean corpus.
    expect(labsExamined).toBe(routes.length);
    expect(actionsExamined).toBeGreaterThan(50);
    expect(promisesChecked).toBeGreaterThan(50);
    expect(findings).toEqual([]);
  });
});
