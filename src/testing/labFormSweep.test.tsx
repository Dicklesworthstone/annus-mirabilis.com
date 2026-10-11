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
/**
 * A REFUSAL INSIDE THE PREDICT GATE IS A REFUSAL NOBODY RECEIVES (am-ig23).
 *
 * `html[data-detail] [data-predict-response="awaiting"]` is `display: none`, and happy-dom computes no
 * styles, so every assertion in this file reads a refusal that a real reader with an armed prediction
 * may not be able to see. That is how bm-08's staleness marking stayed hidden for three days under a
 * green suite. Containment is the property a layout engine is not needed for: a descendant cannot
 * un-hide itself from an ancestor's display:none.
 *
 * src/testing/predictGateHidesOnlyTheResponse.test.tsx asks the same question of the surfaces that
 * render unconditionally. These four render only once something has been refused, which is why they are
 * asked here, where a refusal has just been provoked.
 */
const GATE = '[data-predict-response="awaiting"]';
const REFUSAL_SURFACES = [
  ".notice.error",
  "[data-apply-failure]",
  "[data-refusal-code]",
  "[data-currency-state]",
].join(", ");

/**
 * `closest`, NOT a descendant combinator, and a plant is why.
 *
 * The first version of this read `querySelectorAll('[data-predict-response="awaiting"] .notice.error,
 * ...')`. Planting the defect by spreading `gate.response` ONTO WalkLab's own refusal notice left it
 * GREEN: a descendant combinator requires a gated ANCESTOR, so an element the gate hides by carrying the
 * attribute itself is the one case that form cannot see -- and `{...gate.response}` on the notice is the
 * likeliest way for this defect to be reintroduced, since that is how it is spread everywhere else.
 * `closest` includes the element itself, so both shapes are caught. Re-planted after the change, the
 * same one line on WalkLab's notice: 28 findings naming bm-05 and its four refusal codes, red by name,
 * restored byte-identically afterwards.
 */
