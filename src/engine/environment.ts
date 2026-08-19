import { TAU, clamp, css, hex, lerp, mixC, ramp, vnoise, window01, type RGB } from "./utils";
import { terrainY, trainState, skyAt, ROAD_X0, ROAD_X1, type House, type Tree, type View } from "./world";
import { drawPerson } from "./figures";

export interface Cam {
  X: (wx: number, par?: number) => number;
  Y: (wy: number, par?: number) => number;
  z: number;
}

const WALLS = [hex("#efe4cd"), hex("#e6d8bd"), hex("#cfa878"), hex("#b98d63"), hex("#dcc9a4")];
const WHITE: RGB = [255, 255, 255];
const SNOW: RGB = [238, 242, 246];

/* ------------------------------------------------ seasonal colours */
export function grassCol(v: View): RGB {
  let c = mixC(hex("#a3ce7c"), hex("#6fbf68"), v.season.summer);
  c = mixC(c, hex("#c9ae5e"), v.season.autumn * 0.9);
  c = mixC(c, SNOW, v.season.snow * 0.92);
  return c;
}
function dirtCol(v: View): RGB {
  let c = mixC(hex("#c8b28e"), hex("#c2aa80"), v.season.summer);
  c = mixC(c, hex("#b9a888"), v.season.autumn * 0.6);
  c = mixC(c, hex("#e4e9ee"), v.season.snow * 0.9);
  return c;
}
export function leafCol(v: View, type: Tree["type"]): RGB {
  if (type === "pine") return mixC(hex("#4a6a4f"), hex("#5a7a68"), v.season.snow * 0.4);
  let c = mixC(hex("#8fbf6b"), hex("#4e9e55"), v.season.summer);
  if (type === "maple") c = mixC(c, hex("#cf5a33"), v.season.autumn);
  else c = mixC(c, hex("#c9a03e"), v.season.autumn * 0.75);
  if (type === "cherry") c = mixC(c, hex("#f2aec2"), Math.min(1, v.season.bloom * 1.25));
  c = mixC(c, hex("#9aa79e"), v.season.winter * 0.8);
  return c;
}

const inView = (sx: number, w: number, m = 320) => sx > -m && sx < w + m;

