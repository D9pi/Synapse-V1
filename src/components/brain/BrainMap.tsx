"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { RegionId, Subject } from "@/lib/types";
import { REGIONS } from "@/lib/regions";
import { subjectLevel, regionTier } from "@/lib/levels";
import { cn } from "@/lib/utils";

// Fictional "brain map": a stylised neural network split into regions.
// It's a game visual, not anatomy.

const W = 420;
const H = 300;

const LOBES = [
  { cx: 140, cy: 135, rx: 95, ry: 84 },
  { cx: 228, cy: 108, rx: 112, ry: 78 },
  { cx: 312, cy: 140, rx: 76, ry: 70 },
  { cx: 208, cy: 182, rx: 98, ry: 50 },
];
const CEREBELLUM = { cx: 304, cy: 214, rx: 46, ry: 27 };

const ANCHORS: Record<RegionId, [number, number]> = {
  analytical: [118, 98],
  language: [112, 172],
  systems: [214, 62],
  inquiry: [292, 98],
  memory: [214, 192],
  creative: [348, 158],
};

function inside(x: number, y: number, shrink = 0.9) {
  return LOBES.some((e) => ((x - e.cx) / (e.rx * shrink)) ** 2 + ((y - e.cy) / (e.ry * shrink)) ** 2 <= 1);
}

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

interface Node {
  x: number;
  y: number;
  region: RegionId;
  rank: number; // 0..1 distance rank within region (0 = core)
}

function buildNetwork() {
  const rand = rng(7);
  const nodes: Node[] = [];
  const step = 15;
  for (let y = 20; y < H - 20; y += step) {
    for (let x = 30; x < W - 20; x += step) {
      const px = x + (rand() - 0.5) * step * 0.9;
      const py = y + (rand() - 0.5) * step * 0.9;
      if (!inside(px, py)) continue;
      let best: RegionId = "analytical";
      let bd = Infinity;
      for (const [id, [ax, ay]] of Object.entries(ANCHORS) as [RegionId, [number, number]][]) {
        const d = (px - ax) ** 2 + (py - ay) ** 2;
        if (d < bd) {
          bd = d;
          best = id;
        }
      }
      nodes.push({ x: px, y: py, region: best, rank: bd });
    }
  }
  // Normalise rank per region so lighting grows from each region's core outward.
  const byRegion = new Map<RegionId, Node[]>();
  nodes.forEach((n) => byRegion.set(n.region, [...(byRegion.get(n.region) ?? []), n]));
  byRegion.forEach((list) => {
    list.sort((a, b) => a.rank - b.rank);
    list.forEach((n, i) => (n.rank = i / Math.max(1, list.length - 1)));
  });
  // Edges: connect each node to its 2 nearest neighbours.
  const edges: [number, number][] = [];
  const seen = new Set<string>();
  nodes.forEach((n, i) => {
    const near = nodes
      .map((m, j) => ({ j, d: (m.x - n.x) ** 2 + (m.y - n.y) ** 2 }))
      .filter((o) => o.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    for (const { j, d } of near) {
      if (d > 26 ** 2) continue;
      const k = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(k)) continue;
      seen.add(k);
      edges.push([i, j]);
    }
  });
  return { nodes, edges };
}

export interface RegionStat {
  id: RegionId;
  xp: number;
  level: number;
  tier: string;
  subjects: Subject[];
  development: number; // 0..1
}

export function regionStats(subjects: Subject[]): RegionStat[] {
  return REGIONS.map((r) => {
    const subs = subjects.filter((s) => s.region === r.id);
    const xp = subs.reduce((a, s) => a + s.xp, 0);
    const level = xp > 0 ? subjectLevel(xp).level : 0;
    const lv = subjectLevel(xp);
    const development = xp > 0 ? Math.min(1, 0.16 + (level - 1 + lv.progress) / 14) : 0;
    return { id: r.id, xp, level, tier: regionTier(level, xp > 0), subjects: subs, development };
  });
}

