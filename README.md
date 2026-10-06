# Synapse

A gamified, AI-powered study app. Students add their notes and Synapse turns them into a complete study system — then rewards every session with XP, levels, and a growing brain map.

**Notes → AI study guide → flashcards → games and quizzes → progression**

## Desktop app

Synapse runs as a real desktop app on macOS, Windows, and Linux. It's built with Electron and bundles its own local server, so nothing runs in your browser. Progress is saved to a file on your computer, and you paste your AI key into **Settings** inside the app, where it's encrypted with your system keychain when one is available.

**Build the installer on your own computer** (needs [Node.js](https://nodejs.org) 20.9+):

```bash
npm install
npm run dist          # builds an installer for the computer you're on, into release/
```

- **macOS:** open `release/Synapse-<version>-arm64.dmg` (Apple Silicon) or `-x64.dmg` (Intel), then drag Synapse into Applications.
- **Windows:** run `release/Synapse-Setup-<version>.exe`.
- **Linux:** `chmod +x release/Synapse-<version>.AppImage` and run it.

To try it without building an installer, run `npm run desktop`.

**Or download a prebuilt installer:** every push runs the *Desktop app* GitHub Action, which builds all three installers. Open the run under the repo's **Actions** tab and download them from **Artifacts**. Pushing a `v*` tag publishes them as a Release.

The builds aren't signed with paid Apple or Microsoft certificates, so the first launch shows a warning:
- **macOS:** if it says the app "can't be opened", go to **System Settings → Privacy & Security** and click **Open Anyway**. If it says the app is "damaged", run `xattr -cr /Applications/Synapse.app` once.
- **Windows:** on the SmartScreen prompt, click **More info → Run anyway**.

## Run in a browser (development)

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
- **Desktop shell** (`electron/`): `main.cjs` starts the Next.js standalone server in a background process on `127.0.0.1` and loads it in a native window. It stores progress in `synapse-data.json` in the app-data folder and the API key in `settings.json`, encrypted with `safeStorage`. `preload.cjs` exposes a small, explicit bridge to the UI. `scripts/after-pack.cjs` copies the server bundle into the packaged app.
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
