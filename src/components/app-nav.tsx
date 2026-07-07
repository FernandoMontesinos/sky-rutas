"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavEntry = {
  href: string;
  label: string;
  /** Etiqueta corta para la barra inferior móvil (si no, usa label). */
  short?: string;
  icon: string;
};

/** Devuelve el href del item activo: el prefijo más largo que calza con la ruta. */
function useActiveHref(items: NavEntry[]) {
  const pathname = usePathname();
  let best = "";
  for (const i of items) {
    const match =
      pathname === i.href || (i.href !== "/" && pathname.startsWith(i.href + "/"));
    if (match && i.href.length > best.length) best = i.href;
  }
  return best;
}

/** Fila de enlaces del header (solo pantallas sm en adelante). */
export function DesktopNav({ items }: { items: NavEntry[] }) {
  const active = useActiveHref(items);
  return (
    <nav className="mx-auto hidden max-w-4xl gap-1 px-2 pb-2 sm:flex">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            active === i.href
              ? "bg-brand/10 text-brand"
              : "text-gray-600 hover:bg-brand/10 hover:text-brand"
          }`}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

/** Barra de navegación inferior fija (solo móvil). */
export function MobileNav({ items }: { items: NavEntry[] }) {
  const active = useActiveHref(items);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_3px_rgba(0,0,0,0.06)] sm:hidden">
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
              active === i.href ? "text-brand" : "text-gray-500"
            }`}
          >
            <span className="text-xl leading-none">{i.icon}</span>
            {i.short ?? i.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
