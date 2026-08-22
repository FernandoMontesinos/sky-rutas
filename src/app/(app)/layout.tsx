import Link from "next/link";
import { KeyRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ROLE_LABEL, type UserRole } from "@/lib/types";
import { LocationSharer } from "@/components/location-sharer";
import { RealtimeRefresher } from "@/components/realtime-refresher";
import { NotificationBell } from "@/components/notification-bell";
import { DesktopNav, MobileNav, type NavEntry } from "@/components/app-nav";
import { signOut } from "./actions";

type NavItem = NavEntry & { roles: UserRole[] };

const NAV: NavItem[] = [
  // Inicio no aplica al repartidor: su pantalla es la lista de órdenes y la
  // home lo redirige ahí (ver app/(app)/page.tsx).
  { href: "/", label: "Inicio", icon: "home", roles: ["admin", "vendedor", "almacen"] },
  { href: "/ordenes/nueva", label: "Nueva orden", short: "Nueva", icon: "package-plus", roles: ["admin", "vendedor"] },
  { href: "/ordenes", label: "Órdenes", icon: "clipboard-list", roles: ["admin", "vendedor", "almacen", "facturacion"] },
  { href: "/mapa", label: "Mapa", icon: "map", roles: ["admin", "almacen", "vendedor", "facturacion"] },
  { href: "/reportes", label: "Reportes", icon: "bar-chart", roles: ["admin", "almacen", "facturacion"] },
  { href: "/admin/usuarios", label: "Usuarios", icon: "users", roles: ["admin"] },
];

/**
 * El repartidor tiene su propia barra. Los demás roles gestionan desde un
 * escritorio y les sirve ver el tablero entero de un vistazo; él trabaja en la
 * calle, en movimiento y con una mano, y una sola pantalla con las tres etapas
 * apiladas lo obliga a scrollear para saber qué le queda por hacer.
 *
 * Cada etapa de su día pasa a ser una pestaña, y la barra inferior —que antes
 * tenía una única entrada "Órdenes", desaprovechada— se vuelve el control
 * principal. La primera no lleva parámetro para que `/ordenes` a secas caiga
 * ahí (ver useActiveHref en app-nav.tsx).
 */
const NAV_REPARTIDOR: NavEntry[] = [
  { href: "/ordenes", label: "Por hacer", icon: "list-todo" },
  {
    href: "/ordenes?panel=recogidas",
    label: "Recogidas (por cerrar)",
    short: "Recogidas",
    icon: "truck",
  },
  { href: "/ordenes?panel=completadas", label: "Completadas", short: "Listas", icon: "check-circle" },
  { href: "/mapa", label: "Mapa", icon: "map" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, profile } = await requireUser();
  const items =
    profile.role === "repartidor"
      ? NAV_REPARTIDOR
      : NAV.filter((i) => i.roles.includes(profile.role));

  return (
    <div className="flex min-h-screen flex-col">
      <RealtimeRefresher />
      {/*
        El header es de ancho completo siempre (igual en toda página, angosta
        o ancha) para que no quede como una caja flotando desalineada sobre
        el contenido de las pantallas anchas (Órdenes/Mapa/Reportes). El
        padding lateral responsivo evita que se vea pegado al borde.
      */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="SkyHigh" className="h-8 w-auto" />
            <span className="text-sm font-semibold text-gray-400">Rutas</span>
          </Link>

          <div className="ml-auto flex min-w-0 items-center gap-2 text-sm">
            <span className="truncate text-gray-500">
              <span className="max-w-[110px] truncate align-bottom sm:max-w-none">
                {profile.full_name}
              </span>
              <span className="hidden sm:inline"> · {ROLE_LABEL[profile.role]}</span>
            </span>
            <NotificationBell userId={userId} role={profile.role} />
            <Link
              href="/cuenta"
              aria-label="Mi cuenta"
              title="Mi cuenta"
              className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-brand"
            >
              <KeyRound className="h-5 w-5" strokeWidth={2.25} />
            </Link>
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
          <div className="px-4 pb-2 sm:px-6 lg:px-8">
            <LocationSharer />
          </div>
        )}
      </header>

      {/*
        Ancho completo por defecto: Órdenes, Mapa y Reportes son pantallas
        densas que deben usar todo el espacio disponible. Las páginas de
        lectura/formulario (Inicio, Nueva orden, detalle de orden) se
        angostan ellas mismas con su propio wrapper "max-w-4xl mx-auto".
        pb extra en móvil para que la barra inferior no tape el contenido.
      */}
      <main className="w-full flex-1 px-4 py-6 pb-24 sm:px-6 sm:pb-6 lg:px-8">
        {children}
      </main>

      <MobileNav items={items} />
    </div>
  );
}
