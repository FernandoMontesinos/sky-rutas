import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ROLE_LABEL, type UserRole } from "@/lib/types";
import { signOut } from "./actions";

type NavItem = { href: string; label: string; roles: UserRole[] };

const NAV: NavItem[] = [
  { href: "/", label: "Inicio", roles: ["admin", "vendedor", "almacen", "repartidor"] },
  { href: "/ordenes/nueva", label: "Nueva orden", roles: ["admin", "vendedor"] },
  { href: "/ordenes", label: "Órdenes", roles: ["admin", "vendedor", "almacen", "repartidor"] },
  { href: "/mapa", label: "Mapa", roles: ["admin", "almacen"] },
  { href: "/admin/usuarios", label: "Usuarios", roles: ["admin"] },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireUser();
  const items = NAV.filter((i) => i.roles.includes(profile.role));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-black text-white">
              SH
            </span>
            <span className="font-bold text-gray-900">SkyHigh Rutas</span>
          </Link>

          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-gray-500 sm:inline">
              {profile.full_name} · {ROLE_LABEL[profile.role]}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-gray-300 px-3 py-1.5 font-medium text-gray-700 transition hover:bg-gray-100"
              >
                Salir
              </button>
            </form>
          </div>
        </div>

        <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-2 pb-2">
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-brand/10 hover:text-brand"
            >
              {i.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
