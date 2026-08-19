import { TAU, clamp, css, hex, mixC, window01, type RGB } from "./utils";
import type { Animal, Npc, SeasonMix, View } from "./world";

/* roundRect fallback for older browsers */
if (typeof CanvasRenderingContext2D !== "undefined" && !("roundRect" in CanvasRenderingContext2D.prototype)) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (CanvasRenderingContext2D.prototype as any).roundRect = function (
    x: number, y: number, w: number, h: number, r: number | number[],
  ) {
    const rr = Math.min(typeof r === "number" ? r : (r[0] ?? 0), w / 2, h / 2);
    this.moveTo(x + rr, y);
    this.arcTo(x + w, y, x + w, y + h, rr);
    this.arcTo(x + w, y + h, x, y + h, rr);
    this.arcTo(x, y + h, x, y, rr);
    this.arcTo(x, y, x + w, y, rr);
    this.closePath();
    return this;
  };
}

/* ------------------------------------------------------------------ person */
export interface PersonOpts {
  s: number;
  facing: number;
  phase: number;
  swing: number;
  top: RGB;
  bottom: RGB;
  hair: RGB;
  skin?: RGB;
  robe?: boolean;
  coat?: RGB | null;
  scarf?: RGB | null;
  hat?: "straw" | "band" | null;
  bun?: boolean;
  elder?: boolean;
  armLift?: number;
  armReach?: number;
  bow?: number;
  lookUp?: number;
  sit?: number;
  prop?: "broom" | "water" | "basket" | "cane" | null;
  umbrella?: boolean;
  pinwheel?: number;
  apron?: boolean;
}

const SKIN: RGB = [246, 203, 166];
const INK = "#40322a";

