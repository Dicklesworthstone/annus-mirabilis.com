/**
 * Annus Mirabilis: Laboratory Concurrency Limits and Device Profiles
 *
 * Implements AGENTS.md "Worker behavior, memory, and lifecycle":
 * - Limit concurrent heavy laboratories to preserve thermal and memory headroom.
 * - Provisional defaults: 2 on desktop-class devices, 1 on mobile-class devices.
 * - Sourced locally from navigator.hardwareConcurrency and viewport width.
 * - Device telemetry is evaluated purely in-client and NEVER transmitted anywhere.
 */

export interface DeviceProfile {
  readonly isMobile: boolean;
  readonly maxConcurrentHeavyLabs: number;
  readonly hardwareConcurrency: number;
  readonly viewportWidth: number;
  readonly rationale: string;
}

/**
 * Detects device class and returns concurrency limit without transmitting any data.
 */
export function detectDeviceConcurrencyLimit(injected?: {
  hardwareConcurrency?: number;
  innerWidth?: number;
}): DeviceProfile {
  const cores =
    injected?.hardwareConcurrency ??
    (typeof navigator !== "undefined" ? (navigator.hardwareConcurrency ?? 4) : 4);

  const width = injected?.innerWidth ?? (typeof window !== "undefined" ? window.innerWidth : 1200);

  // Mobile heuristic: narrow viewport (< 768px) or constrained cores (<= 2)
  const isMobile = width < 768 || cores <= 2;

  if (isMobile) {
    return {
      isMobile: true,
      maxConcurrentHeavyLabs: 1,
      hardwareConcurrency: cores,
      viewportWidth: width,
      rationale: `Mobile/constrained device (viewport ${width}px, ${cores} cores): concurrency capped at 1 to prevent worker thrashing and WebGL context eviction.`,
    };
  }

  return {
    isMobile: false,
    maxConcurrentHeavyLabs: 2,
    hardwareConcurrency: cores,
    viewportWidth: width,
    rationale: `Desktop device (viewport ${width}px, ${cores} cores): concurrency capped at 2 to balance simultaneous inspection with CPU/battery efficiency.`,
  };
}
