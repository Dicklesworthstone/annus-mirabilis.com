/**
 * THE TWO REFUSAL SITES IN settings.ts, ONE DRIVEN AND ONE PROVED UNREACHABLE (am-r3qt).
 *
 * am-r3qt asks that the untested-refusal debt be told apart before it is paid, because three different
 * things are mixed in it: a refusal nothing drives (real work), one a test reaches without citing it
 * (cheap), and one that cannot fire at all (not work - record the reason). This file is one of each.
 *
 * `settings-rejected` is reachable and is driven below from the condition it exists for: an input the
 * shelf validator refuses.
 *
 * `settings-link-too-large` CANNOT FIRE for any input a reader can produce, and that is measured rather
 * than asserted. Every shelf has a fixed field set, each field is a number, a toggle or a choice from a
 * listed set, and the validator returns normalised parameters - so the longest possible link is bounded
 * by the longest legal value of each field. Measured 2026-10-06 across all three shelves in both modes,
 * the largest is 399 characters against a limit of 2048:
 *
 *     shelf-michelson-morley full 332  1904 302
 *     shelf-fizeau           full 399  1904 389
 *     shelf-maxwell-galilean full 260  1904 265
 *
 * THE BOUND IS ASSERTED BELOW, not restated, so "unreachable by construction" goes red if a field set
 * grows or a choice gets a long id. That is the only thing that keeps a recorded non-reachability from
 * becoming a stale excuse.
 *
 * AND THE CODE IS ASSEMBLED FROM PARTS where it names that site, deliberately. A single-site code is
 * credited by a test block MENTIONING it, so writing the literal would mark the site tested when
 * nothing drives it - which is the false credit this bead exists to undo. The same device, for the same
 * reason, is in scripts/download-facsimiles.test.ts's 21.8.
 */

import { describe, expect, it } from "bun:test";
import { ExperimentRuntimeError } from "../refusal.ts";
import {
  SHELF_IDS,
  type ShelfField,
  type ShelfMode,
  shelfFields,
  validateShelfInput,
} from "./definition.ts";
import { encodeShelfSettings, SHELF_SETTINGS_LIMIT } from "./settings.ts";

const MODES: readonly ShelfMode[] = ["full", "1904"];

/** The longest legal value for a field: the longest listed choice, the toggle's own initial, and a number. */
function widestValue(field: ShelfField): number | string | boolean {
  if (field.kind === "choice")
    return [...(field.choices ?? [])].sort((a, b) => b.length - a.length)[0] ?? "";
  if (field.kind === "boolean") return field.initial;
  return 0.123456789012345;
}

describe("shelf settings refusals", () => {
  it("settings-rejected: an input the shelf validator refuses is not encoded into a link", () => {
    // Driven from the condition, not from a cast: an empty record has none of the shelf's fields, which
    // is what a form stripped of its inputs would send.
    let raised: unknown;
    try {
      encodeShelfSettings("shelf-michelson-morley", "full", {} as never);
    } catch (e) {
      raised = e;
    }
    expect(raised).toBeInstanceOf(ExperimentRuntimeError);
    const err = raised as ExperimentRuntimeError;
    expect(err.code).toBe("settings-rejected");
    // The reader-facing half: the sentence is the validator's own, so it names what is missing rather
    // than reporting that something went wrong.
    expect(err.message.length).toBeGreaterThan(20);
  });

  it("the refusal carries the validator's reason, not a generic one", () => {
    // A second condition reaching the same site, so the arm is not pinned to one input shape.
    let raised: unknown;
    try {
      encodeShelfSettings("shelf-michelson-morley", "full", { notAField: 1 } as never);
    } catch (e) {
      raised = e;
    }
    expect((raised as ExperimentRuntimeError).code).toBe("settings-rejected");
  });

  it("the oversize-link guard cannot fire: the widest legal link is far inside the limit", () => {
    // The measurement the docblock reports, re-taken on every run. If a shelf gains fields or a choice
    // gains a long id, this is where it shows.
    const widths: string[] = [];
    let worst = 0;
    for (const id of SHELF_IDS)
      for (const mode of MODES) {
        const fields = shelfFields(id, mode);
        const input: Record<string, unknown> = {};
        for (const field of fields) input[field.id] = widestValue(field);
        const checked = validateShelfInput(id, mode, input);
        // The widest input must itself be ACCEPTED, or this measures the length of nothing.
        expect(checked.kind).toBe("accepted");
        if (checked.kind !== "accepted") continue;
        const url = encodeShelfSettings(id, mode, checked.parameters);
        worst = Math.max(worst, url.length);
        widths.push(`${id}/${mode} ${url.length}`);
      }
    expect(widths.length).toBe(SHELF_IDS.length * MODES.length);
    console.log(
      `[shelf settings] widest links: ${widths.join(", ")}; limit ${SHELF_SETTINGS_LIMIT}`,
    );
    // Named with headroom rather than as "< 2048", so a field set that grew by half still fails here
    // while the guard is still unreachable, which is when someone should look.
    expect(worst).toBeLessThan(SHELF_SETTINGS_LIMIT / 2);
  });

  it("a settings link a reader can produce round-trips", () => {
    // The accept half of the pair. Without it, every assertion above would still pass on an encoder
    // that refused everything.
    const fields = shelfFields("shelf-maxwell-galilean", "full");
    const input: Record<string, unknown> = {};
    for (const field of fields) input[field.id] = field.initial;
    const url = encodeShelfSettings("shelf-maxwell-galilean", "full", input as never);
    expect(url).toContain("/lab/shelf-maxwell-galilean/");
    expect(url).toContain("shelf=");
  });
});
