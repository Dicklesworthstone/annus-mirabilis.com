import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { declaredDomains } from "../experiments/controls/declaredDomain.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

/**
 * What a reader gets from typing a value that is not a setting (am-lab-domains-silently-clamped-pzj5,
 * dispatch 165). src/testing/labDomainSweep.test.ts proves each lab's validator; this proves its
 * form, where a typed "" used to become 0 (SR-08, SR-12) before any validator saw it.
 *
 * Each lab page is mounted in happy-dom. Every text or number field is typed through its own React
 * onChange, then the form is submitted (or the field blurred, for a field that commits on blur).
 * For "abc", "" and ±1e300 the reader must see a refusal, and:
 * - the accepted state does not advance;
 * - no run is requested;
 * - no NaN or Infinity appears, and no developer's error text: ExperimentRuntimeError's
 *   "[experiment] ... (outside-numeric-range)" form, which LQ-06 showed a reader for a typed 1e300
 *   while this pattern could not see it.
 * The one allowance: ±1e300 may be accepted in a field whose declared domain is open on that side,
 * or that declares none, as long as nothing raw appears. (In a real browser "abc" cannot be typed
 * into a number field and arrives as "", so both stand for the same reader.)
 *
 * UNFINISHED names the labs not yet fixed, a two-way ratchet like labDomainSweep's.
 *
 * A refusal must also say that what is on screen is not what was typed (dispatch 170): the field
 * keeps the refused text beside the old results, so the alert says the results shown are the last
 * accepted ones. UNMARKED names the labs whose refusals do not, as a second two-way ratchet. The
 * mark is looked for in the refusal itself, not anywhere on the page, where a standing sentence
 * would satisfy it for every refusal at once.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const APP = resolve(root, "src/app/lab");

const UNFINISHED: readonly string[] = [];

/** Labs a refusal leaves without saying the results shown are the last accepted ones. */
const UNMARKED: readonly string[] = [];

