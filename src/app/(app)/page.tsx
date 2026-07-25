import Link from "next/link";
import { PackagePlus, PackageCheck, Truck, ClipboardList, Bell } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL } from "@/lib/types";
import { PushPrompt } from "@/components/push-prompt";

function tiempoRelativo(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit" });
}

export default async function HomePage() {
  const { userId, profile } = await requireUser();
  const supabase = await createClient();

  // Conteos según rol
  const base = () => supabase.from("orders").select("*", { count: "exact", head: true });

  const [pendientes, asignadas, completadasHoy, { data: actividad }] = await Promise.all([
    base().eq("estado", "pendiente"),
    profile.role === "repartidor"
      ? base().eq("estado", "asignado").eq("assigned_to", userId)
      : base().eq("estado", "asignado"),
    base()
      .eq("estado", "completado")
      .gte("completed_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    supabase
      .from("notifications")
      .select("id, titulo, mensaje, order_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const cards = [
    {
      label: profile.role === "repartidor" ? "Por hacer" : "Pendientes",
      value: profile.role === "repartidor" ? asignadas.count ?? 0 : pendientes.count ?? 0,
      tone: "bg-gray-100 text-gray-800",
    },
    {
      label: profile.role === "repartidor" ? "Asignadas a ti" : "Asignadas",
      value: asignadas.count ?? 0,
      tone: "bg-amber-50 text-amber-800",
    },
    {
      label: "Completadas hoy",
      value: completadasHoy.count ?? 0,
      tone: "bg-green-50 text-green-800",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          Hola, {profile.full_name.split(" ")[0]}
          <span className="inline-block origin-[70%_70%] animate-[wave_1.8s_ease-in-out_1]">
            👋
          </span>
        </h1>
        <p className="text-gray-500">{ROLE_LABEL[profile.role]}</p>
      </div>

      <PushPrompt userId={userId} />

      <div className="grid grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-2xl p-4 ${c.tone}`}>
            <div className="text-3xl font-black">{c.value}</div>
            <div className="text-xs font-medium opacity-80">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {(profile.role === "admin" || profile.role === "vendedor") && (
          <Link
            href="/ordenes/nueva"
            className="flex items-start gap-3 rounded-2xl bg-brand p-5 font-semibold text-white shadow transition hover:bg-brand-dark hover:shadow-md"
          >
            <PackagePlus className="mt-0.5 h-6 w-6 shrink-0" strokeWidth={2} />
            <span>
              Subir nueva orden
              <span className="mt-1 block text-sm font-normal opacity-90">
                Pega la imagen de la orden y registra entrega o recojo
              </span>
            </span>
          </Link>
        )}

        {(profile.role === "admin" || profile.role === "almacen") && (
          <Link
            href="/ordenes?estado=pendiente"
            className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-5 font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 hover:shadow"
          >
            <PackageCheck className="mt-0.5 h-6 w-6 shrink-0 text-brand" strokeWidth={2} />
            <span>
              Asignar órdenes a repartidores
              <span className="mt-1 block text-sm font-normal text-gray-500">
                {pendientes.count ?? 0} pendiente(s) por asignar
              </span>
            </span>
          </Link>
        )}

        {profile.role === "repartidor" && (
          <Link
            href="/ordenes"
            className="flex items-start gap-3 rounded-2xl bg-brand p-5 font-semibold text-white shadow transition hover:bg-brand-dark hover:shadow-md"
          >
            <Truck className="mt-0.5 h-6 w-6 shrink-0" strokeWidth={2} />
            <span>
              Ver mi ruta del día
              <span className="mt-1 block text-sm font-normal opacity-90">
                Entra a cada orden y toma la foto de la guía
              </span>
            </span>
          </Link>
        )}

        <Link
          href="/ordenes"
          className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-5 font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 hover:shadow"
        >
          <ClipboardList className="h-6 w-6 shrink-0 text-brand" strokeWidth={2} />
          Ver todas las órdenes
        </Link>
      </div>

      {actividad && actividad.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
            <Bell className="h-4 w-4" strokeWidth={2.25} />
            Actividad reciente
          </h2>
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            {actividad.map((n, i) => (
              <Link
                key={n.id}
                href={n.order_id ? `/ordenes/${n.order_id}` : "/ordenes"}
                className={`flex items-start justify-between gap-3 px-4 py-3 text-sm transition hover:bg-gray-50 ${
                  i > 0 ? "border-t border-gray-100" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-gray-800">{n.titulo}</div>
                  <div className="truncate text-xs text-gray-500">{n.mensaje}</div>
                </div>
                <span className="shrink-0 text-xs text-gray-400">{tiempoRelativo(n.created_at)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
