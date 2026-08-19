import { gauss, mixC, mulberry32, ramp, type RGB, hex, invLerp } from "./utils";

export const WORLD_W = 27200;

/* ------------------------------------------------- view state */
export interface SeasonMix {
  bloom: number;
  summer: number;
  autumn: number;
  winter: number;
  snow: number;
}

export interface View {
  w: number;
  h: number;
  dpr: number;
  time: number;
  dt: number;
  p: number;
  target: number;
  camX: number;
  camY: number;
  zoom: number;
  tod: number;
  night: number;
  light: number;
  season: SeasonMix;
  px: number;
  py: number;
  reduced: boolean;
  mobile: boolean;
  festival: number;
  fwActive: number;
  boy: {
    x: number;
    y: number;
    facing: number;
    faceT: number;
    phase: number;
    speed: number;
    wave: number;
    bow: number;
    lookUp: number;
    sit: number;
    basket: number;
  };
  world: WorldData;
  boom?: (strength: number) => void;
}

/* ------------------------------------------------- terrain */
export function terrainY(x: number) {
  let y = -8 * Math.sin(x * 0.00045 + 1.7) - 5 * Math.sin(x * 0.0013 + 0.5);
  y -= 22 * gauss(x, 8620, 340); // shrine hill
  y -= 92 * gauss(x, 26580, 320); // final overlook hill
  return y;
}

export const ROAD_X0 = 1400;
export const ROAD_X1 = 26200;

/* ------------------------------------------------- master timeline keys */
export const CAMERA_KEYS: number[][] = [
  [0.0, 620, -152, 1.34],
  [0.045, 1500, -128, 1.12],
  [0.06, 2150, -118, 1.02],
  [0.1, 3000, -112, 1.0],
  [0.118, 3230, -112, 1.06],
  [0.145, 3700, -110, 0.98],
  [0.17, 4550, -118, 0.94],
  [0.205, 5300, -120, 0.92],
  [0.228, 5980, -112, 1.0],
  [0.252, 6120, -112, 1.04],
  [0.272, 6800, -116, 0.98],
  [0.292, 7380, -118, 0.96],
  [0.316, 8150, -122, 0.97],
  [0.338, 8720, -128, 1.02],
  [0.356, 9350, -114, 0.98],
  [0.372, 9480, -116, 1.05],
  [0.398, 10250, -114, 0.97],
  [0.44, 10900, -118, 0.94],
  [0.48, 11650, -112, 0.98],
  [0.505, 11820, -112, 1.03],
  [0.535, 12500, -116, 0.96],
  [0.56, 13150, -122, 0.92],
  [0.6, 13950, -114, 0.97],
  [0.625, 14420, -110, 1.0],
  [0.655, 15050, -112, 0.95],
  [0.69, 15800, -116, 0.9],
  [0.72, 16450, -118, 0.94],
  [0.738, 16980, -150, 1.02],
  [0.762, 17150, -158, 1.04],
  [0.782, 17800, -120, 0.98],
  [0.82, 18800, -116, 0.95],
  [0.845, 19620, -112, 1.0],
  [0.868, 20200, -114, 0.97],
  [0.89, 20950, -118, 0.95],
  [0.915, 22000, -116, 0.94],
  [0.935, 23300, -114, 0.98],
  [0.952, 24300, -112, 1.0],
  [0.962, 24820, -112, 1.05],
  [0.978, 25500, -116, 1.0],
  [0.988, 26050, -132, 0.92],
  [1.0, 26520, -192, 0.8],
];

