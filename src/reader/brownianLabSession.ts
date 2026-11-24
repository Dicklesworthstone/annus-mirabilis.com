import type { createBm01Session, PreparedBm01Example } from "../experiments/bm01/session.ts";

export type BrownianLabSession = ReturnType<typeof createBm01Session>;
export type SharedBrownianLab = Readonly<{
  session: BrownianLabSession;
  example: PreparedBm01Example;
  /** A stable view lease. Its visibility never overrides another visible view. */
  view(leaseId: string): BrownianLabSession;
  dispose(): void;
}>;

/**
 * One scientific owner, with independently mounted controls in the column, sheet and full lab.
 * Creating a facade does not acquire a lease: visibility effects do that after mounting. A
 * disconnected facade may reconnect, including React's setup/cleanup/setup in StrictMode.
 */
export function createBrownianLabSession(
  owner: BrownianLabSession,
  example: PreparedBm01Example,
): SharedBrownianLab {
  const leases = new Map<string, boolean>();
  const views = new Map<string, BrownianLabSession>();
  let disposed = false;
  const updateVisibility = () => {
    if (!disposed) owner.setSchedulingPaused(![...leases.values()].some((paused) => !paused));
  };
  updateVisibility();
  return Object.freeze({
    session: owner,
    example,
    view(leaseId: string) {
      const existing = views.get(leaseId);
      if (existing) return existing;
      const facade: BrownianLabSession = Object.freeze({
        ...owner,
        setSchedulingPaused(paused: boolean) {
          if (disposed) return;
          leases.set(leaseId, paused);
          updateVisibility();
        },
        disconnect() {
          if (disposed || !leases.delete(leaseId)) return;
          updateVisibility();
        },
      });
      views.set(leaseId, facade);
      return facade;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      leases.clear();
      owner.setSchedulingPaused(true);
      owner.disconnect();
    },
  });
}
