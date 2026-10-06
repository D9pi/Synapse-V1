import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  as: As = "div",
  ...rest
}: { as?: "div" | "section" | "article" } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <As className={cn("rounded-3xl border border-line bg-surface p-5 sm:p-6", className)} {...rest}>
      {children}
    </As>
  );
}

export function SectionTitle({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex items-center justify-between gap-3", className)}>
      <h2 className="label">{children}</h2>
      {action}
    </div>
  );
}

export function Chip({ children, className, active }: { children: React.ReactNode; className?: string; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em]",
        active ? "border-fg bg-fg text-bg" : "border-line text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, body, action, className }: { title: string; body?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-3xl border border-dashed border-line px-6 py-12 text-center", className)}>
      <p className="text-base font-medium">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