export const BOY_KEYS: number[][] = [
  [0, 1500], [0.045, 1900], [0.075, 2400], [0.1, 3050], [0.118, 3210],
  [0.135, 3245], [0.16, 4050], [0.185, 4520], [0.205, 4830], [0.228, 5900],
  [0.245, 6040], [0.252, 6085], [0.272, 6720], [0.292, 7330], [0.316, 8100],
  [0.338, 8680], [0.356, 9300], [0.368, 9430], [0.38, 9470], [0.398, 10200],
  [0.44, 10850], [0.48, 11620], [0.5, 11740], [0.505, 11775], [0.535, 12450],
  [0.56, 13100], [0.6, 13900], [0.625, 14380], [0.645, 14420], [0.655, 15000],
  [0.69, 15750], [0.72, 16400], [0.738, 16900], [0.762, 16965], [0.782, 17700],
  [0.82, 18750], [0.845, 19560], [0.86, 19645], [0.868, 20150], [0.89, 20900],
  [0.915, 21950], [0.935, 23250], [0.952, 24250], [0.962, 24780], [0.978, 25450],
  [0.988, 25980], [1, 26450],
];

/** p → time of day. 0 dawn · 0.25 noon · 0.5 sunset · 0.75 night · 1 dawn */
export const TOD_KEYS: number[][] = [
  [0, 0.0], [0.03, 0.04], [0.08, 0.1], [0.15, 0.16], [0.25, 0.22],
  [0.35, 0.26], [0.45, 0.32], [0.55, 0.38], [0.62, 0.48], [0.68, 0.58],
  [0.715, 0.66], [0.735, 0.74], [0.76, 0.78], [0.775, 0.8], [0.79, 0.97],
  [0.81, 0.03], [0.85, 0.12], [0.9, 0.22], [0.93, 0.3], [0.955, 0.42],
  [0.97, 0.5], [0.978, 0.6], [0.985, 0.995], [1.0, 0.1],
];

export function seasonMix(p: number): SeasonMix {
  const bloom = Math.min(1, ramp(p, 0.36, 0.42) * (1 - ramp(p, 0.52, 0.575)) + ramp(p, 0.972, 0.99) * 0.9);
  const summer = ramp(p, 0.53, 0.6) * (1 - ramp(p, 0.745, 0.79));
  const autumn = ramp(p, 0.76, 0.82) * (1 - ramp(p, 0.875, 0.915));
  const winter = ramp(p, 0.875, 0.915) * (1 - ramp(p, 0.965, 0.985));
  return { bloom, summer, autumn, winter, snow: winter };
}

export function nightAmount(tod: number) {
  return ramp(tod, 0.62, 0.74) * (1 - ramp(tod, 0.9, 1.0));
}

/* ------------------------------------------------- sky palette */
export const SKY_KEYS: { t: number; top: RGB; mid: RGB; hor: RGB }[] = [
  { t: 0.0, top: hex("#7ba3c9"), mid: hex("#e8c9a0"), hor: hex("#f2b98a") },
  { t: 0.1, top: hex("#79b4de"), mid: hex("#bfe0f0"), hor: hex("#eaf2e4") },
  { t: 0.28, top: hex("#6fb0e6"), mid: hex("#b5dcf4"), hor: hex("#e6f2ec") },
  { t: 0.42, top: hex("#69ace4"), mid: hex("#afd9f2"), hor: hex("#e2f0ea") },
  { t: 0.52, top: hex("#74a9d8"), mid: hex("#c4dcf0"), hor: hex("#f0e8d4") },
  { t: 0.6, top: hex("#7e9fc8"), mid: hex("#e8c290"), hor: hex("#f5b273") },
  { t: 0.68, top: hex("#5d6fa8"), mid: hex("#c98f7e"), hor: hex("#ee9e6b") },
  { t: 0.76, top: hex("#35497c"), mid: hex("#5a6c9e"), hor: hex("#b98472") },
  { t: 0.85, top: hex("#2c3d69"), mid: hex("#45598c"), hor: hex("#5e7099") },
  { t: 0.96, top: hex("#3e5488"), mid: hex("#7e88ac"), hor: hex("#c79a82") },
  { t: 1.0, top: hex("#7ba3c9"), mid: hex("#e8c9a0"), hor: hex("#f2b98a") },
];

