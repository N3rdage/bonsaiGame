// The one random generator the Inked kit draws with: every wobble, overshoot
// and bit of wear comes from a page's seed through it, so a rerun reproduces
// the committed PNGs byte for byte.

/** mulberry32: a small seeded generator, uniform in [0, 1). */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
