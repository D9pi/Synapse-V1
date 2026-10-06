"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { desktop, type AIProvider, type DesktopSettings } from "@/lib/desktop";
import { cn } from "@/lib/utils";
import { Card, SectionTitle, Chip } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Field";
import { Icon } from "../ui/Icon";
import { ProgressBar } from "../ui/Progress";
import { useAI } from "../shell/Providers";

// Recommended free models. Sizes are download sizes; RAM is what the computer needs.
const RECOMMENDED = [
  { name: "gemma3:4b", label: "Light", size: "3.3 GB", ram: "8 GB RAM", note: "Fastest. Good for flashcards and explanations." },
  { name: "qwen2.5:7b", label: "Recommended", size: "4.7 GB", ram: "16 GB RAM", note: "Best balance of quality and speed." },
  { name: "gemma3:12b", label: "Best", size: "8.1 GB", ram: "32 GB RAM", note: "Highest quality, slower on most laptops." },
];

interface LocalStatus {
  running: boolean;
  version: string | null;
  models: { name: string; size: number; parameterSize: string | null }[];
  selected: string;
}

async function fetchLocalStatus(): Promise<LocalStatus> {
  try {
    const res = await fetch("/api/local-ai", { cache: "no-store" });
    return await res.json();
  } catch {
    return { running: false, version: null, models: [], selected: "" };
  }
}

const gb = (bytes: number) => `${(bytes / 1e9).toFixed(1)} GB`;
const same = (a: string, b: string) => a === b || a === `${b}:latest` || b === `${a}:latest`;