/* ================================================= SKY */
export function drawSky(ctx: CanvasRenderingContext2D, v: View, cam: Cam) {
  const sky = skyAt(v.tod, v.season.winter);
  const g = ctx.createLinearGradient(0, 0, 0, v.h * 0.82);
  g.addColorStop(0, css(sky.top));
  g.addColorStop(0.55, css(sky.mid));
  g.addColorStop(1, css(sky.hor));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, v.w, v.h);

  /* stars */
  if (v.night > 0.03) {
    ctx.fillStyle = "#fdf6e6";
    for (const s of v.world.stars) {
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(v.time * 1.3 + s.tw));
      ctx.globalAlpha = v.night * 0.8 * tw;
      ctx.beginPath();
      ctx.arc(s.x * v.w, s.y * v.h * 0.8, s.s, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    /* moon */
    const mx = v.w * 0.74 + v.px * 6;
    const my = v.h * 0.2;
    const mg = ctx.createRadialGradient(mx, my, 2, mx, my, 70);
    mg.addColorStop(0, "rgba(250,246,230,0.5)");
    mg.addColorStop(1, "rgba(250,246,230,0)");
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.arc(mx, my, 70, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(248,244,228,0.95)";
    ctx.beginPath(); ctx.arc(mx, my, 15, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(220,214,196,0.5)";
    ctx.beginPath(); ctx.arc(mx - 4, my - 3, 3.4, 0, TAU); ctx.arc(mx + 5, my + 4, 2.2, 0, TAU); ctx.fill();
  }

  /* sun */
  const sunA = 1 - ramp(v.tod, 0.58, 0.68);
  if (sunA > 0.01) {
    const u = clamp(v.tod / 0.6, 0, 1);
    const sx = lerp(0.13, 0.87, u) * v.w + v.px * 10;
    const sy = v.h * (0.465 - Math.sin(u * Math.PI) * 0.34);
    const low = 1 - Math.sin(u * Math.PI);
    const r = 24 + low * 14;
    const warm = mixC(hex("#fff4d6"), hex("#ffc37a"), low);
    const gg = ctx.createRadialGradient(sx, sy, 2, sx, sy, r * 6.5);
    gg.addColorStop(0, css(warm, 0.85 * sunA));
    gg.addColorStop(0.25, css(warm, 0.32 * sunA));
    gg.addColorStop(1, css(warm, 0));
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(sx, sy, r * 6.5, 0, TAU); ctx.fill();
    ctx.fillStyle = css(mixC(warm, WHITE, 0.55), 0.95 * sunA);
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
  }

  /* clouds */
  const skyMixT = 0.3 + v.night * 0.3;
  const cc = mixC(WHITE, sky.hor, skyMixT);
  const cAlpha = (1 - v.night * 0.65) * (0.75 - v.season.winter * 0.25);
  const scale = 1 + v.season.summer * 0.4;
  for (const c of v.world.clouds) {
    const span = v.w + 520;
    let cx = (c.bx * span + v.time * c.spd - v.camX * 0.055) % span;
    if (cx < 0) cx += span;
    cx -= 260;
    const cy = v.h * c.y + v.py * 5;
    const s = c.s * scale * (v.w / 1500);
    ctx.fillStyle = css(cc, cAlpha * 0.8);
    ctx.beginPath();
    ctx.ellipse(cx, cy, 62 * s, 17 * s, 0, 0, TAU);
    ctx.ellipse(cx - 40 * s, cy + 6 * s, 38 * s, 13 * s, 0, 0, TAU);
    ctx.ellipse(cx + 44 * s, cy + 5 * s, 42 * s, 14 * s, 0, 0, TAU);
    ctx.ellipse(cx + 8 * s, cy - 10 * s, 40 * s, 14 * s, 0, 0, TAU);
    ctx.fill();
  }

  /* morning mist in the valley */
  const mist = (1 - ramp(v.p, 0.04, 0.11)) * (1 - ramp(v.tod, 0.12, 0.24));
  if (mist > 0.02) {
    for (let i = 0; i < 2; i++) {
      const my = v.h * (0.56 + i * 0.1);
      const mg = ctx.createLinearGradient(0, my - 34, 0, my + 34);
      mg.addColorStop(0, "rgba(250,246,238,0)");
      mg.addColorStop(0.5, `rgba(250,246,238,${0.2 * mist})`);
      mg.addColorStop(1, "rgba(250,246,238,0)");
      ctx.fillStyle = mg;
      ctx.save();
      ctx.translate(Math.sin(v.time * 0.1 + i * 2) * 30, 0);
      ctx.fillRect(-60, my - 34, v.w + 120, 68);
      ctx.restore();
    }
  }

  /* dawn light rays */
  const rays = (1 - ramp(v.tod, 0.05, 0.16)) * (1 - ramp(v.p, 0.03, 0.09));
  if (rays > 0.02) {
    ctx.save();
    ctx.translate(v.w * 0.18, -40);
    ctx.rotate(0.5);
    for (let i = 0; i < 3; i++) {
      const rw = 60 + i * 70;
      ctx.fillStyle = `rgba(255,224,170,${0.07 * rays})`;
      ctx.fillRect(i * 160, 0, rw, v.h * 1.6);
    }
    ctx.restore();
  }
}

/* ================================================= MOUNTAINS */
export function drawRidges(ctx: CanvasRenderingContext2D, v: View, cam: Cam) {
  const sky = skyAt(v.tod, v.season.winter);
  const ridges = [
    { par: 0.1, base: 0.5, amp: 0.17, seed: 3.1, col: mixC(hex("#a8bfd4"), sky.hor, 0.42) },
    { par: 0.2, base: 0.565, amp: 0.13, seed: 9.7, col: mixC(hex("#8fae9e"), sky.hor, 0.3) },
    { par: 0.34, base: 0.625, amp: 0.095, seed: 17.3, col: mixC(hex("#7c9c82"), sky.hor, 0.16) },
  ];
  const winter = v.season.winter;
  for (const r of ridges) {
    const col = mixC(r.col, hex("#e8eef2"), winter * 0.45);
    ctx.fillStyle = css(col, 1 - v.night * 0.3);
    ctx.beginPath();
    ctx.moveTo(-20, v.h);
    const step = 22;
    for (let sx = -20; sx <= v.w + 20; sx += step) {
      const wx = sx / cam.z + v.camX * r.par;
      const n = vnoise(wx * 0.0011 + r.seed) * 0.72 + vnoise(wx * 0.0031 + r.seed * 2.3) * 0.28;
      const ry = v.h * (r.base - r.amp * n) + v.py * 4 * r.par;
      ctx.lineTo(sx, ry);
    }
    ctx.lineTo(v.w + 20, v.h);
    ctx.closePath();
    ctx.fill();
    /* snow caps */
    if (winter > 0.06 && r.par < 0.25) {
      ctx.fillStyle = css(SNOW, winter * 0.55);
      ctx.beginPath();
      for (let sx = -20; sx <= v.w + 20; sx += step) {
        const wx = sx / cam.z + v.camX * r.par;
        const n = vnoise(wx * 0.0011 + r.seed) * 0.72 + vnoise(wx * 0.0031 + r.seed * 2.3) * 0.28;
        if (n > 0.66) {
          const ry = v.h * (r.base - r.amp * n) + v.py * 4 * r.par;
          ctx.moveTo(sx, ry);
          ctx.arc(sx, ry + 4, 10 * (n - 0.6) * 6, Math.PI, 0);
        }
      }
      ctx.fill();
    }
  }
  /* distant tree scallops on the nearest ridge */
  const forestCol = mixC(mixC(hex("#6a8a70"), sky.hor, 0.2), hex("#dfe8ec"), winter * 0.5);
  ctx.fillStyle = css(forestCol, 0.85 - v.night * 0.3);
  const par = 0.34;
  for (let sx = -30; sx <= v.w + 30; sx += 34) {
    const wx = sx / cam.z + v.camX * par;
    const n = vnoise(wx * 0.0011 + 17.3) * 0.72 + vnoise(wx * 0.0031 + 39.8) * 0.28;
    const ry = v.h * (0.625 - 0.095 * n) + v.py * 4 * par;
    const bump = 8 + vnoise(wx * 0.02 + 5) * 10;
    ctx.beginPath();
    ctx.arc(sx + (wx % 34), ry + 3, bump, Math.PI, 0);
    ctx.fill();
  }
}

export function drawFarVillage(ctx: CanvasRenderingContext2D, v: View, cam: Cam) {
  const par = 0.5;
  const sky = skyAt(v.tod, v.season.winter);
  const col = mixC(hex("#9aa8b0"), sky.hor, 0.45);
  const roofCol = mixC(hex("#7a8490"), sky.hor, 0.4);
  const x0 = v.camX * par - v.w / cam.z;
  const x1 = v.camX * par + v.w / cam.z * 2;
  for (let x = Math.floor(x0 / 300) * 300; x < x1; x += 300) {
    const n = vnoise(x * 0.013 + 40);
    if (n < 0.42) continue;
    const sx = cam.X(x, par);
    if (!inView(sx, v.w)) continue;
    const sy = cam.Y(-146 - n * 30, 0.5) + v.py * 3;
    const w = 22 + n * 26;
    ctx.globalAlpha = 0.6 - v.night * 0.25;
    ctx.fillStyle = css(col);
    ctx.fillRect(sx - w / 2, sy - 14, w, 14);
    ctx.fillStyle = css(roofCol);
    ctx.beginPath();
    ctx.moveTo(sx - w / 2 - 4, sy - 14);
    ctx.lineTo(sx, sy - 24 - n * 8);
    ctx.lineTo(sx + w / 2 + 4, sy - 14);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ================================================= GROUND */
export function drawGround(ctx: CanvasRenderingContext2D, v: View, cam: Cam) {
  const grass = grassCol(v);
  const far = mixC(grass, WHITE, 0.25);
  const horY = cam.Y(-170, 1);
  /* base ground fill */
  const gg = ctx.createLinearGradient(0, horY, 0, v.h);
  gg.addColorStop(0, css(far));
  gg.addColorStop(0.24, css(grass));
  gg.addColorStop(1, css(mixC(grass, hex("#5a7a4a"), 0.22 + v.night * 0.2)));
  ctx.fillStyle = gg;
  ctx.fillRect(0, horY - 2, v.w, v.h - horY + 2);

  const wx0 = v.camX - v.w / cam.z / 2 - 200;
  const wx1 = v.camX + v.w / cam.z / 2 + 200;
  const sky = skyAt(v.tod, v.season.winter);

  /* ---- paddy fields */
  const m = v.season;
  const riceH = 9 + 15 * m.summer + 13 * m.autumn * (1 - m.summer * 0.2);
  const riceCol = mixC(mixC(hex("#9fd47a"), hex("#57a94e"), m.summer), hex("#d8b54c"), m.autumn);
  for (const [px0, px1] of v.world.paddySegs) {
    if (px1 < wx0 || px0 > wx1) continue;
    const yTop = cam.Y(-80, 1);
    const yBot = cam.Y(-10, 1);
    /* water / soil base */
    let base: RGB = mixC(mixC(sky.hor, hex("#6a9ab0"), 0.35), hex("#e8f0f2"), 0.15);
    if (m.autumn > 0.4) base = mixC(base, hex("#c9a860"), (m.autumn - 0.4) * 1.2);
    if (m.winter > 0.4) base = mixC(base, SNOW, (m.winter - 0.4) * 1.5);
    ctx.fillStyle = css(base, 0.95);
    ctx.fillRect(cam.X(px0), yTop, cam.X(px1) - cam.X(px0), yBot - yTop);
    /* bunds */
    ctx.strokeStyle = css(mixC(grass, hex("#4a5a3a"), 0.2), 0.5);
    ctx.lineWidth = 2;
    const rows = [-68, -54, -40, -27, -16];
    for (const ry of rows) {
      const yy = cam.Y(ry, 1);
      ctx.beginPath();
      ctx.moveTo(cam.X(px0), yy);
      ctx.lineTo(cam.X(px1), yy);
      ctx.stroke();
    }
    /* rice plants with travelling wind waves */
    if (m.winter < 0.7) {
      const windAmp = (0.6 + Math.sin(v.time * 0.4) * 0.3) * (v.reduced ? 0.4 : 1);
      ctx.strokeStyle = css(riceCol, 0.9);
      ctx.lineWidth = 1.5 * cam.z;
      rows.forEach((ry, ri) => {
        const yy = cam.Y(ry, 1);
        const hh = riceH * cam.z * (0.75 + ri * 0.07);
        ctx.beginPath();
        const step = 13;
        const gx0 = Math.max(px0, wx0);
        const gx1 = Math.min(px1, wx1);
        for (let x = gx0; x <= gx1; x += step) {
          const sway = Math.sin(x * 0.021 - v.time * 1.7 + ri * 1.2) * 3.2 * windAmp * cam.z;
          const sx = cam.X(x);
          ctx.moveTo(sx + sway * 0.25, yy);
          ctx.quadraticCurveTo(sx + sway * 0.6, yy - hh * 0.6, sx + sway, yy - hh);
        }
        ctx.stroke();
      });
    } else {
      /* winter stubble */
      ctx.strokeStyle = css(mixC(hex("#b9bfa8"), SNOW, 0.4), 0.6);
      ctx.lineWidth = 1.2;
      const gx0 = Math.max(px0, wx0);
      const gx1 = Math.min(px1, wx1);
      ctx.beginPath();
      for (let x = gx0; x <= gx1; x += 16) {
        const sx = cam.X(x);
        rows.forEach((ry) => {
          const yy = cam.Y(ry, 1);
          ctx.moveTo(sx, yy);
          ctx.lineTo(sx + 1.5, yy - 4 * cam.z);
        });
      }
      ctx.stroke();
    }
    /* cloud shadows drifting across the field */
    if (v.night < 0.3 && m.winter < 0.4) {
      for (let i = 0; i < 2; i++) {
        const cx = cam.X(px0 + ((v.time * 12 + i * 700) % (px1 - px0 + 500)));
        ctx.fillStyle = "rgba(70,90,70,0.07)";
        ctx.beginPath();
        ctx.ellipse(cx, (yTop + yBot) / 2, 190 * cam.z, (yBot - yTop) * 0.55, 0, 0, TAU);
        ctx.fill();
      }
    }
  }

  /* ---- vegetable plots */
  for (const [px0, px1] of v.world.vegSegs) {
    if (px1 < wx0 || px0 > wx1) continue;
    const yTop = cam.Y(-46, 1);
    const yBot = cam.Y(-8, 1);
    ctx.fillStyle = css(mixC(hex("#a8885e"), SNOW, m.snow * 0.8), 0.9);
    ctx.fillRect(cam.X(px0), yTop, cam.X(px1) - cam.X(px0), yBot - yTop);
    const leaf = mixC(hex("#6faf5e"), hex("#c9a03e"), m.autumn);
    ctx.fillStyle = css(leaf, 0.95);
    for (let r = 0; r < 3; r++) {
      const yy = yTop + (r + 0.5) * ((yBot - yTop) / 3);
      for (let x = px0 + 10; x < px1 - 6; x += 17) {
        const sx = cam.X(x);
        const rr = (3 + Math.sin(x * 3 + r) * 1.2) * cam.z;
        ctx.beginPath();
        ctx.arc(sx, yy, rr, Math.PI, 0);
        ctx.fill();
      }
    }
  }

  /* ---- river */
  for (const [rx0, rx1] of v.world.riverSegs) {
    if (rx1 < wx0 || rx0 > wx1) continue;
    const yTop = cam.Y(-60, 1);
    const yBot = cam.Y(-14, 1);
    let water = mixC(mixC(sky.hor, hex("#5f9fc0"), 0.4), hex("#2e4a70"), v.night * 0.45);
    if (m.winter > 0.5) water = mixC(water, hex("#dfe9f0"), (m.winter - 0.5) * 1.4);
    ctx.fillStyle = css(water, 0.96);
    ctx.fillRect(cam.X(rx0), yTop, cam.X(rx1) - cam.X(rx0), yBot - yTop);
    /* banks */
    ctx.fillStyle = css(mixC(grass, hex("#4a5a3a"), 0.25), 0.9);
    ctx.fillRect(cam.X(rx0), yTop - 3, cam.X(rx1) - cam.X(rx0), 4);
    ctx.fillRect(cam.X(rx0), yBot - 1, cam.X(rx1) - cam.X(rx0), 5);
    /* shimmer */
    if (m.winter < 0.75) {
      ctx.strokeStyle = css(mixC(WHITE, sky.hor, 0.3), 1);
      ctx.lineWidth = 1.4 * cam.z;
      const gx0 = Math.max(rx0, wx0);
      const gx1 = Math.min(rx1, wx1);
      for (let r = 0; r < 5; r++) {
        const yy = yTop + (r + 0.6) * ((yBot - yTop) / 5.4);
        ctx.beginPath();
        for (let x = gx0; x < gx1; x += 30) {
          const a = Math.sin(v.time * 2 + x * 0.05 + r * 3.1) * 0.5 + 0.5;
          if (a < 0.45) continue;
          const sx = cam.X(x + r * 7);
          ctx.moveTo(sx, yy);
          ctx.lineTo(sx + 10 * cam.z, yy);
        }
        ctx.globalAlpha = 0.28;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else {
      /* icy patches */
      ctx.fillStyle = "rgba(250,252,255,0.55)";
      for (let x = rx0 + 40; x < rx1 - 40; x += 130) {
        ctx.beginPath();
        ctx.ellipse(cam.X(x), (yTop + yBot) / 2, 42 * cam.z, 9 * cam.z, 0, 0, TAU);
        ctx.fill();
      }
    }
    /* bank stones */
    ctx.fillStyle = css(mixC(hex("#9aa0a4"), SNOW, m.snow * 0.7));
    for (let x = rx0 + 18; x < rx1; x += 95) {
      const n = vnoise(x * 0.7);
      ctx.beginPath();
      ctx.ellipse(cam.X(x), yBot + 2 + n * 4, (5 + n * 5) * cam.z, (3 + n * 2) * cam.z, 0, 0, TAU);
      ctx.fill();
    }
  }

  /* ---- wildflowers */
  if (m.snow < 0.5) {
    const cols = ["#e8a0b0", "#f0e0a0", "#e0e8f4", "#d0a0d0", "#f4c0a0"];
    for (const [fx0, fx1] of v.world.flowerSegs) {
      if (fx1 < wx0 || fx0 > wx1) continue;
      const gx0 = Math.max(fx0, wx0);
      const gx1 = Math.min(fx1, wx1);
      ctx.lineWidth = 1 * cam.z;
      for (let x = gx0; x < gx1; x += 24) {
        const n = vnoise(x * 1.7);
        const sx = cam.X(x);
        const yy = cam.Y(26 + n * 14, 1);
        const sway = Math.sin(v.time * 1.6 + x) * 1.6 * (v.reduced ? 0.3 : 1);
        ctx.strokeStyle = css(mixC(hex("#6a9a55"), SNOW, m.snow), 0.8);
        ctx.beginPath();
        ctx.moveTo(sx, yy);
        ctx.quadraticCurveTo(sx + sway * 0.4, yy - 5 * cam.z, sx + sway, yy - 9 * cam.z);
        ctx.stroke();
        ctx.fillStyle = cols[Math.floor(n * 5) % 5];
        ctx.beginPath();
        ctx.arc(sx + sway, yy - 9.5 * cam.z, 2.1 * cam.z, 0, TAU);
        ctx.fill();
      }
    }
  }

  /* ---- road */
  const rx0 = Math.max(ROAD_X0, wx0);
  const rx1 = Math.min(ROAD_X1, wx1);
  if (rx1 > rx0) {
    ctx.fillStyle = css(dirtCol(v), 0.97);
    ctx.beginPath();
    ctx.moveTo(cam.X(rx0), cam.Y(terrainY(rx0) - 6, 1));
    for (let x = rx0; x <= rx1; x += 46) {
      ctx.lineTo(cam.X(x), cam.Y(terrainY(x) - 6, 1));
    }
    for (let x = rx1; x >= rx0; x -= 46) {
      ctx.lineTo(cam.X(x), cam.Y(terrainY(x) + 34, 1));
    }
    ctx.closePath();
    ctx.fill();
    /* worn centre line */
    ctx.strokeStyle = css(mixC(dirtCol(v), hex("#8a7a5e"), 0.3), 0.4);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = rx0; x <= rx1; x += 46) {
      const sx = cam.X(x);
      const sy = cam.Y(terrainY(x) + 15, 1);
      if (x === rx0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
  }

  /* ---- shrine stone path */
  if (v.camX > 7600 && v.camX < 9600) {
    ctx.fillStyle = css(mixC(hex("#b0aca2"), SNOW, m.snow * 0.7));
    for (let x = 8080; x < 8330; x += 34) {
      const sx = cam.X(x);
      const sy = cam.Y(terrainY(x) + 12, 1);
      ctx.beginPath();
      ctx.ellipse(sx, sy, 10 * cam.z, 4 * cam.z, 0, 0, TAU);
      ctx.fill();
    }
  }

  /* ---- bridges */
  for (const b of v.world.bridges) {
    if (b.x + b.span < wx0 || b.x - b.span > wx1) continue;
    const ty = terrainY(b.x);
    const deck = (u: number) => ({ x: b.x + u * (b.span / 2), y: ty - 26 * (1 - u * u) });
    /* shadow */
    ctx.fillStyle = "rgba(40,50,40,0.16)";
    ctx.beginPath();
    ctx.ellipse(cam.X(b.x), cam.Y(ty - 8, 1), (b.span / 2) * cam.z, 8 * cam.z, 0, 0, TAU);
    ctx.fill();
    /* deck */
    ctx.strokeStyle = css(mixC(hex("#a8834e"), SNOW, m.snow * 0.5));
    ctx.lineWidth = 6.5 * cam.z;
    ctx.beginPath();
    for (let u = -1; u <= 1.001; u += 0.125) {
      const d = deck(u);
      const sx = cam.X(d.x);
      const sy = cam.Y(d.y - 6, 1);
      if (u === -1) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    /* railing */
    ctx.strokeStyle = css(mixC(hex("#8a6b45"), SNOW, m.snow * 0.4));
    ctx.lineWidth = 2.4 * cam.z;
    ctx.beginPath();
    for (let u = -1; u <= 1.001; u += 0.125) {
      const d = deck(u);
      const sx = cam.X(d.x);
      const sy = cam.Y(d.y - 20, 1);
      if (u === -1) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.lineWidth = 1.8 * cam.z;
    for (let u = -1; u <= 1.001; u += 0.25) {
      const d = deck(u);
      ctx.beginPath();
      ctx.moveTo(cam.X(d.x), cam.Y(d.y - 6, 1));
      ctx.lineTo(cam.X(d.x), cam.Y(d.y - 20, 1));
      ctx.stroke();
    }
  }
}

/* ================================================= POLES & WIRES */
export function drawPoles(ctx: CanvasRenderingContext2D, v: View, cam: Cam) {
  const m = v.season;
  ctx.strokeStyle = css(mixC(hex("#6a6258"), hex("#8a8a90"), m.snow * 0.4));
  ctx.lineWidth = 3 * cam.z;
  const vis: { x: number; top: number }[] = [];
  for (const x of v.world.poles) {
    const sx = cam.X(x);
    if (!inView(sx, v.w, 400)) continue;
    const gy = cam.Y(terrainY(x) + 4, 1);
    const top = cam.Y(terrainY(x) - 158, 1);
    ctx.beginPath();
    ctx.moveTo(sx, gy);
    ctx.lineTo(sx, top);
    ctx.stroke();
    ctx.lineWidth = 2.4 * cam.z;
    ctx.beginPath();
    ctx.moveTo(sx - 13 * cam.z, top + 5 * cam.z);
    ctx.lineTo(sx + 13 * cam.z, top + 5 * cam.z);
    ctx.moveTo(sx - 10 * cam.z, top + 16 * cam.z);
    ctx.lineTo(sx + 10 * cam.z, top + 16 * cam.z);
    ctx.stroke();
    ctx.lineWidth = 3 * cam.z;
    vis.push({ x, top });
  }
  ctx.strokeStyle = "rgba(58,54,48,0.42)";
  ctx.lineWidth = 1;
  for (let i = 0; i < vis.length - 1; i++) {
    const a = vis[i];
    const b = vis[i + 1];
    if (b.x - a.x > 420) continue;
    for (const dy of [5, 16]) {
      const ay = a.top + dy * cam.z;
      const by = b.top + dy * cam.z;
      ctx.beginPath();
      ctx.moveTo(cam.X(a.x), ay);
      ctx.quadraticCurveTo((cam.X(a.x) + cam.X(b.x)) / 2, (ay + by) / 2 + 15 * cam.z, cam.X(b.x), by);
      ctx.stroke();
    }
  }
}

/* ================================================= HOUSES */
export function drawHouse(ctx: CanvasRenderingContext2D, h: House, v: View, cam: Cam, smokeA: number) {
  const sx = cam.X(h.x);
  if (!inView(sx, v.w, 420)) return;
  const m = v.season;
  const base = cam.Y(terrainY(h.x) - 8, 1);
  const w = h.w * cam.z;
  const wallH = h.h * cam.z;
  const top = base - wallH;
  const wall = mixC(WALLS[h.wall % WALLS.length], hex("#dfe6ec"), m.snow * 0.25);
  const wood = mixC(hex("#6a5340"), hex("#7a6a5e"), m.snow * 0.3);

  /* wall */
  ctx.fillStyle = css(wall);
  ctx.fillRect(sx - w / 2, top, w, wallH);
  /* timber frame */
  ctx.strokeStyle = css(wood, 0.9);
  ctx.lineWidth = 2.2 * cam.z;
  ctx.strokeRect(sx - w / 2, top, w, wallH);
  ctx.beginPath();
  ctx.moveTo(sx - w / 2, top + wallH * 0.52);
  ctx.lineTo(sx + w / 2, top + wallH * 0.52);
  ctx.stroke();
  /* veranda */
  ctx.fillStyle = css(mixC(hex("#b09468"), SNOW, m.snow * 0.5));
  ctx.fillRect(sx - w / 2 + 4 * cam.z, base - 13 * cam.z, w - 8 * cam.z, 4 * cam.z);

  /* windows (with warm night light) */
  const winY = top + wallH * 0.16;
  const winH = wallH * 0.3;
  const lit = v.light > 0.05 && (h.variant % 2 === 0 || h.lantern);
  const winCol = lit ? mixC(hex("#ffd9a0"), hex("#ffc988"), 0.5) : mixC(hex("#f0e8d4"), hex("#c8ccd4"), v.night * 0.6);
  for (let i = 0; i < 2; i++) {
    const wxp = sx - w * 0.26 + i * w * 0.3;
    if (lit) {
      ctx.fillStyle = css(hex("#ffd9a0"), v.light * 0.22);
      ctx.fillRect(wxp - 5 * cam.z, winY - 4 * cam.z, w * 0.22 + 10 * cam.z, winH + 8 * cam.z);
    }
    ctx.fillStyle = css(winCol, 0.95);
    ctx.fillRect(wxp, winY, w * 0.22, winH);
    ctx.strokeStyle = css(wood, 0.85);
    ctx.lineWidth = 1.4 * cam.z;
    ctx.strokeRect(wxp, winY, w * 0.22, winH);
    ctx.beginPath();
    ctx.moveTo(wxp + w * 0.11, winY);
    ctx.lineTo(wxp + w * 0.11, winY + winH);
    ctx.moveTo(wxp, winY + winH * 0.5);
    ctx.lineTo(wxp + w * 0.22, winY + winH * 0.5);
    ctx.stroke();
  }

  /* door */
  const dw = w * 0.2;
  ctx.fillStyle = css(mixC(hex("#7a6248"), hex("#8a7a6a"), m.snow * 0.3));
  ctx.fillRect(sx + w * 0.16, base - wallH * 0.46, dw, wallH * 0.46);
  ctx.strokeStyle = css(wood, 0.7);
  ctx.lineWidth = 1.2 * cam.z;
  ctx.beginPath();
  ctx.moveTo(sx + w * 0.16 + dw / 2, base - wallH * 0.46);
  ctx.lineTo(sx + w * 0.16 + dw / 2, base);
  ctx.stroke();

  /* roof */
  const roofH = h.h * 0.42 * cam.z;
  const ov = 13 * cam.z;
  const roofCol = h.roof === "tile" ? mixC(hex("#55524e"), hex("#8a9098"), m.snow * 0.45) : mixC(hex("#b99a5e"), hex("#dfe4e8"), m.snow * 0.5);
  ctx.fillStyle = css(roofCol);
  ctx.beginPath();
  ctx.moveTo(sx - w / 2 - ov, top + 1);
  ctx.quadraticCurveTo(sx - w * 0.3, top - roofH * 0.75, sx - w * 0.16, top - roofH);
  ctx.lineTo(sx + w * 0.16, top - roofH);
  ctx.quadraticCurveTo(sx + w * 0.3, top - roofH * 0.75, sx + w / 2 + ov, top + 1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = css(mixC(roofCol, hex("#000000"), 0.3), 0.5);
  ctx.lineWidth = 1.2 * cam.z;
  ctx.beginPath();
  ctx.moveTo(sx - w * 0.16, top - roofH);
  ctx.lineTo(sx + w * 0.16, top - roofH);
  ctx.stroke();
  if (h.roof === "tile") {
    ctx.strokeStyle = "rgba(30,28,26,0.16)";
    for (let r = 1; r <= 3; r++) {
      ctx.beginPath();
      const ry = top - roofH + (roofH * r) / 3.4;
      ctx.moveTo(sx - w / 2 - ov + r * 7 * cam.z, ry + 2);
      ctx.quadraticCurveTo(sx, ry - 3, sx + w / 2 + ov - r * 7 * cam.z, ry + 2);
      ctx.stroke();
    }
  }
  /* snow on roof */
  if (m.snow > 0.08) {
    ctx.fillStyle = css(SNOW, m.snow * 0.92);
    ctx.beginPath();
    ctx.moveTo(sx - w * 0.17, top - roofH);
    ctx.lineTo(sx + w * 0.17, top - roofH);
    ctx.quadraticCurveTo(sx + w * 0.3, top - roofH * 0.72, sx + w / 2 + ov - 3, top);
    ctx.lineTo(sx + w / 2 - 2 * cam.z, top);
    ctx.quadraticCurveTo(sx, top - roofH * 0.6, sx - w / 2 + 2 * cam.z, top);
    ctx.lineTo(sx - w / 2 - ov + 3, top);
    ctx.quadraticCurveTo(sx - w * 0.3, top - roofH * 0.72, sx - w * 0.17, top - roofH);
    ctx.closePath();
    ctx.globalAlpha = m.snow * 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  /* eave shadow */
  ctx.fillStyle = "rgba(40,32,24,0.14)";
  ctx.fillRect(sx - w / 2, top, w, 5 * cam.z);

  /* noren curtain */
  if (h.noren) {
    const nc = mixC(hex(h.noren), hex("#8a92a0"), v.night * 0.4);
    const nx = sx + w * 0.16;
    const ny = base - wallH * 0.46;
    for (let i = 0; i < 3; i++) {
      const sway = Math.sin(v.time * 1.6 + i * 1.4 + h.variant) * 1.8 * (v.reduced ? 0.3 : 1);
      ctx.fillStyle = css(nc, 0.96);
      ctx.beginPath();
      ctx.moveTo(nx + i * (dw / 3), ny);
      ctx.lineTo(nx + (i + 1) * (dw / 3) - 1, ny);
      ctx.lineTo(nx + (i + 1) * (dw / 3) - 1 + sway, ny + 15 * cam.z);
      ctx.lineTo(nx + i * (dw / 3) + sway, ny + 15 * cam.z);
      ctx.closePath();
      ctx.fill();
    }
  }

  /* shop dressing */
  if (h.shop && h.shop !== "house" && h.shop !== "teahouse") {
    const sy0 = base;
    if (h.shop === "bakery" || h.shop === "tea") {
      /* open window with goods + steam */
      const ox = sx - w * 0.3;
      ctx.fillStyle = css(hex("#8a6a4a"));
      ctx.fillRect(ox, top + wallH * 0.55, w * 0.3, wallH * 0.3);
      ctx.fillStyle = css(mixC(hex("#ffe9c0"), hex("#ffd9a0"), v.light), 0.95);
      ctx.fillRect(ox + 2 * cam.z, top + wallH * 0.55 + 2 * cam.z, w * 0.3 - 4 * cam.z, wallH * 0.3 - 4 * cam.z);
      if (h.shop === "bakery") {
        ctx.fillStyle = "#d9a05e";
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(ox + (i + 0.6) * w * 0.09, top + wallH * 0.78, 3 * cam.z, Math.PI, 0);
          ctx.fill();
        }
      }
      drawSteam(ctx, ox + w * 0.15, top + wallH * 0.52, v.time, 0.5, cam.z);
    }
    if (h.shop === "grocery" || h.shop === "veg") {
      /* crates */
      for (let i = 0; i < 2; i++) {
        const cx = sx - w * 0.34 + i * w * 0.24;
        ctx.fillStyle = "#a8834e";
        ctx.fillRect(cx, sy0 - 10 * cam.z, w * 0.18, 10 * cam.z);
        const vegCols = ["#d96a4a", "#7ab05e", "#e8a03e"];
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = vegCols[(h.variant + i + k) % 3];
          ctx.beginPath();
          ctx.arc(cx + (k + 0.5) * w * 0.06, sy0 - 12 * cam.z, 2.6 * cam.z, Math.PI, 0);
          ctx.fill();
        }
      }
    }
    if (h.shop === "veg") {
      /* tarp */
      ctx.fillStyle = "rgba(200,80,60,0.9)";
      ctx.beginPath();
      ctx.moveTo(sx - w * 0.42, top + wallH * 0.5);
      ctx.lineTo(sx + w * 0.05, top + wallH * 0.5);
      ctx.lineTo(sx + w * 0.12, top + wallH * 0.62);
      ctx.lineTo(sx - w * 0.48, top + wallH * 0.62);
      ctx.closePath();
      ctx.fill();
    }
    if (h.shop === "flower") {
      const potCols = ["#d97a8a", "#e8c05e", "#b08ad0", "#e8906a"];
      for (let i = 0; i < 4; i++) {
        const fx = sx - w * 0.36 + i * w * 0.17;
        ctx.fillStyle = "#8a6a4a";
        ctx.fillRect(fx, sy0 - 8 * cam.z, 7 * cam.z, 8 * cam.z);
        ctx.fillStyle = potCols[(h.variant + i) % 4];
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.arc(fx + 3.5 * cam.z + (k - 1) * 2.4 * cam.z, sy0 - 11 * cam.z - (k % 2) * 2, 1.9 * cam.z, 0, TAU);
          ctx.fill();
        }
      }
    }
    /* shop sign board */
    ctx.fillStyle = css(mixC(hex("#4a4038"), hex("#5a5a64"), v.night * 0.4));
    ctx.fillRect(sx - w * 0.44, top + wallH * 0.1, 8 * cam.z, wallH * 0.42);
    ctx.fillStyle = "rgba(240,230,210,0.9)";
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(sx - w * 0.44 + 2 * cam.z, top + wallH * 0.14 + i * wallH * 0.12, 4 * cam.z, wallH * 0.07);
    }
  }

  /* door lantern */
  if (h.lantern) {
    const lx = sx + w * 0.16 - 7 * cam.z;
    const ly = base - wallH * 0.56;
    const glow = v.light;
    if (glow > 0.05) {
      const rg = ctx.createRadialGradient(lx, ly, 1, lx, ly, 22 * cam.z);
      rg.addColorStop(0, `rgba(255,190,110,${0.4 * glow})`);
      rg.addColorStop(1, "rgba(255,190,110,0)");
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(lx, ly, 22 * cam.z, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = css(mixC(hex("#d95f4a"), hex("#ff9a5e"), glow * 0.6));
    ctx.beginPath();
    ctx.ellipse(lx, ly, 4.6 * cam.z, 6 * cam.z, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(60,30,20,0.5)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(lx, ly - 6 * cam.z); ctx.lineTo(lx, ly + 6 * cam.z);
    ctx.stroke();
  }

  /* laundry */
  if (h.laundry && m.snow < 0.5) {
    const lx0 = sx + w / 2 + 6 * cam.z;
    const lx1 = lx0 + 34 * cam.z;
    const ly = base - wallH * 0.5;
    ctx.strokeStyle = css(wood);
    ctx.lineWidth = 1.6 * cam.z;
    ctx.beginPath();
    ctx.moveTo(lx0, base); ctx.lineTo(lx0, ly - 4 * cam.z);
    ctx.moveTo(lx1, base); ctx.lineTo(lx1, ly - 4 * cam.z);
    ctx.moveTo(lx0, ly - 3 * cam.z); ctx.lineTo(lx1, ly - 3 * cam.z);
    ctx.stroke();
    const cloths = ["#e8e0cc", "#a8c0d0", "#e0b0a0"];
    cloths.forEach((c, i) => {
      const cx = lx0 + (i + 0.3) * (lx1 - lx0) * 0.3;
      const sway = Math.sin(v.time * 1.3 + i * 2 + h.variant) * 2 * (v.reduced ? 0.3 : 1);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(cx, ly - 2 * cam.z);
      ctx.lineTo(cx + 9 * cam.z, ly - 2 * cam.z);
      ctx.lineTo(cx + 9 * cam.z + sway, ly + 11 * cam.z);
      ctx.lineTo(cx + sway, ly + 11 * cam.z);
      ctx.closePath();
      ctx.fill();
    });
  }

  /* kitchen smoke */
  if (h.smoke && smokeA > 0.02) {
    drawSmoke(ctx, sx + w * 0.1, top - roofH + 4 * cam.z, v.time + h.variant * 3, smokeA, cam.z);
  }
}

export function drawSteam(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, a: number, z: number) {
  for (let i = 0; i < 3; i++) {
    const u = (t * 0.5 + i * 0.34) % 1;
    ctx.fillStyle = `rgba(255,255,255,${(1 - u) * 0.32 * a})`;
    ctx.beginPath();
    ctx.arc(x + Math.sin(u * 6 + i * 2) * 3 * z, y - u * 22 * z, (1.6 + u * 3.4) * z, 0, TAU);
    ctx.fill();
  }
}

function drawSmoke(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, a: number, z: number) {
  for (let i = 0; i < 4; i++) {
    const u = (t * 0.16 + i * 0.25) % 1;
    ctx.fillStyle = `rgba(240,238,232,${(1 - u) * 0.3 * a})`;
    ctx.beginPath();
    ctx.arc(x + Math.sin(u * 5 + i) * 7 * z + u * 10 * z, y - u * 52 * z, (3 + u * 8) * z, 0, TAU);
    ctx.fill();
  }
}

/* ================================================= TREES */
export function drawTree(ctx: CanvasRenderingContext2D, t: Tree, v: View, cam: Cam) {
  const sx = cam.X(t.x);
  if (!inView(sx, v.w, 380)) return;
  const m = v.season;
  const z = cam.z * t.s;
  const gy = cam.Y(terrainY(t.x) - 4, 1);
  const trunkH = 36 * z;
  const sway = Math.sin(v.time * 0.9 + t.seed) * 1.7 * (v.reduced ? 0.4 : 1) * z;
  const leafAmount = t.type === "pine" ? 1 : 1 - m.winter * 0.92;

  /* trunk */
  ctx.strokeStyle = css(mixC(hex("#7a5c42"), hex("#6a5a50"), m.snow * 0.3));
  ctx.lineWidth = 4.4 * z;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(sx, gy);
  ctx.quadraticCurveTo(sx + sway * 0.3, gy - trunkH * 0.6, sx + sway * 0.6, gy - trunkH);
  ctx.stroke();

  if (leafAmount < 0.32 && t.type !== "pine") {
    /* bare winter branches */
    ctx.lineWidth = 1.6 * z;
    ctx.strokeStyle = css(mixC(hex("#7a5c42"), hex("#9aa0a8"), m.snow * 0.4));
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.5 + vnoise(t.seed + i) * 0.3;
      const len = (16 + vnoise(t.seed * 2 + i) * 14) * z;
      const bx = sx + sway * 0.6;
      const by = gy - trunkH;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(a) * len, by + Math.sin(a) * len);
      ctx.stroke();
    }
    if (m.snow > 0.3) {
      ctx.fillStyle = css(SNOW, m.snow * 0.8);
      ctx.beginPath();
      ctx.ellipse(sx + sway * 0.6, gy - trunkH - 2, 10 * z, 3 * z, 0, 0, TAU);
      ctx.fill();
    }
    /* cherry hints tiny buds in early return-spring */
    if (t.type === "cherry" && m.bloom > 0.05) {
      ctx.fillStyle = css(hex("#f2aec2"), m.bloom * 0.8);
      for (let i = 0; i < 6; i++) {
        const a = vnoise(t.seed + i * 3) * TAU;
        const rr = (8 + vnoise(t.seed + i) * 12) * z;
        ctx.beginPath();
        ctx.arc(sx + sway * 0.6 + Math.cos(a) * rr, gy - trunkH + Math.sin(a) * rr * 0.7, 2 * z, 0, TAU);
        ctx.fill();
      }
    }
    return;
  }

  const col = leafCol(v, t.type);
  if (t.type === "pine") {
    ctx.fillStyle = css(col, 0.96);
    for (let i = 0; i < 3; i++) {
      const ty = gy - trunkH * 0.35 - i * 15 * z;
      const rw = (20 - i * 5) * z;
      ctx.beginPath();
      ctx.moveTo(sx + sway * (0.3 + i * 0.2) - rw, ty);
      ctx.lineTo(sx + sway * (0.4 + i * 0.2), ty - 20 * z);
      ctx.lineTo(sx + sway * (0.3 + i * 0.2) + rw, ty);
      ctx.closePath();
      ctx.fill();
    }
    if (m.snow > 0.2) {
      ctx.fillStyle = css(SNOW, m.snow * 0.75);
      for (let i = 0; i < 3; i++) {
        const ty = gy - trunkH * 0.35 - i * 15 * z;
        ctx.beginPath();
        ctx.ellipse(sx + sway * 0.4, ty - 12 * z, (12 - i * 3) * z, 3 * z, 0, 0, TAU);
        ctx.fill();
      }
    }
    return;
  }
  if (t.type === "willow") {
    const cx = sx + sway * 0.6;
    const cy = gy - trunkH;
    ctx.fillStyle = css(col, 0.9);
    ctx.beginPath();
    ctx.ellipse(cx, cy - 6 * z, 20 * z, 14 * z, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = css(mixC(col, hex("#ffffff"), 0.12), 0.8);
    ctx.lineWidth = 1.4 * z;
    for (let i = -3; i <= 3; i++) {
      const sxp = cx + i * 5.4 * z;
      const drop = (26 + vnoise(t.seed + i) * 16) * z;
      const sw2 = Math.sin(v.time * 1.4 + i + t.seed) * 3.4 * z * (v.reduced ? 0.4 : 1);
      ctx.beginPath();
      ctx.moveTo(sxp, cy);
      ctx.quadraticCurveTo(sxp + sw2 * 0.5, cy + drop * 0.6, sxp + sw2, cy + drop);
      ctx.stroke();
    }
    return;
  }

  /* blob canopy */
  const cx = sx + sway * 0.6;
  const cy = gy - trunkH;
  const blobs = t.type === "cherry" ? 6 : 5;
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * TAU + vnoise(t.seed + i) * 1.4;
    const rr = (13 + vnoise(t.seed * 3 + i) * 9) * z * (0.4 + leafAmount * 0.6);
    const bx = cx + Math.cos(a) * 11 * z;
    const by = cy - 6 * z + Math.sin(a) * 7 * z;
    ctx.fillStyle = css(mixC(col, i % 2 ? hex("#ffffff") : hex("#3a5a3a"), i % 2 ? 0.1 : 0.08), 0.95 * (0.5 + leafAmount * 0.5));
    ctx.beginPath();
    ctx.arc(bx, by, rr, 0, TAU);
    ctx.fill();
  }
  if (t.type === "cherry" && m.bloom > 0.3) {
    ctx.fillStyle = css(hex("#e889a4"), m.bloom * 0.5);
    for (let i = 0; i < 7; i++) {
      const a = vnoise(t.seed + i * 7) * TAU;
      const rr = vnoise(t.seed + i * 3) * 16 * z;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * rr, cy - 6 * z + Math.sin(a) * rr * 0.6, 1.6 * z, 0, TAU);
      ctx.fill();
    }
  }
}

/* ================================================= SHRINE */
export function drawShrine(ctx: CanvasRenderingContext2D, v: View, cam: Cam) {
  const m = v.season;
  if (v.camX < 7400 || v.camX > 9800) return;
  const wood = mixC(hex("#c4553b"), hex("#a85a4a"), v.night * 0.3);

  /* torii */
  const tx = cam.X(8200);
  const tgy = cam.Y(terrainY(8200) + 2, 1);
  const z = cam.z;
  const th = 100 * z;
  ctx.fillStyle = css(wood);
  ctx.fillRect(tx - 30 * z, tgy - th, 7 * z, th);
  ctx.fillRect(tx + 23 * z, tgy - th, 7 * z, th);
  ctx.fillStyle = css(mixC(wood, hex("#2a2a2e"), 0.5));
  ctx.fillRect(tx - 31 * z, tgy - 5 * z, 9 * z, 5 * z);
  ctx.fillRect(tx + 22 * z, tgy - 5 * z, 9 * z, 5 * z);
  /* kasagi (curved top) */
  ctx.fillStyle = css(mixC(wood, hex("#3a3230"), 0.35));
  ctx.beginPath();
  ctx.moveTo(tx - 46 * z, tgy - th - 2 * z);
  ctx.quadraticCurveTo(tx, tgy - th - 13 * z, tx + 46 * z, tgy - th - 2 * z);
  ctx.lineTo(tx + 46 * z, tgy - th + 5 * z);
  ctx.quadraticCurveTo(tx, tgy - th - 5 * z, tx - 46 * z, tgy - th + 5 * z);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(wood);
  ctx.fillRect(tx - 40 * z, tgy - th + 13 * z, 80 * z, 5.5 * z);
  /* shide (paper streamers) */
  ctx.fillStyle = "rgba(250,248,240,0.95)";
  for (let i = -1; i <= 1; i++) {
    const px = tx + i * 22 * z;
    const sway = Math.sin(v.time * 1.8 + i) * 1.6 * z;
    ctx.beginPath();
    ctx.moveTo(px, tgy - th + 19 * z);
    ctx.lineTo(px + 3 * z + sway * 0.4, tgy - th + 25 * z);
    ctx.lineTo(px + sway, tgy - th + 31 * z);
    ctx.lineTo(px - 2.4 * z + sway, tgy - th + 31 * z);
    ctx.lineTo(px - 1.6 * z + sway * 0.4, tgy - th + 25 * z);
    ctx.lineTo(px - 4 * z, tgy - th + 19 * z);
    ctx.closePath();
    ctx.fill();
  }
  if (m.snow > 0.2) {
    ctx.fillStyle = css(SNOW, m.snow * 0.9);
    ctx.beginPath();
    ctx.moveTo(tx - 45 * z, tgy - th - 1 * z);
    ctx.quadraticCurveTo(tx, tgy - th - 12 * z, tx + 45 * z, tgy - th - 1 * z);
    ctx.lineTo(tx + 45 * z, tgy - th + 2 * z);
    ctx.quadraticCurveTo(tx, tgy - th - 8 * z, tx - 45 * z, tgy - th + 2 * z);
    ctx.fill();
  }

  /* stone lanterns */
  for (const lx of [8360, 8520]) {
    const sx = cam.X(lx);
    if (!inView(sx, v.w)) continue;
    const gy = cam.Y(terrainY(lx) + 6, 1);
    const st = mixC(hex("#a8a49a"), SNOW, m.snow * 0.6);
    ctx.fillStyle = css(st);
    ctx.fillRect(sx - 6 * z, gy - 5 * z, 12 * z, 5 * z);
    ctx.fillRect(sx - 2.6 * z, gy - 20 * z, 5.2 * z, 15 * z);
    ctx.fillRect(sx - 7 * z, gy - 30 * z, 14 * z, 10 * z);
    ctx.beginPath();
    ctx.moveTo(sx - 10 * z, gy - 30 * z);
    ctx.lineTo(sx, gy - 40 * z);
    ctx.lineTo(sx + 10 * z, gy - 30 * z);
    ctx.closePath();
    ctx.fill();
    if (v.light > 0.05) {
      ctx.fillStyle = `rgba(255,210,140,${0.85 * v.light})`;
      ctx.fillRect(sx - 3.4 * z, gy - 28 * z, 6.8 * z, 6 * z);
      const rg = ctx.createRadialGradient(sx, gy - 25 * z, 1, sx, gy - 25 * z, 18 * z);
      rg.addColorStop(0, `rgba(255,210,140,${0.3 * v.light})`);
      rg.addColorStop(1, "rgba(255,210,140,0)");
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(sx, gy - 25 * z, 18 * z, 0, TAU); ctx.fill();
    }
  }

  /* honden (small hall) on the hill */
  const hx = cam.X(8860);
  if (inView(hx, v.w, 500)) {
    const gy = cam.Y(terrainY(8860) - 12, 1);
    const hw = 92 * z;
    const hh = 52 * z;
    ctx.fillStyle = css(mixC(hex("#b08a5e"), SNOW, m.snow * 0.2));
    ctx.fillRect(hx - hw / 2, gy - hh, hw, hh);
    ctx.fillStyle = css(mixC(hex("#5a554e"), hex("#98a0a8"), m.snow * 0.4));
    ctx.beginPath();
    ctx.moveTo(hx - hw / 2 - 12 * z, gy - hh);
    ctx.quadraticCurveTo(hx, gy - hh - 34 * z, hx + hw / 2 + 12 * z, gy - hh);
    ctx.closePath();
    ctx.fill();
    /* chigi */
    ctx.strokeStyle = css(mixC(hex("#5a554e"), SNOW, m.snow * 0.3));
    ctx.lineWidth = 3 * z;
    ctx.beginPath();
    ctx.moveTo(hx - 8 * z, gy - hh - 24 * z); ctx.lineTo(hx + 10 * z, gy - hh - 40 * z);
    ctx.moveTo(hx + 8 * z, gy - hh - 24 * z); ctx.lineTo(hx - 10 * z, gy - hh - 40 * z);
    ctx.stroke();
    /* door + offering box */
    ctx.fillStyle = css(mixC(hex("#6a4a32"), hex("#7a6a5e"), m.snow * 0.3));
    ctx.fillRect(hx - 12 * z, gy - hh * 0.62, 24 * z, hh * 0.62);
    ctx.fillStyle = "#5a4a38";
    ctx.fillRect(hx - 10 * z, gy - 7 * z, 20 * z, 7 * z);
    /* suzu bell + rope */
    const bellSwing = Math.sin(v.time * 1.1) * 0.12 + window01(v.p, 0.325, 0.36) * Math.sin(v.time * 7) * 0.3;
    ctx.save();
    ctx.translate(hx + 26 * z, gy - hh - 4 * z);
    ctx.rotate(bellSwing);
    ctx.strokeStyle = "#c9b088";
    ctx.lineWidth = 1.8 * z;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 20 * z); ctx.stroke();
    ctx.fillStyle = "#d8c08a";
    ctx.beginPath(); ctx.arc(0, 23 * z, 4 * z, 0, TAU); ctx.fill();
    ctx.fillStyle = "#c95a4a";
    ctx.fillRect(-2.6 * z, 12 * z, 5.2 * z, 6 * z);
    ctx.restore();
  }
}

/* ================================================= STATION & TRAIN */
export function drawStation(ctx: CanvasRenderingContext2D, v: View, cam: Cam) {
  if (v.camX < 6200 || v.camX > 8800) return;
  const m = v.season;
  const z = cam.z;

  /* tracks (behind, elevated slightly) */
  const ty = cam.Y(-52, 1);
  const gx0 = cam.X(6850);
  const gx1 = cam.X(7980);
  ctx.fillStyle = css(mixC(hex("#a89a82"), SNOW, m.snow * 0.7), 0.9);
  ctx.fillRect(gx0, ty - 8 * z, gx1 - gx0, 16 * z);
  ctx.strokeStyle = "rgba(70,60,50,0.5)";
  ctx.lineWidth = 2.4 * z;
  for (let x = 6860; x < 7980; x += 20) {
    const sx = cam.X(x);
    ctx.beginPath();
    ctx.moveTo(sx, ty - 6 * z);
    ctx.lineTo(sx, ty + 6 * z);
    ctx.stroke();
  }
  ctx.strokeStyle = css(mixC(hex("#8a8e94"), hex("#c0c8d0"), m.snow * 0.4));
  ctx.lineWidth = 2 * z;
  ctx.beginPath();
  ctx.moveTo(gx0, ty - 3.4 * z); ctx.lineTo(gx1, ty - 3.4 * z);
  ctx.moveTo(gx0, ty + 3.4 * z); ctx.lineTo(gx1, ty + 3.4 * z);
  ctx.stroke();

  /* platform */
  const py = cam.Y(-16, 1);
  ctx.fillStyle = css(mixC(hex("#c4beb2"), SNOW, m.snow * 0.6));
  ctx.fillRect(cam.X(7120), py, cam.X(7720) - cam.X(7120), 10 * z);
  ctx.fillStyle = "rgba(70,60,50,0.25)";
  ctx.fillRect(cam.X(7120), py + 10 * z, cam.X(7720) - cam.X(7120), 3 * z);

  /* shelter */
  const sx = cam.X(7480);
  const sgy = py;
  ctx.strokeStyle = css(mixC(hex("#6a5340"), SNOW, m.snow * 0.3));
  ctx.lineWidth = 3 * z;
  ctx.beginPath();
  ctx.moveTo(sx - 40 * z, sgy); ctx.lineTo(sx - 40 * z, sgy - 52 * z);
  ctx.moveTo(sx + 40 * z, sgy); ctx.lineTo(sx + 40 * z, sgy - 52 * z);
  ctx.stroke();
  ctx.fillStyle = css(mixC(hex("#55524e"), hex("#8a9098"), m.snow * 0.45));
  ctx.beginPath();
  ctx.moveTo(sx - 52 * z, sgy - 52 * z);
  ctx.lineTo(sx, sgy - 66 * z);
  ctx.lineTo(sx + 52 * z, sgy - 52 * z);
  ctx.closePath();
  ctx.fill();
  if (m.snow > 0.2) {
    ctx.fillStyle = css(SNOW, m.snow * 0.85);
    ctx.beginPath();
    ctx.moveTo(sx - 50 * z, sgy - 53 * z);
    ctx.lineTo(sx, sgy - 65 * z);
    ctx.lineTo(sx + 50 * z, sgy - 53 * z);
    ctx.lineTo(sx + 50 * z, sgy - 50 * z);
    ctx.lineTo(sx, sgy - 62 * z);
    ctx.lineTo(sx - 50 * z, sgy - 50 * z);
    ctx.fill();
  }
  /* bench */
  ctx.fillStyle = "#8a6b4a";
  ctx.fillRect(sx - 26 * z, sgy - 14 * z, 52 * z, 4 * z);
  ctx.fillRect(sx - 24 * z, sgy - 10 * z, 4 * z, 10 * z);
  ctx.fillRect(sx + 20 * z, sgy - 10 * z, 4 * z, 10 * z);
  /* sign */
  const gx = cam.X(7200);
  ctx.strokeStyle = "#6a6258";
  ctx.lineWidth = 2.4 * z;
  ctx.beginPath();
  ctx.moveTo(gx, sgy); ctx.lineTo(gx, sgy - 44 * z);
  ctx.stroke();
  ctx.fillStyle = "#efe8d8";
  ctx.fillRect(gx - 16 * z, sgy - 44 * z, 32 * z, 13 * z);
  ctx.fillStyle = "#4a7a9a";
  ctx.fillRect(gx - 16 * z, sgy - 44 * z, 32 * z, 3.6 * z);
  ctx.fillStyle = "#4a4038";
  for (let i = 0; i < 3; i++) ctx.fillRect(gx - 11 * z + i * 8 * z, sgy - 38 * z, 5 * z, 5 * z);

  drawTrain(ctx, v, cam, ty);
}

function drawTrain(ctx: CanvasRenderingContext2D, v: View, cam: Cam, trackY: number) {
  const tr = trainState(v.time);
  if (!tr.visible) return;
  const sx = cam.X(tr.x);
  if (!inView(sx, v.w, 900)) return;
  const z = cam.z;
  const bounce = tr.moving ? Math.sin(v.time * 26) * 0.7 * z : 0;
  const y = trackY - 30 * z + bounce;
  const L = 300 * z;
  const Hh = 30 * z;

  /* cars */
  for (let cIdx = 0; cIdx < 2; cIdx++) {
    const cx0 = sx + cIdx * (L * 0.52);
    ctx.fillStyle = css(mixC(hex("#efe8d4"), hex("#c8ccd8"), v.night * 0.25));
    ctx.beginPath();
    if (cIdx === 0) {
      ctx.moveTo(cx0 - 14 * z, y + Hh);
      ctx.lineTo(cx0 - 8 * z, y + 4 * z);
      ctx.quadraticCurveTo(cx0, y, cx0 + 12 * z, y);
      ctx.lineTo(cx0 + L * 0.52, y);
      ctx.lineTo(cx0 + L * 0.52, y + Hh);
    } else {
      ctx.rect(cx0, y, L * 0.5, Hh);
    }
    ctx.closePath();
    ctx.fill();
    /* stripe */
    ctx.fillStyle = "#e07a4a";
    ctx.fillRect(cx0 - (cIdx === 0 ? 10 * z : 0), y + Hh * 0.62, L * 0.52 + (cIdx === 0 ? 10 * z : 0), 4.6 * z);
    /* windows */
    const lit = v.light > 0.1;
    ctx.fillStyle = lit ? "rgba(255,220,150,0.95)" : "rgba(120,150,170,0.8)";
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(cx0 + 12 * z + i * 26 * z, y + 5 * z, 16 * z, 10 * z);
    }
    /* door — slides open while stopped */
    const dw = 11 * z;
    const open = tr.doors * dw * 0.9;
    const half = (dw - open) / 2;
    ctx.fillStyle = css(mixC(hex("#d8d0bc"), hex("#b0b8c4"), v.night * 0.3));
    ctx.fillRect(cx0 + L * 0.25 - open / 2 - half, y + 4 * z, half, Hh - 6 * z);
    ctx.fillRect(cx0 + L * 0.25 + open / 2, y + 4 * z, half, Hh - 6 * z);
    /* window wave during stop */
    if (cIdx === 0 && !tr.moving && tr.doors > 0.5) {
      const wxp = cx0 + 12 * z + 3 * 26 * z + 8 * z;
      const wave = Math.sin(v.time * 4) * 2.4 * z;
      ctx.fillStyle = "#f0c8a0";
      ctx.beginPath();
      ctx.arc(wxp, y + 8 * z + wave * 0.2, 2.6 * z, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "#e8a06a";
      ctx.lineWidth = 1.6 * z;
      ctx.beginPath();
      ctx.moveTo(wxp + 2 * z, y + 10 * z);
      ctx.lineTo(wxp + 5 * z, y + 5 * z + wave);
      ctx.stroke();
    }
  }
  /* headlight at dawn/night */
  if (v.light > 0.1) {
    const rg = ctx.createRadialGradient(sx - 12 * z, y + Hh * 0.5, 1, sx - 12 * z, y + Hh * 0.5, 40 * z);
    rg.addColorStop(0, `rgba(255,240,190,${0.5 * v.light})`);
    rg.addColorStop(1, "rgba(255,240,190,0)");
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(sx - 12 * z, y + Hh * 0.5, 40 * z, 0, TAU); ctx.fill();
  }
}

/* ================================================= FESTIVAL */
export function drawFestival(ctx: CanvasRenderingContext2D, v: View, cam: Cam) {
  const festA = window01(v.p, 0.645, 0.78, 0.02, 0.02);
  if (festA < 0.02) return;
  const m = v.season;
  const z = cam.z;
  ctx.save();
  ctx.globalAlpha *= Math.min(1, festA * 1.4);

  /* bamboo poles carrying the lantern strings */
  const poles = v.world.festivalPoles;
  ctx.strokeStyle = css(mixC(hex("#8a7a5e"), hex("#9a9288"), v.night * 0.3), 0.95);
  ctx.lineWidth = 3 * z;
  for (const pxw of poles) {
    const px = cam.X(pxw);
    if (!inView(px, v.w, 400)) continue;
    ctx.beginPath();
    ctx.moveTo(px, cam.Y(terrainY(pxw) + 6, 1));
    ctx.lineTo(px, cam.Y(terrainY(pxw) - 128, 1));
    ctx.stroke();
  }
  for (let i = 0; i < poles.length - 1; i++) {
    const a = poles[i];
    const b = poles[i + 1];
    const ax = cam.X(a);
    const bx = cam.X(b);
    const topY = cam.Y(terrainY(a) - 128, 1);
    ctx.strokeStyle = "rgba(60,50,40,0.55)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(ax, topY);
    ctx.quadraticCurveTo((ax + bx) / 2, topY + 30 * z, bx, topY);
    ctx.stroke();
    const nL = 7;
    for (let k = 1; k < nL; k++) {
      const u = k / nL;
      const lx = ax + (bx - ax) * u;
      const sag = Math.sin(u * Math.PI);
      const ly = topY + 30 * z * sag + 5 * z;
      const glow = v.light * (0.65 + 0.35 * Math.sin(v.time * 2 + k + i));
      if (glow > 0.05) {
        const rg = ctx.createRadialGradient(lx, ly, 1, lx, ly, 16 * z);
        rg.addColorStop(0, `rgba(255,196,120,${0.4 * glow})`);
        rg.addColorStop(1, "rgba(255,196,120,0)");
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(lx, ly, 16 * z, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = css(mixC(hex("#f0e0c0"), hex("#ffbe6e"), glow), 0.96);
      ctx.beginPath();
      ctx.ellipse(lx, ly, 4 * z, 5.4 * z, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(120,60,40,0.5)";
      ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(lx, ly - 5.4 * z); ctx.lineTo(lx, ly + 5.4 * z); ctx.stroke();
    }
  }

  /* stalls */
  for (const st of v.world.stalls) {
    const sx = cam.X(st.x);
    if (!inView(sx, v.w, 400)) continue;
    const gy = cam.Y(terrainY(st.x) - 10, 1);
    const wSt = 76 * z;
    const hSt = 46 * z;
    /* body */
    ctx.fillStyle = css(mixC(hex("#b08a5e"), hex("#8a7a68"), v.night * 0.3));
    ctx.fillRect(sx - wSt / 2, gy - hSt, wSt, hSt);
    /* counter */
    ctx.fillStyle = "#c9a56e";
    ctx.fillRect(sx - wSt / 2 - 4 * z, gy - hSt * 0.42, wSt + 8 * z, 5 * z);
    /* striped awning */
    const cols = st.stripe === 0 ? ["#cf5a4a", "#f0e8d8"] : ["#4a6a9a", "#f0e8d8"];
    const nS = 8;
    for (let i = 0; i < nS; i++) {
      ctx.fillStyle = css(mixC(hex(cols[i % 2]), hex("#8a90a0"), v.night * 0.35), 0.96);
      const x0 = sx - wSt / 2 - 6 * z + (i * (wSt + 12 * z)) / nS;
      ctx.beginPath();
      ctx.moveTo(x0, gy - hSt - 12 * z);
      ctx.lineTo(x0 + (wSt + 12 * z) / nS, gy - hSt - 12 * z);
      ctx.lineTo(x0 + (wSt + 12 * z) / nS, gy - hSt + 4 * z);
      ctx.lineTo(x0, gy - hSt + 4 * z);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = css(mixC(hex("#55524e"), hex("#3a3a44"), v.night * 0.3));
    ctx.fillRect(sx - wSt / 2 - 8 * z, gy - hSt - 15 * z, wSt + 16 * z, 4 * z);
    /* warm pool of light */
    if (v.light > 0.05) {
      const rg = ctx.createRadialGradient(sx, gy - hSt * 0.3, 4, sx, gy - hSt * 0.3, 70 * z);
      rg.addColorStop(0, `rgba(255,200,120,${0.32 * v.light})`);
      rg.addColorStop(1, "rgba(255,200,120,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(sx - 70 * z, gy - hSt - 30 * z, 140 * z, hSt + 60 * z);
    }
    /* goods */
    if (st.kind === 0) {
      ctx.fillStyle = "#d9a05e";
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(sx - 20 * z + i * 10 * z, gy - hSt * 0.42 - 3 * z, 3 * z, Math.PI, 0);
        ctx.fill();
      }
    } else if (st.kind === 1) {
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = "#d94a3a";
        ctx.beginPath();
        ctx.arc(sx - 14 * z + i * 14 * z, gy - hSt * 0.42 - 6 * z, 3.4 * z, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "#8a6b45";
        ctx.lineWidth = 1.2 * z;
        ctx.beginPath();
        ctx.moveTo(sx - 14 * z + i * 14 * z, gy - hSt * 0.42 - 3 * z);
        ctx.lineTo(sx - 14 * z + i * 14 * z, gy - hSt * 0.42 + 1 * z);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = "#e8f0f4";
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(sx - 18 * z + i * 14 * z - 4 * z, gy - hSt * 0.42 - 2 * z);
        ctx.lineTo(sx - 18 * z + i * 14 * z, gy - hSt * 0.42 - 9 * z);
        ctx.lineTo(sx - 18 * z + i * 14 * z + 4 * z, gy - hSt * 0.42 - 2 * z);
        ctx.closePath();
        ctx.fill();
      }
    }
    /* small stall lantern */
    const lg = v.light;
    ctx.fillStyle = css(mixC(hex("#e8d8b8"), hex("#ffc46e"), lg), 0.95);
    ctx.beginPath();
    ctx.ellipse(sx + wSt / 2 - 4 * z, gy - hSt + 10 * z, 3.4 * z, 4.6 * z, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/* ================================================= FOREGROUND */
export function drawForeground(ctx: CanvasRenderingContext2D, v: View, cam: Cam) {
  const m = v.season;
  const grass = mixC(grassCol(v), hex("#3a5a3a"), 0.28);

  for (const f of v.world.foreground) {
    const par = f.par;
    const sx = cam.X(f.x, par);
    if (!inView(sx, v.w, 500)) continue;
    const gy = cam.Y(52 + (par - 1.12) * 90, par);
    if (f.kind === "grass") {
      const sway = Math.sin(v.time * 1.7 + f.seed) * 2.4 * (v.reduced ? 0.3 : 1);
      ctx.strokeStyle = css(mixC(grass, SNOW, m.snow * 0.8), 0.9);
      ctx.lineWidth = 1.6 * cam.z * f.s;
      ctx.beginPath();
      for (let i = -2; i <= 2; i++) {
        ctx.moveTo(sx + i * 3.4, gy);
        ctx.quadraticCurveTo(sx + i * 4 + sway * 0.5, gy - 9 * f.s, sx + i * 4.6 + sway, gy - 16 * f.s);
      }
      ctx.stroke();
    } else if (f.kind === "flower" && m.snow < 0.5) {
      const sway = Math.sin(v.time * 1.5 + f.seed) * 2;
      ctx.strokeStyle = css(grass, 0.9);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(sx, gy);
      ctx.quadraticCurveTo(sx + sway * 0.4, gy - 8, sx + sway, gy - 15 * f.s);
      ctx.stroke();
      ctx.fillStyle = ["#e8a0b0", "#f0e0a0", "#e0b0d0"][Math.floor(f.seed) % 3];
      ctx.beginPath();
      ctx.arc(sx + sway, gy - 16 * f.s, 3 * f.s, 0, TAU);
      ctx.fill();
    } else if (f.kind === "bush") {
      const col = mixC(leafCol(v, "green"), hex("#2a4a2a"), 0.25);
      ctx.fillStyle = css(mixC(col, SNOW, m.snow * 0.6), 0.96);
      const r = 16 * f.s * cam.z;
      ctx.beginPath();
      ctx.arc(sx - r * 0.8, gy, r * 0.8, Math.PI, 0);
      ctx.arc(sx, gy - 2, r, Math.PI, 0);
      ctx.arc(sx + r * 0.8, gy, r * 0.75, Math.PI, 0);
      ctx.fill();
      if (m.snow > 0.3) {
        ctx.fillStyle = css(SNOW, m.snow * 0.8);
        ctx.beginPath();
        ctx.ellipse(sx, gy - r * 0.9, r * 0.9, 3.4, 0, 0, TAU);
        ctx.fill();
      }
    } else if (f.kind === "fence") {
      const fx0 = sx;
      const span = 240 * cam.z;
      ctx.strokeStyle = css(mixC(hex("#8a7355"), hex("#a8a8b0"), m.snow * 0.4), 0.95);
      ctx.lineWidth = 3 * cam.z;
      for (let i = 0; i < 6; i++) {
        const px = fx0 + (i * span) / 5;
        ctx.beginPath();
        ctx.moveTo(px, gy + 4);
        ctx.lineTo(px, gy - 30 * cam.z);
        ctx.stroke();
      }
      ctx.lineWidth = 2.4 * cam.z;
      ctx.beginPath();
      ctx.moveTo(fx0, gy - 24 * cam.z); ctx.lineTo(fx0 + span, gy - 24 * cam.z);
      ctx.moveTo(fx0, gy - 12 * cam.z); ctx.lineTo(fx0 + span, gy - 12 * cam.z);
      ctx.stroke();
      if (m.snow > 0.25) {
        ctx.fillStyle = css(SNOW, m.snow * 0.85);
        for (let i = 0; i < 6; i++) {
          const px = fx0 + (i * span) / 5;
          ctx.beginPath();
          ctx.ellipse(px, gy - 30 * cam.z, 3.6, 2, 0, 0, TAU);
          ctx.fill();
        }
      }
    } else if (f.kind === "branch") {
      drawBranch(ctx, v, cam, sx, f);
    }
  }
}

function drawBranch(ctx: CanvasRenderingContext2D, v: View, cam: Cam, sx: number, f: { s: number; seed: number; side?: 1 | -1 }) {
  const m = v.season;
  const side = f.side ?? 1;
  const fromLeft = side < 0;
  const x0 = fromLeft ? sx - v.w * 0.28 : sx + v.w * 0.28;
  const y0 = -30;
  const sway = Math.sin(v.time * 0.6 + f.seed) * 0.02 * (v.reduced ? 0.3 : 1);
  const leafAmount = 1 - m.winter * 0.9;
  const col = mixC(leafCol(v, m.bloom > 0.4 ? "cherry" : "green"), hex("#1a3a2a"), 0.3);

  ctx.save();
  ctx.translate(x0, y0);
  ctx.rotate(sway);
  ctx.strokeStyle = css(mixC(hex("#5a4632"), SNOW, m.snow * 0.2), 0.95);
  ctx.lineWidth = 9 * f.s * cam.z;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  const dir = fromLeft ? 1 : -1;
  ctx.quadraticCurveTo(dir * 140 * f.s, 60 * f.s, dir * 260 * f.s, 150 * f.s);
  ctx.stroke();
  ctx.lineWidth = 4.5 * f.s * cam.z;
  ctx.beginPath();
  ctx.moveTo(dir * 130 * f.s, 56 * f.s);
  ctx.quadraticCurveTo(dir * 220 * f.s, 70 * f.s, dir * 280 * f.s, 60 * f.s);
  ctx.stroke();

  if (leafAmount > 0.25 || m.bloom > 0.2) {
    const clusters = [
      [200, 90, 46], [270, 150, 40], [300, 55, 34], [150, 60, 30], [240, 110, 36],
    ];
    for (const [cx, cy, r] of clusters) {
      ctx.fillStyle = css(col, 0.94);
      ctx.beginPath();
      ctx.arc(dir * cx * f.s, cy * f.s, r * f.s * leafAmount, 0, TAU);
      ctx.fill();
      if (m.bloom > 0.4) {
        ctx.fillStyle = css(hex("#f2aec2"), m.bloom * 0.55);
        for (let i = 0; i < 5; i++) {
          const a = vnoise(f.seed + i + cx) * TAU;
          ctx.beginPath();
          ctx.arc(dir * cx * f.s + Math.cos(a) * r * 0.6, cy * f.s + Math.sin(a) * r * 0.5, 3.4 * f.s, 0, TAU);
          ctx.fill();
        }
      }
    }
  }
  ctx.restore();
}

/* ================================================= TEA HOUSE INTERIOR */
export function drawTeahouseInterior(ctx: CanvasRenderingContext2D, v: View, a: number) {
  if (a < 0.01) return;
  const { w, h } = v;
  ctx.save();
  ctx.globalAlpha = a;

  /* back wall */
  const wg = ctx.createLinearGradient(0, 0, 0, h);
  wg.addColorStop(0, "#5e4430");
  wg.addColorStop(1, "#7a5a3c");
  ctx.fillStyle = wg;
  ctx.fillRect(0, 0, w, h);

  /* window — snowy outside */
  const wx0 = w * 0.08, wy0 = h * 0.14, ww = w * 0.3, wh = h * 0.46;
  const og = ctx.createLinearGradient(0, wy0, 0, wy0 + wh);
  og.addColorStop(0, "#c8d8e4");
  og.addColorStop(1, "#e8eef2");
  ctx.fillStyle = og;
  ctx.fillRect(wx0, wy0, ww, wh);
  /* outside silhouette */
  ctx.fillStyle = "#aebfca";
  ctx.beginPath();
  ctx.moveTo(wx0, wy0 + wh * 0.7);
  ctx.quadraticCurveTo(wx0 + ww * 0.4, wy0 + wh * 0.5, wx0 + ww, wy0 + wh * 0.72);
  ctx.lineTo(wx0 + ww, wy0 + wh);
  ctx.lineTo(wx0, wy0 + wh);
  ctx.fill();
  ctx.strokeStyle = "#8a9aa6";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(wx0 + ww * 0.72, wy0 + wh * 0.62);
  ctx.quadraticCurveTo(wx0 + ww * 0.7, wy0 + wh * 0.3, wx0 + ww * 0.78, wy0 + wh * 0.16);
  ctx.stroke();
  /* falling snow outside */
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  for (let i = 0; i < 26; i++) {
    const u = (v.time * 0.06 * (1 + (i % 3) * 0.4) + i * 0.13) % 1;
    const fx = wx0 + ((i * 53.7) % ww) + Math.sin(v.time + i) * 6;
    ctx.globalAlpha = a * (0.5 + (i % 3) * 0.2);
    ctx.beginPath();
    ctx.arc(fx, wy0 + u * wh, 1.6 + (i % 3), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = a;
  /* window frame */
  ctx.strokeStyle = "#4a3626";
  ctx.lineWidth = 8;
  ctx.strokeRect(wx0, wy0, ww, wh);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(wx0 + ww / 2, wy0); ctx.lineTo(wx0 + ww / 2, wy0 + wh);
  ctx.moveTo(wx0, wy0 + wh / 2); ctx.lineTo(wx0 + ww, wy0 + wh / 2);
  ctx.stroke();

  /* shoji panels on the right */
  const sx0 = w * 0.58;
  ctx.fillStyle = "#f2e2c0";
  ctx.fillRect(sx0, h * 0.1, w * 0.36, h * 0.55);
  ctx.strokeStyle = "#8a6a48";
  ctx.lineWidth = 5;
  ctx.strokeRect(sx0, h * 0.1, w * 0.36, h * 0.55);
  ctx.lineWidth = 2.4;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(sx0 + (i * w * 0.36) / 4, h * 0.1);
    ctx.lineTo(sx0 + (i * w * 0.36) / 4, h * 0.65);
    ctx.stroke();
  }
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(sx0, h * 0.1 + (i * h * 0.55) / 5);
    ctx.lineTo(sx0 + w * 0.36, h * 0.1 + (i * h * 0.55) / 5);
    ctx.stroke();
  }

  /* warm lamp glow */
  const lampX = w * 0.52, lampY = h * 0.24;
  const rg = ctx.createRadialGradient(lampX, lampY, 10, lampX, lampY, h * 0.55);
  rg.addColorStop(0, "rgba(255,214,150,0.5)");
  rg.addColorStop(1, "rgba(255,214,150,0)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#4a3626";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(lampX, 0); ctx.lineTo(lampX, lampY - 26); ctx.stroke();
  ctx.fillStyle = "#f4dcae";
  ctx.beginPath();
  ctx.ellipse(lampX, lampY, 20, 26, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#c9a56e";
  ctx.lineWidth = 1.6;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.ellipse(lampX, lampY, 20, 26, 0, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(lampX - 20, lampY + i * 9);
    ctx.lineTo(lampX + 20, lampY + i * 9);
    ctx.stroke();
  }

  /* floor */
  const fg = ctx.createLinearGradient(0, h * 0.62, 0, h);
  fg.addColorStop(0, "#a8764a");
  fg.addColorStop(1, "#7a5434");
  ctx.fillStyle = fg;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  ctx.strokeStyle = "rgba(60,38,22,0.4)";
  ctx.lineWidth = 2;
  for (let i = 1; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(0, h * 0.62 + (i * h * 0.38) / 6);
    ctx.lineTo(w, h * 0.62 + (i * h * 0.38) / 6);
    ctx.stroke();
  }

  /* table + tea */
  const tx = w * 0.5, ty = h * 0.82;
  ctx.fillStyle = "#4a3020";
  ctx.beginPath();
  ctx.ellipse(tx, ty, w * 0.16, h * 0.05, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#5e4030";
  ctx.beginPath();
  ctx.ellipse(tx, ty - 6, w * 0.16, h * 0.05, 0, 0, TAU);
  ctx.fill();
  /* teapot */
  ctx.fillStyle = "#3a4a4e";
  ctx.beginPath();
  ctx.arc(tx - w * 0.02, ty - 18, 13, Math.PI * 0.9, Math.PI * 2.1);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(tx - w * 0.02, ty - 14, 15, 10, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#3a4a4e";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(tx - w * 0.02 - 2, ty - 30, 9, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tx - w * 0.02 + 14, ty - 18);
  ctx.lineTo(tx - w * 0.02 + 24, ty - 24);
  ctx.stroke();
  /* cups */
  for (const cx of [-0.075, 0.055]) {
    ctx.fillStyle = "#c9b896";
    ctx.beginPath();
    ctx.ellipse(tx + w * cx, ty - 10, 8, 5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#8aa06a";
    ctx.beginPath();
    ctx.ellipse(tx + w * cx, ty - 11.5, 6, 3, 0, 0, TAU);
    ctx.fill();
  }
  /* steam */
  for (let i = 0; i < 3; i++) {
    const u = (v.time * 0.3 + i * 0.33) % 1;
    ctx.strokeStyle = `rgba(255,255,255,${(1 - u) * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const bx = tx + w * (i === 0 ? -0.02 : i === 1 ? -0.075 : 0.055);
    ctx.moveTo(bx, ty - 26);
    ctx.quadraticCurveTo(bx + Math.sin(u * 5 + i) * 8, ty - 40 - u * 20, bx + Math.sin(u * 7 + i) * 12, ty - 54 - u * 26);
    ctx.stroke();
  }

  /* cushions + sitters */
  ctx.fillStyle = "#b05540";
  ctx.beginPath();
  ctx.ellipse(tx + w * 0.13, ty + h * 0.06, 22, 9, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#4a6a8a";
  ctx.beginPath();
  ctx.ellipse(tx - w * 0.13, ty + h * 0.06, 22, 9, 0, 0, TAU);
  ctx.fill();

  const shop: import("./figures").PersonOpts = {
    s: 1.5, facing: -1, phase: v.time * 0.7, swing: 0.05,
    top: hex("#8a8f7a"), bottom: hex("#5f646e"), hair: hex("#c9c4ba"),
    robe: true, elder: true, bun: false,
    armReach: 0.35 + Math.sin(v.time * 1.2) * 0.08,
  };
  drawPerson(ctx, tx + w * 0.13, ty + h * 0.065, shop);
  const boy: import("./figures").PersonOpts = {
    s: 1.5, facing: 1, phase: v.time * 0.6, swing: 0.04,
    top: hex("#54748f"), bottom: hex("#4a5568"), hair: hex("#4a3a30"),
    hat: "straw", scarf: hex("#cf5a40"), coat: hex("#3f5a72"),
    armLift: window01(v.p, 0.955, 0.97) * 0.8,
  };
  drawPerson(ctx, tx - w * 0.13, ty + h * 0.065, boy);

  /* noren at the doorway edge */
  ctx.fillStyle = "#4f6d8c";
  for (let i = 0; i < 4; i++) {
    const sway = Math.sin(v.time * 1.4 + i) * 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.925 + i * 18, 0);
    ctx.lineTo(w * 0.925 + (i + 1) * 18 - 2, 0);
    ctx.lineTo(w * 0.925 + (i + 1) * 18 - 2 + sway, h * 0.16);
    ctx.lineTo(w * 0.925 + i * 18 + sway, h * 0.16);
    ctx.closePath();
    ctx.fill();
  }
  /* warm vignette */
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.85);
  vg.addColorStop(0, "rgba(40,20,10,0)");
  vg.addColorStop(1, "rgba(40,20,10,0.34)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/* ================================================= FINAL PANORAMA */
export function drawPanorama(ctx: CanvasRenderingContext2D, v: View, a: number) {
  if (a < 0.01) return;
  const { w, h } = v;
  const m = v.season;
  ctx.save();
  ctx.globalAlpha = a;

  /* rolling valley */
  const horizon = h * 0.52;
  const fg2 = ctx.createLinearGradient(0, horizon, 0, h);
  fg2.addColorStop(0, css(mixC(hex("#b8d890"), SNOW, m.snow * 0.5)));
  fg2.addColorStop(1, css(mixC(hex("#7ab068"), hex("#c9d8c0"), m.snow * 0.5)));
  ctx.fillStyle = fg2;
  ctx.fillRect(0, horizon, w, h - horizon);

  /* field strips */
  const stripCols = [
    mixC(hex("#a8d478"), hex("#d8b54c"), m.autumn),
    mixC(hex("#90c468"), hex("#c9a84e"), m.autumn),
    mixC(hex("#b8dc8a"), SNOW, m.snow * 0.6),
  ];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = css(stripCols[i], 0.85);
    const y0 = horizon + 8 + i * 20;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.quadraticCurveTo(w * 0.5, y0 - 8 + i * 4, w, y0 + 6);
    ctx.lineTo(w, y0 + 16);
    ctx.quadraticCurveTo(w * 0.5, y0 + 8 + i * 4, 0, y0 + 16);
    ctx.fill();
  }

  /* winding river */
  ctx.strokeStyle = css(mixC(hex("#8fc0d8"), hex("#5f9fc0"), 0.4), 0.95);
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(w * 0.62, horizon + 4);
  ctx.bezierCurveTo(w * 0.5, h * 0.68, w * 0.3, h * 0.72, w * 0.16, h);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const u = (v.time * 0.05 + i * 0.15) % 1;
    const bx = w * 0.62 - u * w * 0.4;
    const by = horizon + 10 + u * (h - horizon) * 0.8;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + 10, by + 2);
    ctx.stroke();
  }

  /* railway + tiny train */
  ctx.strokeStyle = "rgba(90,80,70,0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, horizon + 52);
  ctx.quadraticCurveTo(w * 0.5, horizon + 44, w, horizon + 54);
  ctx.stroke();
  const trainX = ((v.time * 26) % (w + 220)) - 110;
  ctx.fillStyle = "#efe8d4";
  ctx.fillRect(trainX, horizon + 40, 46, 10);
  ctx.fillStyle = "#e07a4a";
  ctx.fillRect(trainX, horizon + 46, 46, 2.6);
  ctx.fillStyle = "rgba(120,150,170,0.9)";
  for (let i = 0; i < 4; i++) ctx.fillRect(trainX + 5 + i * 11, horizon + 42, 6, 3.6);

  /* miniature village */
  const houseCols = [hex("#efe4cd"), hex("#e6d8bd"), hex("#dcc9a4")];
  const roofs = [hex("#55524e"), hex("#6a5a4e"), hex("#5a5a60")];
  for (let i = 0; i < 15; i++) {
    const hx = w * 0.06 + (i / 15) * w * 0.88 + Math.sin(i * 7.3) * 18;
    const hy = horizon + 26 + Math.sin(i * 3.1) * 10 + (i % 3) * 7;
    const hw = 20 + (i % 4) * 6;
    const hh = 12 + (i % 3) * 3;
    if (Math.abs(hx - w * 0.55) < 40 && i % 2 === 0) continue;
    ctx.fillStyle = css(houseCols[i % 3]);
    ctx.fillRect(hx - hw / 2, hy - hh, hw, hh);
    ctx.fillStyle = css(roofs[i % 3]);
    ctx.beginPath();
    ctx.moveTo(hx - hw / 2 - 4, hy - hh);
    ctx.lineTo(hx, hy - hh - 9);
    ctx.lineTo(hx + hw / 2 + 4, hy - hh);
    ctx.closePath();
    ctx.fill();
    if (m.snow > 0.3) {
      ctx.fillStyle = css(SNOW, 0.8);
      ctx.beginPath();
      ctx.moveTo(hx - hw / 2 - 2, hy - hh - 1);
      ctx.lineTo(hx, hy - hh - 8);
      ctx.lineTo(hx + hw / 2 + 2, hy - hh - 1);
      ctx.closePath();
      ctx.fill();
    }
  }
  /* tiny torii */
  ctx.fillStyle = "#c4553b";
  ctx.fillRect(w * 0.3 - 8, horizon + 12, 3, 18);
  ctx.fillRect(w * 0.3 + 5, horizon + 12, 3, 18);
  ctx.fillRect(w * 0.3 - 12, horizon + 10, 24, 3.4);

  /* cherry trees */
  const bloomNow = Math.max(m.bloom, 0.5 * a);
  for (let i = 0; i < 8; i++) {
    const cx = w * 0.08 + i * w * 0.115;
    const cy = horizon + 20 + Math.sin(i * 5.2) * 12;
    ctx.strokeStyle = "#7a5c42";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 10);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    if (bloomNow > 0.1) {
      ctx.fillStyle = css(hex("#f2aec2"), 0.6 + bloomNow * 0.4);
      ctx.beginPath();
      ctx.arc(cx, cy - 4, 8 + (i % 3) * 2, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = css(leafCol(v, "green"), 0.9);
      ctx.beginPath();
      ctx.arc(cx, cy - 4, 7 + (i % 3) * 2, 0, TAU);
      ctx.fill();
    }
  }

  /* foreground hill the boy stands on */
  ctx.fillStyle = css(mixC(hex("#6aa058"), SNOW, m.snow * 0.4));
  ctx.beginPath();
  ctx.moveTo(w * 0.55, h);
  ctx.quadraticCurveTo(w * 0.78, h * 0.72, w * 1.08, h * 0.86);
  ctx.lineTo(w * 1.08, h);
  ctx.closePath();
  ctx.fill();
  /* grass ticks */
  ctx.strokeStyle = css(mixC(hex("#5a8a4a"), SNOW, m.snow * 0.4), 0.7);
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 26; i++) {
    const gx = w * 0.6 + i * 18;
    const gy = h * 0.93 - Math.sin((gx / w) * 2.2) * 30 + (i % 3) * 8;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + 2, gy - 7);
    ctx.stroke();
  }

  /* the boy, watching over everything */
  const boyX = w * 0.8, boyY = h * 0.875;
  const windSway = Math.sin(v.time * 1.4) * 0.03;
  ctx.save();
  ctx.translate(boyX, boyY);
  ctx.rotate(windSway * 0.2);
  ctx.translate(-boyX, -boyY);
  drawPerson(ctx, boyX, boyY, {
    s: 1.25, facing: -1, phase: v.time * 0.5, swing: 0.06,
    top: hex("#6fa3a0"), bottom: hex("#71808f"), hair: hex("#4a3a30"), hat: "straw",
  });
  ctx.restore();

  ctx.restore();
}
