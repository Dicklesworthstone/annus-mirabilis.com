/**
 * The help line under a seed field (dispatch 212). The label read "Trial seed (unsigned 64-bit
 * integer)", which names the number's type and not its use. A reader needs two things: what the
 * seed does, and what may be typed. The field names this line in aria-describedby, so a screen
 * reader reads it with the field. The range is the full unsigned 64-bit one the labs validate
 * (u64String.ts), written out.
 */

/** 2^64 - 1, the largest seed, grouped for reading. */
export const SEED_MAX_READABLE = "18,446,744,073,709,551,615";

export function SeedHelp({
  id,
  replays = "trial",
}: {
  /** The id the seed input names in aria-describedby. */
  readonly id: string;
  /** What the same seed brings back: "trial" by default, or the draws it seeds. */
  readonly replays?: string;
}) {
  return (
    <small id={id} className="fine">
      With the same settings, the same seed replays the same {replays}. Any whole number from 0 to{" "}
      {SEED_MAX_READABLE} works.
    </small>
  );
}
