"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { playerLevel, titleFor } from "@/lib/levels";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "../ui/Icon";
import { Ring } from "../ui/Progress";
import { EventLayer } from "./EventLayer";
import { AssistantDrawer } from "../assistant/AssistantDrawer";
import { useAI } from "./Providers";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Dashboard", icon: "home" },
  { href: "/subjects", label: "Subjects", icon: "layers" },
  { href: "/study", label: "Study", icon: "play" },
  { href: "/ai", label: "AI", icon: "spark" },
  { href: "/progress", label: "Progress", icon: "chart" },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Synapse home">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" fill="currentColor" />
        <circle cx="4" cy="6" r="1.6" fill="currentColor" opacity="0.7" />
        <circle cx="20" cy="7" r="1.6" fill="currentColor" opacity="0.7" />
        <circle cx="18" cy="20" r="1.6" fill="currentColor" opacity="0.7" />
        <path d="M4 6 12 12 20 7M12 12l6 8" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      </svg>
      <span className="font-mono text-[13px] font-medium tracking-[0.3em]">SYNAPSE</span>
    </Link>
  );
}

function PlayerChip() {
  const xp = useStore((s) => s.player.xp);
  const lv = playerLevel(xp);
  return (
    <Link href="/progress" className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition hover:border-line-strong">
      <Ring value={lv.progress} size={44} stroke={3} label={`Level ${lv.level}`}>
        <span className="num text-sm font-semibold">{lv.level}</span>
      </Ring>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{titleFor(lv.level)}</p>
        <p className="num font-mono text-[11px] text-muted">
          {lv.current}/{lv.needed} XP
        </p>
      </div>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const openAssistant = useStore((s) => s.openAssistant);
  const assistantOpen = useStore((s) => s.assistantOpen);
  const inSession = /^\/study\/[^/]+\/[^/]+/.test(path);
  const { isDesktop } = useAI();

  return (
    <div className="min-h-[calc(100vh_-_var(--tb))]">
      {isDesktop && (
        <div className="titlebar" aria-hidden="true">
          <span className="font-mono text-[10px] tracking-[0.3em] text-faint">SYNAPSE</span>
        </div>
      )}
      {/* Desktop sidebar */}
      <aside className="fixed bottom-0 left-0 top-[var(--tb)] z-30 hidden w-60 flex-col border-r border-line bg-bg px-4 py-6 lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <nav className="mt-10 flex flex-col gap-1" aria-label="Main">
          {NAV.map((n) => {
            const active = isActive(path, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
                  active ? "text-fg" : "text-muted hover:text-fg",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl border border-line bg-surface-2"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                )}
                <Icon name={n.icon} className="relative" />
                <span className="relative">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          <Link
            href="/settings"
            aria-current={path.startsWith("/settings") ? "page" : undefined}
            className={cn("flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors", path.startsWith("/settings") ? "bg-surface-2 text-fg" : "text-muted hover:text-fg")}
          >
            <Icon name="gear" />
            Settings
          </Link>
          <PlayerChip />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-[var(--tb)] z-30 flex h-14 items-center justify-between border-b border-line bg-bg/80 px-4 backdrop-blur-xl lg:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <LevelPill />
          <Link href="/settings" aria-label="Settings" className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-fg">
            <Icon name="gear" size={18} />
          </Link>
        </div>
      </header>

      <main className={cn("lg:pl-60", !inSession && "pb-28 lg:pb-12")}>
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 lg:px-10 lg:pt-10">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      {!inSession && (
        <nav
          aria-label="Main"
          className="fixed inset-x-3 bottom-3 z-30 flex h-16 items-center justify-around rounded-2xl border border-line-strong bg-surface/90 backdrop-blur-xl lg:hidden"
        >
          {NAV.map((n) => {
            const active = isActive(path, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex flex-col items-center gap-1 px-3 py-1 text-[10px] transition", active ? "text-fg" : "text-faint")}
              >
                <Icon name={n.icon} size={20} />
                {n.label}
              </Link>
            );
          })}
        </nav>
      )}

      {/* Floating assistant */}
      {!assistantOpen && path !== "/ai" && (
        <motion.button
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => openAssistant()}
          aria-label="Open AI study assistant"
          className={cn(
            "fixed right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-invert pl-4 pr-5 text-invert-fg shadow-[0_10px_40px_-10px_var(--glow)] lg:bottom-8 lg:right-8",
            inSession ? "bottom-4" : "bottom-24",
          )}
        >
          <Icon name="spark" size={20} />
          <span className="text-sm font-medium">Ask Synapse</span>
        </motion.button>
      )}

      <AssistantDrawer />
      <EventLayer />
    </div>
  );
}

function LevelPill() {
  const xp = useStore((s) => s.player.xp);
  const streak = useStore((s) => s.player.streak);
  const lv = playerLevel(xp);
  return (
    <Link href="/progress" className="flex items-center gap-3 rounded-full border border-line px-3 py-1.5">
      <span className="flex items-center gap-1 font-mono text-xs text-muted">
        <Icon name="flame" size={13} /> {streak}
      </span>
      <span className="h-3 w-px bg-line-strong" />
      <span className="font-mono text-xs">LV {lv.level}</span>
    </Link>
  );
}