function LocalAI({ active, activeModel, onActivate, busy }: { active: boolean; activeModel: string | null; onActivate: (model: string) => void; busy: boolean }) {
  const [status, setStatus] = useState<LocalStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [pulling, setPulling] = useState<{ model: string; pct: number; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(() => fetchLocalStatus().then(setStatus), []);

  const check = async () => {
    setChecking(true);
    await load();
    setChecking(false);
  };

  useEffect(() => {
    fetchLocalStatus().then(setStatus);
    return () => abortRef.current?.abort();
  }, []);

  const download = async (model: string) => {
    setError(null);
    setPulling({ model, pct: 0, label: "Starting download…" });
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/local-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Download failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let ok = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as { status?: string; total?: number; completed?: number; error?: string };
          if (ev.error) throw new Error(ev.error);
          if (ev.status === "success") ok = true;
          const pct = ev.total ? (ev.completed ?? 0) / ev.total : undefined;
          setPulling((p) => ({
            model,
            pct: pct ?? p?.pct ?? 0,
            label: ev.total ? `Downloading… ${gb(ev.completed ?? 0)} of ${gb(ev.total)}` : (ev.status ?? "Working…").replace(/^\w/, (c) => c.toUpperCase()),
          }));
        }
      }
      if (!ok) throw new Error("The download didn't finish. Check your internet connection and try again.");
      await load();
      setPulling(null);
      if (!active) onActivate(model);
    } catch (err) {
      setPulling(null);
      if ((err as Error).name !== "AbortError") setError((err as Error).message);
    } finally {
      abortRef.current = null;
    }
  };

  if (!status) {
    return <p className="mt-6 text-sm text-muted">Looking for Local AI on this computer…</p>;
  }

  if (!status.running) {
    return (
      <div className="mt-6">
        <p className="text-sm">Local AI uses <strong className="font-semibold">Ollama</strong>, a free app that runs AI models on your own computer. No account, no key, no cost.</p>
        <ol className="mt-5 flex flex-col gap-3">
          {[
            <>
              Download Ollama from{" "}
              <a href="https://ollama.com/download" target="_blank" rel="noreferrer" className="underline underline-offset-4">
                ollama.com/download
              </a>{" "}
              (free).
            </>,
            <>Install it and open it. On Mac it sits in the menu bar; on Windows, in the system tray.</>,
            <>Come back here and click Check again.</>,
          ].map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-[11px]">{i + 1}</span>
              <span className="pt-0.5 text-muted">{step}</span>
            </li>
          ))}
        </ol>
        <Button className="mt-5" variant="outline" size="sm" icon="refresh" loading={checking} onClick={check}>
          Check again
        </Button>
      </div>
    );
  }

  const installed = status.models;
  const isInstalled = (name: string) => installed.some((m) => same(m.name, name));
  const others = installed.filter((m) => !RECOMMENDED.some((r) => same(m.name, r.name)));
  const rows = [
    ...RECOMMENDED.map((r) => ({ ...r, installed: isInstalled(r.name) })),
    ...others.map((m) => ({ name: m.name, label: "Installed", size: gb(m.size), ram: m.parameterSize ?? "", note: "", installed: true })),
  ];

  return (
    <div className="mt-6">
      <p className="flex items-center gap-2 text-sm">
        <span className="h-2 w-2 rounded-full bg-fg" /> Ollama is running{status.version ? ` (v${status.version})` : ""}. Choose a model — it downloads once and then works offline.
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {rows.map((r) => {
          const isActive = active && !!activeModel && same(activeModel, r.name);
          const isPulling = pulling?.model === r.name;
          return (
            <li key={r.name} className={cn("rounded-2xl border p-4", isActive ? "border-fg" : "border-line")}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className="font-mono">{r.name}</span>
                    <Chip active={r.label === "Recommended"}>{r.label}</Chip>
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {[r.size, r.ram].filter(Boolean).join(" · ")}
                    {r.note && ` — ${r.note}`}
                  </p>
                </div>
                {isActive ? (
                  <Chip active>
                    <Icon name="check" size={10} /> In use
                  </Chip>
                ) : r.installed ? (
                  <Button size="sm" onClick={() => onActivate(r.name)} loading={busy}>
                    Use this model
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" icon="upload" className="[&_svg]:rotate-180" disabled={!!pulling || busy} onClick={() => download(r.name)}>
                    Download
                  </Button>
                )}
              </div>
              {isPulling && (
                <div className="mt-3">
                  <ProgressBar value={pulling.pct} height={4} label={`Downloading ${r.name}`} />
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-muted">{pulling.label}</span>
                    <button onClick={() => abortRef.current?.abort()} className="text-[11px] text-faint hover:text-fg">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="mt-3 text-xs">
          {error}
        </p>
      )}
      <p className="mt-4 text-xs leading-relaxed text-faint">
        Local AI is free and private — nothing leaves your computer. It&apos;s slower and less accurate than Claude, and building a study kit can take a few minutes. Not sure how much RAM you have? Start with <span className="font-mono">gemma3:4b</span>.
      </p>
    </div>
  );
}

function ClaudeKey({ settings, active, onUse, onSaved }: { settings: DesktopSettings | null; active: boolean; onUse: () => void; onSaved: () => void }) {
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (value: string | null) => {
    const d = desktop();
    if (!d) return;
    if (value && !/^sk-ant-/.test(value.trim())) {
      setError("That doesn't look like an Anthropic API key (they start with “sk-ant-”).");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await d.setApiKey(value);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="mt-6">
      <p className="text-sm text-muted">Claude gives the best study kits and tutoring. It needs an Anthropic API key, and usage is billed to your Anthropic account (pay as you go).</p>
      {settings?.hasKey && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3">
          <span className="flex items-center gap-3 text-sm">
            <Icon name="key" size={16} />
            Key saved <span className="font-mono text-muted">{settings.keyHint}</span>
          </span>
          <span className="flex gap-1">
            {!active && (
              <Button size="sm" onClick={onUse} disabled={saving}>
                Use Claude
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => save(null)} disabled={saving}>
              Remove
            </Button>
          </span>
        </div>
      )}
      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (key.trim()) void save(key.trim());
        }}
      >
        <Input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={settings?.hasKey ? "Replace with a new key…" : "sk-ant-…"}
          aria-label="Anthropic API key"
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
        />
        <Button type="submit" loading={saving} disabled={!key.trim()}>
          {saving ? "Restarting…" : "Save key"}
        </Button>
      </form>
      {error && (
        <p role="alert" className="mt-3 text-xs">
          {error}
        </p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-faint">
        Get a key at{" "}
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-muted underline underline-offset-4 hover:text-fg">
          console.anthropic.com
        </a>
        . {settings?.encrypted ? "Your key is encrypted with your system keychain and only used on this computer." : "Your key is stored only on this computer."}
      </p>
    </div>
  );
}

const ENGINES: { id: AIProvider; title: string; blurb: string; icon: "brain" | "spark" | "stop" }[] = [
  { id: "ollama", title: "Local AI", blurb: "Free · runs on this computer", icon: "brain" },
  { id: "anthropic", title: "Claude", blurb: "Best quality · needs API key", icon: "spark" },
  { id: "off", title: "Off", blurb: "Offline generator only", icon: "stop" },
];

export function AISettings() {
  const { ai, provider, model, isDesktop } = useAI();
  const [settings, setSettings] = useState<DesktopSettings | null>(null);
  const activeEngine: AIProvider = settings?.provider ?? (provider ?? "off");
  const [view, setView] = useState<AIProvider | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = view ?? (activeEngine === "off" ? "ollama" : activeEngine);

  useEffect(() => {
    desktop()?.getSettings().then(setSettings);
  }, []);

  // Switching engines restarts the app's local server and reloads this page.
  const activate = async (p: AIProvider, ollamaModel?: string) => {
    const d = desktop();
    if (!d) return;
    setBusy(true);
    try {
      await d.setAI({ provider: p, ollamaModel });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <SectionTitle
        action={
          <Chip active={ai}>
            <span className={ai ? "h-1.5 w-1.5 rounded-full bg-bg" : "h-1.5 w-1.5 rounded-full bg-faint"} />
            {ai ? (provider === "ollama" ? `Local AI · ${model}` : "Claude on") : "AI off"}
          </Chip>
        }
      >
        AI
      </SectionTitle>
      <p className="max-w-xl text-sm leading-relaxed text-muted">
        AI builds your study kits, runs the tutor, writes Challenge questions, and grades short answers. Without it, everything still works using the offline generator.
      </p>

      {!isDesktop ? (
        <div className="mt-6 max-w-xl rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
          Running in a browser: set <code className="font-mono text-fg">SYNAPSE_AI_PROVIDER=ollama</code> (free, needs Ollama) or <code className="font-mono text-fg">ANTHROPIC_API_KEY=sk-ant-…</code> in <code className="font-mono text-fg">.env.local</code> and restart. In the desktop app you can do this here.
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-2 sm:grid-cols-3" role="tablist" aria-label="AI engine">
            {ENGINES.map((e) => (
              <button
                key={e.id}
                role="tab"
                aria-selected={shown === e.id}
                onClick={() => setView(e.id)}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border p-4 text-left transition",
                  shown === e.id ? "border-fg bg-surface-2" : "border-line hover:border-line-strong",
                )}
              >
                <Icon name={e.icon} size={18} className="mt-0.5 shrink-0" />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {e.title}
                    {activeEngine === e.id && <span className="rounded-full bg-fg px-1.5 py-0.5 font-mono text-[9px] uppercase text-bg">On</span>}
                  </span>
                  <span className="block text-xs text-muted">{e.blurb}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="max-w-2xl">
            {shown === "ollama" && (
              <LocalAI active={activeEngine === "ollama"} activeModel={settings?.ollamaModel ?? (provider === "ollama" ? model : null)} onActivate={(m) => activate("ollama", m)} busy={busy} />
            )}
            {shown === "anthropic" && <ClaudeKey settings={settings} active={activeEngine === "anthropic"} onUse={() => activate("anthropic")} onSaved={() => setBusy(true)} />}
            {shown === "off" && (
              <div className="mt-6">
                <p className="text-sm text-muted">Synapse will use its built-in offline generator. No AI tutor, and study kits are simpler.</p>
                {activeEngine !== "off" ? (
                  <Button className="mt-4" variant="outline" size="sm" loading={busy} onClick={() => activate("off")}>
                    Turn AI off
                  </Button>
                ) : (
                  <p className="mt-4 text-xs text-faint">AI is currently off.</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
