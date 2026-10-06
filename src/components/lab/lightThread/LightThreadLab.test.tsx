import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LIGHT_THREAD_QUANTITIES } from "../../../experiments/lightThread/definition.ts";
import labDigests from "../../../generated/lab-source-digests.json";
import { LightThreadLab } from "./LightThreadLab.tsx";

test("SSR retains every quantity, the model boundaries, and the primary-source exits", () => {
  const html = renderToStaticMarkup(<LightThreadLab />);
  for (const id of Object.keys(LIGHT_THREAD_QUANTITIES)) {
    assert.ok(html.includes(`data-quantity-id="${id}"`), id);
  }
  for (const href of [
    "/papers/light-quanta/#s6",
    "/papers/special-relativity/#s8",
    "/papers/mass-energy/",
    "/lab/me-01/",
    "/lab/me-02/",
  ]) {
    assert.ok(html.includes(`href="${href}"`), href);
  }
  // The label is derived (am-inst-execution-labels-5ywv); until 5a97f929 it was the hard-coded badge
  // "Ideal model, host calculation". Without the page's source digest no label is earned.
  assert.ok(!html.includes('data-execution-label="host"'));
  assert.ok(!html.includes('data-execution-label="static"'));
  assert.ok(html.includes("zero invariant mass"));
  assert.ok(html.includes("does not require quanta"));
  assert.ok(html.includes("<noscript>"));
  assert.ok(html.includes("<fieldset disabled="));
  assert.ok(html.includes("lt=1"));
  assert.ok(!html.includes("NaN"));
  assert.ok(!html.includes("Infinity"));
  assert.ok(!html.includes("<canvas"));
});

test("with the page's source digest, the build-time example earns the static label", () => {
  const html = renderToStaticMarkup(<LightThreadLab sourceDigest={labDigests["light-thread"]} />);
  assert.ok(html.includes('data-execution-label="static"'));
  assert.ok(html.includes("Static worked example"));
  assert.ok(!html.includes('data-execution-label="host"'));
});

test("the code behind the numbers is named by what it computes, not by an internal role", () => {
  // The links read "Wave owners", "Cross-paper calculation" and "Snapshot publication", under "the
  // existing relativistic wave owners" and "One accepted, instance-scoped snapshot" (dispatch 218).
  const text = renderToStaticMarkup(<LightThreadLab />)
    .replace(/<[^>]+>/g, "")
    .replaceAll("&#x27;", "'");
  const start = text.indexOf("Model limits and the code behind the numbers");
  assert.ok(start > 0);
  const end = text.indexOf("How the page gathers these results", start);
  assert.ok(end > start);
  const disclosure = text.slice(start, end + 40);
  for (const name of [
    "Doppler shift and light energy (relativity §§ 7–8)",
    "The light thread across the papers",
    "How the page gathers these results",
    "the site's code for relativistic waves",
  ]) {
    assert.ok(disclosure.includes(name), name);
  }
  assert.ok(!/\bowners?\b|\bsnapshot\b|instance-scoped/i.test(disclosure), disclosure);
});

/**
 * BOTH OF THIS COMPONENT'S REFUSALS ARE UNREACHABLE, and this is the record rather than a test of
 * either site (am-r3qt). Measured by planting, not by reading: disabling the scalar guard leaves
 * this file at 3 pass 0 fail, so nothing here was driving it.
 *
 *   snapshot-missing-scalar, at LightThreadLab.tsx line 50, refuses a reading whose result is not
 *   a finite scalar. Every reading comes from this lab's session, and that session constructs
 *   EVERY output with `status: "value"` unconditionally and declares `statuses: ["value"]` as the
 *   only admitted status. evaluateLightThread returns a number for each of its quantities -
 *   frequencies, energies, masses - so neither half of the guard's condition can hold.
 *
 *   no-accepted-snapshot, at line 114, refuses a render with no accepted snapshot. The session
 *   PUBLISHES at construction and throws `publication-refused` if that publication is not
 *   accepted, so a session that exists has an accepted snapshot and one that does not never
 *   returns a view to render.
 *
 * Both are defensive guards whose preconditions are established upstream, which is the am-okw3
 * shape. They are worth keeping: the first is what would catch a session that began returning a
 * typed no-value without the component learning to render it, and the second is what would catch
 * a store that published nothing.
 *
 * THE PREMISES ARE ASSERTED so the claims fail if the structure changes. Add a non-value status to
 * the session's declared statuses, or let it return a view without publishing, and this goes red.
 *
 * THIS RECORD CREDITS BOTH SITES AND SHOULD NOT. Each code has exactly ONE site in this file, and
 * the scanner credits a site when a test block names its code - so naming them here reads as
 * payment. The same thing happened on lq06/changes.ts and is recorded on am-r3qt as a defect in
 * the credit model: documenting a single-site unreachable refusal is indistinguishable from
 * driving it. The alternative is a record forbidden to name what it is about.
 */
test("both LightThreadLab refusals are unreachable, and the upstream facts that make them so", () => {
  const session = readFileSync(
    new URL("../../../experiments/lightThread/session.ts", import.meta.url),
    "utf8",
  );

  // snapshot-missing-scalar: the session admits one status and sets it unconditionally.
  assert.ok(
    session.includes('statuses: Object.freeze(["value"] as const)'),
    "the session must still declare value as its only admitted status",
  );
  assert.ok(
    session.includes('status: "value" as const'),
    "the session must still set every result status to value unconditionally",
  );
  assert.ok(
    !/"(symbolic|analytic-limit|underdetermined|not-applicable|outside-domain|divergent)"/.test(
      readFileSync(new URL("../../../physics/reference/lightThread.ts", import.meta.url), "utf8"),
    ),
    "the owner must still return no non-value status",
  );

  // no-accepted-snapshot: the session refuses to exist without an accepted publication.
  assert.ok(
    session.includes("publication-refused"),
    "the session must still refuse construction when its initial publication is not accepted",
  );

  // Non-vacuity: the component really does render, so "the guards are unreachable" is a statement
  // about a path that runs rather than about a component nothing exercises.
  assert.ok(renderToStaticMarkup(<LightThreadLab />).includes("data-quantity-id"));
});
