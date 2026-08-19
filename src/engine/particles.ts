import { TAU, lerp } from "./utils";

export type ParticleType = "petal" | "snow" | "leaf" | "pollen" | "firefly";

interface Particle {
  type: ParticleType;
  x: number; y: number; z: number;
  vx: number; vy: number;
  rot: number; vr: number;
  size: number; seed: number;
  hue: number;
}

const LEAF_COLORS = ["#d9813f", "#c95d33", "#d9a83e", "#b97a35", "#c9904a"];
const PETAL_COLORS = ["#f6c3d0", "#f2aec2", "#f8d3dc", "#ef9fb6"];

export interface ParticleEnv {
  time: number;
  camX: number;
  camY: number;
  vw: number;
  vh: number;
  zoom: number;
  wind: number;
}

export class ParticleField {
  private ps: Particle[] = [];
  weights: Record<ParticleType, number> = { petal: 0, snow: 0, leaf: 0, pollen: 0, firefly: 0 };
  private max = 240;

  setQuality(q: number) {
    this.max = Math.round(240 * q);
  }

  setMode(w: Partial<Record<ParticleType, number>>) {
    this.weights = { petal: 0, snow: 0, leaf: 0, pollen: 0, firefly: 0, ...w };
  }

  private spawn(type: ParticleType, env: ParticleEnv, near?: { x: number; y: number }) {
    const spanX = (env.vw / env.zoom) * 0.8;
    const top = env.camY - env.vh / env.zoom / 2;
    const bottom = env.camY + env.vh / env.zoom / 2;
    const z = Math.random();
    const x = near ? near.x + (Math.random() - 0.5) * 60 : env.camX + (Math.random() * 2 - 1) * spanX;
    let y: number;
    if (type === "firefly") y = bottom - 20 - Math.random() * 170;
    else if (near) y = near.y + (Math.random() - 0.5) * 40;
    else y = top - 40 + Math.random() * (bottom - top) * 0.85;

    const p: Particle = {
      type, x, y, z,
      vx: 0, vy: 0,
      rot: Math.random() * TAU,
      vr: (Math.random() - 0.5) * 3,
      size: 1, seed: Math.random() * 100,
      hue: Math.floor(Math.random() * 4),
    };
    switch (type) {
      case "petal": p.size = 3.4 + Math.random() * 3.2; p.vy = 13 + Math.random() * 13; p.vr = (Math.random() - 0.5) * 5; break;
      case "snow": p.size = 1.6 + Math.random() * 3; p.vy = 13 + Math.random() * 17; break;
      case "leaf": p.size = 4 + Math.random() * 4.5; p.vy = 20 + Math.random() * 18; p.vr = (Math.random() - 0.5) * 2.4; break;
      case "pollen": p.size = 1.1 + Math.random() * 1.6; p.vy = -3 + Math.random() * 8; break;
      case "firefly": p.size = 1.4 + Math.random() * 1.2; p.vy = 0; p.z = 0.4 + Math.random() * 0.6; break;
    }
    this.ps.push(p);
  }