export function skyAt(tod: number, winter: number) {
  let i = 0;
  while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1].t < tod) i++;
  const a = SKY_KEYS[i];
  const b = SKY_KEYS[i + 1];
  const u = invLerp(tod, a.t, b.t);
  const uu = u * u * (3 - 2 * u);
  const pale: RGB = [224, 233, 238];
  const w = winter * 0.38;
  const blend = (x: RGB, y: RGB): RGB => {
    const c = mixC(x, y, uu);
    return mixC(c, pale, w);
  };
  return { top: blend(a.top, b.top), mid: blend(a.mid, b.mid), hor: blend(a.hor, b.hor) };
}

/* ------------------------------------------------- world data */
export interface House {
  x: number; w: number; h: number;
  roof: "tile" | "thatch";
  wall: number; variant: number;
  noren?: string; smoke?: boolean; laundry?: boolean; lantern?: boolean;
  shop?: "bakery" | "tea" | "grocery" | "flower" | "veg" | "teahouse" | "house";
  awning?: string; balcony?: boolean;
}
export interface Tree { x: number; type: "cherry" | "maple" | "green" | "pine" | "willow"; s: number; seed: number }
export interface Npc {
  x: number; y: number; s: number;
  type: "elder" | "woman" | "man" | "farmer" | "shop" | "child" | "musician";
  act: string;
  scene: [number, number];
  path?: [number, number];
  speed: number; phase: number;
  greet?: { a: number; b: number; kind: "wave" | "bow" | "offer" };
  dir: 1 | -1; seed: number;
  pinwheel?: boolean; umbrella?: boolean;
}
export interface Foreground { x: number; kind: "grass" | "flower" | "branch" | "bush" | "fence"; par: number; s: number; seed: number; side?: 1 | -1 }
export interface Animal { kind: "cat" | "dog"; x: number; scene: [number, number]; act: string; seed: number }

export interface WorldData {
  houses: House[];
  trees: Tree[];
  poles: number[];
  npcs: Npc[];
  foreground: Foreground[];
  animals: Animal[];
  riverSegs: [number, number][];
  bridges: { x: number; span: number }[];
  paddySegs: [number, number][];
  vegSegs: [number, number][];
  flowerSegs: [number, number][];
  festivalPoles: number[];
  stalls: { x: number; stripe: number; kind: number }[];
  clouds: { bx: number; y: number; s: number; spd: number }[];
  stars: { x: number; y: number; s: number; tw: number }[];
}

const WALLS = ["#efe4cd", "#e6d8bd", "#cfa878", "#b98d63", "#dcc9a4"];

