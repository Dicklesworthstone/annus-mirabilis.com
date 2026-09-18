import { isMode1904 as isConstants1904 } from "../constants.ts";

/** 1904-mode surface guard. Owner of the full guard is am-ref-constants-xik. */

export class Mode1904GuardError extends TypeError {
  readonly code = "mode-1904-guard";
  constructor(surface: string) {
    super(`1904 mode cannot reach ${surface}.`);
    this.name = "Mode1904GuardError";
  }
}

let depth = 0;

export function isMode1904(): boolean {
  return depth > 0 || isConstants1904();
}

export function withMode1904Guard<T>(fn: () => T): T {
  depth += 1;
  try {
    return fn();
  } finally {
    depth -= 1;
  }
}

export function refuseModernSurface(surface: string): never {
  throw new Mode1904GuardError(surface);
}
