"use client";

import { useMemo } from "react";

export interface GraphSpec {
  title?: string;
  xmin?: number;
  xmax?: number;
  ymin?: number;
  ymax?: number;
  functions?: { f: string; label?: string }[];
  points?: { x: number; y: number; label?: string }[];
}

const CONST: Record<string, number> = { pi: Math.PI, e: Math.E };
const FUNCS: Record<string, (v: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
};

/** Recursive-descent parser. Deliberately does not use eval. */
function compile(src: string): ((x: number) => number) | null {
  const s = src.replace(/\s+/g, "").toLowerCase();
  let i = 0;
  const peek = () => s[i];

  function expr(): ((x: number) => number) | null {
    let left = term();
    if (!left) return null;
    while (peek() === "+" || peek() === "-") {
      const op = s[i++];
      const right = term();
      if (!right) return null;
      const l: (x: number) => number = left;
      left = op === "+" ? (x: number) => l(x) + right(x) : (x: number) => l(x) - right(x);
    }
    return left;
  }

  function term(): ((x: number) => number) | null {
    let left = power();
    if (!left) return null;
    while (peek() === "*" || peek() === "/") {
      const op = s[i++];
      const right = power();
      if (!right) return null;
      const l: (x: number) => number = left;
      left = op === "*" ? (x: number) => l(x) * right(x) : (x: number) => l(x) / right(x);
    }
    return left;
  }

  function power(): ((x: number) => number) | null {
    const base = unary();
    if (!base) return null;
    if (peek() === "^") {
      i++;
      const exp = power();
      if (!exp) return null;
      return (x) => Math.pow(base(x), exp(x));
    }
    return base;
  }

  function unary(): ((x: number) => number) | null {
    if (peek() === "-") {
      i++;
      const v = unary();
      return v ? (x) => -v(x) : null;
    }
    if (peek() === "+") {
      i++;
      return unary();
    }
    return atom();
  }

  function atom(): ((x: number) => number) | null {
    if (peek() === "(") {
      i++;
      const v = expr();
      if (peek() !== ")") return null;
      i++;
      return v;
    }
    const num = /^\d+(\.\d+)?/.exec(s.slice(i));
    if (num) {
      i += num[0].length;
      const n = parseFloat(num[0]);
      return () => n;
    }
    const word = /^[a-z]+/.exec(s.slice(i));
    if (!word) return null;
    const name = word[0];
    i += name.length;
    if (name === "x") return (x) => x;
    if (name in CONST) {
      const c = CONST[name];
      return () => c;
    }
    if (name in FUNCS) {
      const f = FUNCS[name];
      if (peek() !== "(") return null;
      i++;
      const arg = expr();
      if (peek() !== ")") return null;
      i++;
      return arg ? (x) => f(arg(x)) : null;
    }
    return null;
  }

  const fn = expr();
  if (!fn || i !== s.length) return null;
  return fn;
}

const COLORS = ["#c8321e", "#1f7a4d", "#3d5a80", "#8e2a6b", "#8f5a0a"];

