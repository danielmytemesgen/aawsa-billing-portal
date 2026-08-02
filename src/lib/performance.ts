export function withPerformanceLogging<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (process.env.NODE_ENV === 'production') {
    return fn();
  }

  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return fn()
    .then((result) => {
      const durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start;
      console.info(`[perf] ${label}: ${durationMs.toFixed(2)}ms`);
      return result;
    })
    .catch((error) => {
      const durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start;
      console.error(`[perf] ${label} failed after ${durationMs.toFixed(2)}ms`, error);
      throw error;
    });
}
