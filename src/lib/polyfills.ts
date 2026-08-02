/**
 * Polyfills for legacy browsers and older Android WebViews / OS versions.
 */

if (typeof window !== "undefined") {
  // Polyfill crypto.randomUUID
  if (typeof crypto !== "undefined" && !crypto.randomUUID) {
    (crypto as any).randomUUID = function randomUUID() {
      return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c: any) =>
        (
          c ^
          (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
        ).toString(16)
      );
    };
  }

  // Polyfill navigator.connection stub if completely missing
  if (!("connection" in navigator)) {
    (navigator as any).connection = {
      effectiveType: "4g",
      rtt: 50,
      downlink: 10,
      saveData: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
  }
}
