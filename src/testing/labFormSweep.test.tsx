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
 * - no NaN or Infinity appears.
 * The one allowance: ±1e300 may be accepted in a field whose declared domain is open on that side,
 * or that declares none, as long as nothing raw appears. (In a real browser "abc" cannot be typed
 * into a number field and arrives as "", so both stand for the same reader.)
 *
 * UNFINISHED names the labs not yet fixed, a two-way ratchet like labDomainSweep's.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const APP = resolve(root, "src/app/lab");

const UNFINISHED: readonly string[] = [
  "bm-02",
  "bm-03",
  "bm-04",
  "bm-05",
  "bm-06",
  "bm-07",
  "lq-01",
  "lq-03",
  "lq-07",
  "lq-08",
  "lq-09",
  "me-02",
  "sr-02",
  "sr-03",
  "sr-04",
  "sr-07",
  "sr-09",
  "sr-10",
  "sr-11",
  "sr-13",
];

const VALUES = ["abc", "", "1e300", "-1e300"] as const;
const RAW = /\bNaN\b|\bInfinity\b|\[object |must be a finite number between/g;

function propsKey(el: Element): string | undefined {
  return Object.keys(el).find((k) => k.startsWith("__reactProps$"));
}
function props(el: Element): Record<string, ((...a: unknown[]) => void) | undefined> | undefined {
  const key = propsKey(el);
  return key ? (el as unknown as Record<string, Record<string, () => void>>)[key] : undefined;
}
const pause = () => new Promise((r) => setTimeout(r, 5));

function fields(c: HTMLElement): HTMLInputElement[] {
  return [...c.querySelectorAll("input")].filter((i) => {
    const t = (i.getAttribute("type") ?? "text").toLowerCase();
    return (t === "text" || t === "number") && !i.readOnly && !i.closest("[data-share-form]");
  }) as HTMLInputElement[];
}
function state(c: HTMLElement) {
  const lab = c.querySelector("[data-instrument-id]");
  return {
    accepted:
      lab?.getAttribute("data-accepted-input-revision") ??
      lab?.getAttribute("data-snapshot-version") ??
      "",
    requested: lab?.getAttribute("data-input-revision") ?? "",
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
          }
        }
      }
      if (seen.size === 0) untyped.push(route);
      await act(async () => {
        page.reactRoot.unmount();
      });
      removeContainer(page.container);
      findings[route] = found;
      if (UNFINISHED.includes(route)) expect(found.length).toBeGreaterThan(0);
      else expect(found).toEqual([]);
    }, 120_000);
  }

  test("the sweep typed into fields (a floor, not a census)", () => {
    console.log(
      `[form sweep] ${typed} values typed; labs with no typed field: ${untyped.join(", ") || "none"}; labs with a finding: ${Object.entries(
        findings,
      )
        .filter(([, f]) => f.length)
        .map(([r]) => r)
        .join(", ")}`,
    );
    expect(typed).toBeGreaterThan(400);
    // SR-05 is driven by buttons alone. Any other lab with nothing to type means the sweep lost it.
    expect(untyped).toEqual(["sr-05"]);
  });
});
