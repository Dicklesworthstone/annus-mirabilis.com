/**
 * A REFUSAL FROM ANOTHER LAB'S SCHEMA KEEPS ITS OWN CODE (am-ig23).
 *
 * `validateLightInvestigation` has its own range rules AND passes two other schemas' verdicts
 * through: `validateLq04Parameters` and `validateLq08Parameters`. It used to flatten the second kind
 * into a sentence and re-throw it as its own `ExperimentRuntimeError("parameters-rejected", ...)`,
 * so an lq-04 band-width refusal and a malformed settings record arrived downstream wearing the same
 * code, and the component then reduced even that to `e.message`. The refusal died twice.
 *
 * THE PAIR IS THE POINT. Converting a pass-through is only correct if the module's OWN rules are
 * left alone, and nothing in a one-sided test would notice if they had been swallowed too. So the
 * first two tests are a matched pair: an lq-04 refusal must arrive as a ParameterRefusalError
 * carrying lq-04's code, and this validator's own frequency rule must still raise its own
 * `parameters-rejected`. An implementation that converted everything passes the first and fails the
 * second.
 *
 * The third drives the reader's surface, because layer one alone delivers nothing: the code reaching
 * a catch is not the code reaching a page.
 *
 * The out-of-band value was found by probing rather than guessed. lq-04 admits a band width of
 * 10^9 to 10^14 Hz, so 0.0001 THz is below it, and the field is read in THz.
 */

import { afterAll, beforeAll, expect, test } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { ExperimentRuntimeError } from "../../experiments/refusal.ts";
import { ParameterRefusalError } from "../../experiments/results/applyFailure.ts";
import generated from "../../generated/light-quanta-investigation.json" with { type: "json" };
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { validateLightInvestigation } from "./investigation.ts";

const PAGE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../app/discover/light-quanta/investigate/page.tsx",
);
const pause = () => new Promise((r) => setTimeout(r, 5));
const base = (generated as { parameters: Record<string, number> }).parameters;

test("an lq-04 refusal arrives as a typed refusal carrying lq-04's own code", () => {
  // 1e8 Hz: below lq-04's admitted band of 10^9 to 10^14 Hz, and inside every rule this validator
  // checks itself, so it reaches the pass-through rather than being stopped earlier.
  let thrown: unknown;
  try {
    validateLightInvestigation({ ...base, bandwidth: 1e8 });
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toBeInstanceOf(ParameterRefusalError);
  const refusal = (thrown as ParameterRefusalError).refusal;
  expect(refusal.code).toBe("invalid-parameter");
  // The sentence a reader gets is lq-04's own, not this module's generic one.
  expect((thrown as Error).message).toContain("band width");
});

test("CONTRAST: this validator's OWN rule still raises its own parameters-rejected code", () => {
  // Without this, converting every branch would look like a success. 100 THz is below the
  // investigation's own stated 300 to 1200 THz range, which is this module's rule and not lq-04's.
  let thrown: unknown;
  try {
    validateLightInvestigation({ ...base, frequency: 1e14 });
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toBeInstanceOf(ExperimentRuntimeError);
  expect(thrown).not.toBeInstanceOf(ParameterRefusalError);
  expect((thrown as ExperimentRuntimeError).code).toBe("parameters-rejected");
});

let container: HTMLElement;
let reactRoot: ReturnType<typeof createRoot>;

beforeAll(async () => {
  await installDom();
  const mod = (await import(PAGE)) as { default: () => ReactElement | Promise<ReactElement> };
  const out = mod.default();
  const jsx = (out instanceof Promise ? await out : out) as ReactElement;
  container = createContainer();
  reactRoot = createRoot(container);
  await act(async () => {
    reactRoot.render(jsx);
  });
  await act(async () => {
    await pause();
  });
});

afterAll(async () => {
  await act(async () => {
    reactRoot.unmount();
  });
  removeContainer(container);
  await uninstallDom();
});

test("the reader's notice carries the code, not only the sentence", async () => {
  const field = container.querySelector('input[name="bandwidth"]') as HTMLInputElement | null;
  expect(field).not.toBeNull();
  // Non-vacuity in both directions: the page mounted, and it carries no refusal yet.
  expect(container.querySelectorAll("[data-apply-failure]").length).toBe(0);

  const input = field as HTMLInputElement;
  input.value = "0.0001";
  const propsKey = Object.keys(input).find((k) => k.startsWith("__reactProps$"));
  expect(propsKey).toBeDefined();
  const reactProps = (el: Element) =>
    propsKey
      ? (el as unknown as Record<string, Record<string, (e: unknown) => void>>)[propsKey]
      : undefined;
  await act(async () => {
    reactProps(input)?.onChange?.({ currentTarget: input, target: input });
  });
  const form = input.closest("form");
  expect(form).not.toBeNull();
  // The form is indexed by the INPUT's react key: React names these with one suffix per root and
  // `Object.keys` on a happy-dom <form> does not list it, so a lookup on the form itself returns
  // undefined for onSubmit and the submit silently never fires.
  const formProps = reactProps(form as Element);
  expect(typeof formProps?.onSubmit).toBe("function");
  await act(async () => {
    formProps?.onSubmit?.({ preventDefault() {}, currentTarget: form, target: form });
    await pause();
  });

  const alert = container.querySelector("[data-apply-failure]");
  expect(alert).not.toBeNull();
  expect(alert?.getAttribute("data-apply-failure")).toBe("refused");
  expect(alert?.getAttribute("data-refusal-code")).toBe("invalid-parameter");
  // aria-describedby must still resolve to this element, which is why both sources share one <p>.
  const described = container
    .querySelector("form[aria-describedby]")
    ?.getAttribute("aria-describedby");
  expect(described).toBe(alert?.getAttribute("id"));
  console.log(
    `[light investigation refusal] code="${alert?.getAttribute("data-refusal-code")}" describedby="${described}"`,
  );
});
