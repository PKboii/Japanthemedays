export const TAU = Math.PI * 2;

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (v: number, a: number, b: number) => (b === a ? 0 : clamp((v - a) / (b - a), 0, 1));
export const smoothstep = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
export const smootherstep = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

/** 0→1→0 envelope over [a,b] with smooth fade-in/out edges */
export const window01 = (p: number, a: number, b: number, fi = 0.012, fo = 0.012) =>
  smoothstep(invLerp(p, a - fi, a)) * (1 - smoothstep(invLerp(p, b, b + fo)));

export const ramp = (p: number, a: number, b: number) => smoothstep(invLerp(p, a, b));

export const gauss = (x: number, c: number, w: number) =>
  Math.exp(-((x - c) * (x - c)) / (2 * w * w));

/** deterministic PRNG */
export function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type RGB = [number, number, number];

export function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const mixC = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

export const css = (c: RGB, a = 1) =>
  `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

export const scaleC = (c: RGB, f: number): RGB => [c[0] * f, c[1] * f, c[2] * f];

/** sample piecewise keyframes [[t, ...values], ...] with smoothstep easing between keys */
export function sampleKeys(keys: number[][], p: number): number[] {
  const n = keys.length;
  if (p <= keys[0][0]) return keys[0].slice(1);
  if (p >= keys[n - 1][0]) return keys[n - 1].slice(1);
  let i = 0;
  while (i < n - 2 && keys[i + 1][0] < p) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const u = smoothstep(invLerp(p, a[0], b[0]));
  const out: number[] = [];
  for (let j = 1; j < a.length; j++) out.push(lerp(a[j], b[j] ?? a[j], u));
  return out;
}

const hashN = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** cheap 1D value noise, continuous */
export function vnoise(x: number) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hashN(i), hashN(i + 1), u);
}

export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));
