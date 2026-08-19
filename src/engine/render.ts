import { TAU, clamp, damp, ramp, window01 } from "./utils";
import { terrainY, type View } from "./world";
import { boyFrame, drawAnimal, drawBirds, drawDragonflies, drawPerson, drawRiders, npcFrame } from "./figures";
import {
  drawFarVillage, drawFestival, drawForeground, drawGround, drawHouse, drawPanorama,
  drawPoles, drawRidges, drawShrine, drawSky, drawStation, drawTeahouseInterior, drawTree,
  type Cam,
} from "./environment";
import type { ParticleField } from "./particles";

/* ---------------------------------------------------------------- fireworks */
interface Rocket { x: number; y: number; vy: number; col: number }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; ttl: number; col: number }

const FW_COLS = ["#ffd9a0", "#ffb0a0", "#a8d8f0", "#f0e0a0", "#f4b0c8", "#c8f0d0"];

export class Fireworks {
  rockets: Rocket[] = [];
  sparks: Spark[] = [];
  private timer = 1.2;

  update(dt: number, v: View) {
    if (v.fwActive > 0.5 && this.rockets.length + this.sparks.length / 60 < (v.reduced ? 1.5 : 3.2)) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 2.1 + Math.random() * 1.6;
        this.rockets.push({
          x: 16650 + Math.random() * 1050,
          y: terrainY(17000) - 10,
          vy: -(300 + Math.random() * 90),
          col: Math.floor(Math.random() * FW_COLS.length),
        });
      }
    }
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.y += r.vy * dt;
      r.vy += 110 * dt;
      if (r.vy > -70) {
        const n = v.reduced ? 26 : 52;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * TAU + Math.random() * 0.3;
          const sp = 60 + Math.random() * 110;
          this.sparks.push({
            x: r.x, y: r.y,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8,
            life: 0, ttl: 1.1 + Math.random() * 0.7,
            col: (r.col + (Math.random() < 0.2 ? 1 : 0)) % FW_COLS.length,
          });
        }
        this.rockets.splice(i, 1);
        v.boom?.(0.6 + Math.random() * 0.4);
      }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life += dt;
      if (s.life > s.ttl) { this.sparks.splice(i, 1); continue; }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 1 - 1.4 * dt;
      s.vy = s.vy * (1 - 1.4 * dt) + 46 * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D, v: View, cam: Cam) {
    if (this.rockets.length === 0 && this.sparks.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const r of this.rockets) {
      ctx.fillStyle = FW_COLS[r.col];
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(cam.X(r.x), cam.Y(r.y), 2.2, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(cam.X(r.x), cam.Y(r.y + 9), 1.6, 0, TAU);
      ctx.fill();
    }
    for (const s of this.sparks) {
      const u = 1 - s.life / s.ttl;
      ctx.globalAlpha = u * 0.95;
      ctx.fillStyle = FW_COLS[s.col];
      ctx.beginPath();
      ctx.arc(cam.X(s.x), cam.Y(s.y), (1.4 + u * 1.8) * cam.z, 0, TAU);
      ctx.fill();
      /* river reflection */
      if (s.x > 16500 && s.x < 17900) {
        const wy = -60 + (-60 - s.y) * 0.35;
        if (wy > -60 && wy < -12) {
          ctx.globalAlpha = u * 0.3;
          ctx.beginPath();
          ctx.ellipse(cam.X(s.x), cam.Y(wy), 2.4 * cam.z, 1 * cam.z, 0, 0, TAU);
          ctx.fill();
        }
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

/* ---------------------------------------------------------------- boy helpers */
function bridgeArch(x: number, v: View) {
  for (const b of v.world.bridges) {
    const half = b.span / 2;
    if (Math.abs(x - b.x) < half) {
      const u = (x - b.x) / half;
      return -24 * (1 - u * u);
    }
  }
  return 0;
}

export function updateBoy(v: View, prevX: number) {
  const b = v.boy;
  const dx = b.x - prevX;
  const speed = v.dt > 0 ? dx / v.dt : 0;
  b.speed = damp(b.speed, Math.abs(speed), 5, v.dt);
  if (Math.abs(speed) > 3) {
    const t = speed > 0 ? 1 : -1;
    b.faceT = t;
  }
  b.facing = damp(b.facing, b.faceT, 7, v.dt);
  if (Math.abs(b.facing) < 0.25) b.facing = 0.25 * (b.facing >= 0 ? 1 : -1);
  /* stride locked to distance — slow scroll = slow walk, reverse = walk backwards */
  b.phase += dx * 0.035;

  /* response envelopes — the village knows him */
  let wave = 0;
  let greetX = b.x;
  for (const n of v.world.npcs) {
    if (!n.greet) continue;
    const e = window01(v.p, n.greet.a, n.greet.b);
    if (e > wave) {
      wave = e;
      greetX = n.x;
    }
  }
  if (wave > 0.3) b.faceT = greetX > b.x ? 1 : -1;
  b.wave = wave * (0.8 + 0.2 * Math.sin(v.time * 3.2));
  /* a small thankful bow for the picnic snack, a polite nod at the tea shop */
  b.bow = window01(v.p, 0.49, 0.526) * 0.4 + window01(v.p, 0.226, 0.262) * 0.22;
  b.lookUp = window01(v.p, 0.726, 0.768);
  b.sit = window01(v.p, 0.617, 0.65);
  b.basket = window01(v.p, 0.83, 0.874);
}

/* ---------------------------------------------------------------- master render */
export function render(ctx: CanvasRenderingContext2D, v: View, particles: ParticleField, fw: Fireworks) {
  const parScale = v.reduced || v.mobile ? 0.55 : 1;
  const px = v.px * parScale;
  const py = v.py * parScale;
  const cam: Cam = {
    z: v.zoom,
    X: (wx, par = 1) => (wx - v.camX * par) * v.zoom + v.w / 2 + px * 24 * par * v.zoom,
    Y: (wy, par = 1) => (wy - v.camY * (0.5 + 0.5 * par)) * v.zoom + v.h / 2 + py * 11 * par * v.zoom,
  };

  const panA = ramp(v.p, 0.985, 0.996);

  drawSky(ctx, v, cam);
  drawRidges(ctx, v, cam);
  drawFarVillage(ctx, v, cam);
  drawBirds(ctx, v);

  /* far particle layer (behind the village) */
  particles.draw(ctx, "far", cam.X, cam.Y, v.zoom, v.time);

  ctx.save();
  ctx.globalAlpha = 1 - panA;

  drawGround(ctx, v, cam);
  drawPoles(ctx, v, cam);
  drawShrine(ctx, v, cam);
  drawStation(ctx, v, cam);

  const smokeA = clamp(
    window01(v.p, 0, 0.12) * 0.9 + v.season.winter * 0.9 + window01(v.p, 0.94, 0.975) * 0.8,
    0, 1,
  );
  for (const h of v.world.houses) drawHouse(ctx, h, v, cam, smokeA);
  for (const t of v.world.trees) drawTree(ctx, t, v, cam);

  drawFestival(ctx, v, cam);

  const footY = (wx: number, extra = 0) => terrainY(wx) + 14 + extra;

  drawRiders(ctx, v, (wx) => cam.X(wx), (wx) => cam.Y(footY(wx), 1));

  /* villagers */
  for (const n of v.world.npcs) {
    const f = npcFrame(n, v);
    if (!f) continue;
    const sx = cam.X(f.x);
    if (sx < -200 || sx > v.w + 200) continue;
    ctx.globalAlpha = (1 - panA) * f.alpha;
    drawPerson(ctx, sx, cam.Y(footY(f.x, f.y + 4) + ((f.sit ?? 0) > 0.5 ? 4 : 0), 1), f);
  }
  ctx.globalAlpha = 1 - panA;

  /* animals */
  for (const a of v.world.animals) {
    const alpha = window01(v.p, a.scene[0], a.scene[1]);
    if (alpha < 0.02) continue;
    const sx = cam.X(a.x);
    if (sx < -200 || sx > v.w + 200) continue;
    ctx.globalAlpha = (1 - panA) * alpha;
    drawAnimal(ctx, a, v, sx, cam.Y(footY(a.x) + 2, 1));
    ctx.globalAlpha = 1 - panA;
  }

  /* the boy */
  const boyOpts = boyFrame(v);
  drawPerson(
    ctx,
    cam.X(v.boy.x),
    cam.Y(footY(v.boy.x) + bridgeArch(v.boy.x, v) + v.boy.sit * 6, 1),
    boyOpts,
  );

  drawDragonflies(ctx, v, cam.X, cam.Y);
  drawForeground(ctx, v, cam);

  particles.draw(ctx, "near", cam.X, cam.Y, v.zoom, v.time);
  fw.update(v.dt, v);
  fw.draw(ctx, v, cam);

  ctx.restore();

  /* time-of-day light washes */
  const golden = window01(v.tod, 0.5, 0.66, 0.06, 0.06) * 0.6 + window01(v.tod, -0.02, 0.07, 0.03, 0.03) * 0.5;
  if (golden > 0.02) {
    ctx.fillStyle = `rgba(255,178,100,${golden * 0.13})`;
    ctx.fillRect(0, 0, v.w, v.h);
  }
  if (v.night > 0.02) {
    ctx.fillStyle = `rgba(38,58,110,${v.night * 0.2})`;
    ctx.fillRect(0, 0, v.w, v.h);
  }
  if (v.season.winter > 0.02 && v.night < 0.5) {
    ctx.fillStyle = `rgba(205,224,242,${v.season.winter * (1 - v.night) * 0.09})`;
    ctx.fillRect(0, 0, v.w, v.h);
  }

  drawTeahouseInterior(ctx, v, window01(v.p, 0.947, 0.976, 0.007, 0.006));
  drawPanorama(ctx, v, panA);
}
