// magic_black motion helpers (restrained set for an app UI):
// scroll reveal, count-up numbers, card cursor-spotlight, ambient cursor glow.
// Every effect respects prefers-reduced-motion.

import React, { useEffect, useRef, useState } from 'react';

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Wrap a block to fade+rise it in when it enters the viewport. */
export const Reveal: React.FC<{ children: React.ReactNode; className?: string; delay?: number }> =
  ({ children, className = '', delay = 0 }) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      if (reducedMotion()) {
        el.classList.add('revealed');
        return;
      }
      const io = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => el.classList.add('revealed'), delay);
          io.disconnect();
        }
      }, { threshold: 0.12 });
      io.observe(el);
      return () => io.disconnect();
    }, [delay]);

    return <div ref={ref} className={`reveal ${className}`}>{children}</div>;
  };

/** Animated count-up that starts when the element scrolls into view. */
export const CountUp: React.FC<{ value: number; className?: string; duration?: number }> =
  ({ value, className = '', duration = 1200 }) => {
    const ref = useRef<HTMLSpanElement>(null);
    const [display, setDisplay] = useState(0);
    const started = useRef(false);

    useEffect(() => {
      if (reducedMotion()) {
        setDisplay(value);
        return;
      }
      const el = ref.current;
      if (!el) return;
      const run = () => {
        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min((t - t0) / duration, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          setDisplay(Math.round(value * eased));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      };
      if (started.current) {
        // value changed after the initial animation — just show it
        setDisplay(value);
        return;
      }
      const io = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          run();
          io.disconnect();
        }
      }, { threshold: 0.4 });
      io.observe(el);
      return () => io.disconnect();
    }, [value, duration]);

    return <span ref={ref} className={className}>{display.toLocaleString()}</span>;
  };

/** Attach to a .bento-card.spot to drive the radial spotlight from the cursor. */
export function spotlight(e: React.MouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${e.clientX - r.left}px`);
  el.style.setProperty('--my', `${e.clientY - r.top}px`);
}

/** Ambient starfield: small lime-tinted dots drifting upward behind all content
 * (the magic_black "galaxy" layer — fixed canvas at z -2, auras sit at -3). */
export const Starfield: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (reducedMotion()) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0, raf = 0;
    let pts: Array<{ x: number; y: number; r: number; a: number; s: number }> = [];

    const size = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      pts = Array.from({ length: Math.min(90, Math.floor(w / 16)) }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.3,
        a: Math.random() * 0.5 + 0.2,
        s: Math.random() * 0.4 + 0.1,
      }));
    };
    size();
    window.addEventListener('resize', size, { passive: true });

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.y -= p.s;
        if (p.y < 0) p.y = h;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 7);
        ctx.fillStyle = `rgba(180,205,140,${p.a})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', size);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (reducedMotion()) return null;
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, zIndex: -2, opacity: 0.5, pointerEvents: 'none' }}
    />
  );
};

/** Ambient glow that trails the pointer behind all content. */
export const CursorGlow: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducedMotion()) return;
    let raf = 0;
    let tx = -600, ty = -600, x = tx, y = ty;
    const onMove = (e: MouseEvent) => { tx = e.clientX; ty = e.clientY; };
    const loop = () => {
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      if (ref.current) ref.current.style.transform = `translate(${x - 240}px, ${y - 240}px)`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener('mousemove', onMove);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (reducedMotion()) return null;
  return <div ref={ref} id="cursor-glow" style={{ top: 0, left: 0, transform: 'translate(-600px,-600px)' }} />;
};
