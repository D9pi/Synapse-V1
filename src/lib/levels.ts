// Level curves. Overall level is slower than subject levels.

export interface LevelInfo {
  level: number;
  current: number; // xp into current level
  needed: number; // xp required to go from level -> level+1
  progress: number; // 0..1
  total: number;
}

function curve(base: number, exp: number) {
  return (level: number) => Math.round(base * Math.pow(level, exp));
}

const playerCost = curve(120, 1.45);
const subjectCost = curve(80, 1.35);

function resolve(xp: number, cost: (l: number) => number): LevelInfo {
  let level = 1;
  let remaining = Math.max(0, Math.floor(xp));
  while (remaining >= cost(level)) {
    remaining -= cost(level);
    level++;
  }
  const needed = cost(level);
  return { level, current: remaining, needed, progress: remaining / needed, total: xp };
}

export const playerLevel = (xp: number) => resolve(xp, playerCost);
export const subjectLevel = (xp: number) => resolve(xp, subjectCost);

export const TITLES: { level: number; title: string }[] = [
  { level: 1, title: "Initiate" },
  { level: 3, title: "Apprentice" },
  { level: 5, title: "Scholar" },
  { level: 8, title: "Analyst" },
  { level: 12, title: "Savant" },
  { level: 16, title: "Polymath" },
  { level: 20, title: "Luminary" },
];

export function titleFor(level: number): string {
  let t = TITLES[0].title;
  for (const entry of TITLES) if (level >= entry.level) t = entry.title;
  return t;
}

export function nextTitle(level: number): { level: number; title: string } | null {
  return TITLES.find((t) => t.level > level) ?? null;
}

export const REGION_TIERS = ["Dormant", "Awakening", "Active", "Developed", "Advanced", "Mastered"];

export function regionTier(level: number, hasXp: boolean): string {
  if (!hasXp) return REGION_TIERS[0];
  if (level >= 15) return REGION_TIERS[5];
  if (level >= 10) return REGION_TIERS[4];
  if (level >= 6) return REGION_TIERS[3];
  if (level >= 3) return REGION_TIERS[2];
  return REGION_TIERS[1];
}