export function drawPerson(ctx: CanvasRenderingContext2D, x: number, y: number, o: PersonOpts) {
  const skin = o.skin ?? SKIN;
  const sit = o.sit ?? 0;
  const lift = o.armLift ?? 0;
  const reach = o.armReach ?? 0;
  const bow = o.bow ?? 0;
  const lookUp = o.lookUp ?? 0;
  const swing = o.swing * (1 - sit);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(o.s * o.facing, o.s);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const hipY = -24 + sit * 9;
  const footLift = (ph: number) => -Math.abs(Math.sin(ph)) * 2.6 * swing;

  /* legs */
  if (sit > 0.5) {
    ctx.strokeStyle = css(o.bottom);
    ctx.lineWidth = 3.8;
    ctx.beginPath();
    ctx.moveTo(-1, hipY); ctx.lineTo(8, -13); ctx.lineTo(7, -1);
    ctx.moveTo(2, hipY); ctx.lineTo(11, -13); ctx.lineTo(10, -1);
    ctx.stroke();
  } else if (!o.robe) {
    ctx.strokeStyle = css(o.bottom);
    ctx.lineWidth = 3.8;
    const f1 = Math.sin(o.phase) * 6.2 * swing;
    const f2 = Math.sin(o.phase + Math.PI) * 6.2 * swing;
    ctx.beginPath();
    ctx.moveTo(-2.4, hipY); ctx.lineTo(f1 - 2.4, footLift(o.phase));
    ctx.moveTo(2.4, hipY); ctx.lineTo(f2 + 2.4, footLift(o.phase + Math.PI));
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(f1 - 1.4, footLift(o.phase), 2.6, 1.4, 0, 0, TAU);
    ctx.ellipse(f2 + 3.4, footLift(o.phase + Math.PI), 2.6, 1.4, 0, 0, TAU);
    ctx.fill();
  } else {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(-2, -1, 2.4, 1.3, 0, 0, TAU);
    ctx.ellipse(3, -1, 2.4, 1.3, 0, 0, TAU);
    ctx.fill();
  }

  /* bow rotates the upper body around the hips */
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(bow * 0.5);
  ctx.translate(0, -hipY);

  const torsoColor = o.coat ?? o.top;

  /* torso */
  if (o.robe) {
    ctx.fillStyle = css(torsoColor);
    ctx.beginPath();
    ctx.moveTo(-6.5, -46);
    ctx.lineTo(6.5, -46);
    ctx.lineTo(10.5, -7);
    ctx.lineTo(-10.5, -7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = css(mixC(torsoColor, [0, 0, 0], 0.25), 0.8);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(4.5, -45);
    ctx.lineTo(6.5, -8);
    ctx.stroke();
  } else {
    ctx.fillStyle = css(torsoColor);
    ctx.beginPath();
    ctx.roundRect(-6.8, -47, 13.6, 24, 4.5);
    ctx.fill();
    if (o.coat) {
      ctx.strokeStyle = css(mixC(o.coat, [0, 0, 0], 0.3));
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -46); ctx.lineTo(0, -24);
      ctx.stroke();
    }
  }
  if (o.apron) {
    ctx.fillStyle = "rgba(240,231,210,0.95)";
    ctx.beginPath();
    ctx.roundRect(-5.4, -38, 10.8, 20, 2.5);
    ctx.fill();
  }
  if (o.scarf) {
    ctx.fillStyle = css(o.scarf);
    ctx.beginPath();
    ctx.roundRect(-5.6, -49, 11.2, 4.6, 2);
    ctx.fill();
    ctx.save();
    ctx.translate(3.4, -46);
    ctx.rotate(0.18 + Math.sin(o.phase * 0.5) * 0.06);
    ctx.beginPath();
    ctx.roundRect(-1.6, 0, 3.4, 9.5, 1.5);
    ctx.fill();
    ctx.restore();
  }

  /* arms */
  const shoulder = { x: 4.2, y: -43.5 };
  const hang = { x: 7.6, y: -25 };
  const up = { x: 12.5, y: -57.5 };
  const fwd = { x: 15.5, y: -35 };
  const waveWig = Math.sin(o.phase * 2.6) * 1.6 * lift;
  let hx = hang.x + (up.x - hang.x) * lift + (fwd.x - hang.x) * reach + waveWig;
  let hy = hang.y + (up.y - hang.y) * lift + (fwd.y - hang.y) * reach;
  // far arm (mostly hidden, slight idle)
  ctx.strokeStyle = css(mixC(torsoColor, [0, 0, 0], 0.16));
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(-shoulder.x, shoulder.y);
  ctx.quadraticCurveTo(-6.5, -34, -7.2 + Math.sin(o.phase + Math.PI) * 2 * swing, -25.5);
  ctx.stroke();
  // near arm
  ctx.strokeStyle = css(torsoColor);
  ctx.beginPath();
  ctx.moveTo(shoulder.x, shoulder.y);
  ctx.quadraticCurveTo((shoulder.x + hx) / 2 + 2.4, (shoulder.y + hy) / 2 - 1.5, hx, hy);
  ctx.stroke();
  ctx.fillStyle = css(skin);
  ctx.beginPath();
  ctx.arc(hx, hy, 2.1, 0, TAU);
  ctx.fill();

  /* props in the near hand */
  if (o.prop === "broom") {
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(0.42 + Math.sin(o.phase) * 0.22);
    ctx.strokeStyle = "#8a6b45";
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 26); ctx.stroke();
    ctx.strokeStyle = "#c9a55e";
    ctx.lineWidth = 1.1;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath(); ctx.moveTo(0, 24); ctx.lineTo(i * 1.7, 31); ctx.stroke();
    }
    ctx.restore();
  } else if (o.prop === "water") {
    ctx.fillStyle = "#7d9aa6";
    ctx.beginPath();
    ctx.roundRect(hx - 1, hy - 4, 9, 6.5, 1.5);
    ctx.fill();
    ctx.strokeStyle = "#7d9aa6";
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(hx + 8, hy - 2.4); ctx.lineTo(hx + 12.5, hy - 4.6); ctx.stroke();
    ctx.fillStyle = "rgba(150,200,235,0.85)";
    for (let i = 0; i < 3; i++) {
      const drop = (o.phase * 9 + i * 5.2) % 13;
      ctx.globalAlpha = 1 - drop / 13;
      ctx.beginPath();
      ctx.arc(hx + 13 + i * 1.4, hy - 4 + drop, 0.9, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (o.prop === "basket") {
    ctx.fillStyle = "#c99a5e";
    ctx.beginPath();
    ctx.moveTo(hx - 5, hy);
    ctx.lineTo(hx + 5, hy);
    ctx.lineTo(hx + 3.4, hy + 7);
    ctx.lineTo(hx - 3.4, hy + 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#a87f45";
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(hx - 4.4, hy + 2.4); ctx.lineTo(hx + 4.4, hy + 2.4); ctx.stroke();
  } else if (o.prop === "cane") {
    ctx.strokeStyle = "#8a6b45";
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + 2.4, 0); ctx.stroke();
  }
  if (o.pinwheel !== undefined) {
    ctx.save();
    ctx.translate(hx + 1, hy - 2);
    ctx.strokeStyle = "#8a6b45";
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -13); ctx.stroke();
    ctx.translate(0, -13);
    const cols = ["#d96a5a", "#e8c25e", "#6aa0a8", "#efe4cf"];
    for (let k = 0; k < 4; k++) {
      ctx.save();
      ctx.rotate(o.pinwheel + (k * Math.PI) / 2);
      ctx.fillStyle = cols[k];
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(4.5, -2, 6.5, 0.5);
      ctx.quadraticCurveTo(3.5, 2.4, 0, 0);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  if (o.umbrella) {
    ctx.strokeStyle = "#7a5c3e";
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(2, -66); ctx.stroke();
    ctx.fillStyle = "#c96f5e";
    ctx.beginPath();
    ctx.ellipse(2, -66, 17, 7.5, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#b45f50";
    ctx.beginPath();
    ctx.ellipse(2, -66, 17, 2.6, 0, 0, Math.PI);
    ctx.fill();
  }

  /* head */
  const headY = -53.5 - lookUp * 1.6;
  ctx.save();
  ctx.translate(0, headY);
  ctx.rotate(-lookUp * 0.32 + bow * 0.18);
  ctx.fillStyle = css(skin);
  ctx.beginPath();
  ctx.arc(0, 0, 7.1, 0, TAU);
  ctx.fill();
  ctx.fillStyle = css(o.hair);
  ctx.beginPath();
  ctx.arc(0, -1.2, 7.25, Math.PI * 0.92, Math.PI * 2.08);
  ctx.fill();
  if (o.bun) {
    ctx.beginPath();
    ctx.arc(-6.2, -3.6, 2.9, 0, TAU);
    ctx.fill();
  }
  if (o.elder) {
    ctx.strokeStyle = css(o.hair);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-5, -2); ctx.lineTo(-6.6, 1.4);
    ctx.moveTo(5.4, -2.6); ctx.lineTo(6.8, 0.4);
    ctx.stroke();
  }
  // face (kept tiny and warm)
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(2.5, -0.4 - lookUp * 0.8, 0.82, 0, TAU);
  ctx.arc(5.3, -0.4 - lookUp * 0.8, 0.82, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(64,50,42,0.75)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(3.9, 1.9, 1.7, Math.PI * 0.15, Math.PI * 0.75);
  ctx.stroke();
  if (o.hat === "straw") {
    ctx.fillStyle = "#dcbd72";
    ctx.beginPath();
    ctx.ellipse(0, -5.4, 11, 3.4, -0.06, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -7.2, 6.6, 4, 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = "#a8834e";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, -5.6, 6.7, 1.9, -0.06, 0, Math.PI);
    ctx.stroke();
  } else if (o.hat === "band") {
    ctx.fillStyle = "#e8e0cc";
    ctx.beginPath();
    ctx.roundRect(-6.6, -6.4, 13.2, 2.6, 1);
    ctx.fill();
  }
  ctx.restore(); // head

  ctx.restore(); // bow
  ctx.restore(); // person
}

/* ------------------------------------------------------------------ seasonal colour blending */
function blend(pal: { sp: string; su: string; au: string; wi: string }, m: SeasonMix): RGB {
  let c = mixC(hex(pal.sp), hex(pal.su), m.summer);
  c = mixC(c, hex(pal.au), m.autumn);
  c = mixC(c, hex(pal.wi), m.winter);
  return c;
}

export function boyFrame(v: View): PersonOpts {
  const m = v.season;
  const b = v.boy;
  const top = blend({ sp: "#6fa3a0", su: "#e9dfc2", au: "#c9854a", wi: "#54748f" }, m);
  const bottom = blend({ sp: "#71808f", su: "#8a97a3", au: "#7a6a58", wi: "#4a5568" }, m);
  return {
    s: 1.0,
    facing: b.facing,
    phase: b.phase,
    swing: clamp(Math.abs(b.speed) / 55, 0, 1) * (1 - b.sit),
    top,
    bottom,
    hair: hex("#4a3a30"),
    hat: "straw",
    coat: m.winter > 0.35 ? blend({ sp: "#54748f", su: "#54748f", au: "#54748f", wi: "#3f5a72" }, m) : null,
    scarf: m.winter > 0.35 ? hex("#cf5a40") : null,
    armLift: b.wave,
    bow: b.bow,
    lookUp: b.lookUp,
    sit: b.sit,
    prop: b.basket > 0.5 ? "basket" : null,
  };
}

const NPC_TOPS: Record<Npc["type"], { sp: string; su: string; au: string; wi: string }> = {
  elder: { sp: "#8a8f7a", su: "#97a08a", au: "#948468", wi: "#6f7585" },
  woman: { sp: "#b0788a", su: "#a8789a", au: "#a86f5e", wi: "#8a6f85" },
  man: { sp: "#7a8a6f", su: "#6f9484", au: "#8a7a55", wi: "#5f6f85" },
  farmer: { sp: "#9aa86f", su: "#8aa85f", au: "#a8944f", wi: "#7a8468" },
  shop: { sp: "#6f8aa0", su: "#5f8aa8", au: "#7a7f94", wi: "#5a6f8f" },
  child: { sp: "#d98a6a", su: "#e89a5e", au: "#cf7f4f", wi: "#b06a5e" },
  musician: { sp: "#4f6a8f", su: "#456f9a", au: "#5a6a85", wi: "#4a5a7a" },
};

export function npcFrame(n: Npc, v: View): (PersonOpts & { x: number; y: number; alpha: number }) | null {
  const alpha = window01(v.p, n.scene[0], n.scene[1]);
  if (alpha < 0.02) return null;

  let x = n.x;
  let facing = n.dir;
  const walking = !!n.path && n.speed > 0 && !["sit"].includes(n.act);
  if (n.path) {
    const [x0, x1] = n.path;
    const span = Math.max(1, x1 - x0);
    const u = ((v.time * n.speed) / span / 2 + n.phase) % 2;
    const uu = u < 1 ? u : 2 - u;
    x = x0 + uu * span;
    facing = u < 1 ? 1 : -1;
  }

  const greetEnv = n.greet ? window01(v.p, n.greet.a, n.greet.b) : 0;
  if (greetEnv > 0.05 && n.greet?.kind !== "offer") facing = v.boy.x > x ? 1 : -1;

  const m = v.season;
  const top = blend(NPC_TOPS[n.type], m);
  const bottom = blend({ sp: "#5f646e", su: "#66707a", au: "#6a5f50", wi: "#4a5060" }, m);
  const hairColor = n.type === "elder" ? hex("#c9c4ba") : hex(n.type === "child" ? "#5a4632" : "#43352c");
  const isWoman = n.type === "woman" || (n.type === "elder" && n.seed % 2 === 0);
  const winterCoat = m.winter > 0.35 ? mixC(top, hex("#5a6070"), 0.55) : null;

  const o: PersonOpts & { x: number; y: number; alpha: number } = {
    x, y: n.y, alpha,
    s: n.s * (n.type === "child" ? 0.74 : 1),
    facing,
    phase: v.time * n.speed * 0.16 + n.phase * 3,
    swing: walking ? 0.9 : 0.12,
    top,
    bottom,
    hair: hairColor,
    robe: isWoman || n.type === "elder",
    elder: n.type === "elder",
    bun: isWoman,
    coat: winterCoat,
    scarf: m.winter > 0.35 && n.seed % 2 === 0 ? hex("#b05540") : null,
    hat: n.type === "farmer" ? "straw" : n.type === "musician" ? "band" : null,
    apron: n.type === "shop",
  };

  switch (n.act) {
    case "sweep":
      o.prop = "broom"; o.swing = 0.25; o.armReach = 0.55;
      o.phase = v.time * 3.4 + n.phase;
      break;
    case "shovel":
      o.prop = "broom"; o.swing = 0.3; o.armReach = 0.6; o.phase = v.time * 2.6 + n.phase;
      break;
    case "water":
      o.prop = "water"; o.armReach = 0.75; o.swing = 0.1; o.phase = v.time * 1.2;
      break;
    case "work":
      o.bow = 0.55 + Math.sin(v.time * 1.1 + n.phase) * 0.2;
      o.armReach = 0.6; o.swing = 0;
      break;
    case "checkwater":
      o.bow = 0.4; o.armReach = 0.3; o.swing = 0;
      break;
    case "carry":
      o.prop = "basket"; o.armLift = 0.12;
      break;
    case "sit":
      o.sit = 1; o.swing = 0; o.phase = v.time * 0.6 + n.phase;
      break;
    case "wait":
      o.swing = 0.06 + Math.sin(v.time * 0.9 + n.phase) * 0.04;
      o.phase = v.time * 0.8;
      break;
    case "photo":
      o.armLift = 0.72; o.armReach = 0.4; o.swing = 0.05;
      break;
    case "buy":
    case "sell":
      o.armReach = 0.45 + Math.sin(v.time * 1.6 + n.phase) * 0.12;
      o.swing = 0.08;
      break;
    case "pray":
      o.bow = 0.5 + Math.sin(v.time * 0.7) * 0.1; o.swing = 0;
      break;
    case "music":
      o.sit = 1; o.phase = v.time * 5 + n.phase; o.armReach = 0.5;
      o.armLift = Math.max(0, Math.sin(v.time * 5)) * 0.5;
      break;
    case "splash": {
      o.phase = v.time * 4 + n.phase * 2;
      o.swing = 0.7;
      o.armLift = Math.max(0, Math.sin(v.time * 2.2 + n.phase)) * 0.6;
      break;
    }
    case "snowplay":
      o.bow = 0.35 + Math.sin(v.time * 1.4 + n.phase) * 0.2;
      o.phase = v.time * 2 + n.phase;
      o.prop = "basket";
      break;
    case "lookup":
      o.lookUp = 1; o.swing = 0.05; o.phase = v.time * 0.7 + n.phase;
      break;
    case "balcony":
      o.armLift = 0.55 + Math.sin(v.time * 1.8) * 0.2;
      o.swing = 0;
      break;
    default:
      break;
  }

  if (n.greet) {
    const kind = n.greet.kind;
    if (kind === "wave") o.armLift = Math.max(o.armLift ?? 0, greetEnv * (0.78 + 0.22 * Math.sin(v.time * 3.1)));
    if (kind === "offer") o.armReach = Math.max(o.armReach ?? 0, greetEnv * 0.95);
    if (kind === "bow") o.bow = Math.max(o.bow ?? 0, greetEnv * 0.55);
  }
  if (n.umbrella) o.umbrella = true;
  if (n.pinwheel !== undefined && n.pinwheel) o.pinwheel = v.time * 9;

  return o;
}

/* ------------------------------------------------------------------ animals */
export function drawAnimal(ctx: CanvasRenderingContext2D, a: Animal, v: View, sx: number, sy: number) {
  if (a.kind === "cat") {
    let x = sx;
    let moving = 0;
    if (a.act === "cross") {
      const u = ((v.time * 9) / 240 + a.seed) % 2;
      const uu = u < 1 ? u : 2 - u;
      x = sx + (-120 + uu * 240) * v.zoom;
      moving = u < 1 ? 1 : -1;
    }
    const y = sy;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(moving < 0 ? -1 : 1, 1);
    const stretch = a.act === "sit" && Math.abs(v.target - v.p) < 0.0004
      ? Math.sin(v.time * 1.3) * 0.5 + 0.5 : 0;
    const tail = Math.sin(v.time * 1.1 + a.seed) * 0.5;
    ctx.strokeStyle = "#8a7f70";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-9, -4);
    ctx.quadraticCurveTo(-14, -8 - tail * 4, -13, -14 - tail * 3);
    ctx.stroke();
    ctx.fillStyle = "#9a8f80";
    ctx.beginPath();
    ctx.ellipse(0, -6 - stretch * 1.5, 9 + stretch * 2, 6 + stretch, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(8.5, -11 - stretch * 2, 4.6, 0, TAU);
    ctx.fill();
    // ears
    ctx.beginPath();
    ctx.moveTo(6, -15 - stretch * 2); ctx.lineTo(7.4, -19 - stretch * 2); ctx.lineTo(9, -15.4 - stretch * 2);
    ctx.moveTo(9.4, -15.4 - stretch * 2); ctx.lineTo(11, -18.6 - stretch * 2); ctx.lineTo(12.2, -14.8 - stretch * 2);
    ctx.fill();
    // stripes
    ctx.strokeStyle = "#7a705f";
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(-2 + i * 4, -8 - stretch, 3.4, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
    ctx.fillStyle = "#40322a";
    ctx.beginPath();
    ctx.arc(10, -11.5 - stretch * 2, 0.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  } else {
    // sitting dog
    const x = sx;
    const y = sy;
    ctx.save();
    ctx.translate(x, y);
    const wag = Math.sin(v.time * 6 + a.seed) * 0.6;
    ctx.strokeStyle = "#b08d5a";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-7, -6);
    ctx.quadraticCurveTo(-12, -8, -11.5, -13 + wag * 3);
    ctx.stroke();
    ctx.fillStyle = "#c09a63";
    ctx.beginPath();
    ctx.ellipse(-1, -8, 8.5, 8, 0, 0, TAU); // haunch
    ctx.ellipse(6, -11, 5.5, 7.5, 0.25, 0, TAU); // chest
    ctx.fill();
    ctx.beginPath();
    ctx.arc(8, -21, 5, 0, TAU);
    ctx.fill();
    // floppy ear
    ctx.fillStyle = "#a87f4a";
    ctx.beginPath();
    ctx.ellipse(5, -21, 2.2, 4.4, 0.3, 0, TAU);
    ctx.fill();
    // muzzle + eye
    ctx.fillStyle = "#c09a63";
    ctx.beginPath();
    ctx.ellipse(12.4, -19.6, 2.8, 2, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#40322a";
    ctx.beginPath();
    ctx.arc(14.4, -19.8, 0.8, 0, TAU);
    ctx.arc(8.6, -22.2, 0.75, 0, TAU);
    ctx.fill();
    // front legs
    ctx.strokeStyle = "#c09a63";
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(5, -8); ctx.lineTo(5.6, 0);
    ctx.moveTo(8.6, -8); ctx.lineTo(9.2, 0);
    ctx.stroke();
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ riders & sky life */
export function drawBicycle(
  ctx: CanvasRenderingContext2D, x: number, y: number, facing: number, pedal: number, rider: PersonOpts | null,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.strokeStyle = "#4a4a52";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(-11, -8, 7.6, 0, TAU);
  ctx.arc(11, -8, 7.6, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-11, -8); ctx.lineTo(-2, -8); ctx.lineTo(4, -20); ctx.lineTo(11, -8);
  ctx.moveTo(-2, -8); ctx.lineTo(2, -20); ctx.lineTo(9, -21);
  ctx.moveTo(2, -20); ctx.lineTo(-4, -21);
  ctx.stroke();
  // pedals
  const px = Math.cos(pedal) * 3.4;
  const py = Math.sin(pedal) * 3.4;
  ctx.beginPath();
  ctx.moveTo(-2 - px, -8 - py); ctx.lineTo(-2 + px, -8 + py);
  ctx.stroke();
  if (rider) {
    // legs to pedals
    ctx.strokeStyle = css(rider.bottom);
    ctx.lineWidth = 3.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-3, -26); ctx.lineTo(-2 + px, -8 + py);
    ctx.moveTo(-3, -26); ctx.lineTo(-2 - px, -8 - py);
    ctx.stroke();
    drawPerson(ctx, -3, -2, { ...rider, s: rider.s * 0.98, sit: 0, swing: 0, facing: 1, phase: 0 });
  }
  ctx.restore();
}

const RIDES: { scene: [number, number]; x0: number; x1: number; speed: number; top: string }[] = [
  { scene: [0.055, 0.13], x0: 1650, x1: 2650, speed: 46, top: "#7a8aa0" },
  { scene: [0.395, 0.465], x0: 9900, x1: 10950, speed: 52, top: "#a08a6f" },
  { scene: [0.55, 0.625], x0: 12550, x1: 13650, speed: 60, top: "#8aa06f" },
  { scene: [0.605, 0.66], x0: 14210, x1: 14430, speed: 40, top: "#6f8aa0" },
];

export function drawRiders(ctx: CanvasRenderingContext2D, v: View, X: (wx: number) => number, groundY: (wx: number) => number) {
  for (const r of RIDES) {
    const alpha = window01(v.p, r.scene[0], r.scene[1]);
    if (alpha < 0.02) continue;
    const span = r.x1 - r.x0;
    const u = ((v.time * r.speed) / span / 2 + 0.3) % 2;
    const uu = u < 1 ? u : 2 - u;
    const x = r.x0 + uu * span;
    const facing = u < 1 ? 1 : -1;
    ctx.save();
    ctx.globalAlpha *= alpha;
    drawBicycle(ctx, X(x), groundY(x) + 4, facing, v.time * 7, {
      s: 0.94, facing: 1, phase: 0, swing: 0,
      top: hex(r.top), bottom: hex("#5f646e"), hair: hex("#43352c"),
    });
    ctx.restore();
  }
}

export function drawBirds(ctx: CanvasRenderingContext2D, v: View) {
  const dayness = 1 - v.night;
  if (dayness < 0.15) return;
  ctx.save();
  ctx.globalAlpha *= dayness * 0.85;
  ctx.strokeStyle = "#4a5568";
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  const flocks = [
    { y: 0.2, spd: 26, n: 5, off: 0, dir: 1 },
    { y: 0.3, spd: 18, n: 3, off: 900, dir: -1 },
  ];
  for (const f of flocks) {
    const span = v.w + 500;
    let x = ((v.time * f.spd + f.off) % span);
    if (f.dir < 0) x = span - x;
    x -= 250;
    for (let i = 0; i < f.n; i++) {
      const bx = x - i * 26 * f.dir;
      const by = v.h * f.y + Math.sin(v.time * 2 + i * 2) * 6 + i * 9;
      const flap = Math.sin(v.time * 9 + i * 1.7) * 3.4;
      ctx.beginPath();
      ctx.moveTo(bx - 6, by - flap * 0.4);
      ctx.quadraticCurveTo(bx - 2, by - 3 - flap, bx, by);
      ctx.quadraticCurveTo(bx + 2, by - 3 - flap, bx + 6, by - flap * 0.4);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawDragonflies(ctx: CanvasRenderingContext2D, v: View, X: (wx: number, par: number) => number, Y: (wy: number, par: number) => number) {
  const a = window01(v.p, 0.545, 0.66) + window01(v.p, 0.34, 0.4);
  if (a < 0.02) return;
  ctx.save();
  ctx.globalAlpha *= Math.min(1, a);
  for (let i = 0; i < 3; i++) {
    const bx = v.camX + Math.sin(v.time * 0.5 + i * 2.1) * 260 + Math.sin(v.time * 1.7 + i) * 40;
    const by = v.camY + 20 + Math.cos(v.time * 0.8 + i * 1.4) * 46;
    const sx = X(bx, 1.02);
    const sy = Y(by, 1);
    const flutter = Math.sin(v.time * 34 + i * 5) * 0.5 + 0.5;
    ctx.strokeStyle = "#3f8a8a";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(sx - 6, sy);
    ctx.lineTo(sx + 5, sy);
    ctx.stroke();
    ctx.fillStyle = `rgba(220,240,245,${0.35 + flutter * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(sx - 1, sy - 2.4, 4.6, 1.6 + flutter, -0.3, 0, TAU);
    ctx.ellipse(sx - 1, sy + 2.4, 4.6, 1.6 + flutter, 0.3, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
