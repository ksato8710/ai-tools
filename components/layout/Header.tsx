"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-50 bg-cream/80 backdrop-blur-md border-b border-border-light"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div className="max-w-7xl mx-auto pl-20 pr-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          <span className="text-xl font-bold font-[family-name:var(--font-nunito)] text-accent-leaf">
            AI Tools
          </span>
          <span className="text-xs text-text-muted font-medium bg-card px-2 py-0.5 rounded-full">
            Suite
          </span>
        </Link>

        <nav className="flex items-center gap-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          <NavLink href="/" active={pathname === "/"}>
            Home
          </NavLink>
          <NavLink href="/er-diagram" active={pathname === "/er-diagram"}>
            ER Diagram
          </NavLink>
          <NavLink href="/variant-ui" active={pathname === "/variant-ui"}>
            Variant UI
          </NavLink>
          <NavLink href="/presentation" active={pathname === "/presentation"}>
            Presentation
          </NavLink>
          <NavLink href="/app-inspector" active={pathname.startsWith("/app-inspector")}>
            App Inspector
          </NavLink>
          <NavLink href="/meeting" active={pathname === "/meeting"}>
            Meeting
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
        active
          ? "bg-accent-leaf text-white font-medium"
          : "text-text-secondary hover:bg-card hover:text-text-primary"
      }`}
    >
      {children}
    </Link>
  );
}
