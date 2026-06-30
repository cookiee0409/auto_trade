"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  BrainCircuit,
  FileUp,
  Gauge,
  ListChecks,
  ScrollText,
  Settings,
  Target
} from "lucide-react";
import { AuthPanel } from "@/components/auth-panel";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/trades", label: "Trades", icon: ScrollText },
  { href: "/strategies", label: "Strategies", icon: Target },
  { href: "/trendline", label: "Trendline", icon: Activity },
  { href: "/rules", label: "Rules", icon: ListChecks },
  { href: "/ai-review", label: "AI Review", icon: BrainCircuit },
  { href: "/imports", label: "Imports", icon: FileUp },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="border-b border-line bg-ink/95 px-3 py-3 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:border-b-0 lg:border-r">
      <div className="mb-4 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-info/15 text-info">
          <BarChart3 size={21} aria-hidden />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">AI Trade Review Lab</div>
          <div className="text-xs text-slate-400">Process over outcome</div>
        </div>
      </div>
      <nav className="flex gap-2 overflow-x-auto lg:block lg:space-y-1 lg:overflow-visible">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 transition hover:bg-white/7 hover:text-white",
                active && "bg-info/15 text-info"
              )}
            >
              <Icon size={18} aria-hidden />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="hidden lg:block">
        <AuthPanel />
      </div>
    </aside>
  );
}
