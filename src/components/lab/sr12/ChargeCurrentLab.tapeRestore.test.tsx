/**
 * AFTER A SHARED ?tape= LINK, DO THE TYPED BOXES SHOW THE RESTORED NUMBERS?
 *
 * SR-08, SR-12 and SR-13 each keep their form in two pieces: `draft`, the accepted parameter set,
 * and `typed`, the TEXT in the number inputs (`value={typed.boost}` and its siblings). Each
 * laboratory's own apply handler updates both, which is the authoritative pattern for "new
 * parameters were accepted":
 *
 *     setDraft(parameters);
 *     setTyped(typedFrom(parameters));
 *
 * Their `?tape=` restores updated only the first. A reader opening a shared link therefore saw the
 * restored RESULTS beside the PREVIOUS numbers in the boxes, and pressing "Apply trial settings"
 * without retyping would have sent the stale text back. SR-09 and SR-10 always called both, which
 * is how three labs sat wrong beside two that were right.
 *
 * Measured by this test before the repair: SR-12's inputs read `0.6 | 0.6 | 0 | 1` after restoring
 * a tape whose boost was 0.8c.
 *
 * WHAT IS ASSERTED, AND WHY IT IS SHAPED THIS WAY. Not "setTyped was called" -- that is the
 * implementation. Not the formatted text of a particular field either, because each laboratory
 * writes its own numbers and a test that knew all three formattings would break on a presentation
 * change that harms nobody. What a reader can tell apart is this: rendering WITH a restored tape
 * must put different text in the boxes than rendering WITHOUT one. Under the defect the two renders
 * were identical, because both showed the defaults.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { encodeTapePermalink } from "../../../experiments/permalink/codec.ts";
import {
  type LabTapeBinding,
  tapeForSettings,
} from "../../../experiments/permalink/sessionTape.ts";
import { SR08_DEFAULTS } from "../../../experiments/sr08/definition.ts";
import { DEFAULT_PREPARED_EXAMPLE as SR08_EXAMPLE } from "../../../experiments/sr08/session.ts";
import { SR08_TAPE } from "../../../experiments/sr08/tape.ts";
import { SR12_DEFAULTS } from "../../../experiments/sr12/definition.ts";
import { DEFAULT_PREPARED_EXAMPLE as SR12_EXAMPLE } from "../../../experiments/sr12/session.ts";
import { SR12_TAPE } from "../../../experiments/sr12/tape.ts";
import { SR13_DEFAULTS } from "../../../experiments/sr13/definition.ts";
import { DEFAULT_PREPARED_EXAMPLE as SR13_EXAMPLE } from "../../../experiments/sr13/session.ts";
import { SR13_TAPE } from "../../../experiments/sr13/tape.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../../testing/reactDom.ts";
import { FieldFrameChangeLab } from "../sr08/FieldFrameChangeLab.tsx";
import { ElectronDynamicsLab } from "../sr13/ElectronDynamicsLab.tsx";
import { ChargeCurrentLab } from "./ChargeCurrentLab.tsx";

const C_SI = 299_792_458;

/** The three laboratories that held their form text separately and restored only half of it. */
const LABS = [
  {
    id: "sr-08",
    Lab: FieldFrameChangeLab,
    binding: SR08_TAPE as LabTapeBinding,
    example: SR08_EXAMPLE,
    // A field component away from the default of 1, so the restored text cannot read like it.
    settings: { ...SR08_DEFAULTS, electricFieldY: 7 },
    // The text a typed box must carry afterwards. SR-08 shows this component as it is.
    expectInput: "7",
  },
  {
    id: "sr-12",
    Lab: ChargeCurrentLab,
    binding: SR12_TAPE as LabTapeBinding,
    example: SR12_EXAMPLE,
    settings: { ...SR12_DEFAULTS, boost: 0.8 * C_SI },
    // SR-12's box holds the boost as a fraction of c, which is why the setting above is 0.8c.
    expectInput: "0.8",
  },
  {
    id: "sr-13",
    Lab: ElectronDynamicsLab,
    binding: SR13_TAPE as LabTapeBinding,
    example: SR13_EXAMPLE,
    settings: { ...SR13_DEFAULTS, initialSpeed: 0.25 },
    // SR-13's initial speed is already a fraction of c, and its default is 0.6.
    expectInput: "0.25",
  },
] as const;

/** Every input's text after rendering the laboratory at `href`. */
async function inputsAfterRender(
  lab: (typeof LABS)[number],
  href: string,
): Promise<readonly string[]> {
  history.replaceState({}, "", href);
  const container = createContainer();
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(
        createElement(lab.Lab as never, {
          example: lab.example,
          restoreFromLocation: true,
        }),
      );
    });
    // The restore is a promise inside an effect, so let the microtasks settle.
    await act(async () => {
      await Promise.resolve();
    });
    return [...container.querySelectorAll("input")].map((i) => i.value);
  } finally {
    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  }
}

describe("restoring a shared tape link fills the typed boxes", () => {
  beforeEach(async () => {
    await installDom();
  });
  afterEach(async () => {
    await uninstallDom();
  });

  for (const lab of LABS) {
    test(`${lab.id}: the inputs follow the restored settings, not the defaults`, async () => {
      const tape = tapeForSettings(lab.binding, lab.settings);
      expect(tape, `${lab.id} refused a settings set it should accept`).not.toBeNull();
      if (!tape) return;
      const encoded = encodeTapePermalink(tape);

      const withoutTape = await inputsAfterRender(lab, `/lab/${lab.id}/`);
      const withTape = await inputsAfterRender(lab, `/lab/${lab.id}/?tape=${encoded}`);

      // Non-vacuity, twice: the form rendered inputs at all, and the same number both times, so
      // the comparison below is between two populated renders of one form.
      expect(withoutTape.length, `${lab.id} rendered no inputs`).toBeGreaterThan(0);
      expect(withTape.length).toBe(withoutTape.length);

      const changed = withTape.filter((v, i) => v !== withoutTape[i]);
      console.log(
        `[census] ${lab.id}: ${withTape.length} input(s), ${changed.length} changed by the restore`,
      );

      /*
       * THE ASSERTION IS ON THE RESTORED VALUE, NOT ON A COUNT OF CHANGES, and the weaker form is
       * worth recording because it read as careful and proved nothing. `changed.length > 0` was
       * measured against a worktree at the unfixed commit and PASSED on all three laboratories:
       * exactly one input changed anyway, a slider bound to `draft`, which was always restored.
       * The count moved from 1 to 2 or 3 with the repair, so a count would have had to pin a
       * per-laboratory number to be sensitive at all.
       *
       * So: a typed box must carry the restored number, and -- the half that makes it sensitive --
       * no box may carry it before the restore, which is also what catches a settings choice that
       * happens to equal a default.
       */
      const carries = (values: readonly string[]) =>
        values.some((v) => v.trim().startsWith(lab.expectInput));
      expect(
        carries(withoutTape),
        `${lab.id}: an input already showed ${lab.expectInput} WITHOUT the tape, so this settings choice cannot discriminate: [${withoutTape.join(" | ")}]`,
      ).toBe(false);
      expect(
        carries(withTape),
        `${lab.id}: no input shows the restored ${lab.expectInput}; inputs were [${withTape.join(" | ")}]`,
      ).toBe(true);
      // And the count is reported beside it rather than asserted.
      expect(changed.length).toBeGreaterThan(0);
    });
  }
});