  update(dt: number, env: ParticleEnv) {
    const total =
      this.weights.petal + this.weights.snow + this.weights.leaf + this.weights.pollen + this.weights.firefly;
    if (total > 0.001 && this.ps.length < this.max) {
      const room = Math.min(3, this.max - this.ps.length);
      for (let i = 0; i < room; i++) {
        let r = Math.random() * total;
        let type: ParticleType = "petal";
        for (const t of Object.keys(this.weights) as ParticleType[]) {
          r -= this.weights[t];
          if (r <= 0) { type = t; break; }
        }
        // petals occasionally arrive in little clusters
        if (type === "petal" && Math.random() < 0.28) {
          const cx = env.camX + (Math.random() * 2 - 1) * (env.vw / env.zoom) * 0.6;
          const cy = env.camY - env.vh / env.zoom / 2 + Math.random() * 60;
          for (let k = 0; k < 3; k++) this.spawn("petal", env, { x: cx, y: cy });
        } else this.spawn(type, env);
      }
    }

    const bottom = env.camY + env.vh / env.zoom / 2 + 60;
    const marginX = (env.vw / env.zoom) * 0.95;
    const t = env.time;

    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i];
      const w = this.weights[p.type];
      if (w <= 0.02) { this.ps.splice(i, 1); continue; }
      const depth = 0.55 + 0.5 * p.z;
      switch (p.type) {
        case "petal":
          p.x += (env.wind * 9 * depth + Math.sin(t * 1.4 + p.seed) * 7) * dt;
          p.y += p.vy * depth * dt;
          p.rot += p.vr * dt;
          break;
        case "snow":
          p.x += (env.wind * 6 * depth + Math.sin(t * 0.8 + p.seed * 2) * 9 * depth) * dt;
          p.y += p.vy * depth * dt;
          break;
        case "leaf":
          p.x += (env.wind * 10 * depth + Math.sin(t * 2.1 + p.seed) * 16) * dt;
          p.y += p.vy * depth * dt * (0.82 + 0.18 * Math.sin(t * 3 + p.seed));
          p.rot += p.vr * dt;
          break;
        case "pollen":
          p.x += (env.wind * 4 + Math.sin(t * 0.9 + p.seed) * 4) * dt;
          p.y += p.vy * dt + Math.sin(t * 1.6 + p.seed) * 3 * dt;
          break;
        case "firefly":
          p.x += Math.sin(t * 0.7 + p.seed * 3) * 9 * dt;
          p.y += Math.cos(t * 0.55 + p.seed * 2) * 7 * dt;
          break;
      }
      if (p.y > bottom || p.x < env.camX - marginX || p.x > env.camX + marginX) {
        if (w > 0.02 && (p.type === "petal" || p.type === "snow" || p.type === "leaf" || p.type === "pollen")) {
          // recycle to the top of view
          p.x = env.camX + (Math.random() * 2 - 1) * (env.vw / env.zoom) * 0.8;
          p.y = env.camY - env.vh / env.zoom / 2 - 30 - Math.random() * 40;
          if (p.type === "pollen") p.y += 80 + Math.random() * 120;
        } else this.ps.splice(i, 1);
      }
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    layer: "far" | "near",
    X: (wx: number, par: number) => number,
    Y: (wy: number, par: number) => number,
    zoom: number,
    time: number,
  ) {
    for (const p of this.ps) {
      const near = p.z >= 0.62;
      if ((layer === "near") !== near) continue;
      const par = 0.72 + 0.5 * p.z;
      const sx = X(p.x, par);
      const sy = Y(p.y, par);
      const sc = zoom * (0.55 + 0.65 * p.z);
      const depthA = 0.45 + 0.55 * p.z;

      if (p.type === "petal") {
        const tum = 0.45 + 0.55 * Math.abs(Math.sin(p.rot));
        ctx.fillStyle = PETAL_COLORS[p.hue];
        ctx.globalAlpha = (near ? 0.75 : 0.9) * depthA;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(p.rot * 0.6);
        ctx.scale(tum, 1);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * sc, p.size * sc * 0.62, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      } else if (p.type === "snow") {
        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = (near ? 0.65 : 0.85) * depthA;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size * sc, 0, TAU);
        ctx.fill();
      } else if (p.type === "leaf") {
        ctx.fillStyle = LEAF_COLORS[p.hue % LEAF_COLORS.length];
        ctx.globalAlpha = (near ? 0.72 : 0.9) * depthA;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * sc, p.size * sc * 0.5, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      } else if (p.type === "pollen") {
        const tw = 0.4 + 0.6 * (Math.sin(time * 2.4 + p.seed * 4) * 0.5 + 0.5);
        ctx.fillStyle = "#fdf3d0";
        ctx.globalAlpha = 0.5 * tw * depthA;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size * sc, 0, TAU);
        ctx.fill();
      } else {
        const blink = Math.pow(Math.sin(time * 1.7 + p.seed * 5) * 0.5 + 0.5, 3);
        if (blink < 0.03) continue;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = "rgba(255,236,150,0.16)";
        ctx.globalAlpha = blink;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size * sc * 4.4, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "rgba(255,246,190,0.95)";
        ctx.beginPath();
        ctx.arc(sx, sy, p.size * sc, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  get count() {
    return this.ps.length;
  }
}