export function BrainMap({
  subjects,
  selected,
  onSelect,
  className,
  compact = false,
}: {
  subjects: Subject[];
  selected?: RegionId | null;
  onSelect?: (id: RegionId) => void;
  className?: string;
  compact?: boolean;
}) {
  const { nodes, edges } = useMemo(() => buildNetwork(), []);
  const stats = useMemo(() => regionStats(subjects), [subjects]);
  const dev = useMemo(() => Object.fromEntries(stats.map((s) => [s.id, s.development])) as Record<RegionId, number>, [stats]);
  const [hover, setHover] = useState<RegionId | null>(null);
  const focus = hover ?? selected ?? null;

  const lit = (n: Node) => n.rank <= dev[n.region] && dev[n.region] > 0;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn("h-auto w-full select-none", className)}
      role="img"
      aria-label="Brain map showing development of each study region"
    >
      <defs>
        <radialGradient id="glow">
          <stop offset="0%" stopColor="var(--fg)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--fg)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Silhouette: stroked lobes, then filled lobes on top leave only the outer outline. */}
      <g>
        {LOBES.map((e, i) => (
          <ellipse key={`o${i}`} {...e} fill="none" stroke="var(--line-strong)" strokeWidth={3} />
        ))}
        <ellipse {...CEREBELLUM} fill="none" stroke="var(--line-strong)" strokeWidth={3} />
        {LOBES.map((e, i) => (
          <ellipse key={`f${i}`} {...e} fill="var(--surface)" />
        ))}
        <ellipse {...CEREBELLUM} fill="var(--surface)" />
        {/* brain stem */}
        <path d="M262 226 C 266 248, 270 262, 268 286" stroke="var(--line-strong)" strokeWidth={10} fill="none" strokeLinecap="round" opacity={0.6} />
        {/* cerebellum folds */}
        {[0, 1, 2, 3].map((i) => (
          <path
            key={i}
            d={`M${266 + i * 3} ${206 + i * 7} Q ${304} ${196 + i * 9}, ${344 - i * 4} ${208 + i * 6}`}
            stroke="var(--line)"
            fill="none"
          />
        ))}
        {/* sulci */}
        <path d="M206 36 C 196 80, 214 110, 196 150" stroke="var(--line)" fill="none" strokeWidth={1.2} />
        <path d="M110 160 C 160 150, 220 148, 286 168" stroke="var(--line)" fill="none" strokeWidth={1.2} />
      </g>

      {/* Region glows */}
      {stats.map((s) => {
        const [ax, ay] = ANCHORS[s.id];
        const strength = s.development;
        if (strength <= 0 && focus !== s.id) return null;
        return (
          <motion.circle
            key={`g-${s.id}`}
            cx={ax}
            cy={ay}
            initial={false}
            animate={{ r: 30 + strength * 50, opacity: focus === s.id ? 1 : 0.35 + strength * 0.5 }}
            fill="url(#glow)"
          />
        );
      })}

      {/* Edges */}
      <g>
        {edges.map(([a, b], i) => {
          const na = nodes[a];
          const nb = nodes[b];
          const on = lit(na) && lit(nb) && na.region === nb.region;
          const dim = focus && na.region !== focus;
          return (
            <line
              key={i}
              x1={na.x}
              y1={na.y}
              x2={nb.x}
              y2={nb.y}
              stroke={on ? "var(--fg)" : "var(--faint)"}
              strokeOpacity={on ? (dim ? 0.15 : 0.55) : dim ? 0.08 : 0.22}
              strokeWidth={on ? 0.9 : 0.6}
              style={{ transition: "stroke-opacity .3s" }}
            />
          );
        })}
      </g>

      {/* Nodes */}
      <g>
        {nodes.map((n, i) => {
          const on = lit(n);
          const dim = focus && n.region !== focus;
          const pulse = on && i % 7 === 0;
          return (
            <circle
              key={i}
              cx={n.x}
              cy={n.y}
              r={on ? (n.rank < 0.08 ? 3 : 2) : 1.2}
              fill={on ? "var(--fg)" : "var(--faint)"}
              opacity={dim ? 0.25 : on ? 1 : 0.7}
              className={pulse ? "pulse-dot" : undefined}
              style={{ transition: "opacity .3s", animationDelay: pulse ? `${(i % 13) * 0.17}s` : undefined }}
            />
          );
        })}
      </g>

      {/* Hit areas */}
      {onSelect &&
        REGIONS.map((r) => {
          const [ax, ay] = ANCHORS[r.id];
          return (
            <circle
              key={`hit-${r.id}`}
              cx={ax}
              cy={ay}
              r={42}
              fill="transparent"
              className="cursor-pointer"
              tabIndex={0}
              role="button"
              aria-label={`${r.name}`}
              onMouseEnter={() => setHover(r.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(r.id)}
              onBlur={() => setHover(null)}
              onClick={() => onSelect(r.id)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(r.id)}
            />
          );
        })}

      {/* Labels */}
      {!compact &&
        REGIONS.map((r) => {
          const [ax, ay] = ANCHORS[r.id];
          const s = stats.find((x) => x.id === r.id)!;
          const active = focus === r.id;
          return (
            <g key={`l-${r.id}`} pointerEvents="none" opacity={focus && !active ? 0.35 : 1} style={{ transition: "opacity .3s" }}>
              <text x={ax} y={ay - 4} textAnchor="middle" fontSize={8} fontFamily="var(--font-geist-mono)" letterSpacing="0.12em" fill="var(--fg)" style={{ textTransform: "uppercase" }} paintOrder="stroke" stroke="var(--surface)" strokeWidth={3}>
                {r.name.toUpperCase()}
              </text>
              <text x={ax} y={ay + 8} textAnchor="middle" fontSize={7.5} fontFamily="var(--font-geist-mono)" fill="var(--muted)" paintOrder="stroke" stroke="var(--surface)" strokeWidth={3}>
                {s.xp > 0 ? `LV ${s.level} · ${s.tier}` : "DORMANT"}
              </text>
            </g>
          );
        })}
    </svg>
  );
}
