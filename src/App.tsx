import { useEffect, useRef, useState } from "react";
import { clamp, damp, ramp, sampleKeys, window01 } from "./engine/utils";
import {
  BOY_KEYS, CAMERA_KEYS, TOD_KEYS, makeWorld, nightAmount, seasonMix,
  type View,
} from "./engine/world";
import { ParticleField } from "./engine/particles";
import { Fireworks, render, updateBoy } from "./engine/render";
import { VillageAudio } from "./engine/audio";

const SEASON_LABELS = [
  { kanji: "春", en: "SPRING", a: 0.372, b: 0.455 },
  { kanji: "夏", en: "SUMMER", a: 0.56, b: 0.64 },
  { kanji: "秋", en: "AUTUMN", a: 0.782, b: 0.856 },
  { kanji: "冬", en: "WINTER", a: 0.902, b: 0.956 },
  { kanji: "春", en: "SPRING RETURNS", a: 0.978, b: 1.02 },
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const seasonRef = useRef<HTMLDivElement>(null);
  const kanjiRef = useRef<HTMLSpanElement>(null);
  const enRef = useRef<HTMLSpanElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<VillageAudio | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [reduced, setReduced] = useState(false);

  const toggleSound = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.enabled) {
      a.disable();
      setSoundOn(false);
    } else {
      a.enable();
      setSoundOn(true);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isMobile = () => window.innerWidth < 820 || "ontouchstart" in window;

    const v: View = {
      w: window.innerWidth,
      h: window.innerHeight,
      dpr: 1,
      time: 0,
      dt: 0.016,
      p: 0,
      target: 0,
      camX: 620,
      camY: -152,
      zoom: 1.34,
      tod: 0,
      night: 0,
      light: 0,
      season: { bloom: 0, summer: 0, autumn: 0, winter: 0, snow: 0 },
      px: 0,
      py: 0,
      reduced: mq.matches,
      mobile: isMobile(),
      festival: 0,
      fwActive: 0,
      boy: {
        x: 1500, y: 0, facing: 1, faceT: 1, phase: 0, speed: 0,
        wave: 0, bow: 0, lookUp: 0, sit: 0, basket: 0,
      },
      world: makeWorld(),
    };
    setReduced(v.reduced);

    const particles = new ParticleField();
    const fw = new Fireworks();
    const audio = new VillageAudio();
    audioRef.current = audio;
    v.boom = (s) => audio.boom(s);

    let targetPX = 0;
    let targetPY = 0;
    let filH = 0;
    let seasonIdx = -2;
    let frame = 0;

    /* ---- timeline input: native scroll when the document can scroll,
       otherwise drive the film directly from wheel / touch / keys ---- */
    let virtual = 0;
    let nativeUsable = true;
    const runwayPx = () => window.innerHeight * 26;
    const onWheel = (e: WheelEvent) => {
      nativeUsable = document.documentElement.scrollHeight - window.innerHeight > 2;
      if (!nativeUsable) virtual = clamp(virtual + e.deltaY / runwayPx(), 0, 1);
    };
    let lastTouchY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      lastTouchY = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? null;
      if (y === null || lastTouchY === null) return;
      nativeUsable = document.documentElement.scrollHeight - window.innerHeight > 2;
      if (!nativeUsable) virtual = clamp(virtual + (lastTouchY - y) / runwayPx(), 0, 1);
      lastTouchY = y;
    };
    const onTouchEnd = () => {
      lastTouchY = null;
    };
    const onKey = (e: KeyboardEvent) => {
      if (nativeUsable) return; // browser handles key scrolling natively
      const steps: Record<string, number> = {
        ArrowDown: 0.012, ArrowUp: -0.012, PageDown: 0.045, PageUp: -0.045,
        " ": 0.02, Spacebar: 0.02, Home: -1, End: 1,
      };
      const d = steps[e.key];
      if (d !== undefined) {
        e.preventDefault();
        virtual = clamp(virtual + d, 0, 1);
      }
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKey);

    const resize = () => {
      v.w = window.innerWidth;
      v.h = window.innerHeight;
      v.mobile = isMobile();
      v.dpr = Math.min(window.devicePixelRatio || 1, v.mobile ? 1.4 : 1.75);
      canvas.width = Math.round(v.w * v.dpr);
      canvas.height = Math.round(v.h * v.dpr);
      ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
      const fil = document.querySelector<HTMLElement>(".filament");
      filH = fil ? fil.offsetHeight : 200;
      particles.setQuality(v.mobile ? 0.45 : v.reduced ? 0.4 : 1);
    };
    resize();

    const onPointer = (e: PointerEvent) => {
      targetPX = (e.clientX / v.w) * 2 - 1;
      targetPY = (e.clientY / v.h) * 2 - 1;
    };
    const onMq = () => {
      v.reduced = mq.matches;
      setReduced(mq.matches);
    };
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointer, { passive: true });
    mq.addEventListener?.("change", onMq);

    let raf = 0;
    let last = performance.now();
    let first = true;
    let frameErrored = false;

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const dt = clamp((t - last) / 1000, 0.001, 0.05);
      last = t;
      v.dt = dt;
      v.time += dt;
      frame++;
      try {

      /* ---- scroll → master timeline */
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const progress = max > 2 ? window.scrollY / max : virtual;
      v.target = clamp(progress, 0, 1);
      if (first) {
        v.p = v.target;
        first = false;
      }
      v.p = damp(v.p, v.target, v.reduced ? 9 : 3.1, dt);

      /* ---- camera */
      const cam = sampleKeys(CAMERA_KEYS, v.p);
      const breathe = v.reduced ? 0 : Math.sin(v.time * 0.11) * 5;
      v.camX = cam[0] + breathe;
      v.camY = cam[1];
      v.zoom = cam[2];
      v.tod = sampleKeys(TOD_KEYS, v.p)[0];
      v.night = nightAmount(v.tod);
      v.season = seasonMix(v.p);
      v.festival = window01(v.p, 0.648, 0.776);
      v.fwActive = window01(v.p, 0.718, 0.77);
      v.light = clamp(v.night * 1.15 + v.festival * 0.55 + window01(v.p, 0.94, 0.976) * 0.9, 0, 1);

      /* ---- pointer parallax (separate smoothing) */
      v.px = damp(v.px, v.reduced ? 0 : targetPX, 2.6, dt);
      v.py = damp(v.py, v.reduced ? 0 : targetPY, 2.6, dt);

      /* ---- boy */
      const prevX = v.boy.x;
      v.boy.x = sampleKeys(BOY_KEYS, v.p)[0];
      updateBoy(v, prevX);

      /* ---- particles */
      const m = v.season;
      const pollen = window01(v.p, 0.06, 0.35) * 0.55 + m.summer * 0.22;
      const firefly = clamp(v.night * (window01(v.p, 0.58, 0.78) + m.summer * 0.5), 0, 1) * 0.9;
      particles.setMode({
        petal: m.bloom,
        snow: m.snow,
        leaf: m.autumn * 0.95,
        pollen,
        firefly,
      });
      const wind = Math.sin(v.time * 0.21) * 0.55 + 0.35;
      particles.update(dt, {
        time: v.time, camX: v.camX, camY: v.camY,
        vw: v.w, vh: v.h, zoom: v.zoom, wind,
      });

      render(ctx, v, particles, fw);

      /* ---- ambient audio mix */
      if (frame % 12 === 0 && audio.enabled) {
        let river = 0;
        for (const [a, b] of v.world.riverSegs) {
          if (v.camX > a - 260 && v.camX < b + 260) river = 1;
        }
        audio.update({
          tod: v.tod, night: v.night,
          summer: m.summer, autumn: m.autumn, winter: m.winter, bloom: m.bloom,
          festival: v.festival, fw: v.fwActive, river,
        });
      }

      /* ---- DOM chrome (no React re-renders) */
      if (titleRef.current) {
        const a = 1 - ramp(v.p, 0.045, 0.085);
        titleRef.current.style.opacity = a.toFixed(3);
        titleRef.current.style.transform = `translateY(${(1 - a) * -14}px)`;
      }
      if (hintRef.current) {
        hintRef.current.style.opacity = v.target < 0.008 ? "1" : "0";
      }
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(-50%, ${v.p * filH - 3.5}px)`;
      }
      if (seasonRef.current) {
        let idx = -1;
        for (let i = 0; i < SEASON_LABELS.length; i++) {
          const l = SEASON_LABELS[i];
          if (window01(v.p, l.a, l.b, 0.008, 0.008) > 0.03) { idx = i; break; }
        }
        if (idx !== seasonIdx) {
          seasonIdx = idx;
          if (idx >= 0) {
            if (kanjiRef.current) kanjiRef.current.textContent = SEASON_LABELS[idx].kanji;
            if (enRef.current) enRef.current.textContent = SEASON_LABELS[idx].en;
            seasonRef.current.classList.add("on");
          } else {
            seasonRef.current.classList.remove("on");
          }
        }
      }
      if (endRef.current) {
        endRef.current.style.opacity = ramp(v.p, 0.991, 0.999).toFixed(3);
      }
      } catch (err) {
        if (!frameErrored) {
          frameErrored = true;
          console.error("[hidamari] frame error — the film continues", err);
        }
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
      mq.removeEventListener?.("change", onMq);
      audio.disable();
    };
  }, []);

  return (
    <div className="relative">
      <canvas ref={canvasRef} className="stage" aria-label="A cinematic scroll through a Japanese countryside village across one day and four seasons" role="img" />

      {/* scroll runway — the film's timeline */}
      <div style={{ height: "2600vh" }} aria-hidden="true" />

      {/* film finish */}
      <div className="fx-vignette" aria-hidden="true" />
      <div className="fx-grain" aria-hidden="true" />
      <div className="fx-bars top" aria-hidden="true" />
      <div className="fx-bars bottom" aria-hidden="true" />

      {/* opening title */}
      <div ref={titleRef} className="ui title-block" style={{ opacity: 1 }}>
        <div className="title-v font-display">陽だまり村</div>
        <div className="title-e">
          HIDAMARI VILLAGE
          <br />
          ONE DAY · FOUR SEASONS
        </div>
      </div>

      {/* season label */}
      <div ref={seasonRef} className="ui season-label">
        <span ref={kanjiRef} className="kanji">春</span>
        <span ref={enRef} className="en">SPRING</span>
      </div>

      {/* progress filament */}
      <div className="ui filament" aria-hidden="true">
        {[37.5, 56.5, 79, 90.5].map((t) => (
          <div key={t} className="tick" style={{ top: `${t}%` }} />
        ))}
        <div ref={dotRef} className="dot" />
      </div>

      {/* scroll hint */}
      <div ref={hintRef} className="ui hint">
        <div className="line" />
        <span>SCROLL&nbsp;&nbsp;·&nbsp;&nbsp;歩こう</span>
      </div>

      {/* final words */}
      <div ref={endRef} className="ui end-title" style={{ opacity: 0 }}>
        <div className="jp font-display">また明日。</div>
        <div className="en">SEE YOU TOMORROW</div>
      </div>

      {reduced && (
        <div className="ui motion-note">
          REDUCED MOTION
          <br />
          GENTLER PLAYBACK
        </div>
      )}

      {/* sound toggle */}
      <button
        className="sound-btn"
        onClick={toggleSound}
        aria-label={soundOn ? "Mute the village soundscape" : "Play the village soundscape"}
        aria-pressed={soundOn}
        title={soundOn ? "sound on" : "sound off"}
      >
        {!soundOn && <span className="ring" aria-hidden="true" />}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none" />
          {soundOn ? (
            <>
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M18.5 6a9 9 0 0 1 0 12" />
            </>
          ) : (
            <>
              <line x1="16" y1="9.5" x2="21" y2="14.5" />
              <line x1="21" y1="9.5" x2="16" y2="14.5" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}
