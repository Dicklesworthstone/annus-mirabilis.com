/**
 * THE INVESTIGATION PAGE'S REFUSAL IS DELIVERED, NOT JUST CONSTRUCTED (am-ig23).
 *
 * BrownianInvestigation.tsx flattened a typed refusal into a bare string in its own `apply()`, so a
 * reader who entered an inadmissible setting read a correct sentence and lost the three things
 * AGENTS.md's refusal contract asks for beside it: the code, the ranked repairs and the staleness
 * marking. The conversion keeps the whole refusal.
 *
 * WHY A SECOND TEST FILE RATHER THAN A CASE IN BrownianInvestigation.test.tsx. That file is a
 * `renderToStaticMarkup` server render, which cannot type into a field or submit a form, so it can
 * only ever assert what the page says on arrival. This one mounts the real page in happy-dom and
 * drives the form.
 *
 * AND WHY IT IS DRIVEN AT ALL, which is this bead's own lesson rather than a preference. Thirteen
 * lab conversions were verified by typecheck and by suites staying green, and the bead recorded the
 * result: "Seven laboratories render `data-apply-failure` ... and NOTHING in the repository asserted
 * that any of them ever appears. That establishes the code compiles. It does not establish that a
 * reader receives a code, which is the entire purpose of the bead." labFormSweep closed that gap for
 * the /lab/ pages by sweeping every lab route; this page is under /discover/ and no sweep reaches
 * it, so without this file the same gap would reopen here.
 *
 * The negative a wrong implementation fails: the assertion is on the CODE and the typed kind, not on
 * the sentence. The pre-conversion component rendered the same sentence with no attributes at all,
 * so a revert leaves the text identical and turns this red.
 */

import { afterAll, beforeAll, expect, test } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";

const PAGE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../app/discover/brownian-motion/investigate/page.tsx",
);
const pause = () => new Promise((r) => setTimeout(r, 5));

function propsKey(el: Element): string | undefined {
  return Object.keys(el).find((k) => k.startsWith("__reactProps$"));
}
function reactProps(
  el: Element,
  key = propsKey(el),
): Record<string, ((...a: unknown[]) => void) | undefined> | undefined {
  return key ? (el as unknown as Record<string, Record<string, () => void>>)[key] : undefined;
}

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

test("an inadmissible setting is refused with a code the reader's browser receives", async () => {
  // NON-VACUITY FIRST, in both directions. The page must mount with a bm-01 form and with NO
  // refusal on it: a container that failed to render, or one that already carried a code, would
  // make the assertions below pass while proving nothing.
  const field = container.querySelector('input[name="a"]') as HTMLInputElement | null;
  expect(field).not.toBeNull();
  expect(container.querySelectorAll("[data-apply-failure]").length).toBe(0);

  const input = field as HTMLInputElement;
  // A particle radius of 500 m is finite and parseable, so it reaches the model rather than being
  // stopped by the field's own number check. That matters: a value the form rejects locally would
  // exercise the string path this test is not about.
  input.value = "500000000";
  await act(async () => {
    reactProps(input)?.onChange?.({ currentTarget: input, target: input });
  });
  const form = input.closest("form");
  expect(form).not.toBeNull();
  // THE FORM IS INDEXED BY THE INPUT'S REACT KEY, not by its own. React names these properties with
  // one random suffix per root, and `Object.keys` on the <form> did not list it here: a lookup on
  // the form itself returned undefined for onSubmit, so the submit silently never fired and the test
  // failed reporting no refusal. labFormSweep's probe already does it this way; this is the same
  // reason.
  const key = propsKey(input);
  expect(key).toBeDefined();
  const formProps = reactProps(form as Element, key);
  expect(typeof formProps?.onSubmit).toBe("function");
  await act(async () => {
    formProps?.onSubmit?.({ preventDefault() {}, currentTarget: form, target: form });
    await pause();
  });

  const alert = container.querySelector("[data-apply-failure]");
  expect(alert).not.toBeNull();
  // The typed identity, which the flattened sentence could not carry.
  expect(alert?.getAttribute("data-apply-failure")).toBe("refused");
  const code = alert?.getAttribute("data-refusal-code") ?? "";
  expect(code.length).toBeGreaterThan(0);
  // A reader still gets a sentence, so the code did not replace the explanation.
  expect((alert?.textContent ?? "").trim().length).toBeGreaterThan(20);
  console.log(
    `[investigation refusal] data-apply-failure="${alert?.getAttribute("data-apply-failure")}" data-refusal-code="${code}"`,
  );
});
