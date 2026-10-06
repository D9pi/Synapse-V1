# Synapse

A gamified, AI-powered study app. Students add their notes and Synapse turns them into a complete study system — then rewards every session with XP, levels, and a growing brain map.

**Notes → AI study guide → flashcards → games and quizzes → progression**

## Quick start

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY for AI features
npm run dev                  # http://localhost:3000
```

With no API key, everything still works: an offline generator builds study kits from structured notes, and short answers are graded by keyword matching. To see the full loop quickly, choose **New subject → Or try a sample subject**.

## Features

| Area | What it does |
| --- | --- |
| **Dashboard** | One obvious next action ("Study now"), level ring, streak, study time, mastery, recommended sessions, brain preview, AI insight, activity feed |
| **Subjects** | Create a course; add typed or pasted notes, textbook text, existing flashcards (Quizlet or tab-separated), topic lists, or uploaded files (PDF, .txt, .md, .csv) |
| **AI study kit** | A structured study guide (what it is, key points, formulas, how to solve, worked example, common mistakes, quick review), concepts, definitions, formulas, flashcards, multiple-choice and short-answer questions, practice problems, and a study plan. You can edit all of it. Regenerating keeps your mastery for concepts that still exist. |
| **Study modes** | **Learn** (teach, then test) · **Flashcards** (3D flip, Known / Still learning, missed cards come back at the end of the round) · **Quiz** (adaptive: a missed concept adds a follow-up question) · **Review** (your open mistakes) · **Challenge** (AI-generated hard questions, 2× XP; unlocks at subject level 2) |
| **Adaptive engine** | Tracks mastery per concept and weights question selection toward weak, unpractised, stale, or frequently missed concepts. You can also pick the concepts to focus on. |
| **AI tutor** | Available on every page as a drawer, or full screen at `/ai`. It sees the current course, study guide, flashcards, mastery, mistakes, sessions, and whatever question or card is on screen. "Why did I get this wrong?" opens it with that question already loaded. Replies stream in. |
| **Progression** | Player and subject levels, XP for every action, streak bonuses, mastery bonuses, titles, 12 achievements, unlockable themes (Onyx, Graphite, Paper), and an 18-week activity heatmap |
| **Brain map** | A procedurally drawn neural network split into 6 regions. Each subject feeds one region, and nodes light up from the region's core outward as it levels. This is a fictional game mechanic, not neuroscience. |

## Architecture

- **Next.js (App Router) + TypeScript + Tailwind v4**, with Framer Motion for animation
- **State:** a single Zustand store (`src/lib/store.ts`) persisted to `localStorage`. All XP goes through one `grant()` path, which raises level-up, achievement, and mastery events for the UI.
- **Domain logic** is in pure modules: `levels.ts` (curves and titles), `xp.ts` (economy), `adaptive.ts` (mastery and question selection), `recommend.ts` (the answer to "what should I study now?"), and `achievements.ts`
- **AI** runs server-side only (`src/lib/ai/claude.ts`) through the Anthropic SDK, using structured outputs validated against Zod schemas (`src/lib/ai/schema.ts`). Responses are normalised into the app's id-based model (`normalize.ts`).
- **API routes:** `/api/generate`, `/api/questions`, `/api/grade`, `/api/extract` (PDF to notes), `/api/assistant` (streaming), `/api/status`. Each one falls back gracefully when AI is unavailable or fails.
- **Offline generator** (`src/lib/offline.ts`): heuristic extraction of headings, definitions, formulas, steps, examples, and mistakes, plus MCQ distractor generation

```
src/
  app/            routes: dashboard, subjects, study sessions, ai, progress, api/*
  components/     ui primitives, shell (nav, events), assistant, brain, subjects, study
  lib/            types, store, game logic, ai, offline generator
```