const VALUES = ["abc", "", "1e300", "-1e300"] as const;
const KEPT = /last accepted/i;
const RAW =
  /\bNaN\b|\bInfinity\b|\[object |must be a finite number between|\[(?:experiment|[a-z]{2}-\d{2})\] | \((?:[a-z]+-)+[a-z]+\)/g;

function propsKey(el: Element): string | undefined {
  return Object.keys(el).find((k) => k.startsWith("__reactProps$"));
}
function props(el: Element): Record<string, ((...a: unknown[]) => void) | undefined> | undefined {
  const key = propsKey(el);
  return key ? (el as unknown as Record<string, Record<string, () => void>>)[key] : undefined;
}
const pause = () => new Promise((r) => setTimeout(r, 5));

/**
 * Waits until the lab's accepted and requested revisions hold still, so a probe measures what ITS
 * value changed. A worker lab's first snapshot, or the run a mode switch starts, can land after one
 * 5 ms pause; the next probe then read that late arrival as its own value being accepted. On
 * 2026-09-25 this made lq-01 report `power="abc": let through` in 1 of 3 runs, and it refused the
 * b9f2ad77 deploy. Bounded at 200 pauses; it returns as soon as four in a row see no change.
 */
async function settle(c: HTMLElement): Promise<void> {
  let last = "";
  let still = 0;
  for (let i = 0; i < 200 && still < 4; i++) {
    await act(async () => {
      await pause();
    });
    const s = state(c);
    const now = `${s.accepted}|${s.requested}`;
    still = now === last ? still + 1 : 0;
    last = now;
  }
}

/**
 * The laboratory's SETTINGS fields.
 *
 * A text field is in scope when typing nonsense into it should be refused, which is true of a physical setting
 * and false of a free-text annotation. `[data-share-form]` was already excluded for that reason; the reader's
 * experiment recorder, added by 66296834, brought two more - `title` and `label`, the name and note a reader
 * gives a saved experiment - and they are prose, so nothing refuses them and nothing should.
 *
 * MEASURED, AND THIS SWEEP WAS RED FOR A DAY BECAUSE OF IT. It went from 34 pass / 0 fail at 71792960 to
 * 6 pass / 28 fail at 66296834, the next commit, and stayed red through 2026-10-06. Every failure was one of
 * these two fields reported as "silent" on nearly every lab, which is the sweep's own population having grown
 * rather than any lab regressing: the docblock above says "every text or number field", which was equivalent
 * to "every setting" only while every such field was one. The second failing assertion was the same cause -
 * `untyped` lost "sr-05", because a lab driven by buttons alone now had the recorder's text fields to type
 * into.
 *
 * The exclusion is by the recorder's own container attribute rather than by field name, so a renamed field
 * stays excluded and a new SETTING called `title` would not be.
 */
function fields(c: HTMLElement): HTMLInputElement[] {
  return [...c.querySelectorAll("input")].filter((i) => {
    const t = (i.getAttribute("type") ?? "text").toLowerCase();
    return (
      (t === "text" || t === "number") &&
      !i.readOnly &&
      !i.closest("[data-share-form]") &&
      !i.closest("[data-experiment-recorder]")
    );
  }) as HTMLInputElement[];
}
function state(c: HTMLElement) {
  const lab = c.querySelector("[data-instrument-id]");
  // A measurement change (BM-06's interval endpoints) leaves the input revision where it was, so a
  // lab that re-reads a fixed result says so on its own measurement-revision attributes. Without
  // them an accepted change of interval read as "silent" (dispatch 184).
  const measured = (name: string) => lab?.getAttribute(name) ?? "";
  return {
    accepted: `${
      lab?.getAttribute("data-accepted-input-revision") ??
      lab?.getAttribute("data-snapshot-version") ??
      ""
    }/${measured("data-accepted-measurement-revision")}`,
    requested: `${lab?.getAttribute("data-input-revision") ?? ""}/${measured("data-measurement-revision")}`,
    // THE CODE, NOT ONLY THE SENTENCE (am-ig23). `marked` below asks whether a refusal SAYS the shown
    // results are the last accepted. It cannot ask whether the refusal is identifiable, and that is the
    // half the flattening conversions exist to restore: a reason a reader can read and a code a gate can
    // find are two different obligations, and seven labs carried `data-apply-failure` with nothing
    // driving it.
    codes: [...c.querySelectorAll("[data-refusal-code]")]
      .map((e) => e.getAttribute("data-refusal-code") ?? "")
      .filter((x) => x !== ""),
    // `data-apply-failure` ONLY, for the conversion assertion. The first version keyed on
    // `data-refusal-code` and found fifteen labs, because the WORKER-refusal surface carries that
    // attribute too and has for some time - a true measurement of a different property. This attribute
    // is written only by the form-validation surface the am-ig23 conversions create, so it is the one
    // that can tell a converted lab from an unconverted one.
    applyFailures: [...c.querySelectorAll("[data-apply-failure]")]
      .map((e) => e.getAttribute("data-apply-failure") ?? "")
      .filter((x) => x !== ""),
    alerts: [...c.querySelectorAll('[role="alert"], .notice.error, .error, .form-error')]
      .map((e) => (e.textContent ?? "").trim())
      .filter(Boolean)
      .join(" | "),
    text: c.textContent ?? "",
  };
}

async function mount(route: string) {
  const mod = await import(resolve(APP, route, "page.tsx"));
  const out = mod.default({ params: Promise.resolve({}), searchParams: Promise.resolve({}) });
  const jsx = (out instanceof Promise ? await out : out) as ReactElement;
  const container = createContainer();
  const reactRoot = createRoot(container);
  await act(async () => {
    reactRoot.render(jsx);
  });
  await act(async () => {
    await pause();
  });
  for (const d of container.querySelectorAll("details")) (d as HTMLDetailsElement).open = true;
  await settle(container);
  return { container, reactRoot };
}

/** Types `value` into field `i` and submits; what changed. */
async function probe(c: HTMLElement, i: number, value: string) {
  const before = state(c);
  const el = fields(c)[i];
  if (!el) return { missing: true } as const;
  el.value = value;
  await act(async () => {
    props(el)?.onChange?.({ currentTarget: el, target: el });
  });
  const form = el.closest("form");
  const key = propsKey(el);
  const formProps =
    form && key
      ? (form as unknown as Record<string, Record<string, (e: unknown) => void>>)[key]
      : undefined;
  await act(async () => {
    if (formProps?.onSubmit)
      formProps.onSubmit({ preventDefault() {}, currentTarget: form, target: form });
    else {
      props(el)?.onBlur?.({ currentTarget: el, target: el });
      props(el)?.onKeyDown?.({ key: "Enter", currentTarget: el, target: el, preventDefault() {} });
    }
    await pause();
  });
  const after = state(c);
  return {
    missing: false,
    advanced: after.accepted !== before.accepted,
    requested: after.requested !== before.requested,
    // Only a refusal that appeared or changed for this value counts.
    refusal: after.alerts !== "" && after.alerts !== before.alerts,
    marked: KEPT.test(after.alerts),
    // Only a code that was not already on the page before this value: the worker-refusal surface can
    // carry one from an earlier state, and crediting that would make an unconverted lab look converted.
    coded: after.codes.filter((x) => !before.codes.includes(x)),
    applyFailed: after.applyFailures.length > before.applyFailures.length,
    raw: [...new Set(after.text.match(RAW) ?? [])].filter((h) => !before.text.includes(h)),
  } as const;
}

const routes = readdirSync(APP)
  .filter((d) => /^(bm|lq|me|sr)-\d\d$/.test(d))
  .sort();

describe("typing a value that is not a setting gets a refusal on every lab page", () => {
  beforeAll(async () => {
    await installDom();
  });
  afterAll(async () => {
    await uninstallDom();
  });

  const findings: Record<string, string[]> = {};
  const unmarked: Record<string, string[]> = {};
  let refusals = 0;
  let marked = 0;
  const codedRoutes = new Set<string>();
  const typedSurfaceRoutes = new Set<string>();
  const untyped: string[] = [];
  let typed = 0;

  for (const route of routes) {
    test(`${route}: each typed field refuses "abc", "" and ±1e300 outside its domain`, async () => {
      let page = await mount(route);
      // A mode can suffix the id ("me-03:box-1906"); the manifest is the lab's.
      const lab = (
        page.container.querySelector("[data-instrument-id]")?.getAttribute("data-instrument-id") ??
        route
      ).split(":")[0] as string;
      const domains = declaredDomains(lab);
      const found: string[] = [];
      const plain: string[] = [];
      const seen = new Set<string>();
      // Each mode a radio or a toggle button selects can show its own fields (ME-03's 1906 box), so
      // the sweep visits the page as mounted and then each such state, typing each field name once.
      const switches = (c: HTMLElement) =>
        [...c.querySelectorAll('input[type="radio"], button[aria-pressed]')] as Element[];
      const nameOf = (e: Element) =>
        `${e.tagName}:${(e.textContent ?? "").trim()}:${e.getAttribute("value") ?? ""}`;
      const modes = switches(page.container).map(nameOf);
      const enter = async (c: HTMLElement, mode: number) => {
        if (mode < 0) return;
        const target = switches(c).find((e) => nameOf(e) === modes[mode]);
        if (!target) return;
        await act(async () => {
          props(target)?.onChange?.({ currentTarget: target, target });
          props(target)?.onClick?.({ currentTarget: target, target, preventDefault() {} });
          await pause();
        });
        for (const d of c.querySelectorAll("details")) (d as HTMLDetailsElement).open = true;
        await settle(c);
      };
      for (let mode = -1; mode < modes.length; mode++) {
        await enter(page.container, mode);
        const n = fields(page.container).length;
        for (let i = 0; i < n; i++) {
          const el = fields(page.container)[i];
          const name = el?.getAttribute("name") || (el?.id ?? "").replace(/^.*-/, "") || `#${i}`;
          if (seen.has(name)) continue;
          seen.add(name);
          const d = domains[name];
          const initial = el?.value ?? "";
          for (const v of VALUES) {
            // A refusal left standing by the last value would read as this value's. Clear it by
            // applying the field's starting value again, else start from a fresh page in this mode.
            if (state(page.container).alerts) {
              await probe(page.container, i, initial);
              if (state(page.container).alerts) {
                await act(async () => {
                  page.reactRoot.unmount();
                });
                removeContainer(page.container);
                page = await mount(route);
                await enter(page.container, mode);
              }
            }
            const r = await probe(page.container, i, v);
            if (r.missing) continue;
            typed++;
            const openSide =
              (v === "1e300" && (!d || d.max === undefined)) ||
              (v === "-1e300" && (!d || d.min === undefined));
            const letThrough = r.advanced || r.requested;
            if (r.raw.length) found.push(`${name}=${JSON.stringify(v)}: shows ${r.raw.join(", ")}`);
            else if (letThrough && !openSide)
              found.push(`${name}=${JSON.stringify(v)}: let through`);
            else if (!letThrough && !r.refusal) found.push(`${name}=${JSON.stringify(v)}: silent`);
            if (!letThrough && r.refusal) {
              refusals++;
              if (r.marked) marked++;
              else plain.push(`${name}=${JSON.stringify(v)}`);
              // AFTER the pair above, not between them. Inserted in the middle, this statement stole the
              // `else` from `if (r.marked)` and `plain` then collected every refusal that carried no
              // code - 17 findings on bm-02 alone, a lab this change does not touch. A dangling else is
              // what an inserted line does to the construct it lands inside.
              if (r.coded.length > 0) codedRoutes.add(route);
              if (r.applyFailed) typedSurfaceRoutes.add(route);
            }
          }
        }
      }
      if (seen.size === 0) untyped.push(route);
      await act(async () => {
        page.reactRoot.unmount();
      });
      removeContainer(page.container);
      findings[route] = found;
      unmarked[route] = plain;
      if (UNFINISHED.includes(route)) expect(found.length).toBeGreaterThan(0);
      else expect(found).toEqual([]);
      if (UNMARKED.includes(route)) expect(plain.length).toBeGreaterThan(0);
      else expect(plain).toEqual([]);
    }, 120_000);
  }

  test("the sweep typed into fields (a floor, not a census)", () => {
    console.log(
      `[form sweep] ${typed} values typed; labs with no typed field: ${untyped.join(", ") || "none"}; labs with a finding: ${Object.entries(
        findings,
      )
        .filter(([, f]) => f.length)
        .map(([r]) => r)
        .join(
          ", ",
        )}; ${marked} of ${refusals} refusals say the results shown are the last accepted; labs whose refusals do not: ${Object.entries(
        unmarked,
      )
        .filter(([, f]) => f.length)
        .map(([r]) => r)
        .join(", ")}`,
    );
    console.log(
      `[form sweep] refusals carrying data-refusal-code, by lab: ${[...codedRoutes].sort().join(", ") || "NONE"}`,
    );
    expect(typed).toBeGreaterThan(400);
    // The mark is found somewhere, so a pattern that could never match would not pass as a clean run.
    expect(marked).toBeGreaterThan(0);
    // SR-05 is driven by buttons alone. Any other lab with nothing to type means the sweep lost it.
    expect(untyped).toEqual(["sr-05"]);
  });

  /**
   * THE TYPED REFUSAL SURFACE, DRIVEN (am-ig23).
   *
   * Seven laboratories render `data-refusal-code` and `data-apply-failure` on a refusal raised while
   * validating the form, and until now NOTHING asserted that any of them appears. The conversions were
   * verified by typecheck and by the suites staying green, which establishes that the code compiles and
   * not that a reader ever sees a code - the exact gap between a refusal existing and a refusal being
   * delivered.
   *
   * An EXACT SET rather than a count, for the same reason the flattening list is one: a lab that loses
   * its typed surface in a refactor fails here by name, and a lab that gains one fails too, which is
   * what makes adding it to this list a deliberate act. The list only grows as conversions land.
   *
   * The codes counted are only those NOT already on the page before the value was typed, so a
   * worker-refusal surface carrying one from an earlier state cannot make an unconverted lab read as
   * converted.
   */
  /**
   * The labs whose FORM-validation refusal renders the typed surface, measured 2026-10-06 by the sweep
   * above and written down afterwards, not predicted.
   *
   * Eleven, and they correspond one-for-one with the source files carrying `data-apply-failure`:
   * TracerLab (bm-01), WalkLab (bm-05), BrownianLab (bm-06), InferenceLab (bm-07), CameraLab (bm-08),
   * WaveDescriptionLab (lq-01), SpectrumLab (lq-03),
   * EntropyWorkbenchLab (lq-04), RodSimultaneityLab (sr-03), LorentzMapLab (sr-04) and
   * VelocityCompositionLab (sr-06). That correspondence is the point - it
   * says the attribute a reader's browser receives is the one the component declares, which neither a
   * typecheck nor a grep of the source can establish.
   *
   * THE LIST ONLY GROWS. A lab that loses its typed surface in a refactor fails here by name, and a lab
   * that gains one fails too, so adding a line is a deliberate act taken when a conversion lands rather
   * than a number that drifts.
   */
  const RECORDED_TYPED_SURFACE = [
    "bm-01",
    "bm-05",
    "bm-06",
    "bm-07",
    "bm-08",
    "lq-01",
    "lq-03",
    "lq-04",
    "sr-03",
    "sr-04",
    "sr-06",
  ];
  test("every lab converted to keep a typed refusal renders it to the reader", () => {
    console.log(
      `[form sweep] form-validation refusals carrying data-apply-failure, by lab: ${
        [...typedSurfaceRoutes].sort().join(", ") || "NONE"
      }`,
    );
    // Non-vacuity first: a selector that matched nothing would make the set below trivially equal to an
    // empty recorded list and read as a clean run.
    expect(typedSurfaceRoutes.size).toBeGreaterThan(0);
    expect([...typedSurfaceRoutes].sort()).toEqual(RECORDED_TYPED_SURFACE);
  });
});
