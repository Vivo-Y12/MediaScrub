import type { ReactNode } from "react";
import { ShieldCheck, WifiOff } from "lucide-react";

export default function WorkspaceShell({
  kicker,
  title,
  description,
  children,
}: {
  kicker: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <div className="grid-bg pointer-events-none absolute inset-x-0 top-0 h-[380px]" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-5 pb-24 pt-12 sm:px-8">
        <p className="kicker">{kicker}</p>
        <h1 className="font-display mt-3 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-dim sm:text-base">{description}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-acid/30 bg-acid/5 px-3 py-1 font-mono text-[0.65rem] uppercase tracking-wider text-acid">
            <ShieldCheck className="size-3" /> processing: this device
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 px-3 py-1 font-mono text-[0.65rem] uppercase tracking-wider text-dim">
            <WifiOff className="size-3" /> network: silent for media
          </span>
        </div>
        <div className="mt-10">{children}</div>
      </div>
    </div>
  );
}
