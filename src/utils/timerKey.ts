// Minimal, non-breaking instrumentation helpers
// These helpers wrap an existing profiler with start/stop(name: string) methods
// and enforce the L{level}-{path} naming convention with ':' as sub-path delimiter.

export type Profiler = {
  start: (name: string) => void;
  stop: (name: string) => void;
};

const DEFAULT_DELIMITER = ":";

// Replace spaces and trim; allow alphanumerics and :._- in final key
function sanitize(segment: string): string {
  return segment
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9:._-]/g, "");
}

export function makeKey(level: number, ...segments: string[]): string {
  const clean = segments.map(sanitize).filter(Boolean);
  const path = clean.join(DEFAULT_DELIMITER);
  return `L${level}-${path}`;
}

// L1 convenience with explicit step name (e.g., "Routing")
export function makeL1(stepName: string): string {
  return makeKey(1, stepName);
}

// Ensures start/stop pairing with try/finally
export function scopedTimer(profiler: Profiler, level: number, ...segments: string[]): () => void {
  const key = makeKey(level, ...segments);
  profiler.start(key);
  let stopped = false;
  return () => {
    if (!stopped) {
      stopped = true;
      profiler.stop(key);
    }
  };
}

// Syntactic sugar for L1 steps
export function stepTimer(profiler: Profiler, stepName: string): () => void {
  return scopedTimer(profiler, 1, stepName);
}

// Measures a function (sync/async) and returns its result
export async function withTimer<T>(
  profiler: Profiler,
  level: number,
  segments: string[] | string,
  fn: () => T | Promise<T>
): Promise<T> {
  const parts = Array.isArray(segments) ? segments : [segments];
  const stop = scopedTimer(profiler, level, ...parts);
  try {
    const result = fn();
    // Await if it's a Promise, otherwise return value directly
    return (result instanceof Promise) ? await result : (result as T);
  } finally {
    stop();
  }
}
