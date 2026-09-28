/**
 * A MOTION SUPPRESSION THAT HIDES CONTENT IS A BUG, NOT AN ACCOMMODATION (am-a11y-reading-only-6wwd).
 *
 * The bead's own pitfall says reading-only "must never remove content; it defers cost and motion".
 * There is one way to break that with a one-line CSS change, and the codebase already contains the
 * shape it applies to.
 *
 * `.eq-explainer[data-explainer-filled="fetching"] .eq-explain-levels::before` says "Opening the
 * explanation." It starts at `opacity: 0` and is REVEALED by `eq-explain-waiting`, an animation
 * whose only job is to raise opacity to 1 after a deliberate 0.4s delay, so a fetch that lands
 * quickly shows nothing rather than a flash. Its `prefers-reduced-motion` companion therefore
 * writes BOTH `animation: none` AND `opacity: 1`. Drop the second declaration, or suppress the
 * animation from anywhere else without restoring opacity, and the sentence becomes permanently
 * invisible to exactly the readers the setting exists to serve.
 *
 * Measured 2026-09-28: one rule in the whole of src/ animates from `opacity: 0`, and it is guarded.
 * This test exists so the second one cannot arrive unguarded, and so that a blanket
 * `animation: none` under a new suppression selector is caught here rather than by a reader who
 * never sees the message.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(new URL("../../../", import.meta.url).pathname);

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return name.endsWith(".css") ? [path] : [];
  });
}

/** Comment bodies are blanked rather than removed, so a rule is never confused with prose about
 *  one and line positions do not move. */
function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length));
}

type Rule = { selector: string; body: string };

/** Every `selector { declarations }` pair, ignoring at-rule headers but keeping their contents. */
function rules(css: string): Rule[] {
  const out: Rule[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null = re.exec(css);
  while (m !== null) {
    const selector = (m[1] ?? "").trim().split("\n").pop()?.trim() ?? "";
    if (selector && !selector.startsWith("@")) out.push({ selector, body: m[2] ?? "" });
    m = re.exec(css);
  }
  return out;
}

describe("an animation that reveals content keeps a way to be revealed without it", () => {
  const files = cssFiles(resolve(ROOT, "src"));

  test("every rule revealed by an animation has a suppression companion that restores it", () => {
    expect(files.length).toBeGreaterThan(5);
    const revealed: string[] = [];
    const unguarded: string[] = [];
    for (const file of files) {
      const css = withoutComments(readFileSync(file, "utf8"));
      const all = rules(css);
      for (const rule of all) {
        const hidden = /(^|[;{\s])opacity:\s*0\s*(;|$)/.test(rule.body);
        const animated = /(^|[;{\s])animation:\s*[^;]*[a-zA-Z]/.test(rule.body);
        if (!hidden || !animated) continue;
        const where = `${relative(ROOT, file)} ${rule.selector}`;
        revealed.push(where);
        // The companion is any OTHER rule with the same selector that both stops the animation and
        // restores opacity. Matching on the selector rather than on the enclosing at-rule keeps this
        // true for a future suppression that is not `prefers-reduced-motion`.
        const companion = all.some(
          (other) =>
            other !== rule &&
            other.selector === rule.selector &&
            /animation:\s*none/.test(other.body) &&
            /opacity:\s*1/.test(other.body),
        );
        if (!companion) unguarded.push(where);
      }
    }
    console.log(
      `[reveal-animation] ${revealed.length} rules revealed by an animation across ${files.length} stylesheets; ${unguarded.length} without a restoring companion`,
    );
    // Non-vacuity on a measured count: one such rule exists (the equation explainer's "Opening the
    // explanation."). A run finding none means the scan broke, not that the risk went away.
    expect(revealed.length).toBeGreaterThanOrEqual(1);
    expect(unguarded).toEqual([]);
  });
});
