/**
 * CAN A READER PRESS PLAY, AND DOES IT PLAY?
 *
 * Seven laboratories gained a `WalkthroughControl` once their walkthrough records became carryable
 * in a link (f64267b03, which recorded the eleven checkpoint digests that had kept them out). The
 * component derives its own visibility from the published catalogue by experimentId, so mounting it
 * is not evidence that anything appears: a laboratory whose records do not convert renders nothing,
 * silently and correctly. That silence is exactly what this asserts against.
 *
 * THE PROPERTY, not a count per laboratory: EVERY button a laboratory offers must play. Pressing
 * it must report `data-walkthrough-result="played"`, never `"refused"`. That runs the whole chain a
 * reader depends on -- record, checkpoint digest, permalink conversion, published catalogue, mode,
 * compatibility, the laboratory's own validator, an accepted snapshot -- so a break anywhere in it
 * surfaces as a refusal code instead of a silent nothing. A refusing button is a worse outcome than
 * no button, which is why the component declines what it cannot play.
 *
 * NON-VACUITY IS ON THE CORPUS, so no laboratory is required to have a walkthrough. Six of the
 * seven offer one; ME-03 offers NONE, for two reasons that are both correct and neither of which a
 * count per laboratory could express:
 *
 *   `the-1906-box` is recorded in mode `me-03:box-1906` and this binding is `me-03:default`;
 *   `where-the-energy-went` has one event at action 1 and a checkpoint at action 3, and its own
 *   description names three boundary cases, so two events were never authored.
 *
 * Asserting "me-03 has no button" would be asserting a debt, and it would go red on the day
 * somebody finishes the record -- the opposite of what should happen. The floor below goes red if
 * the buttons disappear, and ME-03's button appears on its own when its record is complete.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_PREPARED_EXAMPLE as ME03_EXAMPLE } from "../../experiments/me03/session.ts";
import { DEFAULT_PREPARED_EXAMPLE as SR08_EXAMPLE } from "../../experiments/sr08/session.ts";
import { DEFAULT_PREPARED_EXAMPLE as SR09_EXAMPLE } from "../../experiments/sr09/session.ts";
import { DEFAULT_PREPARED_EXAMPLE as SR10_EXAMPLE } from "../../experiments/sr10/session.ts";
import { DEFAULT_PREPARED_EXAMPLE as SR11_EXAMPLE } from "../../experiments/sr11/session.ts";
import { DEFAULT_PREPARED_EXAMPLE as SR12_EXAMPLE } from "../../experiments/sr12/session.ts";
import { DEFAULT_PREPARED_EXAMPLE as SR13_EXAMPLE } from "../../experiments/sr13/session.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { BoundaryLedgerLab } from "./me03/BoundaryLedgerLab.tsx";
import { FieldFrameChangeLab } from "./sr08/FieldFrameChangeLab.tsx";
import { DopplerAberrationLab } from "./sr09/DopplerAberrationLab.tsx";
import { LightComplexLab } from "./sr10/LightComplexLab.tsx";
import { MovingMirrorLab } from "./sr11/MovingMirrorLab.tsx";
import { ChargeCurrentLab } from "./sr12/ChargeCurrentLab.tsx";
import { ElectronDynamicsLab } from "./sr13/ElectronDynamicsLab.tsx";

/** The laboratories mounted in this change, with the walkthroughs each is expected to offer. */
const LABS = [
  { id: "sr-08", Lab: FieldFrameChangeLab, example: SR08_EXAMPLE },
  { id: "sr-09", Lab: DopplerAberrationLab, example: SR09_EXAMPLE },
  { id: "sr-10", Lab: LightComplexLab, example: SR10_EXAMPLE },
  { id: "sr-11", Lab: MovingMirrorLab, example: SR11_EXAMPLE },
  { id: "sr-12", Lab: ChargeCurrentLab, example: SR12_EXAMPLE },
  { id: "sr-13", Lab: ElectronDynamicsLab, example: SR13_EXAMPLE },
  { id: "me-03", Lab: BoundaryLedgerLab, example: ME03_EXAMPLE },
] as const;

describe("a laboratory's recorded walkthrough is reachable and plays", () => {
  beforeEach(async () => {
    await installDom();
  });
  afterEach(async () => {
    await uninstallDom();
  });

  /** How many playable buttons each laboratory offered, filled in by the tests below. */
  const offered = new Map<string, number>();

  for (const lab of LABS) {
    test(`${lab.id}: every walkthrough button it offers plays`, async () => {
      const container = createContainer();
      const root = createRoot(container);
      try {
        await act(async () => {
          root.render(createElement(lab.Lab as never, { example: lab.example }));
        });

        const ids = [...container.querySelectorAll("button[data-walkthrough]")].map((b) =>
          b.getAttribute("data-walkthrough"),
        );
        offered.set(lab.id, ids.length);
        console.log(
          `[census] ${lab.id}: ${ids.length} walkthrough button(s): ${ids.join(", ") || "none"}`,
        );

        // EVERY button, not only the first: a laboratory with two walkthroughs must play both.
        for (const id of ids) {
          const button = container.querySelector<HTMLButtonElement>(
            `button[data-walkthrough="${id}"]`,
          );
          expect(button, `${lab.id}: button ${id} vanished between query and press`).not.toBeNull();
          if (!button) continue;
          await act(async () => {
            button.click();
          });
          await act(async () => {
            await Promise.resolve();
          });
          const result = container.querySelector("[data-walkthrough-result]");
          expect(result, `${lab.id}: pressing ${id} reported no outcome at all`).not.toBeNull();
          const code = result?.getAttribute("data-walkthrough-code");
          expect(
            result?.getAttribute("data-walkthrough-result"),
            `${lab.id}: ${id} was refused (${code ?? "no code"}): ${result?.textContent ?? ""}`,
          ).toBe("played");
        }
      } finally {
        await act(async () => {
          root.unmount();
        });
        removeContainer(container);
      }
    });
  }

  test("the corpus is non-vacuous: these laboratories offer playable walkthroughs", () => {
    // The floor. Every per-laboratory test above passes trivially if no button is ever rendered,
    // which is precisely the state these seven were in before f64267b03.
    const total = [...offered.values()].reduce((sum, n) => sum + n, 0);
    const withButton = [...offered.values()].filter((n) => n > 0).length;
    console.log(
      `[census] ${withButton} of ${LABS.length} laboratories offer a playable walkthrough; ${total} button(s) in all`,
    );
    expect(offered.size, "a laboratory test did not run").toBe(LABS.length);
    expect(withButton).toBeGreaterThanOrEqual(6);
    expect(total).toBeGreaterThanOrEqual(6);
  });
});
