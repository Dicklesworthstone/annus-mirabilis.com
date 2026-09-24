/**
 * The work-energy lesson's before-and-after ledger, as pure logic.
 *
 * A steady push of force F through a distance d, along the motion, does work F·d on a body, and the
 * work becomes energy of motion: K_after = K_before + F·d, with K = ½mv² at everyday speeds. The
 * ledger also counts every energy from a zero the reader chooses. The totals move with that zero;
 * the work, the energy of motion, and the speed they give do not, because each is a difference.
 */

export const MASSES: readonly number[] = [2, 3];
export const START_SPEEDS: readonly number[] = [0, 1, 2];
export const FORCES: readonly number[] = [1, 3];
export const DISTANCES: readonly number[] = [1, 2, 4];
/** Where energy is counted from, in joules: any choice, since only differences are fixed. */
export const ZEROS: readonly number[] = [0, 100, 1_000_000];

export type LedgerInput = Readonly<{
  mass: number;
  startSpeed: number;
  force: number;
  distance: number;
  zero: number;
}>;

export type Ledger = Readonly<{
  /** Energy of motion before the push, ½mv², in joules. */
  before: number;
  /** Work done by the push, F·d, in joules. */
  work: number;
  /** Energy of motion after the push, in joules. */
  after: number;
  /** The speed that energy of motion gives, from ½mv² = K, in metres per second. */
  speedAfter: number;
  /** The same two energies counted from the chosen zero. */
  countedBefore: number;
  countedAfter: number;
}>;

export const kineticEnergy = (mass: number, speed: number) => 0.5 * mass * speed ** 2;

export function ledger({ mass, startSpeed, force, distance, zero }: LedgerInput): Ledger {
  const before = kineticEnergy(mass, startSpeed);
  const work = force * distance;
  const after = before + work;
  return {
    before,
    work,
    after,
    speedAfter: Math.sqrt((2 * after) / mass),
    countedBefore: zero + before,
    countedAfter: zero + after,
  };
}

/** A number of joules or metres per second as the lessons print it: at most two decimals, grouped. */
export function amount(value: number): string {
  const rounded = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
  const [whole, fraction] = rounded.split(".") as [string, string | undefined];
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}
