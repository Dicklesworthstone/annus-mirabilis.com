/**
 * am-read-return-stack-oxa. The compass: a persistent, compact navigation landmark showing the
 * question being answered, the idea just opened, and a way back to the exact step. Hidden when no
 * clarification is open (renders nothing -- there is no landmark to relinquish space for when the
 * stack is empty). CSS (not tested here) is responsible for "never obscures content... relinquishes
 * space before hiding text, and moves below the passage at high zoom"; this component only owns
 * the content and the accessible structure.
 */
import type { StackFrame } from "./stackStore.ts";

export type CompassProps = Readonly<{
  frame: StackFrame | undefined;
  /** True when the frame just shown replaced the deepest frame at MAX_CLARIFICATION_DEPTH rather
   * than being pushed. The compass says so in words (this bead's Depth limit requirement). */
  depthLimitReplaced?: boolean;
  onReturn: () => void;
}>;

export function Compass({ frame, depthLimitReplaced = false, onReturn }: CompassProps) {
  if (!frame) return null;
  return (
    <nav aria-label="Your place in the argument" data-compass>
      <p data-compass-question>{frame.question}</p>
      <p data-compass-idea>{frame.title}</p>
      {depthLimitReplaced ? (
        <p data-compass-depth-limit>
          The deepest explanation was replaced; return to the argument is still available.
        </p>
      ) : null}
      <button type="button" data-compass-return onClick={onReturn}>
        Return to the exact step
      </button>
    </nav>
  );
}
