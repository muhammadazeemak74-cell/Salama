/**
 * Deterministic mulberry32 PRNG. Used instead of Math.random() for
 * generating particle geometry so component render stays pure — same
 * seed always produces the same "random-looking" layout.
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
