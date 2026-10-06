import type { RegionId } from "./types";

// A fictional game mechanic loosely inspired by different cognitive skills.
// It is not a claim about how real brains work.
export interface RegionDef {
  id: RegionId;
  name: string;
  skill: string;
  subjects: string;
  keywords: string[];
}

export const REGIONS: RegionDef[] = [
  {
    id: "analytical",
    name: "Analytical Cortex",
    skill: "Quantitative reasoning",
    subjects: "Mathematics, Statistics",
    keywords: ["math", "algebra", "calculus", "geometry", "statistic", "trig", "precalc", "arithmetic", "probability"],
  },
  {
    id: "inquiry",
    name: "Inquiry Lobe",
    skill: "Scientific reasoning",
    subjects: "Biology, Chemistry, Physics",
    keywords: ["bio", "chem", "physics", "science", "anatomy", "earth", "environment", "ecology", "astronomy", "psych"],
  },
  {
    id: "language",
    name: "Language Center",
    skill: "Language & expression",
    subjects: "English, Literature, Languages",
    keywords: ["english", "literature", "poetry", "writing", "spanish", "french", "german", "latin", "chinese", "japanese", "language", "grammar", "rhetoric", "composition"],
  },
  {
    id: "memory",
    name: "Memory Archive",
    skill: "Context & recall",
    subjects: "History, Government, Geography",
    keywords: ["history", "gov", "civics", "geography", "econ", "world", "politic", "law", "apush", "euro"],
  },
  {
    id: "systems",
    name: "Logic Engine",
    skill: "Problem solving",
    subjects: "Computer Science, Engineering",
    keywords: ["computer", "cs", "programming", "code", "coding", "engineering", "algorithm", "data", "software", "logic"],
  },
  {
    id: "creative",
    name: "Creative Field",
    skill: "Synthesis & creativity",
    subjects: "Arts, Music, Philosophy, Other",
    keywords: ["art", "music", "philosophy", "design", "film", "theater", "theatre", "religion", "ethics"],
  },
];

export const regionById = (id: RegionId) => REGIONS.find((r) => r.id === id)!;

export function guessRegion(name: string): RegionId {
  const n = name.toLowerCase();
  for (const r of REGIONS) {
    if (r.keywords.some((k) => n.includes(k))) return r.id;
  }
  return "creative";
}