function gatedRefusalSurfaces(c: HTMLElement): string[] {
  return [...c.querySelectorAll(REFUSAL_SURFACES)]
    .filter((e) => e.closest(GATE) !== null)
    .map(
      (e) =>
        `${e.className || e.tagName.toLowerCase()}[${
          e.getAttribute("data-refusal-code") ??
          e.getAttribute("data-currency-state") ??
          e.getAttribute("data-apply-failure") ??
          "-"
        }]`,
    );
}

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
    gated: gatedRefusalSurfaces(c),
    // THE STALENESS MARKING, BY LAB (am-m79c). `data-currency-state` has exactly one producer in
    // the repository -- CurrencyIndicator, reached through ExecutionChrome -- so a lab that renders
    // no chrome has no element a refusal can mark, and a reader of it is told WHY the settings were
    // refused and not that the numbers beside the message are from the previous ones.
    currencies: [...c.querySelectorAll("[data-currency-state]")]
      .map((e) => e.getAttribute("data-currency-state") ?? "")
      .filter((x) => x !== ""),
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
    gated: after.gated.filter((x) => !before.gated.includes(x)),
    // A `refused` currency that was not already on the page before this value: the worker-refusal
    // surface can carry one from an earlier state, and crediting that would make a lab with no
    // form-validation marking read as having one.
    currencyRefused: after.currencies.includes("refused") && !before.currencies.includes("refused"),
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
  /** Refusal surfaces that appeared INSIDE a predict-gated region, by lab (am-ig23). */
  const gatedRefusals: string[] = [];
  /** Labs whose FORM refusal marks the accepted readouts stale (am-m79c). */
  const currencyRoutes = new Set<string>();
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
              for (const g of r.gated) gatedRefusals.push(`${route}: ${g}`);
              if (r.currencyRefused) currencyRoutes.add(route);
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

  /**
   * THE REFUSAL A READER WITH AN ARMED PREDICTION ACTUALLY RECEIVES (am-ig23).
   *
   * Every refusal above was read out of a DOM with no styles, so "the reader sees a refusal" was an
   * inference from presence, not from visibility. This asserts the one thing presence cannot tell you:
   * that no refusal surface sits under an ancestor the predict gate hides. The sweep mounts each lab as
   * a first-time reader, so the gate is armed on every lab that asks -- which is the exact state the
   * defect needed and no earlier assertion here was in.
   */
  test("no refusal surface appears inside the predict-gated region", () => {
    console.log(
      `[census] predict-gate refusal visibility: ${refusals} refusal(s) provoked across ${routes.length} labs; ` +
        `${gatedRefusals.length} surface(s) inside a gated region${
          gatedRefusals.length ? `: ${gatedRefusals.join("; ")}` : ""
        }`,
    );
    // The denominator first: with no refusal provoked this assertion is about nothing.
    expect(refusals).toBeGreaterThan(0);
    expect(gatedRefusals).toEqual([]);
  });

  /**
   * WHICH LABS MARK THE ACCEPTED READOUTS STALE ON A FORM REFUSAL (am-m79c).
   *
   * `data-currency-state` has exactly ONE producer in the repository -- `CurrencyIndicator`, reached
   * through `ExecutionChrome` -- so a lab that renders no chrome has no element a refusal can mark,
   * and a reader of it is told WHY the settings were refused and NOT that the numbers beside the
   * message are from the previous settings. AGENTS.md: a refusal "freeze[s] the illegal step, show[s]
   * the reason, and keep[s] the last legal state", and keeping a state the reader cannot tell is
   * stale is two thirds of that.
   *
   * AN EXACT SET, for the reason the `data-apply-failure` list beside it is one: a lab that loses
   * its marking in a refactor fails here by name, and a lab that gains one fails too, so adding a
   * line is a deliberate act taken when the work lands.
   *
   * MEASURED 2026-10-10 AND IT WIDENS am-m79c's OWN FINDING. That bead records six labs with no
   * execution chrome at all, three of which refuse a form. This measures the labs whose FORM refusal
   * actually marks staleness, and there were SEVEN -- so of the 27 labs that do render a chrome, 20
   * did not pass it a `validationRefusal` and their form refusal marked nothing. Rendering the chrome
   * and marking a form refusal with it are different things, and only this set distinguishes them.
   *
   * GROWN FROM 7 TO 16 ON 2026-10-11, and the arithmetic is written out because a recorded set that
   * grows is the exact shape a weakened record also has. 13 files held a form failure in a local
   * `failure` state and never handed it to the chrome; each gained the one line WalkLab and CameraLab
   * already had. Those 13 files are 12 lab routes plus one discovery view that is not among the 33,
   * and 3 of the 12 (lq-03, lq-04, sr-04) were already in this set because their refusal reaches the
   * STORE rather than stopping at the form. So 12 - 3 = 9 new, and 7 + 9 = 16, which is what the
   * sweep now reports. If that subtraction does not close, the set was edited rather than earned.
   *
   * The 11 that still render a chrome and mark nothing have no form-failure state at all, so there is
   * nothing to pass; they are not an omission of this repair.
   *
   * THEN 16 TO 19 ON THE SAME DAY, closing am-m79c's criterion 1. bm-03, bm-07 and sr-03 refuse a
   * form and render no chrome at any position, so there was no element for a refusal to mark. Each
   * now mounts `CurrencyForView` beside the execution label it already writes by hand -- the currency
   * half alone, not the whole chrome, which would have added a model note and its layout to three
   * headings. Those three are asserted BY NAME below as well as through this set.
   */
  const RECORDED_STALENESS_MARKING = [
    "bm-01",
    "bm-03",
    "bm-04",
    "bm-05",
    "bm-06",
    "bm-07",
    "bm-08",
    "lq-01",
    "lq-03",
    "lq-04",
    "lq-05",
    "lq-06",
    "lq-07",
    "lq-08",
    "lq-09",
    "sr-03",
    "sr-04",
    "sr-06",
    "sr-07",
  ];
  /**
   * The three that mark a form refusal WITHOUT rendering an execution chrome (am-m79c criterion 1).
   *
   * Kept apart from the set above because the census line used to subtract that set's size from 27,
   * the number of chrome-rendering labs, and the two populations stopped being nested the moment
   * bm-03, bm-07 and sr-03 gained a standalone `CurrencyForView`. `27 - 19 = 8` was then an answer to
   * no question: of the 27 chrome labs, 19 - 3 = 16 mark, so 11 do not. A difference between two
   * populations that are not nested is the count error AGENTS.md puts first, and this is the version
   * of the line that cannot drift into it.
   */
  const MARKS_WITHOUT_A_CHROME = ["bm-03", "bm-07", "sr-03"];
  test("the labs whose form refusal marks the accepted readouts stale, by name (am-m79c)", () => {
    const withChrome = [...currencyRoutes].filter((r) => !MARKS_WITHOUT_A_CHROME.includes(r));
    console.log(
      `[census] form-refusal staleness marking: ${[...currencyRoutes].sort().join(", ") || "NONE"} ` +
        `(${currencyRoutes.size} of 33 labs: ${withChrome.length} of the 27 that render an execution ` +
        `chrome, so ${27 - withChrome.length} render one and mark nothing; plus ` +
        `${MARKS_WITHOUT_A_CHROME.filter((r) => currencyRoutes.has(r)).length} of the ` +
        `${MARKS_WITHOUT_A_CHROME.length} that mark one with no chrome at all)`,
    );
    // Non-vacuity first: a selector that matched nothing would make the set trivially equal to an
    // empty recorded list and read as a clean run.
    expect(currencyRoutes.size).toBeGreaterThan(0);
    expect([...currencyRoutes].sort()).toEqual(RECORDED_STALENESS_MARKING);
    // And the three chrome-less labs are IN it, asserted by name rather than left to the set above:
    // am-m79c's criterion 1 is about these three specifically, and a set equality says nothing about
    // which members mattered.
    for (const route of MARKS_WITHOUT_A_CHROME) {
      expect(currencyRoutes.has(route), `${route} refuses a form and must mark it`).toBe(true);
    }
  });

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
   * Seventeen as of 2026-10-09, and they correspond one-for-one with the source files carrying
   * `data-apply-failure`:
   * TracerLab (bm-01), ConfigurationLab (bm-03), DriftDiffusionLab (bm-04), WalkLab (bm-05), BrownianLab (bm-06), InferenceLab (bm-07), CameraLab (bm-08),
   * WaveDescriptionLab (lq-01), SpectrumLab (lq-03),
   * EntropyWorkbenchLab (lq-04), CoefficientMatchLab (lq-06), PhotoelectricLab (lq-08),
   * IonizationLab (lq-09), RodSimultaneityLab (sr-03), LorentzMapLab (sr-04),
   * VelocityCompositionLab (sr-06) and FieldEquationsLab (sr-07). That correspondence is the point - it
   * says the attribute a reader's browser receives is the one the component declares, which neither a
   * typecheck nor a grep of the source can establish.
   *
   * THE LIST ONLY GROWS. A lab that loses its typed surface in a refactor fails here by name, and a lab
   * that gains one fails too, so adding a line is a deliberate act taken when a conversion lands rather
   * than a number that drifts.
   */
  const RECORDED_TYPED_SURFACE = [
    "bm-01",
    "bm-03",
    "bm-04",
    "bm-05",
    "bm-06",
    "bm-07",
    "bm-08",
    "lq-01",
    "lq-03",
    "lq-04",
    "lq-06",
    "lq-08",
    "lq-09",
    "sr-03",
    "sr-04",
    "sr-06",
    "sr-07",
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
