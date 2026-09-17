/**
 * Spawn a real subprocess for e2e tests. Never falls back to an in-process call.
 * EBADF is retried (file-descriptor exhaustion under parallel runs); a persistent
 * EBADF fails with that cause named, so the proof class stays "subprocess".
 */

import { type SpawnSyncOptions, spawnSync } from "node:child_process";

export type ErrnoException = Error & { readonly code?: string };

export function isErrnoException(err: unknown): err is ErrnoException {
  return (
    err instanceof Error && "code" in err && typeof (err as { code?: unknown }).code === "string"
  );
}

export type ObservedSubprocess = Readonly<{
  kind: "subprocess";
  exitCode: number;
  stdout: string;
  stderr: string;
}>;

const EBADF_BACKOFF_MS = [50, 150, 350] as const;

function sleepMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function asText(value: string | Buffer | Uint8Array | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return new TextDecoder().decode(value);
}

export function spawnObserved(
  command: string,
  args: readonly string[],
  options: SpawnSyncOptions = {},
): ObservedSubprocess {
  const spawnOptions: SpawnSyncOptions = {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    ...options,
  };

  let lastError: Error | undefined;
  const attempts = EBADF_BACKOFF_MS.length + 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const proc = spawnSync(command, [...args], spawnOptions);
    if (!proc.error) {
      return {
        kind: "subprocess",
        exitCode: proc.status ?? (proc.signal ? 1 : 0),
        stdout: asText(proc.stdout),
        stderr: asText(proc.stderr),
      };
    }
    lastError = proc.error;
    const code = isErrnoException(proc.error) ? proc.error.code : undefined;
    if (code === "EBADF" && attempt < EBADF_BACKOFF_MS.length) {
      sleepMs(EBADF_BACKOFF_MS[attempt] ?? 50);
      continue;
    }
    const hint =
      code === "EBADF"
        ? " EBADF from spawn usually means file-descriptor exhaustion under a parallel test run. This e2e test requires a real subprocess and will not fall back to an in-process call."
        : "";
    throw new Error(
      `Failed to spawn ${command} ${args.join(" ")} (attempt ${attempt + 1}/${attempts}): ${proc.error.message}.${hint}`,
      { cause: proc.error },
    );
  }
  throw new Error(`Failed to spawn ${command}: ${lastError?.message ?? "unknown error"}`, {
    cause: lastError,
  });
}