export function makeWorld(): WorldData {
  const rng = mulberry32(20240407);
  const houses: House[] = [];
  const trees: Tree[] = [];
  const poles: number[] = [];
  const npcs: Npc[] = [];
  const foreground: Foreground[] = [];
  const animals: Animal[] = [];

  let variant = 0;
  const H = (x: number, w: number, h: number, opts: Partial<House> = {}) => {
    houses.push({
      x, w, h,
      roof: opts.roof ?? (variant % 3 === 2 ? "thatch" : "tile"),
      wall: opts.wall ?? (variant % WALLS.length),
      variant,
      ...opts,
    });
    variant++;
  };

  /* --- village entrance (reused visually by the snowy village) */
  H(1620, 190, 118, { smoke: true, lantern: true });
  H(1930, 150, 100, { noren: "#7d9c78" });
  H(2250, 205, 122, { roof: "tile", laundry: true, wall: 0 });
  H(2590, 160, 104, { smoke: true, wall: 3 });
  /* --- elder street */
  H(2960, 200, 120, { roof: "thatch", smoke: true, lantern: true });
  H(3440, 165, 106, { wall: 2 });
  H(3790, 185, 112, { laundry: true, wall: 1 });
  /* --- shops */
  H(5710, 190, 116, { shop: "bakery", smoke: true, awning: "#d98f5f" });
  H(5990, 200, 120, { shop: "tea", noren: "#5b7f9e", lantern: true });
  H(6270, 185, 112, { shop: "grocery", wall: 2 });
  H(6560, 160, 104, { shop: "flower" });
  H(6760, 120, 92, { shop: "veg" });
  /* --- after station, shrine approach */
  H(7980, 170, 108, { wall: 1, lantern: true });
  /* --- spring village */
  H(9820, 190, 118, { smoke: true, wall: 0, laundry: true });
  H(10130, 160, 104, { noren: "#b9705f" });
  H(10470, 200, 120, { wall: 2, balcony: true } as House);
  H(10800, 170, 108, { smoke: true, wall: 4 });
  H(11080, 150, 100, { wall: 1 });
  /* --- summer houses */
  H(12550, 180, 112, { smoke: true, wall: 0 });
  H(13420, 165, 106, { laundry: true, wall: 2 });
  /* --- festival edge cottages */
  H(14980, 175, 110, { wall: 1, lantern: true });
  H(16480, 160, 104, { smoke: true, wall: 3 });
  /* --- autumn row */
  H(18100, 185, 114, { smoke: true, roof: "thatch", wall: 4 });
  H(18480, 155, 102, { wall: 2 });
  H(20220, 170, 108, { smoke: true, wall: 0 });
  /* --- snowy village (mirrors entrance variants) */
  H(22960, 190, 118, { smoke: true, lantern: true, wall: 0 });
  H(23270, 150, 100, { noren: "#7d9c78", wall: 1 });
  H(23590, 205, 122, { smoke: true, wall: 2, laundry: true });
  H(23930, 160, 104, { smoke: true, wall: 3 });
  /* --- teahouse */
  H(24620, 240, 128, { shop: "teahouse", noren: "#4f6d8c", lantern: true, smoke: true, wall: 0 });
  /* --- spring return */
  H(25520, 165, 106, { smoke: true, wall: 1 });
  H(25830, 150, 98, { wall: 4 });

  const tree = (x: number, type: Tree["type"], s = 1) =>
    trees.push({ x, type, s, seed: rng() * 100 });

  /* dawn vista, before the road begins */
  tree(620, "green", 1.1); tree(880, "cherry", 1.15); tree(1160, "green", 0.95); tree(1350, "cherry", 0.85);
  /* entrance & streets */
  tree(1520, "green", 1.15); tree(2120, "cherry", 0.9); tree(2450, "green", 0.85);
  tree(2830, "maple", 1.0); tree(3180, "green", 1.1); tree(3620, "cherry", 1.0);
  tree(3950, "green", 0.9);
  /* fields edges */
  tree(4030, "green", 1.05); tree(5560, "green", 1.2); tree(5660, "cherry", 0.8);
  /* shops */
  tree(6150, "green", 0.8); tree(6470, "cherry", 0.85);
  /* station + shrine */
  tree(7120, "green", 1.0); tree(7700, "pine", 0.9);
  tree(8060, "pine", 1.1); tree(8280, "pine", 0.95); tree(8500, "maple", 1.05);
  tree(8950, "pine", 1.15); tree(9120, "green", 1.0);
  /* river */
  tree(9220, "willow", 1.2); tree(9620, "willow", 1.0); tree(9760, "green", 0.9);
  /* spring village — cherries */
  tree(9900, "cherry", 1.25); tree(10260, "cherry", 1.1); tree(10600, "cherry", 1.35);
  tree(10950, "cherry", 1.0); tree(11150, "green", 0.9);
  /* picnic meadow */
  tree(11480, "cherry", 1.15); tree(11700, "cherry", 1.5); tree(12000, "cherry", 1.2);
  tree(12280, "green", 1.0);
  /* summer */
  tree(12450, "green", 1.2); tree(12980, "green", 0.95); tree(13700, "green", 1.1);
  tree(13820, "willow", 1.25); tree(14650, "willow", 1.1); tree(14950, "green", 1.0);
  tree(16350, "green", 1.1); tree(16550, "green", 0.9);
  /* fireworks bank */
  tree(17300, "green", 1.0); tree(17700, "willow", 1.05);
  /* autumn */
  tree(17950, "maple", 1.1); tree(18350, "maple", 0.95); tree(18750, "green", 1.0);
  tree(20250, "maple", 1.05);
  /* forest path — dense maples */
  for (let i = 0; i < 9; i++) tree(20500 + i * 128, i % 3 === 1 ? "green" : "maple", 1.05 + (i % 3) * 0.18);
  /* winter approach + snowy village */
  tree(21700, "green", 1.0); tree(22100, "maple", 0.9); tree(22650, "green", 1.1);
  tree(23130, "green", 1.0); tree(23450, "cherry", 0.9); tree(23800, "green", 1.15);
  tree(24150, "pine", 1.0);
  /* teahouse + return */
  tree(24400, "maple", 0.95); tree(25150, "pine", 1.05); tree(25350, "green", 0.9);
  tree(25700, "cherry", 1.05); tree(26050, "cherry", 1.2); tree(26250, "green", 1.0);

  /* poles along the road (skip wide field stretches) */
  for (let x = 1480; x <= 26100; x += 330) {
    const inField = (x > 4050 && x < 5500) || (x > 12500 && x < 13700) || (x > 18900 && x < 20100);
    if (!inField) poles.push(x);
  }

  let npcSeed = 1;
  const N = (n: Partial<Npc> & { x: number; scene: [number, number] }) =>
    npcs.push({
      y: -4, s: 0.92, type: "man", act: "stand", speed: 14, phase: rng() * 10, dir: 1,
      seed: npcSeed++, ...n,
    });

  /* entrance */
  N({ x: 2090, type: "elder", act: "sweep", scene: [0.045, 0.16] });
  N({ x: 2760, type: "woman", act: "water", scene: [0.055, 0.17] });
  N({ x: 3300, type: "elder", act: "stand", scene: [0.08, 0.175], greet: { a: 0.098, b: 0.14, kind: "wave" } });
  N({ x: 3600, type: "child", act: "walk", path: [3500, 3900], speed: 34, scene: [0.12, 0.2] });
  N({ x: 3740, type: "woman", act: "walk", path: [3690, 3880], speed: 10, scene: [0.12, 0.2] });
  N({ x: 3790, type: "man", act: "walk", path: [3740, 3930], speed: 10, phase: 3, scene: [0.12, 0.2] });
  /* fields */
  N({ x: 4700, y: -30, s: 0.82, type: "farmer", act: "work", scene: [0.15, 0.225], greet: { a: 0.172, b: 0.208, kind: "wave" } });
  N({ x: 5180, y: -30, s: 0.82, type: "farmer", act: "checkwater", scene: [0.16, 0.23] });
  /* shops */
  N({ x: 6010, type: "shop", act: "stand", scene: [0.21, 0.29], greet: { a: 0.226, b: 0.262, kind: "wave" } });
  N({ x: 5860, type: "woman", act: "walk", path: [5780, 5950], speed: 12, dir: -1, scene: [0.22, 0.285] });
  N({ x: 6340, type: "woman", act: "buy", scene: [0.22, 0.29] });
  N({ x: 6400, type: "shop", act: "sell", scene: [0.21, 0.3] });
  /* station */
  N({ x: 7310, y: -20, s: 0.88, type: "woman", act: "wait", scene: [0.268, 0.33] });
  N({ x: 7450, y: -20, s: 0.88, type: "man", act: "wait", phase: 2, scene: [0.268, 0.33] });
  /* shrine */
  N({ x: 8840, y: -34, s: 0.85, type: "elder", act: "pray", scene: [0.318, 0.368] });
  /* river */
  N({ x: 9500, s: 0.7, type: "child", act: "sit", scene: [0.34, 0.4], greet: { a: 0.354, b: 0.392, kind: "wave" } });
  /* spring village */
  N({ x: 10350, type: "man", act: "photo", scene: [0.398, 0.458] });
  N({ x: 10640, type: "woman", act: "walk", path: [10560, 10760], speed: 8, scene: [0.395, 0.46] });
  N({ x: 10690, type: "man", act: "walk", path: [10610, 10810], speed: 8, phase: 2.5, scene: [0.395, 0.46] });
  N({ x: 10930, type: "elder", act: "sit", scene: [0.4, 0.47] });
  N({ x: 10200, type: "child", act: "walk", path: [10050, 10650], speed: 40, scene: [0.39, 0.46], pinwheel: true });
  N({ x: 10500, type: "woman", act: "balcony", scene: [0.4, 0.45] });
  /* picnic */
  N({ x: 11590, type: "woman", act: "sit", scene: [0.465, 0.535], greet: { a: 0.49, b: 0.526, kind: "offer" } });
  N({ x: 11660, type: "man", act: "sit", phase: 2, scene: [0.465, 0.535] });
  N({ x: 11720, s: 0.68, type: "child", act: "sit", phase: 4, scene: [0.465, 0.535] });
  N({ x: 11930, type: "woman", act: "sit", phase: 1, scene: [0.47, 0.53] });
  N({ x: 11990, type: "woman", act: "sit", phase: 3.4, scene: [0.47, 0.53] });
  /* summer fields */
  N({ x: 13120, y: -30, s: 0.82, type: "farmer", act: "work", scene: [0.54, 0.615], greet: { a: 0.562, b: 0.594, kind: "wave" } });
  N({ x: 13480, s: 0.7, type: "child", act: "walk", path: [13380, 13600], speed: 26, scene: [0.56, 0.62] });
  /* summer river */
  N({ x: 14120, s: 0.7, type: "child", act: "splash", scene: [0.6, 0.655] });
  N({ x: 14200, s: 0.7, type: "child", act: "splash", phase: 2, scene: [0.6, 0.655] });
  /* festival */
  const festCrowd: [number, string, Npc["type"]][] = [
    [15260, "walk", "woman"], [15420, "walk", "man"], [15600, "stand", "elder"],
    [15750, "walk", "woman"], [15980, "stand", "man"], [16150, "walk", "man"],
    [16300, "stand", "woman"], [15330, "walk", "child"],
  ];
  festCrowd.forEach(([x, act, type], i) =>
    N({ x, type, act, path: act === "walk" ? [x - 90, x + 90] : undefined, speed: act === "walk" ? (type === "child" ? 30 : 9) : 0, phase: i * 1.7, scene: [0.65, 0.775], greet: i === 2 || i === 4 ? { a: 0.68 + i * 0.008, b: 0.71 + i * 0.008, kind: "wave" } : undefined }));
  N({ x: 15950, type: "musician", act: "music", scene: [0.66, 0.775] });
  N({ x: 15210, type: "shop", act: "sell", scene: [0.65, 0.775] });
  N({ x: 15810, type: "shop", act: "sell", scene: [0.65, 0.775] });
  N({ x: 16110, type: "shop", act: "sell", scene: [0.65, 0.775] });
  /* fireworks bank */
  N({ x: 17180, type: "woman", act: "lookup", scene: [0.725, 0.775] });
  N({ x: 17240, type: "man", act: "lookup", phase: 2, scene: [0.725, 0.775] });
  N({ x: 17290, s: 0.66, type: "child", act: "lookup", phase: 1, scene: [0.725, 0.775] });
  /* autumn */
  N({ x: 18320, type: "elder", act: "sweep", scene: [0.8, 0.865] });
  N({ x: 19250, y: -30, s: 0.82, type: "farmer", act: "work", scene: [0.8, 0.885] });
  N({ x: 19480, y: -30, s: 0.82, type: "farmer", act: "carry", path: [19380, 19700], speed: 12, scene: [0.8, 0.885] });
  N({ x: 19650, y: -26, s: 0.84, type: "farmer", act: "stand", scene: [0.8, 0.885], greet: { a: 0.836, b: 0.866, kind: "wave" } });
  N({ x: 19780, s: 0.66, type: "child", act: "carry", path: [19700, 19900], speed: 16, scene: [0.82, 0.88] });
  /* snowy village */
  N({ x: 23100, type: "elder", act: "shovel", scene: [0.915, 0.955] });
  N({ x: 23480, s: 0.68, type: "child", act: "snowplay", scene: [0.92, 0.96] });
  N({ x: 23560, s: 0.7, type: "child", act: "snowplay", phase: 2.4, scene: [0.92, 0.96] });
  N({ x: 23700, type: "woman", act: "walk", path: [23300, 24050], speed: 9, umbrella: true, scene: [0.915, 0.958] });

  animals.push(
    { kind: "cat", x: 2470, scene: [0.05, 0.2], act: "sit", seed: 3 },
    { kind: "cat", x: 8420, scene: [0.315, 0.37], act: "cross", seed: 5 },
    { kind: "dog", x: 6540, scene: [0.21, 0.32], act: "sit", seed: 7 },
    { kind: "cat", x: 21000, scene: [0.895, 0.93], act: "sit", seed: 3 },
    { kind: "cat", x: 23990, scene: [0.92, 0.965], act: "sit", seed: 3 },
  );

  /* foreground dressing */
  for (let x = 1350; x < 26300; x += 118) {
    foreground.push({ x: x + rng() * 60, kind: "grass", par: 1.14 + rng() * 0.14, s: 0.7 + rng() * 0.7, seed: rng() * 10 });
  }
  const branchAt = [1900, 4300, 8100, 10320, 13000, 17000, 20620, 23220, 25620];
  branchAt.forEach((x, i) =>
    foreground.push({ x, kind: "branch", par: 1.28, s: 0.9 + rng() * 0.5, seed: rng() * 10, side: i % 2 ? 1 : -1 }));
  const bushes = [1700, 3100, 6900, 9900, 15100, 18200, 22700, 25300];
  bushes.forEach((x) => foreground.push({ x, kind: "bush", par: 1.2, s: 0.8 + rng() * 0.6, seed: rng() * 10 }));
  foreground.push({ x: 1560, kind: "fence", par: 1.18, s: 1, seed: 0 });
  foreground.push({ x: 23320, kind: "fence", par: 1.18, s: 1, seed: 1 });

  const clouds = Array.from({ length: 8 }, () => ({
    bx: rng(), y: 0.08 + rng() * 0.24, s: 0.7 + rng() * 0.9, spd: 4 + rng() * 7,
  }));
  const stars = Array.from({ length: 120 }, () => ({
    x: rng(), y: rng() * 0.52, s: 0.6 + rng() * 1.4, tw: rng() * 10,
  }));

  return {
    houses, trees, poles, npcs, foreground, animals,
    riverSegs: [[9150, 9750], [13750, 15050], [16500, 17900]],
    bridges: [{ x: 9420, span: 160 }, { x: 14300, span: 180 }, { x: 17120, span: 150 }],
    paddySegs: [[60, 1330], [4050, 5550], [12450, 13750], [18850, 20150]],
    vegSegs: [[2700, 2880], [6680, 6830], [18500, 18700]],
    flowerSegs: [[2850, 3300], [9750, 11150], [25450, 26050]],
    festivalPoles: [15050, 15450, 15850, 16250, 16520],
    stalls: [
      { x: 15200, stripe: 0, kind: 0 }, { x: 15500, stripe: 1, kind: 1 },
      { x: 15800, stripe: 0, kind: 2 }, { x: 16100, stripe: 1, kind: 0 },
      { x: 16380, stripe: 0, kind: 1 },
    ],
    clouds, stars,
  };
}

/* train schedule (wall-clock based — the village lives on its own time) */
export function trainState(time: number) {
  const T = time % 48;
  const stationX = 7380;
  if (T < 10) {
    const u = T / 10;
    const e = 1 - (1 - u) * (1 - u);
    return { x: stationX + 1500 * (1 - e), doors: 0, visible: true, moving: true };
  }
  if (T < 20) return { x: stationX, doors: T > 11.5 && T < 18.5 ? 1 : 0, visible: true, moving: false };
  if (T < 30) {
    const u = (T - 20) / 10;
    return { x: stationX - 1700 * u * u, doors: 0, visible: true, moving: true };
  }
  return { x: -9999, doors: 0, visible: false, moving: false };
}
