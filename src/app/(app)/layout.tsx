import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ROLE_LABEL, type UserRole } from "@/lib/types";
import { LocationSharer } from "@/components/location-sharer";
import { RealtimeRefresher } from "@/components/realtime-refresher";
import { DesktopNav, MobileNav, type NavEntry } from "@/components/app-nav";
import { signOut } from "./actions";

type NavItem = NavEntry & { roles: UserRole[] };

const NAV: NavItem[] = [
  { href: "/", label: "Inicio", icon: "home", roles: ["admin", "vendedor", "almacen", "repartidor"] },
  { href: "/ordenes/nueva", label: "Nueva orden", short: "Nueva", icon: "package-plus", roles: ["admin", "vendedor"] },
  { href: "/ordenes", label: "Órdenes", icon: "clipboard-list", roles: ["admin", "vendedor", "almacen", "repartidor"] },
  { href: "/mapa", label: "Mapa", icon: "map", roles: ["admin", "almacen"] },
  { href: "/reportes", label: "Reportes", icon: "bar-chart", roles: ["admin", "almacen"] },
  { href: "/admin/usuarios", label: "Usuarios", icon: "users", roles: ["admin"] },
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
      <RealtimeRefresher />
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="SkyHigh" className="h-8 w-auto" />
            <span className="text-sm font-semibold text-gray-400">Rutas</span>
          </Link>

          <div className="ml-auto flex min-w-0 items-center gap-3 text-sm">
            <span className="truncate text-gray-500">
              <span className="max-w-[110px] truncate align-bottom sm:max-w-none">
                {profile.full_name}
              </span>
              <span className="hidden sm:inline"> · {ROLE_LABEL[profile.role]}</span>
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

        <DesktopNav items={items} />

        {profile.role === "repartidor" && (
          <div className="mx-auto max-w-4xl px-4 pb-2">
            <LocationSharer />
          </div>
        )}
      </header>

      {/* pb extra en móvil para que la barra inferior no tape el contenido */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 pb-24 sm:pb-6">
        {children}
      </main>

      <MobileNav items={items} />
    </div>
  );
}