export default function GraphBlock({ spec }: { spec: GraphSpec }) {
  const width = 620;
  const height = 320;
  const pad = 34;

  const data = useMemo(() => {
    const xmin = Number.isFinite(spec.xmin) ? (spec.xmin as number) : -6;
    const xmax = Number.isFinite(spec.xmax) && (spec.xmax as number) > xmin ? (spec.xmax as number) : 6;
    const fns = (spec.functions ?? [])
      .map((f) => ({ ...f, fn: compile(String(f.f ?? "")) }))
      .filter((f) => f.fn)
      .slice(0, 5);
    // Function-space points; they are mapped to pixels when the SVG is built.
    const samples: { pts: [number, number][]; color: string }[] = [];
    let lo = Infinity;
    let hi = -Infinity;
    for (const [idx, f] of fns.entries()) {
      const pts: [number, number][] = [];
      const steps = 400;
      for (let k = 0; k <= steps; k++) {
        const x = xmin + ((xmax - xmin) * k) / steps;
        const y = f.fn!(x);
        if (!Number.isFinite(y)) continue;
        lo = Math.min(lo, y);
        hi = Math.max(hi, y);
        pts.push([x, y]);
      }
      samples.push({ pts, color: COLORS[idx % COLORS.length] });
    }
    let ymin = Number.isFinite(spec.ymin) ? (spec.ymin as number) : lo;
    let ymax = Number.isFinite(spec.ymax) ? (spec.ymax as number) : hi;
    if (!Number.isFinite(ymin) || !Number.isFinite(ymax) || ymin >= ymax) {
      ymin = -5;
      ymax = 5;
    } else {
      const padY = (ymax - ymin) * 0.08;
      ymin -= padY;
      ymax += padY;
    }
    return { xmin, xmax, ymin, ymax, fns, samples };
  }, [spec]);

  if (data.fns.length === 0) {
    return (
      <p className="rounded-xl bg-warn-wash px-4 py-3 text-sm text-warn">
        The tutor sent a graph I could not draw. Ask it to plot the function again.
      </p>
    );
  }

  const { xmin, xmax, ymin, ymax } = data;
  const sx = (x: number) => pad + ((x - xmin) / (xmax - xmin)) * (width - pad * 2);
  const sy = (y: number) => height - pad - ((y - ymin) / (ymax - ymin)) * (height - pad * 2);
  /** Maps function points to pixels, breaking the line at asymptotes and off-chart jumps. */
  const pathFor = (pts: [number, number][]) => {
    let d = "";
    let pen = false;
    let prev: [number, number] | null = null;
    const span = ymax - ymin;
    for (const [x, y] of pts) {
      const visible = y >= ymin - span && y <= ymax + span;
      const jump = prev ? Math.abs(y - prev[1]) > span * 0.8 : false;
      if (!visible || jump) {
        pen = false;
        prev = [x, y];
        continue;
      }
      d += `${pen ? "L" : "M"}${sx(x).toFixed(2)},${sy(y).toFixed(2)} `;
      pen = true;
      prev = [x, y];
    }
    return d.trim();
  };

  const xAxis = Math.min(Math.max(sy(0), pad), height - pad);
  const yAxis = Math.min(Math.max(sx(0), pad), width - pad);
  const ticks = (a: number, b: number, n = 6) => {
    const step = (b - a) / n;
    return Array.from({ length: n + 1 }, (_, k) => a + step * k);
  };
  const label = (v: number) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(1));

  return (
    <figure className="rounded-xl border border-line bg-card p-3">
      {spec.title && <figcaption className="mb-1 text-sm font-medium">{spec.title}</figcaption>}
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={spec.title ?? "Graph"}>
        {ticks(xmin, xmax).map((t) => (
          <line key={`gx${t}`} x1={sx(t)} y1={pad} x2={sx(t)} y2={height - pad} stroke="#eee9dd" strokeWidth="1" />
        ))}
        {ticks(ymin, ymax).map((t) => (
          <line key={`gy${t}`} x1={pad} y1={sy(t)} x2={width - pad} y2={sy(t)} stroke="#eee9dd" strokeWidth="1" />
        ))}
        <line x1={pad} y1={xAxis} x2={width - pad} y2={xAxis} stroke="#17150f" strokeWidth="1.2" />
        <line x1={yAxis} y1={pad} x2={yAxis} y2={height - pad} stroke="#17150f" strokeWidth="1.2" />
        {ticks(xmin, xmax).map((t) => (
          <text key={`tx${t}`} x={sx(t)} y={xAxis + 14} textAnchor="middle" className="fill-[#6b665c] text-[10px]">
            {label(t)}
          </text>
        ))}
        {ticks(ymin, ymax).map((t) => (
          <text key={`ty${t}`} x={yAxis - 6} y={sy(t) + 3} textAnchor="end" className="fill-[#6b665c] text-[10px]">
            {label(t)}
          </text>
        ))}
        {data.samples.map((s, i) => (
          <path key={i} d={pathFor(s.pts)} fill="none" stroke={s.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        ))}
        {(spec.points ?? []).slice(0, 12).map((p, i) => (
          <g key={`p${i}`}>
            <circle cx={sx(p.x)} cy={sy(p.y)} r="3.5" fill="#17150f" />
            {p.label && (
              <text x={sx(p.x) + 6} y={sy(p.y) - 6} className="fill-[#17150f] text-[11px]">
                {p.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      {data.fns.length > 1 && (
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-muted">
          {data.fns.map((f, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              {f.label ?? `y = ${f.f}`}
            </span>
          ))}
        </div>
      )}
    </figure>
  );
}
