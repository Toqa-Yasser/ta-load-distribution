/** Returns a number in [0, 1). */
export type Rng = () => number;

/** mulberry32: small, fast, deterministic PRNG. */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}
